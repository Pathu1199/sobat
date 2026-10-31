import { addDays, isIsoDate, localDate } from './date';
import type { AbhyasItem, AbhyasRunning, AbhyasSession, AbhyasTick, ISODate } from './types';

/**
 * Abhyas: the user's own list for the day, any job at all, from yoga and
 * study to "fix the bike". An item repeats on chosen weekdays from the day it
 * was added, or belongs to one date; an item removed (archived) leaves the
 * days from its removal on and stays on the days before, so history reads as
 * it was. An item is done on a date when it was ticked, or when it has a
 * minutes target and the timer counted that much. One timer runs at a time;
 * it remembers when it started, so closing the app loses nothing, and it
 * stops itself at three hours or at the end of its own day, so a forgotten
 * timer never writes a 12-hour study day. Every rule here is pure; the store
 * wraps them in thin actions.
 */

/** The longest one timer counts, in minutes. */
export const MAX_SESSION_MIN = 180;
/** Reminder times an item may have. */
export const MAX_TIMES = 3;
/** The largest minutes target: ten hours. */
export const MAX_TARGET_MIN = 600;
/** The icons an item can have, in the picker's order; the first is the default. */
export const ABHYAS_ICONS = ['book-outline', 'code-slash-outline', 'fitness-outline', 'language-outline', 'leaf-outline', 'briefcase-outline', 'musical-notes-outline', 'pencil-outline'] as const;

/** Everything Abhyas keeps, as one bundle for the rules that read all of it. */
export type AbhyasData = { items: AbhyasItem[]; ticks: AbhyasTick[]; sessions: AbhyasSession[]; running: AbhyasRunning | null };

/** What a date shows: items done of items on it, and the minutes counted on it. */
export type DayStatus = { total: number; done: number; minutes: number };

function weekday(date: ISODate): number {
  return new Date(`${date}T12:00:00`).getDay();
}

/** Whether an item belongs to a date: a one-off on its own date, a repeating one on its weekdays from the day it was added; neither from the day it was removed. */
function isOn(item: AbhyasItem, date: ISODate): boolean {
  if (item.archivedAt) {
    const gone = localDate(item.archivedAt);
    if (isIsoDate(gone) && gone <= date) return false;
  }
  if (item.kind === 'once') return item.date === date;
  // A repeating item added today does not go back and leave the days before it undone.
  const added = localDate(item.createdAt);
  if (isIsoDate(added) && added > date) return false;
  return item.days.includes(weekday(date));
}

/** The items that belong to a date, in the user's order. */
export function itemsOn(items: AbhyasItem[], date: ISODate): AbhyasItem[] {
  return items.filter((i) => isOn(i, date)).sort((a, b) => a.order - b.order);
}

/** When a running timer stops by itself: three hours after it started, or at midnight after its own day, whichever comes first. NaN for a start that is not a time. */
function limitOf(running: AbhyasRunning): number {
  const start = Date.parse(running.startedAt);
  const midnight = new Date(`${addDays(localDate(running.startedAt), 1)}T00:00:00`).getTime();
  return Math.min(start + MAX_SESSION_MIN * 60000, midnight);
}

/** Whole minutes a running timer has counted by now, never past where it stops by itself. */
function runningMinutes(running: AbhyasRunning, now: Date): number {
  const minutes = Math.floor((Math.min(now.getTime(), limitOf(running)) - Date.parse(running.startedAt)) / 60000);
  return minutes > 0 ? minutes : 0;
}

/** Minutes counted for an item on a date: its finished sessions there, and the running timer when it is this item's and started that day. */
export function minutesOn(sessions: AbhyasSession[], running: AbhyasRunning | null, itemId: string, date: ISODate, now: Date): number {
  const done = sessions.filter((s) => s.itemId === itemId && s.date === date).reduce((a, s) => a + s.minutes, 0);
  const live = running && running.itemId === itemId && localDate(running.startedAt) === date ? runningMinutes(running, now) : 0;
  return done + live;
}

/** Done on a date: ticked, or the timer counted the minutes target. */
export function isDone(item: AbhyasItem, date: ISODate, ticks: AbhyasTick[], minutes: number): boolean {
  if (ticks.some((t) => t.itemId === item.id && t.date === date)) return true;
  return typeof item.targetMin === 'number' && item.targetMin > 0 && minutes >= item.targetMin;
}

