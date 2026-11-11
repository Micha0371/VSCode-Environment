const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');
const constants = load('lib/constants.ts');
const { validateItem, parseItem, fetchAllItems, PAGE_SIZE, assertUniqueItemName, itemSaveErrorKey } = load('lib/pantry-data.ts', { './constants': constants, './pagination': load('lib/pagination.ts') });
const row = (id = '1') => ({ id, household_id: 'h', name: 'Milk', status: 'in_stock',
  category: 'dairy', location: 'fridge', created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01' });

test('validation rejects API-bypass values and permits bounded Unicode names', () => {
  for (const change of [{ name: '   ' }, { name: 'a'.repeat(121) }, { category: '__proto__' },
    { location: 'arbitrary' }, { status: 'constructor' }]) {
    assert.throws(() => validateItem({ ...row(), ...change }));
  }
  assert.equal(validateItem({ ...row(), name: ' Milk ' }).name, 'Milk');
  assert.equal(Object.hasOwn(validateItem(row()), 'created_by'), false);
  assert.doesNotThrow(() => validateItem({ ...row(), name: '\u{1F34E}'.repeat(120) }));
  assert.doesNotThrow(() => parseItem({ ...row(), created_by: null }));
  assert.throws(() => parseItem({ ...row(), status: 'invalid' }));
  assert.throws(() => parseItem({ ...row(), household_id: null }));
});

test('client duplicate validation excludes self and leaves interior whitespace unchanged', () => {
  const items = [row('milk'), { ...row('fridge'), name: 'Milk Fridge' }];
  for (const name of ['Milk', 'milk', ' MILK ', '\u00a0Milk\u00a0']) {
    assert.throws(() => assertUniqueItemName(items, name), error => error.code === '23505');
  }
  assert.doesNotThrow(() => assertUniqueItemName(items, ' milk ', 'milk'));
  assert.throws(() => assertUniqueItemName(items, 'milk', 'fridge'));
  assert.doesNotThrow(() => assertUniqueItemName(items, 'Milk Pantry'));
  assert.doesNotThrow(() => assertUniqueItemName(items, 'Milk  Fridge'));
  assert.equal(itemSaveErrorKey({ code: '23505' }), 'err_duplicate_item');
  assert.equal(itemSaveErrorKey(new Error('offline')), 'err_save_item');
});

test('fetches every page beyond the default 1000-row server cap', async () => {
  const rows = Array.from({ length: 1207 }, (_, i) => row(String(i)));
  const ranges = [];
  const client = { from() { return { select() { return this; }, eq() { return this; },
    order() { return this; }, range(from, to) {
      ranges.push([from, to]); return Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null });
    } }; } };
  const result = await fetchAllItems(client, 'h');
  assert.equal(result.length, 1207);
  assert.equal(new Set(result.map(it => it.id)).size, 1207);
  assert.deepEqual(ranges[1], [PAGE_SIZE, PAGE_SIZE * 2 - 1]);
});

test('a smaller server cap or failed page is an error, never a partial inventory', async () => {
  const client = { from() { return { select() { return this; }, eq() { return this; },
    order() { return this; }, range() { return Promise.resolve({ data: [row()], count: 100, error: null }); } }; } };
  await assert.rejects(fetchAllItems(client, 'h'), /row limit/);
  client.from = () => ({ select() { return this; }, eq() { return this; }, order() { return this; },
    range() { return Promise.resolve({ error: new Error('offline') }); } });
  await assert.rejects(fetchAllItems(client, 'h'), /offline/);
});
