import { defaultPortion } from './foods';
import { kcalForGrams, MEAL_WINDOWS } from './nutrition';
import type { FoodItem, MealType } from './types';

/**
 * "980 kcal left: what can I still eat today?" The rest of the day is split
 * across the meals not yet eaten, and each gets a plate that fits: a grain,
 * a bhaji, a dal for lunch and dinner; something light for a snack; the
 * usual things for breakfast. Everything comes from the food list, so each
 * line can be logged with one tap. A seed reshuffles the picks.
 */
export type Pick = { food: FoodItem; grams: number; kcal: number; protein: number; /** Lighter swaps for the same role: cut this, have that. */ alts?: Pick[] };
export type SlotPlan = { type: MealType; budget: number; picks: Pick[]; kcal: number; protein: number };
export type DayPlan = {
  remaining: number;
  /** True when what is left is too little to eat anything but water or fruit. */
  stop: boolean;
  slots: SlotPlan[];
  /** The meal that is on now, or next. */
  now: MealType;
};

export type DayPlanInput = {
  remaining: number;
  hour: number;
  loggedTypes: MealType[];
  foods: FoodItem[];
  avoided: Set<string>;
  /** Today's bhaji from the routine, if any; these are preferred for lunch and dinner. */
  preferred?: string[];
  seed?: number;
};

const SKIP_TAGS = ['fried', 'street_food', 'packaged', 'nonveg', 'egg'];
const STOP_BELOW = 80;

function portionOf(f: FoodItem): Pick | null {
  const p = defaultPortion(f);
  if (!p) return null;
  const n = kcalForGrams(f, p.grams);
  return { food: f, grams: p.grams, kcal: n.kcal, protein: n.protein };
}

function usable(f: FoodItem, avoided: Set<string>): boolean {
  if (avoided.has(f.id)) return false;
  if (f.category === 'nonveg' || f.category === 'sweet' || f.category === 'beverage' || f.category === 'fast_food') return false;
  return !f.tags.some((t) => SKIP_TAGS.includes(t));
}

/** Candidates for one role, best protein per calorie first, rotated by the seed so a reshuffle shows others. */
function candidates(foods: FoodItem[], avoided: Set<string>, role: 'grain' | 'veg' | 'dal' | 'breakfast' | 'snack', max: number, seed: number, preferred: string[] = []): Pick[] {
  const list = foods
    .filter((f) => usable(f, avoided))
    .filter((f) => {
      if (role === 'grain') return f.category === 'grain' && !f.tags.includes('breakfast');
      if (role === 'veg') return f.category === 'veg';
      if (role === 'dal') return f.category === 'dal' || f.tags.includes('usal');
      if (role === 'breakfast') return f.tags.includes('breakfast') || f.category === 'dairy' || f.category === 'fruit';
      return f.category === 'fruit' || f.category === 'dairy' || f.category === 'dryfruit' || (f.category === 'snack' && f.tags.includes('healthy_swap'));
    })
    .map(portionOf)
    .filter((p): p is Pick => !!p && p.kcal <= max && p.kcal >= 30)
    .sort((a, b) => {
      const pa = preferred.includes(a.food.id) ? 1 : 0;
      const pb = preferred.includes(b.food.id) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.protein / Math.max(1, b.kcal) - a.protein / Math.max(1, a.kcal);
    });
  if (list.length === 0) return [];
  // Keep the preferred ones at the front; rotate the rest.
  const front = list.filter((p) => preferred.includes(p.food.id));
  const rest = list.filter((p) => !preferred.includes(p.food.id));
  const k = rest.length ? seed % rest.length : 0;
  return [...front, ...rest.slice(k), ...rest.slice(0, k)];
}

function plate(type: MealType, budget: number, input: DayPlanInput, slotIndex = 0): Pick[] {
  // Each meal rotates from a different point, so dinner is not lunch again.
  const seed = (input.seed ?? 0) + slotIndex * 3;
  const picks: Pick[] = [];
  let left = budget;
  const take = (role: Parameters<typeof candidates>[2], share: number, prefer?: string[]) => {
    const list = candidates(input.foods, input.avoided, role, Math.min(left, budget * share), seed, prefer);
    const c = list.find((x) => !picks.some((p) => p.food.id === x.food.id));
    if (c) {
      // Two swaps that cost no more than the pick, so "cut this, have that" is always a saving.
      const alts = list.filter((x) => x.food.id !== c.food.id && x.kcal <= c.kcal && !picks.some((p) => p.food.id === x.food.id)).slice(0, 2);
      picks.push({ ...c, alts });
      left -= c.kcal;
    }
  };
  if (type === 'lunch' || type === 'dinner') {
    take('veg', 0.45, input.preferred);
    take('grain', 0.5);
    take('dal', 0.4);
    // Room for one more chapati or bhakri, if the plate is still light; then curd or a fruit.
    if (left > budget * 0.3) take('grain', 0.35);
    if (left > budget * 0.2) take('snack', 0.3);
  } else if (type === 'breakfast') {
    // Poha or upma, then milk or a fruit, then one more if the plate is still light.
    take('breakfast', 0.8);
    if (left > budget * 0.3) take('breakfast', 0.6);
    if (left > budget * 0.25) take('snack', 0.5);
  } else {
    take('snack', 0.8);
    if (left > budget * 0.4) take('snack', 0.5);
  }
  return picks;
}

export function dayPlan(input: DayPlanInput): DayPlan {
  const remaining = Math.max(0, Math.round(input.remaining));
  const windowsLeft = MEAL_WINDOWS.filter((w) => w.endHour > input.hour && !input.loggedTypes.includes(w.type));
  const nowWindow = MEAL_WINDOWS.find((w) => input.hour >= w.startHour && input.hour < w.endHour);
  const now: MealType = nowWindow?.type ?? windowsLeft[0]?.type ?? 'snack';
  const stop = remaining < STOP_BELOW;
  if (stop || windowsLeft.length === 0) return { remaining, stop, slots: [], now };
  const shareSum = windowsLeft.reduce((a, w) => a + w.share, 0);
  const slots: SlotPlan[] = windowsLeft.map((w, i) => {
    const budget = Math.round((remaining * w.share) / shareSum);
    const picks = plate(w.type, budget, input, i);
    return { type: w.type, budget, picks, kcal: picks.reduce((a, p) => a + p.kcal, 0), protein: Math.round(picks.reduce((a, p) => a + p.protein, 0)) };
  });
  return { remaining, stop, slots, now };
}

/** The whole day on the target, every meal, as a sheet to plan from in the morning. */
export function fullDayPlan(input: Omit<DayPlanInput, 'hour' | 'loggedTypes'>): DayPlan {
  return dayPlan({ ...input, hour: 0, loggedTypes: [] });
}
