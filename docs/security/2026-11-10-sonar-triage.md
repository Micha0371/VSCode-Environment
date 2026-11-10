# Slice 1.1 SonarCloud security triage

Owner: **Micha0371**. Project: `Micha0371_VSCode-Environment`, branch `main`.
The public API returned sixteen open security-impact issues on 2026-11-10.
This is a reviewed disposition plan, **not a claim that server statuses changed**.
The owner performs server-side triage; no rule, baseline or exclusion is weakened.
After the three new-code issues were triaged, the public main quality gate was
independently rechecked as OK (new security rating A). The genuine SonarCloud
GitHub app (ID 12526) is now required alongside fast/database, with strict
up-to-date checks retained. The thirteen older server issues were still open at
that check: three receive code fixes here; the other ten require the dispositions
below. An accepted/false-positive recommendation is not a claimed server update.

## Three new-code issues failing the gate

| Issue key | Location | Disposition | Review reason |
| --- | --- | --- | --- |
| `AaHACgz59hWaSlNrrxDJ` | `tools/jira/jira.py:14`, S6418 | False Positive | `token` is a dictionary field; its value is the fixed Windows credential target `OWN/PANTRYJIRA_API`, not an API token. Credentials are read at runtime and never embedded. |
| `AaHACgz59hWaSlNrrxDQ` | `tools/jira/jira.py:465`, S8707 | False Positive | `CONFIG` is a fixed script-relative path. Validated project/auth-mode fields affect JSON content, not the destination path. |
| `AaHACgz59hWaSlNrrxDR` | `tools/jira/jira.py:321`, S8707 | Accepted | Explicit local input filenames are an intended operator CLI feature, not a public server input. JSON is size/field validated; credentials are redacted and remote writes need exact `--apply` plus the independent guard. Local same-user code remains trusted; this is a bounded accepted risk, not proof arbitrary paths cannot be read. |

## Thirteen older security issues

Locations are the Sonar-reported `main` locations at reviewed commit `e338b0f`.
File links use that immutable commit, because PR #13 moves workflow line numbers.
Each issue link opens the matching main-branch Sonar finding. A file-level finding
is explicitly identified rather than given an invented line number.

