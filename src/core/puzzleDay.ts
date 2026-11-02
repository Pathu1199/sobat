import { isIsoDate } from './date';
import type { ISODate, PuzzleLog } from './types';
import { LEVELS, levelFor, type ZipLevel } from './zip';

/**
 * Today's puzzle, the day around it: whether it is open, what a solved day stores, and what a record must look like.
 * Pure; the store and the screen only call it.
 */

/** Where today's puzzle stands: closed (by the Routine's jobs left, or by the meals on a day with no job), open at a level, or solved in so many seconds. */
export type PuzzleToday =
  | { kind: 'closed'; by: 'routine'; done: number; total: number }
  | { kind: 'closed'; by: 'meals' }
  | { kind: 'open'; level: ZipLevel }
  | { kind: 'solved'; level: ZipLevel; seconds: number };

/**
 * Today's puzzle from the Routine's jobs due today (`done` of `total`, a running timer's minutes counted), whether today's meals
 * are all logged or skipped (`isCompleteMark`), whether today is a free (off) day, the Routine streak with its shield, and
 * today's record if it was solved. A solved day stays solved, whatever the Routine says afterwards (a tick undone changes
 * nothing) and at the level it was solved at. Otherwise a day with jobs opens when every job is done (the Routine rule wins, on
 * a free day too), and a day with none opens when the meals are settled, or at once on a free day: a rest day's small treat.
 * The level is the streak's (`levelFor`). Nothing here is stored: undo a tick and an unsolved puzzle closes again.
 */
export function puzzleToday(o: {
  routine: { done: number; total: number };
  mealsComplete: boolean;
  freeDay: boolean;
  streak: number;
  solved: PuzzleLog | undefined;
}): PuzzleToday {
  if (o.solved) return { kind: 'solved', level: o.solved.level, seconds: o.solved.seconds };
  if (o.routine.total > 0) {
    return o.routine.done >= o.routine.total ? { kind: 'open', level: levelFor(o.streak) } : { kind: 'closed', by: 'routine', done: o.routine.done, total: o.routine.total };
  }
  return o.mealsComplete || o.freeDay ? { kind: 'open', level: levelFor(o.streak) } : { kind: 'closed', by: 'meals' };
}

/** A solved record as the app reads it: a real date, a time in seconds that is a number from 0 up, and a level the puzzle has (a whole number that is a key of `LEVELS`). */
export function isPuzzleLog(v: unknown): v is PuzzleLog {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return isIsoDate(r.date) && typeof r.seconds === 'number' && Number.isFinite(r.seconds) && r.seconds >= 0 && typeof r.level === 'number' && Number.isInteger(r.level) && r.level in LEVELS;
}

/**
 * The records with a day solved: added once, in date order; a day already there keeps the faster time (the faster record whole,
 * its level with it, since the time was for that level's puzzle). The same list when nothing changes, and a record the load
 * would drop (`isPuzzleLog`) is never taken.
 */
export function withSolved(puzzles: PuzzleLog[], log: PuzzleLog): PuzzleLog[] {
  if (!isPuzzleLog(log)) return puzzles;
  const have = puzzles.find((p) => p.date === log.date);
  if (!have) return [...puzzles, log].sort((a, b) => compareDates(a.date, b.date));
  return log.seconds < have.seconds ? puzzles.map((p) => (p === have ? log : p)) : puzzles;
}

/** Two dates in order by their characters, so every device holds the records the same way. */
function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
