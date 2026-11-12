const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

const { ShoppingItem } = load('components/ShoppingItem.tsx', {
  'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: s => s } },
  '@expo/vector-icons': { Ionicons: 'Icon' },
  '@/lib/theme': load('lib/theme.ts'),
});

const item = (over = {}) => ({ id: 'i1', household_id: 'h', pantry_item_id: null, name: 'Milk', is_checked: false,
  completed_at: null, created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01', ...over });
const flat = style => [style].flat(Infinity).filter(Boolean).reduce((acc, s) => ({ ...acc, ...s }), {});

function render(props) {
  let renderer;
  act(() => { renderer = create(React.createElement(ShoppingItem, props)); });
  return renderer;
}
const withRow = (props, fn) => {
  const r = render(props);
  try { fn(r.root); } finally { act(() => r.unmount()); }
};

test('completed item is a checked, disabled checkbox with a struck-through name', () => {
  withRow({ item: item({ is_checked: true, completed_at: '2026-01-02' }) }, root => {
    const toggle = root.findByProps({ testID: 'shopping-toggle-i1' });
    assert.equal(toggle.props.accessibilityRole, 'checkbox');
    assert.equal(toggle.props.accessibilityLabel, 'Milk');
    assert.deepEqual(toggle.props.accessibilityState, { checked: true, disabled: true });
    assert.equal(root.findByType('Icon').props.name, 'checkmark-circle');
    const name = root.findByType('Text');
    assert.equal(flat(name.props.style).textDecorationLine, 'line-through');
  });
});

test('open item is unchecked with an outline icon and no strike-through', () => {
  withRow({ item: item() }, root => {
    const toggle = root.findByProps({ testID: 'shopping-toggle-i1' });
    assert.equal(toggle.props.accessibilityState.checked, false);
    assert.equal(root.findByType('Icon').props.name, 'ellipse-outline');
    assert.equal(flat(root.findByType('Text').props.style).textDecorationLine, undefined);
  });
});

test('toggle is disabled while pending and enabled otherwise when onToggle is given', () => {
  withRow({ item: item(), onToggle: () => {}, pending: true }, root => {
    const toggle = root.findByProps({ testID: 'shopping-toggle-i1' });
    assert.equal(toggle.props.disabled, true);
    assert.equal(toggle.props.accessibilityState.disabled, true);
  });
  withRow({ item: item(), onToggle: () => {} }, root => {
    const toggle = root.findByProps({ testID: 'shopping-toggle-i1' });
    assert.equal(toggle.props.disabled, false);
    assert.equal(toggle.props.accessibilityState.disabled, false);
  });
});

test('name press target is disabled without onPress and enabled with it', () => {
  withRow({ item: item() }, root => {
    assert.equal(root.findByProps({ testID: 'shopping-item-i1' }).props.disabled, true);
  });
  withRow({ item: item(), onPress: () => {} }, root => {
    assert.equal(root.findByProps({ testID: 'shopping-item-i1' }).props.disabled, false);
  });
});

test('toggle touch target is at least 44pt including hitSlop', () => {
  withRow({ item: item(), onToggle: () => {} }, root => {
    const toggle = root.findByProps({ testID: 'shopping-toggle-i1' });
    const s = flat(toggle.props.style({ pressed: false }));
    const slop = toggle.props.hitSlop;
    const size = 26 + 2 * s.padding;
    assert.ok(size + slop.left + slop.right >= 44, 'horizontal target');
    assert.ok(size + slop.top + slop.bottom >= 44, 'vertical target');
  });
});
