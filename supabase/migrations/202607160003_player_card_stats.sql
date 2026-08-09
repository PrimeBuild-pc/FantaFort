alter table public.players add column birth_date date;

create or replace function public.get_market_players()
returns table (
  id text,
  handle text,
  real_name text,
  organization text,
  photo_url text,
  rarity text,
  price integer,
  earnings integer,
  birth_date date,
  eligibility_note text,
  tournament_points bigint,
  cups_played bigint,
  tournament_wins bigint,
  best_placement integer,
  average_placement numeric
)
language sql stable security invoker set search_path = public
as $$
  select p.id, p.handle, p.real_name, p.organization, p.photo_url, p.rarity, p.price,
    p.earnings, p.birth_date, p.eligibility_note,
    coalesce(sum(r.points), 0)::bigint,
    count(distinct r.window_id)::bigint,
    coalesce(sum(r.wins), 0)::bigint,
    min(r.rank),
    round(avg(r.rank), 1)
  from players p
  left join player_results r on r.player_id = p.id
  where p.active
  group by p.id
  order by p.price desc, p.handle;
$$;

revoke execute on function public.get_market_players() from public;
grant execute on function public.get_market_players() to anon, authenticated;
