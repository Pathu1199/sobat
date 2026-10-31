import { describe, expect, it } from 'vitest';
import { afterRun, dueAt, dueBetween, LIMITS, localTime, MAX_PER_RUN, validSchedule, type PushSchedule } from './schedule';

const S: PushSchedule = {
  v: 1,
  tz: 'Asia/Kolkata',
  lang: 'mr',
  days: [1, 2, 3, 4, 5, 6],
  blocks: [
    { kind: 'start', start: '09:00', title: 'Work starts', body: 'water' },
    { kind: 'lunch', start: '13:00', title: 'Lunch', body: 'eat' },
  ],
  slots: [{ id: 'lunch', at: '13:45', title: 'Lunch?', body: 'log or skip' }],
  breaks: { everyMinutes: 20, from: '09:00', to: '18:00', title: 'Look away', body: '20s' },
  water: { everyMinutes: 30, from: '09:00', to: '18:00', title: 'Water', body: 'glass' },
  mantras: [{ date: '2026-10-06', title: 'Mantra', text: 'Sleep.' }],
  quiet: { from: 22, to: 7 },
  weigh: { weekday: 2, title: 'Weigh?', body: 'morning' },
};
// 2026-10-06 is a Tuesday. Kolkata is UTC+5:30, so 09:20 local is 03:50Z.
const at = (hhmm: string) => Date.parse(`2026-10-06T${hhmm}:00+05:30`);

describe('localTime', () => {
  it('reads the person\'s wall clock in their zone', () => {
    const t = localTime(at('13:45'), 'Asia/Kolkata');
    expect(t).toEqual({ date: '2026-10-06', weekday: 2, minutes: 13 * 60 + 45 });
  });
});

describe('dueAt', () => {
  const now = (hhmm: string) => localTime(at(hhmm), S.tz);
  it('fires blocks, slots, breaks, water and the mantra at their minutes', () => {
    expect(dueAt(S, now('09:00')).map((r) => r.key)).toEqual(['block-start-2026-10-06']);
    expect(dueAt(S, now('13:45')).map((r) => r.key)).toEqual(['slot-lunch-2026-10-06']);
    expect(dueAt(S, now('09:20')).map((r) => r.key)).toEqual(['break-2026-10-06-560']);
    expect(dueAt(S, now('09:40')).map((r) => r.key)).toEqual(['break-2026-10-06-580', 'water-2026-10-06-580']);
    expect(dueAt(S, now('08:00')).map((r) => r.key)).toEqual(['mantra-2026-10-06']);
    expect(dueAt(S, now('09:21'))).toEqual([]);
    expect(dueAt(S, now('07:45')).map((r) => r.key)).toEqual(['weigh-2026-10-06']);
  });
  it('stays quiet at night and off days', () => {
    expect(dueAt(S, localTime(Date.parse('2026-10-06T23:00:00+05:30'), S.tz))).toEqual([]);
    // Sunday: no blocks or breaks; water keeps going (no office means no break schedule to defer to).
    const sun = localTime(Date.parse('2026-10-11T09:20:00+05:30'), S.tz);
    expect(dueAt(S, sun).some((r) => r.key.startsWith('break'))).toBe(false);
  });
});

describe('dueAt: free days', () => {
  it('asks about no meal on a free day, and as before on any other day', () => {
    const free: PushSchedule = { ...S, offDays: [2] };
    const tue = localTime(at('13:45'), S.tz);
    expect(dueAt(free, tue).some((r) => r.key.startsWith('slot'))).toBe(false);
    expect(dueAt({ ...S, offDays: [0] }, tue).map((r) => r.key)).toEqual(['slot-lunch-2026-10-06']);
    // A schedule from an older app has no free days: every day asks, as before.
    expect(dueAt(S, tue).map((r) => r.key)).toEqual(['slot-lunch-2026-10-06']);
  });
});

describe('dueBetween', () => {
  it('collects what fell in the gap, once, and caps a long gap', () => {
    const keys = dueBetween(S, at('09:16'), at('09:21')).map((r) => r.key);
    expect(keys).toEqual(['break-2026-10-06-560']);
    // An hour-long stall sends only the last few minutes' worth, never the whole hour.
    const stalled = dueBetween(S, at('09:00'), at('10:00'));
    expect(stalled.length).toBeLessThanOrEqual(3);
    expect(stalled.every((r) => Number(r.key.split('-').pop()) >= 590)).toBe(true);
  });
});

