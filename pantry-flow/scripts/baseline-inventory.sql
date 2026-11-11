-- Supplement catalog-snapshot.sql with extra-object detection. Catalogs only.
BEGIN READ ONLY;
SELECT jsonb_build_object(
  'server_version', current_setting('server_version'),
  'migration_ledger_exists', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
  'relations', (SELECT jsonb_agg(jsonb_build_object(
    'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
    'definition',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END
  ) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')),
  'routines', (SELECT jsonb_agg(jsonb_build_object(
    'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
    'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid)
  ) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    AND p.prokind IN ('f','p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')),
  'types', (SELECT jsonb_agg(jsonb_build_object('name',t.typname,'kind',t.typtype)
    ORDER BY t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typtype IN ('e','d')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')),
  'triggers', (SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,
    'table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid,true),
    'enabled',t.tgenabled) ORDER BY n.nspname,c.relname,t.tgname)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal
    AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users'))
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_trigger'::regclass AND d.objid=t.oid AND d.deptype='e')),
  'event_triggers', (SELECT jsonb_agg(jsonb_build_object('name',e.evtname,
    'event',e.evtevent,'enabled',e.evtenabled,'tags',e.evttags,
    'owner',pg_get_userbyid(e.evtowner),'function',p.proname)
    ORDER BY e.evtname) FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  'uuid_extension', (SELECT jsonb_build_object('name',e.extname,'version',e.extversion,
    'schema',n.nspname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='uuid-ossp')
) AS snapshot;
COMMIT;
