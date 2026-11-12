const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

test('mutation lock is immediate and navigating away abandons completion callbacks', async () => {
  let blur, value, successes = 0, operations = 0;
  const { useItemMutation } = load('hooks/useItemMutation.ts', { 'expo-router': {
    useFocusEffect: callback => React.useEffect(() => { blur = callback(); return blur; }, [callback]),
  } });
  function Consumer() { value = useItemMutation(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(Consumer)); });
  const pending = deferred();
  const operation = () => { operations++; return pending.promise; };
  let first, second;
  act(() => {
    first = value.run(operation, () => successes++, () => assert.fail('unexpected failure'));
    second = value.run(operation, () => successes++, () => assert.fail('unexpected failure'));
  });
  assert.equal(operations, 1);
  assert.equal(value.busy, true);
  blur();
  await act(async () => { pending.resolve(); await Promise.all([first, second]); });
  assert.equal(successes, 0);
  assert.equal(value.busy, false);
  await act(async () => value.run(async () => {}, () => successes++, () => {}));
  assert.equal(successes, 1);
  const unmounted = deferred();
  let last;
  act(() => { last = value.run(() => unmounted.promise, () => successes++, () => {}); });
  act(() => renderer.unmount());
  await act(async () => { unmounted.resolve(); await last; });
  assert.equal(successes, 1);
});

test('the operation can ask whether its screen is still current', async () => {
  let blur, value;
  const { useItemMutation } = load('hooks/useItemMutation.ts', { 'expo-router': {
    useFocusEffect: callback => React.useEffect(() => { blur = callback(); return blur; }, [callback]),
  } });
  function Consumer() { value = useItemMutation(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(Consumer)); });
  const seen = [];
  const step = deferred();
  let pending;
  act(() => { pending = value.run(async current => { seen.push(current()); await step.promise; seen.push(current()); },
    () => {}, () => {}); });
  blur();
  await act(async () => { step.resolve(); await pending; });
  const later = deferred();
  act(() => { pending = value.run(async current => { seen.push(current()); await later.promise; seen.push(current()); },
    () => {}, () => {}); });
  act(() => renderer.unmount());
  await act(async () => { later.resolve(); await pending; });
  assert.deepEqual(seen, [true, false, true, false]);
});
