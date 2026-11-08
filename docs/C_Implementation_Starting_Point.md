# Pantry Flow — Implementation Starting Point

> **Aligned with**: Ecosystem Foundation Blueprint (Household_Bundle P0)
> **Target Stack**: Expo/React Native + Supabase
> **Version**: 1.1 MVP (Refined)

---

## 1. Project Structure: Reference vs Day-One

### Reference Architecture (Future Portfolio)

The Ecosystem Foundation Blueprint describes a monorepo structure for the full 4-app portfolio:

```
/portfolio-root/
├── packages/shared/     ← Shared utilities, theme, i18n, auth
├── apps/pantry-flow/    ← App 1
├── apps/household-hub/  ← App 2
├── apps/smart-cart/     ← App 3
├── apps/refill-tracker/ ← App 4
└── supabase/            ← Shared Supabase project
```

**This is a reference architecture**, not a mandatory day-one setup.

### Day-One Setup (Pantry Flow MVP)

For the first implementation, start with a **simpler Pantry Flow-focused structure**:

```
/pantry-flow/
├── app/                    # Expo Router file-based routing
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/
│   ├── (tabs)/
│   └── [modals]
├── components/             # Reusable UI components
├── hooks/                  # Custom hooks
├── lib/
│   ├── supabase.ts        # Supabase client
│   ├── i18n/              # Translations
│   └── theme.ts           # Design tokens
├── types/                  # TypeScript types
├── app.json
├── package.json
└── tsconfig.json
```

This structure:
- Keeps everything in one project for simplicity
- Can be refactored into the monorepo pattern later
- Follows the same conventions as the reference architecture
- Remains compatible with future shared-package extraction

---

## 2. Route and Navigation Structure

### Expo Router File Structure
```
app/
├── _layout.tsx          # Root: providers wrapper
├── index.tsx            # Entry: auth-based redirect
├── (auth)/
│   ├── _layout.tsx      # Stack navigator (no tabs)
│   ├── login.tsx        # Login screen
│   └── register.tsx     # Registration screen
├── (tabs)/
│   ├── _layout.tsx      # Bottom tab navigator
│   ├── index.tsx        # Pantry (Tab 1)
│   ├── shopping.tsx     # Shopping List (Tab 2)
│   └── settings.tsx     # Settings (Tab 3)
├── add-item.tsx         # Full-screen modal
├── edit-item/
│   └── [id].tsx         # Dynamic route modal
├── invite.tsx           # Full-screen modal
└── premium.tsx          # Full-screen modal
```

### Root Layout (`_layout.tsx`)
```tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-item/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
          <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </I18nProvider>
  );
}
```

### Entry Redirect (`index.tsx`)
```tsx
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export default function Index() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingIndicator fullScreen />;
  }
  
  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}
```

### Tabs Layout (`(tabs)/_layout.tsx`)
```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/lib/i18n';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav_pantry'),
          tabBarIcon: ({ focused, color }) => (
            <Ionicons 
              name={focused ? 'cube' : 'cube-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: t('nav_shopping'),
          tabBarIcon: ({ focused, color }) => (
            <Ionicons 
              name={focused ? 'cart' : 'cart-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav_settings'),
          tabBarIcon: ({ focused, color }) => (
            <Ionicons 
              name={focused ? 'settings' : 'settings-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## 3. Recommended Component Structure

### Core Components (`/components/`)

| Component | Purpose | Props |
|-----------|---------|-------|
| `Button` | Primary action button | `variant`, `size`, `loading`, `disabled`, `onPress` |
| `Card` | Content container | `children`, `padding` |
| `Input` | Text input field | `label`, `error`, `placeholder` |
| `StatusBadge` | Item status indicator | `status` (in_stock, low, out) |
| `EmptyState` | Empty list placeholder | `icon`, `title`, `subtitle`, `actionLabel`, `onAction` |
| `LoadingIndicator` | Spinner | `size`, `fullScreen` |

### App-Specific Components

| Component | Purpose |
|-----------|---------|
| `PantryItem` | Single item row with status toggle |
| `ShoppingItem` | Checkable shopping list item |
| `CategoryFilter` | Horizontal filter chips |
| `StatusFilter` | Filter by in_stock/low/out |
| `ItemForm` | Shared form for add/edit |
| `HouseholdMember` | Member row in settings |
| `InvitationBanner` | Pending invitation prompt |

### Component Example: StatusBadge
```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';

