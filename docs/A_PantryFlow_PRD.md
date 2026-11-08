# Pantry Flow — Product Requirements Document (PRD)

> **Source of Truth**: Ecosystem Foundation Blueprint (Household_Bundle P0)
> **Version**: 1.1 MVP (Refined)
> **Last Updated**: January 2026

---

## 1. Product Summary

**Pantry Flow** is the first app in a portfolio of 4 household utility apps. It is a calm, elegant, mobile-first application that helps users know what they have at home, what is running low, and what they need to buy soon.

### One Clear Promise
> **Reduce the mental load of household inventory management.**

### Core Value Propositions
- **Know what you have** — Track pantry items by name, category, and location
- **Know what's running low** — Clear visual status: in stock, low, out
- **Know what to buy** — Shopping list built from items you mark as needed
- **Reduce waste** — Optional expiry tracking (lightweight, not required)
- **Reduce forgetting** — Never come home with duplicates or forget essentials

### Design Philosophy (per Blueprint)
- Calm, not chaotic
- Practical, not playful
- Modern, not enterprise
- Light mode first
- Household-friendly
- Minimal clutter, maximum utility

### Technical Foundation (per Blueprint)
- **Frontend**: Cross-platform mobile-first (Expo/React Native)
- **Backend**: Supabase (managed PostgreSQL + Auth + RLS)
- **Auth**: Supabase Auth (email/password baseline, Google OAuth optional later)
- **i18n**: Lightweight hook + locale files (EN + DE at launch)
- **No custom backend server** — client-to-Supabase architecture

---

## 2. MVP Scope

### In Scope (MVP)
| Feature | Description |
|---------|-------------|
| **Pantry Dashboard** | Overview of all items with filtering by category/location |
| **Add/Edit Items** | Quick item entry with name, category, location; quantity optional |
| **Item Status** | Simple states: in stock, low, out (not enterprise inventory) |
| **Shopping List** | View/manage items marked as "need to buy" |
| **User Authentication** | Email/password via Supabase Auth |
| **User Profile** | Name, language preference |
| **Shared Household** | Basic: invite one other user to share pantry (2 members free) |
| **i18n** | English + German from day one |
| **Free/Premium Split** | 75 items free, premium for unlimited |

### Deferred (Post-MVP)
- Expiry tracking UI (data model supports it, UI deferred)
- Barcode scanning
- Photo attachments
- Recipe integration
- Meal planning
- AI-powered suggestions
- Push notifications (server-side)
- Multiple households
- Advanced analytics/reports
- Consumption history tracking
- Google social login

---

## 3. Explicit Non-Goals

| Non-Goal | Rationale |
|----------|-----------|
| Recipe management | Different problem domain, scope creep |
| Meal planning | Adds complexity, not core to inventory |
| Nutrition tracking | Health app territory |
| Price tracking | Smart Cart's domain (sibling app) |
| Barcode database | Requires external API, maintenance burden |
| AI features in MVP | Cost + complexity, not needed for core loop |
| Real-time sync | Poll-on-refresh sufficient for MVP |
| Social features | Moderation burden, not relevant |
| Gamification | Manipulative, against design philosophy |
| Multi-household | Single household focus for MVP |
| Custom backend server | Blueprint: client-to-Supabase |
| Image storage | Eliminates storage costs in v1 |
| Enterprise inventory UX | This is a household app, not warehouse software |

---

## 4. Core User Personas

### Primary: The Household Manager
- **Profile**: 25-45 years old, manages household shopping/inventory
- **Pain**: Forgets what's at home, buys duplicates, things expire unused
- **Goal**: Quick visibility into pantry state before shopping
- **Tech**: Comfortable with mobile apps, prefers simplicity

### Secondary: The Shared Household Member
- **Profile**: Partner/roommate who contributes to household
- **Pain**: Doesn't know what others have bought/used
- **Goal**: Stay informed, contribute without duplicating effort
- **Tech**: Needs low friction, won't adopt complex apps

### Tertiary: The Organized Planner
- **Profile**: Likes systems, wants complete inventory control
- **Pain**: Current tools are either too simple or too complex
- **Goal**: Comprehensive tracking without enterprise complexity
- **Tech**: Will use all features if they're well-designed

