/**
 * What is due, and when. Pure functions over the schedule the app uploads,
 * so they can be tested without a Worker. Times are the person's local
 * clock, read through their IANA time zone.
 */

export type PushSchedule = {
  v: 1;
  tz: string;
  lang: string;
  days: number[];
  blocks: { kind: string; start: string; title: string; body: string }[];
  slots: { id: string; at: string; title: string; body: string }[];
  breaks: { everyMinutes: number; from: string; to: string; title: string; body: string } | null;
  water: { everyMinutes: number; from: string; to: string; title: string; body: string } | null;
  mantras: { date: string; title: string; text: string }[];
  quiet: { from: number; to: number };
  weigh?: { weekday: number; title: string; body: string } | null;
};

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
  if (s.weigh && s.weigh.weekday === now.weekday && now.minutes === 7 * 60 + 45) out.push({ key: `weigh-${now.date}`, title: s.weigh.title, body: s.weigh.body, url: '/' });

  if (workDay) {
    for (const b of s.blocks) if (toMinutes(b.start) === now.minutes) out.push({ key: `block-${b.kind}-${now.date}`, title: b.title, body: b.body, url: '/' });
  }
  for (const sl of s.slots) if (toMinutes(sl.at) === now.minutes) out.push({ key: `slot-${sl.id}-${now.date}`, title: sl.title, body: sl.body, url: '/' });

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
  return out;
}

/**
 * Everything due in the window (from, to], minute by minute. The window is
 * the gap since the last cron run, capped so a stalled relay cannot flood a
 * phone with an hour of missed reminders.
 */
export function dueBetween(s: PushSchedule, fromMs: number, toMs: number, capMinutes = 10): Reminder[] {
  const start = Math.max(fromMs, toMs - capMinutes * 60_000);
  const out: Reminder[] = [];
  const seen = new Set<string>();
  // Walk whole minutes strictly after `start` up to `toMs`.
  let t = Math.floor(start / 60_000) * 60_000 + 60_000;
  for (; t <= toMs; t += 60_000) {
    for (const r of dueAt(s, localTime(t, s.tz))) {
      if (!seen.has(r.key)) {
        seen.add(r.key);
        out.push(r);
      }
    }
  }
  // At most three in one go; the rest are stale by now.
  return out.slice(-3);
}
