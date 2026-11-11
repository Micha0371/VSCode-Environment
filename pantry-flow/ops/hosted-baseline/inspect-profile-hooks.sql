-- Targeted read-only inspection for the function-reconciliation change window.
BEGIN READ ONLY;
SELECT jsonb_agg(jsonb_build_object(
  'schema',n.nspname,'name',p.proname,
  'arguments',pg_get_function_identity_arguments(p.oid),
  'owner',pg_get_userbyid(p.proowner),'proacl',to_jsonb(p.proacl),
  'definition',pg_get_functiondef(p.oid)
) ORDER BY n.nspname,p.proname) AS functions
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='extensions'
  AND p.proname IN ('grant_pg_graphql_access','pgrst_ddl_watch');
COMMIT;
