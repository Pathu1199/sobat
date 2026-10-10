import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { foodName } from '../core/foods';
import { newId } from '../core/id';
import { KCAL_FLOOR } from '../core/nutrition';
import { planItems, weekdayOf } from '../core/routine';
import { dayStatus, dayTotals, lineInfo, mealTotals, type PlanMeal } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useMinute } from '../services/useWorkSchedule';
import { isOffDay } from '../core/week';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Micro, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

const MEAL_KEY: Record<string, string> = { breakfast: 'breakfast', mid: 'plan_meal_mid', lunch: 'lunch', tea: 'plan_meal_tea', evening: 'plan_meal_evening', dinner: 'dinner', night: 'plan_meal_night' };

/**
 * Today's page of the week plan on the home screen: the day's planned total
 * against the target, and the next meal or two not yet eaten, each logged
 * with one tap. Shows nothing until a plan exists; the plan screen writes it.
 */
export function PlanTodayCard() {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const { state, foods, targets, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const minute = useMinute();
  const plan = state.weekPlan;
  const day = plan?.days[weekdayOf(today)];

  const todayMeals = useMemo(() => state.meals.filter((m) => m.date === today), [state.meals, today]);
  if (isOffDay(state.settings.offDays, today)) {
    return (
      <Pressable onPress={() => router.push('/food?s=plan')} accessibilityRole="button">
        <Card rail={C.cyan}>
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700' }}>{`🌿 ${t('free_day')}`}</Text>
          <Small color={C.textDim}>{t('free_day_today')}</Small>
        </Card>
      </Pressable>
    );
  }
  if (!plan || !day) {
    return (
      <Pressable onPress={() => router.push('/food?s=plan')} accessibilityRole="button">
        <Card rail={C.accent}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Micro color={C.textDim}>{t('diet_title')}</Micro>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>{t('plan_make')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textGhost} />
          </Row>
        </Card>
      </Pressable>
    );
  }

  const totals = dayTotals(day, foods);
  const status = dayStatus(totals.kcal, targets.kcal, KCAL_FLOOR[state.profile.sex]);
  const logged = (meal: PlanMeal) => {
    const ids = new Set(meal.lines.map((l) => l.foodId));
    return todayMeals.some((m) => m.type === meal.type && m.items.some((it) => it.foodId && ids.has(it.foodId)));
  };
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  // The meal that is due or next, then the one after; anything already eaten drops off.
  const upcoming = day.meals.filter((m) => !logged(m) && toMin(m.time) >= minute - 90).slice(0, 2);

  function log(meal: PlanMeal) {
    const items = planItems(meal.lines, foods);
    if (!items.length) return;
    const kcal = items.reduce((a, i) => a + i.kcal, 0);
    app.addMeal({ id: newId(), at: new Date().toISOString(), date: today, type: meal.type, items, kcal, protein: Math.round(items.reduce((a, i) => a + i.protein, 0)) });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal }));
  }

  const color = status === 'low' ? C.red : status === 'on' ? C.green : C.amber;
  return (
    <Card rail={color}>
      <Pressable onPress={() => router.push('/food?s=plan')} accessibilityRole="button">
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Micro color={C.textDim}>{t('plan_today')}</Micro>
            <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700' }}>
              {totals.kcal}
              <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500' }}>{` / ${targets.kcal} kcal`}</Text>
            </Text>
          </View>
          <Row style={{ gap: 6 }}>
            <Micro color={C.accent}>{t('plan_open')}</Micro>
            <Ionicons name="chevron-forward" size={15} color={C.accent} />
          </Row>
        </Row>
      </Pressable>
      {status === 'low' ? <Small color={C.red}>{fill(t('plan_status_low_short'), { gap: targets.kcal - totals.kcal })}</Small> : null}
      {upcoming.length === 0 ? <Small color={C.green}>{t('plan_all_logged')}</Small> : null}
      {upcoming.map((meal) => {
        const mt = mealTotals(meal, foods);
        const names = meal.lines
          .map((l) => {
            const i = lineInfo(l, foods, lang);
            return i ? `${foodName(i.food, lang)}${l.qty !== 1 ? ` ×${l.qty}` : ''}` : null;
          })
          .filter(Boolean)
          .join(', ');
        return (
          <View key={meal.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Micro color={C.accent}>{`${t(MEAL_KEY[meal.id] ?? meal.type)} · ${meal.time}`}</Micro>
              <Micro>{`${mt.kcal} kcal`}</Micro>
            </Row>
            <Row style={{ gap: 10 }}>
              <Text style={{ flex: 1, color: C.text, fontSize: F.small, lineHeight: 20 }} numberOfLines={2}>{names}</Text>
              <Btn small tone="soft" label={t('plan_log_short')} icon={<Ionicons name="checkmark" size={14} color={C.text} />} onPress={() => log(meal)} />
            </Row>
          </View>
        );
      })}
    </Card>
  );
}
