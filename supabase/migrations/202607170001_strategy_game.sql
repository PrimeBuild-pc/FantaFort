-- Strategic leagues, tournament formations, live sessions and bounded bonuses.
alter table public.leagues
  add column initial_budget integer not null default 10000 check (initial_budget between 6000 and 30000),
  add column roster_size integer not null default 3 check (roster_size between 2 and 4),
  add column draft_hours integer not null default 24 check (draft_hours between 1 and 168),
  add column duration_days integer not null default 30 check (duration_days between 1 and 365),
  add column scoring_mode text not null default 'classic' check (scoring_mode in ('classic', 'balanced', 'formation')),
  add column market_closes_at timestamptz;

alter table public.tournaments
  add column round integer not null default 0,
  add column match_cap integer,
  add column format text not null default 'unknown' check (format in ('unknown', 'solo', 'duo', 'trio', 'squad')),
  add column description text,
  add column image_url text,
  add column scoring_rules jsonb not null default '[]'::jsonb,
  add column payout_tables jsonb not null default '[]'::jsonb;

alter table public.player_results
  add column team_id text,
  add column team_size integer not null default 1 check (team_size between 1 and 4),
  add column percentile numeric,
  add column updated_at timestamptz not null default now();

create table public.tournament_teams (
  window_id text not null references public.tournaments(window_id) on delete cascade,
  team_id text not null,
  rank integer not null check (rank > 0),
  points integer not null default 0,
  percentile numeric,
  updated_at timestamptz not null default now(),
  primary key (window_id, team_id)
);

create table public.tournament_team_members (
  window_id text not null,
  team_id text not null,
  account_id text not null,
  player_id text references public.players(id) on delete set null,
  username text,
  flag_token text,
  primary key (window_id, team_id, account_id),
  foreign key (window_id, team_id) references public.tournament_teams(window_id, team_id) on delete cascade
);

create table public.tournament_sessions (
  window_id text not null,
  team_id text not null,
  session_id text not null,
  ended_at timestamptz,
  placement integer,
  team_eliminations integer not null default 0,
  victory boolean not null default false,
  time_alive integer,
  tracked_stats jsonb not null default '{}'::jsonb,
  primary key (window_id, team_id, session_id),
  foreign key (window_id, team_id) references public.tournament_teams(window_id, team_id) on delete cascade
);

create table public.player_price_history (
  id bigint generated always as identity primary key,
  player_id text not null references public.players(id) on delete cascade,
  old_price integer not null check (old_price > 0),
  new_price integer not null check (new_price > 0),
  changed_at timestamptz not null default now()
);
create index player_price_history_latest on public.player_price_history(player_id, changed_at desc);

