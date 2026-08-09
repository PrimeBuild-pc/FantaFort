-- Close FF-01/02/03: enforce admin MFA in SQL, isolate strategies and retire legacy invites.

create function public.authorize_admin_step_up_request()
returns void language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not is_account_active() or not is_app_admin() then
    raise insufficient_privilege using message = 'Admin access denied';
  end if;
end;
$$;

create or replace function public.authorize_admin_request()
returns void language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.authorize_admin_step_up_request();
  if auth.jwt() ->> 'aal' is distinct from 'aal2' then
    raise insufficient_privilege using message = 'MFA verification required';
  end if;
end;
$$;

revoke all on function public.authorize_admin_step_up_request() from public;
grant execute on function public.authorize_admin_step_up_request() to authenticated;

alter table public.admin_step_up_grants
  add column target_user_id uuid;
alter table public.admin_step_up_grants
  drop constraint admin_step_up_grants_scope_check;
alter table public.admin_step_up_grants
  add constraint admin_step_up_grants_scope_check
  check (scope in ('role', 'economy', 'recovery', 'anonymize', 'account_status', 'session_revoke'));

create or replace function public.create_admin_step_up_grant(grant_token_hash text, grant_scope text)
returns void language plpgsql security definer set search_path = public
as $$
declare session_id text := auth.jwt() ->> 'session_id';
begin
  perform public.authorize_admin_request();
  if session_id is null or grant_token_hash !~ '^[a-f0-9]{64}$'
    or grant_scope not in ('role', 'economy', 'recovery', 'anonymize') then
    raise invalid_parameter_value using message = 'Invalid step-up request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-step-up:' || auth.uid()::text, 0));
  delete from public.admin_step_up_grants where expires_at <= now();
  if (select count(*) from public.admin_step_up_grants
      where admin_user_id = auth.uid() and created_at > now() - interval '10 minutes') >= 20 then
    raise program_limit_exceeded using message = 'Step-up rate limit reached';
  end if;
  insert into public.admin_step_up_grants(token_hash, admin_user_id, auth_session_id, scope, expires_at)
  values (grant_token_hash, auth.uid(), session_id, grant_scope, now() + interval '5 minutes');
end;
$$;

