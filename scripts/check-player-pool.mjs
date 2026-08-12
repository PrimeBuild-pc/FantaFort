// Regression guard for the pool. Two incidents are encoded here:
//   1. churn - an incremental sync must never deactivate;
//   2. dead cards - a player must never be recruitable from an event that cannot pay
//      them, which is what happened to Division 2/3 and to every NAW/OCE player.
// Runs offline; no database or provider access.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyEntry,
  isCompetitiveEvent,
  isDisplayEvent,
  isHomeFlag,
  isLegacyPoolEntry,
  MAX_QUALIFYING_RANK,
  pagesForRankLimit,
  POOL_GRACE_DAYS,
  POOL_REGIONS,
  shouldDeactivate,
} from '../src/lib/pro-eligibility.ts';

const now = Date.parse('2026-08-12T00:00:00Z');
const daysAgo = days => new Date(now - days * 86_400_000).toISOString();
const flag = country => `GroupIdentity_GeoIdentity_${country}`;

// --- Churn (incident 1) ------------------------------------------------------
for (const lastSeenAt of [daysAgo(0), daysAgo(POOL_GRACE_DAYS + 400), null]) {
  assert.equal(shouldDeactivate({ fullSync: false, lastSeenAt, now }), false,
    'incremental sync must never deactivate');
}
assert.equal(shouldDeactivate({ fullSync: true, lastSeenAt: daysAgo(POOL_GRACE_DAYS + 1), now }), true);
assert.equal(shouldDeactivate({ fullSync: true, lastSeenAt: daysAgo(POOL_GRACE_DAYS - 1), now }), false);
for (const lastSeenAt of [null, undefined, 'not-a-date']) {
  assert.equal(shouldDeactivate({ fullSync: true, lastSeenAt, now }), false,
    'a missing last_seen_at must never cause deactivation');
}

// --- Dead cards (incident 2) -------------------------------------------------
// Anything a player can be recruited from must also be scoreable. One predicate now
// serves both, so the invariant is checked by construction over real event ids.
const REAL_EVENT_IDS = [
  'epicgames_S41_FNCSDivisionalCup_Division1_EU',
  'epicgames_S41_FNCSDivisionalCup_Division2_EU',
  'epicgames_S41_FNCSDivisionalCup_Division3_EU',
  'epicgames_S41_FNCSDivisionalCup_Division4_EU',
  'epicgames_S41_CashCup_Solo_EU',
  'epicgames_S41_CashCup_DuosZB_EU',
  'epicgames_S40_MobileSeriesApr_EU',
  'epicgames_S40_BakMobileCup_NAC',
  'epicgames_S41_RankedCup_EU',
  'epicgames_S41_FNCSGlobalChampionship_EU',
];
for (const eventId of REAL_EVENT_IDS) {
  const recruits = [1, 50, 250].some(rank =>
    classifyEntry({ eventId, region: 'EU', rank, flagToken: flag('italy') }) !== null);
  if (recruits) {
    assert.ok(isCompetitiveEvent(eventId),
      `${eventId} can recruit players, so it must also be scoreable`);
  }
}
// Division 2 and 3 are the population this expansion targets: they must both recruit
// and score, which is exactly what was broken before.
for (const eventId of ['epicgames_S41_FNCSDivisionalCup_Division2_EU', 'epicgames_S41_FNCSDivisionalCup_Division3_EU']) {
  assert.ok(isCompetitiveEvent(eventId), `${eventId} must score`);
  assert.ok(classifyEntry({ eventId, region: 'EU', rank: 20 }), `${eventId} must recruit`);
}
assert.equal(isCompetitiveEvent('epicgames_S41_FNCSDivisionalCup_Division4_EU'), false, 'Division 4 is out of scope');

// Mobile stays out of recruitment, scoring and the public listing together.
for (const eventId of ['epicgames_S40_MobileSeriesApr_EU', 'epicgames_S40_BakMobileCup_NAC']) {
  assert.equal(isCompetitiveEvent(eventId), false, `${eventId} must not be competitive`);
  assert.equal(classifyEntry({ eventId, region: 'EU', rank: 1, flagToken: flag('italy') }), null, `${eventId} must not recruit`);
  assert.equal(isDisplayEvent(eventId), false, `${eventId} must not be listed`);
}
assert.equal(isCompetitiveEvent('epicgames_S41_RankedCup_EU'), false, 'ranked is not competitive play');

