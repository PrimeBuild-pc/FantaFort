-- Give a newly carried player the results we already recorded for their account.
--
-- `player_results` is only written for accounts that were in the pool at sync time,
-- so a player added later - recovered from recorded history by the importer, or
-- promoted by an administrator - starts with a blank card even though their team's
-- rank, points and sessions are already stored. That is the same defect that left
-- 94% of the regional and open tiers with no statistics.
--
-- Set-based on purpose: `tournament_sessions` alone holds ~140,000 rows, and paging
-- that through the importer to aggregate it in JavaScript would be slow and would put
-- the arithmetic somewhere the database can do exactly once.

create or replace function public.sync_recorded_player_results()
returns integer language plpgsql security definer set search_path = public
as $$
declare inserted integer;
begin
  with linked as (
    -- Back-link member rows recorded before the account was carried, so the player's
    -- history stops looking like it belongs to nobody.
    update public.tournament_team_members member
    set player_id = carried.id
    from public.players carried
    where carried.account_id = member.account_id
      and carried.active
      and member.player_id is null
    returning 1
  ),
  written as (
    insert into public.player_results (
      window_id, player_id, team_id, team_size, rank, points, matches, wins,
      team_eliminations, percentile, updated_at
    )
    select member.window_id, carried.id, member.team_id,
      greatest(1, least(4, (
        select count(*) from public.tournament_team_members mate
        where mate.window_id = member.window_id and mate.team_id = member.team_id
      )))::integer,
      team.rank, team.points,
      coalesce(session_totals.matches, 0)::integer,
      coalesce(session_totals.wins, 0)::integer,
      coalesce(session_totals.eliminations, 0)::integer,
      team.percentile, now()
    from public.tournament_team_members member
    join public.players carried
      on carried.account_id = member.account_id and carried.active
    join public.tournament_teams team
      on team.window_id = member.window_id and team.team_id = member.team_id
    left join lateral (
      select count(*) matches,
        count(*) filter (where played.victory) wins,
        sum(played.team_eliminations) eliminations
      from public.tournament_sessions played
      where played.window_id = member.window_id and played.team_id = member.team_id
    ) session_totals on true
    -- Never overwrite a result the results sync owns: it has the authoritative
    -- session history for windows it re-crawls.
    on conflict (window_id, player_id) do nothing
    returning 1
  )
  -- `linked` is a data-modifying CTE, so it runs whether or not anything selects
  -- from it; only `written` needs to be read, for the count.
  select count(*) into inserted from written;
  return inserted;
end;
$$;

revoke all on function public.sync_recorded_player_results() from public, anon, authenticated;
grant execute on function public.sync_recorded_player_results() to service_role;

notify pgrst, 'reload schema';
