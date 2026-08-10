-- Badge administration uses the existing fail-closed mutation controls and a dedicated target-bound scope.
alter table public.admin_step_up_grants drop constraint admin_step_up_grants_scope_check;
alter table public.admin_step_up_grants add constraint admin_step_up_grants_scope_check
  check (scope in ('role', 'economy', 'recovery', 'anonymize', 'account_status', 'session_revoke', 'badge'));

create or replace function public.create_admin_step_up_grant(
  grant_token_hash text,
  grant_scope text,
  grant_target_user_id uuid
)
returns void language plpgsql security definer set search_path = public
as $$
declare session_id text := auth.jwt() ->> 'session_id';
begin
  perform public.authorize_admin_request();
  if session_id is null or grant_token_hash !~ '^[a-f0-9]{64}$'
    or grant_scope not in ('account_status', 'session_revoke', 'badge')
    or grant_target_user_id is null or grant_target_user_id = auth.uid()
    or not exists(select 1 from public.profiles where id = grant_target_user_id and not is_admin) then
    raise invalid_parameter_value using message = 'Invalid step-up request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-step-up:' || auth.uid()::text, 0));
  delete from public.admin_step_up_grants where expires_at <= now();
  if (select count(*) from public.admin_step_up_grants
      where admin_user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise program_limit_exceeded using message = 'Step-up rate limit reached';
  end if;
  insert into public.admin_step_up_grants(token_hash, admin_user_id, auth_session_id, scope, target_user_id, expires_at)
  values (grant_token_hash, auth.uid(), session_id, grant_scope, grant_target_user_id, now() + interval '5 minutes');
end;
$$;

create function public.admin_set_user_badge(
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

-- Extend existing AAL2 admin reads without exposing communication data publicly.
drop function public.admin_list_users(text,text,text,integer,integer);
create function public.admin_list_users(
  user_search text default null,
  status_filter text default null,
  role_filter text default null,
  page_index integer default 0,
  page_size integer default 25
)
returns table (
  id uuid,
  email text,
  username text,
  account_status text,
  account_role text,
  community_email_opt_in boolean,
  badge_count bigint,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = public, auth
as $$
declare query text := nullif(trim(user_search), '');
begin
  perform public.authorize_admin_request();
  if query is not null and char_length(query) > 254 then raise invalid_parameter_value using message = 'Invalid search'; end if;
  if status_filter is not null and status_filter not in ('active', 'suspended', 'anonymized') then raise invalid_parameter_value using message = 'Invalid status'; end if;
  if role_filter is not null and role_filter not in ('admin', 'user') then raise invalid_parameter_value using message = 'Invalid role'; end if;
  if page_index not between 0 and 10000 or page_size not between 1 and 100 then raise invalid_parameter_value using message = 'Invalid page'; end if;

  return query
  select p.id, u.email::text, p.username, p.account_status,
    case when p.is_admin then 'admin' else 'user' end,
    p.community_email_opt_in,
    (select count(*) from public.user_badges award where award.user_id = p.id),
    u.created_at, u.last_sign_in_at, count(*) over()
  from public.profiles p
  join auth.users u on u.id = p.id
  where (query is null
      or position(lower(query) in lower(p.username)) > 0
      or position(lower(query) in lower(coalesce(u.email, ''))) > 0
      or p.id::text = lower(query))
    and (status_filter is null or p.account_status = status_filter)
    and (role_filter is null or (role_filter = 'admin') = p.is_admin)
  order by u.created_at desc, p.id
  limit page_size offset page_index * page_size;
end;
$$;

create or replace function public.admin_get_user(target_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth
as $$
declare result jsonb;
begin
  perform public.authorize_admin_request();
  select jsonb_build_object(
    'id', p.id,
    'email', u.email,
    'username', p.username,
    'status', p.account_status,
    'role', case when p.is_admin then 'admin' else 'user' end,
    'createdAt', u.created_at,
    'lastSignInAt', u.last_sign_in_at,
    'emailConfirmedAt', u.email_confirmed_at,
    'balance', w.balance,
    'lockedBalance', w.locked_balance,
    'rewardPoints', p.reward_points,
    'experiencePoints', p.experience_points,
    'communityEmailOptIn', p.community_email_opt_in,
    'communityEmailOptedInAt', p.community_email_opted_in_at,
    'communityEmailOptedOutAt', p.community_email_opted_out_at,
    'badges', public.public_badges_for_user(p.id, coalesce(ranking.rank, 9223372036854775807)),
    'availableBadges', (select coalesce(jsonb_agg(jsonb_build_object(
      'slug', badge.slug, 'name', badge.name, 'description', badge.description, 'icon', badge.icon_token,
      'assignmentType', badge.assignment_type
    ) order by badge.name), '[]'::jsonb) from public.badges badge where badge.assignment_type <> 'dynamic')
  ) into result
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.account_wallets w on w.user_id = p.id
  left join lateral (select row.rank from public.global_leaderboard_rows() row where row.user_id = p.id) ranking on true
  where p.id = target_user_id;
  if result is null then raise no_data_found using message = 'User not found'; end if;
  return result;
end;
$$;

revoke all on function public.admin_set_user_badge(uuid,text,boolean,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.admin_set_user_badge(uuid,text,boolean,text,uuid,text,text) to authenticated, service_role;
revoke all on function public.admin_list_users(text,text,text,integer,integer), public.admin_get_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_users(text,text,text,integer,integer), public.admin_get_user(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
