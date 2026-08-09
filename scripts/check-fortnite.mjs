import { fetchOsirionJson, isLeaderboardResponse, isTournamentResponse } from '../src/lib/osirion-fetch.ts';

const tournaments = await fetchOsirionJson('/tournaments?region=EU&includeHistoricData=true', isTournamentResponse);
if (tournaments.success === false || tournaments.tournaments.length === 0) throw new Error('Invalid Osirion tournament response');

const now = Date.now();
const candidate = tournaments.tournaments
  .flatMap(event => event.eventWindows.map(window => ({ event, window })))
  .filter(({ window }) => Date.parse(window.endTime) <= now && window.scoreLocations.length)
  .sort((a, b) => Date.parse(b.window.endTime) - Date.parse(a.window.endTime))[0];
if (!candidate) throw new Error('No completed tournament leaderboard found');
const location = candidate.window.scoreLocations.find(item => item.isMain) || candidate.window.scoreLocations[0];
const query = new URLSearchParams({
  leaderboardEventId:location.leaderboardEventId,
  leaderboardEventWindowId:location.leaderboardEventWindowId,
  page:'0',
});
const result = await fetchOsirionJson(`/tournaments/leaderboard?${query}`, isLeaderboardResponse);
const entry = result.leaderboard.entries[0];
if (!entry || !Array.isArray(entry.players) || !Array.isArray(entry.sessionHistory)) throw new Error('Invalid Osirion leaderboard response');
console.log(`Osirion OK: ${tournaments.tournaments.length} EU tournaments; ${result.leaderboard.entries.length} bounded leaderboard teams.`);
