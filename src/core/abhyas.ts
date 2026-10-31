import { addDays, isIsoDate, localDate, toISODate } from './date';
import { weekdayOf } from './routine';
import type { AbhyasItem, AbhyasRunning, AbhyasSession, AbhyasTick, AppState, ISODate } from './types';

/**
 * Abhyas: the user's own list for the day, any job at all, from yoga and
 * study to "fix the bike". An item repeats on chosen weekdays from the day it
 * was added, or belongs to one date; an item removed (archived) leaves the
 * days from its removal on and stays on the days before, so history reads as
 * it was (a removal with no readable date, from a damaged file, leaves every
 * day, as every other rule here already reads it as removed). An item is done on a date when it was ticked, or when it has a
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

/**
 * Whether an item belongs to a date: a one-off on its own date, a repeating one on its weekdays from the day it was added;
 * neither from the day it was removed, nor on any day when the removal's date cannot be read.
 */
function isOn(item: AbhyasItem, date: ISODate): boolean {
  if (item.archivedAt) {
    const gone = localDate(item.archivedAt);
    if (!isIsoDate(gone) || gone <= date) return false;
  }
  if (item.kind === 'once') return item.date === date;
  // A repeating item added today does not go back and leave the days before it undone.
  const added = localDate(item.createdAt);
  if (isIsoDate(added) && added > date) return false;
  return item.days.includes(weekdayOf(date));
}

/** The items that belong to a date, in the user's order. */
export function itemsOn(items: AbhyasItem[], date: ISODate): AbhyasItem[] {
  return items.filter((i) => isOn(i, date)).sort((a, b) => a.order - b.order);
}

