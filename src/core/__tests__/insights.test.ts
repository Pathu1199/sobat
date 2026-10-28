import { describe, expect, it } from 'vitest';
import { breakStreak, findPatterns, streak, weightTrend } from '../insights';
import { lastNDates } from '../date';
import type { BreakLog } from '../breaks';
import type { Meal, MoodLog, SleepLog, WorkoutLog } from '../types';

describe('streak', () => {
  it('counts back from today only', () => {
    const dates = lastNDates(5, '2026-09-25');
    const logged = new Set([dates[0], dates[2], dates[3], dates[4]]);
    expect(streak(dates, (d) => logged.has(d))).toBe(3);
  });

  it('is zero when today is missing', () => {
    const dates = lastNDates(3, '2026-09-25');
    expect(streak(dates, (d) => d !== dates[2])).toBe(0);
  });
});

describe('weightTrend', () => {
  it('compares 7-day windows rather than single days', () => {
    // A tenth of a kilo less every day for two weeks: each window, later days counting more, averages its eleventh and
    // its fourth day, 98.9 and 99.6, so the week took off exactly 0.7.
    const logs = lastNDates(14, '2026-09-25').map((date, i) => ({ date, kg: Math.round((100 - i * 0.1) * 10) / 10 }));
    const t = weightTrend(logs, '2026-09-25')!;
    expect(t.current).toBe(98.9);
    expect(t.change7).toBe(-0.7);
    expect(t.span7).toBe(7);
    expect(t.asOf).toBe('2026-09-25');
  });

  it('returns null with no weigh-in on or before today', () => {
    expect(weightTrend([], '2026-09-25')).toBeNull();
    expect(weightTrend([{ date: '2026-09-30', kg: 80 }], '2026-09-25')).toBeNull();
  });

  it('an old weigh-in never stands in for this week, however many there are', () => {
    const old = Array.from({ length: 20 }, () => ({ date: '2026-09-01', kg: 90 }));
    expect(weightTrend([...old, { date: '2026-09-25', kg: 80 }], '2026-09-25')!.current).toBe(80);
  });

  it('counts days, not weigh-ins: several on one day count as that day once', () => {
    // Three weigh-ins on the window's last day are one day at 79, beside one at 80 six days before: (80 + 7 × 79) / 8.
    const burst = [{ date: '2026-09-19', kg: 80 }, { date: '2026-09-25', kg: 79.2 }, { date: '2026-09-25', kg: 78.8 }, { date: '2026-09-25', kg: 79 }];
    expect(weightTrend(burst, '2026-09-25')!.current).toBe(79.1);
  });

  it('weighs the later days of the window more', () => {
    // Six days back counts once, today seven times: (80 + 7 × 79) / 8 = 79.125.
    expect(weightTrend([{ date: '2026-09-19', kg: 80 }, { date: '2026-09-25', kg: 79 }], '2026-09-25')!.current).toBe(79.1);
  });

  it('gives the change over three weeks, the window ending at the latest weigh-in', () => {
    const t = weightTrend([{ date: '2026-09-01', kg: 82 }, { date: '2026-09-22', kg: 79 }, { date: '2026-10-30', kg: 70 }], '2026-09-25')!;
    expect(t.current).toBe(79);
    expect(t.change21).toBe(-3);
    expect(t.change7).toBeNull();
    expect(t.asOf).toBe('2026-09-22');
  });

  it('shows the changes to someone who weighs in every fortnight', () => {
    const logs = [
      { date: '2026-08-14', kg: 84 },
      { date: '2026-08-28', kg: 83 },
      { date: '2026-09-11', kg: 82 },
      { date: '2026-09-25', kg: 81 },
    ];
    const t = weightTrend(logs, '2026-09-26')!;
    expect(t.current).toBe(81);
    // A week back the latest weigh-in is the one a fortnight before, three weeks back the one four weeks before, thirty
    // days back the one six weeks before.
    expect([t.change7, t.change21, t.change30]).toEqual([-1, -2, -3]);
    // Each says how far apart the weigh-ins it compares really are: two, four and six weeks, never the 7, 21 and 30 asked.
    expect([t.span7, t.span21, t.span30]).toEqual([14, 28, 42]);
    expect(t.asOf).toBe('2026-09-25');
  });

  it('shows the changes to someone who weighs in every ten days', () => {
    const logs = [
      { date: '2026-08-26', kg: 83 },
      { date: '2026-09-05', kg: 82.5 },
      { date: '2026-09-15', kg: 82 },
      { date: '2026-09-25', kg: 81.5 },
    ];
    const t = weightTrend(logs, '2026-09-25')!;
    // A week back: the weigh-in ten days before; three weeks and thirty days back: the one thirty days before.
    expect([t.change7, t.change21, t.change30]).toEqual([-0.5, -1.5, -1.5]);
    expect([t.span7, t.span21, t.span30]).toEqual([10, 30, 30]);
  });

  it('bridges a missed week, but never calls a change over months one over a week', () => {
    // Weekly, then a week missed: the week's change reaches back to the weigh-in two weeks before.
    const missed = [
      { date: '2026-09-04', kg: 82 },
      { date: '2026-09-11', kg: 81.5 },
      { date: '2026-09-25', kg: 80.5 },
    ];
    expect(weightTrend(missed, '2026-09-25')!.change7).toBe(-1);
    // Two months without a weigh-in: no change over a week or three, and the weigh-in it has is old (asOf says when).
    const gap = [
      { date: '2026-07-01', kg: 85 },
      { date: '2026-09-01', kg: 82 },
    ];
    const t = weightTrend(gap, '2026-10-20')!;
    expect([t.change7, t.change21, t.change30]).toEqual([null, null, null]);
    expect([t.span7, t.span21, t.span30]).toEqual([null, null, null]);
    expect(t.asOf).toBe('2026-09-01');
  });
});

