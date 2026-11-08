# PF-TEST-001 behavioral coverage

Reference: validated commit `e6dbcf8f09bf43bc8dc0c08d7eac62eaf46a45a8`.
Harness branch: `pantryflow/pf-test-001`. The reference branch is unchanged.
Sources: approved Slice 1 plan E/F, approved strict-duplicate rules in the user
request, migrations 00001–00003, current app/hooks/lib and device findings in H.
Later user-approved hardening supersedes the old examples permitting client
timestamp writes or requiring permanently non-null authors.

“Automated” describes executable coverage, not an assertion that an unexecuted
suite passed. Execution results are recorded separately in README.md.

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
| SDK-01 | Existing acceptance scenarios survive SDK 52 → 58 | Original Node, RNTL, pgTAP, API and Maestro suites retained | Fast and local database/API pass; fresh Android pending |
| SDK-02 | Category first tap remains handled with keyboard open | `keyboard-contract.test.cjs`, async RNTL case, existing Maestro flow | Node/component pass; native pending |
| SDK-03 | Windows prebuild relocates native package correctly | `native-tooling.test.cjs` exercises actual Expo config plugin; Windows CI job | Local patched regression passes; CI pending |
| SDK-04 | Fresh native fonts/icons and lifecycle work on SDK 58 | Existing Maestro native font/error checks and physical ARM64 smoke | Pending |
