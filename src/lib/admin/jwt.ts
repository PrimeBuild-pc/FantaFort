import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminAal = 'aal1' | 'aal2';

export async function getVerifiedAal(client: SupabaseClient, accessToken: string, supabaseUrl: string): Promise<AdminAal | null> {
  try {
    const { data, error } = await client.auth.getClaims(accessToken);
    const claims = data?.claims;
    const audience = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud];
    const expectedIssuer = new URL('/auth/v1', supabaseUrl).href;

    if (error || !claims
      || claims.iss !== expectedIssuer
      || !audience.includes('authenticated')
      || typeof claims.exp !== 'number'
      || claims.exp <= Math.floor(Date.now() / 1000)) return null;

    if (claims.aal === 'aal1') return 'aal1';
    if (claims.aal === 'aal2') return 'aal2';
    return null;
  } catch {
    return null;
  }
}
