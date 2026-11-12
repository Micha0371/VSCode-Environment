# Slice 2 step 3 (Shopping tab and interactions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give household members a Shopping tab, between Pantry and Settings, that shows the shared shopping list and lets them add, rename, complete, reopen and remove items.

**Architecture:** Two stacked PRs from current `main`.
- **Part A (step 3a, KAN-16 + KAN-18)** mounts the existing `ShoppingProvider`, adds the tab and renders the read-only list with loading, empty, error and retry states.
- **Part B (step 3b, KAN-17)** adds the interactions:
  - an inline add field;
  - a check circle on each row that completes or reopens the item;
  - a modal edit screen for renaming and removing.

The business rules stay in `lib/shopping-data.ts` and `hooks/useShoppingItems.tsx`. Screens only call the provider and translate its errors.

**Tech Stack:** Expo SDK 58 / React Native 0.88, expo-router tabs and modal stack, the existing `node:test` + react-test-renderer harness (`tests/helpers.cjs` `load(file, stubs)`), and Jest + RNTL for real native primitives.

**Spec:**
- [slice-2-implementation-plan.md](slice-2-implementation-plan.md): steps 3a and 3b, decisions D1, D2 and D5, and the engineering constraints.
- Jira KAN-16 (implement the shopping-list screen and navigation), KAN-17 (implement item creation, editing, completion, reopening and removal interactions) and KAN-18 (implement loading, empty, error and retry states).
- Owner UX decisions of 2026-11-12, quoted under Global Constraints.

## Global Constraints

- **Tab order:** Pantry, Shopping, Settings. The route file is `app/(tabs)/shopping.tsx`, the tab icon is Ionicons `cart-outline` and the title is `t('nav_shopping')`. Existing screens are not redesigned.
- **Owner decision 2026-11-12 (adding):** "Inline field": a name field and an Add button at the top of the Shopping tab. The new item appears immediately, and the field clears and keeps focus for the next item.
- **Plan review amendments (2026-11-12):**
  1. The field stays editable during an add. On success it clears only if it still holds exactly the submitted text, so a successful request never erases the next item the user has started typing.
  2. Clearing is independent of focus: it happens after success even when the tab has lost focus. The screen never calls `focus()` and never reopens the keyboard on a hidden tab. "Keeps focus" means only that `submitBehavior="submit"` does not blur the field on submit.
  3. Keyboard coverage is described accurately. Tests here pin the contract props (`keyboardShouldPersistTaps="handled"`, `submitBehavior`) and RNTL presses with real primitives. They do not establish real Android keyboard behaviour. First-tap-with-keyboard-open behaviour on the shopping screens is recorded as pending device verification, which belongs to step 5's Maestro journey.
- **Owner decision 2026-11-12 (editing):** "Tap name → edit modal". The row's circle toggles complete and reopen. Tapping the name opens a modal with the name field, Save, Cancel and Remove, where Remove asks for native confirmation.
- **Owner decision 2026-11-12 (completed items):** "Separate section". Open items appear under "To buy", newest first. Completed items appear under "Completed" below them, newest completion first, with a check mark and strikethrough. Completed items stay until removed individually (D2): there is no bulk clear.
- **Strings:** English only (D5). New keys go in `lib/i18n/en.ts`, with this exact copy:
  - `nav_shopping`: 'Shopping'
  - `shopping_empty_title`: 'Your shopping list is empty'
  - `shopping_empty_subtitle`: 'Add the things you need to buy.'
  - `shopping_section_open`: 'To buy'
  - `shopping_section_completed`: 'Completed'
  - `shopping_add_placeholder`: 'Add an item'
  - `shopping_add_button`: 'Add'
  - `shopping_edit_title`: 'Edit item'
  - `shopping_remove`: 'Remove'
  - `shopping_remove_confirm_title`: 'Remove item?'
  - `shopping_remove_confirm_message`: 'This removes the item from the shopping list for everyone in your household.'
  - Reuse the existing keys: `common_retry`, `common_cancel`, `common_back`, `item_save_button` and `item_name`.
