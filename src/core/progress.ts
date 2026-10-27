import { addDays, lastNDates } from './date';
import type { DayRecord } from './record';
import { weekdayOf } from './routine';
import type { ISODate, Meal } from './types';
import { markOf, type StripMark } from './weekStrip';

/**
 * Progress, worked out: the record calendar (a month as weeks of seven days,
 * Monday first, blank before the first day and after the last, each day
 * marked as on the week strip, and how far it steps), this week's full days
 * and of how many, the last seven days' average, when a weigh-in is too old to speak for now,
 * and where the old links to Progress's sections go. Months are 'YYYY-MM'.
 * Pure.
 */
export type MonthCell = ISODate | null;

export function monthCells(month: string): MonthCell[][] {
  const first = `${month}-01`;
  const lead = (weekdayOf(first) + 6) % 7;
  const cells: MonthCell[] = Array.from({ length: lead }, (): MonthCell => null);
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

export type CalendarDay = { date: ISODate; mark: StripMark; light: boolean };

/** The month's days, each with the mark the week strip gives it (`markOf`): nothing before the person started, lighter while a meal the app filled in is not confirmed. */
export function monthMarks(month: string, recordOn: (date: ISODate) => DayRecord, today: ISODate, since: ISODate): (CalendarDay | null)[][] {
  return monthCells(month).map((week) => week.map((date) => (date ? { date, ...markOf(recordOn(date), date, today, since) } : null)));
}

/** Whether the calendar steps back a month (not before the month the person started) and forward one (not past this one). */
export function monthSteps(month: string, today: ISODate, since: ISODate): { prev: boolean; next: boolean } {
  return { prev: month > since.slice(0, 7), next: month < today.slice(0, 7) };
}

/**
 * Of these dates, the ones the strip marks full (`n`: every planned meal
 * logged or skipped and something eaten), and of how many (`of`): the dates
 * that can be full, free days and days before the start left out.
 */
export function fullDays(dates: ISODate[], recordOn: (date: ISODate) => DayRecord, today: ISODate, since: ISODate): { n: number; of: number } {
  const marks = dates.map((d) => markOf(recordOn(d), d, today, since).mark);
  return { n: marks.filter((m) => m === 'full').length, of: marks.filter((m) => m !== 'off' && m !== 'none').length };
}

/**
 * What was eaten a day on average over the last seven days, today included
 * once it is complete: the calories of the meals logged (the food
 * database's), counted on every complete day, every planned meal logged or
 * skipped. A day of meals all skipped counts (with what little was eaten),
 * so skipping shows in the average; a day with meals still missing never
 * pulls it down, and free days and days before the start are left out. Null
 * without a complete day.
 */
export function recentIntake(input: { today: ISODate; since: ISODate; meals: Pick<Meal, 'date' | 'kcal'>[]; recordOn: (date: ISODate) => DayRecord }): { avg: number; days: number } | null {
  return completeIntake({ ...input, dates: lastNDates(7, input.today) });
}

/** The same average over any dates, as the weekly report takes it for a week: only the complete days of them count. */
export function completeIntake(input: { dates: ISODate[]; today: ISODate; since: ISODate; meals: Pick<Meal, 'date' | 'kcal'>[]; recordOn: (date: ISODate) => DayRecord }): { avg: number; days: number } | null {
  const days = input.dates.filter((d) => {
    const mark = markOf(input.recordOn(d), d, input.today, input.since).mark;
    return mark === 'full' || mark === 'skipped';
  });
  if (days.length === 0) return null;
  const kcal = input.meals.reduce((a, m) => (days.includes(m.date) ? a + m.kcal : a), 0);
  return { avg: Math.round(kcal / days.length), days: days.length };
}

/** A latest weigh-in more than this many days old no longer speaks for now: Progress says when it was instead of a change. */
export const STALE_WEIGHT_DAYS = 30;

/** The latest weigh-in is more than `STALE_WEIGHT_DAYS` before today. */
export function weightIsStale(asOf: ISODate, today: ISODate): boolean {
  return asOf < addDays(today, -STALE_WEIGHT_DAYS);
}

/** Progress's old sections are pages of their own now: an old ?s= link to the coach or the charts goes there; anything else stays on Progress. */
export function oldProgressLink(s: unknown): '/coach' | '/growth' | null {
  if (s === 'coach') return '/coach';
  if (s === 'charts') return '/growth';
  return null;
}
