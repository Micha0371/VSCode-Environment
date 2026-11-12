const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');
const theme = load('lib/theme.ts');
const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', SectionList: 'SectionList',
  Pressable: 'Pressable', StyleSheet: { create: styles => styles } };
const t = key => key;
const pushes = [];
const shared = { 'expo-router': { useRouter: () => ({ push: route => pushes.push(route) }) }, 'react-native': native, '@/lib/theme': theme, '@expo/vector-icons': { Ionicons: 'Icon' },
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
  const { default: Screen } = load('app/(tabs)/shopping.tsx', { ...shared,
    '@/components/Input': { Input: focusStub },
    'expo-router': { useRouter: () => ({ push: route => pushes.push(route) }) },
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ householdId: 'h', items: [], loading: false,
      error: null, retry: () => {}, addItem: async () => row('new'), ...state }) } });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  const input = () => renderer.root.findByType('Input');
  const submit = () => renderer.root.findByProps({ testID: 'shopping-add-submit' });
  return { renderer, input, submit, focusCalls };
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

test('keyboard submit without a household does not add', async () => {
  const calls = [];
  const { renderer, input } = renderAdd({ householdId: null, addItem: async arg => { calls.push(arg); return row('m'); } });
  try {
    act(() => input().props.onChangeText('Milk'));
    await act(async () => { input().props.onSubmitEditing(); });
    assert.deepEqual(calls, []);
  } finally { act(() => renderer.unmount()); }
});