- **Errors:** every displayed write error is `t(shoppingErrorKey(error))`. The list's load error is shown as the key the provider exposes.
- **Reuse:** `Button`, `Input`, `EmptyState`, `AuthGate`, `lib/theme.ts` and `hooks/useItemMutation.ts` (for the modal only; see Task 5). Add no dependencies.
- **Accessibility:** error text uses `accessibilityRole="alert"`, as the pantry screens do. The toggle uses `accessibilityRole="checkbox"` with `accessibilityState={{ checked, disabled }}` and `accessibilityLabel={item.name}`. No web-only roles.
- **Keyboard:** every scroll container on a screen with a text field sets `keyboardShouldPersistTaps="handled"`. This is the contract that fixed the Slice 1.1 first-tap keyboard defect. The tests assert the prop, not the device behaviour (amendment 3).
- **Test IDs:**
  - list: `shopping-screen`, `shopping-retry`, `shopping-section-open`, `shopping-section-completed`, `shopping-item-<id>` (the name), `shopping-toggle-<id>`;
  - add: `shopping-add-input`, `shopping-add-submit`, `shopping-action-error`;
  - edit: `shopping-edit-name`, `shopping-edit-save`, `shopping-edit-cancel`, `shopping-edit-remove`.
- **Tests:**
  - Screen tests use the `node:test` harness with string stubs for native primitives, as `tests/screens.test.cjs` does.
  - A component test in `tests/components` is used only where real native primitives matter.
  - Every PR passes `npm run test:fast` and `npm run test:local`.
- **Gates:**
  - Part A: screen tests.
  - Part B: screen tests, plus an owner-dispatched `workflow_dispatch` run of the Android job on the Part B branch. The journey there is the existing Slice 1.1 one; the shopping journey itself belongs to step 5.

## Review Focus

1. **First tap on Add with the keyboard open:** it must add the item and not only dismiss the keyboard. Task 3 pins the contract prop. Device verification is pending until step 5.
2. **Double tap on a row's circle:** sends one request, and the second tap is ignored rather than shown as an error. Covered in Task 4.
3. **Renaming to another open item's name:** shows the duplicate message and keeps the modal open with the typed text. Covered in Task 5.
4. **A failed complete or reopen:** keeps the list as it was and shows the error. The next successful action clears the error. Covered in Task 4.
5. **Switching tabs while an add is in flight:** the field is still cleared, so on return the user does not see the submitted text next to the new item. That would invite a duplicate. Text typed after submitting is kept. Covered in Task 3.

---

## Part A — step 3a (branch `pantryflow/kan-16-shopping-tab`, PR to `main`)

### Task 1: Mount the provider and add the Shopping tab

**Files:**
- Modify: `pantry-flow/app/_layout.tsx` (nest `ShoppingProvider` directly inside `PantryProvider`, around `StatusBar` and `Stack`)
- Modify: `pantry-flow/app/(tabs)/_layout.tsx` (a `Tabs.Screen name="shopping"` between `index` and `settings`)
- Create: `pantry-flow/app/(tabs)/shopping.tsx` (a placeholder screen returning `<View testID="shopping-screen" />`; Task 2 replaces it)
- Modify: `pantry-flow/lib/i18n/en.ts` (`nav_shopping`)
- Modify: `pantry-flow/jest.config.cjs` (`testTimeout: 30000`, with a comment explaining it)
- Create: `pantry-flow/tests/navigation.test.cjs`

**Interfaces:**
- Consumes: `ShoppingProvider` from `@/hooks/useShoppingItems`. It is keyed by user id internally and reads `useHouseholdScope()`, so it must sit inside `AuthProvider` and `HouseholdProvider`.
- Produces: the route `/(tabs)/shopping`. Root-layout nesting is now AuthProvider > HouseholdProvider > PantryProvider > ShoppingProvider > Stack.

