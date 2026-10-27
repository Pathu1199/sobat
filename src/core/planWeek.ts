import { addDays, mondayOf } from './date';
import { hasPlan, type DayMenu } from './menu';
import { weekdayOf } from './routine';
import type { FoodItem, ISODate } from './types';
import { isOffDay } from './week';
import { dayStatus, dayTotals, lineInfo, roleOf, type PlanMeal, type Role } from './weekPlan';

/**
 * The plan screen's week: one row per date with its total, its main dish
 * and a status against the target, the week's average, the week the screen
 * opens on, and the stamp that says a week was looked over. Pure.
 */
export type PlanRowStatus = 'on' | 'high' | 'low' | 'off' | 'suggested' | 'empty';
export type PlanRow = {
  date: ISODate;
  /** Date.getDay(): 0 is Sunday. */
  weekday: number;
  kcal: number;
  protein: number;
  mainFoodId: string | null;
  status: PlanRowStatus;
  /** A free day in the person's settings, whatever its status says: a free day planned under the safe minimum still reads low. */
  off: boolean;
  /** The app's own suggestion for a day from today on, nobody changed it: a low one is said in amber, not red. */
  suggested: boolean;
  /** Before today: history, shown but not edited here. */
  past: boolean;
};

/** Parts of a plate that are not its main dish. */
const SIDES: Role[] = ['bread', 'rice', 'drink', 'dairy'];

type Found = { id: string; kcal: number };

/** The food of these meals with the most calories that passes `ok`. */
function biggest(meals: PlanMeal[], foods: FoodItem[], ok: (role: Role) => boolean): Found | null {
  let best: Found | null = null;
  for (const m of meals) {
    for (const l of m.lines) {
      const info = lineInfo(l, foods);
      if (info && ok(roleOf(info.food)) && (!best || info.kcal > best.kcal)) best = { id: info.food.id, kcal: info.kcal };
    }
  }
  return best;
}

/** What the meal plans in calories, foods gone from the database left out. */
function mealKcal(m: PlanMeal, foods: FoodItem[]): number {
  return m.lines.reduce((a, l) => a + (lineInfo(l, foods)?.kcal ?? 0), 0);
}

/**
 * The day's main dish, looked for in its main meals: lunch and dinner, or on
 * a day with neither, the meal that plans the most calories. There the bhaji
 * first, then the dal, then the food with the most calories that is not
 * bread, rice, a drink or milk. Failing that, the same rule over the whole
 * day, and last the food with the most calories of all. Null with nothing
 * planned.
 */
export function mainDish(day: { meals: PlanMeal[] }, foods: FoodItem[]): string | null {
  const planned = day.meals.filter((m) => m.lines.length > 0);
  let main = planned.filter((m) => m.type === 'lunch' || m.type === 'dinner');
  if (main.length === 0 && planned.length > 0) {
    const top = planned.reduce((a, m) => (mealKcal(m, foods) > mealKcal(a, foods) ? m : a));
    main = [top];
  }
  const notSide = (role: Role) => !SIDES.includes(role);
  const found =
    biggest(main, foods, (role) => role === 'bhaji') ??
    biggest(main, foods, (role) => role === 'dal') ??
    biggest(main, foods, notSide) ??
    biggest(planned, foods, notSide) ??
    biggest(planned, foods, () => true);
  return found?.id ?? null;
}

export function planWeekRows(input: {
  week: DayMenu[];
  today: ISODate;
  target: number;
  floor: number;
  offDays: number[];
  foods: FoodItem[];
  /** A day the app built from the pattern and nobody changed. Asked only of today and later days that plan something. */
  suggested: (d: DayMenu) => boolean;
}): PlanRow[] {
  return input.week.map((d) => {
    const totals = dayTotals({ meals: d.meals }, input.foods);
    const past = d.date < input.today;
    const off = isOffDay(input.offDays, d.date);
    const planned = hasPlan(d);
    // A day already lived is history: what it held is weighed like any plan, never called the app's suggestion.
    const suggested = !past && planned && input.suggested(d);
    let status: PlanRowStatus;
    // Under the safe minimum always shows, a free day included, so "Looks good, save week" never passes such a day as free.
    if (planned && totals.kcal < input.floor) status = 'low';
    else if (off) status = 'off';
    else if (!planned) status = 'empty';
    else if (suggested) status = 'suggested';
    else {
      const s = dayStatus(totals.kcal, input.target, input.floor);
      status = s === 'over' ? 'high' : s === 'low' ? 'low' : 'on';
    }
    return {
      date: d.date,
      weekday: weekdayOf(d.date),
      kcal: totals.kcal,
      protein: totals.protein,
      mainFoodId: mainDish(d, input.foods),
      status,
      off,
      suggested,
      past,
    };
  });
}

/** The colour of a row's status word: low is red for the person's own plan and amber for the app's suggestion (as the opened menu says it), high amber, on target teal, the rest grey. */
export type PlanRowTone = 'red' | 'amber' | 'accent' | 'dim';
export function planRowTone(r: Pick<PlanRow, 'status' | 'suggested'>): PlanRowTone {
  if (r.status === 'low') return r.suggested ? 'amber' : 'red';
  if (r.status === 'high') return 'amber';
  if (r.status === 'on') return 'accent';
  return 'dim';
}

/** The planned calories a day on average, free and empty days left out, and how far that is from the target. Null with nothing planned. */
export function weekAverage(rows: PlanRow[], target: number): { avg: number; diff: number } | null {
  const counted = rows.filter((r) => !r.off && r.status !== 'empty');
  if (counted.length === 0) return null;
  const avg = Math.round(counted.reduce((a, r) => a + r.kcal, 0) / counted.length);
  return { avg, diff: avg - target };
}

/** The week the plan screen opens on: this one from Monday to Friday, the next one at the weekend, when it is the one to plan. */
export function defaultPlanWeek(today: ISODate): ISODate {
  const wd = weekdayOf(today);
  return wd === 0 || wd === 6 ? addDays(mondayOf(today), 7) : mondayOf(today);
}

/** Weeks marked as looked over, newest first, the eight newest kept. The same list when nothing changes: the week is in it already, or older than all eight kept. */
export function withReviewedWeek(list: ISODate[] | undefined, monday: ISODate): ISODate[] {
  const prev = list ?? [];
  if (prev.includes(monday)) return prev;
  const next = [monday, ...prev].sort((a, b) => b.localeCompare(a)).slice(0, 8);
  return next.includes(monday) ? next : prev;
}

/**
 * What Balance on the plan screen leaves alone. It counts with every food a
 * plan names (`planFoods`, the list the totals on screen are counted with),
 * so it balances the total the person sees; a food outside the person's diet
 * counts as avoided, so Balance never adds one or makes one bigger, as it
 * never does a food the pattern avoids.
 */
export function balanceAvoided(avoided: Set<string>, planFoods: FoodItem[], dietFoods: FoodItem[]): Set<string> {
  const diet = new Set(dietFoods.map((f) => f.id));
  const out = new Set(avoided);
  for (const f of planFoods) if (!diet.has(f.id)) out.add(f.id);
  return out;
}
