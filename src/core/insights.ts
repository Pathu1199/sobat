import { lastNDates } from './date';
import { expectedKcalByHour } from './nutrition';
import type { ISODate, Meal, MoodLog, SleepLog, WaterLog, WeightLog, WorkoutLog } from './types';

/** null means 'not known yet today', which is different from a score of zero. */
export type DayScore = {
  date: ISODate;
  eating: number | null;
  movement: number;
  water: number;
  sleep: number | null;
  mood: number | null;
  total: number;
};

function clamp100(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreDay(input: {
  date: ISODate;
  kcal: number;
  kcalTarget: number;
  waterMl: number;
  waterGoalMl: number;
  workedOut: boolean;
  workoutMinutes: number;
  sleepScore?: number;
  moodScore?: number;
  /** Hour of day when the day is still running. Omit to score a finished day. */
  hour?: number;
}): DayScore {
  // Mid-day, judge against what a normal eater would have had by now. Judging a
  // half-eaten day against the full target reads as failure at breakfast.
  const running = input.hour !== undefined && input.hour < 21;
  const denominator = running ? Math.max(expectedKcalByHour(input.kcalTarget, input.hour!), 1) : input.kcalTarget;

  let eating: number | null;
  if (input.kcal === 0) {
    eating = running ? null : 0;
  } else if (denominator <= 0) {
    eating = null;
  } else {
    const ratio = input.kcal / denominator;
    // Over the target hurts more than under it, in both modes.
    eating = ratio <= 1 ? clamp100(100 - Math.abs(1 - ratio) * 120) : clamp100(100 - (ratio - 1) * 220);
  }

  const movement = clamp100(input.workedOut ? 60 + Math.min(input.workoutMinutes, 40) : 0);
  const water = clamp100((input.waterMl / Math.max(input.waterGoalMl, 1)) * 100);
  const sleep = input.sleepScore === undefined ? null : clamp100(input.sleepScore);
  const mood = input.moodScore === undefined ? null : clamp100(((input.moodScore - 1) / 4) * 100);

  const known = [eating, movement, water, sleep, mood].filter((n): n is number => n !== null);
  const total = known.length > 0 ? clamp100(known.reduce((a, b) => a + b, 0) / known.length) : 0;
  return { date: input.date, eating, movement, water, sleep, mood, total };
}

/** Consecutive days ending today that pass the test. */
export function streak(dates: ISODate[], has: (d: ISODate) => boolean): number {
  let n = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (has(dates[i])) n++;
    else break;
  }
  return n;
}

/** Weight jumps around daily, so compare 7-day averages instead. */
export function weightTrend(logs: WeightLog[]): { current: number; change7: number | null; change30: number | null } | null {
  if (logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const avg = (arr: WeightLog[]) => arr.reduce((a, b) => a + b.kg, 0) / arr.length;
  const last7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);
  const prev30 = sorted.slice(-37, -30);
  return {
    current: Math.round(avg(last7) * 10) / 10,
    change7: prev7.length ? Math.round((avg(last7) - avg(prev7)) * 10) / 10 : null,
    change30: prev30.length ? Math.round((avg(last7) - avg(prev30)) * 10) / 10 : null,
  };
}

export type Correlation = { key: string; strength: number; detail: string };

/**
 * Very simple pattern spotting on small data. Not statistics, just enough
 * to surface something the user can check against their own memory.
 */
