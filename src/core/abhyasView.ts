import { ABHYAS_ICONS, dayStatus, draftProblem, firstDate, isDone, itemsOn, MAX_TARGET_MIN, minutesOn, streak, type AbhyasData, type AbhyasDraft, type DayStatus } from './abhyas';
import { addDays, localDate, mondayOf } from './date';
import type { AbhyasItem, ISODate } from './types';

/**
 * What the Abhyas list shows on a date and what each row lets the user do,
 * for the card on Today and the Abhyas tab. Today every row ticks and a
 * timed item's timer starts and stops; a day before ticks too, but no timer
 * starts on a day that is over; a day still to come shows what is planned,
 * with nothing to tick yet. The tab's other sections and Progress's row are
 * at the end. Words are the component's. Pure.
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

/** The Abhyas tab's Repeating section: the repeating items still on the list, in the user's order, the order its up and down buttons move (`reorder`). */
export function repeating(items: AbhyasItem[]): AbhyasItem[] {
  return items.filter((i) => i.kind === 'repeat' && !i.archivedAt).sort((a, b) => a.order - b.order);
}

/** The tab's Coming up: one-offs still on the list for a day after today, soonest first, in the user's order within a day. */
export function comingUp(items: AbhyasItem[], today: ISODate): AbhyasItem[] {
  return items
    .filter((i): i is AbhyasItem & { date: ISODate } => i.kind === 'once' && !i.archivedAt && typeof i.date === 'string' && i.date > today)
    .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
}

/**
 * An item's weekdays as the tab writes them, Monday to Sunday: 'every' for
 * all seven, a run of three days or more as one range ([1, 5] is Mon–Fri),
 * and any other day on its own ([3, 3]).
 */
export function weekdayRuns(days: number[]): 'every' | [number, number][] {
  const on = WEEK_ORDER.filter((d) => days.includes(d));
  if (on.length === WEEK_ORDER.length) return 'every';
  const out: [number, number][] = [];
  let run: number[] = [];
  const close = () => {
    if (run.length >= 3) out.push([run[0], run[run.length - 1]]);
    else for (const d of run) out.push([d, d]);
    run = [];
  };
  for (const d of WEEK_ORDER) {
    if (on.includes(d)) run.push(d);
    else close();
  }
  close();
  return out;
}

/**
 * The tab's Last 14 days: one entry per day before today, newest first, with
 * its items done of items on it and its minutes ("3 of 4 · 85 min"). Never
 * before the first item, so a list started this week shows this week only; a
 * day in between with nothing on it stays, as nothing planned.
 */
export function recentDays(data: AbhyasData, today: ISODate, now: Date, n = 14): (DayStatus & { date: ISODate })[] {
  const first = firstDate(data.items);
  const out: (DayStatus & { date: ISODate })[] = [];
  if (!first) return out;
  for (let date = addDays(today, -1); date >= first && out.length < n; date = addDays(date, -1)) out.push({ date, ...dayStatus(data, date, now) });
  return out;
}

/**
 * Progress's Abhyas row: this week so far, Monday to today, as items done of
 * items on those days ("18 of 21 this week"), and the streak. A day still to
 * come this week counts nothing yet. Null while nothing is on the list.
 */
export function abhyasProgress(data: AbhyasData, today: ISODate, now: Date): { done: number; total: number; streak: number } | null {
  if (!data.items.some((i) => !i.archivedAt)) return null;
  let done = 0;
  let total = 0;
  for (let date = mondayOf(today); date <= today; date = addDays(date, 1)) {
    const s = dayStatus(data, date, now);
    done += s.done;
    total += s.total;
  }
  return { done, total, streak: streak(data, today, now) };
}

/**
 * After a repeating item moved (the list as it is now): its place among the
 * repeating items ("place 2 of 3"), and which of its buttons keeps the focus,
 * the one pressed or the other one once the item reached the end where the
 * pressed one no longer works. Null for an item that is not one of them.
 */
export function movedPlace(items: AbhyasItem[], id: string, by: -1 | 1): { n: number; m: number; focus: 'up' | 'down' } | null {
  const list = repeating(items);
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const last = list.length - 1;
  return { n: i + 1, m: list.length, focus: by < 0 ? (i > 0 ? 'up' : 'down') : i < last ? 'down' : 'up' };
}
