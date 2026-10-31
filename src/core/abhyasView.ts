import { ABHYAS_ICONS, draftProblem, isDone, itemsOn, MAX_TARGET_MIN, minutesOn, type AbhyasData, type AbhyasDraft } from './abhyas';
import { localDate } from './date';
import type { AbhyasItem, ISODate } from './types';

/**
 * What the Abhyas list shows on a date and what each row lets the user do,
 * for the card on Today and the Abhyas tab. Today every row ticks and a
 * timed item's timer starts and stops; a day before ticks too, but no timer
 * starts on a day that is over; a day still to come shows what is planned,
 * with nothing to tick yet. Words are the component's. Pure.
 */

/** One row: the item, whether it is done, the tick box, "12 of 30 min" for a timed item, and the timer button at the right. */
export type AbhyasRow = {
  item: AbhyasItem;
  done: boolean;
  /**
   * The tick box, filled while the item is done. `off` says why it cannot be
   * pressed: the day is still to come, or the timer reached the target (no
   * untick undoes counted minutes).
   */
  tick: { checked: boolean; off: 'future' | 'timer' | null };
  /** Minutes counted against the target, the running timer's included; null for an item with no target. */
  minutes: { n: number; of: number } | null;
  /** The one timer runs for this item: the row shows a small moving dot. */
  running: boolean;
  /** The button at the right: Start, Stop, or none. */
  timer: 'start' | 'stop' | null;
  /** Why a timed item has no Start: its day is over, or still to come. */
  timerOff: 'past' | 'future' | null;
};

/** The card's rows for a date, in the user's order, and "2 of 4 done". `now` is `useNow()`, so a running timer's minutes move. */
export function abhyasCard(data: AbhyasData, date: ISODate, today: ISODate, now: Date): { rows: AbhyasRow[]; done: number; total: number } {
  const rows = itemsOn(data.items, date).map((item): AbhyasRow => {
    const minutes = minutesOn(data.sessions, data.running, item.id, date, now);
    const timed = typeof item.targetMin === 'number' && item.targetMin > 0;
    const done = isDone(item, date, data.ticks, minutes);
    const byTimer = timed && minutes >= (item.targetMin ?? 0);
    // Its own day's timer, or one from an earlier day not yet closed (closeStale runs within the minute): Stop stays in reach today.
    const running = data.running?.itemId === item.id && (localDate(data.running.startedAt) === date || date === today);
    const later = date > today;
    return {
      item,
      done,
      tick: { checked: done, off: later ? 'future' : byTimer ? 'timer' : null },
      minutes: timed ? { n: minutes, of: item.targetMin ?? 0 } : null,
      running,
      timer: running ? 'stop' : timed && date === today ? 'start' : null,
      timerOff: running || !timed || date === today ? null : later ? 'future' : 'past',
    };
  });
  return { rows, done: rows.filter((r) => r.done).length, total: rows.length };
}

/** The weekday chips' order, Monday to Sunday (0 is Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
/** The minutes target's chips; any other value goes in the box beside them. */
export const TARGET_CHOICES = [15, 30, 45, 60] as const;

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** What the sheet edits: an item's fields with a date always, so "Repeats" and "One day" can be switched without losing either. */
export type SheetDraft = AbhyasDraft & { date: ISODate };

/** A new item: a one-off on `date` (the card's + adds one for the day it shows) or a repeating one; every weekday on, the first icon. */
export function newDraft(kind: AbhyasItem['kind'], date: ISODate): SheetDraft {
  return { name: '', icon: ABHYAS_ICONS[0], kind, days: [...EVERY_DAY], date, times: [] };
}

/** An item as the sheet edits it: a repeating one keeps its days and takes `date` in case it becomes a one-off; a one-off has every weekday on in case it starts to repeat. */
export function draftOf(item: AbhyasItem, date: ISODate): SheetDraft {
  return {
    name: item.name,
    icon: item.icon,
    kind: item.kind,
    days: item.kind === 'repeat' ? [...item.days] : [...EVERY_DAY],
    date: item.date ?? date,
    ...(item.targetMin !== undefined ? { targetMin: item.targetMin } : {}),
    times: [...item.times],
  };
}

/** A clock time as people type one ("7:30", "0730", "19.05", "7") as "HH:MM" on the 24-hour clock; null when it is not one. */
export function parseTime(text: string): string | null {
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** The minutes box as typed: digits only, at most the largest target (`MAX_TARGET_MIN`); empty is no target. */
export function targetText(text: string): { text: string; value: number | undefined } {
  const digits = text.replace(/\D/g, '');
  if (!digits) return { text: '', value: undefined };
  const value = Math.min(Number(digits), MAX_TARGET_MIN);
  return { text: String(value), value };
}

/** The sheet's fields as they stand: the target as a number (none for Off) and the reminder times as typed. */
export type SheetForm = Omit<SheetDraft, 'targetMin' | 'times'> & { target: number | undefined; times: string[] };

/**
 * What Save saves, and why it cannot: the draft's own problem first
 * (`draftProblem`), then a reminder time that is not a clock time. A time box
 * left empty is no time.
 */
export function formDraft(form: SheetForm): { draft: SheetDraft; problem: ReturnType<typeof draftProblem> | 'time' | null } {
  const typed = form.times.map((t) => t.trim()).filter((t) => t !== '');
  const times = typed.map(parseTime).filter((t): t is string => t !== null);
  const { target, ...rest } = form;
  const draft: SheetDraft = { ...rest, ...(target !== undefined ? { targetMin: target } : {}), times };
  return { draft, problem: draftProblem(draft) ?? (times.length < typed.length ? 'time' : null) };
}
