-- refresh_market_prices() has failed every scheduled results sync (57014 statement
-- timeout, about a minute in) since the player pool grew past a few hundred rows.
-- Same two-part cause as sync_recorded_player_results in 202608150002:
--
-- 1. The per-player lateral reads player_results by player_id, but the only index on
--    that table is the primary key (window_id, player_id). player_id is not a prefix
--    of it, so each of the ~12,000 active players forces a sequential scan over all
--    ~43,000 result rows: roughly half a billion row visits per run.
-- 2. It never set its own statement_timeout, so a batch job only service_role can
--    call inherited whatever short default the API role runs under.
--
-- The body below is unchanged apart from the timeout: the pricing formula is not
-- part of this fix.
create index if not exists player_results_player_idx on public.player_results (player_id);

create or replace function public.refresh_market_prices()
returns integer language plpgsql security definer set search_path = public set statement_timeout = '4min'
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

notify pgrst, 'reload schema';
