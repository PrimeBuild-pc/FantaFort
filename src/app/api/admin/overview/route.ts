import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

export async function GET(request: NextRequest) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const signal = AbortSignal.timeout(4000);
  const [overview, errors, health, activity] = await Promise.all([
    admin.client.rpc('get_admin_overview').abortSignal(signal),
    admin.client.rpc('get_admin_errors').abortSignal(signal),
    admin.client.rpc('get_admin_health').abortSignal(signal),
    admin.client.rpc('admin_list_audit', {
      search_filter:null, action_filter:null, outcome_filter:null, target_type_filter:null, target_ref_filter:null,
      actor_username_filter:null, created_from_filter:null, created_to_filter:null, page_index:0, page_size:10,
    }).abortSignal(signal),
  ]);
  if (overview.error || errors.error || health.error || activity.error) return adminServerError();

  return NextResponse.json({ overview:overview.data, errors:errors.data || [], health:health.data, activity:activity.data || [] });
}
