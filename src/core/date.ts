import { fill, latinDigits } from '../i18n';
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

/** Whole days from `from` to `to`, negative when `to` comes first. Counted noon to noon, so a clock change never shortens a day. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
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

/**
 * A length of time in hours and minutes, in the person's language: "7h 30m",
 * "7 ता 30 मि", "7 घं 30 मि". The words for hour and minute are the tiles'
 * units (`tile_unit_h`, `tile_unit_m`); `dur_hm` only places them.
 */
export function formatMinutes(mins: number, t: (key: string) => string): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return fill(t('dur_hm'), { h, m: String(m).padStart(2, '0'), uh: t('tile_unit_h'), um: t('tile_unit_m') });
}

/** A length of time to the nearest half hour, in hours with the tiles' unit word and no space, for a narrow column: "7.5h", "7.5ता", "7.5घं". */
export function formatHalfHours(mins: number, t: (key: string) => string): string {
  return `${Math.round(mins / 30) / 2}${t('tile_unit_h')}`;
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

// Marathi dates are asked for in Latin digits, as every number in the app is written, and any Devanagari digit an engine
// still writes is turned into one (latinDigits), so a date never sits in other digits beside the numbers next to it.
const LOCALE: Record<Lang, string> = { en: 'en-IN', mr: 'mr-IN-u-nu-latn', hi: 'hi-IN-u-nu-latn' };

/** A date in the chosen language's words and Latin digits, or `fallback` when Intl is missing or cannot read it: every date label goes through here. */
function formatDate(date: ISODate, lang: Lang, options: Intl.DateTimeFormatOptions, fallback: string): string {
  try {
    const s = new Date(date + 'T12:00:00').toLocaleDateString(LOCALE[lang] ?? 'en-IN', options);
    return s && s !== 'Invalid Date' ? latinDigits(s) : fallback;
  } catch {
    return fallback;
  }
}

/** "Sat 26 Sep" in the chosen language. Falls back to the ISO date if Intl is missing. */
export function formatDayLabel(date: ISODate, lang: Lang): string {
  return formatDate(date, lang, { weekday: 'short', day: 'numeric', month: 'short' }, date);
}

/** "26 Oct" in the chosen language. Falls back to the ISO date if Intl is missing. */
export function formatDayMonth(date: ISODate, lang: Lang): string {
  return formatDate(date, lang, { day: 'numeric', month: 'short' }, date);
}

/** "14 Mar 2027" in the chosen language: a date far enough off to need its year. */
export function formatDayMonthYear(date: ISODate, lang: Lang): string {
  return formatDate(date, lang, { day: 'numeric', month: 'short', year: 'numeric' }, date);
}

/** "October 2026" in the chosen language, for any date in the month. */
export function formatMonthYear(date: ISODate, lang: Lang): string {
  return formatDate(date, lang, { month: 'long', year: 'numeric' }, date.slice(0, 7));
}

/** "28 Oct, 14:05": a moment (an ISO timestamp) in the device's own zone, in the chosen language and Latin digits, on the 24-hour clock the app writes times in. The timestamp itself when it cannot be read. */
export function formatMoment(iso: string, lang: Lang): string {
  try {
    const s = new Date(iso).toLocaleString(LOCALE[lang] ?? 'en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return s && s !== 'Invalid Date' ? latinDigits(s) : iso;
  } catch {
    return iso;
  }
}