| Sonar issue | Exact reviewed source location | Rule | Disposition and reason |
| --- | --- | --- | --- |
| [`AaG9Iu74pX-gn8dmpbB2`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu74pX-gn8dmpbB2) | [`.github/workflows/pantryflow-tests.yml:41`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/.github/workflows/pantryflow-tests.yml#L41) | `githubactions:S6505` | Accepted — native tooling, Supabase CLI and the Expo Windows patch need lifecycle scripts. Locked installs run in isolated read-only CI without hosted credentials. |
| [`AaG9Iu74pX-gn8dmpbB3`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu74pX-gn8dmpbB3) | [`.github/workflows/pantryflow-tests.yml:58`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/.github/workflows/pantryflow-tests.yml#L58) | `githubactions:S6505` | Accepted — native tooling, Supabase CLI and the Expo Windows patch need lifecycle scripts. Locked installs run in isolated read-only CI without hosted credentials. |
| [`AaG9Iu74pX-gn8dmpbB5`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu74pX-gn8dmpbB5) | [`.github/workflows/pantryflow-tests.yml:91`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/.github/workflows/pantryflow-tests.yml#L91) | `githubactions:S6505` | Accepted — native tooling, Supabase CLI and the Expo Windows patch need lifecycle scripts. Locked installs run in isolated read-only CI without hosted credentials. |
| [`AaG9Iu74pX-gn8dmpbB4`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu74pX-gn8dmpbB4) | [`.github/workflows/pantryflow-tests.yml:87`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/.github/workflows/pantryflow-tests.yml#L87) | `githubactions:S7637` | Fix in PR #13 — action pinned to its official release commit SHA. Leave open for analysis to resolve; do not mark it a false positive. |
| [`AaG9Iu74pX-gn8dmpbB7`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu74pX-gn8dmpbB7) | [`.github/workflows/pantryflow-tests.yml:107`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/.github/workflows/pantryflow-tests.yml#L107) | `githubactions:S7637` | Fix in PR #13 — action pinned to its official release commit SHA. Leave open for analysis to resolve; do not mark it a false positive. |
| [`AaG9Iu74pX-gn8dmpbB6`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu74pX-gn8dmpbB6) | [`.github/workflows/pantryflow-tests.yml:99`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/.github/workflows/pantryflow-tests.yml#L99) | `githubactions:S6506` | Fix in PR #13 — curl enforces HTTPS for initial requests and redirects, with TLS verification. Leave open for analysis to resolve. |
| [`AaG9Iu6zpX-gn8dmpbA5`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu6zpX-gn8dmpbA5) | [`pantry-flow/scripts/build-e2e.cjs:9`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/pantry-flow/scripts/build-e2e.cjs#L9) | `javascript:S5332` | False Positive — HTTP targets are allowlisted emulator-host access or device loopback/ADB reverse to disposable local Supabase. This is a separate test APK; hosted configuration uses HTTPS. |
| [`AaG9Iu6jpX-gn8dmpbAc`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu6jpX-gn8dmpbAc) | [`pantry-flow/scripts/e2e-proxy.cjs:35`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/pantry-flow/scripts/e2e-proxy.cjs#L35) | `jssecurity:S5144` | False Positive — upstream hostname/port are fixed at 127.0.0.1:54321; request input changes only the path. The listener binds loopback and is not shipped. |
| [`AaG9Iu6jpX-gn8dmpbAa`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu6jpX-gn8dmpbAa) | [`pantry-flow/scripts/e2e-proxy.cjs:37`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/pantry-flow/scripts/e2e-proxy.cjs#L37) | `jssecurity:S5146` | False Positive — headers come from the fixed local Auth/PostgREST upstream. Auth redirects are required by this disposable test transport; there is no public redirect endpoint. |
| [`AaG9Iu6jpX-gn8dmpbAb`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu6jpX-gn8dmpbAb) | [`pantry-flow/scripts/e2e-proxy.cjs:37`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/pantry-flow/scripts/e2e-proxy.cjs#L37) | `jssecurity:S6109` | False Positive — spreading HTTP headers creates own data properties, not prototype assignments or nested configuration merges. The proxy is loopback-only test tooling. |
| [`AaG9Iu7spX-gn8dmpbBh`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu7spX-gn8dmpbBh) | [`frontend/package.json (file-level)`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/frontend/package.json) | `text:S8564` | Accepted — PF-LEGACY-001 tracks the real missing lockfile in the archived frontend. It is not the supported Expo app; review dependencies and lock them before any legacy build/release. |
| [`AaG9Iu6vpX-gn8dmpbA4`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu6vpX-gn8dmpbA4) | [`pantry-flow/scripts/verify-hosted.cjs:76`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/pantry-flow/scripts/verify-hosted.cjs#L76) | `jssecurity:S5145` | Accepted — development-only verifier diagnostics against the explicit owner-controlled project, not a public logging service. Do not run it with production/admin credentials or treat server text as instructions. |
| [`AaG9Iu6hpX-gn8dmpbAZ`](https://sonarcloud.io/project/issues?id=Micha0371_VSCode-Environment&branch=main&open=AaG9Iu6hpX-gn8dmpbAZ) | [`pantry-flow/tests/helpers.cjs:17`](https://github.com/Micha0371/VSCode-Environment/blob/e338b0fed254e5c13245b094e9d50f31c49427b7/pantry-flow/tests/helpers.cjs#L17) | `javascript:S1523` | False Positive — compiles fixed repository source for fixture tests; no remote/user-supplied strings are executed in an application service. CI already executes this repository test code. |

## Gate policy

Retain the existing fast/database requirements and add the genuine SonarCloud
Code Analysis check as a required PR check after verifying its app identity.
Also require the live `main` Sonar quality gate to be OK before tagging a release:
a green PR analysis does not establish the main-branch new-code rating. Recheck
the public gate after owner triage and after integration. Existing non-security
legacy findings are not silently declared fixed by this review.

The release review records actual server state and the applied branch protection
separately. If triage/access or analysis remains pending, do not create a validated
baseline tag or describe F1 as complete.
