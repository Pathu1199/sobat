import { breakStats, type BreakLog } from './breaks';
import { addDays, lastNDates, localHour } from './date';
import { DAY_ENDS_AT_HOUR } from './nudge';
import { expectedKcalByMinute, openedKcalByMinute, pattern, windowsCloseAt, type PatternSlot } from './pattern';
import { DEFAULT_ROUTINE, DEFAULT_SLOTS } from './routine';
import type { ISODate, Meal, MoodLog, SleepLog, WaterLog, WeightLog, WorkoutLog } from './types';

/** null means 'not known yet today', which is different from a score of zero. */
export type DayScore = {
  date: ISODate;
  eating: number | null;
  movement: number | null;
  water: number | null;
  sleep: number | null;
  mood: number | null;
  total: number;
};

export type LeverKey = 'eating' | 'movement' | 'water' | 'sleep' | 'mood';

/** Movement is only judged once the evening window opens, unless it already happened. */
const MOVEMENT_JUDGED_FROM_HOUR = 18;

/** The four meals of the day, for a running day judged without the person's own pattern. */
const DEFAULT_PATTERN = pattern({ ...DEFAULT_ROUTINE, slots: DEFAULT_SLOTS });

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
  /** Minute of the day, for today. Omit to score a finished day. */
  minutes?: number;
  /** How much water a person on pace would have drunk by now. Only used while running. */
  expectedWaterMl?: number;
  /** The eating pattern a running day is judged by; the four meals of the day when not given or empty. */
  slots?: PatternSlot[];
}): DayScore {
  const slots = input.slots?.length ? input.slots : DEFAULT_PATTERN;
  // Eating is still running until the last slot's window has closed, so a 21:30 dinner is not missed at 21:15.
  const running = input.minutes !== undefined && input.minutes < windowsCloseAt(slots);
  // Water and movement run over the waking day, until 21:00 or the last window's close if later,
  // so a pattern whose last meal is at 17:00 does not end the day for them at 17:45.
  const awake = input.minutes !== undefined && input.minutes < Math.max(DAY_ENDS_AT_HOUR * 60, windowsCloseAt(slots));
  // Mid-day, judge against the person's own pattern: on pace anywhere from what is due by
  // now to all the slots whose window has opened, so a breakfast eaten as its window opens
  // is not over and a lunch not yet eaten as its window opens is not under. Judging a
  // half-eaten day against the full target reads as failure at breakfast.
  const denominator = running
    ? Math.max(1, Math.min(Math.max(input.kcal, expectedKcalByMinute(input.kcalTarget, input.minutes!, slots)), openedKcalByMinute(input.kcalTarget, input.minutes!, slots)))
    : input.kcalTarget;

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

  let movement: number | null;
  if (input.workedOut) movement = clamp100(60 + Math.min(input.workoutMinutes, 40));
  else if (awake && input.minutes! < MOVEMENT_JUDGED_FROM_HOUR * 60) movement = null;
  else movement = 0;

  let water: number | null;
  if (awake && input.expectedWaterMl !== undefined) {
    water = input.expectedWaterMl <= 0 ? null : clamp100((input.waterMl / input.expectedWaterMl) * 100);
  } else {
    water = clamp100((input.waterMl / Math.max(input.waterGoalMl, 1)) * 100);
  }

  const sleep = input.sleepScore === undefined ? null : clamp100(input.sleepScore);
  const mood = input.moodScore === undefined ? null : clamp100(((input.moodScore - 1) / 4) * 100);

  const known = [eating, movement, water, sleep, mood].filter((n): n is number => n !== null);
  const total = known.length > 0 ? clamp100(known.reduce((a, b) => a + b, 0) / known.length) : 0;
  return { date: input.date, eating, movement, water, sleep, mood, total };
}

