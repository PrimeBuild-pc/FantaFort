-- Sortable columns for the admin account table.
--
-- The list is paginated server-side, so sorting had to move server-side too:
-- reordering only the 25 rows already fetched would silently show the wrong
-- "first by last access". The sort key is matched against a fixed whitelist of
-- CASE branches rather than interpolated, so no dynamic SQL is built from input.

drop function if exists public.admin_list_users(text, text, text, integer, integer);

create function public.admin_list_users(
  user_search text default null,
  status_filter text default null,
  role_filter text default null,
  page_index integer default 0,
  page_size integer default 25,
  sort_key text default 'created_at',
  sort_direction text default 'desc'
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
declare
  query text := nullif(trim(user_search), '');
  key text := coalesce(sort_key, 'created_at');
  ascending boolean := lower(coalesce(sort_direction, 'desc')) = 'asc';
begin
  perform public.authorize_admin_request();
  if query is not null and char_length(query) > 254 then raise invalid_parameter_value using message = 'Invalid search'; end if;
  if status_filter is not null and status_filter not in ('active', 'suspended', 'anonymized') then raise invalid_parameter_value using message = 'Invalid status'; end if;
  if role_filter is not null and role_filter not in ('admin', 'user') then raise invalid_parameter_value using message = 'Invalid role'; end if;
  if page_index not between 0 and 10000 or page_size not between 1 and 100 then raise invalid_parameter_value using message = 'Invalid page'; end if;
  if key not in ('username', 'account_status', 'account_role', 'badge_count', 'created_at', 'last_sign_in_at') then
    raise invalid_parameter_value using message = 'Invalid sort key';
  end if;
  if lower(coalesce(sort_direction, 'desc')) not in ('asc', 'desc') then
    raise invalid_parameter_value using message = 'Invalid sort direction';
  end if;

  return query
  with matched as (
    select p.id row_id, u.email::text row_email, p.username row_username,
      p.account_status row_status,
      case when p.is_admin then 'admin' else 'user' end row_role,
      p.community_email_opt_in row_opt_in,
      (select count(*) from public.user_badges award where award.user_id = p.id) row_badges,
      u.created_at row_created, u.last_sign_in_at row_last_sign_in,
      count(*) over() row_total
    from public.profiles p
    join auth.users u on u.id = p.id
    where (query is null
        or position(lower(query) in lower(p.username)) > 0
        or position(lower(query) in lower(coalesce(u.email, ''))) > 0
        or p.id::text = lower(query))
      and (status_filter is null or p.account_status = status_filter)
      and (role_filter is null or (role_filter = 'admin') = p.is_admin)
  )
  select m.row_id, m.row_email, m.row_username, m.row_status, m.row_role,
    m.row_opt_in, m.row_badges, m.row_created, m.row_last_sign_in, m.row_total
  from matched m
  order by
    case when ascending then
      case key
        when 'username' then lower(m.row_username)
        when 'account_status' then m.row_status
        when 'account_role' then m.row_role
      end
    end asc nulls last,
    case when not ascending then
      case key
        when 'username' then lower(m.row_username)
        when 'account_status' then m.row_status
        when 'account_role' then m.row_role
      end
    end desc nulls last,
    case when ascending and key = 'badge_count' then m.row_badges end asc nulls last,
    case when not ascending and key = 'badge_count' then m.row_badges end desc nulls last,
    case when ascending and key = 'created_at' then m.row_created end asc nulls last,
    case when not ascending and key = 'created_at' then m.row_created end desc nulls last,
    case when ascending and key = 'last_sign_in_at' then m.row_last_sign_in end asc nulls last,
    case when not ascending and key = 'last_sign_in_at' then m.row_last_sign_in end desc nulls last,
    m.row_id
  limit page_size offset page_index * page_size;
end;
$$;

revoke all on function public.admin_list_users(text, text, text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.admin_list_users(text, text, text, integer, integer, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
