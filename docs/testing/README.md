# Running the consolidated regression harness

Reference baseline: `e6dbcf8`. Work belongs on `pantryflow/pf-test-001`; never rewrite or retag the validated baseline. No application source, business rules, migrations or production configuration are changed for tests.

Read [the existing inventory](existing-inventory.md), [behavior matrix](coverage-matrix.md), and [independent production tasks](production-follow-ups.md).

## Fast checks

From `pantry-flow`, with Node 22.13+:

```sh
npm ci
npm run test:fast
```

This runs TypeScript, the original Node/React/PGlite regressions plus lifecycle/i18n checks, one focused Jest/RNTL keyboard-category test, and the local-target safety guard. `npm test` preserves the original Node suite command. Jest uses the SDK 52 preset and React 18-compatible RNTL; migrating the existing suite to Jest would add duplication without behavioral benefit. These test-only dependencies do not upgrade Expo.

## Disposable Supabase

Docker Desktop (Linux containers) must be running. Supabase CLI 2.58.5 is locked as a dev dependency; no global CLI is required. On Windows, Docker's CLI directory must be on PATH for the CLI's credential helper. A per-user install may be under `%LOCALAPPDATA%/Programs/DockerDesktop/resources/bin`.

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

`.github/workflows/pantryflow-tests.yml` runs fast and disposable-database jobs on PRs. Manual dispatch and weekly scheduled runs additionally build an Android test APK and run Maestro on an accelerated emulator. CI has read-only repository permissions and needs no Supabase/GitHub secrets. It uploads only diagnostics for seven days. Schedules/manual dispatch require the workflow to exist on the repository default branch; until merged, branch pushes run fast/database checks. A harness-branch push whose commit message contains `[full-e2e]` also runs Android, allowing exact-commit validation without modifying the preserved default baseline.

A harness change is accepted only after fast, database and Android jobs pass for its exact commit. Do not label an unexecuted flow a passing regression. Baseline historical counts (32 local, 13 hosted, 22 device groups) remain historical evidence rather than current automation counts. SDK upgrade, actual email delivery and historical hosted-account cleanup stay separate tasks.

## Current execution record

- Fast: TypeScript and 34 Node checks passed; Jest/RNTL and local-target guard also passed.
- Disposable Supabase: unchanged migrations reset successfully; all 21 pgTAP assertions and all six HTTP behavior groups passed, including independent concurrent writes. Reserved accounts cleaned automatically.
- Android Maestro: implemented, not yet executed; no new validated tag created.

Official references: [Expo unit testing](https://docs.expo.dev/develop/unit-testing/), [Supabase database testing](https://supabase.com/docs/guides/database/testing), [Maestro Android](https://docs.maestro.dev/get-started/supported-platform/android), [Maestro HTTP scripts](https://docs.maestro.dev/maestro-flows/javascript/make-http-requests).
