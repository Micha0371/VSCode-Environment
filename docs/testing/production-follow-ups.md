# Independent production follow-ups

Owner for every open item below: repository maintainer **Micha0371**. Internal
PF identifiers are tracking labels, not Jira issue keys. Review these gates
before the related implementation or release; completing Slice 1.1 does not
waive them.

| Task | Priority | Acceptance |
| --- | --- | --- |
| PF-SDK-001 — Upgrade Expo SDK/tooling | P1 before production | Completed and merged as PR #2; protected-main full regression and Android/physical smoke passed. See ../release-readiness/2026-11-09.md. iOS compilation remains unverified on Windows. |
| PF-EMAIL-001 — Verify real confirmation-email registration | P1 before production | Completed and merged as PR #3, including PR #9. Controlled SMTP signup/session/restart/logout and physical force-stopped cold-start acceptance passed. That cold start used normal routing; fallback coverage remains the deterministic timing regression. Public DNS and fresh Gmail SPF/DKIM/DMARC PASS were verified on 2026-11-10. See [sender authentication evidence](../release-readiness/2026-11-10-email-authentication.md) and the earlier report for scope. |
| PF-EMAIL-002 — Sender DMARC enforcement review | Follow-up hardening | Current auth-subdomain policy is `p=none`, without aggregate reporting. Assess legitimate senders and reporting before considering quarantine/reject; stronger enforcement is not claimed or applied automatically. |
| PF-CLEANUP-001 — Remove historical disposable hosted accounts | P2 before production | Completed: three generated historical fixtures and the final email-test fixture removed with exact/aggregate cascade verification; obsolete generated passwords removed. Owner explicitly retained the three manual-test accounts, their households and one item. Local fixture cleanup remains isolated from hosted data. |
| PF-IOS-001 — Validate iOS build and physical behavior | P1 before an iOS/public launch | Produce a fresh SDK-compatible iOS build and verify auth/link/session recovery, pantry CRUD, duplicates, navigation, keyboard interaction and icons on iOS. Windows/Android evidence does not close this gate. |
| PF-PREMIUM-001 — Audit existing premium flags | Before premium gating | Audit existing `profiles.is_premium` against intended entitlements using authorized read access; document anomalies and obtain an explicit decision before any correction. Do not reset flags automatically. SEC-03's privilege tests do not establish historical data correctness. |
| PF-DB-001 — Align database versions and adopt hosted migration history safely | Before KAN-8 reaches hosted Supabase | KAN-28 changes the disposable local/CI target from major 15 to 17; [local verification](2026-11-10-kan-28-postgres17.md) compares local 17.11 with hosted 17.6. Exact-head full CI including Android must pass before acceptance and KAN-8 authors the migration. The hosted migration ledger remains absent: review baseline adoption before using migration push/repair; never replay 00001–00003 against existing tables or infer application from an empty ledger. Tracked as [KAN-28](https://michaelwuerthner.atlassian.net/browse/KAN-28) (PF-DB-001a: Align local/CI PostgreSQL to major 17) and [KAN-29](https://michaelwuerthner.atlassian.net/browse/KAN-29) (PF-DB-001b: Adopt hosted migration-history baseline, before hosted application). |
| PF-LEGACY-001 — Legacy frontend dependency reproducibility | Before running/releasing the archived frontend | The supported app is `pantry-flow`. The legacy `frontend` has no committed lockfile; do not treat its dependency tree as verified or ship it without a separate dependency/build review and lockfile. |
| PF-I18N-001 — Complete English/German launch content | Before public launch | Complete the PRD's EN+DE content and verify translated validation/navigation. German delivery remains outside the approved Slice 1.1 baseline. Planned as a separate localization slice after Slice 2, possibly with more European languages, together with the language switcher and pantry filters (owner decision D5, [Slice 2 plan](../planning/slice-2-implementation-plan.md)). |
| PF-AUTH-001 — Password recovery | Before public launch | Design and verify request, email, native reset link, password update and expired/replayed recovery. This missing public-user recovery path is not claimed covered by signup confirmation. |
| PF-DATA-001 — Populated-database migration upgrade test | Before production migration release | Exercise migrations against representative existing data, including invalid/duplicate rows and rollback/no-loss behavior. Empty local resets and PGlite coverage do not establish real upgrade compatibility. The current hosted project is non-production (owner decision D6), so this gates the first production release, not the Slice 2 development migration. |

PF-TEST-001 completion requires a recorded clean full-suite run. Do not mark a
new release/tag validated while Android or database runs remain pending.

KAN-29's [baseline analysis and adoption procedure](hosted-baseline-adoption.md)
is prepared for owner review. It identifies the hosted-only RLS auto-enable
event trigger as an explicit configuration exception; hosted ledger adoption
remains pending authorization and read-back, not completed by documentation.
