# Slice 2 Step 2 — Shared Household Scope and Shopping State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Share one household lookup between providers (step 2a, KAN-11), then add the shopping data module and `ShoppingProvider` with unit and local-stack tests (step 2b, KAN-12/13/14).

**Architecture:** A new `HouseholdProvider` runs the existing `useHousehold()` once. `PantryProvider` consumes it, and `ShoppingProvider` will too. `lib/shopping-data.ts` holds validation, parsing, error mapping and the Supabase calls; it takes the client as a parameter, like `fetchAllItems`, so integration tests can call it with ordinary clients. `hooks/useShoppingItems.tsx` copies `usePantryItems.tsx`'s identity key, generation guards and per-item pending set. No UI changes in step 2.

**Tech Stack:** Expo SDK 58 / React Native 0.88, TypeScript, supabase-js, node:test with react-test-renderer through `tests/helpers.cjs` `load()`, tsx for local-stack integration tests.

**Spec:** [docs/planning/slice-2-implementation-plan.md](slice-2-implementation-plan.md) (D1–D6, steps 2a/2b, engineering constraints); [docs/planning/slice-2-shopping-database.md](slice-2-shopping-database.md) (the 00004 contract); Jira KAN-11 (Shopping List Operations) with subtasks KAN-12 (create, read, update, complete/reopen and delete operations), KAN-13 (input validation, authorization handling and error mapping) and KAN-14 (unit and integration tests).

**Branches:** Part A (Task 1) on `pantryflow/kan-11-household-scope` from `main`; its PR merges first. Part B (Tasks 2–4) on `pantryflow/kan-12-shopping-data`, branched from Part A's head.

## Global Constraints

- All commands run from `pantry-flow/`. Fast gate: `npm run test:fast`. Database gate (needs the local stack): `npm run test:local`.
- No UI or screen changes, and `ShoppingProvider` is **not** mounted in `app/_layout.tsx` in step 2; step 3a mounts it when the Shopping tab consumes it.
- No new dependencies; no migration, workflow or hosted changes; no realtime, offline queue or backend.
- PostgreSQL is authoritative; client checks are a convenience. Client name rules mirror 00003/00004: edge trim with `String.prototype.trim`, case-insensitive comparison with `toLowerCase()`, interior whitespace significant, length 1–120 **code points** (`Array.from(name).length`).
- D1: names are unique among **open** (`is_checked = false`) items per household; completed names may repeat. A duplicate add, rename or reopen fails with code `23505`; nothing is merged or renamed.
- D2: completion is the server-set `completed_at`; reopen clears it; completed items stay until deleted. Clients write only `is_checked`, never timestamps.
- D5: new strings are English-only, added to `lib/i18n/en.ts` only; `de` falls back to English.
- Business rules live in `lib/` data modules and providers, never in screen handlers.
- Existing pantry behavior and existing tests stay green; pantry changes are limited to what each task names.
- Commit messages start with the Jira key(s) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Review Focus

- Sign-out or household change while a shopping write is in flight must not repopulate the next user's list (Task 3 test).
- Renaming a **completed** item to an open item's name is allowed by D1; the client check must not block it (Tasks 2 and 3 tests).
- Reopening an item that was deleted meanwhile returns `PGRST116`; it maps to the missing-record key and must not resurrect the row (Task 3 test).
- A household lookup failure must be retried through the shared `refreshHousehold`, so one retry recovers both providers (Tasks 1 and 3 tests).
- A malformed server row returned from a write must be rejected, leaving prior state unchanged (Task 3 test).

---

## Part A — Step 2a (KAN-11 household scope)

### Task 1: Shared `HouseholdProvider`

**Files:**
- Create: `pantry-flow/hooks/household-scope.tsx`
- Modify: `pantry-flow/hooks/usePantryItems.tsx` (import and the one `useHousehold()` call only)
- Modify: `pantry-flow/hooks/useHousehold.ts` (comment on line 5 only: "Used once by HouseholdProvider; providers and screens consume useHouseholdScope.")
- Modify: `pantry-flow/app/_layout.tsx` (wrap `PantryProvider` in `HouseholdProvider`, inside `AuthProvider`)
- Modify: `pantry-flow/tests/pantry-state.test.cjs` (stub key `'./useHousehold'` → `'./household-scope'` exporting `useHouseholdScope`; no other change)
- Test: `pantry-flow/tests/household-scope.test.cjs`

