-- Server-side market: stop shipping the whole player pool to every browser.
--
-- `get_market_players()` returns every active player with four lateral joins, and the
-- client paginated through all of it at login (src/lib/market-players.ts). At 1,036
-- players that was already heavy; the pool import now restores ~4,500 and the plan
-- targets ~8,000. Header calls useGame(), so every page - including the admin console -
-- waited for that whole download before rendering.
--
-- The lateral block lives once, in get_players_by_ids(), and the search delegates to
-- it, so the expensive joins only ever run for a bounded set of ids. Everything here
-- is security invoker: RLS on players still applies and the chain runs as the caller.

-- Default market ordering.
create index if not exists players_active_price_idx
  on public.players (price desc, handle)
  where active;

-- Resolves an explicit, bounded id set: a market page, a league roster, portfolio
-- positions, a single card.
create or replace function public.get_players_by_ids(ids text[])
returns table (
  id text, handle text, real_name text, organization text, photo_url text, rarity text,
  price integer, earnings integer, birth_date date, eligibility_note text,
  tournament_points bigint, cups_played bigint, tournament_wins bigint,
  best_placement integer, average_placement numeric, points_per_match numeric,
  win_rate numeric, price_change integer, teammates jsonb
)
language plpgsql stable security invoker set search_path = public
as $$
begin
  if ids is null or array_length(ids, 1) is null then
    return;
  end if;
  if array_length(ids, 1) > 500 then
    raise invalid_parameter_value using message = 'Too many player ids';
  end if;

  return query
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
  where p.id = any(ids)
  order by p.price desc, p.handle;
end;
$$;

-- One page of the market plus the unpaginated match count, so the pager does not
-- need the rest of the pool to know how many pages exist.
create or replace function public.search_market_players(
  search text default null,
  page_limit integer default 48,
  page_offset integer default 0
)
returns table (
  id text, handle text, real_name text, organization text, photo_url text, rarity text,
  price integer, earnings integer, birth_date date, eligibility_note text,
  tournament_points bigint, cups_played bigint, tournament_wins bigint,
  best_placement integer, average_placement numeric, points_per_match numeric,
  win_rate numeric, price_change integer, teammates jsonb, total_count bigint
)
language plpgsql stable security invoker set search_path = public
as $$
declare
  needle text := nullif(btrim(coalesce(search, '')), '');
  bounded_limit integer := least(greatest(coalesce(page_limit, 48), 1), 100);
  bounded_offset integer := least(greatest(coalesce(page_offset, 0), 0), 100000);
  matched bigint;
  page_ids text[];
begin
  if needle is not null and char_length(needle) > 80 then
    raise invalid_parameter_value using message = 'Search term too long';
  end if;

  select count(*), (array_agg(p.id order by p.price desc, p.handle))[bounded_offset + 1:bounded_offset + bounded_limit]
    into matched, page_ids
  from players p
  where p.active
    and (needle is null
      or p.handle ilike '%' || needle || '%'
      or p.real_name ilike '%' || needle || '%'
      or p.organization ilike '%' || needle || '%');

  return query
    select r.*, matched from public.get_players_by_ids(coalesce(page_ids, '{}')) r;
end;
$$;

-- Market-wide aggregates for the trading overview, previously derived client-side
-- from the full pool.
create or replace function public.get_market_summary()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with latest as (
    select p.id, p.handle, m.change
    from players p
    left join lateral (
      select h.new_price - h.old_price change from player_price_history h
      where h.player_id = p.id order by h.changed_at desc limit 1
    ) m on true
    where p.active
  )
  select jsonb_build_object(
    'listed', (select count(*) from latest),
    'advancing', (select count(*) from latest where change > 0),
    'declining', (select count(*) from latest where change < 0),
    'averageMove', coalesce((select round(avg(coalesce(change, 0)), 1) from latest), 0),
    'movers', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'handle', handle, 'priceChange', change))
      from (select id, handle, change from latest where change is not null and change <> 0
            order by abs(change) desc, handle limit 8) top), '[]'::jsonb)
  );
$$;

revoke execute on function
  public.get_players_by_ids(text[]),
  public.search_market_players(text, integer, integer),
  public.get_market_summary() from public;
grant execute on function
  public.get_players_by_ids(text[]),
  public.search_market_players(text, integer, integer),
  public.get_market_summary() to anon, authenticated;
