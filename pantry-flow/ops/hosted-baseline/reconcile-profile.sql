-- One-time baseline repair, NOT migration 00004 and NOT permission to execute.
-- Target must be selected explicitly by the separately approved CLI command.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $reconcile_profile$
DECLARE
  canonical_sql constant text := $canonical$CREATE OR REPLACE FUNCTION public.handle_new_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
$canonical$;
  expected_legacy text;
  actual_definition text;
  function_oid oid;
  owner_before oid;
  acl_before aclitem[];
  acl_entries text[];
  versions text[];
  names text[];
BEGIN
  IF current_setting('server_version_num')::int / 10000 <> 17 THEN
    RAISE EXCEPTION 'Expected PostgreSQL major 17; stop';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'Expected adopted baseline ledger; stop';
  END IF;
  SELECT array_agg(version ORDER BY version), array_agg(name ORDER BY version)
    INTO versions, names FROM supabase_migrations.schema_migrations;
  IF versions IS DISTINCT FROM ARRAY['00001','00002','00003']::text[]
     OR names IS DISTINCT FROM ARRAY['first_slice','review_hardening','strict_duplicate_prevention']::text[] THEN
    RAISE EXCEPTION 'Expected exactly baseline versions 00001-00003; stop';
  END IF;
  IF to_regclass('public.pantry_shopping_items') IS NOT NULL THEN
    RAISE EXCEPTION 'Shopping schema unexpectedly exists; stop';
  END IF;
  IF (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
      WHERE a.attrelid='public.pantry_households'::regclass AND a.attname='name')
      IS DISTINCT FROM '''My Household''::text' THEN
    RAISE EXCEPTION 'Household default changed; stop';
  END IF;

  function_oid := to_regprocedure('public.handle_new_profile()');
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'Expected existing profile trigger function; stop';
  END IF;
  SELECT p.proowner,p.proacl INTO owner_before,acl_before
    FROM pg_proc p WHERE p.oid=function_oid;
  IF pg_get_userbyid(owner_before) <> 'postgres' THEN
    RAISE EXCEPTION 'Profile function owner changed; stop';
  END IF;
  SELECT array_agg(x::text ORDER BY x::text COLLATE "C") INTO acl_entries
    FROM unnest(acl_before) x;
  IF acl_entries IS DISTINCT FROM ARRAY['=X/postgres','anon=X/postgres',
      'authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[] THEN
    RAISE EXCEPTION 'Profile function grants changed; stop';
  END IF;

  -- Hosted's reviewed GraphQL hook compares DDL object OIDs with pg_graphql.
  -- Replacing this existing function retains its OID; rule out an OID collision.
  IF EXISTS (SELECT 1 FROM pg_extension e
      WHERE e.extname='pg_graphql' AND e.oid=function_oid) THEN
    RAISE EXCEPTION 'Unexpected GraphQL extension OID collision; stop';
  END IF;

  expected_legacy := replace(replace(canonical_sql,E'\r\n',E'\n'),
    E'INSERT INTO public.pantry_households (owner_id)\n  VALUES (NEW.id)',
    E'INSERT INTO public.pantry_households (owner_id, name)\n  VALUES (NEW.id, ''My Household'')');
  actual_definition := replace(pg_get_functiondef(function_oid),E'\r\n',E'\n');
  IF actual_definition = replace(canonical_sql,E'\r\n',E'\n') THEN
    RAISE EXCEPTION 'Profile function already canonical; inspect, do not retry';
  END IF;
  IF actual_definition IS DISTINCT FROM expected_legacy THEN
    RAISE EXCEPTION 'Expected only the reviewed legacy profile definition; stop';
  END IF;

  -- Fixed reviewed SQL, never SQL obtained from the database or user input.
  EXECUTE canonical_sql;

  IF to_regprocedure('public.handle_new_profile()')::oid IS DISTINCT FROM function_oid
     OR replace(pg_get_functiondef(function_oid),E'\r\n',E'\n')
        IS DISTINCT FROM replace(canonical_sql,E'\r\n',E'\n')
     OR (SELECT p.proowner FROM pg_proc p WHERE p.oid=function_oid) IS DISTINCT FROM owner_before
     OR (SELECT p.proacl FROM pg_proc p WHERE p.oid=function_oid) IS DISTINCT FROM acl_before THEN
    RAISE EXCEPTION 'Profile reconciliation postcondition failed; rollback';
  END IF;
END;
$reconcile_profile$;

COMMIT;
