import type { ISODate } from './types';

/**
 * Today's puzzle: a Zip path puzzle. A square grid holds some numbers 1, 2, …
 * N; the user draws one line, square to square, that starts on 1, meets the
 * numbers in order, ends on N and goes through every square once. A puzzle is
 * built from the date and the level alone by a seeded generator, so the phone
 * and the website show the same one on the same day, and it is built to have
 * one answer, so it can be reasoned out and not guessed. Every rule here is
 * pure; the screen and the store only wrap them.
 */

export type ZipLevel = 1 | 2 | 3 | 4 | 5 | 6;
/** A square of the grid: row * size + col. */
export type Cell = number;
/** `clues` maps a square to its number, 1 to `last`; a plain record so a puzzle can be compared and saved. */
export type ZipPuzzle = { date: ISODate; level: ZipLevel; size: number; clues: Record<number, number>; last: number };

/**
 * The grid and the count of numbers aimed for at each level. Without walls one answer needs about a third of the squares
 * numbered, so the generator adds numbers past the aim whenever that is what one answer needs: levels 3, 5 and 6 (the
 * hardest form of their grids, 7, 7 and 8) end up with only what one answer needs. The first level at each grid size (1, 2
 * and 4) aims higher (12, 16 and 20), numbers spread evenly along the line, which is the gentler form of that grid.
 */
export const LEVELS: Record<ZipLevel, { size: number; numbers: number }> = {
  1: { size: 5, numbers: 12 },
  2: { size: 6, numbers: 16 },
  3: { size: 6, numbers: 7 },
  4: { size: 7, numbers: 20 },
  5: { size: 7, numbers: 7 },
  6: { size: 8, numbers: 8 },
};

/** The level for a Routine streak (with its shield): 0 to 2 days is level 1, 3 to 6 level 2, 7 to 20 level 3, 21 to 29 level 4, 30 to 65 level 5, 66 and more level 6. A negative or unreadable streak is level 1. */
export function levelFor(streak: number): ZipLevel {
  if (!Number.isFinite(streak) || streak < 3) return 1;
  if (streak < 7) return 2;
  if (streak < 21) return 3;
  if (streak < 30) return 4;
  if (streak < 66) return 5;
  return 6;
}

/** The highest level this build has. */
const TOP_LEVEL = Object.keys(LEVELS).length;

/** Whether a number is a level this build has: a whole number that is a key of `LEVELS`. A record from a newer build may carry one it has not. */
export function isLevel(n: number): n is ZipLevel {
  return Number.isInteger(n) && n in LEVELS;
}

/** The level to build a puzzle at for a stored one: itself when this build has it, the top level for a higher one (a newer build's), the first for anything unreadable. */
export function clampLevel(n: number): ZipLevel {
  if (isLevel(n)) return n;
  if (Number.isNaN(n)) return 1;
  return Math.min(TOP_LEVEL, Math.max(1, Math.trunc(n))) as ZipLevel;
}

/** FNV-1a over the characters of a string, as an unsigned 32-bit number. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small seeded random generator (mulberry32): each call gives a number from 0 up to, not including, 1; one seed always gives the same run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The row and the column (from 0) of a square of a `size` grid. */
export function rowCol(cell: Cell, size: number): { row: number; col: number } {
  return { row: Math.floor(cell / size), col: cell % size };
}

/** How many moves apart two squares of a `size` grid are (rows plus columns). Plain arithmetic, no allocation: the solver asks it in its loops. */
function apart(size: number, a: Cell, b: Cell): number {
  return Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size));
}

/** Whether two squares of a `size` grid share an edge. */
function adjacent(size: number, a: Cell, b: Cell): boolean {
  return apart(size, a, b) === 1;
}

/** Whether a value is a square of the grid. */
function onGrid(size: number, cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < size * size;
}

/** The number a square holds, or 0 when it holds none. */
function numberAt(p: ZipPuzzle, cell: Cell): number {
  return p.clues[cell] ?? 0;
}

