# Independent production follow-ups

| Task | Priority | Acceptance |
| --- | --- | --- |
| PF-SDK-001 — Upgrade Expo SDK/tooling | P1 before production | Completed and merged as PR #2; protected-main full regression and Android/physical smoke passed. See ../release-readiness/2026-11-09.md. iOS compilation remains unverified on Windows. |
| PF-EMAIL-001 — Verify real confirmation-email registration | P1 before production | Controlled real-recipient/Android validation passed on 2026-11-09: actual resend receipt, same-device callback authentication, cold restart, logout and consumed-link replay; prior real expiry and translated rate-limit recovery also verified. PR #3 still requires review/current CI/merge. Default sender restricts recipients: production SMTP and delivery to a normal non-organization mailbox remain required before public signup. See ../release-readiness/2026-11-09.md for precise scope. |
| PF-CLEANUP-001 — Remove historical disposable hosted accounts | P2 before production | Completed: three generated historical fixtures and the final email-test fixture removed with exact/aggregate cascade verification; obsolete generated passwords removed. Owner explicitly retained the three manual-test accounts, their households and one item. Local fixture cleanup remains isolated from hosted data. |

PF-TEST-001 completion requires a recorded clean full-suite run. Do not mark a
new release/tag validated while Android or database runs remain pending.
