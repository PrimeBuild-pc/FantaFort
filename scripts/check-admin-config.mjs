import assert from 'node:assert/strict';
import { parseAdminRuntimeConfig } from '../src/lib/admin/config.ts';

const parse = overrides => parseAdminRuntimeConfig({ NODE_ENV:'development', ...overrides });

assert.deepEqual(parse({}), {
  mutationsEnabled:false, badgeMutationsEnabled:false, playerPoolMutationsEnabled:false, resultsImportEnabled:false, anonymizationEnabled:false, mfaEnforcementEnabled:true, serverKeyConfigured:false,
});
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'false', ADMIN_ANONYMIZATION_ENABLED:'false', ADMIN_MFA_ENFORCEMENT_ENABLED:'false' }).mutationsEnabled, false);
assert.equal(parse({ ADMIN_MFA_ENFORCEMENT_ENABLED:'false' }).mfaEnforcementEnabled, false);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'TRUE', ADMIN_ANONYMIZATION_ENABLED:'yes', ADMIN_MFA_ENFORCEMENT_ENABLED:'0' }).mfaEnforcementEnabled, true);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'true' }).mutationsEnabled, false);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'true', SUPABASE_SECRET_KEY:'   ' }).mutationsEnabled, false);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'true', SUPABASE_SECRET_KEY:'test-placeholder' }).mutationsEnabled, true);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'true', SUPABASE_SERVICE_ROLE_KEY:'test-placeholder' }).mutationsEnabled, true);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'true', ADMIN_ANONYMIZATION_ENABLED:'true', SUPABASE_SECRET_KEY:'test-placeholder' }).anonymizationEnabled, true);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'false', ADMIN_ANONYMIZATION_ENABLED:'true', SUPABASE_SECRET_KEY:'test-placeholder' }).anonymizationEnabled, false);
assert.equal(parseAdminRuntimeConfig({ NODE_ENV:'production', ADMIN_MFA_ENFORCEMENT_ENABLED:'false' }).mfaEnforcementEnabled, true);
assert.equal(parseAdminRuntimeConfig({ NODE_ENV:'production', ADMIN_MFA_ENFORCEMENT_ENABLED:'invalid' }).mfaEnforcementEnabled, true);

// Badge administration is an independent, fail-closed capability.
assert.equal(parse({}).badgeMutationsEnabled, false);
assert.equal(parse({ ADMIN_BADGE_MUTATIONS_ENABLED:'false' }).badgeMutationsEnabled, false);
assert.equal(parse({ ADMIN_BADGE_MUTATIONS_ENABLED:'TRUE' }).badgeMutationsEnabled, false);
assert.equal(parse({ ADMIN_BADGE_MUTATIONS_ENABLED:'1' }).badgeMutationsEnabled, false);
assert.equal(parse({ ADMIN_BADGE_MUTATIONS_ENABLED:'true' }).badgeMutationsEnabled, true);
// Enabling badges must not enable anything else...
const badgeOnly = parse({ ADMIN_BADGE_MUTATIONS_ENABLED:'true', ADMIN_ANONYMIZATION_ENABLED:'true', SUPABASE_SECRET_KEY:'test-placeholder' });
assert.equal(badgeOnly.mutationsEnabled, false);
assert.equal(badgeOnly.anonymizationEnabled, false);
// ...and enabling everything else must not enable badges.
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'true', ADMIN_ANONYMIZATION_ENABLED:'true', SUPABASE_SECRET_KEY:'test-placeholder' }).badgeMutationsEnabled, false);

// Promoting a player is its own capability, on the same terms as badges: exact-'true'
// only, and neither implied by nor implying any other switch in either direction.
assert.equal(parse({}).playerPoolMutationsEnabled, false);
for (const value of ['false', 'TRUE', '1', 'yes', '']) {
  assert.equal(parse({ ADMIN_PLAYER_POOL_MUTATIONS_ENABLED:value }).playerPoolMutationsEnabled, false);
}
assert.equal(parse({ ADMIN_PLAYER_POOL_MUTATIONS_ENABLED:'true' }).playerPoolMutationsEnabled, true);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'true', SUPABASE_SECRET_KEY:'test-placeholder' }).playerPoolMutationsEnabled, false);
assert.equal(parse({ ADMIN_BADGE_MUTATIONS_ENABLED:'true' }).playerPoolMutationsEnabled, false);
assert.equal(parse({ ADMIN_PLAYER_POOL_MUTATIONS_ENABLED:'true' }).mutationsEnabled, false);
assert.equal(parse({ ADMIN_PLAYER_POOL_MUTATIONS_ENABLED:'true' }).badgeMutationsEnabled, false);
assert.equal(parse({ ADMIN_PLAYER_POOL_MUTATIONS_ENABLED:'true' }).anonymizationEnabled, false);

// Importing tournament results is its own capability too, same terms as player-pool.
assert.equal(parse({}).resultsImportEnabled, false);
for (const value of ['false', 'TRUE', '1', 'yes', '']) {
  assert.equal(parse({ ADMIN_RESULTS_IMPORT_ENABLED:value }).resultsImportEnabled, false);
}
assert.equal(parse({ ADMIN_RESULTS_IMPORT_ENABLED:'true' }).resultsImportEnabled, true);
assert.equal(parse({ ADMIN_MUTATIONS_ENABLED:'true', SUPABASE_SECRET_KEY:'test-placeholder' }).resultsImportEnabled, false);
assert.equal(parse({ ADMIN_PLAYER_POOL_MUTATIONS_ENABLED:'true' }).resultsImportEnabled, false);
assert.equal(parse({ ADMIN_RESULTS_IMPORT_ENABLED:'true' }).mutationsEnabled, false);
assert.equal(parse({ ADMIN_RESULTS_IMPORT_ENABLED:'true' }).playerPoolMutationsEnabled, false);
assert.equal(parse({ ADMIN_RESULTS_IMPORT_ENABLED:'true' }).anonymizationEnabled, false);

console.log('Admin environment fail-closed checks passed.');
