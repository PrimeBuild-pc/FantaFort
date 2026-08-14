import { createClient } from '@supabase/supabase-js';
import { fetchOsirionJson, isLeaderboardResponse, isTournamentResponse } from '../src/lib/osirion-fetch.ts';
import {
  classifyEntry, eventFormat, isCompetitiveEvent, isLegacyPoolEntry, pagesForRankLimit,
  POOL_GRACE_DAYS, POOL_REGIONS, POOL_TARGET_SIZE, selectPool, shouldDeactivate, sizeFromFormat,
  TIER_PRIORITY,
} from '../src/lib/pro-eligibility.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase configuration');

const dryRun = process.argv.includes('--dry-run');
const fullSync = dryRun || process.argv.includes('--full');
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

// Provider budget. The documented limit is ~60 requests/minute; a full crawl must
// stay well inside it and must not starve the 15-minute results sync that shares it.
const REQUEST_BUDGET = fullSync ? 400 : 40;
const LOOKBACK_DAYS = 180;
let requests = 0;

const existing = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('players').select('id, account_id, price, rarity, photo_url, active, last_seen_at, pro_tier, eligibility_note').range(from, from + 999);
  if (error) throw error;
  existing.push(...data);
  if (data.length < 1000) break;
}
const existingByAccount = new Map(existing.map(player => [player.account_id, player]));

// Article 21 objections have to survive the crawl: this importer re-creates every
// account it sees with `active: true`, so an excluded player must be dropped before
// it is ever remembered. Fail closed rather than silently re-importing an objector.
const objections = await supabase.from('player_data_objections').select('account_id');
if (objections.error) throw objections.error;
const objected = new Set(objections.data.map(row => row.account_id));

const imported = new Map();
let scannedWindows = 0;

// The crawl already downloads the leaderboards that justify each recruitment and used
// to discard them. Keeping them means a recruited player arrives with the result that
// qualified them instead of a blank card, at no extra provider request: 94% of the
// regional and open tiers had no statistics at all before this.
const tournamentRows = new Map();
const teamRows = new Map();
const memberRows = new Map();
const resultRows = new Map();

/** Keeps the strongest claim when a player appears in several events. */
function remember(account, classification, eventLabel, rank) {
  if (objected.has(account.accountId)) return;
  const current = imported.get(account.accountId);
  if (current) {
    const better = TIER_PRIORITY[classification.tier] - TIER_PRIORITY[current.tier]
      || rank - current.rank;
    if (better >= 0) return;
  }
  const stored = existingByAccount.get(account.accountId);
  imported.set(account.accountId, {
    tier: classification.tier,
    rank,
    row: {
      id: stored?.id || account.accountId,
      account_id: account.accountId,
      handle: account.username.replace(/ǃ+$/, '').trim(),
      rarity: stored?.rarity || (classification.tier === 'elite' ? 'legendary' : classification.tier === 'contender' ? 'epic' : 'rare'),
      price: stored?.price || (classification.tier === 'elite' ? 4000 : classification.tier === 'contender' ? 2800 : 1800),
      active: true,
      pro_tier: classification.tier,
      last_seen_at: new Date().toISOString(),
      eligibility_note: `${classification.reason} · ${eventLabel}`.slice(0, 300),
    },
  });
}

