import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getVerifiedAal } from '../src/lib/admin/jwt.ts';

const supabaseUrl = 'https://admin-jwt-test.supabase.co';
const issuer = `${supabaseUrl}/auth/v1`;
const encoder = new TextEncoder();
const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const keys = await crypto.subtle.generateKey({
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}, true, ['sign', 'verify']);
const publicKey = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), alg: 'RS256', kid: 'admin-test-key', use: 'sig' };

async function sign(overrides = {}) {
  const header = encode({ alg: 'RS256', kid: publicKey.kid, typ: 'JWT' });
  const payload = encode({
    iss: issuer,
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60,
    iat: Math.floor(Date.now() / 1000),
    sub: randomUUID(),
    role: 'authenticated',
    aal: 'aal1',
    ...overrides,
  });
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, encoder.encode(input));
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

const client = createClient(supabaseUrl, 'test-anon-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: async input => {
      if (new URL(typeof input === 'string' ? input : input.url).pathname === '/auth/v1/.well-known/jwks.json') {
        return Response.json({ keys: [publicKey] });
      }
      throw new Error('Unexpected network request');
    },
  },
});

const aal1 = await sign();
assert.equal(await getVerifiedAal(client, aal1, supabaseUrl), 'aal1');
assert.equal(await getVerifiedAal(client, await sign({ aal: 'aal2' }), supabaseUrl), 'aal2');

const [header, payload, signature] = aal1.split('.');
const alteredPayload = encode({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), aal: 'aal2' });
assert.equal(await getVerifiedAal(client, `${header}.${alteredPayload}.${signature}`, supabaseUrl), null, 'altered signature accepted');
assert.equal(await getVerifiedAal(client, await sign({ exp: Math.floor(Date.now() / 1000) - 1 }), supabaseUrl), null, 'expired token accepted');
assert.equal(await getVerifiedAal(client, await sign({ iss: 'https://attacker.example/auth/v1' }), supabaseUrl), null, 'forged issuer accepted');
assert.equal(await getVerifiedAal(client, await sign({ aud: 'attacker' }), supabaseUrl), null, 'forged audience accepted');

console.log('Verified admin JWT AAL checks passed.');
