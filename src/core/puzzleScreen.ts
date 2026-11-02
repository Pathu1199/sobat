import { fill, numberText } from '../i18n';
import type { PuzzleToday } from './puzzleDay';
import type { ISODate } from './types';
import { puzzleFor, solved, step, type Cell, type ZipLevel, type ZipPuzzle } from './zip';

/**
 * What the puzzle's screen, the Routine tab's card and Today's line work out before they draw: where a finger is on the board, the
 * words, the line being played with its clock, and the puzzles already built. Pure; the components only wrap them.
 */
type T = (key: string) => string;

/** The widest the board is drawn, in points, on a screen with room to spare. */
const BOARD_MAX = 380;

/** The side of the board: the screen less a gutter each side, at most 380 points. */
export function boardSide(width: number, gutter: number, max = BOARD_MAX): number {
  return Math.max(0, Math.min(width - 2 * gutter, max));
}

/**
 * The square of a `size` board, `boardPx` points wide, that a point on it (from its top left corner) is in; null outside the board.
 * With an `inset` (a fraction of a square, from each edge) only the middle of a square answers, so a finger cutting a corner
 * between two squares touches neither.
 */
export function cellAt(x: number, y: number, boardPx: number, size: number, inset = 0): Cell | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(boardPx > 0) || !(size > 0)) return null;
  if (x < 0 || y < 0 || x >= boardPx || y >= boardPx) return null;
  const side = boardPx / size;
  const col = Math.floor(x / side);
  const row = Math.floor(y / side);
  if (inset > 0) {
    const fx = x / side - col;
    const fy = y / side - row;
    if (fx < inset || fx > 1 - inset || fy < inset || fy > 1 - inset) return null;
  }
  return row * size + col;
}

/** The time as m:ss ("1:23"); whole seconds, the minutes written as the app writes any number, and nothing below 0:00. */
export function timeText(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  return `${numberText(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`;
}

/** About how many minutes a level takes: a minute at the gentle levels, growing with the grid. */
const MINUTES: Record<ZipLevel, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4 };

/** "about a minute", "about 2 minutes": a guess, never a promise. */
export function aboutText(level: ZipLevel, t: T): string {
  const n = MINUTES[level];
  return n === 1 ? t('zip_about_one') : fill(t('zip_about_n'), { n });
}

/** The puzzle screen's quiet line over the board: "Level 3 · grows with your Routine streak". */
export function levelLine(level: ZipLevel, t: T): string {
  return fill(t('zip_level_grows'), { n: level });
}

/** What the card on the Routine tab says (and the puzzle's own screen, when it is closed): its tone, its title and line, and whether it offers Play. */
export type CardWords = { tone: 'closed' | 'open' | 'solved'; title: string; line: string; play: boolean };

/** The card for each state of today's puzzle: closed (why, with how far the Routine is), open (the level and about how long) and solved (the time). Kind: it opens, nothing is locked or owed. */
export function cardWords(today: PuzzleToday, t: T): CardWords {
  if (today.kind === 'closed') {
    const line = today.by === 'routine' ? fill(t('zip_closed_routine'), { n: today.done, m: today.total }) : t('zip_closed_meals');
    return { tone: 'closed', title: t('zip_title'), line, play: false };
  }
  if (today.kind === 'open') {
    return { tone: 'open', title: t('zip_open_title'), line: fill(t('zip_level_about'), { n: today.level, about: aboutText(today.level, t) }), play: true };
  }
  return { tone: 'solved', title: fill(t('zip_solved_in'), { time: timeText(today.seconds) }), line: t('zip_new_tomorrow'), play: false };
}

/** Where a square stands against the line: free, on it, or at its end (where the finger is). */
export type CellState = 'free' | 'on' | 'end';

export function cellState(path: Cell[], cell: Cell): CellState {
  const at = path.indexOf(cell);
  if (at < 0) return 'free';
  return at === path.length - 1 ? 'end' : 'on';
}

