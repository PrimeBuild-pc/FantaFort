import type { SupabaseClient } from '@supabase/supabase-js';
import type { Player } from './types';

// Row shape shared by get_players_by_ids and search_market_players.
export function mapPlayer(row: Record<string, unknown>): Player {
  return {
    id: String(row.id), handle: String(row.handle), realName: row.real_name as string | null,
    team: row.organization as string | null, photoUrl: row.photo_url as string | null,
    rarity: row.rarity as Player['rarity'], price: Number(row.price), earnings: row.earnings as number | null,
    birthDate: row.birth_date as string | null, tournamentPoints: Number(row.tournament_points || 0),
    cupsPlayed: Number(row.cups_played || 0), tournamentWins: Number(row.tournament_wins || 0),
    bestPlacement: row.best_placement == null ? null : Number(row.best_placement),
    averagePlacement: row.average_placement == null ? null : Number(row.average_placement),
    pointsPerMatch: Number(row.points_per_match || 0), winRate: Number(row.win_rate || 0),
    priceChange: Number(row.price_change || 0),
    teammates: (row.teammates || []) as Player['teammates'],
    eligibility: String(row.eligibility_note || ''),
  };
}

export const MARKET_PAGE_SIZE = 48;
/** Matches the server-side cap in get_players_by_ids. */
const MAX_IDS = 500;

/** Resolves an explicit set of players — roster, portfolio positions, one card. */
export async function fetchPlayersByIds(client: SupabaseClient, ids: string[]): Promise<Player[]> {
  if (!ids.length) return [];
  const players: Player[] = [];
  for (let index = 0; index < ids.length; index += MAX_IDS) {
    const { data, error } = await client.rpc('get_players_by_ids', { ids: ids.slice(index, index + MAX_IDS) });
    if (error) throw error;
    players.push(...(data as Record<string, unknown>[]).map(mapPlayer));
  }
  return players;
}

/** One page of the market. `total` is the unpaginated match count for the pager. */
export async function searchMarketPlayers(
  client: SupabaseClient,
  { search = '', page = 1, pageSize = MARKET_PAGE_SIZE }: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{ players: Player[]; total: number }> {
  const { data, error } = await client.rpc('search_market_players', {
    search: search.trim().slice(0, 80) || null,
    page_limit: pageSize,
    page_offset: Math.max(0, page - 1) * pageSize,
  });
  if (error) throw error;
  const rows = (data || []) as Record<string, unknown>[];
  return { players: rows.map(mapPlayer), total: Number(rows[0]?.total_count || 0) };
}

export type MarketSummary = {
  listed: number; advancing: number; declining: number; averageMove: number;
  movers: { id: string; handle: string; priceChange: number }[];
};

/** Market-wide aggregates for the trading overview. */
export async function fetchMarketSummary(client: SupabaseClient): Promise<MarketSummary> {
  const { data, error } = await client.rpc('get_market_summary');
  if (error) throw error;
  return (data || { listed: 0, advancing: 0, declining: 0, averageMove: 0, movers: [] }) as MarketSummary;
}

export type KnownAccount = {
  account_id: string; username: string; flag_token: string|null; best_rank: number;
  appearances: number; latest_event: string|null; latest_region: string|null; latest_ends_at: string|null;
};

// Repeated misses are the common case for a search box, so misses are cached too:
// without that, every keystroke past the last match re-queries for nothing.
const knownAccountCache = new Map<string, { at: number; accounts: KnownAccount[] }>();
const KNOWN_ACCOUNT_TTL_MS = 5 * 60_000;
const KNOWN_ACCOUNT_CACHE_MAX = 100;

/** Players seen in synced tournaments who are not carried in the market. */
export async function searchKnownAccounts(client: SupabaseClient, search: string): Promise<KnownAccount[]> {
  const key = search.trim().toLowerCase().slice(0, 80);
  if (key.length < 2) return [];
  const cached = knownAccountCache.get(key);
  if (cached && Date.now() - cached.at < KNOWN_ACCOUNT_TTL_MS) return cached.accounts;

  const { data, error } = await client.rpc('search_known_accounts', { search: key, result_limit: 10 });
  if (error) throw error;
  const accounts = (data || []) as KnownAccount[];
  // Bounded so a long session cannot grow the cache without limit.
  if (knownAccountCache.size >= KNOWN_ACCOUNT_CACHE_MAX) {
    knownAccountCache.delete(knownAccountCache.keys().next().value as string);
  }
  knownAccountCache.set(key, { at: Date.now(), accounts });
  return accounts;
}