export function findPatterns(input: {
  meals: Meal[];
  sleep: SleepLog[];
  moods: MoodLog[];
  workouts: WorkoutLog[];
  kcalTarget: number;
}): Correlation[] {
  const out: Correlation[] = [];
  const byDate = new Map<ISODate, number>();
  for (const m of input.meals) byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.kcal);

  // Short sleep, then more calories the next day.
  const pairs: { short: boolean; kcal: number }[] = [];
  for (const s of input.sleep) {
    const next = new Date(s.date + 'T12:00:00');
    next.setDate(next.getDate() + 1);
    const key = next.toISOString().slice(0, 10);
    const kcal = byDate.get(key);
    if (kcal !== undefined) pairs.push({ short: s.minutes < 360, kcal });
  }
  const shortDays = pairs.filter((p) => p.short);
  const okDays = pairs.filter((p) => !p.short);
  if (shortDays.length >= 2 && okDays.length >= 2) {
    const diff = Math.round(shortDays.reduce((a, b) => a + b.kcal, 0) / shortDays.length - okDays.reduce((a, b) => a + b.kcal, 0) / okDays.length);
    if (Math.abs(diff) >= 150) {
      out.push({ key: 'sleep_vs_kcal', strength: Math.min(1, Math.abs(diff) / 600), detail: `${diff > 0 ? '+' : ''}${diff} kcal after short sleep` });
    }
  }

  // Late-night eating.
  const lateCount = input.meals.filter((m) => Number(m.at.slice(11, 13)) >= 22).length;
  if (lateCount >= 3) out.push({ key: 'late_eating', strength: Math.min(1, lateCount / 10), detail: `${lateCount} meals after 10pm` });

  // A repeated snack hour.
  const hourCounts = new Map<number, number>();
  for (const m of input.meals.filter((x) => x.type === 'snack')) {
    const h = Number(m.at.slice(11, 13));
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  let topHour = -1;
  let topCount = 0;
  hourCounts.forEach((v, k) => {
    if (v > topCount) {
      topCount = v;
      topHour = k;
    }
  });
  if (topCount >= 3) out.push({ key: 'snack_hour', strength: Math.min(1, topCount / 7), detail: `snack around ${topHour}:00 on ${topCount} days` });

  // Movement and mood.
  const moodByDate = new Map<ISODate, number>();
  for (const m of input.moods) moodByDate.set(m.date, m.score);
  const moved = input.workouts.filter((w) => w.status === 'done').map((w) => moodByDate.get(w.date)).filter((x): x is number => x !== undefined);
  const allMoods = [...moodByDate.values()];
  if (moved.length >= 3 && allMoods.length >= 5) {
    const a = moved.reduce((x, y) => x + y, 0) / moved.length;
    const b = allMoods.reduce((x, y) => x + y, 0) / allMoods.length;
    if (a - b >= 0.4) out.push({ key: 'move_vs_mood', strength: Math.min(1, (a - b) / 2), detail: `mood ${(a - b).toFixed(1)} higher on workout days` });
  }

  return out.sort((x, y) => y.strength - x.strength);
}

export function weeklyStats(input: {
  today: ISODate;
  meals: Meal[];
  water: WaterLog[];
  workouts: WorkoutLog[];
  sleep: SleepLog[];
  weights: WeightLog[];
  kcalTarget: number;
  waterGoalMl: number;
}) {
  const dates = lastNDates(7, input.today);
  const kcalByDate = new Map<ISODate, number>();
  for (const m of input.meals) kcalByDate.set(m.date, (kcalByDate.get(m.date) ?? 0) + m.kcal);
  const loggedDays = dates.filter((d) => (kcalByDate.get(d) ?? 0) > 0).length;
  const overDays = dates.filter((d) => (kcalByDate.get(d) ?? 0) > input.kcalTarget).length;
  const workoutDays = dates.filter((d) => input.workouts.some((w) => w.date === d && w.status === 'done')).length;
  const avgKcal = loggedDays ? Math.round(dates.reduce((a, d) => a + (kcalByDate.get(d) ?? 0), 0) / loggedDays) : 0;
  const sleepDays = input.sleep.filter((s) => dates.includes(s.date));
  const avgSleep = sleepDays.length ? Math.round(sleepDays.reduce((a, s) => a + s.minutes, 0) / sleepDays.length) : 0;
  return { dates, loggedDays, overDays, workoutDays, avgKcal, avgSleepMinutes: avgSleep, trend: weightTrend(input.weights) };
}
