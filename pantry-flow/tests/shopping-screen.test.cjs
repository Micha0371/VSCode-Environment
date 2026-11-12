const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');
const theme = load('lib/theme.ts');
const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', SectionList: 'SectionList',
  Pressable: 'Pressable', StyleSheet: { create: styles => styles } };
const t = key => key;
const shared = { 'react-native': native, '@/lib/theme': theme, '@expo/vector-icons': { Ionicons: 'Icon' },
  '@/lib/i18n': { useTranslation: () => ({ t }) }, '@/components/Button': { Button: 'Button' },
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
  const r = render({ items: [done('d', '2026-01-02'), row('o')] });
  try {
    const list = r.root.findByType('SectionList').props;
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
