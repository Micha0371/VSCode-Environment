# PF-TEST-001 behavioral coverage

Reference: validated commit `e6dbcf8f09bf43bc8dc0c08d7eac62eaf46a45a8`.
Harness branch: `pantryflow/pf-test-001`. The reference branch is unchanged.
Sources: approved Slice 1 plan E/F, approved strict-duplicate rules in the user
request, migrations 00001–00003, current app/hooks/lib and device findings in H.
Later user-approved hardening supersedes the old examples permitting client
timestamp writes or requiring permanently non-null authors.

“Automated” describes executable coverage, not an assertion that an unexecuted
suite passed. Execution results are recorded separately in README.md.

## Slice 2 database coverage — KAN-7 / KAN-30

Contract: [approved D1/D2/D4 model](../planning/slice-2-shopping-database.md).
These cases cover persistence and the shopping data/provider layer (steps 1 and 2); no shopping screens exist yet.

| ID | Observable outcome | Automated coverage | Limit |
| --- | --- | --- | --- |
| SHOP-DB-01 | Blank/null/overlong names fail; edge trim/case uniqueness applies only to open names; internal spaces remain significant | shopping.test.sql and shopping API group in behavior.integration.ts | Translated UI validation arrives with shopping data/UI work |
| SHOP-DB-02 | Manual/linked adds share a namespace; duplicate rename/reopen fails without overwriting | pgTAP and ordinary-user API read-back | No merge/rename on conflict |
| SHOP-DB-03 | Concurrent add, rename, reopen and add-versus-reopen produce one open winner | Separate authenticated clients through real PostgREST | PGlite is not used as concurrency evidence |
| SHOP-DB-04 | Completion is server-timed, retained and reopenable; edits preserve completion time; shopping does not change pantry state | pgTAP and API full pantry-row comparison | No bulk clear or automatic pantry synchronization |
| SHOP-DB-05 | Foreign/anonymous access, forged creators and client-owned timestamp/identity changes fail | Ordinary-role pgTAP and public-key API checks | Admin used only for fixture preparation/deletion |
| SHOP-DB-06 | Cross-household links fail; same-household relink preserves name/completion; deleting the former target preserves the new link, deleting the current target clears only the link | Composite-FK pgTAP and direct API add/update/relink/deletion | Optional links remain inside the same household |
| SHOP-DB-07 | Members may edit another author's item; author deletion nulls attribution; household deletion cascades rows | API shared-membership fixture plus pgTAP deletion assertions | No invitations or multi-household UI introduced |
| SHOP-DB-08 | 00004 preserves populated Slice 1.1 rows | PGlite upgrade regression in database.test.cjs | Supplemental actual local PG17 incremental-upgrade probe passed; not production populated-upgrade approval |
| SHOP-STATE-01 | Shopping names are validated and database/transport errors map to contract keys (duplicate, permission, missing, invalid name, missing pantry link, generic) | shopping-data.test.cjs (unit) | No UI consumes the keys until step 3 |
| SHOP-STATE-02 | Provider state follows household scope, guards stale and superseded writes, drops a missing row and re-reads, reconciles an add with a concurrent refresh by id, and surfaces mapped errors | shopping-state.test.cjs, list-provider-contract.cjs (unit) | Mounting, screens and the low/out prompt arrive in steps 3a, 3b and 4 |
| SHOP-STATE-03 | Ordinary members persist and read back insert, linked insert, rename, check, reopen and delete; bypassed client checks surface as the contract keys for duplicate, foreign-household, foreign-link, 121-character, hidden-id rename and hidden-id delete; completed names repeat and reopen into an open duplicate fails | shopping-data.integration.ts against real local Auth/PostgREST with ordinary clients | Local stack only; relinking from the client is not exposed in step 2 |
| SHOP-STATE-04 | Unmount, sign-out, household change and superseded reads do not apply stale results | Provider-level unit tests in shopping-state.test.cjs | Aborting an HTTP request mid-flight is not asserted, since it cannot show whether the server committed |
| SHOP-UI-01 | The Shopping tab is gated and placed between Pantry and Settings; loading, empty, error/retry and sectioned list states | navigation.test.cjs, shopping-screen.test.cjs (unit) | Android loading-failure/retry, empty and sectioned states: SHOP-E2E-01 |
| SHOP-UI-02 | Inline add, complete/reopen, rename and confirmed remove with locks, translated errors and keyboard-safe tap settings; an add error clears as soon as the field is edited; a failed complete/reopen error names its item and disappears once that item is removed or changed; household changes reset drafts/locks/feedback and discard obsolete add/toggle completions, including leaving and returning to the same household | shopping-screen.test.cjs, shopping-edit.test.cjs, components/shopping-add.test.tsx | Android first taps with the keyboard open on Add, a row circle, edit Save and Remove; tab-switch draft; confirmed remove: SHOP-E2E-01 |
| SHOP-LINK-01 | The low/out prompt fires only on a change to low or out; Yes adds once, linked; No or dismiss adds nothing; the pantry save is never reverted; no prompt, add or failure notice once the edit screen has closed or lost focus | edit-item-prompt.test.cjs, mutation.test.cjs, pantry-shopping.test.cjs (unit) | Android prompt wording, Back as Not now, Not now, Add and the duplicate notice: SHOP-E2E-01. A lost native alert (KAN-36) is not reproducible |
| SHOP-LINK-02 | Shopping rename/complete/reopen/remove never change pantry data; pantry status changes create no shopping items; open duplicates are rejected with the duplicate key, a completed duplicate does not block, reopening into an open duplicate fails; pantry deletion keeps a named standalone shopping item | pantry-shopping.integration.ts against real local Auth/PostgREST with ordinary clients | Local stack only |
| SHOP-E2E-01 | Android release-mode test APK: the low/out prompt (Back, Not now, Add, duplicate notice), keyboard-open add, toggle, rename and remove, duplicate message cleared by editing, complete/reopen, remove cancel/confirm, tab-switch draft, cold restart, shopping load failure/retry and another household's empty list | `.maestro/slice-2-shopping.yaml` on real local Auth/PostgREST through the loopback proxy | Emulator in the CI Android job; physical phone results in the evidence section below |
| SHOP-E2E-02 | The journey's persisted outcome: exact shopping rows, the pantry link, completion state, an unchanged pantry row, and nothing for the other household | `e2e-fixtures.ts shopping-verify` with ordinary clients after the flow | Local stack only |
| DB-ENV-02 | Every migration from 00004 on applies without `extensions` on search_path, as in the hosted CLI push session | migration-push-search-path.test.cjs (PGlite, fast job), with a negative control for an unqualified `uuid_generate_v4()` | Models only search_path resolution, not every hosted login-role privilege; added after the 2026-11-11 hosted 00004 push failed and rolled back |
| DB-ENV-01 | Running PostgreSQL major must be 17 | Separate environment.test.sql, plan(1), in existing database CI job | The identical assertion was demonstrated failing on separate local 15.19; update deliberately with future major upgrades |

