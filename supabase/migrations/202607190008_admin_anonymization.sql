-- Controlled application-data anonymization. No hard delete. Proposed only.
create function public.admin_preview_anonymization_impact(target_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public set statement_timeout = '3s'
as $$
declare impact jsonb;
begin
  impact := admin_preview_user_impact(target_user_id);
  return impact || jsonb_build_object('fingerprint', md5(impact::text));
end;
$$;

create function public.admin_anonymize_profile(
  target_user_id uuid,
  confirmed_target_id uuid,
  expected_impact_fingerprint text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public set statement_timeout = '5s'
as $$
declare
  target profiles;
  subject_id uuid := target_user_id;
  anonymized_username text;
  impact jsonb;
  prior admin_audit_log;
begin
  perform authorize_admin_request();
  if auth.jwt() ->> 'aal' is distinct from 'aal2' then
    raise insufficient_privilege using message = 'MFA verification required';
  end if;
  if subject_id is null or subject_id = auth.uid() or confirmed_target_id is distinct from subject_id
    or expected_impact_fingerprint !~ '^[a-f0-9]{32}$'
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid anonymization request';
  end if;

  select * into prior from admin_audit_log where actor_user_id = auth.uid() and action = 'user.anonymize'
    and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> subject_id::text or prior.reason <> trim(action_reason)
      or prior.before_state ->> 'impactFingerprint' is distinct from expected_impact_fingerprint then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('replayed', true, 'status', 'anonymized');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-anonymize:' || subject_id::text, 0));
  select * into target from profiles where id = subject_id for update;
  if target.id is null or target.is_admin or target.account_status <> 'suspended' then
    raise invalid_parameter_value using message = 'Suspended non-admin account required';
  end if;
  impact := admin_preview_anonymization_impact(subject_id);
  if impact ->> 'fingerprint' is distinct from expected_impact_fingerprint then
    raise serialization_failure using message = 'Impact preview is stale';
  end if;
  if exists(select 1 from league_members m join leagues l on l.id = m.league_id
    where m.user_id = subject_id and l.status in ('lobby', 'active')) then
    raise invalid_parameter_value using message = 'Open league dependencies must be resolved first';
  end if;
  perform consume_admin_step_up_grant(step_up_token_hash, 'anonymize');

  anonymized_username := 'deleted_' || left(md5(subject_id::text), 12);
  delete from friendships f where subject_id in (f.user_a, f.user_b);
  delete from notifications n where n.user_id = subject_id;
  delete from league_invites i where i.target_user_id = subject_id or i.invited_by = subject_id;
  delete from account_watchlist w where w.user_id = subject_id;
  delete from app_errors e where e.user_id = subject_id;
  update profiles set username = anonymized_username, locale = 'en', wallet_cents = 0,
    name_style = 'default', last_seen_at = null, account_status = 'anonymized', status_changed_at = now()
  where id = subject_id;
  insert into admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, idempotency_key, outcome)
  values (auth.uid(), 'user.anonymize', 'user', subject_id::text, trim(action_reason),
    jsonb_build_object('status', target.account_status, 'impact', impact - 'fingerprint',
      'impactFingerprint', expected_impact_fingerprint),
    jsonb_build_object('status', 'anonymized'), action_request_id, action_idempotency_key, 'succeeded');
  return jsonb_build_object('replayed', false, 'status', 'anonymized');
end;
$$;

revoke all on function public.admin_preview_anonymization_impact(uuid),
  public.admin_anonymize_profile(uuid,uuid,text,text,uuid,text,text) from public;
grant execute on function public.admin_preview_anonymization_impact(uuid),
  public.admin_anonymize_profile(uuid,uuid,text,text,uuid,text,text) to authenticated;
