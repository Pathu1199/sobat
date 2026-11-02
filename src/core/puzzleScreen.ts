import { fill, numberText } from '../i18n';
import type { PuzzleToday } from './puzzleDay';
import type { ISODate } from './types';
import { buildPuzzle, rowCol, solved, step, type Cell, type ZipLevel, type ZipPuzzle } from './zip';

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
 * The side of a `size` board in the `width` points it has: whole squares, each a point or more, so no square is a fraction and the
 * board is as wide as it is tall. The board and the place held for it before it is built both come from this one rule.
 */
export function boardPx(width: number, size: number): number {
  return size * Math.max(1, Math.floor((Number.isFinite(width) ? width : 0) / size));
}

/** How long after a touch on the board a square's own press is still the touch's, in ms (a press arrives just after the finger lifts). */
export const PRESS_QUIET_MS = 300;
/** How long a touch may be "active" with nothing heard from it before it is taken as lost, in ms: a missed end of touch must not block the keyboard and the screen reader for ever. */
export const TOUCH_STALE_MS = 3000;

/**
 * Whether a square's own press (`onPress`) is the user's: a screen reader's activation or a key, and not the press that comes with a
 * finger lifting off a stroke, which would cut the line back to the square the stroke began on. `lastTouchMs` is when the board's pan
 * last heard from a touch (it began, moved or ended) and `active` whether one is down. Only a clock, no timer: a press counts when
 * no touch is active (or one has been silent for `TOUCH_STALE_MS`) and the last one is more than `PRESS_QUIET_MS` ago.
 */