**Interfaces:**
- Produces:
  - `HouseholdProvider({ children }: { children: ReactNode })`: keyed by `user?.id ?? 'guest'` through an inner scoped provider, the same pattern as `PantryProvider`; calls `useHousehold()` exactly once.
  - `useHouseholdScope(): { householdId: string | null; loading: boolean; error: string | null; refreshHousehold: () => Promise<void> }`. It throws `Error('useHouseholdScope must be used within HouseholdProvider')` outside the provider.
- Consumes: `useHousehold()` from `./useHousehold` (unchanged) and `useAuth()` from `@/lib/auth`.

- [ ] **Step 1: Write failing tests in `tests/household-scope.test.cjs`.** Load `hooks/household-scope.tsx` with stubs `'@/lib/supabase'` (a `from()` spy whose `single()` returns a deferred) and `'@/lib/auth'`. Tests:
  - `one lookup is shared by every consumer under HouseholdProvider`: two consumers render; resolve the lookup once with `{ data: { household_id: 'h1' }, error: null }`. Assert the spy saw exactly 1 `from('pantry_household_members')` call and both consumers report `householdId === 'h1'`, `loading === false`.
  - `a user change re-keys the scope and old results cannot leak`: user `alice` → `bob` before the first lookup resolves. Resolving alice's lookup leaves `householdId === null`; bob's lookup sets `'bob-home'`.
  - `a failed lookup exposes err_no_household and one refresh recovers all consumers`: reject → both see `error === 'err_no_household'`; call `refreshHousehold()`, resolve → both see the new id with `error === null`.
  - `useHouseholdScope outside HouseholdProvider throws`.
  - `PantryProvider consumes the shared scope`: load `hooks/usePantryItems.tsx` with the real `./household-scope` module, compiled via `load` with the same stubs. Pass that **same module instance** both as the `'./household-scope'` stub and as the source of `HouseholdProvider`, because context identity depends on it. and `'@/lib/pantry-data'` with `fetchAllItems` as a spy. Render `HouseholdProvider > PantryProvider > consumer`. Assert `fetchAllItems` is called with `'h1'` after the lookup, and that with a failed lookup the pantry `retry()` triggers a second household lookup rather than an items fetch.
- [ ] **Step 2: Run** `node --test tests/household-scope.test.cjs`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `hooks/household-scope.tsx`. Replace `usePantryItems.tsx`'s `useHousehold()` call with `useHouseholdScope()`, keeping the destructured names identical. Update the `useHousehold.ts` comment, `_layout.tsx` and the `pantry-state.test.cjs` stub key.
- [ ] **Step 4: Run** `node --test tests/household-scope.test.cjs tests/pantry-state.test.cjs tests/household.test.cjs`, then `npm run test:fast`. Expected: all pass; existing test bodies unchanged.
- [ ] **Step 5: Commit** — `KAN-11: share one household scope between providers`.

---

## Part B — Step 2b (KAN-12/13/14 shopping data and state)

### Task 2: Shopping data module and shared pagination

**Files:**
- Create: `pantry-flow/lib/pagination.ts`
- Modify: `pantry-flow/lib/pantry-data.ts` (`fetchAllItems` delegates to `fetchAllPages`; `PAGE_SIZE` stays exported from `pantry-data.ts` as a re-export)
- Create: `pantry-flow/lib/shopping-data.ts`
- Modify: `pantry-flow/lib/i18n/en.ts` (six keys below)
- Test: `pantry-flow/tests/shopping-data.test.cjs`; existing `tests/pantry-data.test.cjs` must pass unchanged

