import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateValue = (value:string|null) => value ? new Date(value) : null;

export async function GET(request: NextRequest) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = request.nextUrl.searchParams;
  const page = Number(params.get('page') || 0);
  const size = Number(params.get('size') || 50);
  const search = params.get('q')?.trim() || null;
  const action = params.get('action') || null;
  const outcome = params.get('outcome') || null;
  const targetType = params.get('targetType') || null;
  const targetRef = params.get('target') || null;
  const actor = params.get('admin') || null;
  const from = dateValue(params.get('from'));
  const to = dateValue(params.get('to'));
  if (!Number.isInteger(page) || page < 0 || page > 1000 || !Number.isInteger(size) || size < 1 || size > 100
    || (search !== null && (search.length < 2 || search.length > 100 || !/^[A-Za-z0-9_.:-]+$/.test(search) || uuid.test(search)))
    || (action !== null && !/^[a-z][a-z0-9_.]{1,79}$/.test(action))
    || (outcome !== null && !['succeeded', 'failed', 'denied'].includes(outcome))
    || (targetType !== null && !/^[a-z][a-z0-9_]{1,39}$/.test(targetType))
    || (targetRef !== null && !/^target_[a-f0-9]{12}$/.test(targetRef))
    || (actor !== null && !/^[A-Za-z0-9_.-]{3,30}$/.test(actor))
    || (params.has('from') && (!from || Number.isNaN(from.getTime())))
    || (params.has('to') && (!to || Number.isNaN(to.getTime())))
    || (from && to && (from > to || to.getTime() - from.getTime() > 25 * 31 * 24 * 60 * 60 * 1000))) {
    return NextResponse.json({ error:'Invalid audit query' }, { status:400 });
  }
  const result = await admin.client.rpc('admin_list_audit', {
    search_filter:search,
    action_filter:action,
    outcome_filter:outcome,
    target_type_filter:targetType,
    target_ref_filter:targetRef,
    actor_username_filter:actor,
    created_from_filter:from?.toISOString() || null,
    created_to_filter:to?.toISOString() || null,
    page_index:page,
    page_size:size,
  }).abortSignal(AbortSignal.timeout(4000));
  if (result.error) return adminServerError();
  return NextResponse.json({ entries:result.data || [], total:Number(result.data?.[0]?.total_count || 0), page, size });
}
