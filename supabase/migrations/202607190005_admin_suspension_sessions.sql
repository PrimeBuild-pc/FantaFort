-- Account suspension and immediate Data API session revocation. Proposed only.
alter table public.admin_step_up_grants drop constraint admin_step_up_grants_scope_check;
alter table public.admin_step_up_grants add constraint admin_step_up_grants_scope_check
  check (scope in ('role', 'economy', 'recovery', 'anonymize'));

create or replace function public.create_admin_step_up_grant(grant_token_hash text, grant_scope text)
returns void language plpgsql security definer set search_path = public
as $$
declare session_id text := auth.jwt() ->> 'session_id';
begin
  perform authorize_admin_request();
  if auth.jwt() ->> 'aal' is distinct from 'aal2' or session_id is null then
    raise insufficient_privilege using message = 'MFA verification required';
  end if;
  if grant_token_hash !~ '^[a-f0-9]{64}$' or grant_scope not in ('role', 'economy', 'recovery', 'anonymize') then
    raise invalid_parameter_value using message = 'Invalid step-up request';
  end if;
  delete from admin_step_up_grants where expires_at <= now() or used_at is not null;
  insert into admin_step_up_grants(token_hash, admin_user_id, auth_session_id, scope, expires_at)
  values (grant_token_hash, auth.uid(), session_id, grant_scope, now() + interval '5 minutes');
end;
$$;

create function public.enforce_active_data_session()
returns void language plpgsql stable security definer set search_path = public, auth
as $$
declare
  caller_id uuid := auth.uid();
  jwt_role text := auth.jwt() ->> 'role';
  caller_session_id text := auth.jwt() ->> 'session_id';
begin
  if caller_id is null or jwt_role = 'service_role' then return; end if;
  if not exists(select 1 from public.profiles where id = caller_id and account_status = 'active') then
    raise insufficient_privilege using message = 'Account unavailable';
  end if;
  if caller_session_id is not null and not exists(select 1 from auth.sessions s where s.id::text = caller_session_id and s.user_id = caller_id) then
    raise insufficient_privilege using message = 'Session unavailable';
  end if;
end;
$$;

revoke all on function public.enforce_active_data_session() from public;
grant execute on function public.enforce_active_data_session() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'public.enforce_active_data_session';
notify pgrst, 'reload config';

create function public.admin_set_account_status(
  target_user_id uuid,
  new_status text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  target profiles;
  action_name text;
  prior admin_audit_log;
begin
  perform authorize_admin_request();
  if target_user_id = auth.uid() then raise invalid_parameter_value using message = 'Self-targeting is not allowed'; end if;
  if new_status not in ('active', 'suspended') then raise invalid_parameter_value using message = 'Invalid account status'; end if;
  if action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200 then
    raise invalid_parameter_value using message = 'Invalid admin request';
  end if;
  action_name := case new_status when 'suspended' then 'user.suspend' else 'user.reactivate' end;
  select * into prior from admin_audit_log
    where actor_user_id = auth.uid() and action = action_name and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_user_id::text then raise unique_violation using message = 'Idempotency key already used'; end if;
    return jsonb_build_object('before', prior.before_state, 'after', prior.after_state, 'replayed', true);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-status:' || target_user_id::text, 0));
  select * into target from profiles where id = target_user_id for update;
  if target.id is null then raise no_data_found using message = 'User not found'; end if;
  if target.is_admin then raise invalid_parameter_value using message = 'Administrator status cannot be changed here'; end if;
  if (select count(*) from admin_audit_log where actor_user_id = auth.uid() and action = action_name and created_at > now() - interval '1 hour') >= 20 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  update profiles set account_status = new_status, status_changed_at = now() where id = target_user_id;
  insert into admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
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
  action_idempotency_key text
)
returns integer language plpgsql security definer set search_path = public, auth
as $$
declare removed integer;
begin
  perform public.authorize_admin_request();
  if target_user_id = auth.uid() then raise invalid_parameter_value using message = 'Self-targeting is not allowed'; end if;
  if action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200 then
    raise invalid_parameter_value using message = 'Invalid admin request';
  end if;
  if exists(select 1 from public.admin_audit_log where actor_user_id = auth.uid() and action = 'user.revoke_sessions'
    and idempotency_key = action_idempotency_key and target_id = target_user_id::text) then return 0; end if;
  if not exists(select 1 from public.profiles where id = target_user_id and not is_admin) then
    raise invalid_parameter_value using message = 'User unavailable';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-sessions:' || target_user_id::text, 0));
  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid() and action = 'user.revoke_sessions'
    and created_at > now() - interval '1 hour') >= 20 then raise program_limit_exceeded using message = 'Admin action rate limit reached'; end if;
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

create function public.admin_authorize_recovery_attempt(
  target_user_id uuid,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns boolean language plpgsql security definer set search_path = public
as $$
declare prior admin_audit_log;
begin
  perform authorize_admin_request();
  if auth.jwt() ->> 'aal' is distinct from 'aal2' then
    raise insufficient_privilege using message = 'MFA verification required';
  end if;
  if target_user_id = auth.uid() or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid admin request';
  end if;

  select * into prior from admin_audit_log where actor_user_id = auth.uid()
    and action = 'user.request_recovery' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_user_id::text or prior.reason <> trim(action_reason) then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-recovery-actor:' || auth.uid()::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-recovery-target:' || target_user_id::text, 0));
  if not exists(select 1 from profiles where id = target_user_id and not is_admin and account_status = 'active') then
    raise invalid_parameter_value using message = 'User unavailable';
  end if;
  if (select count(*) from admin_audit_log where action = 'user.request_recovery'
    and target_id = target_user_id::text and created_at > now() - interval '1 hour') >= 3
    or (select count(*) from admin_audit_log where actor_user_id = auth.uid() and action = 'user.request_recovery'
      and created_at > now() - interval '1 hour') >= 20 then
    raise program_limit_exceeded using message = 'Recovery rate limit reached';
  end if;

  perform consume_admin_step_up_grant(step_up_token_hash, 'recovery');
  insert into admin_audit_log(actor_user_id, action, target_type, target_id, reason, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'user.request_recovery', 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('accepted', true), action_request_id, action_idempotency_key, 'succeeded');
  return true;
end;
$$;

revoke all on function public.admin_set_account_status(uuid,text,text,uuid,text),
  public.admin_revoke_user_sessions(uuid,text,uuid,text), public.admin_authorize_recovery_attempt(uuid,text,uuid,text,text) from public;
grant execute on function public.admin_set_account_status(uuid,text,text,uuid,text),
  public.admin_revoke_user_sessions(uuid,text,uuid,text), public.admin_authorize_recovery_attempt(uuid,text,uuid,text,text) to authenticated;
