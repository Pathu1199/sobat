import { addDays } from './date';
import type { Targets } from './nutrition';
import type { ISODate, Profile, WeightLog } from './types';

/**
 * The road from the first logged weight to the goal: what has been lost, what
 * is left, and when the goal lands at the chosen rate and at the real pace.
 * Plain arithmetic on the weight log; nothing here asks a model.
 */

export type Stage = 'start' | 'early' | 'halfway' | 'close' | 'done' | 'slipping';

export type Plan = {
  startKg: number;
  currentKg: number;
  goalKg: number;
  lostKg: number;
  toGoKg: number;
  /** kg per week the targets aim for. */
  targetRate: number;
  /** kg per week actually happening over the last month, or null with too little data. */
  actualRate: number | null;
  weeksAtTarget: number | null;
  etaAtTarget: ISODate | null;
  weeksAtActual: number | null;
  etaAtActual: ISODate | null;
  dailyKcal: number;
  proteinG: number;
  stage: Stage;
  daysLogging: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

/** Slope of the last `windowDays` of weights, kg per week. Needs two logs at least a week apart. */
export function actualRateKgPerWeek(logs: WeightLog[], today: ISODate, windowDays = 30): number | null {
  const since = addDays(today, -windowDays);
  const pts = [...logs].filter((w) => w.date >= since).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days < 7) return null;
  // Lost weight is a positive rate, to match the target's sign.
  return r1(((first.kg - last.kg) / days) * 7);
}

function eta(toGo: number, rate: number | null, today: ISODate): { weeks: number | null; date: ISODate | null } {
  if (rate === null || rate <= 0) return { weeks: null, date: null };
  if (toGo <= 0) return { weeks: 0, date: today };
  const days = Math.ceil((toGo / rate) * 7);
  return { weeks: Math.ceil(days / 7), date: addDays(today, days) };
}

export function planFrom(profile: Profile, weights: WeightLog[], targets: Targets, today: ISODate): Plan {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const startKg = sorted[0]?.kg ?? profile.weightKg;
  const currentKg = sorted[sorted.length - 1]?.kg ?? profile.weightKg;
  const goalKg = profile.goalWeightKg > 0 ? profile.goalWeightKg : currentKg;
  const lostKg = r1(startKg - currentKg);
  const toGoKg = r1(Math.max(0, currentKg - goalKg));
  const targetRate = targets.rateKgPerWeek;
  const actualRate = actualRateKgPerWeek(weights, today);
  const atTarget = eta(toGoKg, targetRate, today);
  const atActual = eta(toGoKg, actualRate, today);
  const daysLogging = sorted.length > 0 ? daysBetween(sorted[0].date, today) : 0;

  let stage: Stage;
  const total = startKg - goalKg;
  if (toGoKg <= 0) stage = 'done';
  else if (sorted.length < 2 || daysLogging < 7) stage = 'start';
  else if (actualRate !== null && actualRate < -0.2) stage = 'slipping';
  else if (toGoKg <= 2) stage = 'close';
  else if (total > 0 && lostKg >= total / 2) stage = 'halfway';
  else stage = 'early';

  return {
    startKg,
    currentKg,
    goalKg,
    lostKg,
    toGoKg,
    targetRate,
    actualRate,
    weeksAtTarget: atTarget.weeks,
    etaAtTarget: atTarget.date,
    weeksAtActual: atActual.weeks,
    etaAtActual: atActual.date,
    dailyKcal: targets.kcal,
    proteinG: targets.proteinG,
    stage,
    daysLogging,
  };
}

/**
 * Weigh on one day a week, and if that was missed, be asked again two days
 * later; never more often, since daily readings mislead. Due when nothing has
 * been logged in the last six days and today is the weigh day or two after it.
 */
export function weighInDue(weights: WeightLog[], today: ISODate, weighDay: number): boolean {
  const recent = weights.some((w) => daysBetween(w.date, today) <= 6 && w.date <= today);
  if (recent) return false;
  const wd = new Date(today + 'T12:00:00').getDay();
  return wd === weighDay || wd === (weighDay + 2) % 7;
}

/**
 * Which line to say today. The day number keeps it from repeating the same
 * sentence every morning; the stage keeps it honest about where things are.
 */
export function motivationKey(plan: Plan, today: ISODate): string {
  const n = daysBetween('2026-01-01', today) % 3;
  return `mot_${plan.stage}_${n}`;
}
