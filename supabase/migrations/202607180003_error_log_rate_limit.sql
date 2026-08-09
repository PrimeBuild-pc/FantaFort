create index app_errors_user_created on public.app_errors(user_id, created_at desc);

create or replace function public.log_client_error(error_message text, error_path text, error_stack text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  if (select count(*) from app_errors where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then return; end if;
  insert into app_errors(user_id, path, message, stack)
  values (auth.uid(), left(coalesce(error_path, '/'), 500), left(coalesce(error_message, 'Unknown error'), 2000), left(error_stack, 8000));
end;
$$;
