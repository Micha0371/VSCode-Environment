# KAN-29 — Hosted migration-history adoption

Status: **hosted baseline adoption completed and verified on 2026-11-11**.
The owner authorized the exact operation below; see the execution record at the
end of this document. The commands remain historical procedure, not permission
to repeat the repair or apply another migration.
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

Before adoption, the hosted ledger was absent. `scripts/catalog-snapshot.sql` matched local 17 for
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
configuration, explicitly accepted by the owner before adoption:

| Object | Observed definition / effect |
| --- | --- |
| `public.rls_auto_enable()` | No arguments, owner postgres, SECURITY DEFINER, search_path pg_catalog; enables RLS for newly created public tables. Errors are logged and swallowed. Normalized function-definition SHA-256: `dd9ce3fd3905d621611cf0ea2e7591bada6d61f827445cfa2afe27e69b03f271`. |
| `ensure_rls` | Owner postgres, enabled `O`, event ddl_command_end, tags CREATE TABLE / CREATE TABLE AS / SELECT INTO, invokes rls_auto_enable. |

The helper's purpose corresponds to the official [event-trigger example](https://supabase.com/docs/guides/database/postgres/event-triggers).
Its installation provenance is unknown; it is not declared by 00001–00003 and
is absent from the local reference. Authorized disposition: preserve it as an
explicit hosted configuration exception. Do not claim a byte-identical rebuild
of the entire hosted platform. KAN-8 must still explicitly enable/test RLS on
new application tables; it must not depend on this hosted helper. This procedure
does not install, drop or alter that function or event trigger.

The inventory is application-focused, not a complete audit of Supabase-managed
schemas, roles or every database object class. Any newly observed difference,
changed helper definition/attachment or unexpected ledger content stops adoption.

## KAN-31 inventory coverage and reviewed platform differences

The inventory now records raw `proacl` for every public non-extension routine
and all non-extension-member event triggers, regardless of their function's
schema. Each event entry includes `function_schema`; extension-owned functions
do not cause their non-extension-member event triggers to be hidden. These
fields supplement the narrower application catalog rather than replacing it.

Remaining limit: event-trigger entries identify the invoked function's schema
and name, but bodies/ACLs of functions outside public are not included. A change
to `extensions.grant_pg_net_access()` implementation can therefore escape this
inventory. A deeper platform audit needs targeted read-only definition/grant
snapshots; KAN-31 does not claim that coverage.

Compare ACLs as complete grantee/privilege/grantor entries (array ordering alone
is insignificant). `X` means EXECUTE, an empty grantee means PUBLIC, and `*`
denotes grant option. A null `proacl` means PostgreSQL's default ACL, not an empty
grant set: resolve its default semantics before accepting any difference. Do
not omit ACLs when comparing definitions or normalize away added grants.
The SQL output preserves catalog ACL ordering, so a strict field comparison
can conservatively flag an order-only change. Review the complete entries
manually in that case rather than ignoring the ACL field.

The 2026-11-11 KAN-31 comparison queried hosted once, read-only, against a fresh
local 17.11 reference. All five application routines had identical local/hosted
ACLs: `=X/postgres`, `postgres=X/postgres`, `anon=X/postgres`,
`authenticated=X/postgres`, `service_role=X/postgres`. The hosted-only
`rls_auto_enable()` had the same ACL entries. This records existing grants; it
does not harden or widen them. The preserved helper and `ensure_rls` exception
above still apply, with `function_schema = public` for the event trigger.

The newly visible platform entries below are enabled `O`, owned by
`supabase_admin`, and invoke functions in `extensions`. They are reviewed by
their exact bindings, not ignored by owner or namespace. Their names and targets
identify GraphQL, cron, networking and PostgREST integration hooks; they are not
declared by the application migrations. Function implementation provenance was
not established by this catalog comparison.

| Event trigger | Function in extensions | Event | Local tags | Hosted tags |
| --- | --- | --- | --- | --- |
| issue_graphql_placeholder | set_graphql_placeholder | sql_drop | DROP EXTENSION | DROP EXTENSION |
| issue_pg_cron_access | grant_pg_cron_access | ddl_command_end | CREATE EXTENSION | CREATE EXTENSION |
| issue_pg_graphql_access | grant_pg_graphql_access | ddl_command_end | CREATE EXTENSION | CREATE FUNCTION |
| issue_pg_net_access | grant_pg_net_access | ddl_command_end | CREATE EXTENSION | CREATE EXTENSION |
| pgrst_ddl_watch | pgrst_ddl_watch | ddl_command_end | null (all tags) | null (all tags) |
| pgrst_drop_watch | pgrst_drop_watch | sql_drop | null (all tags) | null (all tags) |

`issue_pg_graphql_access` is an explicit platform-configuration difference:
the watched DDL tag differs. No application object difference follows from
this observation, and no hosted/platform object was changed to force equality.
Preserve the reviewed binding on each environment. New or changed bindings,
owners, enabled states or ACLs require fresh review; there is no blanket platform
exception. These hooks do not replace explicit RLS in application migrations.

