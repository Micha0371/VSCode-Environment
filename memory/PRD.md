# Pantry Flow — PRD Summary

> **Last Updated**: January 2026
> **Status**: Planning Complete (v1.1 Refined)

---

## Original Problem Statement

Create Pantry Flow app-specific PRD and implementation starting point based on the approved Ecosystem Foundation Blueprint (Household_Bundle P0), covering:
- mobile-first product direction
- Supabase-based backend
- managed auth via Supabase Auth
- multilingual-ready from day one (EN + DE)
- cost-conscious architecture
- solo-founder maintainable
- shared household capable
- fair free vs premium structure

---

## Product Overview

**Pantry Flow** is a calm, elegant, mobile-first household utility app that helps users know what they have at home, what is running low, and what they need to buy soon.

### Core Promise
> Reduce the mental load of household inventory management.

### Target Stack (per Blueprint)
- **Frontend**: Expo/React Native (cross-platform mobile-first)
- **Backend**: Supabase (managed PostgreSQL + Auth + RLS)
- **Auth**: Supabase Auth (email/password)
- **i18n**: Lightweight hook + locale files (EN + DE)

---

## User Personas

1. **Household Manager** — Primary user who manages shopping/inventory
2. **Shared Household Member** — Partner/roommate who contributes
3. **Organized Planner** — Wants comprehensive tracking without complexity

---

## Core Requirements (Refined v1.1)

### MVP Features
- Pantry Dashboard with filtering
- Add/Edit/Delete items (name, category, location required; quantity optional)
- **Status-based tracking**: in_stock, low, out (not enterprise inventory)
- Shopping list with **prompt-based sync** (no automatic loops)
- User authentication (Supabase Auth)
- **One household per user** (clear leave-then-join flow)
- i18n: English + German
- Free tier: **75 items max** (premium: unlimited)

### Deferred (Post-MVP)
- Expiry tracking UI (schema ready)
- Barcode scanning
- AI features
- Database-level premium enforcement

### Non-Goals
- Recipe management
- Meal planning
- Real-time sync
- Enterprise inventory complexity

---

## What's Been Implemented

| Date | Deliverable | Status |
|------|-------------|--------|
| Jan 2026 | Ecosystem Blueprint analysis | ✅ Complete |
| Jan 2026 | Pantry Flow PRD v1.0 | ✅ Complete |
| Jan 2026 | PRD Refinement v1.1 | ✅ Complete |
| Jan 2026 | Reuse Audit | ✅ Complete (Clean Slate) |
| Jan 2026 | Implementation Starting Point v1.1 | ✅ Complete |

### Documents Created
- `/app/docs/A_PantryFlow_PRD.md` — Full PRD (v1.1 Refined)
- `/app/docs/B_Reuse_Audit.md` — Reuse audit report
- `/app/docs/C_Implementation_Starting_Point.md` — Implementation blueprint (v1.1)
- `/app/docs/D_Refinement_Changelog.md` — Changelog of refinements

---

## Key Refinements (v1.1)

| Topic | Change |
|-------|--------|
| Free item limit | 50 → **75** |
| UX model | Quantity-focused → **Status-based (in_stock/low/out)** |
| Shopping sync | Auto-add → **Prompt-based, user confirms** |
| Household membership | Vague merge → **One per user, leave-then-join** |
| Premium enforcement | DB trigger → **Phase 1: UI soft gating** |
| Expiry tracking | MVP feature → **Deferred (schema only)** |
| Project structure | Monorepo required → **Day-one simple, monorepo is reference** |

---

## Prioritized Backlog

### P0 (MVP Must-Have)
- [ ] Supabase project setup
- [ ] Database schema + RLS policies
- [ ] Auth flow (login/register)
- [ ] Pantry CRUD with status model
- [ ] Shopping list with prompt-based sync
- [ ] Household sharing (one per user)
- [ ] i18n (EN + DE)
- [ ] Soft premium gating (75 items)

### P1 (Post-MVP)
- [ ] Expiry tracking UI
- [ ] Premium subscription (RevenueCat)
- [ ] Database-level premium enforcement
- [ ] Google social login

### P2 (Future)
- [ ] Barcode scanning
- [ ] Smart suggestions
- [ ] Multiple households
- [ ] Additional languages

---

## Next Tasks

1. Set up Supabase project
2. Run database migrations
3. Implement Phase 0 foundation (theme, i18n, auth provider)
4. Build auth screens
5. Build pantry core with status model

---

*See full documents in `/app/docs/` for complete details.*
