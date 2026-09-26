import { describe, expect, it } from 'vitest';
import { scaleMealItem } from '../foods';
import type { MealItem } from '../types';

describe('scaleMealItem', () => {
  const item: MealItem = { name_en: 'Chapati', name_mr: 'चपाती', grams: 80, kcal: 238, protein: 8, carbs: 42, fat: 4, estimated: false };

  it('scales every nutrient with the weight', () => {
    const half = scaleMealItem(item, 40);
    expect(half.grams).toBe(40);
    expect(half.kcal).toBe(119);
    expect(half.protein).toBe(4);
    expect(half.carbs).toBe(21);
    expect(half.fat).toBe(2);
    expect(half.estimated).toBe(false);
  });

  it('never divides by zero', () => {
    const zero = scaleMealItem({ ...item, grams: 0 }, 50);
    expect(zero.grams).toBe(50);
    expect(zero.kcal).toBe(0);
  });
});
