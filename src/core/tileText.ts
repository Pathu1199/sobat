import { WALK_ACTIVITY_ID } from './activity';
import { addDays } from './date';
import type { DayMenu } from './menu';
import { dayRecord, type DayRecordState } from './record';
import type { Routine } from './routine';
import { walkTile, waterTile } from './tiles';
import type { ActivityLog, ISODate, Meal, SlotSkip, WeightLog } from './types';

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
export type TileWords = { parts: TilePart[]; line: TileLine };

/** The night the sleep tile fills toward, in minutes. */
export const SLEEP_TARGET_MIN = 480;
/** One breathing session: a minute, four seconds in and four seconds out. */
export const BREATHE_SESSION_MS = 60000;
export const BREATHE_HALF_MS = 4000;
/** How far back the weight tile looks for its change. */
export const WEIGHT_CHANGE_DAYS = 21;
/** How far back the streak tile looks for the best run. */
export const BEST_STREAK_DAYS = 90;

/** One place after the point, always shown: 1 → "1.0". */
export function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** A weight without a needless ".0": 80 → "80", 79.5 → "79.5". */
function kgText(kg: number): string {
  return String(Math.round(kg * 10) / 10);
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

/** Minutes walked, and the minutes still to go or the goal reached. */
export function walkWords(minutes: number, goalMin: number): TileWords {
  const w = walkTile(minutes, goalMin);
  return {
    parts: [{ num: String(Math.round(minutes)), unitKey: 'tile_unit_min' }],
    line: w.reached ? { key: 'tile_goal_reached' } : { key: 'tile_min_left', params: { n: w.minutesLeft } },
  };
}

/** Hours and minutes slept, "7 h 10 m" ("7 h" on the hour); a dash before the check-in. The line is the goal. */
export function sleepWords(minutes: number | null, targetMin = SLEEP_TARGET_MIN): TileWords {
  const line: TileLine = { key: 'tile_sleep_goal', params: { h: Math.round((targetMin / 60) * 10) / 10 } };
  if (minutes === null || !(minutes > 0)) return { parts: [{ num: '—' }], line };
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

/** The latest weigh-in, and its change over the last three weeks or, with nothing to compare, the goal. */
export function weightWords(weights: WeightLog[], goalKg: number, today: ISODate): TileWords {
  const latest = [...weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const change = weightChange(weights, today);
  const line: TileLine = !change
    ? { key: 'tile_weight_goal', params: { kg: kgText(goalKg) } }
    : change.weeks === 1
      ? { key: 'tile_weight_change_1', params: { kg: signedKg(change.kg) } }
      : { key: 'tile_weight_change', params: { kg: signedKg(change.kg), weeks: change.weeks } };
  return { parts: [latest ? { num: oneDecimal(latest.kg), unitKey: 'unit_kg' } : { num: '—' }], line };
}

/** Today's streak in days, and the best run, never shown lower than today's. */
export function streakWords(streak: number, best: number): TileWords {
  return {
    parts: [{ num: String(streak), unitKey: streak === 1 ? 'tile_unit_day' : 'tile_unit_days' }],
    line: { key: 'tile_best', params: { n: Math.max(best, streak) } },
  };
}

/** The longest run of full days, oldest first. An off day neither breaks a run nor adds to it. */
export function bestRun(states: DayRecordState[]): number {
  let run = 0;
  let best = 0;
  for (const s of states) {
    if (s === 'off') continue;
    run = s === 'full' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * The best run of full days in the last `days`, judged on the menus as they
 * show, the way the streak is. A day settled only by skips is a complete
 * record but not a day eaten as planned, so it ends a run, as it ends the
 * streak: skipping is never rewarded.
 */
export function bestStreak(input: {
  today: ISODate;
  menuOn: (date: ISODate) => DayMenu | null;
  routine: Routine;
  meals: Meal[];
  skips: SlotSkip[];
  offDays: number[];
  days?: number;
}): number {
  const byDate = new Map<ISODate, Meal[]>();
  for (const m of input.meals) {
    const list = byDate.get(m.date);
    if (list) list.push(m);
    else byDate.set(m.date, [m]);
  }
  const states: DayRecordState[] = [];
  for (let i = (input.days ?? BEST_STREAK_DAYS) - 1; i >= 0; i--) {
    const date = addDays(input.today, -i);
    const meals = byDate.get(date) ?? [];
    const r = dayRecord({ date, today: input.today, menu: input.menuOn(date), routine: input.routine, meals, skips: input.skips, offDays: input.offDays });
    // Skips alone: the run ends here, as it ends the streak (recordStreak).
    states.push(r.state === 'full' && meals.length === 0 ? 'partial' : r.state);
  }
  return bestRun(states);
}

/** Where a breathing session is: breathing in or out, seconds left, or done after a minute. */
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

/** At rest: "1 min" and "Tap to start". During a session: the time left, and "Breathe in" or "Breathe out". */
export function breatheWords(elapsedMs: number | null): TileWords {
  if (elapsedMs === null) return { parts: [{ num: String(BREATHE_SESSION_MS / 60000), unitKey: 'tile_unit_min' }], line: { key: 'tile_tap_to_start' } };
  const p = breathePhase(elapsedMs);
  return { parts: [{ num: clockText(p.leftSec) }], line: { key: p.inhale ? 'breathe_in' : 'breathe_out' } };
}

/** Minutes of walking logged on a date; other activities do not fill the walk tile. */
export function walkMinutesOn(logs: ActivityLog[], date: ISODate): number {
  return logs.filter((l) => l.date === date && l.activityId === WALK_ACTIVITY_ID).reduce((a, l) => a + l.minutes, 0);
}
