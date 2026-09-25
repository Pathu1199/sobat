import Fuse from 'fuse.js';
import { kcalForGrams } from './nutrition';
import type { FoodItem, Lang, MealItem } from './types';

export function foodName(food: FoodItem, lang: Lang): string {
  if (lang === 'mr') return food.name_mr || food.name_en;
  if (lang === 'hi') return food.name_hi || food.name_en;
  return food.name_en;
}

export function portionLabel(p: FoodItem['portions'][number], lang: Lang): string {
  if (lang === 'mr') return p.label_mr || p.label_en;
  if (lang === 'hi') return p.label_hi || p.label_en;
  return p.label_en;
}

export function defaultPortion(food: FoodItem) {
  return food.portions.find((p) => p.unit === food.default_portion) ?? food.portions[0];
}

let cached: { list: FoodItem[]; fuse: Fuse<FoodItem> } | null = null;

export function buildIndex(foods: FoodItem[]) {
  const fuse = new Fuse(foods, {
    keys: [
      { name: 'name_en', weight: 3 },
      { name: 'name_mr', weight: 3 },
      { name: 'name_hi', weight: 3 },
      { name: 'tags', weight: 1 },
      { name: 'category', weight: 0.5 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  cached = { list: foods, fuse };
  return cached;
}

export function searchFoods(foods: FoodItem[], query: string, limit = 25): FoodItem[] {
  if (!cached || cached.list !== foods) buildIndex(foods);
  const q = query.trim();
  if (!q) return foods.slice(0, limit);
  return cached!.fuse.search(q, { limit }).map((r) => r.item);
}

/** Turn a food plus a portion count into a meal line with real numbers. */
export function toMealItem(food: FoodItem, grams: number, estimated = false): MealItem {
  const n = kcalForGrams(food, grams);
  return {
    foodId: food.id,
    name_en: food.name_en,
    name_mr: food.name_mr,
    grams: Math.round(grams),
    kcal: n.kcal,
    protein: n.protein,
    carbs: n.carbs,
    fat: n.fat,
    estimated,
  };
}

/**
 * Match a name the vision model returned against the database. Calories then
 * come from the database, not the model, whenever a match exists.
 */
export function resolveByName(foods: FoodItem[], name: string): FoodItem | null {
  const hits = searchFoods(foods, name, 1);
  return hits[0] ?? null;
}

/** Meal options that fit inside the remaining budget, best protein first. */
export function suggestMeals(
  foods: FoodItem[],
  kcalMax: number,
  opts: { vegOnly?: boolean; noEgg?: boolean; minKcal?: number } = {},
): { food: FoodItem; grams: number; kcal: number; protein: number }[] {
  const minKcal = opts.minKcal ?? 150;
  const out: { food: FoodItem; grams: number; kcal: number; protein: number }[] = [];
  for (const f of foods) {
    // Category matters as much as the tag: a dish can be nonveg without being tagged.
    if (opts.vegOnly && (f.tags.includes('nonveg') || f.category === 'nonveg')) continue;
    if (opts.noEgg && (f.tags.includes('egg') || /\begg\b|अंड/i.test(f.name_en + f.name_mr + f.name_hi))) continue;
    if (['beverage', 'sweet'].includes(f.category)) continue;
    const p = defaultPortion(f);
    if (!p) continue;
    const n = kcalForGrams(f, p.grams);
    if (n.kcal <= kcalMax && n.kcal >= minKcal) out.push({ food: f, grams: p.grams, kcal: n.kcal, protein: n.protein });
  }
  return out.sort((a, b) => b.protein - a.protein).slice(0, 12);
}
