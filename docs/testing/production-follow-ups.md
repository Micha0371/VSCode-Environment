# Independent production follow-ups

| Task | Priority | Acceptance |
| --- | --- | --- |
| PF-SDK-001 — Upgrade Expo SDK/tooling | P1 before production | Completed and merged as PR #2; protected-main full regression and Android/physical smoke passed. See ../release-readiness/2026-11-09.md. iOS compilation remains unverified on Windows. |
| PF-EMAIL-001 — Verify real confirmation-email registration | P1 before production | Completed and merged as PR #3, including PR #9. Controlled SMTP signup/session/restart/logout and physical force-stopped cold-start acceptance passed. That cold start used normal routing; fallback coverage remains the deterministic timing regression. Public DNS and fresh Gmail SPF/DKIM/DMARC PASS were verified on 2026-11-10. See [sender authentication evidence](../release-readiness/2026-11-10-email-authentication.md) and the earlier report for scope. |
| PF-EMAIL-002 — Sender DMARC enforcement review | Follow-up hardening | Current auth-subdomain policy is `p=none`, without aggregate reporting. Assess legitimate senders and reporting before considering quarantine/reject; stronger enforcement is not claimed or applied automatically. |
| PF-CLEANUP-001 — Remove historical disposable hosted accounts | P2 before production | Completed: three generated historical fixtures and the final email-test fixture removed with exact/aggregate cascade verification; obsolete generated passwords removed. Owner explicitly retained the three manual-test accounts, their households and one item. Local fixture cleanup remains isolated from hosted data. |

PF-TEST-001 completion requires a recorded clean full-suite run. Do not mark a
new release/tag validated while Android or database runs remain pending.
