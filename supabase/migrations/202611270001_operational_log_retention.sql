-- Enforces the retention promised by the privacy notice: client errors 30 days,
-- admin audit 24 months, expired step-up grants and invite rate-limit windows daily.
create extension if not exists pg_cron with schema pg_catalog;

-- Audit stays append-only for every caller; the only exception is the retention
-- purge below, and only for rows already past the 24-month window.
create or replace function public.reject_admin_audit_change()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('fantafort.retention_purge', true) = 'on'
    and old.created_at < now() - interval '24 months' then
    return old;
  end if;
  raise exception 'Admin audit records are append-only';
end;
$$;

create function public.purge_expired_operational_logs()
returns jsonb language plpgsql security definer set search_path = public set statement_timeout = '60s'
as $$
declare
  errors_deleted integer;
  grants_deleted integer;
  attempts_deleted integer;
  audit_deleted integer;
begin
  delete from app_errors where created_at < now() - interval '30 days';
  get diagnostics errors_deleted = row_count;
  delete from admin_step_up_grants where expires_at <= now() or used_at is not null;
  get diagnostics grants_deleted = row_count;
  delete from league_invite_preview_attempts where window_started_at < now() - interval '1 day';
  get diagnostics attempts_deleted = row_count;
  perform set_config('fantafort.retention_purge', 'on', true);
  delete from admin_audit_log where created_at < now() - interval '24 months';
  get diagnostics audit_deleted = row_count;
  perform set_config('fantafort.retention_purge', 'off', true);
  return jsonb_build_object('appErrors', errors_deleted, 'stepUpGrants', grants_deleted,
    'invitePreviewAttempts', attempts_deleted, 'adminAudit', audit_deleted);
end;
$$;

revoke all on function public.purge_expired_operational_logs() from public, anon, authenticated;
grant execute on function public.purge_expired_operational_logs() to service_role;

select cron.schedule('purge-expired-operational-logs', '23 3 * * *', 'select public.purge_expired_operational_logs()');
