import { describe, expect, it } from 'vitest';
import {
  breakStats,
  canSkip,
  clocksAfter,
  clocksAfterIdle,
  DEFAULT_BREAK_SETTINGS,
  inQuiet,
  inWindow,
  isPaused,
  nextDue,
  skipsLeft,
  suggestLongerInterval,
  takesScreen,
  type BreakClocks,
  type BreakContext,
  type BreakLog,
  type BreakSettings,
} from '../breaks';

const T0 = new Date('2026-09-28T10:00:00+05:30').getTime();
const MIN = 60_000;

function clocks(at: number = T0): BreakClocks {
  return { micro: at, long: at, posture: at, blink: at };
}

function ctx(over: Partial<BreakContext> = {}): BreakContext {
  return {
    nowMs: T0,
    clocks: clocks(T0),
    idleSeconds: 0,
    hour: 10,
    weekday: 1,
    settings: DEFAULT_BREAK_SETTINGS,
    foreground: null,
    logsToday: [],
    ...over,
  };
}

function settings(over: Partial<BreakSettings> = {}): BreakSettings {
  return { ...DEFAULT_BREAK_SETTINGS, ...over };
}

describe('nextDue', () => {
  it('counts down to the soonest enabled kind', () => {
    // Nothing elapsed: posture is every 30, micro every 20, blink off.
    const d = nextDue(ctx())!;
    expect(d.kind).toBe('micro');
    expect(d.inSeconds).toBe(20 * 60);
  });

  it('reports a kind as due when its interval has elapsed', () => {
    const d = nextDue(ctx({ nowMs: T0 + 20 * MIN }))!;
    expect(d.kind).toBe('micro');
    expect(d.inSeconds).toBe(0);
  });

  it('prefers the long break when both are due at the same moment', () => {
    // At 60 minutes micro (3rd) and long (1st) both come due; the long one wins.
    const d = nextDue(ctx({ nowMs: T0 + 60 * MIN, clocks: clocks(T0) }))!;
    expect(d.kind).toBe('long');
  });

  it('skips a kind that is switched off', () => {
    const d = nextDue(ctx({ settings: settings({ micro: { ...DEFAULT_BREAK_SETTINGS.micro, enabled: false } }) }))!;
    // Posture at 30 minutes is now the soonest.
    expect(d.kind).toBe('posture');
    expect(d.inSeconds).toBe(30 * 60);
  });

  it('includes blink only when it has been switched on', () => {
    const on = settings({ blink: { ...DEFAULT_BREAK_SETTINGS.blink, enabled: true } });
    expect(nextDue(ctx({ settings: on }))!.kind).toBe('blink');
    expect(nextDue(ctx())!.kind).toBe('micro');
  });

  it('returns null when the monitor is off entirely', () => {
    expect(nextDue(ctx({ settings: settings({ enabled: false }) }))).toBeNull();
  });
});

describe('isPaused', () => {
  it('holds everything until the pause expires', () => {
    const paused = settings({ pausedUntilMs: T0 + 30 * MIN });
    expect(isPaused(ctx({ settings: paused }))).toBe(true);
    expect(isPaused(ctx({ nowMs: T0 + 31 * MIN, settings: paused }))).toBe(false);
  });

  it('respects quiet hours across midnight', () => {
    expect(isPaused(ctx({ hour: 23 }))).toBe(true);
    expect(isPaused(ctx({ hour: 3 }))).toBe(true);
    expect(isPaused(ctx({ hour: 10 }))).toBe(false);
  });

  it('holds outside the working schedule when one is set', () => {
    // Monday to Friday, 9 to 18.
    const s = settings({ schedule: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 } });
    expect(isPaused(ctx({ settings: s, weekday: 1, hour: 10 }))).toBe(false);
    expect(isPaused(ctx({ settings: s, weekday: 1, hour: 19 }))).toBe(true);
    expect(isPaused(ctx({ settings: s, weekday: 0, hour: 10 }))).toBe(true);
  });

  it('holds during fullscreen and calls when smart pause asks it to', () => {
    const fg = { fullscreen: true, exe: 'vlc.exe', onCall: false };
    expect(isPaused(ctx({ foreground: fg }))).toBe(true);
    expect(isPaused(ctx({ foreground: { ...fg, fullscreen: false } }))).toBe(false);
    expect(isPaused(ctx({ foreground: { fullscreen: false, exe: 'zoom.exe', onCall: true } }))).toBe(true);
  });

  it('ignores fullscreen and calls when smart pause is switched off', () => {
    const s = settings({ smartPause: { whenFullscreen: false, whenOnCall: false, apps: [] } });
    expect(isPaused(ctx({ settings: s, foreground: { fullscreen: true, exe: 'vlc.exe', onCall: true } }))).toBe(false);
  });

  it('holds while a named app is in front, case-insensitively', () => {
    const s = settings({ smartPause: { whenFullscreen: false, whenOnCall: false, apps: ['Photoshop.exe'] } });
    expect(isPaused(ctx({ settings: s, foreground: { fullscreen: false, exe: 'photoshop.exe', onCall: false } }))).toBe(true);
    expect(isPaused(ctx({ settings: s, foreground: { fullscreen: false, exe: 'code.exe', onCall: false } }))).toBe(false);
  });

  it('is never paused by a foreground state the platform could not read', () => {
    expect(isPaused(ctx({ foreground: null }))).toBe(false);
  });

  it('handles a night-shift schedule that crosses midnight', () => {
    const s = settings({ schedule: { days: [0, 1, 2, 3, 4, 5, 6], startHour: 22, endHour: 6 } });
    expect(isPaused(ctx({ settings: { ...s, quietStartHour: 0, quietEndHour: 0 }, hour: 23 }))).toBe(false);
    expect(isPaused(ctx({ settings: { ...s, quietStartHour: 0, quietEndHour: 0 }, hour: 12 }))).toBe(true);
  });

  it('treats an empty schedule window as all day', () => {
    const s = settings({ schedule: { days: [1], startHour: 9, endHour: 9 }, quietStartHour: 0, quietEndHour: 0 });
    expect(isPaused(ctx({ settings: s, weekday: 1, hour: 3 }))).toBe(false);
  });
});

