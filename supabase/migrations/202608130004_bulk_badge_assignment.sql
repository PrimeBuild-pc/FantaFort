-- Bulk badge assignment behind a single step-up.
--
-- Awarding Founding 50 to 30 accounts previously meant 30 separate grants and 30
-- TOTP codes, which also collided with the 20-grants-per-10-minutes limit. The
-- constraint that made that necessary is real: a grant is bound to exactly one
-- target so it cannot be redirected at another account (confused deputy).
--
-- This keeps that property by binding a grant to an explicit, enumerated target
-- SET instead of loosening the binding. The grant is still one-time, still bound
-- to the admin, the auth session and the scope; consumption requires the caller to
-- present exactly the same set, so a grant minted for 30 named accounts cannot be
-- spent on a 31st. Every individual award still writes its own audit row, so
-- nothing about traceability or non-repudiation is traded away for convenience.
--
-- The batch is all-or-nothing: one ineligible target aborts the whole call rather
-- than silently awarding a subset. The admin console already shows awardability per
-- candidate, so an invalid selection is visible before submitting.

alter table public.admin_step_up_grants
  add column if not exists target_user_ids uuid[];

-- A grant addresses one account or one enumerated set, never both and never neither
-- (older scopes that predate targeting are unaffected: both stay null there).
alter table public.admin_step_up_grants
  drop constraint if exists admin_step_up_grants_single_target;
alter table public.admin_step_up_grants
  add constraint admin_step_up_grants_single_target
  check (target_user_id is null or target_user_ids is null);