**Interfaces:**
- Produces in `lib/pagination.ts`:
  - `PAGE_SIZE = 200`;
  - `fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown; count: number | null }>, parse: (row: unknown) => T): Promise<T[]>`. It contains the exact loop from today's `fetchAllItems`, including the error messages `'Incomplete inventory'` and `'Server row limit is below page size'`.
- Produces in `lib/shopping-data.ts` (no `@/` imports, so tsx integration tests can import it):
  - `interface ShoppingItem { id: string; household_id: string; pantry_item_id: string | null; name: string; is_checked: boolean; completed_at: string | null; created_by: string | null; created_at: string; updated_at: string }`
  - `interface NewShoppingItemInput { name: string; pantryItemId?: string | null }`
  - `SHOPPING_NAME_MAX = 120`
  - `validateShoppingName(name: string): string` returns the trimmed name. On an empty or over-120-code-point name it throws an `Error` with `code: 'PF_INVALID_SHOPPING'`.
  - `assertUniqueOpenName(items: ShoppingItem[], name: string, excludeId?: string): void` considers only `!is_checked` items and throws `{ code: '23505' }`.
  - `parseShoppingItem(value: unknown): ShoppingItem`
  - `shoppingErrorKey(error: unknown): ShoppingErrorKey`
  - `fetchAllShoppingItems(client: SupabaseClient, householdId: string): Promise<ShoppingItem[]>` filters `household_id`, orders by `created_at` desc then `id` desc, and uses `fetchAllPages`.
  - `insertShoppingItem(client, householdId: string, userId: string, input: NewShoppingItemInput): Promise<ShoppingItem>` inserts exactly `{ household_id, name, pantry_item_id, created_by }`, with `pantry_item_id` defaulting to `null`.
  - `renameShoppingItem(client, householdId: string, id: string, name: string): Promise<ShoppingItem>` updates exactly `{ name }`.
  - `setShoppingItemChecked(client, householdId: string, id: string, checked: boolean): Promise<ShoppingItem>` updates exactly `{ is_checked }`.
  - `deleteShoppingItem(client, householdId: string, id: string): Promise<void>` selects `id`; zero rows throws an `Error` with `code: 'PF_SHOPPING_MISSING'`.
  - Every update and delete filters `.eq('id', id).eq('household_id', householdId)`. Insert and update use `.select().single()` and parse the result.
- Error mapping (exact): `'23505'` → `'err_duplicate_shopping_item'`; `'42501'` → `'err_shopping_permission'`; `'PGRST116'` or `'PF_SHOPPING_MISSING'` → `'err_shopping_missing'`; `'PF_INVALID_SHOPPING'`, `'23514'`, `'23502'`, `'23503'` or `'22P02'` → `'err_shopping_invalid'`; anything else, including non-objects and plain transport errors → `'err_save_shopping'`.
- `en.ts` keys (exact copy):
  - `err_load_shopping: 'Could not load the shopping list.'`
  - `err_save_shopping: 'Could not save the shopping list item. Please try again.'`
  - `err_duplicate_shopping_item: 'This item is already on your shopping list.'`
  - `err_shopping_invalid: 'Use a name of 1 to 120 characters.'`
  - `err_shopping_permission: 'You do not have access to this shopping list.'`
  - `err_shopping_missing: 'This shopping list item is no longer available.'`

- [ ] **Step 1: Write failing tests in `tests/shopping-data.test.cjs`:**
  - `validation trims edges, keeps interior whitespace and bounds code points`: `''`, `'   '`, `' '` and 121 `'a'` throw with `code === 'PF_INVALID_SHOPPING'`; `' Milk '` → `'Milk'`; `'Milk  Fridge'` is unchanged; 120 × `'\u{1F34E}'` passes.
  - `parsing rejects malformed rows`: rejects `is_checked: 'false'`, checked with `completed_at: null`, open with a timestamp, `pantry_item_id: 5`, `household_id: null` and `name: ' Milk '`; accepts `pantry_item_id: null` and `created_by: null`.
  - `open-name uniqueness ignores completed items and self`: `'milk'`, `' MILK '` and `' milk '` against open `Milk` throw `23505`; the same names against a completed `Milk` pass; `excludeId` of the open item passes; `'Milk  Fridge'` vs `'Milk Fridge'` passes.
  - `error mapping follows the contract`: a table test over every code listed above, plus `new Error('offline')` and `null` → `'err_save_shopping'`. Every returned key exists in `en` (load `lib/i18n/en.ts`).
  - `reads page beyond the server cap and never return partial lists`: the 1207-row and small-cap/failed-page cases, mirroring `pantry-data.test.cjs`. Assert `eq('household_id', 'h')` and both `order` calls.
  - `writes send only contract columns and scope by household`: a recording client stub asserts the payloads and `eq` calls listed in Interfaces. Delete with `data: []` rejects with code `PF_SHOPPING_MISSING`.
