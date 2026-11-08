# Pantry Flow

Mobile household inventory with Expo, React Native, TypeScript, and Supabase.
The implemented slice includes email/password auth, pantry CRUD, and stock
statuses. Shopping lists, invitations, German content, and premium gating remain
future work. No separate API server is used.

## Local setup

Use Node.js 22.13 or newer, npm, and a native simulator or an Expo development
client compatible with SDK 52. Current Expo Go releases may not support SDK 52.

From `pantry-flow/`:

```sh
npm ci
cp .env.example .env
```

On Windows, copy the template with your editor or file manager if your shell is
unavailable. The intended hosted project is **pantryflow_emergent**, reference
`oiqteedkfwmcertgxqga`, URL `https://oiqteedkfwmcertgxqga.supabase.co`. The name is
user-supplied; management access is needed to independently verify the dashboard
display name.

Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the project's **publishable key** or legacy
public anon key. The variable retains its original name for compatibility; both
key formats are supported. Never put a secret/service-role key in the app. `.env`
is ignored by Git. Restart Metro after changing environment variables.

## Database setup and upgrades

In the intended project's Supabase SQL Editor, apply migrations in order:

1. `supabase/migrations/00001_first_slice.sql` — new projects only.
2. `supabase/migrations/00002_review_hardening.sql` — new and existing projects.
3. `supabase/migrations/00003_strict_duplicate_prevention.sql` — Slice 1.1.

For an existing installation, apply only missing migrations. Do not rerun the
first migration over existing tables. Local tests do not apply migrations to the
hosted project; a publishable key cannot run schema migrations.

Migration 2 is transactional. If existing records have invalid names, languages,
categories, or locations, it fails without partially applying its changes.
Correct those records explicitly, then rerun the migration. It does not silently
delete or normalize household data. Before using `is_premium` for entitlement
checks, audit existing values: the original policy allowed self-assignment.

Migration 3 enforces case-insensitive item-name uniqueness within a household.
Leading/trailing whitespace is trimmed before storage; category, location, and
status do not affect uniqueness. Internal spaces are preserved: `Milk Fridge`
and `Milk  Fridge` remain distinct. Add/edit prevalidation gives immediate
feedback, and PostgreSQL rejects racing writes with error `23505`, displayed
through the existing translation mechanism. Editing the same item is allowed.
Identical names in different households are allowed.

If existing normalized names collide, migration 3 aborts without modifying any
items. It also requires explicit cleanup of any legacy surrounding whitespace.
Review and resolve those records intentionally before retrying; no migration
silently renames, merges, overwrites, or deletes them.

The hardened schema:

- Allows users to update only their profile name and language.
- Requires an item's creator to match the authenticated caller on insert.
- Prevents clients from changing item identity, household, creator, or timestamps.
- Validates item names (1–120 characters, not whitespace-only), category, location,
  and stock status. Profile names are limited to 100 characters; locales are EN/DE.
- Maintains item modification times in PostgreSQL.
- Preserves surviving household items when their author is deleted, clearing the
  author reference instead of blocking account deletion.

## Run and verify

```sh
npm start
npm run typecheck
npm test
```

For repeatable hosted checks, `scripts/verify-hosted.cjs --run` uses two disposable
confirmed accounts from the ignored `.env.verification.local` file:

```env
PANTRY_TEST_A_EMAIL=your_disposable_account_a
PANTRY_TEST_A_PASSWORD=its_password
PANTRY_TEST_B_EMAIL=your_disposable_account_b
PANTRY_TEST_B_PASSWORD=its_password
```

Run it with `node scripts/verify-hosted.cjs --preflight` first. The script is pinned
to project `oiqteedkfwmcertgxqga`; it refuses other targets. `--run` creates only
run-specific inventory, restores test profile fields, deletes exact test item IDs,
and signs out its own sessions. Results go into ignored `.verification/`.
`--create-test-accounts --run` may create disposable accounts only when the project
already has email auto-confirm enabled; it never changes auth settings. Those
accounts remain available for device tests and require dashboard deletion when
no longer needed. Their generated passwords are never printed or committed.

Email confirmation may stay enabled. Registration displays confirmation
instructions when Supabase returns no session; users confirm their address and
then sign in. Auth startup and sign-out failures have visible recovery states.

Smoke test on a device against a disposable account:

1. Register, confirm email if enabled, and sign in.
2. Add three items; returning from the modal should immediately update the list.
3. Edit a name/status and delete an item; verify the list and persisted data.
4. Simulate a failed initial request; verify an error and working retry control.
5. Leave a modal while a request is pending; completion must not pop another screen.
6. Sign out and sign in as another account; no previous inventory should appear.
7. Open an add/edit deep link while signed out; it should redirect to login.

## Code boundaries

- `app/` and `components/`: forms, navigation, presentation, translated feedback.
- `lib/auth.tsx`: session lifecycle and authentication outcomes.
- `hooks/useHousehold.ts`: household lookup/retry, invoked by the shared provider.
- `hooks/usePantryItems.tsx`: shared pantry state and CRUD; scoped by user identity.
- `lib/pantry-data.ts`: validation, response parsing, and paged inventory reads.
- `hooks/useItemMutation.ts`: mutual exclusion and abandoned-screen protection.
- `supabase/migrations/`: authoritative database permissions and integrity rules.

All pantry screens consume one provider. Reads are versioned so stale responses
cannot undo mutations or cross identity changes. Reads use deterministic ordering
and pages of 200; a server cap below that size causes an explicit error rather
than silently showing a truncated inventory. This remains an online app without
realtime or offline synchronization.
Pending edits/deletes also lock the affected item across screens; leaving a modal
does not allow a second screen to race another change against that same item.

## Test scope and remaining platform work

Tests execute production TypeScript through the TypeScript compiler, real React
hooks/context through the React test renderer, and migrations in PGlite's
PostgreSQL engine. Native UI and network boundaries are mocked. For SQL tests,
only the unavailable `uuid-ossp` extension is replaced with PostgreSQL's built-in
UUID generator; migration permissions, constraints, and triggers run unchanged.

These checks do not replace device tests or inspection of the hosted project's
actual grants, auth settings, migration state, and existing data.

The SDK 52 dependency tree has outstanding security advisories in legacy tooling.
Compatible patches and an npm lockfile are included; a supported Expo SDK upgrade
and native-device validation are still needed before a production release. Do
not use `npm audit fix --force` as a substitute for that migration.

## Behavioral regression harness

See [test commands and execution record](../docs/testing/README.md), [coverage matrix](../docs/testing/coverage-matrix.md), and [baseline inventory](../docs/testing/existing-inventory.md). Run `npm run test:fast` for the consolidated fast gate. Docker-backed tests use only the dedicated local Supabase stack; they do not run against the configured hosted app project.
