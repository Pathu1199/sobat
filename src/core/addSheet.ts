import { amountText, basketFromItems, basketFromLines, linesFromBasket, type BasketLine } from './basket';
import { addDays } from './date';
import { fill, numberText } from '../i18n';
import { foodName, measureName, toMealItem } from './foods';
import { skippedOn, type MealsAndSkips } from './menu';
import { currentSlot, type SlotState } from './pattern';
import type { PlanLine } from './routine';
import { stable } from './sync';
import type { FoodItem, ISODate, Lang, Meal, MealItem, SavedMeal } from './types';
import { lineInfo, plannedKcal, type PlanMeal } from './weekPlan';

/**
 * What the add sheet lists, top to bottom, as rows for one FlatList. With a
 * search typed: the matches only, so they sit just under the search box and
 * above the keyboard, or one line saying nothing was found. With none: the
 * meal being built, then (when logging) eating as planned, while no foods are
 * chosen, and the same as yesterday, then saved meals, recent foods, and
 * photo and barcode.
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
  // Eating as planned logs the plan as it is, so it is not offered while foods are being chosen: it would drop them.
  if (logging && input.planned && input.basket.length === 0) rows.push({ kind: 'planned', key: 'planned' });
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

/**
 * Changing a menu, the meal of each slot the person has worked on is kept
 * while they move between the slot chips: leaving a slot keeps its meal as it
 * was left, coming back brings it back, and a slot not opened yet starts from
 * its planned foods. Nothing is dropped without a word.
 */
export function switchDraft(input: {
  drafts: Record<string, BasketLine[]>;
  /** The slot being left, with the meal as it is now. */
  from: string | undefined;
  basket: BasketLine[];
  to: string;
  /** The planned foods of the slot opened. */
  planned: PlanLine[];
  foods: FoodItem[];
}): { drafts: Record<string, BasketLine[]>; basket: BasketLine[] } {
  const drafts = input.from === undefined ? input.drafts : { ...input.drafts, [input.from]: input.basket };
  return { drafts, basket: drafts[input.to] ?? basketFromLines(input.planned, input.foods) };
}

/**
 * What Save writes when a menu is being changed: the day's meals, each slot's
 * as it was left in the sheet. A slot opened but not changed keeps its lines
 * exactly as they were. Null when nothing changes, so nothing is written and
 * nothing says it was saved.
 */
export function menuSave(meals: PlanMeal[], drafts: Record<string, BasketLine[]>, foods: FoodItem[]): PlanMeal[] | null {
  let changed = false;
  const next = meals.map((m) => {
    const draft = drafts[m.id];
    if (!draft || stable(draft) === stable(basketFromLines(m.lines, foods))) return m;
    const lines = linesFromBasket(draft, foods);
    if (stable(lines) === stable(m.lines)) return m;
    changed = true;
    return { ...m, lines };
  });
  return changed ? next : null;
}

/**
 * What a slot may hold, for "N left for Lunch": a slot the menu plans holds
 * its planned calories, from the database, as the menu shows them; a slot
 * with nothing planned (or only foods gone from the database) keeps its share
 * of the day.
 */