- [ ] **Step 2: Run** `node --test tests/shopping-data.test.cjs`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `lib/pagination.ts`, the `fetchAllItems` delegation, `lib/shopping-data.ts` and the `en.ts` keys.
- [ ] **Step 4: Run** `node --test tests/shopping-data.test.cjs tests/pantry-data.test.cjs tests/i18n.test.cjs`, then `npm run test:fast`. Expected: all pass.
- [ ] **Step 5: Commit** — `KAN-12 KAN-13: shopping data module and shared pagination`.

### Task 3: `ShoppingProvider` state

**Files:**
- Create: `pantry-flow/hooks/useShoppingItems.tsx`
- Test: `pantry-flow/tests/shopping-state.test.cjs`

**Interfaces:**
- Consumes: `useHouseholdScope()` from `./household-scope` (Task 1); `useAuth()` from `@/lib/auth`; `supabase` from `@/lib/supabase`; all of Task 2's `lib/shopping-data.ts` exports, imported as `@/lib/shopping-data`.
- Produces:
  - `ShoppingProvider({ children })`, keyed by `user?.id ?? 'guest'` and requiring `HouseholdProvider` above it;
  - `useShoppingItems()`. Outside the provider it throws `Error('useShoppingItems must be used within ShoppingProvider')`. It returns: `{ householdId: string | null; items: ShoppingItem[]; loading: boolean; error: string | null; fetchItems(): Promise<void>; retry(): Promise<void>; addItem(input: NewShoppingItemInput): Promise<ShoppingItem>; renameItem(id: string, name: string): Promise<ShoppingItem>; completeItem(id: string): Promise<ShoppingItem>; reopenItem(id: string): Promise<ShoppingItem>; deleteItem(id: string): Promise<void>; getItem(id: string): ShoppingItem | null }`.
- Behavior, matching `usePantryItems.tsx`:
  - The load error key is `'err_load_shopping'`.
  - `retry` is `refreshHousehold` when there is a household error or no household, otherwise `fetchItems`.
  - Every mutation bumps the generation before sending, and applies its result only if the scope is still current.
  - `renameItem`, `completeItem`, `reopenItem` and `deleteItem` hold a per-item pending set. A second call for the same id throws `Error('Shopping item change is already pending')` without an API call.
  - Client prevalidation before any API call:
    - `addItem` runs `validateShoppingName` and `assertUniqueOpenName`.
    - `renameItem` runs `validateShoppingName`; it also runs `assertUniqueOpenName` excluding itself, but only when the item is open.
    - `reopenItem` runs `assertUniqueOpenName` on the item's name, excluding itself, when the item is in the visible list.
    - `completeItem` has no duplicate check.
  - Visible items are filtered to the current `householdId`.

