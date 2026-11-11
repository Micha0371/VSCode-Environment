-- Slice 2 D1/D2/D4: one open-name namespace per household; retained completion.
-- Local development only until this exact migration receives hosted approval.
-- Hosted `db push` runs without the extensions schema on search_path, so this
-- file uses core gen_random_uuid() instead of uuid-ossp's uuid_generate_v4().
BEGIN;

ALTER TABLE public.pantry_items
  ADD CONSTRAINT pantry_items_household_id_id_key UNIQUE (household_id, id);

CREATE TABLE public.pantry_shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.pantry_households(id) ON DELETE CASCADE,
  pantry_item_id uuid,
  name text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopping_name_valid CHECK (
    char_length(name) BETWEEN 1 AND 120
    AND name = public.pantry_trim_item_name(name) AND name <> ''
  ),
  CONSTRAINT shopping_completion_valid CHECK (
    (is_checked AND completed_at IS NOT NULL)
    OR (NOT is_checked AND completed_at IS NULL)
  ),
  CONSTRAINT shopping_pantry_same_household_fkey
    FOREIGN KEY (household_id, pantry_item_id)
    REFERENCES public.pantry_items(household_id, id)
    ON DELETE SET NULL (pantry_item_id)
);

CREATE FUNCTION public.prepare_shopping_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.name = public.pantry_trim_item_name(NEW.name);
  NEW.updated_at = now();
  IF TG_OP = 'INSERT' THEN
    NEW.completed_at = CASE WHEN NEW.is_checked THEN now() ELSE NULL END;
  ELSIF NEW.is_checked IS DISTINCT FROM OLD.is_checked THEN
    NEW.completed_at = CASE WHEN NEW.is_checked THEN now() ELSE NULL END;
  ELSE
    NEW.completed_at = OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_shopping_item() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER shopping_item_prepare BEFORE INSERT OR UPDATE
  ON public.pantry_shopping_items FOR EACH ROW
  EXECUTE FUNCTION public.prepare_shopping_item();

CREATE UNIQUE INDEX shopping_items_household_open_name_key
  ON public.pantry_shopping_items (household_id, lower(public.pantry_trim_item_name(name)))
  WHERE NOT is_checked;
CREATE INDEX shopping_items_household_idx ON public.pantry_shopping_items(household_id);

ALTER TABLE public.pantry_shopping_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pantry_shopping_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.pantry_shopping_items TO authenticated;
GRANT INSERT (household_id, pantry_item_id, name, is_checked, created_by)
  ON public.pantry_shopping_items TO authenticated;
GRANT UPDATE (pantry_item_id, name, is_checked)
  ON public.pantry_shopping_items TO authenticated;

CREATE POLICY shopping_select_member ON public.pantry_shopping_items
  FOR SELECT TO authenticated USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY shopping_insert_member ON public.pantry_shopping_items
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND household_id IN (
      SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY shopping_update_member ON public.pantry_shopping_items
  FOR UPDATE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );
CREATE POLICY shopping_delete_member ON public.pantry_shopping_items
  FOR DELETE TO authenticated USING (
    household_id IN (SELECT household_id FROM public.pantry_household_members WHERE user_id = auth.uid())
  );

COMMIT;
