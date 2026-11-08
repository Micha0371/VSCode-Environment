import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localStack, fixtures, cleanup, emails, password } from './local-stack';

test('real local Auth/PostgREST behavior from migrations 00001–00003', async t => {
  const stack = localStack();
  try {
    const [a, b] = await fixtures(stack);
    const insert = (user: typeof a, name: string, extra = {}) => user.client.from('pantry_items').insert({
      household_id: user.household, created_by: user.id, name, ...extra,
    }).select().single();
    const ok = <T,>(result: { data: T; error: unknown }) => { assert.equal(result.error, null); return result.data; };
    const milk = ok(await insert(a, '  Milk  '));
    assert.equal(milk.name, 'Milk');

    await t.test('direct API rejects duplicate creates and renames, permits self edits and distinct names', async () => {
      for (const name of ['Milk', 'milk', ' MILK ', '\u00a0Milk\u00a0']) {
        assert.equal((await insert(a, name, { category: 'grains', location: 'counter', status: 'out' })).error?.code, '23505');
      }
      const fridge = ok(await insert(a, 'Milk Fridge'));
      ok(await insert(a, 'Milk  Fridge')); // Internal whitespace is intentionally significant.
      assert.equal((await a.client.from('pantry_items').update({ name: 'milk' }).eq('id', fridge.id)).error?.code, '23505');
      ok(await a.client.from('pantry_items').update({ name: ' Milk ', status: 'low' }).eq('id', milk.id));
      ok(await insert(b, 'milk'));
    });

    await t.test('independent HTTP transactions produce exactly one winner for concurrent duplicates', async () => {
      const results = await Promise.all([insert(a, 'Eggs'), insert(a, ' eggs ')]);
      assert.equal(results.filter(r => !r.error).length, 1);
      assert.equal(results.find(r => r.error)?.error?.code, '23505');
      const x = ok(await insert(a, 'Bread A')), y = ok(await insert(a, 'Bread B'));
      const renames = await Promise.all([x, y].map(row => a.client.from('pantry_items').update({ name: 'Bread' }).eq('id', row.id)));
      assert.equal(renames.filter(r => !r.error).length, 1);
      assert.equal(renames.find(r => r.error)?.error?.code, '23505');
    });

    await t.test('two households and anonymous callers cannot cross authorization boundaries', async () => {
      for (const [actor, owner] of [[b, a], [a, b]]) {
        for (const table of ['pantry_items', 'pantry_households', 'pantry_household_members', 'profiles']) {
          const filter = table === 'pantry_items' ? 'household_id' : table === 'pantry_households' || table === 'profiles' ? 'id' : 'user_id';
          const value = table === 'pantry_items' || table === 'pantry_households' ? owner.household : owner.id;
          assert.deepEqual(ok(await actor.client.from(table).select('*').eq(filter, value)), []);
        }
        assert.deepEqual(ok(await actor.client.from('pantry_items').update({ name: 'Stolen' }).eq('household_id', owner.household).select()), []);
        assert.deepEqual(ok(await actor.client.from('pantry_items').delete().eq('household_id', owner.household).select()), []);
        assert.ok((await insert(actor, 'Foreign', { household_id: owner.household })).error);
      }
      const anon = stack.client();
      const read = await anon.from('pantry_items').select('*');
      assert.ok(read.error || read.data?.length === 0);
      assert.ok((await anon.from('pantry_items').insert({ name: 'Anon', household_id: a.household, created_by: a.id })).error);
    });

    await t.test('profile privileges and immutable creator/household/timestamps are enforced', async () => {
      ok(await a.client.from('profiles').update({ name: 'Alice', language: 'de' }).eq('id', a.id));
      assert.ok((await a.client.from('profiles').update({ is_premium: true }).eq('id', a.id)).error);
      for (const [column, value] of Object.entries({ created_by: b.id, household_id: b.household, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), id: b.id })) {
        assert.ok((await a.client.from('pantry_items').update({ [column]: value }).eq('id', milk.id)).error);
      }
      assert.ok((await insert(a, 'Forged', { created_by: b.id })).error);
      assert.ok((await insert(a, 'Null', { created_by: null })).error);
    });

    await t.test('blank/overlong names and unsupported values fail; all stock states persist', async () => {
      for (const name of ['', ' ', '\t\n', 'a'.repeat(121)]) assert.equal((await insert(a, name)).error?.code, '23514');
      for (const column of ['category', 'location', 'status']) assert.equal((await insert(a, 'Invalid', { [column]: 'invalid' })).error?.code, '23514');
      for (const status of ['in_stock', 'low', 'out']) {
        const saved = ok(await a.client.from('pantry_items').update({ status }).eq('id', milk.id).select().single());
        assert.equal(saved.status, status);
        assert.equal(ok(await a.client.from('pantry_items').select('status').eq('id', milk.id).single())!.status, status);
      }
      ok(await a.client.from('pantry_items').delete().eq('id', milk.id));
      assert.deepEqual(ok(await a.client.from('pantry_items').select().eq('id', milk.id)), []);
    });

    await t.test('real confirmation-required signup, rejection, confirmation, refresh and logout', async () => {
      const client = stack.client();
      const signup = await client.auth.signUp({ email: emails[2], password, options: { data: { name: 'Signup' } } });
      assert.equal(signup.error, null); assert.equal(signup.data.session, null); assert.ok(signup.data.user);
      assert.ok((await client.auth.signInWithPassword({ email: emails[2], password })).error);
      const confirmed = await stack.admin.auth.admin.updateUserById(signup.data.user!.id, { email_confirm: true });
      assert.equal(confirmed.error, null); // Real email delivery remains a separate release task.
      assert.ok((await client.auth.signInWithPassword({ email: emails[2], password: 'wrong-password' })).error);
      const login = await client.auth.signInWithPassword({ email: emails[2], password });
      assert.equal(login.error, null); assert.ok(login.data.session);
      const restored = stack.client();
      assert.equal((await restored.auth.setSession(login.data.session!)).error, null);
      const refresh = await restored.auth.refreshSession();
      assert.equal(refresh.error, null); assert.ok(refresh.data.session);
      assert.equal((await restored.auth.signOut({ scope: 'local' })).error, null);
      assert.ok((await stack.client().auth.refreshSession({ refresh_token: refresh.data.session!.refresh_token })).error);
    });
  } finally {
    await cleanup(stack.admin); // Fails the run if fixture deletion fails.
  }
});
