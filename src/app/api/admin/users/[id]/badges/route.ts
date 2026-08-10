import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, uuidPattern } from '@/lib/admin/actions';

const badgeSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(request:NextRequest, context:{params:Promise<{id:string}>}) {
  const admin=await prepareAdminMutation(request);
  if (admin instanceof NextResponse) return admin;
  const {id}=await context.params;
  const body=await request.json().catch(()=>null) as {badge?:unknown;assign?:unknown;reason?:unknown;requestId?:unknown;idempotencyKey?:unknown;stepUpToken?:unknown}|null;
  if (!uuidPattern.test(id) || !body || typeof body.badge!=='string' || !badgeSlug.test(body.badge)
    || typeof body.assign!=='boolean' || typeof body.reason!=='string' || body.reason.trim().length<3 || body.reason.trim().length>500
    || typeof body.requestId!=='string' || !uuidPattern.test(body.requestId)
    || typeof body.idempotencyKey!=='string' || body.idempotencyKey.length<8 || body.idempotencyKey.length>200
    || typeof body.stepUpToken!=='string' || !/^[a-f0-9]{64}$/.test(body.stepUpToken)) {
    return NextResponse.json({error:'Invalid badge operation'},{status:400});
  }
  const result=await admin.client.rpc('admin_set_user_badge',{
    target_user_id:id,
    target_badge_slug:body.badge,
    assign_badge:body.assign,
    action_reason:body.reason.trim(),
    action_request_id:body.requestId,
    action_idempotency_key:body.idempotencyKey,
    step_up_token_hash:createHash('sha256').update(body.stepUpToken).digest('hex'),
  });
  if (result.error) return NextResponse.json({error:'Badge operation unavailable'},{status:409});
  return NextResponse.json({success:true,result:result.data});
}