describe('afterRun', () => {
  it('writes the entry only when something was sent, and drops a gone address', () => {
    expect(afterRun(0, false)).toBe('leave');
    expect(afterRun(2, false)).toBe('save');
    expect(afterRun(1, true)).toBe('delete');
    expect(afterRun(0, true)).toBe('delete');
  });

  it('leaves nothing behind when a run is skipped: the next run still finds what fell due since', () => {
    // A run at 13:40 found nothing and wrote nothing, so lastRunMs is still 13:35; the 13:45 run looks back to it.
    const at = (hhmm: string) => Date.parse(`2026-10-28T${hhmm}:00+05:30`);
    expect(dueBetween(S, at('13:40'), at('13:44'))).toEqual([]);
    expect(dueBetween(S, at('13:35'), at('13:45')).map((r) => r.title)).toContain('Lunch?');
  });
});

// Version 2: the same schedule with the Abhyas and "Day so far" parts, and no office day, so only they come at their
// times. 2026-10-06 is a Tuesday (2); Sunday (0) is free.
const V2: PushSchedule = {
  ...S,
  v: 2,
  blocks: [],
  breaks: null,
  water: null,
  offDays: [0],
  abhyas: [
    { id: 'yoga', days: [0, 2, 4], times: ['07:30', '18:00'], title: 'Yoga', body: '0 of 20 min today', bodyToday: '12 of 20 min today' },
    { id: 'coding', days: [2], times: ['18:00'], title: 'Coding', body: "Today's list" },
  ],
  once: [
    { date: '2026-10-07', time: '10:00', title: 'Fix the bike', body: "Today's list" },
    { date: '2026-10-07', time: '10:00', title: 'Call the bank', body: "Today's list" },
  ],
  doneToday: ['coding'],
  doneDate: '2026-10-06',
  checklist: { times: ['13:00', '20:30'], title: 'Dhyey · Day so far', body: '✓ Breakfast · ○ Lunch', date: '2026-10-06' },
};
const ms = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+05:30`);
const on = (date: string, hhmm: string) => localTime(ms(date, hhmm), V2.tz);
const keys = (s: PushSchedule, date: string, hhmm: string) => dueAt(s, on(date, hhmm)).map((r) => r.key);

describe('dueAt: Abhyas', () => {
  it('reminds of a repeating item at each of its times on its own weekdays, and on no other', () => {
    expect(keys(V2, '2026-10-06', '07:30')).toEqual(['abhyas-yoga-2026-10-06-07:30']);
    expect(dueAt(V2, on('2026-10-06', '07:30'))[0]).toMatchObject({ title: 'Yoga', url: '/' });
    // Monday is not one of its days.
    expect(keys(V2, '2026-10-05', '07:30')).toEqual([]);
    expect(keys(V2, '2026-10-06', '07:31')).toEqual([]);
  });

  it("keeps to the item's own days on a free day, as the phone does", () => {
    expect(keys(V2, '2026-10-11', '07:30')).toEqual(['abhyas-yoga-2026-10-11-07:30']);
  });

  it('skips an item done on the upload day, that day only', () => {
    // Coding was ticked on Tuesday 6 October: nothing for it that evening.
    expect(keys(V2, '2026-10-06', '18:00')).toEqual(['abhyas-yoga-2026-10-06-18:00']);
    // The next Tuesday it comes again, though the app has not uploaded since.
    expect(keys(V2, '2026-10-13', '18:00')).toEqual(['abhyas-yoga-2026-10-13-18:00', 'abhyas-coding-2026-10-13-18:00']);
  });

  it("says the minutes counted on the upload day that day, and a fresh day's words after it", () => {
    expect(dueAt(V2, on('2026-10-06', '18:00'))[0].body).toBe('12 of 20 min today');
    expect(dueAt(V2, on('2026-10-08', '18:00'))[0].body).toBe('0 of 20 min today');
  });

  it('reminds of a one-off on its date only, each of two at one time', () => {
    const due = dueAt(V2, on('2026-10-07', '10:00'));
    expect(due.map((r) => r.title)).toEqual(['Fix the bike', 'Call the bank']);
    expect(new Set(due.map((r) => r.key)).size).toBe(2);
    expect(keys(V2, '2026-10-14', '10:00')).toEqual([]);
    expect(keys(V2, '2026-10-06', '10:00')).toEqual([]);
  });

  it('stays quiet in quiet hours', () => {
    const late: PushSchedule = {
      ...V2,
      abhyas: [{ id: 'read', days: [2], times: ['23:00'], title: 'Read', body: "Today's list" }],
      once: [{ date: '2026-10-06', time: '06:00', title: 'Gym', body: "Today's list" }],
      checklist: { ...V2.checklist!, times: ['22:30'] },
    };
    expect(keys(late, '2026-10-06', '23:00')).toEqual([]);
    expect(keys(late, '2026-10-06', '06:00')).toEqual([]);
    expect(keys(late, '2026-10-06', '22:30')).toEqual([]);
    // With no quiet hours the same rows come.
    const open: PushSchedule = { ...late, quiet: { from: 0, to: 0 } };
    expect(keys(open, '2026-10-06', '23:00')).toEqual(['abhyas-read-2026-10-06-23:00']);
    expect(keys(open, '2026-10-06', '06:00')).toEqual(['once-0-2026-10-06-06:00']);
    expect(keys(open, '2026-10-06', '22:30')).toEqual(['checklist-2026-10-06-22:30']);
  });
});

describe('dueAt: Day so far', () => {
  it('sends the day as it stood at each of its times, on its own date', () => {
    expect(keys(V2, '2026-10-06', '13:00')).toEqual(['checklist-2026-10-06-13:00']);
    expect(dueAt(V2, on('2026-10-06', '20:30'))[0]).toMatchObject({ title: 'Dhyey · Day so far', body: '✓ Breakfast · ○ Lunch', url: '/' });
  });

  it('never sends a stale day on a later one', () => {
    expect(keys(V2, '2026-10-07', '20:30')).toEqual([]);
    expect(keys(V2, '2026-10-13', '20:30')).toEqual([]);
  });

  it('sends nothing on a free day, nor when it is off', () => {
    const sunday: PushSchedule = { ...V2, checklist: { ...V2.checklist!, date: '2026-10-11' } };
    expect(keys(sunday, '2026-10-11', '20:30')).toEqual([]);
    expect(keys({ ...V2, checklist: null }, '2026-10-06', '20:30')).toEqual([]);
  });
});

describe('dueAt: a version 1 schedule', () => {
  it('works as before, with none of the new parts', () => {
    expect(S.v).toBe(1);
    expect(S.abhyas).toBeUndefined();
    expect(keys(S, '2026-10-06', '13:45')).toEqual(['slot-lunch-2026-10-06']);
    expect(keys(S, '2026-10-06', '20:30')).toEqual([]);
    expect(keys(S, '2026-10-06', '18:00')).toEqual([]);
  });
});

describe('dueBetween: many at one time', () => {
  it('sends a few Abhyas items set for one time all together', () => {
    const four: PushSchedule = { ...V2, doneToday: [], abhyas: ['a', 'b', 'c', 'd'].map((id) => ({ id, days: [2], times: ['07:00'], title: id, body: "Today's list" })) };
    expect(dueBetween(four, ms('2026-10-06', '06:55'), ms('2026-10-06', '07:00')).map((r) => r.title)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the meal-time prompt and the day so far over the Abhyas times when more fall due than one run sends', () => {
    const crowd: PushSchedule = {
      ...V2,
      doneToday: [],
      slots: [{ id: 'dinner', at: '20:30', title: 'Dinner?', body: 'log or skip' }],
      abhyas: Array.from({ length: 8 }, (_, i) => ({ id: `item${i}`, days: [2], times: ['20:30'], title: `item${i}`, body: "Today's list" })),
    };
    const sent = dueBetween(crowd, ms('2026-10-06', '20:25'), ms('2026-10-06', '20:30')).map((r) => r.key);
    expect(sent).toHaveLength(MAX_PER_RUN);
    expect(sent).toContain('slot-dinner-2026-10-06');
    expect(sent).toContain('checklist-2026-10-06-20:30');
    // The user's first items, in their order.
    expect(sent.filter((k) => k.startsWith('abhyas-'))).toEqual(['item0', 'item1', 'item2', 'item3'].map((id) => `abhyas-${id}-2026-10-06-20:30`));
  });

  it('keeps the latest of one kind after a stall', () => {
    const spread: PushSchedule = {
      ...V2,
      doneToday: [],
      checklist: null,
      abhyas: Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, days: [2], times: [`19:0${i}`], title: `m${i}`, body: "Today's list" })),
    };
    const sent = dueBetween(spread, ms('2026-10-06', '18:55'), ms('2026-10-06', '19:09')).map((r) => r.title);
    expect(sent).toEqual(['m2', 'm3', 'm4', 'm5', 'm6', 'm7']);
  });
});

describe('validSchedule', () => {
  it('takes a version 1 schedule from an older app as it always did', () => {
    expect(validSchedule(S)).toBe(true);
    const oldest: Partial<PushSchedule> = { ...S };
    delete oldest.offDays;
    delete oldest.weigh;
    expect(validSchedule(oldest)).toBe(true);
  });

  it('takes a version 2 schedule, with or without the day so far', () => {
    expect(validSchedule(V2)).toBe(true);
    expect(validSchedule({ ...V2, checklist: null, abhyas: [], once: [], doneToday: [] })).toBe(true);
    expect(validSchedule(JSON.parse(JSON.stringify(V2)))).toBe(true);
  });

  it('refuses junk', () => {
    for (const junk of [null, 'v2', [], 42, {}, { ...S, v: 3 }, { ...S, v: '1' }, { ...S, tz: 5 }]) expect(validSchedule(junk), JSON.stringify(junk)).toBe(false);
  });

  it('refuses a version 2 schedule with a part missing or malformed', () => {
    const row = V2.abhyas![0];
    const bad: Record<string, unknown>[] = [
      { abhyas: undefined },
      { once: undefined },
      { doneToday: undefined },
      { doneDate: undefined },
      { checklist: undefined },
      { quiet: null },
      { abhyas: [{ ...row, days: [7] }] },
      { abhyas: [{ ...row, days: [1.5] }] },
      { abhyas: [{ ...row, times: ['6:30'] }] },
      { abhyas: [{ ...row, times: ['24:00'] }] },
      { abhyas: [{ ...row, id: '' }] },
      { abhyas: [{ ...row, title: 7 }] },
      { abhyas: [{ ...row, bodyToday: null }] },
      { abhyas: ['yoga'] },
      { once: [{ ...V2.once![0], date: 'tomorrow' }] },
      { once: [{ ...V2.once![0], time: 1000 }] },
      { doneToday: [5] },
      { doneDate: '6 Oct' },
      { checklist: { ...V2.checklist!, date: undefined } },
      { checklist: { ...V2.checklist!, times: '20:30' } },
      { checklist: [] },
    ];
    for (const change of bad) expect(validSchedule({ ...V2, ...change }), JSON.stringify(change)).toBe(false);
  });

  it('refuses a version 2 schedule over the limits', () => {
    const row = V2.abhyas![0];
    const long = (n: number) => 'x'.repeat(n);
    expect(validSchedule({ ...V2, abhyas: Array.from({ length: LIMITS.rows }, (_, i) => ({ ...row, id: `i${i}` })) })).toBe(true);
    expect(validSchedule({ ...V2, abhyas: Array.from({ length: LIMITS.rows + 1 }, (_, i) => ({ ...row, id: `i${i}` })) })).toBe(false);
    expect(validSchedule({ ...V2, once: Array.from({ length: LIMITS.rows + 1 }, () => V2.once![0]) })).toBe(false);
    expect(validSchedule({ ...V2, doneToday: Array.from({ length: LIMITS.rows + 1 }, (_, i) => `i${i}`) })).toBe(false);
    expect(validSchedule({ ...V2, abhyas: [{ ...row, times: ['06:00', '07:00', '08:00', '09:00'] }] })).toBe(false);
    expect(validSchedule({ ...V2, abhyas: [{ ...row, id: long(LIMITS.id + 1) }] })).toBe(false);
    expect(validSchedule({ ...V2, abhyas: [{ ...row, title: long(LIMITS.text) }] })).toBe(true);
    expect(validSchedule({ ...V2, abhyas: [{ ...row, title: long(LIMITS.text + 1) }] })).toBe(false);
    expect(validSchedule({ ...V2, once: [{ ...V2.once![0], body: long(LIMITS.text + 1) }] })).toBe(false);
    expect(validSchedule({ ...V2, checklist: { ...V2.checklist!, body: long(LIMITS.checklist) } })).toBe(true);
    expect(validSchedule({ ...V2, checklist: { ...V2.checklist!, body: long(LIMITS.checklist + 1) } })).toBe(false);
  });
});
