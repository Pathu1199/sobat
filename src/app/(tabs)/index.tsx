import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BreakCard } from '../../components/BreakCard';
import { DayReview } from '../../components/DayReview';
import { DayScoreCard } from '../../components/DayScore';
import { DecisionCard } from '../../components/DecisionCard';
import { MealSheet } from '../../components/MealSheet';
import { NowStrip } from '../../components/NowStrip';
import { TipCard } from '../../components/TipCard';
import { IconButton, TopBarActions } from '../../components/TopBarActions';
import { addDays, formatDayLabel, localHHMM, localHour } from '../../core/date';
import { decide } from '../../core/decide';
import { scoreDay } from '../../core/insights';
import { expectedWaterByHour } from '../../core/nudge';
import { sumTotals } from '../../core/nutrition';
import { pendingCount } from '../../core/queue';
import type { Meal } from '../../core/types';
import { makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, ListRow, MeterRow, Micro, Row, Small } from '../../ui/components';
import { HeroRing } from '../../ui/HeroRing';
import { Page } from '../../ui/TopBar';
import { Cols } from '../../ui/tiles';
import { C, F, S } from '../../ui/theme';
import { useBreakpoint } from '../../ui/useBreakpoint';

export default function TodayScreen() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, budget, targets, waterToday, streakDays, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  // The design leads in English with the chosen language beside it.
  const en = makeT('en');
  const hour = new Date().getHours();
  const wide = useBreakpoint() === 'desktop';

  // Today by default; the chevrons under the meals walk back a day at a time.
  const [viewDate, setViewDate] = useState(today);
  const isToday = viewDate === today;
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);

  const greetKey = hour < 12 ? 'good_morning' : hour < 17 ? 'good_afternoon' : 'good_evening';
  const greeting = en(greetKey);
  const greetingAlt = lang === 'en' ? undefined : t(greetKey);

  const dayMeals = state.meals.filter((m) => m.date === viewDate);
  const dayTotals = sumTotals(dayMeals.flatMap((m) => m.items));
  const dayWater = isToday ? waterToday : state.water.filter((w) => w.date === viewDate).reduce((a, w) => a + w.ml, 0);
  const daySteps = state.steps.find((s) => s.date === viewDate)?.count ?? 0;
  const workoutDay = state.workouts.find((w) => w.date === viewDate && w.status === 'done');
  const moodDay = state.moods.filter((m) => m.date === viewDate).slice(-1)[0];
  const sleepDay = state.sleep.find((s) => s.date === viewDate);

  // Today uses the live budget; an earlier day is judged against the full target.
  const dayBudget = isToday
    ? budget
    : {
        target: targets.kcal,
        consumed: dayTotals.kcal,
        remaining: targets.kcal - dayTotals.kcal,
        proteinTarget: targets.proteinG,
        proteinConsumed: Math.round(dayTotals.protein),
      };
  const over = dayBudget.remaining < 0;

  const lateMealDays = useMemo(() => new Set(state.meals.filter((m) => localHour(m.at) >= 22).map((m) => m.date)).size, [state.meals]);

  const decision = useMemo(
    () =>
      decide({
        budget,
        hour,
        waterMl: waterToday,
        waterGoalMl: state.settings.waterGoalMl,
        movedToday: !!state.workouts.find((w) => w.date === today && w.status === 'done'),
        lateMealDays,
      }),
    [budget, hour, waterToday, state.settings.waterGoalMl, state.workouts, today, lateMealDays],
  );

  const score = scoreDay({
    date: viewDate,
    kcal: dayBudget.consumed,
    kcalTarget: dayBudget.target,
    waterMl: dayWater,
    waterGoalMl: state.settings.waterGoalMl,
    workedOut: !!workoutDay,
    workoutMinutes: workoutDay?.minutes ?? 0,
    sleepScore: sleepDay?.score,
    moodScore: moodDay?.score,
    hour: isToday ? hour : undefined,
    expectedWaterMl: isToday ? expectedWaterByHour(hour, state.settings.waterGoalMl) : undefined,
  });

  const queued = pendingCount(state.photoQueue);
  const subtitle = `${formatDayLabel(today, lang)}${streakDays > 0 ? ` · ${streakDays} ${t('streak_days')}` : ''}`;
  const titleName = `${greeting}, ${state.profile.name || 'there'}`;
  const waterMarker = isToday ? expectedWaterByHour(hour, state.settings.waterGoalMl) / Math.max(1, state.settings.waterGoalMl) : undefined;

  function addGlass() {
    app.addWater(state.settings.glassMl);
    fb.haptic('light');
    fb.notify(t('toast_water_added'));
  }

  const heroCard = (
    <Card>
      <View style={wide ? { flexDirection: 'row', gap: 18, alignItems: 'center' } : { alignItems: 'center', gap: 16 }}>
        <HeroRing
          value={dayBudget.consumed}
          max={dayBudget.target}
          size={wide ? 176 : 150}
          color={over ? C.red : C.accent}
          big={String(Math.abs(dayBudget.remaining))}
          caption={over ? t('kcal_over') : t('kcal_left')}
        />
        <View style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch', gap: 13 }}>
          <MeterRow label={en('eaten')} alt={lang === 'en' ? undefined : t('eaten')} value={dayBudget.consumed} total={dayBudget.target} unit="kcal" color={C.accent} />
          <MeterRow label={en('protein')} alt={lang === 'en' ? undefined : t('protein')} value={dayBudget.proteinConsumed} total={dayBudget.proteinTarget} unit="g" color={C.violet} />
          <MeterRow label={en('water')} alt={lang === 'en' ? undefined : t('water')} value={dayWater} total={state.settings.waterGoalMl} unit="ml" color={C.cyan} marker={waterMarker} />
          {daySteps > 0 ? <MeterRow label={en('steps_today')} alt={lang === 'en' ? undefined : t('steps_today')} value={daySteps} total={8000} color={C.green} /> : null}
        </View>
      </View>
      {isToday ? (
        <>
          <Divider />
          <Row style={{ gap: 8 }}>
            <QuickAction icon="add" label={t('add_food')} onPress={() => router.push('/log')} />
            <QuickAction icon="camera-outline" label={t('add_photo')} onPress={() => router.push('/photo')} />
            <QuickAction icon="water-outline" label={t('add_water')} onPress={addGlass} />
          </Row>
        </>
      ) : null}
    </Card>
  );

  const dayLabel = isToday ? t('tab_today') : viewDate === addDays(today, -1) ? t('yesterday') : formatDayLabel(viewDate, lang);

  const mealsBlock = (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 0 }}>
          <IconButton name="chevron-back" label={t('yesterday')} onPress={() => setViewDate(addDays(viewDate, -1))} />
          <Micro color={C.textDim}>{`${t('logged_intake')} · ${dayLabel}`}</Micro>
          <IconButton name="chevron-forward" label={t('tab_today')} disabled={isToday} onPress={() => setViewDate(addDays(viewDate, 1))} />
        </Row>
        <Micro>{`${dayMeals.length} ${dayMeals.length === 1 ? t('session_one') : t('session_many')}`}</Micro>
      </Row>
      <Card>
        {dayMeals.length === 0 ? (
          <Small color={C.textGhost}>{t('nothing_logged')}</Small>
        ) : (
          dayMeals.map((m, i) => <MealRow key={m.id} meal={m} first={i === 0} lang={lang} onPress={() => setOpenMeal(m)} />)
        )}
      </Card>
    </View>
  );

  const rightColumn = (
    <>
      {isToday ? <BreakCard /> : null}
      {isToday ? <NowStrip wide /> : null}
      <DayScoreCard score={score} />
    </>
  );

  if (wide) {
    return (
      <Page title={titleName} alt={greetingAlt} subtitle={subtitle} right={<TopBarActions streak={streakDays} />} wide>
        {queued > 0 ? <Small color={C.cyan}>{(queued === 1 ? t('photos_queued') : t('photos_queued_plural')).replace('{n}', String(queued))}</Small> : null}
        <Cols weights={[1.15, 1, 0.95]}>
          <>
            {heroCard}
            {mealsBlock}
          </>
          <>
            {isToday ? <DecisionCard decision={decision} lang={lang} targets={targets} budget={budget} /> : null}
            {isToday ? <TipCard /> : null}
            {isToday ? <DayReview /> : null}
          </>
          {rightColumn}
        </Cols>
        <Small color={C.textGhost}>{t('medical_note')}</Small>
        <MealSheet meal={openMeal} onClose={() => setOpenMeal(null)} />
      </Page>
    );
  }

  return (
    <Page title={titleName} alt={undefined} subtitle={subtitle} right={<TopBarActions streak={streakDays} />}>
      {queued > 0 ? <Small color={C.cyan}>{(queued === 1 ? t('photos_queued') : t('photos_queued_plural')).replace('{n}', String(queued))}</Small> : null}
      {heroCard}
      {isToday ? <DecisionCard decision={decision} lang={lang} targets={targets} budget={budget} /> : null}
      {isToday ? <NowStrip /> : null}
      <DayScoreCard score={score} />
      {isToday ? <TipCard /> : null}
      {isToday ? <DayReview /> : null}
      {mealsBlock}
      <Small color={C.textGhost}>{t('medical_note')}</Small>
      <MealSheet meal={openMeal} onClose={() => setOpenMeal(null)} />
    </Page>
  );
}

/** One logged meal: type, first items, time, calories. */
export function MealRow({ meal, first, lang, onPress }: { meal: Meal; first: boolean; lang: 'en' | 'mr' | 'hi'; onPress: () => void }) {
  const t = makeT(lang);
  const names = meal.items.map((x) => x.name_en).filter(Boolean);
  const alt = lang !== 'en' ? meal.items.map((x) => x.name_mr).filter(Boolean)[0] : undefined;
  return (
    <View>
      {!first ? <Divider /> : null}
      <ListRow
        icon={<Ionicons name="restaurant-outline" size={15} color={C.textDim} />}
        title={t(meal.type)}
        alt={names[0] ? `· ${names.slice(0, 2).join(', ')}` : alt}
        sub={meal.note === 'needs_review' ? t('needs_review') : `${localHHMM(meal.at)} · ${meal.items.some((x) => x.estimated) ? t('estimated') : t('verified_record')}`}
        value={String(meal.kcal)}
        valueUnit="kcal"
        onPress={onPress}
        trailing={<Ionicons name="chevron-forward" size={15} color={C.textGhost} />}
      />
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: C.cardAlt,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radiusSm,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Ionicons name={icon} size={15} color={C.textDim} />
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}
