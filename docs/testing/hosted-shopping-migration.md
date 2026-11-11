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
3. Review every drift difference. The documented household-name default,
   preserved RLS helper, exact platform event-trigger bindings and CRLF/LF are
   the existing exceptions. KAN-31 must be integrated so routine ACLs and
   non-public event-trigger bindings are visible. A changed binding, ACL or
   unexplained object stops the operation. Non-public function implementation
   coverage remains limited as documented there.
4. Use the pinned CLI's tracked migration path. Its dry run must show only
   00004 pending; review every proposed action before the explicitly authorized
   application. No SQL Editor replay, seed/config/role changes or unrelated
   history repair is part of this application. Record the exact command and
   result. On failure, timeout or interruption, stop and inspect read-only;
   do not automatically retry or alter ledger rows to hide a partial result.
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
