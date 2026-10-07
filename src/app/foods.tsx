import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { FoodDetailSheet, FoodThumb, type Chosen } from '../components/FoodDetailSheet';
import { defaultPortion, portionLabel, searchFoods, styleOf, toMealItem } from '../core/foods';
import { newId } from '../core/id';
import { mealTypeForHour } from '../core/nutrition';
import type { FoodItem } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Field, ListRow, Micro, Pill, Screen, Small } from '../ui/components';
import { C } from '../ui/theme';

const CATEGORIES = ['all', 'veg', 'dal', 'grain', 'snack', 'fruit', 'dairy', 'beverage', 'sweet', 'fast_food'] as const;

/**
 * The whole food list, for looking things up: picture, dry or gravy, and the
 * calories of a usual portion. Tapping one opens the same sheet as the +
 * screen; Add logs it for the current meal.
 */
export default function FoodsScreen() {
  const app = useApp();
  const fb = useFeedback();
  const { foods, state, today, hour } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('all');
  const [detail, setDetail] = useState<FoodItem | null>(null);

  const list = useMemo(() => {
    const base = query.trim() ? searchFoods(foods, query, 60) : [...foods].sort((a, b) => a.name_en.localeCompare(b.name_en));
    return cat === 'all' ? base : base.filter((f) => f.category === cat);
  }, [foods, query, cat]);

  function add(c: Chosen) {
    const item = toMealItem(c.food, c.gramsPerUnit * c.count);
    app.addMeal({ id: newId(), at: new Date().toISOString(), date: today, type: mealTypeForHour(hour), items: [item], kcal: item.kcal, protein: Math.round(item.protein) });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: item.kcal }));
    setDetail(null);
  }

  return (
    <Screen>
      <Small>{fill(t('foods_intro'), { n: foods.length })}</Small>
      <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {CATEGORIES.map((c) => (
          <Pill key={c} label={t(`cat_${c}`)} active={cat === c} onPress={() => setCat(c)} />
        ))}
      </ScrollView>
      <Card>
        {list.length === 0 ? <Small color={C.textGhost}>{t('no_results')}</Small> : null}
        {list.map((f, i) => {
          const p = defaultPortion(f);
          const kcal = p ? Math.round((f.kcal_100g * p.grams) / 100) : f.kcal_100g;
          const style = styleOf(f);
          return (
            <View key={f.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon={<FoodThumb food={f} size={44} />}
                title={f.name_en}
                alt={lang === 'en' ? undefined : f.name_mr}
                sub={[style ? t(`style_${style}`) : null, p ? portionLabel(p, lang) : null, `${Math.round(f.protein_100g * ((p?.grams ?? 100) / 100))} g ${t('protein').toLowerCase()}`].filter(Boolean).join(' · ')}
                value={String(kcal)}
                valueUnit="kcal"
                onPress={() => setDetail(f)}
                trailing={<Ionicons name="chevron-forward" size={15} color={C.textGhost} />}
              />
            </View>
          );
        })}
      </Card>
      <Micro>{t('foods_note')}</Micro>
      <Text style={{ height: 1 }} />
      <FoodDetailSheet food={detail} onAdd={add} onClose={() => setDetail(null)} />
    </Screen>
  );
}
