import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase URL or server key');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const api = 'https://fnapi.osirion.gg/v1';
const regions = ['EU', 'NAC'];
const now = Date.now();
const cutoff = now - 14 * 24 * 60 * 60 * 1000;
const future = now + 21 * 24 * 60 * 60 * 1000;

const { data: players, error: playersError } = await supabase
  .from('players')
  .select('id, account_id')
  .eq('active', true)
  .not('account_id', 'is', null);
if (playersError) throw playersError;

const playerByAccount = new Map(players.map(player => [player.account_id, player.id]));
let syncedResults = 0;
let syncedSessions = 0;

function isFantasyEvent(eventId) {
  const id = eventId.toLowerCase();
  if (/mobile|console|ranked|playstation|zerobuild|trioszb|soloszb/.test(id)) return false;
  if (id.includes('divisionalcup')) return id.includes('division1');
  return /fncs|victorycup|cashcup/.test(id);
}

function eventFormat(playlist = '', eventId = '') {
  const value = `${playlist} ${eventId}`.toLowerCase();
  if (/solo/.test(value)) return 'solo';
  if (/duo/.test(value)) return 'duo';
  if (/trio/.test(value)) return 'trio';
  if (/squad/.test(value)) return 'squad';
  return 'unknown';
}

function formatFromSize(size) {
  return ['unknown', 'solo', 'duo', 'trio', 'squad'][size] || 'unknown';
}

function sizeFromFormat(value) {
  return { solo: 1, duo: 2, trio: 3, squad: 4 }[value] || 1;
}

async function providerJson(path) {
  const response = await fetch(`${api}${path}`);
  if (!response.ok) throw new Error(`Osirion ${response.status}: ${path}`);
  return response.json();
}