/** The one known metric doing the most damage, or null when nothing is below 60. */
export function biggestLever(score: DayScore): LeverKey | null {
  const keys: LeverKey[] = ['eating', 'movement', 'water', 'sleep', 'mood'];
  let worst: LeverKey | null = null;
  let worstValue = 60;
  for (const k of keys) {
    const v = score[k];
    if (v !== null && v < worstValue) {
      worst = k;
      worstValue = v;
    }
  }
  return worst;
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

/** A day counts when at least seven in ten offered breaks were taken. */
const BREAK_STREAK_PCT = 70;

/** Consecutive days ending today whose break compliance held up. */
export function breakStreak(logs: BreakLog[], dates: ISODate[]): number {
  const byDate = new Map<ISODate, BreakLog[]>();
  for (const l of logs) {
    const list = byDate.get(l.date);
    if (list) list.push(l);
    else byDate.set(l.date, [l]);
  }
  return streak(dates, (d) => {
    const day = byDate.get(d);
    if (!day || day.length === 0) return false;
    return breakStats(day).compliancePct >= BREAK_STREAK_PCT;
  });
}

const TREND_DAYS = 7;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Each day's weigh-ins as one: their average. Several weigh-ins on one day are that day, counted once. */
function dailyKg(logs: WeightLog[]): Map<ISODate, number> {
  const sums = new Map<ISODate, { kg: number; n: number }>();
  for (const l of logs) {
    const s = sums.get(l.date) ?? { kg: 0, n: 0 };
    sums.set(l.date, { kg: s.kg + l.kg, n: s.n + 1 });
  }
  return new Map(Array.from(sums, ([date, s]) => [date, s.kg / s.n]));
}

/** The days weighed from `from` to `to`, each counting its place in the window: 1 on the first day, 2 on the next, and so on; several weigh-ins on one day count as that day once. Null when there is none. */
export function timeWeightedKg(logs: WeightLog[], from: ISODate, to: ISODate): number | null {
  let sum = 0;
  let weight = 0;
  for (const [date, kg] of dailyKg(logs)) {
    if (date < from || date > to) continue;
    const w = Math.round((Date.parse(`${date}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000) + 1;
    sum += kg * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : null;
}

/**
 * The weight smoothed over time, not over entries: a seven-day window ending
 * at the latest weigh-in on or before today (`asOf`), later days counting
 * more and each day once, so a burst of weigh-ins on a Sunday does not
 * outweigh the week and an old one never stands in for this week. A change
 * over 7, 21 or 30 days compares it with the same window ending at the latest
 * weigh-in on or before that many days back, so someone who weighs in every
 * ten days or every fortnight sees them too. That weigh-in may be at most as
 * far again before it (a week's change reaches back two weeks at most): a
 * change over months is never called one over a week. Null where there is
 * none. Each change comes with its span, the days between the two
 * weigh-ins it compares (a "three weeks" change may span up to six), so a
 * screen says the weeks it really covers. `asOf` lets a screen say when, or
 * leave out a change gone stale.
 */
export function weightTrend(
  logs: WeightLog[],
  today: ISODate,
): {
  current: number;
  change7: number | null;
  change21: number | null;
  change30: number | null;
  span7: number | null;
  span21: number | null;
  span30: number | null;
  asOf: ISODate;
} | null {
  const days = Array.from(dailyKg(logs).keys())
    .filter((d) => d <= today)
    .sort();
  if (days.length === 0) return null;
  const last = days[days.length - 1];
  const at = (end: ISODate) => timeWeightedKg(logs, addDays(end, -(TREND_DAYS - 1)), end);
  const now = at(last) ?? 0;
  const change = (back: number): { kg: number; days: number } | null => {
    const target = addDays(last, -back);
    let end: ISODate | null = null;
    for (const d of days) if (d <= target) end = d;
    if (end === null || end < addDays(target, -back)) return null;
    const then = at(end);
    return then === null ? null : { kg: r1(now - then), days: daysBetween(end, last) };
  };
  const [c7, c21, c30] = [change(7), change(21), change(30)];
  return {
    current: r1(now),
    change7: c7?.kg ?? null,
    change21: c21?.kg ?? null,
    change30: c30?.kg ?? null,
    span7: c7?.days ?? null,
    span21: c21?.days ?? null,
    span30: c30?.days ?? null,
    asOf: last,
  };
}

/** Whole days from `from` to `to`. */
function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
}

export type Correlation = { key: string; strength: number; params: Record<string, string | number> };

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
    const key = addDays(s.date, 1);
    const kcal = byDate.get(key);
    if (kcal !== undefined) pairs.push({ short: s.minutes < 360, kcal });
  }
  const shortDays = pairs.filter((p) => p.short);
  const okDays = pairs.filter((p) => !p.short);
  if (shortDays.length >= 2 && okDays.length >= 2) {
    const diff = Math.round(shortDays.reduce((a, b) => a + b.kcal, 0) / shortDays.length - okDays.reduce((a, b) => a + b.kcal, 0) / okDays.length);
    if (Math.abs(diff) >= 150) {
      out.push({ key: 'sleep_vs_kcal', strength: Math.min(1, Math.abs(diff) / 600), params: { diff: `${diff > 0 ? '+' : ''}${diff}` } });
    }
  }

  // Late-night eating.
  const lateCount = input.meals.filter((m) => localHour(m.at) >= 22).length;
  if (lateCount >= 3) out.push({ key: 'late_eating', strength: Math.min(1, lateCount / 10), params: { n: lateCount } });

  // A repeated snack hour.
  const hourCounts = new Map<number, number>();
  for (const m of input.meals.filter((x) => x.type === 'snack')) {
    const h = localHour(m.at);
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
  if (topCount >= 3) out.push({ key: 'snack_hour', strength: Math.min(1, topCount / 7), params: { h: topHour, n: topCount } });

  // Movement and mood.
  const moodByDate = new Map<ISODate, number>();
  for (const m of input.moods) moodByDate.set(m.date, m.score);
  const moved = input.workouts.filter((w) => w.status === 'done').map((w) => moodByDate.get(w.date)).filter((x): x is number => x !== undefined);
  const allMoods = [...moodByDate.values()];
  if (moved.length >= 3 && allMoods.length >= 5) {
    const a = moved.reduce((x, y) => x + y, 0) / moved.length;
    const b = allMoods.reduce((x, y) => x + y, 0) / allMoods.length;
    if (a - b >= 0.4) out.push({ key: 'move_vs_mood', strength: Math.min(1, (a - b) / 2), params: { d: (a - b).toFixed(1) } });
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
  return { dates, loggedDays, overDays, workoutDays, avgKcal, avgSleepMinutes: avgSleep, trend: weightTrend(input.weights, input.today) };
}
