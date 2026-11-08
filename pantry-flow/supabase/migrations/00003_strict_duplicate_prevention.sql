-- Slice 1.1: household-scoped names, independent of category/location/status.
-- Existing conflicts require an explicit user decision. Never merge, rename,
-- overwrite, or delete legacy items to make this migration succeed.
BEGIN;

-- Match JavaScript String.trim() whitespace, including nonbreaking spaces.
-- Interior whitespace and the user's display capitalization are preserved.
CREATE FUNCTION public.pantry_trim_item_name(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.pantry_items
    GROUP BY household_id, lower(public.pantry_trim_item_name(name))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505',
      MESSAGE = 'Existing household items have duplicate normalized names. Resolve conflicts explicitly before applying Slice 1.1.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pantry_items
    WHERE name <> public.pantry_trim_item_name(name)
       OR public.pantry_trim_item_name(name) = ''
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Existing item names need whitespace cleanup. Review and normalize them explicitly before applying Slice 1.1.';
  END IF;
END;
$$;

CREATE FUNCTION public.normalize_pantry_item_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.name = public.pantry_trim_item_name(NEW.name);
  RETURN NEW;
END;
$$;
CREATE TRIGGER pantry_items_normalize_name
  BEFORE INSERT OR UPDATE OF name ON public.pantry_items
  FOR EACH ROW EXECUTE FUNCTION public.normalize_pantry_item_name();

ALTER TABLE public.pantry_items ADD CONSTRAINT pantry_items_name_trimmed
  CHECK (name = public.pantry_trim_item_name(name) AND name <> '');

-- PostgreSQL's unique index arbitrates concurrent writes, including renames.
CREATE UNIQUE INDEX pantry_items_household_normalized_name_key
  ON public.pantry_items (household_id, lower(public.pantry_trim_item_name(name)));

COMMIT;
