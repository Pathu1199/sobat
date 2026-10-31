/**
 * What is due, and when. Pure functions over the schedule the app uploads,
 * so they can be tested without a Worker. Times are the person's local
 * clock, read through their IANA time zone.
 */

export type PushSchedule = {
  /** 1 from an older app, which has none of the Abhyas and "Day so far" parts below; 2 has them all. */
  v: 1 | 2;
  tz: string;
  lang: string;
  days: number[];
  blocks: { kind: string; start: string; title: string; body: string }[];
  slots: { id: string; at: string; title: string; body: string }[];
  /** Free days, 0 = Sunday: no meal is asked about on one. Missing from an older app's schedule, which asks every day. */
  offDays?: number[];
  breaks: { everyMinutes: number; from: string; to: string; title: string; body: string } | null;
  water: { everyMinutes: number; from: string; to: string; title: string; body: string } | null;
  mantras: { date: string; title: string; text: string }[];
  quiet: { from: number; to: number };
  weigh?: { weekday: number; title: string; body: string } | null;
  /** Repeating Abhyas items: each at its times on its weekdays, off days too. `bodyToday` is the words on `doneDate`, when minutes were counted there. */
  abhyas?: { id: string; days: number[]; times: string[]; title: string; body: string; bodyToday?: string }[];
  /** One-off Abhyas items: one row per reminder time, on its date. */
  once?: { date: string; time: string; title: string; body: string }[];
  /** Repeating items already done on `doneDate`: skipped that day only. */
  doneToday?: string[];
  doneDate?: string;
  /** "Day so far" as `date` stood when the app uploaded it: at its times on that date only, never on a later day or a free day. */
  checklist?: { times: string[]; title: string; body: string; date: string } | null;
};

/**
 * What a version 2 schedule may hold in its Abhyas and "Day so far" parts, so
 * one phone's entry stays small and every reminder fits in a push. The app
 * keeps under these (src/core/pushSchedule.ts, `PUSH_LIMITS`).
 */
export const LIMITS = { rows: 30, id: 64, text: 80, checklist: 800, times: 3 } as const;

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const isDate = (v: unknown) => typeof v === 'string' && DATE.test(v);
const isTimes = (v: unknown) => Array.isArray(v) && v.length <= LIMITS.times && v.every((t) => typeof t === 'string' && CLOCK.test(t));
const isWeekdays = (v: unknown) => Array.isArray(v) && v.length <= 7 && v.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
const isId = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= LIMITS.id;
const isList = (v: unknown, each: (x: unknown) => boolean) => Array.isArray(v) && v.length <= LIMITS.rows && v.every(each);

function isAbhyasRow(v: unknown): boolean {
  if (!isObject(v)) return false;
  return isId(v.id) && isWeekdays(v.days) && isTimes(v.times) && isText(v.title, LIMITS.text) && isText(v.body, LIMITS.text) && (v.bodyToday === undefined || isText(v.bodyToday, LIMITS.text));
}

function isOnceRow(v: unknown): boolean {
  return isObject(v) && isDate(v.date) && typeof v.time === 'string' && CLOCK.test(v.time) && isText(v.title, LIMITS.text) && isText(v.body, LIMITS.text);
}

function isChecklist(v: unknown): boolean {
  return v === null || (isObject(v) && isTimes(v.times) && isText(v.title, LIMITS.text) && isText(v.body, LIMITS.checklist) && isDate(v.date));
}

/**
 * Whether an upload is a schedule the relay keeps. Version 1, from an older
 * app, is checked as it always was; version 2 also has its Abhyas and "Day so
 * far" parts checked in full, each within `LIMITS`, so nothing malformed or
 * oversized is stored and read every five minutes.
 */
export function validSchedule(s: unknown): s is PushSchedule {
  if (!isObject(s)) return false;
  const o = s as Partial<PushSchedule>;
  const base = typeof o.tz === 'string' && Array.isArray(o.days) && Array.isArray(o.blocks) && Array.isArray(o.slots) && Array.isArray(o.mantras) && typeof o.quiet === 'object';
  if (o.v === 1) return base;
  if (o.v !== 2 || !base || !isObject(o.quiet) || typeof o.quiet.from !== 'number' || typeof o.quiet.to !== 'number') return false;
  return isList(o.abhyas, isAbhyasRow) && isList(o.once, isOnceRow) && isList(o.doneToday, isId) && isDate(o.doneDate) && isChecklist(o.checklist);
}

export type Reminder = { key: string; title: string; body: string; url: string };

