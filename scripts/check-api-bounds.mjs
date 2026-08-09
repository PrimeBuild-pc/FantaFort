import assert from 'node:assert/strict';
import { fetchOsirionJson, isLeaderboardResponse, isTournamentResponse } from '../src/lib/osirion-fetch.ts';
import { getAllMarketPlayers } from '../src/lib/market-players.ts';

const originalFetch = globalThis.fetch;
const mock = implementation => { globalThis.fetch = implementation; };
const validTournament = { eventId:'event', eventWindows:[{ beginTime:'2026-01-01T00:00:00Z', endTime:'2026-01-01T01:00:00Z', scoreLocations:[{ leaderboardEventId:'event', leaderboardEventWindowId:'window', isMain:true }] }] };
const validEntry = { rank:1, pointsEarned:100, percentile:1, players:[], sessionHistory:[] };

try {
  let request;
  mock(async (url, init) => { request = { url, init }; return new Response(JSON.stringify({ tournaments:[validTournament] })); });
  const valid = await fetchOsirionJson('/tournaments?region=EU', isTournamentResponse, { cache:'no-store' }, { retries:0 });
  assert.equal(valid.tournaments.length, 1);
  assert.equal(request.url, 'https://fnapi.osirion.gg/v1/tournaments?region=EU');
  assert.equal(request.init.cache, 'no-store');
  assert.ok(request.init.signal instanceof AbortSignal);

  mock((_url, init) => new Promise((_, reject) => {
    const keepAlive = setTimeout(() => reject(new Error('timeout signal did not abort')), 100);
    init.signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(init.signal.reason); }, { once:true });
  }));
  await assert.rejects(fetchOsirionJson('/timeout', isTournamentResponse, {}, { timeoutMs:10, retries:0 }), /timeout|aborted/i);

  mock(async () => new Response('x'.repeat(101)));
  await assert.rejects(fetchOsirionJson('/large', isTournamentResponse, {}, { maxBytes:100, retries:0 }), /byte limit/);

  mock(async () => new Response('{'));
  await assert.rejects(fetchOsirionJson('/json', isTournamentResponse, {}, { retries:0 }), /invalid JSON/);

  mock(async () => new Response(JSON.stringify({ tournaments:[{ eventId:42, eventWindows:[] }] })));
  await assert.rejects(fetchOsirionJson('/schema', isTournamentResponse, {}, { retries:0 }), /invalid schema/);

  mock(async () => new Response(JSON.stringify({ leaderboard:{ totalPages:1, entries:Array(501).fill(validEntry) } })));
  await assert.rejects(fetchOsirionJson('/records', isLeaderboardResponse, {}, { retries:0 }), /invalid schema/);

  mock(async () => new Response(JSON.stringify({ leaderboard:{ totalPages:1, updatedAt:'2026-01-01T00:00:00Z', entries:[validEntry] } })));
  assert.equal((await fetchOsirionJson('/valid', isLeaderboardResponse, {}, { retries:0 })).leaderboard.entries.length, 1);
} finally {
  globalThis.fetch = originalFetch;
}

let marketPage = 0;
const marketClient = { rpc: () => ({ range:async () => ({ data:marketPage++ === 0 ? Array(1000).fill({ id:'player' }) : [{ id:'last' }], error:null }) }) };
assert.equal((await getAllMarketPlayers(marketClient)).length, 1001);
assert.equal(marketPage, 2);
console.log('API timeout, byte, JSON, schema, record and valid-response checks passed.');
