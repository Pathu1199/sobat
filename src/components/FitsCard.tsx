import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { dayPlan, fullDayPlan } from '../core/dayPlan';
import { foodName, toMealItem } from '../core/foods';
import { newId } from '../core/id';
import { pattern, settledSlotIds, slotStates } from '../core/pattern';
import { avoidedFoodIds, bhajiFor, slotLabel } from '../core/routine';
import type { MealType } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useMinute } from '../services/useWorkSchedule';
import { isOffDay } from '../core/week';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Micro, Pill, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';
import { FoodThumb } from './FoodDetailSheet';

/**
 * What still fits today, meal by meal: "980 kcal left — lunch 420: bhaji,
 * 2 chapati, dal · snack 120: fruit · dinner 440: ...". Each line logs with a
 * tap; a shuffle shows other plates. When what is left is too little, it
 * says stop, plainly.
 */
export function FitsCard({ compact }: { compact?: boolean }) {
  const app = useApp();
  const fb = useFeedback();
  const { state, foods, budget, today, hour } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [seed, setSeed] = useState(0);
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<'rest' | 'day'>('rest');
  const [allMeals, setAllMeals] = useState(false);
  const [swapsFor, setSwapsFor] = useState<string | null>(null);
  const minute = useMinute();
  const slots = useMemo(() => pattern(state.routine), [state.routine]);
  const loggedSlotIds = useMemo(() => {
    const todayMeals = state.meals.filter((m) => m.date === today);
    return settledSlotIds(slotStates({ routine: state.routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: minute, skippedSlots: app.skippedToday }));
  }, [state.routine, state.meals, today, app.targets.kcal, minute, app.skippedToday]);

  const plan = useMemo(() => {
    const base = { foods, avoided: avoidedFoodIds(state.routine), preferred: bhajiFor(state.routine, today), seed, slots };
    return mode === 'day' ? fullDayPlan({ ...base, remaining: app.targets.kcal }) : dayPlan({ ...base, remaining: budget.remaining, hour, loggedSlotIds, nowMinutes: minute });
  }, [mode, app.targets.kcal, budget.remaining, hour, loggedSlotIds, minute, foods, state.routine, today, seed, slots]);

  function log(type: MealType, foodId: string, grams: number, slotId?: string) {
    const food = foods.find((f) => f.id === foodId);
    if (!food) return;
    const item = toMealItem(food, grams);
    app.addMeal({ id: newId(), at: new Date().toISOString(), date: today, type, items: [item], kcal: item.kcal, protein: Math.round(item.protein), slotId });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: item.kcal }));
  }

  const isNow = (s: { id?: string; type: MealType }) => (plan.nowId ? s.id === plan.nowId : s.type === plan.now);
  const labelOf = (s: { id?: string; type: MealType }) => {
    const slot = s.id ? state.routine.slots.find((x) => x.id === s.id) : undefined;
    return (slot && slotLabel(slot, lang)) || t(s.type);
  };
  if (isOffDay(state.settings.offDays, today)) return null;
  if (plan.stop && mode === 'rest') {
    return (
      <Card rail={C.amber}>
        <Row style={{ gap: 10 }}>
          <Ionicons name="hand-left-outline" size={20} color={C.amber} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{t('fits_stop_title')}</Text>
            <Small color={C.textDim}>{plan.remaining > 0 ? fill(t('fits_stop_some'), { kcal: plan.remaining }) : t('fits_stop_over')}</Small>
          </View>
        </Row>
        <Pressable onPress={() => setMode('day')}>
          <Micro color={C.accentText}>{`${t('fits_full_day')} ›`}</Micro>
        </Pressable>
      </Card>
    );
  }
  if (plan.slots.length === 0) return null;

  return (
    <Card rail={C.green}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={{ flex: 1, gap: 2 }}>
          <Micro color={C.textDim}>{t('fits_title')}</Micro>
          <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{mode === 'day' ? fill(t('fits_day_total'), { kcal: plan.remaining }) : fill(t('fits_left'), { kcal: plan.remaining })}</Text>
        </Pressable>
        <Row style={{ gap: 14 }}>
          <Pressable onPress={() => setSeed((s) => s + 1)} accessibilityRole="button" accessibilityLabel={t('fits_shuffle')} hitSlop={8}>
            <Ionicons name="shuffle-outline" size={18} color={C.accent} />
          </Pressable>
          <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={open ? t('show_less') : t('show_more')} accessibilityState={{ expanded: open }} hitSlop={15}>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={C.textFaint} />
          </Pressable>
        </Row>
      </Row>
      {open ? (
        <Row style={{ gap: 6 }}>
          <Pill label={t('fits_rest')} active={mode === 'rest'} onPress={() => setMode('rest')} />
          <Pill label={t('fits_full_day')} active={mode === 'day'} onPress={() => setMode('day')} />
        </Row>
      ) : null}
      {open
        ? plan.slots.filter((s) => !compact || allMeals || mode === 'day' || isNow(s) || plan.slots[0] === s).map((s, i) => (
            <View key={s.id ?? s.type} style={{ gap: 6 }}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <Micro color={mode === 'rest' && isNow(s) ? C.accentText : C.textFaint}>{`${labelOf(s)}${mode === 'rest' && isNow(s) ? ` · ${t('fits_now')}` : ''}`}</Micro>
                <Micro>{`${s.kcal} / ${s.budget} kcal · ${s.protein} g`}</Micro>
              </Row>
              {s.picks.map((p) => (
                <Pressable
                  key={p.food.id}
                  onPress={() => log(s.type, p.food.id, p.grams, s.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
                  <FoodThumb food={p.food} lang={lang} size={30} />
                  <Text style={{ flex: 1, color: C.text, fontSize: F.small }} numberOfLines={1}>
                    {foodName(p.food, lang)}
                    <Text style={{ color: C.textFaint }}>{`  ${p.grams} g`}</Text>
                  </Text>
                  <Text style={{ color: C.textDim, fontSize: F.small }}>{`${p.kcal}`}</Text>
                  <Ionicons name="add-circle-outline" size={16} color={C.accent} />
                </Pressable>
              ))}
              {s.picks.some((p) => p.alts?.length) && compact && swapsFor !== (s.id ?? s.type) ? (
                <Pressable onPress={() => setSwapsFor(s.id ?? s.type)} style={{ paddingLeft: 40, paddingVertical: 2 }}>
                  <Micro color={C.accentText}>{`${t('fits_show_swaps')} ›`}</Micro>
                </Pressable>
              ) : null}
              {s.picks.some((p) => p.alts?.length) && (!compact || swapsFor === (s.id ?? s.type)) ? (
                <View style={{ gap: 2, paddingLeft: 40 }}>
                  {s.picks
                    .filter((p) => p.alts?.length)
                    .map((p) => (
                      <Row key={`alt-${p.food.id}`} style={{ gap: 6, flexWrap: 'wrap' }}>
                        <Micro color={C.textFaint}>{fill(t('fits_swap'), { food: foodName(p.food, lang) })}</Micro>
                        {p.alts!.map((a) => (
                          <Pressable key={a.food.id} onPress={() => log(s.type, a.food.id, a.grams, s.id)} accessibilityRole="button">
                            <Micro color={C.accentText}>{`${foodName(a.food, lang)} (${a.kcal}${p.kcal - a.kcal > 0 ? `, −${p.kcal - a.kcal}` : ''})`}</Micro>
                          </Pressable>
                        ))}
                      </Row>
                    ))}
                </View>
              ) : null}
            </View>
          ))
        : null}
      {open && compact && mode === 'rest' && plan.slots.length > 1 ? (
        <Pressable onPress={() => setAllMeals((a) => !a)} accessibilityRole="button" style={{ paddingVertical: 2 }}>
          <Micro color={C.accentText}>{allMeals ? `${t('fits_hide_rest')} ‹` : `${fill(t('fits_show_rest'), { n: plan.slots.length - 1 })} ›`}</Micro>
        </Pressable>
      ) : null}
      {open ? <Micro color={C.textFaint}>{t('fits_hint')}</Micro> : null}
    </Card>
  );
}
