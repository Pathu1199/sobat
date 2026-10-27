import { addDays, weekDates } from './date';
import { menuSlots, skippedOn, type DayMenu } from './menu';
import { pattern, slotOf, type SlotPoint } from './pattern';
import type { Routine } from './routine';
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
};

type RecordBase = { today: ISODate; routine: Routine; meals: Meal[]; skips: SlotSkip[]; offDays: number[] };

export function dayRecord(input: RecordBase & { date: ISODate; menu: DayMenu | null }): DayRecord {
  const dayMeals = input.meals.filter((m) => m.date === input.date);
  const fromPlan = dayMeals.some((m) => m.source === 'auto');
  if (isOffDay(input.offDays, input.date)) return { state: 'off', fromPlan };
  if (input.date > input.today) return { state: 'planned', fromPlan };
  // Meals are matched against every slot of the date; only the ones with something planned must be settled.
  // A date with no menu at all is judged against the pattern's slots, every one of them.
  const all: (SlotPoint & { planned: boolean })[] = input.menu
    ? menuSlots(input.menu).map((s) => ({ id: s.id, type: s.type, minutes: s.minutes, planned: s.meal.lines.length > 0 }))
    : pattern(input.routine).map((p) => ({ id: p.id, type: p.type, minutes: p.minutes, planned: true }));
  const required = all.filter((s) => s.planned);
  if (required.length === 0) return { state: dayMeals.length > 0 ? 'full' : 'empty', fromPlan };
  const skipped = new Set(skippedOn(input.skips, input.date));
  const eaten = new Set<string>();
  for (const m of dayMeals) {
    const s = slotOf(m, all);
    if (s) eaten.add(s.id);
  }
  const settled = required.filter((s) => eaten.has(s.id) || skipped.has(s.id)).length;
  if (settled === required.length) return { state: 'full', fromPlan };
  return { state: settled > 0 || dayMeals.length > 0 ? 'partial' : 'empty', fromPlan };
}

/** The seven records of the week starting on `monday`, Monday first, for the week strip. */
export function weekRecord(input: RecordBase & { monday: ISODate; menuOn: (date: ISODate) => DayMenu | null }): DayRecord[] {
  return weekDates(input.monday).map((date) => dayRecord({ ...input, date, menu: input.menuOn(date) }));
}

/**
 * Full days in a row, back from today. Today counts once it is full, but a
 * today not settled yet never breaks the run, so in the morning the streak is
 * yesterday's, not 0. An off day neither breaks it nor counts. Looks back at
 * most `limit` days.
 */
export function recordStreak(input: RecordBase & { menuOn: (date: ISODate) => DayMenu | null; limit?: number }): number {
  const byDate = new Map<ISODate, Meal[]>();
  for (const m of input.meals) {
    const list = byDate.get(m.date);
    if (list) list.push(m);
    else byDate.set(m.date, [m]);
  }
  let n = 0;
  for (let i = 0; i < (input.limit ?? 60); i++) {
    const date = addDays(input.today, -i);
    const r = dayRecord({ ...input, meals: byDate.get(date) ?? [], date, menu: input.menuOn(date) });
    if (r.state === 'full') n++;
    else if (r.state !== 'off' && i > 0) break;
  }
  return n;
}
