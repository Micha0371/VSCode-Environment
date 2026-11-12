# Slice 2 step 5: Android shopping journey and physical-device evidence — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (recommended here) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A fresh Android test build runs the shopping journey (create, edit, complete, reopen, remove, and the low/out pantry prompt) against isolated local Supabase, with database read-back. The same build then runs on the owner's physical phone, and the evidence is recorded.

**Tickets:**
- KAN-25 ([Slice 2] Implement a Maestro Android E2E scenario for the shopping-list workflow);
- KAN-26 ([Slice 2] Execute physical-device smoke testing and collect release evidence);
- device items from KAN-36 (PF-PROMPT-001: low/out prompt follow-ups).

**Spec:**
- `docs/planning/slice-2-implementation-plan.md`: step 5 row, owner decisions D1–D4, engineering constraints;
- the KAN-25 and KAN-26 definitions of done;
- the device checklists in the step 3 and step 4 plans.

**Baseline:** `main` at `eabb43f` (PR #33). Branch `pantryflow/kan-25-26-shopping-e2e`.

## What exists

- **`.maestro/slice-1-1.yaml`:** the pantry journey on `com.pantryflow.test`. It leaves Alice with one pantry item, Milk (Dairy, Low), which `e2e-fixtures.ts verify` asserts. Bob's household is empty.
- **`scripts/run-e2e.cjs`:** it does the following, in order:
  - starts the loopback proxy `scripts/e2e-proxy.cjs` on 127.0.0.1:54329;
  - runs `prepare` and installs `.verification/pantryflow-test.apk`;
  - runs the Slice 1.1 flow, then `verify`, then the confirmation flows;
  - in `finally`, captures logcat, applies the font/asset gate and runs `cleanup`.
- **Proxy fault hooks:** `fail-reads` (pantry GET only), `delay-write` (pantry PATCH), `wait-write` and `restore`. There's no shopping fault yet.
- **Shopping testIDs:**
  - `shopping-screen`, `shopping-add-input`, `shopping-add-submit`, `shopping-retry`, `shopping-action-error`, `shopping-section-open` and `shopping-section-completed`;
  - `shopping-toggle-<id>`, whose accessibility label is the item name, and `shopping-item-<id>`;
  - `shopping-edit-name`, `shopping-edit-save`, `shopping-edit-cancel` and `shopping-edit-remove`.
- **Android alert buttons:** React Native maps the last button to `android:id/button1` and the one before it to `button2`:
  - prompt: Add is `button1`, Not now is `button2`;
  - failure notice: OK is `button1`;
  - remove confirmation: Remove is `button1`, Cancel is `button2`.
- **CI:** the Android job runs only on `workflow_dispatch`, the schedule or `[full-e2e]`. It uses an ubuntu runner with an API 35 x86_64 emulator and Maestro CLI 2.12.0.
- **Local tooling:**
  - Docker is running;
  - Maestro 2.12.0 is in the main checkout's ignored `.verification/maestro-tools`;
  - Android Studio's bundled Java runtime can serve the Gradle build (the `java` on PATH is 1.8);
  - the device recipe is in `docs/testing/README.md` ("Physical-device SDK smoke test").
- **Device:** 23122PCD1G on Android 16, connected over Wi-Fi ADB at 192.168.0.100:39949. `com.pantryflow.test` from an earlier run and `com.pantryflow.app` are both installed. The production-package app is never touched.

## Global constraints

- Only the separate test APK (`com.pantryflow.test`) and only local Supabase, through the loopback proxy and `adb reverse tcp:54329 tcp:54329`. Never expose the stack on the LAN or put an admin key in the APK. Nothing hosted.
- Reserved fixture accounts only. Exact cleanup, and a failed cleanup is a failed run.
- No application behaviour change. If the journey finds a defect, it gets its own failing case and a separate decision; it isn't worked around in the flow.
- The Slice 1.1 and confirmation journeys are kept unchanged and still run first.
- No macOS or iOS CI. iOS stays out of scope (PF-IOS-001).

## Review focus

1. **Wi-Fi ADB dropping mid-run.** The runner's `finally` still cleans fixtures and the proxy. A rerun starts again from `prepare`, and no half-state counts as evidence.
2. **Alert timing.** The prompt appears only after the save's network round trip, so the flow waits with `extendedWaitUntil` and never assumes it appears immediately.
3. **Ambiguous name selectors.** A shopping row's name text and its toggle's label are the same string, and the alert's "Add" duplicates the Add button. Toggles are tapped by id pattern plus a relative selector, and alert buttons by system id.
4. **The shopping read fault must be contained.** It must not affect pantry reads, and `restore` must clear it, or the later confirmation flows fail for the wrong reason.
5. **Read-back must prove the outcome, not that the screens looked right.** It checks:
   - the exact final rows;
   - the link to Milk's pantry id;
   - completion state;
   - Milk's pantry row unchanged by shopping edits;
   - Bob has no rows.

---

### Task 1 (KAN-25): shopping journey on the emulator path

**Files:**
- Create `.maestro/slice-2-shopping.yaml` and `.maestro/helpers/fail-shopping-reads.js`.
- Modify:
  - `scripts/e2e-proxy.cjs`: a `fail-shopping-reads` hook for GET `/rest/v1/pantry_shopping_items`, cleared by `restore`;
  - `scripts/e2e-fixtures.ts`: a `shopping-verify` command;
  - `scripts/run-e2e.cjs`: run the new flow and `shopping-verify` after `verify`, with its own JUnit report; an optional `PANTRY_TEST_APK` path;
  - `docs/testing/README.md` and `docs/testing/coverage-matrix.md`.

**The journey.** Alice starts with Milk (Low) left by the Slice 1.1 flow. Each line is an assertion point:
1. Log in through `helpers/login.yaml`. The Pantry tab shows Milk.
2. **Back dismisses the prompt.** Edit Milk, set Out and Save. Wait for "Add to shopping list?" with the message "Milk", then press Android `back`. The screen closes, Milk shows Out, and Shopping is still empty.
3. **Not now.** Edit Milk, set Low and Save, then tap `button2`. The screen closes and Shopping is still empty.
4. **Add.** Edit Milk, set Out and Save, then tap `button1`. On Shopping, Milk appears under "To buy".
5. **First tap with the keyboard open.** On Shopping, type "Bread" into `shopping-add-input` without hiding the keyboard, and tap `shopping-add-submit` once. Bread appears and the field is empty.
6. **Duplicate.** Add " milk ". "This item is already on your shopping list." appears.
7. **Duplicate notice from the prompt.** Edit pantry Milk, set Low and Save, then tap `button1`. "Not added to the shopping list" appears with the duplicate message. Tap OK (`button1`). The screen closes, Milk shows Low, and Shopping has a single Milk.
8. **Complete and reopen.** Toggle Bread. It moves under "Completed"; take a screenshot `completed-state`. Toggle it again and it's back under "To buy". Toggle it once more and leave it completed.
9. **Rename with the keyboard open.** Tap Bread, replace the name with "Rye bread" and tap Save without hiding the keyboard. "Rye bread" is listed.
10. **Remove.** Add "Eggs" and open it. Remove, then Cancel (`button2`); the modal stays. Remove, then confirm (`button1`); Eggs is gone.
11. **Tab switch keeps a draft.** Type "Cheese" without submitting, switch to Pantry and back. "Cheese" is still in the field. Clear it.
12. **Restart.** `launchApp` without clearing state. Milk (to buy) and Rye bread (completed) are shown.
13. **Failure and retry.** Turn on `fail-shopping-reads` and `launchApp`. The translated load error appears. `restore`, tap `shopping-retry`, and the items return.
14. **Isolation.** Sign out and log in as Bob. Shopping shows the empty state.

**`shopping-verify`**, run with ordinary clients and no admin reads of app data:
- Alice has exactly two shopping rows:
  - Milk: open, `pantry_item_id` equal to her Milk pantry id;
  - Rye bread: completed (`is_checked`, `completed_at` set), with no link.
- Alice's Milk pantry row is Dairy, Low, still named "Milk", and her only pantry item.
- Bob has no shopping rows and no pantry rows.

- [ ] **Step 1:** Proxy hook and helper. Add a new `tests/e2e-proxy.test.cjs` (no e2e-script tests exist yet), written failing first. It starts the proxy against a stub upstream and asserts that the shopping fault returns 503 only for shopping GETs, that pantry GETs and shopping writes pass through, and that `restore` clears it.
- [ ] **Step 2:** `shopping-verify` and the runner changes, keeping the existing order: Slice 1.1, `verify`, shopping, `shopping-verify`, then the confirmation flows.
- [ ] **Step 3:** The flow, written and debugged against the physical phone, because one ARM64 build serves all flow iterations. It runs with `PANTRY_TEST_TARGET=device`, `PANTRY_TEST_ARCHITECTURES=arm64-v8a`, `ANDROID_SERIAL=192.168.0.100:39949`, and `PANTRY_TEST_APK` pointing at the ARM64 APK.
- [ ] **Step 4:** Docs. Add rows SHOP-E2E-01 (journey) and SHOP-E2E-02 (read-back and isolation) to the coverage matrix, and fill in the "step 5" remaining-acceptance cells of SHOP-UI-01, SHOP-UI-02 and SHOP-LINK-01. The README recipe gets the new flow, `PANTRY_TEST_APK` and the shopping fault.
- [ ] **Step 5:** Local gates: `npm run test:fast` and `npm run test:local`. Commit `KAN-25: Android shopping journey with database read-back`.
- [ ] **Step 6:** Push. The owner dispatches the Android workflow on the branch (ubuntu emulator). It must pass on the emulator as well as the phone.

### Task 2 (KAN-26): physical-device evidence

- [ ] **Step 1:** A complete `npm run test:e2e` on the phone from the final commit's fresh ARM64 build: Slice 1.1, shopping, then the confirmation flows, followed by logcat font/asset gate and cleanup.
- [ ] **Step 2:** Review the screenshots: completed state (strikethrough and checkmark), native icons and fonts on the Shopping tab, and the prompt. The owner confirms the visuals.
- [ ] **Step 3:** Record the evidence in a new coverage-matrix section, "Slice 2 Android evidence (KAN-25, KAN-26)":
  - commit and APK architecture;
  - device model and Android version;
  - each flow's result and the CI run id;
  - limitations:
    - iOS not run;
    - a lost native alert (KAN-36) not reproducible;
    - real network handover not tested;
    - Wi-Fi ADB rather than USB.
  - The Slice is not labelled production-ready.
  Commit `KAN-26: Slice 2 Android device evidence`.
- [ ] **Step 4:** Cleanup:
  - `npm run e2e:cleanup`;
  - `adb reverse --remove tcp:54329`;
  - stop the proxy;
  - `supabase stop`.
  `com.pantryflow.test` stays installed, as before.

## Rulings and risks carried into execution

- **Execution mode:** inline (executing-plans), not subagents. The work is a device-in-the-loop debugging cycle on one phone, which a fresh subagent per task can't share. A Sonnet task review after Task 1 and an Opus final review of the branch are kept.
- **Debugging on the phone first, then the emulator through CI:** one ARM64 build costs one Gradle run, and flow changes need no rebuild. Cost if wrong: an emulator-only failure that shows up only at the CI dispatch.
- **Xiaomi (HyperOS) prerequisites:** Maestro input needs "USB debugging (Security settings)" turned on, and `adb install` may ask for confirmation on the phone. If the installed `com.pantryflow.test` has a different signature, reinstalling it means uninstalling the test package first; that removes only test data, and I'll ask before doing it.
- **Wi-Fi ADB:** ping is about 120 ms, and the port changes after a reconnect. If a run is flaky because of the transport, it's rerun, not counted.
- **KAN-24** ([Slice 2] Extend unit, database, and behavioral regression coverage): its "every criterion has a case or an explicit manual limitation" is checked against the updated matrix at the end of Task 2. Moving it to Done is a separate decision.

## Execution notes

- **Slice 1.1 flow changed after all.** Since step 4 (#33), a save to Low or Out shows the shopping prompt, so the unchanged flow failed at `assertVisible: Out`. `slice-1-1.yaml` now waits for the prompt and taps Not now after those two saves; no assertion was removed.
- **One application change, on the owner's decision.** The add error stayed under an emptied field. It gets its own failing test and a one-line fix (KAN-17, cc57ad4); the journey asserts the message disappears.
- **Phone evidence and later assertions.** The counted phone run used the flows at f2fdb97. The task review then added two outcome assertions (Bread back under "To buy" after reopen; Rye bread back after retry), which are checked by the emulator run on the final head.
