import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const walk = async directory => {
  const entries = await readdir(directory, { withFileTypes:true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
};

const sourceFiles = (await walk('src')).filter(file => /\.(ts|tsx)$/.test(file));
for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  if (content.startsWith('"use client"')
    && (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('SUPABASE_SECRET_KEY'))) {
    throw new Error('Server Supabase key reference found in client code');
  }
}

const adminPage = await readFile('src/app/admin/page.tsx', 'utf8');
if (adminPage.includes("rpc('get_admin_")) throw new Error('Admin page bypasses the server API');
for (const expected of ['auth.mfa.enroll', 'auth.mfa.challengeAndVerify', "currentAal !== 'aal2'"]) {
  if (!adminPage.includes(expected)) throw new Error('Admin MFA enrollment path is incomplete');
}

const server = await readFile('src/lib/admin/server.ts', 'utf8');
for (const expected of ['getVerifiedAal', 'auth.getUser', "'authorize_admin_step_up_request'", "ADMIN_MUTATIONS_ENABLED === 'true'", "NODE_ENV !== 'production'", "ADMIN_MFA_ENFORCEMENT_ENABLED === 'false'", 'origin !== request.nextUrl.origin']) {
  if (!server.includes(expected)) throw new Error('Admin server guard is incomplete');
}
const service = await readFile('src/lib/admin/service.ts', 'utf8');
for (const expected of ['recordAdminFailure', "outcome:'failed'", 'error_code:errorCode']) {
  if (!service.includes(expected)) throw new Error('External admin failure audit is incomplete');
}

const recoveryRoute = await readFile('src/app/api/admin/users/[id]/recovery/route.ts', 'utf8');
for (const expected of ["currentAal !== 'aal2'", "admin_authorize_recovery_attempt", "resetPasswordForEmail", "{ accepted:true }"]) {
  if (!recoveryRoute.includes(expected)) throw new Error('Admin recovery guard is incomplete');
}
if (recoveryRoute.includes('generateLink') || recoveryRoute.includes('action_link')) {
  throw new Error('Admin recovery must not generate or expose links');
}
const suspensionMigration = await readFile('supabase/migrations/202607190005_admin_suspension_sessions.sql', 'utf8');
for (const expected of ["consume_admin_step_up_grant(step_up_token_hash, 'recovery')", ">= 3", ">= 20", 'delete from auth.sessions']) {
  if (!suspensionMigration.includes(expected)) throw new Error('Admin recovery/session database guard is incomplete');
}
const reactivateRoute = await readFile('src/app/api/admin/users/[id]/reactivate/route.ts', 'utf8');
for (const expected of ['admin_step_up_grants', "eq('scope','account_status')", "eq('target_user_id',id)", "is('used_at',null)"]) {
  if (!reactivateRoute.includes(expected)) throw new Error('Admin reactivation grant guard is incomplete');
}

const routeFiles = (await walk('src/app/api/admin')).filter(file => file.endsWith('route.ts'));
if (!routeFiles.length) throw new Error('Admin API routes are missing');
for (const file of routeFiles) {
  const content = await readFile(file, 'utf8');
  if (!content.includes('authorizeAdmin') && !content.includes('prepareAdminMutation')) throw new Error('Admin API route lacks authorization');
  if (content.includes('export async function POST')
    && !content.includes('prepareAdminMutation')
    && (!content.includes('adminMutationsEnabled()') || !content.includes('rejectCrossOriginMutation'))) {
    throw new Error('Mutative admin route lacks fail-closed and origin guards');
  }
}

const migrationFiles = (await readdir('supabase/migrations')).filter(file => file.startsWith('20260719'));
const adminMigrations = (await Promise.all(migrationFiles.map(file => readFile(join('supabase/migrations', file), 'utf8')))).join('\n');
if (/drop\s+index(?:\s+if\s+exists)?\s+(?:public\.)?profiles_single_admin/i.test(adminMigrations)) {
  throw new Error('profiles_single_admin must remain in place');
}
const roleMigration = await readFile('supabase/migrations/202607190006_admin_roles.sql', 'utf8');
for (const expected of ['target_user_id = auth.uid()', 'Additional administrators are not enabled', 'The last administrator cannot be removed']) {
  if (!roleMigration.includes(expected)) throw new Error('Admin role guard is incomplete');
}
const economyMigration = await readFile('supabase/migrations/202607190007_admin_economy.sql', 'utf8');
for (const expected of ['> 100000', '> 10000', '> 50000', 'action_payload_fingerprint', 'Self balance changes are not allowed', "'economy.adjust_wallet'"]) {
  if (!economyMigration.includes(expected)) throw new Error('Admin economy guard is incomplete');
}
const walletRoute = await readFile('src/app/api/admin/users/[id]/wallet/route.ts', 'utf8');
if (!walletRoute.includes('> 10000') || !walletRoute.includes('payloadFingerprint')) {
  throw new Error('Admin wallet route limits are incomplete');
}
const anonymizationRoute = await readFile('src/app/api/admin/users/[id]/anonymize/route.ts', 'utf8');
for (const expected of ["ADMIN_ANONYMIZATION_ENABLED !== 'true'", "currentAal !== 'aal2'", 'impactFingerprint', 'confirmed_target_id',
  'recordAdminFailure', 'admin_step_up_grants', 'getClaims(admin.accessToken)', 'declaredProviders', 'clearedMetadata']) {
  if (!anonymizationRoute.includes(expected)) throw new Error('Admin anonymization route is incomplete');
}
const anonymizationMigration = await readFile('supabase/migrations/202607190008_admin_anonymization.sql', 'utf8');
for (const expected of ["auth.jwt() ->> 'aal' is distinct from 'aal2'", 'confirmed_target_id is distinct from subject_id', 'admin_preview_anonymization_impact', "consume_admin_step_up_grant(step_up_token_hash, 'anonymize')", "impact - 'fingerprint'"]) {
  if (!anonymizationMigration.includes(expected)) throw new Error('Admin anonymization database guard is incomplete');
}
if (/delete\s+from\s+(?:public\.)?(?:profiles|wallet_transactions|admin_audit_log)/i.test(anonymizationMigration)) {
  throw new Error('Anonymization must preserve profiles, ledger and audit');
}
const auditMigration = await readFile('supabase/migrations/202607190009_admin_audit_overview.sql', 'utf8');
for (const expected of ['redact_admin_json', 'admin_log_ref', 'search_filter', 'target_ref_filter', 'actor_username_filter',
  'created_from_filter', 'created_to_filter', "set statement_timeout = '3s'", 'page_index not between 0 and 1000']) {
  if (!auditMigration.includes(expected)) throw new Error('Admin audit reader is incomplete');
}
const auditRoute = await readFile('src/app/api/admin/audit/route.ts', 'utf8');
for (const expected of ['AbortSignal.timeout(4000)', 'target_ref_filter', 'actor_username_filter', 'created_from_filter', 'created_to_filter']) {
  if (!auditRoute.includes(expected)) throw new Error('Admin audit API bounds are incomplete');
}
const overviewRoute = await readFile('src/app/api/admin/overview/route.ts', 'utf8');
if (overviewRoute.includes('fetch(') || overviewRoute.includes('searchParams') || !overviewRoute.includes('AbortSignal.timeout(4000)')) {
  throw new Error('Admin health checks must remain internal and bounded');
}
const privacyMigration = await readFile('supabase/migrations/202607250001_privacy_requests.sql', 'utf8');
for (const expected of ['request_account_deletion', "account_status = 'suspended'", 'delete from auth.sessions', 'account_privacy_requests_one_pending', 'profiles_resolve_privacy_request']) {
  if (!privacyMigration.includes(expected)) throw new Error('Privacy request guard is incomplete');
}
const accountPage = await readFile('src/app/account/page.tsx', 'utf8');
if (!accountPage.includes("rpc('request_account_deletion'") || accountPage.includes("rpc('delete_account'")) {
  throw new Error('Account deletion UI bypasses the reviewed request flow');
}

const nextConfig = await readFile('next.config.ts', 'utf8');
for (const expected of ['Strict-Transport-Security', "source: '/api/admin/:path*'", 'private, no-store, max-age=0', 'supabaseSocketOrigin']) {
  if (!nextConfig.includes(expected)) throw new Error('HTTP security headers are incomplete');
}
if (nextConfig.includes('https://*.supabase.co') || nextConfig.includes('wss://*.supabase.co')) {
  throw new Error('CSP connect-src must not trust every Supabase project');
}
const remediation = await readFile('supabase/migrations/202608080001_security_audit_remediation.sql', 'utf8');
for (const expected of [
  'authorize_admin_step_up_request', "auth.jwt() ->> 'aal' is distinct from 'aal2'",
  "consume_admin_step_up_grant(step_up_token_hash, 'account_status', target_user_id)",
  "consume_admin_step_up_grant(step_up_token_hash, 'session_revoke', target_user_id)",
  'drop function public.admin_set_account_status(uuid,text,text,uuid,text)',
  'drop function public.admin_revoke_user_sessions(uuid,text,uuid,text)',
  'user_id = auth.uid()', "'^[A-F0-9]{16}$'", 'league_invite_preview_attempts',
  'sandbox_top_up_ledger', 'Daily sandbox top-up limit reached', 'drop function public.mock_top_up(integer)',
]) {
  if (!remediation.includes(expected)) throw new Error('Security audit remediation migration is incomplete');
}

// Keep this dependency-free check runnable in CI and isolated from any Supabase project.
console.log('Admin authorization static checks passed.');
