import type { UndoStep } from './addSheet';
import { formatQty, steppedLine } from './basket';
import { foodName, measureName } from './foods';
import { menuSlots, outsideRecord, planFillId, type DayMenu } from './menu';
import { DAY_ENDS_AT_HOUR } from './nudge';
import { slotOf } from './pattern';
import { NOTHING_EATEN_KCAL } from './record';
import type { PlanLine } from './routine';
import type { FoodItem, ISODate, Lang, Meal, MealType } from './types';
import { dayStatus, lineInfo } from './weekPlan';

/**
 * The day's menu as Today shows it, one row per slot of that date's menu.
 * A slot holding a meal is done (one the app filled in too, marked by its
 * id until confirmed); a skipped slot is skipped; a future day is all plan.
 * Today, the current slot is the first one still open at or after the slot
 * whose turn it is, open slots before it can still be filled in, and the rest
 * are later. On a past day every slot not settled is open. Only slots with
 * something planned count as missing, as in the record. An off day and a day
 * before the person started show their rows the same way, but nothing on
 * them is missing or filled in from the plan (`judged` is false). Pure.
 */
export type DayMode = 'past' | 'today' | 'future';
export type RowState = 'done' | 'skipped' | 'current' | 'open' | 'later' | 'plan';
/** One planned food: `idx` is its place in the menu meal, so − / + edits the right line; `measure` names one of its measures ("1 katori (150 g)"). */
export type RowLine = { idx: number; foodId: string; name: string; qty: number; qtyText: string; unit: string; measure: string; grams: number; kcal: number; protein: number };
export type MenuRow = {
  slotId: string;
  type: MealType;
  time: string;
  lines: RowLine[];
  /** The slot's menu meal has lines, whether or not their foods are still in the database: a meal the day asks for, as in the record. */
  planned: boolean;
  plannedKcal: number;
  /** The meals eaten in this slot on the date. */
  meals: Meal[];
  eatenKcal: number;
  state: RowState;
  /** Meals here the app filled in from the plan and nobody confirmed yet. */
  autoIds: string[];
};
export type DayView = {
  date: ISODate;
  mode: DayMode;
  rows: MenuRow[];
  /** Slots with something planned. */
  required: number;
  /** A day in the record: today or a past day, not an off day, not before the person started. */
  judged: boolean;
  /** Of those, the ones eaten or skipped. */
  settled: number;
  /** A past day's planned slots still open; 0 on other days and on a day not judged. */
  missing: number;
  plannedKcal: number;
  plannedProtein: number;
  eatenKcal: number;
  eatenProtein: number;
  autoIds: string[];
  /** A past day judged, with nothing logged or skipped: "Fill this day from plan". */
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
  /** The plan screen's view: today and later as plan, never judged. It edits a day's menu and never logs; a past date keeps its own rows, which offer no Change (the store refuses an edit before today). */
  planOnly?: boolean;
  /** An off day in the person's settings. */
  offDay: boolean;
  /** The first day of the person's record (core/weekStrip.ts `stripSince`, the strip's own start); a date before it is not judged. */
  startDate?: ISODate;
}): DayView {
  const mode: DayMode = input.planOnly && input.date >= input.today ? 'future' : dayMode(input.date, input.today);
  const judged = !input.planOnly && mode !== 'future' && !outsideRecord(input.date, input.offDay, input.startDate);
  const slots = menuSlots(input.menu);
  const dayMeals = input.meals.filter((m) => m.date === input.date);
  const bySlot = new Map<string, Meal[]>(slots.map((s) => [s.id, []]));
  for (const m of dayMeals) {
    const s = slotOf(m, slots);
    if (s) bySlot.get(s.id)?.push(m);
  }
  const skipped = new Set(input.skippedIds);
  const rows: MenuRow[] = slots.map((s) => {
    const lines = rowLines(s.meal.lines, input.foods, input.lang);
    const meals = bySlot.get(s.id) ?? [];
    const state: RowState = mode === 'future' ? 'plan' : meals.length > 0 ? 'done' : skipped.has(s.id) ? 'skipped' : 'open';
    return {
      slotId: s.id,
      type: s.type,
      time: s.meal.time,
      lines,
      planned: s.meal.lines.length > 0,
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
  // As in the record: a slot counts when its menu meal has lines, even one whose food has left the database.
  const required = rows.filter((r) => r.planned);
  const settled = required.filter((r) => r.state === 'done' || r.state === 'skipped').length;
  return {
    date: input.date,
    mode,
    rows,
    required: required.length,
    judged,
    settled,
    missing: mode === 'past' && judged ? required.length - settled : 0,
    plannedKcal: rows.reduce((a, r) => a + r.plannedKcal, 0),
    plannedProtein: Math.round(rows.reduce((a, r) => a + r.lines.reduce((b, l) => b + l.protein, 0), 0)),
    eatenKcal: dayMeals.reduce((a, m) => a + m.kcal, 0),
    eatenProtein: Math.round(dayMeals.reduce((a, m) => a + m.protein, 0)),
    autoIds: rows.flatMap((r) => r.autoIds),
    canFill: mode === 'past' && judged && required.length > 0 && dayMeals.length === 0 && rows.every((r) => r.state !== 'skipped'),
  };
}

/** Planned lines as a row shows them, each with its place in `lines`; a food gone from the database is left out. */
export function rowLines(lines: PlanLine[], foods: FoodItem[], lang: Lang): RowLine[] {
  const out: RowLine[] = [];
  lines.forEach((line, idx) => {
    const info = lineInfo(line, foods, lang);
    if (info)
      out.push({
        idx,
        foodId: line.foodId,
        name: foodName(info.food, lang),
        qty: line.qty,
        qtyText: formatQty(line.qty),
        unit: info.unit,
        measure: measureName(info.food, info.unit, lang),
        grams: info.grams,
        kcal: info.kcal,
        protein: info.protein,
      });
  });
  return out;
}

/**
 * A past day's − / + on an open slot changes a draft of what was eaten, never
 * that day's menu (its record of what was planned): the slot's planned lines
 * until a tap, each step on the measure's grid, and − to nothing takes the
 * food out of the draft. "Ate this" logs the draft. A step on no line changes
 * nothing, and nor does one on a line that is no longer the food tapped (a
 * quick second − after the first took its line out lands on the next food).
 */
export function stepDraft(lines: PlanLine[], idx: number, foodId: string, by: 1 | -1): PlanLine[] {
  const line = lines[idx];
  if (!line || line.foodId !== foodId) return lines;
  const next = steppedLine(line, by);
  return next ? lines.map((l, i) => (i === idx ? next : l)) : lines.filter((_, i) => i !== idx);
}

/** One draft per date and slot, so a draft never follows the person to another day. */
export function draftKey(date: ISODate, slotId: string): string {
  return `${date}:${slotId}`;
}

/** A button a row of the day's menu offers (the words are DayMenu's). */
export type RowOffer = 'planned' | 'change' | 'add' | 'ate_this' | 'ate_other' | 'skip';

/**
 * The buttons a row offers. The slot whose turn it is: Ate as planned and
 * Change, or only a way to add food when nothing it plans can be logged. An
 * open slot (a past day, or one today passed empty): Ate this when there is
 * something to log as planned, Ate other, and Skipped while it is one of the
 * day's meals. A future day changes its plan and never logs: Change, or add
 * food to an empty slot. Done, skipped and later rows have none of these.
 */
export function rowOffers(row: Pick<MenuRow, 'state' | 'lines' | 'planned'>): RowOffer[] {
  const has = row.lines.length > 0;
  if (row.state === 'current') return has ? ['planned', 'change'] : ['add'];
  if (row.state === 'plan') return has ? ['change'] : ['add'];
  if (row.state !== 'open') return [];
  const out: RowOffer[] = has ? ['ate_this', 'ate_other'] : ['ate_other'];
  if (row.planned) out.push('skip');
  return out;
}

/** "Day looks right", which confirms every meal the app filled in that day: a past day, or today from 21:00, while there is one to confirm. */
export function offersDayConfirm(view: Pick<DayView, 'mode' | 'autoIds'>, hour: number): boolean {
  if (view.autoIds.length === 0) return false;
  return view.mode === 'past' || (view.mode === 'today' && hour >= DAY_ENDS_AT_HOUR);
}

/**
 * How a past day's record bar ("3 of 3 meals") is drawn: full when every
 * planned meal was eaten or skipped, missing while some are open. A day of
 * meals all skipped with nothing eaten (a drink at most) is `skipped`, a
 * record of its own and never the teal of a full day, as the week strip
 * marks it (core/weekStrip.ts `markOf`): skipping is not praised.
 */
export function recordTone(view: Pick<DayView, 'settled' | 'required' | 'eatenKcal'>): 'full' | 'skipped' | 'missing' {
  if (view.settled < view.required) return 'missing';
  return view.eatenKcal < NOTHING_EATEN_KCAL ? 'skipped' : 'full';
}

/** The line under a future day's total. */
export type PlanNote = 'suggested' | 'suggested_low' | 'low' | null;

/**
 * The line under a future day's total against the goal. The app's own
 * suggestion for a day nobody wrote is named as one, in a neutral tone, and
 * points to Balance only when it is under the safe minimum; the person's own
 * plan too low for a day (`dayStatus` 'low') is said plainly, with the way to
 * the diet plan. A day with nothing planned has no total to call low.
 */
export function planNote(input: { kcal: number; target: number; floor: number; suggested: boolean; hasPlan: boolean }): PlanNote {
  if (!input.hasPlan) return null;
  if (input.suggested) return input.kcal < input.floor ? 'suggested_low' : 'suggested';
  return dayStatus(input.kcal, input.target, input.floor) === 'low' ? 'low' : null;
}

/**
 * The Undo of "Fill this day from plan", from the day as it was before: each
 * meal it logged taken away (by the id `fillFromPlan` gives it) and its slot
 * left open, not skipped, as every slot was on a day that could be filled.
 * Nothing for a day that cannot be filled.
 */
export function fillUndoSteps(view: Pick<DayView, 'date' | 'canFill' | 'rows'>): UndoStep[] {
  if (!view.canFill) return [];
  return view.rows
    .filter((r) => r.lines.length > 0)
    .flatMap((r): UndoStep[] => [
      { kind: 'remove', id: planFillId(view.date, r.slotId) },
      { kind: 'unskip', date: view.date, slotId: r.slotId },
    ]);
}
