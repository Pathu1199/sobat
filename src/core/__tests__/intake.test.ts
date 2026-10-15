import { describe, expect, it } from 'vitest';
import { intakeFact, lowIntake } from '../intake';
import type { Meal } from '../types';

const meal = (date: string, kcal: number, n = 0): Meal => ({ id: `${date}-${n}`, at: `${date}T12:00:00.000Z`, date, type: 'lunch', items: [], kcal, protein: 0 });
/** A day with two meals, so it counts. */
const day = (date: string, kcal: number) => [meal(date, kcal / 2, 0), meal(date, kcal / 2, 1)];
const base = { today: '2026-10-12', target: 1600, floor: 1500, offDays: [] as number[] };

describe('lowIntake', () => {
  it('averages the last three counted days and speaks when they sit below the line', () => {
    const meals = [...day('2026-10-11', 1200), ...day('2026-10-10', 1100), ...day('2026-10-09', 1300), ...day('2026-10-08', 2000)];
    expect(lowIntake({ ...base, meals })).toEqual({ avg: 1200, limit: 1500, days: 3 });
  });

  it('is quiet with fewer than three counted days, above the line, and ignores half-logged days, off days and today', () => {
    expect(lowIntake({ ...base, meals: [...day('2026-10-11', 1000), ...day('2026-10-10', 1000)] })).toBeNull();
    expect(lowIntake({ ...base, meals: [...day('2026-10-11', 1550), ...day('2026-10-10', 1600), ...day('2026-10-09', 1500)] })).toBeNull();
    const halfLogged = [meal('2026-10-11', 300), ...day('2026-10-10', 1000), ...day('2026-10-09', 1000), ...day('2026-10-08', 1000)];
    expect(lowIntake({ ...base, meals: halfLogged })).toEqual({ avg: 1000, limit: 1500, days: 3 });
    // 2026-10-11 is a Sunday: an off day does not count against anyone.
    expect(lowIntake({ ...base, offDays: [0], meals: [...day('2026-10-11', 500), ...day('2026-10-10', 1000), ...day('2026-10-09', 1000)] })).toBeNull();
    expect(lowIntake({ ...base, meals: [...day('2026-10-12', 200), ...day('2026-10-10', 1000), ...day('2026-10-09', 1000)] })).toBeNull();
  });

  it('uses the higher of the floor and 85 percent of the target as the line', () => {
    const meals = [...day('2026-10-11', 1700), ...day('2026-10-10', 1700), ...day('2026-10-09', 1700)];
    expect(lowIntake({ ...base, target: 2200, meals })).toEqual({ avg: 1700, limit: 1870, days: 3 });
  });

  it('writes one plain sentence for the model, or nothing', () => {
    expect(intakeFact({ avg: 1200, limit: 1500, days: 3 })).toBe('Their last 3 logged days averaged 1200 kcal, under the 1500 kcal line; cravings are expected. Encourage eating the plan in full, never less.');
    expect(intakeFact(null)).toBeNull();
  });
});
