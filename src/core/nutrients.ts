import type { FoodItem, Meal } from './types';

/**
 * Which foods are good sources of the nutrients a vegetarian has to watch.
 * Qualitative on purpose: milligram tables for 240 home dishes would be
 * guesses, and a guess shown as a number is worse than a true "this is a
 * good source". Protein is the exception; it is measured per food.
 */
export const NUTRIENT_TAGS = ['protein', 'iron', 'calcium', 'b12', 'fibre'] as const;
export type NutrientTag = (typeof NUTRIENT_TAGS)[number];

export function isSourceOf(f: FoodItem, n: NutrientTag): boolean {
  if (n === 'protein') return f.tags.includes('high_protein') || f.protein_100g >= 8;
  return f.tags.includes(`src_${n}`);
}

/** For each nutrient, the foods eaten today that are a good source of it. */
export function nutrientSourcesEaten(meals: Meal[], foods: FoodItem[]): Record<NutrientTag, string[]> {
  const out = { protein: [], iron: [], calcium: [], b12: [], fibre: [] } as Record<NutrientTag, string[]>;
  const eaten = new Set(meals.flatMap((m) => m.items.map((i) => i.foodId).filter((x): x is string => !!x)));
  for (const id of eaten) {
    const f = foods.find((x) => x.id === id);
    if (!f) continue;
    for (const n of NUTRIENT_TAGS) if (isSourceOf(f, n) && !out[n].includes(f.name_en)) out[n].push(f.name_en);
  }
  return out;
}
