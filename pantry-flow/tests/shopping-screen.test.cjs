const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');
const theme = load('lib/theme.ts');
const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', SectionList: 'SectionList',
  Pressable: 'Pressable', StyleSheet: { create: styles => styles } };
const t = key => key;
const shared = { 'react-native': native, '@/lib/theme': theme, '@expo/vector-icons': { Ionicons: 'Icon' },
  '@/lib/i18n': { useTranslation: () => ({ t }) }, '@/components/Button': { Button: 'Button' }, '@/components/Input': { Input: 'Input' },
  '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/ShoppingItem': { ShoppingItem: 'Row' },
  '@/lib/shopping-data': load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') }) };

const row = (id, over = {}) => ({ id, household_id: 'h', pantry_item_id: null, name: id, is_checked: false,
  completed_at: null, created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01', ...over });
const done = (id, at) => row(id, { is_checked: true, completed_at: at });

function render(state) {
  const { default: Screen } = load('app/(tabs)/shopping.tsx', { ...shared,
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ items: [], loading: false, error: null, retry: () => {}, ...state }) } });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  return renderer;
}

test('initial shopping load shows progress without claiming an empty list', () => {
  const r = render({ loading: true });
  try {
    assert.equal(r.root.findAllByType('Spinner').length, 1);
    assert.equal(r.root.findAllByType('EmptyState').length, 0);
  } finally { act(() => r.unmount()); }
});

test('a refresh keeps the visible list instead of a spinner', () => {
  const r = render({ loading: true, items: [row('a')] });
  try {
    assert.equal(r.root.findAllByType('SectionList').length, 1);
    assert.equal(r.root.findAllByType('Spinner').length, 0);
  } finally { act(() => r.unmount()); }
});

test('a failed load shows the error with retry, not an empty list', () => {
  let retries = 0;
  const r = render({ error: 'err_load_shopping', retry: () => { retries++; } });
  try {
    const alert = r.root.findAll(n => n.type === 'Text' && n.props.accessibilityRole === 'alert');
    assert.equal(alert.length, 1);
    assert.match(JSON.stringify(alert[0].props.children), /err_load_shopping/);
    assert.equal(r.root.findAllByType('EmptyState').length, 0);
    act(() => r.root.findByProps({ testID: 'shopping-retry' }).props.onPress());
    assert.equal(retries, 1);
  } finally { act(() => r.unmount()); }
});

test('an empty list shows the empty state without an add action', () => {
  const r = render({});
  try {
    const props = r.root.findByType('EmptyState').props;
    assert.equal(props.title, 'shopping_empty_title');
    assert.equal(props.subtitle, 'shopping_empty_subtitle');
    assert.equal(props.ctaLabel, undefined);
  } finally { act(() => r.unmount()); }
});

test('open items come before completed items, each under its heading', () => {
  const r = render({ items: [done('d1', '2026-01-02'), row('o'), done('d2', '2026-01-03')] });
  try {
    const list = r.root.findByType('SectionList').props;
    assert.deepEqual(list.sections.map(s => s.data.map(i => i.id)), [['o'], ['d2', 'd1']]);
    assert.deepEqual(list.sections.map(s => s.key), ['open', 'completed']);
    assert.deepEqual(list.sections.map(s => s.title), ['shopping_section_open', 'shopping_section_completed']);
    assert.equal(list.renderItem({ item: row('o') }).props.item.is_checked, false);
    assert.equal(list.renderItem({ item: done('d', 'x') }).props.item.is_checked, true);
    const header = list.renderSectionHeader({ section: list.sections[1] });
    assert.equal(header.props.testID, 'shopping-section-completed');
  } finally { act(() => r.unmount()); }
  const r2 = render({ items: [row('o')] });
  try {
    assert.deepEqual(r2.root.findByType('SectionList').props.sections.map(s => s.key), ['open']);
  } finally { act(() => r2.unmount()); }
});

// ---- Inline add ----
// Node string stubs: these pin the screen's wiring and contract props. They do not
// establish real Android keyboard behaviour (Maestro covers that).
function renderAdd(state) {
  const focusCalls = [];
  const focusStub = React.forwardRef((props, ref) => {
    const handle = { focus: () => focusCalls.push('focus') };
    if (typeof ref === 'function') ref(handle); else if (ref) ref.current = handle;
    return React.createElement('Input', props);
  });
  const cleanups = [];
  const { default: Screen } = load('app/(tabs)/shopping.tsx', { ...shared,
    '@/components/Input': { Input: focusStub },
    'expo-router': { useFocusEffect: effect => { cleanups.push(effect); } },
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ householdId: 'h', items: [], loading: false,
      error: null, retry: () => {}, addItem: async () => row('new'), ...state }) } });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  const input = () => renderer.root.findByType('Input');
  const submit = () => renderer.root.findByProps({ testID: 'shopping-add-submit' });
  return { renderer, input, submit, focusCalls, cleanups };
}

