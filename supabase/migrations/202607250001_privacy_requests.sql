-- Verified self-service privacy request intake. Final anonymization remains an admin-reviewed action.
create table public.account_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  request_type text not null default 'deletion' check (request_type = 'deletion'),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index account_privacy_requests_one_pending
  on public.account_privacy_requests(user_id, request_type) where status = 'pending';
create index account_privacy_requests_status_requested
  on public.account_privacy_requests(status, requested_at);

alter table public.account_privacy_requests enable row level security;
revoke all on table public.account_privacy_requests from anon, authenticated;
grant select on table public.account_privacy_requests to authenticated;
grant all on table public.account_privacy_requests to service_role;

create policy "read own privacy requests" on public.account_privacy_requests
  for select using (auth.uid() = user_id);

create function public.request_account_deletion(confirm_username text)
returns uuid language plpgsql security definer set search_path = public, auth set statement_timeout = '5s'
as $$
declare
  target public.profiles;
  request_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('privacy-request:' || auth.uid()::text, 0));
  select * into target from public.profiles where id = auth.uid() for update;
  if target.id is null or target.account_status <> 'active' then raise exception 'Account unavailable'; end if;
  if target.is_admin then raise exception 'Administrator accounts require a reviewed handover'; end if;
  if target.username is distinct from confirm_username then raise exception 'Username confirmation does not match'; end if;
  if exists(select 1 from public.league_members m join public.leagues l on l.id = m.league_id
    where m.user_id = auth.uid() and l.status in ('lobby','active')) then
    raise exception 'Leave or close open leagues first';
  end if;

  select id into request_id from public.account_privacy_requests
    where user_id = auth.uid() and request_type = 'deletion' and status = 'pending';
  if request_id is null then
    insert into public.account_privacy_requests(user_id) values (auth.uid()) returning id into request_id;
  end if;
  update public.profiles set account_status = 'suspended', status_changed_at = now() where id = auth.uid();
  delete from auth.sessions where user_id = auth.uid();
  return request_id;
end;
$$;

create function public.resolve_account_privacy_request()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.account_status = 'anonymized' then
    update account_privacy_requests set status = 'completed', resolved_at = now()
      where user_id = new.id and status = 'pending';
  elsif old.account_status = 'suspended' and new.account_status = 'active' then
    update account_privacy_requests set status = 'cancelled', resolved_at = now()
      where user_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger profiles_resolve_privacy_request
after update of account_status on public.profiles
for each row when (old.account_status is distinct from new.account_status)
execute function public.resolve_account_privacy_request();

create or replace function public.get_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public set statement_timeout = '3s'
as $$
begin
  perform authorize_admin_request();
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'suspendedUsers', (select count(*) from profiles where account_status = 'suspended'),
    'pendingPrivacyRequests', (select count(*) from account_privacy_requests where status = 'pending'),
    'activeLeagues', (select count(*) from leagues where status = 'active'),
    'pendingFriendRequests', (select count(*) from friendships where status = 'pending'),
    'players', (select count(*) from players where active),
    'errors24h', (select count(*) from app_errors where created_at > now() - interval '24 hours'),
    'adminActions24h', (select count(*) from admin_audit_log where created_at > now() - interval '24 hours'),
    'latestSync', (select max(synced_at) from tournaments)
  );
end;
$$;

revoke all on function public.request_account_deletion(text), public.resolve_account_privacy_request() from public;
grant execute on function public.request_account_deletion(text) to authenticated;
