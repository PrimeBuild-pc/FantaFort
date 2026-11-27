-- Completes a verified self-service deletion request without an interactive admin.
-- Runs only for service_role (the scheduled GitHub workflow), only for a pending
-- request whose account is still suspended, and mirrors admin_anonymize_profile.
create function public.complete_privacy_deletion(privacy_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public set statement_timeout = '10s'
as $$
declare
  request account_privacy_requests;
  target profiles;
  -- Audit needs an actor; no profile has this id, so it lists as "unavailable".
  system_actor constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
begin
  select * into request from account_privacy_requests where id = privacy_request_id for update;
  if request.id is null or request.request_type <> 'deletion' then
    raise invalid_parameter_value using message = 'Unknown privacy request';
  end if;
  if request.status = 'completed' then
    return jsonb_build_object('replayed', true, 'status', 'anonymized');
  end if;
  if request.status <> 'pending' then
    raise invalid_parameter_value using message = 'Privacy request is not pending';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin-anonymize:' || request.user_id::text, 0));
  select * into target from profiles where id = request.user_id for update;
  if target.id is null or target.is_admin or target.account_status <> 'suspended' then
    raise invalid_parameter_value using message = 'Suspended non-admin account required';
  end if;
  if exists(select 1 from league_members m join leagues l on l.id = m.league_id
    where m.user_id = target.id and l.status in ('lobby', 'active')) then
    raise invalid_parameter_value using message = 'Open league dependencies must be resolved first';
  end if;

  delete from friendships f where target.id in (f.user_a, f.user_b);
  delete from notifications n where n.user_id = target.id;
  delete from league_invites i where i.target_user_id = target.id or i.invited_by = target.id;
  delete from account_watchlist w where w.user_id = target.id;
  delete from app_errors e where e.user_id = target.id;
  delete from user_badges b where b.user_id = target.id;
  delete from user_cosmetics c where c.user_id = target.id;
  -- The profiles_resolve_privacy_request trigger marks the request completed.
  update profiles set username = 'deleted_' || left(md5(target.id::text), 12), locale = 'en',
    name_style = 'default', avatar_style = 'default', last_seen_at = null,
    account_status = 'anonymized', status_changed_at = now(),
    public_lineup_enabled = false, community_email_opt_in = false,
    community_email_opted_in_at = null, community_email_opted_out_at = null,
    community_email_consent_version = null, community_email_consent_source = null
  where id = target.id;
  insert into admin_audit_log(actor_user_id, action, target_type, target_id, reason, before_state, after_state,
    request_id, outcome)
  values (system_actor, 'privacy.deletion_complete', 'user', target.id::text, 'Verified self-service deletion request',
    jsonb_build_object('status', target.account_status, 'privacyRequestId', request.id, 'requestedAt', request.requested_at),
    jsonb_build_object('status', 'anonymized'), request.id, 'succeeded');
  return jsonb_build_object('replayed', false, 'status', 'anonymized');
end;
$$;

revoke all on function public.complete_privacy_deletion(uuid) from public, anon, authenticated;
grant execute on function public.complete_privacy_deletion(uuid) to service_role;
