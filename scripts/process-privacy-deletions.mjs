// Completes verified self-service deletion requests (see docs/admin-anonymization-recovery.md).
// Auth PII is replaced first, then complete_privacy_deletion pseudonymizes the profile;
// a failure after the Auth step is retried forward on the next run, never rolled back.
import { randomBytes, randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DAY_MS = 86400000;

export async function processPrivacyDeletions(service, { graceDays = 7, dryRun = false, userIds = null, log = console.log } = {}) {
  let query = service.from('account_privacy_requests').select('id,user_id,requested_at')
    .eq('status', 'pending').eq('request_type', 'deletion')
    .lte('requested_at', new Date(Date.now() - graceDays * DAY_MS).toISOString()).order('requested_at');
  if (userIds) query = query.in('user_id', userIds);
  const { data: requests, error } = await query;
  if (error) throw error;

  const failures = [];
  let completed = 0;
  for (const request of requests) {
    // Workflow logs of a public repository are public: identify requests by a short random ref only.
    const ref = request.id.slice(0, 8);
    const age = Math.floor((Date.now() - Date.parse(request.requested_at)) / DAY_MS);
    try {
      const authUser = await service.auth.admin.getUserById(request.user_id);
      if (authUser.error || !authUser.data.user) throw new Error('Auth user unavailable');
      const user = authUser.data.user;
      const declared = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
      const providers = [...(user.identities || []).map(identity => identity.provider), ...declared];
      if (providers.some(provider => !['email', 'phone'].includes(provider))) throw new Error('Linked identity provider requires manual review');
      if (dryRun) { log(`would complete ${ref} (${age} days old)`); continue; }

      const clearedMetadata = Object.fromEntries(Object.keys(user.user_metadata || {}).map(key => [key, null]));
      const authUpdate = await service.auth.admin.updateUserById(request.user_id, {
        email: `anonymized-${randomBytes(16).toString('hex')}@example.invalid`,
        ...(user.phone ? { phone: `+1555010${randomInt(10000).toString().padStart(4, '0')}`, phone_confirm: true } : {}),
        // Suffix satisfies the Auth policy requiring every character class.
        password: `${randomBytes(32).toString('base64url')}aA1!`,
        email_confirm: true,
        user_metadata: { ...clearedMetadata, username: 'anonymized', test_marker: 'ANONYMIZED' },
        ban_duration: '876000h',
      });
      if (authUpdate.error) throw new Error(`Auth anonymization failed: ${authUpdate.error.message}`);
      const result = await service.rpc('complete_privacy_deletion', { privacy_request_id: request.id });
      if (result.error) throw new Error(`Database anonymization failed: ${result.error.message}`);
      completed += 1;
      log(`completed ${ref} (${age} days old)`);
    } catch (failure) {
      failures.push(ref);
      log(`FAILED ${ref} (${age} days old): ${failure.message}`);
    }
  }
  log(`${requests.length} due, ${completed} completed, ${failures.length} failed${dryRun ? ' (dry run)' : ''}`);
  return { due: requests.length, completed, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  const graceDays = Number(process.env.PRIVACY_DELETION_GRACE_DAYS ?? 7);
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 21) throw new Error('PRIVACY_DELETION_GRACE_DAYS must be 0-21');
  const service = createClient(url, key, { auth: { persistSession: false } });
  const { failures } = await processPrivacyDeletions(service, { graceDays, dryRun: process.argv.includes('--dry-run') });
  if (failures.length) process.exitCode = 1;
}
