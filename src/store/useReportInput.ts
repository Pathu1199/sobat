import { useCallback, useMemo } from 'react';
import { dayStatus } from '../core/abhyas';
import { useMedals } from '../components/useRewards';
import { atMinute } from '../core/date';
import { compareSpan, dayFacts, type DayFacts, type ReportInput, type ReportPeriod } from '../core/report';
import { mealsByDate } from '../core/record';
import { dayScore } from '../core/teacher';
import { walkMinutesOn, waterMlOn } from '../core/tileText';
import { stripSince } from '../core/weekStrip';
import type { ISODate } from '../core/types';
import { useMinute } from '../services/useClock';
import { useApp } from './AppProvider';
import { usePerfectOn } from './usePerfectOn';
import { useRecordOn } from './useRecordOn';

// Finished timers only for a day's jobs, as the perfect day and the calendar read them.
const NO_TIMER = new Date(0);

/**
 * What `periodReport` and `compareReport` read, from the store: each day as Progress reads it (`useRecordOn`'s record and mark,
 * `usePerfectOn`'s perfect day, `stripSince`'s start), its meals, water, walk and routine, and the teacher's `dayScore` (at the end of
 * a day gone by, at this minute for today). The days of the period and of the span it is compared with are read once, when one of
 * the logs or the period changes, so a re-render never judges up to sixty days again; only today is read again as the minute turns.
 * The medals are the perfect-week medals the shelf holds (`useMedals`).
 */
export function useReportInput(period: ReportPeriod): { input: ReportInput; medalsHeld: number } {
  const app = useApp();
  const { state, today, targets, abhyas } = app;
  const { meals, water, weights, routine, slotSkips, settings, profile } = state;
  const activities = state.activities;
  const recordOn = useRecordOn();
  const perfectOn = usePerfectOn();
  const minute = useMinute();
  const { medals } = useMedals();
  const offDays = settings.offDays;
  const since = stripSince(profile, meals, today);
  const byDate = useMemo(() => mealsByDate(meals), [meals]);

  // One day, judged at `nowMinutes` of it.
  const read = useCallback(
    (date: ISODate, nowMinutes: number): DayFacts => {
      const dayMeals = byDate.get(date) ?? [];
      return dayFacts({
        date,
        today,
        since,
        offDays: offDays ?? [],
        record: recordOn(date),
        // A day still to come can never be a perfect one; the record's mark ('planned') is still read.
        perfect: date > today ? false : perfectOn(date),
        meals: dayMeals,
        waterMl: waterMlOn(water, date),
        walkMin: walkMinutesOn(activities ?? [], date),
        jobs: dayStatus(abhyas, date, NO_TIMER),
        score: dayScore({
          date,
          routine,
          meals: dayMeals,
          skips: slotSkips,
          nowMinutes,
          abhyas,
          now: date === today ? atMinute(today, nowMinutes) : NO_TIMER,
          water,
          activities: activities ?? [],
          waterGoalMl: settings.waterGoalMl,
          walkGoalMin: settings.walkGoalMin,
        }),
      });
    },
    [byDate, today, since, offDays, recordOn, perfectOn, water, activities, abhyas, routine, slotSkips, settings.waterGoalMl, settings.walkGoalMin],
  );

  // The days gone by and the days to come, read once; today is read apart, as the minute turns.
  const others = useMemo(() => {
    const map = new Map<ISODate, DayFacts>();
    for (const date of [...period.dates, ...compareSpan(period, today)]) if (date !== today && !map.has(date)) map.set(date, read(date, date < today ? 1440 : 0));
    return map;
  }, [period, today, read]);
  const now = useMemo(() => read(today, minute), [read, today, minute]);
  const factsOn = useCallback((date: ISODate): DayFacts => (date === today ? now : (others.get(date) ?? read(date, date < today ? 1440 : 0))), [today, now, others, read]);

  const perfectWeekMondays = useMemo(() => medals.flatMap((m) => (m.track === 'week' && m.monday ? [m.monday] : [])), [medals]);
  const input = useMemo<ReportInput>(
    () => ({
      today,
      nowMinutes: minute,
      since,
      offDays: offDays ?? [],
      goals: { kcal: targets.kcal, protein: targets.proteinG, waterMl: settings.waterGoalMl, walkMin: settings.walkGoalMin },
      factsOn,
      weights,
      perfectWeekMondays,
    }),
    [today, minute, since, offDays, targets.kcal, targets.proteinG, settings.waterGoalMl, settings.walkGoalMin, factsOn, weights, perfectWeekMondays],
  );
  return { input, medalsHeld: medals.length };
}
