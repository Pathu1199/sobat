import { mondayOf } from './date';
import type { StreakStep } from './record';
import type { ISODate } from './types';

/**
 * The streak shield: one free rest day a week. In each Monday to Sunday week,
 * the first day that would end a run going on (a break the shield may cover,
 * with at least one day counted before it) holds the run instead, neither
 * counting nor ending it, and the shield is used for that week; a second such
 * day in the same week ends the run as before. It applies to every streak the
 * app shows, each with its own shield. Pure and deterministic: a run is worked
 * out from its days, oldest first, every time, so it is the same on every
 * device and nothing is stored.
 */

/** One day of a run, oldest first: what it does to the run, and whether a break that day is one the shield may cover. */
export type RunDay = { date: ISODate; step: StreakStep; coverable: boolean };

export type Run = {
  /** Days in a row at the end: the streak. */
  days: number;
  /** The longest run among the days. */
  best: number;
  /** The days the shield covered, at most one in each Monday to Sunday week. */
  covered: ISODate[];
};

/** The run through `days`, oldest first, with the shield when `shield` is true (`covered` is then the days it held), without it as every break ends a run. */
export function runOf(days: readonly RunDay[], shield: boolean): Run {
  let run = 0;
  let best = 0;
  const covered: ISODate[] = [];
  for (const d of days) {
    if (d.step === 'count') {
      run += 1;
      best = Math.max(best, run);
      continue;
    }
    if (d.step === 'hold') continue;
    const week = mondayOf(d.date);
    if (shield && d.coverable && run > 0 && !covered.some((c) => mondayOf(c) === week)) {
      covered.push(d.date);
      continue;
    }
    run = 0;
  }
  return { days: run, best, covered };
}

/** What the gold note beside a streak says: the shield is used while it covered a day of this Monday to Sunday week, ready otherwise. */
export function shieldNote(covered: readonly ISODate[], today: ISODate): 'ready' | 'used' {
  const week = mondayOf(today);
  return covered.some((d) => mondayOf(d) === week) ? 'used' : 'ready';
}
