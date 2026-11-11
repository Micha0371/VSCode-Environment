import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  assertUniqueOpenName, deleteShoppingItem, fetchAllShoppingItems, insertShoppingItem, renameShoppingItem,
  setShoppingItemChecked, validateShoppingName, ShoppingItem, NewShoppingItemInput,
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
  const beginMutation = () => {
    if (!householdId || !user || !isCurrent(scope)) throw new Error('No active household');
    generation.current++; setLoading(false); setError(null);
  };
  const beginItemMutation = (id: string) => {
    if (pendingItems.current.has(id)) throw new Error('Shopping item change is already pending');
    beginMutation();
    pendingItems.current.add(id);
  };
  const applyResult = (update: (prev: ShoppingItem[]) => ShoppingItem[]) => {
    if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(update); }
  };
  // Runs one write for an existing item under the per-item lock and replaces
  // the item with the parsed result the data module returns.
  const changeItem = async (id: string, write: () => Promise<ShoppingItem>) => {
    beginItemMutation(id);
    try {
      const item = await write();
      applyResult(prev => prev.map(it => it.id === id ? item : it));
      return item;
    } finally {
      pendingItems.current.delete(id);
    }
  };

  const addItem = async (input: NewShoppingItemInput) => {
    const name = validateShoppingName(input.name);
    assertUniqueOpenName(visibleItems, name);
    beginMutation();
    const item = await insertShoppingItem(supabase, householdId!, user!.id, { ...input, name });
    applyResult(prev => [item, ...prev]);
    return item;
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
    beginItemMutation(id);
    try {
      await deleteShoppingItem(supabase, householdId!, id);
      applyResult(prev => prev.filter(it => it.id !== id));
    } finally {
      pendingItems.current.delete(id);
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
