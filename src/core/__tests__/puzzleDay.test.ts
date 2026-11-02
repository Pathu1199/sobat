import { describe, expect, it } from 'vitest';
import { isPuzzleLog, puzzleToday, withSolved } from '../puzzleDay';
import type { PuzzleLog } from '../types';
import { LEVELS, type ZipLevel } from '../zip';

const log = (date: string, seconds: number, level: PuzzleLog['level'] = 1): PuzzleLog => ({ date, seconds, level });

describe('puzzleToday', () => {
  const base = { routine: { done: 0, total: 0 }, mealsComplete: false, freeDay: false, streak: 0, solved: undefined };

  it('is closed by the Routine while jobs are left, saying how many are done', () => {
    expect(puzzleToday({ ...base, routine: { done: 2, total: 4 } })).toEqual({ kind: 'closed', by: 'routine', done: 2, total: 4 });
    expect(puzzleToday({ ...base, routine: { done: 0, total: 1 } })).toEqual({ kind: 'closed', by: 'routine', done: 0, total: 1 });
  });

  it('is closed by the Routine even when the meals are all logged: the jobs are what open it on a day that has any', () => {
    expect(puzzleToday({ ...base, routine: { done: 3, total: 4 }, mealsComplete: true })).toEqual({ kind: 'closed', by: 'routine', done: 3, total: 4 });
  });

  it('opens when every job due today is done, at the level of the streak', () => {
    expect(puzzleToday({ ...base, routine: { done: 4, total: 4 }, streak: 0 })).toEqual({ kind: 'open', level: 1 });
    expect(puzzleToday({ ...base, routine: { done: 4, total: 4 }, streak: 12 })).toEqual({ kind: 'open', level: 3 });
  });

  it('counts a day with more done than due (a timer past its target) as done', () => {
    expect(puzzleToday({ ...base, routine: { done: 5, total: 4 } })).toEqual({ kind: 'open', level: 1 });
  });

  it('takes the level from the streak at every edge', () => {
    const level = (streak: number) => {
      const t = puzzleToday({ ...base, routine: { done: 1, total: 1 }, streak });
      return t.kind === 'open' ? t.level : null;
    };
    expect([0, 2, 3, 6, 7, 20, 21, 29, 30, 65, 66, 400].map(level)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it('on a day with no job due is closed by the meals until they are all logged or skipped, then open', () => {
    expect(puzzleToday({ ...base })).toEqual({ kind: 'closed', by: 'meals' });
    expect(puzzleToday({ ...base, mealsComplete: true, streak: 8 })).toEqual({ kind: 'open', level: 3 });
  });

  it('on a free day with no job due is open at the streak\'s level, with the meals logged or not: a rest day\'s small treat', () => {
    expect(puzzleToday({ ...base, freeDay: true })).toEqual({ kind: 'open', level: 1 });
    expect(puzzleToday({ ...base, freeDay: true, mealsComplete: true, streak: 25 })).toEqual({ kind: 'open', level: 4 });
    expect(puzzleToday({ ...base, freeDay: true, streak: 70 })).toEqual({ kind: 'open', level: 6 });
  });

  it('on a free day with a job due still needs the job: the Routine rule wins', () => {
    expect(puzzleToday({ ...base, freeDay: true, routine: { done: 1, total: 2 } })).toEqual({ kind: 'closed', by: 'routine', done: 1, total: 2 });
    expect(puzzleToday({ ...base, freeDay: true, routine: { done: 1, total: 2 }, mealsComplete: true })).toEqual({ kind: 'closed', by: 'routine', done: 1, total: 2 });
    expect(puzzleToday({ ...base, freeDay: true, routine: { done: 2, total: 2 }, streak: 8 })).toEqual({ kind: 'open', level: 3 });
  });

  it('a solved day reads solved on a free day too', () => {
    expect(puzzleToday({ ...base, freeDay: true, solved: log('2026-11-02', 61, 2) })).toEqual({ kind: 'solved', level: 2, seconds: 61 });
  });

  it('shows the stored time and level once solved, whatever the Routine and the streak say now', () => {
    const solved = log('2026-11-02', 83, 2);
    expect(puzzleToday({ ...base, routine: { done: 4, total: 4 }, streak: 80, solved })).toEqual({ kind: 'solved', level: 2, seconds: 83 });
    // A tick undone afterwards: the day still reads solved.
    expect(puzzleToday({ ...base, routine: { done: 3, total: 4 }, streak: 2, solved })).toEqual({ kind: 'solved', level: 2, seconds: 83 });
    // A day with no job and the meals no longer complete: the same.
    expect(puzzleToday({ ...base, mealsComplete: false, solved })).toEqual({ kind: 'solved', level: 2, seconds: 83 });
  });
});

describe('isPuzzleLog', () => {
  it('reads a date, a time that is a number from 0 up, and a level from 1 to 6', () => {
    expect(isPuzzleLog(log('2026-11-02', 83, 3))).toBe(true);
    expect(isPuzzleLog(log('2026-11-02', 0, 6))).toBe(true);
    expect(isPuzzleLog(log('2026-11-02', 12.5, 1))).toBe(true);
  });

  it('refuses anything else', () => {
    const good = log('2026-11-02', 83, 3);
    for (const bad of [null, undefined, 'x', 7, [], {}, { ...good, date: '2026-13-40' }, { ...good, date: '02-11-2026' }, { ...good, date: 20261102 }, { ...good, seconds: -1 }, { ...good, seconds: Number.NaN }, { ...good, seconds: Number.POSITIVE_INFINITY }, { ...good, seconds: '83' }, { ...good, level: 0 }, { ...good, level: 7 }, { ...good, level: 2.5 }, { ...good, level: '3' }, { date: good.date, seconds: 83 }]) {
      expect(isPuzzleLog(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('isPuzzleLog and the levels', () => {
  it('reads the level range from LEVELS, so a level added later is not dropped on load', () => {
    const table = LEVELS as Record<number, (typeof LEVELS)[ZipLevel]>;
    const seventh = { date: '2026-11-02', seconds: 90, level: 7 };
    expect(isPuzzleLog(seventh)).toBe(false);
    table[7] = { size: 9, numbers: 9 };
    try {
      expect(isPuzzleLog(seventh)).toBe(true);
      expect(isPuzzleLog({ ...seventh, level: 8 })).toBe(false);
    } finally {
      delete table[7];
    }
    expect(isPuzzleLog(seventh)).toBe(false);
  });

  it('accepts exactly the levels LEVELS has, as whole numbers', () => {
    for (const level of Object.keys(LEVELS).map(Number)) expect(isPuzzleLog(log('2026-11-02', 5, level as ZipLevel)), `level ${level}`).toBe(true);
    for (const level of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 'constructor', '1']) expect(isPuzzleLog({ ...log('2026-11-02', 5), level }), String(level)).toBe(false);
  });
});

describe('withSolved', () => {
  it('adds the record of a day', () => {
    expect(withSolved([], log('2026-11-02', 90))).toEqual([log('2026-11-02', 90)]);
  });

  it('keeps every other day and the days in order', () => {
    const out = withSolved([log('2026-10-30', 70), log('2026-11-01', 80)], log('2026-10-31', 90));
    expect(out.map((p) => p.date)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('keeps the faster time when a day is solved twice', () => {
    const first = [log('2026-11-02', 90, 2)];
    expect(withSolved(first, log('2026-11-02', 75, 2))).toEqual([log('2026-11-02', 75, 2)]);
    // The slower one changes nothing: the very same list.
    expect(withSolved(first, log('2026-11-02', 120, 2))).toBe(first);
    expect(withSolved(first, log('2026-11-02', 90, 2))).toBe(first);
  });

  it('keeps one record for the day, the faster one whole, level with it, and the other days as they were', () => {
    const before = [log('2026-11-01', 60), log('2026-11-02', 90, 2)];
    const out = withSolved(before, log('2026-11-02', 40, 3));
    expect(out).toEqual([log('2026-11-01', 60), log('2026-11-02', 40, 3)]);
    expect(out[0]).toBe(before[0]);
  });

  it('never changes the list it was given', () => {
    const before = [log('2026-11-02', 90)];
    withSolved(before, log('2026-11-02', 10));
    withSolved(before, log('2026-11-03', 10));
    expect(before).toEqual([log('2026-11-02', 90)]);
  });

  it('takes no record the load would drop', () => {
    const before = [log('2026-11-02', 90)];
    expect(withSolved(before, log('2026-11-03', Number.NaN))).toBe(before);
    expect(withSolved(before, log('2026-11-03', -4))).toBe(before);
    expect(withSolved(before, { date: 'today', seconds: 4, level: 1 })).toBe(before);
  });
});