for (const region of POOL_REGIONS) {
  if (requests >= REQUEST_BUDGET) break;
  const data = await fetchOsirionJson(`/tournaments?region=${region}&includeHistoricData=true`, isTournamentResponse);
  requests++;
  const perEvent = new Map();
  const candidates = data.tournaments
    .filter(event => isCompetitiveEvent(event.eventId))
    .flatMap(event => event.eventWindows.map(window => ({ event, window })))
    .filter(({ window }) => Date.parse(window.endTime) <= Date.now()
      && Date.parse(window.endTime) >= Date.now() - LOOKBACK_DAYS * 86400000
      && window.scoreLocations?.length)
    .sort((a, b) => Date.parse(b.window.endTime) - Date.parse(a.window.endTime))
    .filter(({ event }) => {
      const count = perEvent.get(event.eventId) || 0;
      if (count >= (fullSync ? 6 : 1)) return false;
      perEvent.set(event.eventId, count + 1);
      return true;
    })
    .slice(0, fullSync ? (region === 'EU' ? 24 : 12) : 3);

  for (const candidate of candidates) {
    if (requests >= REQUEST_BUDGET) break;
    const location = candidate.window.scoreLocations.find(item => item.isMain) || candidate.window.scoreLocations[0];
    const eventLabel = candidate.event.displayData?.longFormatTitle || candidate.event.eventId;
    let totalPages = 1;
    let plannedPages = 1;

    for (let page = 0; page < Math.min(totalPages, plannedPages); page++) {
      if (requests >= REQUEST_BUDGET) break;
      const params = new URLSearchParams({
        leaderboardEventId: location.leaderboardEventId,
        leaderboardEventWindowId: location.leaderboardEventWindowId,
        page: String(page),
      });
      const { leaderboard } = await fetchOsirionJson(`/tournaments/leaderboard?${params}`, isLeaderboardResponse);
      requests++;
      totalPages = leaderboard.totalPages;
      if (page === 0) {
        scannedWindows++;
        // Page size varies by format, so the depth needed is only knowable after the
        // first page: solo pages hold 100 entries, duo/trio far fewer.
        plannedPages = pagesForRankLimit(leaderboard.entries.length);
      }

      const windowId = location.leaderboardEventWindowId;
      const format = eventFormat(candidate.window.playlistId, candidate.event.eventId);
      tournamentRows.set(windowId, {
        window_id: windowId,
        event_id: location.leaderboardEventId,
        name: eventLabel,
        region,
        starts_at: candidate.window.beginTime,
        ends_at: candidate.window.endTime,
        round: candidate.window.round || 0,
        match_cap: candidate.window.matchCap || null,
        format,
        synced_at: new Date().toISOString(),
      });

      for (const entry of leaderboard.entries) {
        const visible = entry.players || [];
        const teamId = entry.teamId || visible.map(player => player.accountId).filter(Boolean).sort().join(':');
        if (!teamId) continue;
        const history = entry.sessionHistory || [];
        const stamp = leaderboard.updatedAt || new Date().toISOString();
        teamRows.set(windowId + ':' + teamId, {
          window_id: windowId, team_id: teamId, rank: entry.rank, points: entry.pointsEarned,
          percentile: entry.percentile ?? null, updated_at: stamp,
        });
        for (const account of visible) {
          if (!account.accountId || !account.username) continue;
          memberRows.set(windowId + ':' + teamId + ':' + account.accountId, {
            window_id: windowId, team_id: teamId, account_id: account.accountId,
            username: account.username, flag_token: account.flagToken || null,
          });
          resultRows.set(windowId + ':' + account.accountId, {
            account_id: account.accountId,
            window_id: windowId,
            team_id: teamId,
            team_size: Math.min(4, Math.max(sizeFromFormat(format), visible.length)),
            rank: entry.rank,
            points: entry.pointsEarned,
            matches: history.length,
            wins: history.filter(session => session.trackedStats?.VICTORY_ROYALE_STAT > 0).length,
            team_eliminations: history.reduce((sum, session) => sum + (session.trackedStats?.TEAM_ELIMS_STAT_INDEX || 0), 0),
            percentile: entry.percentile ?? null,
            updated_at: stamp,
          });
          const classification = classifyEntry({
            eventId: candidate.event.eventId, region, rank: entry.rank, flagToken: account.flagToken,
          });
          if (classification) remember(account, classification, eventLabel, entry.rank);
        }
      }
    }
  }
}

// The results sync records every account it sees, across a different window sample
// than this crawl takes, so recruiting only from the 48 windows fetched here left
// 5,577 accounts that qualify under our own rules sitting outside the market -
// including 52 elite and several rank-1 finishes. Classifying the stored rows as well
// costs no provider request and keeps membership decided in exactly one place: a
// second writer would race this one and make the target meaningless.
const pageAll = async (table, columns) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
};

const storedTournaments = new Map((await pageAll('tournaments', 'window_id, event_id, region'))
  .map(row => [row.window_id, row]));
const storedRanks = new Map((await pageAll('tournament_teams', 'window_id, team_id, rank'))
  .map(row => [`${row.window_id}:${row.team_id}`, row.rank]));
let recoveredFromHistory = 0;
for (const member of await pageAll('tournament_team_members', 'account_id, username, flag_token, window_id, team_id')) {
  if (!member.account_id || !member.username) continue;
  const tournament = storedTournaments.get(member.window_id);
  const rank = storedRanks.get(`${member.window_id}:${member.team_id}`);
  if (!tournament || !rank) continue;
  const classification = classifyEntry({
    eventId: tournament.event_id, region: tournament.region, rank, flagToken: member.flag_token,
  });
  if (!classification) continue;
  const before = imported.size;
  remember({ accountId: member.account_id, username: member.username, flagToken: member.flag_token },
    classification, tournament.event_id, rank);
  if (imported.size > before) recoveredFromHistory++;
}

// Quotas per tier, best rank first, with unused slots spilling to the others. A
// strict priority sort filled the whole budget with elite and contender and cut the
// home cohort entirely, which is the opposite of what this pool exists for.
const candidates = [...imported.values()];
const players = selectPool(candidates, POOL_TARGET_SIZE).map(entry => entry.row);
const tierCounts = players.reduce((counts, row) => ({ ...counts, [row.pro_tier]: (counts[row.pro_tier] || 0) + 1 }), {});
if (players.length > 10_000) throw new Error('Osirion player import exceeds record limit');

