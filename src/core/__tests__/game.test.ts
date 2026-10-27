import { describe, expect, it } from 'vitest';
import { badges, climbTrail, level, nextWin, weeklyChallenge, xp, type GameInput } from '../game';
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
  // The record streak, as the store works it out (full days eaten at or above the safe minimum), and its best run.
  streakDays: 7,
  bestStreakDays: 7,
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

  it('counts the streak by the record, the one the streak tile shows, never by days with any meal', () => {
    // Seven days with meals, but only two full days at or above the safe minimum in a row and three at best.
    const short = { ...base, streakDays: 2, bestStreakDays: 3 };
    const b = Object.fromEntries(badges(short).map((x) => [x.key, x]));
    expect(b.streak_7.earned).toBe(false);
    expect([b.streak_7.n, b.streak_30.n]).toEqual([2, 2]);
    expect(xp(short)).toBe(xp(base) - 5 * 5);
    // A run of seven earlier in the window has earned it, though today's run is shorter; today's run is what the next badge counts.
    const earlier = Object.fromEntries(badges({ ...base, streakDays: 2, bestStreakDays: 8 }).map((x) => [x.key, x]));
    expect(earlier.streak_7).toMatchObject({ earned: true, progress: 1 });
    expect(earlier.streak_30).toMatchObject({ earned: false, n: 2 });
  });

  it('keeps a badge already earned: one celebrated stays earned, under the record streak and after a kilo comes back', () => {
    const now = { ...base, streakDays: 0, bestStreakDays: 0, weights: [...base.weights, { date: d(-1), kg: 98.5 }] };
    const before = Object.fromEntries(badges(now).map((x) => [x.key, x]));
    expect([before.streak_7.earned, before.kg_1.earned]).toEqual([false, false]);
    const kept = Object.fromEntries(badges({ ...now, celebrated: ['badge:streak_7', 'badge:kg_1'] }).map((x) => [x.key, x]));
    expect(kept.streak_7).toMatchObject({ earned: true, progress: 1, n: 0 });
    expect(kept.kg_1).toMatchObject({ earned: true, progress: 1 });
    expect(kept.streak_30.earned).toBe(false);
  });

  it('celebrates no streak on a meal save that makes seven days with meals but not seven full days in a row', () => {
    const challenge = weeklyChallenge(base);
    const earned = (input: typeof base) => badges(input).filter((b) => b.earned).map((b) => b.key);
    const seen = ['badge:first_meal', 'badge:first_weigh', 'badge:weigh_4', 'badge:kg_1'];
    expect(nextWin({ earned: earned({ ...base, streakDays: 6, bestStreakDays: 6 }), level: 'base', challenge, celebrated: seen }).next).toBeNull();
    expect(nextWin({ earned: earned(base), level: 'base', challenge, celebrated: seen }).next?.id).toBe('badge:streak_7');
  });

  it('celebrates each win once, and does not flood the first time', () => {
    const challenge = weeklyChallenge(base);
    const first = nextWin({ earned: ['first_meal', 'streak_7'], level: 'base', challenge, celebrated: undefined });
    expect(first.next).toBeNull();
    expect(first.seed).toEqual(['badge:first_meal', 'badge:streak_7']);
    const later = nextWin({ earned: ['first_meal', 'streak_7', 'kg_1'], level: 'camp1', challenge, celebrated: first.seed });
    expect(later.next).toEqual({ id: 'level:camp1', kind: 'level', key: 'camp1' });
    const after = nextWin({ earned: ['first_meal', 'streak_7', 'kg_1'], level: 'camp1', challenge, celebrated: [...first.seed!, 'level:camp1'] });
    expect(after.next?.id).toBe('badge:kg_1');
    const done = { ...challenge, done: true };
    const all = nextWin({ earned: [], level: 'base', challenge: done, celebrated: [] });
    expect(all.next?.id).toBe(`challenge:${challenge.weekStart}`);
  });

  it('waits while the add sheet is open, its "Save as my meal?" too, and celebrates once it has closed; a first run still seeds quietly', () => {
    const challenge = weeklyChallenge(base);
    const win = { earned: ['first_meal'], level: 'base' as const, challenge, celebrated: [] as string[] };
    expect(nextWin({ ...win, waiting: true })).toEqual({ seed: null, next: null });
    expect(nextWin({ ...win, waiting: false }).next?.id).toBe('badge:first_meal');
    expect(nextWin({ ...win, celebrated: null, waiting: true }).seed).toEqual(['badge:first_meal']);
  });
});

