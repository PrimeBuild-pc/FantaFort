-- The database outgrew the free plan (649 MB of 500 MB): tournament_sessions alone was
-- 459 MB, one row per team per match with the full provider stats JSON. Its only reader was
-- the backfill below, which needs three per-team totals. Keep those on the team row and drop
-- the per-match history; the live leaderboard reads sessions from the provider directly.
set local statement_timeout = '10min';

alter table public.tournament_teams
  add column if not exists matches integer not null default 0,
  add column if not exists wins integer not null default 0,
  add column if not exists team_eliminations integer not null default 0;

update public.tournament_teams team set
  matches = totals.matches, wins = totals.wins, team_eliminations = totals.eliminations
from (
  select window_id, team_id, count(*)::integer matches,
    (count(*) filter (where victory))::integer wins,
    coalesce(sum(team_eliminations), 0)::integer eliminations
  from public.tournament_sessions
  group by window_id, team_id
) totals
where team.window_id = totals.window_id and team.team_id = totals.team_id;

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
      team.matches, team.wins, team.team_eliminations,
      team.percentile, now()
    from public.tournament_team_members member
    join public.players carried
      on carried.account_id = member.account_id and carried.active
    join public.tournament_teams team
      on team.window_id = member.window_id and team.team_id = member.team_id
    -- Skip results that already exist before the per-team session counts: almost every
    -- member row has one, and computing them only for ON CONFLICT to discard them took
    -- 100-190 s, past the API gateway timeout that failed the daily pool sync.
    where not exists (
      select 1 from public.player_results recorded
      where recorded.window_id = member.window_id and recorded.player_id = carried.id
    )
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

drop table public.tournament_sessions;

notify pgrst, 'reload schema';
