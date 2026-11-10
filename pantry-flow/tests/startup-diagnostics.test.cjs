const test = require('node:test');
const assert = require('node:assert/strict');
const { redactStartupLog } = require('../scripts/redact-startup-log.cjs');

test('startup diagnostics preserve the actual port failure while removing test credentials', () => {
  const failure = 'failed to bind host port 0.0.0.0:54324/tcp: address already in use';
  const result = redactStartupLog([
    'Pull complete', failure,
    'ANON_KEY=eyJfixture.payload.signature',
    'service_role: private-fixture-value',
    'Publishable | sb_publishable_fixture',
    'Secret | sb_secret_fixture',
    'opaque value eyJother.payload.signature',
    'Authorization: Bearer private-value',
  ].join('\n'));
  assert.match(result, /address already in use/);
  assert.ok(result.includes(failure));
  assert.match(result, /Pull complete/);
  assert.doesNotMatch(result, /private-fixture|sb_publishable_fixture|sb_secret_fixture|eyJfixture|eyJother|Bearer private-value/);
  assert.equal(redactStartupLog(result), result);
});
