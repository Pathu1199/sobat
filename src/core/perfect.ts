import { firstDate, isDone, itemsOn, minutesOn, type AbhyasData } from './abhyas';
import { addDays, isIsoDate, localDate, mondayOf, weekDates } from './date';
import type { StreakStep } from './record';
import type { AbhyasItem, AbhyasSession, AbhyasTick, ISODate } from './types';

/**
 * The gold days and weeks. A perfect day gets a gold star on the Progress
 * calendar; a perfect week of a routine job is a medal. Pure.
 */

/**
 * A perfect day: the meal record full and eaten at the safe minimum or more
 * (the day the streak counts, `streakStep` 'count', so a day of meals all
 * skipped, one under the safe minimum, an off day or a day still to come is
 * never one), every routine job on the day done, and the water goal met.
 */
export function perfectDay(day: { step: StreakStep; jobs: { done: number; total: number }; waterMl: number; waterGoalMl: number }): boolean {
  return day.step === 'count' && day.jobs.done >= day.jobs.total && day.waterGoalMl > 0 && day.waterMl >= day.waterGoalMl;
}

/**
 * The dates among `dates` that show a gold star: perfect days (`perfectOn`) from the day the user started (`since`) on. Before it
 * nothing is shown, not the week strip's dot nor a star, so a day from before the app was in use never shines. Read once for the
 * whole month, so the calendar looks each day up in a set instead of judging it again at every render.
 */
export function perfectDates(dates: readonly ISODate[], since: ISODate, perfectOn: (date: ISODate) => boolean): Set<ISODate> {
  return new Set(dates.filter((d) => d >= since && perfectOn(d)));
}

/** Days a job must be due in a week for that week to count as a perfect one: a job due once or twice a week is done or not, never a week's effort. */
export const PERFECT_WEEK_MIN_DAYS = 3;

export type PerfectWeek = { itemId: string; monday: ISODate };

/** Records of each date, so a look over many weeks reads each date's at once. */
function onDates<T extends { date: ISODate }>(list: T[]): Map<ISODate, T[]> {
  const out = new Map<ISODate, T[]>();
  for (const r of list) out.set(r.date, [...(out.get(r.date) ?? []), r]);
  return out;
}

/**
 * Whether a job stayed on the list to the end of the week that ends on `sunday`: one removed (archived) on that Sunday or any day
 * before it did not, and a removal whose date cannot be read counts as before. Deleting a job is never a way to a medal.
 */
function stayedThrough(item: AbhyasItem, sunday: ISODate): boolean {
  if (!item.archivedAt) return true;
  const gone = localDate(item.archivedAt);
  return isIsoDate(gone) && gone > sunday;
}

// Finished sessions only: a perfect week is earned when the timer stops, not while it runs.
const NO_TIMER = new Date(0);

/**
 * The Monday to Sunday weeks in which a routine job was done on every day it
 * was due, from the week of the first item to this one, oldest first and in
 * the user's order within a week: due on `PERFECT_WEEK_MIN_DAYS` days or more
 * that week, each of them today or before. A job added in the middle of a
 * week is due on the days it was on the list (`itemsOn`); one removed before
 * the week ends earns nothing for it, however well the days before went.
 */
export function perfectWeeks(data: Omit<AbhyasData, 'running'>, today: ISODate): PerfectWeek[] {
  const first = firstDate(data.items);
  if (!first) return [];
  const ticks = onDates<AbhyasTick>(data.ticks);
  const sessions = onDates<AbhyasSession>(data.sessions);
  const byOrder = [...data.items].sort((a, b) => a.order - b.order);
  const out: PerfectWeek[] = [];
  for (let monday = mondayOf(first); monday <= today; monday = addDays(monday, 7)) {
    const due = new Map<string, ISODate[]>();
    for (const date of weekDates(monday)) for (const item of itemsOn(data.items, date)) due.set(item.id, [...(due.get(item.id) ?? []), date]);
    const sunday = addDays(monday, 6);
    for (const item of byOrder) {
      const days = due.get(item.id) ?? [];
      if (days.length < PERFECT_WEEK_MIN_DAYS || days[days.length - 1] > today || !stayedThrough(item, sunday)) continue;
      const allDone = days.every((d) => isDone(item, d, ticks.get(d) ?? [], minutesOn(sessions.get(d) ?? [], null, item.id, d, NO_TIMER)));
      if (allDone) out.push({ itemId: item.id, monday });
    }
  }
  return out;
}
