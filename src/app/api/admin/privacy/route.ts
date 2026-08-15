import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

const STATUSES = ['pending', 'completed', 'cancelled'];

export async function GET(request:NextRequest) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = request.nextUrl.searchParams;
  const status = params.get('status') || 'pending';
  const page = Math.max(0, Number(params.get('page')) || 0);
  if (status !== 'all' && !STATUSES.includes(status)) return NextResponse.json({ error:'Invalid status' }, { status:400 });

  const result = await admin.client.rpc('admin_list_privacy_requests', {
    status_filter: status === 'all' ? null : status, page_index: page, page_size: 50,
  });
  if (result.error) return adminServerError();
  const rows = (result.data || []) as Record<string, unknown>[];
  return NextResponse.json({ requests: rows, total: Number(rows[0]?.total_count || 0) });
}
