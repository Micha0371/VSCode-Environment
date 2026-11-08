# Pantry Flow — Final Corrected Analysis (Experimental Build)

> **Purpose**: Source-faithful analysis of the controlled experimental build before any code is written.
> **Mode**: Sandbox / documentation-only. No implementation in this pass.
> **Source of truth**: `/app/docs/A_PantryFlow_PRD.md`, `/app/docs/C_Implementation_Starting_Point.md`, `/app/docs/E_First_Slice_Build_Plan.md`.
> **Supersedes**: All prior Analysis iterations in this session.

---

## Section A — Sandbox Guardrails (Strict)

The experimental build is bounded by the following rules. Any deviation is a scope violation.

1. **No scope drift.** Build only what is explicitly documented in the Slice 1 plan.
2. **No AI features.** No LLM calls, no smart suggestions, no auto-classification.
3. **No gamification.** No streaks, badges, points, or achievements.
4. **No premium gating in Slice 1.** The 75-item soft limit is deferred to Slice 4.
5. **No recipe management, meal planning, or real-time sync.** These are product non-goals.
6. **No speculative helpers/abstractions.** No offline sync layer, no generic CRUD wrappers, no "future-proof" interfaces beyond what Slice 1 uses.
7. **No deferred schema columns in Slice 1.** `quantity`, `unit`, `expiry_date`, `notes` are explicitly excluded from the Slice 1 `pantry_items` table (see Section H).
8. **No code is written in this pass.** Implementation begins only after explicit "approved" from the user.

---

## Section B — Environment Mismatch (Operational Note)

| Aspect | Emergent Container Default | Pantry Flow Requirement |
|---|---|---|
| Frontend | React (web) served on port 3000 | **Expo / React Native (mobile-first)** |
| Backend | FastAPI on port 8001 | **None — client talks to Supabase directly** |
| Database | MongoDB | **Supabase Postgres + RLS** |
| Auth | Custom JWT | **Supabase Auth (email/password)** |

**Resolution**: Treated as an operational setup mismatch, **not** a product blocker.
- Code generated in the next phase will target an **external Expo project** (run locally by the user via `npx create-expo-app` and Expo Go / simulator).
- No attempt will be made to adapt Pantry Flow to the in-container React-web + FastAPI + Mongo runtime.
- The in-container services remain idle for this project; they are not used.

---

## Section C — Stack & Architecture (Confirmed)

| Layer | Choice |
|---|---|
| Mobile framework | Expo (managed) + React Native + TypeScript |
| Navigation | Expo Router (file-based) |
| State | React Context (Auth, i18n) + local hook state |
| Backend | Supabase (Postgres + Auth + RLS) |
| Client SDK | `@supabase/supabase-js` |
| Session storage | `@react-native-async-storage/async-storage` |
| i18n | Flat key–value objects + custom `I18nProvider` / `useTranslation` hook |
| Theming | Static token object in `lib/theme.ts` |

**No** Redux, Zustand, React Query, Reanimated, Tamagui, NativeWind, or other libraries in Slice 1 unless Slice 1 literally cannot ship without them.

---

## Section D — Reuse Audit (Clean Slate Confirmed)

- `/app` currently contains only planning documents under `/app/docs/` and `/app/memory/PRD.md`.
- No legacy code, components, hooks, or migrations exist.
- **Reuse score: 0%.** Everything is greenfield.
- Output target is a new Expo project scaffold, generated on the user's machine.

---

## Section E — Slice 1 Scope (Included)

| Included in Slice 1 | Rationale |
|---|---|
| Supabase project + `00001_first_slice.sql` migration | Foundation |
| `profiles` table + auto-create trigger on `auth.users` insert | Required for RLS |
| `pantry_households` + `pantry_household_members` (UNIQUE `user_id`) | Required for item ownership |
| `pantry_items` table — **strict Slice 1 schema (see Section H)** | Core feature |
| RLS policies for all 4 tables | Security baseline |
| Supabase Auth: register, login, logout, session restore | Auth gate |
| 2-tab layout: Pantry + Settings (logout-only stub) | Minimal navigation |
| Pantry list screen | Primary value |
| Add Item modal (name, category, location) | Core action |
| Edit Item modal (name, category, location, status, delete) | Core action |
| Status model: `in_stock` / `low` / `out` with colored badge | Core differentiation |
| `I18nProvider` + `useTranslation` hook | i18n-ready from day one |
| `en.ts` populated; `de.ts` stubbed | English-visible, architecture multilingual |
| Basic theming via `lib/theme.ts` | Calm visual identity |

