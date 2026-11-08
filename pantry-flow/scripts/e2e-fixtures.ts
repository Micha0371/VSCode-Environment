import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { localStack, fixtures, cleanup, appRoot, emails, password } from '../tests/integration/local-stack';

async function main() {
const stack = localStack();
const command = process.argv[2];
if (command === 'prepare') {
  try {
    await fixtures(stack);
    await fs.mkdir(path.join(appRoot, '.verification'), { recursive: true });
    await fs.writeFile(path.join(appRoot, '.verification/e2e-env.json'), JSON.stringify({
      // Only a local anon key is copied into the APK. Never the admin key.
      EXPO_PUBLIC_SUPABASE_ANON_KEY: stack.key,
      EXPO_PUBLIC_SUPABASE_URL: 'http://10.0.2.2:54329',
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
} else if (command === 'cleanup') {
  await cleanup(stack.admin);
  await fs.rm(path.join(appRoot, '.verification/e2e-env.json'), { force: true });
  console.log('Removed only reserved local test accounts and their cascading household data.');
} else throw new Error('Expected prepare, verify or cleanup');

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
