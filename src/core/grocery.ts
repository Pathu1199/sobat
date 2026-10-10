import { defaultPortion } from './foods';
import type { FoodItem, ISODate } from './types';
import type { WeekPlan } from './weekPlan';

/**
 * The week's plan, read as a shopping list: every food that appears in
 * any meal of any day, with the grams the plan adds up to, grouped the way
 * a bhaji market and a kirana are laid out. Cooked dishes are listed by
 * their main raw item where that is obvious (bhaji by its vegetable, dal by
 * its pulse); the rest are listed as themselves with a note.
 */
export type GroceryLine = {
  foodId: string;
  food: FoodItem;
  /** Total grams of the dish over the week as planned. */
  grams: number;
  /** How many times it appears. */
  times: number;
  /** Rounded buying amount, e.g. "1.5 kg", "6 pieces", "2 packets". */
  amount: string;
  unit: 'kg' | 'g' | 'piece' | 'pack' | 'l' | 'ml';
};

export type GroceryGroup = { key: string; lines: GroceryLine[] };

const GROUP_ORDER = ['veg', 'vegetable', 'fruit', 'dal', 'grain', 'dairy', 'dryfruit', 'beverage', 'snack', 'other'];

/** Raw weight is about 0.8 of the cooked bhaji or dal, and a dish is roughly its main ingredient plus water and oil. */
const RAW_FACTOR: Record<string, number> = { veg: 0.8, dal: 0.45, grain: 0.5, vegetable: 1, fruit: 1, dairy: 1, dryfruit: 1, beverage: 1, snack: 1, other: 1 };

function roundAmount(grams: number, food: FoodItem): { amount: string; unit: GroceryLine['unit'] } {
  // Bought by the piece when a piece is a real unit (a chapati, an apple), not a single almond.
  const PIECE = ['piece', 'medium', 'small', 'large', 'slice'];
  const pieceLike = food.portions.find((p) => PIECE.includes(p.unit) && (p.unit === food.default_portion || p.grams >= 20));
  if (pieceLike) {
    const per = pieceLike.grams;
    const n = Math.ceil(grams / per);
    return { amount: `${n}`, unit: 'piece' };
  }
  if (food.category === 'beverage' || food.category === 'dairy') {
    return grams >= 1000 ? { amount: `${Math.round((grams / 1000) * 2) / 2}`, unit: 'l' } : { amount: `${Math.ceil(grams / 100) * 100}`, unit: 'ml' };
  }
  if (grams >= 1000) return { amount: `${Math.round((grams / 1000) * 4) / 4}`, unit: 'kg' };
  return { amount: `${Math.ceil(grams / 50) * 50}`, unit: 'g' };
}

export function groceryList(plan: WeekPlan, foods: FoodItem[], dayIdxs: number[] = [0, 1, 2, 3, 4, 5, 6]): GroceryGroup[] {
  const totals = new Map<string, { grams: number; times: number }>();
  for (const i of dayIdxs) {
    const day = plan.days[i];
    if (!day) continue;
    for (const m of day.meals) {
      for (const l of m.lines) {
        const food = foods.find((f) => f.id === l.foodId);
        if (!food) continue;
        const portion = food.portions.find((p) => p.unit === l.unit) ?? defaultPortion(food);
        const g = (portion?.grams ?? 100) * l.qty;
        const cur = totals.get(l.foodId) ?? { grams: 0, times: 0 };
        totals.set(l.foodId, { grams: cur.grams + g, times: cur.times + 1 });
      }
    }
  }
  const groups = new Map<string, GroceryLine[]>();
  for (const [id, v] of totals) {
    const food = foods.find((f) => f.id === id)!;
    const raw = Math.round(v.grams * (RAW_FACTOR[food.category] ?? 1));
    const { amount, unit } = roundAmount(raw, food);
    const key = GROUP_ORDER.includes(food.category) ? food.category : 'other';
    const list = groups.get(key) ?? [];
    list.push({ foodId: id, food, grams: raw, times: v.times, amount, unit });
    groups.set(key, list);
  }
  return GROUP_ORDER.filter((k) => groups.has(k)).map((k) => ({ key: k, lines: groups.get(k)!.sort((a, b) => b.grams - a.grams) }));
}

/** The week a tick belongs to, so a list ticked on Sunday is clean again next week. */
export function groceryWeekKey(today: ISODate, weekStartDay = 0): string {
  const d = new Date(today + 'T12:00:00');
  const back = (d.getDay() - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - back);
  return d.toISOString().slice(0, 10);
}