for (const [label, rows, limit] of [
  ['tournaments', tournamentRows, 2_000], ['teams', teamRows, 40_000],
  ['members', memberRows, 160_000], ['results', resultRows, 160_000],
]) if (rows.size > limit) throw new Error('Osirion ' + label + ' exceed record limit');

// Computed before the write branch so a dry run can report what it would store:
// otherwise the only way to check this path would be to run it for real.
const pooled = new Map(players.map(row => [row.account_id, row.id]));
const keptResults = [...resultRows.values()]
  .filter(row => pooled.has(row.account_id))
  .map(row => ({
    window_id: row.window_id, player_id: pooled.get(row.account_id), team_id: row.team_id,
    team_size: row.team_size, rank: row.rank, points: row.points, matches: row.matches,
    wins: row.wins, team_eliminations: row.team_eliminations, percentile: row.percentile,
    updated_at: row.updated_at,
  }));
const keptWindows = new Set(keptResults.map(row => row.window_id));

let deactivated = 0;
let recoveredResults = 0;
if (!dryRun && players.length) {
  for (let index = 0; index < players.length; index += 500) {
    const { error } = await supabase.from('players').upsert(players.slice(index, index + 500));
    if (error) throw error;
  }

  // Results are written only for accounts that made it into the pool, and only after
  // the players exist: player_results.player_id is a foreign key.
  const upsertAll = async (table, rows) => {
    for (let index = 0; index < rows.length; index += 500) {
      const { error } = await supabase.from(table).upsert(rows.slice(index, index + 500));
      if (error) throw error;
    }
  };
  await upsertAll('tournaments', [...tournamentRows.values()].filter(row => keptWindows.has(row.window_id)));
  await upsertAll('tournament_teams', [...teamRows.values()].filter(row => keptWindows.has(row.window_id)));
  await upsertAll('tournament_team_members', [...memberRows.values()]
    .filter(row => keptWindows.has(row.window_id))
    .map(row => ({ ...row, player_id: pooled.get(row.account_id) || null })));
  await upsertAll('player_results', keptResults);

  // Players recovered from recorded history have no results of their own yet: their
  // team rows were stored while nobody carried them. Fill those in from what the
  // database already holds, set-based, without overwriting anything the results sync
  // owns for windows it re-crawls.
  const backfilled = await supabase.rpc('sync_recorded_player_results');
  if (backfilled.error) throw backfilled.error;
  recoveredResults = Number(backfilled.data || 0);

  // Decay, not absence: an incremental run scans a handful of windows, so it must
  // never conclude that everyone it did not just see has stopped competing.
  const now = Date.now();
  const importedAccounts = new Set(players.map(row => row.account_id));
  const staleIds = existing
    .filter(player => player.active && !importedAccounts.has(player.account_id))
    .filter(player => shouldDeactivate({ fullSync, lastSeenAt: player.last_seen_at, now })
      // Entries from the pre-tier importer were chosen by rules we no longer stand
      // behind, including regions that are no longer synced and whose players can
      // never score again. Waiting out the grace period keeps them sellable for months.
      || (fullSync && isLegacyPoolEntry({ proTier: player.pro_tier, eligibilityNote: player.eligibility_note })))
    .map(player => player.id);
  for (let index = 0; index < staleIds.length; index += 100) {
    const { error } = await supabase.from('players').update({ active:false }).in('id', staleIds.slice(index, index + 100));
    if (error) throw error;
  }
  deactivated = staleIds.length;
}

console.log(`${dryRun ? 'Would import' : 'Player pool ready'}: ${players.length} players from ${scannedWindows} windows across ${POOL_REGIONS.length} regions.`);
console.log(`Tiers: ${Object.entries(tierCounts).map(([tier, count]) => `${tier} ${count}`).join(' · ') || 'none'}`);
console.log(`Recovered ${recoveredFromHistory} qualifying accounts from previously recorded results.`);
if (!dryRun) console.log(`Backfilled ${recoveredResults} results for players who had none.`);
console.log(`Provider requests: ${requests}/${REQUEST_BUDGET}${requests >= REQUEST_BUDGET ? ' (budget reached, crawl truncated)' : ''}`);
console.log(`${dryRun ? 'Would store' : 'Stored'} ${keptResults.length} qualifying results across ${keptWindows.size} windows.`);
console.log(`Mode: ${fullSync ? 'full' : 'incremental'}; deactivated ${deactivated} (decayed past ${POOL_GRACE_DAYS} days, or left over from the pre-tier importer).`);
if (candidates.length > players.length) console.log(`Capped: ${candidates.length - players.length} candidates dropped at the ${POOL_TARGET_SIZE} target.`);