---

## Section F — Explicitly Excluded from Slice 1

| Excluded | Moved to |
|---|---|
| Shopping list table, screen, "add to shopping list?" prompt | Slice 2 |
| Category/status filters, pull-to-refresh | Slice 2 |
| German translation **content** (stub structure stays) | Slice 2 / 3 |
| Language switcher UI | Slice 2 / 3 |
| Household invitations / sharing / leave-then-join | Slice 3 |
| Profile editing (name change, language preference UI) | Slice 3 |
| Full Settings screen | Slice 3 |
| Premium gating + 75-item soft limit | Slice 4 |
| Expiry tracking (UI **and** schema column) | Post-MVP |
| Quantity / unit / notes fields | Post-MVP (if ever) |
| Barcode scanning, OCR, smart suggestions | Post-MVP |
| RevenueCat, Stripe, any payments | Post-MVP |
| Google OAuth / social login | Post-MVP |
| Password reset UI, email verification UI | Post-MVP |
| Multiple households per user | Post-MVP |
| Push notifications, background sync, offline queue | Post-MVP |

---

## Section G — i18n Architecture (Ready on Day One)

**Principles**
- All user-facing strings go through `t('key')`. No hardcoded visible strings.
- Internal/database values are **language-agnostic keys** (e.g. `in_stock`, `dairy`, `fridge`) — never translated strings.
- Display values are derived via translation (`t('status_in_stock')`, `t('cat_dairy')`, `t('loc_fridge')`).
- Flat key–value shape. No nested namespaces.
- Fallback chain: current locale → English → raw key.
- Locale is persisted in `AsyncStorage` under `user_language`.

**Slice 1 locale content**
- `en.ts`: fully populated for every key referenced in Slice 1 screens.
- `de.ts`: exported empty object typed as `Record<string, string>`. Falls back to English. Content filled in a later slice.

**No** `i18next`, `react-intl`, or ICU plural/format libraries in Slice 1. The custom provider is sufficient and keeps the dependency footprint minimal.

---

## Section H — Database Schema (Slice 1 — Locked)

The four tables below are the **exact** Slice 1 baseline. No additional columns, indexes beyond those listed, or auxiliary tables will be created in Slice 1.

### H.1 `public.profiles`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `name` | `text` NOT NULL DEFAULT `''` | Seeded from `raw_user_meta_data->>'name'` |
| `language` | `text` NOT NULL DEFAULT `'en'` | Reserved for future switcher |
| `is_premium` | `boolean` NOT NULL DEFAULT `false` | Schema-ready; not enforced in Slice 1 |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

### H.2 `public.pantry_households`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK DEFAULT `uuid_generate_v4()` | |
| `name` | `text` NOT NULL DEFAULT `'My Household'` | |
| `owner_id` | `uuid` NOT NULL | FK → `auth.users(id)` ON DELETE CASCADE |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

