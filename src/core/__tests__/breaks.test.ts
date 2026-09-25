import { describe, expect, it } from 'vitest';
import {
  breakRemainingSeconds, breakStats, DEFAULT_BREAK_SETTINGS, inQuiet, isBreakOver,
  minutesUntilBreak, resetPointFor, shouldStartBreak, suggestLongerInterval,
  type BreakContext, type BreakLog,
} from '../breaks';

const T0 = 1_800_000_000_000;
const ctx = (over: Partial<BreakContext> = {}): BreakContext => ({
  nowMs: T0 + 21 * 60000,
  workingSinceMs: T0,
  idleSeconds: 5,
  hour: 14,
  settings: DEFAULT_BREAK_SETTINGS,
  ...over,
});

describe('shouldStartBreak', () => {
  it('fires once the work stretch is long enough', () => {
    expect(shouldStartBreak(ctx())).toBe(true);
  });

  it('does not fire before the interval', () => {
    expect(shouldStartBreak(ctx({ nowMs: T0 + 19 * 60000 }))).toBe(false);
  });

  it('never fires when switched off', () => {
    expect(shouldStartBreak(ctx({ settings: { ...DEFAULT_BREAK_SETTINGS, enabled: false } }))).toBe(false);
  });

  it('stays quiet at night', () => {
    expect(shouldStartBreak(ctx({ hour: 23 }))).toBe(false);
    expect(shouldStartBreak(ctx({ hour: 3 }))).toBe(false);
  });

  it('does not ambush someone who is already away', () => {
    expect(shouldStartBreak(ctx({ idleSeconds: 600 }))).toBe(false);
  });

  it('respects a custom interval', () => {
    const settings = { ...DEFAULT_BREAK_SETTINGS, workMinutes: 45 };
    expect(shouldStartBreak(ctx({ settings }))).toBe(false);
    expect(shouldStartBreak(ctx({ settings, nowMs: T0 + 46 * 60000 }))).toBe(true);
  });
});

describe('minutesUntilBreak', () => {
  it('counts down and never goes negative', () => {
    expect(Math.round(minutesUntilBreak(ctx({ nowMs: T0 + 5 * 60000 })))).toBe(15);
    expect(minutesUntilBreak(ctx({ nowMs: T0 + 40 * 60000 }))).toBe(0);
  });

  it('is infinite when disabled', () => {
    expect(minutesUntilBreak(ctx({ settings: { ...DEFAULT_BREAK_SETTINGS, enabled: false } }))).toBe(Infinity);
  });
});

describe('resetPointFor', () => {
  it('treats time away from the desk as a break already taken', () => {
    expect(resetPointFor(ctx({ idleSeconds: 400 }))).toBe(ctx({ idleSeconds: 400 }).nowMs);
  });

  it('does nothing while you are working', () => {
    expect(resetPointFor(ctx())).toBeNull();
  });
});

describe('break countdown', () => {
  it('counts the pause down to zero', () => {
    expect(breakRemainingSeconds(T0, T0, 60)).toBe(60);
    expect(breakRemainingSeconds(T0, T0 + 30000, 60)).toBe(30);
    expect(breakRemainingSeconds(T0, T0 + 90000, 60)).toBe(0);
  });

  it('knows when the pause is done', () => {
    expect(isBreakOver(T0, T0 + 59000, 60)).toBe(false);
    expect(isBreakOver(T0, T0 + 60000, 60)).toBe(true);
  });
});

describe('inQuiet', () => {
  it('handles a window across midnight', () => {
    expect(inQuiet(23, 22, 7)).toBe(true);
    expect(inQuiet(6, 22, 7)).toBe(true);
    expect(inQuiet(12, 22, 7)).toBe(false);
  });
});

describe('breakStats', () => {
  const log = (action: 'taken' | 'skipped', worked: number): BreakLog => ({ id: Math.random().toString(), date: '2026-09-25', at: '', action, workedMinutes: worked });

  it('reports compliance and the longest stretch', () => {
    const s = breakStats([log('taken', 20), log('skipped', 25), log('taken', 48)]);
    expect(s.taken).toBe(2);
    expect(s.skipped).toBe(1);
    expect(s.compliancePct).toBe(67);
    expect(s.longestStretchMinutes).toBe(48);
  });

  it('is zero with no history', () => {
    expect(breakStats([]).compliancePct).toBe(0);
  });
});

describe('suggestLongerInterval', () => {
  const skip = (): BreakLog => ({ id: Math.random().toString(), date: '2026-09-25', at: '', action: 'skipped', workedMinutes: 20 });
  const take = (): BreakLog => ({ id: Math.random().toString(), date: '2026-09-25', at: '', action: 'taken', workedMinutes: 20 });

  it('offers a longer gap when every break gets skipped', () => {
    expect(suggestLongerInterval([skip(), skip(), skip(), skip(), skip()], 20)).toBe(35);
  });

  it('stays quiet when breaks are being taken', () => {
    expect(suggestLongerInterval([skip(), skip(), take(), skip(), skip()], 20)).toBeNull();
  });

  it('does not push past the ceiling', () => {
    expect(suggestLongerInterval([skip(), skip(), skip(), skip(), skip()], 90)).toBeNull();
  });
});
