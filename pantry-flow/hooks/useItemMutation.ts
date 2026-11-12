import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// A synchronous lock prevents two presses before React has rerendered. A focus
// generation prevents a completed request from navigating an abandoned screen.
// The operation receives the same check, so a multi-step operation (a prompt, a
// notice) can stop once its screen has closed or another screen covers it.
export function useItemMutation() {
  const locked = useRef(false);
  const mounted = useRef(true);
  const focus = useRef(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; focus.current++; };
  }, []);
  useFocusEffect(useCallback(() => {
    return () => { focus.current++; };
  }, []));
  const run = async (
    operation: (current: () => boolean) => Promise<unknown>,
    success: () => void,
    failure: (error: unknown) => void,
  ) => {
    if (locked.current) return;
    locked.current = true;
    const started = focus.current;
    const current = () => mounted.current && started === focus.current;
    setBusy(true);
    try {
      await operation(current);
      if (current()) success();
    } catch (error) {
      if (current()) failure(error);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, run };
}
