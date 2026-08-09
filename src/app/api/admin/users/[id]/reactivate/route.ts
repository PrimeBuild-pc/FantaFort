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

  const service = adminServiceClient();
  if (!service) return NextResponse.json({ error:'Admin operation unavailable' }, { status:503 });
  const tokenHash = createHash('sha256').update(action.stepUpToken).digest('hex');
  const claims = await admin.client.auth.getClaims(admin.accessToken);
  const sessionId = claims.data?.claims.session_id;
  const grant = typeof sessionId === 'string' ? await service.from('admin_step_up_grants').select('token_hash')
    .eq('token_hash',tokenHash).eq('admin_user_id',admin.user.id).eq('auth_session_id',sessionId)
    .eq('scope','account_status').eq('target_user_id',id).is('used_at',null)
    .gt('expires_at',new Date().toISOString()).maybeSingle() : null;
  if (!grant || grant.error || !grant.data) return NextResponse.json({ error:'Admin operation unavailable' }, { status:409 });
  const unbanned = await service.auth.admin.updateUserById(id, { ban_duration:'none' });
  if (unbanned.error) {
    await recordAdminFailure(admin.user.id, 'user.reactivate_auth', id, action.reason, 'AUTH_UNBAN_FAILED');
    return NextResponse.json({ error:'Admin operation unavailable' }, { status:502 });
  }

  const changed = await admin.client.rpc('admin_set_account_status', {
    target_user_id:id, new_status:'active', action_reason:action.reason,
    action_request_id:action.requestId, action_idempotency_key:action.idempotencyKey,
    step_up_token_hash:tokenHash,
  });
  if (changed.error) {
    await service.auth.admin.updateUserById(id, { ban_duration:'876000h' });
    await recordAdminFailure(admin.user.id, 'user.reactivate_database', id, action.reason, 'DATABASE_REACTIVATION_FAILED');
    return NextResponse.json({ error:'Admin operation unavailable' }, { status:409 });
  }
  return NextResponse.json({ success:true });
}
