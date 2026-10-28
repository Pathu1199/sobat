import { describe, expect, it } from 'vitest';
import { DAY_ENDS_AT_HOUR, expectedWaterByHour, gateStep, inQuietHours, pickNudge, skipStreak } from '../nudge';
import type { NudgeContext } from '../nudge';
import type { NudgeLog } from '../types';

const base: NudgeContext = {
  hour: 14,
  minute: 0,
  idleSeconds: 10,
  sittingMinutes: 50,
  waterMl: 2000,
  waterGoalMl: 3000,
  lastMealHoursAgo: 2,
  todayNudges: [],
  quietStartHour: 22,
  quietEndHour: 7,
  enabled: true,
  offDay: false,
};

function log(type: string, action: NudgeLog['action']): NudgeLog {
  return { id: Math.random().toString(), at: '', date: '2026-09-25', type, action };
}

describe('inQuietHours', () => {
  it('handles a window that wraps midnight', () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(3, 22, 7)).toBe(true);
    expect(inQuietHours(12, 22, 7)).toBe(false);
  });

  it('handles a same-day window', () => {
    expect(inQuietHours(10, 9, 12)).toBe(true);
    expect(inQuietHours(13, 9, 12)).toBe(false);
  });
});

describe('pickNudge', () => {
  it('asks for a log when nothing was logged by late morning, not before', () => {
    const quietDesk = { ...base, sittingMinutes: 10, lastMealHoursAgo: null };
    expect(pickNudge({ ...quietDesk, hour: 14 })?.type).toBe('log');
    expect(pickNudge({ ...quietDesk, hour: 9 })?.type).not.toBe('log');
  });

  it('never asks for a log on an off day', () => {
    const quietDesk = { ...base, sittingMinutes: 10, lastMealHoursAgo: null };
    expect(pickNudge({ ...quietDesk, hour: 14, offDay: true })?.type).not.toBe('log');
    expect(pickNudge({ ...quietDesk, hour: 14, offDay: true })).not.toBeNull();
  });

  it('stays silent when disabled', () => {
    expect(pickNudge({ ...base, enabled: false })).toBeNull();
  });

  it('stays silent at night', () => {
    expect(pickNudge({ ...base, hour: 2 })).toBeNull();
  });

  it('stays silent when you are away from the desk', () => {
    expect(pickNudge({ ...base, idleSeconds: 900 })).toBeNull();
  });

  it('puts water first when you are behind', () => {
    const n = pickNudge({ ...base, waterMl: 200 });
    expect(n?.type).toBe('water');
  });

  it('asks you to stand after 90 minutes of sitting', () => {
    const n = pickNudge({ ...base, sittingMinutes: 120 });
    expect(n?.type).toBe('stand');
  });

  it('backs off a type that keeps getting skipped', () => {
    const skipped = [log('water', 'skip'), log('water', 'skip'), log('water', 'skip')];
    const n = pickNudge({ ...base, waterMl: 200, todayNudges: skipped });
    expect(n?.type).not.toBe('water');
  });

  it('does not repeat the nudge it just showed', () => {
    const n = pickNudge({ ...base, sittingMinutes: 20, todayNudges: [log('breathe', 'done')] });
    expect(n?.type).not.toBe('breathe');
  });

  it('always attaches a micro-task', () => {
    const n = pickNudge({ ...base, waterMl: 100 });
    expect(n!.microTaskSeconds).toBeGreaterThan(0);
  });
});

describe('skipStreak', () => {
  it('counts only the trailing run', () => {
    const logs = [log('water', 'skip'), log('water', 'done'), log('water', 'skip'), log('water', 'skip')];
    expect(skipStreak(logs, 'water')).toBe(2);
  });
});

describe('expectedWaterByHour', () => {
  it('spreads the goal across waking hours', () => {
    expect(expectedWaterByHour(6, 3000)).toBe(0);
    expect(expectedWaterByHour(14, 3000)).toBe(1500);
    expect(expectedWaterByHour(22, 3000)).toBe(3000);
  });

  it('reaches the whole goal at the hour the waking day ends, 21:00, and not before', () => {
    expect(DAY_ENDS_AT_HOUR).toBe(21);
    expect(expectedWaterByHour(DAY_ENDS_AT_HOUR - 1, 3000)).toBeLessThan(3000);
    expect(expectedWaterByHour(DAY_ENDS_AT_HOUR, 3000)).toBe(3000);
  });
});

describe('gateStep: how often the app may speak up on its own', () => {
  const gate = { gapMinutes: 60, maxPerDay: 8, quietStartHour: 22, quietEndHour: 7 };
  const at = (iso: string) => new Date(iso);

  it('counts the day\'s cap by the person\'s own date, so it starts again at their midnight, not at UTC\'s', () => {
    const open = { ...gate, quietStartHour: 0, quietEndHour: 0 };
    // 03:00 on the 28th in Kolkata is still the 27th in UTC.
    const now = at('2026-10-28T03:00:00');
    expect(now.toISOString().slice(0, 10)).toBe('2026-10-27');
    // Yesterday's eight do not hold back the first one of the new day...
    const yesterday = { lastAt: at('2026-10-27T21:00:00').getTime(), sentOn: '2026-10-27', sentCount: 8 };
    expect(gateStep(open, yesterday, now)).toEqual({ lastAt: now.getTime(), sentOn: '2026-10-28', sentCount: 1 });
    // ...and the new day's eight are not forgotten because UTC is still on yesterday.
    const today = { lastAt: at('2026-10-28T01:00:00').getTime(), sentOn: '2026-10-28', sentCount: 8 };
    expect(gateStep(open, today, now)).toBeNull();
  });

  it('holds back a reminder in quiet hours, past the day\'s cap, or inside the gap; a high one waits half the gap', () => {
    const now = at('2026-10-28T13:00:00');
    const fresh = { lastAt: 0, sentOn: '', sentCount: 0 };
    expect(gateStep(gate, fresh, at('2026-10-28T23:00:00'))).toBeNull();
    expect(gateStep(gate, { lastAt: 0, sentOn: '2026-10-28', sentCount: 8 }, now)).toBeNull();
    const recent = { lastAt: now.getTime() - 40 * 60000, sentOn: '2026-10-28', sentCount: 2 };
    expect(gateStep(gate, recent, now)).toBeNull();
    expect(gateStep(gate, recent, now, 'high')).toEqual({ lastAt: now.getTime(), sentOn: '2026-10-28', sentCount: 3 });
  });
});
