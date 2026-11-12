const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { fork } = require('node:child_process');

// Drives the real test proxy against a stub upstream on free ports, so a running
// local stack on 54321/54329 is never touched.
async function start() {
  const seen = [];
  const upstream = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('[]');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const proxy = fork(path.join(__dirname, '../scripts/e2e-proxy.cjs'), [], {
    env: { ...process.env, PANTRY_PROXY_PORT: '0', PANTRY_PROXY_UPSTREAM_PORT: String(upstream.address().port) },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const port = await new Promise((resolve, reject) => {
    proxy.once('message', message => resolve(message.port));
    proxy.once('exit', code => reject(Error(`proxy exited ${code}`)));
  });
  const call = (method, url) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, method }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end(method === 'GET' ? undefined : '{}');
  });
  const stop = () => { proxy.kill(); upstream.close(); };
  return { call, seen, stop };
}

const shopping = '/rest/v1/pantry_shopping_items?select=*';
const pantry = '/rest/v1/pantry_items?select=*';

test('the shopping read fault fails only shopping reads until restore', async () => {
  const { call, seen, stop } = await start();
  try {
    assert.equal(await call('GET', '/__test/fail-shopping-reads'), 200);
    assert.equal(await call('GET', shopping), 503);
    assert.equal(await call('GET', pantry), 200);
    assert.equal(await call('POST', shopping), 200);
    assert.equal(await call('PATCH', shopping), 200);
    assert.equal(await call('GET', '/__test/restore'), 200);
    assert.equal(await call('GET', shopping), 200);
    assert.deepEqual(seen, [`GET ${pantry}`, `POST ${shopping}`, `PATCH ${shopping}`, `GET ${shopping}`]);
  } finally { stop(); }
});

test('the pantry read fault still leaves shopping reads alone', async () => {
  const { call, stop } = await start();
  try {
    await call('GET', '/__test/fail-reads');
    assert.equal(await call('GET', pantry), 503);
    assert.equal(await call('GET', shopping), 200);
    await call('GET', '/__test/restore');
    assert.equal(await call('GET', pantry), 200);
  } finally { stop(); }
});
