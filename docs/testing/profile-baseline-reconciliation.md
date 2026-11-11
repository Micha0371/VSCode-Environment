# Proposed profile-trigger baseline reconciliation

Status: **executed and verified on 2026-11-11**; see the
[execution record](#execution-record--2026-11-11). Hosted migration 00004 remains
unapplied and needs its own authorization.

Original preparation note: the strict 00004 preflight stopped at merged commit `320d8ae` because the hosted
`handle_new_profile()` explicitly inserts the household name, whereas migrations
00001/00002 use the matching column default. Current behavior is equivalent,
but SQL definitions differ. The stop condition remains in force.

This proposes a one-time, version-controlled operational baseline repair using
`pantry-flow/ops/hosted-baseline/reconcile-profile.sql`. It is separate from
00004 and requires its own explicit owner authorization after review. Historical
migrations 00001–00004 are unchanged. No new migration is marked applied and the
ledger remains exactly 00001–00003. The file is outside `supabase/migrations`,
so normal migration push/reset cannot execute it automatically. It does not
introduce a general exception to migration-based deployment.

## Exact scope and guards

Target: `oiqteedkfwmcertgxqga` (PantryFlow_Emergent), PostgreSQL major 17,
pinned CLI 2.122.1. The SQL file itself cannot establish project identity; the
operator must verify the explicit CLI project ref and isolated non-test workdir.

The transaction checks the exact three ledger versions/names, absence of the
shopping table, current `My Household` column default, existing function owner
postgres, the full reviewed EXECUTE ACL and the precise recorded legacy
definition after CRLF/LF normalization. It accepts no arbitrary body change.
It refuses a missing or already-canonical function rather than treating a retry
as permission to write again.

The only DDL is fixed, reviewed `CREATE OR REPLACE FUNCTION` for
`public.handle_new_profile()`, matching the function produced by repository
migrations 00001/00002. It replaces the explicit name insert with the default,
retains SECURITY DEFINER and the empty search_path, and does not execute SQL
obtained from the hosted database or user input. The same transaction verifies
the exact canonical definition plus unchanged OID, owner and raw ACL. A failed
postcondition raises an exception and rolls back the replacement.

The file does not issue table-data writes, ledger writes, GRANT/REVOKE, owner
changes, RLS changes or changes to `rls_auto_enable()` / `ensure_rls`. Session-only
search_path and timeout settings expire at transaction end. All other application
metadata is checked in saved before/after snapshots outside this transaction.
Stop on any unexpected difference. Coordinate a window with no other schema or
history writers; these guards are not a universal lock against unrelated DDL.

## DDL hooks reviewed during preparation

The hosted inspection was catalog-only and READ ONLY on 2026-11-11. The two
hooks that can run for this CREATE FUNCTION are owned by supabase_admin. Both
have ACL entries `=X/supabase_admin`, `supabase_admin=X/supabase_admin`, and
`postgres=X*/supabase_admin`.

| Function in extensions | Observed behavior | Definition SHA-256, CRLF/LF normalized |
| --- | --- | --- |
| grant_pg_graphql_access | Returns unless a DDL object's OID matches the pg_graphql extension OID; otherwise recreates the GraphQL wrapper/grants | `9ec845adab4ba00bbf7740458b6c4461094697023f0f7adc693b373e2ea54f68` |
| pgrst_ddl_watch | Sends NOTIFY pgrst, reload schema, for matching DDL including CREATE FUNCTION | `2b4b5d702ddf70fbd1a05c9825f9f9016d5c0ef97dd3df5f5b012ea23d9b94b1` |

Replacing this existing function retains its OID. The repair explicitly refuses
an OID collision with pg_graphql so the reviewed GraphQL hook's early-return
condition remains satisfied. PostgREST schema reload notification is expected;
this is not a claim of zero platform/connection side effects. The preserved
`ensure_rls` binding watches table-creation tags, not CREATE FUNCTION.

Before execution, rerun `ops/hosted-baseline/inspect-profile-hooks.sql` and the
full baseline inventory in the isolated hosted workdir, saving their results.
Require those definitions, owners, grants and applicable event bindings to remain
as reviewed. Stop for a new/changed applicable hook; do not blanket-ignore it.
This targeted inspection does not close every non-public function inventory gap.

## Local validation

The Node/PGlite regression applies actual unchanged migrations 00001–00003
(using the existing UUID-extension shim), then emulates only the recorded legacy
function. It verifies preservation of OID, ownership, grants, settings, existing
application rows and ledger, and correct household creation after repair.
Rejection cases cover unreviewed bodies, changed grants/owner/default/history,
and already-canonical state. A simulated CREATE FUNCTION hook adds an extra
EXECUTE grant: the postcondition rejects it and both definition/grant roll back.

The actual SQL file also passed a separate local PostgreSQL 17.11 rehearsal
against a populated 00003 reference. Before/after metadata and row snapshots
were saved. The repaired function matched the migration-built canonical catalog
and inventory; metadata except its definition, existing rows and ledger were
unchanged. A new fixture profile created its expected household afterward.
Exact fixtures were then removed. This is local evidence, not a hosted write or
production populated-upgrade approval. Ignored evidence includes
`profile-rehearsal-{before,after,result}.json` and `profile-hook-inspection.json`.

## Execution proposal — requires separate authorization

1. Use the reviewed **merged** reconciliation commit and a clean worktree.
   Record the commit and actual SQL-file byte hash. Use the existing CLI login;
   never pass tokens, secret keys or database passwords in commands, print them
   or copy credential files. Follow baseline adoption's login/cache precautions.
2. Build a fresh local PostgreSQL 17 reference through 00003. Save timestamped
   hosted before-catalog, before-inventory, hook inspection and ledger snapshots.
   Require the only application mismatch to be the exact legacy profile body
   accepted by the guarded repair. All other function metadata, policies,
   constraints, grants and reviewed platform bindings must match. Require ledger
   00001–00003 and the existing default. The general strict shopping preflight
   stays blocked until this repair has succeeded and been independently read back.
3. Prepare `.verification/hosted-profile-reconciliation/supabase/config.toml`
   from the tracked non-test template `ops/hosted-baseline/supabase/config.toml`.
   Do not link the disposable test project or stage/run migration SQL here.
   From Command Prompt in `pantry-flow`, set `PF_RECONCILE_ROOT` to the working
   directory and, **only after explicit authorization**, run this exact proposal:

   ```bat
   set PF_RECONCILE_ROOT=%CD%
   node node_modules/supabase/dist/supabase.js db query --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/hosted-profile-reconciliation --file "%PF_RECONCILE_ROOT%\ops\hosted-baseline\reconcile-profile.sql" --output-format json --yes
   ```

   This command is a real hosted write, not a dry run. The local rehearsal and
   review precede it. Capture its result and timestamp. On error, timeout or
   interruption, stop and inspect read-only before considering another attempt.
   Do not assume a lost response means rollback, automatically retry, or revert
   to the legacy definition. No exactly-once network guarantee is claimed.
4. **Save** hosted after-catalog, after-inventory, hooks and ledger before any
   comparison assertion. Require only the function definition to change, exactly
   to the local canonical definition after CRLF/LF normalization. OID, owner,
   ACL, settings and profile-trigger attachment remain unchanged. Preserve all
   other application metadata, reviewed platform bindings and the RLS helper.
   Require ledger 00001–00003 still unchanged. Snapshot SQL selects catalogs;
   user-row verification needs appropriate separate authorization if requested.
5. Publish authorization, commit/hash, command, timestamps and comparison results.
   Then rerun the **unchanged strict** 00004 preflight from scratch. Do not reuse
   the previously blocked preflight as permission to push. The later migration
   dry run must show only 00004, with `--skip-vault` on the migration-only push
   path and no seed/role/config additions. Applying 00004 is a separate operation
   covered by its owner authorization, not by running this reconciliation file.

No hosted write is part of preparing this PR. Its read-only hook inspection and
local validation do not establish that reconciliation has already happened.

## Execution record — 2026-11-11

**Authorization.** After reviewing PR #21 and choosing the repair over a
documented exception, the owner wrote: "i will go with A, #21 is merged. please
go ahead". This covered the reconciliation only, not applying 00004.

**Source.** Merged commit `28030ac` (PR #21). The checkout ran from `f7a198f`,
whose tree (`5f24e245`) is identical to the merged commit's tree, with no local
changes and the disposable test project unlinked. Pinned Supabase CLI 2.122.1.
`reconcile-profile.sql` SHA-256
`ca6c61b53008db337b9a671f861e19140b4d8cdadec457daf5d74934e5f20be1`, equal to the
committed blob.

**Preflight** (completed 16:12:32.409 UTC / 17:12:32 CET). Local reference:
freshly reset disposable stack, PostgreSQL 17.11, exactly 00001–00003. Hosted
17.6. Before-catalog, before-inventory, hook inspection and ledger were saved
first. Hosted ledger was exactly 00001–00003. Both reviewed DDL hooks matched
their recorded hashes, owner and ACL. After applying only the documented
exceptions (preserved `rls_auto_enable()` / `ensure_rls`, the reviewed GraphQL
tag binding, CRLF/LF), the single application difference was
`handle_new_profile()`: hosted equal to the exact recorded legacy body, local
equal to the canonical body in the script. No other problem was found.

**Command** (attempt recorded 16:12:32.593 UTC before running; finished
16:12:34.591 UTC), run once from `pantry-flow`:

```bat
node node_modules/supabase/dist/supabase.js db query --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/hosted-profile-reconciliation --file "<pantry-flow>\ops\hosted-baseline\reconcile-profile.sql" --output-format json --yes
```

Exit code 0, empty result rows. The CLI reported "Initialising login role...",
the documented login side effect; no token or password was passed or printed.

**Read-back** (after-files saved before any assertion; verified 16:12:41 UTC):

- Hosted ledger still exactly 00001 first_slice, 00002 review_hardening,
  00003 strict_duplicate_prevention.
- Hosted `handle_new_profile()` now equals the local migration-built
  definition; the explicit `name` insert is gone. SECURITY DEFINER,
  `search_path=""` and the anon/authenticated EXECUTE results are unchanged.
- Hosted after-catalog and after-inventory equal the local 00003 reference,
  apart from the same documented exceptions.
- Before vs after: catalog and inventory, including all routine ACLs, are
  identical except for that one function body. The hook inspection is unchanged.
- The function's OID, owner and raw ACL were also checked by the script's own
  in-transaction postcondition; the saved snapshots do not record the OID.

**Strict 00004 preflight, rerun unchanged from scratch** (16:13:03 UTC,
read-only): no differences, `canProceed: true`, no hosted write. The disposable
local stack was then restored through 00004.

**Limits.**
- No user rows were read.
- Effects of the GraphQL hook outside `public`, in the `extensions` or GraphQL
  schemas, are not covered by the inventory. The OID guard keeps that hook on
  its early-return path.
- The expected PostgREST schema reload was not observed directly.
- The temporary CLI login role was not audited.

Ignored local evidence: `.verification/profile-reconciliation-2026-11-11T16-12-24-230Z/`
(meta, local reference, before/after hosted catalog, inventory, hooks and
ledger, attempt, execute logs, result) and
`.verification/shopping-preflight-2026-11-11T16-12-58-252Z/`.