---

## 5. Jobs-to-Be-Done

| Job | Frequency | Importance |
|-----|-----------|------------|
| "Help me know what I have at home before shopping" | 2-3x/week | Critical |
| "Help me quickly note when something is running low" | Daily | Critical |
| "Help me build a shopping list from low items" | 2-3x/week | High |
| "Help me avoid buying duplicates" | 2-3x/week | High |
| "Help me share pantry state with my household" | Ongoing | Medium |
| "Help me quickly add new items after shopping" | 2-3x/week | High |

---

## 6. Screen Map

```
┌─────────────────────────────────────────────────────────────┐
│                        PANTRY FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  app/                                                       │
│  ├── _layout.tsx      Root: AuthProvider + I18nProvider     │
│  ├── index.tsx        Entry: redirect based on auth state   │
│  │                                                          │
│  ├── (auth)/          Auth flow (no tabs)                   │
│  │   ├── _layout.tsx  Stack layout                          │
│  │   ├── login.tsx    Login screen                          │
│  │   └── register.tsx Registration screen                   │
│  │                                                          │
│  ├── (tabs)/          Main app (bottom tabs)                │
│  │   ├── _layout.tsx  Bottom tab navigator                  │
│  │   ├── index.tsx    Pantry Dashboard (Tab 1)              │
│  │   ├── shopping.tsx Shopping List (Tab 2)                 │
│  │   └── settings.tsx Settings (Tab 3, always last)         │
│  │                                                          │
│  ├── add-item.tsx     Add item modal                        │
│  ├── edit-item/[id].tsx Edit item modal                     │
│  ├── invite.tsx       Invite household member               │
│  └── premium.tsx      Premium upgrade modal                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Navigation Structure

### Bottom Tab Bar (3 tabs per Blueprint)
| Tab | Icon (Ionicons) | Label | Screen |
|-----|-----------------|-------|--------|
| 1 | `cube-outline` / `cube` | Pantry | Primary dashboard |
| 2 | `cart-outline` / `cart` | Shopping | Shopping list |
| 3 | `settings-outline` / `settings` | Settings | Settings |

### Navigation Rules (per Blueprint)
- Max 3 tabs
- Settings always last
- Primary value screen (Pantry) always first
- Icons: outline for inactive, filled for active (Ionicons)
- Modals slide up (full-screen)
- No nested navigation deeper than 3 levels
- No modal stacking (one modal at a time)

---

## 8. Key User Flows

### Flow 1: First Session (Onboarding → First Item)
```
App Launch → Supabase restores session → No session found →
Navigate to (auth)/login → User taps "Register" →
Register with email/password → Profile created (trigger) →
Household auto-created → Navigate to (tabs) →
Empty Pantry State → Tap "Add First Item" →
Add Item Modal (name required, rest optional) → Save → See Item in Pantry ✓
```
**Target**: Complete within 60 seconds

### Flow 2: Quick Add Item
```
Pantry Tab → Tap "+" FAB → Add Item Modal →
Enter name → Optionally select category/location →
Tap Save → Item appears in list (status: in stock) ✓
```
**Target**: 3 taps + typing

### Flow 3: Mark Item as Low / Need to Buy
```
Pantry Tab → Find item → Tap status or swipe →
Select "Low" or "Out" → Prompt: "Add to shopping list?" →
User confirms → Item added to shopping list ✓
```
**Target**: 2-3 taps

### Flow 4: Before Shopping Trip
```
Open App → Shopping Tab → See items to buy →
Review list → Go shopping ✓
```

### Flow 5: After Shopping (Purchase Flow)
```
Shopping Tab → Tap item to check off →
Item removed from shopping list →
User returns to Pantry → Updates item status to "In Stock" if desired ✓
```

### Flow 6: Share with Household
```
Settings → Household → Invite Member →
Enter email → Send invitation →
Invitee logs in → Sees pending invitation →
Invitee confirms "Join this household" (leaves their current household) →
Both users now see shared pantry ✓
```

---

## 9. Data Model / Schema

### Item Status Model (User-Facing Simplicity)

The app presents simple, practical states to users:

| Status | Meaning | Visual |
|--------|---------|--------|
| **In Stock** | Have it, no action needed | Default / green indicator |
| **Low** | Running low, might need soon | Yellow/amber indicator |
| **Out** | None left, need to buy | Red indicator |

Internally, the data model stores `status text` (values: `in_stock`, `low`, `out`) rather than complex quantity tracking. Quantity fields exist in the schema for optional use but are not the primary UX.

### Tables (Supabase PostgreSQL)

```sql
-- ============================================
-- SHARED PROFILE TABLE (per Blueprint Section 7)
-- ============================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup (per Blueprint Section 4)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PANTRY FLOW TABLES (app-specific, prefixed)
-- ============================================

