import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, uuidPattern } from '@/lib/admin/actions';

export async function POST(request: NextRequest, context: { params:Promise<{ id:string }> }) {
  const admin = await prepareAdminMutation(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as {
    delta?:unknown; expectedBalance?:unknown; reason?:unknown; reference?:unknown;
    requestId?:unknown; idempotencyKey?:unknown; stepUpToken?:unknown;
  } | null;
  if (!uuidPattern.test(id) || !body || !Number.isInteger(body.delta) || Number(body.delta) === 0 || Math.abs(Number(body.delta)) > 10000
    || !Number.isInteger(body.expectedBalance) || Number(body.expectedBalance) < 0
    || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 500
    || (body.reference != null && (typeof body.reference !== 'string' || body.reference.length > 200))
    || typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId)
    || typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 200
    || typeof body.stepUpToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.stepUpToken)) {
    return NextResponse.json({ error:'Invalid wallet adjustment' }, { status:400 });
  }

  const delta = Number(body.delta);
  const expectedBalance = Number(body.expectedBalance);
  const reason = body.reason.trim();
  const reference = typeof body.reference === 'string' ? body.reference.trim() || null : null;
  const payloadFingerprint = createHash('sha256')
    .update(JSON.stringify([id, delta, expectedBalance, reason, reference, body.requestId])).digest('hex');
  const result = await admin.client.rpc('admin_adjust_wallet', {
    target_user_id:id,
    adjustment:delta,
    expected_balance:expectedBalance,
    action_reason:reason,
    external_reference:reference,
    action_request_id:body.requestId,
    action_idempotency_key:body.idempotencyKey,
    action_payload_fingerprint:payloadFingerprint,
    step_up_token_hash:createHash('sha256').update(body.stepUpToken).digest('hex'),
  });
  if (result.error) return NextResponse.json({ error:'Wallet adjustment unavailable' }, { status:409 });
  return NextResponse.json({ success:true, result:result.data });
}
