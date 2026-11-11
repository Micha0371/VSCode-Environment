import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  assertUniqueOpenName, deleteShoppingItem, fetchAllShoppingItems, insertShoppingItem, renameShoppingItem,
  setShoppingItemChecked, shoppingErrorKey, validateShoppingName, ShoppingItem, NewShoppingItemInput,
} from '@/lib/shopping-data';
import { useHouseholdScope } from './household-scope';

export type { ShoppingItem, NewShoppingItemInput } from '@/lib/shopping-data';

function useShoppingState() {
  const { user } = useAuth();
  const { householdId, loading: householdLoading, error: householdError, refreshHousehold } = useHouseholdScope();
  const [items, setItems] = useState<ShoppingItem[]>([]);
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
      const result = await fetchAllShoppingItems(supabase, householdId);
      if (isCurrent(scope) && request === generation.current) {
        setItems(result); setLoadedScope(scope);
      }
    } catch {
      if (isCurrent(scope) && request === generation.current) setError('err_load_shopping');
    } finally {
      if (isCurrent(scope) && request === generation.current) setLoading(false);
    }
  }, [householdId, user?.id]);

  useEffect(() => {
    setItems([]);
    void fetchItems();
    return () => { generation.current++; };
  }, [fetchItems]);

  // Invalidate pending reads before each mutation, so an older snapshot cannot
  // overwrite its result. All screens observe this same state instance.
  // While the list is not loaded for this scope the discarded read is re-run
  // after the write settles, and a load error stays visible, so a write before
  // the first load never leaves a partial list or a permanent spinner.
  const beginMutation = () => {
    if (!householdId || !user || !isCurrent(scope)) throw new Error('No active household');
    const unloaded = loadedScope !== scope;
    generation.current++; setLoading(false);
    if (!unloaded) setError(null);
    return unloaded;
  };
  // Also re-read when a write failed because the record is missing, so a row
  // another member deleted disappears. The caller still gets the original error.
  const rereadIfUnloaded = (unloaded: boolean) => {
    if (unloaded && isCurrent(scope)) void fetchItems();
  };
  const isMissing = (error: unknown) => shoppingErrorKey(error) === 'err_shopping_missing';
  const beginItemMutation = (id: string) => {
    if (pendingItems.current.has(id)) throw new Error('Shopping item change is already pending');
    const unloaded = beginMutation();
    pendingItems.current.add(id);
    return unloaded;
  };
  const applyResult = (update: (prev: ShoppingItem[]) => ShoppingItem[]) => {
    if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(update); }
  };
  // Runs one write for an existing item under the per-item lock and replaces
  // the item with the parsed result the data module returns.
  const changeItem = async (id: string, write: () => Promise<ShoppingItem>) => {
    let reread = beginItemMutation(id);
    try {
      const item = await write();
      applyResult(prev => prev.map(it => it.id === id ? item : it));
      return item;
    } catch (error) {
      if (isMissing(error)) reread = true;
      throw error;
    } finally {
      pendingItems.current.delete(id);
      rereadIfUnloaded(reread);
    }
  };

  const addItem = async (input: NewShoppingItemInput) => {
    const name = validateShoppingName(input.name);
    assertUniqueOpenName(visibleItems, name);
    const unloaded = beginMutation();
    try {
      const item = await insertShoppingItem(supabase, householdId!, user!.id, { ...input, name });
      applyResult(prev => [item, ...prev]);
      return item;
    } finally {
      rereadIfUnloaded(unloaded);
    }
  };
  const renameItem = async (id: string, name: string) => {
    const validated = validateShoppingName(name);
    const existing = visibleItems.find(it => it.id === id);
    if (existing && !existing.is_checked) assertUniqueOpenName(visibleItems, validated, id);
    return changeItem(id, () => renameShoppingItem(supabase, householdId!, id, validated));
  };
  const completeItem = (id: string) =>
    changeItem(id, () => setShoppingItemChecked(supabase, householdId!, id, true));
  const reopenItem = async (id: string) => {
    const existing = visibleItems.find(it => it.id === id);
    if (existing) assertUniqueOpenName(visibleItems, existing.name, id);
    return changeItem(id, () => setShoppingItemChecked(supabase, householdId!, id, false));
  };
  const deleteItem = async (id: string) => {
    let reread = beginItemMutation(id);
    try {
      await deleteShoppingItem(supabase, householdId!, id);
      applyResult(prev => prev.filter(it => it.id !== id));
    } catch (error) {
      if (isMissing(error)) reread = true;
      throw error;
    } finally {
      pendingItems.current.delete(id);
      rereadIfUnloaded(reread);
    }
  };
  const retry = householdError || !householdId ? refreshHousehold : fetchItems;
  // Hide the previous household synchronously, before effects run.
  const visibleItems = householdId ? items.filter(it => it.household_id === householdId) : [];
  return {
    householdId, items: visibleItems,
    loading: householdLoading || loading || (!!householdId && loadedScope !== scope && !error),
    error: householdError ?? error, fetchItems, retry, addItem, renameItem, completeItem, reopenItem, deleteItem,
    getItem: (id: string) => visibleItems.find(it => it.id === id) ?? null,
  };
}

const ShoppingContext = createContext<ReturnType<typeof useShoppingState> | undefined>(undefined);
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ScopedShoppingProvider key={user?.id ?? 'guest'}>{children}</ScopedShoppingProvider>;
}
function ScopedShoppingProvider({ children }: { children: ReactNode }) {
  const value = useShoppingState();
  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
}
export function useShoppingItems() {
  const value = useContext(ShoppingContext);
  if (!value) throw new Error('useShoppingItems must be used within ShoppingProvider');
  return value;
}
