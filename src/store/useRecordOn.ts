import { useCallback, useMemo } from 'react';
import { dayRecord, mealsByDate, type DayRecord } from '../core/record';
import type { ISODate } from '../core/types';
import { useApp } from './AppProvider';

/**
 * A day's record (`dayRecord`) from the store, on the menu as it shows: the
 * one way Progress and its calendar read the record, so they never judge a
 * day two ways. The meals are grouped by date once, so a month of days stays
 * cheap.
 */
export function useRecordOn(): (date: ISODate) => DayRecord {
  const { state, today, menuOn } = useApp();
  const { meals, routine, slotSkips, settings } = state;
  const offDays = settings.offDays;
  const byDate = useMemo(() => mealsByDate(meals), [meals]);
  return useCallback(
    (date: ISODate) => dayRecord({ date, today, menu: menuOn(date), routine, meals: byDate.get(date) ?? [], skips: slotSkips, offDays: offDays ?? [] }),
    [today, menuOn, routine, byDate, slotSkips, offDays],
  );
}
