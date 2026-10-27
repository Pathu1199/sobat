import type { DayMode, DayView } from './dayView';
import type { Budget, Targets } from './nutrition';
import { normalizeTodayCards } from './tabs';
import type { TodayCardId } from './types';

/**
 * Today's blocks under the week strip and calories left, from the cards the
 * person has on, in their order: the menu, the coach line, the Water and Walk
 * pair, and the optional cards. The single tiles (weight, sleep, the climb)
 * pair up two to a row in the order they come; a lone one keeps half a row.
 * Unknown, repeated and switched-off cards are left out, and anything that is
 * not a list gets the default. Pure.
 */
export type PairTile = 'weight' | 'sleep' | 'climb';
export type TodayBlock = { kind: 'menu' } | { kind: 'coach' } | { kind: 'waterWalk' } | { kind: 'steps' } | { kind: 'mantra' } | { kind: 'pair'; tiles: PairTile[] };

const SINGLE_TILES: string[] = ['weight', 'sleep', 'climb'];

export function todayBlocks(cards: unknown): TodayBlock[] {
  const out: TodayBlock[] = [];
  let pending: PairTile[] = [];
  const flush = () => {
    if (pending.length > 0) out.push({ kind: 'pair', tiles: pending });
    pending = [];
  };
  for (const { id } of normalizeTodayCards(cards).filter((c) => c.on)) {
    if (SINGLE_TILES.includes(id)) {
      pending.push(id as PairTile);
      if (pending.length === 2) flush();
      continue;
    }
    flush();
    out.push({ kind: id as Exclude<TodayCardId, PairTile> });
  }
  flush();
  return out;
}

/** What "Calories left" says, as i18n keys and numbers; the words are the component's. */
export type CaloriesLeftWords = {
  /** The big number, never negative: what is left, or how far over. */
  kcal: number;
  over: boolean;
  /** Said in red: food eaten past the goal, or the person's own plan going over it, on a day in the record. */
  alarm: boolean;
  /** Null on a day before the person started: it shows what was eaten, with no "left". */
  label: 'kcal_left' | 'kcal_over' | 'today_left_after_plan' | null;
  /** "Planned X · Goal Y", "Suggested X · Goal Y" or, for a past day, "Eaten X of Y". */
  line: { key: 'today_planned_goal' | 'today_suggested_goal' | 'today_eaten_of'; kcal: number; goal: number };
  /** Calories a walk or other activity earned back that day: today's live figure, a past day's own; 0 on a day still to come. */
  earned: number;
  protein: { g: number; target: number };
};

/**
 * The one number the day is about. Today it is the live budget, so a walk
 * earns some back, under "Planned X · Goal Y"; a past day is the goal and what
 * that day's walks earned, less what was eaten, under "Eaten X of Y", so it
 * stays the number today showed; a future day is what the plan leaves. A menu
 * that is the app's own suggestion, which nobody wrote, is named as one and
 * never judged in red: its plan note on the menu is what points to Balance.
 * Nothing is said in red on a free day or a day before the person started,
 * and a day before the start has no "left" at all. Protein goes against its
 * target: eaten, or planned on a future day. Pure.
 */
export function caloriesLeft(input: {
  mode: DayMode;
  targets: Pick<Targets, 'kcal' | 'proteinG'>;
  view: Pick<DayView, 'plannedKcal' | 'plannedProtein' | 'eatenKcal' | 'eatenProtein' | 'judged'>;
  /** Today's live budget. */
  budget: Pick<Budget, 'remaining' | 'earned' | 'proteinConsumed'>;
  /** The day's menu is the app's suggestion (the store's `isSuggestedMenu`). */
  suggested: boolean;
  /** A free day in the person's settings. */
  offDay: boolean;
  /** What that day's walks and activities earned back (`eatBack(burnedOn(...))`); read on a past day. */
  dayEarned: number;
}): CaloriesLeftWords {
  const { mode, targets, view, budget } = input;
  const goal = targets.kcal;
  const earned = mode === 'today' ? Math.max(0, budget.earned) : mode === 'past' ? Math.max(0, input.dayEarned) : 0;
  const left = Math.round(mode === 'today' ? budget.remaining : mode === 'past' ? goal + earned - view.eatenKcal : goal - view.plannedKcal);
  const over = left < 0;
  const suggested = input.suggested && mode !== 'past';
  // A day still to come is never in the record yet (`judged`), so there the free day and the suggestion decide.
  const inRecord = mode === 'future' ? !input.offDay && !suggested : view.judged;
  const beforeStart = mode !== 'future' && !view.judged && !input.offDay;
  return {
    kcal: Math.abs(left),
    over,
    alarm: over && inRecord,
    label: beforeStart ? null : over ? 'kcal_over' : mode === 'future' ? 'today_left_after_plan' : 'kcal_left',
    line:
      mode === 'past'
        ? { key: 'today_eaten_of', kcal: view.eatenKcal, goal }
        : { key: suggested ? 'today_suggested_goal' : 'today_planned_goal', kcal: view.plannedKcal, goal },
    earned,
    protein: { g: mode === 'today' ? budget.proteinConsumed : mode === 'past' ? view.eatenProtein : view.plannedProtein, target: targets.proteinG },
  };
}
