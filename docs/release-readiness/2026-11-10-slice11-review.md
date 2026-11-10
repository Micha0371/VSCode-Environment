# Slice 1.1 review findings — 2026-11-10

Reviewed reference: protected `main` at `e338b0f`, after PR #12. Fixes are isolated
on `pantryflow/slice11-review-findings`. Slice 2 design is GO; a validated baseline
tag still requires the P1 gate and exact-commit CI evidence below. Public launch
remains a separate NO-GO decision.

| Finding | Disposition / evidence |
| --- | --- |
| F1 — hidden red Sonar main gate | Sixteen security findings reviewed in [the triage plan](../security/2026-11-10-sonar-triage.md). Owner triage is complete, independently verified against main's open-issue API. Main's gate is OK. The genuine SonarCloud app is now required alongside fast/database, with strict up-to-date protection retained. Only three older findings remain open on main; official action SHAs and HTTPS-only redirects fix them in this PR, pending post-merge analysis. No suppression or new-code-baseline reset is used. |
| F2 — weekly Android run cancelled by pushes | Workflow cancellation now applies only to superseded PR runs. Scheduled/manual/main active runs are preserved. Startup output is captured with pipe failure propagation; only failed startups upload a separately redacted file, including when tests never start. Successful startup logs are not uploaded. Fresh CI validation is pending. A pending schedule can still be replaced within GitHub's shared concurrency group; this non-blocking queue limitation is retained. |
| F3 — deployed schema unknown | Completed read-only hosted/catalog comparison below. No unexplained application-schema difference. Migration history is absent and tracked as PF-DB-001 before KAN-8 reaches hosted Supabase; no remote schema/history mutation was performed. |
| F4 — confirmed fixture setup undocumented | Added [hosted verification procedure](../testing/hosted-verification.md): two confirmed disposable accounts, separate households, public-key-only assertions, exact cleanup/account cleanup limits and no global confirmation relaxation. Runner refusal now links to that procedure. A regression verifies confirmation-enabled settings cannot trigger synthetic signup. |
| F5 — ownerless iOS/premium debt | PF-IOS-001 and PF-PREMIUM-001 now have owner Micha0371, explicit deadlines and acceptance in [production follow-ups](../testing/production-follow-ups.md). This records the work; no iOS validation or entitlement correction is falsely claimed. |
| F6 — stale current counts | Renamed the 35-check record as historical PF-TEST-001 evidence and linked subsequent validation. No brittle count-enforcement test was added. |
| F7 — merged remote branches | Deleted eleven merged branch refs, each matched to its merged PR/head and guarded by an exact Git lease in an atomic push. Preserved `main`, `pantryflow/slice-1.1-validated`, `pantryflow/pf-test-001` and all unmerged/new work. Tags were untouched. |

## Hosted catalog comparison

Target: `PantryFlow_Emergent`, `oiqteedkfwmcertgxqga`, PostgreSQL 17.6.
Reference: freshly reset disposable local PostgreSQL 15 from repository migrations
00001–00003. Both snapshots used `scripts/catalog-snapshot.sql` in explicit
read-only transactions. No application user rows or credentials were selected.

Compared: four tables, 24 columns, 18 constraints, eight indexes, eight RLS
policies, four triggers, five trigger/normalization functions, 56 effective
table-privilege decisions and 192 effective column-privilege decisions for anon
and authenticated. RLS enablement, immutable client fields, profile permissions,
creator foreign-key behavior and the valid unique household/normalized-name index
match. The public table set also matches.

One textual function difference is retained in evidence: hosted
`handle_new_profile` explicitly inserts household name `My Household`, while
the repository omits that column and uses its identical default. Column defaults
match; this is equivalent for the current schema, not an unexplained security
drift. Other function differences are CRLF/LF only. Raw catalog snapshots and
the comparison summary are ignored verification artifacts, not personal data.

The hosted migration ledger does not exist, consistent with SQL Editor installs.
Do not blindly push/replay old migrations or mark arbitrary versions applied.
PF-DB-001 requires reviewed baseline-history adoption before the first Slice 2
hosted migration. This is separate from the completed read-only comparison.

## Preserved branch evidence

Removed merged PR branches: #2 SDK, #3 release readiness, #4 Jira integration,
#5 Jira safety, #6 Jira operational validation, #7 Slice 2 backlog, #8 minor
Sonar cleanup, #9 callback investigation, #10 documentation refresh, #11 SMTP
evidence and #12 DMARC follow-up ID. Their merged commits remain in history.
The two intentionally retained reference branches account for the remaining
merged branches mentioned by the review.

## Baseline and launch decision

Local validation passed: typecheck, 52 Node checks, the Jest/RNTL case, local-target
safety, all 21 pgTAP assertions and ordinary-user HTTP/email integration cases.
Workflow YAML/action pins and actual Bash pipeline failure propagation were
checked. The redaction regression preserves the observed port-collision error
while removing credential-related startup lines/tokens. No production runtime
or database behavior is changed. Exact-commit hosted CI/Android results remain
separate from these local results.

Use the distinct tag name `pantryflow/slice-1.1-baseline` when the reviewed fix
is integrated and protected main, full regression and Sonar main gates pass.
Do not create a tag named `pantryflow/slice-1.1-validated`: that name already
belongs to the historical branch. No new validated tag is created by this record.

Reuse the current membership/authorization and data abstractions for Slice 2.
Extract household context when the shopping-list consumer needs it; extract
shared read-versioning only with that concrete second use. No speculative
application refactor or new Slice 2 schema is included in these fixes.

Public launch still needs owned iOS validation, EN/DE completion, password
recovery, intended premium behavior/audit, real populated-database upgrade
coverage and the existing DMARC enforcement review. Physical execution of the
Android timeout fallback remains explicitly unclaimed; deterministic coverage
and normal physical cold-start acceptance are the existing evidence.
