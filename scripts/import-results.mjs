import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const file = process.argv.slice(2).find(argument => argument !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!file || !url || !service) throw new Error('Usage: npm run import:results -- data.json (Supabase environment required)');

const payload = JSON.parse(await readFile(file, 'utf8'));
const tournament = payload.tournament;
const results = payload.results;
const formats = new Set(['unknown', 'solo', 'duo', 'trio', 'squad']);
if (!tournament || !Array.isArray(results) || !results.length) throw new Error('Expected tournament object and non-empty results array');
for (const key of ['window_id', 'event_id', 'name', 'region', 'starts_at', 'ends_at']) if (typeof tournament[key] !== 'string' || !tournament[key]) throw new Error(`Invalid tournament.${key}`);
if (!formats.has(tournament.format || 'unknown') || !Number.isFinite(Date.parse(tournament.starts_at)) || !Number.isFinite(Date.parse(tournament.ends_at)) || Date.parse(tournament.ends_at) <= Date.parse(tournament.starts_at)) throw new Error('Invalid tournament format or dates');
for (const [index, row] of results.entries()) {
  if (typeof row.player_id !== 'string' || !row.player_id || !Number.isInteger(row.rank) || row.rank < 1 || !Number.isInteger(row.points) || row.points < 0) throw new Error(`Invalid result at index ${index}`);
  for (const key of ['matches', 'wins', 'team_eliminations']) if (!Number.isInteger(row[key] ?? 0) || (row[key] ?? 0) < 0) throw new Error(`Invalid ${key} at index ${index}`);
}

const supabase = createClient(url, service, { auth:{ persistSession:false } });
const ids = [...new Set(results.map(row => row.player_id))];
const players = await supabase.from('players').select('id').in('id', ids);
if (players.error) throw players.error;
const known = new Set(players.data.map(row => row.id));
const unknown = ids.filter(id => !known.has(id));
if (unknown.length) throw new Error(`Unknown player IDs: ${unknown.join(', ')}`);

if (dryRun) {
  console.log(`Validated ${results.length} results for ${tournament.window_id}.`);
} else {
  const syncedAt = new Date().toISOString();
  const tournamentRow = { ...tournament, format:tournament.format || 'unknown', synced_at:syncedAt };
  const savedTournament = await supabase.from('tournaments').upsert(tournamentRow, { onConflict:'window_id' });
  if (savedTournament.error) throw savedTournament.error;
  const savedResults = await supabase.from('player_results').upsert(results.map(row => ({
    window_id:tournament.window_id, player_id:row.player_id, team_id:row.team_id || null,
    team_size:row.team_size || 1, rank:row.rank, points:row.points, matches:row.matches || 0,
    wins:row.wins || 0, team_eliminations:row.team_eliminations || 0, updated_at:syncedAt,
  })), { onConflict:'window_id,player_id' });
  if (savedResults.error) throw savedResults.error;
  console.log(`Imported ${results.length} results for ${tournament.window_id}.`);
}