/** `dayStatus` on the ticks and sessions of that date alone, already picked out. */
function statusIn(data: AbhyasData, date: ISODate, ticks: AbhyasTick[], sessions: AbhyasSession[], now: Date): DayStatus {
  const items = itemsOn(data.items, date);
  let done = 0;
  for (const item of items) if (isDone(item, date, ticks, minutesOn(sessions, data.running, item.id, date, now))) done++;
  const finished = sessions.reduce((a, s) => a + s.minutes, 0);
  const live = data.running && localDate(data.running.startedAt) === date ? runningMinutes(data.running, now) : 0;
  return { total: items.length, done, minutes: finished + live };
}

/** A date's items done of the items on it, and every minute counted on it, the running timer's included. */
export function dayStatus(data: AbhyasData, date: ISODate, now: Date): DayStatus {
  return statusIn(
    data,
    date,
    data.ticks.filter((t) => t.date === date),
    data.sessions.filter((s) => s.date === date),
    now,
  );
}

/** A timer started now for an item. */
export function start(itemId: string, now: Date): AbhyasRunning {
  return { itemId, startedAt: now.toISOString() };
}

/**
 * The session a timer stopped now leaves: on the date it started, ended now
 * or where it stops by itself (three hours, or midnight after its day), with
 * the whole minutes counted. Null for less than a minute: a tap on Start and
 * Stop by mistake writes nothing. Its id is the item's and the start's, so
 * the same timer stopped on two devices is one session.
 */
export function stop(running: AbhyasRunning, now: Date): AbhyasSession | null {
  const end = Math.min(now.getTime(), limitOf(running));
  const minutes = Math.floor((end - Date.parse(running.startedAt)) / 60000);
  if (!(minutes >= 1)) return null;
  return {
    id: `${running.itemId}@${running.startedAt}`,
    itemId: running.itemId,
    date: localDate(running.startedAt),
    startedAt: running.startedAt,
    endedAt: new Date(end).toISOString(),
    minutes: Math.min(minutes, MAX_SESSION_MIN),
  };
}

/**
 * On open and each minute: a timer at three hours, or one that started
 * before today, is stopped where it stops by itself, and its session kept.
 * A timer whose start is not a time is dropped. Anything else runs on.
 */
export function closeStale(running: AbhyasRunning | null, now: Date): { running: AbhyasRunning | null; session: AbhyasSession | null } {
  if (!running) return { running: null, session: null };
  if (now.getTime() < limitOf(running)) return { running, session: null };
  return { running: null, session: stop(running, now) };
}

/** Records by their date, so a rule that reads many days finds each day's at once. */
function byDate<T extends { date: ISODate }>(list: T[]): Map<ISODate, T[]> {
  const out = new Map<ISODate, T[]>();
  for (const r of list) {
    const day = out.get(r.date);
    if (day) day.push(r);
    else out.set(r.date, [r]);
  }
  return out;
}

/** The first date any item can be on: the earliest one-off date or day an item was added. Null with no items. */
function firstDate(items: AbhyasItem[]): ISODate | null {
  let first: ISODate | null = null;
  for (const i of items) {
    const d = i.kind === 'once' ? i.date : localDate(i.createdAt);
    if (isIsoDate(d) && (first === null || d < first)) first = d;
  }
  return first;
}

/**
 * Days in a row, back from today, on which every item on the day was done.
 * Today counts once all its items are done, the running timer's minutes
 * included, and never breaks the run before then, so in the morning the
 * streak is yesterday's. A day with no items neither breaks it nor counts.
 * Looks back no further than the first item.
 */
export function streak(data: AbhyasData, today: ISODate, now: Date): number {
  const first = firstDate(data.items);
  if (!first) return 0;
  const ticks = byDate(data.ticks);
  const sessions = byDate(data.sessions);
  let n = 0;
  for (let date = today; date >= first; date = addDays(date, -1)) {
    const s = statusIn(data, date, ticks.get(date) ?? [], sessions.get(date) ?? [], now);
    if (s.total === 0) continue;
    if (s.done === s.total) n++;
    else if (date !== today) break;
  }
  return n;
}

/**
 * Items done over every day up to today, each item on each day once: the
 * climb's points count them. Finished sessions only, so the points move when
 * a timer stops, not every minute it runs.
 */
