-- Founding 50: separate the historical slot from current awardability.
--
-- Eligibility uses only authoritative, stable database facts: administrator flag,
-- profile account status, auth soft-deletion, auth ban and the `test_marker` metadata
-- that every technical account must carry. Nickname shape and email domain are NOT
-- criteria: they are unstable heuristics and a real player may legitimately match them.
--
-- A suspended account keeps its historical position among the first 50 real accounts but
-- cannot receive the badge until it is active again. An unconfirmed email is reported for
-- information only and never blocks the award.

drop function public.admin_preview_founding_50();
create function public.admin_preview_founding_50()
returns table (
  candidate_order bigint,
  user_id uuid,
  username text,
  account_status text,
  registered_at timestamptz,
  email_confirmed boolean,
  historical_candidate boolean,
  currently_awardable boolean,
  award_block_reason text,
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
  with historical as (
    select row_number() over (order by auth_user.created_at, profile.id)::bigint as slot,
      profile.id as profile_id,
      profile.username as nickname,
      profile.account_status as status,
      auth_user.created_at as registered,
      auth_user.email_confirmed_at is not null as confirmed
    from public.profiles profile
    join auth.users auth_user on auth_user.id = profile.id
    where profile.account_status <> 'anonymized'
      and not profile.is_admin
      and auth_user.deleted_at is null
      and (auth_user.banned_until is null or auth_user.banned_until <= now())
      and nullif(auth_user.raw_user_meta_data ->> 'test_marker', '') is null
    order by auth_user.created_at, profile.id
    limit 50
  )
  select candidate.slot,
    candidate.profile_id,
    candidate.nickname,
    candidate.status,
    candidate.registered,
    candidate.confirmed,
    true,
    candidate.status = 'active',
    case when candidate.status <> 'active' then candidate.status end,
    exists(
      select 1 from public.user_badges award
      join public.badges badge on badge.id = award.badge_id
      where award.user_id = candidate.profile_id and badge.slug = 'founding-50'
    )
  from historical candidate
  order by candidate.slot;
end;
$$;

-- Holding a historical slot is not enough: the award requires current awardability.
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
    select 1 from public.admin_preview_founding_50() candidate
    where candidate.user_id = target_user_id and candidate.currently_awardable
  ) then raise invalid_parameter_value using message = 'User is not a currently awardable Founding 50 candidate'; end if;
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
