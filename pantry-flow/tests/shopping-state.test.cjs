const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');
const real = load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') });
const row = (id = '1', name = 'Milk', checked = false, household_id = 'h') => ({ id, household_id, pantry_item_id: null,
  name, is_checked: checked, completed_at: checked ? '2026-01-02' : null, created_by: 'u',
  created_at: '2026-01-01', updated_at: '2026-01-01' });

function fixture() {
  let user = { id: 'u' }, household = 'h', scope = { loading: false, error: null };
  let first, second;
  const reads = [];
  const calls = [];
  const impl = {};
  const record = op => (...args) => { calls.push(op); return impl[op](...args); };
  const refreshes = [];
  const { ShoppingProvider, useShoppingItems } = load('hooks/useShoppingItems.tsx', {
    '@/lib/supabase': { supabase: {} }, '@/lib/auth': { useAuth: () => ({ user }) },
    './household-scope': { useHouseholdScope: () => ({ householdId: household, loading: scope.loading, error: scope.error,
      refreshHousehold: async () => { refreshes.push(1); } }) },
    '@/lib/shopping-data': { ...real,
      fetchAllShoppingItems: () => { const d = deferred(); reads.push(d); return d.promise; },
      insertShoppingItem: record('insert'), renameShoppingItem: record('rename'),
      setShoppingItemChecked: record('check'), deleteShoppingItem: record('delete') },
  });
  function One() { first = useShoppingItems(); return null; }
  function Two() { second = useShoppingItems(); return null; }
  const tree = () => React.createElement(ShoppingProvider, null, React.createElement(One), React.createElement(Two));
  let renderer;
  act(() => { renderer = create(tree()); });
  return { reads, calls, impl, refreshes, get first() { return first; }, get second() { return second; },
    useShoppingItems,
    change(nextUser, nextHousehold, nextScope = scope) { user = nextUser; household = nextHousehold; scope = nextScope; act(() => renderer.update(tree())); },
    dispose() { act(() => renderer.unmount()); } };
}

test('both consumers observe add, rename, complete, reopen and delete; old reads cannot undo a write', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([]));
  let refresh;
  act(() => { refresh = f.first.fetchItems(); });
  f.impl.insert = async () => row('1', 'Milk');
  await act(async () => { await f.first.addItem({ name: ' Milk ' }); });
  assert.equal(f.first.items.length, 1);
  assert.equal(f.second.items.length, 1);
  await act(async () => { f.reads[1].resolve([]); await refresh; });
  assert.equal(f.first.items.length, 1);
  f.impl.rename = async () => row('1', 'Oat milk');
  await act(async () => { await f.second.renameItem('1', 'Oat milk'); });
  assert.equal(f.first.items[0].name, 'Oat milk');
  f.impl.check = async (_c, _h, _id, checked) => row('1', 'Oat milk', checked);
  await act(async () => { await f.first.completeItem('1'); });
  assert.equal(f.second.items[0].is_checked, true);
  await act(async () => { await f.second.reopenItem('1'); });
  assert.equal(f.first.items[0].is_checked, false);
  assert.equal(f.first.getItem('1').name, 'Oat milk');
  f.impl.delete = async () => {};
  await act(async () => { await f.second.deleteItem('1'); });
  assert.equal(f.first.items.length, 0);
  assert.equal(f.first.getItem('1'), null);
  f.dispose();
});

test('newest read wins and a user or household change clears state and discards old requests', async () => {
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
  await act(async () => f.reads[3].resolve([row('safe', 'Milk', false, 'other-household')]));
  assert.equal(f.first.items[0].id, 'safe');
  f.change({ id: 'other' }, 'third-household');
  assert.deepEqual(f.first.items, []);
  f.change(null, null);
  assert.deepEqual(f.first.items, []);
  f.dispose();
});

test('failed initial fetch is err_load_shopping and retry recovers; a household error retries the shared lookup', async () => {
  const f = fixture();
  await act(async () => f.reads[0].reject(new Error('offline')));
  assert.equal(f.first.error, 'err_load_shopping');
  assert.equal(f.first.loading, false);
  let retry;
  act(() => { retry = f.first.retry(); });
  await act(async () => { f.reads[1].resolve([row()]); await retry; });
  assert.equal(f.first.error, null);
  assert.equal(f.first.items.length, 1);
  const reads = f.reads.length;
  f.change({ id: 'u' }, null, { loading: false, error: 'err_household' });
  assert.equal(f.first.error, 'err_household');
  await act(async () => { await f.first.retry(); });
  assert.equal(f.refreshes.length, 1);
  assert.equal(f.reads.length, reads);
  f.dispose();
});