-- Households
CREATE TABLE public.pantry_households (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL DEFAULT 'My Household',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Household members (join table)
-- Each user belongs to exactly ONE household at a time
CREATE TABLE public.pantry_household_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- Enforces one household per user
);

-- Auto-create household on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger AS $$
DECLARE
  new_household_id uuid;
BEGIN
  -- Create default household
  INSERT INTO public.pantry_households (owner_id, name)
  VALUES (NEW.id, 'My Household')
  RETURNING id INTO new_household_id;
  
  -- Add owner as member
  INSERT INTO public.pantry_household_members (household_id, user_id, role)
  VALUES (new_household_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- Household invitations
CREATE TABLE public.pantry_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- Pantry items (main entity)
CREATE TABLE public.pantry_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low', 'out')),
  category text NOT NULL DEFAULT 'other',
  location text NOT NULL DEFAULT 'pantry',
  -- Optional fields (not required in MVP UX, but available)
  quantity numeric DEFAULT NULL,
  unit text DEFAULT NULL,
  expiry_date date DEFAULT NULL,
  notes text DEFAULT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Shopping list items (independent list, linked optionally to pantry)
CREATE TABLE public.pantry_shopping_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  pantry_item_id uuid REFERENCES public.pantry_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  added_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES (per Blueprint Section 3)
-- ============================================
CREATE INDEX idx_pantry_items_household ON public.pantry_items(household_id);
CREATE INDEX idx_pantry_items_category ON public.pantry_items(household_id, category);
CREATE INDEX idx_pantry_items_status ON public.pantry_items(household_id, status);
CREATE INDEX idx_pantry_shopping_household ON public.pantry_shopping_items(household_id);
CREATE INDEX idx_household_members_user ON public.pantry_household_members(user_id);

-- ============================================
-- ROW LEVEL SECURITY (per Blueprint Section 3)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_shopping_items ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Households: members can view their households
CREATE POLICY "Members view households" ON public.pantry_households
  FOR SELECT USING (
    id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Owner updates household" ON public.pantry_households
  FOR UPDATE USING (owner_id = auth.uid());

-- Household members: view members of your households
CREATE POLICY "View household members" ON public.pantry_household_members
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );

-- Pantry items: household members can CRUD
CREATE POLICY "Members view items" ON public.pantry_items
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Members insert items" ON public.pantry_items
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Members update items" ON public.pantry_items
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Members delete items" ON public.pantry_items
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );

-- Shopping items: same as pantry items
CREATE POLICY "Members view shopping" ON public.pantry_shopping_items
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Members insert shopping" ON public.pantry_shopping_items
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Members update shopping" ON public.pantry_shopping_items
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Members delete shopping" ON public.pantry_shopping_items
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );

-- Invitations: owner can manage, invitee can accept
CREATE POLICY "Owner manages invitations" ON public.pantry_invitations
  FOR ALL USING (invited_by = auth.uid());
CREATE POLICY "Invitee views invitation" ON public.pantry_invitations
  FOR SELECT USING (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));
