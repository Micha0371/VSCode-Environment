const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');
const theme = load('lib/theme.ts');
const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', FlatList: 'FlatList',
  Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'ios' }, StyleSheet: { create: styles => styles } };
const t = key => key;
const shared = { 'react-native': native, '@/lib/theme': theme,
  '@/lib/i18n': { useTranslation: () => ({ t }) }, '@/components/Button': { Button: 'Button' } };

test('initial inventory loading shows progress without claiming an empty pantry', () => {
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared,
    'expo-router': { useRouter: () => ({}) }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items: [], loading: true, error: null }) },
  });
  let renderer;
  try {
    act(() => { renderer = create(React.createElement(Screen)); });
    assert.equal(renderer.root.findAllByType('EmptyState').length, 0);
    assert.equal(renderer.root.findAllByType('Spinner').length, 1);
  } finally { if (renderer) act(() => renderer.unmount()); }
});

test('a failed initial pantry load shows retry instead of claiming the pantry is empty', () => {
  let retries = 0;
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared,
    'expo-router': { useRouter: () => ({}) }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items: [], loading: false, error: 'err_load_items', retry: () => retries++ }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  assert.equal(renderer.root.findAllByType('EmptyState').length, 0);
  act(() => renderer.root.findByType('Button').props.onPress());
  assert.equal(retries, 1);
  act(() => renderer.unmount());
});

test('empty pantry offers add navigation and populated pantry opens the selected item', () => {
  const navigation = [];
  let items = [];
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared,
    'expo-router': { useRouter: () => ({ push: route => navigation.push(route) }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items, loading: false, error: null }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  act(() => renderer.root.findByType('EmptyState').props.onCtaPress());
  assert.deepEqual(navigation, ['/add-item']);
  items = [{ id: 'selected-item' }];
  act(() => renderer.update(React.createElement(Screen)));
  assert.equal(renderer.root.findAllByType('EmptyState').length, 0);
  const row = renderer.root.findByType('FlatList').props.renderItem({ item: items[0] });
  act(() => row.props.onPress());
  assert.equal(navigation.at(-1), '/edit-item/selected-item');
  act(() => renderer.unmount());
});

test('email-confirmation signup shows instructions and does not navigate to the pantry', async () => {
  const navigation = [];
  const { default: Register } = load('app/(auth)/register.tsx', { ...shared,
    'expo-router': { Link: 'Link', useRouter: () => ({ replace: path => navigation.push(path) }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/Input': { Input: 'Input' },
    '@/lib/auth': { useAuth: () => ({ signUp: async () => 'confirmation_required' }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Register)); });
  const inputs = renderer.root.findAllByType('Input');
  act(() => { inputs[0].props.onChangeText('Alice'); inputs[1].props.onChangeText('a@example.com'); inputs[2].props.onChangeText('password'); });
  await act(async () => renderer.root.findByType('Button').props.onPress());
  assert.deepEqual(navigation, []);
  assert.match(JSON.stringify(renderer.toJSON()), /auth_check_email_message/);
  act(() => renderer.unmount());
});

test('sign-out failure is visible and does not navigate away', async () => {
  let navigation = 0;
  const { default: Settings } = load('app/(tabs)/settings.tsx', { ...shared,
    'expo-router': { useRouter: () => ({ replace: () => navigation++ }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/lib/auth': { useAuth: () => ({ signOut: async () => { throw new Error('offline'); } }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Settings)); });
  await act(async () => renderer.root.findByType('Button').props.onPress());
  assert.equal(navigation, 0);
  assert.match(JSON.stringify(renderer.toJSON()), /err_signout/);
  assert.equal(renderer.root.findByType('Button').props.loading, false);
  act(() => renderer.unmount());
});

test('protected routes do not mount children during restoration, failure or signed-out access', () => {
  let state = { loading: true, error: null, session: null }, mounted = 0;
  const { AuthGate } = load('components/AuthGate.tsx', { ...shared,
    'expo-router': { Redirect: 'Redirect' }, './Button': { Button: 'Button' },
    '@/lib/auth': { useAuth: () => ({ ...state, retrySession: async () => {} }) },
  });
  function Private() { mounted++; return React.createElement('Private'); }
  const tree = () => React.createElement(AuthGate, { requireSession: true }, React.createElement(Private));
  let renderer;
  act(() => { renderer = create(tree()); });
  assert.equal(mounted, 0);
  state = { loading: false, error: 'err_restore_session', session: null };
  act(() => renderer.update(tree()));
  assert.equal(mounted, 0);
  state = { loading: false, error: null, session: null };
  act(() => renderer.update(tree()));
  assert.equal(renderer.root.findByType('Redirect').props.href, '/(auth)/login');
  assert.equal(mounted, 0);
  state = { loading: false, error: null, session: { user: { id: 'u' } } };
  act(() => renderer.update(tree()));
  assert.equal(mounted, 1);
  act(() => renderer.unmount());
});

for (const [file, label] of [['app/add-item.tsx', 'item_add_button'], ['app/edit-item/[id].tsx', 'item_save_button']]) {
  test(`${file} translates a server unique-constraint rejection without navigating`, async () => {
    const constants = load('lib/constants.ts');
    const data = load('lib/pantry-data.ts', { './constants': constants, './pagination': load('lib/pagination.ts') });
    const { en } = load('lib/i18n/en.ts');
    const mutation = load('hooks/useItemMutation.ts', { 'expo-router': {
      useFocusEffect: callback => React.useEffect(callback, [callback]),
    } });
    let navigations = 0;
    const existing = { id: '1', name: 'Oat milk', category: 'dairy', location: 'fridge', status: 'in_stock' };
    const duplicate = async () => { throw { code: '23505' }; };
    const { default: Screen } = load(file, { ...shared,
      'expo-router': { useRouter: () => ({ back: () => navigations++ }), useLocalSearchParams: () => ({ id: '1' }) },
      '@/lib/i18n': { useTranslation: () => ({ t: key => en[key] ?? key }) },
      '@/components/AuthGate': { AuthGate: ({ children }) => children },
      '@/components/Input': { Input: 'Input' }, '@/components/OptionChips': { OptionChips: 'OptionChips' },
      '@/hooks/useItemMutation': mutation, '@/lib/pantry-data': data, '@/lib/constants': constants,
      '@/hooks/usePantryItems': { usePantryItems: () => ({ householdId: 'h', loading: false, error: null,
        addItem: duplicate, updateItem: duplicate, getItem: () => existing }) },
    });
    let renderer;
    act(() => { renderer = create(React.createElement(Screen)); });
    act(() => renderer.root.findByType('Input').props.onChangeText('milk'));
    await act(async () => renderer.root.findAllByType('Button').find(button => button.props.label === en[label]).props.onPress());
    assert.equal(renderer.root.findByType('Input').props.error, en.err_duplicate_item);
    assert.equal(navigations, 0);
    act(() => renderer.unmount());
  });
}