/** What a screen reader says for a square: "Row 2, column 3, number 4, on the line" (row and column from 1; no number says none). */
export function cellLabel(o: { cell: Cell; size: number; number: number; state: CellState }, t: T): string {
  const parts = [fill(t('zip_cell'), { r: Math.floor(o.cell / o.size) + 1, c: (o.cell % o.size) + 1 })];
  if (o.number > 0) parts.push(fill(t('zip_cell_number'), { n: o.number }));
  if (o.state === 'on') parts.push(t('zip_cell_on'));
  if (o.state === 'end') parts.push(t('zip_cell_end'));
  return parts.join(', ');
}

/** The middle of each square of the line, in order, on a `size` board `boardPx` points wide: the points the drawn line runs through. */
export function linePoints(path: Cell[], size: number, boardPx: number): { x: number; y: number }[] {
  const side = boardPx / size;
  return path.map((c) => ({ x: (c % size) * side + side / 2, y: Math.floor(c / size) * side + side / 2 }));
}

/** How many built puzzles are kept: today's, and a few the user went back to. */
export const PUZZLE_CACHE = 6;
/** Built puzzles by "date:level", oldest first (a Map keeps the order it was set in). */
const BUILT = new Map<string, ZipPuzzle>();
const keyOf = (date: ISODate, level: ZipLevel) => `${date}:${level}`;

/** The puzzle already built for a date and level, or undefined. Looking does not build it. */
export function puzzleCached(date: ISODate, level: ZipLevel): ZipPuzzle | undefined {
  return BUILT.get(keyOf(date, level));
}

/**
 * The puzzle for a date and level, built on the first ask and kept (`PUZZLE_CACHE` of them; the one used longest ago goes first),
 * so coming back to the screen is instant. A build takes about 10 ms on a laptop and a good deal more on a phone, so the screen asks
 * after its first paint, never while it draws.
 */
export function puzzleBuilt(date: ISODate, level: ZipLevel): ZipPuzzle {
  const key = keyOf(date, level);
  const have = BUILT.get(key);
  const puzzle = have ?? puzzleFor(date, level);
  // Set again so it is the newest, whether it was just built or only used again.
  BUILT.delete(key);
  BUILT.set(key, puzzle);
  for (const old of BUILT.keys()) {
    if (BUILT.size <= PUZZLE_CACHE) break;
    BUILT.delete(old);
  }
  return puzzle;
}

/**
 * The game being played: the line so far, when the first square was reached (ms, the clock's start; null before) and when the line won
 * (null until it does). Times are the caller's `Date.now()`, passed in, so every step here is pure.
 */
export type Play = { path: Cell[]; startedAt: number | null; solvedAt: number | null };
export const NEW_PLAY: Play = { path: [], startedAt: null, solvedAt: null };

export type PlayAction = { type: 'reach'; puzzle: ZipPuzzle; cell: Cell; now: number } | { type: 'undo' } | { type: 'again' };

/**
 * The game after an action. `reach`: the finger reached a square, and the line is what `step` makes of it; the first square starts the
 * clock, and a line that covers the puzzle stops it. `undo`: one square back (back to no line stops the clock). `again`: no line, no
 * clock. A move that changes nothing, and anything once the line has won, gives back the same play.
 */
export function playStep(play: Play, a: PlayAction): Play {
  if (play.solvedAt !== null) return play;
  if (a.type === 'reach') {
    const path = step(a.puzzle, play.path, a.cell);
    if (path === play.path) return play;
    return { path, startedAt: play.startedAt ?? a.now, solvedAt: solved(a.puzzle, path) ? a.now : null };
  }
  if (a.type === 'undo') {
    if (play.path.length === 0) return play;
    const path = play.path.slice(0, -1);
    return { path, startedAt: path.length > 0 ? play.startedAt : null, solvedAt: null };
  }
  return play.path.length === 0 && play.startedAt === null ? play : NEW_PLAY;
}

/** The seconds a won game took, to the nearest whole one (the store takes whole seconds), or null while it is not won. */
export function playSeconds(play: Play): number | null {
  if (play.solvedAt === null || play.startedAt === null) return null;
  return Math.max(0, Math.round((play.solvedAt - play.startedAt) / 1000));
}
