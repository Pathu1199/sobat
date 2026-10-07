import { describe, expect, it } from 'vitest';
import { badges, climbTrail, level, weeklyChallenge, xp, type GameInput } from '../game';
import type { Meal } from '../types';

const TODAY = '2026-10-07'; // a Wednesday
const meal = (date: string, kcal = 1500): Meal => ({ id: date + kcal, at: `${date}T13:00:00`, date, type: 'lunch', items: [], kcal, protein: 20 });
const d = (n: number) => {
  const x = new Date(TODAY + 'T12:00:00');
  x.setDate(x.getDate() - n);
  return x.toISOString().slice(0, 10);
};

const base: GameInput = {
  today: TODAY,
  meals: [0, 1, 2, 3, 4, 5, 6].map((n) => meal(d(n))),
  water: [{ id: 'w', at: '', date: TODAY, ml: 3000 }],
  weights: [
    { date: d(21), kg: 98 },
    { date: d(14), kg: 97.2 },
    { date: d(7), kg: 96.6 },
    { date: d(0), kg: 96 },
  ],
  sleep: [],
  steps: [],
  workouts: [],
  kcalTarget: 1800,
  waterGoalMl: 3000,
  startKg: 98,
  goalKg: 88,
};

describe('game', () => {
  it('scores points and places them on a level', () => {
    const points = xp(base);
    // 7 meals, 1 water day, 4 weigh-ins, 7-day streak
    expect(points).toBe(7 * 10 + 15 + 4 * 25 + 7 * 5);
    const l = level(points);
    expect(l.key).toBe('base');
    expect(l.next).toBe(300);
    expect(level(950).key).toBe('camp2');
    expect(level(99999).next).toBeNull();
  });

  it('earns the firsts and the 7-day streak, not the 30', () => {
    const b = Object.fromEntries(badges(base).map((x) => [x.key, x]));
    expect(b.first_meal.earned).toBe(true);
    expect(b.first_weigh.earned).toBe(true);
    expect(b.streak_7.earned).toBe(true);
    expect(b.streak_30.earned).toBe(false);
    expect(b.streak_30.progress).toBeCloseTo(7 / 30);
    expect(b.weigh_4.earned).toBe(true);
    expect(b.kg_1.earned).toBe(true);
    expect(b.kg_5.earned).toBe(false);
    expect(b.halfway.n).toBe(20);
  });

  it('picks one challenge for the week and counts only this week', () => {
    const c = weeklyChallenge(base);
    expect(c.daysLeft).toBe(3); // Wed → Sat, week starting Sunday
    expect(c.target).toBeGreaterThan(0);
    const next = weeklyChallenge({ ...base, today: '2026-10-14' });
    expect(next.key).not.toBe(c.key);
    const same = weeklyChallenge({ ...base, today: '2026-10-09' });
    expect(same.key).toBe(c.key);
  });

  it('lays the weigh-ins along the climb', () => {
    const trail = climbTrail(base.weights, 98, 88);
    expect(trail.map((t) => t.p)).toEqual([0, 0.08, 0.14, 0.2]);
    expect(climbTrail(base.weights, 88, 98)).toEqual([]);
  });
});
