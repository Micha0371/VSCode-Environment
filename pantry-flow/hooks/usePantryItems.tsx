import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { assertUniqueItemName, fetchAllItems, parseItem, validateItem, PantryItem, NewItemInput, UpdateItemInput } from '@/lib/pantry-data';
import { useHouseholdScope } from './household-scope';

export type { PantryItem, NewItemInput, UpdateItemInput } from '@/lib/pantry-data';

function usePantryState() {
  const { user } = useAuth();
  const { householdId, loading: householdLoading, error: householdError, refreshHousehold } = useHouseholdScope();
  const [items, setItems] = useState<PantryItem[]>([]);
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
      const result = await fetchAllItems(supabase, householdId);
      if (isCurrent(scope) && request === generation.current) {
        setItems(result); setLoadedScope(scope);
      }
    } catch {
      if (isCurrent(scope) && request === generation.current) setError('err_load_items');
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
    if (pendingItems.current.has(id)) throw new Error('Item change is already pending');
    beginMutation();
    pendingItems.current.add(id);
  };
  const addItem = async (input: NewItemInput) => {
    const validated = validateItem(input);
    assertUniqueItemName(visibleItems, validated.name);
    beginMutation();
    const { data, error: err } = await supabase.from('pantry_items')
      .insert({ ...validated, household_id: householdId, status: 'in_stock', created_by: user!.id })
      .select().single();
    if (err) throw err;
    const item = parseItem(data);
    if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => [item, ...prev]); }
    return item;
  };
  const updateItem = async (id: string, input: UpdateItemInput) => {
    const validated = validateItem(input);
    assertUniqueItemName(visibleItems, validated.name, id);
    beginItemMutation(id);
    try {
      const { data, error: err } = await supabase.from('pantry_items')
        .update(validated).eq('id', id).eq('household_id', householdId).select().single();
      if (err) throw err;
      const item = parseItem(data);
      if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => prev.map(it => it.id === id ? item : it)); }
      return item;
    } finally {
      pendingItems.current.delete(id);
    }
  };
  const deleteItem = async (id: string) => {
    beginItemMutation(id);
    try {
      const { data, error: err } = await supabase.from('pantry_items')
        .delete().eq('id', id).eq('household_id', householdId).select('id');
      if (err) throw err;
      if (!data?.length) throw new Error('Item was not deleted');
      if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => prev.filter(it => it.id !== id)); }
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
    error: householdError ?? error, fetchItems, retry, addItem, updateItem, deleteItem,
    getItem: (id: string) => visibleItems.find(it => it.id === id) ?? null,
  };
}

const PantryContext = createContext<ReturnType<typeof usePantryState> | undefined>(undefined);
export function PantryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ScopedPantryProvider key={user?.id ?? 'guest'}>{children}</ScopedPantryProvider>;
}
function ScopedPantryProvider({ children }: { children: ReactNode }) {
  const value = usePantryState();
  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}
export function usePantryItems() {
  const value = useContext(PantryContext);
  if (!value) throw new Error('usePantryItems must be used within PantryProvider');
  return value;
}
