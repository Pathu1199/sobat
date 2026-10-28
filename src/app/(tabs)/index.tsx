import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { CaloriesLeft } from '../../components/CaloriesLeft';
import { Celebration } from '../../components/Celebration';
import { CoachLine } from '../../components/CoachLine';
import { DayMenu } from '../../components/DayMenu';
import { DayReview } from '../../components/DayReview';
import { IntakeCard } from '../../components/IntakeCard';
import { MantraCard } from '../../components/MantraCard';
import { MealSheet } from '../../components/MealSheet';
import { StepsCard } from '../../components/StepsCard';
import { SleepTile } from '../../components/tiles/SleepTile';
import { StreakTile } from '../../components/tiles/StreakTile';
import { TileRow } from '../../components/tiles/TileRow';
import { WaterWalkTiles } from '../../components/tiles/WaterWalk';
import { WeightTile } from '../../components/tiles/WeightTile';
import { IconButton } from '../../ui/IconButton';
import { WeekStrip } from '../../components/WeekStrip';
import { addDays, formatDayLabel, isIsoDate, mondayOf } from '../../core/date';
import { dayMode, dayView } from '../../core/dayView';
import { skippedOn } from '../../core/menu';
import { currentSlot, slotStates } from '../../core/pattern';
import { pendingCount } from '../../core/queue';
import { weekRecord } from '../../core/record';
import { dayReviewShown, todayBlocks, withReview, type PairTile } from '../../core/todayLayout';
import type { Meal } from '../../core/types';
import { isOffDay } from '../../core/week';
import { stripSince, weekStrip } from '../../core/weekStrip';
import { fill, makeT } from '../../i18n';
import { useMinute } from '../../services/useWorkSchedule';
import { useApp } from '../../store/AppProvider';
import { Card, Small } from '../../ui/components';
import { Logo } from '../../ui/Logo';
import { STRIP_MARGIN } from '../../ui/stripGeometry';
import { C } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

/**
 * Today: the calories left and the day's menu to tick off. The week strip
 * on top picks the day (?date=, none for today); under the number come the
 * cards the person keeps on, in their order: by default the menu, one coach
 * line and the Water and Walk tiles. A past day is filled in, a future day is
 * planned, in the same place; nothing here logs into a date after today. In
 * the evening the day's review follows, while its reminder is on.
 */
export default function TodayScreen() {
  const app = useApp();
  const router = useRouter();
  const { state, today, targets } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const minute = useMinute();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const viewed = isIsoDate(date) ? date : today;
  const mode = dayMode(viewed, today);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);

  const go = useCallback((d: string) => router.setParams({ date: d === today ? undefined : d }), [router, today]);
  // Stable between renders, so the strip's swipe handler is not made again every minute.
  const onWeek = useCallback((by: -1 | 1) => go(addDays(viewed, 7 * by)), [go, viewed]);

  // The store's own menu for the date, the one its logging and filling read.
  const menu = app.menuOn(viewed);
  const offDays = state.settings.offDays ?? [];
  // Where the record starts: the week strip's first day with a mark, and the first day the menu can miss a meal.
  const since = stripSince(state.profile, state.meals, today);
  const dayMeals = state.meals.filter((m) => m.date === viewed);
  const skippedIds = skippedOn(state.slotSkips, viewed);
  // Today, the slot whose turn it is by the person's own pattern.
  const currentId =
    mode === 'today' ? (currentSlot(slotStates({ routine: state.routine, target: targets.kcal, meals: dayMeals, nowMinutes: minute, skippedSlots: skippedIds }), minute)?.slot.id ?? null) : null;
  const view = dayView({ date: viewed, today, menu, meals: dayMeals, skippedIds, currentId, foods: app.planFoods, lang, offDay: isOffDay(offDays, viewed), startDate: since });
  // Asked once, of the menu shown: whether it is just the app's own suggestion. A past day reads what was eaten instead.
  const suggested = mode !== 'past' && app.isSuggestedMenu(menu);

  // One Monday for the record and the strip, so the dots and the days are the same week.
  const monday = mondayOf(viewed);
  const records = weekRecord({ monday, today, routine: state.routine, meals: state.meals, skips: state.slotSkips, offDays, menuOn: app.menuOn });
  const days = weekStrip({ monday, today, viewed, records, since });

  // The evening review, while its reminder is on: the reminder at 21:30 opens Today, where it is, within the page's five blocks.
  const review = dayReviewShown({ on: state.settings.reminders.dayReview, mode, hour: app.hour, hasData: app.budget.consumed > 0 || state.sleep.some((s) => s.date === today) });

  const queued = pendingCount(state.photoQueue);
  const title = mode === 'today' ? t('tab_today') : viewed === addDays(today, -1) ? t('yesterday') : formatDayLabel(viewed, lang);
  const pairTile = (id: PairTile) =>
    id === 'weight' ? <WeightTile key={id} /> : id === 'sleep' ? <SleepTile key={id} date={viewed} /> : <StreakTile key={id} onPress={() => router.push('/progress')} hint={t('tile_hint_streak')} />;

  return (
    <Page title={title} left={<Logo size={26} />} right={mode === 'today' ? undefined : <IconButton name="today-outline" label={t('today_back')} onPress={() => go(today)} />}>
      {queued > 0 ? <Small color={C.cyan}>{fill(t(queued === 1 ? 'photos_queued' : 'photos_queued_plural'), { n: queued })}</Small> : null}
      <Card>
        {/* The strip reaches over the card's padding, so each day is a finger wide on a 360 point phone (ui/stripGeometry.ts). */}
        <View style={{ marginHorizontal: STRIP_MARGIN }}>
          <WeekStrip days={days} lang={lang} onSelect={go} onWeek={onWeek} />
        </View>
        <CaloriesLeft mode={mode} view={view} suggested={suggested} />
      </Card>
      {/* Days in a row under the safe minimum are said plainly, today only; nothing shows otherwise. */}
      {mode === 'today' ? <IntakeCard /> : null}
      {/* A day still to come has no night to check in yet, so todayBlocks leaves its Sleep tile out; the day's line shows only while it is switched on. */}
      {withReview(todayBlocks(state.settings.todayCards, mode, state.settings.features.mantra), review).map((b, i) => {
        if (b.kind === 'review') return <DayReview key="review" />;
        if (b.kind === 'menu') return <DayMenu key="menu" date={viewed} view={view} menu={menu} onOpenMeal={setOpenMeal} />;
        // The coach and the mantra speak about now; nothing is drunk or walked on a day still to come.
        if (b.kind === 'coach') return mode === 'today' ? <CoachLine key="coach" /> : null;
        // Keyed by the date, so "Added … · Undo" and the sheet of one day never stay on screen for another.
        if (b.kind === 'waterWalk') return mode === 'future' ? null : <WaterWalkTiles key={`waterWalk-${viewed}`} date={viewed} />;
        if (b.kind === 'steps') return <StepsCard key="steps" date={viewed} />;
        if (b.kind === 'mantra') return mode === 'today' ? <MantraCard key="mantra" /> : null;
        return (
          <TileRow key={`pair-${i}`}>
            {b.tiles.map(pairTile)}
            {b.tiles.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </TileRow>
        );
      })}
      <Small color={C.textFaint}>{t('medical_note')}</Small>
      <MealSheet meal={openMeal} onClose={() => setOpenMeal(null)} />
      {mode === 'today' ? <Celebration /> : null}
    </Page>
  );
}
