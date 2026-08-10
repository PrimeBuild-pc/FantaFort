-- Granular, fail-closed badge administration.
-- General admin mutations and badge mutations become independent capabilities:
-- neither switch implies the other, and a missing configuration means disabled.

alter table public.admin_runtime_config
  add column badge_mutations_enabled boolean not null default false;

-- The step-up grant table is the single choke point for every admin mutation, so the
-- per-scope capability is decided here instead of duplicating a second kill switch.
create or replace function public.enforce_admin_mutation_runtime()
returns trigger language plpgsql security definer set search_path = public
as $$
declare config public.admin_runtime_config;
begin
  select * into config from public.admin_runtime_config where singleton;
  if not coalesce(
    case when new.scope = 'badge' then config.badge_mutations_enabled else config.mutations_enabled end,
    false
  ) then
    raise insufficient_privilege using message = 'Admin mutations disabled';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_admin_mutation_runtime() from public, anon, authenticated;

-- "automatic" implied an unattended award that no code performs. Founding 50 is granted
-- once, by an administrator, only to an account the verified preview already lists.
alter table public.badges drop constraint badges_assignment_type_check;
alter table public.badges add constraint badges_assignment_type_check
  check (assignment_type in ('automatic', 'verified', 'manual', 'dynamic'));
update public.badges set assignment_type = 'verified' where slug = 'founding-50';

-- Founding 50 verification: administrators and technical accounts are never candidates.
drop function public.admin_preview_founding_50();
create function public.admin_preview_founding_50()
returns table (
  candidate_order bigint,
  user_id uuid,
  username text,
  account_status text,
  registered_at timestamptz,
  email_confirmed boolean,
  already_awarded boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.authorize_admin_request();
  return query
  select row_number() over (order by auth_user.created_at, profile.id)::bigint,
    profile.id, profile.username, profile.account_status, auth_user.created_at,
    auth_user.email_confirmed_at is not null,
    exists(
      select 1 from public.user_badges award
      join public.badges badge on badge.id = award.badge_id
      where award.user_id = profile.id and badge.slug = 'founding-50'
    )
  from public.profiles profile
  join auth.users auth_user on auth_user.id = profile.id
  where profile.account_status <> 'anonymized'
    and not profile.is_admin
    and auth_user.deleted_at is null
    and (auth_user.banned_until is null or auth_user.banned_until <= now())
    and nullif(auth_user.raw_user_meta_data ->> 'test_marker', '') is null
  order by auth_user.created_at, profile.id
  limit 50;
end;
$$;

-- Consume-time capability check so disabling the switch stops in-flight grants immediately.
create or replace function public.admin_set_user_badge(
  target_user_id uuid,
  target_badge_slug text,
  assign_badge boolean,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_badge public.badges;
  prior public.admin_audit_log;
  action_name text := case when assign_badge then 'badge.assign' else 'badge.remove' end;
  had_badge boolean;
begin
  perform public.authorize_admin_request();
  if target_user_id = auth.uid()
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

  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = action_name and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_user_id::text
      or coalesce(prior.after_state ->> 'badge', prior.before_state ->> 'badge') <> target_badge_slug then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('before', prior.before_state, 'after', prior.after_state, 'replayed', true);
  end if;

  perform public.consume_admin_step_up_grant(step_up_token_hash, 'badge', target_user_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-badge:' || target_user_id::text || ':' || target_badge_slug, 0));
  if not exists(select 1 from public.profiles where id = target_user_id and account_status = 'active' and not is_admin) then
    raise invalid_parameter_value using message = 'User unavailable';
  end if;
  select * into target_badge from public.badges where slug = target_badge_slug and assignment_type <> 'dynamic';
  if target_badge.id is null then raise invalid_parameter_value using message = 'Badge unavailable'; end if;
  if target_badge.slug = 'founding-50' and not exists(
    select 1 from public.admin_preview_founding_50() candidate where candidate.user_id = target_user_id
  ) then raise invalid_parameter_value using message = 'User is not a verified Founding 50 candidate'; end if;
  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action in ('badge.assign', 'badge.remove') and created_at > now() - interval '1 hour') >= 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  select exists(select 1 from public.user_badges where user_id = target_user_id and badge_id = target_badge.id) into had_badge;
  if assign_badge and not had_badge then
    insert into public.user_badges(user_id, badge_id, awarded_by, reason, source)
    values (target_user_id, target_badge.id, auth.uid(), trim(action_reason), 'admin');
  elsif not assign_badge and had_badge then
    delete from public.user_badges where user_id = target_user_id and badge_id = target_badge.id;
  end if;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), action_name, 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('badge', target_badge.slug, 'assigned', had_badge),
    jsonb_build_object('badge', target_badge.slug, 'assigned', assign_badge),
    action_request_id, action_idempotency_key, 'succeeded');
  return jsonb_build_object(
    'before', jsonb_build_object('badge', target_badge.slug, 'assigned', had_badge),
    'after', jsonb_build_object('badge', target_badge.slug, 'assigned', assign_badge),
    'replayed', false
  );
end;
$$;

revoke all on function public.admin_preview_founding_50() from public, anon, authenticated;
grant execute on function public.admin_preview_founding_50() to authenticated, service_role;

notify pgrst, 'reload schema';