- [ ] **Step 1: Write the failing tests** in `tests/navigation.test.cjs`:
  - `tab layout orders Pantry, Shopping, Settings behind the session gate`:
    - Load `app/(tabs)/_layout.tsx`, stubbing `expo-router` `Tabs` as a component that renders its children, with `Tabs.Screen = 'TabScreen'`. Stub `@/components/AuthGate` `AuthGate` as a component that renders `'Gate'` with its props and children. Use `t = key => key`.
    - Assert the `TabScreen` names are `['index', 'shopping', 'settings']`.
    - Assert the shopping screen's `options.title === 'nav_shopping'`.
    - Assert every `TabScreen` is a descendant of a `Gate` whose `requireSession` is `true`.
  - `root layout mounts ShoppingProvider inside the household scope and around the stack`:
    - Load `app/_layout.tsx`, with each provider stubbed as a component that renders a named host element plus its children.
    - Assert that the `Stack` host has, from the inside out, the ancestors `ShoppingProvider`, `PantryProvider`, `HouseholdProvider` and `AuthProvider`.
- [ ] **Step 2: Run** `node --test tests/navigation.test.cjs`. Expected: both tests fail, because there is no shopping screen and no `ShoppingProvider`.
- [ ] **Step 3: Implement** the layout changes, the placeholder screen, the `nav_shopping` key and the Jest `testTimeout`. The timeout comment must say that a cold transform cache on a fresh checkout took 10–12 s for the first component test against the 5 s default, as observed 2026-11-12.
- [ ] **Step 4: Run** `node --test tests/*.test.cjs` and `npx tsc --noEmit`. Expected: everything passes.
- [ ] **Step 5: Commit** `KAN-16: mount ShoppingProvider and add the Shopping tab`.

### Task 2: Shopping list screen states

**Files:**
- Modify: `pantry-flow/lib/shopping-data.ts` (add `splitShoppingItems`)
- Create: `pantry-flow/components/ShoppingItem.tsx`
- Modify: `pantry-flow/app/(tabs)/shopping.tsx`
- Modify: `pantry-flow/lib/i18n/en.ts` (`shopping_empty_title`, `shopping_empty_subtitle`, `shopping_section_open`, `shopping_section_completed`)
- Test: `pantry-flow/tests/shopping-data.test.cjs` (append) and a new `pantry-flow/tests/shopping-screen.test.cjs`
- Modify: `docs/testing/coverage-matrix.md` (a new SHOP-UI-01 row; see Step 5)

