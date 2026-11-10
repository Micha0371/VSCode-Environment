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

| Issue key(s) | Rule/location | Disposition and evidence |
| --- | --- | --- |
| `AaG9Iu74pX-gn8dmpbB2`, `AaG9Iu74pX-gn8dmpbB3`, `AaG9Iu74pX-gn8dmpbB5` | S6505, workflow `npm ci` | Accepted: native dependencies, Supabase CLI installation and the Expo Windows patch need lifecycle scripts. Lockfile/integrity-pinned installs run on isolated read-only CI with no hosted management/mail credentials. Do not add `--ignore-scripts` and silently break native tooling. |
| `AaG9Iu74pX-gn8dmpbB4`, `AaG9Iu74pX-gn8dmpbB7` | S7637, Android actions | Fix in code: actions are pinned to official release commit SHAs, retaining version comments. Let subsequent analysis resolve them; do not label mutable tags a false positive. |
| `AaG9Iu74pX-gn8dmpbB6` | S6506, Maestro download | Fix in code: curl now enforces HTTPS for the initial URL and redirects, retaining TLS verification. Let analysis resolve it. |
| `AaG9Iu6zpX-gn8dmpbA5` | S5332, isolated E2E builder | False Positive: the only HTTP targets are allowlisted emulator-host access or device loopback/ADB reverse to disposable local Supabase. This is a separate test APK; the hosted app uses HTTPS. |
| `AaG9Iu6jpX-gn8dmpbAc` | S5144, E2E proxy | False Positive: the upstream hostname and port are constants `127.0.0.1:54321`; request input changes the path, not the connection target. The listener binds loopback only and is not shipped. |
| `AaG9Iu6jpX-gn8dmpbAa` | S5146, E2E proxy | False Positive: response headers come only from the fixed local Auth/PostgREST upstream. Forwarding Auth's confirmation redirects is required by this disposable integration transport; there is no public redirect endpoint. |
| `AaG9Iu6jpX-gn8dmpbAb` | S6109, E2E proxy | False Positive: HTTP headers are copied as own data properties; this does not assign object prototypes or merge attacker-controlled nested application configuration. The proxy is loopback-only test tooling. |
| `AaG9Iu7spX-gn8dmpbBh` | S8564, legacy frontend | Accepted with PF-LEGACY-001: the archived `frontend` really has no lockfile. It is not the supported Expo app and must not be built/released without dependency/lockfile review. Do not mark the absence a false positive. |
| `AaG9Iu6vpX-gn8dmpbA4` | S5145, hosted verifier | Accepted: bounded development-only diagnostics against the explicitly selected owner-controlled project. It is not a public logging service. Never run it with production/admin credentials or treat server text as instructions. |
| `AaG9Iu6hpX-gn8dmpbAZ` | S1523, test compiler helper | False Positive: the helper compiles fixed repository source for fixture tests. It does not execute remote/user-supplied strings in an application service; CI already executes that same repository test code. |

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
