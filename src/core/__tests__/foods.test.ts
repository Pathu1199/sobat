import { describe, expect, it } from 'vitest';
import { recentFoodIds, scaleMealItem } from '../foods';
import type { Meal, MealItem } from '../types';

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

describe('recentFoodIds', () => {
  const mk = (date: string, ids: (string | undefined)[]): Meal => ({
    id: date,
    at: `${date}T13:00`,
    date,
    type: 'lunch',
    items: ids.map((foodId) => ({ foodId, name_en: foodId ?? 'x', name_mr: '', grams: 100, kcal: 100, protein: 5, carbs: 10, fat: 2, estimated: false })),
    kcal: 100,
    protein: 5,
  });

  it('ranks by how often a food was logged, most first', () => {
    const meals = [mk('2026-09-20', ['chapati', 'dal']), mk('2026-09-21', ['chapati', 'rice']), mk('2026-09-22', ['chapati', 'dal'])];
    expect(recentFoodIds(meals, '2026-09-01')).toEqual(['chapati', 'dal', 'rice']);
  });

  it('ignores lines without a database food and days before the cutoff', () => {
    const meals = [mk('2026-08-01', ['old']), mk('2026-09-22', [undefined, 'curd'])];
    expect(recentFoodIds(meals, '2026-09-01')).toEqual(['curd']);
  });

  it('caps the list', () => {
    const meals = [mk('2026-09-22', ['a', 'b', 'c', 'd'])];
    expect(recentFoodIds(meals, '2026-09-01', 2)).toHaveLength(2);
  });
});