Local validation created a temporary event trigger calling a function outside
public and a temporary public function with an extra EXECUTE grant to a
dedicated NOLOGIN role. Both appeared in the inventory; revoking the grant was
visible too. The trigger, functions, schema and role were removed in cleanup,
and the final inventory equaled the pre-probe snapshot. No fixtures, hosted
writes, historical migration changes or application changes are part of KAN-31.
Ignored evidence: `kan31-probe-inventory.json`, `kan31-local-inventory.json` and
`kan31-hosted-inventory.json`. Retain both before and after snapshots for the
next hosted operation, as required below.

## CLI login and connection side effects

"Ledger-only" describes the application-level operation; it does not mean the
CLI has no authentication or local-state side effects. Account login persists
the access token in native credential storage, with a plaintext access-token
file fallback when that storage is unavailable; see the [CLI login reference](https://supabase.com/docs/reference/cli/introduction).
Never print, inspect for publication or commit that credential material.

Login-based hosted database connections can also initialize temporary database
login roles through the CLI's connection setup; see [hosted connection settings](https://supabase.com/docs/guides/local-development/local-and-hosted-projects#common-settings).
A SQL `READ ONLY` transaction constrains its queries, not setup performed outside
that transaction. The application snapshots do not audit platform login roles
or prove the absence of every CLI-managed authentication side effect. The record
below makes no claim that such roles were unchanged or that their cleanup was
independently verified.

Project lookups can write `.temp/linked-project.json` in their workdir and local
CLI/telemetry caches even when the requested SQL is read-only. Use the isolated
non-test workdir and check the disposable project's link/cache files afterward.
This documentation follow-up uses saved evidence only; it performs no login,
hosted query or hosted mutation.

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

## Exact hosted write — executed after owner authorization

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

## Execution record — 2026-11-11

Executed from merged PR #16 commit
`68ccf4c8da723cdeab39c88691204298a49a4afa` against
`oiqteedkfwmcertgxqga`, using pinned Supabase CLI 2.122.1 and the separate
`.verification/kan29-hosted` workdir. The tracked worktree was clean.

The owner explicitly authorized:

> Authorized for KAN-29: preserve `public.rls_auto_enable()` and the `ensure_rls`
> event trigger unchanged, and run the exact ledger-only repair of 00001–00003
> on `oiqteedkfwmcertgxqga` from the merged commit, after a clean drift check.
> Read back the ledger and schema. Nothing else; stop on any unexpected result.

| Event | UTC timestamp (2026-11-11) | Europe/Berlin (CET) |
| --- | --- | --- |
| Clean preflight saved | 10:41:05.875 | 11:41:05.875 |
| Repair attempt recorded | 10:41:27.587 | 11:41:27.587 |
| Repair returned exit code 0 | 10:41:29.517 | 11:41:29.517 |
| Successful read-back/comparison record saved | 10:41:52.897 | 11:41:52.897 |

The exact command executed was:

```bat
node node_modules/supabase/dist/supabase.js migration repair 00001 00002 00003 --status applied --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/kan29-hosted
```

The execution helper rejected a preflight older than three minutes, rechecked
the current hosted inventory against the saved preflight inventory, and recorded
the attempt before issuing the command. The attempt followed preflight by about
22 seconds. No migration SQL was replayed.

The preflight captured these SHA-256 values for the exact staged migration-file
bytes. These are Windows working-copy byte hashes, not line-ending-normalized
Git blob hashes; a different checkout's line endings can change them.

| Migration | SHA-256 |
| --- | --- |
| `00001_first_slice.sql` | `45a77fcb77c9761f45e72764e36994785ec290ac4a17f2e0a8ef9b63344b1633` |
| `00002_review_hardening.sql` | `0838664c575be3e22a891a4eac4df609e8dd6a114de6ddb638d052b65c470106` |
| `00003_strict_duplicate_prevention.sql` | `2d2cd945aa3606aecf08f8f1561c599ef8f76f858062713a4d65fafbb7981c5c` |

Direct SQL read-back returned exactly:

| Version | Name |
| --- | --- |
| `00001` | `first_slice` |
| `00002` | `review_hardening` |
| `00003` | `strict_duplicate_prevention` |

The separate CLI `migration list` agreed, showing those same three versions in
both local files and hosted history. The post-repair application catalog was
compared field for field to the saved immediately-before catalog and matched.
The inventory matched with only `migration_ledger_exists` changing from false
to true. The RLS helper and event trigger remained unchanged. The disposable
project's `.temp/project-ref` and `.temp/linked-project.json` remained absent.
The execution record was written only after those assertions and the CLI
migration-list command succeeded.

Evidence sources are the ignored local `kan29-authorized-*` files under
`pantry-flow/.verification/`: `preflight.json`, `repair-attempt.json`,
`repair-result.json`, `execution-record.json`, `before-catalog.json`,
`before-inventory.json`, `repair.log`, and `migration-list.log`, plus
`kan29-execute.cjs`. This section publishes their non-secret execution summary;
it does not publish credentials or claim an independent hosted re-query.

Evidence limitation: after-catalog and after-inventory values were compared in
memory but were not saved as separate files. They cannot now be independently
re-inspected from the run's artifacts. No after-files have been reconstructed or
backdated. For the next operation, persist both after-snapshots before comparing
and recording success, alongside the before-snapshots. Application row contents
and platform authentication state were not independently snapshotted in this
hosted run; the no-data-change claim is limited to the ledger-only command's
scope and the absence of application migration SQL replay.

KAN-29's hosted adoption acceptance is satisfied. Later hosted migrations still
require their own fresh drift check, exact migration review and authorization.
