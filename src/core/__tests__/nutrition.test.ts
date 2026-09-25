import { describe, expect, it } from 'vitest';
import { bmi, bmiBand, budget, dailyTargets, healthyWeightRange, kcalForGrams, mealTypeForHour, mealsRemaining, tdee, bmr, KCAL_FLOOR } from '../nutrition';
import { suggestMeals } from '../foods';
import type { Profile } from '../types';

const varad: Profile = {
  name: 'Varad',
  sex: 'male',
  birthYear: 1998,
  heightCm: 172,
  weightKg: 100,
  activity: 'sedentary',
  goalWeightKg: 75,
  rateKgPerWeek: 0.5,
  lang: 'mr',
  onboarded: true,
};

const now = new Date('2026-09-25T10:00:00');

describe('bmr and tdee', () => {
  it('matches Mifflin-St Jeor for a male', () => {
    // 10*100 + 6.25*172 - 5*28 + 5 = 1000 + 1075 - 140 + 5 = 1940
    expect(bmr(varad, now)).toBe(1940);
  });

  it('applies the sex offset', () => {
    expect(bmr({ ...varad, sex: 'female' }, now)).toBe(1940 - 5 - 161);
  });

  it('scales by activity', () => {
    expect(tdee(varad, now)).toBe(Math.round(1940 * 1.2));
    expect(tdee({ ...varad, activity: 'active' }, now)).toBeGreaterThan(tdee(varad, now));
  });
});

describe('dailyTargets', () => {
  it('subtracts a deficit sized to the chosen rate', () => {
    const t = dailyTargets(varad, now);
    expect(t.tdee).toBe(2328);
    expect(t.deficit).toBe(550); // 0.5 kg/week
    expect(t.kcal).toBe(1778);
    expect(t.floored).toBe(false);
  });

  it('caps the rate at 1 kg per week however greedy the goal', () => {
    const t = dailyTargets({ ...varad, rateKgPerWeek: 3 }, now);
    expect(t.rateKgPerWeek).toBeLessThanOrEqual(1);
  });

  it('never drops below the calorie floor', () => {
    const small: Profile = { ...varad, sex: 'female', weightKg: 48, heightCm: 150, activity: 'sedentary', rateKgPerWeek: 1 };
    const t = dailyTargets(small, now);
    expect(t.kcal).toBeGreaterThanOrEqual(KCAL_FLOOR.female);
    expect(t.floored).toBe(true);
  });

  it('sets protein from goal weight, not current weight', () => {
    const t = dailyTargets(varad, now);
    expect(t.proteinG).toBe(Math.round(1.4 * 75));
  });
});

describe('bmi', () => {
  it('computes and bands', () => {
    expect(bmi(100, 172)).toBe(33.8);
    expect(bmiBand(33.8)).toBe('obese');
    expect(bmiBand(22)).toBe('normal');
    expect(bmiBand(27)).toBe('over');
    expect(bmiBand(17)).toBe('under');
  });

  it('gives a healthy range for a height', () => {
    const r = healthyWeightRange(172);
    expect(r.min).toBe(55);
    expect(r.max).toBe(74);
  });
});

describe('meal windows', () => {
  it('maps hours to meals', () => {
    expect(mealTypeForHour(8)).toBe('breakfast');
    expect(mealTypeForHour(13)).toBe('lunch');
    expect(mealTypeForHour(17)).toBe('snack');
    expect(mealTypeForHour(20)).toBe('dinner');
    expect(mealTypeForHour(2)).toBe('snack');
  });

  it('counts only meals still ahead', () => {
    expect(mealsRemaining(6)).toHaveLength(4);
    expect(mealsRemaining(12)).toEqual(['lunch', 'snack', 'dinner']);
    expect(mealsRemaining(23)).toHaveLength(0);
  });
});

describe('budget', () => {
  const targets = dailyTargets(varad, now);

  it('splits what is left across the meals that remain', () => {
    const b = budget(targets, { kcal: 500, protein: 20, carbs: 60, fat: 15 }, 12);
    expect(b.remaining).toBe(targets.kcal - 500);
    expect(b.mealsLeft).toBe(3);
    expect(b.perMeal).toBe(Math.round((targets.kcal - 500) / 3));
  });

  it('goes negative when overeating, and never suggests a negative meal', () => {
    const b = budget(targets, { kcal: 2600, protein: 60, carbs: 300, fat: 90 }, 20);
    expect(b.remaining).toBeLessThan(0);
    expect(b.perMeal).toBe(0);
  });
});

describe('kcalForGrams', () => {
  it('scales per 100 g values', () => {
    const poha = { kcal_100g: 130, protein_100g: 2.5, carbs_100g: 24, fat_100g: 3 };
    expect(kcalForGrams(poha, 200)).toEqual({ kcal: 260, protein: 5, carbs: 48, fat: 6 });
  });
});

describe('suggestMeals dietary filters', () => {
  const foods = [
    { id: 'dal', name_en: 'Dal Tadka', name_mr: 'डाळ', name_hi: 'दाल', category: 'dal', kcal_100g: 120, protein_100g: 6, carbs_100g: 15, fat_100g: 4, portions: [{ unit: 'katori', label_en: '1 katori', label_mr: '१ वाटी', label_hi: '1 कटोरी', grams: 150 }], default_portion: 'katori', tags: ['veg'], source: 'IFCT2017' },
    { id: 'chicken-sukka', name_en: 'Chicken Sukka', name_mr: 'चिकन सुके', name_hi: 'चिकन सुखा', category: 'nonveg', kcal_100g: 200, protein_100g: 22, carbs_100g: 4, fat_100g: 11, portions: [{ unit: 'katori', label_en: '1 katori', label_mr: '१ वाटी', label_hi: '1 कटोरी', grams: 150 }], default_portion: 'katori', tags: ['nonveg'], source: 'estimate' },
    { id: 'egg-bhurji', name_en: 'Egg Bhurji', name_mr: 'अंडा भुर्जी', name_hi: 'अंडा भुर्जी', category: 'nonveg', kcal_100g: 180, protein_100g: 13, carbs_100g: 4, fat_100g: 13, portions: [{ unit: 'katori', label_en: '1 katori', label_mr: '१ वाटी', label_hi: '1 कटोरी', grams: 150 }], default_portion: 'katori', tags: ['egg'], source: 'estimate' },
  ];

  it('offers everything when there is no rule', () => {
    expect(suggestMeals(foods as never, 900).map((o) => o.food.id)).toContain('chicken-sukka');
  });

  it('never offers meat to a vegetarian', () => {
    const ids = suggestMeals(foods as never, 900, { vegOnly: true }).map((o) => o.food.id);
    expect(ids).not.toContain('chicken-sukka');
    expect(ids).toContain('dal');
  });

  it('drops egg dishes when eggs are refused', () => {
    const ids = suggestMeals(foods as never, 900, { noEgg: true }).map((o) => o.food.id);
    expect(ids).not.toContain('egg-bhurji');
  });
});
