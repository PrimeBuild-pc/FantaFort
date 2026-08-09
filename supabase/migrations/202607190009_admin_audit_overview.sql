-- Bounded audit reader, internal operational health and output redaction. Proposed only.
create index admin_audit_log_action_created on public.admin_audit_log(action, created_at desc);
create index admin_audit_log_outcome_created on public.admin_audit_log(outcome, created_at desc);
create index admin_audit_log_target_type_created on public.admin_audit_log(target_type, created_at desc);

create function public.redact_admin_log(value text)
returns text language sql immutable security definer set search_path = pg_catalog
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(coalesce(value, ''),
                '(?i)bearer[[:space:]]+[a-z0-9._~-]+', 'Bearer [REDACTED]', 'g'),
              '[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', '[JWT REDACTED]', 'g'),
            '(?i)sb_(secret|publishable)_[a-z0-9_-]+', '[SUPABASE KEY REDACTED]', 'g'),
          '(?i)(authorization|cookie|set-cookie|apikey|service[_-]?role|service[_-]?key|access[_-]?token|refresh[_-]?token|token)[[:space:]]*[:=][[:space:]]*[^[:space:],;}"'']+',
            '\1=[REDACTED]', 'g'),
        '(?i)[a-f0-9]{48,}', '[SECRET REDACTED]', 'g'),
      '[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[EMAIL]', 'g'),
    '(?i)[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', '[UUID]', 'g')
$$;

create function public.redact_admin_json(value jsonb)
returns jsonb language sql immutable security definer set search_path = public
as $$
  select public.redact_admin_log(coalesce(value, '{}'::jsonb)::text)::jsonb
$$;

create function public.admin_log_ref(prefix text, value text)
returns text language sql immutable security definer set search_path = pg_catalog
as $$
  select prefix || '_' || left(md5(coalesce(value, '')), 12)
$$;

revoke all on function public.redact_admin_log(text), public.redact_admin_json(jsonb), public.admin_log_ref(text,text) from public;

create or replace function public.log_client_error(error_message text, error_path text, error_stack text default null)
returns void language plpgsql security definer set search_path = public set statement_timeout = '2s'
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  if (select count(*) from app_errors where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then return; end if;
  insert into app_errors(user_id, path, message, stack)
  values (auth.uid(), left(redact_admin_log(coalesce(error_path, '/')), 500),
    left(redact_admin_log(coalesce(error_message, 'Unknown error')), 2000),
    left(redact_admin_log(error_stack), 8000));
end;
$$;

create or replace function public.get_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public set statement_timeout = '3s'
as $$
begin
  perform authorize_admin_request();
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'suspendedUsers', (select count(*) from profiles where account_status = 'suspended'),
    'activeLeagues', (select count(*) from leagues where status = 'active'),
    'pendingFriendRequests', (select count(*) from friendships where status = 'pending'),
    'players', (select count(*) from players where active),
    'errors24h', (select count(*) from app_errors where created_at > now() - interval '24 hours'),
    'adminActions24h', (select count(*) from admin_audit_log where created_at > now() - interval '24 hours'),
    'latestSync', (select max(synced_at) from tournaments)
  );
end;
$$;

create or replace function public.get_admin_errors()
returns table(id bigint, path text, message text, created_at timestamptz)
language plpgsql stable security definer set search_path = public set statement_timeout = '3s'
as $$
begin
  perform authorize_admin_request();
  -- Stack traces remain server-side and are deliberately excluded from this reader.
  return query select e.id, redact_admin_log(e.path), redact_admin_log(e.message), e.created_at
  from app_errors e order by e.created_at desc limit 50;
end;
$$;

create function public.get_admin_health()
returns jsonb language plpgsql stable security definer set search_path = public set statement_timeout = '2s'
as $$
declare latest timestamptz;
begin
  perform authorize_admin_request();
  select max(synced_at) into latest from tournaments;
  -- Internal checks only: this function performs no outbound request and accepts no URL.
  return jsonb_build_object(
    'database', 'available',
    'authData', case when exists(select 1 from profiles) then 'available' else 'empty' end,
    'competitiveData', case when latest is null then 'unavailable' when latest < now() - interval '2 hours' then 'stale' else 'available' end,
    'latestSync', latest
  );
