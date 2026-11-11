const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

function setup(initialUser = { id: 'alice' }) {
  const state = { user: initialUser };
  const requests = [];
  const calls = [];
  const supabase = { from(table) { calls.push(table); return { select() { return this; }, eq() { return this; },
    single() { const d = deferred(); requests.push(d); return d.promise; } }; } };
  const stubs = { '@/lib/supabase': { supabase }, '@/lib/auth': { useAuth: () => ({ user: state.user }) } };
  // household-scope imports ./useHousehold, which is TS and must be compiled by load too.
  const useHouseholdModule = load('hooks/useHousehold.ts', stubs);
  const scope = load('hooks/household-scope.tsx', { ...stubs, './useHousehold': useHouseholdModule });
  return { state, requests, calls, stubs, scope };
}

test('one lookup is shared by every consumer under HouseholdProvider', async () => {
  const { requests, calls, scope } = setup();
  let a, b;
  function One() { a = scope.useHouseholdScope(); return null; }
  function Two() { b = scope.useHouseholdScope(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(scope.HouseholdProvider, null,
    React.createElement(One), React.createElement(Two))); });
  await act(async () => requests[0].resolve({ data: { household_id: 'h1' }, error: null }));
  assert.equal(calls.filter(t => t === 'pantry_household_members').length, 1);
  assert.equal(a.householdId, 'h1'); assert.equal(b.householdId, 'h1');
  assert.equal(a.loading, false); assert.equal(b.loading, false);
  act(() => renderer.unmount());
});

test('a user change re-keys the scope and old results cannot leak', async () => {
  const { state, requests, scope } = setup({ id: 'alice' });
  let value;
  function Consumer() { value = scope.useHouseholdScope(); return null; }
  const tree = () => React.createElement(scope.HouseholdProvider, null, React.createElement(Consumer));
  let renderer;
  act(() => { renderer = create(tree()); });
  state.user = { id: 'bob' };
  act(() => renderer.update(tree()));
  await act(async () => requests[0].resolve({ data: { household_id: 'alice-home' }, error: null }));
  assert.equal(value.householdId, null);
  await act(async () => requests[1].resolve({ data: { household_id: 'bob-home' }, error: null }));
  assert.equal(value.householdId, 'bob-home');
  act(() => renderer.unmount());
});

test('a failed lookup exposes err_no_household and one refresh recovers all consumers', async () => {
  const { requests, scope } = setup();
  let a, b;
  function One() { a = scope.useHouseholdScope(); return null; }
  function Two() { b = scope.useHouseholdScope(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(scope.HouseholdProvider, null,
    React.createElement(One), React.createElement(Two))); });
  await act(async () => requests[0].reject(new Error('offline')));
  assert.equal(a.error, 'err_no_household'); assert.equal(b.error, 'err_no_household');
  let retry;
  act(() => { retry = a.refreshHousehold(); });
  await act(async () => {
    requests[1].resolve({ data: { household_id: 'h2' }, error: null });
    await retry;
  });
  assert.equal(requests.length, 2);
  assert.equal(a.householdId, 'h2'); assert.equal(b.householdId, 'h2');
  assert.equal(a.error, null); assert.equal(b.error, null);
  act(() => renderer.unmount());
});

test('useHouseholdScope outside HouseholdProvider throws', () => {
  const { scope } = setup();
  function Consumer() { scope.useHouseholdScope(); return null; }
  const original = console.error;
  console.error = () => {};
  try {
    assert.throws(() => act(() => { create(React.createElement(Consumer)); }),
      /useHouseholdScope must be used within HouseholdProvider/);
  } finally { console.error = original; }
});

test('PantryProvider consumes the shared scope', async () => {
  const { requests, calls, stubs, scope } = setup();
  const reads = [];
  const data = load('lib/pantry-data.ts', { './constants': load('lib/constants.ts'), './pagination': load('lib/pagination.ts') });
  const fetchAllItems = (_client, householdId) => { reads.push(householdId); return Promise.resolve([]); };
  const { PantryProvider, usePantryItems } = load('hooks/usePantryItems.tsx', {
    ...stubs, './household-scope': scope, '@/lib/pantry-data': { ...data, fetchAllItems },
  });
  let value;
  function Consumer() { value = usePantryItems(); return null; }
  const tree = () => React.createElement(scope.HouseholdProvider, null,
    React.createElement(PantryProvider, null, React.createElement(Consumer)));
  let renderer;
  act(() => { renderer = create(tree()); });
  await act(async () => requests[0].resolve({ data: { household_id: 'h1' }, error: null }));
  assert.deepEqual(reads, ['h1']);
  act(() => renderer.unmount());

  // Failed lookup: retry re-runs the household lookup, not an items fetch.
  reads.length = 0; requests.length = 0; calls.length = 0;
  act(() => { renderer = create(tree()); });
  await act(async () => requests[0].reject(new Error('offline')));
  assert.equal(value.error, 'err_no_household');
  act(() => { void value.retry(); });
  assert.equal(requests.length, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(reads, []);
  await act(async () => requests[1].reject(new Error('offline')));
  act(() => renderer.unmount());
});
