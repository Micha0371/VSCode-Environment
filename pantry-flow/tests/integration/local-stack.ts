import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import path from 'node:path';

export const appRoot = path.resolve(__dirname, '../..');
export const localUrl = 'http://127.0.0.1:54321';
export const password = 'PF-local-test-only-9281!';
export const emails = ['pf.test.alice@example.com', 'pf.test.bob@example.com', 'pf.test.signup@example.com'];

export function validateLocalStatus(status: Record<string, string>) {
  assert.equal(status.API_URL, localUrl, 'Refusing any non-local or unexpected Supabase stack');
  assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY, 'Local CLI must return local anon/admin keys');
  return status;
}

// Explicit CLI cwd, never .env or hosted credentials. The admin client is only
// for local fixture lifecycle. All behavioral assertions use ordinary clients.
export function localStack() {
  const executable = path.join(appRoot, 'node_modules/supabase/bin', process.platform === 'win32' ? 'supabase.exe' : 'supabase');
  const status = validateLocalStatus(JSON.parse(execFileSync(executable, ['status', '-o', 'json'], {
    cwd: appRoot, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
  })));
  const options = { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } };
  return {
    key: status.ANON_KEY,
    admin: createClient(localUrl, status.SERVICE_ROLE_KEY, options),
    client: () => createClient(localUrl, status.ANON_KEY, options),
  };
}

export async function cleanup(admin: SupabaseClient) {
  // Only exact reserved fixture emails; never bulk-delete arbitrary accounts.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const user of data.users.filter(user => emails.includes(user.email ?? ''))) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
}

export async function fixtures(stack: ReturnType<typeof localStack>) {
  await cleanup(stack.admin);
  const users = [];
  for (const email of emails.slice(0, 2)) {
    const { data, error } = await stack.admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { name: email.includes('alice') ? 'Alice' : 'Bob' } });
    if (error) throw error;
    const client = stack.client();
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    const membership = await client.from('pantry_household_members').select('household_id').single();
    if (membership.error) throw membership.error;
    users.push({ client, id: data.user.id, household: membership.data.household_id as string });
  }
  return users;
}
