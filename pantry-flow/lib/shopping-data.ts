import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllPages } from './pagination';

export interface ShoppingItem {
  id: string;
  household_id: string;
  pantry_item_id: string | null;
  name: string;
  is_checked: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewShoppingItemInput { name: string; pantryItemId?: string | null }

export type ShoppingErrorKey =
  | 'err_duplicate_shopping_item' | 'err_shopping_permission' | 'err_shopping_missing'
  | 'err_shopping_invalid' | 'err_shopping_link_missing' | 'err_save_shopping';

export const SHOPPING_NAME_MAX = 120;

const TABLE = 'pantry_shopping_items';

function coded(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

export function validateShoppingName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || Array.from(trimmed).length > SHOPPING_NAME_MAX) {
    throw coded('Invalid shopping item name', 'PF_INVALID_SHOPPING');
  }
  return trimmed;
}

function normalizedName(name: string) {
  return name.trim().toLowerCase();
}

export function assertUniqueOpenName(items: ShoppingItem[], name: string, excludeId?: string): void {
  const normalized = normalizedName(name);
  if (items.some(item => !item.is_checked && item.id !== excludeId &&
      normalizedName(item.name) === normalized)) {
    throw coded('Duplicate shopping item', '23505');
  }
}

export function parseShoppingItem(value: unknown): ShoppingItem {
  if (!value || typeof value !== 'object') throw new Error('Invalid shopping item response');
  const row = value as Record<string, unknown>;
  for (const key of ['id', 'household_id', 'name', 'created_at', 'updated_at']) {
    if (typeof row[key] !== 'string') throw new Error('Invalid shopping item response');
  }
  for (const key of ['pantry_item_id', 'created_by', 'completed_at']) {
    if (row[key] !== null && typeof row[key] !== 'string') throw new Error('Invalid shopping item response');
  }
  if (typeof row.is_checked !== 'boolean' || row.is_checked !== (row.completed_at !== null)) {
    throw new Error('Invalid shopping item state');
  }
  if (validateShoppingName(row.name as string) !== row.name) {
    throw new Error('Invalid shopping item name');
  }
  return row as unknown as ShoppingItem;
}

// The name message is shown only for a name the client or the name check
// rejected. A rejected pantry link (23503) has its own message; other invalid
// requests (23502, 22P02, other checks) fall back to the generic save error.
export function shoppingErrorKey(error: unknown): ShoppingErrorKey {
  const fields = error !== null && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
  switch (fields.code) {
    case '23505': return 'err_duplicate_shopping_item';
    case '42501': return 'err_shopping_permission';
    case 'PGRST116': case 'PF_SHOPPING_MISSING': return 'err_shopping_missing';
    case 'PF_INVALID_SHOPPING': return 'err_shopping_invalid';
    case '23514':
      return typeof fields.message === 'string' && fields.message.includes('"shopping_name_valid"')
        ? 'err_shopping_invalid' : 'err_save_shopping';
    case '23503': return 'err_shopping_link_missing';
    default: return 'err_save_shopping';
  }
}

export async function fetchAllShoppingItems(client: SupabaseClient, householdId: string) {
  return fetchAllPages(
    (from, to) => client.from(TABLE)
      .select('*', { count: 'exact' }).eq('household_id', householdId)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, to),
    parseShoppingItem,
  );
}

export async function insertShoppingItem(
  client: SupabaseClient, householdId: string, userId: string, input: NewShoppingItemInput,
): Promise<ShoppingItem> {
  const name = validateShoppingName(input.name);
  const { data, error } = await client.from(TABLE).insert({
    household_id: householdId, name, pantry_item_id: input.pantryItemId ?? null, created_by: userId,
  }).select().single();
  if (error) throw error;
  return parseShoppingItem(data);
}

async function updateShoppingItem(
  client: SupabaseClient, householdId: string, id: string, patch: { name: string } | { is_checked: boolean },
): Promise<ShoppingItem> {
  const { data, error } = await client.from(TABLE).update(patch)
    .eq('id', id).eq('household_id', householdId).select().single();
  if (error) throw error;
  return parseShoppingItem(data);
}

export async function renameShoppingItem(client: SupabaseClient, householdId: string, id: string, name: string) {
  return updateShoppingItem(client, householdId, id, { name: validateShoppingName(name) });
}

export async function setShoppingItemChecked(
  client: SupabaseClient, householdId: string, id: string, checked: boolean,
) {
  return updateShoppingItem(client, householdId, id, { is_checked: checked });
}

export async function deleteShoppingItem(
  client: SupabaseClient, householdId: string, id: string,
): Promise<void> {
  const { data, error } = await client.from(TABLE).delete()
    .eq('id', id).eq('household_id', householdId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw coded('Shopping item not found', 'PF_SHOPPING_MISSING');
}
