const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const ref = 'oiqteedkfwmcertgxqga';

test('manual email builder refuses another project before loading or building app artifacts', () => {
  const result = spawnSync(process.execPath, ['scripts/build-email-validation.cjs', '--project-ref', 'another-project'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Explicit intended project reference required/);
  assert.doesNotMatch(result.stdout, /Built isolated/);
});

test('manual email builder rejects modern secret and legacy service-role keys before any build', () => {
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  for (const key of ['sb_secret_fixture_not_a_real_key', jwt]) {
    const result = spawnSync(process.execPath, ['scripts/build-email-validation.cjs', '--project-ref', ref], {
      cwd: root, encoding: 'utf8', env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, EXPO_PUBLIC_SUPABASE_ANON_KEY: key },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Never bundle/);
    assert.doesNotMatch(result.stdout, /Built isolated/);
  }
});