export function slotAllowance(input: { lines: PlanLine[]; foods: FoodItem[]; share: number }): number {
  const planned = plannedKcal(input.lines, input.foods);
  return planned > 0 ? planned : input.share;
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

/** The slot line in words, its parts joined by " · ", the calories written as the app writes them (1,463). */
export function slotLineText(parts: SlotLinePart[], t: (key: string) => string): string {
  return parts.map((p) => fill(t(p.key), typeof p.params.kcal === 'number' ? { ...p.params, kcal: numberText(p.params.kcal) } : p.params)).join(' · ');
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

/**
 * What a tap on the same as yesterday or a saved meal does: logs it in one
 * tap while nothing is being built, else adds its foods into the meal being
 * built (and always while a menu is being changed), so the foods chosen so
 * far are never dropped or logged apart.
 */
export function addsIntoMeal(mode: 'log' | 'plan', basket: readonly BasketLine[]): boolean {
  return mode === 'plan' || basket.length > 0;
}

/**
 * Whether the sheet offers the same as yesterday: whenever yesterday's slot
 * holds something, to log in one tap; but while it would add into the meal
 * being built (`addsIntoMeal`), only when one of its foods can go in, as a
 * food read from a photo has no measure to add and the tap would do nothing.
 */
export function offersYesterday(input: { mode: 'log' | 'plan'; basket: readonly BasketLine[]; items: MealItem[]; foods: FoodItem[] }): boolean {
  if (input.items.length === 0) return false;
  return !addsIntoMeal(input.mode, input.basket) || basketFromItems([], input.items, input.foods).length > 0;
}

/** The slot as it was before a one-tap log, for its Undo: the meals filled in from the plan the log replaces, and whether the slot was marked skipped. */
export function slotBefore(state: MealsAndSkips, date: ISODate, slotId: string): { replaced: Meal[]; wasSkipped: boolean } {
  return { replaced: filledIn(state.meals, date, slotId), wasSkipped: skippedOn(state.slotSkips, date).includes(slotId) };
}

/** One step of an Undo, each done through the store: removeMeal, addMeal, skipSlot or unskipSlot. */
export type UndoStep = { kind: 'remove'; id: string } | { kind: 'add'; meal: Meal } | { kind: 'skip' | 'unskip'; date: ISODate; slotId: string };

/**
 * The Undo of a one-tap log, in order: the meal taken away, the meals filled
 * in from the plan that it replaced put back, and the slot's skip put back
 * exactly as it was. Taking a meal away can mark its slot skipped (so the app
 * does not fill it straight back), which an Undo must not leave behind; and a
 * slot skipped before the tap is skipped again.
 */
export function undoSteps(tap: { id: string; date: ISODate; slotId: string; replaced: Meal[]; wasSkipped: boolean }): UndoStep[] {
  return [
    { kind: 'remove', id: tap.id },
    ...tap.replaced.map((meal): UndoStep => ({ kind: 'add', meal })),
    { kind: tap.wasSkipped ? 'skip' : 'unskip', date: tap.date, slotId: tap.slotId },
  ];
}

/**
 * The Undo of a meal deleted from its sheet, taken before the delete: the
 * meal put back as the state holds it (the sheet's copy only when it is gone
 * already) through addMeal, then its slot's skip exactly as it was. Taking a
 * meal away can mark its slot skipped (so the app does not fill it straight
 * back), and addMeal lifts that skip; a slot that was skipped beside its meal
 * is skipped again. A meal that names no slot only comes back.
 */
export function removeUndoSteps(state: MealsAndSkips, meal: Meal): UndoStep[] {
  const gone = state.meals.find((m) => m.id === meal.id) ?? meal;
  if (!gone.slotId) return [{ kind: 'add', meal: gone }];
  const wasSkipped = skippedOn(state.slotSkips, gone.date).includes(gone.slotId);
  return [
    { kind: 'add', meal: gone },
    { kind: wasSkipped ? 'skip' : 'unskip', date: gone.date, slotId: gone.slotId },
  ];
}

/** A line's food, measure and amount, the amount to three places so a count read back from grams still matches. */
const lineKey = (l: PlanLine) => `${l.foodId}|${l.unit}|${Math.round(l.qty * 1000)}`;
const linesKey = (lines: PlanLine[]) => lines.map(lineKey).sort().join(',');

/** A saved meal already holds these lines: the same foods in the same measures and amounts, in any order. Then there is nothing to offer to save. */
export function alreadySaved(lines: PlanLine[], saved: Pick<SavedMeal, 'lines'>[]): boolean {
  const key = linesKey(lines);
  return saved.some((s) => linesKey(s.lines) === key);
}

/** The foods of eating as planned, each named with its measure ("Kanda Poha 1 katori (150 g)"); a food that is gone or an amount of nothing is left out, as it is when logged. */
export function plannedSummary(lines: PlanLine[], foods: FoodItem[], lang: Lang): string {
  return lines
    .flatMap((l) => {
      const info = lineInfo(l, foods, lang);
      return info && info.grams > 0 ? [`${foodName(info.food, lang)} ${amountText(l.qty, measureName(info.food, info.unit, lang))}`] : [];
    })
    .join(' · ');
}
