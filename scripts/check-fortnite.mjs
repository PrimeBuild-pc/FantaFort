const endpoint = 'https://fnapi.osirion.gg/v1';
const tournaments = await fetch(`${endpoint}/tournaments?region=EU&includeHistoricData=true`).then(response => {
  if (!response.ok) throw new Error(`Tournament API ${response.status}`);
  return response.json();
});

if (!tournaments.success || !Array.isArray(tournaments.tournaments) || tournaments.tournaments.length === 0) {
  throw new Error('Invalid Osirion tournament response');
}

const now = Date.now();
const candidate = tournaments.tournaments
  .flatMap(event => (event.eventWindows || []).map(window => ({ event, window })))
  .filter(({ window }) => Date.parse(window.endTime) <= now && window.scoreLocations?.length)
  .sort((a, b) => Date.parse(b.window.endTime) - Date.parse(a.window.endTime))[0];
if (!candidate) throw new Error('No completed tournament leaderboard found');
const location = candidate.window.scoreLocations.find(item => item.isMain) || candidate.window.scoreLocations[0];
const query = new URLSearchParams({
  leaderboardEventId: location.leaderboardEventId,
  leaderboardEventWindowId: location.leaderboardEventWindowId,
  page: '0',
});
const result = await fetch(`${endpoint}/tournaments/leaderboard?${query}`).then(response => {
  if (!response.ok) throw new Error(`Leaderboard API ${response.status}`);
  return response.json();
});
const entry = result.leaderboard?.entries?.[0];
if (!entry || !Array.isArray(entry.players) || !Array.isArray(entry.sessionHistory)) {
  throw new Error('Invalid Osirion leaderboard response');
}
console.log(`Osirion OK: ${tournaments.tournaments.length} EU tournaments; ${result.leaderboard.entries.length} leaderboard teams with session history.`);
