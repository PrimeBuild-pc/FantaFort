-- Browser-triggered version of scripts/import-results.mjs. The script upserts
-- tournaments/player_results directly with the service-role key, bypassing
-- RLS; this RPC does the same write but security-definer + authorize_admin_request()
-- gated, so the CLI fallback the admin overview page only ever printed as a
-- command can finally be run as an audited in-browser action. Same validation
-- rules as the script: unknown player IDs reject the whole import, nothing
-- partial is ever written.
alter table public.admin_runtime_config
  add column if not exists results_import_enabled boolean not null default false;

create or replace function public.admin_import_tournament_results(
  tournament_data jsonb,
  results_data jsonb,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  prior public.admin_audit_log;
  t_window_id text := tournament_data ->> 'window_id';
  t_event_id text := tournament_data ->> 'event_id';
  t_name text := tournament_data ->> 'name';
  t_region text := tournament_data ->> 'region';
  t_starts_at timestamptz;
  t_ends_at timestamptz;
  t_format text := coalesce(tournament_data ->> 'format', 'unknown');
  result_count integer;
  unknown_ids text[];
  synced timestamptz := now();
begin
  perform public.authorize_admin_request();
  if not coalesce((select results_import_enabled from public.admin_runtime_config where singleton), false) then
    raise insufficient_privilege using message = 'Results import disabled';
  end if;
  if action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200 then
    raise invalid_parameter_value using message = 'Invalid import request';
  end if;

  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = 'results.import' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> coalesce(t_window_id, '') then raise unique_violation using message = 'Idempotency key already used'; end if;
    return jsonb_build_object('windowId', prior.target_id, 'replayed', true);
  end if;

  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action = 'results.import' and created_at > now() - interval '1 hour') >= 20 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  -- Tournament shape, mirroring scripts/import-results.mjs.
  if t_window_id is null or t_event_id is null or t_name is null or t_region is null
    or char_length(t_window_id) = 0 or char_length(t_event_id) = 0 or char_length(t_name) = 0 or char_length(t_region) = 0
    or t_format not in ('unknown', 'solo', 'duo', 'trio', 'squad') then
    raise invalid_parameter_value using message = 'Invalid tournament fields';
  end if;
  begin
    t_starts_at := (tournament_data ->> 'starts_at')::timestamptz;
    t_ends_at := (tournament_data ->> 'ends_at')::timestamptz;
  exception when others then
    raise invalid_parameter_value using message = 'Invalid tournament dates';
  end;
  if t_starts_at is null or t_ends_at is null or t_ends_at <= t_starts_at then
    raise invalid_parameter_value using message = 'Invalid tournament dates';
  end if;

  if jsonb_typeof(results_data) is distinct from 'array' then
    raise invalid_parameter_value using message = 'results must be an array';
  end if;
  select count(*) into result_count from jsonb_array_elements(results_data);
  if result_count < 1 or result_count > 500 then
    raise invalid_parameter_value using message = 'results must have between 1 and 500 entries';
  end if;

  -- Shape-check every entry the same way the script does, before writing anything.
  if exists (
    select 1 from jsonb_to_recordset(results_data) as entry(
      player_id text, rank int, points int, matches int, wins int, team_eliminations int, team_id text, team_size int
    )
    where entry.player_id is null or char_length(entry.player_id) = 0
      or entry.rank is null or entry.rank < 1
      or entry.points is null or entry.points < 0
      or coalesce(entry.matches, 0) < 0 or coalesce(entry.wins, 0) < 0 or coalesce(entry.team_eliminations, 0) < 0
      or coalesce(entry.team_size, 1) not between 1 and 4
  ) then
    raise invalid_parameter_value using message = 'Invalid result entry';
  end if;

  select array_agg(distinct entry.player_id) into unknown_ids
  from jsonb_to_recordset(results_data) as entry(player_id text)
  where not exists (select 1 from public.players p where p.id = entry.player_id);
  if unknown_ids is not null and array_length(unknown_ids, 1) > 0 then
    raise invalid_parameter_value using message = 'Unknown player IDs: ' || array_to_string(unknown_ids, ', ');
  end if;

  insert into public.tournaments(window_id, event_id, name, region, starts_at, ends_at, format, synced_at)
  values (t_window_id, t_event_id, t_name, t_region, t_starts_at, t_ends_at, t_format, synced)
  on conflict (window_id) do update set
    event_id = excluded.event_id, name = excluded.name, region = excluded.region,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at, format = excluded.format, synced_at = excluded.synced_at;

  insert into public.player_results(window_id, player_id, team_id, team_size, rank, points, matches, wins, team_eliminations, updated_at)
  select t_window_id, entry.player_id, entry.team_id, coalesce(entry.team_size, 1), entry.rank, entry.points,
    coalesce(entry.matches, 0), coalesce(entry.wins, 0), coalesce(entry.team_eliminations, 0), synced
  from jsonb_to_recordset(results_data) as entry(
    player_id text, rank int, points int, matches int, wins int, team_eliminations int, team_id text, team_size int
  )
  on conflict (window_id, player_id) do update set
    team_id = excluded.team_id, team_size = excluded.team_size, rank = excluded.rank, points = excluded.points,
    matches = excluded.matches, wins = excluded.wins, team_eliminations = excluded.team_eliminations, updated_at = excluded.updated_at;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
    before_state, after_state, request_id, idempotency_key, outcome)
  values (auth.uid(), 'results.import', 'tournament', t_window_id, trim(action_reason),
    jsonb_build_object('windowId', t_window_id),
    jsonb_build_object('windowId', t_window_id, 'resultCount', result_count),
    action_request_id, action_idempotency_key, 'succeeded');

  return jsonb_build_object('windowId', t_window_id, 'resultCount', result_count, 'replayed', false);
end;
$$;

revoke all on function public.admin_import_tournament_results(jsonb, jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_import_tournament_results(jsonb, jsonb, text, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
