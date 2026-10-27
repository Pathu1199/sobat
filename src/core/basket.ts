import { toISODate } from './date';
import { defaultPortion, toMealItem } from './foods';
import type { PlanLine } from './routine';
import type { FoodItem, ISODate, Meal, MealItem, MealSource } from './types';
import type { PlanMeal } from './weekPlan';

/**
 * The add sheet's basket: the foods about to be logged as one meal. Each line
 * is a food, a measure, what one measure weighs and how many; one line per
 * food, so adding a food that is already there adds to its count. Calories
 * always come from the database at those grams. Pure, so the stepper, the
 * grams box, the bottom bar, a saved meal and a day's menu all count the
 * same way. A count is kept exactly (typed grams stay the grams typed) and is
 * rounded only where it is shown (formatQty), and where a line is written
 * (linesFromBasket) only finely enough that it reads back as the same grams.
 */
export type BasketLine = { foodId: string; unit: string; gramsPerUnit: number; count: number };

/** Measures counted whole: one chapati, one slice, one medium banana. */
const WHOLE_UNITS = ['piece', 'slice', 'small', 'medium', 'large'];

const round2 = (n: number) => Math.round(n * 100) / 100;
/** A written count: four places keep the grams of any amount up to 3 kg (100 g in a 150 g katori is 0.6667, read back as 100 g). */
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** How much one − or + changes a count: one for things counted whole, a half for the rest. */
export function stepFor(unit: string): number {
  return WHOLE_UNITS.includes(unit) ? 1 : 0.5;
}

/**
 * The count after one − or +: the next point of the step grid that way, so an
 * amount off the grid moves to the nearest step its way and never further
 * (1.4 chapatis go to 1 or 2, 1.33 katoris to 1 or 1.5); 0 means the line
 * goes.
 */
export function stepCount(count: number, unit: string, by: 1 | -1): number {
  const step = stepFor(unit);
  const k = round2(count) / step;
  const n = by > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1;
  return Math.max(0, round2(n * step));
}

/**
 * The food sheet's − / +: one step on the grid, but never under one step, and
 * − never makes a typed amount below a step (half a chapati) larger. When −
 * gives back the same count it can do nothing, and the button says so.
 */
export function sheetStep(count: number, unit: string, by: 1 | -1): number {
  const next = Math.max(stepFor(unit), stepCount(count, unit, by));
  return by < 0 ? Math.min(count, next) : next;
}

const MAX_GRAMS = 3000;

/** Grams as typed in the grams box: a plain number above 0 and up to 3 kg, or null ("12abc", "1e3", "", "0"). */
export function parseGrams(text: string): number | null {
  const v = text.trim();
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const g = Number(v);
  return g > 0 && g <= MAX_GRAMS ? g : null;
}

/** A count that rounds to 0 counts as nothing: written down it would be a line of nothing. */
function countsAsSomething(count: number): boolean {
  return round2(count) > 0;
}

/**
 * The count typed grams make in a measure, not rounded, so the grams stay
 * exactly as typed (100 g in a 150 g katori stays 100 g). Null when the text
 * is not an amount or the amount would count as nothing.
 */
export function countFromGrams(text: string, gramsPerUnit: number): number | null {
  const g = parseGrams(text);
  if (g === null || !(gramsPerUnit > 0)) return null;
  const count = g / gramsPerUnit;
  return countsAsSomething(count) ? count : null;
}

/** A food's line at its own default measure. */
export function lineOf(food: FoodItem, count = 1): BasketLine {
  const p = defaultPortion(food);
  return { foodId: food.id, unit: p?.unit ?? 'bowl', gramsPerUnit: p?.grams ?? 150, count };
}