test('a pending change locks the same item while other items stay available', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row('1', 'Milk'), row('2', 'Eggs')]));
  const pending = deferred();
  f.impl.check = () => pending.promise;
  f.impl.delete = async () => {};
  let first, second, other;
  act(() => {
    first = f.first.completeItem('1');
    second = f.second.deleteItem('1');
    other = f.second.deleteItem('2');
  });
  let outcomes;
  await act(async () => {
    pending.resolve(row('1', 'Milk', true));
    outcomes = await Promise.allSettled([first, second, other]);
  });
  assert.equal(outcomes[0].status, 'fulfilled');
  assert.equal(outcomes[1].status, 'rejected');
  assert.equal(outcomes[1].reason.message, 'Shopping item change is already pending');
  assert.equal(outcomes[2].status, 'fulfilled');
  assert.deepEqual(f.calls, ['check', 'delete']);
  assert.deepEqual(f.first.items.map(i => [i.id, i.is_checked]), [['1', true]]);
  await act(async () => { await f.first.deleteItem('1'); });
  assert.equal(f.first.items.length, 0);
  f.dispose();
});

test('client duplicate checks apply to open items only', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row('1', 'Milk'), row('2', 'Eggs', true), row('3', 'Bread')]));
  const hasCode = code => e => e.code === code;
  await act(async () => {
    await assert.rejects(f.first.addItem({ name: ' milk ' }), hasCode('23505'));
    await assert.rejects(f.first.renameItem('3', 'MILK'), hasCode('23505'));
    await assert.rejects(f.first.renameItem('3', '   '), hasCode('PF_INVALID_SHOPPING'));
  });
  assert.deepEqual(f.calls, []);
  f.impl.insert = async () => row('4', 'Eggs');
  await act(async () => { await f.first.addItem({ name: 'Eggs' }); });
  assert.deepEqual(f.calls, ['insert']);
  assert.equal(f.first.items.filter(i => i.name === 'Eggs').length, 2);
  f.impl.rename = async () => row('2', 'Milk', true);
  await act(async () => { await f.first.renameItem('2', 'Milk'); });
  assert.deepEqual(f.calls, ['insert', 'rename']);
  await act(async () => { await assert.rejects(f.first.reopenItem('2'), hasCode('23505')); });
  assert.deepEqual(f.calls, ['insert', 'rename']);
  assert.equal(f.first.getItem('2').is_checked, true);
  f.dispose();
});

test('failed or malformed writes leave state intact and allow retry', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row('1', 'Milk', true)]));
  const before = f.first.items;
  f.impl.rename = async () => { throw new Error('offline'); };
  f.impl.check = async () => real.parseShoppingItem({ id: '1' });
  f.impl.insert = async () => { throw new Error('offline'); };
  await act(async () => {
    await assert.rejects(f.first.renameItem('1', 'Oat'), /offline/);
    await assert.rejects(f.first.completeItem('1'), /Invalid shopping item/);
    await assert.rejects(f.first.addItem({ name: 'Eggs' }), /offline/);
  });
  assert.deepEqual(f.first.items, before);
  assert.equal(f.reads.length, 1);
  f.impl.check = async (_c, _h, _id, checked) => row('1', 'Milk', checked);
  await act(async () => { await f.first.reopenItem('1'); });
  assert.equal(f.first.items[0].is_checked, false);
  await act(async () => { await f.first.completeItem('1'); });
  f.impl.check = async () => { throw Object.assign(new Error('gone'), { code: 'PGRST116' }); };
  await act(async () => { await assert.rejects(f.first.reopenItem('1'), e => e.code === 'PGRST116'); });
  assert.equal(f.reads.length, 2);
  await act(async () => f.reads[1].resolve([]));
  assert.equal(f.first.items.length, 0);
  assert.equal(f.first.loading, false);
  f.dispose();
});

