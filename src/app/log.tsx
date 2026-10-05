import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomFoodForm } from '../components/CustomFoodForm';
import { IconButton } from '../components/TopBarActions';
import { addDays, localHHMM, toISODate } from '../core/date';
import { newId } from '../core/id';
import { defaultPortion, foodName, portionLabel, recentFoodIds, searchFoods, toMealItem } from '../core/foods';
import { mealTypeForHour } from '../core/nutrition';
import type { FoodItem, MealItem, MealType } from '../core/types';
import { makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { BiText, Btn, Card, Divider, Empty, Field, ListRow, Micro, Pill, Row, SectionHeader, Segmented } from '../ui/components';
import { TopBar } from '../ui/TopBar';
import { C, F, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function LogScreen() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const insets = useSafeAreaInsets();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
  const wide = useBreakpoint() === 'desktop';

  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState<MealType>(() => mealTypeForHour(app.hour));
  const [basket, setBasket] = useState<{ food: FoodItem; count: number; unit: string }[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

  const results = useMemo(() => searchFoods(app.foods, query, 30), [app.foods, query]);
  const todayMeals = app.state.meals.filter((m) => m.date === app.today);
  const recents = useMemo(() => {
    const ids = recentFoodIds(app.state.meals, addDays(app.today, -30), 8);
    return ids.map((id) => app.foods.find((f) => f.id === id)).filter((f): f is FoodItem => !!f);
  }, [app.state.meals, app.foods, app.today]);
  const yesterdaySame = app.state.meals.find((m) => m.date === addDays(app.today, -1) && m.type === mealType);

  const basketItems: MealItem[] = basket.map((b) => {
    const p = b.food.portions.find((x) => x.unit === b.unit) ?? defaultPortion(b.food);
    return toMealItem(b.food, (p?.grams ?? 100) * b.count);
  });
  const basketKcal = basketItems.reduce((a, i) => a + i.kcal, 0);
  const basketProtein = Math.round(basketItems.reduce((a, i) => a + i.protein, 0));

  function addToBasket(food: FoodItem) {
    fb.haptic('light');
    setBasket((b) => {
      const existing = b.find((x) => x.food.id === food.id);
      if (existing) return b.map((x) => (x.food.id === food.id ? { ...x, count: x.count + 0.5 } : x));
      return [...b, { food, count: 1, unit: food.default_portion }];
    });
  }

  function saveMeal() {
    if (basketItems.length === 0) return;
    const now = new Date();
    app.addMeal({ id: newId(), at: now.toISOString(), date: toISODate(now), type: mealType, items: basketItems, kcal: basketKcal, protein: basketProtein });
    setBasket([]);
    setQuery('');
    fb.haptic('success');
    fb.notify(t('toast_meal_saved').replace('{kcal}', String(basketKcal)));
  }

  function repeatYesterday() {
    if (!yesterdaySame) return;
    const now = new Date();
    app.addMeal({ ...yesterdaySame, id: newId(), at: now.toISOString(), date: toISODate(now), note: undefined });
    fb.haptic('success');
    fb.notify(t('toast_meal_saved').replace('{kcal}', String(yesterdaySame.kcal)));
  }

  function saveWeight() {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg < 25 || kg > 350) return;
    app.addWeight({ date: app.today, kg });
    setWeightInput('');
    fb.notify(`${kg} ${t('unit_kg')}`);
  }

  function addGlass() {
    app.addWater(app.state.settings.glassMl);
    fb.haptic('light');
    fb.notify(t('toast_water_added'));
  }

  const glasses = Math.round(app.waterToday / app.state.settings.glassMl);
  const glassGoal = Math.round(app.state.settings.waterGoalMl / app.state.settings.glassMl);

  const quickRow = (
    <Row style={{ gap: 10, alignItems: 'stretch' }}>
      <View style={{ flex: 1, backgroundColor: C.card, borderWidth: S.hairline, borderColor: C.border, borderRadius: S.radius, padding: 14, gap: 6 }}>
        <Pressable onPress={addGlass} style={({ pressed }) => ({ gap: 4, opacity: pressed ? 0.7 : 1 })}>
          <Row style={{ gap: 6 }}>
            <Ionicons name="water-outline" size={15} color={C.cyan} />
            <Micro>{en('water')}</Micro>
          </Row>
          <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '300' }}>
            +1 <Text style={{ color: C.textFaint, fontSize: F.small }}>{`${glasses} / ${glassGoal}`}</Text>
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            app.undoWater();
            fb.notify(t('undo'));
          }}
          disabled={app.waterToday === 0}
          accessibilityLabel={t('undo')}
          style={({ pressed }) => ({ opacity: app.waterToday === 0 ? 0.3 : pressed ? 0.6 : 1, alignSelf: 'flex-start' })}>
          <Micro color={C.textDim}>{t('undo')}</Micro>
        </Pressable>
      </View>
      <View style={{ flex: 1, backgroundColor: C.card, borderWidth: S.hairline, borderColor: C.border, borderRadius: S.radius, padding: 14, gap: 6 }}>
        <Micro>{en('add_weight')}</Micro>
        <Row style={{ gap: 8 }}>
          <Field value={weightInput} onChangeText={setWeightInput} keyboardType="numeric" placeholder={`${app.state.profile.weightKg}`} />
          <Pressable onPress={saveWeight} disabled={!weightInput.trim()} hitSlop={6} accessibilityLabel={t('save')} style={{ opacity: weightInput.trim() ? 1 : 0.35, justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={26} color={C.accent} />
          </Pressable>
        </Row>
      </View>
    </Row>
  );

  const tools = (
    <Row style={{ gap: 8 }}>
      <Btn small tone="soft" icon={<Ionicons name="camera-outline" size={15} color={C.accent} />} label={t('add_photo')} onPress={() => router.push('/photo')} style={{ flex: 1 }} />
      <Btn small tone="soft" icon={<Ionicons name="barcode-outline" size={15} color={C.accent} />} label={t('scan_barcode')} onPress={() => router.push('/scan')} style={{ flex: 1 }} />
    </Row>
  );

  const searchBlock = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('add_food')} meta={t(mealType)} />
      <Segmented value={mealType} onChange={setMealType} options={MEAL_TYPES.map((m) => ({ key: m, label: en(m) }))} />
      <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} autoFocus={!wide} />
      {query.trim() === '' && (recents.length > 0 || yesterdaySame) ? (
        <View style={{ gap: 8 }}>
          <Micro>{t('recent')}</Micro>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {yesterdaySame ? <Pill label={`↻ ${t('same_as_yesterday')} · ${yesterdaySame.kcal} kcal`} tone={C.accent} textColor={C.text} onPress={repeatYesterday} /> : null}
            {recents.map((f) => (
              <Pill key={f.id} label={lang === 'en' ? f.name_en : `${f.name_en} · ${foodName(f, lang)}`} onPress={() => addToBasket(f)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  const basketCard =
    basket.length > 0 ? (
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
                  <Pill key={n} label={`${n}x`} active={b.count === n} onPress={() => setBasket((x) => x.map((y) => (y.food.id === b.food.id ? { ...y, count: n } : y)))} />
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
        {wide ? (
          <>
            <Divider />
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{basketKcal}</Text>
                <Micro>{`kcal · ${basketProtein} g ${en('protein')}`}</Micro>
              </View>
              <Btn label={t('save')} onPress={saveMeal} />
            </Row>
          </>
        ) : null}
      </Card>
    ) : null;

  const resultsCard = (
    <Card>
      {results.length === 0 ? (
        <View style={{ gap: 10 }}>
          <Empty text={t('no_results')} />
          <Btn small tone="soft" label={query.trim() ? t('add_as_custom').replace('{q}', query.trim()) : t('custom_food')} onPress={() => setCustomOpen(true)} />
        </View>
      ) : (
        <>
          {results.slice(0, 20).map((f, i) => {
            const p = defaultPortion(f);
            const kcal = p ? Math.round((f.kcal_100g * p.grams) / 100) : f.kcal_100g;
            return (
              <View key={f.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow title={f.name_en} alt={lang === 'en' ? undefined : f.name_mr} sub={p ? portionLabel(p, lang) : undefined} value={String(kcal)} valueUnit="kcal" onPress={() => addToBasket(f)} trailing={<Ionicons name="add" size={17} color={C.accent} />} />
              </View>
            );
          })}
          <Divider />
          <Btn small tone="ghost" label={t('custom_food')} onPress={() => setCustomOpen(true)} />
        </>
      )}
    </Card>
  );

  const customForm = customOpen ? (
    <CustomFoodForm
      initialName={query}
      onSaved={(f) => {
        setCustomOpen(false);
        addToBasket(f);
        setQuery('');
      }}
      onCancel={() => setCustomOpen(false)}
    />
  ) : null;

  const todayCard = (
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
                sub={localHHMM(m.at)}
                value={String(m.kcal)}
                valueUnit="kcal"
                trailing={
                  <Pressable onPress={() => app.removeMeal(m.id)} hitSlop={8} accessibilityLabel={t('delete')}>
                    <Ionicons name="trash-outline" size={16} color={C.textGhost} />
                  </Pressable>
                }
              />
            </View>
          ))
        )}
      </Card>
    </View>
  );

  const bar = (
    <TopBar title={en('tab_log')} alt={lang === 'en' ? undefined : t('tab_log')} right={<IconButton name="close" label={t('close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />} />
  );

  const scroll = { padding: S.pad, gap: S.gap } as const;

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {bar}
        <View style={{ flex: 1, flexDirection: 'row', maxWidth: S.maxWide, width: '100%', alignSelf: 'center' }}>
          <ScrollView style={{ flex: 1.2 }} contentContainerStyle={{ ...scroll, paddingHorizontal: S.gutterWide }} keyboardShouldPersistTaps="handled">
            {tools}
            {searchBlock}
            {customForm}
            {resultsCard}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...scroll, paddingHorizontal: S.gutterWide }} keyboardShouldPersistTaps="handled">
            {quickRow}
            {basketCard}
            {todayCard}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {bar}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...scroll, maxWidth: 780, width: '100%', alignSelf: 'center', paddingBottom: basket.length > 0 ? 120 : 40 }} keyboardShouldPersistTaps="handled">
        {quickRow}
        {tools}
        {searchBlock}
        {basketCard}
        {customForm}
        {resultsCard}
        {todayCard}
      </ScrollView>
      {basket.length > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: S.pad,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: C.bgAlt,
            borderTopWidth: S.hairline,
            borderTopColor: C.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{basketKcal}</Text>
            <Micro>{`${basket.length} ${t('items').toLowerCase()} · ${basketProtein} g ${en('protein')}`}</Micro>
          </View>
          <Btn label={t('save')} onPress={saveMeal} style={{ minWidth: 120 }} />
        </View>
      ) : null}
    </View>
  );
}
