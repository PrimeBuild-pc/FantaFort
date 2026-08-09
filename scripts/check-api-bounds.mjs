import assert from 'node:assert/strict';
import { fetchOsirion } from '../src/lib/osirion-fetch.ts';
import { getAllMarketPlayers } from '../src/lib/market-players.ts';

const originalFetch = globalThis.fetch;
let request;
globalThis.fetch = async (url, init) => {
  request = { url, init };
  return new Response('{}');
};

try {
  await fetchOsirion('/tournaments?region=EU', { cache: 'no-store' });
  assert.equal(request.url, 'https://fnapi.osirion.gg/v1/tournaments?region=EU');
  assert.equal(request.init.cache, 'no-store');
  assert.ok(request.init.signal instanceof AbortSignal);
} finally {
  globalThis.fetch = originalFetch;
}

let marketPage = 0;
const marketClient = { rpc: () => ({ range: async () => ({ data: marketPage++ === 0 ? Array(1000).fill({ id:'player' }) : [{ id:'last' }], error:null }) }) };
assert.equal((await getAllMarketPlayers(marketClient)).length, 1001);
assert.equal(marketPage, 2);

console.log('API resource-bound checks passed.');
