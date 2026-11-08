# PF-SDK-001 — Expo SDK/tooling upgrade

Status: implemented; Android/application/database validation passed. SonarCloud S5332 issue review remains open. [PR #2](https://github.com/Micha0371/VSCode-Environment/pull/2) is a draft and is not merged. Branch `pantryflow/pf-sdk-001` starts from protected main `5b10411`; the Slice 1.1 baseline remains intact.

Expo is upgraded from SDK 52 to 58.0.23, React Native from 0.76.9 to 0.88.1, and React from 18.3.1 to 19.3.0. TypeScript 6.0.3, Jest 30.5.2 and RNTL 14.1.0 match the SDK. There are no new database migrations, business rules, features or screen redesigns. Supabase JS, PGlite, tsx and URL-polyfill resolved versions remain unchanged.

## Validation

| Gate | Result / evidence |
| --- | --- |
| Clean npm ci, npm ls --all | Passed locally; clean installs also passed on Linux and Windows CI |
| Expo Doctor | 20/20 |
| TypeScript / Node | Passed; 37 Node cases, retaining the original 35 cases and all assertions |
| Component / local-target safety | One async RNTL case and one safety case passed |
| Disposable Supabase | 21 pgTAP assertions and six ordinary-user HTTP integration groups passed |
| Fresh Android / Maestro | [SDK run 42532320502](https://github.com/Micha0371/VSCode-Environment/actions/runs/42532320502) passed; [build-fix rerun 42534912839](https://github.com/Micha0371/VSCode-Environment/actions/runs/42534912839) also passed all jobs |
| Latest constructor-only cleanup | [PR run 42537091907](https://github.com/Micha0371/VSCode-Environment/actions/runs/42537091907): fast, database and Windows checks passed; production sources are unchanged |
| Windows ARM64 release APK | Built successfully in 6m39s after the path correction |
| Physical Android 16 / ARM64 | Login, empty state, Milk creation, first keyboard-open Dairy tap, Fridge selection, Low status edit, cold restart with restored session/item, temporary-item deletion, tab navigation and logout passed |
| Physical persistence / native assets | Ordinary-user API read found exactly Milk/Dairy/Fridge/Low, no temporary item, and an empty independent household. Visual inspection confirmed native icons; process logs had no fatal/missing-native-module errors |
| Cleanup | Reserved local accounts and cascading fixtures removed; ADB reverse removed; loopback proxy and disposable Supabase stack stopped. Test app was signed out; baseline app and hosted data were untouched |
| SonarCloud | Three constructor findings confirmed FIXED; the local-loopback HTTP finding S5332 remains OPEN pending authenticated review |

The tested ARM64 APK SHA-256 is `c7dfa1c1b7bfb0a2f82eddea4ae75dddbf432dad9fd44c2b2d84acd31d8091d1`. Build artifacts, screenshots and raw logs are ignored local verification artifacts.

## Compatibility changes

SDKs 53–57 were upgraded incrementally and each passed the fast suite. TypeScript 6 requires explicit Node/Jest globals and removal of baseUrl. React 19 tests use the act environment and modern JSX transform. RNTL 14 uses async render/events; its removed composite query's keyboard-tap assertion was retained in a Node contract test. The existing React renderer suite remains intact. Removed newArchEnabled config reflects the SDK's mandatory New Architecture; the baseline already enabled it. Tab icons use the existing active/inactive theme colors, and AppState typing permits the newer nullable initial state.

Windows config-plugins 58.0.12 passes a backslash path as a glob. A version-guarded Windows postinstall correction uses Expo's existing relative-pattern/cwd approach. A real filesystem regression fails against the unmodified module and passes after correction. Review/remove the workaround on any config-plugins update. Windows native C++ builds also require short staging directories for libraries such as Reanimated; generated test builds use ignored repository-local `.cxx` caches. These changes do not alter Android settings or production data.

## Dependency and platform limits

Unused direct query-string was removed after confirming no app imports. A scoped Supabase CLI tar override selects patched 7.5.22 without upgrading the CLI. Clean-install audit reports zero high/critical findings and retains 23 moderate/one low tooling findings for review. No forced cross-major audit fix or rule suppression was applied.

iOS compilation was not performed on this Windows host; iOS minimum becomes 16.4. Real external confirmation-email delivery remains PF-EMAIL-001. This report does not claim production readiness or approval to merge.

Remaining advisory review (2026-11-09):

| Root dependency | Installed use and limit | Follow-up |
| --- | --- | --- |
| [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | Expo CLI/fingerprint and Jest filesystem scans. No application route accepts glob patterns or exposes a production glob service. | Upstream fix starts at 14.0.2, outside these dependencies’ declared major ranges; track compatible upstream releases rather than force a cross-major substitution. |
| [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) | Tooling file-pattern processing; pantry names are never passed to this matcher. | Fixed in 11.0.1, outside current tooling major ranges. |
| [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Jest configuration merge, with repository-owned config. | No patched upstream version published at review time; revisit when Jest changes its dependency. |

These findings are retained in the review, not suppressed in npm audit. This assessment is based on the dependency paths and application imports, not a claim that the packages themselves are patched.


## SonarCloud review evidence

The sole open issue is `AaG9XLAvR-6YnTPhESk-`, S5332, in `scripts/e2e-fixtures.ts`. Both APK endpoints are strictly allowlisted and use disposable local accounts. The proxy binds only 127.0.0.1; the phone reaches its own loopback through authorized ADB reverse. The hosted app's HTTPS configuration is unchanged. A narrowly scoped false-positive review is appropriate; the S5332 rule and quality gate remain enabled. Browser control could not reliably inspect the Opera URL, and the dedicated browser host was unavailable, so authenticated triage has not been performed.

## Official references

- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://expo.dev/changelog/sdk-53
- https://expo.dev/changelog/sdk-54
- https://expo.dev/changelog/sdk-55
- https://expo.dev/changelog/sdk-56
- https://expo.dev/changelog/sdk-57
- https://expo.dev/changelog/sdk-58
