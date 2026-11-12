const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

const { offersShoppingAdd } = load('lib/pantry-shopping.ts');

test('offersShoppingAdd prompts only on a change to low or out', () => {
  for (const [a, b] of [['in_stock', 'low'], ['in_stock', 'out'], ['low', 'out'], ['out', 'low']]) {
    assert.equal(offersShoppingAdd(a, b), true, `${a} -> ${b}`);
  }
  for (const [a, b] of [['low', 'low'], ['out', 'out'], ['low', 'in_stock'], ['out', 'in_stock'], ['in_stock', 'in_stock']]) {
    assert.equal(offersShoppingAdd(a, b), false, `${a} -> ${b}`);
  }
});
