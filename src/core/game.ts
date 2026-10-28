import { chapterSince } from './chapter';
import type { Targets } from './nutrition';
import { shownPlan, type Plan } from './plan';
import type { AppState, ISODate, Meal, Settings, SleepLog, StepLog, WaterLog, WeightLog, WorkoutLog } from './types';
import { weekSummary } from './week';

/**
 * The game around the climb: points for the things that move the weight,
 * camps reached on the way up, badges for firsts and streaks, and one
 * challenge a week. All derived from the logs, nothing stored, so it can
 * never disagree with the data. The streak is the record's (core/record.ts):
 * full days eaten at or above the safe minimum, a day of meals all skipped
 * ending the run. The streak tile shows it from a new chapter's first day;
 * the points and the streak badges count it over the whole journey
 * (`gameView`). A badge already won (celebrated) is kept.
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
  offDays?: number[];
  /** The first day of a new chapter: the weekly challenge counts from it. */
  since?: ISODate;
  /** Days in a row by the record, as the store works them out (`recordStreak`). */
  streakDays: number;
  /** The best run in the streak's window, by the same rule (`bestStreak`); never less than `streakDays`. */
  bestStreakDays: number;
  /** Wins already celebrated (badge:, level:, challenge: ids): a badge among them stays earned. */
  celebrated?: string[] | null;
};

export const LEVELS = ['base', 'camp1', 'camp2', 'camp3', 'camp4', 'summit'] as const;
export type LevelKey = (typeof LEVELS)[number];
const LEVEL_XP = [0, 300, 900, 2000, 4000, 7000];

export type Level = { key: LevelKey; index: number; xp: number; next: number | null; progress: number };

function dayCounts(input: GameInput) {
  const waterByDay = new Map<string, number>();
  for (const w of input.water) waterByDay.set(w.date, (waterByDay.get(w.date) ?? 0) + w.ml);
  const waterGoalDays = [...waterByDay.values()].filter((ml) => ml >= input.waterGoalMl).length;
  return { waterByDay, waterGoalDays };
}

/** Points: meals 10 each, a water-goal day 15, a weigh-in 25, a night logged 10, a workout 20, plus 5 per day of the record streak. */
export function xp(input: GameInput): number {
  const { waterGoalDays } = dayCounts(input);
  return input.meals.length * 10 + waterGoalDays * 15 + input.weights.length * 25 + input.sleep.length * 10 + input.workouts.length * 20 + input.streakDays * 5;
}

export function level(points: number): Level {
  let i = 0;
  while (i + 1 < LEVEL_XP.length && points >= LEVEL_XP[i + 1]) i++;
  const next = i + 1 < LEVEL_XP.length ? LEVEL_XP[i + 1] : null;
  const span = next === null ? 1 : next - LEVEL_XP[i];
  return { key: LEVELS[i], index: i, xp: points, next, progress: next === null ? 1 : (points - LEVEL_XP[i]) / span };
}

/**
 * The level for these points, never below the highest camp already
 * celebrated: the streak's part of the points goes when a run ends, but a
 * camp reached stays reached, as a badge does. Kept above its points, the
 * level shows the real points and no progress toward the next camp yet.
 */
export function keptLevel(points: number, celebrated: string[] | null | undefined): Level {
  const now = level(points);
  const best = LEVELS.reduce((top, key, i) => (celebrated?.includes(`level:${key}`) ? Math.max(top, i) : top), 0);
  if (best <= now.index) return now;
  const next = best + 1 < LEVEL_XP.length ? LEVEL_XP[best + 1] : null;
  return { key: LEVELS[best], index: best, xp: points, next, progress: next === null ? 1 : 0 };
}

export type Badge = { key: string; earned: boolean; progress: number; n: number; target: number };

/**
 * Firsts, streaks and kilos. `progress` is 0..1 towards `target`; `n` is the
 * raw count. A streak badge is earned by a run of the record streak that long
 * in its window, and counts today's run toward the next. A badge already
 * celebrated stays earned, whatever its count is now.
 */
