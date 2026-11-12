import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { localStack, fixtures, cleanup, appRoot, emails, password } from '../tests/integration/local-stack';
import { confirmationLink, messages, openVerification } from '../tests/integration/confirmation-mail';
import { setTimeout as delay } from 'node:timers/promises';

async function main() {
const stack = localStack();
const command = process.argv[2];
if (command === 'prepare') {
  try {
    const target = process.env.PANTRY_TEST_TARGET ?? 'emulator';
    assert.ok(['emulator', 'device'].includes(target), 'Expected emulator or device test target');
    await fixtures(stack);
    await fs.mkdir(path.join(appRoot, '.verification'), { recursive: true });
    await fs.writeFile(path.join(appRoot, '.verification/e2e-env.json'), JSON.stringify({
      // Only a local anon key is copied into the APK. Never the admin key.
      EXPO_PUBLIC_SUPABASE_ANON_KEY: stack.key,
      // Device HTTP is loopback-only through ADB reverse; the proxy binds 127.0.0.1.
      // These endpoints are confined to disposable fixtures, never the hosted app.
      EXPO_PUBLIC_SUPABASE_URL: target === 'device' ? 'http://127.0.0.1:54329' : 'http://10.0.2.2:54329',
    }));
    await fs.writeFile(path.join(appRoot, '.verification/confirmation-state.json'), JSON.stringify({
      previousIds: (await messages()).map(message => message.ID),
    }));
    console.log('Prepared two isolated households; registration account starts absent.');
  } catch (error) { await cleanup(stack.admin); throw error; }
} else if (command === 'verify') {
  const client = stack.client();
  assert.equal((await client.auth.signInWithPassword({ email: emails[0], password })).error, null);
  const result = await client.from('pantry_items').select('*');
  assert.equal(result.error, null);
  assert.equal(result.data?.length, 1, 'Android must leave exactly one persisted item');
  assert.equal(result.data![0].name, 'Milk');
  assert.equal(result.data![0].category, 'dairy', 'First keyboard-open chip tap must select Dairy');
  assert.equal(result.data![0].status, 'low');
  const bob = stack.client();
  assert.equal((await bob.auth.signInWithPassword({ email: emails[1], password })).error, null);
  assert.deepEqual((await bob.from('pantry_items').select('*')).data, []);
  const users = await stack.admin.auth.admin.listUsers();
  assert.equal(users.error, null);
  const registration = users.data.users.find(user => user.email === emails[2]);
  assert.ok(registration, 'Android registration must reach real local Auth');
  assert.ok(!registration.email_confirmed_at, 'Registration requires confirmation');
  console.log('Verified Android database outcomes, household isolation and confirmation-required registration.');
} else if (command === 'shopping-verify') {
  // Ordinary clients only: what each household member can actually read.
  const alice = stack.client();
  assert.equal((await alice.auth.signInWithPassword({ email: emails[0], password })).error, null);
  const pantry = await alice.from('pantry_items').select('id, name, category, status');
  assert.equal(pantry.error, null);
  assert.equal(pantry.data?.length, 1, 'The shopping journey must not add or remove pantry items');
  const milk = pantry.data![0];
  assert.deepEqual({ name: milk.name, category: milk.category, status: milk.status },
    { name: 'Milk', category: 'dairy', status: 'low' }, 'The pantry row must stay as the prompt flow last saved it');
  const shopping = await alice.from('pantry_shopping_items').select('name, is_checked, completed_at, pantry_item_id').order('name');
  assert.equal(shopping.error, null);
  assert.deepEqual(shopping.data?.map(row => row.name), ['Milk', 'Rye bread'], 'Expected exactly Milk and Rye bread');
  const [linked, bread] = shopping.data!;
  assert.equal(linked.pantry_item_id, milk.id, 'The prompt add must link Milk to its pantry item');
  assert.equal(linked.is_checked, false);
  assert.equal(linked.completed_at, null);
  assert.equal(bread.pantry_item_id, null, 'A manual add has no pantry link');
  assert.equal(bread.is_checked, true);
  assert.ok(bread.completed_at, 'A completed item carries its server-set completion time');
  const bob = stack.client();
  assert.equal((await bob.auth.signInWithPassword({ email: emails[1], password })).error, null);
  assert.deepEqual((await bob.from('pantry_shopping_items').select('id')).data, []);
  assert.deepEqual((await bob.from('pantry_items').select('id')).data, []);
  await alice.auth.signOut();
  await bob.auth.signOut();
  console.log('Verified Android shopping outcomes, the pantry link, completion state and household isolation.');
} else if (command === 'confirmation-first') {
  const state = JSON.parse(await fs.readFile(path.join(appRoot, '.verification/confirmation-state.json'), 'utf8'));
  const location = await openVerification(await confirmationLink(emails[3], new Set(state.previousIds)));
  assert.ok(location.searchParams.get('code'), 'The first signup email must return a PKCE code');
  await fs.writeFile(path.join(appRoot, '.verification/confirmation-state.json'), JSON.stringify({ confirmed: location.toString() }));
} else if (command === 'confirmation-reset') {
  const users = await stack.admin.auth.admin.listUsers();
  assert.equal(users.error, null);
  const user = users.data.users.find(user => user.email === emails[3]);
  assert.ok(user?.email_confirmed_at && user.last_sign_in_at, 'First signup must establish a real Android session before reset');
  assert.equal((await stack.admin.auth.admin.deleteUser(user.id)).error, null);
  await fs.writeFile(path.join(appRoot, '.verification/confirmation-state.json'), JSON.stringify({
    previousIds: (await messages()).map(message => message.ID),
  }));
  console.log('Verified first-signup Android session and reset only the reserved local confirmation account.');
} else if (command === 'confirmation-expired') {
  const state = JSON.parse(await fs.readFile(path.join(appRoot, '.verification/confirmation-state.json'), 'utf8'));
  const link = await confirmationLink(emails[3], new Set(state.previousIds));
  console.log('Waiting for the disposable 60-second email expiry before Android recovery validation.');
  await delay(65000);
  const expired = await openVerification(link);
  assert.equal(new URLSearchParams(expired.hash.slice(1)).get('error_code'), 'otp_expired');
  await fs.writeFile(path.join(appRoot, '.verification/confirmation-state.json'), JSON.stringify({
    expired: expired.toString(), previousIds: (await messages()).map(message => message.ID),
  }));
} else if (command === 'confirmation-resent') {
  const state = JSON.parse(await fs.readFile(path.join(appRoot, '.verification/confirmation-state.json'), 'utf8'));
  const location = await openVerification(await confirmationLink(emails[3], new Set(state.previousIds)));
  assert.ok(location.searchParams.get('code'), 'The resent native email must use PKCE, never implicit access tokens');
  await fs.writeFile(path.join(appRoot, '.verification/confirmation-state.json'), JSON.stringify({ ...state, confirmed: location.toString() }));
} else if (command === 'confirmation-verify') {
  const users = await stack.admin.auth.admin.listUsers();
  assert.equal(users.error, null);
  const user = users.data.users.find(user => user.email === emails[3]);
  assert.ok(user?.email_confirmed_at, 'Android must confirm the actual local Auth account');
  assert.ok(user.last_sign_in_at, 'Android callback must establish a session before independent password verification');
  const client = stack.client();
  const session = await client.auth.signInWithPassword({ email: emails[3], password });
  assert.equal(session.error, null);
  assert.deepEqual((await client.from('pantry_items').select('id')).data, []);
  await client.auth.signOut();
  console.log('Verified native signup, expired email recovery, PKCE resend, confirmation and independent empty household.');
} else if (command === 'cleanup') {
  await cleanup(stack.admin);
  await fs.rm(path.join(appRoot, '.verification/e2e-env.json'), { force: true });
  await fs.rm(path.join(appRoot, '.verification/confirmation-state.json'), { force: true });
  console.log('Removed only reserved local test accounts and their cascading household data.');
} else throw new Error('Expected prepare, verify, shopping-verify or cleanup');

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
