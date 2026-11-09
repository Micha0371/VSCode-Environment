# Jira integration safety review — 2026-11-09

Reference: PR #4, merged main `01b66239886d5ced543700bea356c5c26e728b4c`.
Review requested after merge. Fixes are isolated on `pantryflow/jira-safety-review`.
No live Jira issue was created, edited or transitioned for this review.

## Findings and changes

1. **Exact write intent was not enforced (medium).** Default argparse behavior
   accepted `--a` and `--app` as `--apply`. New regression cases reproduced this
   for creation, update and transition before correction. All parsers now reject
   abbreviations. A separate request-layer write gate is disabled by default and
   enabled only by the exact parsed boolean flag. Handler previews and validation
   failures have assertions that no mutation request is sent.
2. **Argument-error output bypassed redaction (medium).** Argparse echoed unknown
   arguments, including a synthetic secret in the reproducer, before the credential
   redactor existed. The parser now returns a fixed safe diagnostic. Existing
   selected-field output, configured-secret redaction, discarded HTTP error bodies
   and fixed unexpected-exception messages remain in place. Tests exercise each
   failure-output path and never use real credentials.
3. **Ambiguous write failures lacked actionable semantics (medium).** Network,
   malformed-response and 5xx failures could follow a committed Jira operation.
   Such outcomes now explicitly return `write_outcome_unknown` and instruct callers
   to inspect Jira before retrying. Requests are never automatically replayed.
   HTTP 429 preserves only a sanitized numeric Retry-After hint; no error body or
   raw header is emitted. Tests cover 400/401/403/404/409/429 and changed workflow
   availability between transition discovery and application.

## Limits that remain explicit

- This is not a transactional multi-agent write coordinator. It has no distributed
  lock, local writer lock, optimistic version precondition or idempotency ledger.
  Simultaneous creates can duplicate work; edits may be last-writer-wins. A read
  preflight cannot prevent a Jira project move racing the request. Current use
  should have one writer; stronger guarantees require a separate design.
- A successful account/project read does not prove mutation permission. Real write
  permissions and workflow validators remain untested without an authorized
  disposable issue. Fixture rejection tests establish client behavior only.
- Credentials exist in process memory and remain accessible to other code running
  under the same Windows identity. The CLI does not provide OS-level isolation.
- Normal issue content is intentionally returned to agents. Redaction covers the
  configured credentials and known encodings, not arbitrary unrelated secrets or
  every possible transformation of secret text. No raw response/header debugging
  should be added.

## Validation

`python -m unittest discover -s tools/jira -p test_*.py -v`: 22 tests pass locally.
The two reproducing tests failed against the original parser before the fix.
Windows/Linux fixture CI and the repository's existing required checks run on the
follow-up PR. Review source, tests and these limits together; a passing suite is
not proof of exactly-once semantics or blanket secret protection.

References: [Python argparse abbreviation behavior](https://docs.python.org/3/library/argparse.html#allow-abbrev),
[Atlassian rate limits and Retry-After](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/).
