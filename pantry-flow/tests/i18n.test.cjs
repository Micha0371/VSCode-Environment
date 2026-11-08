const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

test('saved locale restores, missing translations fall back and locale changes persist', async () => {
  const storage = new Map([['user_language', 'de']]);
  const { en } = load('lib/i18n/en.ts');
  const { de } = load('lib/i18n/de.ts');
  const { I18nProvider, useTranslation } = load('lib/i18n/index.tsx', {
    './en': { en }, './de': { de },
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key), setItem: async (key, value) => { storage.set(key, value); },
    },
  });
  let current;
  function Probe() { current = useTranslation(); return React.createElement('Text', null, current.t('err_duplicate_item')); }
  let view;
  try {
    await act(async () => { view = create(React.createElement(I18nProvider, null, React.createElement(Probe))); });
    assert.equal(current.locale, 'de');
    assert.equal(view.toJSON().children[0], en.err_duplicate_item);
    assert.equal(current.t('unrecognized_test_key'), 'unrecognized_test_key');
    await act(async () => current.setLocale('en'));
    assert.equal(storage.get('user_language'), 'en');
    const { CATEGORIES, LOCATIONS, STATUSES } = load('lib/constants.ts');
    for (const [prefix, values] of [['cat', CATEGORIES], ['loc', LOCATIONS], ['status', STATUSES]]) {
      for (const value of values) assert.notEqual(current.t(`${prefix}_${value}`), `${prefix}_${value}`);
    }
  } finally { if (view) act(() => view.unmount()); }
});
