const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

const theme = load('lib/theme.ts');
const constants = load('lib/constants.ts');
const pantryData = load('lib/pantry-data.ts', { './constants': constants, './pagination': load('lib/pagination.ts') });
const shoppingData = load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') });
const pantryShopping = load('lib/pantry-shopping.ts');
const t = key => key;
const baseItem = { id: '1', name: 'Milk', category: 'dairy', location: 'fridge', status: 'in_stock' };

function render({ updateItem, addItem, shopping = {}, current = 'in_stock' } = {}) {
  const item = { ...baseItem, status: current };
  const log = { back: 0, alerts: [], adds: [], updates: 0, deletes: 0 };
  const focus = { blur: () => {} };
  const mutation = load('hooks/useItemMutation.ts', { 'expo-router': {
    useFocusEffect: callback => React.useEffect(() => { focus.blur = callback(); return focus.blur; }, [callback]),
  } });
  const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', Pressable: 'Pressable',
    ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' },
    Alert: { alert: (...args) => log.alerts.push(args) }, StyleSheet: { create: s => s } };
  const { default: Screen } = load('app/edit-item/[id].tsx', {
    'react-native': native, '@/lib/theme': theme, '@/lib/constants': constants,
    '@/lib/i18n': { useTranslation: () => ({ t }) },
    'expo-router': { useRouter: () => ({ back: () => { log.back++; } }), useLocalSearchParams: () => ({ id: '1' }) },
    '@/components/Button': { Button: 'Button' }, '@/components/Input': { Input: 'Input' },
    '@/components/OptionChips': { OptionChips: 'OptionChips' },
    '@/components/AuthGate': { AuthGate: ({ children }) => children },
    '@/hooks/useItemMutation': mutation, '@/lib/pantry-data': pantryData,
    '@/lib/shopping-data': shoppingData, '@/lib/pantry-shopping': pantryShopping,
    '@/hooks/usePantryItems': { usePantryItems: () => ({ loading: false, error: null, retry: () => {},
      getItem: () => item, deleteItem: async () => { log.deletes++; },
      updateItem: async (id, input) => { log.updates++; return updateItem(id, input); } }) },
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ loading: false, items: [], ...shopping,
      addItem: async input => { log.adds.push(input); return (addItem ?? (async () => ({})))(input); } }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  const by = id => renderer.root.findByProps({ testID: id });
  const press = text => log.alerts.at(-1)[2].find(b => b.text === text).onPress();
  return { renderer, log, by, press, blur: () => focus.blur(), input: () => renderer.root.findByType('Input') };
}
const saved = status => async () => ({ ...baseItem, status });
const start = by => { let p; act(() => { p = by('edit-item-save').props.onPress(); }); return p; };
const save = by => act(async () => { await by('edit-item-save').props.onPress(); });
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
function setStatus(by, s) { act(() => by(`edit-item-status-${s}`).props.onPress()); }

test('saving a change to low asks once and Yes adds the saved name linked to the item', async () => {
  const { renderer, log, by, press } = render({ updateItem: saved('low') });
  try {
    setStatus(by, 'low');
    const pending = start(by);
    await flush();
    assert.equal(log.alerts.length, 1);
    assert.equal(log.alerts[0][0], 'shopping_prompt_title');
    assert.equal(log.alerts[0][1], 'Milk');
    assert.equal(log.back, 0);
    await act(async () => { press('shopping_prompt_add'); await flush(); });
    await pending;
    assert.deepEqual(log.adds, [{ name: 'Milk', pantryItemId: '1' }]);
    assert.equal(log.back, 1);
  } finally { act(() => renderer.unmount()); }
});

for (const [label, answer] of [['Not now', 'skip'], ['dismissal', 'dismiss']]) {
  test(`${label} adds nothing and closes`, async () => {
    const { renderer, log, by, press } = render({ updateItem: saved('out') });
    try {
      setStatus(by, 'out');
      const pending = start(by);
      await flush();
      if (answer === 'skip') await act(async () => { press('shopping_prompt_skip'); await flush(); });
      else await act(async () => { log.alerts[0][3].onDismiss(); await flush(); });
      await pending;
      assert.equal(log.adds.length, 0);
      assert.equal(log.back, 1);
    } finally { act(() => renderer.unmount()); }
  });
}

test('unchanged status and changes to in stock never prompt', async () => {
  for (const [current, s] of [['in_stock', 'in_stock'], ['low', 'in_stock'], ['low', 'low'], ['out', 'out']]) {
    const { renderer, log, by } = render({ updateItem: saved(s), current });
    try {
      await save(by);
      assert.equal(log.alerts.length, 0);
      assert.equal(log.back, 1);
    } finally { act(() => renderer.unmount()); }
  }
});

test('a failed pantry save shows the pantry error and never prompts', async () => {
  const { renderer, log, by, input } = render({ updateItem: async () => { throw { code: '23505' }; } });
  try {
    setStatus(by, 'low');
    await save(by);
    assert.equal(input().props.error, 'err_duplicate_item');
    assert.equal(log.alerts.length, 0);
    assert.equal(log.back, 0);
  } finally { act(() => renderer.unmount()); }
});

