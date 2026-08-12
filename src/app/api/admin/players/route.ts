import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

export async function GET(request:NextRequest) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const search = request.nextUrl.searchParams.get('search')?.trim() || '';
  if (search.length < 2 || search.length > 80) {
    return NextResponse.json({ error:'Invalid search' }, { status:400 });
  }
  const result = await admin.client.rpc('search_known_accounts', { search, result_limit:25 });
  if (result.error) return adminServerError();
  return NextResponse.json({ accounts:result.data || [] });
}