type Status = 'in_stock' | 'low' | 'out';

interface StatusBadgeProps {
  status: Status;
}

const statusColors: Record<Status, string> = {
  in_stock: colors.status.in_stock,
  low: colors.status.low,
  out: colors.status.out,
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();
  
  return (
    <View 
      style={[styles.badge, { backgroundColor: statusColors[status] }]}
      testID={`status-badge-${status}`}
    >
      <Text style={styles.text}>{t(`status_${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
```

---

## 4. Supabase Setup

### Migration Files
```
supabase/migrations/
├── 00001_profiles.sql           # Shared profiles + trigger
├── 00002_pantry_households.sql  # Households + members + trigger
├── 00003_pantry_items.sql       # Items table + RLS
├── 00004_pantry_shopping.sql    # Shopping table + RLS
└── 00005_pantry_invitations.sql # Invitations table + RLS
```

See PRD Section 9 for complete SQL schema.

### Key Schema Points

**Item Status Model** (simplified for household UX):
```sql
status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low', 'out'))
```

**One Household Per User** (enforced by unique constraint):
```sql
UNIQUE(user_id) -- On pantry_household_members
```

**Optional Fields** (available but not required):
```sql
quantity numeric DEFAULT NULL,
unit text DEFAULT NULL,
expiry_date date DEFAULT NULL,
```

---

## 5. Authentication Flow

### Supabase Auth Integration

```tsx
// lib/auth.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### Auth Flow Summary
```
1. App launch → Supabase SDK restores session from AsyncStorage
2. onAuthStateChange fires → if session → navigate to (tabs)
3. No session → navigate to (auth)/login
4. Login → supabase.auth.signInWithPassword()
5. Register → supabase.auth.signUp() → triggers create profile → triggers create household
6. Logout → supabase.auth.signOut() → navigate to (auth)/login
```

---

## 6. Household Logic

### One Household Per User

Each user belongs to exactly one household. The schema enforces this with `UNIQUE(user_id)` on `pantry_household_members`.

### useHousehold Hook

```tsx
// hooks/useHousehold.ts
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export function useHousehold() {
  const { user } = useAuth();
  
  const getHousehold = async () => {
    const { data, error } = await supabase
      .from('pantry_household_members')
      .select(`
        household_id,
        role,
        household:pantry_households(id, name, owner_id)
      `)
      .eq('user_id', user?.id)
      .single();
    
    if (error) throw error;
    return data;
  };
  
  const getMembers = async (householdId: string) => {
    const { data, error } = await supabase
      .from('pantry_household_members')
      .select(`
        id, role, joined_at,
        user:profiles(id, name)
      `)
      .eq('household_id', householdId);
    
    if (error) throw error;
    return data;
  };
  
  const inviteMember = async (householdId: string, email: string) => {
    const { data, error } = await supabase
      .from('pantry_invitations')
      .insert({
        household_id: householdId,
        email: email.toLowerCase(),
        invited_by: user?.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  };
  
  // Accept invitation: leave current household, join new one
  const acceptInvitation = async (invitationId: string) => {
    const { data: invitation } = await supabase
      .from('pantry_invitations')
      .select('household_id')
      .eq('id', invitationId)
      .single();
    
    if (!invitation) throw new Error('Invitation not found');
    
    // Delete current membership (leaves old household)
    await supabase
      .from('pantry_household_members')
      .delete()
      .eq('user_id', user?.id);
    
    // Join new household
    await supabase
      .from('pantry_household_members')
      .insert({
        household_id: invitation.household_id,
        user_id: user?.id,
        role: 'member',
      });
    
    // Mark invitation accepted
    await supabase
      .from('pantry_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId);
  };
  
  const removeMember = async (memberId: string) => {
    await supabase.from('pantry_household_members').delete().eq('id', memberId);
  };
  
  const leaveHousehold = async () => {
    // For members only (owners must transfer first)
    await supabase
      .from('pantry_household_members')
      .delete()
      .eq('user_id', user?.id);
    
    // Create new personal household
    const { data: newHousehold } = await supabase
      .from('pantry_households')
      .insert({ owner_id: user?.id, name: 'My Household' })
      .select()
      .single();
    
    await supabase
      .from('pantry_household_members')
      .insert({ household_id: newHousehold.id, user_id: user?.id, role: 'owner' });
  };
  
  return {
    getHousehold,
    getMembers,
    inviteMember,
    acceptInvitation,
    removeMember,
    leaveHousehold,
  };
}
```

---

## 7. Pantry ↔ Shopping List Sync

### Implementation Rules (Simple and Predictable)

```tsx
// hooks/usePantryItems.ts
export function usePantryItems(householdId: string) {
  
  const updateItemStatus = async (
    itemId: string, 
    newStatus: 'in_stock' | 'low' | 'out'
  ) => {
    await supabase
      .from('pantry_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    
    // Return the new status so UI can prompt "Add to shopping list?"
    return { itemId, newStatus };
  };
  
  // Separate action: user explicitly adds to shopping list
  const addToShoppingList = async (item: PantryItem) => {
    await supabase
      .from('pantry_shopping_items')
      .insert({
        household_id: item.household_id,
        pantry_item_id: item.id,
        name: item.name,
        added_by: user?.id,
      });
  };
  
  // ...
}
```

### UI Flow Example
```tsx
// When user changes status to 'low' or 'out'
const handleStatusChange = async (item, newStatus) => {
  await updateItemStatus(item.id, newStatus);
  
  if (newStatus === 'low' || newStatus === 'out') {
    // Show prompt, don't auto-add
    Alert.alert(
      t('prompt_add_to_shopping_title'),
      t('prompt_add_to_shopping_message', { name: item.name }),
      [
        { text: t('common_no'), style: 'cancel' },
        { text: t('common_yes'), onPress: () => addToShoppingList(item) },
      ]
    );
  }
};
```

### What Happens When Shopping Item is Checked
```tsx
const checkOffShoppingItem = async (itemId: string) => {
  // Simply remove from shopping list
  await supabase
    .from('pantry_shopping_items')
    .delete()
    .eq('id', itemId);
  
  // Pantry status is NOT automatically updated
  // User can manually update pantry item status if desired
};
```

---

## 8. Premium Gating (Phased Approach)

### Phase 1: Soft UI Enforcement (MVP)

```tsx
// hooks/usePremium.ts
export function usePremium() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setLoading(false);
      return;
    }
    
    supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setIsPremium(data?.is_premium ?? false);
        setLoading(false);
      });
  }, [user]);
  
  return { isPremium, loading };
}
```

### Item Limit Check (Application Layer)
```tsx
// hooks/usePantryItems.ts
const FREE_ITEM_LIMIT = 75;

export function usePantryItems(householdId: string) {
  const { isPremium } = usePremium();
  
  const getItemCount = async () => {
    const { count } = await supabase
      .from('pantry_items')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId);
    return count ?? 0;
  };
  
  const canAddItem = async () => {
    if (isPremium) return { allowed: true };
    const count = await getItemCount();
    return { 
      allowed: count < FREE_ITEM_LIMIT,
      count,
      limit: FREE_ITEM_LIMIT,
    };
  };
  
  const addItem = async (item: NewPantryItem) => {
    const { allowed, count, limit } = await canAddItem();
    
    if (!allowed) {
      // Don't throw, return status for UI to handle gracefully
      return { success: false, reason: 'LIMIT_REACHED', count, limit };
    }
    
    const { data, error } = await supabase
      .from('pantry_items')
      .insert(item)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  };
  
  // ...
}
```

### UI Handling
```tsx
const handleAddItem = async (formData) => {
  const result = await addItem(formData);
  
  if (!result.success && result.reason === 'LIMIT_REACHED') {
    // Show upgrade prompt
    Alert.alert(
      t('premium_limit_title'),
      t('premium_limit_message', { count: result.count, limit: result.limit }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        { text: t('btn_upgrade'), onPress: () => router.push('/premium') },
      ]
    );
    return;
  }
  
  // Success path
  router.back();
};
```

### Phase 2: Database Enforcement (Post-MVP)
Once subscription flow is stable, add database trigger as a safety net:
```sql
-- Add this LATER, not in MVP
CREATE TRIGGER enforce_item_limit
  BEFORE INSERT ON public.pantry_items
  FOR EACH ROW EXECUTE FUNCTION public.check_item_limit();
```

---

## 9. i18n Setup

### Locale Files

```tsx
// lib/i18n/en.ts
export const en = {
  // Common
  common_save: 'Save',
  common_cancel: 'Cancel',
  common_delete: 'Delete',
  common_yes: 'Yes',
  common_no: 'No',
  
  // Navigation
  nav_pantry: 'Pantry',
  nav_shopping: 'Shopping',
  nav_settings: 'Settings',
  
  // Item Status
  status_in_stock: 'In Stock',
  status_low: 'Low',
  status_out: 'Out',
  
  // Categories
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
  
  // Labels
  label_name: 'Name',
  label_category: 'Category',
  label_location: 'Location',
  label_email: 'Email',
  label_password: 'Password',
  
  // Buttons
  btn_add_item: 'Add Item',
  btn_login: 'Sign In',
  btn_register: 'Create Account',
  btn_logout: 'Sign Out',
  btn_invite: 'Invite Member',
  btn_upgrade: 'Upgrade to Premium',
  
  // Prompts
  prompt_add_to_shopping_title: 'Add to Shopping List?',
  prompt_add_to_shopping_message: 'Would you like to add {{name}} to your shopping list?',
  
  // Empty States
  empty_pantry_title: 'Your pantry is empty',
  empty_pantry_subtitle: 'Add your first item to get started',
  empty_shopping_title: 'Shopping list is empty',
  empty_shopping_subtitle: 'Items you need to buy will appear here',
  
  // Premium
  premium_limit_title: 'Item Limit Reached',
  premium_limit_message: 'You have {{count}} of {{limit}} items. Upgrade to Premium for unlimited items.',
  premium_title: 'Upgrade to Premium',
  premium_feature_unlimited: 'Unlimited pantry items',
  premium_feature_members: 'Up to 5 household members',
  
  // Household
  household_join_title: 'Join Household?',
  household_join_message: 'Joining this household will remove you from your current household. Continue?',
  
  // Onboarding
  onboard_welcome: 'Welcome to Pantry Flow',
  onboard_tagline: 'Know what you have. Buy what you need.',
  onboard_get_started: 'Get Started',
};

export type TranslationKey = keyof typeof en;
```

```tsx
// lib/i18n/de.ts
export const de: Record<string, string> = {
  // Common
  common_save: 'Speichern',
  common_cancel: 'Abbrechen',
  common_delete: 'Löschen',
  common_yes: 'Ja',
  common_no: 'Nein',
  
  // Navigation
  nav_pantry: 'Vorrat',
  nav_shopping: 'Einkaufen',
  nav_settings: 'Einstellungen',
  
  // Item Status
  status_in_stock: 'Vorrätig',
  status_low: 'Wenig',
  status_out: 'Leer',
  
  // Categories
  cat_dairy: 'Milchprodukte',
  cat_grains: 'Getreide',
  cat_produce: 'Obst & Gemüse',
  cat_protein: 'Protein',
  cat_canned: 'Konserven',
  cat_frozen: 'Tiefkühl',
  cat_beverages: 'Getränke',
  cat_snacks: 'Snacks',
  cat_condiments: 'Gewürze',
  cat_cleaning: 'Reinigung',
  cat_personal: 'Körperpflege',
  cat_other: 'Sonstiges',
  
  // ... (complete German translations)
  
  // Prompts
  prompt_add_to_shopping_title: 'Zur Einkaufsliste hinzufügen?',
  prompt_add_to_shopping_message: 'Möchtest du {{name}} zur Einkaufsliste hinzufügen?',
  
  // Household
  household_join_title: 'Haushalt beitreten?',
  household_join_message: 'Wenn du diesem Haushalt beitrittst, verlässt du deinen aktuellen Haushalt. Fortfahren?',
};
```

### i18n Provider
```tsx
// lib/i18n/index.tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, TranslationKey } from './en';
import { de } from './de';

type Locale = 'en' | 'de';
const translations: Record<Locale, Record<string, string>> = { en, de };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  
  useEffect(() => {
    AsyncStorage.getItem('user_language').then((saved) => {
      if (saved === 'en' || saved === 'de') setLocaleState(saved);
    });
  }, []);
  
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    AsyncStorage.setItem('user_language', newLocale);
  }, []);
  
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = translations[locale][key] ?? translations['en'][key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, String(v));
      });
    }
    return text;
  }, [locale]);
  
  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
}
```

---

## 10. Phased MVP Task List (Build Order)

### Phase 0: Foundation Setup
```
□ Create Supabase project
□ Configure environment (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)
□ Run database migrations
□ Verify RLS policies
□ Create project structure (/pantry-flow)
□ Create theme tokens (lib/theme.ts)
□ Create i18n files (lib/i18n/)
□ Create Supabase client (lib/supabase.ts)
□ Create AuthProvider + useAuth
□ Create base UI components
□ Set up Expo Router navigation
```

### Phase 1: Authentication
```
□ Login screen UI
□ Register screen UI
□ Wire up signIn/signUp
□ Handle auth errors with user-friendly messages
□ Session persistence verification
□ Auth-based routing
□ Profile + household auto-creation verification
```

### Phase 2: Core Pantry
```
□ Pantry dashboard screen
□ Empty pantry state
□ usePantryItems hook
□ useHousehold hook (get household_id)
□ PantryItem component with status badge
□ Add item modal (name required, category/location optional)
□ Edit item modal
□ Status toggle (in_stock → low → out)
□ Item list with FlatList
□ Pull-to-refresh
□ Category filter
□ Status filter
```

### Phase 3: Shopping List
```
□ Shopping list screen
□ useShoppingList hook
□ "Add to shopping list?" prompt when marking low/out
□ ShoppingItem component (checkable)
□ Check off item (removes from list)
□ Manual delete from shopping list
□ Manual add to shopping list
□ Empty state
```

### Phase 4: Household Sharing
```
□ Settings screen
□ Profile section (name, language)
□ Household section
□ Member list display
□ Invite screen
□ Send invitation
□ Pending invitation banner (for invitees)
□ Accept invitation (with leave-household confirmation)
□ Decline invitation
□ Remove member (owner only)
□ Leave household (creates new personal household)
```

### Phase 5: Premium & Polish
```
□ Premium modal screen
□ Item count display
□ Soft limit enforcement (75 items)
□ Upgrade prompts (gentle)
□ Member limit check (2 free)
□ Error handling polish
□ Loading states
□ Keyboard handling
□ Accessibility pass
```

### Phase 6: Testing & Launch
```
□ End-to-end testing
□ Performance check
□ German translation QA
□ App Store assets
□ Documentation
□ Soft launch
```

---

## 11. Expiry Tracking (Deferred)

### MVP: Data Ready, UI Deferred

The schema includes `expiry_date` as an optional field, but:
- No expiry input in add-item modal for MVP
- No expiry badges or filtering in MVP
- No expiry alerts in MVP

### Post-MVP Implementation Path
1. Add optional expiry date picker in edit-item modal
2. Show expiry badge on items with dates set
3. Premium: enable expiry-based sorting/alerts

---

## 12. Parts to Build from Scratch

Since no earlier implementation exists aligned with the refined PRD, build everything fresh:

| Category | Build Fresh |
|----------|-------------|
| **Database** | Supabase migrations, RLS policies, triggers |
| **Auth** | AuthProvider using Supabase Auth |
| **i18n** | I18nProvider, en.ts, de.ts |
| **Theme** | Design tokens per Blueprint |
| **Components** | Button, Card, Input, StatusBadge, EmptyState, etc. |
| **Navigation** | Expo Router (auth, tabs, modals) |
| **Screens** | All screens per PRD screen map |
| **Hooks** | usePantryItems, useShoppingList, useHousehold, usePremium |

---

## Summary

This implementation starting point provides:

1. ✅ **Day-one project structure** — Simple, Pantry Flow-focused (reference monorepo documented for future)
2. ✅ **Expo Router navigation** — 3-tab layout with modals
3. ✅ **Supabase schema** — Status-based items, one-household-per-user
4. ✅ **Auth flow** — Supabase Auth with auto-profile/household creation
5. ✅ **Simple sync rules** — Prompt-based, no automatic loops
6. ✅ **Household sharing** — Clear leave-then-join flow
7. ✅ **Soft premium gating** — UI-layer enforcement first
8. ✅ **i18n setup** — EN + DE with parameterized strings
9. ✅ **Phased task list** — Realistic build order
10. ✅ **Expiry deferred** — Schema ready, UI for later

**Next Step**: Create Supabase project and begin Phase 0 foundation tasks.

---

*This document is the implementation blueprint for Pantry Flow MVP. Reference the PRD for product decisions and the Ecosystem Foundation Blueprint for shared conventions.*
