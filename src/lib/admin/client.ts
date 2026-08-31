import { supabase } from '@/lib/supabase';

export async function adminFetch(input: string, init: RequestInit = {}) {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${data.session.access_token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(input, { ...init, headers });
  if (response.status === 403 && (init.method || 'GET').toUpperCase() === 'GET'
    && typeof window !== 'undefined' && window.location.pathname !== '/admin') {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/admin?next=${encodeURIComponent(next)}`);
  }
  return response;
}

export async function adminStepUp(scope:'role'|'economy'|'recovery'|'anonymize'|'account_status'|'session_revoke'|'badge', code:string, targetId?:string, targetIds?:string[]) {
  if (!supabase || !/^\d{6}$/.test(code)) return null;
  const factors = await supabase.auth.mfa.listFactors();
  const factor = factors.data?.totp.find(item => item.status === 'verified');
  if (!factor) return null;
  const response = await adminFetch('/api/admin/step-up', {
    // targetIds mints one grant bound to the whole set; targetId keeps the single-target path.
    method:'POST', body:JSON.stringify(targetIds ? { factorId:factor.id, code, scope, targetIds } : { factorId:factor.id, code, scope, targetId }),
  });
  if (!response?.ok) return null;
  const result = await response.json() as { stepUpToken:string; accessToken:string; refreshToken:string };
  const session = await supabase.auth.setSession({ access_token:result.accessToken, refresh_token:result.refreshToken });
  return session.error ? null : result.stepUpToken;
}
