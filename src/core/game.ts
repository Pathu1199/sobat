import { chapterSince } from './chapter';
import type { Targets } from './nutrition';
import { shownPlan, type Plan } from './plan';
import type { AppState, ISODate, WeightLog } from './types';

/**
 * The climb: the weight journey drawn as a mountain, from the start weight at
 * its foot to the goal at its summit, with camps at a quarter, half and three
 * quarters of the way and a trail of the weigh-ins. All derived from the
 * logs, nothing stored. The rewards (medals, the daily challenge) are
 * core/medals.ts and core/challenge.ts; the points, camps-as-levels, badges
 * and weekly challenge that were here are retired, and the ids they were
 * celebrated under stay readable in `celebrated` (the streak, kilo, halfway and
 * summit badges count as the medals they became).
 */

/** Where each weigh-in sits on the climb, 0 at the start weight and 1 at the goal. */
export function climbTrail(weights: WeightLog[], startKg: number, goalKg: number): { date: ISODate; p: number }[] {
  const total = startKg - goalKg;
  if (total <= 0) return [];
  return [...weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => ({ date: w.date, p: Math.round(Math.min(1, Math.max(0, (startKg - w.kg) / total)) * 1000) / 1000 }));
}

export type GameView = {
  plan: Plan;
  progress: number;
  camps: { p: number; label: string }[];
  trail: number[];
};

/**
 * Everything the climb shows, from the store: Lost, To go, the mountain, its
 * camps and its trail are the chapter's (`shownPlan`, the trail from the
 * chapter's first day); a chapter start after today is no chapter yet.
 */
export function gameView(o: {
  state: Pick<AppState, 'profile' | 'weights'>;
  targets: Targets;
  today: ISODate;
}): GameView {
  const { state, targets, today } = o;
  const plan = shownPlan(state.profile, state.weights, targets, today);
  const since = chapterSince(state.profile.chapterStart, today);
  const total = Math.max(0, plan.startKg - plan.goalKg);
  const progress = total > 0 ? Math.min(1, Math.max(0, plan.lostKg / total)) : plan.toGoKg <= 0 ? 1 : 0;
  const camps = total > 0 ? [0.25, 0.5, 0.75].map((p) => ({ p, label: `${Math.round((plan.startKg - total * p) * 10) / 10}` })) : [];
  const trailWeights = since ? state.weights.filter((w) => w.date >= since) : state.weights;
  return { plan, progress, camps, trail: climbTrail(trailWeights, plan.startKg, plan.goalKg).map((t) => t.p) };
}
