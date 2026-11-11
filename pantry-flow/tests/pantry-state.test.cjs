const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');
const constants = load('lib/constants.ts');
const data = load('lib/pantry-data.ts', { './constants': constants });
const row = (id = '1', household_id = 'h') => ({ id, household_id, name: 'Milk', status: 'in_stock',
  category: 'dairy', location: 'fridge', created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01' });

function fixture() {
  let user = { id: 'u' }, household = 'h';
  let first, second, mutationResult;
  const reads = [];
  const apiCalls = [];
  const supabase = { from() { return { insert() { apiCalls.push('insert'); return this; }, update() { apiCalls.push('update'); return this; },
    delete() { apiCalls.push('delete'); return this; }, eq() { return this; }, select() { return this; },
    single() { return Promise.resolve(mutationResult); },
    then(yes, no) { return Promise.resolve(mutationResult).then(yes, no); } }; } };
  const { PantryProvider, usePantryItems } = load('hooks/usePantryItems.tsx', {
    '@/lib/supabase': { supabase }, '@/lib/auth': { useAuth: () => ({ user }) },
    './household-scope': { useHouseholdScope: () => ({ householdId: household, loading: false, error: null, refreshHousehold: async () => {} }) },
    '@/lib/pantry-data': { ...data, fetchAllItems: () => { const d = deferred(); reads.push(d); return d.promise; } },
  });
  function One() { first = usePantryItems(); return null; }
  function Two() { second = usePantryItems(); return null; }
  const tree = () => React.createElement(PantryProvider, null, React.createElement(One), React.createElement(Two));
  let renderer;
  act(() => { renderer = create(tree()); });
  return { reads, apiCalls, get first() { return first; }, get second() { return second; },
    mutation(value) { mutationResult = value; },
    change(nextUser, nextHousehold) { user = nextUser; household = nextHousehold; act(() => renderer.update(tree())); },
    dispose() { act(() => renderer.unmount()); } };
}

test('both consumers observe add, edit and delete; old reads cannot undo a write', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([]));
  let refresh;
  act(() => { refresh = f.first.fetchItems(); });
  f.mutation({ data: row(), error: null });
  await act(async () => f.first.addItem(row()));
  assert.equal(f.first.items.length, 1);
  assert.equal(f.second.items.length, 1);
  await act(async () => assert.rejects(f.first.addItem({ ...row(), name: ' milk ' }), error => error.code === '23505'));
  await act(async () => { f.reads[1].resolve([]); await refresh; });
  assert.equal(f.first.items.length, 1);
  f.mutation({ data: { ...row(), status: 'low' }, error: null });
  await act(async () => f.second.updateItem('1', { ...row(), status: 'low' }));
  assert.equal(f.first.items[0].status, 'low');
  f.mutation({ data: [{ id: '1' }], error: null });
  await act(async () => f.second.deleteItem('1'));
  assert.equal(f.first.items.length, 0);
  f.dispose();
});

test('newest read wins and a user change clears state and discards old requests', async () => {
  const f = fixture();
  let newest;
  act(() => { newest = f.first.fetchItems(); });
  await act(async () => { f.reads[1].resolve([row('new')]); await newest; });
  await act(async () => f.reads[0].resolve([row('old')]));
  assert.equal(f.first.items[0].id, 'new');
  let abandoned;
  act(() => { abandoned = f.first.fetchItems(); });
  f.change({ id: 'other' }, 'other-household');
  assert.deepEqual(f.first.items, []);
  await act(async () => { f.reads[2].resolve([row('private')]); await abandoned; });
  assert.deepEqual(f.first.items, []);
  await act(async () => f.reads[3].resolve([row('safe', 'other-household')]));
  assert.equal(f.first.items[0].id, 'safe');
  f.change(null, null);
  assert.deepEqual(f.first.items, []);
  f.dispose();
});

test('failed initial fetch remains an error and retry recovers', async () => {
  const f = fixture();
  await act(async () => f.reads[0].reject(new Error('offline')));
  assert.equal(f.first.error, 'err_load_items');
  assert.equal(f.first.loading, false);
  let retry;
  act(() => { retry = f.first.retry(); });
  await act(async () => { f.reads[1].resolve([row()]); await retry; });
  assert.equal(f.first.error, null);
  assert.equal(f.first.items.length, 1);
  f.mutation({ data: [], error: null });
  await act(async () => assert.rejects(f.first.deleteItem('missing'), /not deleted/));
  f.dispose();
});

test('a pending update locks the same item against a second screen deleting it', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row()]));
  const pending = deferred();
  f.mutation(pending.promise);
  let first, second;
  act(() => {
    first = f.first.updateItem('1', { ...row(), status: 'low' });
    second = f.second.deleteItem('1');
  });
  let outcomes;
  await act(async () => {
    pending.resolve({ data: { ...row(), status: 'low' }, error: null });
    outcomes = await Promise.allSettled([first, second]);
  });
  assert.equal(outcomes[0].status, 'fulfilled');
  assert.equal(outcomes[1].status, 'rejected');
  assert.match(outcomes[1].reason.message, /pending/);
  assert.deepEqual(f.apiCalls, ['update']);
  assert.equal(f.first.items[0].status, 'low');
  f.dispose();
});

test('a pending mutation cannot repopulate the next signed-in user cache', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row()]));
  const pending = deferred();
  f.mutation(pending.promise);
  let updating;
  act(() => { updating = f.first.updateItem('1', { ...row(), status: 'low' }); });
  f.change({ id: 'other-user' }, 'other-household');
  await act(async () => f.reads[1].resolve([row('other-item', 'other-household')]));
  await act(async () => {
    pending.resolve({ data: { ...row(), status: 'low' }, error: null });
    await updating;
  });
  assert.deepEqual(f.first.items.map(item => item.id), ['other-item']);
  f.dispose();
});

test('failed writes preserve existing inventory and allow a subsequent retry', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row()]));
  f.mutation({ error: new Error('offline') });
  await act(async () => {
    await assert.rejects(f.first.updateItem('1', { ...row(), status: 'out' }), /offline/);
    await assert.rejects(f.first.deleteItem('1'), /offline/);
    await assert.rejects(f.first.addItem({ ...row(), name: 'Eggs' }), /offline/);
  });
  assert.equal(f.first.items[0].status, 'in_stock');
  assert.equal(f.first.items.length, 1);
  f.mutation({ data: { ...row(), status: 'out' }, error: null });
  await act(async () => f.first.updateItem('1', { ...row(), status: 'out' }));
  assert.equal(f.first.items[0].status, 'out');
  f.dispose();
});
