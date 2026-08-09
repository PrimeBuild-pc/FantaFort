import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, readAdminAction, uuidPattern } from '@/lib/admin/actions';
import { adminServiceClient, recordAdminFailure } from '@/lib/admin/service';

export async function POST(request: NextRequest, context: { params:Promise<{ id:string }> }) {
  const admin = await prepareAdminMutation(request);
  if (admin instanceof NextResponse) return admin;
  const [{ id }, action] = await Promise.all([context.params, readAdminAction(request)]);
  if (!uuidPattern.test(id) || !action || typeof action.stepUpToken !== 'string'
    || !/^[a-f0-9]{64}$/.test(action.stepUpToken)) {
    return NextResponse.json({ error:'Invalid admin request' }, { status:400 });
  }

  const changed = await admin.client.rpc('admin_set_account_status', {
    target_user_id:id, new_status:'suspended', action_reason:action.reason,
    action_request_id:action.requestId, action_idempotency_key:action.idempotencyKey,
    step_up_token_hash:createHash('sha256').update(action.stepUpToken).digest('hex'),
  });
  if (changed.error) return NextResponse.json({ error:'Admin operation unavailable' }, { status:409 });

  const service = adminServiceClient();
  if (!service) return NextResponse.json({ error:'Admin operation incomplete' }, { status:503 });
  const banned = await service.auth.admin.updateUserById(id, { ban_duration:'876000h' });
  if (banned.error) {
    await recordAdminFailure(admin.user.id, 'user.suspend_auth', id, action.reason, 'AUTH_BAN_FAILED');
    return NextResponse.json({ error:'Admin operation incomplete' }, { status:502 });
  }
  return NextResponse.json({ success:true });
}
