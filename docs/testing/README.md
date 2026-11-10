# Running the consolidated regression harness

## Integration and required checks

`main` is the integration branch. The historical branch
`pantryflow/slice-1.1-validated` remains at `e6dbcf8`. Pull requests into `main`
require the GitHub Actions `fast` and `database` checks plus the genuine
`SonarCloud Code Analysis` check against an up-to-date
branch, with conversations resolved. Direct pushes, force pushes and branch
deletion are blocked by branch protection, including for administrators.
Android remains an on-demand/weekly gate rather than an unconditional PR job.

The coverage matrix is a living specification: every behavior change, including
Slice 2 work, adds or updates its acceptance scenarios and regression tests in
the same pull request. SDK/native dependency upgrades stay on a separate branch
and require the entire harness, a fresh Android build and a physical-device
smoke test. Production follow-ups remain in `production-follow-ups.md`.

Reference baseline: `e6dbcf8`. PF-TEST-001 was implemented on `pantryflow/pf-test-001`; use a new branch for subsequent tasks and never rewrite or retag the validated baseline. No application source, business rules, migrations or production configuration are changed for tests.

Read [the existing inventory](existing-inventory.md), [behavior matrix](coverage-matrix.md), and [independent production tasks](production-follow-ups.md).

Hosted checks with confirmed disposable accounts, exact cleanup and read-only
catalog comparison are documented in [hosted verification](hosted-verification.md).
Do not disable hosted email confirmation to run the legacy account-creation flag.

## Fast checks

From `pantry-flow`, with Node 22.13+:

```sh
npm ci
npm run test:fast
```

This runs TypeScript, the original Node/React/PGlite regressions plus lifecycle/i18n checks, one focused Jest/RNTL keyboard-category test, and the local-target safety guard. `npm test` preserves the original Node suite command. Jest uses the SDK 58 `jest-expo` preset and RNTL 14 with React 19; migrating the existing suite to Jest would add duplication without behavioral benefit.

## Disposable Supabase

Docker Desktop (Linux containers) must be running. Supabase CLI 2.122.1 is locked as a dev dependency; no global CLI is required. On Windows, Docker's CLI directory must be on PATH for the CLI's credential helper. A per-user install may be under `%LOCALAPPDATA%/Programs/DockerDesktop/resources/bin`.

```sh
npm run db:start
npm run test:local
```

The dedicated `pantryflow-tests` stack uses ports 54320–54324. Reset applies unchanged migrations 00001–00003 to the LOCAL stack, runs 21 transactional pgTAP assertions, then ordinary-user HTTP integration tests. No hosted project is linked or read from .env. The status API URL must equal `http://127.0.0.1:54321` before any test client is constructed. A local admin key is used only to create/confirm/delete exact reserved fixtures; authorization assertions never use it.

The tests create two independent household accounts and a third signup account. The exact `pf.test.*@example.com` addresses are reserved to this stack. Setup removes stale reserved fixtures; finally blocks clean them after failures. pgTAP rolls back all rows. Do not run database and Android suites simultaneously against one stack. A hard-killed process may need `npm run e2e:cleanup` on restart. `npm run db:reset` destroys only this dedicated local database, never the hosted development database.

## Android E2E

Requires Java 17+, Android SDK/NDK build tools, an x86_64 Android emulator (API 35 in CI), ADB and Maestro CLI 2.12.0. Windows uses the official Maestro ZIP and its `bin/maestro.bat`; set `MAESTRO` to that path and `JAVA_HOME` to the Android Studio JBR if Java is not on PATH. Linux CI uses the same pinned CLI release.

```sh
npm run e2e:prepare
npm run e2e:build
npm run test:e2e
```

The build copies current application sources into ignored `.verification/e2e-app`, generates native Android there, and produces a release-mode, debug-signed `com.pantryflow.test` APK. It never installs over `com.pantryflow.app` or Expo Go. Test-only cleartext transport targets the host's local proxy through emulator address `10.0.2.2:54329`; the proxy forwards only to local Supabase at port 54321. No service key enters the app bundle. This command targets an emulator, not the previously paired physical phone.

The runner creates fresh fixtures, installs that APK, starts a local test proxy, executes Maestro, checks real database outcomes, captures logcat and cleans accounts. The flow covers login, cold restart, background/foreground, keyboard-open category selection, add/duplicate add/duplicate edit, distinct names, cancel/confirm delete, all stock states, account switching, protected deep links, real confirmation-required signup, REST load failure/retry and delayed-save navigation. A direct database assertion verifies exactly one Milk record with Dairy and Low; an empty second household verifies cache isolation. Hook tests retain immediate double-submit coverage.

Maestro favors existing testIDs. Approved English messages are asserted for visible outcomes; native confirmation buttons use Android system IDs. The font/assets regression gate checks logcat for the prior ExpoAsset/AppDirectories failure. Screenshots preserve the native icon result for review; the gate alone does not prove pixel-correct glyph appearance.

