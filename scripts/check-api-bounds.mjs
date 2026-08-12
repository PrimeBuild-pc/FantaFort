import assert from 'node:assert/strict';
import { fetchOsirionJson, isLeaderboardResponse, isTournamentResponse } from '../src/lib/osirion-fetch.ts';
import { fetchPlayersByIds, searchMarketPlayers } from '../src/lib/market-players.ts';

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

// The market is served page by page; the client must never ask for an unbounded set.
const calls = [];
const marketClient = { rpc: async (name, params) => {
  calls.push({ name, params });
  if (name === 'search_market_players') return { data:[{ id:'a', handle:'A', total_count:1234 }], error:null };
  return { data:params.ids.map(id => ({ id, handle:id })), error:null };
} };

// Id resolution chunks to the server-side cap instead of sending one huge array.
const many = Array.from({ length: 501 }, (_, index) => `player-${index}`);
assert.equal((await fetchPlayersByIds(marketClient, many)).length, 501);
assert.deepEqual(calls.map(call => call.params.ids.length), [500, 1]);
assert.deepEqual(await fetchPlayersByIds(marketClient, []), [], 'no request for an empty id set');

calls.length = 0;
const page = await searchMarketPlayers(marketClient, { search:`  ${'a'.repeat(120)}  `, page:3, pageSize:48 });
assert.equal(page.total, 1234, 'pager total comes from the unpaginated count');
assert.equal(calls[0].params.search.length, 80, 'search term is truncated before it leaves the client');
assert.equal(calls[0].params.page_offset, 96);
assert.equal(calls[0].params.page_limit, 48);

calls.length = 0;
await searchMarketPlayers(marketClient, { search:'   ' });
assert.equal(calls[0].params.search, null, 'a blank search is sent as no filter, not an empty match');
assert.equal(calls[0].params.page_offset, 0);

console.log('API timeout, byte, JSON, schema, record, valid-response and market pagination checks passed.');
