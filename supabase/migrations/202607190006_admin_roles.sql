-- Role mutation is prepared but additional administrators remain disabled by profiles_single_admin.
create function public.admin_set_role(
  target_user_id uuid,
  requested_admin boolean,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare target public.profiles;
begin
  perform public.authorize_admin_request();
  if target_user_id = auth.uid() then raise invalid_parameter_value using message = 'Self role changes are not allowed'; end if;
  if action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash !~ '^[a-f0-9]{64}$' then raise invalid_parameter_value using message = 'Invalid admin request'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-role-change', 0));
  select * into target from public.profiles where id = target_user_id for update;
  if target.id is null or target.account_status <> 'active' then raise invalid_parameter_value using message = 'User unavailable'; end if;
  if target.is_admin = requested_admin then return; end if;
  perform public.consume_admin_step_up_grant(step_up_token_hash, 'role');

  if requested_admin then
    if exists(select 1 from public.profiles where is_admin and id <> target_user_id) then
      raise feature_not_supported using message = 'Additional administrators are not enabled';
    end if;
    if not exists(select 1 from auth.mfa_factors where user_id = target_user_id and status = 'verified') then
      raise invalid_parameter_value using message = 'Verified MFA is required';
    end if;
  elsif (select count(*) from public.profiles where is_admin) <= 1 then
    raise invalid_parameter_value using message = 'The last administrator cannot be removed';
  end if;

  update public.profiles set is_admin = requested_admin where id = target_user_id;
  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'user.set_role', 'user', target_user_id::text, trim(action_reason),
    jsonb_build_object('role', case when target.is_admin then 'admin' else 'user' end),
    jsonb_build_object('role', case when requested_admin then 'admin' else 'user' end),
    action_request_id, action_idempotency_key, 'succeeded');
end;
$$;

revoke all on function public.admin_set_role(uuid,boolean,text,uuid,text,text) from public;
grant execute on function public.admin_set_role(uuid,boolean,text,uuid,text,text) to authenticated;
