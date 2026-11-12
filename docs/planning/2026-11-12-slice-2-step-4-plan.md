# Slice 2 step 4 (low/out prompt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a household member saves a pantry item whose status changed to low or out, the app asks "Add to shopping list?". Yes adds the item once, linked to that pantry item. No adds nothing. The pantry save is never undone.

**Architecture:**
- **One PR from `main`.** Task 1 puts the prompt into the existing pantry edit screen's save flow. The status rule lives in a small pure module; Yes calls the same `ShoppingProvider.addItem` that the manual add uses. Task 2 adds local-stack integration tests that the pantry and shopping domains stay independent, and the duplicate decision record (KAN-21).
- **No new data path, migration or background sync.**

**Tech Stack:** Expo SDK 58 / React Native 0.88, expo-router, the `node:test` + react-test-renderer screen harness (`tests/helpers.cjs` `load(file, stubs)`), and tsx integration tests against the local Supabase stack.

**Spec:**
- [slice-2-implementation-plan.md](slice-2-implementation-plan.md), step 4 and decisions D1, D3 and D4.
- Jira KAN-19 (Pantry-to-Shopping-List Integration), KAN-20 (Implement adding an existing pantry item to the shopping list), KAN-21 (Define and implement duplicate handling) and KAN-22 (Implement integration and regression tests).
- PRD section 10, the pantry ↔ shopping sync rules.

## Global Constraints

- **D3, verbatim:** "After a successful save in `app/edit-item/[id].tsx` that changes the status to low or out, the app asks 'Add to shopping list?'. Yes calls the same shopping add operation as a manual add, linked to that pantry item; No or dismiss does nothing. The pantry save is already persisted and is never rolled back by the prompt outcome; an open duplicate (D1) shows the translated duplicate message. No prompt when the status is unchanged or in stock; new pantry items start in stock, so adding one never prompts. No separate 'add to shopping list' button in Slice 2."
- **When it prompts:** "changes the status to low or out" means `next !== previous && (next === 'low' || next === 'out')`. So in stock → low, in stock → out, low → out and out → low all prompt. Unchanged status and any change to in stock don't.
- **D1:**
  - Shopping names are unique among **open** items only. Manual and pantry-linked items share one name space.
  - Completed items never block an add.
  - Adding when an open duplicate exists fails with the translated duplicate message. Nothing is merged, renamed or overwritten.
- **D4:** deleting a pantry item sets the shopping item's link to null, and the shopping item keeps its own name.
- **PRD section 10:** shopping changes (rename, complete, reopen, remove) never change pantry data. Pantry status changes never create shopping items without confirmation.
- **Names:** pantry and shopping names share the same rules (120 characters, the same trimming), so a saved pantry name is always a valid shopping name. Yes sends the saved pantry name unchanged as `name`, and the saved pantry item's `id` as `pantryItemId`.
- **Strings:** English only (D5). New `lib/i18n/en.ts` keys, with this exact copy:
  - `shopping_prompt_title`: 'Add to shopping list?'
  - `shopping_prompt_add`: 'Add'
  - `shopping_prompt_skip`: 'Not now'
  - `shopping_prompt_failed_title`: 'Not added to the shopping list'
  - `common_ok`: 'OK'
  - The prompt's message is the saved item's name.
- **Errors:** a failed shopping add is shown as `t(shoppingErrorKey(error))` in a native notice titled `shopping_prompt_failed_title`. It never appears as the pantry form's save error.
- **Reuse:** `useItemMutation`, `usePantryItems().updateItem`, `useShoppingItems().addItem`, `shoppingErrorKey` and React Native `Alert`. No new dependencies, and no redesign of the edit screen.
- **Tests:**
  - Screen tests use the `node:test` harness with string stubs, like `tests/shopping-edit.test.cjs`.
  - Integration tests use ordinary local-stack clients, like `tests/integration/shopping-data.integration.ts`.
  - The PR passes `npm run test:fast` and `npm run test:local`.

## Review Focus

1. **Leaving the edit screen while the save is in flight:** no prompt appears over another screen. The pantry change is still saved. Covered in Task 1.
2. **A double Save, or Save and then Delete:** one pantry write and at most one prompt. The screen stays locked from the save until the prompt and any shopping add have finished. Covered in Task 1.
3. **The pantry item deleted by another member before Yes:** the notice shows "The pantry item for this entry is no longer available.", the screen closes, and nothing is written. Covered in Task 1 at screen level and Task 2 at integration level.
4. **An open item with the same name, manual or linked:** the translated duplicate notice appears, no second entry is created, and the pantry status stays saved. A completed item with the same name doesn't block the add. Covered in Tasks 1 and 2.
5. **The shopping list still loading or failed to load when Yes is tapped:** the add is still sent. The provider's write-before-first-load handling from step 2b re-reads the list. Covered in Task 1, which asserts the call, and by existing provider tests.

---

### Task 1: Prompt after a low/out save (KAN-20; KAN-21 UI)

