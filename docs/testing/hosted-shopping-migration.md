# Applying 00004 to hosted — review and post-migration comparison

This is a future-operation checklist, not authorization to run a hosted write.
The shopping migration has only been applied to disposable local databases.
Use a separately reviewed commit and explicit owner authorization for
`oiqteedkfwmcertgxqga` (PantryFlow_Emergent). Do not replay 00001–00003 or repair
history again: KAN-29 already recorded those versions.

1. Confirm the approved commit, pinned CLI, exact 00004 content and clean
   worktree. Stage only reviewed migrations in an isolated non-test CLI workdir.
   Keep the disposable test project unlinked. Follow the CLI authentication/cache
   precautions in [baseline adoption](hosted-baseline-adoption.md).
2. Immediately before application, read the hosted ledger and save timestamped
   hosted **before-catalog** and **before-inventory** files under ignored
   `.verification`. Expect exactly 00001–00003. Compare the current hosted schema
   with a fresh local PostgreSQL 17 reference built only through 00003, using
   the reviewed `scripts/catalog-snapshot.sql` and `scripts/baseline-inventory.sql`.
   Also retain a separate local reference through 00004 for the after-comparison.
   Do not compare a pre-00004 hosted database against a post-00004 local database
   and waive the resulting differences wholesale.
3. Review every drift difference. The documented household-name default is not
   a function-definition exception: after CRLF/LF normalization, any
   `handle_new_profile` difference stops the operation. The preserved RLS helper,
   exact reviewed platform event-trigger bindings and CRLF/LF are the existing
   exceptions. KAN-31 must be integrated so routine ACLs and
   non-public event-trigger bindings are visible. A changed binding, ACL or
   unexplained object stops the operation. Non-public function implementation
   coverage remains limited as documented there.
   The recorded legacy profile-body mismatch is tracked by the separate
   [reconciliation proposal](profile-baseline-reconciliation.md); preparing or
   merging that proposal does not waive this stop condition or execute a repair.
4. Use the pinned CLI's tracked migration path. Its dry run must show only
   00004 pending; review every proposed action before the explicitly authorized
   application. No SQL Editor replay, seed/config/role changes or unrelated
   history repair is part of this application. Record the exact command and
   result. On failure, timeout or interruption, stop and inspect read-only;
   do not automatically retry or alter ledger rows to hide a partial result.
   The push runs as the CLI's temporary `cli_login_postgres` role with
   `SET ROLE postgres`, so `extensions` is not on its `search_path`. `db query`
   connects as `postgres` directly, so a role or search_path probe made through
   `db query` does not represent the push session. The fast-suite guard
   `tests/migration-push-search-path.test.cjs` applies every migration from
   00004 on under the push session's path.
5. After application, **save** the hosted after-catalog, after-inventory and
   ledger read-back before running comparison assertions, so a failed assertion
   still leaves inspectable evidence. Expect exactly 00001–00004 in history.
   Compare hosted against the local 00004 reference, including all five tables,
   constraints/indexes, policies, effective table/column privileges, function
   definitions/settings/permissions and row-trigger definitions. The catalog
   script includes the shopping table and `prepare_shopping_item()`.
6. Review `pantry_shopping_items` RLS explicitly. Hosted `ensure_rls` fires during
   CREATE TABLE and may affect the new table even though local lacks that event
   trigger. Require both `rls` and **`force_rls`** in the saved table catalog to
   match local 00004 exactly. Do not normalize away a forced-RLS difference or
   accept a discrepancy merely because both environments enforce some RLS.
   Require the four membership policies, intended column grants and open-name
   unique index to match too. Preserve the helper/function binding itself.
7. Compare before/after to confirm every change is explained by reviewed 00004
   plus its new ledger record. Existing application data is not changed by the
   migration's intended SQL; schema evidence alone does not independently prove
   row contents unchanged. Additional hosted data/fixture verification needs
   authorization appropriate to those reads/writes. Do not promote the minimal
   local populated-upgrade probe to production-upgrade approval.
8. Publish a non-secret execution summary with authorization, commit, file hashes,
   timestamps, command, ledger and comparison results. Retain both before/after
   files locally, including on unexpected results. The later operation remains
   incomplete until read-back and all expected schema checks pass.

No hosted query or application is performed by this documentation change.

## Attempt record — 2026-11-11 (failed, fully rolled back)

**Authorization.** The owner wrote "ok please apply 00004 to hosted" after the
verified profile reconciliation. That approval covered the 00004 bytes merged in
`28030ac`; the corrected file needs a fresh approval.

**Source.** Checkout tree `5f24e245`, identical to merged commit `28030ac`, with
no local changes and the test project unlinked. CLI 2.122.1. The isolated workdir
held only the template config and exactly 00001–00004, written from the committed
blobs. Old 00004 blob SHA-256 began `56867b34cdddee9d`.

**Before the push.** Two read-only rehearsals ran, and the final preflight
completed at 16:21:45.587 UTC. Hosted matched the fresh local 00003 reference
under the documented exceptions only, and the ledger was exactly 00001–00003.
The dry-run plan was exactly `00004_shopping_items.sql`, with no seeds and no
roles.

**Command** (16:21:45.743–16:21:47.419 UTC), run once:

```bat
node node_modules/supabase/dist/supabase.js db push --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/hosted-00004/workdir --skip-vault --yes
```

Exit 1: `DbPushApplyError: function uuid_generate_v4() does not exist (SQLSTATE
42883)` at statement 2, the `CREATE TABLE public.pantry_shopping_items` default.
It was not retried.

**State afterwards** (read-only): the ledger is still exactly 00001–00003. The
hosted catalog and inventory are identical to the saved before-snapshots, and
there is no shopping table and no `pantry_items_household_id_id_key`. The
migration's own transaction rolled back completely.

**Root cause** (inferred from the hosted role catalog and the error; the push
session's own search_path was not printed). `cli_login_postgres` is a member of `postgres` with
`rolinherit=false` and no role settings. The `postgres` role's
`search_path="$user", public, extensions` therefore does not apply after
`SET ROLE`, and the push session cannot resolve uuid-ossp's function, which lives
in `extensions` on hosted and local alike. Local resets, CI and the pre-push
`db query` role probe all connect as `postgres`, so none could see the problem.

**Fix.** 00004's default is now core `gen_random_uuid()`. No environment with a
persistent ledger had recorded 00004: hosted rolled back, and only disposable
local/CI stacks had applied it. The new fast-suite guard fails on the old file
with the same error.

Ignored local evidence: `.verification/hosted-00004/` (local references, both
rehearsals, and the attempt's before files, dry run, push logs and post-failure
snapshots).
