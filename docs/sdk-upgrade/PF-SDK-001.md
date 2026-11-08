# PF-SDK-001 — Expo SDK/tooling upgrade

Status: in progress on `pantryflow/pf-sdk-001`, based on protected main `5b10411`.

Target: Expo 58.0.23, React Native 0.88.1 and React 19.3.0, as published in Expo's SDK 58 compatibility matrix. No Slice 2 features, database migrations, household/name rules, or UI redesign are included.

Upgrade SDKs incrementally, retaining all behavioral regressions. SDKs 53, 54, 55, 56 and 57 pass TypeScript, the 35 Node cases, the keyboard component case and the local-target guard. Intermediate checkpoints and full logs are ignored local artifacts. SDK 56 requires explicit Node/Jest typings under TypeScript 6 and removal of deprecated baseUrl. React 19 requires the standalone test act environment; test JSX uses the modern transform.

SDK 58 requires RNTL 14. Its async component APIs must be migrated without dropping assertions. The original Node/React renderer suite is retained. Obsolete newArchEnabled config is removed because the newer SDK always uses the New Architecture. Babel and optional React DOM test dependencies are explicitly aligned with the SDK.

Required final gates: clean dependency/Doctor review, TypeScript and fast suite, disposable pgTAP and HTTP suites, fresh native release APK and Maestro on Android, and a fresh ARM64 APK smoke test on the physical phone using only local fixtures/ADB reverse. Do not merge or mark validated while any required gate is pending. iOS native compilation is not available on this Windows host; SDK 56+ raises the minimum iOS version to 16.4.

Official references:
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://expo.dev/changelog/sdk-53
- https://expo.dev/changelog/sdk-54
- https://expo.dev/changelog/sdk-55
- https://expo.dev/changelog/sdk-56
- https://expo.dev/changelog/sdk-57
- https://expo.dev/changelog/sdk-58

SDK 58 validation so far: Expo Doctor 20/20; TypeScript, 36 existing/relocated Node checks, async RNTL component and local-target safety guard pass with Jest 30.5.2. Disposable Supabase: 21 pgTAP assertions and six HTTP integration groups pass. Native APK/Maestro and physical-device gates remain pending.

Windows prebuild exposed an upstream config-plugins 58.0.12 bug: an absolute backslash path was passed as a tinyglobby pattern. This stalls package refactoring when run from the generated app. The version-guarded Windows-only postinstall correction uses the relative-pattern/cwd form already used by Expo Android Paths. A real config-plugin filesystem regression verifies debug-package relocation (one additional Node check). Remove/review this workaround when config-plugins changes.

Dependency review: the lockfile removes unused direct query-string (no app imports), eliminating its vulnerable decoder. A scoped `supabase > tar` override keeps the existing CLI version while selecting patched tar 7.5.22. Lockfile audit now reports no high/critical findings, with 23 moderate and one low remaining in Expo/Jest tooling (glob/minimatch/deepmerge). No cross-major overrides or forced downgrade suggested by npm audit were applied. Final clean install and rerun remain required. Supabase JS, PGlite, tsx and URL-polyfill resolved versions are unchanged from the baseline.
