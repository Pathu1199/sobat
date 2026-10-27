import { WALK_ACTIVITY_ID } from './activity';
import { addDays } from './date';
import type { DayMenu } from './menu';
import { dayRecord, mealsByDate, STREAK_LOOKBACK_DAYS, streakStep, type StreakStep } from './record';
import type { Routine } from './routine';
import { walkTile, waterTile } from './tiles';
import type { ActivityLog, ISODate, Meal, SlotSkip, WaterLog, WeightLog } from './types';

/**
 * The words and numbers on the living tiles, worked out once so every tile
 * reads the same way: a number with its unit, and one short line that says
 * what is left or what the goal is ("4 bottles left", "Goal 8 h", "Best 12"),
 * never "of 30" without a unit. Keys and values only: the tile turns the keys
 * into words in the person's language.
 */

/** One number on a tile, with its unit beside it in a smaller size: "1.0" "L", or "7" "h" "10" "m". */
export type TilePart = { num: string; unitKey?: string };
/** The short line under the number: an i18n key and what it fills in. */
export type TileLine = { key: string; params?: Record<string, string | number> };
/**
 * A tile's words. `empty` is there only when the tile has no value yet (it
 * shows `NO_VALUE`): the phrase a screen reader says in place of the dash.
 */
export type TileWords = { parts: TilePart[]; line: TileLine; empty?: TileLine };

/** The mark a tile shows where its value will be, before the first check-in or weigh-in: an en dash. */
export const NO_VALUE = '–';

/** The night the sleep tile fills toward, in minutes. */
export const SLEEP_TARGET_MIN = 480;
/** One breath: four seconds in and four seconds out. */
export const BREATHE_HALF_MS = 4000;
/** One breathing session: eight whole breaths, 64 seconds, so it ends on a breath out with the circle small. The tile calls it a minute. */
export const BREATHE_SESSION_MS = 8 * 2 * BREATHE_HALF_MS;
/** How far back the weight tile looks for its change. */
export const WEIGHT_CHANGE_DAYS = 21;

