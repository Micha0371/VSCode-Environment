const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { load, deferred } = require('./helpers.cjs');

function fixture() {
  const exchange = deferred();
  const sent = deferred();
  const calls = { exchange: [], resend: [] };
  let session = null;
  const service = load('lib/email-confirmation.ts', {
    'expo-linking': { createURL: path => `pantryflow://${path}` },
    './native-auth-crypto': { assertSecurePkce() {} },
    './supabase': { supabase: { auth: {
      getSession: async () => ({ data: { session }, error: null }),
      exchangeCodeForSession: code => { calls.exchange.push(code); return exchange.promise; },
      resend: request => { calls.resend.push(request); return sent.promise; },
    } } },
  });
  return { service, calls, exchange, sent, signIn() { session = { user: { id: 'existing' } }; } };
}

test('confirmation rejects missing, ambiguous, malformed and error links without exchanging credentials', async () => {
  const f = fixture();
  for (const params of [{}, { code: ['one', 'two'] }, { code: 'a\nb' }, { code: 'x'.repeat(2049) }, { code: 'valid', error_code: 'otp_expired' }]) {
    assert.equal(f.service.confirmationCode(params), null);
    await assert.rejects(f.service.confirmEmail(params));
  }
  assert.deepEqual(f.calls.exchange, []);
});

test('confirmation coalesces duplicate active callbacks and requires an actual authenticated session', async () => {
  const f = fixture();
  const first = f.service.confirmEmail({ code: 'auth-code' });
  const second = f.service.confirmEmail({ code: 'auth-code' });
  assert.equal(first, second);
  await Promise.resolve();
  assert.deepEqual(f.calls.exchange, ['auth-code']);
  f.exchange.resolve({ data: { session: { user: { id: 'confirmed' } } }, error: null });
  await first;
  const missing = fixture();
  const attempt = missing.service.confirmEmail({ code: 'other-code' });
  missing.exchange.resolve({ data: { session: null }, error: null });
  await assert.rejects(attempt, /no session/);
});

test('expired codes remain recoverable and a callback cannot replace an already signed-in account', async () => {
  const f = fixture();
  const attempt = f.service.confirmEmail({ code: 'expired' });
  f.exchange.resolve({ data: { session: null }, error: new Error('expired') });
  await assert.rejects(attempt, /expired/);
  const signedIn = fixture();
  signedIn.signIn();
  await assert.rejects(signedIn.service.confirmEmail({ code: 'attacker-code' }), /Already signed in/);
  assert.deepEqual(signedIn.calls.exchange, []);
});

test('resend validates the address, prevents overlap, uses the app callback and unlocks after rejection', async () => {
  const f = fixture();
  await assert.rejects(f.service.resendConfirmation('not-an-address'));
  assert.deepEqual(f.calls.resend, []);
  const request = f.service.resendConfirmation(' alice@example.com ');
  await assert.rejects(f.service.resendConfirmation('bob@example.com'), /already running/);
  assert.deepEqual(f.calls.resend, [{ type: 'signup', email: 'alice@example.com', options: { emailRedirectTo: 'pantryflow://auth/callback' } }]);
  f.sent.resolve({ error: new Error('offline') });
  await assert.rejects(request, /offline/);
  await assert.rejects(f.service.resendConfirmation('alice@example.com'), /offline/);
  assert.equal(f.calls.resend.length, 2);
});

test('native PKCE adapter delegates secure randomness and SHA-256 without replacing browser crypto', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    const crypto = load('lib/native-auth-crypto.ts', {
      'react-native': { Platform: { OS: 'android' } },
      'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
        getRandomValues: values => webcrypto.getRandomValues(values),
        digest: (algorithm, bytes) => webcrypto.subtle.digest(algorithm, bytes),
      },
    });
    crypto.assertSecurePkce();
    const input = new TextEncoder().encode('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
    assert.equal(Buffer.from(digest).toString('base64url'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    assert.notDeepEqual(globalThis.crypto.getRandomValues(new Uint32Array(8)), new Uint32Array(8));
    await assert.rejects(globalThis.crypto.subtle.digest('MD5', input), /only supports SHA-256/);
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    crypto.installNativeAuthCrypto();
    assert.equal(globalThis.crypto, webcrypto);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});