**Interfaces:**
- Consumes: `useShoppingItems()`, which returns `{ householdId, items, loading, error, retry, … }`; `ShoppingItem` (type) from `@/lib/shopping-data`.
- Produces:
  - `splitShoppingItems(items: ShoppingItem[]): { open: ShoppingItem[]; completed: ShoppingItem[] }`. `open` keeps the input order. `completed` is sorted by `completed_at` descending, then by `id` descending.
  - `ShoppingItem` component with props `{ item: ShoppingItem; onToggle?: () => void; onPress?: () => void; pending?: boolean }`:
    - It renders a circle `Pressable` (`shopping-toggle-<id>`, checkbox role and state, `disabled` when there is no `onToggle` or when `pending`) and a name `Pressable` (`shopping-item-<id>`, disabled when there is no `onPress`).
    - A completed item's name has `textDecorationLine: 'line-through'` and muted colour, and its circle shows an Ionicons `checkmark-circle`. An open item's circle shows `ellipse-outline`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/shopping-data.test.cjs`, `splitShoppingItems separates open from completed and orders completions newest first`. The input order is `open-b`, `done-old`, `open-a`, `done-new`, where `done-old` and `done-new` have `completed_at` values `'2026-01-01'` and `'2026-01-03'`. Expect `open.map(id)` to equal `['open-b', 'open-a']` and `completed.map(id)` to equal `['done-new', 'done-old']`. A tie on `completed_at` orders by id descending.
  - `tests/shopping-screen.test.cjs` (stubs as in `screens.test.cjs`, plus `SectionList: 'SectionList'` and `@expo/vector-icons`):
    - `initial shopping load shows progress without claiming an empty list`: `loading: true` with `items: []` shows one `Spinner` and no `EmptyState`.
    - `a refresh keeps the visible list instead of a spinner`: `loading: true` with one item shows a `SectionList` and no `Spinner`.
    - `a failed load shows the error with retry, not an empty list`: `error: 'err_load_shopping'` renders an `accessibilityRole="alert"` text containing `err_load_shopping`, and no `EmptyState`. Pressing `shopping-retry` calls `retry` exactly once.
    - `an empty list shows the empty state without an add action`: the `EmptyState` props are `title: 'shopping_empty_title'` and `subtitle: 'shopping_empty_subtitle'`, with no `ctaLabel`.
    - `open items come before completed items, each under its heading`:
      - The `SectionList` `sections` keys are `['open', 'completed']`, titled with the section keys. An empty section is omitted: with only open items, the keys are `['open']`.
      - The rendered completed row's toggle has `accessibilityState.checked === true`. The open row's toggle has `false`.
- [ ] **Step 2: Run** both test files. Expected: the new tests fail.
- [ ] **Step 3: Implement** `splitShoppingItems`, `components/ShoppingItem.tsx` and the screen. The screen's state precedence is the same as `app/(tabs)/index.tsx`: error, then the spinner (only while loading with no items), then the empty state, then the `SectionList`. The section headers are `Text` elements with the testIDs `shopping-section-open` and `shopping-section-completed`. In Part A, rows have no handlers.
- [ ] **Step 4: Run** `npm run test:fast`. Expected: exit 0.
- [ ] **Step 5: Add** the coverage-matrix row `SHOP-UI-01 | The Shopping tab is gated and placed between Pantry and Settings; loading, empty, error/retry and sectioned list states | navigation.test.cjs, shopping-screen.test.cjs (unit) | Interactions arrive in step 3b; real-keyboard behaviour is pending device verification in step 5`. Then commit `KAN-18: Shopping list loading, empty, error and sectioned list states`.

---

## Part B — step 3b (branch `pantryflow/kan-17-shopping-interactions`, stacked on Part A, retargeted to `main` after Part A merges)

### Task 3: Inline add

**Files:**
- Modify: `pantry-flow/app/(tabs)/shopping.tsx`
- Modify: `pantry-flow/lib/i18n/en.ts` (`shopping_add_placeholder`, `shopping_add_button`)
- Test: `pantry-flow/tests/shopping-screen.test.cjs` (append) and a new `pantry-flow/tests/components/shopping-add.test.tsx`

**Interfaces:**
- Consumes: `addItem(input: NewShoppingItemInput): Promise<ShoppingItem>`. It validates the name and the duplicate rule itself and rejects with coded errors. `shoppingErrorKey`.
- Produces: an add bar rendered above the list and above the empty state. It is not rendered in the error or initial-spinner states.

Ruling: the inline add uses a screen-local synchronous lock (a `useRef` boolean, a `busy` state and a mounted guard), not `useItemMutation`. `useItemMutation` drops its success callback when focus changes, which suits a modal that navigates away. On a tab that stays mounted, it would leave the submitted text in the field (Review Focus 5).

- [ ] **Step 1: Write the failing tests.**
  - `shopping-screen.test.cjs`:
    - `adding submits the typed name once, clears the field and keeps focus`:
      - Typing ` Milk ` and pressing `shopping-add-submit` twice synchronously calls `addItem` once, with `{ name: ' Milk ' }`. The provider trims the name.
      - After it resolves, the field value is `''`.
      - Submitting through `onSubmitEditing` behaves the same.
      - The input has `submitBehavior === 'submit'`, which keeps focus. It replaces the deprecated `blurOnSubmit`.
    - `a rejected add keeps the text and shows the translated error`: when `addItem` rejects with code `'23505'`, the field keeps ` Milk `, and the `Input` `error` prop is `'err_duplicate_shopping_item'`. The next successful add clears the error.
    - `an add still clears the field when focus changes during the request`: stub `expo-router` `useFocusEffect` so that it runs its cleanup before `addItem` resolves. The field is still `''`, which proves the add bar doesn't depend on screen focus.
    - `text typed while an add is in flight is kept`: submit `Milk`, then `changeText('Eggs')` before `addItem` resolves. After it resolves, the field is `'Eggs'`. The field's `editable` prop is never `false` during the request.
    - `the add bar never moves focus itself`: no `focus` call is made on the input. Use a ref stub that records `focus` calls, and expect none after a successful or a failed add.
    - `Add is disabled without a household`: with `householdId: null`, the `shopping-add-submit` `Button` has `disabled: true`.
    - `the list keeps the first tap with the keyboard open`: the `SectionList` has `keyboardShouldPersistTaps === 'handled'`.
  - `tests/components/shopping-add.test.tsx` (RNTL with the real `TextInput`, `Input` and `Button`): render the screen with a mocked `@/hooks/useShoppingItems`, `changeText` on `shopping-add-input`, then press `shopping-add-submit`. `addItem` is called with the typed name. This proves the wiring with real primitives, not Android keyboard behaviour (amendment 3).
- [ ] **Step 2: Run.** Expected: the new tests fail.
- [ ] **Step 3: Implement** the add bar (`Input` plus `Button`, in a row), the lock and the keyboard props. On success, use `setName(current => current === submitted ? '' : current)`.
- [ ] **Step 4: Run** `npm run test:fast`. Expected: exit 0.
- [ ] **Step 5: Commit** `KAN-17: inline add on the Shopping tab`.

### Task 4: Complete and reopen from the list

**Files:**
- Modify: `pantry-flow/app/(tabs)/shopping.tsx`
- Test: `pantry-flow/tests/shopping-screen.test.cjs` (append)

**Interfaces:**
- Consumes: `completeItem(id)`, `reopenItem(id)` and the `ShoppingItem` `onToggle`/`pending` props from Task 2.
- Produces: per-row pending state, and a list-level `shopping-action-error` alert text.

- [ ] **Step 1: Write the failing tests.**
  - `tapping an open item's circle completes it once even on a double tap`:
    - Two synchronous presses of `shopping-toggle-1` produce one `completeItem('1')` call and no error text.
    - While the call is pending, the row's `pending` prop is `true`.
  - `tapping a completed item's circle reopens it`: this calls `reopenItem`.
  - `a failed toggle shows the translated error and keeps the list`:
    - When `completeItem` rejects with `{ code: 'PGRST116' }`, the alert text is `'err_shopping_missing'`, and the `items` rendered are unchanged by the screen.
    - The next successful toggle removes the alert.
  - `pending toggles on different items run independently`: two items toggled together each produce one call.
