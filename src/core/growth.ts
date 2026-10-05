import { addDays, lastNDates } from './date';
import { minutesOn } from './usage';
import type { UsageBucket } from './usage';
import type { ISODate, Meal, MoodLog, SleepLog, WaterLog, WeightLog, WorkoutLog } from './types';

export type Period = 'today' | 'week' | 'month';

export const PERIOD_DAYS: Record<Period, number> = { today: 1, week: 7, month: 30 };

export function rangeFor(period: Period, today: ISODate): ISODate[] {
  return lastNDates(PERIOD_DAYS[period], today);
}

/** The window immediately before this one, for the change figures. */
export function previousRangeFor(period: Period, today: ISODate): ISODate[] {
  const n = PERIOD_DAYS[period];
  return lastNDates(n, addDays(today, -n));
}

export type GrowthData = {
  meals: Meal[];
  water: WaterLog[];
  weights: WeightLog[];
  sleep: SleepLog[];
  moods: MoodLog[];
  workouts: WorkoutLog[];
  usage: UsageBucket[];
  kcalTarget: number;
  waterGoalMl: number;
};

export type Metric = {
  key: string;
  value: number;
  previous: number | null;
  /** Whether a rise is a good thing, so the arrow can be coloured honestly. */
  higherIsBetter: boolean;
  unit: string;
  decimals?: number;
};

export type GrowthSummary = {
  period: Period;
  dates: ISODate[];
  metrics: Metric[];
  kcalSeries: { date: ISODate; value: number }[];
  weightSeries: { date: ISODate; value: number }[];
  sleepSeries: { date: ISODate; value: number }[];
  screenSeries: { date: ISODate; value: number }[];
  consistency: { date: ISODate; logged: boolean; onTarget: boolean; moved: boolean }[];
};

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function kcalByDate(meals: Meal[]): Map<ISODate, number> {
  const m = new Map<ISODate, number>();
  for (const meal of meals) m.set(meal.date, (m.get(meal.date) ?? 0) + meal.kcal);
  return m;
}

function waterByDate(water: WaterLog[]): Map<ISODate, number> {
  const m = new Map<ISODate, number>();
  for (const w of water) m.set(w.date, (m.get(w.date) ?? 0) + w.ml);
  return m;
}

type Slice = {
  kcalAvg: number;
  onTargetDays: number;
  loggedDays: number;
  workoutDays: number;
  workoutMinutes: number;
  sleepAvg: number;
  waterAvg: number;
  moodAvg: number;
  screenAvg: number;
  weightChange: number;
};

function sliceFor(dates: ISODate[], d: GrowthData): Slice {
  const kcal = kcalByDate(d.meals);
  const water = waterByDate(d.water);
  const inRange = new Set(dates);

  const loggedDates = dates.filter((x) => (kcal.get(x) ?? 0) > 0);
  const kcalValues = loggedDates.map((x) => kcal.get(x) ?? 0);
  // "On target" means within 10 percent of the goal, not exactly on it.
  const onTargetDays = loggedDates.filter((x) => {
    const v = kcal.get(x) ?? 0;
    return v > 0 && v <= d.kcalTarget * 1.1;
  }).length;

  const workouts = d.workouts.filter((w) => inRange.has(w.date) && w.status === 'done');
  const sleeps = d.sleep.filter((s) => inRange.has(s.date));
  const moods = d.moods.filter((m) => inRange.has(m.date));
  const waters = dates.map((x) => water.get(x) ?? 0).filter((v) => v > 0);
  const weights = d.weights.filter((w) => inRange.has(w.date)).sort((a, b) => a.date.localeCompare(b.date));

  return {
    kcalAvg: Math.round(avg(kcalValues)),
    onTargetDays,
    loggedDays: loggedDates.length,
    workoutDays: workouts.length,
    workoutMinutes: workouts.reduce((a, w) => a + w.minutes, 0),
    sleepAvg: Math.round(avg(sleeps.map((s) => s.minutes))),
    waterAvg: Math.round(avg(waters)),
    moodAvg: Math.round(avg(moods.map((m) => m.score)) * 10) / 10,
    screenAvg: Math.round(avg(dates.map((x) => minutesOn(d.usage, x)).filter((v) => v > 0))),
    weightChange: weights.length >= 2 ? Math.round((weights[weights.length - 1].kg - weights[0].kg) * 10) / 10 : 0,
  };
}