/** The square holding a number, or -1 when none does. */
export function cellOfNumber(p: ZipPuzzle, n: number): Cell {
  for (const key of Object.keys(p.clues)) if (p.clues[Number(key)] === n) return Number(key);
  return -1;
}

/**
 * The number due next on a line: one more than the highest number it has passed, or 1 for an empty line. The line `step` builds
 * always meets the numbers in order, so this is also the smallest number not yet on the line.
 */
function nextDue(p: ZipPuzzle, path: Cell[]): number {
  let top = 0;
  for (const c of path) top = Math.max(top, numberAt(p, c));
  return top + 1;
}

/** One square at a time: the line after the finger reaches `cell`, which is next to the line's end or on the line (or the line itself when it may not go there). */
function stepOne(p: ZipPuzzle, path: Cell[], cell: Cell): Cell[] {
  if (path.length === 0) return cell === cellOfNumber(p, 1) ? [cell] : path;
  const end = path[path.length - 1];
  if (cell === end) return path;
  const at = path.indexOf(cell);
  // Back to the square before the end steps back one; any earlier square cuts the line back to it.
  if (at >= 0) return path.slice(0, at + 1);
  if (!adjacent(p.size, end, cell)) return path;
  const n = numberAt(p, cell);
  if (n !== 0) {
    if (n !== nextDue(p, path)) return path;
    // N ends the line, so it waits until it is the only square left.
    if (n === p.last && path.length !== p.size * p.size - 1) return path;
  }
  return [...path, cell];
}

/**
 * The line after the finger reaches `cell`, by the rules of the puzzle: on the
 * last square nothing changes; on the square before it the line steps back
 * one; on an earlier square it is cut back to it; next to the end, off the
 * line, on a square with no number or the next number due (N only as the last
 * square), the line goes there. An empty line takes only square 1. A jump along
 * a row or column (a fast finger) is taken square by square while each square
 * is allowed and stops at the first that is not; any other jump changes
 * nothing. The line it is given is never changed: when nothing changes, it is
 * returned as it is.
 */
export function step(p: ZipPuzzle, path: Cell[], cell: Cell): Cell[] {
  if (!onGrid(p.size, cell)) return path;
  const end = path.length > 0 ? path[path.length - 1] : -1;
  // A square of the line, wherever it is, cuts the line back to it; so does a square next to the end.
  if (end < 0 || path.includes(cell) || adjacent(p.size, end, cell)) return stepOne(p, path, cell);
  const to = rowCol(cell, p.size);
  const from = rowCol(end, p.size);
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr !== 0 && dc !== 0) return path;
  // Along one row or column: the squares between, then the target, one at a time from the end.
  const stride = dr !== 0 ? Math.sign(dr) * p.size : Math.sign(dc);
  const count = Math.abs(dr !== 0 ? dr : dc);
  let line = path;
  for (let i = 1; i <= count; i++) {
    const next = stepOne(p, line, end + stride * i);
    if (next === line) break;
    line = next;
  }
  return line;
}

/** Whether the line wins: every square once, each step to a neighbour, from 1 to N with the numbers in order. */
export function solved(p: ZipPuzzle, path: Cell[]): boolean {
  if (path.length !== p.size * p.size) return false;
  const seen = new Set<Cell>();
  let due = 1;
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (!onGrid(p.size, c) || seen.has(c)) return false;
    if (i > 0 && !adjacent(p.size, path[i - 1], c)) return false;
    seen.add(c);
    const n = numberAt(p, c);
    if (n !== 0) {
      if (n !== due) return false;
      due++;
    }
  }
  // Squares 1 to N all met, in order, so the line began on 1 and ends on N (the squares are all covered, so none was missed).
  return due === p.last + 1 && numberAt(p, path[0]) === 1 && numberAt(p, path[path.length - 1]) === p.last;
}

