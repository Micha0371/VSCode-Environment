# Existing coverage at e6dbcf8

The 32 Node test-runner checks (including the parent and nested PostgreSQL cases) are automated and retained. The parameterized final screen case runs separately for add-item and edit-item. Native/network boundaries are mocked; PGlite runs real PostgreSQL in-process with a minimal auth schema and replacement UUID function. Its overlapping promises do not prove multi-connection concurrency.

### `auth.test.cjs`
- rejected session restoration settles loading, exposes retry, and recovers
- a late restoration cannot overwrite a newer auth event
- signup distinguishes email confirmation from an authenticated session
- saved sessions restore, logout clears identity and a later login replaces it

### `database.test.cjs`
- migrations enforce authorization, validation, attribution and deletion behavior in PostgreSQL
- users may edit profile fields but cannot self-assign premium or change identity
- creator spoofing, null attribution and cross-household insertion are rejected
- direct API equivalents cannot bypass input constraints
- duplicate add and rename are blocked regardless of category, location or status
- overlapping duplicate insert and rename calls cannot both succeed
- other users and anonymous clients cannot read or mutate an existing item
- deleting an author preserves items in a surviving household and clears attribution

### `hosted-runner.test.cjs`
- hosted runner refuses another project and administrative keys before making requests

### `household.test.cjs`
- household lookup rejects stale identities and exposes a retry after network failure

### `mutation.test.cjs`
- mutation lock is immediate and navigating away abandons completion callbacks

### `pantry-data.test.cjs`
- validation rejects API-bypass values and permits bounded Unicode names
- client duplicate validation excludes self and leaves interior whitespace unchanged
- fetches every page beyond the default 1000-row server cap
- a smaller server cap or failed page is an error, never a partial inventory

### `pantry-state.test.cjs`
- both consumers observe add, edit and delete; old reads cannot undo a write
- newest read wins and a user change clears state and discards old requests
- failed initial fetch remains an error and retry recovers
- a pending update locks the same item against a second screen deleting it
- a pending mutation cannot repopulate the next signed-in user cache
- failed writes preserve existing inventory and allow a subsequent retry

### `screens.test.cjs`
- a failed initial pantry load shows retry instead of claiming the pantry is empty
- empty pantry offers add navigation and populated pantry opens the selected item
- email-confirmation signup shows instructions and does not navigate to the pantry
- sign-out failure is visible and does not navigate away
- protected routes do not mount children during restoration, failure or signed-out access
- ${file} translates a server unique-constraint rejection without navigating

## Deployed API validation

`scripts/verify-hosted.cjs` automates 13 Auth/PostgREST groups. Invocation and credentials were manually managed against the selected development project. It is retained as a historical diagnostic and excluded from CI/default test commands. The consolidated local suite uses disposable Supabase instead.

## Android evidence

The prior 22 groups were executed through ad hoc ADB/debugger operations, not reusable Maestro flows. They are historical device evidence, not automated E2E coverage. Their secret-free names and outcomes are in H_Slice_1_1_Verification.md. Keyboard-open category selection and missing native font/assets were confirmed defects. PF-TEST-001 adds a reusable keyboard journey and native error-log regression gate; screenshots still require visual inspection for glyph appearance.