Diagnostics: ignored `.verification/maestro/results.xml`, `debug/`, screenshots and `android-logcat.txt`. Do not upload .env, e2e-env.json, APK/build folders, or local Supabase status keys. Failed cleanup is a failed run. For multiple devices set `ANDROID_SERIAL`; set `ADB` or `MAESTRO` for executable paths if needed.

## CI and release gate

`.github/workflows/pantryflow-tests.yml` runs fast and disposable-database jobs on PRs. Manual dispatch and weekly scheduled runs additionally build an Android test APK and run Maestro on an accelerated emulator. CI has read-only repository permissions and needs no Supabase/GitHub secrets. Android diagnostics are retained for seven days. With the workflow integrated on `main`, scheduled and manual dispatch runs are active. Manual dispatch can select a follow-up branch for full Android validation before its PR is merged.

Only superseded PR runs are automatically cancelled. New pushes to `main` do not
cancel an active scheduled/manual full run. Startup output is captured separately
in `db-start.log` and uploaded even if the tests never start; Bash pipe failure
propagation keeps a failed Supabase startup red. Artifact access still follows
GitHub's authentication and repository permissions.

A harness change is accepted only after fast, database and Android jobs pass for its exact commit. Do not label an unexecuted flow a passing regression. Baseline historical counts (32 local, 13 hosted, 22 device groups) remain historical evidence rather than current automation counts. SDK upgrade, actual email delivery and historical hosted-account cleanup stay separate tasks.

## Historical execution record — PF-TEST-001, 2026-11-08

The counts below describe that dated harness run, not today's suite. Subsequent
SDK/email work added confirmation coverage and raised the Node count to 50.
Full [run 42717033012](https://github.com/Micha0371/VSCode-Environment/actions/runs/42717033012)
passed fast, database, Windows and Android at `76c944d`. Consult the dated release
records and current CI for later changes; do not treat these historical counts
as a current coverage assertion.

- Fast: TypeScript and 35 Node checks passed; Jest/RNTL and local-target guard also passed.
- Disposable Supabase: unchanged migrations reset successfully; all 21 pgTAP assertions and all six HTTP behavior groups passed, including independent concurrent writes and foreign profile/household/membership mutations. Reserved accounts cleaned automatically.
- Android Maestro: full Windows/API 35 release-APK journey passed in 6m 6s, including direct database postconditions, native asset log gate and automatic cleanup. Screenshot review confirms plus/tab icons render. The full [CI run for harness commit 4f90b85](https://github.com/Micha0371/VSCode-Environment/actions/runs/42512140002) also passed all three jobs, including cleanup and diagnostic upload. No new validated tag was created.
- The first CI Android setup requested a removed legacy SDK tools package; explicit platform-tools fixes it. The first executable flow left a trailing email character because a centered tap placed the cursor mid-field. TestID-relative end-of-field taps plus an exact email assertion fixed the harness; application code was unchanged.
- Windows Gradle initially could not rename completed dependency-accessor caches. Copying the completed generated cache directories to their matching immutable names allowed the local build; no antivirus settings were changed. Linux CI did not require that local workaround.

Official references: [Expo unit testing](https://docs.expo.dev/develop/unit-testing/), [Supabase database testing](https://supabase.com/docs/guides/database/testing), [Maestro Android](https://docs.maestro.dev/get-started/supported-platform/android), [Maestro HTTP scripts](https://docs.maestro.dev/maestro-flows/javascript/make-http-requests).

The database-only follow-up `98a823b` adds foreign mutation assertions for profiles, households and memberships; all six integration groups and TypeScript pass locally. It changes neither the APK inputs nor Maestro flows. The branch CI repeats fast/database gates for this follow-up; see [branch workflow runs](https://github.com/Micha0371/VSCode-Environment/actions/workflows/pantryflow-tests.yml?query=branch%3Apantryflow%2Fpf-test-001). The passing Android evidence above remains applicable to the unchanged native journey.

Local fixture accounts and e2e-env.json were removed. The local test stack and emulator were stopped; cached SDK/tooling and ignored diagnostic evidence remain available. Historical hosted accounts remain the independent PF-CLEANUP-001 task.

## Physical-device SDK smoke test

Keep the same disposable local stack. After database/API tests finish, set `PANTRY_TEST_TARGET=device` and run `npm run e2e:prepare`; then set `PANTRY_TEST_ARCHITECTURES=arm64-v8a` and run `npm run e2e:build`. Use the ARM64 output `.verification/pantryflow-test-arm64-v8a.apk` with package `com.pantryflow.test`. Start `node scripts/e2e-proxy.cjs` and use `adb -s <device> reverse tcp:54329 tcp:54329` so the APK reaches only local Supabase through `http://127.0.0.1:54329`. Do not expose the stack on the LAN or put admin credentials in the APK. Run `npm run e2e:cleanup` afterward and remove the ADB reverse rule. The emulator defaults remain unchanged. SDK upgrade smoke execution is tracked in [PF-SDK-001](../sdk-upgrade/PF-SDK-001.md).
