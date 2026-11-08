const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('hosted runner refuses another project and administrative keys before making requests', () => {
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  for (const overrides of [
    { EXPO_PUBLIC_SUPABASE_URL: 'https://other-project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://oiqteedkfwmcertgxqga.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_test' },
    { EXPO_PUBLIC_SUPABASE_URL: 'https://oiqteedkfwmcertgxqga.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt },
  ]) {
    const result = spawnSync(process.execPath, ['scripts/verify-hosted.cjs', '--preflight'], {
      cwd: path.join(__dirname, '..'), env: { ...process.env, ...overrides }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unexpected project|Only publishable or legacy anon keys/);
    assert.doesNotMatch(result.stdout + result.stderr, /signature|sb_secret_test/);
  }
});
