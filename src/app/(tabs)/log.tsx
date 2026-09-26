import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CustomFoodForm } from '../../components/CustomFoodForm';
import { toISODate } from '../../core/date';
import { defaultPortion, foodName, portionLabel, searchFoods, toMealItem } from '../../core/foods';
import { mealTypeForHour } from '../../core/nutrition';
import type { FoodItem, MealItem, MealType } from '../../core/types';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { BiText, Btn, Card, Divider, Empty, Field, ListRow, Micro, Pill, Row, Screen, SectionHeader, Segmented, Small } from '../../ui/components';
import { C, F, S } from '../../ui/theme';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function LogScreen() {
  const app = useApp();
  const router = useRouter();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');

  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState<MealType>(mealTypeForHour(new Date().getHours()));
  const [basket, setBasket] = useState<{ food: FoodItem; count: number; unit: string }[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

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

  const glasses = Math.round(app.waterToday / app.state.settings.glassMl);
  const glassGoal = Math.round(app.state.settings.waterGoalMl / app.state.settings.glassMl);

  return (
    <Screen>
      <Row style={{ gap: 10 }}>
        <Tool icon="camera-outline" label={t('add_photo')} onPress={() => router.push('/photo')} />
        <Tool icon="barcode-outline" label={t('scan_barcode')} onPress={() => router.push('/scan')} />
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{en('water')}</Micro>
          <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
            {glasses}
            <Text style={{ color: C.textFaint, fontWeight: '400' }}>
              {' / '}
              {glassGoal} {t('glasses')}
            </Text>
          </Text>
        </Row>
        <Row style={{ gap: 8 }}>
          <Btn label={`+ 1 ${t('glasses')}`} onPress={() => app.addWater(app.state.settings.glassMl)} style={{ flex: 1 }} />
          <Btn tone="ghost" label={t('undo')} onPress={app.undoWater} disabled={app.waterToday === 0} style={{ flex: 1 }} />
        </Row>
      </Card>

      <Card>
        <Micro>{en('add_weight')}</Micro>
        <Row style={{ gap: 10 }}>
          <Field value={weightInput} onChangeText={setWeightInput} keyboardType="numeric" placeholder={`${app.state.profile.weightKg}`} />
          <Btn label={t('save')} onPress={saveWeight} disabled={!weightInput.trim()} />
        </Row>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('add_food')} meta={t(mealType)} />
        <Segmented value={mealType} onChange={setMealType} options={MEAL_TYPES.map((m) => ({ key: m, label: en(m) }))} />
        <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} />
      </View>

      {basket.length > 0 ? (
        <Card tone={C.accent}>
          {basket.map((b, idx) => {
            const p = b.food.portions.find((x) => x.unit === b.unit) ?? defaultPortion(b.food);
            const item = basketItems[idx];
            return (
              <View key={b.food.id} style={{ gap: 9 }}>
                {idx > 0 ? <Divider /> : null}
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <BiText en={b.food.name_en} alt={lang === 'en' ? undefined : b.food.name_mr} />
                    <Micro>{`${p ? portionLabel(p, lang) : ''} · ${item.grams} g`}</Micro>
                  </View>
                  <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
                    {item.kcal}
                    <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '400' }}> kcal</Text>
                  </Text>
                  <Pressable onPress={() => setBasket((x) => x.filter((y) => y.food.id !== b.food.id))} hitSlop={8}>
                    <Ionicons name="close" size={17} color={C.textFaint} />
                  </Pressable>
                </Row>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {[0.5, 1, 1.5, 2, 3].map((n) => (
                    <Pill
                      key={n}
                      label={`${n}x`}
                      active={b.count === n}
                      onPress={() => setBasket((x) => x.map((y) => (y.food.id === b.food.id ? { ...y, count: n } : y)))}
                    />
                  ))}
                  {b.food.portions.length > 1
                    ? b.food.portions.map((pp) => (
                        <Pill
                          key={pp.unit}
                          label={pp.unit}
                          active={b.unit === pp.unit}
                          onPress={() => setBasket((x) => x.map((y) => (y.food.id === b.food.id ? { ...y, unit: pp.unit } : y)))}
                        />
                      ))
                    : null}
                </Row>
              </View>
            );
          })}
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{basketKcal}</Text>
              <Micro>{`kcal · ${basketProtein} g ${en('protein')}`}</Micro>
            </View>
            <Btn label={t('save')} onPress={saveMeal} />
          </Row>
        </Card>
      ) : null}

      {customOpen ? (
        <CustomFoodForm
          initialName={query}
          onSaved={(f) => {
            setCustomOpen(false);
            addToBasket(f);
            setQuery('');
          }}
          onCancel={() => setCustomOpen(false)}
        />
      ) : null}

      <Card>
        {results.length === 0 ? (
          <View style={{ gap: 10 }}>
            <Empty text={t('no_results')} />
            <Btn
              small
              tone="soft"
              label={query.trim() ? t('add_as_custom').replace('{q}', query.trim()) : t('custom_food')}
              onPress={() => setCustomOpen(true)}
            />
          </View>
        ) : (
          <>
            {results.slice(0, 20).map((f, i) => {
              const p = defaultPortion(f);
              const kcal = p ? Math.round((f.kcal_100g * p.grams) / 100) : f.kcal_100g;
              return (
                <View key={f.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={f.name_en}
                    alt={lang === 'en' ? undefined : f.name_mr}
                    sub={p ? portionLabel(p, lang) : undefined}
                    value={String(kcal)}
                    valueUnit="kcal"
                    onPress={() => addToBasket(f)}
                    trailing={<Ionicons name="add" size={17} color={C.accent} />}
                  />
                </View>
              );
            })}
            <Divider />
            <Btn small tone="ghost" label={t('custom_food')} onPress={() => setCustomOpen(true)} />
          </>
        )}
      </Card>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('logged_intake')} meta={`${todayMeals.length}`} />
        <Card>
          {todayMeals.length === 0 ? (
            <Empty text={t('nothing_logged')} />
          ) : (
            todayMeals.map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  icon={<Ionicons name="restaurant-outline" size={15} color={C.textDim} />}
                  title={t(m.type)}
                  alt={m.items[0]?.name_en ? `· ${m.items.map((x) => x.name_en).slice(0, 2).join(', ')}` : undefined}
                  sub={m.at.slice(11, 16)}
                  value={String(m.kcal)}
                  valueUnit="kcal"
                  trailing={
                    <Pressable onPress={() => app.removeMeal(m.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={C.textGhost} />
                    </Pressable>
                  }
                />
              </View>
            ))
          )}
        </Card>
      </View>
    </Screen>
  );
}

function Tool({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: C.card,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radius,
        paddingVertical: 18,
        alignItems: 'center',
        gap: 8,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Ionicons name={icon} size={20} color={C.accent} />
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}
