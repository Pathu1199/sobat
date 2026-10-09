import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { foodIcon, foodsForDiet, isCountable, MEASURES, measuresFor, recentFoodIds, resolveByName, scaleMealItem, searchFoods, styleOf } from '../foods';
import type { FoodItem, Meal, MealItem } from '../types';
import { isSourceOf, nutrientSourcesEaten } from '../nutrients';
import { RECIPES } from '../../data/recipes';

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

describe('foodsForDiet', () => {
  const ALL = foodsJson as unknown as FoodItem[];
  it('hides meat, fish and eggs for pure veg, keeps eggs for veg + egg', () => {
    const veg = foodsForDiet(ALL, 'veg');
    expect(veg.some((f) => f.category === 'nonveg')).toBe(false);
    expect(veg.some((f) => /\begg\b/i.test(f.name_en))).toBe(false);
    expect(veg.some((f) => f.id === 'chapati')).toBe(true);
    const egg = foodsForDiet(ALL, 'egg');
    expect(egg.some((f) => /\begg\b/i.test(f.name_en))).toBe(true);
    expect(egg.some((f) => f.category === 'nonveg')).toBe(false);
    expect(foodsForDiet(ALL, 'nonveg')).toHaveLength(ALL.length);
  });

  it('offers household measures with sensible weights', () => {
    expect(MEASURES.find((m) => m.unit === 'bowl')?.grams).toBe(150);
    expect(MEASURES.every((m) => m.grams > 0 && m.grams <= 250)).toBe(true);
  });
});

describe('Marathi names in English letters', () => {
  const ALL = foodsJson as unknown as FoodItem[];
  it('finds a dish by the name a Marathi kitchen uses', () => {
    expect(searchFoods(ALL, 'flower batata', 3).map((f) => f.id)).toContain('aloo-gobi');
    expect(searchFoods(ALL, 'patal bhaji', 5).some((f) => styleOf(f) === 'gravy')).toBe(true);
    expect(resolveByName(ALL, 'Vangi Batata (dry)')?.id).toBe('vangi-batata');
    expect(resolveByName(ALL, 'kobi')?.id).toBe('cabbage-matar-bhaji');
  });

  it('knows dry from gravy and draws a matching icon', () => {
    const dry = ALL.find((f) => f.id === 'aloo-gobi')!;
    const gravy = ALL.find((f) => f.id === 'flower-rassa')!;
    expect(styleOf(dry)).toBe('dry');
    expect(styleOf(gravy)).toBe('gravy');
    expect(foodIcon(dry)).not.toBe(foodIcon(gravy));
    expect(ALL.filter((f) => f.category === 'veg' && !styleOf(f))).toEqual([]);
  });
});

describe('measuresFor', () => {
  const ALL = foodsJson as unknown as FoodItem[];
  const by = (id: string) => ALL.find((f) => f.id === id)!;
  it('never offers a bowl of chapati, but does offer a bowl of bhaji', () => {
    expect(isCountable(by('chapati'))).toBe(true);
    expect(measuresFor(by('chapati')).every((m) => m.own)).toBe(true);
    const bhaji = measuresFor(by('aloo-gobi')).map((m) => m.unit);
    expect(bhaji).toContain('bowl');
    expect(bhaji).toContain('spoon_big');
    expect(bhaji).not.toContain('glass');
    expect(measuresFor(by('taak')).map((m) => m.unit)).toContain('glass');
  });
});

describe('nutrient sources and recipes', () => {
  const ALL = foodsJson as unknown as FoodItem[];
  const by = (id: string) => ALL.find((f) => f.id === id)!;
  it('names B12, iron and calcium sources a vegetarian can use', () => {
    expect(isSourceOf(by('curd'), 'b12')).toBe(true);
    expect(isSourceOf(by('palak-bhaji'), 'iron')).toBe(true);
    expect(isSourceOf(by('toned-milk'), 'calcium')).toBe(true);
    expect(isSourceOf(by('chapati'), 'b12')).toBe(false);
    expect(isSourceOf(by('moong-dal'), 'protein')).toBe(true);
  });
  it('reports which sources were eaten today', () => {
    const meal = { id: 'm', at: '2026-10-07T13:00:00', date: '2026-10-07', type: 'lunch', kcal: 1, protein: 1, items: [{ foodId: 'curd', name_en: 'Curd', name_mr: '', grams: 100, kcal: 1, protein: 1, carbs: 0, fat: 0, estimated: false }] } as Meal;
    const s = nutrientSourcesEaten([meal], ALL);
    expect(s.b12).toEqual([by('curd').name_en]);
    expect(s.iron).toEqual([]);
  });
  it('every recipe points at a real food with portions and three languages', () => {
    for (const r of RECIPES) {
      const f = by(r.foodId);
      expect(f, r.id).toBeDefined();
      expect(f.portions.length).toBeGreaterThan(0);
      for (const lang of ['en', 'mr', 'hi'] as const) {
        expect(r.ingredients[lang].length).toBeGreaterThan(1);
        expect(r.steps[lang].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('everyday names in English letters', () => {
  const ALL = foodsJson as unknown as FoodItem[];
  it('finds dry fruits, fruits, vegetables and sabji by the names people type', () => {
    const top = (q: string) => searchFoods(ALL, q, 3).map((f) => f.id);
    expect(top('badam')).toContain('almonds');
    expect(top('kaju')).toContain('cashews');
    expect(top('akrod')).toContain('walnuts');
    expect(top('shengdane')).toContain('peanuts-roasted');
    expect(top('pista')).toContain('pistachios');
    expect(top('anjeer')).toContain('anjeer');
    expect(top('mosambi')).toContain('mosambi');
    expect(top('kakdi')).toEqual(expect.arrayContaining(['cucumber']));
    expect(top('lal math')).toContain('lal-math-bhaji');
    expect(top('chiku')).toContain('chikoo');
  });

  it('has no food twice and puts nuts under dry fruits', () => {
    const ids = ALL.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['almonds', 'walnuts', 'cashews', 'pistachios', 'raisins']) expect(ALL.find((f) => f.id === id)!.category).toBe('dryfruit');
  });
});

