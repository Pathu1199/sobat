import { useCallback, useMemo } from 'react';
import { dayStatus } from '../core/abhyas';
import { fitOn } from '../core/menu';
import { perfectDay } from '../core/perfect';
import { mealsByDate, streakStep } from '../core/record';
import type { ISODate } from '../core/types';
import { useApp } from './AppProvider';
import { useRecordOn } from './useRecordOn';

// Finished timers only, so the calendar does not change while a timer runs.
const NO_TIMER = new Date(0);

/**
 * Whether a day was a perfect one (`perfectDay`), from the store: the record
 * as `useRecordOn` reads it (the same one the dot beside the star is drawn
 * from, so the two cannot disagree), by the streak's rule at the user's safe
 * minimum, the routine list's day, and the water drunk. The calendar on
 * Progress puts a gold star on it.
 */
export function usePerfectOn(): (date: ISODate) => boolean {
  const { state, today, abhyas } = useApp();
  const { meals, routine, settings, water, profile } = state;
  const recordOn = useRecordOn();
  const byDate = useMemo(() => mealsByDate(meals), [meals]);
  const waterBy = useMemo(() => {
    const out = new Map<ISODate, number>();
    for (const w of water) out.set(w.date, (out.get(w.date) ?? 0) + w.ml);
    return out;
  }, [water]);
  const floor = fitOn(profile, routine, today).floor;
  const goal = settings.waterGoalMl;
  return useCallback(
    (date: ISODate) => perfectDay({ step: streakStep(recordOn(date).state, byDate.get(date) ?? [], floor), jobs: dayStatus(abhyas, date, NO_TIMER), waterMl: waterBy.get(date) ?? 0, waterGoalMl: goal }),
    [recordOn, byDate, floor, abhyas, waterBy, goal],
  );
}
