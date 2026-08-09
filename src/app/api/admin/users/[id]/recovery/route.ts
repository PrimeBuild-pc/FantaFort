import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, readAdminAction, uuidPattern } from '@/lib/admin/actions';

export async function POST(request: NextRequest, context: { params:Promise<{ id:string }> }) {
  const admin = await prepareAdminMutation(request);
  if (admin instanceof NextResponse) return admin;
  const [{ id }, action] = await Promise.all([context.params, readAdminAction(request)]);
  if (!uuidPattern.test(id) || !action || typeof action.stepUpToken !== 'string'
    || !/^[a-f0-9]{64}$/.test(action.stepUpToken)) {
    return NextResponse.json({ error:'Invalid admin request' }, { status:400 });
  }
  if (admin.currentAal !== 'aal2') return NextResponse.json({ error:'Admin operation unavailable' }, { status:403 });

  const accepted = await admin.client.rpc('admin_authorize_recovery_attempt', {
    target_user_id:id, action_reason:action.reason, action_request_id:action.requestId,
    action_idempotency_key:action.idempotencyKey,
    step_up_token_hash:createHash('sha256').update(action.stepUpToken).digest('hex'),
  });
  if (!accepted.error && accepted.data === true) {
    const user = await admin.client.rpc('admin_get_user', { target_user_id:id });
    const email = (user.data as { email?:unknown } | null)?.email;
    if (!user.error && typeof email === 'string') {
      await admin.client.auth.resetPasswordForEmail(email, { redirectTo:`${request.nextUrl.origin}/auth?reset=1` });
    }
  }
  return NextResponse.json({ accepted:true }, { status:202 });
}
