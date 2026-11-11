const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');
const pagination = load('lib/pagination.ts');
const { validateShoppingName, parseShoppingItem, assertUniqueOpenName, shoppingErrorKey,
  fetchAllShoppingItems, insertShoppingItem, renameShoppingItem, setShoppingItemChecked,
  deleteShoppingItem } = load('lib/shopping-data.ts', { './pagination': pagination });
const { en } = load('lib/i18n/en.ts');
const { PAGE_SIZE } = pagination;

const row = (id = '1', over = {}) => ({ id, household_id: 'h', pantry_item_id: null, name: 'Milk',
  is_checked: false, completed_at: null, created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01', ...over });

test('validation trims edges, keeps interior whitespace and bounds code points', () => {
  for (const bad of ['', '   ', ' ', 'a'.repeat(121)]) {
    assert.throws(() => validateShoppingName(bad), e => e.code === 'PF_INVALID_SHOPPING');
  }
  assert.equal(validateShoppingName(' Milk '), 'Milk');
  assert.equal(validateShoppingName('Milk  Fridge'), 'Milk  Fridge');
  assert.doesNotThrow(() => validateShoppingName('\u{1F34E}'.repeat(120)));
});

test('parsing rejects malformed rows', () => {
  for (const change of [{ is_checked: 'false' }, { is_checked: true, completed_at: null },
    { completed_at: '2026-01-02' }, { pantry_item_id: 5 }, { household_id: null }, { name: ' Milk ' }]) {
    assert.throws(() => parseShoppingItem(row('1', change)));
  }
  assert.doesNotThrow(() => parseShoppingItem(row('1', { pantry_item_id: null, created_by: null })));
  assert.doesNotThrow(() => parseShoppingItem(row('1', { is_checked: true, completed_at: '2026-01-02' })));
});

test('open-name uniqueness ignores completed items and self', () => {
  const open = [row('a')];
  const done = [row('a', { is_checked: true, completed_at: '2026-01-02' })];
  for (const name of ['milk', ' MILK ', ' milk ']) {
    assert.throws(() => assertUniqueOpenName(open, name), e => e.code === '23505');
    assert.doesNotThrow(() => assertUniqueOpenName(done, name));
  }
  assert.doesNotThrow(() => assertUniqueOpenName(open, 'Milk', 'a'));
  assert.doesNotThrow(() => assertUniqueOpenName([row('b', { name: 'Milk Fridge' })], 'Milk  Fridge'));
});

test('error mapping follows the contract', () => {
  const table = [['23505', 'err_duplicate_shopping_item'], ['42501', 'err_shopping_permission'],
    ['PGRST116', 'err_shopping_missing'], ['PF_SHOPPING_MISSING', 'err_shopping_missing'],
    ['PF_INVALID_SHOPPING', 'err_shopping_invalid'], ['23514', 'err_shopping_invalid'],
    ['23502', 'err_shopping_invalid'], ['23503', 'err_shopping_invalid'], ['22P02', 'err_shopping_invalid'],
    ['XX000', 'err_save_shopping']];
  for (const [code, key] of table) {
    assert.equal(shoppingErrorKey({ code }), key);
    assert.ok(key in en);
  }
  for (const value of [new Error('offline'), null, 'str', undefined]) {
    assert.equal(shoppingErrorKey(value), 'err_save_shopping');
  }
  for (const k of ['err_load_shopping', 'err_save_shopping', 'err_duplicate_shopping_item',
    'err_shopping_invalid', 'err_shopping_permission', 'err_shopping_missing']) assert.ok(en[k]);
});

test('reads page beyond the server cap and never return partial lists', async () => {
  const rows = Array.from({ length: 1207 }, (_, i) => row(String(i)));
  const ranges = []; const calls = [];
  const client = { from(t) { calls.push(['from', t]); return { select() { return this; },
    eq(...a) { calls.push(['eq', ...a]); return this; },
    order(...a) { calls.push(['order', ...a]); return this; }, range(from, to) {
      ranges.push([from, to]); return Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null });
    } }; } };
  const result = await fetchAllShoppingItems(client, 'h');
  assert.equal(result.length, 1207);
  assert.equal(new Set(result.map(it => it.id)).size, 1207);
  assert.deepEqual(ranges[1], [PAGE_SIZE, PAGE_SIZE * 2 - 1]);
  assert.deepEqual(calls[0], ['from', 'pantry_shopping_items']);
  assert.deepEqual(calls.filter(c => c[0] === 'eq')[0], ['eq', 'household_id', 'h']);
  assert.deepEqual(calls.filter(c => c[0] === 'order').slice(0, 2),
    [['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: false }]]);

  const small = { from() { return { select() { return this; }, eq() { return this; },
    order() { return this; }, range() { return Promise.resolve({ data: [row()], count: 100, error: null }); } }; } };
  await assert.rejects(fetchAllShoppingItems(small, 'h'), /row limit/);
  small.from = () => ({ select() { return this; }, eq() { return this; }, order() { return this; },
    range() { return Promise.resolve({ error: new Error('offline') }); } });
  await assert.rejects(fetchAllShoppingItems(small, 'h'), /offline/);
});

test('writes send only contract columns and scope by household', async () => {
  const log = [];
  const make = (data) => {
    const q = { insert(p) { log.push(['insert', p]); return q; }, update(p) { log.push(['update', p]); return q; },
      delete() { log.push(['delete']); return q; }, eq(...a) { log.push(['eq', ...a]); return q; },
      select(...a) { log.push(['select', ...a]); return q; },
      single() { return Promise.resolve({ data: data(), error: null }); },
      then(res, rej) { return Promise.resolve({ data: data(), error: null }).then(res, rej); } };
    return q;
  };
  let next = row('1');
  const client = { from(t) { log.push(['from', t]); return make(() => next); } };

  await insertShoppingItem(client, 'h', 'u', { name: ' Milk ' });
  assert.deepEqual(log.find(l => l[0] === 'insert'),
    ['insert', { household_id: 'h', name: 'Milk', pantry_item_id: null, created_by: 'u' }]);
  log.length = 0;
  await insertShoppingItem(client, 'h', 'u', { name: 'Milk', pantryItemId: 'p' });
  assert.equal(log.find(l => l[0] === 'insert')[1].pantry_item_id, 'p');

  log.length = 0;
  await renameShoppingItem(client, 'h', '1', ' Oats ');
  assert.deepEqual(log.filter(l => l[0] !== 'from'),
    [['update', { name: 'Oats' }], ['eq', 'id', '1'], ['eq', 'household_id', 'h'], ['select']]);

  log.length = 0;
  next = row('1', { is_checked: true, completed_at: '2026-01-02' });
  await setShoppingItemChecked(client, 'h', '1', true);
  assert.deepEqual(log.filter(l => l[0] !== 'from'),
    [['update', { is_checked: true }], ['eq', 'id', '1'], ['eq', 'household_id', 'h'], ['select']]);

  log.length = 0;
  next = [{ id: '1' }];
  await deleteShoppingItem(client, 'h', '1');
  assert.deepEqual(log.filter(l => l[0] !== 'from'),
    [['delete'], ['eq', 'id', '1'], ['eq', 'household_id', 'h'], ['select', 'id']]);
  next = [];
  await assert.rejects(deleteShoppingItem(client, 'h', '1'), e => e.code === 'PF_SHOPPING_MISSING');
});

test('writes reject malformed rows and invalid names before any request', async () => {
  const calls = [];
  const make = data => {
    const q = { insert() { return q; }, update() { return q; }, eq() { return q; }, select() { return q; },
      single() { return Promise.resolve({ data, error: null }); } };
    return q;
  };
  const client = data => ({ from(t) { calls.push(t); return make(data); } });
  const malformed = client(row('1', { is_checked: 'yes' }));
  await assert.rejects(insertShoppingItem(malformed, 'h', 'u', { name: 'Milk' }), /Invalid shopping item/);
  await assert.rejects(renameShoppingItem(malformed, 'h', '1', 'Oats'), /Invalid shopping item/);
  assert.equal(calls.length, 2);
  calls.length = 0;
  const ok = client(row('1'));
  await assert.rejects(insertShoppingItem(ok, 'h', 'u', { name: '   ' }), e => e.code === 'PF_INVALID_SHOPPING');
  await assert.rejects(async () => renameShoppingItem(ok, 'h', '1', '   '), e => e.code === 'PF_INVALID_SHOPPING');
  assert.equal(calls.length, 0);
});
