import { NextRequest, NextResponse } from 'next/server';
import { adminAnonymizationEnabled, adminBadgeMutationsEnabled,
  adminPlayerPoolMutationsEnabled, adminMfaEnforcementEnabled, adminMutationsEnabled, authorizeAdmin } from '@/lib/admin/server';

export async function GET(request: NextRequest) {
  const admin = await authorizeAdmin(request, { allowAal1:true });
  if (admin instanceof NextResponse) return admin;
  const nextAal = admin.user.factors?.some(factor => factor.status === 'verified') ? 'aal2' : admin.currentAal;
  return NextResponse.json({
    authorized: true,
    mutationsEnabled: adminMutationsEnabled(),
    badgeMutationsEnabled: adminBadgeMutationsEnabled(),
    playerPoolMutationsEnabled: adminPlayerPoolMutationsEnabled(),
    mfaEnforcementEnabled: adminMfaEnforcementEnabled(),
    currentAal: admin.currentAal,
    nextAal,
    anonymizationEnabled: adminAnonymizationEnabled(),
  });
}
