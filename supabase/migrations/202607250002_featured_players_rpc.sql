create function public.get_featured_players(player_ids text[])
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
  where p.active and p.id = any(player_ids)
  order by p.price desc, p.handle;
$$;

revoke execute on function public.get_featured_players(text[]) from public;
grant execute on function public.get_featured_players(text[]) to anon, authenticated;