end;
$$;

create function public.admin_list_audit(
  search_filter text default null,
  action_filter text default null,
  outcome_filter text default null,
  target_type_filter text default null,
  target_ref_filter text default null,
  actor_username_filter text default null,
  created_from_filter timestamptz default null,
  created_to_filter timestamptz default null,
  page_index integer default 0,
  page_size integer default 50
)
returns table (
  id bigint,
  actor_ref text,
  actor_username text,
  action text,
  target_type text,
  target_ref text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  request_ref text,
  outcome text,
  error_code text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = public set statement_timeout = '3s'
as $$
declare
  normalized_search text := nullif(trim(search_filter), '');
  effective_from timestamptz := coalesce(created_from_filter, now() - interval '24 months');
  effective_to timestamptz := coalesce(created_to_filter, now());
begin
  perform authorize_admin_request();
  if page_index not between 0 and 1000 or page_size not between 1 and 100 then raise invalid_parameter_value using message = 'Invalid page'; end if;
  if normalized_search is not null and (char_length(normalized_search) not between 2 and 100
    or normalized_search !~ '^[A-Za-z0-9_.:-]+$'
    or normalized_search ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    raise invalid_parameter_value using message = 'Invalid search';
  end if;
  if outcome_filter is not null and outcome_filter not in ('succeeded', 'failed', 'denied') then raise invalid_parameter_value using message = 'Invalid outcome'; end if;
  if action_filter is not null and (char_length(action_filter) > 80 or action_filter !~ '^[a-z][a-z0-9_.]+$') then raise invalid_parameter_value using message = 'Invalid action'; end if;
  if target_type_filter is not null and (char_length(target_type_filter) > 40 or target_type_filter !~ '^[a-z][a-z0-9_]+$') then raise invalid_parameter_value using message = 'Invalid target type'; end if;
  if target_ref_filter is not null and target_ref_filter !~ '^target_[a-f0-9]{12}$' then raise invalid_parameter_value using message = 'Invalid target reference'; end if;
  if actor_username_filter is not null and (char_length(actor_username_filter) not between 3 and 30
    or actor_username_filter !~ '^[A-Za-z0-9_.-]+$') then raise invalid_parameter_value using message = 'Invalid admin'; end if;
  if effective_from > effective_to or effective_to > now() + interval '5 minutes'
    or effective_to - effective_from > interval '25 months' then raise invalid_parameter_value using message = 'Invalid date range'; end if;

  return query select a.id, admin_log_ref('actor', a.actor_user_id::text), redact_admin_log(coalesce(p.username, 'unavailable')),
    a.action, a.target_type, admin_log_ref('target', a.target_id), redact_admin_log(a.reason),
    redact_admin_json(a.before_state), redact_admin_json(a.after_state), admin_log_ref('request', a.request_id::text),
    a.outcome, a.error_code, a.created_at, count(*) over()
  from admin_audit_log a left join profiles p on p.id = a.actor_user_id
  where a.created_at >= effective_from and a.created_at <= effective_to
    and (action_filter is null or a.action = action_filter)
    and (outcome_filter is null or a.outcome = outcome_filter)
    and (target_type_filter is null or a.target_type = target_type_filter)
    and (target_ref_filter is null or admin_log_ref('target', a.target_id) = target_ref_filter)
    and (actor_username_filter is null or lower(p.username) = lower(actor_username_filter))
    and (normalized_search is null or position(lower(normalized_search) in lower(concat_ws(' ',
      p.username, a.action, a.target_type, a.error_code, admin_log_ref('target', a.target_id)))) > 0)
  order by a.created_at desc, a.id desc
  limit page_size offset page_index * page_size;
end;
$$;

revoke all on function public.get_admin_health(),
  public.admin_list_audit(text,text,text,text,text,text,timestamptz,timestamptz,integer,integer) from public;
grant execute on function public.get_admin_health(),
  public.admin_list_audit(text,text,text,text,text,text,timestamptz,timestamptz,integer,integer) to authenticated;
