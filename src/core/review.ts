import { lastNDates } from './date';
import { sumTotals } from './nutrition';
import type { Plan } from './plan';
import type { AvoidRule } from './routine';
import { avoidHits } from './routine';
import type { ISODate, Meal, SleepLog, WaterLog, WeightLog, WorkoutLog } from './types';

/**
 * Two weeks of a person's data, reduced to the handful of numbers that
 * explain a stalled scale, as plain sentences the coach can reason from.
 * This is what makes "why am I not losing?" answerable from evidence.
 */
export type JourneyInput = {
  today: ISODate;
  meals: Meal[];
  water: WaterLog[];
  sleep: SleepLog[];
  workouts: WorkoutLog[];
  weights: WeightLog[];
  kcalTarget: number;
  proteinTarget: number;
  waterGoalMl: number;
  avoid: AvoidRule[];
  plan: Plan;
};

export type Journey = {
  days: number;
  loggedDays: number;
  avgKcal: number;
  overDays: number;
  heavyDays: number;
  avgProtein: number;
  avgWaterMl: number;
  avgSleepMin: number | null;
  workoutDays: number;
  weighIns: number;
  avoidSlips: number;
  lateDinners: number;
};

const HEAVY = 1.2;

export function journey(input: JourneyInput, days = 14): Journey {
  const dates = lastNDates(days, input.today);
  const byDate = new Map<ISODate, Meal[]>();
  for (const m of input.meals) if (dates.includes(m.date)) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);
  const logged = [...byDate.keys()];
  const totals = logged.map((d) => sumTotals((byDate.get(d) ?? []).flatMap((m) => m.items)));
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const waterDays = dates.map((d) => input.water.filter((w) => w.date === d).reduce((a, w) => a + w.ml, 0)).filter((ml) => ml > 0);
  const sleepDays = input.sleep.filter((s) => dates.includes(s.date));
  const late = input.meals.filter((m) => dates.includes(m.date) && m.type === 'dinner' && new Date(m.at).getHours() >= 21).length;
  return {
    days,
    loggedDays: logged.length,
    avgKcal: avg(totals.map((t) => t.kcal)),
    overDays: totals.filter((t) => t.kcal > input.kcalTarget).length,
    heavyDays: totals.filter((t) => t.kcal > input.kcalTarget * HEAVY).length,
    avgProtein: avg(totals.map((t) => t.protein)),
    avgWaterMl: avg(waterDays),
    avgSleepMin: sleepDays.length ? avg(sleepDays.map((s) => s.minutes)) : null,
    workoutDays: dates.filter((d) => input.workouts.some((w) => w.date === d && w.status === 'done')).length,
    weighIns: input.weights.filter((w) => dates.includes(w.date)).length,
    avoidSlips: avoidHits(
      input.meals.filter((m) => dates.includes(m.date)).flatMap((m) => m.items),
      input.avoid,
    ).length,
    lateDinners: late,
  };
}

/** The same numbers as sentences, for the coach's context. */
export function journeyFacts(j: Journey, input: Pick<JourneyInput, 'kcalTarget' | 'proteinTarget' | 'waterGoalMl' | 'plan'>): string[] {
  const f = [
    `Last ${j.days} days: food logged on ${j.loggedDays} of ${j.days} days.`,
    `Average ${j.avgKcal} kcal on logged days against a target of ${input.kcalTarget}; over target on ${j.overDays} days, well over (20%+) on ${j.heavyDays}.`,
    `Average protein ${j.avgProtein} g against ${input.proteinTarget} g.`,
    `Average water ${j.avgWaterMl} ml against ${input.waterGoalMl} ml.`,
    j.avgSleepMin !== null ? `Average sleep ${Math.floor(j.avgSleepMin / 60)}h ${j.avgSleepMin % 60}m.` : 'Sleep not logged.',
    `Workouts on ${j.workoutDays} days. Weighed in ${j.weighIns} times. Dinners after 9pm: ${j.lateDinners}. Avoid-list slips: ${j.avoidSlips}.`,
    `Weight: start ${input.plan.startKg} kg, now ${input.plan.currentKg} kg, goal ${input.plan.goalKg} kg; real pace ${input.plan.actualRate ?? 'unknown'} kg/week against ${input.plan.targetRate} planned.`,
  ];
  if (j.loggedDays < j.days * 0.6) f.push('Logging is patchy, so the averages understate real intake; unlogged days are usually the heavier ones.');
  return f;
}

/** Was yesterday a heavy day? The morning after should be about recovery, not punishment. */
export function wasHeavy(meals: Meal[], date: ISODate, kcalTarget: number): boolean {
  const kcal = meals.filter((m) => m.date === date).reduce((a, m) => a + m.kcal, 0);
  return kcal > kcalTarget * HEAVY;
}

export type Win = { key: string; n: number };

/**
 * Small, real things to be glad about this week. Rewards that depend on
 * behaviour the person controls, never on the scale.
 */
export function wins(input: { today: ISODate; meals: Meal[]; water: WaterLog[]; weights: WeightLog[]; workouts: WorkoutLog[]; waterGoalMl: number; streakDays: number }): Win[] {
  const dates = lastNDates(7, input.today);
  const out: Win[] = [];
  if (input.streakDays >= 3) out.push({ key: 'streak', n: input.streakDays });
  const waterGoalDays = dates.filter((d) => input.water.filter((w) => w.date === d).reduce((a, w) => a + w.ml, 0) >= input.waterGoalMl).length;
  if (waterGoalDays >= 2) out.push({ key: 'water_days', n: waterGoalDays });
  const moved = dates.filter((d) => input.workouts.some((w) => w.date === d && w.status === 'done')).length;
  if (moved >= 2) out.push({ key: 'move_days', n: moved });
  if (input.weights.some((w) => dates.includes(w.date))) out.push({ key: 'weighed', n: 1 });
  return out;
}
