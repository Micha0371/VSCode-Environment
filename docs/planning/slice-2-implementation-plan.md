# Slice 2 implementation plan — refreshed 2026-11-10

Baseline: annotated tag `pantryflow/slice-1.1-baseline` (`df57e2f`, PR #13).
This record supersedes the repository reference, release-gate wording and open
decisions in [the backlog plan](slice-2-backlog-plan.md) and
[the created-backlog record](slice-2-backlog-created.md). Those files remain the
historical record of the 2026-11-09 Jira import. The Jira epic
[KAN-6](https://michaelwuerthner.atlassian.net/browse/KAN-6) (Shopping List MVP) and
[KAN-8](https://michaelwuerthner.atlassian.net/browse/KAN-8) (Define shopping-list
entities, relationships, and database migrations) were refreshed to match, and
KAN-19 (Pantry-to-Shopping-List Integration) and KAN-20 (Implement adding an
existing pantry item to the shopping list) were narrowed to the D3 prompt. The
other backlog descriptions were left unchanged and are read together with this file.

## Superseded assumptions

| Earlier assumption | Current state | Resolution |
| --- | --- | --- |
| Base on `main` 2e25350; email-confirmation PR #3 is a pending release gate | PR #3 merged (PF-EMAIL-001 complete). Remaining launch gates PF-IOS-001, PF-AUTH-001, PF-I18N-001 and PF-DATA-001 are in [production follow-ups](../testing/production-follow-ups.md) | Slice 2 builds on the tag above; launch gates are not Slice 2 acceptance criteria |
| Build plan's Slice 2 list includes pantry filters, German content and a language switcher | `de.ts` is an empty stub; Settings has no language switcher; the Jira backlog omits all three | Deferred to a separate localization slice (D5) |
| PRD §10 / Flow 5: checking off removes the item | Backlog requires complete/reopen | Completion is retained and reopenable (D2) |
| PRD schema sketch: single-column `pantry_item_id ... ON DELETE SET NULL`, no `TO authenticated`, no column grants | A single-column foreign key cannot prevent cross-household links; 00002 conventions use `TO authenticated` policies, column grants and `ON DELETE SET NULL` creators | Composite foreign key and current conventions (D4) |
| KAN-8 has no database prerequisites | PF-DB-001: hosted PostgreSQL 17.6 vs local/CI major 15; hosted migration ledger absent | New prerequisites KAN-28 and KAN-29 |
| KAN-19: "explicit action or confirmed low/out prompt" | Status changes only on save in `app/edit-item/[id].tsx` | Confirmed prompt after save (D3) |
| KAN-27 under the Slice 2 epic could appear blocking | Its description and `non-blocking` label already state it does not block Slice 2 | No change; low-priority maintenance |

## Owner decisions

| ID | Decision |
| --- | --- |
| D1 Duplicates | Names are unique among **open** items only, enforced by a partial unique index reusing `pantry_trim_item_name` and the pantry case rules. Manual and pantry-linked adds share one name space. Adding or reopening when an open duplicate exists returns a translated duplicate error; nothing is silently merged or renamed. Pantry strict uniqueness is unchanged. |
| D2 Completion | A server-set completion timestamp; reopen is allowed; completed items remain until deleted individually. No bulk clear-completed. |
| D3 Pantry entry point | Confirmed prompt (PRD Flow 3). After a successful save in `app/edit-item/[id].tsx` that changes the status to low or out, the app asks "Add to shopping list?". Yes calls the same shopping add operation as a manual add, linked to that pantry item; No or dismiss does nothing. The pantry save is already persisted and is never rolled back by the prompt outcome; an open duplicate (D1) shows the translated duplicate message. No prompt when the status is unchanged or in stock; new pantry items start in stock, so adding one never prompts. No separate "add to shopping list" button in Slice 2. |
| D4 Pantry deletion | The optional link is set to null and the shopping item keeps its own name. Same-household linking uses a composite foreign key `(household_id, pantry_item_id)` referencing a new `UNIQUE (household_id, id)` on `pantry_items`, with `ON DELETE SET NULL (pantry_item_id)` (PostgreSQL 15+). |
| D5 Localization | Pantry category/status filters, German content and the language switcher move to a separate localization slice, possibly with more European languages. Slice 2 strings are English-only. |
| D6 Hosted environment | The hosted project is non-production. PF-DATA-001 does not gate applying the Slice 2 migration there; it remains a production gate. |

## Dependency-ordered plan

Each step is a small PR from current `main`. Every PR carries its own automated
tests (KAN-24, Extend unit, database, and behavioral regression coverage) and
must pass the required fast, database and SonarCloud checks.

| Step | Change | Jira | Depends on | Gate |
| --- | --- | --- | --- | --- |
| 0 | Disposable stack to PostgreSQL 17; rerun full harness and read-only catalog comparison | [KAN-28](https://michaelwuerthner.atlassian.net/browse/KAN-28) (PF-DB-001a: Align local/CI PostgreSQL to major 17) | — | Full CI including Android |
| 1 | `00004` shopping migration: table, RLS, grants, constraints, pgTAP and ordinary-user API tests in **one** PR, so no table without RLS reaches `main` | KAN-7, KAN-8, KAN-9, KAN-10 | 0 | Two-household, concurrency and direct-API-bypass tests |
| 2a | Extract household scope from `PantryProvider`; behaviour-preserving refactor with regression tests | KAN-11 | 1 | Existing suites unchanged |
| 2b | Shopping data module and provider | KAN-12, KAN-13, KAN-14 | 2a | Unit and local integration tests |
| 3a | Shopping tab between Pantry and Settings; loading/empty/error/retry states | KAN-16, KAN-18 | 2b | Screen tests |
| 3b | Add, edit, complete, reopen and remove interactions | KAN-17 | 3a | Screen tests and `[full-e2e]` Android run |
| 4 | Low/out prompt after pantry save and duplicate handling | KAN-20, KAN-21, KAN-22 | 3b | Tests prove the prompt fires only on a change to low/out and shopping never changes pantry state |
| 5 | Maestro shopping journey, then physical-device evidence | KAN-25, KAN-26 | 4 | Fresh test APK, direct database read-back |
| H | Adopt hosted migration history, then apply `00004` to hosted through the tracked path | [KAN-29](https://michaelwuerthner.atlassian.net/browse/KAN-29) (PF-DB-001b: Adopt hosted migration-history baseline) | 0, 1 | Drift-free catalog comparison before each hosted step; owner runs or authorizes |

Step H does not block local development but must precede any hosted use of the
Slice 2 schema. Never apply untracked SQL to the hosted project.

## Engineering constraints

- Preserve the household authorization boundary and pantry strict duplicate prevention.
- PostgreSQL constraints and RLS remain authoritative; client validation is a convenience.
- Keep business rules in data modules and providers, not UI handlers.
- Every feature has acceptance criteria and automated tests before it is accepted.
- Changes reach `main` only through reviewed PRs; tooling outside this repository (for example earlier Emergent workspaces) must not push to it or write to the hosted database.
