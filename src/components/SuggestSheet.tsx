import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { defaultPortion, foodName, suggestMeals, toMealItem } from '../core/foods';
import { newId } from '../core/id';
import { dietFrom } from '../core/memory';
import { mealTypeForHour } from '../core/nutrition';
import { avoidedFoodIds } from '../core/routine';
import { recipeFor, type Recipe } from '../data/recipes';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Divider, ListRow, Micro, Pill, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C } from '../ui/theme';
import { FoodThumb } from './FoodDetailSheet';
import { RecipeSheet } from './RecipeSheet';

/**
 * "What can I eat now?" Foods that fit what is left today, best protein
 * first, never from the avoid list; the ones with a recipe say so and open
 * it. Shown only when asked, never pushed onto the screen.
 */
export function SuggestSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const { foods, state, budget, today, hour } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [onlyRecipes, setOnlyRecipes] = useState(false);

  const list = useMemo(() => {
    const avoided = avoidedFoodIds({ ...state.routine, enabled: true });
    const room = Math.max(120, budget.remaining);
    const all = suggestMeals(foods, room, { ...dietFrom(state.memory), minKcal: 40 }).filter((o) => !avoided.has(o.food.id));
    return onlyRecipes ? all.filter((o) => recipeFor(o.food.id)) : all;
  }, [foods, state.routine, state.memory, budget.remaining, onlyRecipes]);

  function logOne(foodId: string) {
    const food = foods.find((f) => f.id === foodId);
    const p = food ? defaultPortion(food) : undefined;
    if (!food || !p) return;
    const item = toMealItem(food, p.grams);
    app.addMeal({ id: newId(), at: new Date().toISOString(), date: today, type: mealTypeForHour(hour), items: [item], kcal: item.kcal, protein: Math.round(item.protein) });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: item.kcal }));
  }

  return (
    <>
      <Sheet open={open && !recipe} title={t('suggest_title')} onClose={onClose}>
        <Small>{budget.remaining > 0 ? fill(t('suggest_room'), { kcal: budget.remaining }) : t('suggest_over')}</Small>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pill label={t('suggest_all')} active={!onlyRecipes} onPress={() => setOnlyRecipes(false)} />
          <Pill label={t('suggest_with_recipe')} active={onlyRecipes} onPress={() => setOnlyRecipes(true)} />
        </View>
        {list.length === 0 ? <Small color={C.textGhost}>{t('no_results')}</Small> : null}
        {list.map((o, i) => {
          const rec = recipeFor(o.food.id);
          return (
            <View key={o.food.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon={<FoodThumb food={o.food} size={40} />}
                title={foodName(o.food, lang)}
                sub={`${o.grams} g · ${o.protein} g ${t('protein').toLowerCase()}${rec ? ` · ${t(`recipe_${rec.style}`)}` : ''}`}
                value={String(o.kcal)}
                valueUnit="kcal"
                onPress={rec ? () => setRecipe(rec) : () => logOne(o.food.id)}
                trailing={
                  rec ? (
                    <Micro color={C.cyan}>{t('recipe')}</Micro>
                  ) : (
                    <Ionicons name="add-circle-outline" size={20} color={C.accent} />
                  )
                }
              />
            </View>
          );
        })}
        <Text style={{ height: 1 }} />
      </Sheet>
      <RecipeSheet recipe={recipe} onClose={() => setRecipe(null)} />
    </>
  );
}
