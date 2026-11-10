# Slice 2 backlog execution plan

> Historical record of the 2026-11-09 backlog import. Its repository reference,
> release-gate wording and open decisions are superseded by the
> [refreshed implementation plan](slice-2-implementation-plan.md).

Repository reference: validated main 2e2535057efd7b71af56be120bbff4aff73bf8f9 (SDK 58, migrations 00001–00003, merged Jira hardening #5). Pending email-confirmation PR #3 is a separate release gate, not an existing main feature. The source brief authorizes backlog creation only; no Slice 2 implementation or migration execution is included.

## Architecture reuse

| Existing source | Backlog implication |
| --- | --- |
| pantry-flow/lib/supabase.ts, lib/auth.tsx, components/AuthGate.tsx | Reuse the same client, session lifecycle and route guards; no backend server or second auth service. |
| pantry-flow/hooks/useHousehold.ts and hooks/usePantryItems.tsx | Household resolution currently lives once inside PantryProvider. Share that scope for shopping through existing exposure or a minimal reviewed extraction; do not invent an already-existing generic household provider or duplicate lookup per screen. |
| pantry-flow/lib/pantry-data.ts | Follow validation, parsing, pagination and translated error patterns. It is pantry-specific, not a generic repository; add shopping-specific domain functions only where needed. |
| pantry-flow/hooks/usePantryItems.tsx, hooks/useItemMutation.ts | Preserve identity-keyed state, stale-read invalidation, per-item mutation exclusion and abandoned-navigation handling in the shopping workflow. |
| pantry-flow/supabase/migrations/00001_first_slice.sql and 00002_review_hardening.sql | Reuse pantry_households/members and auth.uid membership-based RLS, restricted column grants, immutable attribution and server-owned timestamps; no parallel authorization framework exists or is needed. |
| pantry-flow/supabase/migrations/00003_strict_duplicate_prevention.sql | Preserve pantry uniqueness unchanged. Reuse its normalization/concurrency lessons; shopping duplicate semantics require an explicit documented decision before migration. |
| pantry-flow/app/(tabs)/_layout.tsx, app/_layout.tsx, components/*, lib/theme.ts, lib/i18n/* | Extend two existing tabs with Shopping between Pantry and Settings; reuse components, styling and translations. Do not redesign screens or add a second UI stack. |
| pantry-flow/tests/*, supabase/tests/database/*, tests/integration/*, .maestro/slice-1-1.yaml, scripts/e2e-*.{ts,cjs}, .github/workflows/pantryflow-tests.yml | Extend existing Node/RNTL, pgTAP, isolated Auth/PostgREST and Maestro harness. Preserve reserved fixture cleanup and all Slice 1.1 scenarios; no parallel test platform. |

The older PRD shopping table is a design seed, not an applied migration. Current repository has no shopping table, provider, data module or screen. The latest brief requires complete/reopen; completed items must remain recoverable until explicit removal, rather than silently copying the older PRD's removal-on-check behavior. Any quantity, premium, invitation or real-time scope remains excluded. Optional pantry linkage must be household-consistent at the database boundary and preserve a standalone shopping name after pantry deletion.

## Planned Jira changes

Create one Epic, five Tasks and fifteen Subtasks (21 issues total), only after deduplication and hierarchy/priority metadata checks. Existing KAN-1 through KAN-5 are examples, a completed operational test and unrelated tooling debt; none match Shopping List MVP. Use deterministic per-item backlog identifiers plus one operation identifier, sequential writes, preview then exact --apply, and independent read-back including parent and priority after every issue. Never retry an uncertain write automatically.

| Alias | Task | Priority | Dependency and parallel work |
| --- | --- | --- | --- |
| T1 | Shopping List Domain Model and Database | High | First implementation task. Resolve domain/duplicate decisions before migration. |
| T2 | Shopping List Operations | High | Depends on T1 schema/security contract; API/test design can start alongside T1. |
| T3 | Shopping List Mobile UI | High | Persists against T2. UI/navigation design can start once T1 contract is agreed. |
| T4 | Pantry-to-Shopping-List Integration | Medium | Depends on T1/T2 and agreed duplicate contract; pantry entrypoint design can parallel T3. |
| T5 | Quality Assurance and Release Validation | High | Matrix/fixtures start with T1; final build/E2E/device evidence depends on T1–T4. |

Each Task has the three requested Subtasks, an implementation context citing actual files, testable acceptance criteria, exclusions, priority and explicit dependencies. Native Jira dependency links are optional; the current CLI lacks them, so dependencies will be in descriptions. No unsupported issue-link command will be introduced for this purpose.

## Required tooling capability

At discovery, the secure CLI could create named types but rejected parent and priority input and did not return those fields. It could not fulfill or verify Epic → Task → Subtask until the approved extension below was implemented. The owner approved this extension. Implemented and locally validated with 28 fixture tests: read-only project issue-type creation metadata and priorities; validated parentKey/priorityId creation fields; same-project canonical parent checks and hierarchy-level validation; parent/priority in selected read-back. Retain exact --apply and the independent write gate. Do not use a separate client or bypass existing field restrictions.

## Scope decisions to record in the backlog

- Duplicate behavior for manual add, pantry add, rename, completion and reopening must be agreed explicitly; no silent relaxation of pantry Slice 1.1 or new internal-space normalization.
- Define completion persistence and reopening conflict behavior; deletion remains a separate explicit action.
- Reuse current household membership and test with two independent households and multiple members via isolated fixtures; invitations/multi-household UX are not added.
- Validate cross-household optional pantry links, immutable ownership/attribution, anonymous access and direct API bypass.
- Copying from pantry never writes pantry status on completion/reopen/delete; no automatic sync.
- Release evidence must report pending real email-confirmation gate separately; no premature production-ready claim.

Actual creation metadata confirms Epic 10006 (level 1), Task 10008 (level 0), and Subtask 10007 (level -1), with native parent fields. High priority is ID 2; Medium is ID 3. Subtask creation does not expose priority, so only supported native fields are sent; Task priorities follow the brief. The sequential writer uses pre-write operation journals and read-back verification.

## Execution result

Completed: 21 issues created and independently verified twice, with one final project search confirming exactly 21 unique Slice 2 items. See [the final issue map and report](slice-2-backlog-created.md). No matches were reused, no writes failed or were retried, and no application code changed.
