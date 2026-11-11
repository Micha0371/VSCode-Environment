const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const operation = fs.readFileSync(path.join(__dirname, '../ops/hosted-baseline/reconcile-profile.sql'), 'utf8');
const id = '00000000-0000-0000-0000-000000000021';
const normalize = text => text.replaceAll('\r\n', '\n');

async function fixture() {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$SELECT gen_random_uuid()$$;`);
    for (const name of ['00001_first_slice.sql','00002_review_hardening.sql','00003_strict_duplicate_prevention.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8');
      await db.exec(sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
    }
    await db.exec(`GRANT EXECUTE ON FUNCTION public.handle_new_profile() TO anon,authenticated,service_role;
      CREATE SCHEMA supabase_migrations;
      CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);
      INSERT INTO supabase_migrations.schema_migrations VALUES
        ('00001','first_slice'),('00002','review_hardening'),('00003','strict_duplicate_prevention');`);
    const metadata = async () => (await db.query(`SELECT p.oid,p.proowner,p.proacl,p.proconfig,
      pg_get_functiondef(p.oid) AS definition FROM pg_proc p
      WHERE p.oid='public.handle_new_profile()'::regprocedure`)).rows[0];
    const canonical = normalize((await metadata()).definition);
    const legacy = canonical.replace('INSERT INTO public.pantry_households (owner_id)\n  VALUES (NEW.id)',
      "INSERT INTO public.pantry_households (owner_id, name)\n  VALUES (NEW.id, 'My Household')");
    assert.notEqual(legacy, canonical);
    await db.exec(legacy);
    await db.query('INSERT INTO auth.users(id) VALUES($1)', [id]);
    const rows = async () => (await db.query(`SELECT jsonb_build_object(
      'profiles',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.profiles t),
      'households',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.pantry_households t),
      'members',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.pantry_household_members t),
      'items',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.pantry_items t),
      'ledger',(SELECT jsonb_agg(to_jsonb(t) ORDER BY version) FROM supabase_migrations.schema_migrations t)) AS snapshot`)).rows[0].snapshot;
    return { db, canonical, legacy, metadata, rows };
  } catch (error) { await db.close(); throw error; }
}

test('profile baseline repair is guarded, atomic and equivalent to repository migrations', async t => {
  await t.test('only the known body changes; OID, grants, owner, settings, rows and ledger are preserved', async () => {
    const f = await fixture();
    try {
      const before = await f.metadata(), rows = await f.rows();
      await f.db.exec(operation);
      const after = await f.metadata();
      assert.equal(normalize(after.definition), f.canonical);
      assert.deepEqual({ ...after, definition: null }, { ...before, definition: null });
      assert.deepEqual(await f.rows(), rows);
      await f.db.query('INSERT INTO auth.users(id) VALUES($1)', ['00000000-0000-0000-0000-000000000022']);
      const created = (await f.db.query('SELECT name FROM public.pantry_households WHERE owner_id=$1',
        ['00000000-0000-0000-0000-000000000022'])).rows[0];
      assert.equal(created.name, 'My Household');
    } finally { await f.db.close(); }
  });

  const refusals = [
    ['unreviewed function body', async f => f.db.exec(f.legacy.replace("'owner'", "'member'")), /reviewed legacy profile definition/],
    ['changed grants', async f => f.db.exec('CREATE ROLE extra_grantee; GRANT EXECUTE ON FUNCTION public.handle_new_profile() TO extra_grantee;'), /grants changed/],
    ['changed owner', async f => f.db.exec('CREATE ROLE another_owner; ALTER FUNCTION public.handle_new_profile() OWNER TO another_owner;'), /owner changed/],
    ['changed household default', async f => f.db.exec("ALTER TABLE public.pantry_households ALTER COLUMN name SET DEFAULT 'Different';"), /default changed/],
    ['unexpected ledger version', async f => f.db.exec("INSERT INTO supabase_migrations.schema_migrations VALUES('00004','unexpected');"), /baseline versions/],
    ['already canonical function', async f => f.db.exec(f.canonical), /already canonical/],
  ];
  for (const [name, mutate, error] of refusals) {
    await t.test(`refuses ${name} without changing its starting state`, async () => {
      const f = await fixture();
      try {
        await mutate(f);
        const before = await f.metadata(), rows = await f.rows();
        await assert.rejects(f.db.exec(operation), error);
        await f.db.exec('ROLLBACK');
        assert.deepEqual(await f.metadata(), before);
        assert.deepEqual(await f.rows(), rows);
      } finally { await f.db.close(); }
    });
  }

  await t.test('a DDL-hook grant change aborts and rolls back the replacement and grant', async () => {
    const f = await fixture();
    try {
      await f.db.exec(`CREATE ROLE hook_grantee;
        CREATE FUNCTION public.reconciliation_hook() RETURNS event_trigger LANGUAGE plpgsql AS $$
        BEGIN GRANT EXECUTE ON FUNCTION public.handle_new_profile() TO hook_grantee; END;$$;
        CREATE EVENT TRIGGER reconciliation_hook ON ddl_command_end
        WHEN TAG IN ('CREATE FUNCTION') EXECUTE FUNCTION public.reconciliation_hook();`);
      const before = await f.metadata(), rows = await f.rows();
      await assert.rejects(f.db.exec(operation), /postcondition failed/);
      await f.db.exec('ROLLBACK');
      assert.deepEqual(await f.metadata(), before);
      assert.deepEqual(await f.rows(), rows);
    } finally { await f.db.close(); }
  });
});
