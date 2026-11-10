// Real HTTP authorization checks against the explicitly selected Supabase project.
// Uses two disposable, confirmed users and a public key; never a service-role key.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const appRoot = path.resolve(__dirname, '..');
function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .filter(line => line.trim() && !line.trim().startsWith('#') && line.includes('='))
    .map(line => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
}
const config = { ...readEnv(path.join(appRoot, '.env')), ...readEnv(path.join(appRoot, '.env.verification.local')), ...process.env };
const url = config.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const key = config.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const expectedUrl = 'https://oiqteedkfwmcertgxqga.supabase.co';
const prefix = `PF verification ${crypto.randomUUID()}`;
const results = [];
const created = [];
const sessions = [];
const originalProfiles = [];

async function request(route, { method = 'GET', token, body, prefer } = {}) {
  const response = await fetch(url + route, {
    method, signal: AbortSignal.timeout(20000),
    headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(prefer ? { Prefer: prefer } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}
const query = (table, search) => `/rest/v1/${table}?${search}`;
const ownItem = (session, name, extra = {}) => ({ household_id: session.household,
  name, category: 'dairy', location: 'fridge', status: 'in_stock', created_by: session.user.id, ...extra });
async function insert(session, name, extra = {}) {
  const result = await request(query('pantry_items', 'select=*'), {
    method: 'POST', token: session.access_token, body: ownItem(session, name, extra), prefer: 'return=representation',
  });
  for (const item of Array.isArray(result.data) ? result.data : []) created.push({ id: item.id, session });
  return result;
}
const patch = (session, table, id, body) => request(query(table, `id=eq.${id}&select=*`), {
  method: 'PATCH', token: session.access_token, body, prefer: 'return=representation',
});
function successful(result) {
  assert.equal(result.ok, true, `HTTP ${result.status}: ${result.data?.code ?? 'unexpected response'}`);
  return result.data;
}
function denied(result) {
  assert.equal(result.ok, false, 'Unauthorized operation unexpectedly succeeded');
  assert.ok([401, 403].includes(result.status), `Expected authorization rejection, got HTTP ${result.status}`);
}
function duplicate(result) {
  assert.equal(result.status, 409);
  assert.equal(result.data?.code, '23505');
}
async function check(name, operation) {
  try { await operation(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}

async function run() {
  assert.equal(url, expectedUrl, 'Refusing to test an unexpected project URL');
  if (!key?.startsWith('sb_publishable_')) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role; } catch {}
    assert.equal(role, 'anon', 'Only publishable or legacy anon keys are allowed; admin keys would invalidate authorization tests');
  }
  const settings = await request('/auth/v1/settings');
  assert.equal(settings.ok, true, `Auth settings request failed with HTTP ${settings.status}`);
  console.log(JSON.stringify({ projectRef: 'oiqteedkfwmcertgxqga', authReachable: true,
    emailEnabled: settings.data.external?.email, emailAutoConfirm: settings.data.mailer_autoconfirm,
    signupDisabled: settings.data.disable_signup }));
  if (!process.argv.includes('--run')) return;

  if (process.argv.includes('--create-test-accounts')) {
    assert.equal(settings.data.mailer_autoconfirm, true, 'Confirmation is enabled: provision two confirmed disposable accounts as documented in docs/testing/hosted-verification.md; do not disable confirmation to use this flag');
    const credentialPath = path.join(appRoot, '.env.verification.local');
    const saved = readEnv(credentialPath);
    const runId = crypto.randomUUID().replaceAll('-', '');
    for (const letter of ['A', 'B']) {
      if (config[`PANTRY_TEST_${letter}_EMAIL`] && config[`PANTRY_TEST_${letter}_PASSWORD`]) continue;
      const email = `pf.verify.${runId}.${letter.toLowerCase()}@example.com`;
      const password = crypto.randomBytes(24).toString('base64url') + 'aA1!';
      const signup = successful(await request('/auth/v1/signup', { method: 'POST',
        body: { email, password, data: { name: `Verification ${letter}` } } }));
      assert.ok(signup.access_token && signup.user?.id, 'Signup did not produce a confirmed test account');
      saved[`PANTRY_TEST_${letter}_EMAIL`] = config[`PANTRY_TEST_${letter}_EMAIL`] = email;
      saved[`PANTRY_TEST_${letter}_PASSWORD`] = config[`PANTRY_TEST_${letter}_PASSWORD`] = password;
      fs.writeFileSync(credentialPath, '# Disposable verification accounts. Never commit this file.\n' +
        Object.entries(saved).map(([name, value]) => `${name}=${value}`).join('\n') + '\n');
      console.log(`Created disposable user ${letter}; credentials saved to the ignored local verification environment`);
      successful(await request('/auth/v1/logout?scope=local', { method: 'POST', token: signup.access_token }));
    }
  }

  for (const letter of ['A', 'B']) {
    const email = config[`PANTRY_TEST_${letter}_EMAIL`];
    const password = config[`PANTRY_TEST_${letter}_PASSWORD`];
    assert.ok(email && password, `Provide confirmed disposable user ${letter} in .env.verification.local`);
    const login = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    const session = successful(login);
    assert.ok(session.access_token && session.user?.id, `User ${letter} has no authenticated session`);
    sessions.push(session);
    const memberships = successful(await request(query('pantry_household_members', `user_id=eq.${session.user.id}&select=household_id`), { token: session.access_token }));
    assert.equal(memberships.length, 1, `User ${letter} needs exactly one household`);
    session.household = memberships[0].household_id;
    const profiles = successful(await request(query('profiles', `id=eq.${session.user.id}&select=*`), { token: session.access_token }));
    assert.equal(profiles.length, 1);
    originalProfiles.push({ session, profile: profiles[0] });
  }
  const [a, b] = sessions;
  assert.notEqual(a.user.id, b.user.id, 'Two distinct users are required');
  assert.notEqual(a.household, b.household, 'Test users must belong to separate households');
  const itemA = successful(await insert(a, `${prefix} Milk`))[0];
  const itemB = successful(await insert(b, `${prefix} Milk`))[0];

  await check('separate households may store identical names', async () => assert.equal(itemA.name, itemB.name));
  await check('case/whitespace duplicates are rejected through direct HTTP', async () => {
    for (const name of [itemA.name, itemA.name.toLowerCase(), `  ${itemA.name.toUpperCase()}  `]) duplicate(await insert(a, name));
    duplicate(await insert(a, itemA.name, { category: 'other', location: 'pantry', status: 'out' }));
  });
  await check('renaming to a duplicate fails; same-item edit succeeds', async () => {
    const other = successful(await insert(a, `${prefix} Other`))[0];
    duplicate(await patch(a, 'pantry_items', other.id, { name: itemA.name.toLowerCase() }));
    const edited = successful(await patch(a, 'pantry_items', itemA.id, { name: `  ${itemA.name}  `, status: 'low' }))[0];
    assert.equal(edited.name, itemA.name); assert.equal(edited.status, 'low');
  });
  await check('overlapping HTTP inserts have exactly one winner', async () => {
    const name = `${prefix} Eggs`;
    const outcomes = await Promise.all([insert(a, name), insert(a, ` ${name.toLowerCase()} `)]);
    assert.equal(outcomes.filter(result => result.ok).length, 1);
    duplicate(outcomes.find(result => !result.ok));
  });
  await check('overlapping HTTP renames have exactly one winner', async () => {
    const first = successful(await insert(a, `${prefix} Bread A`))[0];
    const second = successful(await insert(a, `${prefix} Bread B`))[0];
    const outcomes = await Promise.all([
      patch(a, 'pantry_items', first.id, { name: `${prefix} Bread` }),
      patch(a, 'pantry_items', second.id, { name: ` ${prefix.toLowerCase()} bread ` }),
    ]);
    assert.equal(outcomes.filter(result => result.ok).length, 1);
    duplicate(outcomes.find(result => !result.ok));
  });
  await check('household and profile isolation holds for both users', async () => {
    for (const [actor, owner, item] of [[a, b, itemB], [b, a, itemA]]) {
      assert.deepEqual(successful(await request(query('pantry_items', `id=eq.${item.id}&select=*`), { token: actor.access_token })), []);
      assert.deepEqual(successful(await patch(actor, 'pantry_items', item.id, { name: `${prefix} Unauthorized` })), []);
      assert.deepEqual(successful(await request(query('pantry_items', `id=eq.${item.id}&select=id`), {
        method: 'DELETE', token: actor.access_token, prefer: 'return=representation',
      })), []);
      assert.deepEqual(successful(await request(query('profiles', `id=eq.${owner.user.id}&select=*`), { token: actor.access_token })), []);
      assert.deepEqual(successful(await patch(actor, 'profiles', owner.user.id, { name: 'Unauthorized profile change' })), []);
      assert.deepEqual(successful(await request(query('pantry_household_members', `user_id=eq.${owner.user.id}&select=*`), { token: actor.access_token })), []);
      assert.deepEqual(successful(await request(query('pantry_households', `id=eq.${owner.household}&select=*`), { token: actor.access_token })), []);
      assert.equal(successful(await request(query('pantry_households', `id=eq.${actor.household}&select=id`), { token: actor.access_token })).length, 1);
      denied(await insert(actor, `${prefix} Foreign household`, { household_id: owner.household }));
    }
    assert.equal(successful(await request(query('pantry_items', `id=eq.${itemB.id}&select=*`), { token: b.access_token })).length, 1);
  });
  await check('ordinary users cannot grant themselves premium', async () => {
    for (const { session, profile } of originalProfiles) {
      const result = await patch(session, 'profiles', session.user.id, { is_premium: !profile.is_premium });
      if (result.ok) await patch(session, 'profiles', session.user.id, { is_premium: profile.is_premium });
      denied(result);
    }
  });
  await check('profile name/language updates remain allowed', async () => {
    const { profile } = originalProfiles[0];
    const changed = successful(await patch(a, 'profiles', a.user.id, { name: 'PantryFlow verification', language: profile.language === 'en' ? 'de' : 'en' }))[0];
    assert.equal(changed.name, 'PantryFlow verification');
    successful(await patch(a, 'profiles', a.user.id, { name: profile.name, language: profile.language }));
  });
  await check('creator spoofing and creator/household/timestamp updates are rejected', async () => {
    denied(await insert(a, `${prefix} Forged`, { created_by: b.user.id }));
    denied(await insert(a, `${prefix} Null`, { created_by: null }));
    for (const body of [{ created_by: b.user.id }, { household_id: b.household }, { updated_at: new Date().toISOString() }]) {
      denied(await patch(a, 'pantry_items', itemA.id, body));
    }
  });
  await check('invalid direct API values fail database checks', async () => {
    for (const [name, extra] of [['', {}], ['   ', {}], ['a'.repeat(121), {}],
      [`${prefix} Invalid category`, { category: 'invalid' }], [`${prefix} Invalid location`, { location: 'invalid' }],
      [`${prefix} Invalid status`, { status: 'invalid' }]]) {
      const rejected = await insert(a, name, extra);
      assert.equal(rejected.ok, false); assert.equal(rejected.data?.code, '23514');
    }
  });
  await check('CRUD persists all stock states and deletion returns to an empty result', async () => {
    const item = successful(await insert(a, `${prefix} CRUD`))[0];
    assert.equal(item.status, 'in_stock');
    for (const status of ['low', 'out', 'in_stock']) {
      successful(await patch(a, 'pantry_items', item.id, { status }));
      const saved = successful(await request(query('pantry_items', `id=eq.${item.id}&select=*`), { token: a.access_token }));
      assert.equal(saved[0].status, status);
    }
    successful(await request(query('pantry_items', `id=eq.${item.id}&select=id`), {
      method: 'DELETE', token: a.access_token, prefer: 'return=representation',
    }));
    assert.deepEqual(successful(await request(query('pantry_items', `id=eq.${item.id}&select=*`), { token: a.access_token })), []);
  });
  await check('anonymous requests cannot read or insert test inventory', async () => {
    assert.deepEqual(successful(await request(query('pantry_items', `id=eq.${itemA.id}&select=*`))), []);
    denied(await request(query('pantry_items', 'select=*'), { method: 'POST', body: ownItem(a, `${prefix} Anonymous`) }));
  });
  await check('refresh restores a session and logout invalidates its refresh token', async () => {
    const refreshed = successful(await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: a.refresh_token },
    }));
    assert.equal(refreshed.user.id, a.user.id);
    a.access_token = refreshed.access_token;
    a.refresh_token = refreshed.refresh_token;
    // Use the second login for this check, retaining the primary session for cleanup.
    const login = successful(await request('/auth/v1/token?grant_type=password', { method: 'POST',
      body: { email: config.PANTRY_TEST_A_EMAIL, password: config.PANTRY_TEST_A_PASSWORD } }));
    successful(await request('/auth/v1/logout?scope=local', { method: 'POST', token: login.access_token }));
    const revoked = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: login.refresh_token } });
    assert.equal(revoked.ok, false);
  });
}

