# Adversarial review remediation — 2026-11-08

This records implementation changes after the initial review. The original
planning documents describe historical scope; the application README describes
the current setup. On 2026-11-08 the user confirmed that hosted migrations
`00002` and `00003` are now applied. Hosted authorization and duplicate behavior
have subsequently passed 13 real HTTP test groups using two ordinary users.
See [the verification record](H_Slice_1_1_Verification.md) for current results and
completed Android validation.

| Finding | Remediation | Regression coverage |
| --- | --- | --- |
| Independent modal/list state | One identity-scoped PantryProvider, consumed by all pantry screens | Shared add/edit/delete state |
| Self-assigned premium | Profile update grants limited to name/language | PostgreSQL rejects premium/identity updates |
| Forged item creator/deletion blockage | Caller-bound inserts, immutable creator, FK clears deleted authors | Spoof/null rejection; author deletion preserves surviving items |
| Confirmation signup mishandled | Explicit signed-in/confirmation-required outcome and confirmation screen | Auth outcome and screen navigation checks |
| Out-of-order reads and retained state | Request versions, scope checks, keyed provider, state clearing | Stale reads after refresh/mutation/user change |
| Failed load presented as empty | Separate failure state with retry | Error-screen and retry recovery checks |
| Concurrent save/delete and double navigation | Synchronous mutation lock; completion abandoned on blur/unmount | Immediate double press, blur, unmount checks |
| API validation bypass | Database constraints, client validation and response parsing | Direct SQL invalid-value rejection and Unicode boundary checks |
| Auth startup/sign-out failure | Settled loading/error state, retry, caught sign-out errors | Rejected restoration, auth race, sign-out feedback |
| Broken setup/reproducibility | Environment template, npm lockfile, setup docs and test scripts | TypeScript check and regression suite |
| Other observations | Paged reads, modal auth gates, native auth refresh lifecycle, removal of starter status CRUD | Multi-page inventory and protected-route tests |
| Slice 1.1 strict duplicates | Separate migration 3, household/name unique index, whitespace trigger, client prevalidation and translated 23505 errors | Duplicate add/rename, same-item edits, cross-household independence, overlapping writes, legacy-conflict rollback |

Migration `00002_review_hardening.sql` applies after the original migration. It
is transactional and intentionally fails on invalid legacy data instead of
silently changing it. Existing premium flags must be audited before any future
entitlement feature trusts them.

Tests use a real React renderer and PGlite PostgreSQL with mocked native/network
boundaries. PostgreSQL tests reproduce Supabase table grants, exercise RLS as
separate users and anon, and replace only uuid-ossp with the built-in UUID
generator. Device navigation and the actual hosted Supabase state require
separate verification.

## Hosted project

The user identified `pantryflow_emergent` as project
`oiqteedkfwmcertgxqga`. Its URL and supplied publishable key are configured in
the ignored local environment file. The display name has not been independently verified with management access; deployed schema behavior was verified through ordinary-user API tests. A publishable key cannot
apply SQL migrations. Only disposable test accounts and inventory were created for verification.

### Deployment update — 2026-11-08

The user confirms migrations `00002_review_hardening.sql` and
`00003_strict_duplicate_prevention.sql` have been applied. The earlier report's
unapplied-migration blocker is therefore superseded. Do not rerun these migrations
solely because the original audit says they were pending.

Verification began on branch `main`. Whether it includes the previously smartphone-tested
manual fix has not been established; branch name alone does not prove code parity.

Hosted two-user permissions, direct-API duplicate rejection and concurrent writes
now pass. Local coverage grew from 26 to 32 checks, including a newly reproduced
cross-screen pending-write race that is now guarded in the shared provider.
Android auth/CRUD/network-failure flows subsequently passed 22 device groups. Device testing also corrected keyboard-open category selection and missing native font/asset loading by adding the compatible expo-file-system dependency.

The pasted review's proposed creator invariant needs one qualification: clients
cannot change the creator, but deleting an author deliberately sets that reference
to NULL for surviving items. A permanently non-null creator would require a
different account-deletion policy.

## Remaining platform risk

The existing Expo SDK 52 tooling dependency tree has npm security advisories,
including legacy archive/XML tooling. A forced npm audit upgrade is not a safe
remediation: it crosses SDK versions. Compatible native dependencies are aligned
to SDK 52 and locked; upgrading to a supported SDK and testing on devices remains
a production-release prerequisite.

PowerShell was reported blocked by antivirus during a connection probe. It was
left stopped; subsequent local checks use the existing Node tool directly. No
antivirus setting was changed and the blocked connection probe was not retried.
One missing router package was installed through the normal command tool using
cmd after network sandbox approval; PowerShell remained stopped.