export type LocalTime = { date: string; weekday: number; minutes: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The wall clock in `tz` at this instant. */
export function localTime(ms: number, tz: string): LocalTime {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: Math.max(0, WEEKDAYS.indexOf(get('weekday'))),
    minutes: hour * 60 + Number(get('minute')),
  };
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function inQuiet(hour: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Reminders that fall exactly on this local minute. */
export function dueAt(s: PushSchedule, now: LocalTime): Reminder[] {
  const out: Reminder[] = [];
  const hour = Math.floor(now.minutes / 60);
  if (inQuiet(hour, s.quiet.from, s.quiet.to)) return out;
  const workDay = s.days.includes(now.weekday);

  const m = s.mantras.find((x) => x.date === now.date);
  if (m && now.minutes === 8 * 60) out.push({ key: `mantra-${now.date}`, title: m.title, body: m.text, url: '/' });
  // The weigh day at a quarter to eight, before the day's line at eight.
  if (s.weigh && s.weigh.weekday === now.weekday && now.minutes === 7 * 60 + 45) out.push({ key: `weigh-${now.date}`, title: s.weigh.title, body: s.weigh.body, url: '/' });

  if (workDay) {
    for (const b of s.blocks) if (toMinutes(b.start) === now.minutes) out.push({ key: `block-${b.kind}-${now.date}`, title: b.title, body: b.body, url: '/' });
  }
  const freeDay = Array.isArray(s.offDays) && s.offDays.includes(now.weekday);
  if (!freeDay) for (const sl of s.slots) if (toMinutes(sl.at) === now.minutes) out.push({ key: `slot-${sl.id}-${now.date}`, title: sl.title, body: sl.body, url: '/' });

  if (workDay && s.breaks) {
    const from = toMinutes(s.breaks.from);
    const to = toMinutes(s.breaks.to);
    if (now.minutes > from && now.minutes < to && (now.minutes - from) % s.breaks.everyMinutes === 0) {
      out.push({ key: `break-${now.date}-${now.minutes}`, title: s.breaks.title, body: s.breaks.body, url: '/' });
    }
  }
  if (s.water) {
    const from = toMinutes(s.water.from);
    const to = toMinutes(s.water.to);
    // Offset by ten minutes so water and a break never land in the same moment.
    const active = s.days.length === 0 || workDay || !s.breaks;
    if (active && now.minutes > from && now.minutes < to && (now.minutes - from - 10) % s.water.everyMinutes === 0) {
      out.push({ key: `water-${now.date}-${now.minutes}`, title: s.water.title, body: s.water.body, url: '/log' });
    }
  }

  // Abhyas: each repeating item on its own weekdays, free days too (they are the user's choice), but not on the day
  // the app said it was done; each one-off on its date. A version 1 schedule has neither.
  const uploadDay = now.date === s.doneDate;
  for (const a of s.abhyas ?? []) {
    if (!a.days.includes(now.weekday) || (uploadDay && s.doneToday?.includes(a.id))) continue;
    for (const time of a.times) {
      if (toMinutes(time) === now.minutes) out.push({ key: `abhyas-${a.id}-${now.date}-${time}`, title: a.title, body: uploadDay && a.bodyToday ? a.bodyToday : a.body, url: '/' });
    }
  }
  (s.once ?? []).forEach((o, i) => {
    if (o.date === now.date && toMinutes(o.time) === now.minutes) out.push({ key: `once-${i}-${now.date}-${o.time}`, title: o.title, body: o.body, url: '/' });
  });

  // "Day so far" says how its own date stood, so it goes out on that date only, and never on a free day.
  const c = s.checklist;
  if (c && c.date === now.date && !freeDay) {
    for (const time of c.times) if (toMinutes(time) === now.minutes) out.push({ key: `checklist-${now.date}-${time}`, title: c.title, body: c.body, url: '/' });
  }
  return out;
}

/**
 * At most this many go out in one run: after a stall the rest are stale by
 * now, and a few Abhyas items set for the same time still all come.
 */
export const MAX_PER_RUN = 6;

/** Which are kept first when more fall due in one run than it sends: the meal-time prompts and "Day so far", then the rest, the Abhyas times last, as on the phone. */
function rank(key: string): number {
  if (key.startsWith('slot-') || key.startsWith('checklist-')) return 0;
  if (key.startsWith('abhyas-') || key.startsWith('once-')) return 2;
  return 1;
}

/**
 * Everything due in the window (from, to], minute by minute. The window is
 * the gap since the last cron run, capped so a stalled relay cannot flood a
 * phone with an hour of missed reminders.
 */
export function dueBetween(s: PushSchedule, fromMs: number, toMs: number, capMinutes = 10): Reminder[] {
  const start = Math.max(fromMs, toMs - capMinutes * 60_000);
  const out: { r: Reminder; t: number; i: number }[] = [];
  const seen = new Set<string>();
  // Walk whole minutes strictly after `start` up to `toMs`.
  let t = Math.floor(start / 60_000) * 60_000 + 60_000;
  for (; t <= toMs; t += 60_000) {
    for (const r of dueAt(s, localTime(t, s.tz))) {
      if (!seen.has(r.key)) {
        seen.add(r.key);
        out.push({ r, t, i: out.length });
      }
    }
  }
  // At most a few in one go: by rank, then the latest minute, then the order within a minute (the user's order of
  // their Abhyas items). They go out in the order they fell due.
  return out
    .sort((a, b) => rank(a.r.key) - rank(b.r.key) || b.t - a.t || a.i - b.i)
    .slice(0, MAX_PER_RUN)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.r);
}

/**
 * What a cron run does with a phone afterwards: drop it when the push service
 * says the address is gone, save the run time when something was sent or when
 * the phone has none saved yet (`firstRun`, once), and otherwise leave it as
 * it is. KV allows few writes a day on the free plan, so a quiet run writes
 * nothing; the next run still sees the minutes since, and `dueBetween` caps
 * how far back it looks. The first run's time is kept so the window does not
 * start again at each upload until something is sent.
 */
export function afterRun(sent: number, gone: boolean, firstRun = false): 'delete' | 'save' | 'leave' {
  if (gone) return 'delete';
  return sent > 0 || firstRun ? 'save' : 'leave';
}
