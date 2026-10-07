import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomFoodForm } from '../components/CustomFoodForm';
import { FoodDetailSheet, FoodThumb, type Chosen } from '../components/FoodDetailSheet';
import { swapText } from '../components/RoutineCard';
import { IconButton } from '../components/TopBarActions';
import { addDays, formatDayLabel, lastNDates, localHHMM } from '../core/date';
import { newId } from '../core/id';
import { defaultPortion, DISH_STYLES, foodName, portionLabel, recentFoodIds, searchFoods, styleOf, suggestMeals, toMealItem, type DishStyle } from '../core/foods';
import { dietFrom } from '../core/memory';
import { MEAL_WINDOWS, mealTypeForHour, sumTotals } from '../core/nutrition';
import { avoidedFoodIds, avoidHits } from '../core/routine';
import type { FoodItem, MealItem, MealType } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Bar, BiText, Btn, Card, Divider, Empty, Field, ListRow, Micro, Pill, Row, SectionHeader, Segmented } from '../ui/components';
import { DateStrip } from '../ui/DateStrip';
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
  // A line is a food, a measure (one of the food's own portions or a household
  // measure) and how many of it. gramsPerUnit is what the measure weighs.
  const [basket, setBasket] = useState<{ food: FoodItem; count: number; unit: string; gramsPerUnit: number }[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  // A tapped result opens its sheet: picture, measure, amount, numbers, then Add.
  const [detail, setDetail] = useState<FoodItem | null>(null);
  const editing = detail ? basket.find((b) => b.food.id === detail.id) ?? null : null;

  const [styleFilter, setStyleFilter] = useState<DishStyle | null>(null);
  const found = useMemo(() => searchFoods(app.foods, query, 30), [app.foods, query]);
  // Dry or gravy is the first thing a Marathi cook asks; offer the chips whenever the results mix styles.
  const stylesPresent = useMemo(() => DISH_STYLES.filter((s) => found.some((f) => styleOf(f) === s)), [found]);
  const results = useMemo(() => (styleFilter ? found.filter((f) => styleOf(f) === styleFilter) : found), [found, styleFilter]);
  // Any day of the last two weeks can be logged; today unless another is picked.
  const [viewDate, setViewDate] = useState(app.today);
  const isToday = viewDate === app.today;
  const stripDates = useMemo(() => [...lastNDates(11, app.today), ...[1, 2, 3].map((n) => addDays(app.today, n))], [app.today]);
  const loggedDates = useMemo(() => new Set(app.state.meals.map((m) => m.date)), [app.state.meals]);
  const dayMeals = app.state.meals.filter((m) => m.date === viewDate);
  const dayKcal = sumTotals(dayMeals.flatMap((m) => m.items)).kcal;

  /** When a meal "happened": now for today, the usual hour of that meal for an earlier day. */
  function atFor(type: MealType): string {
    if (isToday) return new Date().toISOString();
    const h = (MEAL_WINDOWS.find((w) => w.type === type)?.startHour ?? 12) + 1;
    return new Date(`${viewDate}T${String(h).padStart(2, '0')}:00:00`).toISOString();
  }
  const recents = useMemo(() => {
    const ids = recentFoodIds(app.state.meals, addDays(app.today, -30), 8);
    return ids.map((id) => app.foods.find((f) => f.id === id)).filter((f): f is FoodItem => !!f);
  }, [app.state.meals, app.foods, app.today]);
  const yesterdaySame = app.state.meals.find((m) => m.date === addDays(viewDate, -1) && m.type === mealType);

  const basketItems: MealItem[] = basket.map((b) => toMealItem(b.food, b.gramsPerUnit * b.count));
  const basketKcal = basketItems.reduce((a, i) => a + i.kcal, 0);
  const basketProtein = Math.round(basketItems.reduce((a, i) => a + i.protein, 0));

  const avoidRules = app.state.routine.enabled ? app.state.routine.avoid : [];

  // What fits in what is left today, never from the avoid list. Shown where the choosing happens.
  const ideas = useMemo(() => {
    if (!isToday || !app.state.routine.enabled || app.budget.remaining < 150) return [];
    const avoided = avoidedFoodIds(app.state.routine);
    return suggestMeals(app.foods, app.budget.remaining, dietFrom(app.state.memory))
      .filter((o) => !avoided.has(o.food.id))
      .slice(0, 4);
  }, [isToday, app.budget.remaining, app.foods, app.state.routine, app.state.memory]);

  /** Put the routine's suggested swap in place of an avoided food, keeping the portion count. */
  function swapInBasket(fromId: string, toId: string) {
    const to = app.foods.find((f) => f.id === toId);
    if (!to) return;
    fb.haptic('light');
    setBasket((b) =>
      b.some((x) => x.food.id === toId)
        ? b.filter((x) => x.food.id !== fromId)
        : b.map((x) => (x.food.id === fromId ? { food: to, count: 1, unit: to.default_portion, gramsPerUnit: defaultPortion(to)?.grams ?? 150 } : x)),
    );
  }

  function addChosen(c: Chosen) {
    fb.haptic('light');
    setBasket((b) => {
      const rest = b.filter((x) => x.food.id !== c.food.id);
      return [...rest, { food: c.food, count: c.count, unit: c.unit, gramsPerUnit: c.gramsPerUnit }];
    });
    setDetail(null);
    setQuery('');
  }

  function addToBasket(food: FoodItem) {
    fb.haptic('light');
    setBasket((b) => {
      const existing = b.find((x) => x.food.id === food.id);
      if (existing) return b.map((x) => (x.food.id === food.id ? { ...x, count: x.count + 0.5 } : x));
      const p = defaultPortion(food);
      return [...b, { food, count: 1, unit: p?.unit ?? 'bowl', gramsPerUnit: p?.grams ?? 150 }];
    });
  }

  function saveMeal() {
    if (basketItems.length === 0) return;
    app.addMeal({ id: newId(), at: atFor(mealType), date: viewDate, type: mealType, items: basketItems, kcal: basketKcal, protein: basketProtein });
    setBasket([]);
    setQuery('');
    fb.haptic('success');
    fb.notify(t('toast_meal_saved').replace('{kcal}', String(basketKcal)));
  }

  function repeatYesterday() {
    if (!yesterdaySame) return;
    app.addMeal({ ...yesterdaySame, id: newId(), at: atFor(yesterdaySame.type), date: viewDate, note: undefined });
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
            <Micro>{t('water')}</Micro>
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
        <Micro>{t('add_weight')}</Micro>
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

  const dayBlock = (
    <View style={{ gap: 10 }}>
      <DateStrip dates={stripDates} selected={viewDate} onSelect={setViewDate} marked={loggedDates} lang={lang} today={app.today} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <BiText en={isToday ? t('tab_today') : formatDayLabel(viewDate, 'en')} alt={lang === 'en' ? undefined : isToday ? t('tab_today') : formatDayLabel(viewDate, lang)} size={F.small} color={C.textDim} weight="400" />
          <Text style={{ color: dayKcal > app.targets.kcal ? C.red : C.text, fontSize: F.h2, fontWeight: '300' }}>
            {dayKcal}
            <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}>{` / ${app.targets.kcal} kcal`}</Text>
          </Text>
        </Row>
        <Bar value={dayKcal} max={app.targets.kcal} color={dayKcal > app.targets.kcal ? C.red : C.accent} />
      </Card>
    </View>
  );

  const searchBlock = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('add_food')} meta={t(mealType)} />
      <Segmented value={mealType} onChange={setMealType} options={MEAL_TYPES.map((m) => ({ key: m, label: en(m) }))} />
      <Field value={query} onChangeText={(v) => { setQuery(v); setStyleFilter(null); }} placeholder={t('search_food')} autoFocus={!wide} />
      {query.trim() !== '' && stylesPresent.length > 1 ? (
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {stylesPresent.map((s) => (
            <Pill key={s} label={t(`style_${s}`)} active={styleFilter === s} onPress={() => setStyleFilter(styleFilter === s ? null : s)} />
          ))}
        </Row>
      ) : null}
      {query.trim() === '' && ideas.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Micro>{fill(t('ideas_now'), { kcal: app.budget.remaining })}</Micro>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {ideas.map((o) => (
              <Pill key={o.food.id} label={`${foodName(o.food, lang)} · ${o.kcal} kcal`} tone={C.cyan} textColor={C.text} onPress={() => addToBasket(o.food)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
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
          const own = b.food.portions.find((x) => x.unit === b.unit);
          const measureText = own ? portionLabel(own, lang) : t(`measure_${b.unit}`);
          const item = basketItems[idx];
          const hit = avoidHits([item], avoidRules)[0];
          const swapTo = hit ? app.foods.find((f) => f.id === hit.rule.swapIds[0]) : undefined;
          return (
            <View key={b.food.id} style={{ gap: 8 }}>
              {idx > 0 ? <Divider /> : null}
              <Row style={{ gap: 12 }}>
                <FoodThumb food={b.food} size={40} />
                <Pressable onPress={() => setDetail(b.food)} style={{ flex: 1, gap: 3 }} accessibilityRole="button" accessibilityLabel={t('edit')}>
                  <BiText en={b.food.name_en} alt={lang === 'en' ? undefined : b.food.name_mr} />
                  <Micro>{`${b.count} × ${measureText} · ${item.grams} g · ${t('edit')} ›`}</Micro>
                </Pressable>
                <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
                  {item.kcal}
                  <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '400' }}> kcal</Text>
                </Text>
                <Pressable onPress={() => setBasket((x) => x.filter((y) => y.food.id !== b.food.id))} hitSlop={10} accessibilityLabel={t('delete')}>
                  <Ionicons name="close-circle" size={22} color={C.textFaint} />
                </Pressable>
              </Row>
              {hit ? (
                <Row style={{ gap: 8, alignItems: 'flex-start' }}>
                  <Ionicons name="swap-horizontal" size={14} color={C.amber} style={{ marginTop: 2 }} />
                  <Text style={{ color: C.amber, fontSize: F.small, lineHeight: 18, flex: 1 }}>{swapText(hit, app.foods, lang)}</Text>
                  {swapTo ? <Pill label={`${t('routine_swap')} → ${foodName(swapTo, lang)}`} tone={C.amber} textColor={C.text} onPress={() => swapInBasket(b.food.id, swapTo.id)} /> : null}
                </Row>
              ) : null}
            </View>
          );
        })}
        {wide ? (
          <>
            <Divider />
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{basketKcal}</Text>
                <Micro>{`kcal · ${basketProtein} g ${t('protein')}`}</Micro>
              </View>
              <Btn label={t('save')} onPress={saveMeal} />
            </Row>
          </>
        ) : null}
      </Card>
    ) : null;

  const resultsCard = query.trim() === '' ? (
    <Btn small tone="soft" icon={<Ionicons name="book-outline" size={15} color={C.accent} />} label={fill(t('browse_foods'), { n: app.foods.length })} onPress={() => router.push('/foods')} />
  ) : (
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
                <ListRow
                  icon={<FoodThumb food={f} size={40} />}
                  title={f.name_en}
                  alt={lang === 'en' ? undefined : f.name_mr}
                  sub={[styleOf(f) ? t(`style_${styleOf(f)}`) : null, p ? portionLabel(p, lang) : null].filter(Boolean).join(' · ')}
                  value={String(kcal)}
                  valueUnit="kcal"
                  onPress={() => setDetail(f)}
                  trailing={<Ionicons name="chevron-forward" size={15} color={C.textGhost} />}
                />
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
      <SectionHeader title={t('logged_intake')} meta={`${dayMeals.length}`} />
      <Card>
        {dayMeals.length === 0 ? (
          <Empty text={t('nothing_logged')} />
        ) : (
          dayMeals.map((m, i) => (
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
    <TopBar title={t('tab_log')} alt={lang === 'en' ? undefined : t('tab_log')} right={<IconButton name="close" label={t('close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />} />
  );

  const scroll = { padding: S.pad, gap: S.gap } as const;

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {bar}
        <View style={{ flex: 1, flexDirection: 'row', maxWidth: S.maxWide, width: '100%', alignSelf: 'center' }}>
          <ScrollView style={{ flex: 1.2 }} contentContainerStyle={{ ...scroll, paddingHorizontal: S.gutterWide }} keyboardShouldPersistTaps="handled">
            {dayBlock}
            {searchBlock}
            {customForm}
            {resultsCard}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...scroll, paddingHorizontal: S.gutterWide }} keyboardShouldPersistTaps="handled">
            {basketCard}
            {tools}
            {quickRow}
            {todayCard}
          </ScrollView>
        </View>
        <FoodDetailSheet food={detail} initial={editing ? { unit: editing.unit, gramsPerUnit: editing.gramsPerUnit, count: editing.count } : null} onAdd={addChosen} onClose={() => setDetail(null)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {bar}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...scroll, maxWidth: 780, width: '100%', alignSelf: 'center', paddingBottom: basket.length > 0 ? 120 : 40 }} keyboardShouldPersistTaps="handled">
        {dayBlock}
        {searchBlock}
        {basketCard}
        {customForm}
        {resultsCard}
        {tools}
        {quickRow}
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
            <Micro>{`${basket.length} ${t('items').toLowerCase()} · ${basketProtein} g ${t('protein')}`}</Micro>
          </View>
          <Btn label={t('save')} onPress={saveMeal} style={{ minWidth: 120 }} />
        </View>
      ) : null}
      <FoodDetailSheet food={detail} initial={editing ? { unit: editing.unit, gramsPerUnit: editing.gramsPerUnit, count: editing.count } : null} onAdd={addChosen} onClose={() => setDetail(null)} />
    </View>
  );
}
