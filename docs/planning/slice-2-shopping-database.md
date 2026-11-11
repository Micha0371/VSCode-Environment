# Slice 2 shopping persistence — KAN-7 / KAN-8 / KAN-9 / KAN-10

Implements decisions D1/D2/D4 in [the approved plan](slice-2-implementation-plan.md).
Migration `00004_shopping_items.sql` follows 00001–00003 unchanged. This PR
authors/tests it locally; applying it to hosted requires a separate fresh drift
check and authorization. KAN-31 must land before that hosted check.
The [hosted application checklist](../testing/hosted-shopping-migration.md)
requires saved before/after snapshots and a post-00004 comparison, including the
new table's forced-RLS flag and effects of the preserved hosted event trigger.

`pantry_shopping_items` stores an independent display name, household, optional
pantry link, `is_checked`, server-managed `completed_at`, nullable `created_by`,
and server-managed creation/update timestamps. `created_by` follows the existing
pantry convention rather than introducing a second creator-field vocabulary.

- Open names are unique per household after `pantry_trim_item_name` and lower
  case conversion. Manual and pantry-linked items share one namespace. Display
  case is retained; internal whitespace is significant. Names are 1–120 characters
  after trimming. Blank, null and overlong names fail in PostgreSQL.
- A checked item remains stored until explicitly deleted. Checking sets a server
  timestamp; rechecking/renaming preserves it. Reopening clears it, subject to
  open-name uniqueness. A duplicate insert, rename or reopen fails with 23505;
  callers later map that to the translated duplicate error. No merge/rename or
  overwrite occurs automatically. Completed names may repeat.
- The composite pantry FK uses `(household_id, pantry_item_id)` and the new
  pantry `(household_id, id)` unique key. A foreign-household link fails even if
  the client bypasses UI checks. Pantry deletion clears only the optional link,
  preserving the shopping household/name/completion. Retargeting a link never
  changes its independent shopping name.
- RLS uses existing household memberships. Authenticated members can CRUD their
  household's rows. INSERT requires `created_by = auth.uid()`; UPDATE is not
  restricted to the author, so another member may edit a surviving shared item.
  Author deletion nulls attribution; household deletion cascades its shopping rows.
- Column grants deny client writes to ID, household/creator after creation and
  all timestamps, including `completed_at`. Clients express completion through
  `is_checked`; the trigger determines its timestamp. Trigger-function EXECUTE
  is revoked from public clients; no new RPC or authorization service is added.
- Shopping adds/edits/completion/deletion do not change pantry state. No table
  depends on the hosted-only auto-RLS event trigger for its authorization.

KAN-30 adds a separate one-assertion pgTAP environment file requiring running
PostgreSQL major 17. The original Slice 1.1 file remains at plan(21). A deliberate
future hosted-major upgrade must update both this assertion and config.toml.
The guard must be demonstrated to reject a disposable major-15 stack before
acceptance. Shopping assertions live in their own file and real ordinary-user
HTTP tests reuse the existing local fixture/cleanup harness.

No shopping UI/provider, household-context refactor, quantity/batch expansion or
automatic pantry synchronization is included. Completion remains reopenable;
the historical PRD's removal-on-check behavior is superseded by D2.
