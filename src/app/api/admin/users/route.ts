import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

export async function GET(request: NextRequest) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const params = request.nextUrl.searchParams;
  const page = Number(params.get('page') || 0);
  const size = Number(params.get('size') || 25);
  const search = params.get('search')?.trim() || null;
  const status = params.get('status') || null;
  const role = params.get('role') || null;
  if (!Number.isInteger(page) || page < 0 || page > 10000 || !Number.isInteger(size) || size < 1 || size > 100
    || (search?.length || 0) > 254
    || (status !== null && !['active', 'suspended', 'anonymized'].includes(status))
    || (role !== null && !['admin', 'user'].includes(role))) {
    return NextResponse.json({ error: 'Invalid user query' }, { status: 400 });
  }

  const result = await admin.client.rpc('admin_list_users', {
    user_search:search,
    status_filter:status,
    role_filter:role,
    page_index:page,
    page_size:size,
  });
  if (result.error) return adminServerError();
  return NextResponse.json({ users:result.data || [], total:Number(result.data?.[0]?.total_count || 0), page, size });
}