describe('takesScreen', () => {
  it('is true only for the kinds that blank the screen', () => {
    expect(takesScreen('micro')).toBe(true);
    expect(takesScreen('long')).toBe(true);
    expect(takesScreen('posture')).toBe(false);
    expect(takesScreen('blink')).toBe(false);
  });
});

describe('clocksAfter', () => {
  it('restarts only its own clock for a micro break', () => {
    const next = clocksAfter('micro', clocks(T0), T0 + 20 * MIN);
    expect(next.micro).toBe(T0 + 20 * MIN);
    expect(next.long).toBe(T0);
  });

  it('restarts micro and posture as well after a long break', () => {
    // A three-minute pause has already rested the eyes and the back.
    const next = clocksAfter('long', clocks(T0), T0 + 60 * MIN);
    expect(next.long).toBe(T0 + 60 * MIN);
    expect(next.micro).toBe(T0 + 60 * MIN);
    expect(next.posture).toBe(T0 + 60 * MIN);
    expect(next.blink).toBe(T0);
  });
});

describe('clocksAfterIdle', () => {
  it('does nothing while the person is at the desk', () => {
    expect(clocksAfterIdle(ctx({ idleSeconds: 30 }))).toBeNull();
  });

  it('restarts the short clocks after three minutes away', () => {
    const next = clocksAfterIdle(ctx({ idleSeconds: 180, nowMs: T0 + 5 * MIN }))!;
    expect(next.micro).toBe(T0 + 5 * MIN);
    expect(next.posture).toBe(T0 + 5 * MIN);
    expect(next.long).toBe(T0);
  });

  it('restarts the long clock too after five minutes away', () => {
    const next = clocksAfterIdle(ctx({ idleSeconds: 300, nowMs: T0 + 9 * MIN }))!;
    expect(next.long).toBe(T0 + 9 * MIN);
    expect(next.micro).toBe(T0 + 9 * MIN);
  });
});

describe('canSkip and skipsLeft', () => {
  const skip = (n: number): BreakLog[] =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), date: '2026-09-28', at: '', kind: 'micro' as const, action: 'skipped' as const, workedMinutes: 20, seconds: 20 }));

  it('always allows skipping in gentle mode', () => {
    const s = settings({ strictness: 'gentle' });
    expect(canSkip(skip(99), s)).toBe(true);
    expect(skipsLeft(skip(99), s)).toBe(Infinity);
  });

  it('never allows skipping in strict mode', () => {
    const s = settings({ strictness: 'strict' });
    expect(canSkip([], s)).toBe(false);
    expect(skipsLeft([], s)).toBe(0);
  });

  it('spends a daily budget in normal mode', () => {
    const s = settings({ strictness: 'normal', maxSkipsPerDay: 3 });
    expect(skipsLeft(skip(0), s)).toBe(3);
    expect(canSkip(skip(2), s)).toBe(true);
    expect(skipsLeft(skip(2), s)).toBe(1);
    expect(canSkip(skip(3), s)).toBe(false);
    expect(skipsLeft(skip(3), s)).toBe(0);
  });

  it('counts only skips, not taken breaks', () => {
    const s = settings({ strictness: 'normal', maxSkipsPerDay: 1 });
    const taken: BreakLog[] = [{ id: 't', date: '2026-09-28', at: '', kind: 'micro', action: 'taken', workedMinutes: 20, seconds: 20 }];
    expect(canSkip(taken, s)).toBe(true);
  });
});

