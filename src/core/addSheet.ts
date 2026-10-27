import type { BasketLine } from './basket';
import { addDays } from './date';
import { toMealItem } from './foods';
import { currentSlot, type SlotState } from './pattern';
import type { PlanLine } from './routine';
import type { FoodItem, ISODate, Meal, MealItem } from './types';
import { lineInfo, type PlanMeal } from './weekPlan';

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

/**
 * What Save does: log a meal, or change that date's menu. Nothing is logged
 * into the future (the store refuses it), so on a date after today the sheet
 * always changes the menu, however it was opened.
 */
export function sheetMode(date: ISODate, today: ISODate, asked?: 'log' | 'plan'): 'log' | 'plan' {
  return date > today ? 'plan' : (asked ?? 'log');
}

/**
 * The slot the sheet opens on, among the day's slot ids: the one asked for;
 * else, today, the one whose turn it is; else the day's first slot not yet
 * eaten or skipped; else its first. Undefined on a day with no slots.
 */
export function startSlot(input: { asked?: string; ids: readonly string[]; isToday: boolean; states: SlotState[]; minute: number }): string | undefined {
  const has = (id: string | undefined): id is string => id !== undefined && input.ids.includes(id);
  if (has(input.asked)) return input.asked;
  const now = input.isToday ? currentSlot(input.states, input.minute)?.slot.id : undefined;
  if (has(now)) return now;
  const open = input.states.find((s) => s.status !== 'done' && !s.skipped && has(s.slot.id));
  return open?.slot.id ?? input.ids[0];
}

/**
 * The foods the sheet starts with: the ones it was opened with ("Change" on
 * a meal of the menu hands them over); else, changing a menu, the slot's
 * planned foods, since Save writes the basket as the slot's whole menu and
 * must not drop what was planned; else none.
 */
export function startLines(input: { lines?: PlanLine[]; mode: 'log' | 'plan'; planned: PlanLine[] }): PlanLine[] {
  return input.lines ?? (input.mode === 'plan' ? input.planned : []);
}

export type SlotLinePart = { key: string; params: Record<string, string | number> };

/**
 * The line under the slot chips, as words to fill: what saving leaves for
 * the slot and for the day. A slot holding only the meal filled in from the
 * plan says that meal is replaced, since its calories go when the basket is
 * saved, and is never warned about for them. The day is "today" on today and
 * "for the day" on another date. The tone: over when the day goes over, a
 * warning when only the slot does, calm otherwise.
 */
export function slotLine(input: { preview: { replaces: boolean; slotLeft: number; dayLeft: number }; autoKcal: number; slot: string; isToday: boolean }): { parts: SlotLinePart[]; tone: 'calm' | 'warn' | 'over' } {
  const { preview, isToday } = input;
  const slotPart: SlotLinePart = preview.replaces
    ? { key: 'add_replaces_plan', params: { kcal: input.autoKcal } }
    : { key: preview.slotLeft >= 0 ? 'log_left_for' : 'log_over_for', params: { kcal: Math.abs(preview.slotLeft), slot: input.slot } };
  const dayKey = preview.dayLeft >= 0 ? (isToday ? 'log_left_today' : 'add_left_day') : isToday ? 'log_over_today' : 'add_over_day';
  const tone = preview.dayLeft < 0 ? 'over' : !preview.replaces && preview.slotLeft < 0 ? 'warn' : 'calm';
  return { parts: [slotPart, { key: dayKey, params: { kcal: Math.abs(preview.dayLeft) } }], tone };
}

/**
 * Whether the sheet offers to log the slot as planned: only when logging, on
 * today or an earlier date (the store logs nothing into the future), while
 * something planned weighs anything and the slot holds nothing but the meal
 * the app filled in from the plan, which eating as planned replaces.
 */
export function offersPlanned(input: { mode: 'log' | 'plan'; date: ISODate; today: ISODate; lines: PlanLine[]; foods: FoodItem[]; slotMeals: Pick<Meal, 'source'>[] }): boolean {
  if (input.mode !== 'log' || input.date > input.today) return false;
  if (input.slotMeals.some((m) => m.source !== 'auto')) return false;
  return input.lines.some((l) => (lineInfo(l, input.foods)?.grams ?? 0) > 0);
}

/** The meals of the same slot the day before a date: by slot id, or by kind for a meal that names no slot. */
export function yesterdayIn(meals: Meal[], date: ISODate, slot: Pick<PlanMeal, 'id' | 'type'>): Meal[] {
  const before = addDays(date, -1);
  return meals.filter((m) => m.date === before && (m.slotId === slot.id || (!m.slotId && m.type === slot.type)));
}

/**
 * The same as yesterday, logged again: each food from the database at the
 * same grams, with its calories from the database as it is now (a food of the
 * person's own stays estimated); a food not in the database (read from a
 * photo) as it was logged.
 */
export function repeatItems(meals: Meal[], foods: FoodItem[]): MealItem[] {
  return meals.flatMap((m) =>
    m.items.map((it) => {
      const food = it.foodId ? foods.find((f) => f.id === it.foodId) : undefined;
      return food ? toMealItem(food, it.grams, food.tags.includes('custom')) : it;
    }),
  );
}

/** The meals the app filled in from the plan in a slot on a date: a meal logged there replaces them, and its Undo puts them back. */
export function filledIn(meals: Meal[], date: ISODate, slotId: string): Meal[] {
  return meals.filter((m) => m.date === date && m.source === 'auto' && m.slotId === slotId);
}
