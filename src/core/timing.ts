import type { ISODate, Meal } from './types';

/**
 * When the day's eating happened: the first and last meal, the window
 * between them, the longest gap, and whether dinner ran late. A window of
 * about 12 hours or less and a last meal by 21:00 is the simple, well
 * supported advice; the verdicts say which of those held.
 */
export type Timing = {
  meals: number;
  first: string | null;
  last: string | null;
  /** Minutes from first to last meal. */
  windowMinutes: number;
  /** Longest minutes between two meals. */
  longestGapMinutes: number;
  lateDinner: boolean;
  /** 'none' | 'good' | 'long' (window over 12 h) | 'late' (last meal after 21:00) | 'both' */
  verdict: 'none' | 'good' | 'long' | 'late' | 'both';
};

export const WINDOW_LIMIT_MIN = 12 * 60;
export const LATE_HOUR = 21;

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function minutesOf(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function dayTiming(meals: Meal[], date: ISODate): Timing {
  const day = meals.filter((m) => m.date === date).map((m) => m.at).sort();
  if (day.length === 0) return { meals: 0, first: null, last: null, windowMinutes: 0, longestGapMinutes: 0, lateDinner: false, verdict: 'none' };
  const mins = day.map(minutesOf);
  const first = mins[0];
  const last = mins[mins.length - 1];
  let gap = 0;
  for (let i = 1; i < mins.length; i++) gap = Math.max(gap, mins[i] - mins[i - 1]);
  const windowMinutes = last - first;
  const lateDinner = last >= LATE_HOUR * 60;
  const long = windowMinutes > WINDOW_LIMIT_MIN;
  return {
    meals: day.length,
    first: hhmm(day[0]),
    last: hhmm(day[day.length - 1]),
    windowMinutes,
    longestGapMinutes: gap,
    lateDinner,
    verdict: long && lateDinner ? 'both' : long ? 'long' : lateDinner ? 'late' : 'good',
  };
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m ? `${h} h ${m} m` : `${h} h`) : `${m} m`;
}
