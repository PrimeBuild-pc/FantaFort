// Regression guard for the pool-churn incident: an incremental sync must never
// deactivate, and a full sync must deactivate on elapsed time rather than on
// absence from the current crawl. Runs offline; no database or provider access.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isDisplayEvent,
  isPoolEvent,
  isScoringEvent,
  POOL_GRACE_DAYS,
  shouldDeactivate,
} from '../src/lib/pro-eligibility.ts';

const now = Date.parse('2026-08-11T00:00:00Z');
const daysAgo = days => new Date(now - days * 86_400_000).toISOString();

// The incident: an incremental run must not deactivate anyone, however old.
for (const lastSeenAt of [daysAgo(0), daysAgo(POOL_GRACE_DAYS + 400), null]) {
  assert.equal(shouldDeactivate({ fullSync: false, lastSeenAt, now }), false,
    'incremental sync must never deactivate');
}

// A full sync deactivates only past the grace period.
assert.equal(shouldDeactivate({ fullSync: true, lastSeenAt: daysAgo(POOL_GRACE_DAYS + 1), now }), true);
assert.equal(shouldDeactivate({ fullSync: true, lastSeenAt: daysAgo(POOL_GRACE_DAYS - 1), now }), false);
assert.equal(shouldDeactivate({ fullSync: true, lastSeenAt: daysAgo(0), now }), false);

// Unknown or unparseable timestamps must fail safe: keep the player.
for (const lastSeenAt of [null, undefined, 'not-a-date']) {
  assert.equal(shouldDeactivate({ fullSync: true, lastSeenAt, now }), false,
    'a missing last_seen_at must never cause deactivation');
}

// Mobile stays out of both the pool and scoring until it is handled deliberately:
// importing mobile players without scoring their events creates dead cards.
for (const eventId of ['epicgames_S40_MobileSeriesApr_EU', 'epicgames_S40_BakMobileCup_NAC']) {
  assert.equal(isPoolEvent(eventId), false, `${eventId} must not enter the pool`);
  assert.equal(isScoringEvent(eventId), false, `${eventId} must not score`);
  assert.equal(isDisplayEvent(eventId), false, `${eventId} must not be listed`);
}

// Behaviour preserved while de-duplicating the three former copies of these rules.
assert.equal(isPoolEvent('epicgames_S41_FNCSDivisionalCup_Division2_EU'), true);
assert.equal(isPoolEvent('epicgames_S41_FNCSDivisionalCup_Division5_EU'), false);
assert.equal(isPoolEvent('epicgames_S41_CashCup_Solo_EU'), false, 'pool intake is FNCS-only');
assert.equal(isScoringEvent('epicgames_S41_CashCup_Solo_EU'), true, 'cash cups still score');
assert.equal(isScoringEvent('epicgames_S41_DivisionalCup_Division2_EU'), false);
assert.equal(isScoringEvent('epicgames_S41_DivisionalCup_Division1_EU'), true);
assert.equal(isDisplayEvent('epicgames_S41_RankedCup_EU'), false);

// The import must not reintroduce a presence-based deactivation predicate.
const source = readFileSync(new URL('./sync-player-pool.mjs', import.meta.url), 'utf8');
assert.match(source, /shouldDeactivate\(/, 'deactivation must go through shouldDeactivate');
assert.doesNotMatch(source, /!player\.photo_url/,
  'photo_url must not gate deactivation: it marks marquee players, not active ones');

console.log('check:pool OK');
