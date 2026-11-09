const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

test('category scroll view preserves the first handled tap with the keyboard open', () => {
  const { OptionChips } = load('components/OptionChips.tsx', {
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text',
      StyleSheet: { create: value => value } },
    '@/lib/theme': load('lib/theme.ts'),
  });
  let view;
  try {
    act(() => { view = create(React.createElement(OptionChips, {
      options: ['other', 'dairy'], value: 'other', onChange: () => {}, labelFor: value => value,
    })); });
    // Moved intact from the RNTL composite query removed in v14. Omitting this
    // prop reproduces the original first-tap keyboard dismissal regression.
    assert.equal(view.root.findByType('ScrollView').props.keyboardShouldPersistTaps, 'handled');
  } finally { if (view) act(() => view.unmount()); }
});
