import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localStack, fixtures, cleanup } from './local-stack';
import {
  fetchAllShoppingItems, insertShoppingItem, renameShoppingItem, setShoppingItemChecked,
  deleteShoppingItem, shoppingErrorKey,
} from '../../lib/shopping-data';

async function rejection(work: Promise<unknown>): Promise<unknown> {
  try { await work; } catch (error) { return error; }
  assert.fail('expected the operation to be rejected');
}

test('pantry and shopping stay independent with ordinary clients', async () => {
  const stack = localStack();
  try {
    const [a] = await fixtures(stack);
    const { client, household, id } = a;

    const addPantry = async (name: string, status = 'in_stock') => {
      const result = await client.from('pantry_items').insert({
        household_id: household, created_by: id, name, status,
      }).select().single();
      assert.equal(result.error, null);
      return result.data!;
    };
    const readPantry = async (pantryId: string) => {
      const result = await client.from('pantry_items')
        .select('name, status, category, location, updated_at').eq('id', pantryId).single();
      assert.equal(result.error, null);
      return result.data;
    };
    const shoppingCount = async () => (await fetchAllShoppingItems(client, household)).length;

    // Linked add.
    const milk = await addPantry('Milk', 'low');
    const linked = await insertShoppingItem(client, household, id, { name: 'Milk', pantryItemId: milk.id });
    assert.equal(linked.pantry_item_id, milk.id);

    // Shopping changes leave pantry untouched.
    const snapshot = await readPantry(milk.id);
    await renameShoppingItem(client, household, linked.id, 'Oat milk');
    await setShoppingItemChecked(client, household, linked.id, true);
    await setShoppingItemChecked(client, household, linked.id, false);
    await deleteShoppingItem(client, household, linked.id);
    assert.deepEqual(await readPantry(milk.id), snapshot);

    // Pantry status changes never create shopping items.
    const before = await shoppingCount();
    for (const status of ['out', 'in_stock']) {
      const updated = await client.from('pantry_items').update({ status }).eq('id', milk.id);
      assert.equal(updated.error, null);
    }
    assert.equal(await shoppingCount(), before);

    // Duplicates.
    const breadPantry = await addPantry('Bread');
    const manual = await insertShoppingItem(client, household, id, { name: 'Bread' });
    assert.equal(shoppingErrorKey(await rejection(
      insertShoppingItem(client, household, id, { name: 'bread', pantryItemId: breadPantry.id }))),
    'err_duplicate_shopping_item');
    await setShoppingItemChecked(client, household, manual.id, true);
    const second = await insertShoppingItem(client, household, id, { name: 'bread', pantryItemId: breadPantry.id });
    assert.equal(second.pantry_item_id, breadPantry.id);
    assert.equal(shoppingErrorKey(await rejection(
      setShoppingItemChecked(client, household, manual.id, false))), 'err_duplicate_shopping_item');

    // Pantry deletion keeps the shopping item, its name, and clears the link.
    const gone = await client.from('pantry_items').delete().eq('id', breadPantry.id);
    assert.equal(gone.error, null);
    const survivor = (await fetchAllShoppingItems(client, household)).find(item => item.id === second.id);
    assert.ok(survivor);
    assert.equal(survivor.name, 'bread');
    assert.equal(survivor.pantry_item_id, null);
  } finally {
    await cleanup(stack.admin);
  }
});
