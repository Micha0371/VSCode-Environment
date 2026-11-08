const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';

test('migrations enforce authorization, validation, attribution and deletion behavior in PostgreSQL', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
    `);
    // PGlite uses PostgreSQL's built-in UUID generator in place of uuid-ossp;
    // every table, trigger, policy, grant, and hardening statement runs unchanged.
    const migration = name => fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8');
    await db.exec(migration('00001_first_slice.sql').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
    // Reproduce the permissive Supabase table grants the review targeted.
    await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;');
    await db.exec(migration('00002_review_hardening.sql'));
    await db.query('INSERT INTO auth.users (id) VALUES ($1), ($2)', [alice, bob]);
    const households = await db.query('SELECT id, owner_id FROM public.pantry_households');
    const home = id => households.rows.find(row => row.owner_id === id).id;
    // Prove legacy conflicts abort without merging or deleting either record.
    await db.query(`INSERT INTO public.pantry_items (household_id,name,created_by)
      VALUES ($1,'Milk',$2), ($1,' milk ',$2)`, [home(alice), alice]);
    await assert.rejects(db.exec(migration('00003_strict_duplicate_prevention.sql')), /duplicate normalized names/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.pantry_items')).rows[0].n, 2);
    // Explicit test-fixture cleanup, never performed by the migration.
    await db.exec('DELETE FROM public.pantry_items');
    await db.exec(migration('00003_strict_duplicate_prevention.sql'));
    const as = async (id, role = 'authenticated') => {
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
      await db.exec(`SET ROLE ${role}`);
    };
    const insert = (name = 'Milk', creator = alice, household = home(alice), category = 'dairy', location = 'fridge') =>
      db.query(`INSERT INTO public.pantry_items (household_id,name,created_by,category,location)
        VALUES ($1,$2,$3,$4,$5) RETURNING id`, [household,name,creator,category,location]);
    await as(alice);
    const item = (await insert()).rows[0].id;

    await t.test('users may edit profile fields but cannot self-assign premium or change identity', async () => {
      await db.query("UPDATE public.profiles SET name='Alice', language='de' WHERE id=$1", [alice]);
      await assert.rejects(db.query('UPDATE public.profiles SET is_premium=true WHERE id=$1', [alice]), /permission denied/);
      await assert.rejects(db.query('UPDATE public.profiles SET id=$1 WHERE id=$2', [bob,alice]), /permission denied/);
      await assert.rejects(db.query("UPDATE public.profiles SET language='xx' WHERE id=$1", [alice]), /check constraint/);
      assert.equal((await db.query('SELECT is_premium FROM public.profiles')).rows[0].is_premium, false);
    });
    await t.test('creator spoofing, null attribution and cross-household insertion are rejected', async () => {
      await assert.rejects(insert('Forged', bob), /row-level security/);
      await assert.rejects(insert('Null', null), /row-level security/);
      await assert.rejects(insert('Foreign', alice, home(bob)), /row-level security/);
      for (const column of ['created_by', 'household_id', 'id', 'created_at', 'updated_at']) {
        const value = column.endsWith('_at') ? "now()" : `'${bob}'`;
        await assert.rejects(db.exec(`UPDATE public.pantry_items SET ${column}=${value}`), /permission denied/);
      }
    });
    await t.test('direct API equivalents cannot bypass input constraints', async () => {
      for (const name of ['', '   ', '\t\n', 'a'.repeat(121)]) await assert.rejects(insert(name), /check constraint/);
      await assert.rejects(insert('Milk', alice, home(alice), 'invalid'), /check constraint/);
      await assert.rejects(insert('Milk', alice, home(alice), 'dairy', 'invalid'), /check constraint/);
      await assert.rejects(db.exec("UPDATE public.pantry_items SET status='invalid'"), /check constraint/);
      await db.query("UPDATE public.pantry_items SET name='Oat milk', status='low' WHERE id=$1", [item]);
      assert.equal((await db.query('SELECT status FROM public.pantry_items WHERE id=$1', [item])).rows[0].status, 'low');
    });
    await t.test('duplicate add and rename are blocked regardless of category, location or status', async () => {
      await insert('Milk');
      for (const name of ['milk', 'Milk', '  MILK  ', '\u00a0Milk\u00a0']) {
        await assert.rejects(insert(name), error => error.code === '23505');
      }
      await assert.rejects(insert('milk', alice, home(alice), 'other', 'pantry'), error => error.code === '23505');
      await assert.rejects(db.query("UPDATE public.pantry_items SET name='milk', status='out' WHERE id=$1", [item]), error => error.code === '23505');
      await db.query("UPDATE public.pantry_items SET name='  OAT MILK  ', status='low' WHERE id=$1", [item]);
      assert.equal((await db.query('SELECT name FROM public.pantry_items WHERE id=$1', [item])).rows[0].name, 'OAT MILK');
      await insert('Milk Fridge');
      await insert('Milk Pantry');
      await insert('Milk  Fridge');
      await as(bob);
      await insert('milk', bob, home(bob));
      await as(alice);
    });
    await t.test('overlapping duplicate insert and rename calls cannot both succeed', async () => {
      const outcomes = await Promise.allSettled([insert('Eggs'), insert(' eggs ')]);
      assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
      assert.equal(outcomes.find(x => x.status === 'rejected').reason.code, '23505');
      const a = (await insert('Bread A')).rows[0].id;
      const b = (await insert('Bread B')).rows[0].id;
      const renames = await Promise.allSettled([
        db.query("UPDATE public.pantry_items SET name='Bread' WHERE id=$1", [a]),
        db.query("UPDATE public.pantry_items SET name=' bread ' WHERE id=$1", [b]),
      ]);
      assert.equal(renames.filter(x => x.status === 'fulfilled').length, 1);
      assert.equal(renames.find(x => x.status === 'rejected').reason.code, '23505');
      await db.query('DELETE FROM public.pantry_items WHERE id <> $1', [item]);
    });
    await t.test('other users and anonymous clients cannot read or mutate an existing item', async () => {
      for (const [id, role] of [[bob, 'authenticated'], [null, 'anon']]) {
        await as(id, role);
        assert.equal((await db.query('SELECT * FROM public.pantry_items WHERE id=$1', [item])).rows.length, 0);
        assert.equal((await db.query('DELETE FROM public.pantry_items WHERE id=$1 RETURNING id', [item])).rows.length, 0);
        if (role === 'authenticated') assert.equal((await db.query("UPDATE public.pantry_items SET name='stolen' WHERE id=$1 RETURNING id", [item])).rows.length, 0);
        else await assert.rejects(insert(), /permission denied/);
      }
      await as(alice);
      assert.equal((await db.query('SELECT id FROM public.pantry_items WHERE id=$1', [item])).rows.length, 1);
    });
    await t.test('deleting an author preserves items in a surviving household and clears attribution', async () => {
      await db.exec('RESET ROLE');
      // Represents an existing shared-household item, or a legacy forged record.
      await db.query('UPDATE public.pantry_items SET created_by=$1 WHERE id=$2', [bob,item]);
      await db.query('DELETE FROM auth.users WHERE id=$1', [bob]);
      const result = await db.query('SELECT created_by FROM public.pantry_items WHERE id=$1', [item]);
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].created_by, null);
      await as(alice);
      await db.query('DELETE FROM public.pantry_items WHERE id=$1', [item]);
      assert.equal((await db.query('SELECT * FROM public.pantry_items')).rows.length, 0);
    });
  } finally { await db.close(); }
});
