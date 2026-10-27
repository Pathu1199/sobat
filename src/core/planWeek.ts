import { addDays, mondayOf } from './date';
import { hasPlan, type DayMenu } from './menu';
import type { FoodItem, ISODate } from './types';
import { isOffDay } from './week';
import { dayStatus, dayTotals, lineInfo, roleOf, type PlanMeal } from './weekPlan';

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
  /** Before today: history, shown but not edited here. */
  past: boolean;
};

/** Parts of a plate that are not its main dish. */
const SIDES = ['bread', 'rice', 'drink', 'dairy'];

/** The day's main dish: the planned food with the most calories that is not bread, rice, a drink or milk; else the one with the most calories. */
export function mainDish(day: { meals: PlanMeal[] }, foods: FoodItem[]): string | null {
  let best: { id: string; kcal: number } | null = null;
  let any: { id: string; kcal: number } | null = null;
  for (const m of day.meals) {
    for (const l of m.lines) {
      const info = lineInfo(l, foods);
      if (!info) continue;
      if (!any || info.kcal > any.kcal) any = { id: info.food.id, kcal: info.kcal };
      if (!SIDES.includes(roleOf(info.food)) && (!best || info.kcal > best.kcal)) best = { id: info.food.id, kcal: info.kcal };
    }
  }
  return (best ?? any)?.id ?? null;
}

export function planWeekRows(input: {
  week: DayMenu[];
  today: ISODate;
  target: number;
  floor: number;
  offDays: number[];
  foods: FoodItem[];
  /** A day the app built from the pattern and nobody changed. */
  suggested: (d: DayMenu) => boolean;
}): PlanRow[] {
  return input.week.map((d) => {
    const totals = dayTotals({ meals: d.meals }, input.foods);
    let status: PlanRowStatus;
    if (isOffDay(input.offDays, d.date)) status = 'off';
    else if (!hasPlan(d)) status = 'empty';
    else if (input.suggested(d) && totals.kcal >= input.floor) status = 'suggested';
    else {
      const s = dayStatus(totals.kcal, input.target, input.floor);
      status = s === 'over' ? 'high' : s === 'low' ? 'low' : 'on';
    }
    return {
      date: d.date,
      weekday: new Date(`${d.date}T12:00:00`).getDay(),
      kcal: totals.kcal,
      protein: totals.protein,
      mainFoodId: mainDish(d, input.foods),
      status,
      past: d.date < input.today,
    };
  });
}

/** The planned calories a day on average, off and empty days left out, and how far that is from the target. Null with nothing planned. */
export function weekAverage(rows: PlanRow[], target: number): { avg: number; diff: number } | null {
  const counted = rows.filter((r) => r.status !== 'off' && r.status !== 'empty');
  if (counted.length === 0) return null;
  const avg = Math.round(counted.reduce((a, r) => a + r.kcal, 0) / counted.length);
  return { avg, diff: avg - target };
}

/** The week the plan screen opens on: this one from Monday to Friday, the next one at the weekend, when it is the one to plan. */
export function defaultPlanWeek(today: ISODate): ISODate {
  const wd = new Date(`${today}T12:00:00`).getDay();
  return wd === 0 || wd === 6 ? addDays(mondayOf(today), 7) : mondayOf(today);
}

/** Weeks marked as looked over, newest first, the eight newest kept. The same list when the week is already in it. */
export function withReviewedWeek(list: ISODate[] | undefined, monday: ISODate): ISODate[] {
  const prev = list ?? [];
  if (prev.includes(monday)) return prev;
  return [monday, ...prev].sort((a, b) => b.localeCompare(a)).slice(0, 8);
}
