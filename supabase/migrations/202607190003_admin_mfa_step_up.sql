-- MFA-backed, short-lived step-up grants. Proposed only: hosted enforcement remains disabled.
create table public.admin_step_up_grants (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  admin_user_id uuid not null,
  auth_session_id text not null check (char_length(auth_session_id) between 8 and 200),
  scope text not null check (scope in ('role', 'economy', 'anonymize')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index admin_step_up_grants_expiry on public.admin_step_up_grants(expires_at);
alter table public.admin_step_up_grants enable row level security;
revoke all on table public.admin_step_up_grants from anon, authenticated;

create function public.create_admin_step_up_grant(grant_token_hash text, grant_scope text)
returns void language plpgsql security definer set search_path = public
as $$
declare session_id text := auth.jwt() ->> 'session_id';
begin
  perform authorize_admin_request();
  if auth.jwt() ->> 'aal' <> 'aal2' or session_id is null then
    raise insufficient_privilege using message = 'MFA verification required';
  end if;
  if grant_token_hash !~ '^[a-f0-9]{64}$' or grant_scope not in ('role', 'economy', 'anonymize') then
    raise invalid_parameter_value using message = 'Invalid step-up request';
  end if;
  delete from admin_step_up_grants where expires_at <= now() or used_at is not null;
  insert into admin_step_up_grants(token_hash, admin_user_id, auth_session_id, scope, expires_at)
  values (grant_token_hash, auth.uid(), session_id, grant_scope, now() + interval '5 minutes');
end;
$$;

create function public.consume_admin_step_up_grant(grant_token_hash text, grant_scope text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform authorize_admin_request();
  update admin_step_up_grants set used_at = now()
  where token_hash = grant_token_hash
    and admin_user_id = auth.uid()
    and auth_session_id = auth.jwt() ->> 'session_id'
    and scope = grant_scope
    and expires_at > now()
    and used_at is null;
  if not found then raise insufficient_privilege using message = 'Step-up authorization required'; end if;
end;
$$;

revoke all on function public.create_admin_step_up_grant(text,text), public.consume_admin_step_up_grant(text,text) from public;
grant execute on function public.create_admin_step_up_grant(text,text), public.consume_admin_step_up_grant(text,text) to authenticated;
grant all on table public.admin_step_up_grants to service_role;