create function public.create_admin_step_up_grant(
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
    or grant_scope not in ('account_status', 'session_revoke')
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

create function public.consume_admin_step_up_grant(
  grant_token_hash text,
  grant_scope text,
  grant_target_user_id uuid
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.authorize_admin_request();
  update public.admin_step_up_grants set used_at = now()
  where token_hash = grant_token_hash
    and admin_user_id = auth.uid()
    and auth_session_id = auth.jwt() ->> 'session_id'
    and scope = grant_scope
    and target_user_id = grant_target_user_id
    and expires_at > now()
    and used_at is null;
  if not found then
    raise insufficient_privilege using message = 'Step-up authorization required';
  end if;
end;
$$;

revoke all on function public.create_admin_step_up_grant(text,text,uuid) from public;
grant execute on function public.create_admin_step_up_grant(text,text,uuid) to authenticated;
revoke all on function public.consume_admin_step_up_grant(text,text),
  public.consume_admin_step_up_grant(text,text,uuid) from public, anon, authenticated;

create function public.admin_set_account_status(
  target_user_id uuid,
  new_status text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  target public.profiles;
  action_name text;
  prior public.admin_audit_log;
begin
  perform public.authorize_admin_request();
  if target_user_id = auth.uid() then raise invalid_parameter_value using message = 'Self-targeting is not allowed'; end if;
  if new_status not in ('active', 'suspended') then raise invalid_parameter_value using message = 'Invalid account status'; end if;
  if action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid admin request';
  end if;
  action_name := case new_status when 'suspended' then 'user.suspend' else 'user.reactivate' end;
  select * into prior from public.admin_audit_log
    where actor_user_id = auth.uid() and action = action_name and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_user_id::text then raise unique_violation using message = 'Idempotency key already used'; end if;
    return jsonb_build_object('before', prior.before_state, 'after', prior.after_state, 'replayed', true);
  end if;

  perform public.consume_admin_step_up_grant(step_up_token_hash, 'account_status', target_user_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-status:' || target_user_id::text, 0));
  select * into target from public.profiles where id = target_user_id for update;
  if target.id is null then raise no_data_found using message = 'User not found'; end if;
  if target.is_admin then raise invalid_parameter_value using message = 'Administrator status cannot be changed here'; end if;
  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid() and action = action_name
      and created_at > now() - interval '1 hour') >= 20 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  update public.profiles set account_status = new_status, status_changed_at = now() where id = target_user_id;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), action_name, 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('status', target.account_status), jsonb_build_object('status', new_status),
    action_request_id, action_idempotency_key, 'succeeded');
  return jsonb_build_object('before', jsonb_build_object('status', target.account_status),
    'after', jsonb_build_object('status', new_status), 'replayed', false);
end;
$$;

create function public.admin_revoke_user_sessions(
  target_user_id uuid,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare removed integer;
begin
  perform public.authorize_admin_request();
  if target_user_id = auth.uid() then raise invalid_parameter_value using message = 'Self-targeting is not allowed'; end if;
  if action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid admin request';
  end if;
  if exists(select 1 from public.admin_audit_log where actor_user_id = auth.uid() and action = 'user.revoke_sessions'
    and idempotency_key = action_idempotency_key and target_id = target_user_id::text) then return 0; end if;
  if not exists(select 1 from public.profiles where id = target_user_id and not is_admin) then
    raise invalid_parameter_value using message = 'User unavailable';
  end if;

  perform public.consume_admin_step_up_grant(step_up_token_hash, 'session_revoke', target_user_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-sessions:' || target_user_id::text, 0));
  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid() and action = 'user.revoke_sessions'
      and created_at > now() - interval '1 hour') >= 20 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;
  delete from auth.sessions where user_id = target_user_id;
  get diagnostics removed = row_count;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'user.revoke_sessions', 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('sessions', removed), jsonb_build_object('sessions', 0),
    action_request_id, action_idempotency_key, 'succeeded');
  return removed;
end;
$$;

drop function public.admin_set_account_status(uuid,text,text,uuid,text);
drop function public.admin_revoke_user_sessions(uuid,text,uuid,text);
revoke all on function public.admin_set_account_status(uuid,text,text,uuid,text,text),
  public.admin_revoke_user_sessions(uuid,text,uuid,text,text) from public;
grant execute on function public.admin_set_account_status(uuid,text,text,uuid,text,text),
  public.admin_revoke_user_sessions(uuid,text,uuid,text,text) to authenticated;

-- Keep the explicit sandbox top-up bounded, idempotent and auditable.
create table public.sandbox_top_up_ledger (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  amount_cents integer not null check (amount_cents in (499, 999, 1999)),
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create index sandbox_top_up_ledger_user_created
  on public.sandbox_top_up_ledger(user_id, created_at desc);
alter table public.sandbox_top_up_ledger enable row level security;
create policy "read own sandbox top ups" on public.sandbox_top_up_ledger
  for select using (user_id = auth.uid());
create trigger sandbox_top_up_ledger_no_update_or_delete
  before update or delete on public.sandbox_top_up_ledger
  for each row execute function public.reject_wallet_transaction_change();

create function public.mock_top_up(amount_cents integer, request_id uuid)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  prior_balance integer;
  current_balance integer;
begin
  if auth.uid() is null or amount_cents not in (499, 999, 1999) or request_id is null then
    raise invalid_parameter_value using message = 'Invalid sandbox top-up';
  end if;
  select l.balance_after into prior_balance from public.sandbox_top_up_ledger l
    where l.user_id = auth.uid() and l.request_id = mock_top_up.request_id;
  if prior_balance is not null then return prior_balance; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sandbox-top-up:' || auth.uid()::text, 0));
  select l.balance_after into prior_balance from public.sandbox_top_up_ledger l
    where l.user_id = auth.uid() and l.request_id = mock_top_up.request_id;
  if prior_balance is not null then return prior_balance; end if;
  if coalesce((select sum(l.amount_cents) from public.sandbox_top_up_ledger l
      where l.user_id = auth.uid() and l.created_at >= date_trunc('day', now())), 0) + amount_cents > 5000 then
    raise program_limit_exceeded using message = 'Daily sandbox top-up limit reached';
  end if;

  update public.profiles set wallet_cents = wallet_cents + amount_cents
    where id = auth.uid() returning wallet_cents into current_balance;
  if current_balance is null then raise no_data_found using message = 'Account unavailable'; end if;
  insert into public.sandbox_top_up_ledger(user_id, request_id, amount_cents, balance_after)
    values (auth.uid(), request_id, amount_cents, current_balance);
  return current_balance;
end;
$$;

drop function public.mock_top_up(integer);
revoke all on table public.sandbox_top_up_ledger from anon, authenticated;
grant select on table public.sandbox_top_up_ledger to authenticated;
revoke all on function public.mock_top_up(integer,uuid) from public;
grant execute on function public.mock_top_up(integer,uuid) to authenticated;

-- Strategy picks remain private to their owner. Scoring continues through SECURITY DEFINER functions.
drop policy "members read strategy picks" on public.league_strategy_picks;
create policy "owners read strategy picks" on public.league_strategy_picks
  for select using (user_id = auth.uid());

-- Rotate active legacy lobby codes without logging their values.
do $$
declare legacy_count bigint;
begin
  select count(*) into legacy_count from public.leagues
    where status = 'lobby' and char_length(invite_code) <> 16;
  raise notice 'Rotating % legacy lobby invite code(s)', legacy_count;
  update public.leagues
    set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
    where status = 'lobby' and char_length(invite_code) <> 16;
end;
$$;

create table public.league_invite_preview_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id text not null check (char_length(auth_session_id) between 8 and 200),
  window_started_at timestamptz not null default now(),
  failures integer not null default 0 check (failures between 0 and 10),
  primary key (user_id, auth_session_id)
);

alter table public.league_invite_preview_attempts enable row level security;
revoke all on table public.league_invite_preview_attempts from anon, authenticated;
grant all on table public.league_invite_preview_attempts to service_role;

create function public.record_failed_league_invite_preview(caller_id uuid, caller_session_id text)
returns void language sql security definer set search_path = public
as $$
  insert into public.league_invite_preview_attempts(user_id, auth_session_id, failures)
  values (caller_id, caller_session_id, 1)
  on conflict (user_id, auth_session_id) do update set
    window_started_at = case
      when league_invite_preview_attempts.window_started_at <= now() - interval '5 minutes' then now()
      else league_invite_preview_attempts.window_started_at
    end,
    failures = case
      when league_invite_preview_attempts.window_started_at <= now() - interval '5 minutes' then 1
      else least(league_invite_preview_attempts.failures + 1, 10)
    end
$$;

revoke all on function public.record_failed_league_invite_preview(uuid,text) from public, anon, authenticated;

create or replace function public.join_league(code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target public.leagues; member_count integer; normalized_code text := upper(trim(code));
begin
  if auth.uid() is null or normalized_code !~ '^[A-F0-9]{16}$' then
    raise invalid_parameter_value using message = 'Invite unavailable';
  end if;
  select * into target from public.leagues where invite_code = normalized_code and status = 'lobby' for update;
  if target.id is null then raise invalid_parameter_value using message = 'Invite unavailable'; end if;
  if exists(select 1 from public.league_members where league_id = target.id and user_id = auth.uid()) then return target.id; end if;
  select count(*) into member_count from public.league_members where league_id = target.id;
  if member_count >= target.max_members then raise invalid_parameter_value using message = 'Invite unavailable'; end if;
  insert into public.league_members(league_id, user_id, coins) values (target.id, auth.uid(), target.initial_budget);
  perform public.lock_league_stake_for_user(target.id, auth.uid());
  return target.id;
end;
$$;

create or replace function public.preview_league_invite(code text)
returns table(name text, members bigint, economy_mode text, entry_stake integer, initial_budget integer,
  roster_size integer, draft_mode text, duration_days integer)
language plpgsql security definer set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_session_id text := auth.jwt() ->> 'session_id';
  normalized_code text := upper(trim(code));
  target public.leagues;
  current_failures integer;
begin
  if caller_id is null or caller_session_id is null then return; end if;
  select case when window_started_at > now() - interval '5 minutes' then failures else 0 end
    into current_failures from public.league_invite_preview_attempts
    where user_id = caller_id and auth_session_id = caller_session_id;
  if coalesce(current_failures, 0) >= 10 then return; end if;

  if normalized_code !~ '^[A-F0-9]{16}$' then
    perform public.record_failed_league_invite_preview(caller_id, caller_session_id);
    return;
  end if;
  select * into target from public.leagues where invite_code = normalized_code and status = 'lobby';
  if target.id is null then
    perform public.record_failed_league_invite_preview(caller_id, caller_session_id);
    return;
  end if;

  delete from public.league_invite_preview_attempts where user_id = caller_id and auth_session_id = caller_session_id;
  return query select target.name, count(m.user_id), target.economy_mode, target.entry_stake,
    target.initial_budget, target.roster_size, target.draft_mode, target.duration_days
    from public.league_members m where m.league_id = target.id;
end;
$$;

revoke all on function public.join_league(text), public.preview_league_invite(text) from public;
grant execute on function public.join_league(text), public.preview_league_invite(text) to authenticated;
