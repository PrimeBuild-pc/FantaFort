import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const app = process.env.FANTAFORT_STAGING_URL || 'https://fantafort-staging.vercel.app';
if (!url || !anon || !service || new URL(url).hostname !== 'ibatqfmefkekbsvuterp.supabase.co' || process.env.FANTAFORT_TEST_ENV !== 'isolated') throw new Error('Staging-only configuration required');

const admin = createClient(url, service, { auth:{ persistSession:false, autoRefreshToken:false } });
const users = [];
const ok = result => { if (result.error) throw result.error; return result.data; };
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32 = value => {
  let bits = ''; const bytes = [];
  for (const character of value.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
};
const totp = (secret, time = Date.now()) => {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(time / 30_000)));
  const digest = createHmac('sha1', base32(secret)).update(counter).digest(); const offset = digest.at(-1) & 15;
  return String((((digest[offset] & 127) << 24) | digest[offset + 1] << 16 | digest[offset + 2] << 8 | digest[offset + 3]) % 1_000_000).padStart(6, '0');
};
const makeUser = async label => {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `security-${label}-${suffix}@example.com`;
  const created = ok(await admin.auth.admin.createUser({ email, email_confirm:true, user_metadata:{ username:`sec_${label}_${suffix.slice(-8)}`, test_marker:'SECURITY_RETEST' } }));
  users.push(created.user.id);
  const link = ok(await admin.auth.admin.generateLink({ type:'magiclink', email }));
  const client = createClient(url, anon, { auth:{ persistSession:false, autoRefreshToken:false } });
  ok(await client.auth.verifyOtp({ type:'magiclink', token_hash:link.properties.hashed_token }));
  return client;
};
const status = async (path, init = {}) => {
  const response = await fetch(`${app}${path}`, { redirect:'manual', ...init });
  return { status:response.status, text:await response.text(), headers:response.headers };
};

try {
  const first = await makeUser('a');
  const second = await makeUser('b');
  const secondId = users[1];
  await admin.from('profiles').update({ created_at:new Date(Date.now() - 8 * 86_400_000).toISOString() }).in('id', users);

  const secondWallet = ok(await admin.from('account_wallets').select('balance').eq('user_id', secondId).single()).balance;
  assert.equal(ok(await first.from('account_wallets').select('user_id,balance').eq('user_id', secondId)).length, 0);
  await first.from('account_wallets').update({ balance:999_999 }).eq('user_id', secondId);
  assert.equal(ok(await admin.from('account_wallets').select('balance').eq('user_id', secondId).single()).balance, secondWallet);
  await first.from('profiles').update({ is_admin:true, account_status:'active' }).eq('id', secondId);
  assert.equal(ok(await admin.from('profiles').select('is_admin').eq('id', secondId).single()).is_admin, false);
  assert.ok((await first.rpc('get_admin_overview')).error);
  assert.ok((await first.rpc('authorize_admin_request')).error);

  const runtime = ok(await admin.from('admin_runtime_config').select('mutations_enabled').eq('singleton', true).single());
  assert.equal(runtime.mutations_enabled, false);
  assert.ok((await first.from('admin_runtime_config').update({ mutations_enabled:true }).eq('singleton', true)).error);
  assert.ok((await first.rpc('create_admin_step_up_grant', { grant_token_hash:createHash('sha256').update(randomUUID()).digest('hex'), grant_scope:'account_status', grant_target_user_id:secondId })).error);

  const session = ok(await first.auth.getSession()).session;
  const bearer = { Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' };
  for (const path of ['/api/admin/session', '/api/admin/users', '/api/admin/overview', '/api/admin/audit']) assert.ok([403, 404].includes((await status(path, { headers:bearer })).status));
  const action = JSON.stringify({ reason:'Synthetic authorization denial', requestId:randomUUID(), idempotencyKey:`security-${randomUUID()}` });
  for (const origin of [app, 'https://example.invalid']) assert.ok([403, 404].includes((await status(`/api/admin/users/${secondId}/suspend`, { method:'POST', headers:{ ...bearer, Origin:origin }, body:action })).status));

  const factor = ok(await first.auth.mfa.enroll({ factorType:'totp', friendlyName:'security-retest' }));
  const serverTime = Date.parse((await fetch(`${url}/auth/v1/settings`, { headers:{ apikey:anon } })).headers.get('date') || '') || Date.now();
  const verified = ok(await first.auth.mfa.challengeAndVerify({ factorId:factor.id, code:totp(factor.totp.secret, serverTime) }));
  ok(await first.auth.setSession({ access_token:verified.access_token, refresh_token:verified.refresh_token }));
  assert.equal(ok(await first.auth.mfa.getAuthenticatorAssuranceLevel()).currentLevel, 'aal2');
  assert.ok((await first.rpc('authorize_admin_request')).error);
  assert.ok((await first.rpc('create_admin_step_up_grant', { grant_token_hash:createHash('sha256').update(randomUUID()).digest('hex'), grant_scope:'account_status', grant_target_user_id:secondId })).error);

  const refreshed = ok(await first.auth.refreshSession()).session;
  assert.ok(refreshed?.access_token);
  const oldToken = ok(await second.auth.getSession()).session.access_token;
  const stale = createClient(url, anon, { auth:{ persistSession:false, autoRefreshToken:false }, global:{ headers:{ Authorization:`Bearer ${oldToken}` } } });
  ok(await second.auth.signOut({ scope:'global' }));
  assert.ok((await stale.rpc('get_account_portfolio')).error, 'Revoked session retained Data API access');

  for (const path of ['/', '/players']) assert.equal((await status(path)).status, 200);
  assert.equal((await status('/api/admin/session')).status, 403);
  assert.equal((await status('/api/fortnite/leaderboard?eventId=%2Fbad&windowId=x&page=0&matchCap=0')).status, 400);
  for (const path of ['/.env', '/.git/config', '/api/v1/admin']) assert.notEqual((await status(path)).status, 200);
  const authRedirect = await status('/auth?next=https://example.invalid');
  assert.equal(authRedirect.status, 200);
  assert.ok(authRedirect.headers.get('content-security-policy'));
  assert.doesNotMatch(authRedirect.text, /SUPABASE_(?:SECRET|SERVICE_ROLE|JWT_SECRET)|POSTGRES_PASSWORD|PAYPAL_CLIENT_SECRET/);

  console.log('Authenticated staging session, horizontal access, RLS, admin, AAL2, revocation, origin, public/error and exposure checks passed.');
} finally {
  if (users.length) {
    await admin.from('profiles').update({ is_admin:false, account_status:'suspended' }).in('id', users);
    for (const id of users) await admin.auth.admin.updateUserById(id, { ban_duration:'876000h', user_metadata:{ test_marker:'SECURITY_RETEST_RETIRED' } });
  }
}
