const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');
const theme = load('lib/theme.ts');
const parser = load('lib/email-confirmation.ts', {
  'expo-linking': {}, './supabase': {}, './native-auth-crypto': {},
}).confirmationCode;
const shared = {
  'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'Spinner', ScrollView: 'ScrollView', StyleSheet: { create: x => x } },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  '@/components/Button': { Button: 'Button' }, '@/components/Input': { Input: 'Input' },
  '@/lib/theme': theme, '@/lib/i18n': { useTranslation: () => ({ t: x => x }) },
};

test('callback waits for restoration, exchanges once, and navigates only after completion despite auth events', async () => {
  const pending = deferred();
  const routes = [];
  const router = { replace: path => routes.push(path) };
  let auth = { loading: true, user: null }, exchanges = 0;
  const Screen = load('app/auth/callback.tsx', { ...shared,
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({ code: 'real-code' }) },
    '@/lib/auth': { useAuth: () => auth },
    '@/lib/email-confirmation': { confirmationCode: parser, confirmEmail: () => { exchanges++; return pending.promise; } },
  }).default;
  let view;
  try {
    act(() => { view = create(React.createElement(Screen)); });
    assert.equal(exchanges, 0);
    auth = { loading: false, user: null };
    act(() => view.update(React.createElement(Screen)));
    assert.equal(exchanges, 1);
    assert.deepEqual(routes, []);
    auth = { loading: false, user: { id: 'verified' } };
    act(() => view.update(React.createElement(Screen)));
    assert.equal(exchanges, 1);
    await act(async () => pending.resolve());
    assert.deepEqual(routes, ['/(tabs)']);
  } finally { if (view) act(() => view.unmount()); }
});

test('invalid/expired callback provides translated recovery without exposing raw link errors or signing in', async () => {
  const routes = [];
  let params = { error: 'access_denied', error_description: 'private-token-value' }, calls = 0;
  const router = { replace: path => routes.push(path) };
  const Screen = load('app/auth/callback.tsx', { ...shared,
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => params },
    '@/lib/auth': { useAuth: () => ({ loading: false, user: null }) },
    '@/lib/email-confirmation': { confirmationCode: parser, confirmEmail: async () => { calls++; throw new Error('expired'); } },
  }).default;
  let view;
  try {
    await act(async () => { view = create(React.createElement(Screen)); });
    assert.equal(calls, 0);
    assert.match(JSON.stringify(view.toJSON()), /auth_confirmation_invalid/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()), /private-token-value/);
    act(() => view.root.findAllByType('Button').find(b => b.props.testID === 'confirmation-recover').props.onPress());
    assert.deepEqual(routes, ['/(auth)/confirm-email']);
    params = { code: 'expired-code' };
    await act(async () => view.update(React.createElement(Screen)));
    assert.equal(calls, 1);
    assert.match(JSON.stringify(view.toJSON()), /auth_confirmation_invalid/);
    assert.equal(routes.includes('/(tabs)'), false);
  } finally { if (view) act(() => view.unmount()); }
});

test('resend UI blocks double submits, recovers from rate limits, and shows privacy-preserving success/cooldown', async () => {
  let request = deferred(), calls = 0;
  const Screen = load('app/(auth)/confirm-email.tsx', { ...shared,
    'expo-router': { useRouter: () => ({ replace() {} }) },
    '@/lib/email-confirmation': { resendConfirmation: () => { calls++; return request.promise; } },
  }).default;
  let view;
  const button = () => view.root.findAllByType('Button').find(b => b.props.testID === 'confirmation-resend');
  try {
    act(() => { view = create(React.createElement(Screen)); });
    act(() => view.root.findByType('Input').props.onChangeText('a@example.com'));
    let first, second;
    act(() => { first = button().props.onPress(); second = button().props.onPress(); });
    assert.equal(calls, 1);
    await act(async () => { request.reject({ status: 429 }); await Promise.all([first, second]); });
    assert.equal(view.root.findByType('Input').props.error, 'err_confirmation_rate_limit');
    assert.equal(button().props.loading, false);
    request = deferred();
    let retry;
    act(() => { retry = button().props.onPress(); });
    await act(async () => { request.resolve(); await retry; });
    assert.equal(calls, 2);
    assert.match(JSON.stringify(view.toJSON()), /auth_confirmation_sent/);
    assert.equal(button().props.disabled, true);
  } finally { if (view) act(() => view.unmount()); }
});
