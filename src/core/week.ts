import { lastNDates } from './date';
import type { ISODate, Meal, SleepLog, StepLog, WaterLog, WeightLog } from './types';

/**
 * The last seven days as columns: what each day did on the things that
 * decide the week. Pure, so the picture is the same wherever it is drawn.
 */
export type WeekDay = {
  date: ISODate;
  kcal: number;
  logged: boolean;
  /** Against target: 'none' (nothing logged), 'under', 'on' (within 10%), 'over', 'heavy' (20%+). */
  kcalBand: 'none' | 'under' | 'on' | 'over' | 'heavy';
  waterMl: number;
  waterGoal: boolean;
  sleepMinutes: number | null;
  steps: number;
  weightKg: number | null;
};

export type WeekSummary = {
  days: WeekDay[];
  loggedDays: number;
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
}): WeekSummary {
  const dates = lastNDates(7, input.today);
  const days: WeekDay[] = dates.map((date) => {
    const kcal = input.meals.filter((m) => m.date === date).reduce((a, m) => a + m.kcal, 0);
    const ratio = kcal / Math.max(1, input.kcalTarget);
    const waterMl = input.water.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0);
    return {
      date,
      kcal,
      logged: kcal > 0,
      kcalBand: kcal === 0 ? 'none' : ratio > 1.2 ? 'heavy' : ratio > 1.1 ? 'over' : ratio >= 0.7 ? 'on' : 'under',
      waterMl,
      waterGoal: waterMl >= input.waterGoalMl,
      sleepMinutes: input.sleep.find((s) => s.date === date)?.minutes ?? null,
      steps: input.steps.find((s) => s.date === date)?.count ?? 0,
      weightKg: input.weights.find((w) => w.date === date)?.kg ?? null,
    };
  });
  const logged = days.filter((d) => d.logged);
  const slept = days.filter((d) => d.sleepMinutes !== null);
  const weighed = days.filter((d) => d.weightKg !== null);
  // Change across the week: the last weigh-in against the most recent one before the window.
  const before = [...input.weights].filter((w) => w.date < dates[0]).sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastInWeek = [...weighed].reverse()[0];
  return {
    days,
    loggedDays: logged.length,
    onTargetDays: days.filter((d) => d.kcalBand === 'on' || d.kcalBand === 'under').length,
    heavyDays: days.filter((d) => d.kcalBand === 'heavy').length,
    waterGoalDays: days.filter((d) => d.waterGoal).length,
    avgKcal: logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : 0,
    avgSleepMinutes: slept.length ? Math.round(slept.reduce((a, d) => a + (d.sleepMinutes ?? 0), 0) / slept.length) : null,
    weighIns: weighed.length,
    weightChange: lastInWeek && before ? Math.round((lastInWeek.weightKg! - before.kg) * 10) / 10 : null,
  };
}
