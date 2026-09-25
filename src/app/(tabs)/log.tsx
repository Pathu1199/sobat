import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { toISODate } from '../../core/date';
import { defaultPortion, foodName, portionLabel, searchFoods, toMealItem } from '../../core/foods';
import { mealTypeForHour } from '../../core/nutrition';
import type { FoodItem, MealItem, MealType } from '../../core/types';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Btn, Card, Divider, Empty, Field, H2, H3, P, Pill, Row, Screen, Small } from '../../ui/components';
import { C, F } from '../../ui/theme';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function LogScreen() {
  const app = useApp();
  const router = useRouter();
  const lang = app.state.profile.lang;
  const t = makeT(lang);

  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState<MealType>(mealTypeForHour(new Date().getHours()));
  const [basket, setBasket] = useState<{ food: FoodItem; count: number; unit: string }[]>([]);
  const [weightInput, setWeightInput] = useState('');

  const results = useMemo(() => searchFoods(app.foods, query, 30), [app.foods, query]);
  const todayMeals = app.state.meals.filter((m) => m.date === app.today);

  const basketItems: MealItem[] = basket.map((b) => {
    const p = b.food.portions.find((x) => x.unit === b.unit) ?? defaultPortion(b.food);
    return toMealItem(b.food, (p?.grams ?? 100) * b.count);
  });
  const basketKcal = basketItems.reduce((a, i) => a + i.kcal, 0);
  const basketProtein = Math.round(basketItems.reduce((a, i) => a + i.protein, 0));

  function addToBasket(food: FoodItem) {
    setBasket((b) => {
      const existing = b.find((x) => x.food.id === food.id);
      if (existing) return b.map((x) => (x.food.id === food.id ? { ...x, count: x.count + 0.5 } : x));
      return [...b, { food, count: 1, unit: food.default_portion }];
    });
  }

  function saveMeal() {
    if (basketItems.length === 0) return;
    const now = new Date();
    app.addMeal({
      id: String(now.getTime()),
      at: now.toISOString(),
      date: toISODate(now),
      type: mealType,
      items: basketItems,
      kcal: basketKcal,
      protein: basketProtein,
    });
    setBasket([]);
    setQuery('');
  }

  function saveWeight() {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg < 25 || kg > 350) return;
    app.addWeight({ date: app.today, kg });
    setWeightInput('');
  }

  return (
    <Screen>
      <Row style={{ gap: 8 }}>
        <Btn label={`📷 ${t('add_photo')}`} tone="soft" onPress={() => router.push('/photo')} style={{ flex: 1 }} />
        <Btn label={`+ ${t('add_water')}`} tone="soft" onPress={() => app.addWater(app.state.settings.glassMl)} style={{ flex: 1 }} />
      </Row>

      <Card>
        <H3>{t('add_weight')}</H3>
        <Row>
          <Field value={weightInput} onChangeText={setWeightInput} keyboardType="numeric" placeholder={`${app.state.profile.weightKg}`} />
          <Btn small label={t('save')} onPress={saveWeight} />
        </Row>
      </Card>

      <Card>
        <H3>{t('add_food')}</H3>
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          {MEAL_TYPES.map((m) => (
            <Pill key={m} label={t(m)} active={mealType === m} onPress={() => setMealType(m)} />
          ))}
        </Row>
        <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} />

        {basket.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Divider />
            {basket.map((b, idx) => {
              const p = b.food.portions.find((x) => x.unit === b.unit) ?? defaultPortion(b.food);
              const item = basketItems[idx];
              return (
                <View key={b.food.id} style={{ gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <P>{foodName(b.food, lang)}</P>
                      <Small>{p ? portionLabel(p, lang) : ''} · {item.grams} g</Small>
                    </View>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{item.kcal}</Text>
                    <Pressable onPress={() => setBasket((x) => x.filter((y) => y.food.id !== b.food.id))} accessibilityLabel={t('delete')}>
                      <Ionicons name="close" size={18} color={C.textFaint} />
                    </Pressable>
                  </Row>
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {[0.5, 1, 1.5, 2, 3].map((n) => (
                      <Pill key={n} label={`${n}`} active={b.count === n} onPress={() => setBasket((x) => x.map((y) => (y.food.id === b.food.id ? { ...y, count: n } : y)))} />
                    ))}
                    {b.food.portions.length > 1
                      ? b.food.portions.map((pp) => (
                          <Pill key={pp.unit} label={pp.unit} active={b.unit === pp.unit} onPress={() => setBasket((x) => x.map((y) => (y.food.id === b.food.id ? { ...y, unit: pp.unit } : y)))} />
                        ))
                      : null}
                  </Row>
                </View>
              );
            })}
            <Divider />
            <Row style={{ justifyContent: 'space-between' }}>
              <Small>{basketKcal} kcal · {basketProtein} g {t('protein')}</Small>
              <Btn small label={t('save')} onPress={saveMeal} />
            </Row>
          </View>
        ) : null}
      </Card>

      <Card>
        {results.length === 0 ? (
          <Empty text={t('no_results')} />
        ) : (
          results.slice(0, 20).map((f) => {
            const p = defaultPortion(f);
            const kcal = p ? Math.round((f.kcal_100g * p.grams) / 100) : f.kcal_100g;
            return (
              <Pressable key={f.id} onPress={() => addToBasket(f)}>
                <Row style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
                  <View style={{ flex: 1 }}>
                    <P>{foodName(f, lang)}</P>
                    <Small>{p ? portionLabel(p, lang) : ''}</Small>
                  </View>
                  <Text style={{ color: C.textDim, fontSize: F.small }}>{kcal} kcal</Text>
                  <Ionicons name="add" size={18} color={C.teal} />
                </Row>
              </Pressable>
            );
          })
        )}
      </Card>

      <Card>
        <H3>{t('tab_today')}</H3>
        {todayMeals.length === 0 ? (
          <Empty text={t('nothing_logged')} />
        ) : (
          todayMeals.map((m) => (
            <Row key={m.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <P>{m.items.map((i) => (lang === 'mr' ? i.name_mr || i.name_en : i.name_en)).join(', ') || t(m.type)}</P>
                <Small>{t(m.type)} · {m.at.slice(11, 16)}</Small>
              </View>
              <Text style={{ color: C.text, fontWeight: '600' }}>{m.kcal}</Text>
              <Pressable onPress={() => app.removeMeal(m.id)} accessibilityLabel={t('delete')}>
                <Ionicons name="trash-outline" size={18} color={C.textFaint} />
              </Pressable>
            </Row>
          ))
        )}
      </Card>
    </Screen>
  );
}
