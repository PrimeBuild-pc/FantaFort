import { NextRequest, NextResponse } from 'next/server';
import { prepareAdminMutation, uuidPattern } from '@/lib/admin/actions';
import { adminResultsImportEnabled } from '@/lib/admin/server';

export async function POST(request:NextRequest) {
  const admin = await prepareAdminMutation(request, adminResultsImportEnabled());
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null) as
    { tournament?:unknown; results?:unknown; reason?:unknown; requestId?:unknown; idempotencyKey?:unknown } | null;
  if (!body || typeof body.tournament !== 'object' || body.tournament === null
    || !Array.isArray(body.results) || !body.results.length
    || typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.trim().length > 500
    || typeof body.requestId !== 'string' || !uuidPattern.test(body.requestId)
    || typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 200) {
    return NextResponse.json({ error:'Invalid import payload' }, { status:400 });
  }
  const result = await admin.client.rpc('admin_import_tournament_results', {
    tournament_data: body.tournament, results_data: body.results,
    action_reason: body.reason.trim(), action_request_id: body.requestId, action_idempotency_key: body.idempotencyKey,
  });
  if (result.error) return NextResponse.json({ error: result.error.message || 'Import rejected' }, { status:409 });
  return NextResponse.json({ success:true, result:result.data });
}