- [ ] **Step 2: Run.** Expected: the new tests fail.
- [ ] **Step 3: Implement** a ref `Set<string>` lock with mirrored state for rendering, the mounted guard and the error state.
- [ ] **Step 4: Run** `npm run test:fast`. Expected: exit 0.
- [ ] **Step 5: Commit** `KAN-17: complete and reopen shopping items from the list`.

### Task 5: Edit modal (rename and remove)

**Files:**
- Create: `pantry-flow/app/shopping-item/[id].tsx`
- Modify: `pantry-flow/app/_layout.tsx` (`<Stack.Screen name="shopping-item/[id]" options={{ presentation: 'modal', title: '' }} />`)
- Modify: `pantry-flow/app/(tabs)/shopping.tsx` (the row `onPress` calls `router.push(`/shopping-item/${id}`)`)
- Modify: `pantry-flow/lib/i18n/en.ts` (`shopping_edit_title`, `shopping_remove`, `shopping_remove_confirm_title`, `shopping_remove_confirm_message`)
- Test: `pantry-flow/tests/shopping-edit.test.cjs` (new), plus additions to `tests/navigation.test.cjs` and `tests/shopping-screen.test.cjs`
- Modify: `docs/testing/coverage-matrix.md` (a new SHOP-UI-02 row)