test('adding submits the typed name once, clears the field and keeps focus', async () => {
  const calls = []; const d = deferred();
  const { renderer, input, submit, focusCalls } = renderAdd({ addItem: arg => { calls.push(arg); return d.promise; } });
  try {
    assert.equal(input().props.testID, 'shopping-add-input');
    assert.equal(input().props.placeholder, 'shopping_add_placeholder');
    assert.equal(input().props.submitBehavior, 'submit');
    assert.equal(submit().props.label, 'shopping_add_button');
    act(() => input().props.onChangeText(' Milk '));
    act(() => { submit().props.onPress(); submit().props.onPress(); });
    assert.deepEqual(calls, [{ name: ' Milk ' }]);
    await act(async () => { d.resolve(row('m')); await d.promise; });
    assert.equal(input().props.value, '');
    act(() => input().props.onChangeText('Eggs'));
    await act(async () => { input().props.onSubmitEditing(); });
    assert.deepEqual(calls, [{ name: ' Milk ' }, { name: 'Eggs' }]);
    assert.deepEqual(focusCalls, []);
  } finally { act(() => renderer.unmount()); }
});

test('a rejected add keeps the text and shows the translated error', async () => {
  let fail = true;
  const { renderer, input, submit } = renderAdd({ addItem: async () => {
    if (fail) throw Object.assign(new Error('dup'), { code: '23505' });
    return row('m');
  } });
  try {
    act(() => input().props.onChangeText(' Milk '));
    await act(async () => { submit().props.onPress(); });
    assert.equal(input().props.value, ' Milk ');
    assert.equal(input().props.error, 'err_duplicate_shopping_item');
    fail = false;
    await act(async () => { submit().props.onPress(); });
    assert.equal(input().props.value, '');
    assert.equal(input().props.error, null);
  } finally { act(() => renderer.unmount()); }
});

test('an add still clears the field when focus changes during the request', async () => {
  const d = deferred();
  const { renderer, input, submit, cleanups } = renderAdd({ addItem: () => d.promise });
  try {
    act(() => input().props.onChangeText('Milk'));
    act(() => { submit().props.onPress(); });
    for (const effect of cleanups) { const cleanup = effect(); if (typeof cleanup === 'function') cleanup(); }
    await act(async () => { d.resolve(row('m')); await d.promise; });
    assert.equal(input().props.value, '');
  } finally { act(() => renderer.unmount()); }
});

test('text typed while an add is in flight is kept', async () => {
  const d = deferred();
  const { renderer, input, submit } = renderAdd({ addItem: () => d.promise });
  try {
    act(() => input().props.onChangeText('Milk'));
    act(() => { submit().props.onPress(); });
    assert.notEqual(input().props.editable, false);
    act(() => input().props.onChangeText('Eggs'));
    assert.notEqual(input().props.editable, false);
    await act(async () => { d.resolve(row('m')); await d.promise; });
    assert.equal(input().props.value, 'Eggs');
  } finally { act(() => renderer.unmount()); }
});

test('the add bar never moves focus itself', async () => {
  let fail = false;
  const { renderer, input, submit, focusCalls } = renderAdd({ addItem: async () => {
    if (fail) throw new Error('boom');
    return row('m');
  } });
  try {
    act(() => input().props.onChangeText('Milk'));
    await act(async () => { submit().props.onPress(); });
    fail = true;
    act(() => input().props.onChangeText('Eggs'));
    await act(async () => { submit().props.onPress(); });
    assert.deepEqual(focusCalls, []);
  } finally { act(() => renderer.unmount()); }
});

test('Add is disabled without a household', () => {
  const { renderer, submit } = renderAdd({ householdId: null });
  try { assert.equal(submit().props.disabled, true); } finally { act(() => renderer.unmount()); }
});

test('the add bar shows with items and empty, not in the error or loading states', () => {
  for (const state of [{ items: [row('a')] }, {}]) {
    const { renderer, input } = renderAdd(state);
    try { assert.equal(input().props.testID, 'shopping-add-input'); } finally { act(() => renderer.unmount()); }
  }
  for (const state of [{ error: 'err_load_shopping' }, { loading: true }]) {
    const { renderer } = renderAdd(state);
    try { assert.equal(renderer.root.findAllByType('Input').length, 0); } finally { act(() => renderer.unmount()); }
  }
});

test('the list keeps the first tap with the keyboard open', () => {
  const { renderer } = renderAdd({ items: [row('a')] });
  try {
    assert.equal(renderer.root.findByType('SectionList').props.keyboardShouldPersistTaps, 'handled');
  } finally { act(() => renderer.unmount()); }
});
