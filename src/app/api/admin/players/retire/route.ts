import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, uuidPattern } from '@/lib/admin/actions';
import { adminPlayerPoolMutationsEnabled } from '@/lib/admin/server';

export async function POST(request:NextRequest) {
  const admin = await prepareAdminMutation(request, adminPlayerPoolMutationsEnabled());
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null) as
    { id?:unknown; reason?:unknown; requestId?:unknown; idempotencyKey?:unknown } | null;
  if (!body || typeof body.id !== 'string' || body.id.length < 1 || body.id.length > 100
    || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 500
    || typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId)
    || typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 200) {
    return NextResponse.json({ error:'Invalid retirement request' }, { status:400 });
  }
  const result = await admin.client.rpc('admin_retire_market_player', {
    target_id: body.id, action_reason: body.reason.trim(),
    action_request_id: body.requestId, action_idempotency_key: body.idempotencyKey,
  });
  if (result.error) return NextResponse.json({ error:'Retirement unavailable' }, { status:409 });
  return NextResponse.json({ success:true, result:result.data });
}