test('the add field limits the name length like the edit modal', () => {
  const { renderer, input } = renderAdd({});
  try { assert.equal(input().props.maxLength, 120); } finally { act(() => renderer.unmount()); }
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

// ---- Complete and reopen ----
function renderToggle(state) {
  const r = renderAdd(state);
  const rowProps = item => r.renderer.root.findByType('SectionList').props.renderItem({ item }).props;
  const alerts = () => r.renderer.root.findAll(n => n.props.testID === 'shopping-action-error');
  return { ...r, rowProps, alerts };
}

test('tapping an open item\'s circle completes it once even on a double tap', async () => {
  const calls = []; const d = deferred();
  const item = row('1');
  const { renderer, rowProps, alerts } = renderToggle({ items: [item], completeItem: id => { calls.push(id); return d.promise; } });
  try {
    act(() => { rowProps(item).onToggle(); rowProps(item).onToggle(); });
    assert.deepEqual(calls, ['1']);
    assert.equal(alerts().length, 0);
    assert.equal(rowProps(item).pending, true);
    await act(async () => { d.resolve(); await d.promise; });
    assert.equal(rowProps(item).pending, false);
    assert.equal(alerts().length, 0);
  } finally { act(() => renderer.unmount()); }
});

test('tapping a completed item\'s circle reopens it', async () => {
  const calls = [];
  const item = done('1', '2026-01-02');
  const { renderer, rowProps } = renderToggle({ items: [item],
    completeItem: async () => { calls.push('complete'); }, reopenItem: async id => { calls.push(`reopen:${id}`); } });
  try {
    await act(async () => { rowProps(item).onToggle(); });
    assert.deepEqual(calls, ['reopen:1']);
  } finally { act(() => renderer.unmount()); }
});

test('a failed toggle shows the translated error and keeps the list', async () => {
  let fail = true;
  const items = [row('1')];
  const { renderer, rowProps, alerts } = renderToggle({ items, completeItem: async () => {
    if (fail) throw Object.assign(new Error('gone'), { code: 'PGRST116' });
  } });
  try {
    await act(async () => { rowProps(items[0]).onToggle(); });
    assert.equal(alerts().length, 1);
    assert.equal(alerts()[0].props.accessibilityRole, 'alert');
    assert.match(JSON.stringify(alerts()[0].props.children), /err_shopping_missing/);
    assert.equal(renderer.root.findByType('SectionList').props.sections[0].data[0], items[0]);
    assert.equal(rowProps(items[0]).pending, false);
    // A later successful toggle does not hide the failure; only a new start clears it.
    fail = false;
    await act(async () => { rowProps(items[0]).onToggle(); });
    assert.equal(alerts().length, 0);
  } finally { act(() => renderer.unmount()); }
});

test('a successful add clears a stale toggle error', async () => {
  const items = [row('1')];
  const { renderer, rowProps, alerts, input } = renderToggle({ items,
    completeItem: async () => { throw Object.assign(new Error('gone'), { code: 'PGRST116' }); } });
  try {
    await act(async () => { rowProps(items[0]).onToggle(); });
    assert.equal(alerts().length, 1);
    act(() => input().props.onChangeText('Eggs'));
    await act(async () => { renderer.root.findByProps({ testID: 'shopping-add-submit' }).props.onPress(); });
    assert.equal(alerts().length, 0);
  } finally { act(() => renderer.unmount()); }
});

test('a new toggle start clears the previous toggle error immediately', async () => {
  const items = [row('1'), row('2')]; const d = deferred();
  const { renderer, rowProps, alerts } = renderToggle({ items,
    completeItem: id => { if (id === '1') throw Object.assign(new Error('gone'), { code: 'PGRST116' }); return d.promise; } });
  try {
    await act(async () => { rowProps(items[0]).onToggle(); });
    assert.equal(alerts().length, 1);
    act(() => { rowProps(items[1]).onToggle(); });
    assert.equal(alerts().length, 0);
    await act(async () => { d.resolve(); await d.promise; });
  } finally { act(() => renderer.unmount()); }
});

test('a late success of another toggle does not hide an earlier failure', async () => {
  const items = [row('a'), row('b')]; const da = deferred(); const db = deferred();
  const { renderer, rowProps, alerts } = renderToggle({ items,
    completeItem: id => (id === 'a' ? da.promise : db.promise) });
  try {
    act(() => { rowProps(items[1]).onToggle(); rowProps(items[0]).onToggle(); });
    await act(async () => { da.reject(Object.assign(new Error('gone'), { code: 'PGRST116' })); await da.promise.catch(() => {}); });
    assert.equal(alerts().length, 1);
    await act(async () => { db.resolve(); await db.promise; });
    assert.equal(alerts().length, 1);
  } finally { act(() => renderer.unmount()); }
});

test('a household change clears the toggle error', async () => {
  const items = [row('1')];
  const state = { items, householdId: 'h', completeItem: async () => { throw Object.assign(new Error('gone'), { code: 'PGRST116' }); } };
  const { renderer, rowProps, alerts } = renderToggle(state);
  try {
    await act(async () => { rowProps(items[0]).onToggle(); });
    assert.equal(alerts().length, 1);
    state.householdId = 'h2';
    act(() => renderer.update(React.createElement(renderer.root.type)));
    assert.equal(alerts().length, 0);
  } finally { act(() => renderer.unmount()); }
});

test('pending toggles on different items run independently', async () => {
  const calls = []; const d1 = deferred(); const d2 = deferred();
  const a = row('a'); const b = row('b');
  const { renderer, rowProps } = renderToggle({ items: [a, b],
    completeItem: id => { calls.push(id); return id === 'a' ? d1.promise : d2.promise; } });
  try {
    act(() => { rowProps(a).onToggle(); rowProps(b).onToggle(); });
    assert.deepEqual(calls, ['a', 'b']);
    assert.equal(rowProps(a).pending, true);
    assert.equal(rowProps(b).pending, true);
    await act(async () => { d1.resolve(); await d1.promise; });
    assert.equal(rowProps(a).pending, false);
    assert.equal(rowProps(b).pending, true);
    await act(async () => { d2.resolve(); await d2.promise; });
  } finally { act(() => renderer.unmount()); }
});

// ---- Edit modal navigation ----
test('pressing a row name opens the edit modal for that item', () => {
  const item = row('1');
  const r = renderAdd({ items: [item] });
  try {
    pushes.length = 0;
    const props = r.renderer.root.findByType('SectionList').props.renderItem({ item }).props;
    act(() => props.onPress());
    assert.deepEqual(pushes, ['/shopping-item/1']);
  } finally { act(() => r.renderer.unmount()); }
});

test('a pending toggle from an obsolete household cannot show an error in the new list', async () => {
  const d = deferred(); const item = row('old');
  const state = { householdId: 'h', items: [item], completeItem: () => d.promise };
  const { renderer, rowProps, alerts } = renderToggle(state);
  try {
    act(() => { rowProps(item).onToggle(); });
    state.householdId = 'h2'; state.items = [row('new', { household_id: 'h2' })];
    act(() => renderer.update(React.createElement(renderer.root.type)));
    await act(async () => {
      d.reject(Object.assign(new Error('old permission failure'), { code: '42501' }));
      await d.promise.catch(() => {});
    });
    assert.equal(alerts().length, 0);
    assert.equal(renderer.root.findByType('SectionList').props.sections[0].data[0].id, 'new');
  } finally { act(() => renderer.unmount()); }
});

test('a pending add from an obsolete household cannot show an error or block a new add', async () => {
  const old = deferred(); const current = deferred(); const calls = [];
  const state = { householdId: 'h', addItem: input => { calls.push(input.name); return old.promise; } };
  const { renderer, input, submit } = renderAdd(state);
  try {
    act(() => input().props.onChangeText('Milk'));
    act(() => submit().props.onPress());
    state.householdId = 'h2'; state.addItem = value => { calls.push(value.name); return current.promise; };
    act(() => renderer.update(React.createElement(renderer.root.type)));
    assert.equal(input().props.value, '');
    assert.equal(submit().props.loading, false);
    act(() => input().props.onChangeText('Eggs'));
    act(() => submit().props.onPress());
    assert.deepEqual(calls, ['Milk', 'Eggs']);
    await act(async () => {
      old.reject(Object.assign(new Error('old duplicate'), { code: '23505' }));
      await old.promise.catch(() => {});
    });
    assert.equal(input().props.error, null);
    assert.equal(input().props.value, 'Eggs');
    assert.equal(submit().props.loading, true);
    await act(async () => { current.resolve(row('e')); await current.promise; });
    assert.equal(input().props.value, '');
    assert.equal(submit().props.loading, false);
  } finally { act(() => renderer.unmount()); }
});

test('returning to a household does not revive an earlier add completion or clear its new draft', async () => {
  const d = deferred();
  const state = { householdId: 'h', addItem: () => d.promise };
  const { renderer, input, submit } = renderAdd(state);
  try {
    act(() => input().props.onChangeText('Milk'));
    act(() => submit().props.onPress());
    state.householdId = null;
    act(() => renderer.update(React.createElement(renderer.root.type)));
    state.householdId = 'h';
    act(() => renderer.update(React.createElement(renderer.root.type)));
    act(() => input().props.onChangeText('Milk'));
    await act(async () => { d.resolve(row('m')); await d.promise; });
    assert.equal(input().props.value, 'Milk');
    assert.equal(submit().props.loading, false);
  } finally { act(() => renderer.unmount()); }
});

// A toggle error belongs to the item that failed. It names that item and goes away once
// the item is removed or changed by a later successful write (updated_at is server-set).
const alertText = alerts => alerts().map(a => [].concat(a.props.children).join('')).join('|');

test('a toggle error names its item and stays while that item is unchanged', async () => {
  const milk = row('1', { name: 'Milk' }); const eggs = row('2', { name: 'Eggs' });
  const state = { items: [milk, eggs], completeItem: async id => { if (id === '1') throw new Error('offline'); } };
  const { renderer, rowProps, alerts } = renderToggle(state);
  try {
    await act(async () => { rowProps(milk).onToggle(); });
    assert.equal(alertText(alerts), 'Milk: err_save_shopping');
    state.items = [milk, { ...eggs, name: 'Free-range eggs', updated_at: '2026-01-05' }];
    act(() => renderer.update(React.createElement(renderer.root.type)));
    assert.equal(alertText(alerts), 'Milk: err_save_shopping');
  } finally { act(() => renderer.unmount()); }
});

test('a toggle error disappears once its item is removed', async () => {
  const milk = row('1', { name: 'Milk' });
  const state = { items: [milk], completeItem: async () => { throw new Error('offline'); } };
  const { renderer, rowProps, alerts } = renderToggle(state);
  try {
    await act(async () => { rowProps(milk).onToggle(); });
    assert.equal(alerts().length, 1);
    state.items = [];
    act(() => renderer.update(React.createElement(renderer.root.type)));
    assert.equal(alerts().length, 0);
  } finally { act(() => renderer.unmount()); }
});

test('a toggle error disappears once its item is changed by a later write', async () => {
  const milk = row('1', { name: 'Milk' });
  const state = { items: [milk], completeItem: async () => { throw new Error('offline'); } };
  const { renderer, rowProps, alerts } = renderToggle(state);
  try {
    await act(async () => { rowProps(milk).onToggle(); });
    assert.equal(alerts().length, 1);
    state.items = [{ ...milk, name: 'Oat milk', updated_at: '2026-01-05' }];
    act(() => renderer.update(React.createElement(renderer.root.type)));
    assert.equal(alerts().length, 0);
  } finally { act(() => renderer.unmount()); }
});

test('a missing-item error stays after the row is dropped and names the item', async () => {
  const milk = row('1', { name: 'Milk' });
  const state = { items: [milk, row('2')], completeItem: async () => { throw Object.assign(new Error('gone'), { code: 'PGRST116' }); } };
  const { renderer, rowProps, alerts } = renderToggle(state);
  try {
    await act(async () => { rowProps(milk).onToggle(); });
    state.items = [row('2')];
    act(() => renderer.update(React.createElement(renderer.root.type)));
    assert.equal(alertText(alerts), 'Milk: err_shopping_missing');
  } finally { act(() => renderer.unmount()); }
});
