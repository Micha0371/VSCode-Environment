# Jira operational validation — 2026-11-09

Code under test: merged PR #5, `2e2535057efd7b71af56be120bbff4aff73bf8f9`.
Project: PantryFlow, key KAN. The owner explicitly authorized one disposable
end-to-end write test and one non-blocking concurrency technical-debt issue.

## Write-guard verification

All current issue mutation paths use `Jira.call`: POST `/issue` (create), PUT
`/issue/{key}` (update), and POST `/issue/{key}/transitions` (transition). Each
handler previews without `--apply`; the independent request-layer guard rejects
mutations unless initialized with the exact boolean authorization parsed from
the exact flag. Its only POST exception is the fixed read-only `/search/jql` path.
Direct HTTP calls outside this layer are only GET tenant discovery/authentication.
The default-deny regression also covers PATCH and DELETE even though no CLI
command exposes either operation.

## Controlled live write test

Operation ID: `PF-JIRA-E2E-20261109-c160e6ed-ed1b-4c0d-8fef-ed2f1b83f89d`.
It was placed in both the issue summary and description **before** creation.
Every mutation was previewed and then applied once through the merged CLI.

| Step | Independent evidence | Result |
| --- | --- | --- |
| Create Task | Read-back of KAN-4: matching key, operation ID, Task type, initial Backlog status | Passed |
| Update | Read-back: exact updated summary, operation ID retained in description, expected label set persisted | Passed |
| Discover/preview transition | Current transition list exposed ID 51, Fertig; preview matched it | Passed |
| Apply transition | Jira returned the applied Fertig transition | Passed |
| Final read-back | KAN-4 status Fertig, updated summary/labels retained, operation ID present | Passed |

[KAN-4](https://michaelwuerthner.atlassian.net/browse/KAN-4) contains synthetic
data only and remains completed as an audit record. It was not silently deleted.
No timeout, ambiguous response or automatic retry occurred. If a mutation had
returned an uncertain outcome, the procedure would stop and inspect Jira by the
pre-recorded identifier before any intentional retry.

Credentials stayed in Windows Credential Manager and the CLI process. Local input
files use ignored `.local.json` filenames; selected, redacted read-backs and the
operation journal are in ignored `.verification/jira-live/`. No credentials or
raw authorization headers appear in this record.

## Follow-up technical debt

[KAN-5](https://michaelwuerthner.atlassian.net/browse/KAN-5): **Technical debt:
protect Jira CLI concurrent writes and ambiguous retries**. Creation was previewed
and applied once, then read back independently to verify its operation identifier,
technical-debt/non-blocking labels and Backlog status.

It records coordination across local processes, supported conflict detection,
operation reconciliation and deterministic race/crash tests as future acceptance
criteria. It explicitly does not block current PantryFlow development. Current
operation remains single writer only. No concurrency architecture was added by
this validation task.

## Practical limits

Successful live writes prove this account could create, edit and complete a Task
in the tested workflow at the time of validation. They do not prove permissions
for other users/projects/issue types, all workflow validators, concurrency safety,
or exactly-once delivery. Failure paths remain covered by the 22 fixture tests.
