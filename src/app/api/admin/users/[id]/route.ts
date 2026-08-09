import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, context: { params:Promise<{ id:string }> }) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const { id } = await context.params;
  if (!uuid.test(id)) return NextResponse.json({ error: 'Invalid user reference' }, { status: 400 });

  const [user, impact] = await Promise.all([
    admin.client.rpc('admin_get_user', { target_user_id:id }),
    admin.client.rpc('admin_preview_anonymization_impact', { target_user_id:id }),
  ]);
  if (user.error || impact.error) return adminServerError();
  const { fingerprint:impactFingerprint, ...impactPreview } = impact.data as Record<string,unknown>;
  return NextResponse.json({ user:user.data, impact:impactPreview, impactFingerprint });
}
