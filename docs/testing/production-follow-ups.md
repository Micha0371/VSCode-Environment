# Independent production follow-ups

| Task | Priority | Acceptance |
| --- | --- | --- |
| PF-SDK-001 — Upgrade Expo SDK/tooling | P1 before production | Implemented and Android-validated in PR #2 (ready for review, not merged): Expo 58, locked compatible dependencies, advisory review, fast/database/Android suites, physical-device smoke and SonarCloud gate passed. See ../sdk-upgrade/PF-SDK-001.md. iOS compilation remains unverified on Windows. |
| PF-EMAIL-001 — Verify real confirmation-email registration | P1 before production | Dedicated test project/provider; delivered email, correct redirect/expiry, unconfirmed login rejected, confirmation followed by login, duplicate registration privacy and recovery checked. Local admin confirmation and simulated UI responses do not satisfy delivery. |
| PF-CLEANUP-001 — Remove historical disposable hosted accounts | P2 before production | Delete the three prior verification accounts through authorized dashboard/admin access, confirm their test households/inventory removed, and remove ignored credentials. Current local fixture cleanup does not touch hosted accounts. |

PF-TEST-001 completion requires a recorded clean full-suite run. Do not mark a
new release/tag validated while Android or database runs remain pending.
