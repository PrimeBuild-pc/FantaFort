import assert from 'node:assert/strict';
import { WEEKEND_PRESET, focusWindow, formatRemaining, pairById, windowPhase } from '../src/lib/weekend.ts';

assert.equal(WEEKEND_PRESET.rosterSize, 3);
assert.equal(WEEKEND_PRESET.scoringMode, 'formation');
assert.equal(WEEKEND_PRESET.economyMode, 'demo');
assert.equal(WEEKEND_PRESET.entryStake, 0);
assert.equal(WEEKEND_PRESET.draftMode, 'market');
assert.equal(WEEKEND_PRESET.marketHours, 48);
assert.equal(WEEKEND_PRESET.durationDays, 4);
assert.equal(WEEKEND_PRESET.budget, 10000);

const now = Date.parse('2026-08-01T12:00:00Z');
const rows = [
  { id: 'past', startsAt: '2026-07-01T00:00:00Z', endsAt: '2026-07-02T00:00:00Z' },
  { id: 'live', startsAt: '2026-08-01T10:00:00Z', endsAt: '2026-08-01T18:00:00Z' },
  { id: 'next', startsAt: '2026-08-02T10:00:00Z', endsAt: '2026-08-02T18:00:00Z' },
];
assert.equal(focusWindow(rows, now)?.id, 'live');
assert.equal(focusWindow(rows.filter(row => row.id !== 'live'), now)?.id, 'next');
assert.equal(focusWindow([rows[0]], now)?.id, 'past');
assert.equal(focusWindow([], now), null);
assert.equal(windowPhase(rows[0], now), 'completed');
assert.equal(windowPhase(rows[1], now), 'live');
assert.equal(windowPhase(rows[2], now), 'upcoming');
assert.equal(formatRemaining('2026-08-01T12:00:00Z', now), '0m');
assert.equal(formatRemaining('2026-08-01T12:30:00Z', now), '30m');
assert.equal(formatRemaining('2026-08-01T14:05:00Z', now), '2h 5m');
assert.equal(formatRemaining('2026-08-04T12:00:00Z', now), '3d 0h');

const pairs = pairById([{ userId: 'b' }, { userId: 'a' }, { userId: 'c' }]);
assert.deepEqual(pairs.map(pair => [pair.home.userId, pair.away?.userId ?? null]), [['a', 'b'], ['c', null]]);
assert.equal(pairById([]).length, 0);

console.log('weekend checks passed');
