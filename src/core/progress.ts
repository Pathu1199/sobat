import { addDays } from './date';
import { weekdayOf } from './routine';
import type { ISODate } from './types';

/**
 * The record calendar on Progress: a month as weeks of seven days, Monday
 * first, blank before the first day and after the last, and the step from
 * one month to the next. Months are 'YYYY-MM'. Pure.
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
