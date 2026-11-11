import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORIES, LOCATIONS, STATUSES } from './constants';
import { fetchAllPages, PAGE_SIZE } from './pagination';
import type { StatusKey } from './theme';

export interface PantryItem {
  id: string;
  household_id: string;
  name: string;
  status: StatusKey;
  category: string;
  location: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewItemInput { name: string; category: string; location: string }
export interface UpdateItemInput extends NewItemInput { status: StatusKey }

export const ITEM_NAME_MAX = 120;
export { PAGE_SIZE };

export function normalizedItemName(name: string) {
  return name.trim().toLowerCase();
}

export function assertUniqueItemName(items: PantryItem[], name: string, excludeId?: string) {
  const normalized = normalizedItemName(name);
  if (items.some(item => item.id !== excludeId && normalizedItemName(item.name) === normalized)) {
    throw Object.assign(new Error('Duplicate pantry item'), { code: '23505' });
  }
}

export function itemSaveErrorKey(error: unknown) {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === '23505'
    ? 'err_duplicate_item' : 'err_save_item';
}

export function validateItem(input: NewItemInput | UpdateItemInput) {
  const name = input.name.trim();
  if (!name || Array.from(name).length > ITEM_NAME_MAX ||
      !(CATEGORIES as readonly string[]).includes(input.category) ||
      !(LOCATIONS as readonly string[]).includes(input.location) ||
      ('status' in input && !(STATUSES as readonly string[]).includes(input.status))) {
    throw new Error('Invalid pantry item');
  }
  return {
    name, category: input.category, location: input.location,
    ...('status' in input ? { status: input.status } : {}),
  };
}

export function parseItem(value: unknown): PantryItem {
  if (!value || typeof value !== 'object') throw new Error('Invalid item response');
  const row = value as Record<string, unknown>;
  for (const key of ['id', 'household_id', 'name', 'category', 'location', 'status', 'created_at', 'updated_at']) {
    if (typeof row[key] !== 'string') throw new Error('Invalid item response');
  }
  if (row.created_by !== null && typeof row.created_by !== 'string') {
    throw new Error('Invalid item creator');
  }
  validateItem(row as unknown as UpdateItemInput);
  return row as unknown as PantryItem;
}

export function fetchAllItems(client: SupabaseClient, householdId: string) {
  return fetchAllPages(
    (from, to) => client.from('pantry_items')
      .select('*', { count: 'exact' }).eq('household_id', householdId)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, to),
    parseItem,
  );
}