-- Only verified rulings are entered by the service role. Unscored sessions are not treated as cheating.
create table public.competitive_rulings (
  window_id text not null references public.tournaments(window_id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  ruling text not null check (ruling in ('disqualification', 'cheating_ban')),
  points_penalty integer not null default -50 check (points_penalty between -200 and 0),
  source_url text not null check (source_url ~ '^https://'),
  verified_at timestamptz not null,
  notes text,
  primary key (window_id, player_id)
);

create table public.league_strategy_picks (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  window_id text not null references public.tournaments(window_id) on delete cascade,
  pick_type text not null check (pick_type in ('captain', 'duo_call', 'exact_score')),
  player_id text not null references public.players(id),
  partner_player_id text references public.players(id),
  predicted_points integer check (predicted_points between 0 and 1000),
  cost integer not null check (cost > 0),
  created_at timestamptz not null default now(),
  unique (league_id, user_id, window_id, pick_type),
  check ((pick_type = 'duo_call') = (partner_player_id is not null)),
  check ((pick_type = 'exact_score') = (predicted_points is not null)),
  check (partner_player_id is null or partner_player_id <> player_id)
);

alter table public.tournament_teams enable row level security;
alter table public.tournament_team_members enable row level security;
alter table public.tournament_sessions enable row level security;
alter table public.player_price_history enable row level security;
alter table public.competitive_rulings enable row level security;
alter table public.league_strategy_picks enable row level security;

create policy "read tournament teams" on public.tournament_teams for select using (true);
create policy "read tournament team members" on public.tournament_team_members for select using (true);
create policy "read tournament sessions" on public.tournament_sessions for select using (true);
create policy "read price history" on public.player_price_history for select using (true);
create policy "read verified rulings" on public.competitive_rulings for select using (true);
create policy "members read strategy picks" on public.league_strategy_picks for select using (is_league_member(league_id));

-- Replace the original one-argument RPC to avoid PostgREST overload ambiguity.
drop function public.create_league(text);
create function public.create_league(
  league_name text,
  budget integer,
  slots integer,
  market_hours integer,
  league_days integer,
  mode text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid; code text;
begin
  league_name := trim(league_name);
  if char_length(league_name) not between 3 and 40 then raise exception 'League name must be 3-40 characters'; end if;
  if budget not between 6000 and 30000 then raise exception 'Budget must be 6,000-30,000'; end if;
  if slots not between 2 and 4 then raise exception 'Roster must have 2-4 players'; end if;
  if market_hours not between 1 and 168 then raise exception 'Market duration must be 1-168 hours'; end if;
  if league_days not between 1 and 365 then raise exception 'League duration must be 1-365 days'; end if;
  if mode not in ('classic', 'balanced', 'formation') then raise exception 'Invalid scoring mode'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into leagues(name, owner_id, invite_code, initial_budget, roster_size, draft_hours, duration_days, scoring_mode)
  values (league_name, auth.uid(), code, budget, slots, market_hours, league_days, mode) returning id into new_id;
  insert into league_members(league_id, user_id, role, coins) values (new_id, auth.uid(), 'owner', budget);
  return new_id;
end;
$$;

create or replace function public.join_league(code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target leagues; member_count integer;
begin
  select * into target from leagues where invite_code = upper(trim(code)) for update;
  if target.id is null then raise exception 'Invite code not found'; end if;
  if target.status <> 'lobby' then raise exception 'League already started'; end if;
  select count(*) into member_count from league_members where league_id = target.id;
  if member_count >= target.max_members then raise exception 'League is full'; end if;
  insert into league_members(league_id, user_id, coins) values (target.id, auth.uid(), target.initial_budget) on conflict do nothing;
  return target.id;
end;
$$;

create or replace function public.start_league(target_league uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists(select 1 from leagues where id = target_league and owner_id = auth.uid() and status = 'lobby') then
    raise exception 'Only the owner can start this league';
  end if;
  if (select count(*) from league_members where league_id = target_league) < 2 then
    raise exception 'Invite at least one friend before starting';
  end if;
  update leagues set status = 'active', starts_at = now(),
    market_closes_at = now() + make_interval(hours => draft_hours),
    ends_at = now() + make_interval(days => duration_days)
  where id = target_league;
end;
$$;

create or replace function public.league_buy_player(target_league uuid, target_player_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare player_price integer; current_coins integer; slots integer;
begin
  if not is_league_member(target_league) then raise exception 'Not a league member'; end if;
  select roster_size into slots from leagues where id = target_league and status = 'active' and now() < market_closes_at;
  if slots is null then raise exception 'Market is not open'; end if;
  select price into player_price from players where id = target_player_id and active;
  if player_price is null then raise exception 'Player unavailable'; end if;
  select coins into current_coins from league_members where league_id = target_league and user_id = auth.uid() for update;
  if current_coins < player_price then raise exception 'Not enough V-Coins'; end if;
  if (select count(*) from league_roster_entries where league_id = target_league and user_id = auth.uid() and released_at is null) >= slots then
    raise exception 'Roster is full';
  end if;
  if exists(select 1 from league_roster_entries where league_id = target_league and player_id = target_player_id and released_at is null) then
    raise exception 'Player already owned in this league';
  end if;
  insert into league_roster_entries(league_id, user_id, player_id, acquired_price)
  values (target_league, auth.uid(), target_player_id, player_price);
  update league_members set coins = coins - player_price where league_id = target_league and user_id = auth.uid();
end;
$$;

create or replace function public.league_sell_player(target_league uuid, target_player_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare entry_id bigint; refund integer;
begin
  if not exists(select 1 from leagues where id = target_league and status = 'active' and now() < market_closes_at) then
    raise exception 'Market is not open';
  end if;
  select re.id, greatest(1, floor(p.price * 0.95))::integer into entry_id, refund
  from league_roster_entries re join players p on p.id = re.player_id
  where re.league_id = target_league and re.user_id = auth.uid() and re.player_id = target_player_id and re.released_at is null
  limit 1 for update of re;
  if entry_id is null then raise exception 'Player not in your roster'; end if;
  update league_roster_entries set released_at = now() where id = entry_id;
  update league_members set coins = coins + refund where league_id = target_league and user_id = auth.uid();
end;
$$;

create function public.buy_strategy_pick(
  target_league uuid,
  target_window text,
  strategy text,
  target_player_id text,
  partner_id text,
  prediction integer
)
returns void language plpgsql security definer set search_path = public
as $$
declare league_row leagues; tournament_start timestamptz; pick_cost integer;
begin
  select * into league_row from leagues where id = target_league and status = 'active' for share;
  if league_row.id is null or not is_league_member(target_league) then raise exception 'Active league required'; end if;
  select starts_at into tournament_start from tournaments
  where window_id = target_window and starts_at > now() and starts_at <= league_row.ends_at;
  if tournament_start is null then raise exception 'Prediction window is closed'; end if;
  if strategy not in ('captain', 'duo_call', 'exact_score') then raise exception 'Invalid strategy'; end if;
  if not exists(select 1 from league_roster_entries where league_id = target_league and user_id = auth.uid()
    and player_id = target_player_id and released_at is null) then raise exception 'Player not in your roster'; end if;
  if strategy = 'duo_call' then
    if partner_id is null or partner_id = target_player_id or not exists(select 1 from league_roster_entries
      where league_id = target_league and user_id = auth.uid() and player_id = partner_id and released_at is null)
      then raise exception 'Choose two different roster players'; end if;
  else partner_id := null;
  end if;
  if strategy = 'exact_score' then
    if prediction is null or prediction not between 0 and 1000 then raise exception 'Prediction must be 0-1,000'; end if;
  else prediction := null;
  end if;
  pick_cost := greatest(1, round(league_row.initial_budget * case strategy when 'captain' then .05 when 'duo_call' then .03 else .02 end));
  update league_members set coins = coins - pick_cost
  where league_id = target_league and user_id = auth.uid() and coins >= pick_cost;
  if not found then raise exception 'Not enough V-Coins'; end if;
  begin
    insert into league_strategy_picks(league_id, user_id, window_id, pick_type, player_id, partner_player_id, predicted_points, cost)
    values (target_league, auth.uid(), target_window, strategy, target_player_id, partner_id, prediction, pick_cost);
  exception when unique_violation then
    raise exception 'Strategy already used for this tournament';
  end;
end;
$$;

create function public.get_league_score_components(target_league uuid)
returns table(user_id uuid, base_points bigint, synergy_points bigint, strategy_points bigint, penalty_points bigint, projected_points bigint)
language sql stable security definer set search_path = public
as $$
with cfg as (
  select l.* from leagues l where l.id = target_league and is_league_member(target_league)
), members as (
  select m.user_id from league_members m join cfg on cfg.id = m.league_id
), eligible as (
  select re.user_id, r.window_id, r.player_id, r.team_id, greatest(r.team_size, 1) team_size,
    r.rank, r.points, r.matches, t.match_cap, t.ends_at,
    case when cr.player_id is null then r.points else 0 end clean_points,
    case when cr.player_id is null then
      case when t.ends_at > now() and r.matches > 0 and t.match_cap > r.matches
        then round(r.points::numeric / r.matches * t.match_cap)::integer else r.points end
      else 0 end projected_clean_points,
    coalesce(cr.points_penalty, 0) penalty
  from league_roster_entries re
  join cfg on cfg.id = re.league_id
  join player_results r on r.player_id = re.player_id
  join tournaments t on t.window_id = r.window_id
    and t.starts_at >= re.acquired_at
    and t.starts_at >= coalesce(cfg.starts_at, '-infinity'::timestamptz)
    and t.starts_at <= coalesce(cfg.ends_at, 'infinity'::timestamptz)
    and (re.released_at is null or t.starts_at < re.released_at)
  left join competitive_rulings cr on cr.window_id = r.window_id and cr.player_id = r.player_id
), formation_groups as (
  select e.user_id, e.window_id, coalesce(e.team_id, e.player_id) formation_id,
    max(e.clean_points) points, max(e.projected_clean_points) projection
  from eligible e group by e.user_id, e.window_id, coalesce(e.team_id, e.player_id)
), base_scores as (
  select m.user_id,
    case cfg.scoring_mode
      when 'classic' then coalesce((select sum(e.clean_points) from eligible e where e.user_id = m.user_id), 0)
      when 'balanced' then coalesce((select sum(round(e.clean_points::numeric / e.team_size)) from eligible e where e.user_id = m.user_id), 0)
      else coalesce((select sum(f.points) from formation_groups f where f.user_id = m.user_id), 0)
    end::bigint base_points,
    case cfg.scoring_mode
      when 'classic' then coalesce((select sum(e.projected_clean_points) from eligible e where e.user_id = m.user_id), 0)
      when 'balanced' then coalesce((select sum(round(e.projected_clean_points::numeric / e.team_size)) from eligible e where e.user_id = m.user_id), 0)
      else coalesce((select sum(f.projection) from formation_groups f where f.user_id = m.user_id), 0)
    end::bigint base_projection
  from members m cross join cfg
), synergy_groups as (
  select e.user_id, e.window_id, e.team_id, count(distinct e.player_id) teammate_count,
    max(e.clean_points) team_points, max(e.projected_clean_points) team_projection, min(e.rank) rank
  from eligible e where e.team_id is not null and e.penalty = 0
  group by e.user_id, e.window_id, e.team_id having count(distinct e.player_id) >= 2
), synergy_scores as (
  select s.user_id,
    coalesce(sum(round(s.team_points * (5 * (s.teammate_count - 1) + case when s.rank <= 10 then 10 when s.rank <= 25 then 5 when s.rank <= 50 then 2 else 0 end) / 100.0)), 0)::bigint points,
    coalesce(sum(round(s.team_projection * (5 * (s.teammate_count - 1) + case when s.rank <= 10 then 10 when s.rank <= 25 then 5 when s.rank <= 50 then 2 else 0 end) / 100.0)), 0)::bigint projection
  from synergy_groups s group by s.user_id
), strategy_awards as (
  select p.user_id, round(e.clean_points * .10)::bigint points
  from league_strategy_picks p join eligible e on e.user_id = p.user_id and e.window_id = p.window_id and e.player_id = p.player_id
  where p.league_id = target_league and p.pick_type = 'captain'
  union all
  select p.user_id, least(150, round(greatest(a.clean_points, b.clean_points) * .10)
    + case when least(a.rank, b.rank) <= 10 then 40 when least(a.rank, b.rank) <= 25 then 20 when least(a.rank, b.rank) <= 50 then 10 else 0 end)::bigint
  from league_strategy_picks p
  join eligible a on a.user_id = p.user_id and a.window_id = p.window_id and a.player_id = p.player_id
  join eligible b on b.user_id = p.user_id and b.window_id = p.window_id and b.player_id = p.partner_player_id and b.team_id = a.team_id
  where p.league_id = target_league and p.pick_type = 'duo_call'
  union all
  select p.user_id, case when abs(p.predicted_points - e.clean_points) = 0 then 150
    when abs(p.predicted_points - e.clean_points) <= 5 then 75
    when abs(p.predicted_points - e.clean_points) <= 15 then 25 else 0 end::bigint
  from league_strategy_picks p join eligible e on e.user_id = p.user_id and e.window_id = p.window_id and e.player_id = p.player_id
  where p.league_id = target_league and p.pick_type = 'exact_score' and e.ends_at <= now()
), strategy_scores as (
  select user_id, coalesce(sum(points), 0)::bigint points from strategy_awards group by user_id
), penalties as (
  select user_id, coalesce(sum(penalty), 0)::bigint points from eligible group by user_id
)
select m.user_id, b.base_points, coalesce(s.points, 0), coalesce(a.points, 0), coalesce(p.points, 0),
  b.base_projection + coalesce(s.projection, 0) + coalesce(a.points, 0) + coalesce(p.points, 0)
from members m join base_scores b using(user_id)
left join synergy_scores s using(user_id)
left join strategy_scores a using(user_id)
left join penalties p using(user_id);
$$;

-- Return the strategic score breakdown and configuration in one dashboard call.
drop function public.get_league_dashboard(uuid);
create function public.get_league_dashboard(target_league uuid)
returns table(
  user_id uuid, username text, name_style text, points bigint, projected_points bigint,
  base_points bigint, synergy_points bigint, strategy_points bigint, penalty_points bigint,
  coins integer, roster jsonb
)
language sql stable security definer set search_path = public
as $$
  select m.user_id, p.username, p.name_style,
    (s.base_points + s.synergy_points + s.strategy_points + s.penalty_points)::bigint,
    s.projected_points, s.base_points, s.synergy_points, s.strategy_points, s.penalty_points, m.coins,
    coalesce(jsonb_agg(distinct jsonb_build_object('id', pl.id, 'handle', pl.handle, 'photo_url', pl.photo_url, 'price', pl.price))
      filter (where pl.id is not null and re.released_at is null), '[]'::jsonb)
  from league_members m
  join profiles p on p.id = m.user_id
  join get_league_score_components(target_league) s on s.user_id = m.user_id
  left join league_roster_entries re on re.league_id = m.league_id and re.user_id = m.user_id
  left join players pl on pl.id = re.player_id
  where m.league_id = target_league and is_league_member(target_league)
  group by m.user_id, p.username, p.name_style, m.coins, s.base_points, s.synergy_points,
    s.strategy_points, s.penalty_points, s.projected_points
  order by 4 desc, p.username;
$$;

create or replace function public.finish_league(target_league uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare winner uuid;
begin
  if not exists(select 1 from leagues where id = target_league and owner_id = auth.uid() and status = 'active') then
    raise exception 'Only the owner can finish an active league';
  end if;
  select d.user_id into winner from get_league_dashboard(target_league) d order by d.points desc, d.username limit 1;
  update leagues set status = 'completed', ends_at = least(coalesce(ends_at, now()), now()) where id = target_league;
  update profiles set reward_points = reward_points + 100 where id = winner;
  return winner;
end;
$$;

-- Reprice only when competitive form changes; provider sync currently runs every 15 minutes.
create function public.refresh_market_prices()
returns integer language plpgsql security definer set search_path = public
as $$
declare row_data record; target integer; changed integer := 0;
begin
  for row_data in
    select p.id, p.price,
      coalesce(form.points_per_match, 0) points_per_match,
      coalesce(form.average_rank, 101) average_rank,
      coalesce(form.win_rate, 0) win_rate,
      coalesce(form.cups, 0) cups
    from players p
    left join lateral (
      select avg(x.points::numeric / greatest(x.matches, 1)) points_per_match,
        avg(x.rank) average_rank, sum(x.wins)::numeric / greatest(sum(x.matches), 1) win_rate, count(*) cups
      from (
        select r.points, r.matches, r.rank, r.wins
        from player_results r join tournaments t on t.window_id = r.window_id
        where r.player_id = p.id order by t.ends_at desc limit 5
      ) x
    ) form on true
    where p.active
  loop
    if row_data.cups = 0 then continue; end if;
    target := round((least(6500, greatest(1500,
      1500 + row_data.points_per_match * 45 + greatest(0, 101 - row_data.average_rank) * 15 + row_data.win_rate * 700))) / 25.0) * 25;
    if target <> row_data.price then
      insert into player_price_history(player_id, old_price, new_price) values (row_data.id, row_data.price, target);
      update players set price = target,
        rarity = case when target >= 5000 then 'legendary' when target >= 3500 then 'epic' when target >= 2200 then 'rare' else 'common' end
      where id = row_data.id;
      changed := changed + 1;
    end if;
  end loop;
  return changed;
end;
$$;

-- Rich market cards: recent form, latest price movement and actual event teammates.
drop function public.get_market_players();
create function public.get_market_players()
returns table (
  id text, handle text, real_name text, organization text, photo_url text, rarity text,
  price integer, earnings integer, birth_date date, eligibility_note text,
  tournament_points bigint, cups_played bigint, tournament_wins bigint,
  best_placement integer, average_placement numeric, points_per_match numeric,
  win_rate numeric, price_change integer, teammates jsonb
)
language sql stable security invoker set search_path = public
as $$
  select p.id, p.handle, p.real_name, p.organization, p.photo_url, p.rarity, p.price,
    p.earnings, p.birth_date, p.eligibility_note,
    coalesce(total.points, 0), coalesce(total.cups, 0), coalesce(total.wins, 0),
    total.best_rank, total.average_rank,
    coalesce(recent.points_per_match, 0), coalesce(recent.win_rate, 0), coalesce(move.change, 0),
    coalesce(mates.players, '[]'::jsonb)
  from players p
  left join lateral (
    select sum(r.points)::bigint points, count(distinct r.window_id)::bigint cups, sum(r.wins)::bigint wins,
      min(r.rank) best_rank, round(avg(r.rank), 1) average_rank
    from player_results r where r.player_id = p.id
  ) total on true
  left join lateral (
    select round(avg(x.points::numeric / greatest(x.matches, 1)), 1) points_per_match,
      round(sum(x.wins)::numeric * 100 / greatest(sum(x.matches), 1), 1) win_rate
    from (
      select r.points, r.matches, r.wins from player_results r join tournaments t on t.window_id = r.window_id
      where r.player_id = p.id order by t.ends_at desc limit 5
    ) x
  ) recent on true
  left join lateral (
    select h.new_price - h.old_price change from player_price_history h
    where h.player_id = p.id order by h.changed_at desc limit 1
  ) move on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('id', q.id, 'handle', q.handle, 'windowId', q.window_id)) players
    from (
      select distinct on (other.id) other.id, other.handle, mine.window_id, t.ends_at
      from player_results mine
      join player_results teammate on teammate.window_id = mine.window_id and teammate.team_id = mine.team_id and teammate.player_id <> mine.player_id
      join players other on other.id = teammate.player_id
      join tournaments t on t.window_id = mine.window_id
      where mine.player_id = p.id and mine.team_id is not null
      order by other.id, t.ends_at desc limit 4
    ) q
  ) mates on true
  where p.active
  order by p.price desc, p.handle;
$$;

revoke execute on function public.create_league(text,integer,integer,integer,integer,text),
  public.buy_strategy_pick(uuid,text,text,text,text,integer), public.get_league_score_components(uuid),
  public.get_league_dashboard(uuid), public.refresh_market_prices(), public.get_market_players() from public;
grant execute on function public.create_league(text,integer,integer,integer,integer,text),
  public.buy_strategy_pick(uuid,text,text,text,text,integer), public.get_league_dashboard(uuid) to authenticated;
grant execute on function public.get_market_players() to anon, authenticated;
grant execute on function public.refresh_market_prices() to service_role;
