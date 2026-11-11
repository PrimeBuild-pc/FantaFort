import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

export async function GET(request: NextRequest) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const report = await admin.client.rpc('admin_interest_report').abortSignal(AbortSignal.timeout(12000));
  if (report.error) return adminServerError();
  return NextResponse.json(report.data);
}
