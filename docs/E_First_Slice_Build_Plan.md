# Pantry Flow — First Vertical Slice Build Plan

> **Goal**: Smallest usable end-to-end version that proves the foundation
> **Scope**: Auth + Pantry CRUD + Status Model + i18n-Ready Architecture
> **Timeline**: 3-5 days for a solo founder

---

## 1. What to Build First (Slice 1)

| Include | Why |
|---------|-----|
| Supabase project setup | Foundation |
| `profiles` table + auto-creation trigger | Required for auth |
| `pantry_households` + `pantry_household_members` tables | Required for items |
| `pantry_items` table (simplified) | Core feature |
| Login screen | Auth gate |
| Register screen | New users |
| Pantry list screen | Primary value |
| Add item modal | Core action |
| Edit item modal | Core action |
| Status toggle (in_stock/low/out) | Core differentiation |
| Basic 2-tab navigation (Pantry + Settings stub) | Minimal nav |
| **i18n provider + English translations** | Architecture ready from day one |

---

## 2. What to Postpone

| Postpone | When |
|----------|------|
| Shopping list screen + table | Slice 2 |
| "Add to shopping list?" prompt | Slice 2 |
| Household invitations + sharing | Slice 3 |
| Settings screen (full) | Slice 3 |
| Premium gating + item limits | Slice 4 |
| **German translations** (structure ready, content later) | Slice 2 or 3 |
| Category/location filters | After basic list works |
| Pull-to-refresh | After basic list works |
| Empty state illustrations | After basic list works |
| Expiry tracking | Post-MVP |

---

## 3. Required Supabase Tables (First Slice Only)

### Migration 1: `00001_first_slice.sql`

```sql
-- ============================================
-- FIRST SLICE: Profiles + Households + Items
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Households table
CREATE TABLE public.pantry_households (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL DEFAULT 'My Household',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Household members table (one user = one household)
CREATE TABLE public.pantry_household_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 4. Pantry items table (simplified for first slice)
CREATE TABLE public.pantry_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low', 'out')),
  category text NOT NULL DEFAULT 'other',
  location text NOT NULL DEFAULT 'pantry',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- TRIGGERS: Auto-create profile + household
-- ============================================

-- Trigger 1: Create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Create household when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger AS $$
DECLARE
  new_household_id uuid;
BEGIN
  INSERT INTO public.pantry_households (owner_id)
  VALUES (NEW.id)
  RETURNING id INTO new_household_id;
  
  INSERT INTO public.pantry_household_members (household_id, user_id, role)
  VALUES (new_household_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

-- Profiles: own profile only
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Households: via membership
CREATE POLICY "Members view households" ON public.pantry_households
  FOR SELECT USING (
    id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );

-- Members: view own membership
CREATE POLICY "View own membership" ON public.pantry_household_members
  FOR SELECT USING (user_id = auth.uid());

-- Items: full CRUD for household members
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

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_pantry_items_household ON public.pantry_items(household_id);
CREATE INDEX idx_household_members_user ON public.pantry_household_members(user_id);
```

**That's it for Slice 1.** No shopping table, no invitations table.

---

## 4. Required Screens (First Slice Only)

```
app/
├── _layout.tsx           # Root: I18nProvider + AuthProvider
├── index.tsx             # Entry redirect
├── (auth)/
│   ├── _layout.tsx       # Stack
│   ├── login.tsx         # Email + password login
│   └── register.tsx      # Email + password + name register
├── (tabs)/
│   ├── _layout.tsx       # 2-tab layout (Pantry, Settings)
│   ├── index.tsx         # Pantry list
│   └── settings.tsx      # Stub: just logout button
├── add-item.tsx          # Modal: name + category + location
└── edit-item/
    └── [id].tsx          # Modal: edit + status + delete
```

**Total: 9 files** (excluding components/hooks/lib)

---

## 5. Navigation (First Slice Only)

### 2 Tabs Only

| Tab | Icon | Screen | Content |
|-----|------|--------|---------|
| 1 | `cube` | Pantry | Item list + FAB |
| 2 | `settings` | Settings | Logout button only |

**No Shopping tab yet.** Add it in Slice 2.

