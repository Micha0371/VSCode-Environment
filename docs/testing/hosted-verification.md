# Hosted verification with confirmation enabled

This is an owner-authorized development check, not CI. The supported target is
`PantryFlow_Emergent`, project `oiqteedkfwmcertgxqga`. Prefer the disposable local
stack for routine regressions. Hosted checks create temporary pantry rows and
temporarily edit the two fixture profiles, then restore/delete only that work.

## Prepare two confirmed fixtures

1. Use two dedicated disposable accounts, each in its own household with exactly
   one membership. Do not silently reuse the three owner-preserved manual-test
   accounts or a production identity.
2. Register and confirm their emails through the app, or use authorized Supabase
   dashboard/management access to provision those two fixtures as confirmed users.
   Per-user fixture confirmation is not permission to disable the project's
   **Confirm email** setting. Never copy an administrative key into the runner.
3. Store their credentials locally in ignored
   `pantry-flow/.env.verification.local`:

   ```dotenv
   PANTRY_TEST_A_EMAIL=DISPOSABLE_CONFIRMED_ADDRESS_A
   PANTRY_TEST_A_PASSWORD=LOCAL_TEST_PASSWORD_A
   PANTRY_TEST_B_EMAIL=DISPOSABLE_CONFIRMED_ADDRESS_B
   PANTRY_TEST_B_PASSWORD=LOCAL_TEST_PASSWORD_B
   ```

   These are placeholders, not working accounts. Keep the file out of commits,
   artifacts and chat. `pantry-flow/.env` supplies the intended HTTPS project URL
   and public publishable/anon key only. The two accounts must have different
   user IDs and households; the runner rejects shared identities/households.

## Execute and verify cleanup

From `pantry-flow`:

```sh
node scripts/verify-hosted.cjs --preflight
node scripts/verify-hosted.cjs --run
```

Preflight only checks project/public-key boundaries and public Auth settings; it
does not prove the accounts work. The run signs in with their ordinary user
credentials, asserts one household per user and executes the authorization/CRUD
checks. The public key is mandatory: admin keys would invalidate RLS evidence.

Require zero failed checks, no fatal error and zero cleanup failures in ignored
`.verification/hosted-results.json`. The runner restores fixture name/language,
removes only item IDs returned by this run, verifies absence and signs out.
It **does not delete fixture accounts or households**. If interrupted, inspect
the report's exact test IDs and restore the fixture profiles before retrying.
Never bulk-delete pantry data by a name/prefix. After acceptance, use authorized
management access to remove only the two verified disposable identities and
their empty, unshared households, then remove obsolete local passwords.

`--run --create-test-accounts` is retained only for a project that already has
email auto-confirm enabled. It refuses the current confirmation-enabled hosted
project before signup; it does not toggle Auth settings or send email to its
synthetic example.com addresses. For this project, use the confirmed-account
procedure above, not that flag.

## Read-only hosted catalog comparison

For migration-ledger adoption, use the reviewed
[KAN-29 baseline procedure](hosted-baseline-adoption.md), including its broader
object inventory and separate non-test CLI workdir. A catalog match alone does
not authorize a history repair.

`scripts/catalog-snapshot.sql` selects only application catalog metadata inside
`BEGIN READ ONLY`. It contains no user-row query or schema mutation. With an
authorized local Supabase CLI login, compare a freshly migration-built local
stack to the explicitly selected hosted project:

```sh
npm run db:reset
npx --no-install supabase db query --local --file scripts/catalog-snapshot.sql --output-format json
```

For the hosted query, prepare the isolated workdir and use the explicit-project
commands in the baseline procedure. Do not run linked Management API lookups
from the disposable project's workdir: the CLI can leave a hosted-project cache
there even without an explicit `supabase link` command.

The reset is **local only**. Review RLS, effective table/column permissions,
constraints, indexes, trigger/function definitions, function settings and execution
permissions. Ignore JSON object-key ordering and CRLF/LF differences, not SQL
changes. Record every remaining difference explicitly; do not apply a migration
or repair history merely to make the comparison green. The 2026-11-10 comparison
and absent hosted migration ledger are recorded in the release-review evidence.
