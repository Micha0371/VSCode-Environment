// Language-agnostic internal keys. Display is derived via t(`cat_${key}`) / t(`loc_${key}`).
export const CATEGORIES = [
  'dairy',
  'grains',
  'produce',
  'protein',
  'canned',
  'frozen',
  'beverages',
  'snacks',
  'condiments',
  'cleaning',
  'personal',
  'other',
] as const;

export const LOCATIONS = [
  'fridge',
  'freezer',
  'pantry',
  'counter',
  'cabinet',
  'other',
] as const;

export const STATUSES = ['in_stock', 'low', 'out'] as const;

export const DEFAULT_CATEGORY = 'other';
export const DEFAULT_LOCATION = 'pantry';
export const DEFAULT_STATUS = 'in_stock';