/** Add to the basket: a food already there gets the extra amount in its own measure; a new food gets a line. A portion that weighs nothing adds nothing. */
export function addLine(basket: BasketLine[], line: BasketLine): BasketLine[] {
  if (!(line.count > 0) || !(line.gramsPerUnit > 0)) return basket;
  const at = basket.findIndex((b) => b.foodId === line.foodId);
  if (at < 0) return [...basket, line];
  const b = basket[at];
  // A line kept in a measure of no weight cannot hold more of anything: the new line takes its place.
  if (!(b.gramsPerUnit > 0)) return basket.map((x, i) => (i === at ? line : x));
  const more = b.unit === line.unit ? line.count : (line.count * line.gramsPerUnit) / b.gramsPerUnit;
  return basket.map((x, i) => (i === at ? { ...x, count: x.count + more } : x));
}

/** A line as chosen in the food sheet ("Done" on a food already in the basket): it replaces that food's line. */
export function putLine(basket: BasketLine[], line: BasketLine): BasketLine[] {
  return basket.some((b) => b.foodId === line.foodId) ? basket.map((b) => (b.foodId === line.foodId ? line : b)) : [...basket, line];
}

/** Set a food's count; 0 or less takes it out. */
export function setCount(basket: BasketLine[], foodId: string, count: number): BasketLine[] {
  return count > 0 ? basket.map((b) => (b.foodId === foodId ? { ...b, count } : b)) : basket.filter((b) => b.foodId !== foodId);
}

/**
 * Set a food's grams; its count follows, in its measure, unrounded so the
 * grams stay as typed. 0 or less takes it out; an amount that would count as
 * nothing is refused and the line stays as it was.
 */
export function setGrams(basket: BasketLine[], foodId: string, grams: number): BasketLine[] {
  const b = basket.find((x) => x.foodId === foodId);
  if (!b) return basket;
  if (!(grams > 0) || !(b.gramsPerUnit > 0)) return setCount(basket, foodId, 0);
  const count = grams / b.gramsPerUnit;
  return countsAsSomething(count) ? setCount(basket, foodId, count) : basket;
}

export function lineGrams(line: BasketLine): number {
  return Math.round(line.gramsPerUnit * line.count);
}

/**
 * What a line's grams box shows: what is typed, while it stands for the
 * line, else the line's grams. Typed text that is an amount stands while the
 * line holds those grams; text that is not one yet (half typed, "12abc", too
 * little to count) stands until the line changes some other way, so a − or +
 * pressed with the box still focused shows the new grams. `draft.grams` is
 * the line's grams when it was typed.
 */
export function gramsText(draft: { text: string; grams: number } | null, line: BasketLine): string {
  const grams = lineGrams(line);
  if (draft === null) return String(grams);
  const count = countFromGrams(draft.text, line.gramsPerUnit);
  const stands = count !== null ? lineGrams({ ...line, count }) === grams : draft.grams === grams;
  return stands ? draft.text : String(grams);
}

/** The basket as meal items with database calories. A food the person made up stays estimated; a food that is gone is dropped. */
export function basketItems(basket: BasketLine[], foods: FoodItem[]): MealItem[] {
  const items: MealItem[] = [];
  for (const b of basket) {
    const food = foods.find((f) => f.id === b.foodId);
    const grams = lineGrams(b);
    if (food && grams > 0) items.push(toMealItem(food, grams, food.tags.includes('custom')));
  }
  return items;
}

/** "N items · X kcal" for the bottom bar, and the protein. */
export function basketTotals(basket: BasketLine[], foods: FoodItem[]): { items: number; kcal: number; protein: number } {
  const items = basketItems(basket, foods);
  return { items: items.length, kcal: items.reduce((a, i) => a + i.kcal, 0), protein: Math.round(items.reduce((a, i) => a + i.protein, 0)) };
}

/** Planned lines into the basket ("Change" on a meal of the menu), each at its own measure, the way a plan line is read. */
export function basketFromLines(lines: PlanLine[], foods: FoodItem[]): BasketLine[] {
  let basket: BasketLine[] = [];
  for (const l of lines) {
    const food = foods.find((f) => f.id === l.foodId);
    if (!food) continue;
    const p = food.portions.find((x) => x.unit === l.unit) ?? defaultPortion(food);
    if (p) basket = addLine(basket, { foodId: food.id, unit: p.unit, gramsPerUnit: p.grams, count: l.qty });
  }
  return basket;
}

