// Single source of truth for "which Fortnite events matter, who counts as a pro,
// and why".
//
// Recruitment and scoring used to be two separate predicates that had drifted apart,
// and the drift was not symmetric: FNCS Divisional Cups at Division 2 and 3 entered
// the pool but were rejected by scoring, so those players could never earn a point,
// while Cash Cups scored but never recruited. Since the expansion targets exactly
// that Division 2/3 population, they are now ONE predicate — a player can only be
// recruited from an event that also pays them.

/**
 * Platforms and modes excluded everywhere. Mobile is deliberately out: mobile lobbies
 * are not comparable to PC, so mobile results cannot share the PC price band or
 * scoring without mispricing both. It is deferred to its own branch.
 */
const EXCLUDED_MODES = /mobile|console|ranked|playstation|zerobuild|trioszb|soloszb/;

/** Additional exclusions that only apply to the public tournaments listing. */
const EXCLUDED_FROM_DISPLAY = /test|performance/;

/**
 * Events that both introduce players to the pool and pay them points. One predicate
 * on purpose: any asymmetry here silently creates cards that can never score.
 * Divisions 4-5 are excluded as too far from professional play.
 */
export function isCompetitiveEvent(eventId: string): boolean {
  const id = eventId.toLowerCase();
  if (EXCLUDED_MODES.test(id)) return false;
  if (/division[45]/.test(id)) return false;
  return /fncs|victorycup|cashcup/.test(id);
}

/** Events shown on the public tournaments page. */
export function isDisplayEvent(eventId: string): boolean {
  const id = eventId.toLowerCase();
  if (EXCLUDED_FROM_DISPLAY.test(id)) return false;
  return isCompetitiveEvent(id) || (!EXCLUDED_MODES.test(id) && /elite/.test(id));
}

/**
 * Regions crawled — by BOTH the pool import and the results sync, which is the point
 * of exporting them from here. They used to disagree (intake covered EU/NAC/NAW/OCE
 * while scoring covered EU/NAC), so NAW and OCE players sat in the market unable to
 * earn a point. The audience is US and West-EU/Italy; OCE and BR are dropped rather
 * than carried as dead weight, and ASIA/ME stay out until asked for.
 */
export const POOL_REGIONS = ['EU', 'NAC', 'NAW'] as const;

/**
 * Country flags counted as the home audience. Matched against Epic's
 * `GroupIdentity_GeoIdentity_<country>` token, which is **player-selected** — a soft
 * signal, never treated as authoritative nationality. The UK is fragmented across
 * four separate tokens, so all four are listed.
 */
export const HOME_FLAGS = new Set([
  'italy', 'france', 'germany', 'spain', 'portugal', 'netherlands', 'belgium',
  'switzerland', 'austria', 'ireland', 'unitedkingdom', 'england', 'scotland', 'wales',
]);

export function isHomeFlag(flagToken: string | null | undefined): boolean {
  const country = String(flagToken || '').toLowerCase().split('_').pop();
  return country ? HOME_FLAGS.has(country) : false;
}

export type ProTier = 'elite' | 'contender' | 'regional' | 'open';

/** Ordering used when the pool is over target: keep the strongest claim first. */
export const TIER_PRIORITY: Record<ProTier, number> = { elite: 0, contender: 1, regional: 2, open: 3 };

/** Intended pool size. Supply is far larger, so this is a budget, not a goal. */
export const POOL_TARGET_SIZE = 8_000;

/**
 * Slots reserved per tier when the qualifying population exceeds the target.
 *
 * Ranking purely by tier would fill the whole budget with elite and contender and
 * leave the home cohort with nothing - measured, not hypothetical: a strict priority
 * sort produced 1,211 elite and 6,789 contender and cut `regional` and `open`
 * entirely, which is the opposite of what this pool is for. Quotas are filled best
 * rank first; whatever a tier does not use spills to the others in priority order,
 * so no slot is wasted.
 */
export const TIER_QUOTA: Record<ProTier, number> = {
  elite: 1_500,
  contender: 3_000,
  regional: 2_500,
  open: 1_000,
};

/**
 * Applies the quotas, then spends any unused slots on the strongest remaining
 * candidates. `entries` must carry a tier and the best qualifying rank.
 */
export function selectPool<T extends { tier: ProTier; rank: number }>(
  entries: T[],
  target = POOL_TARGET_SIZE,
): T[] {
  const byTier = new Map<ProTier, T[]>();
  for (const entry of entries) {
    const bucket = byTier.get(entry.tier) ?? [];
    bucket.push(entry);
    byTier.set(entry.tier, bucket);
  }
  for (const bucket of byTier.values()) bucket.sort((a, b) => a.rank - b.rank);

  const chosen: T[] = [];
  const leftover: T[] = [];
  for (const tier of Object.keys(TIER_PRIORITY) as ProTier[]) {
    const bucket = byTier.get(tier) ?? [];
    chosen.push(...bucket.slice(0, TIER_QUOTA[tier]));
    leftover.push(...bucket.slice(TIER_QUOTA[tier]));
  }
  if (chosen.length > target) {
    chosen.sort((a, b) => TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier] || a.rank - b.rank);
    return chosen.slice(0, target);
  }
  leftover.sort((a, b) => TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier] || a.rank - b.rank);
  return chosen.concat(leftover.slice(0, Math.max(0, target - chosen.length)));
}

