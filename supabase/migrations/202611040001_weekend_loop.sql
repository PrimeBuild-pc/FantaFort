-- Weekend loop: the trading list can sort the whole market, and a league can
-- read one focus window (live, else next, else last) without shipping every result.

drop function if exists public.search_market_players(text, integer, integer);

create function public.search_market_players(
  search text default null,
  page_limit integer default 48,
  page_offset integer default 0,
  sort text default 'price'
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
  sort_key text := case when sort in ('price', 'name', 'change') then sort else 'price' end;
  matched bigint;
  page_ids text[];
begin
  if needle is not null and char_length(needle) > 80 then
    raise invalid_parameter_value using message = 'Search term too long';
  end if;

  -- get_players_by_ids reorders by price, so the page order is kept with ordinality below.
  select count(*), (array_agg(p.id order by
      case when sort_key = 'name' then p.handle end,
      case when sort_key = 'change' then coalesce((
        select h.new_price - h.old_price from player_price_history h
        where h.player_id = p.id order by h.changed_at desc limit 1
      ), 0) end desc,
      case when sort_key = 'price' then p.price end desc,
      p.handle
    ))[bounded_offset + 1:bounded_offset + bounded_limit]
    into matched, page_ids
  from players p
  where p.active
    and (needle is null
      or p.handle ilike '%' || needle || '%'
      or p.real_name ilike '%' || needle || '%'
      or p.organization ilike '%' || needle || '%');

  return query
    select r.*, matched
    from unnest(coalesce(page_ids, '{}')) with ordinality as picked(id, ord)
    join public.get_players_by_ids(coalesce(page_ids, '{}')) r on r.id = picked.id
    order by picked.ord;
end;
$$;

revoke all on function public.search_market_players(text, integer, integer, text) from public;
grant execute on function public.search_market_players(text, integer, integer, text) to anon, authenticated;

-- One window for the league the caller belongs to. Points follow scoring mode
-- plus captain, duo and exact-score bonuses for that window. Season synergy
-- stays on get_league_standings. Other managers' picks stay hidden until start.
create function public.get_league_window(target_league uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '4s'
as $$
declare
  league_row public.leagues;
  focus public.tournaments;
  result jsonb;
begin
  if not public.is_league_member(target_league) then
    return null;
  end if;
  select * into league_row from public.leagues where id = target_league;
  if league_row.id is null then
    return null;
  end if;

  select * into focus from public.tournaments t
  where t.region in ('EU', 'NAC', 'NAW')
    and t.starts_at >= coalesce(league_row.starts_at, '-infinity'::timestamptz)
    and t.starts_at <= coalesce(league_row.ends_at, 'infinity'::timestamptz)
    and t.starts_at <= now() and t.ends_at >= now()
  order by t.starts_at
  limit 1;

  if focus.window_id is null then
    select * into focus from public.tournaments t
    where t.region in ('EU', 'NAC', 'NAW')
      and t.starts_at >= coalesce(league_row.starts_at, '-infinity'::timestamptz)
      and t.starts_at <= coalesce(league_row.ends_at, 'infinity'::timestamptz)
      and t.starts_at > now()
    order by t.starts_at
    limit 1;
  end if;

  if focus.window_id is null then
    select * into focus from public.tournaments t
    where t.region in ('EU', 'NAC', 'NAW')
      and t.starts_at >= coalesce(league_row.starts_at, '-infinity'::timestamptz)
      and t.starts_at <= coalesce(league_row.ends_at, 'infinity'::timestamptz)
      and t.ends_at < now()
    order by t.ends_at desc
    limit 1;
  end if;

  if focus.window_id is null then
    return jsonb_build_object('window', null, 'players', '[]'::jsonb, 'scores', '[]'::jsonb, 'picks', '[]'::jsonb);
  end if;

  with lines as (
    select re.user_id, re.player_id, pl.handle,
      coalesce(case when cr.player_id is null then r.points else 0 end, 0) as points,
      r.rank, coalesce(r.matches, 0) as matches,
      r.team_id, greatest(coalesce(r.team_size, 1), 1) as team_size
    from public.league_roster_entries re
    join public.players pl on pl.id = re.player_id
    left join public.player_results r on r.player_id = re.player_id and r.window_id = focus.window_id
    left join public.competitive_rulings cr on cr.window_id = r.window_id and cr.player_id = r.player_id
    where re.league_id = target_league
      and re.acquired_at <= focus.starts_at
      and (re.released_at is null or re.released_at > focus.starts_at)
  ), formation as (
    select user_id, coalesce(team_id, player_id) as formation_id, max(points) as points
    from lines
    group by user_id, coalesce(team_id, player_id)
  ), members as (
    select m.user_id, p.username
    from public.league_members m
    join public.profiles p on p.id = m.user_id
    where m.league_id = target_league
  ), base as (
    select m.user_id,
      case league_row.scoring_mode
        when 'classic' then coalesce((select sum(l.points) from lines l where l.user_id = m.user_id), 0)
        when 'balanced' then coalesce((select sum(round(l.points::numeric / l.team_size)) from lines l where l.user_id = m.user_id), 0)
        else coalesce((select sum(f.points) from formation f where f.user_id = m.user_id), 0)
      end::bigint as points
    from members m
  ), strategy as (
    select p.user_id, round(e.points * .10)::bigint as points
    from public.league_strategy_picks p
    join lines e on e.user_id = p.user_id and e.player_id = p.player_id
    where p.league_id = target_league and p.window_id = focus.window_id and p.pick_type = 'captain'
    union all
    select p.user_id, least(150, round(greatest(a.points, b.points) * .10)
      + case when least(a.rank, b.rank) <= 10 then 40 when least(a.rank, b.rank) <= 25 then 20 when least(a.rank, b.rank) <= 50 then 10 else 0 end)::bigint
    from public.league_strategy_picks p
    join lines a on a.user_id = p.user_id and a.player_id = p.player_id
    join lines b on b.user_id = p.user_id and b.player_id = p.partner_player_id and b.team_id is not null and b.team_id = a.team_id
    where p.league_id = target_league and p.window_id = focus.window_id and p.pick_type = 'duo_call'
    union all
    select p.user_id,
      case when abs(p.predicted_points - e.points) = 0 then 150
        when abs(p.predicted_points - e.points) <= 5 then 75
        when abs(p.predicted_points - e.points) <= 15 then 25 else 0 end::bigint
    from public.league_strategy_picks p
    join lines e on e.user_id = p.user_id and e.player_id = p.player_id
    where p.league_id = target_league and p.window_id = focus.window_id and p.pick_type = 'exact_score' and focus.ends_at <= now()
  ), scored as (
    select m.user_id, m.username,
      (b.points + coalesce((select sum(s.points) from strategy s where s.user_id = m.user_id), 0))::bigint as points
    from members m
    join base b on b.user_id = m.user_id
  )
  select jsonb_build_object(
    'window', jsonb_build_object(
      'windowId', focus.window_id,
      'name', focus.name,
      'region', focus.region,
      'startsAt', focus.starts_at,
      'endsAt', focus.ends_at,
      'syncedAt', focus.synced_at,
      'status', case
        when focus.starts_at > now() then 'upcoming'
        when focus.ends_at >= now() then 'live'
        else 'completed' end
    ),
    'players', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', l.user_id, 'playerId', l.player_id, 'handle', l.handle,
      'points', l.points, 'rank', l.rank, 'matches', l.matches
    ) order by l.handle) from lines l), '[]'::jsonb),
    'scores', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', s.user_id, 'username', s.username, 'points', s.points
    ) order by s.points desc, s.username) from scored s), '[]'::jsonb),
    'picks', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', p.user_id,
      'pickType', p.pick_type,
      'playerHandle', pl.handle,
      'partnerHandle', partner.handle,
      'predictedPoints', p.predicted_points,
      'cost', p.cost
    ) order by pl.handle) from public.league_strategy_picks p
      join public.players pl on pl.id = p.player_id
      left join public.players partner on partner.id = p.partner_player_id
      where p.league_id = target_league and p.window_id = focus.window_id
        and (focus.starts_at <= now() or p.user_id = auth.uid())
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_league_window(uuid) from public, anon;
grant execute on function public.get_league_window(uuid) to authenticated;

notify pgrst, 'reload schema';