/**
 * The basket as planned lines, for a saved meal or a day's menu. A line in
 * one of the food's own measures stays in it; a household measure (a bowl, a
 * spoon) becomes the food's default measure at the same grams, because a
 * planned line is read in the food's own measures. The amount is written
 * finely enough that the line reads back as the grams in the basket.
 */
export function linesFromBasket(basket: BasketLine[], foods: FoodItem[]): PlanLine[] {
  const lines: PlanLine[] = [];
  for (const b of basket) {
    const food = foods.find((f) => f.id === b.foodId);
    if (!food || b.count <= 0) continue;
    let line: PlanLine | null = null;
    if (food.portions.some((p) => p.unit === b.unit)) line = { foodId: b.foodId, unit: b.unit, qty: round4(b.count) };
    else {
      const p = defaultPortion(food);
      if (p && p.grams > 0) line = { foodId: b.foodId, unit: p.unit, qty: round4(lineGrams(b) / p.grams) };
    }
    // A line that counts as nothing is not written.
    if (line && countsAsSomething(line.qty)) lines.push(line);
  }
  return lines;
}

/** A clock time to build a date-time from; noon when a slot has none. */
function clockOf(hhmm: string | undefined): string {
  return hhmm && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm) ? hhmm : '12:00';
}

/** A meal of these items in a slot on a date: logged now for today, at the slot's time for another day. Typed by hand unless said otherwise. Null with no items. */
export function itemsMeal(input: { id: string; date: ISODate; slot: Pick<PlanMeal, 'id' | 'type' | 'time'>; items: MealItem[]; now: Date; source?: MealSource }): Meal | null {
  if (input.items.length === 0) return null;
  const at = input.date === toISODate(input.now) ? input.now : new Date(`${input.date}T${clockOf(input.slot.time)}:00`);
  return {
    id: input.id,
    at: at.toISOString(),
    date: input.date,
    type: input.slot.type,
    slotId: input.slot.id,
    items: input.items,
    kcal: input.items.reduce((a, i) => a + i.kcal, 0),
    protein: Math.round(input.items.reduce((a, i) => a + i.protein, 0)),
    source: input.source ?? 'manual',
  };
}

/** The basket as one meal in a slot on a date. */
export function basketMeal(input: { id: string; date: ISODate; slot: Pick<PlanMeal, 'id' | 'type' | 'time'>; basket: BasketLine[]; foods: FoodItem[]; now: Date; source?: MealSource }): Meal | null {
  return itemsMeal({ id: input.id, date: input.date, slot: input.slot, items: basketItems(input.basket, input.foods), now: input.now, source: input.source });
}

/**
 * What saving the basket into a slot does, for the line under the slot
 * chips. A slot that holds only the meal the app filled in from the plan gets
 * that meal replaced (the store drops it when a real meal lands there), so its
 * calories come back to the slot and the day before the basket is counted,
 * and nothing reads as over because of it.
 */
export function slotPreview(input: { allowance: number; eaten: number; autoKcal: number; basketKcal: number; dayLeft: number }): { replaces: boolean; slotLeft: number; dayLeft: number } {
  const replaces = input.autoKcal > 0 && input.eaten <= input.autoKcal;
  const back = replaces ? input.autoKcal : 0;
  return { replaces, slotLeft: input.allowance - (input.eaten - back) - input.basketKcal, dayLeft: input.dayLeft + back - input.basketKcal };
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

/** A count as people write it: 2, ½, 1½, ¾; anything else as it is (1.33). */
export function formatQty(q: number): string {
  const r = round2(q);
  const whole = Math.floor(r);
  const frac = round2(r - whole);
  if (frac === 0) return String(whole);
  const sign = FRACTIONS[String(frac)];
  if (sign) return whole === 0 ? sign : `${whole}${sign}`;
  return String(r);
}
