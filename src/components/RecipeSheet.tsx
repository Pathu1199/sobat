import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { defaultPortion, foodName, toMealItem } from '../core/foods';
import { newId } from '../core/id';
import { kcalForGrams, mealTypeForHour } from '../core/nutrition';
import type { Recipe } from '../data/recipes';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Divider, Micro, Pill, Row, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F } from '../ui/theme';
import { FoodThumb } from './FoodDetailSheet';

/** One recipe: picture, how it is cooked, what goes in, what to do, and the calories of a serving; one button logs it. */
export function RecipeSheet({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const { foods, state, today, hour } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  if (!recipe) return null;
  const food = foods.find((f) => f.id === recipe.foodId);
  const portion = food ? defaultPortion(food) : undefined;
  const n = food && portion ? kcalForGrams(food, portion.grams) : null;

  function log() {
    if (!food || !portion) return;
    const item = toMealItem(food, portion.grams);
    app.addMeal({ id: newId(), at: new Date().toISOString(), date: today, type: mealTypeForHour(hour), items: [item], kcal: item.kcal, protein: Math.round(item.protein) });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: item.kcal }));
    onClose();
  }

  return (
    <Sheet open title={food ? foodName(food, lang) : recipe.id} onClose={onClose}>
      <Row style={{ gap: 14, alignItems: 'flex-start' }}>
        {food ? <FoodThumb food={food} size={88} /> : null}
        <View style={{ flex: 1, gap: 6 }}>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            <Pill label={t(`recipe_${recipe.style}`)} color={C.cardAlt} textColor={recipe.style === 'no_oil' ? C.green : C.cyan} />
            <Pill label={`${recipe.minutes} ${t('minutes')}`} />
            <Pill label={fill(t('serves_n'), { n: recipe.serves })} />
          </Row>
          {n ? (
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '300' }}>
              {n.kcal}
              <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}>{` kcal · ${Math.round(n.protein)} g ${t('protein').toLowerCase()} · ${portion ? portion.grams : ''} g`}</Text>
            </Text>
          ) : null}
        </View>
      </Row>
      <Divider />
      <Micro>{t('ingredients')}</Micro>
      {recipe.ingredients[lang].map((line, i) => (
        <Row key={i} style={{ gap: 8, alignItems: 'flex-start' }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent, marginTop: 8 }} />
          <Small>{line}</Small>
        </Row>
      ))}
      <Divider />
      <Micro>{t('recipe_steps')}</Micro>
      {recipe.steps[lang].map((line, i) => (
        <Row key={i} style={{ gap: 10, alignItems: 'flex-start' }}>
          <Text style={{ color: C.cyan, fontSize: F.h3, fontWeight: '300', width: 18 }}>{i + 1}</Text>
          <Text style={{ flex: 1, color: C.textDim, fontSize: F.body, lineHeight: 22 }}>{line}</Text>
        </Row>
      ))}
      <Divider />
      <Btn label={t('log_this')} icon={<Ionicons name="add" size={16} color={C.white} />} onPress={log} disabled={!food} />
    </Sheet>
  );
}
