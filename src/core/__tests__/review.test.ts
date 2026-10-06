import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE } from '../routine';
import { journey, journeyFacts, wasHeavy, wins } from '../review';
import type { Plan } from '../plan';
import type { Meal } from '../types';

const TODAY = '2026-10-06';
const meal = (date: string, kcal: number, protein = 20, hour = 13, type: Meal['type'] = 'lunch', foodId?: string): Meal => ({
  id: `${date}-${hour}`,
  at: `${date}T${String(hour).padStart(2, '0')}:00:00`,
  date,
  type,
  items: [{ foodId, name_en: foodId ?? 'x', name_mr: '', grams: 100, kcal, protein, carbs: 10, fat: 2, estimated: false }],
  kcal,
  protein,
});
const plan = { startKg: 98, currentKg: 95, goalKg: 80, lostKg: 3, toGoKg: 15, targetRate: 0.5, actualRate: 0.2 } as unknown as Plan;

describe('journey', () => {
  it('counts logged, over and heavy days and the slips that explain a stall', () => {
    const meals = [meal('2026-10-05', 2600), meal('2026-10-04', 1900), meal('2026-10-03', 1500), meal('2026-10-02', 1600, 20, 22, 'dinner'), meal('2026-10-01', 300, 5, 17, 'snack', 'cashews')];
    const j = journey({ today: TODAY, meals, water: [], sleep: [], workouts: [], weights: [{ date: '2026-10-04', kg: 95 }], kcalTarget: 1800, proteinTarget: 110, waterGoalMl: 3000, avoid: DEFAULT_ROUTINE.avoid, plan });
    expect(j.loggedDays).toBe(5);
    expect(j.overDays).toBe(2);
    expect(j.heavyDays).toBe(1);
    expect(j.lateDinners).toBe(1);
    expect(j.avoidSlips).toBe(1);
    expect(j.weighIns).toBe(1);
    expect(j.avgSleepMin).toBeNull();
    const facts = journeyFacts(j, { kcalTarget: 1800, proteinTarget: 110, waterGoalMl: 3000, plan }).join('\n');
    expect(facts).toContain('over target on 2 days');
    expect(facts).toContain('Logging is patchy');
    expect(facts).toContain('real pace 0.2 kg/week');
  });
});

describe('wasHeavy', () => {
  it('is a day more than a fifth over target', () => {
    expect(wasHeavy([meal('2026-10-05', 2200)], '2026-10-05', 1800)).toBe(true);
    expect(wasHeavy([meal('2026-10-05', 2100)], '2026-10-05', 1800)).toBe(false);
    expect(wasHeavy([], '2026-10-05', 1800)).toBe(false);
  });
});

describe('wins', () => {
  it('rewards behaviour, not the scale', () => {
    const water = ['2026-10-05', '2026-10-04'].flatMap((date) => [1, 2, 3].map((i) => ({ id: `${date}${i}`, at: '', date, ml: 1000 })));
    const w = wins({ today: TODAY, meals: [], water, weights: [{ date: '2026-10-05', kg: 95 }], workouts: [], waterGoalMl: 3000, streakDays: 5 });
    expect(w.map((x) => x.key)).toEqual(['streak', 'water_days', 'weighed']);
    expect(wins({ today: TODAY, meals: [], water: [], weights: [], workouts: [], waterGoalMl: 3000, streakDays: 1 })).toEqual([]);
  });
});
