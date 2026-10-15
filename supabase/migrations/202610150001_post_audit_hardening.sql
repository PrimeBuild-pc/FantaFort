-- Post-audit hardening (2026-10-15 review of everything shipped after the August audit).

-- 1. Article 21 objections. Enforced on write so every path (pool sync, results sync,
-- manual import, admin promotion) stores no identifying data for an objector. The opaque
-- account id stays so rosters and results remain referentially intact.
create or replace function public.redact_objected_player()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.player_data_objections where account_id = new.account_id) then
    new.active := false;
    new.handle := 'Removed player';
    new.real_name := null;
    new.organization := null;
    new.photo_url := null;
    new.birth_date := null;
    new.earnings := null;
    new.eligibility_note := 'Data removed on request';
  end if;
  return new;
end;
$$;

create or replace function public.redact_objected_member()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.player_data_objections where account_id = new.account_id) then
    new.username := null;
    new.flag_token := null;
  end if;
  return new;
end;
$$;

create trigger players_redact_objected
before insert or update on public.players
for each row execute function public.redact_objected_player();

create trigger tournament_team_members_redact_objected
before insert or update on public.tournament_team_members
for each row execute function public.redact_objected_member();

-- The update fires the redaction triggers above; the objection itself only needs to touch the rows.
create or replace function public.apply_player_data_objection()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.players set active = false where account_id = new.account_id;
  update public.tournament_team_members set username = null where account_id = new.account_id;
  return new;
end;
$$;

-- Objections received before this migration.
update public.players set active = false
where account_id in (select account_id from public.player_data_objections);
update public.tournament_team_members set username = null
where account_id in (select account_id from public.player_data_objections);

revoke all on function public.redact_objected_player(), public.redact_objected_member(),
  public.apply_player_data_objection() from public, anon, authenticated;

-- 2. Admin price edits: bounded to the repricer range, recorded in the public price
-- history and behind the economy step-up, like wallet adjustments. An unbounded price
-- let a buy -> reprice -> sell cycle mint coins.
drop function public.admin_update_market_player(text, integer, text, text, uuid, text);
create or replace function public.admin_update_market_player(
  target_id text,
  new_price integer,
  new_tier text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text,
  step_up_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  prior public.admin_audit_log;
  before public.players;
begin
  perform public.authorize_admin_request();
  if not coalesce((select player_pool_mutations_enabled from public.admin_runtime_config where singleton), false) then
    raise insufficient_privilege using message = 'Player pool mutations disabled';
  end if;
  if target_id is null or char_length(target_id) not between 1 and 100
    or new_price is null or new_price not between 1500 and 6500
    or new_tier is not null and new_tier not in ('elite', 'contender', 'regional', 'open')
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200
    or step_up_token_hash is null or step_up_token_hash !~ '^[a-f0-9]{64}$' then
    raise invalid_parameter_value using message = 'Invalid player update';
  end if;

  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = 'player.update' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_id then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('id', prior.target_id, 'replayed', true);
  end if;

  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action = 'player.update' and created_at > now() - interval '1 hour') >= 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  select * into before from public.players where id = target_id;
  if before.id is null then
    raise invalid_parameter_value using message = 'Player not found';
  end if;

  perform public.consume_admin_step_up_grant(step_up_token_hash, 'economy');

  update public.players set price = new_price, pro_tier = coalesce(new_tier, pro_tier),
    rarity = case when new_price >= 5000 then 'legendary' when new_price >= 3500 then 'epic'
      when new_price >= 2200 then 'rare' else 'common' end
  where id = target_id;
  if new_price <> before.price then
    insert into public.player_price_history(player_id, old_price, new_price) values (target_id, before.price, new_price);
  end if;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
    before_state, after_state, request_id, idempotency_key, outcome)
  values (auth.uid(), 'player.update', 'player', target_id, trim(action_reason),
    jsonb_build_object('price', before.price, 'tier', before.pro_tier),
    jsonb_build_object('price', new_price, 'tier', coalesce(new_tier, before.pro_tier)),
    action_request_id, action_idempotency_key, 'succeeded');

  return jsonb_build_object('id', target_id, 'price', new_price, 'tier', coalesce(new_tier, before.pro_tier), 'replayed', false);
end;
$$;