/** For each square of a `size` grid, the squares next to it (up, down, left, right), made once per size. */
const AROUND = new Map<number, Cell[][]>();
function around(size: number): Cell[][] {
  let table = AROUND.get(size);
  if (!table) {
    table = [];
    for (let c = 0; c < size * size; c++) {
      const { row: r, col } = rowCol(c, size);
      const next: Cell[] = [];
      if (r > 0) next.push(c - size);
      if (col > 0) next.push(c - 1);
      if (col < size - 1) next.push(c + 1);
      if (r < size - 1) next.push(c + size);
      table.push(next);
    }
    AROUND.set(size, table);
  }
  return table;
}

/**
 * Searches for answers, depth first from square 1: the line goes to a free
 * square next to its end, onto a numbered square only when it is the number due
 * and onto N only as the very last square. After each move it gives up when
 * the squares left cannot be covered any more: they are no longer one
 * connected piece the line can reach (N ends the line, so it is not crossed),
 * one has fewer ways in than it needs (two, one for N), or there are fewer
 * squares left than the numbers still to meet are apart. Each move counts a
 * step against `budget`. It stops at `cap` answers or when the budget is spent,
 * and returns what it found (each answer a line of squares) and whether it
 * finished.
 */
function search(p: ZipPuzzle, cap: number, budget: number): { found: Cell[][]; complete: boolean } {
  const found: Cell[][] = [];
  const n = p.size * p.size;
  // Where each number sits; a number that sits nowhere means no line can meet it.
  const cells = new Int32Array(p.last + 1).fill(-1);
  const num = new Int32Array(n);
  for (const key of Object.keys(p.clues)) {
    const cell = Number(key);
    const k = p.clues[cell];
    if (cell >= 0 && cell < n && k >= 1 && k <= p.last) {
      num[cell] = k;
      cells[k] = cell;
    }
  }
  for (let k = 1; k <= p.last; k++) if (cells[k] < 0) return { found, complete: true };
  const start = cells[1];
  const finish = cells[p.last];
  if (cap <= 0 || (start === finish && n > 1)) return { found, complete: true };
  if (n === 1) return { found: [[start]], complete: true };

  const nbrs = around(p.size);
  // chain[k]: the moves it takes at the least to go from number k through every number up to N.
  const chain = new Int32Array(p.last + 1);
  for (let k = p.last - 1; k >= 1; k--) chain[k] = chain[k + 1] + apart(p.size, cells[k], cells[k + 1]);
  const seen = new Uint8Array(n);
  const reached = new Int32Array(n);
  const stack = new Int32Array(n);
  const route: Cell[] = [start];
  let stamp = 0;
  let steps = 0;
  let stopped = false;
  let ranOut = false;
  seen[start] = 1;

  /** How many squares next to `u` are free or hold the line's end. */
  const ways = (u: Cell, end: Cell): number => {
    let w = 0;
    const beside = nbrs[u];
    for (let i = 0; i < beside.length; i++) if (seen[beside[i]] === 0 || beside[i] === end) w++;
    return w;
  };

  /** Whether `left` free squares can still be covered from `end`; `from` is where the end was (only the squares next to it lost a way in), or -1 to look at every square. */
  const viable = (from: Cell, end: Cell, left: number): boolean => {
    stamp++;
    let top = 0;
    let count = 0;
    stack[top++] = end;
    reached[end] = stamp;
    while (top > 0) {
      const c = stack[--top];
      if (c === finish) continue;
      const beside = nbrs[c];
      for (let i = 0; i < beside.length; i++) {
        const x = beside[i];
        if (seen[x] === 1 || reached[x] === stamp) continue;
        reached[x] = stamp;
        count++;
        stack[top++] = x;
      }
    }
    if (count !== left) return false;
    if (from < 0) {
      for (let u = 0; u < n; u++) if (seen[u] === 0 && ways(u, end) < (u === finish ? 1 : 2)) return false;
    } else {
      const beside = nbrs[from];
      for (let i = 0; i < beside.length; i++) {
        const u = beside[i];
        if (seen[u] === 0 && u !== end && ways(u, end) < (u === finish ? 1 : 2)) return false;
      }
    }
    return true;
  };

  /** The line is at `end`, the number `due` is next and `left` squares are free. */
  const go = (end: Cell, due: number, left: number): void => {
    const beside = nbrs[end];
    for (let i = 0; i < beside.length; i++) {
      const nb = beside[i];
      if (seen[nb] === 1) continue;
      const k = num[nb];
      if (k !== 0 && k !== due) continue;
      if (nb === finish && left !== 1) continue;
      if (++steps > budget) {
        ranOut = true;
        return;
      }
      seen[nb] = 1;
      route.push(nb);
      if (left === 1) {
        found.push([...route]);
        if (found.length >= cap) stopped = true;
      } else {
        const next = k !== 0 ? due + 1 : due;
        if (apart(p.size, nb, cells[next]) + chain[next] <= left - 1 && viable(end, nb, left - 1)) go(nb, next, left - 1);
      }
      route.pop();
      seen[nb] = 0;
      if (stopped || ranOut) return;
    }
  };

  if (viable(-1, start, n - 1)) go(start, 2, n - 1);
  return { found, complete: !ranOut };
}

