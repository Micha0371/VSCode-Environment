import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLocalStatus } from './local-stack';

test('local test harness rejects hosted targets before creating a client', () => {
  for (const API_URL of ['https://oiqteedkfwmcertgxqga.supabase.co', 'http://example.com:54321', 'http://127.0.0.1:9999']) {
    assert.throws(() => validateLocalStatus({ API_URL, ANON_KEY: 'x', SERVICE_ROLE_KEY: 'y' }), /Refusing/);
  }
  assert.doesNotThrow(() => validateLocalStatus({ API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'x', SERVICE_ROLE_KEY: 'y' }));
});