**Interfaces:**
- Consumes: `getItem(id)`, `renameItem(id, name)`, `deleteItem(id)`, `loading`, `error` and `retry` from `useShoppingItems()`; `useItemMutation()` (`{ busy, run }`); `SHOPPING_NAME_MAX` and `shoppingErrorKey`.
- Produces: the route `/shopping-item/[id]`. Its structure mirrors `app/edit-item/[id].tsx`: an `AuthGate requireSession` wrapper and content keyed by `id`.

- [ ] **Step 1: Write the failing tests.**
  - `shopping-edit.test.cjs`:
    - `the modal shows the current name and saves a rename, then closes`: `renameItem('1', 'Oat milk')` is called once, then `router.back()` is called once.
    - `a duplicate rename keeps the modal open with the typed name`: `renameItem` rejects with code `'23505'`. The error is `'err_duplicate_shopping_item'`, the field keeps `'Milk'`, and `back` is not called.
    - `remove asks for confirmation and deletes only on confirm`: the `Alert.alert` stub records the buttons. Cancel calls nothing. The destructive button calls `deleteItem('1')` once, then `back`.
    - `save and remove share one lock`: pressing Save and then confirming Remove before the rename settles produces one write call.
    - `a missing item shows the missing message with retry and back`: `getItem` returns `null` with `loading: false`, and the text is `'err_shopping_missing'`.
    - `the form keeps the first tap with the keyboard open`: the `ScrollView` has `keyboardShouldPersistTaps === 'handled'`.
  - `navigation.test.cjs`: the root `Stack` has a `Stack.Screen` named `'shopping-item/[id]'` with `presentation: 'modal'`.
  - `shopping-screen.test.cjs`: pressing `shopping-item-1` pushes `'/shopping-item/1'`.
- [ ] **Step 2: Run.** Expected: the new tests fail.
- [ ] **Step 3: Implement** the modal, the route registration and the row navigation.
- [ ] **Step 4: Run** `npm run test:fast` and `npm run test:local`. Expected: exit 0.
- [ ] **Step 5: Add** the coverage-matrix row `SHOP-UI-02 | Inline add, complete/reopen, rename and confirmed remove with locks, translated errors and keyboard-safe taps | shopping-screen.test.cjs, shopping-edit.test.cjs, components/shopping-add.test.tsx | Android shopping journey and first-tap-with-keyboard device verification arrive in step 5`. Then commit `KAN-17: rename and remove shopping items in an edit modal`.

## Notes and rulings carried into execution

- KAN-16 and KAN-18 were written before the provider existed. Their "shared shopping provider contract" is `hooks/useShoppingItems.tsx` on `main`. The "KAN-11 operations" that KAN-17 mentions are its operations.
- PRD Flow 5 ("checking off removes the item") and its "All items checked: option to clear" are superseded by D2.
- The Jest timeout raise addresses the cold-cache failures of 2026-11-11 and 2026-11-12. It is not a cover for slow tests: a warm run takes about 1.8 s.
- Part B's Android gate runs the existing Slice 1.1 journey only, to prove that the new tab and providers do not regress it. Maestro shopping coverage is step 5.
- Pending device verification, for step 5: on Android, the first tap on Add, on a row circle and on the edit modal's Save and Remove must work while the keyboard is open (amendment 3).