describe('breakStats', () => {
  const log = (kind: BreakLog['kind'], action: BreakLog['action'], workedMinutes = 20): BreakLog => ({
    id: Math.random().toString(), date: '2026-09-28', at: '', kind, action, workedMinutes, seconds: 20,
  });

  it('reports totals and per-kind counts', () => {
    const s = breakStats([log('micro', 'taken'), log('micro', 'skipped'), log('long', 'taken')]);
    expect(s.taken).toBe(2);
    expect(s.skipped).toBe(1);
    expect(s.compliancePct).toBe(67);
    expect(s.byKind.micro).toEqual({ taken: 1, offered: 2 });
    expect(s.byKind.long).toEqual({ taken: 1, offered: 1 });
    expect(s.byKind.blink).toEqual({ taken: 0, offered: 0 });
  });

  it('weights a long break twice as heavily in the eye-care score', () => {
    // One micro taken of one offered, one long skipped of one offered:
    // weighted taken 1, weighted offered 3 → 33.
    const s = breakStats([log('micro', 'taken'), log('long', 'skipped')]);
    expect(s.eyeCareScore).toBe(33);
    // The mirror image scores far better.
    expect(breakStats([log('micro', 'skipped'), log('long', 'taken')]).eyeCareScore).toBe(67);
  });

  it('is zero, not NaN, with nothing logged', () => {
    const s = breakStats([]);
    expect(s.compliancePct).toBe(0);
    expect(s.eyeCareScore).toBe(0);
    expect(s.longestStretchMinutes).toBe(0);
  });

  it('reports the longest stretch worked', () => {
    expect(breakStats([log('micro', 'taken', 22), log('micro', 'taken', 47)]).longestStretchMinutes).toBe(47);
  });

  it('does not let unacknowledged posture nudges flatter the score', () => {
    const s = breakStats([log('micro', 'skipped'), log('posture', 'taken'), log('posture', 'taken')]);
    // The posture toasts are recorded, but only the micro break is scored.
    expect(s.byKind.posture.taken).toBe(2);
    expect(s.taken).toBe(0);
    expect(s.compliancePct).toBe(0);
    expect(s.eyeCareScore).toBe(0);
  });
});

describe('suggestLongerInterval', () => {
  const skipped = (kind: BreakLog['kind'], n: number): BreakLog[] =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), date: '2026-09-28', at: '', kind, action: 'skipped' as const, workedMinutes: 20, seconds: 20 }));

  it('suggests a longer gap after five skips of that kind in a row', () => {
    expect(suggestLongerInterval(skipped('micro', 5), 'micro', 20)).toBe(35);
  });

  it('ignores skips of a different kind', () => {
    expect(suggestLongerInterval(skipped('long', 5), 'micro', 20)).toBeNull();
  });

  it('says nothing until there are five', () => {
    expect(suggestLongerInterval(skipped('micro', 4), 'micro', 20)).toBeNull();
  });

  it('stops suggesting once the gap is already long', () => {
    expect(suggestLongerInterval(skipped('micro', 5), 'micro', 90)).toBeNull();
  });

  it('resets once a break of that kind is taken', () => {
    const logs = [...skipped('micro', 5), { id: 'x', date: '2026-09-28', at: '', kind: 'micro' as const, action: 'taken' as const, workedMinutes: 20, seconds: 20 }];
    expect(suggestLongerInterval(logs, 'micro', 20)).toBeNull();
  });
});

describe('inQuiet', () => {
  it('handles a window that wraps midnight', () => {
    expect(inQuiet(23, 22, 7)).toBe(true);
    expect(inQuiet(3, 22, 7)).toBe(true);
    expect(inQuiet(12, 22, 7)).toBe(false);
  });

  it('is never quiet when the window is empty', () => {
    expect(inQuiet(5, 7, 7)).toBe(false);
  });
});

describe('inWindow', () => {
  it('handles a plain window, a wrapping one, and an empty one', () => {
    expect(inWindow(10, 9, 18)).toBe(true);
    expect(inWindow(20, 9, 18)).toBe(false);
    expect(inWindow(23, 22, 6)).toBe(true);
    expect(inWindow(3, 22, 6)).toBe(true);
    expect(inWindow(12, 22, 6)).toBe(false);
    expect(inWindow(5, 9, 9)).toBe(true);
  });
});
