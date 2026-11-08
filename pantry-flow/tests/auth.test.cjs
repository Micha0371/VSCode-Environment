const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

function fixture() {
  const restored = deferred();
  let value, listener, response = { data: { session: null }, error: null };
  let signoutError = null;
  const auth = {
    getSession: () => restored.promise,
    onAuthStateChange: cb => { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    signUp: async () => response, signInWithPassword: async () => response,
    signOut: async () => ({ error: signoutError }),
  };
  const { AuthProvider, useAuth } = load('lib/auth.tsx', { './supabase': { supabase: { auth } } });
  function Consumer() { value = useAuth(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Consumer))); });
  return { restored, auth, get value() { return value; },
    response(next) { response = next; }, signoutFails() { signoutError = new Error('offline'); },
    event(session) { act(() => listener('SIGNED_IN', session)); },
    dispose() { act(() => renderer.unmount()); } };
}

test('rejected session restoration settles loading, exposes retry, and recovers', async () => {
  const f = fixture();
  await act(async () => f.restored.reject(new Error('storage unavailable')));
  assert.equal(f.value.loading, false);
  assert.equal(f.value.error, 'err_restore_session');
  f.auth.getSession = async () => ({ data: { session: null }, error: null });
  await act(async () => f.value.retrySession());
  assert.equal(f.value.error, null);
  assert.equal(f.value.loading, false);
  f.dispose();
});

test('a late restoration cannot overwrite a newer auth event', async () => {
  const f = fixture();
  const session = { user: { id: 'new-user' } };
  f.event(session);
  await act(async () => f.restored.resolve({ data: { session: null }, error: null }));
  assert.equal(f.value.user.id, 'new-user');
  assert.equal(f.value.loading, false);
  f.dispose();
});

test('signup distinguishes email confirmation from an authenticated session', async () => {
  const f = fixture();
  await act(async () => f.restored.resolve({ data: { session: null }, error: null }));
  let outcome;
  await act(async () => { outcome = await f.value.signUp('Name', 'a@example.com', 'password'); });
  assert.equal(outcome, 'confirmation_required');
  assert.equal(f.value.session, null);
  f.response({ data: { session: { user: { id: 'u' } } }, error: null });
  await act(async () => { outcome = await f.value.signUp('Name', 'a@example.com', 'password'); });
  assert.equal(outcome, 'signed_in');
  assert.equal(f.value.user.id, 'u');
  f.signoutFails();
  await act(async () => assert.rejects(f.value.signOut(), /offline/));
  assert.equal(f.value.user.id, 'u');
  f.dispose();
});

test('saved sessions restore, logout clears identity and a later login replaces it', async () => {
  const f = fixture();
  const saved = { user: { id: 'saved-user' } };
  await act(async () => f.restored.resolve({ data: { session: saved }, error: null }));
  assert.equal(f.value.user.id, 'saved-user');
  await act(async () => f.value.signOut());
  assert.equal(f.value.session, null);
  assert.equal(f.value.user, null);
  f.response({ data: { session: { user: { id: 'next-user' } } }, error: null });
  await act(async () => f.value.signIn('next@example.com', 'password'));
  assert.equal(f.value.user.id, 'next-user');
  f.dispose();
});
