import { addDays, weekDates } from './date';
import { menuSlots, skippedOn, type DayMenu } from './menu';
import { pattern, slotOf, type SlotPoint } from './pattern';
import type { Routine } from './routine';
import { runOf, type Run, type RunDay } from './shield';
import type { ISODate, Meal, SlotSkip } from './types';
import { isOffDay } from './week';

/**
 * The calorie record, day by day. A day is full when every meal it planned
 * was logged or skipped, partial when some were, empty when none; a day after
 * today is only planned, and an off day is off. A day holding a meal the app
 * filled in that nobody confirmed is marked, so the record shows which days
 * were really checked. Pure; the week strip, the calendar and the streak all
 * read it.
 */
export type DayRecordState = 'full' | 'partial' | 'empty' | 'planned' | 'off';

export type DayRecord = {
  state: DayRecordState;
  /** Some meal that day was filled in from the plan and is not confirmed yet. */
  fromPlan: boolean;
  /** Under `NOTHING_EATEN_KCAL` eaten that day: on a full day, its meals were all skipped (a drink at most), never a day to praise. */
  nothingEaten: boolean;
  /** A day whose menu planned nothing: no meal was missed, so the record does not call it meals missing. Only ever true. */
  nothingPlanned?: true;
  /** On a full day with nothing eaten: a meal that day was marked skipped, so it reads as meals skipped. Only ever true. */
  skipped?: true;
};

type RecordBase = { today: ISODate; routine: Routine; meals: Meal[]; skips: SlotSkip[]; offDays: number[] };

export function dayRecord(input: RecordBase & { date: ISODate; menu: DayMenu | null }): DayRecord {
  const dayMeals = input.meals.filter((m) => m.date === input.date);
  const fromPlan = dayMeals.some((m) => m.source === 'auto');
  const nothingEaten = eatenKcal(dayMeals) < NOTHING_EATEN_KCAL;
  const skipped = new Set(skippedOn(input.skips, input.date));
  const at = (state: DayRecordState): DayRecord => ({ state, fromPlan, nothingEaten, ...(state === 'full' && nothingEaten && skipped.size > 0 ? { skipped: true as const } : {}) });
  if (isOffDay(input.offDays, input.date)) return at('off');
  if (input.date > input.today) return at('planned');
  // Meals are matched against every slot of the date; only the ones with something planned must be settled.
  // A date with no menu at all is judged against the pattern's slots, every one of them.
  const all: (SlotPoint & { planned: boolean })[] = input.menu
    ? menuSlots(input.menu).map((s) => ({ id: s.id, type: s.type, minutes: s.minutes, planned: s.meal.lines.length > 0 }))
    : pattern(input.routine).map((p) => ({ id: p.id, type: p.type, minutes: p.minutes, planned: true }));
  const required = all.filter((s) => s.planned);
  if (required.length === 0) return { ...at(dayMeals.length > 0 ? 'full' : 'empty'), nothingPlanned: true };
  const eaten = new Set<string>();
  for (const m of dayMeals) {
    const s = slotOf(m, all);
    if (s) eaten.add(s.id);
  }
  const settled = required.filter((s) => eaten.has(s.id) || skipped.has(s.id)).length;
  if (settled === required.length) return at('full');
  return at(settled > 0 || dayMeals.length > 0 ? 'partial' : 'empty');
}

/** The seven records of the week starting on `monday`, Monday first, for the week strip. */
export function weekRecord(input: RecordBase & { monday: ISODate; menuOn: (date: ISODate) => DayMenu | null }): DayRecord[] {
  return weekDates(input.monday).map((date) => dayRecord({ ...input, date, menu: input.menuOn(date) }));
}

/** What one day does to a run of days: adds to it, leaves it as it was, or ends it. */
export type StreakStep = 'count' | 'hold' | 'break';

