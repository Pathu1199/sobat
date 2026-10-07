import { lastNDates } from './date';
import { streak } from './insights';
import type { ISODate, Meal, SleepLog, StepLog, WaterLog, WeightLog, WorkoutLog } from './types';
import { weekSummary } from './week';

/**
 * The game around the climb: points for the things that move the weight,
 * camps reached on the way up, badges for firsts and streaks, and one
 * challenge a week. All derived from the logs, nothing stored, so it can
 * never disagree with the data.
 */
export type GameInput = {
  today: ISODate;
  meals: Meal[];
  water: WaterLog[];
  weights: WeightLog[];
  sleep: SleepLog[];
  steps: StepLog[];
  workouts: WorkoutLog[];
  kcalTarget: number;
  waterGoalMl: number;
  startKg: number;
  goalKg: number;
};

export const LEVELS = ['base', 'camp1', 'camp2', 'camp3', 'camp4', 'summit'] as const;
export type LevelKey = (typeof LEVELS)[number];
const LEVEL_XP = [0, 300, 900, 2000, 4000, 7000];

export type Level = { key: LevelKey; index: number; xp: number; next: number | null; progress: number };

function dayCounts(input: GameInput) {
  const mealDays = new Set(input.meals.map((m) => m.date));
  const waterByDay = new Map<string, number>();
  for (const w of input.water) waterByDay.set(w.date, (waterByDay.get(w.date) ?? 0) + w.ml);
  const waterGoalDays = [...waterByDay.values()].filter((ml) => ml >= input.waterGoalMl).length;
  return { mealDays, waterByDay, waterGoalDays };
}

/** Points: meals 10 each, a water-goal day 15, a weigh-in 25, a night logged 10, a workout 20, plus 5 per streak day. */
export function xp(input: GameInput): number {
  const { waterGoalDays } = dayCounts(input);
  const s = streak(lastNDates(365, input.today), (d) => input.meals.some((m) => m.date === d));
  return input.meals.length * 10 + waterGoalDays * 15 + input.weights.length * 25 + input.sleep.length * 10 + input.workouts.length * 20 + s * 5;
}

export function level(points: number): Level {
  let i = 0;
  while (i + 1 < LEVEL_XP.length && points >= LEVEL_XP[i + 1]) i++;
  const next = i + 1 < LEVEL_XP.length ? LEVEL_XP[i + 1] : null;
  const span = next === null ? 1 : next - LEVEL_XP[i];
  return { key: LEVELS[i], index: i, xp: points, next, progress: next === null ? 1 : (points - LEVEL_XP[i]) / span };
}

export type Badge = { key: string; earned: boolean; progress: number; n: number; target: number };

/** Firsts, streaks and kilos. `progress` is 0..1 towards `target`; `n` is the raw count. */
export function badges(input: GameInput): Badge[] {
  const { mealDays, waterGoalDays } = dayCounts(input);
  const dates = lastNDates(365, input.today);
  const mealStreak = streak(dates, (d) => mealDays.has(d));
  const sorted = [...input.weights].sort((a, b) => a.date.localeCompare(b.date));
  const lost = sorted.length ? Math.max(0, input.startKg - sorted[sorted.length - 1].kg) : 0;
  const total = Math.max(0, input.startKg - input.goalKg);
  const goodNights = input.sleep.filter((s) => s.minutes >= 420).length;
  const stepDays = input.steps.filter((s) => s.count >= 7000).length;
  // Weeks in a row with a weigh-in, counting back from this week.
  let weighWeeks = 0;
  for (let w = 0; w < 52; w++) {
    const end = new Date(input.today + 'T12:00:00');
    end.setDate(end.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const a = start.toISOString().slice(0, 10);
    const b = end.toISOString().slice(0, 10);
    if (input.weights.some((x) => x.date >= a && x.date <= b)) weighWeeks++;
    else break;
  }
  const mk = (key: string, n: number, target: number): Badge => ({ key, n, target, earned: n >= target, progress: Math.min(1, n / target) });
  return [
    mk('first_meal', input.meals.length, 1),
    mk('first_weigh', input.weights.length, 1),
    mk('streak_7', mealStreak, 7),
    mk('streak_30', mealStreak, 30),
    mk('meals_100', input.meals.length, 100),
    mk('water_7', waterGoalDays, 7),
    mk('water_30', waterGoalDays, 30),
    mk('sleep_10', goodNights, 10),
    mk('steps_10', stepDays, 10),
    mk('workouts_10', input.workouts.length, 10),
    mk('weigh_4', weighWeeks, 4),
    mk('kg_1', Math.floor(lost), 1),
    mk('kg_5', Math.floor(lost), 5),
    mk('halfway', total > 0 ? Math.floor((lost / total) * 100) : 0, 50),
    mk('summit', total > 0 ? Math.floor((lost / total) * 100) : 0, 100),
  ];
}

export const CHALLENGES = ['log_all_7', 'water_5', 'steps_4', 'no_heavy', 'sleep_5'] as const;
export type ChallengeKey = (typeof CHALLENGES)[number];
export type Challenge = { key: ChallengeKey; n: number; target: number; done: boolean; progress: number; daysLeft: number };

/** One challenge a week, the same one all week, a different one next week. Progress counts the current week. */
export function weeklyChallenge(input: GameInput, weekStartDay = 0): Challenge {
  const d = new Date(input.today + 'T12:00:00');
  const back = (d.getDay() - weekStartDay + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - back);
  const weekIndex = Math.floor(start.getTime() / (7 * 86400000));
  const key = CHALLENGES[weekIndex % CHALLENGES.length];
  const week = weekSummary({ ...input, today: input.today });
  const inWeek = week.days.filter((x) => x.date >= start.toISOString().slice(0, 10));
  let n = 0;
  let target = 7;
  if (key === 'log_all_7') {
    n = inWeek.filter((x) => x.logged).length;
    target = 7;
  } else if (key === 'water_5') {
    n = inWeek.filter((x) => x.waterGoal).length;
    target = 5;
  } else if (key === 'steps_4') {
    n = inWeek.filter((x) => x.steps >= 7000).length;
    target = 4;
  } else if (key === 'no_heavy') {
    n = inWeek.filter((x) => x.logged && x.kcalBand !== 'heavy').length;
    target = 7;
  } else {
    n = inWeek.filter((x) => (x.sleepMinutes ?? 0) >= 420).length;
    target = 5;
  }
  return { key, n, target, done: n >= target, progress: Math.min(1, n / target), daysLeft: 6 - back };
}

/** Where each weigh-in sits on the climb, 0 at the start weight and 1 at the goal. */
export function climbTrail(weights: WeightLog[], startKg: number, goalKg: number): { date: ISODate; p: number }[] {
  const total = startKg - goalKg;
  if (total <= 0) return [];
  return [...weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => ({ date: w.date, p: Math.round(Math.min(1, Math.max(0, (startKg - w.kg) / total)) * 1000) / 1000 }));
}
