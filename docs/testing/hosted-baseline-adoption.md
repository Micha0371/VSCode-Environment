# KAN-29 — Hosted migration-history adoption

Status: analysis/procedure prepared; **hosted adoption has not been performed**.
Owner review and explicit authorization are required before the repair command.
Task: [KAN-29](https://michaelwuerthner.atlassian.net/browse/KAN-29), PF-DB-001b.

## Target and reference

- Hosted development project: `PantryFlow_Emergent`, `oiqteedkfwmcertgxqga`.
- Source reference: `35e967069d499e71abe019ef6312a6e750b278ee` (merged KAN-28).
  Record this procedure's reviewed PR commit separately in the execution record.
- Local reference: a fresh `pantryflow-tests` PostgreSQL 17.11 reset replaying
  unchanged migrations 00001–00003. Hosted PostgreSQL is 17.6.
- Supabase CLI: existing pinned 2.122.1. Use the existing local CLI login; never
  supply tokens, service keys, database URLs/passwords or debug output in commands.
- Application SQL and all historical migration files remain unchanged. This is
  ledger adoption, not an application-schema migration or production approval.

Supabase's [repair reference](https://supabase.com/docs/reference/cli/supabase-migration-repair)
states that `--status applied` inserts migration-history records without executing
the migration SQL. The exact three short versions were rehearsed on the disposable
local PostgreSQL 17 ledger using this pinned CLI; names/versions were read back,
and application catalog/row snapshots were unchanged. The local data was empty,
so this is not a populated-data upgrade test.

## Baseline analysis — 2026-11-11

The hosted ledger is absent. `scripts/catalog-snapshot.sql` matches local 17 for
four tables, 24 columns, 18 constraints, eight indexes, eight RLS policies, four
triggers, five application functions, 56 effective table-privilege decisions and
192 column-privilege decisions. JSON key order and CRLF/LF are insignificant.
Hosted `handle_new_profile` explicitly inserts `My Household`, equivalent to the
identical local household-name column default. No application discrepancy was
found in those sections.

The additional `scripts/baseline-inventory.sql` detects public non-extension
tables/views/materialized views/sequences/foreign tables, routines, enum/domain
types and user triggers on public tables or `auth.users`. It found exactly the
four application tables, no extra relations/types, the expected four row triggers
and `uuid-ossp` 1.1 in `extensions`. It also found the following hosted-only
configuration, which **must be explicitly accepted**, not silently ignored:

| Object | Observed definition / effect |
| --- | --- |
| `public.rls_auto_enable()` | No arguments, owner postgres, SECURITY DEFINER, search_path pg_catalog; enables RLS for newly created public tables. Errors are logged and swallowed. Normalized function-definition SHA-256: `dd9ce3fd3905d621611cf0ea2e7591bada6d61f827445cfa2afe27e69b03f271`. |
| `ensure_rls` | Owner postgres, enabled `O`, event ddl_command_end, tags CREATE TABLE / CREATE TABLE AS / SELECT INTO, invokes rls_auto_enable. |

The helper's purpose corresponds to the official [event-trigger example](https://supabase.com/docs/guides/database/postgres/event-triggers).
Its installation provenance is unknown; it is not declared by 00001–00003 and
is absent from the local reference. Proposed disposition: preserve it as an
explicit hosted configuration exception. Do not claim a byte-identical rebuild
of the entire hosted platform. KAN-8 must still explicitly enable/test RLS on
new application tables; it must not depend on this hosted helper. This procedure
does not install, drop or alter that function or event trigger.

The inventory is application-focused, not a complete audit of Supabase-managed
schemas, roles or every database object class. Any newly observed difference,
changed helper definition/attachment or unexpected ledger content stops adoption.

## Prepare an isolated non-test workdir

Use **Command Prompt**, starting in `pantry-flow` at the reviewed commit. Ensure
the worktree is clean and no other operator is changing schema/history. Keep
the disposable project's `.temp/project-ref` and `.temp/linked-project.json`
absent throughout. The following copies go only to ignored local state:

```bat
set PF_BASELINE_ROOT=%CD%
mkdir .verification\kan29-hosted\supabase\migrations
copy ops\hosted-baseline\supabase\config.toml .verification\kan29-hosted\supabase\config.toml
copy supabase\migrations\00001_first_slice.sql .verification\kan29-hosted\supabase\migrations\00001_first_slice.sql
copy supabase\migrations\00002_review_hardening.sql .verification\kan29-hosted\supabase\migrations\00002_review_hardening.sql
copy supabase\migrations\00003_strict_duplicate_prevention.sql .verification\kan29-hosted\supabase\migrations\00003_strict_duplicate_prevention.sql
```

Inspect that staged directory: exactly those three migrations, unchanged from
the reviewed commit. If it contains other migrations, stop and use a fresh
isolated directory. Existing directories may make `mkdir` report already exists;
that is not permission to reuse unreviewed contents. Never run `supabase link`
inside `pantry-flow`, and never run start/reset/push from this hosted workdir.

## Immediately-before-adoption checks

Refresh the local reference with `npm run db:reset` (local only), then query both
catalog files locally using `--local` and the hosted target using the commands
below. The hosted query's workdir is deliberately separate from the test stack.

```bat
node node_modules/supabase/dist/supabase.js db query --local --file "%PF_BASELINE_ROOT%\scripts\catalog-snapshot.sql" --output-format json
node node_modules/supabase/dist/supabase.js db query --local --file "%PF_BASELINE_ROOT%\scripts\baseline-inventory.sql" --output-format json
node node_modules/supabase/dist/supabase.js db query --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/kan29-hosted --file "%PF_BASELINE_ROOT%\scripts\catalog-snapshot.sql" --output-format json
node node_modules/supabase/dist/supabase.js db query --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/kan29-hosted --file "%PF_BASELINE_ROOT%\scripts\baseline-inventory.sql" --output-format json
```

All four files execute in explicit read-only transactions and select catalogs
only. Save outputs in ignored `.verification`, compare JSON semantics and review
the exact exceptions above. Require the hosted ledger to remain absent; if it
already exists, inspect its contents instead of assuming the repair is needed.
Do not run a migration-list command against an absent ledger as a substitute
for the read-only existence check. Confirm the reviewed commit and migration
contents have not changed, and obtain owner authorization for the action below.

## Exact proposed hosted write — only after owner authorization

```bat
node node_modules/supabase/dist/supabase.js migration repair 00001 00002 00003 --status applied --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/kan29-hosted
```

This creates/initializes Supabase's migration-history objects and records exactly
those versions. No application migration SQL is replayed. Do not replace it with
`db push`, `migration up`, SQL Editor replay or a handwritten ledger INSERT.
Do not use `--status reverted` to conceal a failed or partial result. If the
command fails, times out or is interrupted, inspect the ledger read-only before
deciding on any retry; never assume that nothing was written.

## Read back and acceptance

After the repair, rerun the hosted inventory first to confirm ledger existence,
then use both the CLI migration list and direct read-only version/name query:

```bat
node node_modules/supabase/dist/supabase.js migration list --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/kan29-hosted
node node_modules/supabase/dist/supabase.js db query --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/kan29-hosted --file "%PF_BASELINE_ROOT%\ops\hosted-baseline\read-back.sql" --output-format json
```

Require exactly `00001 / first_slice`, `00002 / review_hardening`, and
`00003 / strict_duplicate_prevention`, with no other versions. Repeat the hosted
catalog and object inventory and compare to the immediately-before snapshots:
application metadata must be unchanged, with only ledger presence changing in
the inventory. Review aggregate row counts if recorded during the change window;
no application row-changing SQL is part of this procedure. Stop and investigate
any unexpected result. No unreviewed automatic rollback or additional migration.

Append execution timestamp, operator authorization, reviewed commit, exact
command, ledger read-back, post-comparison result and test-project unlink checks
to the execution record. Do not mark KAN-29 done merely because this procedure
exists. Before any later hosted Slice 2 migration, repeat the drift check, review
that migration's exact content and pending version list, then obtain authorization
for the tracked application operation. This baseline authorization does not
authorize applying a future migration.
