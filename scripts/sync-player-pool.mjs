import { createClient } from '@supabase/supabase-js';
import { fetchOsirionJson, isLeaderboardResponse, isTournamentResponse } from '../src/lib/osirion-fetch.ts';
import {
  classifyEntry, isCompetitiveEvent, pagesForRankLimit, POOL_GRACE_DAYS, POOL_REGIONS,
  POOL_TARGET_SIZE, shouldDeactivate, TIER_PRIORITY,
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
  const { data, error } = await supabase.from('players').select('id, account_id, price, rarity, photo_url, active, last_seen_at').range(from, from + 999);
  if (error) throw error;
  existing.push(...data);
  if (data.length < 1000) break;
}
const existingByAccount = new Map(existing.map(player => [player.account_id, player]));
const imported = new Map();
let scannedWindows = 0;

/** Keeps the strongest claim when a player appears in several events. */
function remember(account, classification, eventLabel) {
  const current = imported.get(account.accountId);
  if (current && TIER_PRIORITY[current.tier] <= TIER_PRIORITY[classification.tier]) return;
  const stored = existingByAccount.get(account.accountId);
  imported.set(account.accountId, {
    tier: classification.tier,
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

      for (const entry of leaderboard.entries) {
        for (const account of entry.players || []) {
          if (!account.accountId || !account.username) continue;
          const classification = classifyEntry({
            eventId: candidate.event.eventId, region, rank: entry.rank, flagToken: account.flagToken,
          });
          if (classification) remember(account, classification, eventLabel);
        }
      }
    }
  }
}

// Over-target crawls keep the strongest claims rather than whatever arrived first.
const ranked = [...imported.values()].sort((a, b) => TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier]);
const players = ranked.slice(0, POOL_TARGET_SIZE).map(entry => entry.row);
const tierCounts = players.reduce((counts, row) => ({ ...counts, [row.pro_tier]: (counts[row.pro_tier] || 0) + 1 }), {});
if (players.length > 10_000) throw new Error('Osirion player import exceeds record limit');

let deactivated = 0;
if (!dryRun && players.length) {
  for (let index = 0; index < players.length; index += 500) {
    const { error } = await supabase.from('players').upsert(players.slice(index, index + 500));
    if (error) throw error;
  }

  // Decay, not absence: an incremental run scans a handful of windows, so it must
  // never conclude that everyone it did not just see has stopped competing.
  const now = Date.now();
  const importedAccounts = new Set(players.map(row => row.account_id));
  const staleIds = existing
    .filter(player => player.active && !importedAccounts.has(player.account_id))
    .filter(player => shouldDeactivate({ fullSync, lastSeenAt: player.last_seen_at, now }))
    .map(player => player.id);
  for (let index = 0; index < staleIds.length; index += 100) {
    const { error } = await supabase.from('players').update({ active:false }).in('id', staleIds.slice(index, index + 100));
    if (error) throw error;
  }
  deactivated = staleIds.length;
}

console.log(`${dryRun ? 'Would import' : 'Player pool ready'}: ${players.length} players from ${scannedWindows} windows across ${POOL_REGIONS.length} regions.`);
console.log(`Tiers: ${Object.entries(tierCounts).map(([tier, count]) => `${tier} ${count}`).join(' · ') || 'none'}`);
console.log(`Provider requests: ${requests}/${REQUEST_BUDGET}${requests >= REQUEST_BUDGET ? ' (budget reached, crawl truncated)' : ''}`);
console.log(`Mode: ${fullSync ? 'full' : 'incremental'}; deactivated ${deactivated} players unseen for over ${POOL_GRACE_DAYS} days.`);
if (ranked.length > players.length) console.log(`Capped: ${ranked.length - players.length} lower-tier candidates dropped at the ${POOL_TARGET_SIZE} target.`);