create or replace function public.create_admin_step_up_grant_batch(
  grant_token_hash text,
  grant_scope text,
  grant_target_user_ids uuid[]
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  session_id text := auth.jwt() ->> 'session_id';
  unique_targets uuid[];
begin
  perform public.authorize_admin_request();
  -- Batching is granted only to the badge capability: it is cosmetic and reversible.
  -- Wallet, role, status and anonymisation stay one-target-per-approval by design.
  if session_id is null or grant_token_hash !~ '^[a-f0-9]{64}$' or grant_scope <> 'badge' then
    raise invalid_parameter_value using message = 'Invalid step-up request';
  end if;

  select array_agg(distinct target order by target) into unique_targets
  from unnest(coalesce(grant_target_user_ids, '{}'::uuid[])) target;

  if unique_targets is null or array_length(unique_targets, 1) not between 1 and 50
    or auth.uid() = any(unique_targets)
    or (select count(*) from public.profiles
        where id = any(unique_targets) and not is_admin) <> array_length(unique_targets, 1) then
    raise invalid_parameter_value using message = 'Invalid step-up request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-step-up:' || auth.uid()::text, 0));
  delete from public.admin_step_up_grants where expires_at <= now();
  if (select count(*) from public.admin_step_up_grants
      where admin_user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise program_limit_exceeded using message = 'Step-up rate limit reached';
  end if;
  insert into public.admin_step_up_grants(token_hash, admin_user_id, auth_session_id, scope, target_user_ids, expires_at)
  values (grant_token_hash, auth.uid(), session_id, grant_scope, unique_targets, now() + interval '5 minutes');
end;
$$;

-- Consumption demands the exact same set the grant was minted for.
create or replace function public.consume_admin_step_up_grant_batch(
  grant_token_hash text,
  grant_scope text,
  grant_target_user_ids uuid[]
)
returns void language plpgsql security definer set search_path = public
as $$
declare requested uuid[];
begin
  perform public.authorize_admin_request();
  select array_agg(distinct target order by target) into requested
  from unnest(coalesce(grant_target_user_ids, '{}'::uuid[])) target;

  update public.admin_step_up_grants set used_at = now()
  where token_hash = grant_token_hash
    and admin_user_id = auth.uid()
    and auth_session_id = auth.jwt() ->> 'session_id'
    and scope = grant_scope
    and target_user_ids = requested
    and expires_at > now()
    and used_at is null;
  if not found then
    raise insufficient_privilege using message = 'Step-up authorization required';
  end if;
end;
$$;

create or replace function public.admin_set_user_badges_bulk(
  target_user_ids uuid[],
  target_badge_slug text,
  assign_badge boolean,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  target_badge public.badges;
  prior public.admin_audit_log;
  action_name text := case when assign_badge then 'badge.assign' else 'badge.remove' end;
  targets uuid[];
  target_count integer;
  current_target uuid;
  had_badge boolean;
  changed integer := 0;
begin
  perform public.authorize_admin_request();

  select array_agg(distinct target order by target) into targets
  from unnest(coalesce(target_user_ids, '{}'::uuid[])) target;
  target_count := coalesce(array_length(targets, 1), 0);

  if target_count not between 1 and 50
    or auth.uid() = any(targets)
    or assign_badge is null
    or target_badge_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid badge request';
  end if;
  if not coalesce((select badge_mutations_enabled from public.admin_runtime_config where singleton), false) then
    raise insufficient_privilege using message = 'Badge mutations disabled';
  end if;

  -- Replaying the same key returns the recorded batch instead of awarding twice.
  -- Each target gets its own audit row keyed `<key>:<uuid>`, so the replay probe
  -- matches on that exact prefix. Compared with left() rather than LIKE because the
  -- key is caller-supplied and `%` or `_` in it would otherwise widen the match.
  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = action_name
    and left(idempotency_key, char_length(action_idempotency_key) + 1) = action_idempotency_key || ':';
  if prior.id is not null then
    if coalesce(prior.after_state ->> 'badge', prior.before_state ->> 'badge') <> target_badge_slug then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('badge', target_badge_slug, 'processed', 0, 'replayed', true);
  end if;

  perform public.consume_admin_step_up_grant_batch(step_up_token_hash, 'badge', targets);

  select * into target_badge from public.badges where slug = target_badge_slug and assignment_type <> 'dynamic';
  if target_badge.id is null then raise invalid_parameter_value using message = 'Badge unavailable'; end if;

  -- The hourly ceiling counts the whole batch up front, not one row at a time.
  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action in ('badge.assign', 'badge.remove')
      and created_at > now() - interval '1 hour') + target_count > 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  -- All-or-nothing: validate every target before writing anything, so a single
  -- ineligible account cannot leave the batch half applied.
  if (select count(*) from public.profiles
      where id = any(targets) and account_status = 'active' and not is_admin) <> target_count then
    raise invalid_parameter_value using message = 'One or more users are unavailable';
  end if;
  if target_badge.slug = 'founding-50' and (
    select count(*) from public.admin_preview_founding_50() candidate
    where candidate.user_id = any(targets) and candidate.currently_awardable) <> target_count then
    raise invalid_parameter_value using message = 'One or more users are not currently awardable Founding 50 candidates';
  end if;

  foreach current_target in array targets loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('admin-badge:' || current_target::text || ':' || target_badge_slug, 0));
    select exists(select 1 from public.user_badges
      where user_id = current_target and badge_id = target_badge.id) into had_badge;

    if assign_badge and not had_badge then
      insert into public.user_badges(user_id, badge_id, awarded_by, reason, source)
      values (current_target, target_badge.id, auth.uid(), trim(action_reason), 'admin');
      changed := changed + 1;
    elsif not assign_badge and had_badge then
      delete from public.user_badges where user_id = current_target and badge_id = target_badge.id;
      changed := changed + 1;
    end if;

    -- One audit row per award: a batch approval must not collapse into one entry.
    -- admin_audit_log is unique on (actor, request_id) and (actor, action, idempotency
    -- key), so both are derived per target. The derivation is deterministic from the
    -- batch request id, and the original is kept in after_state, so every row remains
    -- correlatable back to the single approval that authorised it.
    insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
      before_state, after_state, request_id, idempotency_key, outcome)
    values (auth.uid(), action_name, 'user', current_target::text, trim(action_reason),
      jsonb_build_object('badge', target_badge.slug, 'assigned', had_badge),
      jsonb_build_object('badge', target_badge.slug, 'assigned', assign_badge,
        'batch', true, 'batchRequestId', action_request_id),
      (md5(action_request_id::text || ':' || current_target::text))::uuid,
      action_idempotency_key || ':' || current_target::text, 'succeeded');
  end loop;

  return jsonb_build_object('badge', target_badge.slug, 'processed', target_count,
    'changed', changed, 'replayed', false);
end;
$$;

revoke all on function
  public.create_admin_step_up_grant_batch(text, text, uuid[]),
  public.consume_admin_step_up_grant_batch(text, text, uuid[]),
  public.admin_set_user_badges_bulk(uuid[], text, boolean, text, uuid, text, text) from public, anon, authenticated;
grant execute on function
  public.create_admin_step_up_grant_batch(text, text, uuid[]),
  public.admin_set_user_badges_bulk(uuid[], text, boolean, text, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