export function pressAllowed(nowMs: number, lastTouchMs: number, active: boolean): boolean {
  if (active && nowMs - lastTouchMs < TOUCH_STALE_MS) return false;
  return nowMs - lastTouchMs > PRESS_QUIET_MS;
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

/** What the card on the Routine tab says (and the puzzle's own screen, when it is closed): its tone, its title and line. */
export type CardWords = { tone: 'closed' | 'open' | 'solved'; title: string; line: string };

/** The card for each state of today's puzzle: closed (why, with how far the Routine is), open (the level and about how long) and solved (the time). Kind: it opens, nothing is locked or owed. */
export function cardWords(today: PuzzleToday, t: T): CardWords {
  if (today.kind === 'closed') {
    const line = today.by === 'routine' ? fill(t('zip_closed_routine'), { n: today.done, m: today.total }) : t('zip_closed_meals');
    return { tone: 'closed', title: t('zip_title'), line };
  }
  if (today.kind === 'open') {
    return { tone: 'open', title: t('zip_open_title'), line: fill(t('zip_level_about'), { n: today.level, about: aboutText(today.level, t) }) };
  }
  return { tone: 'solved', title: fill(t('zip_solved_in'), { time: timeText(today.seconds) }), line: t('zip_new_tomorrow') };
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
  const { row, col } = rowCol(o.cell, o.size);
  const parts = [fill(t('zip_cell'), { r: row + 1, c: col + 1 })];
  if (o.number > 0) parts.push(fill(t('zip_cell_number'), { n: o.number }));
  if (o.state === 'on') parts.push(t('zip_cell_on'));
  if (o.state === 'end') parts.push(t('zip_cell_end'));
  return parts.join(', ');
}

/** The middle of each square of the line, in order, on a `size` board `boardPx` points wide: the points the drawn line runs through. */
export function linePoints(path: Cell[], size: number, boardPx: number): { x: number; y: number }[] {
  const side = boardPx / size;
  return path.map((c) => {
    const { row, col } = rowCol(c, size);
    return { x: col * side + side / 2, y: row * side + side / 2 };
  });
}

/** How many built puzzles are kept: today's, and a few the user went back to. */
export const PUZZLE_CACHE = 6;
/** A built puzzle with the line it was built from. The puzzle has no other answer, so that line is its answer, and the solved board draws it. */
export type Built = { puzzle: ZipPuzzle; path: Cell[] };
/** Built puzzles by "date:level", oldest first (a Map keeps the order it was set in). */
const BUILT = new Map<string, Built>();
const keyOf = (date: ISODate, level: ZipLevel) => `${date}:${level}`;

/** The puzzle already built for a date and level, with its answer, or undefined. Looking does not build it. */
export function puzzleCached(date: ISODate, level: ZipLevel): Built | undefined {
  return BUILT.get(keyOf(date, level));
}

/**
 * The puzzle for a date and level and its answer, built on the first ask and kept (`PUZZLE_CACHE` of them; the one used longest ago
 * goes first), so coming back to the screen is instant. A build takes about 5 ms on a laptop and up to some 170 ms where the engine
 * does not compile ahead (a phone is slower still), so the screen asks after its first paint, never while it draws.
 */
export function puzzleBuilt(date: ISODate, level: ZipLevel): Built {
  const key = keyOf(date, level);
  const built = BUILT.get(key) ?? buildPuzzle(date, level);
  // Set again so it is the newest, whether it was just built or only used again.
  BUILT.delete(key);
  BUILT.set(key, built);
  for (const old of BUILT.keys()) {
    if (BUILT.size <= PUZZLE_CACHE) break;
    BUILT.delete(old);
  }
  return built;
}

/**
 * The game being played: the line so far, when the first square was reached (ms, the clock's start; null before), when the line won
 * (null until it does) and, right after Start again, the line it cleared with its clock start (`cleared`, so Undo can bring it back
 * once; null the rest of the time, and always while there is a line). Times are the caller's `Date.now()`, passed in, so every step
 * here is pure.
 */
export type Play = { path: Cell[]; startedAt: number | null; solvedAt: number | null; cleared: { path: Cell[]; startedAt: number } | null };
export const NEW_PLAY: Play = { path: [], startedAt: null, solvedAt: null, cleared: null };

export type PlayAction = { type: 'reach'; puzzle: ZipPuzzle; cell: Cell; now: number } | { type: 'undo' } | { type: 'again' };

/**
 * The game after an action. `reach`: the finger reached a square, and the line is what `step` makes of it; the first square starts the
 * clock, and a line that covers the puzzle stops it; any new move forgets the cleared line. `undo`: one square back (back to no line
 * stops the clock), or, on an empty line right after `again`, the line `again` cleared, with its clock (once). `again`: no line, no
 * clock, and the line it cleared kept for that one undo. A move that changes nothing, and anything once the line has won, gives back
 * the same play.
 */
export function playStep(play: Play, a: PlayAction): Play {
  if (play.solvedAt !== null) return play;
  if (a.type === 'reach') {
    const path = step(a.puzzle, play.path, a.cell);
    if (path === play.path) return play;
    return { path, startedAt: play.startedAt ?? a.now, solvedAt: solved(a.puzzle, path) ? a.now : null, cleared: null };
  }
  if (a.type === 'undo') {
    if (play.path.length === 0) return play.cleared ? { path: play.cleared.path, startedAt: play.cleared.startedAt, solvedAt: null, cleared: null } : play;
    const path = play.path.slice(0, -1);
    return { path, startedAt: path.length > 0 ? play.startedAt : null, solvedAt: null, cleared: null };
  }
  if (play.path.length === 0 || play.startedAt === null) return play;
  return { path: [], startedAt: null, solvedAt: null, cleared: { path: play.path, startedAt: play.startedAt } };
}

/** Whether Undo has anything to do: a line to take a step back from, or a line Start again cleared to bring back. Not once the line has won. */
export function canUndo(play: Play): boolean {
  return play.solvedAt === null && (play.path.length > 0 || play.cleared !== null);
}

/** The seconds a won game took, to the nearest whole one (the store takes whole seconds), or null while it is not won. */
export function playSeconds(play: Pick<Play, 'startedAt' | 'solvedAt'>): number | null {
  if (play.solvedAt === null || play.startedAt === null) return null;
  return Math.max(0, Math.round((play.solvedAt - play.startedAt) / 1000));
}

/** The plays kept for the day being played, by "date:level", and the date they are for. */
const KEPT = new Map<string, Play>();
let keptDate: ISODate | null = null;

/**
 * The play kept for a date and level when the user left the screen (or a sync turned the day), to start from when they come back: the
 * line, the clock's start and the cleared line, as they were. Undefined when none was kept. Only the latest day's plays live: reading a
 * newer date than the one kept drops the older plays, and an older date finds nothing and drops nothing.
 */
export function keptPlay(date: ISODate, level: ZipLevel): Play | undefined {
  if (!seeDate(date)) return undefined;
  return KEPT.get(keyOf(date, level));
}

/**
 * Keeps a play for a date and level, replacing the one kept before. A play that has won, or has nothing to keep (no line, no cleared
 * line), is forgotten instead: a won day is stored as solved, and an empty one is the start. A play for a date older than the one kept is ignored.
 */
export function keepPlay(date: ISODate, level: ZipLevel, play: Play): void {
  if (!seeDate(date)) return;
  const key = keyOf(date, level);
  if (play.solvedAt !== null || (play.path.length === 0 && play.cleared === null)) KEPT.delete(key);
  else KEPT.set(key, play);
}

/** Notes the date being read or kept: a newer one than before clears the plays of the day before. False for an older date, which nothing is kept for. */
function seeDate(date: ISODate): boolean {
  if (keptDate !== null && date < keptDate) return false;
  if (date !== keptDate) {
    KEPT.clear();
    keptDate = date;
  }
  return true;
}
