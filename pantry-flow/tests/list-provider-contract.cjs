const { test } = require('node:test');
const assert = require('node:assert/strict');
const { act } = require('react-test-renderer');

// Read-side behaviour of hooks/household-list.ts, run against every provider
// built on it. `fixture()` renders the provider with two consumers and exposes
// the deferred reads; `row(id, householdId)` builds a valid row.
exports.readContract = ({ fixture, row, loadError }) => {
  test('newest read wins and a user or household change clears state and discards old requests', async () => {
    const f = fixture();
    let newest;
    act(() => { newest = f.first.fetchItems(); });
    await act(async () => { f.reads[1].resolve([row('new', 'h')]); await newest; });
    await act(async () => f.reads[0].resolve([row('old', 'h')]));
    assert.equal(f.first.items[0].id, 'new');
    let abandoned;
    act(() => { abandoned = f.first.fetchItems(); });
    f.change({ id: 'other' }, 'other-household');
    assert.deepEqual(f.first.items, []);
    await act(async () => { f.reads[2].resolve([row('private', 'h')]); await abandoned; });
    assert.deepEqual(f.first.items, []);
    await act(async () => f.reads[3].resolve([row('safe', 'other-household')]));
    assert.equal(f.first.items[0].id, 'safe');
    f.change({ id: 'other' }, 'third-household');
    assert.deepEqual(f.first.items, []);
    f.change(null, null);
    assert.deepEqual(f.first.items, []);
    f.dispose();
  });

  test(`failed initial fetch is ${loadError} and retry recovers`, async () => {
    const f = fixture();
    await act(async () => f.reads[0].reject(new Error('offline')));
    assert.equal(f.first.error, loadError);
    assert.equal(f.first.loading, false);
    let retry;
    act(() => { retry = f.first.retry(); });
    await act(async () => { f.reads[1].resolve([row('1', 'h')]); await retry; });
    assert.equal(f.first.error, null);
    assert.equal(f.first.items.length, 1);
    f.dispose();
  });
};