/**
 * How far back the streak and the best run on the streak tile look, in days: one window, so they never disagree. Past the
 * 100-day medal; no longer than the app keeps a lived day's menu (`LIVED_MENU_KEEP_DAYS`), so every day in it is judged on
 * the menu it showed.
 */
export const STREAK_LOOKBACK_DAYS = 120;

/** A day eaten under this many kcal ate nothing: warm water, black tea or coffee, and no meal. */
export const NOTHING_EATEN_KCAL = 50;

/**
 * What a day does to the streak, the one rule the streak and the best run
 * both follow, given the day's state, the meals eaten that day and the
 * person's safe minimum. A full day eaten at or above the minimum counts. A
 * full day with meals eaten under it (most meals skipped, a sick day) is an
 * honest record, never punished: it neither counts nor ends the run. A full
 * day with nothing eaten (under `NOTHING_EATEN_KCAL`: every slot skipped, or
 * a drink in one and the rest skipped) ends the run, so skipping is never
 * rewarded or kept alive by the streak. A total that is not a number (a
 * damaged record) neither counts nor ends it. An off day neither counts nor
 * ends it; any other day ends it.
 */
export function streakStep(state: DayRecordState, meals: Meal[], floor: number): StreakStep {
  if (state === 'off') return 'hold';
  if (state !== 'full') return 'break';
  const kcal = eatenKcal(meals);
  if (kcal < NOTHING_EATEN_KCAL) return 'break';
  return kcal >= floor ? 'count' : 'hold';
}

/** The meals of each date, so a look back over many days reads each date once. */
export function mealsByDate(meals: Meal[]): Map<ISODate, Meal[]> {
  const byDate = new Map<ISODate, Meal[]>();
  for (const m of meals) {
    const list = byDate.get(m.date);
    if (list) list.push(m);
    else byDate.set(m.date, [m]);
  }
  return byDate;
}

/** Calories eaten in a list of meals. */
export function eatenKcal(meals: Meal[]): number {
  return meals.reduce((a, m) => a + m.kcal, 0);
}

type RecordRunInput = RecordBase & { menuOn: (date: ISODate) => DayMenu | null; floor: number };

/**
 * The record's days as a run reads them, oldest first, the last `days` up to
 * today: each by the streak's rule (`streakStep`). A today not settled yet
 * holds, so it never ends the run and in the morning the streak is
 * yesterday's; a today already full with nothing eaten ends it at once. A day
 * that ends a run may be covered by the shield unless it was full with
 * nothing eaten: skipping every meal is never kept alive by the streak.
 */
function recordDays(input: RecordRunInput & { days: number }): RunDay[] {
  const byDate = mealsByDate(input.meals);
  const out: RunDay[] = [];
  for (let i = input.days - 1; i >= 0; i--) {
    const date = addDays(input.today, -i);
    const meals = byDate.get(date) ?? [];
    const state = dayRecord({ ...input, meals, date, menu: input.menuOn(date) }).state;
    const step = streakStep(state, meals, input.floor);
    out.push({ date, step: i === 0 && step === 'break' && state !== 'full' ? 'hold' : step, coverable: state !== 'full' });
  }
  return out;
}

/**
 * The record's run over the last `days` (the streak's window unless told):
 * the streak, the best run and, with `shield`, the days the streak shield
 * covered (core/shield.ts). `floor` is the person's safe minimum.
 */
export function recordRun(input: RecordRunInput & { days?: number; shield?: boolean }): Run {
  return runOf(recordDays({ ...input, days: input.days ?? STREAK_LOOKBACK_DAYS }), input.shield ?? false);
}

/**
 * Days in a row that count (`streakStep`), back from today. Today counts once
 * it is full, but a today not settled yet never breaks the run, so in the
 * morning the streak is yesterday's, not 0. A today already full with nothing
 * eaten ends the run at once. `floor` is the person's safe minimum. Looks
 * back at most `limit` days, the streak window unless told.
 */
export function recordStreak(input: RecordRunInput & { limit?: number }): number {
  return recordRun({ ...input, days: input.limit }).days;
}
