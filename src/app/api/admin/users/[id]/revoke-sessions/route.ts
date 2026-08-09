import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, readAdminAction, uuidPattern } from '@/lib/admin/actions';
import { recordAdminFailure } from '@/lib/admin/service';

export async function POST(request: NextRequest, context: { params:Promise<{ id:string }> }) {
  const admin = await prepareAdminMutation(request);
  if (admin instanceof NextResponse) return admin;
  const [{ id }, action] = await Promise.all([context.params, readAdminAction(request)]);
  if (!uuidPattern.test(id) || !action || typeof action.stepUpToken !== 'string'
    || !/^[a-f0-9]{64}$/.test(action.stepUpToken)) {
    return NextResponse.json({ error:'Invalid admin request' }, { status:400 });
  }

  const result = await admin.client.rpc('admin_revoke_user_sessions', {
    target_user_id:id, action_reason:action.reason,
    action_request_id:action.requestId, action_idempotency_key:action.idempotencyKey,
    step_up_token_hash:createHash('sha256').update(action.stepUpToken).digest('hex'),
  });
  if (result.error) {
    await recordAdminFailure(admin.user.id, 'user.revoke_sessions_database', id, action.reason, 'SESSION_REVOCATION_FAILED');
    return NextResponse.json({ error:'Admin operation unavailable' }, { status:409 });
  }
  return NextResponse.json({ success:true });
}
