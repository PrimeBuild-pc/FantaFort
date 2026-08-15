-- Two read-only admin drill-down pages that previously had no dedicated view:
-- client errors (only a 50-row unpaginated feed existed, on the overview page)
-- and privacy/deletion requests (only a count existed, linking to an unrelated
-- user filter). Both mirror the pagination/filtering shape of admin_list_audit.

create or replace function public.admin_list_errors(
  search_filter text default null,
  page_index integer default 0,
  page_size integer default 50
)
returns table (
  id bigint,
  path text,
  message text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = public set statement_timeout = '3s'
as $$
declare
  normalized_search text := nullif(trim(search_filter), '');
begin
  perform authorize_admin_request();
  if page_index not between 0 and 1000 or page_size not between 1 and 100 then raise invalid_parameter_value using message = 'Invalid page'; end if;
  if normalized_search is not null and char_length(normalized_search) not between 2 and 200 then
    raise invalid_parameter_value using message = 'Invalid search';
  end if;

  return query select e.id, redact_admin_log(e.path), redact_admin_log(e.message), e.created_at, count(*) over()
  from app_errors e
  where normalized_search is null or position(lower(normalized_search) in lower(concat_ws(' ', e.path, e.message))) > 0
  order by e.created_at desc, e.id desc
  limit page_size offset page_index * page_size;
end;
$$;

create or replace function public.admin_list_privacy_requests(
  status_filter text default 'pending',
  page_index integer default 0,
  page_size integer default 50
)
returns table (
  id uuid,
  username text,
  request_type text,
  status text,
  requested_at timestamptz,
  resolved_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = public set statement_timeout = '3s'
as $$
begin
  perform authorize_admin_request();
  if page_index not between 0 and 1000 or page_size not between 1 and 100 then raise invalid_parameter_value using message = 'Invalid page'; end if;
  if status_filter is not null and status_filter not in ('pending', 'completed', 'cancelled') then
    raise invalid_parameter_value using message = 'Invalid status';
  end if;

  return query select r.id, redact_admin_log(coalesce(p.username, 'unavailable')), r.request_type, r.status,
    r.requested_at, r.resolved_at, count(*) over()
  from account_privacy_requests r left join profiles p on p.id = r.user_id
  where status_filter is null or r.status = status_filter
  order by r.requested_at desc
  limit page_size offset page_index * page_size;
end;
$$;

revoke all on function public.admin_list_errors(text, integer, integer),
  public.admin_list_privacy_requests(text, integer, integer) from public;
grant execute on function public.admin_list_errors(text, integer, integer) to authenticated;
grant execute on function public.admin_list_privacy_requests(text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
