import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BreakCheckin } from '../../components/BreakCheckin';
import { BreakPanel } from '../../components/BreakPanel';
import { DayReview } from '../../components/DayReview';
import { DayScoreCard } from '../../components/DayScore';
import { DecisionCard } from '../../components/DecisionCard';
import { MealSheet } from '../../components/MealSheet';
import { NotificationNudge } from '../../components/NotificationNudge';
import { NutrientCard } from '../../components/NutrientCard';
import { StartHereCard } from '../../components/StartHereCard';
import { SuggestSheet } from '../../components/SuggestSheet';
import { NowStrip } from '../../components/NowStrip';
import { Celebration } from '../../components/Celebration';
import { CoachStrip } from '../../components/CoachStrip';
import { PlanTodayCard } from '../../components/PlanTodayCard';
import { FitsCard } from '../../components/FitsCard';
import { MountainCard } from '../../components/MountainCard';
import { RecoveryCard } from '../../components/RecoveryCard';
import { RoutineCard } from '../../components/RoutineCard';
import { TomorrowCard } from '../../components/TomorrowCard';
import { TrackerGrid } from '../../components/TrackerGrid';
import { WeighInCard } from '../../components/WeighInCard';
import { TipCard } from '../../components/TipCard';
import { IconButton, TopBarActions } from '../../components/TopBarActions';
import { addDays, formatDayLabel, localHHMM, localHour } from '../../core/date';
import { decide } from '../../core/decide';
import { scoreDay } from '../../core/insights';
import { expectedWaterByHour } from '../../core/nudge';
import { sumTotals } from '../../core/nutrition';
import { pendingCount } from '../../core/queue';
import type { Meal } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useMantra } from '../../services/useMantra';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, ListRow, MeterRow, Micro, Quote, Row, Small } from '../../ui/components';
import { Logo } from '../../ui/Logo';
import { BannerBar, GradientBanner } from '../../ui/GradientBanner';
import { Page } from '../../ui/TopBar';
import { Cols } from '../../ui/tiles';
import { C, F } from '../../ui/theme';
import { useBreakpoint } from '../../ui/useBreakpoint';

