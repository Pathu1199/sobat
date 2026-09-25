import { describe, expect, it } from 'vitest';
import { expectedWaterByHour, inQuietHours, pickNudge, skipStreak } from '../nudge';
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
});
