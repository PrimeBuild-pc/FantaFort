import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { adminMutationsEnabled, authorizeAdmin, rejectCrossOriginMutation } from './server';

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function prepareAdminMutation(request: NextRequest) {
  if (!adminMutationsEnabled()) return NextResponse.json({ error:'Admin mutations disabled' }, { status:404 });
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  return authorizeAdmin(request);
}

export async function readAdminAction(request: NextRequest) {
  const body = await request.json().catch(() => null) as { reason?:unknown; requestId?:unknown; idempotencyKey?:unknown; stepUpToken?:unknown } | null;
  if (!body || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 500
    || typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId)
    || typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 200) return null;
  return { reason:body.reason.trim(), requestId:body.requestId, idempotencyKey:body.idempotencyKey, stepUpToken:body.stepUpToken };
}
