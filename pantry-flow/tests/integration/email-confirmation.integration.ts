import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { cleanup, emails, localStack, localUrl, password } from './local-stack';

import { callback, messages, confirmationLink, openVerification } from './confirmation-mail';

test('real local confirmation links enforce PKCE, expiry, resend and restart recovery', { timeout: 120000 }, async t => {
  const stack = localStack();
  const challenges: string[] = [];
  const client = (storage = new Map<string, string>()) => createClient(localUrl, stack.key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false,
      storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } } },
    global: { fetch: (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/signup') || url.pathname.endsWith('/resend')) {
        challenges.push(JSON.parse(String(init?.body)).code_challenge_method);
      }
      return fetch(input, { ...init, signal: AbortSignal.timeout(15000) });
    } },
  });
  await cleanup(stack.admin);
  try {
    await t.test('received link confirms identity, survives a new client and cannot be replayed', async () => {
      const storage = new Map<string, string>();
      const initial = client(storage);
      const previous = new Set((await messages()).map(m => m.ID));
      const signup = await initial.auth.signUp({ email: emails[2], password, options: { emailRedirectTo: callback } });
      assert.equal(signup.error, null);
      assert.equal(signup.data.session, null);
      const denied = await stack.client().auth.signInWithPassword({ email: emails[2], password });
      assert.ok(denied.error);
      const location = await openVerification(await confirmationLink(emails[2], previous));
      const code = location.searchParams.get('code');
      assert.ok(code);
      const restarted = client(storage);
      assert.equal((await restarted.auth.getSession()).data.session, null);
      const verified = await restarted.auth.exchangeCodeForSession(code);
      assert.equal(verified.error, null);
      assert.ok(verified.data.session);
      assert.ok(verified.data.user?.email_confirmed_at);
      const replay = await client().auth.exchangeCodeForSession(code);
      assert.ok(replay.error);
      assert.equal(replay.data.session, null);
      const restored = client(storage);
      assert.equal((await restored.auth.getSession()).data.session?.user.id, verified.data.user?.id);
      await restored.auth.signOut();
    });
    await t.test('expired link cannot authenticate; resend produces a working replacement', async () => {
      const current = client();
      let previous = new Set((await messages()).map(m => m.ID));
      const sentAt = Date.now();
      const signup = await current.auth.signUp({ email: emails[0], password, options: { emailRedirectTo: callback } });
      assert.equal(signup.error, null);
      const original = await confirmationLink(emails[0], previous);
      await delay(Math.max(0, 65000 - (Date.now() - sentAt)));
      const expired = await openVerification(original);
      assert.equal(new URLSearchParams(expired.hash.slice(1)).get('error_code'), 'otp_expired');
      assert.equal((await current.auth.getSession()).data.session, null);
      previous = new Set((await messages()).map(m => m.ID));
      const resent = await current.auth.resend({ type: 'signup', email: emails[0], options: { emailRedirectTo: callback } });
      assert.equal(resent.error, null);
      const replacement = await openVerification(await confirmationLink(emails[0], previous));
      const verified = await current.auth.exchangeCodeForSession(replacement.searchParams.get('code')!);
      assert.equal(verified.error, null);
      assert.ok(verified.data.session);
      await current.auth.signOut();
    });
    assert.ok(challenges.length >= 3);
    assert.ok(challenges.every(method => method === 's256'));
  } finally { await cleanup(stack.admin); }
});