export function badges(input: GameInput): Badge[] {
  const { waterGoalDays } = dayCounts(input);
  const best = Math.max(input.streakDays, input.bestStreakDays);
  const kept = new Set(input.celebrated ?? []);
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
  const mk = (key: string, n: number, target: number, reached = n >= target): Badge => {
    const earned = reached || kept.has(`badge:${key}`);
    return { key, n, target, earned, progress: earned ? 1 : Math.min(1, n / target) };
  };
  return [
    mk('first_meal', input.meals.length, 1),
    mk('first_weigh', input.weights.length, 1),
    mk('streak_7', input.streakDays, 7, best >= 7),
    mk('streak_30', input.streakDays, 30, best >= 30),
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
export type Challenge = { key: ChallengeKey; n: number; target: number; done: boolean; progress: number; daysLeft: number; weekStart: ISODate };

/** One challenge a week, the same one all week, a different one next week. Progress counts the current week, from a new chapter's first day when one started this week. */
export function weeklyChallenge(input: GameInput, weekStartDay = 0): Challenge {
  const d = new Date(input.today + 'T12:00:00');
  const back = (d.getDay() - weekStartDay + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - back);
  const weekIndex = Math.floor(start.getTime() / (7 * 86400000));
  const key = CHALLENGES[weekIndex % CHALLENGES.length];
  const week = weekSummary({ ...input, today: input.today });
  const weekStart = start.toISOString().slice(0, 10);
  // A chapter started this week starts the challenge again: the days before it do not count.
  const from = input.since && input.since > weekStart ? input.since : weekStart;
  const inWeek = week.days.filter((x) => x.date >= from);
  let n = 0;
  let target = 7;
  if (key === 'log_all_7') {
    n = inWeek.filter((x) => x.logged || x.off).length;
    target = 7;
  } else if (key === 'water_5') {
    n = inWeek.filter((x) => x.waterGoal).length;
    target = 5;
  } else if (key === 'steps_4') {
    n = inWeek.filter((x) => x.steps >= 7000).length;
    target = 4;
  } else if (key === 'no_heavy') {
    n = inWeek.filter((x) => x.off || (x.logged && x.kcalBand !== 'heavy')).length;
    target = 7;
  } else {
    n = inWeek.filter((x) => (x.sleepMinutes ?? 0) >= 420).length;
    target = 5;
  }
  return { key, n, target, done: n >= target, progress: Math.min(1, n / target), daysLeft: 6 - back, weekStart };
}

/** Where each weigh-in sits on the climb, 0 at the start weight and 1 at the goal. */
export function climbTrail(weights: WeightLog[], startKg: number, goalKg: number): { date: ISODate; p: number }[] {
  const total = startKg - goalKg;
  if (total <= 0) return [];
  return [...weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => ({ date: w.date, p: Math.round(Math.min(1, Math.max(0, (startKg - w.kg) / total)) * 1000) / 1000 }));
}

/** One emoji per badge, shared by the Journey screen and the celebration. */
export const BADGE_ICON: Record<string, string> = {
  first_meal: '🍽️',
  first_weigh: '⚖️',
  streak_7: '🔥',
  streak_30: '🌋',
  meals_100: '💯',
  water_7: '💧',
  water_30: '🌊',
  sleep_10: '🌙',
  steps_10: '👟',
  workouts_10: '💪',
  weigh_4: '📅',
  kg_1: '🪶',
  kg_5: '🏔️',
  halfway: '⛺',
  summit: '🚩',
};

export type Win = { id: string; kind: 'badge' | 'level' | 'challenge'; key: string };

/**
 * Which win to celebrate next. Wins are badges earned, camps reached and the
 * weekly challenge done; each is shown once. The first time this runs there
 * is no record yet, so everything already earned is marked seen rather than
 * celebrated in a flood. While `waiting` (the add sheet is open, its "Save as
 * my meal?" too, or a toast or a line with Undo is on screen) nothing is
 * celebrated yet; the win waits for it to go.
 */
export function nextWin(input: { earned: string[]; level: LevelKey; challenge: Challenge; celebrated: string[] | null | undefined; waiting?: boolean }): { seed: string[] | null; next: Win | null } {
  const all: Win[] = [
    ...(input.level !== 'base' ? [{ id: `level:${input.level}`, kind: 'level' as const, key: input.level }] : []),
    ...input.earned.map((k) => ({ id: `badge:${k}`, kind: 'badge' as const, key: k })),
    ...(input.challenge.done ? [{ id: `challenge:${input.challenge.weekStart}`, kind: 'challenge' as const, key: input.challenge.key }] : []),
  ];
  if (!input.celebrated) return { seed: all.map((w) => w.id), next: null };
  if (input.waiting) return { seed: null, next: null };
  const seen = new Set(input.celebrated);
  return { seed: null, next: all.find((w) => !seen.has(w.id)) ?? null };
}

export type GameView = {
  plan: Plan;
  input: GameInput;
  progress: number;
  camps: { p: number; label: string }[];
  trail: number[];
  points: number;
  level: Level;
  badges: Badge[];
  challenge: Challenge;
};

/**
 * Everything the climb and the game show, from the store. Lost, To go, the
 * mountain, its camps and its trail are the chapter's (`shownPlan`, the trail
 * from the chapter's first day), and so is the weekly challenge; a chapter
 * start after today is no chapter yet. Points and badges are the whole
 * journey's: the kilo badges count from the very first start and the points
 * and the streak badges count the streak over the whole journey (`lifetime`),
 * so a new chapter takes none away; a badge already celebrated stays earned,
 * and so does a camp of the points' level (`keptLevel`).
 */
export function gameView(o: {
  state: Pick<AppState, 'profile' | 'weights' | 'meals' | 'water' | 'sleep' | 'steps' | 'workouts' | 'celebrated'> & { settings: Pick<Settings, 'waterGoalMl' | 'weighDay' | 'offDays'> };
  targets: Targets;
  today: ISODate;
  /** The streak and the best run the streak tile shows, from the chapter's first day. */
  streakDays: number;
  bestStreakDays: number;
  /** The streak and the best run over the whole journey, a chapter or not. */
  lifetime: { streakDays: number; bestStreakDays: number };
}): GameView {
  const { state, targets, today } = o;
  const plan = shownPlan(state.profile, state.weights, targets, today);
  const since = chapterSince(state.profile.chapterStart, today);
  const input: GameInput = {
    today,
    meals: state.meals,
    water: state.water,
    weights: state.weights,
    sleep: state.sleep,
    steps: state.steps,
    workouts: state.workouts,
    kcalTarget: targets.kcal,
    waterGoalMl: state.settings.waterGoalMl,
    startKg: plan.startKg,
    goalKg: plan.goalKg,
    offDays: state.settings.offDays,
    since,
    streakDays: o.streakDays,
    bestStreakDays: o.bestStreakDays,
    celebrated: state.celebrated,
  };
  const lifetime: GameInput = { ...input, startKg: state.profile.firstStartWeightKg ?? plan.startKg, since: undefined, ...o.lifetime };
  const total = Math.max(0, plan.startKg - plan.goalKg);
  const progress = total > 0 ? Math.min(1, Math.max(0, plan.lostKg / total)) : plan.toGoKg <= 0 ? 1 : 0;
  const camps = total > 0 ? [0.25, 0.5, 0.75].map((p) => ({ p, label: `${Math.round((plan.startKg - total * p) * 10) / 10}` })) : [];
  const trailWeights = since ? state.weights.filter((w) => w.date >= since) : state.weights;
  const points = xp(lifetime);
  return {
    plan,
    input,
    progress,
    camps,
    trail: climbTrail(trailWeights, plan.startKg, plan.goalKg).map((t) => t.p),
    points,
    level: keptLevel(points, state.celebrated),
    badges: badges(lifetime),
    challenge: weeklyChallenge(input, state.settings.weighDay),
  };
}
