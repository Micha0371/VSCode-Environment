import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

// A second tap before the first navigation finishes must not push a second edit
// screen (KAN-33). The lock is released when this screen is focused again, or after
// FALLBACK_MS if it never lost focus, because then no navigation happened.
const FALLBACK_MS = 1000;

export function useSingleOpen() {
  const router = useRouter();
  const locked = useRef(false);
  const blurred = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => clearTimer, [clearTimer]);
  useFocusEffect(useCallback(() => {
    locked.current = false;
    clearTimer();
    return () => { blurred.current = true; };
  }, [clearTimer]));
  return useCallback((route: Href) => {
    if (locked.current) return;
    locked.current = true;
    blurred.current = false;
    router.push(route);
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!blurred.current) locked.current = false;
    }, FALLBACK_MS);
  }, [router, clearTimer]);
}
