import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

export async function GET(request:NextRequest) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = request.nextUrl.searchParams;
  const search = params.get('q')?.trim() || null;
  const page = Math.max(0, Number(params.get('page')) || 0);

  const result = await admin.client.rpc('admin_list_errors', { search_filter: search, page_index: page, page_size: 50 });
  if (result.error) return adminServerError();
  const rows = (result.data || []) as Record<string, unknown>[];
  return NextResponse.json({ entries: rows, total: Number(rows[0]?.total_count || 0) });
}
