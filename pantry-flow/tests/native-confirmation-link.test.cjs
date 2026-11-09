const test = require('node:test');
const assert = require('node:assert/strict');
const { load, deferred } = require('./helpers.cjs');

test('Android slow initial-URL bridge still routes the cached confirmation to code exchange', async () => {
  const previousWindow = global.window;
  global.window = {};
  const bridge = deferred();
  const callback = 'pantryflowtest://auth/callback?code=local-regression-code';
  const linking = {
    createURL: path => `pantryflowtest://${path}`,
    getLinkingURL: () => callback,
    clearInitialURL() {},
  };
  try {
    // Execute the installed Router boundary that produced a root fallback on
    // the physical device; the native listener already holds the incoming URL.
    const router = load('node_modules/expo-router/build/fork/getInitialURLWithTimeout.js', {
      'react-native': { Platform: { OS: 'android' }, Linking: { getInitialURL: () => bridge.promise } },
      'expo-linking': linking,
    });
    assert.equal(await router.getInitialURLWithTimeout(), null);
    const intent = load('app/+native-intent.tsx', {
      'react-native-url-polyfill/auto': {},
      'react-native': { Platform: { OS: 'android' } }, 'expo-linking': linking,
    });
    const routed = intent.redirectSystemPath({ path: linking.createURL('/'), initial: true });
    assert.equal(routed, callback, 'a slow bridge must not replace the received confirmation with login');
  } finally {
    bridge.resolve(callback);
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  }
});

test('cached native links cannot replace other routes, platforms or foreign callback targets', () => {
  for (const scheme of ['pantryflow', 'pantryflowtest']) {
    let pending = `${scheme}://auth/callback?code=local-code`;
    let clears = 0;
    const linking = { createURL: path => `${scheme}://${path}`, getLinkingURL: () => pending,
      clearInitialURL: () => { clears++; pending = null; } };
    const android = load('app/+native-intent.tsx', {
      'react-native-url-polyfill/auto': {},
      'react-native': { Platform: { OS: 'android' } }, 'expo-linking': linking,
    });
    for (const path of [`${scheme}://settings`, `${scheme}:///?other=route`]) {
      assert.equal(android.redirectSystemPath({ path, initial: true }), path);
    }
    assert.equal(android.redirectSystemPath({ path: '/', initial: false }), '/');
    assert.equal(clears, 0);
    const ios = load('app/+native-intent.tsx', {
      'react-native-url-polyfill/auto': {},
      'react-native': { Platform: { OS: 'ios' } }, 'expo-linking': linking,
    });
    assert.equal(ios.redirectSystemPath({ path: '/', initial: true }), '/');
    for (pending of [null, 'not a URL', 'https://example.com/auth/callback?code=local-code',
      'other://auth/callback?code=local-code', `${scheme}://other/callback?code=local-code`,
      `${scheme}://auth/other?code=local-code`, `${scheme}://user@auth/callback?code=local-code`]) {
      assert.equal(android.redirectSystemPath({ path: '/', initial: true }), '/');
    }
    assert.equal(clears, 0);
    pending = `${scheme}://auth/callback#error=access_denied&error_code=otp_expired`;
    const expired = pending;
    assert.equal(android.redirectSystemPath({ path: '/', initial: true }), expired);
    assert.equal(clears, 1);
    assert.equal(android.redirectSystemPath({ path: '/', initial: true }), '/');
    const direct = `${scheme}://auth/callback?code=direct-code`;
    assert.equal(android.redirectSystemPath({ path: direct, initial: false }), direct);
    assert.equal(clears, 2);
  }
});

test('unavailable native link API leaves ordinary startup recoverable', () => {
  const intent = load('app/+native-intent.tsx', {
    'react-native-url-polyfill/auto': {},
    'react-native': { Platform: { OS: 'android' } },
    'expo-linking': { createURL: path => `pantryflow://${path}`, getLinkingURL() { throw Error('Native unavailable'); } },
  });
  assert.equal(intent.redirectSystemPath({ path: '/', initial: true }), '/');
});