**Files:**
- Create: `pantry-flow/lib/pantry-shopping.ts`
- Modify: `pantry-flow/app/edit-item/[id].tsx` (the `onSave` operation; a mounted ref)
- Modify: `pantry-flow/lib/i18n/en.ts` (the five keys above)
- Create: `pantry-flow/tests/pantry-shopping.test.cjs` (unit) and `pantry-flow/tests/edit-item-prompt.test.cjs` (screen)
- Modify: `pantry-flow/tests/screens.test.cjs`, stubs only. Its edit-item duplicate test adds `'@/hooks/useShoppingItems'` and `'@/lib/shopping-data'` stubs, with no change to the test body (the same pattern as the step 2 `./pagination` stub).

**Interfaces:**
- Consumes:
  - `usePantryItems()`: `updateItem(id, input): Promise<PantryItem>` and `getItem(id)`.
  - `useShoppingItems()`: `addItem({ name, pantryItemId }): Promise<ShoppingItem>`.
  - `shoppingErrorKey(error)` from `@/lib/shopping-data`.
  - `useItemMutation()`: `{ busy, run(operation, success, failure) }`.
- Produces: `offersShoppingAdd(previous: StatusKey, next: StatusKey): boolean` in `lib/pantry-shopping.ts`.

**Behaviour (the `onSave` operation passed to `run`):**
1. `const previous = item.status`, captured when Save is pressed. Then `const saved = await updateItem(item.id, { name, category, location, status })`. A failure here keeps today's path: the pantry error is shown in the form, with no prompt.
2. If `!mounted.current` (the screen has closed) or `!offersShoppingAdd(previous, saved.status)`, return. `run`'s success callback then calls `router.back()` as today.
3. `await ask()`: a Promise that resolves `true` on `shopping_prompt_add` and `false` on `shopping_prompt_skip` or on dismissal. Use `Alert.alert(t('shopping_prompt_title'), saved.name, [skip (style 'cancel'), add], { cancelable: true, onDismiss })`.
4. On `true`, call `await addItem({ name: saved.name, pantryItemId: saved.id })`. If it rejects, `await notice(t(shoppingErrorKey(error)))`: `Alert.alert(t('shopping_prompt_failed_title'), message, [common_ok], { cancelable: true, onDismiss })`, resolving on either. Don't rethrow.
5. Return. `run`'s success callback closes the screen.

Everything above runs inside `run`'s operation, so the Save, Cancel and Delete buttons stay disabled until the prompt and any shopping add are done.

- [ ] **Step 1: Write the failing tests.**
  - `pantry-shopping.test.cjs`, `offersShoppingAdd prompts only on a change to low or out`. These pairs are true: in_stock→low, in_stock→out, low→out, out→low. These are false: low→low, out→out, low→in_stock, out→in_stock, in_stock→in_stock.
  - `edit-item-prompt.test.cjs`. Load `app/edit-item/[id].tsx` with stubs as in `screens.test.cjs` and the real `hooks/useItemMutation.ts`. Stub `Alert.alert` to record its calls and expose the buttons:
    - `saving a change to low asks once and Yes adds the saved name linked to the item`: `updateItem` resolves `{ ...item, status: 'low' }`. One alert is titled `shopping_prompt_title` with message `'Milk'`. Pressing `shopping_prompt_add` calls `addItem` once with `{ name: 'Milk', pantryItemId: '1' }`, then `back` is called once.
    - `Not now or dismissing adds nothing and closes`: there are no `addItem` calls, and `back` is called once for each case.
    - `unchanged status and changes to in stock never prompt`: no alert, and `back` is called.
    - `a failed pantry save shows the pantry error and never prompts`: `updateItem` rejects `{ code: '23505' }`. The form error is `err_duplicate_item`, with no alert and no `back`.
    - `a duplicate shopping add shows the translated notice and still closes`: `addItem` rejects `{ code: '23505' }`. The second alert is titled `shopping_prompt_failed_title` with message `err_duplicate_shopping_item`. After `common_ok`, `back` is called once, and the form shows no pantry error.
    - `a missing pantry link shows the link notice`: `addItem` rejects `{ code: '23503' }`, and the notice message is `err_shopping_link_missing`.
    - `Save stays locked until the prompt is answered`: while the prompt is open, a second Save press makes no second `updateItem` call. The Save button's `loading` is true, and Delete and Cancel are disabled.
    - `no prompt after the edit screen has closed during the save`: unmount the screen before `updateItem` resolves. No alert is shown.
    - `the shopping add is sent while the shopping list is still loading`: the `useShoppingItems` stub has `loading: true, items: []`. Yes still calls `addItem`.
