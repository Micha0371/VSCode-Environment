# Pantry Flow Documents — Refinement Changelog

> **Date**: January 2026
> **Version**: 1.0 → 1.1 (Refined)

---

## A. Changes to `/app/docs/A_PantryFlow_PRD.md`

### 1. Free Tier Item Limit
- **Changed**: 50 items → **75 items**
- Updated in: Section 2 (MVP Scope), Section 12 (Free vs Premium), Section 17 (Implementation Phases), Section 18 (Edge Cases)
- Added note that 100 was considered but 75 provides clearer differentiation

### 2. Quantity Model / UX Simplification
- **Changed**: Removed emphasis on quantity/unit as primary UX
- **Added**: New "Item Status Model" section in Data Model (Section 9)
  - Status values: `in_stock`, `low`, `out`
  - Quantity/unit fields retained as optional (available but not required)
- Updated schema: `status text` replaces `is_low_stock boolean`
- Updated Core Value Propositions to emphasize states over quantities
- Removed "enterprise inventory" from Non-Goals (made explicit)

### 3. Expiry Tracking
- **Changed**: Moved from MVP core to deferred feature
- **Added**: New Section 14 "Expiry Tracking (Deferred Feature)"
- Removed from MVP Scope table (moved to Deferred list)
- Schema retains `expiry_date` field as optional
- Clarified: data model supports it, UI deferred to post-MVP

### 4. Low-Stock to Shopping-List Sync Rules
- **Added**: New Section 10 "Pantry ↔ Shopping List Sync Rules (MVP)"
- Explicit rules:
  - Marking low/out **prompts** "Add to shopping list?" (not automatic)
  - Removing shopping item does NOT affect pantry status
  - Checking off shopping item does NOT auto-update pantry
  - No automatic re-add loops
- Updated Flow 3 and Flow 5 in Key User Flows

### 5. Household Join Behavior
- **Changed**: Simplified to "one household per user at any time"
- **Removed**: Vague "inactive or merged" language
- **Added**: Clear rule: accepting invitation requires leaving current household
- Updated schema: `UNIQUE(user_id)` on `pantry_household_members` to enforce one-household
- Updated Invitation Flow with explicit confirmation step
- Updated Flow 6 in Key User Flows

### 6. Premium Enforcement Approach
- **Changed**: Moved database trigger enforcement to "Phase 2 (Post-MVP)"
- **Added**: "Implementation Approach" subsection with phased strategy
  - Phase 1: Soft UI/application-layer gating
  - Phase 2: Database-level enforcement after subscription plumbing stable
- Removed database trigger SQL from PRD (moved to future work)

### 7. Other Refinements
- Updated version to 1.1 (Refined)
- Updated Section numbers (added Section 10, renumbered subsequent)
- Simplified Jobs-to-Be-Done (removed expiry job from high-priority)
- Updated Status colors in Design Tokens (in_stock, low, out)
- Updated analytics event: `item_marked_low` → `item_status_changed`
- Clarified index: `is_low_stock` → `status`

---

## B. Changes to `/app/docs/C_Implementation_Starting_Point.md`

### 1. Reference Architecture vs Day-One Setup
- **Added**: New Section 1 "Project Structure: Reference vs Day-One"
- Clarified: monorepo structure is **reference architecture** for future portfolio
- **Added**: Day-one setup as simpler `/pantry-flow/` focused structure
- Emphasized: start simple, refactor to monorepo later

### 2. Free Tier Item Limit
- **Changed**: `FREE_ITEM_LIMIT = 50` → `FREE_ITEM_LIMIT = 75`
- Updated in all code examples

### 3. Quantity Model / UX Simplification
- **Added**: StatusBadge component example (replaces quantity-focused UI)
- Updated `usePantryItems` hook to use `status` field
- Removed quantity-centric UI patterns
- Added StatusFilter component to recommended components

### 4. Low-Stock to Shopping-List Sync
- **Added**: Section 7 "Pantry ↔ Shopping List Sync" with complete implementation
- Shows prompt-based approach (not automatic sync)
- Includes `handleStatusChange` UI flow example
- Clarifies: checking off shopping item does NOT update pantry

### 5. Household Join Behavior
- **Updated**: `useHousehold` hook with clear `acceptInvitation` flow
  - Deletes current membership first
  - Then joins new household
  - Creates new personal household on `leaveHousehold`
- Added `household_join_title` and `household_join_message` to translations

### 6. Premium Enforcement Approach
- **Added**: Section 8 "Premium Gating (Phased Approach)"
- Phase 1: Soft UI enforcement with graceful handling
- Phase 2: Database trigger (noted as future work)
- `canAddItem` returns status object for UI handling (not throwing errors)
- Added `premium_limit_title` and `premium_limit_message` to translations

### 7. Expiry Tracking
- **Added**: Section 11 "Expiry Tracking (Deferred)"
- Confirms: schema ready, UI deferred
- Documents post-MVP implementation path

### 8. i18n Enhancements
- Added parameter support to `t()` function: `t('key', { name: 'Milk' })`
- Added new translation keys:
  - `status_in_stock`, `status_low`, `status_out`
  - `prompt_add_to_shopping_title`, `prompt_add_to_shopping_message`
  - `household_join_title`, `household_join_message`
  - `premium_limit_title`, `premium_limit_message`

### 9. Other Refinements
- Updated version to 1.1 (Refined)
- Simplified file paths (using `@/` alias consistently)
- Removed quantity/unit from required fields in ItemForm references
- Updated phased task list to reflect refined scope
- Clarified component imports (day-one structure)

---

## Summary of Key Decisions

| Topic | Previous | Refined |
|-------|----------|---------|
| Free item limit | 50 | **75** |
| Primary UX model | Quantity + is_low_stock | **Status (in_stock/low/out)** |
| Quantity fields | Required | **Optional** |
| Expiry in MVP | Basic view | **Deferred (schema only)** |
| Shopping list sync | "Auto-appears" | **Prompt-based, user confirms** |
| Household membership | Vague merge logic | **One household per user, leave-then-join** |
| Premium enforcement | Database trigger | **Phase 1: UI soft gating, Phase 2: DB** |
| Project structure | Monorepo required | **Day-one simple, monorepo is reference** |

---

*Both documents are now aligned with the Ecosystem Foundation Blueprint and review feedback.*
