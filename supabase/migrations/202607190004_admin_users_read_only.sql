-- Explicit, paginated admin user reads. Proposed only: do not apply to hosted without approval.
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

create function public.admin_get_user(target_user_id uuid)
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
    'experiencePoints', p.experience_points
  ) into result
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.account_wallets w on w.user_id = p.id
  where p.id = target_user_id;
  if result is null then raise no_data_found using message = 'User not found'; end if;
  return result;
end;
$$;

create function public.admin_preview_user_impact(target_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  perform authorize_admin_request();
  if not exists(select 1 from profiles where id = target_user_id) then raise no_data_found using message = 'User not found'; end if;
  select jsonb_build_object(
    'isAdmin', p.is_admin,
    'openOwnedLeagues', (select count(*) from leagues where owner_id = p.id and status in ('lobby', 'active')),
    'ownedLeagues', (select count(*) from leagues where owner_id = p.id),
    'leagueMemberships', (select count(*) from league_members where user_id = p.id),
    'walletTransactions', (select count(*) from wallet_transactions where user_id = p.id),
    'accountPositions', (select count(*) from account_positions where user_id = p.id),
    'friendships', (select count(*) from friendships where p.id in (user_a, user_b)),
    'notifications', (select count(*) from notifications where user_id = p.id),
    'errorLogs', (select count(*) from app_errors where user_id = p.id)
  ) into result from profiles p where p.id = target_user_id;
  return result;
end;
$$;

revoke all on function public.admin_list_users(text,text,text,integer,integer), public.admin_get_user(uuid),
  public.admin_preview_user_impact(uuid) from public;
grant execute on function public.admin_list_users(text,text,text,integer,integer), public.admin_get_user(uuid),
  public.admin_preview_user_impact(uuid) to authenticated;