async function cleanup() {
  const failures = [];
  for (const { session, profile } of originalProfiles) {
    try { successful(await patch(session, 'profiles', session.user.id, { name: profile.name, language: profile.language })); }
    catch { failures.push('Could not restore a test profile'); }
  }
  // Delete only exact IDs returned by this run; never delete an existing item.
  for (const { id, session } of created) {
    try {
      const candidates = [session, ...sessions.filter(other => other !== session)];
      for (const actor of candidates) successful(await request(query('pantry_items', `id=eq.${id}&select=id`), {
        method: 'DELETE', token: actor.access_token, prefer: 'return=representation',
      }));
      for (const actor of sessions) assert.deepEqual(successful(await request(query('pantry_items', `id=eq.${id}&select=id`), {
        token: actor.access_token,
      })), []);
    } catch { failures.push(`Could not remove test item ${id}`); }
  }
  for (const session of sessions) {
    try { successful(await request('/auth/v1/logout?scope=local', { method: 'POST', token: session.access_token })); }
    catch { failures.push('Could not sign out a test session'); }
  }
  return failures;
}

(async () => {
  let fatal;
  try { await run(); } catch (error) { fatal = error.message; console.error(fatal); }
  const cleanupFailures = process.argv.includes('--run') ? await cleanup() : [];
  if (process.argv.includes('--run')) {
    const report = { projectRef: 'oiqteedkfwmcertgxqga', timestamp: new Date().toISOString(), results,
      fatal: fatal ?? null, cleanupFailures, testItemIds: cleanupFailures.length ? created.map(item => item.id) : [] };
    const reportDir = path.join(appRoot, '.verification');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'hosted-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: results.filter(result => result.status === 'passed').length,
      failed: results.filter(result => result.status === 'failed').length, fatal: !!fatal, cleanupFailures: cleanupFailures.length }));
  }
  if (fatal || cleanupFailures.length || results.some(result => result.status === 'failed')) process.exitCode = 1;
})();
