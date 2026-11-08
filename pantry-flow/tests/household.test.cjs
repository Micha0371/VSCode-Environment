const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

test('household lookup rejects stale identities and exposes a retry after network failure', async () => {
  let user = { id: 'alice' }, value;
  const requests = [];
  const supabase = { from() { return { select() { return this; }, eq() { return this; },
    single() { const d = deferred(); requests.push(d); return d.promise; } }; } };
  const { useHousehold } = load('hooks/useHousehold.ts', {
    '@/lib/supabase': { supabase }, '@/lib/auth': { useAuth: () => ({ user }) },
  });
  function Consumer() { value = useHousehold(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(Consumer)); });
  user = { id: 'bob' };
  act(() => renderer.update(React.createElement(Consumer)));
  await act(async () => requests[0].resolve({ data: { household_id: 'alice-home' }, error: null }));
  assert.equal(value.householdId, null);
  await act(async () => requests[1].reject(new Error('offline')));
  assert.equal(value.loading, false);
  assert.equal(value.error, 'err_no_household');
  let retry;
  act(() => { retry = value.refreshHousehold(); });
  await act(async () => {
    requests[2].resolve({ data: { household_id: 'bob-home' }, error: null });
    await retry;
  });
  assert.equal(value.householdId, 'bob-home');
  assert.equal(value.error, null);
  user = null;
  act(() => renderer.update(React.createElement(Consumer)));
  assert.equal(value.householdId, null);
  act(() => renderer.unmount());
});
