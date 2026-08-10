import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  adminBadgeMutationsEnabled,
  adminMutationsEnabled,
  authorizeAdmin,
  rejectCrossOriginMutation,
  supabaseForToken,
} from '@/lib/admin/server';

const scopes = new Set(['role', 'economy', 'recovery', 'anonymize', 'account_status', 'session_revoke', 'badge']);
const targetedScopes = new Set(['account_status', 'session_revoke', 'badge']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Each scope answers to exactly one capability; neither capability widens the other.
const scopeEnabled = (scope: string) => scope === 'badge' ? adminBadgeMutationsEnabled() : adminMutationsEnabled();

export async function POST(request: NextRequest) {
  if (!adminMutationsEnabled() && !adminBadgeMutationsEnabled()) {
    return NextResponse.json({ error: 'Admin mutations disabled' }, { status: 404 });
  }
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;

  const admin = await authorizeAdmin(request, { allowAal1:true });
  if (admin instanceof NextResponse) return admin;

  const body = await request.json().catch(() => null) as { factorId?:unknown; code?:unknown; scope?:unknown; targetId?:unknown } | null;
  if (!body || typeof body.factorId !== 'string' || !uuid.test(body.factorId)
    || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)
    || typeof body.scope !== 'string' || !scopes.has(body.scope)
    || (targetedScopes.has(body.scope) && (typeof body.targetId !== 'string' || !uuid.test(body.targetId)))) {
    return NextResponse.json({ error: 'Invalid step-up request' }, { status: 400 });
  }
  if (!scopeEnabled(body.scope)) return NextResponse.json({ error: 'Admin mutations disabled' }, { status: 404 });

  const verified = await admin.client.auth.mfa.challengeAndVerify({ factorId:body.factorId, code:body.code });
  if (verified.error || !verified.data) return NextResponse.json({ error: 'MFA verification failed' }, { status: 403 });

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const elevated = supabaseForToken(verified.data.access_token);
  if (!elevated) return NextResponse.json({ error: 'Admin operation unavailable' }, { status: 500 });
  const grant = targetedScopes.has(body.scope)
    ? await elevated.rpc('create_admin_step_up_grant', {
      grant_token_hash:tokenHash, grant_scope:body.scope, grant_target_user_id:body.targetId,
    })
    : await elevated.rpc('create_admin_step_up_grant', { grant_token_hash:tokenHash, grant_scope:body.scope });
  if (grant.error) return NextResponse.json({ error: 'Admin operation unavailable' }, { status: 500 });

  return NextResponse.json({
    stepUpToken: token,
    accessToken: verified.data.access_token,
    refreshToken: verified.data.refresh_token,
    expiresIn: 300,
  });
}