/**
 * How many answers a puzzle has, counted up to `cap`, searching at most
 * `budget` moves. `complete` is false when the search ran out of budget (the
 * count is then only what was found so far); stopping at the cap is complete,
 * the puzzle has at least `cap` answers.
 */
export function solutions(p: ZipPuzzle, cap: number, budget: number): { count: number; complete: boolean } {
  const { found, complete } = search(p, cap, budget);
  return { count: found.length, complete };
}

/** A line over every square of the grid, one row after the other, back and forth. */
function serpentine(size: number): Cell[] {
  const path: Cell[] = [];
  for (let r = 0; r < size; r++) for (let i = 0; i < size; i++) path.push(r * size + (r % 2 === 0 ? i : size - 1 - i));
  return path;
}

/** Reverses the stretch of the line from index `a` to `b`, in place. */
function reverseRange(path: Cell[], a: number, b: number): void {
  for (let i = a, j = b; i < j; i++, j--) [path[i], path[j]] = [path[j], path[i]];
}

/**
 * One backbite: an end of the line reaches for a random square next to it; if
 * that square is on the line (and not the one it already touches), the stretch
 * between them turns around, which leaves a line over every square with a new
 * end. Many of these from a serpentine give an even, random line.
 */
function backbite(path: Cell[], size: number, rand: () => number): void {
  const n = path.length;
  const atHead = rand() < 0.5;
  const nbrs = around(size)[atHead ? path[0] : path[n - 1]];
  const j = path.indexOf(nbrs[Math.floor(rand() * nbrs.length)]);
  if (atHead) {
    if (j > 1) reverseRange(path, 0, j - 1);
  } else if (j < n - 2) {
    reverseRange(path, j + 1, n - 1);
  }
}

/** A random line over every square of the grid, which may run either way. */
function randomPath(size: number, rand: () => number): Cell[] {
  const path = serpentine(size);
  for (let i = 0; i < 40 * size * size; i++) backbite(path, size, rand);
  if (rand() < 0.5) path.reverse();
  return path;
}

/**
 * The moves one check for a second answer may spend while a puzzle is built.
 * Few numbers make a check long (a puzzle is hard to prove to have one answer
 * when it has few), so a check that runs out of budget is the sign to add
 * numbers, which is what keeps a build fast.
 */
const BUDGET = 3000;

/** The positions along a line of `count` numbers: the first and the last square, the others evenly spread and nudged one or two places at random. */
function spreadMarks(n: number, count: number, rand: () => number): number[] {
  const used = new Set<number>([0, n - 1]);
  for (let j = 1; j < count - 1; j++) {
    const nudge = (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 2));
    let at = Math.min(n - 2, Math.max(1, Math.round((j * (n - 1)) / (count - 1)) + nudge));
    while (used.has(at)) at = at < n - 2 ? at + 1 : 1;
    used.add(at);
  }
  return [...used].sort((a, b) => a - b);
}

/** The puzzle a line gives with numbers 1, 2, … on the squares at the given positions along it. */
function along(date: ISODate, level: ZipLevel, path: Cell[], marks: number[]): ZipPuzzle {
  const clues: Record<number, number> = {};
  marks.forEach((at, i) => {
    clues[path[at]] = i + 1;
  });
  return { date, level, size: LEVELS[level].size, clues, last: marks.length };
}

