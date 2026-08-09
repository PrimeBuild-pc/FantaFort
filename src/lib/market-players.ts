import type { SupabaseClient } from '@supabase/supabase-js';

export async function getAllMarketPlayers(client: SupabaseClient) {
  const players: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.rpc('get_market_players').range(from, from + 999);
    if (error) throw error;
    players.push(...data);
    if (data.length < 1000) return players;
  }
}
