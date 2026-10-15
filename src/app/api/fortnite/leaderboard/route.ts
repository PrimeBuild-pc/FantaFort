import { NextRequest, NextResponse } from 'next/server';
import { getTournaments, tournamentRegions } from '@/lib/osirion';
import { fetchOsirionJson, isLeaderboardResponse } from '@/lib/osirion-fetch';
const SAFE_ID = /^[\w:.-]{1,200}$/;

type Session = { sessionId: string; endTime: string; trackedStats: Record<string, number> | null };
type Entry = {
  teamId: string;
  rank: number;
  percentile?: number;
  pointsEarned: number;
  players: { accountId: string; username: string | null; flagToken?: string | null }[];
  sessionHistory?: Session[];
};

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId') || '';
  const windowId = request.nextUrl.searchParams.get('windowId') || '';
  const region = (request.nextUrl.searchParams.get('region') || '').toUpperCase();
  const page = Number(request.nextUrl.searchParams.get('page') || 0);

  if (!SAFE_ID.test(eventId) || !SAFE_ID.test(windowId) || !tournamentRegions.has(region)
    || !Number.isInteger(page) || page < 0 || page > 100) {
    return NextResponse.json({ error: 'Invalid leaderboard parameters' }, { status: 400 });
  }
  // Only proxy windows the cached tournament list knows; arbitrary ids would bypass the cache.
  const tournament = (await getTournaments(region).catch(() => []))
    .find(item => item.eventId === eventId && item.windowId === windowId);
  if (!tournament) return NextResponse.json({ error: 'Unknown leaderboard' }, { status: 404 });
  const matchCap = tournament.matchCap || 0;

  const params = new URLSearchParams({
    leaderboardEventId: eventId,
    leaderboardEventWindowId: windowId,
    page: String(page),
  });
  const data = await fetchOsirionJson(`/tournaments/leaderboard?${params}`, isLeaderboardResponse, { next: { revalidate: 60 } })
    .catch(() => null) as { leaderboard: { totalPages:number; updatedAt:string; entries:Entry[] } } | null;
  if (!data) return NextResponse.json({ error: 'Leaderboard unavailable' }, { status: 502 });

  const entries = data.leaderboard.entries.map(entry => {
    const sessions = (entry.sessionHistory || []).map(session => ({ ...session, trackedStats: session.trackedStats || {} }));
    return {
      teamId: entry.teamId,
      rank: entry.rank,
      percentile: entry.percentile ?? null,
      points: entry.pointsEarned,
      projectedPoints: matchCap > sessions.length && sessions.length > 0
        ? Math.round(entry.pointsEarned / sessions.length * matchCap)
        : entry.pointsEarned,
      players: entry.players,
      matches: sessions.length,
      wins: sessions.filter(session => session.trackedStats.VICTORY_ROYALE_STAT > 0).length,
      eliminations: sessions.reduce((total, session) => total + (session.trackedStats.TEAM_ELIMS_STAT_INDEX || 0), 0),
      sessions: sessions.map((session, index) => ({
        id: session.sessionId,
        number: index + 1,
        endedAt: session.endTime,
        placement: session.trackedStats.PLACEMENT_STAT_INDEX || null,
        eliminations: session.trackedStats.TEAM_ELIMS_STAT_INDEX || 0,
        victory: session.trackedStats.VICTORY_ROYALE_STAT > 0,
        timeAlive: session.trackedStats.TIME_ALIVE_STAT || null,
      })),
    };
  });

  return NextResponse.json({
    entries,
    page,
    totalPages: data.leaderboard.totalPages,
    updatedAt: data.leaderboard.updatedAt,
  });
}