// --- Tiers -------------------------------------------------------------------
const at = (eventId, rank, flagToken) => classifyEntry({ eventId, region: 'EU', rank, flagToken })?.tier ?? null;
assert.equal(at('epicgames_S41_FNCSDivisionalCup_Division1_EU', 5), 'elite');
assert.equal(at('epicgames_S41_FNCSGlobalChampionship_EU', 5), 'elite');
assert.equal(at('epicgames_S41_FNCSDivisionalCup_Division2_EU', 5), 'contender');
assert.equal(at('epicgames_S41_CashCup_Solo_EU', 5), 'open');
// The home cohort qualifies where nobody else does, but never past the rank the
// results sync can reach - that limit is what keeps recruitment payable.
assert.equal(at('epicgames_S41_FNCSDivisionalCup_Division3_EU', 250), null);
assert.equal(at('epicgames_S41_FNCSDivisionalCup_Division3_EU', 250, flag('italy')), 'regional');
assert.equal(at('epicgames_S41_FNCSDivisionalCup_Division3_EU', 250, flag('brazil')), null);
assert.equal(at('epicgames_S41_FNCSDivisionalCup_Division3_EU', MAX_QUALIFYING_RANK + 1, flag('italy')), null,
  'nothing may qualify past the rank scoring reaches');
for (const country of ['unitedkingdom', 'england', 'scotland', 'wales']) {
  assert.ok(isHomeFlag(flag(country)), `${country} is part of the home audience`);
}
assert.equal(isHomeFlag(null), false);
assert.equal(isHomeFlag(flag('unitedstates')), false, 'the flag rule is West-EU, not every audience region');

// --- Legacy sweep ------------------------------------------------------------
// Entries written by the importer before tiers existed carry its note prefix. They
// must go on a full sync; curated and seeded rows never carried it and must survive,
// because guessing from photo_url is what emptied the pool the first time.
assert.equal(isLegacyPoolEntry({ proTier: null, eligibilityNote: 'Top 100 · FNCS Division 3 · OCE' }), true);
assert.equal(isLegacyPoolEntry({ proTier: null, eligibilityNote: 'Curated pro player' }), false);
assert.equal(isLegacyPoolEntry({ proTier: null, eligibilityNote: null }), false);
assert.equal(isLegacyPoolEntry({ proTier: null, eligibilityNote: '' }), false);
// A tiered player is current by definition, whatever its note says.
assert.equal(isLegacyPoolEntry({ proTier: 'regional', eligibilityNote: 'Top 100 · anything' }), false);
// Notes written by the current importer start with the tier reason, never the prefix.
assert.equal(isLegacyPoolEntry({ proTier: null, eligibilityNote: 'FNCS Division 2 top 12 · EU · Cup' }), false);

// --- Crawl bounds ------------------------------------------------------------
assert.equal(pagesForRankLimit(100), 3, '300 ranks at 100 per page');
assert.equal(pagesForRankLimit(50), 6);
assert.ok(pagesForRankLimit(1) <= 8, 'page count stays bounded for tiny pages');
assert.ok(pagesForRankLimit(0) >= 1, 'an empty page must not produce a zero or negative count');
assert.deepEqual([...POOL_REGIONS], ['EU', 'NAC', 'NAW']);

// --- Source guards -----------------------------------------------------------
const pool = readFileSync(new URL('./sync-player-pool.mjs', import.meta.url), 'utf8');
// The importer must keep the leaderboards it downloads: discarding them is what left
// 94% of the regional and open tiers with no statistics at all.
assert.match(pool, /player_results/, 'the pool import must store the results it fetches');
assert.match(pool, /isLegacyPoolEntry\(/, 'the legacy sweep must go through the shared rule');
const results = readFileSync(new URL('./sync-fortnite.mjs', import.meta.url), 'utf8');
assert.match(pool, /shouldDeactivate\(/, 'deactivation must go through shouldDeactivate');
assert.doesNotMatch(pool, /!player\.photo_url/,
  'photo_url must not gate deactivation: it marks marquee players, not active ones');
// Both crawlers must take their regions from the shared module, or they drift apart
// again and the region that only one of them covers becomes dead cards.
for (const [name, source] of [['pool import', pool], ['results sync', results]]) {
  assert.match(source, /POOL_REGIONS/, `${name} must use the shared region list`);
  assert.doesNotMatch(source, /\['EU', 'NAC'\]/, `${name} must not hard-code regions`);
}

console.log('check:pool OK');