export function summarize(period: Period, today: ISODate, d: GrowthData): GrowthSummary {
  const dates = rangeFor(period, today);
  const prevDates = previousRangeFor(period, today);
  const now = sliceFor(dates, d);
  const before = sliceFor(prevDates, d);
  const hasPrevious = before.loggedDays > 0;

  const kcal = kcalByDate(d.meals);

  const metrics: Metric[] = [
    { key: 'avg_kcal', value: now.kcalAvg, previous: hasPrevious ? before.kcalAvg : null, higherIsBetter: false, unit: 'kcal' },
    { key: 'on_target', value: now.onTargetDays, previous: hasPrevious ? before.onTargetDays : null, higherIsBetter: true, unit: 'days' },
    { key: 'logged_days', value: now.loggedDays, previous: hasPrevious ? before.loggedDays : null, higherIsBetter: true, unit: 'days' },
    { key: 'workout_days', value: now.workoutDays, previous: hasPrevious ? before.workoutDays : null, higherIsBetter: true, unit: 'days' },
    { key: 'move_minutes', value: now.workoutMinutes, previous: hasPrevious ? before.workoutMinutes : null, higherIsBetter: true, unit: 'min' },
    { key: 'avg_sleep', value: now.sleepAvg, previous: hasPrevious ? before.sleepAvg : null, higherIsBetter: true, unit: 'min' },
    { key: 'avg_water', value: now.waterAvg, previous: hasPrevious ? before.waterAvg : null, higherIsBetter: true, unit: 'ml' },
    { key: 'avg_mood', value: now.moodAvg, previous: hasPrevious ? before.moodAvg : null, higherIsBetter: true, unit: '/5', decimals: 1 },
    { key: 'screen_time', value: now.screenAvg, previous: hasPrevious ? before.screenAvg : null, higherIsBetter: false, unit: 'min' },
    { key: 'weight_change', value: now.weightChange, previous: hasPrevious ? before.weightChange : null, higherIsBetter: false, unit: 'kg', decimals: 1 },
  ];

  return {
    period,
    dates,
    metrics,
    kcalSeries: dates.map((date) => ({ date, value: kcal.get(date) ?? 0 })),
    weightSeries: d.weights
      .filter((w) => dates.includes(w.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((w) => ({ date: w.date, value: w.kg })),
    sleepSeries: dates.map((date) => ({ date, value: d.sleep.find((s) => s.date === date)?.minutes ?? 0 })),
    screenSeries: dates.map((date) => ({ date, value: minutesOn(d.usage, date) })),
    consistency: dates.map((date) => {
      const v = kcal.get(date) ?? 0;
      return {
        date,
        logged: v > 0,
        onTarget: v > 0 && v <= d.kcalTarget * 1.1,
        moved: d.workouts.some((w) => w.date === date && w.status === 'done'),
      };
    }),
  };
}

/** Percentage change, or null when there is nothing to compare against. */
export function changePct(m: Metric): number | null {
  if (m.previous === null || m.previous === 0) return null;
  return Math.round(((m.value - m.previous) / Math.abs(m.previous)) * 100);
}

export function trendDirection(m: Metric): 'up' | 'down' | 'flat' {
  if (m.previous === null) return 'flat';
  if (m.value > m.previous) return 'up';
  if (m.value < m.previous) return 'down';
  return 'flat';
}

export function isImprovement(m: Metric): boolean | null {
  const dir = trendDirection(m);
  if (dir === 'flat') return null;
  return m.higherIsBetter ? dir === 'up' : dir === 'down';
}