/**
 * Deepest rank any rule below can reach. This is capped by what the results sync can
 * realistically re-crawl every cycle, not by what the provider will serve: recruiting
 * deeper than scoring reaches is how dead cards are created.
 */
export const MAX_QUALIFYING_RANK = 300;

function divisionOf(id: string): number | null {
  const match = /division([123])/.exec(id);
  return match ? Number(match[1]) : null;
}

const isMajor = (id: string) => /global|grand|final|worldcup/.test(id);

/**
 * Classifies one leaderboard entry, or returns null when it does not qualify.
 *
 * Thresholds are deliberately generous at the bottom for the home audience: an
 * Italian or West-EU player placing mid-table in a Division 2/3 cup is exactly the
 * cohort this product is for, while the same rank elsewhere is not.
 */
export function classifyEntry({ eventId, region, rank, flagToken }: {
  eventId: string; region: string; rank: number; flagToken?: string | null;
}): { tier: ProTier; reason: string } | null {
  if (!isCompetitiveEvent(eventId) || !Number.isFinite(rank) || rank < 1) return null;
  const id = eventId.toLowerCase();
  const division = divisionOf(id);
  const fncs = /fncs/.test(id);
  const home = isHomeFlag(flagToken);

  if (fncs && (division === 1 || isMajor(id)) && rank <= 200) {
    return { tier: 'elite', reason: `FNCS ${division === 1 ? 'Division 1' : 'main event'} top ${rank} · ${region}` };
  }
  if (fncs && division === 2 && rank <= 300) {
    return { tier: 'contender', reason: `FNCS Division 2 top ${rank} · ${region}` };
  }
  if (fncs && division === 3 && rank <= 100) {
    return { tier: 'contender', reason: `FNCS Division 3 top ${rank} · ${region}` };
  }
  if (fncs && division === null && rank <= 300) {
    return { tier: 'contender', reason: `FNCS top ${rank} · ${region}` };
  }
  // The home cohort qualifies at ranks where nobody else does - a mid-table Division 3
  // or open-cup placement - but still inside the rank the results sync can reach.
  if (home && rank <= MAX_QUALIFYING_RANK) {
    return { tier: 'regional', reason: `Home region top ${rank} · ${region}` };
  }
  if (!fncs && rank <= 200) {
    return { tier: 'open', reason: `Open cup top ${rank} · ${region}` };
  }
  return null;
}

/**
 * Leaderboard pages worth fetching to reach MAX_QUALIFYING_RANK. Page size varies by
 * format (solo pages hold ~100 entries, duo/trio far fewer), so it is only knowable
 * after the first page. Shared by both crawlers so intake and scoring go equally deep.
 */
export function pagesForRankLimit(entriesPerPage: number, rankLimit = MAX_QUALIFYING_RANK): number {
  return Math.max(1, Math.min(8, Math.ceil(rankLimit / Math.max(entriesPerPage, 1))));
}

/**
 * Event shape helpers, shared for the same reason the region list is: both crawlers
 * need them, and a private copy in each is how the intake and scoring rules drifted
 * apart in the first place.
 */
export function eventFormat(playlist = '', eventId = ''): string {
  const value = `${playlist} ${eventId}`.toLowerCase();
  if (/solo/.test(value)) return 'solo';
  if (/duo/.test(value)) return 'duo';
  if (/trio/.test(value)) return 'trio';
  if (/squad/.test(value)) return 'squad';
  return 'unknown';
}
export function sizeFromFormat(value: string): number {
  return ({ solo: 1, duo: 2, trio: 3, squad: 4 } as Record<string, number>)[value] || 1;
}

/**
 * Prefix written by the pool importer before tiers existed. It marks players chosen
 * by rules we no longer stand behind - including regions that are no longer synced,
 * whose players can never score again. Matching the importer's own marker keeps
 * curated and seeded entries, which never carried it, out of the sweep: guessing from
 * `photo_url` instead is what emptied the pool the first time.
 */
const LEGACY_NOTE_PREFIX = 'Top 100 · ';

export function isLegacyPoolEntry({ proTier, eligibilityNote }: {
  proTier?: string | null; eligibilityNote?: string | null;
}): boolean {
  if (proTier) return false;
  return String(eligibilityNote || '').startsWith(LEGACY_NOTE_PREFIX);
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