### Modals

| Route | Presentation | Purpose |
|-------|--------------|---------|
| `/add-item` | Modal | Add new item |
| `/edit-item/[id]` | Modal | Edit item + change status + delete |

---

## 6. Minimal Auth Flow

### What Works in Slice 1

```
Register:
1. User enters name, email, password
2. supabase.auth.signUp({ email, password, options: { data: { name } } })
3. Trigger creates profile → trigger creates household
4. Redirect to (tabs)

Login:
1. User enters email, password
2. supabase.auth.signInWithPassword({ email, password })
3. Redirect to (tabs)

Logout:
1. User taps "Sign Out" in Settings
2. supabase.auth.signOut()
3. Redirect to (auth)/login

Session Restore:
1. App opens
2. supabase.auth.getSession()
3. If session → (tabs), else → (auth)/login
```

### What's NOT in Slice 1

- Password reset
- Email verification UI
- Google OAuth
- Profile editing (name change)

---

## 7. Minimal Item CRUD Flow

### Get Household ID (Required First)

```tsx
// On app load or in a hook
const { data: membership } = await supabase
  .from('pantry_household_members')
  .select('household_id')
  .eq('user_id', user.id)
  .single();

const householdId = membership.household_id;
// Store in context or pass to hooks
```

### List Items

```tsx
const { data: items } = await supabase
  .from('pantry_items')
  .select('*')
  .eq('household_id', householdId)
  .order('created_at', { ascending: false });
```

### Add Item

```tsx
await supabase.from('pantry_items').insert({
  household_id: householdId,
  name: formData.name,
  category: formData.category || 'other',    // Language-agnostic key
  location: formData.location || 'pantry',   // Language-agnostic key
  status: 'in_stock',                        // Language-agnostic key
  created_by: user.id,
});
```

### Update Item

```tsx
await supabase
  .from('pantry_items')
  .update({
    name: formData.name,
    category: formData.category,
    location: formData.location,
    status: formData.status,
    updated_at: new Date().toISOString(),
  })
  .eq('id', itemId);
```

### Delete Item

```tsx
await supabase
  .from('pantry_items')
  .delete()
  .eq('id', itemId);
```

---

## 8. Status Model in First Slice

### How It Works

| Status | Internal Key | Display (via i18n) | Visual |
|--------|--------------|-------------------|--------|
| In Stock | `in_stock` | `t('status_in_stock')` | Green badge |
| Low | `low` | `t('status_low')` | Amber badge |
| Out | `out` | `t('status_out')` | Red badge |

### UI Pattern (i18n-Ready)

In the **edit item modal**, show 3 status buttons using translation keys:

```tsx
<View style={styles.statusRow}>
  <StatusButton 
    label={t('status_in_stock')}  // ← Uses translation key
    active={status === 'in_stock'} 
    color={colors.status.in_stock}
    onPress={() => setStatus('in_stock')} 
  />
  <StatusButton 
    label={t('status_low')}       // ← Uses translation key
    active={status === 'low'} 
    color={colors.status.low}
    onPress={() => setStatus('low')} 
  />
  <StatusButton 
    label={t('status_out')}       // ← Uses translation key
    active={status === 'out'} 
    color={colors.status.out}
    onPress={() => setStatus('out')} 
  />
</View>
```

### What's NOT Automated in Slice 1

- ❌ No "Add to shopping list?" prompt (no shopping list yet)
- ❌ No visual filtering by status (just show all items)
- ❌ No swipe gestures (tap to edit instead)

---

## 9. i18n Architecture (Ready from Day One)

### Principle
- **English-first in visible UI**: Only English content populated in Slice 1
- **i18n-ready in architecture**: All user-facing text uses `t('key')` pattern
- **Language-agnostic internal values**: Database stores `in_stock`, `dairy`, `fridge` — never translated strings

### Slice 1 i18n Files