KAN-7 / step-1 local validation on 2026-11-11: 53 Node checks, Jest/RNTL, typecheck and target
safety passed; 21 original + 1 environment + 43 shopping pgTAP assertions passed;
six original API groups, six shopping groups and two real-email cases passed.
The actual PostgreSQL 17.11 incremental-upgrade probe started from 00001–00003
with one existing pantry item and its profile/household/membership. Migration up
applied only 00004; saved before/after snapshots of all four original tables
matched exactly, then the fixture was removed. Ignored local evidence includes
`kan7-upgrade-{before,after,result}.json` and `kan30-negative-result.json`.
CI and Android results on the exact PR head remain separate required checks.
Step 2 local validation (shopping data module and provider, after the PR #26 review fixes): 100 Node tests and 1 Jest/RNTL test from `npm run test:fast`; 65 pgTAP assertions in 3 files and 21 integration tests from `npm run test:local`.
Step 4 local validation (low/out prompt and pantry/shopping independence): 166 Node tests and 2 Jest/RNTL tests from `npm run test:fast`; 65 pgTAP assertions in 3 files and 22 integration tests from `npm run test:local`.

Concurrency limit: the API tests dispatch requests together from separate
authenticated clients, but do not force or prove overlapping execution inside
PostgreSQL. The one-winner outcomes remain valid in either serialization; the
partial unique index is the authoritative protection. These cases are not
evidence that a particular lock interleaving was exercised.

## Slice 1.1 baseline coverage

| ID | Approved behavior / observable outcome | Reused automated coverage | Additional coverage | Manual / deferred limit |
| --- | --- | --- | --- | --- |
| AUTH-01 | Registration creates profile, household and one membership | `auth.test.cjs`; PGlite signup triggers | Local integration fixtures and real signup; pgTAP; Maestro confirmation-required signup | Real mail delivery is PF-EMAIL-001 |
| AUTH-02 | Signed-in vs confirmation-required outcomes route correctly | `auth.test.cjs`, `screens.test.cjs` | Maestro against local confirmation-enabled Auth | Hosted auto-confirm path historically tested on phone |
| AUTH-03 | Login succeeds, wrong credentials reject, feedback permits retry | Auth identity tests; historical device group 21 | Local integration rejects invalid/unconfirmed credentials; Maestro login | Maestro asserts translated wrong-password feedback and successful retry |
| AUTH-04 | Logout clears protected state; failed logout stays recoverable | `auth.test.cjs`, `screens.test.cjs` | Local refresh-token invalidation; Maestro signed-out deep link | Access JWTs are not claimed to revoke immediately |
| AUTH-05 | Saved session/cold restart restores identity and inventory | Auth restoration/race tests | Maestro process restart without clearing storage | Real device history retained |
| CRUD-01 | Empty state offers add, list opens correct item | `screens.test.cjs` | Maestro empty → add → edit | Empty-state art remains visual review |
| CRUD-02 | Add trimmed name/category/location; default in_stock persists | Pantry data/state tests | Local CRUD; Maestro + direct DB assertion of exactly one Milk/Dairy record | No quantity/batch model introduced |
| CRUD-03 | Edit name/category/location/status updates shared list immediately | `pantry-state.test.cjs`; validation tests | Maestro all stock states and delayed rename; local persistence reads | Schema keys remain language-independent |
| CRUD-04 | Cancel edits/deletes preserves data, confirm deletes only target | Provider delete/state tests | Maestro native alert cancel/confirm; local deletion readback | Native confirmation uses Android system button IDs |
| DUP-01 | Same household rejects exact/case/edge-space duplicates | `pantry-data.test.cjs`, `database.test.cjs` | Local HTTP and pgTAP; Maestro duplicate add | Unicode edge whitespace covered in existing DB tests |
| DUP-02 | Duplicate rename rejected; self edit allowed | Existing SQL/client/screen checks | Local API, pgTAP, Maestro | Existing record ID excluded client-side |
| DUP-03 | Category/location/status do not change uniqueness | Existing SQL checks | Local direct API and pgTAP | No silent merge/rename/delete |
| DUP-04 | Different names and different households allowed | Existing SQL checks | Two local households; Maestro distinct names | Internal whitespace intentionally remains significant |
| DUP-05 | Database enforces uniqueness with UI bypass and concurrency | Existing PGlite checks (single connection) | Local overlapping HTTP insert/update transactions; exactly one winner | Real multi-connection test complements PGlite |
| DUP-06 | 23505 uses existing translated validation without navigation | Existing add/edit screen tests | Maestro duplicate messages | English-visible Slice 1 assertions use approved text |
| ERR-01 | Blank/overlong/invalid values cannot persist | Existing data/SQL tests | Local HTTP and pgTAP constraints | Native text length limit remains platform behavior |
| ERR-02 | Loading/error differ from empty; retry recovers correct household | Household/provider/screen tests | Maestro real REST 503 through local proxy, retry succeeds | No offline queue or offline success promised |
| STATE-01 | Shared consumers observe add/edit/delete; stale reads cannot undo writes | `pantry-state.test.cjs` | Maestro list updates | Detailed timing stays in deterministic hook tests |
| STATE-02 | Account/household identity changes discard stale results and clear cache | Household/provider/auth tests | Maestro switches to empty second household | Switching households inside one account is outside Slice 1 |
| RACE-01 | Double submit locked immediately, failure unlocks retry | `mutation.test.cjs`, provider failed-write tests | Retained, not duplicated in Maestro | Synchronous race best covered in hook test |
| RACE-02 | Cross-screen save/delete exclusion and abandoned completion | Existing mutation/provider tests | Maestro delayed real PATCH, disabled delete, Back/new modal stays open | Proxy affects only local test transport |
| SEC-01 | All four tables isolate households/users | Existing SQL tests; 13 historical hosted groups | Local API both directions; pgTAP ordinary authenticated roles | Hosted runner excluded from CI |
| SEC-02 | No creator spoof/null, immutable identity/household/time | Existing SQL tests | Local HTTP + pgTAP creator/privilege checks | Author deletion may deliberately clear creator |
| SEC-03 | Profile name/language allowed; premium escalation denied | Existing SQL tests | Local API + pgTAP | Existing premium data audit remains operational |
| SEC-04 | Anonymous clients cannot access or create inventory | Existing SQL tests | Local anonymous client HTTP assertions | Admin client used only for fixture lifecycle |
| DATA-01 | Migrations apply in order on empty real Supabase | PGlite real SQL (UUID adapter) | Local `db reset --local` then pgTAP/API | No hosted migration is applied by this harness |
| DATA-02 | Legacy invalid/duplicate rows abort migration without data loss | Existing `database.test.cjs` transactional rollback fixture | Retained | Real upgrade fixture against populated Supabase remains deferred |
| DATA-03 | Author deletion preserves another owner's household item | Existing SQL case | Retained | Local API fixture cleanup also verifies owner cascades |
| DATA-04 | Paging beyond 1000 does not truncate or conceal failed pages | `pantry-data.test.cjs` | Retained | Native 1000-row scroll performance deferred |
| NAV-01 | Pantry/settings, modals, Back and signed-out deep links | Existing screen/AuthGate/mutation checks | Maestro deep links, cancel, Android Back | Visual tab icon appearance still needs screenshot review |
| LIFE-01 | Foreground starts token refresh; background stops it | New `lifecycle.test.cjs` | Maestro Home/foreground + cold restart | Long-duration expiry/background OS eviction deferred |
| LIFE-02 | Device connectivity loss recovers after reconnect | Existing failed-read/write retry tests | Native REST 503/recovery through local proxy | Actual airplane-mode/network handover remains manual/deferred; no offline queue is approved |
| I18N-01 | English, persisted locale, fallback and language-independent keys | Screen translated errors; new i18n provider checks | Local DB rejects translated enum values | German content/language UI are future slices |
| DEVICE-01 | First category tap works with keyboard open | New RNTL native-primitives case | Maestro leaves keyboard open and DB verifies Dairy | Catches the confirmed first-tap failure |
| DEVICE-02 | Native fonts/assets initialize without prior AppDirectories failure | SDK-compatible dependency retained | Separate native APK; native autolink prerequisite and Android logcat error gates; screenshots | Pixel-perfect glyph rendering remains manual; absence of errors alone is insufficient |

Excluded product features remain excluded: shopping, invitations, multi-household
selection, premium limits, quantities/expiry/batches, filters, pull-to-refresh,
offline queue, password reset and OAuth. Tests must not add them to make a
scenario pass. A discovered behavioral defect gets its own reproducible failing
case and separate reviewable fix; it must not silently alter this reference.

## SDK upgrade compatibility gates (PF-SDK-001)

| ID | Behavior | Coverage | Execution status |
| --- | --- | --- | --- |
| SDK-01 | Existing acceptance scenarios survive SDK 52 → 58 | Original Node, RNTL, pgTAP, API and Maestro suites retained | Fast, local database/API and two fresh Android/Maestro CI runs pass |
| SDK-02 | Category first tap remains handled with keyboard open | `keyboard-contract.test.cjs`, async RNTL case, existing Maestro flow | Node/component, Maestro and physical keyboard-open first tap pass |
| SDK-03 | Windows prebuild relocates native package correctly | `native-tooling.test.cjs` exercises actual Expo config plugin; Windows CI job | Original-module replay fails; corrected regression passes locally and on Windows CI |
| SDK-04 | Fresh native fonts/icons and lifecycle work on SDK 58 | Existing Maestro native font/error checks and physical ARM64 smoke | Maestro and physical Android 16 pass; native icons visually verified |

## Email confirmation release gate (PF-EMAIL-001)

| ID | Behavior | Automated coverage | Remaining acceptance |
| --- | --- | --- | --- |
| EMAIL-01 | Confirmation-enabled signup has no session until valid link | Auth regressions; real local Auth/Mailpit integration; first-signup Maestro path separate from resend | Controlled custom-SMTP first signup passed on physical Android at 23:38 Berlin on 2026-11-09, with backend session verification |
| EMAIL-02 | S256 PKCE callback exchanges once and survives restart | Native Crypto RFC 7636 vector; callback component tests; real Auth integration | Maestro and physical hosted callback passed |
| EMAIL-03 | Expired/replayed/invalid links cannot authenticate | Parser and screen regressions; actual local Auth expiry and replay | Physical expired-link recovery passed |
| EMAIL-04 | Resend creates a usable replacement; overlap and rate limits recover | Resend screen tests; actual local Auth/Mailpit resend | Hosted resend receipt and Android completion passed |
| EMAIL-05 | Confirmation session restores after restart and isolates household | Real local session restore; Maestro confirmation-complete and fixture verification | Native suite passed in full run 42599010616; physical hosted callback session survived cold restart |

Local email integration passed against Auth 2.197.0, matching hosted Auth.
The pinned CLI 2.122.1 replaces the older local Auth that ignored resend PKCE
challenges. This change is separate from the validated SDK baseline.

### Custom SMTP investigation (2026-11-09)

Resend delivered mail from `noreply@auth.householdkit.app`. A fresh signup
link, after click/open tracking were disabled, confirmed the controlled account
but did not establish a hosted session (`last_sign_in_at` remained empty), and
the Android app showed login. The earlier successful physical acceptance used
a resent confirmation. It does not establish that initial custom-SMTP signup
works. That initial failure was kept open until the final acceptance below.

The native runner now exercises a valid first signup before resetting only the
reserved local confirmation account and exercising expiry/resend. It checks
the backend sign-in timestamp before any independent password login, explicitly
stops/relaunches the app for session persistence, and retains separate first-link
reports. Maestro receives an explicit device argument when `ANDROID_SERIAL` is
set, since that ADB environment variable alone did not restrict Maestro's target.

The first local investigation run used an outdated emulator APK lacking the
current callback screen. Its failure is not evidence about the current source.
After rebuilding, valid first-signup native confirmation, force-stop/relaunch
persistence, logout and deliberately invalid callback recovery passed. The
backend sign-in timestamp was verified before resetting that reserved fixture.
Current local API integration (including first-link PKCE exchange, restart and
replay) and fast checks also pass. These local results were kept separate from
the hosted email/browser acceptance completed below.

The focused fresh-APK native rerun also passed the existing actual expiry,
resend, confirmation, force-stop/relaunch and invalid-link recovery path. Local
fixture cleanup completed. This was the confirmation subset, not a new claim
that the whole CRUD suite or hosted SMTP flow passed. Local reports are
`.verification/maestro/confirmation-first-complete.xml`,
`confirmation-resend.xml` and `confirmation-complete.xml` in the same directory.

### Android initial-link startup race

The diagnostic hosted signup used S256 and returned HTTP 200. Opening its email
confirmed the account without a sign-in timestamp. Android recorded a VIEW
launch into the test app, but the restarted Router received the root without
the callback/code. The installed Router's Android initial-URL implementation
uses a 150 ms timeout before substituting that root.

`native-confirmation-link.test.cjs` executes that installed timeout boundary with
a delayed React Native bridge and an already cached native confirmation. It
failed with the original identity routing, and passes with `+native-intent.tsx`.
The fallback uses Expo's native link cache only for initial Android root startup,
accepts only the configured app's exact confirmation route, and clears that
cache after handoff. Tests also cover foreign links, other navigation, expired
callbacks, cache replay, unavailable native API and unchanged iOS behavior.
The attempted emulator background-kill reproduction refused to proceed because
Android had not actually killed the process; it is not counted as evidence.

The startup fix is commit `85d0114`, separate from the harness commits. Local
fast checks pass (50 Node checks, one RNTL case, target safety and typecheck).
A fresh ARM64 build passed and the patched diagnostic test APK is installed.
A token-free native error callback displayed translated recovery. Full CI run
[42709533982](https://github.com/Micha0371/VSCode-Environment/actions/runs/42709533982)
passed fast, database, Windows tooling and fresh Android/Maestro at `85d0114`.
The real confirmation sent at 23:17 Berlin time was opened at 23:33. The patched
app reached the actual callback and displayed invalid/expired recovery rather
than login. Auth recorded confirmation at that click but no sign-in. This does
not establish successful valid-link exchange or the precise expiry stage; a
prompt live retry was needed. That consumed fixture was removed with
exact relational and aggregate checks, and its obsolete password was removed.
The fresh retry sent at 23:37 was opened at 23:38: the callback carried a code,
the token request carried its stored verifier, and Auth returned HTTP 200 and
recorded an actual sign-in. The protected empty pantry survived force-stop and
relaunch. Logout returned to login, and exact fixture cleanup preserved the
three manual-test accounts, three households and single pantry item. The
successful callback was warm (`recovered: false`), so it verifies the real
SMTP flow on the patched APK without proving that the fallback caused that
success. The fallback is independently covered by the failing-before/passing-after
delayed-bridge regression. Subsequent integration and sender-authentication
verification are recorded in the [2026-11-10 evidence](../release-readiness/2026-11-10-email-authentication.md), including public DNS and fresh Gmail SPF/DKIM/DMARC PASS. The initial recipient test alone did not establish those results.
