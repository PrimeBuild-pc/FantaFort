-- Market integrity (2026-10-15 review).

-- 1. Freshness means "prices were recomputed", not "a sync started". synced_at is
-- written before repricing and by the pool sync and imports, so trading stayed open
-- while refresh_market_prices failed on every run.
create table public.market_state (
  singleton boolean primary key default true check (singleton),
  repriced_at timestamptz
);
insert into public.market_state(singleton, repriced_at) values (true, (select max(synced_at) from public.tournaments));
alter table public.market_state enable row level security;
create policy "read market state" on public.market_state for select using (true);
revoke all on table public.market_state from public, anon, authenticated;
grant select on table public.market_state to anon, authenticated;
grant all on table public.market_state to service_role;

create or replace function public.is_trading_market_fresh()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select repriced_at from market_state) > now() - case
    when exists(select 1 from tournaments live where live.starts_at <= now() and live.ends_at >= now())
      then interval '30 minutes'
    else interval '2 hours'
  end, false);
$$;

create or replace function public.get_admin_health()
returns jsonb language plpgsql stable security definer set search_path = public set statement_timeout = '2s'
as $$
declare latest timestamptz;
begin
  perform authorize_admin_request();
  select repriced_at into latest from market_state;
  -- Internal checks only: this function performs no outbound request and accepts no URL.
  return jsonb_build_object(
    'database', 'available',
    'authData', case when exists(select 1 from profiles) then 'available' else 'empty' end,
    'competitiveData', case when latest is null then 'unavailable' when latest < now() - interval '2 hours' then 'stale' else 'available' end,
    'latestSync', latest
  );
end;
$$;

-- 2. Repricing reads finished windows only: live leaderboards are public, so pricing
-- them every 15 minutes let anyone buy before a reprice and sell after it. Set-based
-- instead of one UPDATE per player, which held row locks for minutes.
create or replace function public.refresh_market_prices()
returns integer language plpgsql security definer set search_path = public set statement_timeout = '4min'
as $$
declare changed integer;
begin
  with form as (
    select p.id, p.price,
      coalesce(avg(x.points::numeric / greatest(x.matches, 1)), 0) points_per_match,
      coalesce(avg(x.rank), 101) average_rank,
      sum(x.wins)::numeric / greatest(sum(x.matches), 1) win_rate
    from players p
    cross join lateral (
      select r.points, r.matches, r.rank, r.wins
      from player_results r join tournaments t on t.window_id = r.window_id
      where r.player_id = p.id and t.ends_at <= now()
      order by t.ends_at desc limit 5
    ) x
    where p.active and p.retired_at is null
    group by p.id, p.price
  ), moved as (
    select id, price old_price,
      (round(least(6500, greatest(1500,
        1500 + points_per_match * 45 + greatest(0, 101 - average_rank) * 15 + win_rate * 700)) / 25.0) * 25)::integer new_price
    from form
  ), history as (
    insert into player_price_history(player_id, old_price, new_price)
    select id, old_price, new_price from moved where new_price <> old_price
  )
  update players p set price = m.new_price,
    rarity = case when m.new_price >= 5000 then 'legendary' when m.new_price >= 3500 then 'epic'
      when m.new_price >= 2200 then 'rare' else 'common' end
  from moved m where p.id = m.id and m.new_price <> m.old_price;
  get diagnostics changed = row_count;
  update market_state set repriced_at = now() where singleton;
  return changed;
end;
$$;

-- 3. Admin retirement sticks: the daily pool sync re-activated every qualifying account.
alter table public.players add column if not exists retired_at timestamptz;

create or replace function public.admin_retire_market_player(
  target_id text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text
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
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200 then
    raise invalid_parameter_value using message = 'Invalid retirement request';
  end if;

  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = 'player.retire' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    if prior.target_id <> target_id then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('id', prior.target_id, 'replayed', true);
  end if;

  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action = 'player.retire' and created_at > now() - interval '1 hour') >= 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  select * into before from public.players where id = target_id;
  if before.id is null then
    raise invalid_parameter_value using message = 'Player not found';
  end if;
  -- Retiring an already-retired card is a harmless no-op, not an error: it keeps
  -- the button idempotent even without a matching idempotency key from a stale tab.
  update public.players set active = false, retired_at = now() where id = target_id;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
    before_state, after_state, request_id, idempotency_key, outcome)
  values (auth.uid(), 'player.retire', 'player', target_id, trim(action_reason),
    jsonb_build_object('active', before.active), jsonb_build_object('active', false),
    action_request_id, action_idempotency_key, 'succeeded');

  return jsonb_build_object('id', target_id, 'replayed', false);
