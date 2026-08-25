import { createClient } from '@supabase/supabase-js';
import { fetchOsirionJson, isLeaderboardResponse, isTournamentResponse } from '../src/lib/osirion-fetch.ts';
import { eventFormat, isCompetitiveEvent, pagesForRankLimit, POOL_REGIONS, sizeFromFormat } from '../src/lib/pro-eligibility.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase URL or server key');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const now = Date.now();
const cutoff = now - 14 * 24 * 60 * 60 * 1000;
const future = now + 21 * 24 * 60 * 60 * 1000;
const players = [];
for (let from = 0; ; from += 1000) {
  // PostgREST caps a response well below the size of the pool, so an unpaginated read
  // silently saw a fraction of the eligible accounts and dropped every leaderboard entry
  // belonging to the rest. sync-player-pool.mjs already pages for the same reason.
  const { data, error: playersError } = await supabase.from('players').select('id, account_id').eq('active', true).not('account_id', 'is', null).range(from, from + 999);
  if (playersError) throw playersError;
  players.push(...data);
  if (data.length < 1000) break;
}
if (players.length > 25_000) throw new Error('Active player set exceeds record limit');
console.log(`Mapping ${players.length} eligible accounts.`);

const playerByAccount = new Map(players.map(player => [player.account_id, player.id]));
const tournamentRows = new Map();
const teams = new Map();
const members = new Map();
const sessions = new Map();
const results = new Map();
const largestTeams = new Map();

function formatFromSize(size) { return ['unknown', 'solo', 'duo', 'trio', 'squad'][size] || 'unknown'; }

