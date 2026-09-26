import { describe, expect, it } from 'vitest';
import { biggestLever, findPatterns, scoreDay, streak, weightTrend } from '../insights';
import { lastNDates } from '../date';
import { expectedKcalByHour } from '../nutrition';
import type { Meal, MoodLog, SleepLog, WorkoutLog } from '../types';

describe('scoreDay', () => {
  const b = { date: '2026-09-25', kcalTarget: 1800, waterGoalMl: 3000, workedOut: true, workoutMinutes: 40 };

  it('peaks when you hit the target exactly', () => {
    const s = scoreDay({ ...b, kcal: 1800, waterMl: 3000, sleepScore: 100, moodScore: 5 });
    expect(s.eating).toBe(100);
    expect(s.total).toBe(100);
  });

  it('punishes overeating harder than undereating', () => {
    const over = scoreDay({ ...b, kcal: 2340, waterMl: 0 }).eating!;
    const under = scoreDay({ ...b, kcal: 1260, waterMl: 0 }).eating!;
    expect(over).toBeLessThan(under);
  });

  it('gives zero for a finished day with nothing logged', () => {
    expect(scoreDay({ ...b, kcal: 0, waterMl: 0 }).eating).toBe(0);
  });

  it('does not punish a day that is still running', () => {
    // 11am, breakfast only: that is on pace, not a failure.
    const s = scoreDay({ ...b, kcal: 450, waterMl: 750, hour: 11 });
    expect(s.eating).toBeGreaterThan(70);
  });

  it('shows nothing rather than zero before the first meal', () => {
    expect(scoreDay({ ...b, kcal: 0, waterMl: 0, hour: 9 }).eating).toBeNull();
  });

  it('still catches overeating early in the day', () => {
    const s = scoreDay({ ...b, kcal: 1700, waterMl: 0, hour: 11 });
    expect(s.eating!).toBeLessThan(30);
  });

  it('leaves sleep and mood unknown until they are logged', () => {
    const s = scoreDay({ ...b, kcal: 1800, waterMl: 3000 });
    expect(s.sleep).toBeNull();
    expect(s.mood).toBeNull();
    // The total averages only what is known, so a blank does not drag it down.
    expect(s.total).toBe(100);
  });

  it('shows movement as "later" at noon when nothing is done yet', () => {
    const s = scoreDay({ ...b, workedOut: false, workoutMinutes: 0, kcal: 500, waterMl: 1000, hour: 12 });
    expect(s.movement).toBeNull();
  });

  it('scores movement once a session is done, even at noon', () => {
    const s = scoreDay({ ...b, kcal: 500, waterMl: 1000, hour: 12 });
    expect(s.movement).toBe(100);
  });

  it('scores movement as zero after 18:00 with nothing done', () => {
    const s = scoreDay({ ...b, workedOut: false, workoutMinutes: 0, kcal: 500, waterMl: 1000, hour: 19 });
    expect(s.movement).toBe(0);
  });

  it('judges water against the pace so far, not the whole goal', () => {
    // Noon, 1.5 L drunk, 3 L goal. Half the goal at noon is on pace.
    const s = scoreDay({ ...b, kcal: 500, waterMl: 1500, hour: 12, expectedWaterMl: 1071 });
    expect(s.water).toBe(100);
    const late = scoreDay({ ...b, kcal: 1800, waterMl: 1500 });
    expect(late.water).toBe(50);
  });

  it('leaves water unknown before the pace window opens', () => {
    const s = scoreDay({ ...b, kcal: 0, waterMl: 0, hour: 6, expectedWaterMl: 0 });
    expect(s.water).toBeNull();
  });

  it('scores water part-way along the pace, not only at the cap', () => {
    const s = scoreDay({ ...b, kcal: 500, waterMl: 500, hour: 12, expectedWaterMl: 1000 });
    expect(s.water).toBe(50);
  });

  it('judges movement from 18:00 exactly', () => {
    const s = scoreDay({ ...b, workedOut: false, workoutMinutes: 0, kcal: 500, waterMl: 1000, hour: 18 });
    expect(s.movement).toBe(0);
  });
});

describe('expectedKcalByHour', () => {
  it('rises through the day and reaches the full target by night', () => {
    expect(expectedKcalByHour(1800, 4)).toBe(0);
    expect(expectedKcalByHour(1800, 6)).toBeLessThan(150);
    expect(expectedKcalByHour(1800, 11)).toBe(450);
    expect(expectedKcalByHour(1800, 16)).toBe(1080);
    expect(expectedKcalByHour(1800, 23)).toBe(1800);
  });

  it('never goes backwards', () => {
    let prev = -1;
    for (let h = 0; h <= 23; h++) {
      const v = expectedKcalByHour(1800, h);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
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

describe('biggestLever', () => {
  it('names the lowest known metric when it is dragging', () => {
    const s = scoreDay({ date: '2026-09-25', kcal: 1800, kcalTarget: 1800, waterMl: 600, waterGoalMl: 3000, workedOut: true, workoutMinutes: 40, sleepScore: 80, moodScore: 4 });
    expect(biggestLever(s)).toBe('water');
  });

  it('ignores metrics that are not known yet', () => {
    const s = scoreDay({ date: '2026-09-25', kcal: 450, kcalTarget: 1800, waterMl: 700, waterGoalMl: 3000, workedOut: false, workoutMinutes: 0, hour: 11, expectedWaterMl: 857 });
    // Movement is null at 11am; nothing else is below 60.
    expect(biggestLever(s)).toBeNull();
  });

  it('returns null when everything is fine', () => {
    const s = scoreDay({ date: '2026-09-25', kcal: 1800, kcalTarget: 1800, waterMl: 3000, waterGoalMl: 3000, workedOut: true, workoutMinutes: 40, sleepScore: 90, moodScore: 5 });
    expect(biggestLever(s)).toBeNull();
  });

  it('picks the true minimum when several metrics are low, and the earlier key on a tie', () => {
    const base = { date: '2026-09-25', kcalTarget: 1800, waterGoalMl: 3000, workedOut: true, workoutMinutes: 40 };
    const two = scoreDay({ ...base, kcal: 1800, waterMl: 900, sleepScore: 20, moodScore: 4 });
    expect(two.water).toBe(30);
    expect(biggestLever(two)).toBe('sleep');
    const tie = scoreDay({ ...base, kcal: 1800, waterMl: 600, sleepScore: 20, moodScore: 4 });
    expect(tie.water).toBe(20);
    expect(biggestLever(tie)).toBe('water');
  });
});