revoke all on function public.admin_update_market_player(text, integer, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_update_market_player(text, integer, text, text, uuid, text, text) to authenticated, service_role;

-- 3. Manual results import never overwrites a provider-synced window.
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

  -- Provider-synced windows carry leaderboard teams; a manual import must not overwrite them.
  if exists (select 1 from public.tournament_teams where window_id = t_window_id) then
    raise invalid_parameter_value using message = 'Window is owned by the provider sync';
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

-- 4. Suspended accounts cannot change their public look.
create or replace function public.equip_cosmetic(cosmetic_kind text, cosmetic_slug text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare item cosmetics;
begin
  if auth.uid() is null or not is_account_active() then raise exception 'Sign in required'; end if;
  if cosmetic_kind not in ('name_style', 'avatar') or cosmetic_slug is null then
    raise exception 'Invalid cosmetic';
  end if;
  if cosmetic_slug = 'default' then
    if cosmetic_kind = 'name_style' then
      update profiles set name_style = 'default' where id = auth.uid();
    else
      update profiles set avatar_style = 'default' where id = auth.uid();
    end if;
    return jsonb_build_object('kind', cosmetic_kind, 'slug', 'default');
  end if;
  select * into item from cosmetics where slug = cosmetic_slug and kind = cosmetic_kind and active;
  if item.id is null then raise exception 'Unknown cosmetic'; end if;
  if not exists(select 1 from user_cosmetics where user_id = auth.uid() and cosmetic_id = item.id) then
    raise exception 'Cosmetic not owned';
  end if;
  if item.kind = 'name_style' then
    update profiles set name_style = item.slug where id = auth.uid();
  else
    update profiles set avatar_style = item.slug where id = auth.uid();
  end if;
  return jsonb_build_object('kind', item.kind, 'slug', item.slug);
end;
$$;

-- 5. Anonymisation also clears consents, the public lineup, badges and cosmetics.
create or replace function public.admin_anonymize_profile(
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
  delete from user_badges b where b.user_id = subject_id;
  delete from user_cosmetics c where c.user_id = subject_id;
  update profiles set username = anonymized_username, locale = 'en',
    name_style = 'default', avatar_style = 'default', last_seen_at = null,
    account_status = 'anonymized', status_changed_at = now(),
    public_lineup_enabled = false, community_email_opt_in = false,
    community_email_opted_in_at = null, community_email_opted_out_at = null,
    community_email_consent_version = null, community_email_consent_source = null
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

-- 6. Username search on the public leaderboard requires sign-in.
create or replace function public.get_global_leaderboard(search_username text default null)
returns table (
  rank bigint,
  username text,
  name_style text,
  avatar_style text,
  net_worth bigint,
  badges jsonb,
  public_lineup boolean,
  is_current_user boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set statement_timeout = '3s'
as $$
declare query text := nullif(trim(search_username), '');
begin
  if query is not null and (char_length(query) > 30 or query !~ '^[A-Za-z0-9_.-]+$') then
    raise invalid_parameter_value using message = 'Invalid nickname search';
  end if;
  -- The top 50 stays public; searching every username is for signed-in managers only.
  if query is not null and auth.uid() is null then
    raise insufficient_privilege using message = 'Sign in required';
  end if;

  return query
  select rows.rank, rows.username, rows.name_style, profile.avatar_style, rows.net_worth,
    public.public_badges_for_user(rows.user_id, rows.rank),
    coalesce(profile.public_lineup_enabled, false),
    rows.user_id = auth.uid()
  from public.global_leaderboard_rows() rows
  join public.profiles profile on profile.id = rows.user_id
  where case when query is null
    then rows.rank <= 50 or rows.user_id = auth.uid()
    else position(lower(query) in lower(rows.username)) > 0
  end
  order by rows.rank
  limit case when query is null then 51 else 20 end;
end;
$$;

-- 7. Supabase default privileges grant EXECUTE to anon; these only revoked it from public.
revoke all on function public.admin_list_errors(text, integer, integer),
  public.admin_list_privacy_requests(text, integer, integer) from public, anon;

-- 8. Hosted and local projects still auto-grant full table privileges to the API roles,
-- contrary to the assumption in 202607190001. RLS has no write policies, so this was not
-- exploitable, but a single permissive policy would have opened writes. Every client
-- write goes through security-definer RPCs; the watchlist is the only direct one.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
grant insert, delete on public.account_watchlist to authenticated;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

notify pgrst, 'reload schema';