```

### Enum Values (language-agnostic keys per Blueprint Section 7)

**Item Status**:
`in_stock`, `low`, `out`

**Categories**:
`dairy`, `grains`, `produce`, `protein`, `canned`, `frozen`, `beverages`, `snacks`, `condiments`, `cleaning`, `personal`, `other`

**Units** (optional, for users who want precision):
`piece`, `kg`, `g`, `l`, `ml`, `pack`, `bottle`, `can`, `box`, `bag`, `dozen`

**Locations**:
`fridge`, `freezer`, `pantry`, `counter`, `cabinet`, `other`

---

## 10. Pantry ↔ Shopping List Sync Rules (MVP)

### Design Principle
Keep sync behavior **simple and predictable**. Users should feel in control, not surprised by automation.

### Rules

| Action | Result |
|--------|--------|
| User marks item as "Low" or "Out" | App **prompts**: "Add to shopping list?" — user confirms or skips |
| User adds item to shopping list | Shopping list item created (linked to pantry item if applicable) |
| User removes item from shopping list | Item deleted from shopping list; pantry status unchanged |
| User checks off shopping item | Item removed from shopping list; pantry status unchanged |
| User manually updates pantry status to "In Stock" | No automatic shopping list change |

### What MVP Does NOT Do
- ❌ Automatically re-add items to shopping list when status changes
- ❌ Automatically update pantry status when shopping item is checked off
- ❌ Create infinite loops of sync between pantry and shopping

### Post-MVP Consideration
Smarter automation (e.g., "auto-restock" items that always re-add when marked low) can be explored in premium tier after core UX is validated.

---

## 11. Shared Household Permissions Model (MVP)

### Permission Matrix
| Role | View Items | Add/Edit/Delete Items | Invite Members | Remove Members | Delete Household |
|------|------------|----------------------|----------------|----------------|------------------|
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ |
| Member | ✓ | ✓ | ✗ | ✗ | ✗ |

### MVP Constraints: One Household Per User
- Each user belongs to **exactly one household** at any time
- On signup, user automatically owns their own household
- Accepting an invitation **requires leaving current household**
- No automatic merge of items or data between households in MVP

### Invitation Flow
1. Owner enters invitee's email in Invite screen
2. Invitation row created with status `pending`
3. Invitee registers or logs in → sees pending invitation banner
4. Invitee taps "Accept" → confirmation dialog:
   > "Joining this household will remove you from your current household. Your current items will remain in your old household. Continue?"
5. On confirm:
   - Invitee's membership in old household is deleted
   - Invitee added to new household as `member`
   - Invitation status updated to `accepted`
6. Invitee now sees the shared pantry of the new household

### Owner Leaving Household
- Owner cannot leave without transferring ownership first
- If owner is the only member and deletes account → household deleted

---

## 12. Free vs Premium Feature Split

| Feature | Free | Premium |
|---------|------|---------|
| Pantry items | **75 max** | Unlimited |
| Shopping list | Full access | Full access |
| Categories/locations | All | All |
| Household members | 2 max | 5 max |
| Expiry tracking | — | Optional expiry fields + alerts |
| History retention | 7 days | 90 days |
| Export data (CSV) | No | Yes |
| Smart suggestions | No | Yes (based on history) |

**Note**: 75 items chosen as a fair limit that supports real household use while leaving room for power users to upgrade. (100 was considered but 75 provides clearer differentiation.)

### Premium Pricing (Hypothesis per Blueprint)
- Monthly: $2.99/month
- Annual: $24.99/year (~30% savings)
- Lifetime: $49.99 one-time

### Implementation Approach

**Phase 1 (MVP)**: Soft enforcement via UI/application layer
- `profiles.is_premium` boolean checked in app code
- Frontend shows item count and prompts upgrade near limit
- No database-level triggers blocking inserts initially

**Phase 2 (Post-subscription plumbing)**: Harder enforcement
- Add database trigger to enforce limits once subscription flow is stable
- RevenueCat integration for IAP

This phased approach avoids overengineering before the subscription system is proven.

---

## 13. Onboarding Flow

### Step 1: Welcome Screen
- App name + calm tagline
- "Know what you have. Buy what you need."
- Single CTA: "Get Started"

### Step 2: Register/Login
- Email + password form
- Toggle between Register/Login
- Minimal fields (email, password, name for register)

### Step 3: Language Selection (first launch only)
- "Choose your language"
- English / Deutsch
- Can change later in Settings

### Step 4: Empty Pantry State
- Calm illustration (simple icon, not cartoonish)
- "Your pantry is empty"
- "Add your first item to get started"
- Single prominent "+ Add Item" button

### Step 5: First Item Success
- Item appears in list
- Brief tooltip: "Tap an item to change its status"
- Onboarding complete

---

## 14. Expiry Tracking (Deferred Feature)

### MVP Approach
- Data model includes optional `expiry_date` field
- **UI for expiry is deferred to post-MVP**
- No expiry input in the add-item modal for MVP
- No expiry badges or alerts in MVP

### Post-MVP (Premium)
- Add optional expiry date field in edit-item modal
- Show expiry badges on items approaching expiry
- Premium: enable expiry alerts/notifications

### Rationale
Expiry tracking adds UX complexity and maintenance burden. Keeping it optional and deferred allows MVP to stay focused on core pantry + shopping list value.

---

## 15. Localization and i18n Considerations

### Launch Languages (per Blueprint)
- **English (en)** — Source of truth
- **German (de)** — First translation

### Implementation Rules (per Blueprint Section 5)
1. No hardcoded user-facing text — all via `t('key')`
2. Language-agnostic internal values — store `dairy`, display `t('cat_dairy')`
3. Flat key-value locale files — no nesting
4. 40% text expansion tolerance — German is longer
5. Locale stored in AsyncStorage + synced to `profiles.language`
6. Dates/numbers formatted via `Intl` at display time

### Translation Key Namespaces
```
common_*   — Common words (common_save, common_cancel)
nav_*      — Navigation (nav_pantry, nav_shopping, nav_settings)
cat_*      — Categories (cat_dairy, cat_produce)
loc_*      — Locations (loc_fridge, loc_pantry)
status_*   — Item status (status_in_stock, status_low, status_out)
label_*    — Form labels (label_name, label_category)
btn_*      — Buttons (btn_add_item, btn_mark_low)
msg_*      — Messages (msg_saved, msg_deleted)
err_*      — Errors (err_required, err_network)
empty_*    — Empty states (empty_pantry_title, empty_pantry_subtitle)
onboard_*  — Onboarding (onboard_welcome, onboard_get_started)
settings_* — Settings (settings_language, settings_household)
premium_*  — Premium (premium_unlock, premium_unlimited)
```

---

## 16. Analytics Events (per Blueprint Section 9)

| Event | Trigger | Purpose |
|-------|---------|---------|
| `app_opened` | App launch | DAU tracking |
| `signup_completed` | Successful registration | Conversion |
| `first_item_added` | First pantry item created | Activation |
| `item_added` | Any item added | Core engagement |
| `item_status_changed` | Status changed (in_stock/low/out) | Feature usage |
| `shopping_item_added` | Item added to shopping list | Feature usage |
| `shopping_item_checked` | Item checked off | Task completion |
| `household_invited` | Invitation sent | Sharing adoption |
| `household_joined` | Invitation accepted | Sharing success |
| `language_changed` | Language changed | i18n usage |
| `premium_screen_viewed` | Premium modal opened | Purchase intent |
| `premium_subscribed` | Subscription complete | Revenue |

### MVP Implementation
- Console logging only (no analytics SDK per Blueprint)
- Event structure ready for future PostHog/Aptabase integration

---

## 17. Implementation Phases

### Phase 0: Foundation (Week 1)
- [ ] Supabase project setup
- [ ] Database schema (migrations)
- [ ] RLS policies
- [ ] Supabase client configuration
- [ ] Auth context (AuthProvider, useAuth hook)
- [ ] i18n setup (I18nProvider, useTranslation, en.ts, de.ts)
- [ ] Design system tokens (per Blueprint Section 15)
- [ ] Base UI components (Button, Card, Input, Badge, EmptyState)
- [ ] Navigation structure (Expo Router: _layout, (auth), (tabs))

### Phase 1: Core Pantry (Week 2)
- [ ] Login screen
- [ ] Register screen
- [ ] Auth flow integration
- [ ] Pantry dashboard screen
- [ ] Empty pantry state
- [ ] Add item modal (name, category, location — status defaults to in_stock)
- [ ] Edit item modal
- [ ] Status toggle (in_stock / low / out)
- [ ] Item list with filtering (category, location, status)
- [ ] Pull-to-refresh

### Phase 2: Shopping List (Week 3)
- [ ] Shopping list screen
- [ ] "Add to shopping list" prompt when marking item low/out
- [ ] Manual add to shopping list
- [ ] Check-off item (removes from list)
- [ ] Delete item from shopping list
- [ ] Shopping list empty state

### Phase 3: Household Sharing (Week 4)
- [ ] Settings screen
- [ ] Profile section (name, language)
- [ ] Household section
- [ ] Invite member screen
- [ ] Invitation creation
- [ ] Pending invitation display (for invitee)
- [ ] Accept invitation (with leave-current-household confirmation)
- [ ] Decline invitation
- [ ] Member list display
- [ ] Remove member (owner)
- [ ] Leave household (member)

### Phase 4: Premium & Polish (Week 5)
- [ ] Premium modal
- [ ] Item count display + soft limit enforcement (75 free)
- [ ] Upgrade prompts (soft, not aggressive)
- [ ] Member limit enforcement (2 free)
- [ ] Error handling polish
- [ ] Loading states everywhere
- [ ] Keyboard handling
- [ ] Accessibility pass (touch targets, labels)

### Phase 5: Testing & Launch (Week 6)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Final i18n review (German QA)
- [ ] App Store assets
- [ ] Documentation
- [ ] Soft launch

---

## 18. Edge Cases and Failure States

### Authentication
| Scenario | Handling |
|----------|----------|
| Invalid credentials | Show error, don't clear form |
| Network error | "Check your connection" + retry |
| Session expired | Silent refresh via Supabase SDK |
| Email already registered | "Account exists. Sign in?" |

### Pantry Items
| Scenario | Handling |
|----------|----------|
| Free limit reached (75) | Soft prompt, show upgrade option |
| Item deleted by other member | Refresh shows removal, toast |

### Shopping List
| Scenario | Handling |
|----------|----------|
| All items checked | Success state, option to clear |
| Pantry item deleted | Shopping item becomes standalone (name preserved) |

### Household
| Scenario | Handling |
|----------|----------|
| Member limit reached | Prompt upgrade (free: 2, premium: 5) |
| Invite to unregistered email | Create pending, accept on signup |
| Owner tries to leave | Must transfer ownership first |
| Accepting invite | Confirm leave current household first |

### Network
| Scenario | Handling |
|----------|----------|
| Offline | Show cached data, disable writes, banner |
| Slow network | Loading indicators, 10s timeout |
| Conflict | Last-write-wins (MVP simplicity) |

---

## Appendix: Design Tokens (per Blueprint Section 15)

### Colors
```
Background:
  primary: #F9F9F7
  secondary: #FFFFFF
  tertiary: #F2F2ED

Brand:
  primary: #4A5D4E (sage green)
  light: #E9EFEA
  secondary: #D4A373 (warm tan)
  accent: #738C79

Text:
  primary: #2C302E
  secondary: #6A736E
  tertiary: #9EA8A2
  inverse: #FFFFFF

Status:
  in_stock: #4A5D4E (green)
  low: #D99559 (amber)
  out: #C76D6D (red)

Borders:
  default: #E4E6E1
  focus: #4A5D4E
```

### Spacing (8pt grid)
```
xs: 4 | sm: 8 | md: 16 | lg: 24 | xl: 32 | xxl: 48
```

### Typography
```
h1: 32/40 weight 800 tracking -0.5
h2: 24/32 weight 700 tracking -0.3
h3: 20/28 weight 600 tracking -0.2
body: 16/24 weight 400
label: 14/20 weight 600 tracking 0.5 uppercase
small: 12/16 weight 500
```

### Border Radii
```
sm: 8 | md: 12 | lg: 16 | xl: 24 | pill: 9999
```

---

*This PRD is the source of truth for Pantry Flow MVP. Refer to Ecosystem Foundation Blueprint for shared conventions.*