- [ ] **Step 1: Write failing tests in `tests/shopping-state.test.cjs`.** The fixture follows `pantry-state.test.cjs`: two consumers, a `'./household-scope'` stub and `'@/lib/shopping-data'` with deferred `fetchAllShoppingItems` and controllable write functions that record calls. Tests:
  - `both consumers observe add, rename, complete, reopen and delete; old reads cannot undo a write`
  - `newest read wins and a user or household change clears state and discards old requests`
  - `failed initial fetch is err_load_shopping and retry recovers; a household error retries the shared lookup`
  - `a pending change locks the same item while other items stay available`
  - `client duplicate checks apply to open items only`: add a duplicate of an open name rejects `23505` with no write call; adding a completed item's name succeeds; renaming a completed item to an open item's name is sent; reopening into an open duplicate rejects `23505` with no write call.
  - `failed or malformed writes leave state intact and allow retry`: a transport error and a malformed returned row (parse failure) each leave `items` unchanged. A reopen rejected with `{ code: 'PGRST116' }` leaves the item checked and present.
  - `a pending mutation cannot repopulate the next signed-in user's list`
  - `concurrent adds of one name leave exactly one item`: two `addItem('Eggs')` calls start before either resolves, so both pass the client check. The stub's second insert rejects with `{ code: '23505' }`. One call fulfils, the other rejects with `23505`, and both consumers show exactly one `Eggs`.
  - `useShoppingItems outside ShoppingProvider throws`
- [ ] **Step 2: Run** `node --test tests/shopping-state.test.cjs`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `hooks/useShoppingItems.tsx`.
- [ ] **Step 4: Run** `node --test tests/shopping-state.test.cjs`, then `npm run test:fast`. Expected: all pass.
- [ ] **Step 5: Commit** — `KAN-12 KAN-14: shopping provider with guarded shared state`.

### Task 4: Local-stack integration tests and coverage docs

**Files:**
- Create: `pantry-flow/tests/integration/shopping-data.integration.ts`
- Modify: `pantry-flow/package.json` (append the file to the `test:integration` list)
- Modify: `docs/testing/coverage-matrix.md` (Slice 2 rows `SHOP-STATE-01`–`SHOP-STATE-04` under the existing Slice 2 database section)

**Interfaces:**
- Consumes: `localStack`, `fixtures`, `cleanup` from `./local-stack`; Task 2's `lib/shopping-data.ts` functions, imported relatively as `../../lib/shopping-data`.

- [ ] **Step 1: Write the test** `shopping data module against real local Auth/PostgREST`, using ordinary clients from `fixtures()` and `cleanup(stack.admin)` in `finally`. Subtests:
  - `ordinary members persist and read back all six operations`: insert a manual item and one linked to a new pantry item; `fetchAllShoppingItems` returns both; rename; `setShoppingItemChecked(true)` sets `completed_at`; `(false)` clears it; delete; the read-back no longer contains it.
  - `database rejections map to contract keys when client checks are bypassed`, mapping each case through `shoppingErrorKey`:
    - duplicate open insert → `err_duplicate_shopping_item`;
    - foreign-household insert → `err_shopping_permission`;
    - foreign pantry link → `err_shopping_invalid`;
    - a 121-character name sent through the raw client → `err_shopping_invalid`;
    - rename of another household's id → `err_shopping_missing`;
    - delete of another household's id → `err_shopping_missing`.
  - `completed names may repeat and reopen into an open duplicate fails`.
- [ ] **Step 2: Run** `npm run test:local` (local stack started with `npm run db:start` if needed). Expected: the new tests and all existing database/integration tests pass.
- [ ] **Step 3: Update** `coverage-matrix.md` with the four rows: data validation and mapping; provider state; local-stack operations; interrupted/stale requests (unit-level). For each row, the Limit column states what is not covered, for example that no UI consumes it until step 3.
- [ ] **Step 4: Run** `npm run test:fast` again. Expected: pass.
- [ ] **Step 5: Commit** — `KAN-14: local-stack shopping data tests and coverage`.

## Notes and rulings carried into execution

- "Interrupted" operations (KAN-14) are covered at the provider level: unmount, sign-out, household change and superseded reads. Local-stack tests cover real success and rejection paths. Aborting an HTTP request mid-flight cannot prove whether it committed, so it gives no useful assertion.
- Relinking `pantry_item_id` from the client is not exposed in step 2 (YAGNI); step 4's prompt only creates linked items.
- `ShoppingProvider` mounting, screens and the low/out prompt belong to steps 3a, 3b and 4.
