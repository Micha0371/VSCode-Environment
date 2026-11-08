-- ============================================
-- PANTRY FLOW — SLICE 1 MIGRATION
-- Profiles + Households + Members + Items
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------
-- 1. profiles
-- --------------------------------------------
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL DEFAULT '',
  language    text        NOT NULL DEFAULT 'en',
  is_premium  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------
-- 2. pantry_households
-- --------------------------------------------
CREATE TABLE public.pantry_households (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text        NOT NULL DEFAULT 'My Household',
  owner_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------
-- 3. pantry_household_members (one household per user)
-- --------------------------------------------
CREATE TABLE public.pantry_household_members (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid        NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'owner',
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- --------------------------------------------
-- 4. pantry_items (Slice 1 locked shape: 9 columns)
-- --------------------------------------------
CREATE TABLE public.pantry_items (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid        NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  status       text        NOT NULL DEFAULT 'in_stock'
               CHECK (status IN ('in_stock', 'low', 'out')),
  category     text        NOT NULL DEFAULT 'other',
  location     text        NOT NULL DEFAULT 'pantry',
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger 1: on auth user insert -> create profile
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

-- Trigger 2: on profile insert -> create household + owner membership
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

ALTER TABLE public.profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_households        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items             ENABLE ROW LEVEL SECURITY;

-- profiles: own profile only
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- households: visible via membership
CREATE POLICY "households_select_member" ON public.pantry_households
  FOR SELECT USING (
    id IN (
      SELECT household_id
      FROM public.pantry_household_members
      WHERE user_id = auth.uid()
    )
  );

-- members: own membership rows
CREATE POLICY "members_select_own" ON public.pantry_household_members
  FOR SELECT USING (user_id = auth.uid());

-- items: full CRUD for household members
CREATE POLICY "items_select_member" ON public.pantry_items
  FOR SELECT USING (
    household_id IN (
      SELECT household_id
      FROM public.pantry_household_members
      WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "items_insert_member" ON public.pantry_items
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id
      FROM public.pantry_household_members
      WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "items_update_member" ON public.pantry_items
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id
      FROM public.pantry_household_members
      WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "items_delete_member" ON public.pantry_items
  FOR DELETE USING (
    household_id IN (
      SELECT household_id
      FROM public.pantry_household_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_pantry_items_household    ON public.pantry_items(household_id);
CREATE INDEX idx_household_members_user    ON public.pantry_household_members(user_id);
