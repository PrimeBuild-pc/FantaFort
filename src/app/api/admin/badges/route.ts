import { NextRequest, NextResponse } from 'next/server';
import { adminMutationsEnabled, adminServerError, authorizeAdmin } from '@/lib/admin/server';

export async function GET(request:NextRequest) {
  const admin=await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const [definitions,candidates]=await Promise.all([
    admin.client.from('badges').select('slug,name,description,icon_token,assignment_type').order('name'),
    admin.client.rpc('admin_preview_founding_50'),
  ]);
  if (definitions.error || candidates.error) return adminServerError();
  return NextResponse.json({definitions:definitions.data||[],foundingCandidates:candidates.data||[],mutationsEnabled:adminMutationsEnabled()});
}
