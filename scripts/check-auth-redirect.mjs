import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isEmailSendRateLimit, safeRedirectPath } from '../src/lib/auth.ts';

const origin = 'https://fantafort.com';
assert.equal(safeRedirectPath('/dashboard?tab=team#roster', origin), '/dashboard?tab=team#roster');
assert.equal(safeRedirectPath('//example.invalid', origin), '/dashboard');
assert.equal(safeRedirectPath(String.raw`/\example.invalid`, origin), '/dashboard');
assert.equal(safeRedirectPath('https://example.invalid', origin), '/dashboard');
assert.equal(safeRedirectPath(null, origin), '/dashboard');
assert.equal(isEmailSendRateLimit({ status: 429 }), true);
assert.equal(isEmailSendRateLimit({ code: 'over_email_send_rate_limit' }), true);
assert.equal(isEmailSendRateLimit({ status: 400, code: 'invalid_credentials' }), false);
const authPage = await readFile('src/app/auth/page.tsx', 'utf8');
assert.match(authPage, /emailRedirectTo:`\$\{window\.location\.origin\}\/auth`/);
assert.match(authPage, /params\.get\('mode'\) === 'signup'/);
assert.match(authPage, /redirectTo: `\$\{window\.location\.origin\}\/auth\?reset=1`/);
console.log('Auth checks passed.');
