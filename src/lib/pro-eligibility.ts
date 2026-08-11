// Single source of truth for "which Fortnite events matter, and to whom".
//
// Three rules existed as three near-identical regex copies (the pool import, the
// results sync and the tournaments page) that had silently drifted apart: the pool
// import admitted FNCS only, while the results sync also scored Cash Cups and
// Victory Cups. They are kept as three named predicates rather than merged, because
// they genuinely answer different questions — the drift was the accident, not the
// distinction.

/**
 * Platforms and modes excluded from every rule. Mobile is deliberately out for now:
 * mobile lobbies are not comparable to PC, so mobile results cannot share the PC
 * price band or scoring without mispricing both. Admitting mobile requires changing
 * `isPoolEvent` and `isScoringEvent` together — importing mobile players without
 * scoring their events would create cards that can never earn a point.
 */
const EXCLUDED_MODES = /mobile|console|ranked|playstation|zerobuild|trioszb|soloszb/;

/** Additional exclusions that only apply to the public tournaments listing. */
const EXCLUDED_FROM_DISPLAY = /test|performance/;

/** Events whose leaderboards may introduce a player into the market pool. */
export function isPoolEvent(eventId: string): boolean {
  const id = eventId.toLowerCase();
  if (EXCLUDED_MODES.test(id)) return false;
  if (/division[45]/.test(id)) return false;
  return /fncs/.test(id);
}

/** Events whose results award fantasy points to a player already in the pool. */
export function isScoringEvent(eventId: string): boolean {
  const id = eventId.toLowerCase();
  if (EXCLUDED_MODES.test(id)) return false;
  if (id.includes('divisionalcup')) return id.includes('division1');
  return /fncs|victorycup|cashcup/.test(id);
}

/** Events shown on the public tournaments page. */
export function isDisplayEvent(eventId: string): boolean {
  const id = eventId.toLowerCase();
  if (EXCLUDED_MODES.test(id) || EXCLUDED_FROM_DISPLAY.test(id)) return false;
  if (id.includes('divisionalcup') && !id.includes('division1')) return false;
  return /fncs|cashcup|victorycup|elite|divisionalcup/.test(id);
}

/**
 * Days a player may go without appearing in an imported leaderboard before leaving
 * the market. Membership decays on time, not on absence from one particular crawl:
 * a single incremental run scans a handful of windows, so "not in this run" says
 * nothing about whether someone is still competing.
 */
export const POOL_GRACE_DAYS = 180;

/**
 * Whether an active player should leave the pool.
 *
 * Only a full sync may deactivate. An incremental run scans ~6 windows, so letting
 * it deactivate meant every run removed everyone it had not just seen — which is
 * what emptied 80% of the production pool.
 */
export function shouldDeactivate({
  fullSync,
  lastSeenAt,
  now = Date.now(),
  graceDays = POOL_GRACE_DAYS,
}: {
  fullSync: boolean;
  lastSeenAt: string | number | Date | null | undefined;
  now?: number;
  graceDays?: number;
}): boolean {
  if (!fullSync) return false;
  if (lastSeenAt == null) return false;
  const seen = lastSeenAt instanceof Date ? lastSeenAt.getTime() : new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seen)) return false;
  return seen < now - graceDays * 86_400_000;
}
