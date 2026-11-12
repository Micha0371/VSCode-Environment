const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// A focus-controllable expo-router: focus() runs the screen's focus effect,
// blur() runs its cleanup, as React Navigation does when another screen covers it.
function harness() {
  const pushes = [];
  const router = { push: route => pushes.push(route) };
  let effect = null;
  let cleanup;
  const expoRouter = {
    useRouter: () => router,
    useFocusEffect: callback => React.useEffect(() => {
      effect = callback;
      cleanup = callback();
      return () => { if (cleanup) cleanup(); cleanup = undefined; };
    }, [callback]),
  };
  const { useSingleOpen } = load('hooks/useSingleOpen.ts', { 'expo-router': expoRouter });
  let open;
  function Screen() { open = useSingleOpen(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  return {
    pushes,
    open: route => act(() => open(route)),
    blur: () => act(() => { if (cleanup) cleanup(); cleanup = undefined; }),
    focus: () => act(() => { cleanup = effect(); }),
    unmount: () => act(() => renderer.unmount()),
  };
}

test('a second open before the first navigation finishes is ignored', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  try {
    h.open('/edit-item/a');
    h.open('/edit-item/a');
    h.open('/edit-item/b');
    assert.deepEqual(h.pushes, ['/edit-item/a']);
  } finally { h.unmount(); mock.timers.reset(); }
});

test('after the edit screen closes and the list is focused again, a tap opens it again', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  try {
    h.open('/edit-item/a');
    h.blur();
    mock.timers.tick(5000); // a long-open edit screen keeps the lock
    h.open('/edit-item/a');
    assert.deepEqual(h.pushes, ['/edit-item/a']);
    h.focus();
    h.open('/edit-item/a');
    assert.deepEqual(h.pushes, ['/edit-item/a', '/edit-item/a']);
  } finally { h.unmount(); mock.timers.reset(); }
});

test('a navigation that never moved focus releases the lock after a second', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  try {
    h.open('/edit-item/a');
    act(() => mock.timers.tick(999));
    h.open('/edit-item/a');
    assert.deepEqual(h.pushes, ['/edit-item/a']);
    act(() => mock.timers.tick(1));
    h.open('/edit-item/a');
    assert.deepEqual(h.pushes, ['/edit-item/a', '/edit-item/a']);
  } finally { h.unmount(); mock.timers.reset(); }
});

test('unmounting clears the pending fallback timer', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const cleared = mock.method(globalThis, 'clearTimeout');
  const h = harness();
  try {
    h.open('/edit-item/a');
    const before = cleared.mock.callCount();
    h.unmount();
    assert.ok(cleared.mock.callCount() > before, 'the fallback timer is cleared on unmount');
  } finally { cleared.mock.restore(); mock.timers.reset(); }
});
