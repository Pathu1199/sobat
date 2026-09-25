import { describe, expect, it } from 'vitest';
import { findPatterns, scoreDay, streak, weightTrend } from '../insights';
import { lastNDates } from '../date';
import type { Meal, MoodLog, SleepLog, WorkoutLog } from '../types';

describe('scoreDay', () => {
  const b = { date: '2026-09-25', kcalTarget: 1800, waterGoalMl: 3000, workedOut: true, workoutMinutes: 40 };

  it('peaks when you hit the target exactly', () => {
    const s = scoreDay({ ...b, kcal: 1800, waterMl: 3000, sleepScore: 100, moodScore: 5 });
    expect(s.eating).toBe(100);
    expect(s.total).toBe(100);
  });

  it('punishes overeating harder than undereating', () => {
    const over = scoreDay({ ...b, kcal: 2340, waterMl: 0 }).eating;
    const under = scoreDay({ ...b, kcal: 1260, waterMl: 0 }).eating;
    expect(over).toBeLessThan(under);
  });

  it('gives zero for an unlogged day', () => {
    expect(scoreDay({ ...b, kcal: 0, waterMl: 0 }).eating).toBe(0);
  });
});

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
  it('compares 7-day averages rather than single days', () => {
    const logs = lastNDates(14, '2026-09-25').map((date, i) => ({ date, kg: 100 - i * 0.1 }));
    const t = weightTrend(logs)!;
    expect(t.change7).toBeLessThan(0);
  });

  it('returns null with no data', () => {
    expect(weightTrend([])).toBeNull();
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
    expect(p.some((x) => x.key === 'sleep_vs_kcal')).toBe(true);
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
    expect(p.some((x) => x.key === 'snack_hour')).toBe(true);
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
    expect(p.some((x) => x.key === 'move_vs_mood')).toBe(true);
  });

  it('finds nothing in an empty log', () => {
    expect(findPatterns({ meals: [], sleep: [], moods: [], workouts: [], kcalTarget: 1800 })).toHaveLength(0);
  });
});
