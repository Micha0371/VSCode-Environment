BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);
SELECT is(current_setting('server_version_num')::int / 10000, 17,
  'Disposable PostgreSQL major matches the reviewed hosted major');
SELECT * FROM finish();
ROLLBACK;
