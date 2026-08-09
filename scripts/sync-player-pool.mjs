import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase configuration');

const dryRun = process.argv.includes('--dry-run');
const fullSync = dryRun || process.argv.includes('--full');
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const api = 'https://fnapi.osirion.gg/v1';
const getJson = async (url, label) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`${label}: ${response.status}`);
    if (attempt === 4) throw new Error(`${label}: ${response.status}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 5000 * 2 ** attempt));
  }
};
const existing = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('players').select('id, account_id, price, rarity, photo_url, active').range(from, from + 999);
  if (error) throw error;
  existing.push(...data);
  if (data.length < 1000) break;
}
const existingByAccount = new Map(existing.map(player => [player.account_id, player]));
const imported = new Map();
let scannedWindows = 0;

for (const region of ['EU', 'NAC', 'NAW', 'OCE']) {
  const data = await getJson(`${api}/tournaments?region=${region}&includeHistoricData=true`, `Osirion tournaments unavailable for ${region}`);
  const perEvent = new Map();
  const candidates = data.tournaments
    .filter(event => /fncs/i.test(event.eventId))
    .filter(event => !/division[45]/i.test(event.eventId))
    .flatMap(event => event.eventWindows.map(window => ({ event, window })))
    .filter(({ window }) => Date.parse(window.endTime) <= Date.now() && Date.parse(window.endTime) >= Date.now() - 120 * 86400000 && window.scoreLocations?.length)
    .sort((a, b) => Date.parse(b.window.endTime) - Date.parse(a.window.endTime))
    .filter(({ event }) => {
      const count = perEvent.get(event.eventId) || 0;
      if (count >= (fullSync ? 12 : 1)) return false;
      perEvent.set(event.eventId, count + 1);
      return true;
    })
    .slice(0, fullSync ? (region === 'EU' ? 36 : 12) : (region === 'EU' ? 3 : 1));

  for (const candidate of candidates) {
    const location = candidate.window.scoreLocations.find(item => item.isMain) || candidate.window.scoreLocations[0];
    const params = new URLSearchParams({
      leaderboardEventId: location.leaderboardEventId,
      leaderboardEventWindowId: location.leaderboardEventWindowId,
      page: '0',
    });
    const { leaderboard } = await getJson(`${api}/tournaments/leaderboard?${params}`, 'Osirion leaderboard unavailable');
    if (!leaderboard?.entries) continue;
    scannedWindows++;

    const developmentDivision = /division[23]/i.test(candidate.event.eventId);
    for (const entry of leaderboard.entries.filter(item => item.rank <= 100)) {
      for (const account of entry.players) {
        if (developmentDivision && entry.rank > 10 && !(region === 'EU' && /italy/i.test(account.flagToken || ''))) continue;
        if (!account.accountId || !account.username || imported.has(account.accountId)) continue;
        const current = existingByAccount.get(account.accountId);
        imported.set(account.accountId, {
          id: current?.id || account.accountId,
          account_id: account.accountId,
          handle: account.username.replace(/ǃ+$/, '').trim(),
          rarity: current?.rarity || (entry.rank <= 10 ? 'legendary' : entry.rank <= 50 ? 'epic' : 'rare'),
          price: current?.price || Math.max(1500, 5000 - (entry.rank - 1) * 35),
          active: true,
          eligibility_note: `Top 100 · ${candidate.event.displayData?.longFormatTitle || candidate.event.eventId} · ${region}`,
        });
      }
    }
  }
}

const players = [...imported.values()];
if (!dryRun && players.length) {
  const { error: upsertError } = await supabase.from('players').upsert(players);
  if (upsertError) throw upsertError;
  const staleIds = existing.filter(player => player.active && !player.photo_url && !imported.has(player.account_id)).map(player => player.id);
  for (let index = 0; index < staleIds.length; index += 100) {
    const { error } = await supabase.from('players').update({ active:false }).in('id', staleIds.slice(index, index + 100));
    if (error) throw error;
  }
}
console.log(`${dryRun ? 'Would import' : 'Player pool ready'}: ${players.length} players from ${scannedWindows} recent FNCS windows.`);
