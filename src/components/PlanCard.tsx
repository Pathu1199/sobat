import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDayLabel } from '../core/date';
import { foodName, suggestMeals, toMealItem } from '../core/foods';
import { newId } from '../core/id';
import { dietFrom } from '../core/memory';
import { mealTypeForHour } from '../core/nutrition';
import { motivationKey, planFrom } from '../core/plan';
import { avoidedFoodIds } from '../core/routine';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Divider, Micro, Pill, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/** The day's line about where the weight is going, for the top of the Today screen. */
export function useMotivation(): string {
  const { state, targets, today } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const plan = useMemo(() => planFrom(state.profile, state.weights, targets, today), [state.profile, state.weights, targets, today]);
  return fill(t(motivationKey(plan, today)), { lost: plan.lostKg, togo: plan.toGoKg, days: plan.daysLogging });
}

/**
 * Where the weight is going: lost so far, what is left, when the goal lands,
 * and a few meals that fit what is left today. The motivation line itself
 * sits in the hero above, so it is always the first thing read.
 */
export function PlanCard() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, targets, budget, today, hour, foods } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');

  const plan = useMemo(() => planFrom(state.profile, state.weights, targets, today), [state.profile, state.weights, targets, today]);
  const total = Math.max(0, plan.startKg - plan.goalKg);
  const progress = total > 0 ? Math.min(1, Math.max(0, plan.lostKg / total)) : plan.toGoKg <= 0 ? 1 : 0;

  const ideas = useMemo(() => {
    if (budget.remaining < 150 || hour >= 22) return [];
    const avoided = avoidedFoodIds(state.routine);
    return suggestMeals(foods, budget.remaining, dietFrom(state.memory))
      .filter((o) => !avoided.has(o.food.id))
      .slice(0, 3);
  }, [budget.remaining, hour, foods, state.memory, state.routine]);

  function logIdea(idea: (typeof ideas)[number]) {
    const item = toMealItem(idea.food, idea.grams);
    app.addMeal({ id: newId(), at: new Date().toISOString(), date: today, type: mealTypeForHour(hour), items: [item], kcal: item.kcal, protein: Math.round(item.protein) });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: item.kcal }));
  }

  return (
    <Card rail={C.cyan}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro color={C.textDim}>{en('plan_title')}</Micro>
        {plan.daysLogging > 0 ? <Micro>{fill(t('plan_days'), { n: plan.daysLogging })}</Micro> : null}
      </Row>

      <Row style={{ gap: 18 }}>
        <Stat label={t('plan_lost')} value={`${plan.lostKg}`} unit="kg" color={C.cyan} />
        <Stat label={t('plan_to_go')} value={`${plan.toGoKg}`} unit="kg" />
        <Stat label={t('plan_goal')} value={`${plan.goalKg}`} unit="kg" />
      </Row>
      <Bar value={progress} max={1} color={C.cyan} />

      <View style={{ gap: 4 }}>
        {plan.etaAtTarget && plan.toGoKg > 0 ? (
          <Small>{fill(t('plan_goal_by'), { d: formatDayLabel(plan.etaAtTarget, lang), r: plan.targetRate })}</Small>
        ) : null}
        {plan.toGoKg > 0 ? (
          plan.actualRate !== null && plan.etaAtActual ? (
            <Small color={C.textDim}>{fill(t('plan_actual'), { d: formatDayLabel(plan.etaAtActual, lang), r: plan.actualRate })}</Small>
          ) : plan.actualRate !== null ? (
            <Small color={C.amber}>{t('plan_actual_gaining')}</Small>
          ) : (
            <Pressable onPress={() => router.push('/log')}>
              <Small color={C.accent}>{t('plan_actual_none')}</Small>
            </Pressable>
          )
        ) : null}
        <Small color={C.textDim}>{fill(t('plan_daily'), { kcal: plan.dailyKcal, p: plan.proteinG })}</Small>
      </View>

      {ideas.length > 0 ? (
        <>
          <Divider />
          <Micro>{fill(t('plan_next'), { kcal: budget.remaining })}</Micro>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {ideas.map((o) => (
              <Pill key={o.food.id} label={`${foodName(o.food, lang)} · ${o.kcal} kcal`} onPress={() => logIdea(o)} />
            ))}
          </Row>
        </>
      ) : null}
    </Card>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <View style={{ gap: 3, minWidth: 64 }}>
      <Micro>{label}</Micro>
      <Text style={{ color: color ?? C.text, fontSize: F.h2, fontWeight: '300', letterSpacing: -0.5 }}>
        {value}
        <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}> {unit}</Text>
      </Text>
    </View>
  );
}
