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
        assert.deepEqual(ok(await actor.client.from('profiles').update({ name: 'Stolen' }).eq('id', owner.id).select()), []);
        assert.deepEqual(ok(await actor.client.from('pantry_households').update({ name: 'Stolen' }).eq('id', owner.household).select()), []);
        assert.deepEqual(ok(await actor.client.from('pantry_households').delete().eq('id', owner.household).select()), []);
        assert.deepEqual(ok(await actor.client.from('pantry_household_members').update({ role: 'owner' }).eq('user_id', owner.id).select()), []);
        assert.deepEqual(ok(await actor.client.from('pantry_household_members').delete().eq('user_id', owner.id).select()), []);
        assert.equal((await actor.client.from('pantry_household_members').insert({ household_id: owner.household, user_id: actor.id, role: 'owner' })).error?.code, '42501');
        assert.equal((await actor.client.from('pantry_households').insert({ owner_id: actor.id, name: 'Unapproved second household' })).error?.code, '42501');
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

test('shopping persistence enforces the approved open-name, lifecycle and household contract', async t => {
  const stack = localStack();
  const table = 'pantry_shopping_items';
  try {
    const [a, b] = await fixtures(stack);
    const peer = stack.client();
    assert.equal((await peer.auth.signInWithPassword({ email: emails[0], password })).error, null);
    const ok = <T,>(r: { data: T; error: unknown }) => { assert.equal(r.error, null); return r.data; };
    const insert = (user: typeof a, name: string | null, extra = {}) => user.client.from(table).insert({
      household_id: user.household, created_by: user.id, name, ...extra,
    }).select().single();
    const row = async (id: string) => ok(await a.client.from(table).select().eq('id', id).single())!;
    const pantryA = ok(await a.client.from('pantry_items').insert({ household_id: a.household,
      created_by: a.id, name: 'Pantry milk', status: 'low' }).select().single())!;
    const pantryB = ok(await b.client.from('pantry_items').insert({ household_id: b.household,
      created_by: b.id, name: 'Pantry milk' }).select().single())!;
    const milk = ok(await insert(a, '\u00a0 Milk \u00a0', { pantry_item_id: pantryA.id }))!;

    await t.test('direct API normalizes edge whitespace, rejects bad names and shares manual/linked uniqueness', async () => {
      assert.equal(milk.name, 'Milk');
      for (const name of ['milk', ' MILK ', '\u00a0milk\u00a0']) {
        assert.equal((await insert(a, name)).error?.code, '23505');
      }
      for (const name of ['', ' \t\n', '\u00a0', 'x'.repeat(121)]) {
        assert.equal((await insert(a, name)).error?.code, '23514');
      }
      assert.equal((await insert(a, null)).error?.code, '23502');
      const x = ok(await insert(a, 'Milk Fridge'))!;
      ok(await insert(a, 'Milk  Fridge'));
      assert.equal((await a.client.from(table).update({ name: 'milk' }).eq('id', x.id)).error?.code, '23505');
      ok(await a.client.from(table).update({ name: ' Milk ' }).eq('id', milk.id));
      ok(await insert(b, 'milk'));
    });

    await t.test('completion is retained, server-timed and reopenable without changing pantry state', async () => {
      const checked = ok(await a.client.from(table).update({ is_checked: true }).eq('id', milk.id).select().single())!;
      assert.ok(checked.completed_at); assert.equal(checked.is_checked, true);
      const edited = ok(await a.client.from(table).update({ name: 'Milk', is_checked: true }).eq('id', milk.id).select().single())!;
      assert.equal(edited.completed_at, checked.completed_at);
      const open = ok(await insert(a, 'milk'))!;
      assert.equal((await a.client.from(table).update({ is_checked: false }).eq('id', milk.id)).error?.code, '23505');
      assert.equal((await row(milk.id)).completed_at, checked.completed_at);
      ok(await a.client.from(table).delete().eq('id', open.id));
      const reopened = ok(await a.client.from(table).update({ is_checked: false }).eq('id', milk.id).select().single())!;
      assert.equal(reopened.completed_at, null);
      assert.equal(reopened.is_checked, false);
      assert.deepEqual(ok(await a.client.from('pantry_items').select().eq('id', pantryA.id).single()), pantryA);
    });

    await t.test('independent clients arbitrate concurrent add, rename, reopen and add-versus-reopen', async () => {
      const oneWinner = (results: Array<{ error: { code?: string } | null }>) => {
        assert.equal(results.filter(r => !r.error).length, 1);
        assert.equal(results.find(r => r.error)?.error?.code, '23505');
      };
      oneWinner(await Promise.all([insert(a, 'Eggs'), peer.from(table).insert({
        household_id: a.household, created_by: a.id, name: ' eggs ',
      })]));
      const x = ok(await insert(a, 'Rename A'))!, y = ok(await insert(a, 'Rename B'))!;
      oneWinner(await Promise.all([a.client.from(table).update({ name: 'Bread' }).eq('id', x.id),
        peer.from(table).update({ name: ' bread ' }).eq('id', y.id)]));
      const c = ok(await insert(a, 'Reopen', { is_checked: true }))!;
      const d = ok(await insert(a, 'reopen', { is_checked: true }))!;
      oneWinner(await Promise.all([a.client.from(table).update({ is_checked: false }).eq('id', c.id),
        peer.from(table).update({ is_checked: false }).eq('id', d.id)]));
      assert.equal(ok(await a.client.from(table).select().in('id', [c.id, d.id]).eq('is_checked', false))!.length, 1);
      const e = ok(await insert(a, 'Race', { is_checked: true }))!;
      oneWinner(await Promise.all([insert(a, ' race '), peer.from(table).update({ is_checked: false }).eq('id', e.id)]));
      assert.equal(ok(await a.client.from(table).select().eq('household_id', a.household).ilike('name', 'race').eq('is_checked', false))!.length, 1);
    });

    await t.test('ordinary and anonymous clients cannot cross households, spoof creators or timestamps', async () => {
      for (const [actor, owner] of [[a, b], [b, a]]) {
        assert.deepEqual(ok(await actor.client.from(table).select().eq('household_id', owner.household)), []);
        assert.deepEqual(ok(await actor.client.from(table).update({ name: 'Stolen' }).eq('household_id', owner.household).select()), []);
        assert.deepEqual(ok(await actor.client.from(table).delete().eq('household_id', owner.household).select()), []);
        assert.equal((await insert(actor, 'Foreign', { household_id: owner.household })).error?.code, '42501');
        assert.equal((await insert(actor, 'Forged', { created_by: owner.id })).error?.code, '42501');
      }
      assert.equal((await insert(a, 'Null author', { created_by: null })).error?.code, '42501');
      for (const [column, value] of Object.entries({ id: b.id, household_id: b.household, created_by: b.id,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: new Date().toISOString() })) {
        assert.equal((await a.client.from(table).update({ [column]: value }).eq('id', milk.id)).error?.code, '42501');
        if (column !== 'household_id' && column !== 'created_by') {
          assert.equal((await insert(a, 'Injected ' + column, { [column]: value })).error?.code, '42501');
        }
      }
      assert.equal((await a.client.from(table).update({ is_checked: null }).eq('id', milk.id)).error?.code, '23502');
      const anon = stack.client();
      assert.equal((await anon.from(table).select()).error?.code, '42501');
      assert.equal((await anon.from(table).insert({ name: 'Anon', household_id: a.household, created_by: a.id })).error?.code, '42501');
      assert.equal((await anon.from(table).update({ name: 'Anon' }).eq('id', milk.id)).error?.code, '42501');
      assert.equal((await anon.from(table).delete().eq('id', milk.id)).error?.code, '42501');
    });

    await t.test('pantry links are household-consistent and pantry deletion preserves shopping state', async () => {
      assert.equal((await insert(a, 'Foreign link', { pantry_item_id: pantryB.id })).error?.code, '23503');
      assert.equal((await a.client.from(table).update({ pantry_item_id: pantryB.id }).eq('id', milk.id)).error?.code, '23503');
      const alternate = ok(await a.client.from('pantry_items').insert({ household_id: a.household,
        created_by: a.id, name: 'Pantry oats', status: 'out' }).select().single())!;
      ok(await a.client.from(table).update({ is_checked: true }).eq('id', milk.id));
      const original = await row(milk.id);
      assert.ok(original.completed_at);
      const relinked = ok(await a.client.from(table).update({ pantry_item_id: alternate.id })
        .eq('id', milk.id).select().single())!;
      assert.equal(relinked.pantry_item_id, alternate.id);
      assert.equal(relinked.name, original.name);
      assert.equal(relinked.household_id, original.household_id);
      assert.equal(relinked.is_checked, original.is_checked);
      assert.equal(relinked.completed_at, original.completed_at);
      assert.deepEqual(ok(await a.client.from('pantry_items').select().eq('id', alternate.id).single()), alternate);
      ok(await a.client.from('pantry_items').delete().eq('id', pantryA.id));
      assert.equal((await row(milk.id)).pantry_item_id, alternate.id, 'deleting the former target leaves the new link intact');
      const before = await row(milk.id);
      ok(await a.client.from('pantry_items').delete().eq('id', alternate.id));
      const after = await row(milk.id);
      assert.equal(after.pantry_item_id, null); assert.equal(after.name, before.name);
      assert.equal(after.household_id, before.household_id); assert.equal(after.completed_at, before.completed_at);
      ok(await a.client.from(table).delete().eq('id', milk.id));
      assert.deepEqual(ok(await a.client.from(table).select().eq('id', milk.id)), []);
      assert.deepEqual(ok(await b.client.from('pantry_items').select().eq('id', pantryB.id).single()), pantryB);
    });

    await t.test('another member may edit; deleting its author preserves the surviving household row', async () => {
      // Admin only prepares the shared-membership fixture; assertions use member clients.
      ok(await stack.admin.from('pantry_household_members').update({ household_id: a.household }).eq('user_id', b.id));
      const shared = ok(await insert({ ...b, household: a.household }, 'Shared author'))!;
      ok(await a.client.from(table).update({ name: 'Shared edited' }).eq('id', shared.id));
      assert.equal((await row(shared.id)).name, 'Shared edited');
      assert.equal((await stack.admin.auth.admin.deleteUser(b.id)).error, null);
      assert.equal((await row(shared.id)).created_by, null);
      ok(await a.client.from(table).update({ is_checked: true }).eq('id', shared.id));
      assert.ok((await row(shared.id)).completed_at);
    });
  } finally { await cleanup(stack.admin); }
});
