import { NextRequest, NextResponse } from 'next/server';
import { adminMfaEnforcementEnabled, adminMutationsEnabled, authorizeAdmin } from '@/lib/admin/server';

export async function GET(request: NextRequest) {
  const admin = await authorizeAdmin(request, { allowAal1:true });
  if (admin instanceof NextResponse) return admin;
  const nextAal = admin.user.factors?.some(factor => factor.status === 'verified') ? 'aal2' : admin.currentAal;
  return NextResponse.json({
    authorized: true,
    mutationsEnabled: adminMutationsEnabled(),
    mfaEnforcementEnabled: adminMfaEnforcementEnabled(),
    currentAal: admin.currentAal,
    nextAal,
    anonymizationEnabled: adminMutationsEnabled() && process.env.ADMIN_ANONYMIZATION_ENABLED === 'true',
  });
}
