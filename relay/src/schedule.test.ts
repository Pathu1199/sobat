import { describe, expect, it } from 'vitest';
import { dueAt, dueBetween, localTime, type PushSchedule } from './schedule';

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