```tsx
// lib/i18n/en.ts — Populated in Slice 1
export const en = {
  // Navigation
  nav_pantry: 'Pantry',
  nav_settings: 'Settings',
  
  // Auth
  auth_login: 'Sign In',
  auth_register: 'Create Account',
  auth_logout: 'Sign Out',
  auth_email: 'Email',
  auth_password: 'Password',
  auth_name: 'Name',
  auth_no_account: "Don't have an account?",
  auth_have_account: 'Already have an account?',
  
  // Status
  status_in_stock: 'In Stock',
  status_low: 'Low',
  status_out: 'Out',
  
  // Categories (language-agnostic keys, translated display)
  cat_dairy: 'Dairy',
  cat_grains: 'Grains',
  cat_produce: 'Produce',
  cat_protein: 'Protein',
  cat_canned: 'Canned',
  cat_frozen: 'Frozen',
  cat_beverages: 'Beverages',
  cat_snacks: 'Snacks',
  cat_condiments: 'Condiments',
  cat_cleaning: 'Cleaning',
  cat_personal: 'Personal',
  cat_other: 'Other',
  
  // Locations
  loc_fridge: 'Fridge',
  loc_freezer: 'Freezer',
  loc_pantry: 'Pantry',
  loc_counter: 'Counter',
  loc_cabinet: 'Cabinet',
  loc_other: 'Other',
  
  // Items
  item_name: 'Name',
  item_category: 'Category',
  item_location: 'Location',
  item_add: 'Add Item',
  item_edit: 'Edit Item',
  item_save: 'Save',
  item_delete: 'Delete',
  item_delete_confirm: 'Delete this item?',
  
  // Empty state
  empty_pantry_title: 'Your pantry is empty',
  empty_pantry_subtitle: 'Add your first item to get started',
  
  // Common
  common_cancel: 'Cancel',
  common_save: 'Save',
  common_delete: 'Delete',
  common_yes: 'Yes',
  common_no: 'No',
  
  // Errors
  err_required: 'This field is required',
  err_login_failed: 'Invalid email or password',
  err_register_failed: 'Could not create account',
  err_network: 'Check your internet connection',
};

export type TranslationKey = keyof typeof en;
```

```tsx
// lib/i18n/de.ts — Stub for Slice 1, populated later
import { en } from './en';

// German translations - to be filled in Slice 2 or 3
// For now, falls back to English for any missing keys
export const de: Record<string, string> = {
  // Stub - add translations later
  // nav_pantry: 'Vorrat',
  // nav_settings: 'Einstellungen',
  // ...
};
```

```tsx
// lib/i18n/index.tsx — Provider + Hook
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, TranslationKey } from './en';
import { de } from './de';

type Locale = 'en' | 'de';

const translations: Record<Locale, Record<string, string>> = { en, de };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  
  useEffect(() => {
    AsyncStorage.getItem('user_language').then((saved) => {
      if (saved === 'en' || saved === 'de') {
        setLocaleState(saved);
      }
    });
  }, []);
  
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    AsyncStorage.setItem('user_language', newLocale);
  }, []);
  
  const t = useCallback((key: string): string => {
    // Try current locale, fall back to English, then return key
    return translations[locale][key] ?? translations['en'][key] ?? key;
  }, [locale]);
  
  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
}
```

### Usage Pattern in Components

```tsx
// Example: Login screen
import { useTranslation } from '@/lib/i18n';

export default function LoginScreen() {
  const { t } = useTranslation();
  
  return (
    <View>
      <Text style={styles.title}>{t('auth_login')}</Text>
      <Input 
        label={t('auth_email')} 
        placeholder={t('auth_email')}
        // ...
      />
      <Input 
        label={t('auth_password')} 
        placeholder={t('auth_password')}
        // ...
      />
      <Button onPress={handleLogin}>
        {t('auth_login')}
      </Button>
    </View>
  );
}
```

### Category/Location Picker Pattern

```tsx
// Categories use language-agnostic keys internally
const CATEGORIES = ['dairy', 'grains', 'produce', 'protein', 'canned', 'frozen', 'beverages', 'snacks', 'condiments', 'cleaning', 'personal', 'other'];

// Display uses translation
<Picker selectedValue={category} onValueChange={setCategory}>
  {CATEGORIES.map((cat) => (
    <Picker.Item 
      key={cat} 
      value={cat}                    // Store: 'dairy'
      label={t(`cat_${cat}`)}        // Display: 'Dairy' or 'Milchprodukte'
    />
  ))}
</Picker>
```

