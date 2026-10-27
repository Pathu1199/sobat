import type { ISODate, Lang } from './types';

export function toISODate(d: Date = new Date()): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** A date written YYYY-MM-DD, the way Today's ?date= and the add page's carry one, and a day the calendar has (not 2026-02-30). */
export function isIsoDate(v: unknown): v is ISODate {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v;
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/**
 * When something added from a tile for `date` is logged: now for today, the
 * date's noon for an earlier day. Null for a date after today: nothing is
 * drunk or walked in the future.
 */
export function loggedAt(date: ISODate, now: Date): Date | null {
  const today = toISODate(now);
  if (date > today) return null;
  return date === today ? now : new Date(`${date}T12:00:00`);
}

/** The Monday of the week a date is in. Weeks run Monday to Sunday, the way the plan screen shows them. */
export function mondayOf(date: ISODate): ISODate {
  return addDays(date, -((new Date(date + 'T12:00:00').getDay() + 6) % 7));
}

/** The seven dates of the week starting on `monday`. */
export function weekDates(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function lastNDates(n: number, end: ISODate = toISODate()): ISODate[] {
  const out: ISODate[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/** Minutes between two HH:MM clock times, handling overnight wrap. */
export function minutesBetween(from: string, to: string): number {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  let mins = th * 60 + tm - (fh * 60 + fm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

/**
 * Milliseconds from `now` to the next whole minute in local time. Always
 * between 1 and 60000, so a timer built on it can never spin, and always
 * re-measured rather than accumulated, so it cannot drift.
 */
export function msToNextMinute(now: Date = new Date()): number {
  return 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

export function hhmm(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Clock time of an ISO timestamp in the device's own zone. Never slice the string. */
export function localHHMM(iso: string): string {
  return hhmm(new Date(iso));
}

export function localHour(iso: string): number {
  return new Date(iso).getHours();
}

/** Calendar date of an ISO timestamp in the device's own zone. */
export function localDate(iso: string): ISODate {
  return toISODate(new Date(iso));
}

const LOCALE: Record<Lang, string> = { en: 'en-IN', mr: 'mr-IN', hi: 'hi-IN' };

/** "Sat 26 Sep" in the chosen language. Falls back to the ISO date if Intl is missing. */
export function formatDayLabel(date: ISODate, lang: Lang): string {
  try {
    const d = new Date(date + 'T12:00:00');
    const s = d.toLocaleDateString(LOCALE[lang] ?? 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return s && s !== 'Invalid Date' ? s : date;
  } catch {
    return date;
  }
}

/** "26 Oct" in the chosen language. Falls back to the ISO date if Intl is missing. */
export function formatDayMonth(date: ISODate, lang: Lang): string {
  try {
    const s = new Date(date + 'T12:00:00').toLocaleDateString(LOCALE[lang] ?? 'en-IN', { day: 'numeric', month: 'short' });
    return s && s !== 'Invalid Date' ? s : date;
  } catch {
    return date;
  }
}
