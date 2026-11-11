-- Run only after ledger existence is confirmed. No application rows selected.
BEGIN READ ONLY;
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
COMMIT;
