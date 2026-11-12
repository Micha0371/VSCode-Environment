const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

const theme = load('lib/theme.ts');
const data = load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') });
const mutation = load('hooks/useItemMutation.ts', { 'expo-router': { useFocusEffect: () => {} } });
const t = key => key;
const existing = { id: '1', household_id: 'h', pantry_item_id: null, name: 'Milk', is_checked: false,
  completed_at: null, created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01' };

function render({ state = {} } = {}) {
  const log = { back: 0, alerts: [] };
  const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', Pressable: 'Pressable',
    ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' },
    Alert: { alert: (...args) => log.alerts.push(args) }, StyleSheet: { create: s => s } };
  const { default: Screen } = load('app/shopping-item/[id].tsx', {
    'react-native': native, '@/lib/theme': theme, '@/lib/i18n': { useTranslation: () => ({ t }) },
    'expo-router': { useRouter: () => ({ back: () => { log.back++; } }), useLocalSearchParams: () => ({ id: '1' }) },
    '@/components/Button': { Button: 'Button' }, '@/components/Input': { Input: 'Input' },
    '@/components/AuthGate': { AuthGate: ({ children }) => children },
    '@/hooks/useItemMutation': mutation, '@/lib/shopping-data': data,
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ loading: false, error: null, retry: () => {},
      getItem: () => existing, renameItem: async () => {}, deleteItem: async () => {}, ...state }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  const by = id => renderer.root.findByProps({ testID: id });
  return { renderer, log, by, field: () => by('shopping-edit-name') };
}
const destructive = log => log.alerts.at(-1)[2].find(b => b.style === 'destructive');

test('the modal shows the current name and saves a rename, then closes', async () => {
  const calls = [];
  const { renderer, log, by, field } = render({ state: { renameItem: async (id, name) => { calls.push([id, name]); } } });
  try {
    assert.equal(field().props.value, 'Milk');
    act(() => field().props.onChangeText('Oat milk'));
    await act(async () => by('shopping-edit-save').props.onPress());
    assert.deepEqual(calls, [['1', 'Oat milk']]);
    assert.equal(log.back, 1);
  } finally { act(() => renderer.unmount()); }
});

test('a duplicate rename keeps the modal open with the typed name', async () => {
  const { renderer, log, by, field } = render({ state: { renameItem: async () => { throw { code: '23505' }; } } });
  try {
    await act(async () => by('shopping-edit-save').props.onPress());
    assert.equal(field().props.error, 'err_duplicate_shopping_item');
    assert.equal(field().props.value, 'Milk');
    assert.equal(log.back, 0);
  } finally { act(() => renderer.unmount()); }
});

test('remove asks for confirmation and deletes only on confirm', async () => {
  const calls = [];
  const { renderer, log, by } = render({ state: { deleteItem: async id => { calls.push(id); } } });
  try {
    act(() => by('shopping-edit-remove').props.onPress());
    assert.equal(log.alerts.length, 1);
    const [title, message, buttons] = log.alerts[0];
    assert.equal(title, 'shopping_remove_confirm_title');
    assert.equal(message, 'shopping_remove_confirm_message');
    const cancel = buttons.find(b => b.style === 'cancel');
    assert.equal(cancel.text, 'common_cancel');
    assert.equal(destructive(log).text, 'shopping_remove');
    assert.equal(cancel.onPress, undefined);
    assert.deepEqual(calls, []);
    await act(async () => destructive(log).onPress());
    assert.deepEqual(calls, ['1']);
    assert.equal(log.back, 1);
  } finally { act(() => renderer.unmount()); }
});

test('a failed remove shows the translated error and stays open', async () => {
  const { renderer, log, by, field } = render({ state: { deleteItem: async () => { throw { code: '42501' }; } } });
  try {
    act(() => by('shopping-edit-remove').props.onPress());
    await act(async () => destructive(log).onPress());
    assert.equal(field().props.error, 'err_shopping_permission');
    assert.equal(log.back, 0);
  } finally { act(() => renderer.unmount()); }
});

test('save and remove share one lock', async () => {
  const d = deferred(); const writes = [];
  const { renderer, log, by } = render({ state: {
    renameItem: async () => { writes.push('rename'); await d.promise; },
    deleteItem: async () => { writes.push('delete'); } } });
  try {
    act(() => { by('shopping-edit-save').props.onPress(); });
    act(() => by('shopping-edit-remove').props.onPress());
    if (log.alerts.length) await act(async () => destructive(log).onPress());
    assert.deepEqual(writes, ['rename']);
    await act(async () => { d.resolve(); await d.promise; });
    assert.deepEqual(writes, ['rename']);
  } finally { act(() => renderer.unmount()); }
});

test('a missing item shows the missing message with retry and back', () => {
  let retries = 0;
  const { renderer, log } = render({ state: { getItem: () => null, retry: () => { retries++; } } });
  try {
    const alert = renderer.root.findAll(n => n.type === 'Text' && n.props.accessibilityRole === 'alert');
    assert.equal(alert.length, 1);
    assert.match(JSON.stringify(alert[0].props.children), /err_shopping_missing/);
    const buttons = renderer.root.findAllByType('Button');
    act(() => buttons.find(b => b.props.label === 'common_retry').props.onPress());
    act(() => buttons.find(b => b.props.label === 'common_back').props.onPress());
    assert.equal(retries, 1);
    assert.equal(log.back, 1);
  } finally { act(() => renderer.unmount()); }
});

test('a load error replaces the missing message', () => {
  const { renderer } = render({ state: { getItem: () => null, error: 'err_load_shopping' } });
  try {
    assert.match(JSON.stringify(renderer.toJSON()), /err_load_shopping/);
  } finally { act(() => renderer.unmount()); }
});

test('loading without an item shows progress', () => {
  const { renderer } = render({ state: { getItem: () => null, loading: true } });
  try { assert.equal(renderer.root.findAllByType('Spinner').length, 1); } finally { act(() => renderer.unmount()); }
});

test('the form keeps the first tap with the keyboard open', () => {
  const { renderer } = render();
  try {
    assert.equal(renderer.root.findByType('ScrollView').props.keyboardShouldPersistTaps, 'handled');
  } finally { act(() => renderer.unmount()); }
});

test('cancel closes without writing', () => {
  const { renderer, log, by } = render();
  try { act(() => by('shopping-edit-cancel').props.onPress()); assert.equal(log.back, 1); } finally { act(() => renderer.unmount()); }
});
