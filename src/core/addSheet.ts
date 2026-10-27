import type { BasketLine } from './basket';

/**
 * What the add sheet lists, top to bottom, as rows for one FlatList. With a
 * search typed: the matches only, so they sit just under the search box and
 * above the keyboard, or one line saying nothing was found. With none: the
 * meal being built, then (when logging) eating as planned and the same as
 * yesterday, then saved meals, recent foods, and photo and barcode.
 */
export type AddRow =
  | { kind: 'head'; key: string; titleKey: string }
  | { kind: 'basket'; key: string; foodId: string }
  | { kind: 'planned'; key: string }
  | { kind: 'yesterday'; key: string }
  | { kind: 'saved'; key: string; savedId: string }
  | { kind: 'food'; key: string; foodId: string }
  | { kind: 'tools'; key: string }
  | { kind: 'empty'; key: string };

export function addRows(input: {
  mode: 'log' | 'plan';
  query: string;
  /** Food ids the search found, closest first. */
  results: string[];
  basket: BasketLine[];
  /** The slot has planned foods to log as they are. */
  planned: boolean;
  /** The same slot yesterday holds a meal to log again. */
  yesterday: boolean;
  /** Saved meal ids. */
  saved: string[];
  /** Recent food ids, most used first. */
  recents: string[];
}): AddRow[] {
  if (input.query.trim()) {
    if (input.results.length === 0) return [{ kind: 'empty', key: 'empty' }];
    return input.results.map((id): AddRow => ({ kind: 'food', key: `food:${id}`, foodId: id }));
  }
  const logging = input.mode === 'log';
  const rows: AddRow[] = [];
  if (input.basket.length > 0) {
    rows.push({ kind: 'head', key: 'head:basket', titleKey: 'add_this_meal' });
    for (const b of input.basket) rows.push({ kind: 'basket', key: `basket:${b.foodId}`, foodId: b.foodId });
  }
  if (logging && input.planned) rows.push({ kind: 'planned', key: 'planned' });
  if (logging && input.yesterday) rows.push({ kind: 'yesterday', key: 'yesterday' });
  if (input.saved.length > 0) {
    rows.push({ kind: 'head', key: 'head:saved', titleKey: 'me_saved' });
    for (const id of input.saved) rows.push({ kind: 'saved', key: `saved:${id}`, savedId: id });
  }
  const inBasket = new Set(input.basket.map((b) => b.foodId));
  const recents = input.recents.filter((id) => !inBasket.has(id));
  if (recents.length > 0) {
    rows.push({ kind: 'head', key: 'head:recent', titleKey: 'recent' });
    for (const id of recents) rows.push({ kind: 'food', key: `food:${id}`, foodId: id });
  }
  if (logging) rows.push({ kind: 'tools', key: 'tools' });
  return rows;
}
