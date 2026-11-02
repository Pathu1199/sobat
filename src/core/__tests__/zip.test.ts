import { describe, expect, it } from 'vitest';
import { addDays } from '../date';
import { buildPuzzle, hashString, LEVELS, levelFor, mulberry32, puzzleFor, solutions, solved, step, type Cell, type ZipLevel, type ZipPuzzle } from '../zip';

const PINNED_SEED = 1040194348;

describe('hashString and mulberry32', () => {
  it('the string hash is FNV-1a: stable, and the published test values hold', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
    // The seed one puzzle is built from, pinned so a change to the hash is seen as a change to every puzzle.
    expect(hashString('zip:2026-11-01:3')).toBe(PINNED_SEED);
  });

  it('a seed gives the same numbers every time and another seed gives others', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const c = mulberry32(12346);
    const xs = Array.from({ length: 20 }, () => a());
    const ys = Array.from({ length: 20 }, () => b());
    const zs = Array.from({ length: 20 }, () => c());
    expect(xs).toEqual(ys);
    expect(xs).not.toEqual(zs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('is spread over 0 to 1: the mean of a thousand draws is near a half', () => {
    const r = mulberry32(hashString('zip:2026-11-01:1'));
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += r();
    expect(sum / 1000).toBeGreaterThan(0.45);
    expect(sum / 1000).toBeLessThan(0.55);
  });
});

describe('levelFor and LEVELS', () => {
  it('maps the Routine streak to a level at every edge of the table', () => {
    const at = (n: number) => levelFor(n);
    expect([at(0), at(1), at(2)]).toEqual([1, 1, 1]);
    expect([at(3), at(6)]).toEqual([2, 2]);
    expect([at(7), at(20)]).toEqual([3, 3]);
    expect([at(21), at(29)]).toEqual([4, 4]);
    expect([at(30), at(65)]).toEqual([5, 5]);
    expect([at(66), at(400)]).toEqual([6, 6]);
  });

  it('a negative, fractional or non-finite streak is read safely', () => {
    expect(levelFor(-1)).toBe(1);
    expect(levelFor(NaN)).toBe(1);
    expect(levelFor(Infinity)).toBe(1);
    expect(levelFor(-Infinity)).toBe(1);
    expect(levelFor(2.9)).toBe(1);
    expect(levelFor(3.2)).toBe(2);
  });

  it('has the grid and the number target of the design for each level', () => {
    const rows = ([1, 2, 3, 4, 5, 6] as ZipLevel[]).map((l) => [LEVELS[l].size, LEVELS[l].numbers]);
    expect(rows).toEqual([
      [5, 9],
      [6, 10],
      [6, 7],
      [7, 9],
      [7, 7],
      [8, 8],
    ]);
  });
});

// Two small hand-made puzzles on a 4 x 4 grid (cell = row * 4 + col):
//   S: the numbers sit on a serpentine, 0 1 2 3 7 6 5 4 8 9 10 11 15 14 13 12; 1 on cell 0, 2 on cell 5, 3 on cell 12.
//   T: 1 on cell 0, 2 on cell 10, 3 on cell 2 and 4 on cell 6, answered by T_PATH.
const S: ZipPuzzle = { date: '2026-11-02', level: 1, size: 4, clues: { 0: 1, 5: 2, 12: 3 }, last: 3 };
const S_PATH: Cell[] = [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12];
const T: ZipPuzzle = { date: '2026-11-02', level: 1, size: 4, clues: { 0: 1, 10: 2, 2: 3, 6: 4 }, last: 4 };
const T_PATH: Cell[] = [0, 4, 8, 12, 13, 14, 15, 11, 10, 9, 5, 1, 2, 3, 7, 6];

describe('step', () => {
  it('an empty line takes square 1 and nothing else', () => {
    expect(step(S, [], 0)).toEqual([0]);
    expect(step(S, [], 1)).toEqual([]);
    expect(step(S, [], 5)).toEqual([]);
    expect(step(S, [], 12)).toEqual([]);
  });

  it('goes on to a square next to its end', () => {
    expect(step(S, [0], 1)).toEqual([0, 1]);
    expect(step(S, [0, 1], 2)).toEqual([0, 1, 2]);
    expect(step(S, [0, 1], 5)).toEqual([0, 1, 5]);
  });

  it('does not go to a square that is not next to its end', () => {
    expect(step(S, [0], 6)).toEqual([0]);
    expect(step(S, [0], 5)).toEqual([0]);
    expect(step(S, [0, 1], 4)).toEqual([0, 1]);
  });

  it('does not go to a number that is not the one due, and takes the one that is', () => {
    expect(step(S, [0, 4, 8], 12)).toEqual([0, 4, 8]);
    expect(step(S, [0, 4], 5)).toEqual([0, 4, 5]);
    expect(step(T, [0, 4, 8, 9], 10)).toEqual([0, 4, 8, 9, 10]);
    expect(step(T, [0, 4, 8, 9, 5, 1], 2)).toEqual([0, 4, 8, 9, 5, 1]);
  });

  it('backs up one when the finger goes back to the square before the end', () => {
    expect(step(S, [0, 1, 2], 1)).toEqual([0, 1]);
    expect(step(S, [0, 1], 0)).toEqual([0]);
  });

  it('cuts the line back when the finger touches an earlier square of it', () => {
    expect(step(S, [0, 1, 2, 3, 7, 6], 1)).toEqual([0, 1]);
    expect(step(S, [0, 1, 2, 3, 7, 6], 3)).toEqual([0, 1, 2, 3]);
    expect(step(S, [0, 1, 2], 0)).toEqual([0]);
  });

  it('does nothing when the finger is on the last square of the line', () => {
    const line = [0, 1, 2];
    expect(step(S, line, 2)).toBe(line);
    expect(step(S, [0], 0)).toEqual([0]);
  });

  it('takes a straight jump square by square', () => {
    expect(step(S, [0], 3)).toEqual([0, 1, 2, 3]);
    expect(step(S, [0, 1, 2, 3], 15)).toEqual([0, 1, 2, 3, 7, 11, 15]);
    expect(step(S, [0, 1, 2, 3, 7, 11, 15], 12)).toEqual([0, 1, 2, 3, 7, 11, 15, 14, 13]);
  });

  it('stops a jump before the first square that is not allowed, keeping what it took', () => {
    // Along row 0 from 0, square 2 holds 3 while 2 is still to come.
    expect(step(T, [0], 3)).toEqual([0, 1]);
    // Down column 0 from 0, square 12 is N with squares left over.
    expect(step(S, [0], 12)).toEqual([0, 4, 8]);
    // The number due is taken in a jump when it is reached in order.
    expect(step(S, [0, 1], 13)).toEqual([0, 1, 5, 9, 13]);
    expect(step(S, [0, 4], 7)).toEqual([0, 4, 5, 6, 7]);
  });

  it('a jump that is not along the end\'s row or column changes nothing', () => {
    expect(step(S, [0], 10)).toEqual([0]);
    expect(step(S, [0, 1, 2], 8)).toEqual([0, 1, 2]);
    expect(step(S, [0, 1, 5], 8)).toEqual([0, 1, 5]);
  });

  it('does not take N before the last square, and takes it as the last', () => {
    expect(step(S, [0, 1, 5, 4, 8], 12)).toEqual([0, 1, 5, 4, 8]);
    const nearly = S_PATH.slice(0, 15);
    expect(step(S, nearly, 12)).toEqual(S_PATH);
  });

  it('ignores a square that is not on the grid', () => {
    expect(step(S, [0], 16)).toEqual([0]);
    expect(step(S, [0], -1)).toEqual([0]);
    expect(step(S, [0], 1.5)).toEqual([0]);
    expect(step(S, [], 99)).toEqual([]);
  });

  it('never changes the line it is given', () => {
    const line = Object.freeze([0, 1, 2, 3]) as Cell[];
    expect(() => {
      step(S, line, 7);
      step(S, line, 1);
      step(S, line, 0);
      step(S, line, 15);
      step(S, line, 5);
    }).not.toThrow();
    expect(line).toEqual([0, 1, 2, 3]);
  });
});

describe('solved', () => {
  it('is true for a line over every square, in order, from 1 to N', () => {
    expect(solved(S, S_PATH)).toBe(true);
    expect(solved(T, T_PATH)).toBe(true);
  });

  it('is false for a line that misses a square', () => {
    expect(solved(S, S_PATH.slice(0, 15))).toBe(false);
    expect(solved(T, [])).toBe(false);
  });

  it('is false for a line that does not start on 1 or does not end on N', () => {
    expect(solved(S, [...S_PATH].reverse())).toBe(false);
    expect(solved(T, [...T_PATH].reverse())).toBe(false);
    // Over every square from 1, the numbers in order, but it goes on past N (square 6) to end on square 3.
    expect(solved(T, [0, 4, 8, 12, 13, 14, 15, 11, 10, 9, 5, 1, 2, 6, 7, 3])).toBe(false);
  });

  it('is false for a line that meets the numbers out of order', () => {
    // From 0 to 6 over every square, but 3 (square 2) comes before 2 (square 10).
    expect(solved(T, [0, 1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4, 5, 9, 10, 6])).toBe(false);
  });

  it('is false when two squares in a row are not neighbours', () => {
    const jump = [...T_PATH];
    [jump[4], jump[5]] = [jump[5], jump[4]];
    expect(solved(T, jump)).toBe(false);
  });

  it('is false when a square repeats', () => {
    expect(solved(T, [0, 4, 8, 12, 13, 14, 15, 11, 10, 9, 5, 1, 5, 1, 2, 6])).toBe(false);
    expect(solved(S, [...S_PATH, 12])).toBe(false);
  });

  it('is false for squares outside the grid', () => {
    expect(solved(S, [...S_PATH.slice(0, 15), 16])).toBe(false);
    expect(solved(S, [...S_PATH.slice(0, 15), -1])).toBe(false);
  });
});

/** The puzzle a path gives with numbers on the given positions of it (in path order), the first and the last always among them. */
function cluedAlong(base: ZipPuzzle, path: Cell[], positions: number[]): ZipPuzzle {
  const marks = [...new Set([0, path.length - 1, ...positions])].sort((a, b) => a - b);
  const clues: Record<number, number> = {};
  marks.forEach((at, i) => {
    clues[path[at]] = i + 1;
  });
  return { ...base, clues, last: marks.length };
}

/** Every answer counted the slow, plain way (no pruning, no cleverness), to check the solver against. */
function naiveCount(p: ZipPuzzle): number {
  const n = p.size * p.size;
  const start = Number(Object.keys(p.clues).find((k) => p.clues[Number(k)] === 1));
  const seen = new Set<number>([start]);
  let count = 0;
  const go = (cell: number, due: number): void => {
    if (seen.size === n) {
      if (p.clues[cell] === p.last) count++;
      return;
    }
    const r = Math.floor(cell / p.size);
    const c = cell % p.size;
    const around = [r > 0 ? cell - p.size : -1, r < p.size - 1 ? cell + p.size : -1, c > 0 ? cell - 1 : -1, c < p.size - 1 ? cell + 1 : -1];
    for (const nb of around) {
      if (nb < 0 || seen.has(nb)) continue;
      const num = p.clues[nb];
      if (num !== undefined && num !== due) continue;
      seen.add(nb);
      go(nb, num !== undefined ? due + 1 : due);
      seen.delete(nb);
    }
  };
  go(start, 2);
  return count;
}

const BIG = 5_000_000;

describe('solutions', () => {
  it('counts the answers of the hand-made puzzles as the plain count does', () => {
    expect(naiveCount(S)).toBeGreaterThan(1);
    expect(solutions(S, 1000, BIG)).toEqual({ count: naiveCount(S), complete: true });
    expect(solutions(T, 1000, BIG)).toEqual({ count: naiveCount(T), complete: true });
  });

  it('counts the answers of puzzles with a few numbers on a 5 x 5 as the plain count does', () => {
    const base = puzzleFor('2026-11-01', 1);
    const { path } = buildPuzzle('2026-11-01', 1);
    const rand = mulberry32(99);
    let manyAnswers = 0;
    for (let i = 0; i < 24; i++) {
      const positions = Array.from({ length: 1 + (i % 7) }, () => 1 + Math.floor(rand() * 23));
      const p = cluedAlong(base, path, positions);
      const want = naiveCount(p);
      expect(want).toBeGreaterThan(0);
      expect(solutions(p, 1_000_000, BIG)).toEqual({ count: want, complete: true });
      if (want > 1) manyAnswers++;
    }
    expect(manyAnswers).toBeGreaterThan(6);
  });

  it('agrees with the plain count that built 6 x 6 puzzles have exactly one answer', () => {
    for (const level of [2, 3] as ZipLevel[]) {
      for (let i = 0; i < 8; i++) {
        const date = addDays('2026-12-01', i);
        expect(naiveCount(puzzleFor(date, level)), `${date} level ${level}`).toBe(1);
      }
    }
  });

  it('stops at the cap and says the count is complete up to it', () => {
    const r = solutions(S, 2, BIG);
    expect(r.count).toBe(2);
    expect(r.complete).toBe(true);
    expect(solutions(S, 1, BIG).count).toBe(1);
  });

  it('stops on the budget and says it did not finish', () => {
    const base = puzzleFor('2026-11-01', 6);
    const { path } = buildPuzzle('2026-11-01', 6);
    const sparse = cluedAlong(base, path, []);
    const r = solutions(sparse, 1_000_000_000, 50);
    expect(r.complete).toBe(false);
    expect(solutions(S, 1000, 3).complete).toBe(false);
    expect(solutions(S, 1000, 3).count).toBeLessThanOrEqual(naiveCount(S));
  });

  it('finds none when the numbers cannot be met', () => {
    // On a 3 x 3 the line starts and ends on squares of one colour, and 1 and 3 here are of different colours.
    const none: ZipPuzzle = { date: '2026-11-02', level: 1, size: 3, clues: { 0: 1, 1: 3, 2: 2 }, last: 3 };
    expect(solutions(none, 10, BIG)).toEqual({ count: 0, complete: true });
    // A puzzle with no square 1.
    expect(solutions({ ...S, clues: { 5: 2, 12: 3 } }, 10, BIG)).toEqual({ count: 0, complete: true });
  });
});

describe('puzzleFor', () => {
  const dates = Array.from({ length: 60 }, (_, i) => addDays('2026-11-01', i));
  const timings: number[] = [];

  for (const level of [1, 2, 3, 4, 5, 6] as ZipLevel[]) {
    it(`builds a valid puzzle with one answer at level ${level}, for 60 dates`, () => {
      const { size, numbers } = LEVELS[level];
      let slowest = 0;
      for (const date of dates) {
        const t0 = performance.now();
        const { puzzle: p, path } = buildPuzzle(date, level);
        slowest = Math.max(slowest, performance.now() - t0);
        const label = `${date} level ${level}`;
        expect(p.date, label).toBe(date);
        expect(p.level, label).toBe(level);
        expect(p.size, label).toBe(size);
        // The built path covers every square once, each step to a neighbour.
        expect(path, label).toHaveLength(size * size);
        expect(new Set(path).size, label).toBe(size * size);
        path.forEach((c, i) => {
          if (i > 0) expect(Math.abs(Math.floor(c / size) - Math.floor(path[i - 1] / size)) + Math.abs((c % size) - (path[i - 1] % size)), label).toBe(1);
        });
        // Its numbers are 1 to last, first square to last square, in order along it.
        expect(p.clues[path[0]], label).toBe(1);
        expect(p.clues[path[path.length - 1]], label).toBe(p.last);
        expect(p.last, label).toBeGreaterThanOrEqual(numbers);
        expect(Object.keys(p.clues), label).toHaveLength(p.last);
        // Few enough numbers to be a puzzle: never most of the squares.
        expect(p.last, label).toBeLessThanOrEqual(Math.floor(0.6 * size * size));
        const along = path.map((c) => p.clues[c]).filter((n) => n !== undefined);
        expect(along, label).toEqual(Array.from({ length: p.last }, (_, i) => i + 1));
        expect(solved(p, path), label).toBe(true);
        // One answer, found by a search that was allowed to finish.
        expect(solutions(p, 2, BIG), label).toEqual({ count: 1, complete: true });
      }
      timings.push(slowest);
    });
  }

  it('builds every level well inside the time a phone has (slowest build of any date and level)', () => {
    expect(timings).toHaveLength(6);
    expect(Math.max(...timings)).toBeLessThan(250);
  });

  it('gives the same puzzle for the same date and level, and others for other dates and levels', () => {
    expect(puzzleFor('2026-11-02', 3)).toEqual(puzzleFor('2026-11-02', 3));
    expect(buildPuzzle('2026-11-02', 3).path).toEqual(buildPuzzle('2026-11-02', 3).path);
    expect(puzzleFor('2026-11-02', 3)).not.toEqual(puzzleFor('2026-11-03', 3));
    expect(puzzleFor('2026-11-02', 2)).not.toEqual(puzzleFor('2026-11-02', 3));
    const clueSets = new Set(dates.map((d) => JSON.stringify(puzzleFor(d, 2).clues)));
    expect(clueSets.size).toBeGreaterThan(55);
  });

  it('every built line can be drawn square by square through step, and then solved is true', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as ZipLevel[]) {
      const { puzzle, path } = buildPuzzle('2026-11-02', level);
      let line: Cell[] = [];
      for (const cell of path) line = step(puzzle, line, cell);
      expect(line, `level ${level}`).toEqual(path);
      expect(solved(puzzle, line), `level ${level}`).toBe(true);
    }
  });

  it('pins the puzzle of one day, so a change to the generator (which changes every day\'s puzzle, on the phone and on the website alike) is seen as one', () => {
    expect(puzzleFor('2026-11-02', 1)).toEqual({
      date: '2026-11-02',
      level: 1,
      size: 5,
      clues: { 1: 3, 4: 1, 6: 2, 9: 8, 14: 9, 15: 6, 16: 5, 17: 4, 19: 7 },
      last: 9,
    });
    // A fingerprint of the whole puzzle of that day at each level.
    const prints = ([1, 2, 3, 4, 5, 6] as ZipLevel[]).map((l) => hashString(JSON.stringify(puzzleFor('2026-11-02', l))));
    expect(prints).toEqual([2125174122, 2944207107, 3031794404, 3723629840, 1270934230, 2081711117]);
  });

  it('the puzzle is plain data: it survives being saved and read back', () => {
    const p = puzzleFor('2026-11-02', 4);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});
