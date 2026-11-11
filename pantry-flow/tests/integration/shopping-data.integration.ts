import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localStack, fixtures, cleanup } from './local-stack';
import {
  fetchAllShoppingItems, insertShoppingItem, renameShoppingItem, setShoppingItemChecked,
  deleteShoppingItem, shoppingErrorKey,
} from '../../lib/shopping-data';

const byId = (a: string, b: string) => a.localeCompare(b);

async function rejection(work: Promise<unknown>): Promise<unknown> {
  try { await work; } catch (error) { return error; }
  assert.fail('expected the operation to be rejected');
}

test('shopping data module against real local Auth/PostgREST', async t => {
  const stack = localStack();
  try {
    const [a, b] = await fixtures(stack);

    await t.test('ordinary members persist and read back all six operations', async () => {
      const manual = await insertShoppingItem(a.client, a.household, a.id, { name: '  Oat milk  ' });
      assert.equal(manual.name, 'Oat milk');
      assert.equal(manual.pantry_item_id, null);
      assert.equal(manual.is_checked, false);

      const pantry = await a.client.from('pantry_items').insert({
        household_id: a.household, created_by: a.id, name: 'Rice',
      }).select().single();
      assert.equal(pantry.error, null);
      const linked = await insertShoppingItem(a.client, a.household, a.id, {
        name: 'Rice', pantryItemId: pantry.data!.id,
      });
      assert.equal(linked.pantry_item_id, pantry.data!.id);

      const all = await fetchAllShoppingItems(a.client, a.household);
      assert.deepEqual(all.map(item => item.id).sort(byId), [manual.id, linked.id].sort(byId));

      const renamed = await renameShoppingItem(a.client, a.household, manual.id, 'Soy milk');
      assert.equal(renamed.name, 'Soy milk');

      const checked = await setShoppingItemChecked(a.client, a.household, manual.id, true);
      assert.equal(checked.is_checked, true);
      assert.ok(checked.completed_at);

      const reopened = await setShoppingItemChecked(a.client, a.household, manual.id, false);
      assert.equal(reopened.is_checked, false);
      assert.equal(reopened.completed_at, null);

      await deleteShoppingItem(a.client, a.household, manual.id);
      const after = await fetchAllShoppingItems(a.client, a.household);
      assert.deepEqual(after.map(item => item.id), [linked.id]);
    });

    await t.test('database rejections map to contract keys when client checks are bypassed', async () => {
      const bread = await insertShoppingItem(a.client, a.household, a.id, { name: 'Bread' });
      const foreign = await insertShoppingItem(b.client, b.household, b.id, { name: 'Foreign item' });

      // Duplicate open name (client-side checks are not involved in insertShoppingItem).
      assert.equal(shoppingErrorKey(await rejection(
        insertShoppingItem(a.client, a.household, a.id, { name: ' bread ' }))), 'err_duplicate_shopping_item');

      // Foreign-household insert.
      assert.equal(shoppingErrorKey(await rejection(
        insertShoppingItem(a.client, b.household, a.id, { name: 'Intruder' }))), 'err_shopping_permission');

      // Cross-household pantry link.
      const bPantry = await b.client.from('pantry_items').insert({
        household_id: b.household, created_by: b.id, name: 'B pantry',
      }).select().single();
      assert.equal(bPantry.error, null);
      assert.equal(shoppingErrorKey(await rejection(
        insertShoppingItem(a.client, a.household, a.id, { name: 'Linked abroad', pantryItemId: bPantry.data!.id }))),
      'err_shopping_link_missing');

      // 121-character name through the raw client, bypassing validateShoppingName.
      const overlong = await a.client.from('pantry_shopping_items').insert({
        household_id: a.household, created_by: a.id, name: 'x'.repeat(121),
      }).select().single();
      assert.ok(overlong.error);
      assert.equal(shoppingErrorKey(overlong.error), 'err_shopping_invalid');

      // Rename / delete of another household's id.
      assert.equal(shoppingErrorKey(await rejection(
        renameShoppingItem(a.client, a.household, foreign.id, 'Hijacked'))), 'err_shopping_missing');
      assert.equal(shoppingErrorKey(await rejection(
        deleteShoppingItem(a.client, a.household, foreign.id))), 'err_shopping_missing');

      // The foreign row is untouched and our own row survived.
      const bItems = await fetchAllShoppingItems(b.client, b.household);
      assert.ok(bItems.some(item => item.id === foreign.id && item.name === 'Foreign item'));
      assert.ok((await fetchAllShoppingItems(a.client, a.household)).some(item => item.id === bread.id));
    });

    await t.test('completed names may repeat and reopen into an open duplicate fails', async () => {
      const first = await insertShoppingItem(a.client, a.household, a.id, { name: 'Eggs' });
      await setShoppingItemChecked(a.client, a.household, first.id, true);
      const second = await insertShoppingItem(a.client, a.household, a.id, { name: 'Eggs' });
      assert.equal(second.is_checked, false);
      await setShoppingItemChecked(a.client, a.household, second.id, true);
      const third = await insertShoppingItem(a.client, a.household, a.id, { name: 'eggs' });
      assert.equal(third.is_checked, false);

      assert.equal(shoppingErrorKey(await rejection(
        setShoppingItemChecked(a.client, a.household, first.id, false))), 'err_duplicate_shopping_item');
      const reread = (await fetchAllShoppingItems(a.client, a.household)).find(item => item.id === first.id);
      assert.equal(reread?.is_checked, true);
      assert.ok(reread?.completed_at);
    });
  } finally {
    await cleanup(stack.admin);
  }
});
