import { describe, expect, it } from 'vitest';
import { coachAdvice, type CoachInput } from '../coach';
import type { Budget } from '../nutrition';
import type { Meal } from '../types';

const TODAY = '2026-10-08';
const meal = (type: Meal['type'], hour: number, kcal: number): Meal => ({ id: type + hour, at: `${TODAY}T${String(hour).padStart(2, '0')}:00:00`, date: TODAY, type, items: [], kcal, protein: 15 });
const budget = (consumed: number, target = 1700): Budget => ({ target, consumed, remaining: target - consumed, perMeal: 500, mealsLeft: 2, proteinTarget: 110, proteinConsumed: 20, proteinLeft: 90, pct: consumed / target });

const base: CoachInput = {
  today: TODAY,
  hour: 13,
  minute: 30,
  budget: budget(400),
  meals: [meal('breakfast', 8, 400)],
  water: [{ id: 'w', at: '', date: TODAY, ml: 1500 }],
  sleep: [{ date: TODAY, bed: '23:00', wake: '06:30', quality: 4, wakeups: 0, energy: 4, minutes: 450, score: 80 }],
  weights: [{ date: '2026-10-04', kg: 95.8 }],
  steps: 4000,
  waterGoalMl: 3000,
  weighDay: 0,
  kcalTarget: 1700,
  streakDays: 2,
  nextPlate: { type: 'lunch', budget: 600, kcal: 580, names: ['Palak bhaji', 'Chapati', 'Dal'] },
};

describe('coachAdvice', () => {
  it('names the meal that is on, with its plate and budget', () => {
    const a = coachAdvice(base);
    expect(a[0].key).toBe('coach_meal_plate');
    expect(a[0].params.meal).toBe('lunch');
    expect(a[0].params.kcal).toBe(600);
    expect(a[0].action).toBe('plan');
  });

  it('says stop when the day is spent, and asks for water when behind', () => {
    const a = coachAdvice({ ...base, hour: 19, budget: budget(1680), water: [] });
    expect(a.find((x) => x.key === 'coach_stop')).toBeTruthy();
    const water = a.find((x) => x.key === 'coach_water');
    expect(water?.urgency).toBe('now');
  });

  it('asks for the first log, a walk, the weigh-in and the morning check-in at the right hours', () => {
    const morning = coachAdvice({ ...base, hour: 8, meals: [], sleep: [], weights: [{ date: '2026-09-27', kg: 96 }], today: '2026-10-11' /* a Sunday */ });
    expect(morning.map((x) => x.key)).toEqual(expect.arrayContaining(['coach_sleep_checkin', 'coach_weigh']));
    const afternoon = coachAdvice({ ...base, hour: 17, steps: 1200, meals: [meal('breakfast', 8, 400), meal('lunch', 13, 600)], budget: budget(1000) });
    expect(afternoon.map((x) => x.key)).toContain('coach_walk');
    const noon = coachAdvice({ ...base, hour: 14, meals: [], budget: budget(0) });
    expect(noon[0].key).toBe('coach_log_first');
    expect(noon[0].urgency).toBe('now');
  });

  it('orders by urgency', () => {
    const a = coachAdvice({ ...base, hour: 19, budget: budget(1680), water: [] });
    const order = a.map((x) => x.urgency);
    const rank = { now: 0, soon: 1, note: 2 };
    for (let i = 1; i < order.length; i++) expect(rank[order[i]]).toBeGreaterThanOrEqual(rank[order[i - 1]]);
  });
});
