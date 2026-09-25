import { describe, expect, it } from 'vitest';
import { decide } from '../decide';
import type { Budget } from '../nutrition';

function makeBudget(over: Partial<Budget> = {}): Budget {
  return {
    target: 1800,
    consumed: 900,
    remaining: 900,
    perMeal: 450,
    mealsLeft: 2,
    proteinTarget: 105,
    proteinConsumed: 50,
    proteinLeft: 55,
    pct: 50,
    ...over,
  };
}

const base = { hour: 14, waterMl: 1500, waterGoalMl: 3000, movedToday: true, lateMealDays: 0 };

describe('decide', () => {
  it('greets an empty day', () => {
    const d = decide({ ...base, budget: makeBudget({ consumed: 0, remaining: 1800, pct: 0 }) });
    expect(d.situation).toBe('day_start');
    expect(d.severity).toBe('good');
  });

  it('flags a normal day as on track', () => {
    const d = decide({ ...base, budget: makeBudget() });
    expect(d.situation).toBe('on_track');
  });

  it('acts when the budget is blown', () => {
    const d = decide({ ...base, hour: 19, budget: makeBudget({ consumed: 2000, remaining: -200, pct: 111, mealsLeft: 1 }) });
    expect(d.situation).toBe('over_budget');
    expect(d.severity).toBe('act');
    expect(d.actionKeys).toContain('light_dinner');
  });

  it('escalates past 120 percent but still feeds you', () => {
    const d = decide({ ...base, hour: 20, budget: makeBudget({ consumed: 2400, remaining: -600, pct: 133, mealsLeft: 1 }) });
    expect(d.situation).toBe('way_over');
    expect(d.nextMealMin).toBeGreaterThan(0);
    expect(d.actionKeys).toContain('no_fasting_tomorrow');
  });

  it('never suggests skipping a meal, even at the worst', () => {
    for (const consumed of [2000, 2500, 3000, 4000]) {
      const d = decide({ ...base, hour: 21, budget: makeBudget({ consumed, remaining: 1800 - consumed, mealsLeft: 1 }) });
      if (d.situation !== 'late_eating') expect(d.nextMealMin).toBeGreaterThanOrEqual(300);
    }
  });

  it('notices low protein in the evening', () => {
    const d = decide({ ...base, hour: 19, budget: makeBudget({ consumed: 1200, remaining: 600, proteinConsumed: 30 }) });
    expect(d.situation).toBe('protein_low');
    expect(d.actionKeys).toContain('add_dal');
  });

  it('notices under-eating at night', () => {
    const d = decide({ ...base, hour: 21, budget: makeBudget({ consumed: 600, remaining: 1200, mealsLeft: 1 }) });
    expect(d.situation).toBe('under_eating');
  });

  it('calls out a late-eating habit', () => {
    const d = decide({ ...base, hour: 22, lateMealDays: 4, budget: makeBudget({ consumed: 1700, remaining: 100, mealsLeft: 0 }) });
    expect(d.situation).toBe('late_eating');
  });

  it('always shows the numbers behind the advice', () => {
    const d = decide({ ...base, budget: makeBudget() });
    expect(d.facts.map((f) => f.label)).toEqual(['target', 'eaten', 'left', 'protein']);
  });
});
