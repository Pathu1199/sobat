import { isIsoDate } from './date';
import { badges, climbTrail, level, weeklyChallenge, xp, type Badge, type Challenge, type GameInput, type Level } from './game';
import type { Targets } from './nutrition';
import { planFrom, type Plan } from './plan';
import { shownWeight } from './tileText';
import type { AppState, ISODate, Profile, Settings, WeightLog } from './types';

/**
 * A new chapter: the climb starts again from the weight Progress shows (the
 * weight smoothed over a week, `shownWeight`, so Lost reads 0 on the first
 * day) and today, and the weekly challenge, the streak and the best run count
 * from that day. The very first start is kept, so the kilo badges still count
 * the whole journey. Nothing is deleted. Pure.
 */
export function newChapter(
  profile: Pick<Profile, 'weightKg' | 'startWeightKg' | 'firstStartWeightKg'>,
  weights: WeightLog[],
  today: ISODate,
): Required<Pick<Profile, 'startWeightKg' | 'chapterStart' | 'firstStartWeightKg'>> {
  const earliest = [...weights].sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    startWeightKg: shownWeight(weights, today)?.kg ?? profile.weightKg,
    chapterStart: today,
    // The start as planFrom reads it: the profile's, else the first weigh-in, else the profile weight.
    firstStartWeightKg: profile.firstStartWeightKg ?? profile.startWeightKg ?? earliest?.kg ?? profile.weightKg,
  };
}

/**
 * How many days back from today, today included, the streak may look: no
 * further than the chapter's first day, and never more than `max`. A start
 * that is not a date (a damaged file) or still to come limits nothing.
 */
export function chapterDays(start: ISODate | undefined, today: ISODate, max: number): number {
  if (!isIsoDate(start) || start > today) return max;
  const days = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86400000) + 1;
  return Math.min(max, days);
}

/**
 * The plan read at the weight Progress shows (smoothed over a week,
 * `shownWeight`) rather than the latest weigh-in alone, from the start weight
 * of the chapter: Lost, To go and the goal's date agree with the weight on the
 * Weight tile and the trend card. With no weigh-in it is the plan as it was.
 */
export function shownPlan(profile: Profile, weights: WeightLog[], targets: Targets, today: ISODate): Plan {
  return planFrom(profile, weights, targets, today, shownWeight(weights, today)?.kg);
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
 * from the chapter's first day), and so is the weekly challenge. Points and
 * badges are the whole journey's: the kilo badges count from the very first
 * start, so a new chapter takes none away. The streak is the store's, the one
 * the streak tile shows, and a badge already celebrated stays earned.
 */
export function gameView(o: {
  state: Pick<AppState, 'profile' | 'weights' | 'meals' | 'water' | 'sleep' | 'steps' | 'workouts' | 'celebrated'> & { settings: Pick<Settings, 'waterGoalMl' | 'weighDay' | 'offDays'> };
  targets: Targets;
  today: ISODate;
  streakDays: number;
  bestStreakDays: number;
}): GameView {
  const { state, targets, today } = o;
  const plan = shownPlan(state.profile, state.weights, targets, today);
  const since = isIsoDate(state.profile.chapterStart) ? state.profile.chapterStart : undefined;
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
  const lifetime: GameInput = { ...input, startKg: state.profile.firstStartWeightKg ?? plan.startKg, since: undefined };
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
    level: level(points),
    badges: badges(lifetime),
    challenge: weeklyChallenge(input, state.settings.weighDay),
  };
}
