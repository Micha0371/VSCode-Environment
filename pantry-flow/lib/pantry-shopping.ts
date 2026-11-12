import type { StatusKey } from './theme';

// A pantry save offers a shopping add only when the status changed to low or out.
export function offersShoppingAdd(previous: StatusKey, next: StatusKey): boolean {
  return next !== previous && (next === 'low' || next === 'out');
}
