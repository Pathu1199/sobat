import { formatQty } from './basket';
import { foodName } from './foods';
import { menuSlots, type DayMenu } from './menu';
import { slotOf } from './pattern';
import type { FoodItem, ISODate, Lang, Meal, MealType } from './types';
import { lineInfo } from './weekPlan';

/**
 * The day's menu as Today shows it, one row per slot of that date's menu.
 * A slot holding a meal is done (one the app filled in too, marked by its
 * id until confirmed); a skipped slot is skipped; a future day is all plan.
 * Today, the current slot is the first one still open at or after the slot
 * whose turn it is, open slots before it can still be filled in, and the rest
 * are later. On a past day every slot not settled is open. Only slots with
 * something planned count as missing, as in the record. Pure.
 */
export type DayMode = 'past' | 'today' | 'future';
export type RowState = 'done' | 'skipped' | 'current' | 'open' | 'later' | 'plan';
/** One planned food: `idx` is its place in the menu meal, so − / + edits the right line. */
export type RowLine = { idx: number; foodId: string; name: string; qty: number; qtyText: string; unit: string; grams: number; kcal: number; protein: number };
export type MenuRow = {
  slotId: string;
  type: MealType;
  time: string;
  lines: RowLine[];
  plannedKcal: number;
  /** The meals eaten in this slot on the date. */
  meals: Meal[];
  eatenKcal: number;
  state: RowState;
  /** Meals here the app filled in from the plan and nobody confirmed yet. */
  autoIds: string[];
};
export type DayView = {
  mode: DayMode;
  rows: MenuRow[];
  /** Slots with something planned. */
  required: number;
  /** Of those, the ones eaten or skipped. */
  settled: number;
  /** A past day's planned slots still open; 0 on other days. */
  missing: number;
  plannedKcal: number;
  plannedProtein: number;
  eatenKcal: number;
  eatenProtein: number;
  autoIds: string[];
  /** A past day with nothing logged or skipped: "Fill this day from plan". */
  canFill: boolean;
};

export function dayMode(date: ISODate, today: ISODate): DayMode {
  return date < today ? 'past' : date > today ? 'future' : 'today';
}

export function dayView(input: {
  date: ISODate;
  today: ISODate;
  menu: DayMenu;
  meals: Meal[];
  /** Slot ids skipped on the date. */
  skippedIds: string[];
  /** Today: the slot whose turn it is, from the pattern; null on other days. */
  currentId: string | null;
  foods: FoodItem[];
  lang: Lang;
}): DayView {
  const mode = dayMode(input.date, input.today);
  const slots = menuSlots(input.menu);
  const dayMeals = input.meals.filter((m) => m.date === input.date);
  const bySlot = new Map<string, Meal[]>(slots.map((s) => [s.id, []]));
  for (const m of dayMeals) {
    const s = slotOf(m, slots);
    if (s) bySlot.get(s.id)?.push(m);
  }
  const skipped = new Set(input.skippedIds);
  const rows: MenuRow[] = slots.map((s) => {
    const lines: RowLine[] = [];
    s.meal.lines.forEach((line, idx) => {
      const info = lineInfo(line, input.foods, input.lang);
      if (info) lines.push({ idx, foodId: line.foodId, name: foodName(info.food, input.lang), qty: line.qty, qtyText: formatQty(line.qty), unit: info.unit, grams: info.grams, kcal: info.kcal, protein: info.protein });
    });
    const meals = bySlot.get(s.id) ?? [];
    const state: RowState = mode === 'future' ? 'plan' : meals.length > 0 ? 'done' : skipped.has(s.id) ? 'skipped' : 'open';
    return {
      slotId: s.id,
      type: s.type,
      time: s.meal.time,
      lines,
      plannedKcal: lines.reduce((a, l) => a + l.kcal, 0),
      meals,
      eatenKcal: meals.reduce((a, m) => a + m.kcal, 0),
      state,
      autoIds: meals.filter((m) => m.source === 'auto').map((m) => m.id),
    };
  });
  if (mode === 'today') {
    const from = Math.max(0, rows.findIndex((r) => r.slotId === input.currentId));
    const cur = rows.findIndex((r, i) => i >= from && r.state === 'open');
    rows.forEach((r, i) => {
      if (r.state === 'open' && cur >= 0 && i >= cur) r.state = i === cur ? 'current' : 'later';
    });
  }
  const required = rows.filter((r) => r.lines.length > 0);
  const settled = required.filter((r) => r.state === 'done' || r.state === 'skipped').length;
  return {
    mode,
    rows,
    required: required.length,
    settled,
    missing: mode === 'past' ? required.length - settled : 0,
    plannedKcal: rows.reduce((a, r) => a + r.plannedKcal, 0),
    plannedProtein: Math.round(rows.reduce((a, r) => a + r.lines.reduce((b, l) => b + l.protein, 0), 0)),
    eatenKcal: dayMeals.reduce((a, m) => a + m.kcal, 0),
    eatenProtein: Math.round(dayMeals.reduce((a, m) => a + m.protein, 0)),
    autoIds: rows.flatMap((r) => r.autoIds),
    canFill: mode === 'past' && required.length > 0 && dayMeals.length === 0 && rows.every((r) => r.state !== 'skipped'),
  };
}