/** One place after the point, always shown: 1 → "1.0". */
export function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** One place after the point at most, without a needless ".0", for a number inside a sentence: 3 → "3", 1.5 → "1.5". */
export function shortDecimal(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** A change with its sign, the minus a real minus sign: −1.6, +0.4, and 0.0 for no change. */
export function signedKg(kg: number): string {
  const r = Math.round(kg * 10) / 10;
  if (r < 0) return `−${oneDecimal(-r)}`;
  if (r > 0) return `+${oneDecimal(r)}`;
  return '0.0';
}

/** Litres drunk, and the bottles still to go (rounded up) or the goal reached. */
export function waterWords(ml: number, goalMl: number, bottleMl: number): TileWords {
  const w = waterTile(ml, goalMl, bottleMl);
  const line: TileLine = w.reached ? { key: 'tile_goal_reached' } : w.bottlesLeft === 1 ? { key: 'tile_bottle_left' } : { key: 'tile_bottles_left', params: { n: w.bottlesLeft } };
  return { parts: [{ num: oneDecimal(ml / 1000), unitKey: 'tile_unit_l' }], line };
}

/** What a screen reader says on the water tile: what one tap does, and the litres against the goal, "1.5 of 3 litres". */
export function waterLabel(ml: number, goalMl: number): TileLine {
  return { key: 'tile_water_a11y', params: { now: shortDecimal(ml / 1000), goal: shortDecimal(goalMl / 1000) } };
}

/** Minutes walked, and the minutes still to go or the goal reached. */
export function walkWords(minutes: number, goalMin: number): TileWords {
  const w = walkTile(minutes, goalMin);
  return {
    parts: [{ num: String(Math.round(minutes)), unitKey: 'tile_unit_min' }],
    line: w.reached ? { key: 'tile_goal_reached' } : { key: 'tile_min_left', params: { n: w.minutesLeft } },
  };
}

/** Hours and minutes slept, "7 h 10 m" ("7 h" on the hour); the dash before the check-in. The line is the goal. */
export function sleepWords(minutes: number | null, targetMin = SLEEP_TARGET_MIN): TileWords {
  const line: TileLine = { key: 'tile_sleep_goal', params: { h: Math.round((targetMin / 60) * 10) / 10 } };
  if (minutes === null || !(minutes > 0)) return { parts: [{ num: NO_VALUE }], line, empty: { key: 'tile_no_sleep' } };
  const total = Math.round(minutes);
  const parts: TilePart[] = [{ num: String(Math.floor(total / 60)), unitKey: 'tile_unit_h' }];
  if (total % 60 > 0) parts.push({ num: String(total % 60), unitKey: 'tile_unit_m' });
  return { parts, line };
}

/**
 * The change from the first weigh-in of the last `days` to the latest one,
 * and over how many weeks (at least one). Null when the window holds no
 * earlier weigh-in to compare with.
 */
export function weightChange(weights: WeightLog[], today: ISODate, days = WEIGHT_CHANGE_DAYS): { kg: number; weeks: number } | null {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const from = addDays(today, -days);
  const first = sorted.find((w) => w.date >= from && w.date < latest.date);
  if (!first) return null;
  const span = Math.round((new Date(`${latest.date}T12:00:00`).getTime() - new Date(`${first.date}T12:00:00`).getTime()) / 86400000);
  return { kg: Math.round((latest.kg - first.kg) * 10) / 10, weeks: Math.max(1, Math.round(span / 7)) };
}

/** The latest weigh-in (the dash before the first), and its change over the last three weeks or, with nothing to compare, the goal. */
export function weightWords(weights: WeightLog[], goalKg: number, today: ISODate): TileWords {
  const latest = [...weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const change = weightChange(weights, today);
  const line: TileLine = !change
    ? { key: 'tile_weight_goal', params: { kg: shortDecimal(goalKg) } }
    : change.weeks === 1
      ? { key: 'tile_weight_change_1', params: { kg: signedKg(change.kg) } }
      : { key: 'tile_weight_change', params: { kg: signedKg(change.kg), weeks: change.weeks } };
  if (!latest) return { parts: [{ num: NO_VALUE }], line, empty: { key: 'tile_no_weight' } };
  return { parts: [{ num: oneDecimal(latest.kg), unitKey: 'unit_kg' }], line };
}

/** Today's streak in days, and the best run, never shown lower than today's. */
export function streakWords(streak: number, best: number): TileWords {
  return {
    parts: [{ num: String(streak), unitKey: streak === 1 ? 'tile_unit_day' : 'tile_unit_days' }],
    line: { key: 'tile_best', params: { n: Math.max(best, streak) } },
  };
}

/** The longest run of days that count, oldest first. A day that holds neither breaks a run nor adds to it. */
export function bestRun(steps: StreakStep[]): number {
  let run = 0;
  let best = 0;
  for (const s of steps) {
    if (s === 'hold') continue;
    run = s === 'count' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * The best run in the last `days` (the streak's own window unless told),
 * judged on the menus as they show and by the streak's own rule
 * (`streakStep`, with the person's safe minimum as `floor`): a full day eaten
 * under it neither counts nor ends a run, and a full day with nothing eaten
 * ends it.
 */
export function bestStreak(input: {
  today: ISODate;
  menuOn: (date: ISODate) => DayMenu | null;
  routine: Routine;
  meals: Meal[];
  skips: SlotSkip[];
  offDays: number[];
  floor: number;
  days?: number;
}): number {
  const byDate = mealsByDate(input.meals);
  const steps: StreakStep[] = [];
  for (let i = (input.days ?? STREAK_LOOKBACK_DAYS) - 1; i >= 0; i--) {
    const date = addDays(input.today, -i);
    const meals = byDate.get(date) ?? [];
    const r = dayRecord({ date, today: input.today, menu: input.menuOn(date), routine: input.routine, meals, skips: input.skips, offDays: input.offDays });
    steps.push(streakStep(r.state, meals, input.floor));
  }
  return bestRun(steps);
}

/** Where a breathing session is: breathing in or out, seconds left, or done after the eighth breath out. */
export function breathePhase(elapsedMs: number): { done: boolean; inhale: boolean; leftSec: number } {
  if (elapsedMs >= BREATHE_SESSION_MS) return { done: true, inhale: false, leftSec: 0 };
  const t = Math.max(0, elapsedMs);
  return { done: false, inhale: Math.floor(t / BREATHE_HALF_MS) % 2 === 0, leftSec: Math.ceil((BREATHE_SESSION_MS - t) / 1000) };
}

/** Seconds as a clock: 42 → "0:42". */
export function clockText(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** At rest: "1 min" (the session in whole minutes) and "Tap to start". During a session: the time left, and "Breathe in" or "Breathe out". */
export function breatheWords(elapsedMs: number | null): TileWords {
  if (elapsedMs === null) return { parts: [{ num: String(Math.round(BREATHE_SESSION_MS / 60000)), unitKey: 'tile_unit_min' }], line: { key: 'tile_tap_to_start' } };
  const p = breathePhase(elapsedMs);
  return { parts: [{ num: clockText(p.leftSec) }], line: { key: p.inhale ? 'breathe_in' : 'breathe_out' } };
}

/** Millilitres of water logged on a date. */
export function waterMlOn(logs: WaterLog[], date: ISODate): number {
  return logs.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0);
}

/** Minutes of walking logged on a date; other activities do not fill the walk tile. */
export function walkMinutesOn(logs: ActivityLog[], date: ISODate): number {
  return logs.filter((l) => l.date === date && l.activityId === WALK_ACTIVITY_ID).reduce((a, l) => a + l.minutes, 0);
}