end;
$$;

create or replace function public.admin_promote_known_account(
  target_account_id text,
  target_tier text,
  action_reason text,
  action_request_id uuid,
  action_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  candidate record;
  prior public.admin_audit_log;
  seed_price integer;
  seed_rarity text;
begin
  perform public.authorize_admin_request();
  -- Fail closed: this mutates the market, so a database-side freeze must stop it.
  -- It skips step-up by design, so it cannot inherit the gate the step-up trigger
  -- applies to the other admin mutations and needs its own check.
  if not coalesce((select player_pool_mutations_enabled from public.admin_runtime_config where singleton), false) then
    raise insufficient_privilege using message = 'Player pool mutations disabled';
  end if;
  if target_account_id is null or char_length(target_account_id) not between 8 and 100
    or target_tier not in ('elite', 'contender', 'regional', 'open')
    or action_reason is null or char_length(trim(action_reason)) not between 3 and 500
    or action_request_id is null
    or action_idempotency_key is null or char_length(action_idempotency_key) not between 8 and 200 then
    raise invalid_parameter_value using message = 'Invalid promotion request';
  end if;

  select * into prior from public.admin_audit_log
  where actor_user_id = auth.uid() and action = 'player.promote' and idempotency_key = action_idempotency_key;
  if prior.id is not null then
    -- A key reused for a different account or tier is a conflict, not a replay:
    -- returning success here would report a promotion that never happened.
    if prior.target_id <> target_account_id
      or coalesce(prior.after_state ->> 'tier', '') <> target_tier then
      raise unique_violation using message = 'Idempotency key already used';
    end if;
    return jsonb_build_object('account', prior.target_id, 'replayed', true);
  end if;

  if (select count(*) from public.admin_audit_log where actor_user_id = auth.uid()
      and action = 'player.promote' and created_at > now() - interval '1 hour') >= 50 then
    raise program_limit_exceeded using message = 'Admin action rate limit reached';
  end if;

  if exists (select 1 from public.players where account_id = target_account_id and active) then
    raise unique_violation using message = 'Account is already in the market';
  end if;

  -- Eligibility comes from stored results, never from the caller. Presence in
  -- `tournaments` is itself proof the event passed the competitive filter at sync
  -- time, so the rules are not restated here and cannot drift from them.
  select member.account_id, max(member.username) as username,
    min(team.rank)::integer as best_rank, max(tournament.name) as event_name,
    max(tournament.region) as region
  into candidate
  from public.tournament_team_members member
  join public.tournament_teams team
    on team.window_id = member.window_id and team.team_id = member.team_id
  join public.tournaments tournament on tournament.window_id = member.window_id
  where member.account_id = target_account_id and member.username is not null
  group by member.account_id
  having min(team.rank) <= 300;

  if candidate.account_id is null then
    raise invalid_parameter_value using message = 'Account has no qualifying competitive result';
  end if;

  seed_price := case target_tier when 'elite' then 4000 when 'contender' then 2800 else 1800 end;
  seed_rarity := case target_tier when 'elite' then 'legendary' when 'contender' then 'epic' else 'rare' end;

  insert into public.players(id, account_id, handle, rarity, price, active, pro_tier, last_seen_at, eligibility_note)
  values (target_account_id, target_account_id, candidate.username, seed_rarity, seed_price, true, target_tier, now(),
    format('Promoted · best rank %s · %s · %s', candidate.best_rank, candidate.event_name, candidate.region))
  on conflict (id) do update set active = true, retired_at = null, pro_tier = excluded.pro_tier, last_seen_at = now();

  -- Back-link the results already stored for this account so the new card is not blank.
  update public.tournament_team_members set player_id = target_account_id
  where account_id = target_account_id and player_id is null;

  insert into public.admin_audit_log(actor_user_id, action, target_type, target_id, reason,
    before_state, after_state, request_id, idempotency_key, outcome)
  values (auth.uid(), 'player.promote', 'player', target_account_id, trim(action_reason),
    jsonb_build_object('inPool', false),
    jsonb_build_object('inPool', true, 'tier', target_tier, 'bestRank', candidate.best_rank),
    action_request_id, action_idempotency_key, 'succeeded');

  return jsonb_build_object('account', target_account_id, 'tier', target_tier,
    'handle', candidate.username, 'bestRank', candidate.best_rank, 'replayed', false);
end;
$$;

-- The pool sync refreshes membership fields only; price and rarity belong to the repricer.
-- An upsert cannot omit them (NOT NULL is checked before ON CONFLICT), hence this function.
create or replace function public.update_pool_players(rows jsonb)
returns integer language plpgsql security definer set search_path = public set statement_timeout = '2min'
as $$
declare changed integer;
begin
  if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows) > 500 then
    raise invalid_parameter_value using message = 'rows must be an array of at most 500 players';
  end if;
  update players p set handle = r.handle, active = true, pro_tier = r.pro_tier,
    last_seen_at = r.last_seen_at, eligibility_note = r.eligibility_note
  from jsonb_to_recordset(rows) as r(id text, handle text, pro_tier text, last_seen_at timestamptz, eligibility_note text)
  where p.id = r.id and p.retired_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.update_pool_players(jsonb) from public, anon, authenticated;
