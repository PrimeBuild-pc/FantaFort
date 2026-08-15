import { NextRequest, NextResponse } from 'next/server';
import { adminServerError, authorizeAdmin } from '@/lib/admin/server';

const TIERS = ['elite', 'contender', 'regional', 'open'];

export async function GET(request:NextRequest) {
  const admin = await authorizeAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const params = request.nextUrl.searchParams;
  const search = params.get('search')?.trim() || null;
  const tier = params.get('tier');
  const activeParam = params.get('active');
  const page = Math.max(1, Number(params.get('page')) || 1);
  if (tier && !TIERS.includes(tier)) return NextResponse.json({ error:'Invalid tier filter' }, { status:400 });
  if (activeParam && activeParam !== 'true' && activeParam !== 'false') return NextResponse.json({ error:'Invalid active filter' }, { status:400 });

  const pageSize = 25;
  const result = await admin.client.rpc('admin_list_market_players', {
    search, tier_filter: tier || null, active_filter: activeParam == null ? null : activeParam === 'true',
    page_limit: pageSize, page_offset: (page - 1) * pageSize,
  });
  if (result.error) return adminServerError();
  const rows = (result.data || []) as Record<string, unknown>[];
  return NextResponse.json({ players: rows, total: Number(rows[0]?.total_count || 0), page, pageSize });
}
