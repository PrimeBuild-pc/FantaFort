import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, uuidPattern } from '@/lib/admin/actions';
import { adminPlayerPoolMutationsEnabled } from '@/lib/admin/server';

const TIERS = ['elite', 'contender', 'regional', 'open'];

export async function POST(request:NextRequest) {
  const admin = await prepareAdminMutation(request, adminPlayerPoolMutationsEnabled());
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null) as
    { accountId?:unknown; tier?:unknown; reason?:unknown; requestId?:unknown; idempotencyKey?:unknown } | null;
  if (!body || typeof body.accountId !== 'string' || body.accountId.length < 8 || body.accountId.length > 100
    || typeof body.tier !== 'string' || !TIERS.includes(body.tier)
    || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 500
    || typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId)
    || typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 200) {
    return NextResponse.json({ error:'Invalid promotion request' }, { status:400 });
  }
  // Eligibility is decided by the RPC from stored results, never here: the route only
  // shapes the request. A rejection means nothing was written.
  const result = await admin.client.rpc('admin_promote_known_account', {
    target_account_id:body.accountId,
    target_tier:body.tier,
    action_reason:body.reason.trim(),
    action_request_id:body.requestId,
    action_idempotency_key:body.idempotencyKey,
  });
  if (result.error) return NextResponse.json({ error:'Promotion unavailable' }, { status:409 });
  return NextResponse.json({ success:true, result:result.data });
}