---

## 10. Manual Handling (First Slice)

| Feature | Automated Later | Manual for Now |
|---------|-----------------|----------------|
| Shopping list sync | Slice 2 | User remembers what's low |
| Status filters | Slice 2 | User scrolls through all items |
| Category filters | Slice 2 | User scrolls through all items |
| Household sharing | Slice 3 | Single user only |
| Item limit check | Slice 4 | No limit in Slice 1 |
| Profile editing | Slice 3 | Name set at registration only |
| Language switching UI | Slice 2/3 | Hardcoded to English (but architecture ready) |
| Empty state art | After basics | Simple text message |

---

## 11. Step-by-Step Build Order

### Day 1: Supabase + Auth + i18n Foundation

```
□ Step 1: Create Supabase project
  - Go to supabase.com → New Project
  - Note: Project URL + Anon Key

□ Step 2: Run migration
  - Supabase Dashboard → SQL Editor
  - Paste 00001_first_slice.sql
  - Run

□ Step 3: Verify triggers
  - Auth → Users → Create test user manually
  - Check: profiles table has row
  - Check: pantry_households has row
  - Check: pantry_household_members has row
  - Delete test user when done

□ Step 4: Create Expo project
  npx create-expo-app pantry-flow --template expo-template-blank-typescript
  cd pantry-flow

□ Step 5: Install dependencies
  npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
  npx expo install expo-router expo-linking expo-constants
  npx expo install @expo/vector-icons

□ Step 6: Create lib/supabase.ts
  - Initialize client with URL + anon key
  - Configure AsyncStorage for session persistence

□ Step 7: Create lib/i18n/ (i18n-ready from day one)
  - lib/i18n/en.ts (English translations)
  - lib/i18n/de.ts (empty stub, structure only)
  - lib/i18n/index.tsx (I18nProvider + useTranslation hook)

□ Step 8: Create lib/auth.tsx
  - AuthProvider with user/session/loading state
  - signIn, signUp, signOut functions
  - useAuth hook

□ Step 9: Create lib/theme.ts
  - Color tokens (brand, status, text, background)
  - Spacing, typography, border radii
```

### Day 2: Auth Screens + Navigation (Using i18n)

```
□ Step 10: Set up Expo Router
  - Create app/_layout.tsx (root)
  - Wrap with I18nProvider → AuthProvider
  - Create app/index.tsx (redirect)

□ Step 11: Create (auth) screens with t() calls
  - app/(auth)/_layout.tsx (stack)
  - app/(auth)/login.tsx — all text via t('key')
  - app/(auth)/register.tsx — all text via t('key')

□ Step 12: Test auth flow
  - Register new user
  - Check Supabase: user + profile + household created
  - Logout
  - Login again
  - Verify redirect works

□ Step 13: Create (tabs) layout with t() calls
  - app/(tabs)/_layout.tsx (2 tabs, labels via t())
  - app/(tabs)/index.tsx (Pantry stub)
  - app/(tabs)/settings.tsx (Logout button only)
```

### Day 3: Pantry List + Add Item (Using i18n)

```
□ Step 14: Create useHousehold hook
  - Fetch user's household_id on mount
  - Store in context or return from hook

□ Step 15: Create usePantryItems hook
  - fetchItems(householdId)
  - addItem(item)
  - updateItem(id, updates)
  - deleteItem(id)

□ Step 16: Build Pantry list screen with t() calls
  - Fetch items on mount
  - FlatList with basic item rows
  - Show name + status badge (badge label via t())
  - FAB button to add item

□ Step 17: Create add-item modal with t() calls
  - app/add-item.tsx
  - Form: name (required), category (picker with t()), location (picker with t())
  - Save button → calls addItem → closes modal
  - Cancel button → closes modal

□ Step 18: Test add flow
  - Open modal → add item → see it in list
  - Check Supabase: row created with language-agnostic category/location
```

### Day 4: Edit Item + Status + Delete (Using i18n)

