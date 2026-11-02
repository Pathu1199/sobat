import { lastNDates } from './date';
import type { ISODate, Meal, SleepLog, StepLog, WaterLog, WeightLog } from './types';

/** A day the person takes off: no target, no streak to break, no nagging. */
export function isOffDay(offDays: number[] | undefined, date: ISODate): boolean {
  return !!offDays?.length && offDays.includes(new Date(date + 'T12:00:00').getDay());
}

/** Whether a day's calories are on target: from 70% of the target (below it is under the safe range) to 10% over it. Whole numbers, so a target in tenths cannot tip an edge. */
export function kcalOnTarget(kcal: number, target: number): boolean {
  return kcal * 10 >= target * 7 && kcal * 10 <= target * 11;
}

/**
 * The last seven days as columns: what each day did on the things that
 * decide the week. Pure, so the picture is the same wherever it is drawn.
 */
export type WeekDay = {
  date: ISODate;
  kcal: number;
  logged: boolean;
  /** Against target: 'none' (nothing logged), 'under', 'on' (`kcalOnTarget`), 'over', 'heavy' (20%+); 'off' on a free day. */
  kcalBand: 'none' | 'under' | 'on' | 'over' | 'heavy' | 'off';
  off: boolean;
  waterMl: number;
  waterGoal: boolean;
  sleepMinutes: number | null;
  steps: number;
  weightKg: number | null;
};

export type WeekSummary = {
  days: WeekDay[];
  loggedDays: number;
  /** Days that count: the week minus the free days. */
  trackedDays: number;
  onTargetDays: number;
  heavyDays: number;
  waterGoalDays: number;
  avgKcal: number;
  avgSleepMinutes: number | null;
  weighIns: number;
  weightChange: number | null;
};

export function weekSummary(input: {
  today: ISODate;
  meals: Meal[];
  water: WaterLog[];
  sleep: SleepLog[];
  steps: StepLog[];
  weights: WeightLog[];
  kcalTarget: number;
  waterGoalMl: number;
  offDays?: number[];
}): WeekSummary {
  const dates = lastNDates(7, input.today);
  const days: WeekDay[] = dates.map((date) => {
    const kcal = input.meals.filter((m) => m.date === date).reduce((a, m) => a + m.kcal, 0);
    const target = Math.max(1, input.kcalTarget);
    const ratio = kcal / target;
    const waterMl = input.water.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0);
    const off = isOffDay(input.offDays, date);
    return {
      date,
      kcal,
      off,
      logged: kcal > 0,
      kcalBand: off ? 'off' : kcal === 0 ? 'none' : ratio > 1.2 ? 'heavy' : kcalOnTarget(kcal, target) ? 'on' : ratio > 1.1 ? 'over' : 'under',
      waterMl,
      waterGoal: waterMl >= input.waterGoalMl,
      sleepMinutes: input.sleep.find((s) => s.date === date)?.minutes ?? null,
      steps: input.steps.find((s) => s.date === date)?.count ?? 0,
      weightKg: input.weights.find((w) => w.date === date)?.kg ?? null,
    };
  });
  const tracked = days.filter((d) => !d.off);
  const logged = tracked.filter((d) => d.logged);
  const slept = days.filter((d) => d.sleepMinutes !== null);
  const weighed = days.filter((d) => d.weightKg !== null);
  // Change across the week: the last weigh-in against the most recent one before the window.
  const before = [...input.weights].filter((w) => w.date < dates[0]).sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastInWeek = [...weighed].reverse()[0];
  return {
    days,
    loggedDays: logged.length,
    trackedDays: tracked.length,
    onTargetDays: days.filter((d) => d.kcalBand === 'on' || d.kcalBand === 'under').length,
    heavyDays: days.filter((d) => d.kcalBand === 'heavy').length,
    waterGoalDays: days.filter((d) => d.waterGoal).length,
    avgKcal: logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : 0,
    avgSleepMinutes: slept.length ? Math.round(slept.reduce((a, d) => a + (d.sleepMinutes ?? 0), 0) / slept.length) : null,
    weighIns: weighed.length,
    weightChange: lastInWeek && before ? Math.round((lastInWeek.weightKg! - before.kg) * 10) / 10 : null,
  };
}