export default function TodayScreen() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, budget, targets, waterToday, streakDays, today, hour } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  // The design leads in English with the chosen language beside it.
  const en = makeT('en');
  const wide = useBreakpoint() === 'desktop';
  const mantra = useMantra();
  const [mantraWhy, setMantraWhy] = useState(false);

  // Today by default; the chevrons under the meals walk back a day at a time.
  // Held as an offset, not a date: the day can roll over while the app is open
  // (the desktop build starts with the machine), and an offset follows it.
  const [dayOffset, setDayOffset] = useState(0);
  const viewDate = dayOffset === 0 ? today : addDays(today, dayOffset);
  const isToday = dayOffset === 0;
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  // The phone shows the essentials; the rest waits behind one tap.
  const [more, setMore] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

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


  const heroCard = (
    <Card>
      <View style={{ gap: 14 }}>
        {/* The one number the day is about, on the brand gradient: what is left, and how far through the day's food. */}
        <GradientBanner from={over ? C.red : C.heroFrom} to={over ? C.amber : C.heroTo}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: F.tiny, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{over ? t('kcal_over') : t('kcal_left')}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: F.hero, fontWeight: '800', letterSpacing: -2, lineHeight: F.hero + 4 }}>{Math.abs(dayBudget.remaining).toLocaleString()}</Text>
          <BannerBar value={dayBudget.consumed} max={dayBudget.target} />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: F.small, fontWeight: '600' }}>{`${dayBudget.consumed.toLocaleString()} / ${dayBudget.target.toLocaleString()} kcal · ${dayBudget.proteinConsumed} / ${dayBudget.proteinTarget} g ${t('protein').toLowerCase()}`}</Text>
        </GradientBanner>
        <View style={{ gap: 13 }}>
          <MeterRow label={t('protein')} alt={lang === 'en' ? undefined : t('protein')} value={dayBudget.proteinConsumed} total={dayBudget.proteinTarget} unit="g" color={C.violet} />
          <MeterRow label={t('water')} alt={lang === 'en' ? undefined : t('water')} value={dayWater} total={state.settings.waterGoalMl} unit="ml" color={C.cyan} marker={waterMarker} />
          {daySteps > 0 ? <MeterRow label={t('steps_today')} alt={lang === 'en' ? undefined : t('steps_today')} value={daySteps} total={8000} color={C.green} /> : null}
        </View>
      </View>
      {isToday ? (
        <>
          {mantra ? (
            <Pressable onPress={() => setMantraWhy((w) => !w)} accessibilityRole="button" accessibilityLabel={t('mantra_why')}>
              <Micro color={C.cyan}>{t('mantra_title')}</Micro>
              <View style={{ height: 6 }} />
              <Quote color={C.cyan}>{mantra.text}</Quote>
              {mantraWhy ? (
                <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: 19, marginTop: 8, paddingLeft: 14 }}>{`${mantra.why}\n`}<Text style={{ color: C.textGhost }}>{t('mantra_source')}</Text></Text>
              ) : (
                <Micro color={C.textGhost}>{`${t('mantra_why')} ›`}</Micro>
              )}
            </Pressable>
          ) : null}
          <Divider />
          <Row style={{ gap: 8 }}>
            <QuickAction icon="add" label={t('add_food')} onPress={() => router.push('/log')} />
            <QuickAction icon="camera-outline" label={t('add_photo')} onPress={() => router.push('/photo')} />
            <QuickAction icon="bulb-outline" label={t('suggest')} onPress={() => setSuggestOpen(true)} />
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
          <IconButton name="chevron-back" label={t('yesterday')} onPress={() => setDayOffset((d) => d - 1)} />
          <Micro color={C.textDim}>{`${t('logged_intake')} · ${dayLabel}`}</Micro>
          <IconButton name="chevron-forward" label={t('tab_today')} disabled={isToday} onPress={() => setDayOffset((d) => Math.min(0, d + 1))} />
        </Row>
        <Pressable onPress={() => router.push('/food?s=history')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Micro>{`${dayMeals.length} ${dayMeals.length === 1 ? t('session_one') : t('session_many')}`}</Micro>
          <Micro color={C.accent}>{` · ${t('history')} ›`}</Micro>
        </Pressable>
      </Row>
      {!isToday ? (
        <Pressable
          onPress={() => router.push({ pathname: '/log', params: { date: viewDate } })}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="add-circle-outline" size={18} color={C.accent} />
          <Small color={C.accent}>{fill(t('add_food_for'), { day: dayLabel })}</Small>
        </Pressable>
      ) : null}
      <Card>
        {dayMeals.length === 0 ? (
          <Small color={C.textGhost}>{t('nothing_logged')}</Small>
        ) : (
          dayMeals.map((m, i) => (
            <MealRow
              key={m.id}
              meal={m}
              first={i === 0}
              lang={lang}
              onPress={() => setOpenMeal(m)}
              onDelete={() => {
                app.removeMeal(m.id);
                fb.notify(t('meal_removed'), { label: t('undo'), onPress: () => app.addMeal(m) });
              }}
            />
          ))
        )}
      </Card>
    </View>
  );

  const rightColumn = (
    <>
      {isToday ? <BreakPanel /> : null}
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
            {isToday ? <CoachStrip onSuggest={() => setSuggestOpen(true)} /> : null}
      {isToday ? <PlanTodayCard /> : null}
            {isToday ? <FitsCard /> : null}
            {isToday ? <TrackerGrid /> : null}
            {isToday ? <StartHereCard /> : null}
            {isToday ? <NutrientCard /> : null}
            {isToday ? <NotificationNudge /> : null}
            {isToday ? <WeighInCard /> : null}
            {isToday ? <RecoveryCard /> : null}
            {isToday ? <BreakCheckin /> : null}
            {isToday ? <RoutineCard /> : null}
            {isToday ? <TomorrowCard /> : null}
            {mealsBlock}
          </>
          <>
            {isToday ? <MountainCard /> : null}
            {isToday ? <DecisionCard decision={decision} lang={lang} targets={targets} budget={budget} /> : null}
            {isToday ? <TipCard /> : null}
            {isToday ? <DayReview /> : null}
          </>
          {rightColumn}
        </Cols>
        <Small color={C.textGhost}>{t('medical_note')}</Small>
        <MealSheet meal={openMeal} onClose={() => setOpenMeal(null)} />
        <SuggestSheet open={suggestOpen} onClose={() => setSuggestOpen(false)} />
        {isToday ? <Celebration /> : null}
      </Page>
    );
  }

  return (
    <Page title={state.profile.name || greeting} alt={undefined} subtitle={`${greeting} · ${subtitle}`} left={<Logo size={26} />} right={<TopBarActions streak={streakDays} />}>
      {queued > 0 ? <Small color={C.cyan}>{(queued === 1 ? t('photos_queued') : t('photos_queued_plural')).replace('{n}', String(queued))}</Small> : null}
      {heroCard}
      {isToday ? <CoachStrip onSuggest={() => setSuggestOpen(true)} /> : null}
      {isToday ? <PlanTodayCard /> : null}
      {isToday && !state.weekPlan ? <FitsCard compact /> : null}
      {isToday ? <TrackerGrid /> : null}
      {isToday ? <StartHereCard /> : null}
      {isToday ? <WeighInCard /> : null}
      {isToday ? <RecoveryCard /> : null}
      {isToday ? <BreakCheckin /> : null}
      {isToday ? <RoutineCard /> : null}
      {mealsBlock}
      {isToday ? <MountainCard /> : null}
      <Pressable
        onPress={() => setMore((m) => !m)}
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
        <Micro color={C.textDim}>{`${t('more_today')} · ${t('day_score')} ${score.total}`}</Micro>
        <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={15} color={C.textGhost} />
      </Pressable>
      {more ? (
        <>
          {isToday && state.weekPlan ? <FitsCard compact /> : null}
          {isToday ? <DecisionCard decision={decision} lang={lang} targets={targets} budget={budget} /> : null}
          {isToday ? <NutrientCard /> : null}
          {isToday ? <TomorrowCard /> : null}
          {isToday ? <NotificationNudge /> : null}
          <DayScoreCard score={score} />
          {isToday ? <TipCard /> : null}
          {isToday ? <DayReview /> : null}
        </>
      ) : null}
      <Small color={C.textGhost}>{t('medical_note')}</Small>
      <MealSheet meal={openMeal} onClose={() => setOpenMeal(null)} />
      <SuggestSheet open={suggestOpen} onClose={() => setSuggestOpen(false)} />
      {isToday ? <Celebration /> : null}
    </Page>
  );
}

/** One logged meal: type, first items, time, calories. */
export function MealRow({ meal, first, lang, onPress, onDelete }: { meal: Meal; first: boolean; lang: 'en' | 'mr' | 'hi'; onPress: () => void; onDelete?: () => void }) {
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
        trailing={
          onDelete ? (
            // Edit and delete live on the row, each a 44-point target.
            <Row style={{ gap: 2 }}>
              <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('edit')} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.cardAlt : 'transparent' })}>
                <Ionicons name="create-outline" size={20} color={C.textDim} />
              </Pressable>
              <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={t('delete')} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.redSoft : 'transparent' })}>
                <Ionicons name="trash-outline" size={20} color={C.textDim} />
              </Pressable>
            </Row>
          ) : (
            <Ionicons name="chevron-forward" size={15} color={C.textGhost} />
          )
        }
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
        backgroundColor: C.accentDim,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={C.accent} />
      </View>
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