export function doneCount(data: Omit<AbhyasData, 'running'>, today: ISODate): number {
  const ticks = byDate(data.ticks);
  const sessions = byDate(data.sessions);
  const finished: AbhyasData = { ...data, running: null };
  let n = 0;
  for (const date of new Set([...ticks.keys(), ...sessions.keys()])) {
    if (date <= today) n += statusIn(finished, date, ticks.get(date) ?? [], sessions.get(date) ?? [], new Date(0)).done;
  }
  return n;
}

/** What the user fills in for an item: everything it is but its id, place and dates. */
export type AbhyasDraft = Pick<AbhyasItem, 'name' | 'icon' | 'kind' | 'days' | 'date' | 'targetMin' | 'times'>;

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Reminder times as kept: "HH:MM" clock times only, each once, in the day's order, at most three. Anything that is not a list has none. */
export function cleanTimes(times: unknown): string[] {
  if (!Array.isArray(times)) return [];
  const ok = times.filter((t): t is string => typeof t === 'string' && CLOCK.test(t));
  return [...new Set(ok)].sort().slice(0, MAX_TIMES);
}

/** Weekdays 0 to 6, each once, in order. */
function cleanDays(days: number[]): number[] {
  return [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
}

/** What keeps a draft from being an item: no name, a repeating item with no weekday, a one-off with no real date, or a target that is not 1 to 600 whole minutes. Null when it can be saved. */
export function draftProblem(d: AbhyasDraft): 'name' | 'days' | 'date' | 'target' | null {
  if (!d.name.trim()) return 'name';
  if (d.kind === 'repeat' && cleanDays(d.days).length === 0) return 'days';
  if (d.kind === 'once' && !isIsoDate(d.date)) return 'date';
  if (d.targetMin !== undefined && !(Number.isInteger(d.targetMin) && d.targetMin >= 1 && d.targetMin <= MAX_TARGET_MIN)) return 'target';
  return null;
}

/**
 * The list with a new item at its end, its id from the caller (`newId()`).
 * The name is trimmed, the weekdays and times cleaned, a date kept only for
 * a one-off, and an icon not in the picker's list becomes the default. The
 * same list when the draft cannot be saved (`draftProblem`).
 */
export function addItem(items: AbhyasItem[], draft: AbhyasDraft, id: string, now: Date): AbhyasItem[] {
  if (draftProblem(draft)) return items;
  const order = items.reduce((top, i) => Math.max(top, i.order + 1), 0);
  const item: AbhyasItem = {
    id,
    name: draft.name.trim(),
    icon: (ABHYAS_ICONS as readonly string[]).includes(draft.icon) ? draft.icon : ABHYAS_ICONS[0],
    kind: draft.kind,
    days: draft.kind === 'repeat' ? cleanDays(draft.days) : [],
    ...(draft.kind === 'once' ? { date: draft.date } : {}),
    ...(draft.targetMin !== undefined ? { targetMin: draft.targetMin } : {}),
    times: cleanTimes(draft.times),
    order,
    createdAt: now.toISOString(),
  };
  return [...items, item];
}

/** An item removed now: it leaves today and the days after, and stays on the days before. The same list when there is no such item on it. */
export function archive(items: AbhyasItem[], id: string, now: Date): AbhyasItem[] {
  if (!items.some((i) => i.id === id && !i.archivedAt)) return items;
  return items.map((i) => (i.id === id ? { ...i, archivedAt: now.toISOString() } : i));
}

/**
 * An item one place up (-1) or down (1) among the items of its kind still
 * on the list: it trades places with its neighbour there, and every item is
 * numbered again in the order shown, so two items that came from two devices
 * with the same number still move. At either end the same list.
 */
export function reorder(items: AbhyasItem[], id: string, by: -1 | 1): AbhyasItem[] {
  const me = items.find((i) => i.id === id && !i.archivedAt);
  if (!me) return items;
  const all = [...items].sort((a, b) => a.order - b.order);
  const row = all.filter((i) => i.kind === me.kind && !i.archivedAt);
  const other = row[row.indexOf(me) + by];
  if (!other) return items;
  const a = all.indexOf(me);
  const b = all.indexOf(other);
  [all[a], all[b]] = [all[b], all[a]];
  const place = new Map(all.map((i, n) => [i.id, n]));
  return items.map((i) => (i.order === place.get(i.id) ? i : { ...i, order: place.get(i.id) ?? i.order }));
}
