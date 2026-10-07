import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { FoodThumb } from '../components/FoodDetailSheet';
import { RecipeSheet } from '../components/RecipeSheet';
import { defaultPortion, foodName } from '../core/foods';
import { kcalForGrams } from '../core/nutrition';
import { RECIPES, type Recipe, type RecipeStyle } from '../data/recipes';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Divider, ListRow, Micro, Pill, Screen, Small } from '../ui/components';
import { C } from '../ui/theme';

/** Healthy home recipes: without oil or with a teaspoon, each one loggable with real numbers. */
export default function RecipesScreen() {
  const { foods, state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [style, setStyle] = useState<RecipeStyle | 'all'>('all');
  const [open, setOpen] = useState<Recipe | null>(null);

  const list = useMemo(() => RECIPES.filter((r) => foods.some((f) => f.id === r.foodId) && (style === 'all' || r.style === style)), [foods, style]);

  return (
    <Screen>
      <Small>{fill(t('recipes_intro'), { n: RECIPES.length })}</Small>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Pill label={t('suggest_all')} active={style === 'all'} onPress={() => setStyle('all')} />
        <Pill label={t('recipe_no_oil')} active={style === 'no_oil'} onPress={() => setStyle('no_oil')} />
        <Pill label={t('recipe_low_oil')} active={style === 'low_oil'} onPress={() => setStyle('low_oil')} />
      </View>
      <Card>
        {list.map((r, i) => {
          const food = foods.find((f) => f.id === r.foodId)!;
          const p = defaultPortion(food);
          const n = p ? kcalForGrams(food, p.grams) : null;
          return (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon={<FoodThumb food={food} size={44} />}
                title={foodName(food, lang)}
                sub={`${t(`recipe_${r.style}`)} · ${r.minutes} ${t('minutes')} · ${n ? `${Math.round(n.protein)} g ${t('protein').toLowerCase()}` : ''}`}
                value={n ? String(n.kcal) : undefined}
                valueUnit="kcal"
                onPress={() => setOpen(r)}
                trailing={<Ionicons name="chevron-forward" size={15} color={C.textGhost} />}
              />
            </View>
          );
        })}
      </Card>
      <Micro>{t('recipes_note')}</Micro>
      <RecipeSheet recipe={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}
