import { describe, expect, it } from 'vitest';
import type { Meal } from '../types';
import { weekSummary } from '../week';

const TODAY = '2026-10-07';
const meal = (date: string, kcal: number): Meal => ({ id: date + kcal, at: `${date}T13:00:00`, date, type: 'lunch', items: [], kcal, protein: 10 });

describe('weekSummary', () => {
  it('bands each day against the target and counts the week', () => {
    const s = weekSummary({
      today: TODAY,
      meals: [meal('2026-10-07', 1700), meal('2026-10-06', 2300), meal('2026-10-05', 1950), meal('2026-10-04', 900)],
      water: [{ id: 'w', at: '', date: '2026-10-07', ml: 3000 }],
      sleep: [{ date: '2026-10-07', bed: '23:00', wake: '06:30', quality: 4, wakeups: 0, energy: 4, minutes: 450, score: 80 }],
      steps: [{ date: '2026-10-07', count: 5000 }],
      weights: [{ date: '2026-09-29', kg: 96 }, { date: '2026-10-05', kg: 95.2 }],
      kcalTarget: 1800,
      waterGoalMl: 3000,
    });
    expect(s.days).toHaveLength(7);
    expect(s.days[6].date).toBe(TODAY);
    expect(s.days.map((d) => d.kcalBand)).toEqual(['none', 'none', 'none', 'under', 'on', 'heavy', 'on']);
    expect(s.loggedDays).toBe(4);
    expect(s.onTargetDays).toBe(3);
    expect(s.heavyDays).toBe(1);
    expect(s.waterGoalDays).toBe(1);
    expect(s.avgKcal).toBe(Math.round((1700 + 2300 + 1950 + 900) / 4));
    expect(s.avgSleepMinutes).toBe(450);
    expect(s.weighIns).toBe(1);
    expect(s.weightChange).toBe(-0.8);
  });

  it('is calm about an empty week', () => {
    const s = weekSummary({ today: TODAY, meals: [], water: [], sleep: [], steps: [], weights: [], kcalTarget: 1800, waterGoalMl: 3000 });
    expect(s.loggedDays).toBe(0);
    expect(s.avgKcal).toBe(0);
    expect(s.avgSleepMinutes).toBeNull();
    expect(s.weightChange).toBeNull();
  });
});
