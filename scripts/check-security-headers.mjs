import assert from 'node:assert/strict';
import nextConfig from '../next.config.ts';

const rules = await nextConfig.headers();
const catchAll = rules.find(rule => rule.source === '/(.*)');
assert.ok(catchAll, 'Catch-all security headers missing');
const headers = Object.fromEntries(catchAll.headers.map(({ key, value }) => [key.toLowerCase(), value]));
const enforced = headers['content-security-policy'];
const reportOnly = headers['content-security-policy-report-only'];
for (const value of [enforced, reportOnly]) {
  assert.ok(value.includes("default-src 'self'"));
  assert.ok(value.includes("script-src-attr 'none'"));
  assert.ok(value.includes('https://challenges.cloudflare.com'));
  assert.ok(!value.includes('*.supabase.co'));
}
assert.match(enforced, /script-src [^;]*'unsafe-inline'/);
assert.match(enforced, /style-src 'self' https:\/\/fonts\.googleapis\.com;/);
assert.match(enforced, /style-src-attr 'unsafe-inline'/);
assert.doesNotMatch(reportOnly, /'unsafe-inline'/);
for (const key of ['strict-transport-security', 'referrer-policy', 'permissions-policy', 'x-content-type-options', 'x-frame-options', 'cross-origin-opener-policy']) assert.ok(headers[key]);

const urlArg = process.argv.find(arg => arg.startsWith('--url='));
if (urlArg) {
  const response = await fetch(new URL(urlArg.slice(6)));
  assert.equal(response.status, 200);
  for (const key of ['content-security-policy', 'content-security-policy-report-only', 'strict-transport-security', 'x-content-type-options']) assert.ok(response.headers.get(key), `${key} missing from deployment`);
  assert.match(response.headers.get('content-security-policy'), /script-src-attr 'none'/);
  assert.doesNotMatch(response.headers.get('content-security-policy-report-only'), /'unsafe-inline'/);
}
console.log('CSP enforcement/report-only and HTTP security header checks passed.');
