const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

test('native background stops refresh and returning active restarts it', () => {
  const events = [];
  let change;
  const saved = { url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'local-test-only';
  try {
    load('lib/supabase.ts', {
      'react-native-url-polyfill/auto': {},
      'react-native': { Platform: { OS: 'android' }, AppState: {
        currentState: 'active', addEventListener: (_, callback) => { change = callback; },
      } },
      '@react-native-async-storage/async-storage': {},
      '@supabase/supabase-js': { createClient: () => ({ auth: {
        startAutoRefresh: () => events.push('refreshing'), stopAutoRefresh: () => events.push('stopped'),
      } }) },
    });
    change('background'); change('inactive'); change('active');
    assert.deepEqual(events, ['refreshing', 'stopped', 'stopped', 'refreshing']);
  } finally {
    for (const [name, value] of [['EXPO_PUBLIC_SUPABASE_URL', saved.url], ['EXPO_PUBLIC_SUPABASE_ANON_KEY', saved.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
