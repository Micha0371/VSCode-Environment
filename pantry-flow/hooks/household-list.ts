import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useHouseholdScope } from './household-scope';

// Read side shared by PantryProvider and ShoppingProvider: one list for the
// current household, where the newest read wins and a read or write that
// started under another user or household cannot populate this one.
// Each provider keeps its own writes and uses the guards returned here.
export function useHouseholdList<T extends { id: string; household_id: string }>(
  load: (client: SupabaseClient, householdId: string) => Promise<T[]>, loadError: string,
) {
  const { user } = useAuth();
  const { householdId, loading: householdLoading, error: householdError, refreshHousehold } = useHouseholdScope();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const pendingItems = useRef(new Set<string>());
  // The provider is keyed by user identity. This ref also protects a household
  // change before effect cleanup and async operations after unmount.
  const scope = `${user?.id ?? ''}:${householdId ?? ''}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const isCurrent = (started: string) => mounted.current && currentScope.current === started;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; };
  }, []);

  const fetchItems = useCallback(async () => {
    const request = ++generation.current;
    if (!householdId || !user) {
      setItems([]); setError(null); setLoading(false); return;
    }
    setLoading(true); setError(null);
    try {
      const result = await load(supabase, householdId);
      if (isCurrent(scope) && request === generation.current) {
        setItems(result); setLoadedScope(scope);
      }
    } catch {
      if (isCurrent(scope) && request === generation.current) setError(loadError);
    } finally {
      if (isCurrent(scope) && request === generation.current) setLoading(false);
    }
  }, [householdId, user?.id, load, loadError]);

  useEffect(() => {
    setItems([]);
    void fetchItems();
    return () => { generation.current++; };
  }, [fetchItems]);

  const retry = householdError || !householdId ? refreshHousehold : fetchItems;
  // Hide the previous household synchronously, before effects run.
  const visibleItems = householdId ? items.filter(it => it.household_id === householdId) : [];
  return {
    user, householdId, scope, isCurrent, loadedScope, generation, pendingItems,
    setItems, setLoading, setError, visibleItems,
    // The read-side part of each provider's context value.
    view: {
      householdId, items: visibleItems,
      loading: householdLoading || loading || (!!householdId && loadedScope !== scope && !error),
      error: householdError ?? error, fetchItems, retry,
      getItem: (id: string) => visibleItems.find(it => it.id === id) ?? null,
    },
  };
}
