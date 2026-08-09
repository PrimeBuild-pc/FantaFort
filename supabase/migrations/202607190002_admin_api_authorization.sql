-- Server API authorization primitive. Proposed only: do not apply to hosted without approval.
create function public.authorize_admin_request()
returns void language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not is_account_active() or not is_app_admin() then
    raise insufficient_privilege using message = 'Admin access denied';
  end if;
end;
$$;

revoke all on function public.authorize_admin_request() from public;
grant execute on function public.authorize_admin_request() to authenticated;
