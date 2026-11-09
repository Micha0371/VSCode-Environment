# Independent production follow-ups

| Task | Priority | Acceptance |
| --- | --- | --- |
| PF-SDK-001 — Upgrade Expo SDK/tooling | P1 before production | Completed and merged as PR #2; protected-main full regression and Android/physical smoke passed. See ../release-readiness/2026-11-09.md. iOS compilation remains unverified on Windows. |
| PF-EMAIL-001 — Verify real confirmation-email registration | P1 before production | Controlled non-organization custom-SMTP first signup, Android PKCE exchange, cold restart, logout and exact cleanup passed at 23:38 Berlin on 2026-11-09. Full regression run 42709533982 passed all four jobs at startup-fix commit 85d0114. The successful real callback was warm; the fallback has separate deterministic timing regression coverage. PR #3 and the startup/harness changes still need review/integration; sender SPF/DMARC verification remains a separate production follow-up. See ../release-readiness/2026-11-09.md for precise scope. |
| PF-CLEANUP-001 — Remove historical disposable hosted accounts | P2 before production | Completed: three generated historical fixtures and the final email-test fixture removed with exact/aggregate cascade verification; obsolete generated passwords removed. Owner explicitly retained the three manual-test accounts, their households and one item. Local fixture cleanup remains isolated from hosted data. |

PF-TEST-001 completion requires a recorded clean full-suite run. Do not mark a
new release/tag validated while Android or database runs remain pending.
