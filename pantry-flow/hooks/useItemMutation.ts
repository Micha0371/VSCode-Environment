import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// A synchronous lock prevents two presses before React has rerendered. A focus
// generation prevents a completed request from navigating an abandoned screen.
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
  const run = async (operation: () => Promise<unknown>, success: () => void, failure: (error: unknown) => void) => {
    if (locked.current) return;
    locked.current = true;
    const started = focus.current;
    setBusy(true);
    try {
      await operation();
      if (mounted.current && started === focus.current) success();
    } catch (error) {
      if (mounted.current && started === focus.current) failure(error);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, run };
}