for (const region of regions) {
  const data = await providerJson(`/tournaments?region=${region}&includeHistoricData=true`);
  const windows = data.tournaments
    .filter(event => isFantasyEvent(event.eventId))
    .flatMap(event => event.eventWindows.map(window => ({ event, window })))
    .filter(({ window }) => Date.parse(window.endTime) >= cutoff && Date.parse(window.beginTime) <= future)
    .map(({ event, window }) => ({
      event,
      window,
      location: window.scoreLocations.find(item => item.isMain) || window.scoreLocations[0],
    }))
    .filter(item => item.location)
    .sort((a, b) => Date.parse(b.window.endTime) - Date.parse(a.window.endTime));

  const tournamentRows = windows.map(({ event, window, location }) => ({
    window_id: location.leaderboardEventWindowId,
    event_id: location.leaderboardEventId,
    name: event.displayData?.longFormatTitle || event.displayData?.titleLine1 || event.eventId,
    region,
    starts_at: window.beginTime,
    ends_at: window.endTime,
    round: window.round || 0,
    match_cap: window.matchCap || null,
    format: eventFormat(window.playlistId, event.eventId),
    description: event.displayData?.detailsDescription || event.displayData?.flavorDescription || null,
    image_url: event.displayData?.playlistTileImage || event.displayData?.loadingScreenImage || null,
    scoring_rules: location.scoringRules || [],
    payout_tables: location.payoutTables || [],
    synced_at: new Date().toISOString(),
  }));
  if (tournamentRows.length) {
    const { error } = await supabase.from('tournaments').upsert(tournamentRows);
    if (error) throw error;
  }

  // At most 16 leaderboard requests per region, safely below the provider's 60/minute limit.
  const scoreWindows = windows
    .filter(({ window }) => Date.parse(window.beginTime) <= now)
    .slice(0, 8);

  for (const { event, window, location } of scoreWindows) {
    const expectedTeamSize = sizeFromFormat(eventFormat(window.playlistId, event.eventId));
    const results = new Map();
    const teams = new Map();
    const members = new Map();
    const sessions = new Map();
    let totalPages = 1;
    let largestTeam = 1;

    for (let page = 0; page < Math.min(totalPages, 2); page++) {
      const params = new URLSearchParams({
        leaderboardEventId: location.leaderboardEventId,
        leaderboardEventWindowId: location.leaderboardEventWindowId,
        page: String(page),
      });
      let leaderboard;
      try {
        ({ leaderboard } = await providerJson(`/tournaments/leaderboard?${params}`));
      } catch (error) {
        console.warn(error.message);
        break;
      }
      if (!leaderboard) break;
      totalPages = leaderboard.totalPages;

      for (const entry of leaderboard.entries) {
        const visiblePlayers = entry.players || [];
        const teamId = entry.teamId || visiblePlayers.map(player => player.accountId).sort().join(':');
        if (!teamId) continue;
        const teamSize = Math.min(4, Math.max(expectedTeamSize, visiblePlayers.length));
        largestTeam = Math.max(largestTeam, teamSize);
        teams.set(teamId, {
          window_id: location.leaderboardEventWindowId,
          team_id: teamId,
          rank: entry.rank,
          points: entry.pointsEarned,
          percentile: entry.percentile ?? null,
          updated_at: leaderboard.updatedAt || new Date().toISOString(),
        });

        for (const account of visiblePlayers) {
          if (!account.accountId) continue;
          const memberKey = `${teamId}:${account.accountId}`;
          members.set(memberKey, {
            window_id: location.leaderboardEventWindowId,
            team_id: teamId,
            account_id: account.accountId,
            player_id: playerByAccount.get(account.accountId) || null,
            username: account.username,
            flag_token: account.flagToken || null,
          });
          const playerId = playerByAccount.get(account.accountId);
          if (!playerId) continue;
          const history = entry.sessionHistory || [];
          results.set(playerId, {
            window_id: location.leaderboardEventWindowId,
            player_id: playerId,
            team_id: teamId,
            team_size: teamSize,
            rank: entry.rank,
            points: entry.pointsEarned,
            matches: history.length,
            wins: history.filter(session => session.trackedStats?.VICTORY_ROYALE_STAT > 0).length,
            team_eliminations: history.reduce((sum, session) => sum + (session.trackedStats?.TEAM_ELIMS_STAT_INDEX || 0), 0),
            percentile: entry.percentile ?? null,
            updated_at: leaderboard.updatedAt || new Date().toISOString(),
          });
        }

        for (const session of entry.sessionHistory || []) {
          if (!session.sessionId) continue;
          const stats = session.trackedStats || {};
          sessions.set(`${teamId}:${session.sessionId}`, {
            window_id: location.leaderboardEventWindowId,
            team_id: teamId,
            session_id: session.sessionId,
            ended_at: session.endTime || null,
            placement: stats.PLACEMENT_STAT_INDEX || null,
            team_eliminations: stats.TEAM_ELIMS_STAT_INDEX || 0,
            victory: stats.VICTORY_ROYALE_STAT > 0,
            time_alive: stats.TIME_ALIVE_STAT || null,
            tracked_stats: stats,
          });
        }
      }
    }

    if (teams.size) {
      const { error } = await supabase.from('tournament_teams').upsert([...teams.values()]);
      if (error) throw error;
    }
    if (members.size) {
      const { error } = await supabase.from('tournament_team_members').upsert([...members.values()]);
      if (error) throw error;
    }
    if (sessions.size) {
      const { error } = await supabase.from('tournament_sessions').upsert([...sessions.values()]);
      if (error) throw error;
      syncedSessions += sessions.size;
    }
    if (results.size) {
      const { error } = await supabase.from('player_results').upsert([...results.values()]);
      if (error) throw error;
      syncedResults += results.size;
    }
    if (largestTeam > 1) {
      const { error } = await supabase.from('tournaments').update({ format: formatFromSize(largestTeam) })
        .eq('window_id', location.leaderboardEventWindowId).eq('format', 'unknown');
      if (error) throw error;
    }
  }
}

const { data: repriced, error: priceError } = await supabase.rpc('refresh_market_prices');
if (priceError) throw priceError;
console.log(`Synced ${syncedResults} player results and ${syncedSessions} sessions; repriced ${repriced} players.`);