/** When a running timer stops by itself: three hours after it started, or at midnight after its own day, whichever comes first. NaN for a start that is not a time. */
function limitOf(running: Pick<AbhyasRunning, 'startedAt'>): number {
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

/** `dayStatus` from the items and the timer, on the ticks and sessions of that date alone, already picked out. */
function statusIn({ items, running }: Pick<AbhyasData, 'items' | 'running'>, date: ISODate, ticks: AbhyasTick[], sessions: AbhyasSession[], now: Date): DayStatus {
  const on = itemsOn(items, date);
  let done = 0;
  for (const item of on) if (isDone(item, date, ticks, minutesOn(sessions, running, item.id, date, now))) done++;
  const finished = sessions.reduce((a, s) => a + s.minutes, 0);
  const live = running && localDate(running.startedAt) === date ? runningMinutes(running, now) : 0;
  return { total: on.length, done, minutes: finished + live };
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

/** A session's id: its timer's item and start (`stop`), so the same timer stopped on two devices is one session. */
export function sessionId(running: Pick<AbhyasRunning, 'itemId' | 'startedAt'>): string {
  return `${running.itemId}@${running.startedAt}`;
}

/** A session as the app reads it, from a file or another device: every field there, its minutes a number. Anything else is left out. */
export function isAbhyasSession(v: unknown): v is AbhyasSession {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.id === 'string' && typeof s.itemId === 'string' && typeof s.date === 'string' && typeof s.startedAt === 'string' && typeof s.endedAt === 'string' && typeof s.minutes === 'number' && Number.isFinite(s.minutes);
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
    id: sessionId(running),
    itemId: running.itemId,
    date: localDate(running.startedAt),
    startedAt: running.startedAt,
    endedAt: new Date(end).toISOString(),
    minutes,
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

/** A session that ran until its timer stopped by itself, at three hours or at midnight: nobody pressed Stop where it ends. */
export function ranOut(session: Pick<AbhyasSession, 'startedAt' | 'endedAt'>): boolean {
  return Date.parse(session.endedAt) >= limitOf(session);
}

/**
 * The sessions with one more. The same timer stopped on two devices is one
 * session (its id is the item's and the start's): the stop that came first
 * stays, since a later one only stopped a copy still running elsewhere. The
 * same list when the session there already ends first.
 */
export function withSession(sessions: AbhyasSession[], session: AbhyasSession): AbhyasSession[] {
  const i = sessions.findIndex((s) => s.id === session.id);
  if (i < 0) return [...sessions, session];
  if (sessions[i].endedAt <= session.endedAt) return sessions;
  return sessions.map((s, n) => (n === i ? session : s));
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
export function firstDate(items: AbhyasItem[]): ISODate | null {
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
  let n = 0;
  for (const date of new Set([...ticks.keys(), ...sessions.keys()])) {
    // No timer, so the moment read at does not count.
    if (date <= today) n += statusIn({ items: data.items, running: null }, date, ticks.get(date) ?? [], sessions.get(date) ?? [], new Date(0)).done;
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

/** A draft as an item's own fields: the name trimmed, the weekdays and times cleaned, a date kept only for a one-off, and an icon not in the picker's list the default. */
function fieldsOf(draft: AbhyasDraft): AbhyasDraft {
  return {
    name: draft.name.trim(),
    icon: (ABHYAS_ICONS as readonly string[]).includes(draft.icon) ? draft.icon : ABHYAS_ICONS[0],
    kind: draft.kind,
    days: draft.kind === 'repeat' ? cleanDays(draft.days) : [],
    ...(draft.kind === 'once' ? { date: draft.date } : {}),
    ...(draft.targetMin !== undefined ? { targetMin: draft.targetMin } : {}),
    times: cleanTimes(draft.times),
  };
}

/**
 * The list with a new item at its end, its id from the caller (`newId()`),
 * its fields cleaned (`fieldsOf`). The same list when the draft cannot be
 * saved (`draftProblem`).
 */
export function addItem(items: AbhyasItem[], draft: AbhyasDraft, id: string, now: Date): AbhyasItem[] {
  if (draftProblem(draft)) return items;
  const order = items.reduce((top, i) => Math.max(top, i.order + 1), 0);
  return [...items, { id, ...fieldsOf(draft), order, createdAt: now.toISOString() }];
}

/**
 * An item edited: the draft's fields, cleaned as `addItem` cleans them, with
 * its id, place, start and removal kept. The same list when the draft cannot
 * be saved or there is no such item.
 */
export function updateItem(items: AbhyasItem[], id: string, draft: AbhyasDraft): AbhyasItem[] {
  if (draftProblem(draft) || !items.some((i) => i.id === id)) return items;
  return items.map((i) => (i.id === id ? { id, ...fieldsOf(draft), order: i.order, createdAt: i.createdAt, ...(i.archivedAt ? { archivedAt: i.archivedAt } : {}) } : i));
}

/** An item removed now: it leaves today and the days after, and stays on the days before. The same list when there is no such item on it. */
export function archive(items: AbhyasItem[], id: string, now: Date): AbhyasItem[] {
  if (!items.some((i) => i.id === id && !i.archivedAt)) return items;
  return items.map((i) => (i.id === id ? { ...i, archivedAt: now.toISOString() } : i));
}

/** A removed item put back (Undo after a removal): the same item without its removal, so it is on today and on again. The same list when there is no such removed item. */
export function unarchive(items: AbhyasItem[], id: string): AbhyasItem[] {
  if (!items.some((i) => i.id === id && i.archivedAt)) return items;
  return items.map((i) => {
    if (i.id !== id) return i;
    const { archivedAt: _, ...kept } = i;
    return kept;
  });
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

/** The part of the store Abhyas keeps; the store's actions below change only it, and give back the same state when nothing changes. */
export type AbhyasState = Pick<AppState, 'abhyasItems' | 'abhyasSessions' | 'abhyasTicks' | 'abhyasRunning'>;

/** A tick's id: its item's and its date's, so the same tick made on two devices is one tick. */
export function tickId(itemId: string, date: ISODate): string {
  return `${itemId}@${date}`;
}

/** An item ticked done on a date, by hand: once, for an item on the list, on today or a day before, never a day still to come. */
export function withTick<S extends AbhyasState>(s: S, itemId: string, date: ISODate, now: Date): S {
  if (!isIsoDate(date) || date > toISODate(now) || !s.abhyasItems.some((i) => i.id === itemId)) return s;
  if (s.abhyasTicks.some((t) => t.itemId === itemId && t.date === date)) return s;
  return { ...s, abhyasTicks: [...s.abhyasTicks, { id: tickId(itemId, date), itemId, date, at: now.toISOString() }] };
}

/** An item's tick on a date taken away. */
export function withoutTick<S extends AbhyasState>(s: S, itemId: string, date: ISODate): S {
  const abhyasTicks = s.abhyasTicks.filter((t) => !(t.itemId === itemId && t.date === date));
  return abhyasTicks.length === s.abhyasTicks.length ? s : { ...s, abhyasTicks };
}

/** The state with a timer's session kept, when it counted a whole minute. */
function withSessionOf<S extends AbhyasState>(s: S, running: AbhyasRunning | null, session: AbhyasSession | null): S {
  return { ...s, abhyasRunning: running, abhyasSessions: session ? withSession(s.abhyasSessions, session) : s.abhyasSessions };
}

/** The timer stopped now, its minutes kept on the day it started (`stop`). */
export function withStopped<S extends AbhyasState>(s: S, now: Date): S {
  return s.abhyasRunning ? withSessionOf(s, null, stop(s.abhyasRunning, now)) : s;
}

/**
 * A timer started now for an item on the list. One timer runs at a time:
 * one running for another item stops first and keeps its minutes. Start on
 * the item already running changes nothing, and a removed item gets none.
 */
export function withStarted<S extends AbhyasState>(s: S, itemId: string, now: Date): S {
  if (s.abhyasRunning?.itemId === itemId || !s.abhyasItems.some((i) => i.id === itemId && !i.archivedAt)) return s;
  return { ...withStopped(s, now), abhyasRunning: start(itemId, now) };
}

/** On open and each minute: a timer at three hours, or from before today, stopped where it stops by itself (`closeStale`). */
export function withStaleClosed<S extends AbhyasState>(s: S, now: Date): S {
  const closed = closeStale(s.abhyasRunning, now);
  return closed.running === s.abhyasRunning ? s : withSessionOf(s, closed.running, closed.session);
}

/** An item removed now (`archive`); its timer, if it runs, stops and keeps its minutes. */
export function withArchived<S extends AbhyasState>(s: S, id: string, now: Date): S {
  const abhyasItems = archive(s.abhyasItems, id, now);
  if (abhyasItems === s.abhyasItems) return s;
  return { ...(s.abhyasRunning?.itemId === id ? withStopped(s, now) : s), abhyasItems };
}

/** A removed item put back (`unarchive`), its minutes as they were kept; a timer the removal stopped stays stopped. */
export function withRestored<S extends AbhyasState>(s: S, id: string): S {
  const abhyasItems = unarchive(s.abhyasItems, id);
  return abhyasItems === s.abhyasItems ? s : { ...s, abhyasItems };
}
