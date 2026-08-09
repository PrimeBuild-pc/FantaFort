import { createHash, randomBytes, randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, uuidPattern } from '@/lib/admin/actions';
import { adminServiceClient, recordAdminFailure } from '@/lib/admin/service';

export async function POST(request: NextRequest, context: { params:Promise<{ id:string }> }) {
  if (process.env.ADMIN_ANONYMIZATION_ENABLED !== 'true') {
    return NextResponse.json({ error:'Admin operation unavailable' }, { status:404 });
  }
  const admin = await prepareAdminMutation(request);
  if (admin instanceof NextResponse) return admin;
  if (admin.currentAal !== 'aal2') return NextResponse.json({ error:'Admin operation unavailable' }, { status:403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as {
    confirmation?:unknown; impactFingerprint?:unknown; reason?:unknown;
    requestId?:unknown; idempotencyKey?:unknown; stepUpToken?:unknown;
  } | null;
  if (!uuidPattern.test(id) || !body || typeof body.confirmation !== 'string' || body.confirmation.length > 254
    || typeof body.impactFingerprint !== 'string' || !/^[a-f0-9]{32}$/.test(body.impactFingerprint)
    || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 500
    || typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId)
    || typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 200
    || typeof body.stepUpToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.stepUpToken)) {
    return NextResponse.json({ error:'Invalid anonymization request' }, { status:400 });
  }

  const detail = await admin.client.rpc('admin_get_user', { target_user_id:id });
  const user = detail.data as { email?:unknown; status?:unknown; role?:unknown } | null;
  if (detail.error || !user || user.role !== 'user'
    || (body.confirmation !== id && body.confirmation !== user.email)) {
    return NextResponse.json({ error:'Anonymization requirements not met' }, { status:409 });
  }

  const rpcInput = {
    target_user_id:id,
    confirmed_target_id:id,
    expected_impact_fingerprint:body.impactFingerprint,
    action_reason:body.reason.trim(),
    action_request_id:body.requestId,
    action_idempotency_key:body.idempotencyKey,
    step_up_token_hash:createHash('sha256').update(body.stepUpToken).digest('hex'),
  };
  if (user.status === 'anonymized' && body.confirmation === id) {
    return NextResponse.json({ success:true, replayed:true });
  }
  if (user.status !== 'suspended') {
    return NextResponse.json({ error:'Anonymization requirements not met' }, { status:409 });
  }

  const impact = await admin.client.rpc('admin_preview_anonymization_impact', { target_user_id:id });
  if (impact.error || (impact.data as { fingerprint?:unknown } | null)?.fingerprint !== body.impactFingerprint) {
    return NextResponse.json({ error:'Impact preview is stale' }, { status:409 });
  }

  const service = adminServiceClient();
  if (!service) return NextResponse.json({ error:'Admin operation unavailable' }, { status:503 });
  const authUser = await service.auth.admin.getUserById(id);
  const declaredProviders = authUser.data?.user?.app_metadata?.providers;
  const providers = [
    ...(authUser.data?.user?.identities?.map(identity => identity.provider) || []),
    ...(Array.isArray(declaredProviders) ? declaredProviders.filter((provider):provider is string => typeof provider === 'string') : []),
  ];
  if (authUser.error || !authUser.data.user || providers.some(provider => !['email', 'phone'].includes(provider))) {
    return NextResponse.json({ error:'Auth identity requires manual review' }, { status:409 });
  }
  const claims = await admin.client.auth.getClaims(admin.accessToken);
  const sessionId = claims.data?.claims.session_id;
  const grant = typeof sessionId === 'string' ? await service.from('admin_step_up_grants').select('token_hash')
    .eq('token_hash',rpcInput.step_up_token_hash).eq('admin_user_id',admin.user.id).eq('auth_session_id',sessionId)
    .eq('scope','anonymize').is('used_at',null).gt('expires_at',new Date().toISOString()).maybeSingle() : null;
  if (!grant || grant.error || !grant.data) {
    return NextResponse.json({ error:'Anonymization requirements not met' }, { status:409 });
  }
  const hasPhone = Boolean(authUser.data.user.phone);
  const clearedMetadata = Object.fromEntries(Object.keys(authUser.data.user.user_metadata || {}).map(key => [key, null]));
  const authUpdate = await service.auth.admin.updateUserById(id, {
    email:`anonymized-${randomBytes(16).toString('hex')}@example.invalid`,
    ...(hasPhone ? { phone:`+1555010${randomInt(10000).toString().padStart(4,'0')}`, phone_confirm:true } : {}),
    password:randomBytes(32).toString('hex'),
    email_confirm:true,
    user_metadata:{ ...clearedMetadata, username:'anonymized', test_marker:'ANONYMIZED' },
    ban_duration:'876000h',
  });
  if (authUpdate.error) {
    await recordAdminFailure(admin.user.id, 'user.anonymize_auth', id, body.reason.trim(), 'AUTH_ANONYMIZATION_FAILED');
    return NextResponse.json({ error:'Anonymization incomplete' }, { status:502 });
  }

  const result = await admin.client.rpc('admin_anonymize_profile', rpcInput);
  if (result.error) {
    await recordAdminFailure(admin.user.id, 'user.anonymize_database', id, body.reason.trim(), 'DATABASE_ANONYMIZATION_FAILED');
    return NextResponse.json({ error:'Anonymization incomplete; retry with the UUID confirmation' }, { status:503 });
  }
  return NextResponse.json({ success:true, replayed:false });
}
