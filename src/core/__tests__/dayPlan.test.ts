import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { dayPlan, fullDayPlan } from '../dayPlan';
import type { FoodItem } from '../types';

const foods = foodsJson as FoodItem[];

describe('dayPlan', () => {
  it('splits what is left across the meals still to come and keeps each plate within budget', () => {
    const p = dayPlan({ remaining: 980, hour: 14, loggedTypes: ['breakfast'], foods, avoided: new Set() });
    expect(p.stop).toBe(false);
    expect(p.now).toBe('lunch');
    expect(p.slots.map((s) => s.type)).toEqual(['lunch', 'snack', 'dinner']);
    const budgets = p.slots.reduce((a, s) => a + s.budget, 0);
    expect(Math.abs(budgets - 980)).toBeLessThanOrEqual(2);
    for (const s of p.slots) {
      expect(s.picks.length).toBeGreaterThan(0);
      expect(s.kcal).toBeLessThanOrEqual(s.budget);
      expect(new Set(s.picks.map((x) => x.food.id)).size).toBe(s.picks.length);
    }
  });

  it('says stop when almost nothing is left, and never suggests the avoided', () => {
    expect(dayPlan({ remaining: 40, hour: 20, loggedTypes: [], foods, avoided: new Set() }).stop).toBe(true);
    const all = dayPlan({ remaining: 1200, hour: 9, loggedTypes: [], foods, avoided: new Set(['poha']) });
    expect(all.slots.flatMap((s) => s.picks).some((p) => p.food.id === 'poha')).toBe(false);
  });

  it('puts the routine bhaji first and reshuffles the rest with the seed', () => {
    const veg = foods.find((f) => f.category === 'veg')!;
    const a = dayPlan({ remaining: 1000, hour: 12, loggedTypes: [], foods, avoided: new Set(), preferred: [veg.id] });
    expect(a.slots[0].picks[0].food.id).toBe(veg.id);
    const b = dayPlan({ remaining: 1000, hour: 12, loggedTypes: [], foods, avoided: new Set(), seed: 3 });
    const c = dayPlan({ remaining: 1000, hour: 12, loggedTypes: [], foods, avoided: new Set(), seed: 4 });
    expect(b.slots[0].picks.map((p) => p.food.id)).not.toEqual(c.slots[0].picks.map((p) => p.food.id));
  });

  it('offers lighter swaps and a full-day sheet with all four meals', () => {
    const full = fullDayPlan({ remaining: 1700, foods, avoided: new Set() });
    expect(full.slots.map((s) => s.type)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    const withAlts = full.slots.flatMap((s) => s.picks).filter((p) => (p.alts?.length ?? 0) > 0);
    expect(withAlts.length).toBeGreaterThan(0);
    for (const p of withAlts) for (const a of p.alts!) expect(a.kcal).toBeLessThanOrEqual(p.kcal);
  });
});