/**
 * Where a number is added so that `other`, a second answer, is lost. Numbering
 * a square of the built line puts it between the numbers on either side of it,
 * so `other` is lost when it meets that square outside the stretch between those
 * two. Of the squares for which that holds, the one in the middle of the widest
 * stretch. -1 when there is none (the two lines differ only inside the stretches).
 * `marks` (sorted) holds the first and the last position.
 */
function splitAt(path: Cell[], other: Cell[], marks: number[]): number {
  const metAt = new Map<Cell, number>();
  other.forEach((c, i) => metAt.set(c, i));
  let best = -1;
  let bestScore = -1;
  let lo = 0;
  for (let m = 1; m < path.length - 1; m++) {
    if (marks.includes(m)) {
      lo = m;
      continue;
    }
    const hi = marks.find((k) => k > m) ?? path.length - 1;
    const x = metAt.get(path[m]) ?? -1;
    if ((metAt.get(path[lo]) ?? -1) < x && x < (metAt.get(path[hi]) ?? path.length)) continue;
    const score = Math.min(m - lo, hi - m);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

/** The middles of the `count` widest stretches between two numbers, widest first (fewer when there are fewer stretches with a square in them). */
function middlesOfWidest(marks: number[], count: number): number[] {
  const gaps: { at: number; width: number }[] = [];
  for (let i = 1; i < marks.length; i++) if (marks[i] - marks[i - 1] > 1) gaps.push({ at: Math.floor((marks[i] + marks[i - 1]) / 2), width: marks[i] - marks[i - 1] });
  return gaps
    .sort((a, b) => b.width - a.width || a.at - b.at)
    .slice(0, count)
    .map((g) => g.at);
}

/**
 * The positions along the line to number next, after a check of the puzzle those marks give (`found`: the answers it found, which
 * are the built line or another). A second answer: the square that loses it (`splitAt`), else the middle of the widest stretch.
 * None found, which is a check that ran out of budget: the middles of a quarter more of the stretches, widest first. Empty only
 * when every square already holds a number.
 */
function nextMarks(path: Cell[], found: Cell[][], marks: number[]): number[] {
  const other = found.find((f) => f.some((c, i) => c !== path[i]));
  if (other) {
    const at = splitAt(path, other, marks);
    return at >= 0 ? [at] : middlesOfWidest(marks, 1);
  }
  return middlesOfWidest(marks, Math.max(1, Math.floor(marks.length / 4)));
}

/**
 * Builds the puzzle for a date and level, and the line it was built from (for
 * tests; the line is never shown). The random generator is seeded from the date
 * and level alone. It draws a random line over the grid, numbers its two ends
 * and a few squares between (the level's count, evenly spread), and then, until
 * the puzzle is proved to have one answer, adds numbers: when a check finds a
 * second answer, one that loses it; when a check runs out of budget, a quarter
 * more, in the widest stretches.
 */
export function buildPuzzle(date: ISODate, level: ZipLevel): { puzzle: ZipPuzzle; path: Cell[] } {
  const { size, numbers } = LEVELS[level];
  const rand = mulberry32(hashString(`zip:${date}:${level}`));
  const path = randomPath(size, rand);
  const marks = spreadMarks(path.length, numbers, rand);
  for (;;) {
    const puzzle = along(date, level, path, marks);
    const { found, complete } = search(puzzle, 2, BUDGET);
    if (complete && found.length < 2) return { puzzle, path };
    const add = nextMarks(path, found, marks);
    // Every square numbered: nothing left to add, and the numbers fix the line.
    if (add.length === 0) return { puzzle, path };
    marks.push(...add);
    marks.sort((a, b) => a - b);
  }
}

/** The puzzle for a date and level: the same everywhere, built from the two alone. */
export function puzzleFor(date: ISODate, level: ZipLevel): ZipPuzzle {
  return buildPuzzle(date, level).puzzle;
}
