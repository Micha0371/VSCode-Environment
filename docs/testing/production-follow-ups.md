# Independent production follow-ups

| Task | Priority | Acceptance |
| --- | --- | --- |
| PF-SDK-001 — Upgrade Expo SDK/tooling | P1 before production | Completed and merged as PR #2; protected-main full regression and Android/physical smoke passed. See ../release-readiness/2026-11-09.md. iOS compilation remains unverified on Windows. |
| PF-EMAIL-001 — Verify real confirmation-email registration | P1 before production | Default-sender resend receipt, Android callback, cold restart, logout and replay passed on 2026-11-09. Resend custom SMTP now delivers to a non-organization mailbox, but fresh initial confirmation still returned to login after tracking was disabled: the account confirmed without a session. Current-source local API and first-signup Android tests pass; hosted handoff diagnosis and SMTP fixture cleanup remain open. Sender DNS authentication also requires verification. PR #3 still requires review/current CI/merge. See ../release-readiness/2026-11-09.md for precise scope. |
| PF-CLEANUP-001 — Remove historical disposable hosted accounts | P2 before production | Completed: three generated historical fixtures and the final email-test fixture removed with exact/aggregate cascade verification; obsolete generated passwords removed. Owner explicitly retained the three manual-test accounts, their households and one item. Local fixture cleanup remains isolated from hosted data. |

PF-TEST-001 completion requires a recorded clean full-suite run. Do not mark a
new release/tag validated while Android or database runs remain pending.
