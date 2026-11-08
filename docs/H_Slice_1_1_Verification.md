# Slice 1.1 verification — 2026-11-08

## Current evidence

| Gate | Result | Evidence and limits |
| --- | --- | --- |
| Baseline branch | `pantryflow/slice-1.1-validated` | Clean baseline for the user-authorized `Micha0371/VSCode-Environment` repository; previous repository history is excluded. |
| Hosted migrations | User reports 00002/00003 applied; behaviors independently tested | Real HTTP checks against `oiqteedkfwmcertgxqga` using the public key and two ordinary authenticated users. |
| Deployed authorization and duplicate tests | **13 groups passed, zero failures** | Run-specific inventory deleted, test profile fields restored, test sessions signed out; zero cleanup failures. |
| Local regressions | **32 checks passed** | Real React hooks/context and PostgreSQL/PGlite; native and network boundaries mocked. |
| TypeScript | **Passed** | `tsc --noEmit`. |
| Android source/build | **Passed** | Separate SDK 52 native debug app on Android 16; all 28 application source files match the tested snapshot. |
| Android device flows | **22 groups passed** | Real registration, authentication, inventory, navigation, duplicates, persistence and recovery; confirmation-required response simulated. |
| Baseline commit/push | Prepared after validation | Branch `pantryflow/slice-1.1-validated`; secrets and raw verification artifacts excluded. |

## Deployed checks

The repeatable runner is `pantry-flow/scripts/verify-hosted.cjs`. It pins the
project URL and refuses secret keys. It uses two disposable users in different
households and calls Supabase Auth/PostgREST directly, bypassing UI validation.

1. Identical names are allowed in distinct households.
2. Case/edge-whitespace duplicates and category/location/status variations return
   PostgreSQL `23505` through HTTP 409.
3. Duplicate renames fail; editing the current item and trimming its name succeeds.
4. Two overlapping HTTP inserts for one normalized name produce exactly one winner.
5. Two overlapping HTTP renames for one normalized name produce exactly one winner.
6. Both users are isolated across pantry reads/updates/deletes/inserts, profile
   reads/updates, memberships, and household rows; their own household stays visible.
7. Neither ordinary user can change their premium flag.
8. Name/language profile edits still work and are restored afterward.
9. Creator spoofing, null creators, and creator/household/timestamp rewrites fail.
10. Blank, whitespace-only, overlong, invalid-category/location/status inputs fail
    database checks through the API.
11. CRUD persists `in_stock`, `low`, and `out`; deletion returns an empty result.
12. Anonymous clients cannot read the test inventory or insert items.
13. Refresh restores a session; local logout invalidates that session's refresh token.

The raw report is in ignored `pantry-flow/.verification/hosted-results.json`.
Three disposable accounts remain after HTTP and device testing. Their test inventory has been removed. Their credentials are in
ignored `.env.verification.local`; delete the accounts through the dashboard when
verification is finished. No credentials or tokens belong in this report.

Email auto-confirm is enabled on the deployed project. Account creation and auth
tests therefore verify that configured path. The confirmation-required outcome
is covered by local provider/screen tests and a simulated response on the phone,
not by a real email-delivery test with confirmation enabled. No project authentication setting was changed.

## Additional code-review correction

The original screen-local mutation lock did not cover leaving a screen while its
write was still pending and opening another screen for the same item. A new
regression reproduced overlapping update/delete requests from two consumers.
The shared pantry provider now locks each item until its edit/delete completes,
including failure paths. Writes to unrelated items remain independent.

Added coverage also verifies that a late mutation cannot populate the next user's
cache, failed writes preserve inventory and permit retry, saved sessions restore,
successful logout/login changes identity, and empty/list states navigate correctly.
The hosted runner also rejects administrative keys and unexpected project URLs
before making a request; otherwise a privileged test client could hide RLS defects.

## Android validation

Twenty-two device groups passed: fresh login, real registration, trimmed self-edit, cold session restore, duplicate creation, distinct names, native icons/fonts, duplicate rename, canceled/confirmed deletion, all stock states, blank-name validation, logout/login, account isolation, same-name items across households, deleting the final item, load failure, retry, delayed-save navigation, cleanup, signed-out deep links, invalid-password feedback, and the simulated confirmation-required outcome. Related steps are grouped in the raw report.

Device testing found and fixed two issues: category chips now respond while the keyboard is open, and the explicit SDK-compatible expo-file-system dependency restores native font/asset loading. The separate debug app leaves Expo Go unchanged. Temporary network simulations were removed; the final phone state is signed out with normal networking.

Raw reports, screenshots, credentials, generated native builds and APKs remain in ignored verification directories. Tested application-source SHA-256: `3fd3a609da7f9ec5ea75bb734fd302dea4873d97992443d352553c03189667e3`.

## Remaining production work

- Upgrade the legacy Expo SDK/toolchain before production release; application checks do not resolve the tooling advisories.
- Real confirmation-email delivery was not tested because the project currently auto-confirms email.
- Remove the three disposable accounts through the Supabase dashboard when no longer needed.