### H.3 `public.pantry_household_members`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK DEFAULT `uuid_generate_v4()` | |
| `household_id` | `uuid` NOT NULL | FK → `pantry_households(id)` ON DELETE CASCADE |
| `user_id` | `uuid` NOT NULL **UNIQUE** | FK → `auth.users(id)` ON DELETE CASCADE; enforces one-household-per-user |
| `role` | `text` NOT NULL DEFAULT `'owner'` | |
| `joined_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

### H.4 `public.pantry_items` — **Locked Slice 1 shape**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK DEFAULT `uuid_generate_v4()` | |
| `household_id` | `uuid` NOT NULL | FK → `pantry_households(id)` ON DELETE CASCADE |
| `name` | `text` NOT NULL | |
| `status` | `text` NOT NULL DEFAULT `'in_stock'` | CHECK IN (`'in_stock'`, `'low'`, `'out'`) |
| `category` | `text` NOT NULL DEFAULT `'other'` | Language-agnostic key (e.g. `'dairy'`) |
| `location` | `text` NOT NULL DEFAULT `'pantry'` | Language-agnostic key (e.g. `'fridge'`) |
| `created_by` | `uuid` NOT NULL | FK → `auth.users(id)` |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

**Explicitly excluded from `pantry_items` in Slice 1** (will NOT appear in `00001_first_slice.sql`):

- `quantity` — deferred; status model replaces quantity-thinking in MVP.
- `unit` — deferred; unused without quantity.
- `expiry_date` — deferred; expiry tracking is post-MVP.
- `notes` — deferred; no UI affordance in Slice 1.

These columns may be introduced in later migrations when their consuming UI is built. Adding them pre-emptively in Slice 1 is a scope violation.

### H.5 Triggers (Slice 1)

1. `on_auth_user_created` → `handle_new_user()`: inserts into `profiles`, seeding `name` from user metadata.
2. `on_profile_created` → `handle_new_profile()`: inserts a default `pantry_households` row and a `pantry_household_members` row with role `'owner'`.

Both declared `SECURITY DEFINER` so they can insert regardless of the calling session's RLS context.

### H.6 RLS Policies (Slice 1 only)

| Table | Policies |
|---|---|
| `profiles` | SELECT own, UPDATE own |
| `pantry_households` | SELECT where `id ∈ member households of auth.uid()` |
| `pantry_household_members` | SELECT where `user_id = auth.uid()` |
| `pantry_items` | SELECT / INSERT / UPDATE / DELETE where `household_id ∈ member households of auth.uid()` |

No cross-user visibility, no admin bypass policies, no service-role–only policies in Slice 1.

### H.7 Indexes (Slice 1 only)

- `idx_pantry_items_household` on `pantry_items(household_id)`
- `idx_household_members_user` on `pantry_household_members(user_id)`

No other indexes until query patterns in later slices justify them.

---

## Section I — Build Order, Deliverables & Open Questions

### I.1 Build order (locked to `E_First_Slice_Build_Plan.md`)

1. **Day 1** — Supabase project + migration + Expo scaffold + `lib/supabase.ts`, `lib/i18n/*`, `lib/auth.tsx`, `lib/theme.ts`.
2. **Day 2** — Auth screens (`login`, `register`), tabs layout (`Pantry`, `Settings` stub).
3. **Day 3** — `useHousehold`, `usePantryItems`, pantry list screen, `add-item` modal.
4. **Day 4** — `edit-item/[id]` modal with status selector + delete, `StatusBadge`.
5. **Day 5** — Empty state, baseline theming, error strings via `t('err_*')`, final CRUD run-through.

### I.2 Slice 1 deliverable set

- One SQL migration file (`00001_first_slice.sql`) matching Sections H.1–H.7 exactly.
- One Expo project tree (~23 files) matching the structure in `E_First_Slice_Build_Plan.md §File Structure After Slice 1`.
- Populated `en.ts` covering every `t('key')` referenced by Slice 1 screens.
- Stub `de.ts` exporting `{}` typed as `Record<string, string>`.
- README with: Supabase setup steps, env vars, `npx expo start` instructions, test-account flow.

### I.3 Credentials needed before implementation starts

| Credential | Source | Required at |
|---|---|---|
| Supabase project URL | User's Supabase dashboard | Day 1, Step 6 |
| Supabase anon key | User's Supabase dashboard | Day 1, Step 6 |

No LLM key, no Stripe key, no RevenueCat key, no OAuth client IDs in Slice 1.

### I.4 Open questions for the user (non-blocking — sensible defaults chosen)

1. **Supabase project**: Will the user create the project and paste URL + anon key, or should the generated README walk them through project creation? *(Default: README walkthrough.)*
2. **Expo Router version**: Latest stable at time of scaffold. *(Default: accept whatever `create-expo-app` current template ships with.)*
3. **Theme palette**: PRD mentions "calm sage-green" direction. Concrete tokens will be drafted in `lib/theme.ts` on Day 1; the user can override post-scaffold. *(Default: sage/neutral palette as proposed in `C_Implementation_Starting_Point.md`.)*
4. **Package manager**: `npm` (via `npx`) for simplicity. *(Default: npm.)*

None of the above blocks scaffolding. They can all be answered inline at Day-1 kickoff.

### I.5 Definition of Done for Slice 1

- Fresh install flow: register → auto-household → add 3 items → edit one → change status → delete one → logout → login → data persists.
- Zero hardcoded user-visible strings in any screen or component.
- Every DB write uses language-agnostic keys (`in_stock`, `dairy`, `fridge`).
- `supabase.auth.getSession()` on cold start routes correctly to `(tabs)` or `(auth)/login`.
- No console warnings from Expo Router, no Supabase 401/403 in happy-path CRUD.

---

## Summary

- **Clean slate** confirmed; all prior analysis superseded.
- **Environment mismatch** acknowledged and resolved by targeting an **external** Expo project.
- **Slice 1 `pantry_items` schema is locked** to 9 columns: `id`, `household_id`, `name`, `status`, `category`, `location`, `created_by`, `created_at`, `updated_at`. `quantity`, `unit`, `expiry_date`, `notes` are excluded.
- **Awaiting explicit "approved"** before any code, migration, or scaffold is generated.