for (const [code, message] of [['23505', 'err_duplicate_shopping_item'], ['23503', 'err_shopping_link_missing']]) {
  test(`a shopping add rejected with ${code} shows ${message} and still closes`, async () => {
    const { renderer, log, by, press, input } = render({ updateItem: saved('low'),
      addItem: async () => { throw { code }; } });
    try {
      setStatus(by, 'low');
      const pending = start(by);
      await flush();
      await act(async () => { press('shopping_prompt_add'); await flush(); });
      assert.equal(log.alerts.length, 2);
      assert.equal(log.alerts[1][0], 'shopping_prompt_failed_title');
      assert.equal(log.alerts[1][1], message);
      assert.equal(log.back, 0);
      await act(async () => { press('common_ok'); await flush(); });
      await pending;
      assert.equal(log.back, 1);
      assert.equal(input().props.error, null);
      assert.equal(log.updates, 1);
      assert.equal(log.deletes, 0);
    } finally { act(() => renderer.unmount()); }
  });
}

test('Save stays locked until the prompt is answered', async () => {
  const { renderer, log, by, press } = render({ updateItem: saved('low') });
  try {
    setStatus(by, 'low');
    const pending = start(by);
    await flush();
    await act(async () => { await by('edit-item-save').props.onPress(); });
    assert.equal(log.updates, 1);
    assert.equal(by('edit-item-save').props.loading, true);
    assert.equal(by('edit-item-delete').props.disabled, true);
    assert.equal(by('edit-item-cancel').props.disabled, true);
    await act(async () => { press('shopping_prompt_skip'); await flush(); });
    await pending;
  } finally { act(() => renderer.unmount()); }
});

test('no prompt after the edit screen has closed during the save', async () => {
  const d = deferred();
  const { renderer, log, by } = render({ updateItem: async () => { await d.promise; return { ...baseItem, status: 'low' }; } });
  setStatus(by, 'low');
  let pending;
  act(() => { pending = by('edit-item-save').props.onPress(); });
  act(() => renderer.unmount());
  await act(async () => { d.resolve(); await pending; });
  assert.equal(log.alerts.length, 0);
  assert.equal(log.back, 0);
});

test('a prompt answered after the screen unmounted adds nothing and shows no notice', async () => {
  const { renderer, log, by, press } = render({ updateItem: saved('low') });
  setStatus(by, 'low');
  const pending = start(by);
  await flush();
  assert.equal(log.alerts.length, 1);
  act(() => renderer.unmount());
  await act(async () => { press('shopping_prompt_add'); await flush(); });
  await pending;
  assert.equal(log.adds.length, 0);
  assert.equal(log.alerts.length, 1);
});

test('the prompt and the shopping add use the saved name, not the form name', async () => {
  const { renderer, log, by, press } = render({
    updateItem: async () => ({ ...baseItem, name: 'Whole milk', status: 'low' }) });
  try {
    setStatus(by, 'low');
    const pending = start(by);
    await flush();
    assert.equal(log.alerts[0][1], 'Whole milk');
    await act(async () => { press('shopping_prompt_add'); await flush(); });
    await pending;
    assert.deepEqual(log.adds, [{ name: 'Whole milk', pantryItemId: '1' }]);
  } finally { act(() => renderer.unmount()); }
});

test('the shopping add is sent while the shopping list is still loading', async () => {
  const { renderer, log, by, press } = render({ updateItem: saved('low'), shopping: { loading: true, items: [] } });
  try {
    setStatus(by, 'low');
    const pending = start(by);
    await flush();
    await act(async () => { press('shopping_prompt_add'); await flush(); });
    await pending;
    assert.equal(log.adds.length, 1);
  } finally { act(() => renderer.unmount()); }
});

test('no prompt when another screen covered the edit screen during the save', async () => {
  const d = deferred();
  const { renderer, log, by, blur } = render({ updateItem: async () => { await d.promise; return { ...baseItem, status: 'low' }; } });
  try {
    setStatus(by, 'low');
    const pending = start(by);
    blur();
    await act(async () => { d.resolve(); await flush(); });
    assert.equal(log.updates, 1);
    assert.equal(log.alerts.length, 0);
    await pending;
    assert.equal(log.back, 0);
  } finally { act(() => renderer.unmount()); }
});

test('a prompt answered after the screen lost focus adds nothing and shows no notice', async () => {
  const { renderer, log, by, press, blur } = render({ updateItem: saved('low') });
  try {
    setStatus(by, 'low');
    const pending = start(by);
    await flush();
    assert.equal(log.alerts.length, 1);
    blur();
    await act(async () => { press('shopping_prompt_add'); await flush(); });
    await pending;
    assert.equal(log.adds.length, 0);
    assert.equal(log.alerts.length, 1);
    assert.equal(log.back, 0);
  } finally { act(() => renderer.unmount()); }
});

for (const [label, leave] of [['closed', 'unmount'], ['lost focus', 'blur']]) {
  test(`no failure notice when the screen ${label} while the shopping add was pending`, async () => {
    const d = deferred();
    const { renderer, log, by, press, blur } = render({ updateItem: saved('low'),
      addItem: async () => { await d.promise; throw { code: '23505' }; } });
    let unmounted = false;
    try {
      setStatus(by, 'low');
      const pending = start(by);
      await flush();
      await act(async () => { press('shopping_prompt_add'); await flush(); });
      assert.equal(log.adds.length, 1);
      if (leave === 'unmount') { act(() => renderer.unmount()); unmounted = true; } else blur();
      await act(async () => { d.resolve(); await flush(); });
      assert.equal(log.alerts.length, 1);
      await pending;
      assert.equal(log.back, 0);
    } finally { if (!unmounted) act(() => renderer.unmount()); }
  });
}
