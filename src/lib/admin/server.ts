import 'server-only';

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { adminRuntimeConfig } from './config';
import { getVerifiedAal, type AdminAal } from './jwt';

type AdminRequest = { client: SupabaseClient; user: User; accessToken: string; currentAal: AdminAal };
type AdminAuthorizationOptions = { allowAal1?: boolean };

const denied = () => NextResponse.json({ error: 'Admin access unavailable' }, { status: 403 });

export function supabaseForToken(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function authorizeAdmin(request: NextRequest, options: AdminAuthorizationOptions = {}): Promise<AdminRequest | NextResponse> {
  const match = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match) return denied();
  const accessToken = match[1];
  const client = supabaseForToken(accessToken);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!client || !supabaseUrl) return denied();

  const currentAal = await getVerifiedAal(client, accessToken, supabaseUrl);
  if (!currentAal) return denied();

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return denied();

  const authorization = await client.rpc(options.allowAal1 ? 'authorize_admin_step_up_request' : 'authorize_admin_request');
  if (authorization.error) return denied();
  if (!options.allowAal1 && adminMfaEnforcementEnabled() && currentAal !== 'aal2') return denied();
  return { client, user: data.user, accessToken, currentAal };
}

export const adminMfaEnforcementEnabled = () => adminRuntimeConfig().mfaEnforcementEnabled;
export const adminMutationsEnabled = () => adminRuntimeConfig().mutationsEnabled;
export const adminBadgeMutationsEnabled = () => adminRuntimeConfig().badgeMutationsEnabled;
export const adminPlayerPoolMutationsEnabled = () => adminRuntimeConfig().playerPoolMutationsEnabled;
export const adminAnonymizationEnabled = () => adminRuntimeConfig().anonymizationEnabled;

export function rejectCrossOriginMutation(request: NextRequest) {
  const origin = request.headers.get('origin');
  return !origin || origin !== request.nextUrl.origin
    ? NextResponse.json({ error: 'Request rejected' }, { status: 403 })
    : null;
}

export const adminServerError = () =>
  NextResponse.json({ error: 'Admin operation unavailable' }, { status: 500 });
