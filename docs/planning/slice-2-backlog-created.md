# Slice 2 Jira backlog — created and verified

[KAN-6](https://michaelwuerthner.atlassian.net/browse/KAN-6) — **[Slice 2] Shopping List MVP**

Created 21 issues: one Epic, five Tasks and fifteen Subtasks. All issue keys are unique; every issue was read back after creation and again during final read-only verification. No existing matching shopping issues were found or reused. No unrelated issues were changed.

Application architecture reference: main 2e2535057efd7b71af56be120bbff4aff73bf8f9. The approved narrow CLI extension is commit 16bc6c8 (PR #7); it passed 28 fixture tests. No application code, dependency or migration was implemented/applied in this task.

Operation identifier: PF-S2-BACKLOG-20261109-fabf054c-d6f1-4428-b5d3-e2f73f9f571a. Each issue also has its deterministic PF-S2 backlog identifier in its description and labels. Writes were sequential, previewed and executed once through the existing CLI with exact --apply. No ambiguous write, automatic retry or failed creation occurred. Credentials were not exported.

## Hierarchy

### [KAN-7](https://michaelwuerthner.atlassian.net/browse/KAN-7) — Shopping List Domain Model and Database

Priority: **High**. Parent: [KAN-6](https://michaelwuerthner.atlassian.net/browse/KAN-6).

- [KAN-8](https://michaelwuerthner.atlassian.net/browse/KAN-8) — Define shopping-list entities, relationships, and database migrations
- [KAN-9](https://michaelwuerthner.atlassian.net/browse/KAN-9) — Implement household-scoped Row Level Security policies
- [KAN-10](https://michaelwuerthner.atlassian.net/browse/KAN-10) — Implement data constraints and concurrency/authorization regression tests

### [KAN-11](https://michaelwuerthner.atlassian.net/browse/KAN-11) — Shopping List Operations

Priority: **High**. Parent: [KAN-6](https://michaelwuerthner.atlassian.net/browse/KAN-6).

- [KAN-12](https://michaelwuerthner.atlassian.net/browse/KAN-12) — Implement create, read, update, complete/reopen, and delete operations
- [KAN-13](https://michaelwuerthner.atlassian.net/browse/KAN-13) — Implement input validation, authorization handling, and predictable error mapping
- [KAN-14](https://michaelwuerthner.atlassian.net/browse/KAN-14) — Implement unit and integration tests for supported operations

### [KAN-15](https://michaelwuerthner.atlassian.net/browse/KAN-15) — Shopping List Mobile UI

Priority: **High**. Parent: [KAN-6](https://michaelwuerthner.atlassian.net/browse/KAN-6).

- [KAN-16](https://michaelwuerthner.atlassian.net/browse/KAN-16) — Implement shopping-list screen and navigation
- [KAN-17](https://michaelwuerthner.atlassian.net/browse/KAN-17) — Implement item creation, editing, completion, reopening, and removal interactions
- [KAN-18](https://michaelwuerthner.atlassian.net/browse/KAN-18) — Implement loading, empty, error, and retry states

### [KAN-19](https://michaelwuerthner.atlassian.net/browse/KAN-19) — Pantry-to-Shopping-List Integration

Priority: **Medium**. Parent: [KAN-6](https://michaelwuerthner.atlassian.net/browse/KAN-6).

- [KAN-20](https://michaelwuerthner.atlassian.net/browse/KAN-20) — Implement adding an existing pantry item to the shopping list
- [KAN-21](https://michaelwuerthner.atlassian.net/browse/KAN-21) — Define and implement duplicate handling
- [KAN-22](https://michaelwuerthner.atlassian.net/browse/KAN-22) — Implement integration and regression tests

### [KAN-23](https://michaelwuerthner.atlassian.net/browse/KAN-23) — Quality Assurance and Release Validation

Priority: **High**. Parent: [KAN-6](https://michaelwuerthner.atlassian.net/browse/KAN-6).

- [KAN-24](https://michaelwuerthner.atlassian.net/browse/KAN-24) — Extend unit, database, and behavioral regression coverage
- [KAN-25](https://michaelwuerthner.atlassian.net/browse/KAN-25) — Implement a Maestro Android E2E scenario for the shopping-list workflow
- [KAN-26](https://michaelwuerthner.atlassian.net/browse/KAN-26) — Execute physical-device smoke testing and collect release evidence

## Implementation guidance

Start with [KAN-7](https://michaelwuerthner.atlassian.net/browse/KAN-7) and its domain/migration subtask [KAN-8](https://michaelwuerthner.atlassian.net/browse/KAN-8). Resolve the explicitly open shopping duplicate and completion/reopen contracts before database implementation. Do not relax pantry Slice 1.1 uniqueness or copy the older PRD removal-on-check example over the newer reopen requirement.

Descriptions reference existing Supabase/AuthGate/household membership, useHousehold, PantryProvider state/mutation patterns, pantry-data validation/pagination, native components/theme/i18n, migrations 00001–00003 and the existing Node/RNTL/pgTAP/local API/Maestro harness. They distinguish these from shopping modules/tables/screens that do not exist yet.

Dependencies are explicit in descriptions because the CLI does not expose native issue-link writes. Database contract precedes persisted operations; UI design and test planning can start alongside foundation work; final validation follows integrated UI/pantry workflows. No unnecessary all-task serialization is required.

Native priorities match the requested High/Medium priorities for all five Tasks. The Subtask creation screen does not expose priority, so no unsupported priority field was sent for Subtasks (Jira currently defaults them to Medium). Parent fields were set and independently verified for all twenty children.

The only skipped optional operation was creating native dependency links; descriptions provide the requested fallback. Pending email-confirmation PR #3 remains an independent production release gate. This planning result does not claim Slice 2 implementation or production readiness.
