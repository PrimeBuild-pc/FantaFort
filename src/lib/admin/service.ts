import 'server-only';

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function adminServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });
}

export async function recordAdminFailure(actorId:string, action:string, targetId:string, reason:string, errorCode:string) {
  const service = adminServiceClient();
  if (!service) return;
  await service.from('admin_audit_log').insert({
    actor_user_id:actorId, action, target_type:'user', target_id:targetId, reason,
    request_id:randomUUID(), outcome:'failed', error_code:errorCode,
  });
}