test('a missing-record failure re-reads so a row deleted elsewhere disappears', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row('1', 'Milk'), row('2', 'Eggs')]));
  f.impl.rename = async () => { throw Object.assign(new Error('gone'), { code: 'PGRST116' }); };
  const original = Object.assign(new Error('gone'), { code: 'PF_SHOPPING_MISSING' });
  f.impl.delete = async () => { throw original; };
  let outcome;
  await act(async () => { outcome = await Promise.allSettled([f.first.renameItem('1', 'Oat')]); });
  assert.equal(outcome[0].status, 'rejected');
  assert.equal(outcome[0].reason.code, 'PGRST116');
  assert.equal(f.reads.length, 2);
  await act(async () => f.reads[1].resolve([row('2', 'Eggs')]));
  assert.deepEqual(f.first.items.map(i => i.id), ['2']);
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  await act(async () => { await assert.rejects(f.second.deleteItem('2'), e => e === original); });
  assert.equal(f.reads.length, 3);
  await act(async () => f.reads[2].resolve([]));
  assert.deepEqual(f.first.items, []);
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  f.dispose();
});

test('a missing-record re-read loses to a newer read and to a household change', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row('1', 'Milk')]));
  f.impl.delete = async () => { throw Object.assign(new Error('gone'), { code: 'PF_SHOPPING_MISSING' }); };
  await act(async () => { await assert.rejects(f.first.deleteItem('1'), e => e.code === 'PF_SHOPPING_MISSING'); });
  assert.equal(f.reads.length, 2);
  let newer;
  act(() => { newer = f.first.fetchItems(); });
  await act(async () => { f.reads[2].resolve([row('1', 'Milk'), row('3', 'Tea')]); await newer; });
  await act(async () => f.reads[1].resolve([]));
  assert.deepEqual(f.first.items.map(i => i.id).sort(), ['1', '3']);
  await act(async () => { await assert.rejects(f.first.deleteItem('1'), e => e.code === 'PF_SHOPPING_MISSING'); });
  assert.equal(f.reads.length, 4);
  f.change({ id: 'u' }, 'h2');
  await act(async () => f.reads[3].resolve([row('old', 'Milk', false, 'h')]));
  assert.deepEqual(f.first.items, []);
  await act(async () => f.reads[4].resolve([row('x', 'Tea', false, 'h2')]));
  assert.deepEqual(f.first.items.map(i => i.id), ['x']);
  f.dispose();
});

test('a transport failure on a write issues no re-read', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row('1', 'Milk')]));
  f.impl.rename = async () => { throw new Error('offline'); };
  f.impl.delete = async () => { throw new Error('offline'); };
  await act(async () => {
    await assert.rejects(f.first.renameItem('1', 'Oat'), /offline/);
    await assert.rejects(f.first.deleteItem('1'), /offline/);
  });
  assert.equal(f.reads.length, 1);
  assert.deepEqual(f.first.items.map(i => i.id), ['1']);
  assert.equal(f.first.loading, false);
  f.dispose();
});

test('a pending mutation cannot repopulate the next signed-in user list', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row()]));
  const pending = deferred();
  f.impl.check = () => pending.promise;
  let completing;
  act(() => { completing = f.first.completeItem('1'); });
  f.change({ id: 'other-user' }, 'other-household');
  await act(async () => f.reads[1].resolve([row('other-item', 'Tea', false, 'other-household')]));
  await act(async () => { pending.resolve(row('1', 'Milk', true)); await completing; });
  assert.deepEqual(f.first.items.map(item => item.id), ['other-item']);
  f.dispose();
});

test('concurrent adds of one name leave exactly one item', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([]));
  const first = deferred();
  let n = 0;
  f.impl.insert = () => (++n === 1 ? first.promise : Promise.reject(Object.assign(new Error('dup'), { code: '23505' })));
  let a, b;
  act(() => { a = f.first.addItem({ name: 'Eggs' }); b = f.second.addItem({ name: 'Eggs' }); });
  let outcomes;
  await act(async () => { first.resolve(row('1', 'Eggs')); outcomes = await Promise.allSettled([a, b]); });
  assert.equal(outcomes[0].status, 'fulfilled');
  assert.equal(outcomes[1].status, 'rejected');
  assert.equal(outcomes[1].reason.code, '23505');
  assert.deepEqual(f.first.items.map(i => i.name), ['Eggs']);
  assert.deepEqual(f.second.items.map(i => i.name), ['Eggs']);
  f.dispose();
});

