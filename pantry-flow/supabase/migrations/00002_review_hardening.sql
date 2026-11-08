-- Apply after 00001, including on existing installations. Atomic: invalid legacy
-- records must be corrected explicitly before this migration can complete.
BEGIN;

REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name, language) ON public.profiles TO authenticated;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_name_length CHECK (char_length(name) <= 100),
  ADD CONSTRAINT profiles_language_valid CHECK (language IN ('en', 'de'));

ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.handle_new_profile() SET search_path = '';

-- Keep inventory when its original author is deleted. Creation still requires
-- the caller's identity; only the FK action may clear the attribution later.
ALTER TABLE public.pantry_items
  DROP CONSTRAINT pantry_items_created_by_fkey,
  ALTER COLUMN created_by DROP NOT NULL,
  ADD CONSTRAINT pantry_items_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT pantry_items_name_valid CHECK (
    char_length(name) BETWEEN 1 AND 120 AND name ~ '[^[:space:]]'
  ),
  ADD CONSTRAINT pantry_items_category_valid CHECK (category IN (
    'dairy', 'grains', 'produce', 'protein', 'canned', 'frozen',
    'beverages', 'snacks', 'condiments', 'cleaning', 'personal', 'other'
  )),
  ADD CONSTRAINT pantry_items_location_valid CHECK (location IN (
    'fridge', 'freezer', 'pantry', 'counter', 'cabinet', 'other'
  ));

DROP POLICY items_insert_member ON public.pantry_items;
CREATE POLICY items_insert_member ON public.pantry_items
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND household_id IN (
      SELECT household_id FROM public.pantry_household_members
      WHERE user_id = auth.uid()
    )
  );

-- Clients cannot rewrite identity, ownership, attribution, or creation time.
REVOKE INSERT, UPDATE ON public.pantry_items FROM PUBLIC, anon, authenticated;
GRANT INSERT (household_id, name, status, category, location, created_by)
  ON public.pantry_items TO authenticated;
GRANT UPDATE (name, status, category, location)
  ON public.pantry_items TO authenticated;

CREATE FUNCTION public.set_pantry_item_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER pantry_items_updated_at BEFORE UPDATE ON public.pantry_items
  FOR EACH ROW EXECUTE FUNCTION public.set_pantry_item_updated_at();

COMMIT;
