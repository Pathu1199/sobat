import { t } from '../i18n';
import type { DayMode, DayView } from './dayView';
import type { Budget, Targets } from './nutrition';
import { normalizeTodayCards } from './tabs';
import type { Lang, TodayCardId } from './types';

/**
 * Today's blocks under the week strip and calories left, from the cards the
 * person has on, in their order: the menu, the coach line, the Water and Walk
 * pair, and the optional cards. The single tiles (weight, sleep, the climb)
 * pair up two to a row in the order they come; a lone one keeps half a row.
 * On a day still to come the Sleep tile is left out (there is no night to
 * check in yet), so the tiles left pair up without it. The day's line shows
 * only while it is switched on in Settings (`mantraOn`, off unless given), its
 * card or not. Unknown, repeated and switched-off cards are left out, and
 * anything that is not a list gets the default. Pure.
 */
export type PairTile = 'weight' | 'sleep' | 'climb';
export type TodayBlock = { kind: 'menu' } | { kind: 'coach' } | { kind: 'waterWalk' } | { kind: 'steps' } | { kind: 'mantra' } | { kind: 'pair'; tiles: PairTile[] } | { kind: 'review' };

const SINGLE_TILES: string[] = ['weight', 'sleep', 'climb'];

export function todayBlocks(cards: unknown, mode: DayMode = 'today', mantraOn = false): TodayBlock[] {
  const out: TodayBlock[] = [];
  let pending: PairTile[] = [];
  const flush = () => {
    if (pending.length > 0) out.push({ kind: 'pair', tiles: pending });
    pending = [];
  };
  for (const { id } of normalizeTodayCards(cards).filter((c) => c.on && !(mode === 'future' && c.id === 'sleep') && (mantraOn || c.id !== 'mantra'))) {
    // The Abhyas card keeps its place and its switch, and shows once its card is built (src/components/AbhyasCard.tsx).
    if (id === 'abhyas') continue;
    if (SINGLE_TILES.includes(id)) {
      pending.push(id as PairTile);
      if (pending.length === 2) flush();
      continue;
    }
    flush();
    out.push({ kind: id as Exclude<TodayCardId, PairTile | 'abhyas'> });
  }
  flush();
  return out;
}

/** Blocks under the top card (the week strip and calories left): five on the page in all. */
export const BLOCKS_UNDER_TOP = 4;

/** The cards Today starts with; every other block is one the person switched on. */
const CORE_BLOCKS: TodayBlock['kind'][] = ['menu', 'coach', 'waterWalk'];

/**
 * Today's blocks with the evening review (`dayReviewShown`). While there is
 * room it comes last, so with the cards Today starts with it is the fifth
 * block; on a page already full it takes the place of the last card the
 * person switched on, never a sixth block, and never the menu, the coach line
 * or Water and Walk. Pure.
 */
export function withReview(blocks: TodayBlock[], review: boolean): TodayBlock[] {
  if (!review) return blocks;
  const optional = blocks.map((b) => !CORE_BLOCKS.includes(b.kind)).lastIndexOf(true);
  if (blocks.length < BLOCKS_UNDER_TOP || optional < 0) return [...blocks, { kind: 'review' }];
  return blocks.map((b, i) => (i === optional ? { kind: 'review' } : b));
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
  /** The bar under the number: what is eaten (planned, on a day still to come) out of the goal and what was earned back. */
  bar: { used: number; of: number };
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
  const room = goal + earned;
  const left = Math.round(mode === 'today' ? budget.remaining : mode === 'past' ? room - view.eatenKcal : goal - view.plannedKcal);
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
    bar: { used: room - left, of: room },
  };
}

/** Which greeting an hour of the day takes: morning from 4:00 to noon, afternoon to 17:00, evening after that and through the night. */
export function greetingKey(hour: number): 'greet_morning' | 'greet_afternoon' | 'greet_evening' {
  if (hour >= 4 && hour < 12) return 'greet_morning';
  if (hour >= 12 && hour < 17) return 'greet_afternoon';
  return 'greet_evening';
}

/** The first word of the name the user gave, or null when they gave none. */
export function firstName(name: string | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

/** Today's header: "Good morning, Varad" in the user's language, or the greeting alone when there is no name. Pure. */
export function todayGreeting(hour: number, name: string | undefined, lang: Lang): string {
  const greet = t(lang, greetingKey(hour));
  const first = firstName(name);
  return first ? `${greet}, ${first}` : greet;
}

/**
 * Whether Today shows the evening review ("Today in five lines"): on today
 * only, from 20:00, while its reminder is switched on in Settings (the
 * reminder at 21:30 opens Today, where the review is), and once the day has
 * something to say (`hasData`: something eaten or last night's sleep logged).
 */
export function dayReviewShown(input: { on: boolean; mode: DayMode; hour: number; hasData: boolean }): boolean {
  return input.on && input.mode === 'today' && input.hour >= 20 && input.hasData;
}
