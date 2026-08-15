-- sync_recorded_player_results() has been timing out every scheduled player-pool
-- sync since it shipped (57014 statement timeout, ~3min in): it is a deliberately
-- set-based batch job over tables with well over 100,000 rows, but unlike every
-- other RPC in this codebase it never set its own statement_timeout, so it
-- inherited whatever short default the API role runs under.
--
-- Two fixes: give the join a real index instead of forcing a seq scan across all
-- of tournament_team_members for every active player, and set a timeout sized for
-- the batch job it actually is (service_role only, never reachable from the web).
create index if not exists tournament_team_members_account_idx
  on public.tournament_team_members (account_id);

create or replace function public.sync_recorded_player_results()
returns integer language plpgsql security definer set search_path = public set statement_timeout = '4min'
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