test('a write while the first read is in flight ends with the full server list, not a stuck spinner', async () => {
  const f = fixture();
  f.impl.insert = async () => row('new', 'New');
  await act(async () => { await f.first.addItem({ name: 'New' }); });
  await act(async () => f.reads[f.reads.length - 1].resolve([row('new', 'New'), row('a', 'A'), row('b', 'B')]));
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  assert.deepEqual(f.first.items.map(i => i.id).sort(), ['a', 'b', 'new']);
  f.dispose();
});

test('a successful write after a failed load re-reads instead of showing a partial list', async () => {
  const f = fixture();
  await act(async () => f.reads[0].reject(new Error('offline')));
  assert.equal(f.first.error, 'err_load_shopping');
  f.impl.insert = async () => row('new', 'New');
  await act(async () => { await f.first.addItem({ name: 'New' }); });
  await act(async () => f.reads[f.reads.length - 1].resolve([row('new', 'New'), row('a', 'A')]));
  assert.equal(f.reads.length, 2);
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  assert.deepEqual(f.first.items.map(i => i.id).sort(), ['a', 'new']);
  f.dispose();
});

test('a failed write after a failed load keeps the load error and retry recovers', async () => {
  const f = fixture();
  await act(async () => f.reads[0].reject(new Error('offline')));
  f.impl.insert = async () => { throw new Error('offline'); };
  await act(async () => { await assert.rejects(f.first.addItem({ name: 'New' }), /offline/); });
  await act(async () => f.reads[f.reads.length - 1].reject(new Error('offline')));
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, 'err_load_shopping');
  let retry;
  act(() => { retry = f.first.retry(); });
  await act(async () => { f.reads[f.reads.length - 1].resolve([row('a', 'A')]); await retry; });
  assert.equal(f.first.error, null);
  assert.equal(f.first.loading, false);
  assert.deepEqual(f.first.items.map(i => i.id), ['a']);
  f.dispose();
});

test("a write that resolves after a household change does not appear in the new household's list", async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([]));
  const pending = deferred();
  f.impl.insert = () => pending.promise;
  let adding;
  act(() => { adding = f.first.addItem({ name: 'Eggs' }); });
  f.change({ id: 'u' }, 'h2');
  await act(async () => f.reads[1].resolve([row('x', 'Tea', false, 'h2')]));
  await act(async () => { pending.resolve(row('late', 'Eggs', false, 'h')); await adding; });
  assert.deepEqual(f.first.items.map(i => i.id), ['x']);
  f.dispose();
});

test("a read started under the old household cannot populate the new household's list", async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([]));
  let oldRead;
  act(() => { oldRead = f.first.fetchItems(); });
  f.change({ id: 'u' }, 'h2');
  await act(async () => { f.reads[1].resolve([row('old', 'Milk', false, 'h')]); await oldRead; });
  assert.deepEqual(f.first.items, []);
  await act(async () => f.reads[2].resolve([row('x', 'Tea', false, 'h2')]));
  assert.deepEqual(f.first.items.map(i => i.id), ['x']);
  f.dispose();
});

test('useShoppingItems outside ShoppingProvider throws', () => {
  const f = fixture();
  f.dispose();
  const original = console.error; console.error = () => {};
  try {
    assert.throws(() => act(() => { create(React.createElement(() => { f.useShoppingItems(); return null; })); }),
      /useShoppingItems must be used within ShoppingProvider/);
  } finally { console.error = original; }
});

test("a write that settles after a household change does not strand the new household's first read", async () => {
  const f = fixture();
  const pending = deferred();
  f.impl.insert = () => pending.promise;
  let adding;
  act(() => { adding = f.first.addItem({ name: 'Eggs' }); });
  f.change({ id: 'u' }, 'h2');
  assert.equal(f.reads.length, 2);
  await act(async () => { pending.resolve(row('late', 'Eggs', false, 'h')); await adding; });
  await act(async () => f.reads[1].resolve([row('x', 'Tea', false, 'h2')]));
  assert.deepEqual(f.first.items.map(i => i.id), ['x']);
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  f.dispose();
});
