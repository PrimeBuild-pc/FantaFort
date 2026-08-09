create or replace function public.finish_league(target_league uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare winner uuid;
begin
  if not exists(select 1 from leagues where id = target_league and owner_id = auth.uid() and status = 'active') then
    raise exception 'Only the owner can finish an active league';
  end if;
  select m.user_id into winner
  from league_members m
  left join league_roster_entries re on re.league_id = m.league_id and re.user_id = m.user_id
  left join player_results r on r.player_id = re.player_id
  left join tournaments t on t.window_id = r.window_id and t.starts_at >= re.acquired_at
    and (re.released_at is null or t.starts_at < re.released_at)
  where m.league_id = target_league
  group by m.user_id, m.joined_at
  order by coalesce(sum(case when t.window_id is not null then r.points else 0 end), 0) desc, m.joined_at
  limit 1;
  update leagues set status = 'completed', ends_at = now() where id = target_league;
  update profiles set reward_points = reward_points + 100 where id = winner;
  return winner;
end;
$$;
