import type { LeagueSettings } from './types';

/** One obvious private match: three spots, Formation scoring, no account stake. */
export const WEEKEND_PRESET: LeagueSettings = {
  budget: 10000,
  rosterSize: 3,
  marketHours: 48,
  durationDays: 4,
  scoringMode: 'formation',
  economyMode: 'demo',
  entryStake: 0,
  draftMode: 'market',
};

export type WindowClock = { startsAt: string; endsAt: string };

export function windowPhase(item: WindowClock, now: number): 'upcoming' | 'live' | 'completed' {
  const start = Date.parse(item.startsAt);
  const end = Date.parse(item.endsAt);
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'completed';
}

/** Live window, otherwise the next one, otherwise the latest one already finished. */
export function focusWindow<T extends WindowClock>(rows: T[], now = Date.now()): T | null {
  const ranked = rows.map(row => ({ row, phase: windowPhase(row, now) }));
  const byStart = (left: { row: T }, right: { row: T }) => Date.parse(left.row.startsAt) - Date.parse(right.row.startsAt);
  const live = ranked.filter(item => item.phase === 'live').sort(byStart);
  if (live[0]) return live[0].row;
  const upcoming = ranked.filter(item => item.phase === 'upcoming').sort(byStart);
  if (upcoming[0]) return upcoming[0].row;
  const done = ranked.filter(item => item.phase === 'completed').sort((left, right) => Date.parse(right.row.endsAt) - Date.parse(left.row.endsAt));
  return done[0]?.row ?? null;
}

/** Stable pairs. UUID text order matches Postgres uuid order for canonical ids. */
export function pairById<T extends { userId: string }>(rows: T[]): { home: T; away: T | null }[] {
  const ordered = [...rows].sort((left, right) => left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0);
  const pairs: { home: T; away: T | null }[] = [];
  for (let index = 0; index < ordered.length; index += 2) pairs.push({ home: ordered[index], away: ordered[index + 1] ?? null });
  return pairs;
}

export function formatRemaining(target: string, now = Date.now()): string {
  const ms = Date.parse(target) - now;
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 48) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