```
□ Step 19: Create edit-item modal with t() calls
  - app/edit-item/[id].tsx
  - Load item data on mount
  - Form: name, category, location (pickers with t())
  - Status selector (3 buttons, labels via t())
  - Save button → calls updateItem
  - Delete button → calls deleteItem with confirmation (via t())

□ Step 20: Wire up item tap
  - Tap item in list → navigate to /edit-item/[id]

□ Step 21: Add StatusBadge component
  - Shows colored badge based on status
  - Label via t(`status_${status}`)
  - Used in list items

□ Step 22: Test full CRUD
  - Add item ✓
  - View in list ✓
  - Edit item ✓
  - Change status ✓
  - Delete item ✓
```

### Day 5: Polish + Empty State + Basic Styling

```
□ Step 23: Add empty state with t() calls
  - When no items: show message + add button
  - Title: t('empty_pantry_title')
  - Subtitle: t('empty_pantry_subtitle')

□ Step 24: Basic styling
  - Apply color tokens (sage green, etc.)
  - Card styling for items
  - Button styling
  - Form field styling

□ Step 25: Error handling with t() calls
  - Show error messages via t('err_*')
  - Loading states on buttons

□ Step 26: Final testing
  - Fresh install test
  - Register → add items → edit → delete → logout → login
  - Verify data persists
  - Verify no hardcoded strings (all via t())

□ Step 27: Commit + Document
  - Git commit: "Slice 1: Auth + Pantry CRUD + i18n-Ready"
  - Update README with setup instructions
```

---

## Slice 1 Deliverable Checklist

At the end of Slice 1, you should have:

- [x] Supabase project with 4 tables + triggers + RLS
- [x] Working register/login/logout
- [x] Auto-created profile + household on signup
- [x] Pantry list showing all items
- [x] Add item modal (name, category, location)
- [x] Edit item modal with status selector
- [x] Delete item with confirmation
- [x] Status badges (in_stock/low/out)
- [x] 2-tab navigation (Pantry, Settings stub)
- [x] Basic styling with color tokens
- [x] **i18n provider + useTranslation hook**
- [x] **All user-facing text via t('key')**
- [x] **Language-agnostic internal identifiers**
- [x] **English translations populated**
- [x] **German stub file ready**

**What you DON'T have yet:**
- Shopping list
- Household sharing
- Premium limits
- Filters
- German translations (structure ready, content later)
- Language switching UI
- Fancy empty states
- Pull-to-refresh

---

## What's Next (Slice 2)

After Slice 1 is working:

1. Add `pantry_shopping_items` table
2. Add Shopping tab (3 tabs now)
3. Add "Add to shopping list?" prompt when status changes to low/out
4. Shopping list screen with check-off
5. Category/status filters on Pantry screen
6. **Populate German translations** (de.ts)
7. **Add language switcher in Settings**

---

## File Structure After Slice 1

```
/pantry-flow/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx          # Pantry
│   │   └── settings.tsx       # Logout only
│   ├── add-item.tsx
│   └── edit-item/
│       └── [id].tsx
├── components/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── StatusBadge.tsx
│   ├── PantryItem.tsx
│   └── EmptyState.tsx
├── hooks/
│   ├── useHousehold.ts
│   └── usePantryItems.ts
├── lib/
│   ├── supabase.ts
│   ├── auth.tsx
│   ├── theme.ts
│   └── i18n/
│       ├── en.ts              # ← English (populated)
│       ├── de.ts              # ← German (stub)
│       └── index.tsx          # ← Provider + hook
├── app.json
├── package.json
└── tsconfig.json
```

**~23 files total** for a working, i18n-ready vertical slice.

---

## Key i18n Rules for Slice 1

| Rule | Example |
|------|---------|
| No hardcoded user-facing strings | ❌ `"Sign In"` → ✅ `t('auth_login')` |
| Language-agnostic DB values | Store: `dairy`, `fridge`, `in_stock` |
| Translated display values | Display: `t('cat_dairy')` → "Dairy" |
| Flat key-value structure | `cat_dairy: 'Dairy'` not nested |
| Fallback to English | If German missing, shows English |
| Provider wraps app | `I18nProvider` at root `_layout.tsx` |

---

*This plan is intentionally minimal but i18n-ready. German content can be added without any refactoring — just populate de.ts.*