grant execute on function public.update_pool_players(jsonb) to service_role;

-- 4. Abandoned staked leagues can be closed by their members.
create or replace function public.finish_league(target_league uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target leagues; winner uuid; stake_row record; pot integer := 0; wallet_row account_wallets; winner_name text;
begin
  -- Any member may close a league its owner abandoned a day past its end, so stakes cannot stay locked forever.
  select * into target from leagues where id = target_league and status = 'active'
    and (owner_id = auth.uid() or (is_league_member(target_league) and ends_at is not null and now() > ends_at + interval '24 hours'))
    for update;
  if target.id is null then raise exception 'Only the owner can finish an active league'; end if;
  if target.economy_mode = 'account_stake' and now() < target.ends_at then raise exception 'A staked league can only finish at its scheduled end'; end if;
  if exists(select 1 from league_auctions where league_id = target_league and status = 'active') then raise exception 'Settle the active auction first'; end if;
  select d.user_id into winner from get_league_dashboard(target_league) d order by d.points desc, d.username limit 1;
  select username into winner_name from profiles where id = winner;
  select coalesce(sum(amount), 0) into pot from league_stakes where league_id = target_league and status = 'locked';
  for stake_row in select * from league_stakes where league_id = target_league and status = 'locked' for update loop
    update account_wallets set locked_balance = locked_balance - stake_row.amount, updated_at = now() where user_id = stake_row.user_id returning * into wallet_row;
    if stake_row.user_id = winner then
      update account_wallets set balance = balance + pot, updated_at = now() where user_id = winner returning * into wallet_row;
      insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
      values (winner, pot, wallet_row.balance, 'league_prize', 'league', target_league::text, 'league-prize:' || target_league::text || ':' || winner::text, jsonb_build_object('pot', pot));
    else
      insert into wallet_transactions(user_id, amount, balance_after, type, reference_type, reference_id, idempotency_key, metadata)
      values (stake_row.user_id, 0, wallet_row.balance, 'league_loss', 'league', target_league::text, 'league-loss:' || target_league::text || ':' || stake_row.user_id::text, jsonb_build_object('stake', stake_row.amount));
    end if;
    update league_stakes set status = 'paid', settled_at = now() where league_id = target_league and user_id = stake_row.user_id;
  end loop;
  update leagues set status = 'completed', ends_at = least(coalesce(ends_at, now()), now()) where id = target_league;
  insert into profile_xp_events(user_id, league_id, type, amount)
    select user_id, target_league, 'league_completed', 100 from league_members where league_id = target_league;
  insert into profile_xp_events(user_id, league_id, type, amount) values (winner, target_league, 'league_won', 100);
  update profiles set reward_points = reward_points + case when id = winner then 100 else 0 end,
    experience_points = experience_points + case when id = winner then 200 else 100 end
  where id in (select user_id from league_members where league_id = target_league);
  insert into notifications(user_id, type, metadata, dedupe_key)
  select user_id, 'league_completed', jsonb_build_object('league_id', target_league, 'league_name', target.name, 'winner', winner_name, 'xp', case when user_id = winner then 200 else 100 end),
    'league-completed:' || target_league::text from league_members where league_id = target_league;
  return winner;
end;
$$;

notify pgrst, 'reload schema';
