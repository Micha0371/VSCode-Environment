const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

// Hosted `supabase db push` (CLI login-role path) runs as cli_login_postgres with
// SET ROLE postgres, so the postgres role's search_path, which includes
// `extensions`, does not apply. Local resets connect as postgres and cannot see
// this. Migrations after the adopted 00001-00003 baseline must apply with only
// "$user", public on the path; 2026-11-11's first hosted 00004 push failed on an
// unqualified uuid_generate_v4().
const dir = path.join(__dirname, '../supabase/migrations');
const baseline = ['00001_first_slice.sql', '00002_review_hardening.sql', '00003_strict_duplicate_prevention.sql'];
const pushed = fs.readdirSync(dir).filter(name => /^\d{5}_.+\.sql$/.test(name) && name >= '00004').sort();
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const PUSH_PATH = 'SET search_path TO "$user", public;';

async function hostedLikeBaseline() {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      CREATE SCHEMA extensions;
      CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$SELECT gen_random_uuid()$$;
      SET search_path TO "$user", public, extensions;`);
    for (const name of baseline) await db.exec(read(name).replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
    await db.exec(PUSH_PATH);
    return db;
  } catch (error) { await db.close(); throw error; }
}

test('migrations after the adopted baseline apply under the hosted push search_path', async t => {
  assert.ok(pushed.includes('00004_shopping_items.sql'), 'guard must cover 00004 and later migrations');

  await t.test('every pushed migration succeeds without extensions on search_path', async () => {
    const db = await hostedLikeBaseline();
    try {
      for (const name of pushed) await db.exec(read(name));
      const { rows } = await db.query(`SELECT pg_get_expr(d.adbin, d.adrelid) AS expr FROM pg_attrdef d
        JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
        WHERE a.attrelid = 'public.pantry_shopping_items'::regclass AND a.attname = 'id'`);
      assert.equal(rows[0].expr, 'gen_random_uuid()');
    } finally { await db.close(); }
  });

  await t.test('negative control: an unqualified extension call fails exactly as on hosted', async () => {
    const db = await hostedLikeBaseline();
    try {
      const original = read('00004_shopping_items.sql').replace('DEFAULT gen_random_uuid()', 'DEFAULT uuid_generate_v4()');
      assert.notEqual(original, read('00004_shopping_items.sql'));
      await assert.rejects(db.exec(original), error => error.code === '42883' && /uuid_generate_v4\(\) does not exist/.test(error.message));
    } finally { await db.close(); }
  });
});