describe('findPatterns', () => {
  it('spots more eating after short sleep', () => {
    const sleep: SleepLog[] = [
      { date: '2026-09-20', bed: '02:00', wake: '06:00', quality: 2, wakeups: 1, energy: 2, minutes: 240, score: 30 },
      { date: '2026-09-22', bed: '02:00', wake: '06:00', quality: 2, wakeups: 1, energy: 2, minutes: 240, score: 30 },
      { date: '2026-09-18', bed: '23:00', wake: '07:00', quality: 4, wakeups: 0, energy: 4, minutes: 480, score: 85 },
      { date: '2026-09-19', bed: '23:00', wake: '07:00', quality: 4, wakeups: 0, energy: 4, minutes: 480, score: 85 },
    ];
    const meals: Meal[] = [
      { id: '1', at: '2026-09-21T13:00', date: '2026-09-21', type: 'lunch', items: [], kcal: 2600, protein: 60 },
      { id: '2', at: '2026-09-23T13:00', date: '2026-09-23', type: 'lunch', items: [], kcal: 2500, protein: 60 },
      { id: '3', at: '2026-09-19T13:00', date: '2026-09-19', type: 'lunch', items: [], kcal: 1700, protein: 60 },
      { id: '4', at: '2026-09-20T13:00', date: '2026-09-20', type: 'lunch', items: [], kcal: 1750, protein: 60 },
    ];
    const p = findPatterns({ meals, sleep, moods: [], workouts: [], kcalTarget: 1800 });
    const hit = p.find((x) => x.key === 'sleep_vs_kcal');
    expect(hit).toBeDefined();
    expect(String(hit!.params.diff)).toMatch(/^\+\d+$/);
  });

  it('spots a repeated snack hour', () => {
    const meals: Meal[] = ['2026-09-21', '2026-09-22', '2026-09-23'].map((d, i) => ({
      id: String(i),
      at: `${d}T16:30`,
      date: d,
      type: 'snack' as const,
      items: [],
      kcal: 300,
      protein: 5,
    }));
    const p = findPatterns({ meals, sleep: [], moods: [], workouts: [], kcalTarget: 1800 });
    const hit = p.find((x) => x.key === 'snack_hour');
    expect(hit).toBeDefined();
    expect(hit!.params).toEqual({ h: 16, n: 3 });
  });

  it('spots better mood on workout days', () => {
    const workouts: WorkoutLog[] = ['2026-09-21', '2026-09-22', '2026-09-23'].map((d) => ({ id: d, date: d, exerciseIds: [], minutes: 30, status: 'done' as const }));
    const moods: MoodLog[] = [
      { id: '1', at: '', date: '2026-09-21', score: 5 },
      { id: '2', at: '', date: '2026-09-22', score: 5 },
      { id: '3', at: '', date: '2026-09-23', score: 4 },
      { id: '4', at: '', date: '2026-09-24', score: 2 },
      { id: '5', at: '', date: '2026-09-25', score: 2 },
    ];
    const p = findPatterns({ meals: [], sleep: [], moods, workouts, kcalTarget: 1800 });
    const hit = p.find((x) => x.key === 'move_vs_mood');
    expect(hit).toBeDefined();
    expect(hit!.params.d).toBe('1.1');
  });

  it('finds nothing in an empty log', () => {
    expect(findPatterns({ meals: [], sleep: [], moods: [], workouts: [], kcalTarget: 1800 })).toHaveLength(0);
  });
});

describe('breakStreak', () => {
  const day = (date: string, taken: number, skipped: number): BreakLog[] => [
    ...Array.from({ length: taken }, (_, i) => ({ id: `t${date}${i}`, date, at: '', kind: 'micro' as const, action: 'taken' as const, workedMinutes: 20, seconds: 20 })),
    ...Array.from({ length: skipped }, (_, i) => ({ id: `s${date}${i}`, date, at: '', kind: 'micro' as const, action: 'skipped' as const, workedMinutes: 20, seconds: 20 })),
  ];

  it('counts back from today while compliance holds at 70 percent', () => {
    const dates = lastNDates(4, '2026-09-28');
    const logs = [...day(dates[3], 8, 2), ...day(dates[2], 7, 3), ...day(dates[1], 5, 5), ...day(dates[0], 9, 1)];
    // Today 80%, yesterday 70%, the day before 50% stops it.
    expect(breakStreak(logs, dates)).toBe(2);
  });

  it('is zero when today falls short', () => {
    const dates = lastNDates(2, '2026-09-28');
    expect(breakStreak([...day(dates[1], 1, 9), ...day(dates[0], 10, 0)], dates)).toBe(0);
  });

  it('is zero when nothing was logged today', () => {
    const dates = lastNDates(2, '2026-09-28');
    expect(breakStreak(day(dates[0], 10, 0), dates)).toBe(0);
  });
});