- [ ] **Step 2: Run** `node --test tests/pantry-shopping.test.cjs tests/edit-item-prompt.test.cjs`. Expected: the new tests fail.
- [ ] **Step 3: Implement** `offersShoppingAdd`, the prompt flow above and the keys. Keep the existing edit screen's layout and its other behaviour unchanged.
- [ ] **Step 4: Run** `npm run test:fast`. Expected: exit 0, with the existing `screens.test.cjs` edit-item test passing unchanged apart from its stubs.
- [ ] **Step 5: Commit** `KAN-20: offer to add a pantry item to shopping after a low/out save`.

### Task 2: Pantry ↔ shopping independence tests and duplicate decision (KAN-22, KAN-21)

**Files:**
- Create: `pantry-flow/tests/integration/pantry-shopping.integration.ts`
- Modify: `pantry-flow/package.json` (append it to `test:integration`)
- Modify: `docs/planning/slice-2-shopping-database.md` (a short "Pantry add" paragraph under the duplicate rules)
- Modify: `docs/testing/coverage-matrix.md` (rows SHOP-LINK-01 and SHOP-LINK-02, plus the step 4 counts)

**Interfaces:**
- Consumes: `localStack`, `fixtures`, `cleanup` from `tests/integration/local-stack`, and the `lib/shopping-data` operations. Pantry rows are written with the ordinary client through `client.from('pantry_items')`, as `shopping-data.integration.ts` does.

- [ ] **Step 1: Write the failing integration test** `pantry and shopping stay independent with ordinary clients`, using one household's fixture user and reserved-fixture cleanup:
  - **Linked add:** create pantry item `Milk` (status `low`). `insertShoppingItem` with `{ name: 'Milk', pantryItemId }` returns `pantry_item_id === pantry.id`.
  - **Shopping changes leave pantry untouched:** snapshot the pantry row (`name, status, category, location, updated_at`). Then rename the linked item to `Oat milk`, complete it, reopen it, and delete it. Re-read the pantry row: it's identical to the snapshot.
  - **Pantry status changes never create shopping items:** update the pantry status to `out` and then `in_stock`. The shopping item count is unchanged.
  - **Duplicates:**
    - Insert an open manual `Bread`. A linked add of `bread` for a pantry item named `Bread` maps to `err_duplicate_shopping_item`.
    - Complete the manual `Bread`, and the linked add succeeds.
    - Reopening the completed manual `Bread` then maps to `err_duplicate_shopping_item`.
  - **Pantry deletion:** delete the pantry item behind a linked shopping item. The shopping row still exists, keeps its name, and has `pantry_item_id === null`.
- [ ] **Step 2: Run** `npm run test:local`, or `tsx --test tests/integration/pantry-shopping.integration.ts` against a running stack. Expected: the new file runs and passes, because the database and data module already implement these rules. If any case fails, stop and report it as a defect; don't change the expectation.
- [ ] **Step 3: Document KAN-21.** In `slice-2-shopping-database.md`, add a "Pantry add" paragraph:
  - the low/out prompt uses the same insert as a manual add, with the pantry link;
  - linked and manual items share the open-name space;
  - completed items never block;
  - duplicates are rejected with the translated message, never merged or renamed;
  - pantry deletion keeps the shopping name and clears the link.

  Add the coverage-matrix rows:
  - **SHOP-LINK-01:** the prompt fires only on a change to low or out; Yes adds once, linked; No or dismiss adds nothing; the pantry save is never reverted. Covered by `edit-item-prompt.test.cjs` and `pantry-shopping.test.cjs`.
  - **SHOP-LINK-02:** shopping changes never touch pantry; pantry status changes create no shopping items; duplicate outcomes; pantry deletion keeps a named standalone item. Covered by `pantry-shopping.integration.ts`.
- [ ] **Step 4: Run** `npm run test:fast` and `npm run test:local`. Expected: both exit 0.
- [ ] **Step 5: Commit** `KAN-22 KAN-21: pantry and shopping independence tests and duplicate decision`.

## Notes and rulings carried into execution

- **Prompt timing:** the prompt appears before the edit screen closes, as a native alert, and the screen closes after it's answered. A prompt shown after navigating back would need cross-screen state. Cost if wrong: moving the alert call.
- **A shopping add failure doesn't keep the screen open:** the pantry save already succeeded, so a native notice explains the failure and the screen then closes. Keeping the form open would invite a second, unnecessary pantry save. Cost if wrong: one callback.
- **No prompt if the edit screen closed before the save finished:** D3 places the prompt in the edit screen's save flow, so it must not appear over another screen. The pantry change is still saved. Cost if wrong: a skipped prompt in a rare race; the user can add the item manually.
- **The prompt's message is the item name.** The i18n layer has no interpolation, and Slice 2 is English-only (D5). Cost if wrong: one string change in the localization slice.
- **KAN-32** (PF-STATE-001: PantryProvider write before first load can leave the list loading) stays latent. The prompt runs only after a successful `updateItem` on a loaded item, and step 4 adds no new pantry write path.
- **Separate finding, not in this PR:** `lib/i18n/en.ts` `common_loading` contains a double-encoded ellipsis (`Loadingâ€¦`) from `e6dbcf8`. No screen uses the key today.
