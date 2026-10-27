import { describe, expect, it } from 'vitest';
import { bmi, bmiBand, budget, dailyTargets, healthyWeightRange, isAdultBirthYear, kcalForGrams, mealTypeForHour, mealsRemaining, tdee, bmr, KCAL_FLOOR } from '../nutrition';
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
    // Her goal must sit under her weight, or there is no deficit to floor.
    const small: Profile = { ...varad, sex: 'female', weightKg: 48, goalWeightKg: 44, heightCm: 150, activity: 'sedentary', rateKgPerWeek: 1 };
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

  it('with the eating pattern on, splits across the slots it says are left instead of the fixed windows', () => {
    const consumed = { kcal: 500, protein: 20, carbs: 60, fat: 15 };
    expect(budget(targets, consumed, 14).mealsLeft).toBe(3);
    const b = budget(targets, consumed, 14, 0, 2);
    expect(b.mealsLeft).toBe(2);
    expect(b.perMeal).toBe(Math.round(b.remaining / 2));
    expect(budget(targets, consumed, 14, 0, 0)).toMatchObject({ mealsLeft: 0, perMeal: 0 });
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

describe('dailyTargets never puts a deficit where it does not belong', () => {
  it('holds at maintenance once the weight is at or under the goal', () => {
    const t = dailyTargets({ ...varad, weightKg: 74, goalWeightKg: 75 }, now);
    expect(t.kcal).toBe(Math.max(t.tdee, KCAL_FLOOR.male));
    expect(t.deficit).toBeLessThanOrEqual(0);
    expect(t.hold).toBe('at_goal');
  });

  it('holds at maintenance for an underweight BMI, whatever the goal says', () => {
    // 50 kg at 172 cm is BMI 16.9.
    const t = dailyTargets({ ...varad, weightKg: 50, goalWeightKg: 45 }, now);
    expect(t.kcal).toBe(Math.max(t.tdee, KCAL_FLOOR.male));
    expect(t.hold).toBe('underweight');
  });

  it('treats a goal under the healthy range as the bottom of the range', () => {
    // Healthy minimum at 172 cm is 55 kg.
    const atMin = dailyTargets({ ...varad, weightKg: 55, goalWeightKg: 45 }, now);
    expect(atMin.hold).toBe('at_goal');
    const above = dailyTargets({ ...varad, weightKg: 60, goalWeightKg: 45 }, now);
    expect(above.hold).toBe(null);
    expect(above.deficit).toBeGreaterThan(0);
    expect(above.proteinG).toBe(Math.round(1.4 * 55));
  });

  it('gives maintenance to anyone under 18 or over 100', () => {
    const teen = dailyTargets({ ...varad, birthYear: 2012 }, now);
    expect(teen.hold).toBe('age');
    expect(teen.kcal).toBe(Math.max(teen.tdee, KCAL_FLOOR.male));
    const old = dailyTargets({ ...varad, birthYear: 1920 }, now);
    expect(old.hold).toBe('age');
  });

  it('a two-digit birth year never gives a negative or nonsense BMR', () => {
    const t = dailyTargets({ ...varad, birthYear: 98 }, now);
    expect(t.bmr).toBeGreaterThan(1000);
    expect(t.tdee).toBeGreaterThan(t.bmr);
    expect(t.hold).toBe('age');
    expect(t.kcal).toBe(Math.max(t.tdee, KCAL_FLOOR.male));
  });

  it('keeps the normal deficit for an ordinary adult above the goal', () => {
    expect(dailyTargets(varad, now).hold).toBe(null);
  });
});

describe('isAdultBirthYear', () => {
  it('accepts a four-digit year that gives an age of 18 to 100', () => {
    expect(isAdultBirthYear('1998', now)).toBe(true);
    expect(isAdultBirthYear(' 1990 ', now)).toBe(true);
    expect(isAdultBirthYear('2008', now)).toBe(true);
    expect(isAdultBirthYear('1926', now)).toBe(true);
  });

  it('rejects two-digit years, minors, the very old and junk', () => {
    expect(isAdultBirthYear('98', now)).toBe(false);
    expect(isAdultBirthYear('2009', now)).toBe(false);
    expect(isAdultBirthYear('1925', now)).toBe(false);
    expect(isAdultBirthYear('', now)).toBe(false);
    expect(isAdultBirthYear('19x8', now)).toBe(false);
    // The draft reads the field with Number(), which cannot read Devanagari digits.
    expect(isAdultBirthYear('१९९८', now)).toBe(false);
  });
});