for (const region of POOL_REGIONS) {
  const data = await fetchOsirionJson(`/tournaments?region=${region}&includeHistoricData=true`, isTournamentResponse);
  const windows = data.tournaments
    .filter(event => isCompetitiveEvent(event.eventId))
    .flatMap(event => event.eventWindows.map(window => ({ event, window })))
    .filter(({ window }) => Date.parse(window.endTime) >= cutoff && Date.parse(window.beginTime) <= future)
    .map(({ event, window }) => ({ event, window, location:window.scoreLocations.find(item => item.isMain) || window.scoreLocations[0] }))
    .filter(item => item.location)
    .sort((a, b) => Date.parse(b.window.endTime) - Date.parse(a.window.endTime));
  if (windows.length > 1_000) throw new Error('Osirion tournament window count exceeds limit');

  for (const { event, window, location } of windows) {
    tournamentRows.set(location.leaderboardEventWindowId, {
      window_id:location.leaderboardEventWindowId,
      event_id:location.leaderboardEventId,
      name:event.displayData?.longFormatTitle || event.displayData?.titleLine1 || event.eventId,
      region,
      starts_at:window.beginTime,
      ends_at:window.endTime,
      round:window.round || 0,
      match_cap:window.matchCap || null,
      format:eventFormat(window.playlistId, event.eventId),
      description:event.displayData?.detailsDescription || event.displayData?.flavorDescription || null,
      image_url:event.displayData?.playlistTileImage || event.displayData?.loadingScreenImage || null,
      scoring_rules:location.scoringRules || [],
      payout_tables:location.payoutTables || [],
      synced_at:new Date().toISOString(),
    });
  }

  // Scoring must reach at least as deep as intake does, or the pool fills with
  // players who can never earn a point. Regions and depth both come from the shared
  // eligibility module for exactly that reason. Budget: 3 regions x 8 windows x <=3
  // pages, comfortably inside the provider's ~60 requests/minute.
  for (const { event, window, location } of windows.filter(({ window }) => Date.parse(window.beginTime) <= now).slice(0, 8)) {
    const expectedTeamSize = sizeFromFormat(eventFormat(window.playlistId, event.eventId));
    let totalPages = 1;
    let plannedPages = 1;
    let largestTeam = 1;
    for (let page = 0; page < Math.min(totalPages, plannedPages); page++) {
      const params = new URLSearchParams({
        leaderboardEventId:location.leaderboardEventId,
        leaderboardEventWindowId:location.leaderboardEventWindowId,
        page:String(page),
      });
      const { leaderboard } = await fetchOsirionJson(`/tournaments/leaderboard?${params}`, isLeaderboardResponse);
      totalPages = leaderboard.totalPages;
      if (page === 0) plannedPages = pagesForRankLimit(leaderboard.entries.length);
      for (const entry of leaderboard.entries) {
        const visiblePlayers = entry.players || [];
        const teamId = entry.teamId || visiblePlayers.map(player => player.accountId).filter(Boolean).sort().join(':');
        if (!teamId) continue;
        const teamSize = Math.min(4, Math.max(expectedTeamSize, visiblePlayers.length));
        largestTeam = Math.max(largestTeam, teamSize);
        teams.set(`${location.leaderboardEventWindowId}:${teamId}`, {
          window_id:location.leaderboardEventWindowId,
          team_id:teamId,
          rank:entry.rank,
          points:entry.pointsEarned,
          percentile:entry.percentile ?? null,
          updated_at:leaderboard.updatedAt || new Date().toISOString(),
        });

        for (const account of visiblePlayers) {
          if (!account.accountId) continue;
          members.set(`${location.leaderboardEventWindowId}:${teamId}:${account.accountId}`, {
            window_id:location.leaderboardEventWindowId,
            team_id:teamId,
            account_id:account.accountId,
            player_id:playerByAccount.get(account.accountId) || null,
            username:account.username || null,
            flag_token:account.flagToken || null,
          });
          const playerId = playerByAccount.get(account.accountId);
          if (!playerId) continue;
          const history = entry.sessionHistory || [];
          results.set(`${location.leaderboardEventWindowId}:${playerId}`, {
            window_id:location.leaderboardEventWindowId,
            player_id:playerId,
            team_id:teamId,
            team_size:teamSize,
            rank:entry.rank,
            points:entry.pointsEarned,
            matches:history.length,
            wins:history.filter(session => session.trackedStats?.VICTORY_ROYALE_STAT > 0).length,
            team_eliminations:history.reduce((sum, session) => sum + (session.trackedStats?.TEAM_ELIMS_STAT_INDEX || 0), 0),
            percentile:entry.percentile ?? null,
            updated_at:leaderboard.updatedAt || new Date().toISOString(),
          });
        }

        for (const session of entry.sessionHistory || []) {
          if (!session.sessionId) continue;
          const stats = session.trackedStats || {};
          sessions.set(`${location.leaderboardEventWindowId}:${teamId}:${session.sessionId}`, {
            window_id:location.leaderboardEventWindowId,
            team_id:teamId,
            session_id:session.sessionId,
            ended_at:session.endTime || null,
            placement:stats.PLACEMENT_STAT_INDEX || null,
            team_eliminations:stats.TEAM_ELIMS_STAT_INDEX || 0,
            victory:stats.VICTORY_ROYALE_STAT > 0,
            time_alive:stats.TIME_ALIVE_STAT || null,
            tracked_stats:stats,
          });
        }
      }
    }
    largestTeams.set(location.leaderboardEventWindowId, largestTeam);
  }
}

for (const [label, rows, limit] of [
  ['tournaments', tournamentRows, 2_000], ['teams', teams, 20_000], ['members', members, 80_000],
  ['sessions', sessions, 100_000], ['results', results, 20_000],
]) if (rows.size > limit) throw new Error(`Osirion ${label} exceed record limit`);

async function upsert(table, rows) {
  const values = [...rows.values()];
  for (let index = 0; index < values.length; index += 500) {
    const { error } = await supabase.from(table).upsert(values.slice(index, index + 500));
    if (error) throw error;
  }
}

// All provider responses are bounded and validated before the first write. Upserts are idempotent if a DB call fails mid-run.
// Each phase announces itself: a bare Postgres error in the workflow log otherwise names no step.
for (const [table, rows] of [
  ['tournaments', tournamentRows], ['tournament_teams', teams], ['tournament_team_members', members],
  ['tournament_sessions', sessions], ['player_results', results],
]) {
  console.log(`Upserting ${rows.size} ${table} rows.`);
  await upsert(table, rows);
}
for (const [windowId, largestTeam] of largestTeams) {
  if (largestTeam <= 1) continue;
  const { error } = await supabase.from('tournaments').update({ format:formatFromSize(largestTeam) }).eq('window_id', windowId).eq('format', 'unknown');
  if (error) throw error;
}
console.log('Repricing the market.');
const { data: repriced, error:priceError } = await supabase.rpc('refresh_market_prices');
if (priceError) throw priceError;
console.log(`Synced ${results.size} player results and ${sessions.size} sessions; repriced ${repriced} players.`);
