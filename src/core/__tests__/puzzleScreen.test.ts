import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import type { PuzzleToday } from '../puzzleDay';
import {
  aboutText,
  boardPx,
  boardSide,
  canUndo,
  cardWords,
  cellAt,
  cellLabel,
  cellState,
  keepPlay,
  keptPlay,
  levelLine,
  linePoints,
  NEW_PLAY,
  PRESS_QUIET_MS,
  PUZZLE_CACHE,
  pressAllowed,
  playSeconds,
  playStep,
  puzzleBuilt,
  puzzleCached,
  timeText,
  TOUCH_STALE_MS,
  type Play,
} from '../puzzleScreen';
import { buildPuzzle, puzzleFor, solved, step, type Cell, type ZipLevel } from '../zip';

const en = makeT('en');
const mr = makeT('mr');
const hi = makeT('hi');

describe('boardSide', () => {
  it('is the screen less a gutter on each side, at most 380', () => {
    expect(boardSide(390, 20)).toBe(350);
    expect(boardSide(360, 20)).toBe(320);
    expect(boardSide(1000, 20)).toBe(380);
    expect(boardSide(460, 20)).toBe(380);
  });

  it('is never negative on a screen narrower than its gutters', () => {
    expect(boardSide(30, 20)).toBe(0);
  });
});

describe('boardPx', () => {
  it('is the whole squares that fit the room, as many points wide as the board is tall', () => {
    expect(boardPx(350, 7)).toBe(350);
    expect(boardPx(350, 6)).toBe(348);
    expect(boardPx(350, 8)).toBe(344);
    expect(boardPx(320, 5)).toBe(320);
  });

  it('gives every square at least a point, and is never a fraction of a square', () => {
    expect(boardPx(0, 5)).toBe(5);
    expect(boardPx(3, 8)).toBe(8);
    expect(boardPx(Number.NaN, 5)).toBe(5);
    expect(boardPx(351.9, 7) % 7).toBe(0);
  });
});

describe('pressAllowed', () => {
  it('lets a square\'s press through when no touch is active and the last one ended more than a moment ago', () => {
    expect(pressAllowed(10_000, 10_000 - PRESS_QUIET_MS - 1, false)).toBe(true);
    expect(pressAllowed(10_000, Number.NEGATIVE_INFINITY, false)).toBe(true);
  });

  it('holds it back while the finger is down and for a moment after it lifts: that press belongs to the stroke', () => {
    expect(pressAllowed(10_000, 9_990, true)).toBe(false);
    expect(pressAllowed(10_000, 10_000, false)).toBe(false);
    expect(pressAllowed(10_000, 10_000 - PRESS_QUIET_MS, false)).toBe(false);
    expect(pressAllowed(10_000, 10_000 - PRESS_QUIET_MS + 1, false)).toBe(false);
  });

  it('is a function of the clock alone: a second stroke soon after the first holds its own press back, whatever any timer did', () => {
    // A stroke ended at 1000; a second began at 1100 (active, last touch 1100) and ends at 1850. Throughout, and 300 ms after, no press.
    for (const now of [1100, 1500, 1849]) expect(pressAllowed(now, 1100, true), `during, at ${now}`).toBe(false);
    for (const now of [1850, 1900, 2150]) expect(pressAllowed(now, 1850, false), `after, at ${now}`).toBe(false);
    expect(pressAllowed(2151, 1850, false)).toBe(true);
  });

  it('does not let a lost end of touch block the keyboard and the screen reader for ever', () => {
    expect(pressAllowed(1000 + TOUCH_STALE_MS - 1, 1000, true)).toBe(false);
    expect(pressAllowed(1000 + TOUCH_STALE_MS + 1, 1000, true)).toBe(true);
  });

  it('is false for a clock that is not a number: no press rather than a cut line', () => {
    expect(pressAllowed(Number.NaN, 0, false)).toBe(false);
    expect(pressAllowed(1000, Number.NaN, false)).toBe(false);
  });
});

describe('cellAt', () => {
  // A 5 x 5 board 250 points wide: each square is 50 points.
  it('maps a point to the square it is in, row by row', () => {
    expect(cellAt(0, 0, 250, 5)).toBe(0);
    expect(cellAt(49.9, 49.9, 250, 5)).toBe(0);
    expect(cellAt(50, 0, 250, 5)).toBe(1);
    expect(cellAt(0, 50, 250, 5)).toBe(5);
    expect(cellAt(125, 125, 250, 5)).toBe(12);
    expect(cellAt(249.9, 249.9, 250, 5)).toBe(24);
  });

  it('is null outside the board, on its far edge and for a point that is not a number', () => {
    expect(cellAt(-0.1, 10, 250, 5)).toBeNull();
    expect(cellAt(10, -0.1, 250, 5)).toBeNull();
    expect(cellAt(250, 10, 250, 5)).toBeNull();
    expect(cellAt(10, 250, 250, 5)).toBeNull();
    expect(cellAt(Number.NaN, 10, 250, 5)).toBeNull();
    expect(cellAt(10, Number.POSITIVE_INFINITY, 250, 5)).toBeNull();
  });

  it('is null on a board with no size', () => {
    expect(cellAt(10, 10, 0, 5)).toBeNull();
    expect(cellAt(10, 10, 250, 0)).toBeNull();
  });

  it('with an inset, answers only for the middle of a square, so a finger cutting a corner touches none', () => {
    // 50-point squares, 20% inset: 10 points of each edge are no square's.
    expect(cellAt(25, 25, 250, 5, 0.2)).toBe(0);
    expect(cellAt(5, 25, 250, 5, 0.2)).toBeNull();
    expect(cellAt(25, 45, 250, 5, 0.2)).toBeNull();
    expect(cellAt(10, 10, 250, 5, 0.2)).toBe(0);
    expect(cellAt(49, 25, 250, 5, 0.2)).toBeNull();
    expect(cellAt(75, 75, 250, 5, 0.2)).toBe(6);
  });
});

describe('timeText', () => {
  it('writes minutes and seconds as m:ss', () => {
    expect(timeText(0)).toBe('0:00');
    expect(timeText(5)).toBe('0:05');
    expect(timeText(59)).toBe('0:59');
    expect(timeText(60)).toBe('1:00');
    expect(timeText(83)).toBe('1:23');
    expect(timeText(600)).toBe('10:00');
    expect(timeText(3599)).toBe('59:59');
  });

  it('rounds to a whole second and never shows less than nothing', () => {
    expect(timeText(59.6)).toBe('1:00');
    expect(timeText(83.4)).toBe('1:23');
    expect(timeText(-5)).toBe('0:00');
    expect(timeText(Number.NaN)).toBe('0:00');
  });

  it('writes minutes past an hour as the app writes any big number', () => {
    expect(timeText(3600 * 20)).toBe('1,200:00');
  });
});

describe('aboutText and levelLine', () => {
  it('says about how long each level takes, a minute at the first and growing with the grid', () => {
    const words = ([1, 2, 3, 4, 5, 6] as ZipLevel[]).map((l) => aboutText(l, en));
    expect(words).toEqual(['about a minute', 'about a minute', 'about 2 minutes', 'about 2 minutes', 'about 3 minutes', 'about 4 minutes']);
  });

  it('says the level and that it grows with the streak', () => {
    expect(levelLine(3, en)).toBe('Level 3 · grows with your Routine streak');
    expect(levelLine(3, mr)).toContain('3');
    expect(levelLine(3, hi)).toContain('3');
  });
});

describe('cardWords', () => {
  const closedRoutine: PuzzleToday = { kind: 'closed', by: 'routine', done: 2, total: 4 };

  it('closed by the Routine: the title, and when it opens with how many jobs are done', () => {
    expect(cardWords(closedRoutine, en)).toEqual({ tone: 'closed', title: "Today's puzzle", line: "Opens when today's Routine is done\u00A0·\u00A02\u00A0of\u00A04" });
  });

  it('closed by the meals on a day with no job: opens when the meals are logged', () => {
    expect(cardWords({ kind: 'closed', by: 'meals' }, en)).toEqual({ tone: 'closed', title: "Today's puzzle", line: "Opens when today's meals are logged" });
  });

  it('open: says so, with the level and about how long', () => {
    expect(cardWords({ kind: 'open', level: 3 }, en)).toEqual({ tone: 'open', title: "Today's puzzle is open", line: 'Level 3 · about 2 minutes' });
    expect(cardWords({ kind: 'open', level: 1 }, en).line).toBe('Level 1 · about a minute');
  });

  it('solved: the time it took and that a new one comes tomorrow', () => {
    expect(cardWords({ kind: 'solved', level: 2, seconds: 83 }, en)).toEqual({ tone: 'solved', title: 'Solved in 1:23', line: 'A new puzzle tomorrow' });
  });

  it('is in Marathi and Hindi too, with the numbers as the app writes them', () => {
    const states: PuzzleToday[] = [closedRoutine, { kind: 'closed', by: 'meals' }, { kind: 'open', level: 4 }, { kind: 'solved', level: 4, seconds: 83 }];
    for (const [lang, t] of [['mr', mr], ['hi', hi]] as const) {
      for (const s of states) {
        const w = cardWords(s, t);
        // Every word came from the language's own list: none is a raw key, and none is left as the English one.
        expect(w.title, lang).not.toMatch(/^zip_/);
        expect(w.line, lang).not.toMatch(/^zip_/);
        expect(w.title, lang).not.toBe(cardWords(s, en).title);
        expect(w.line, lang).not.toBe(cardWords(s, en).line);
        expect(w.title + w.line, lang).not.toMatch(/\{/);
      }
    }
    // The count holds together on one line (no-break spaces), in every language.
    expect(cardWords(closedRoutine, mr).line).toContain('4\u00A0पैकी\u00A02');
    expect(cardWords(closedRoutine, hi).line).toContain('4\u00A0में\u00A0से\u00A02');
    expect(cardWords({ kind: 'solved', level: 1, seconds: 83 }, mr).title).toContain('1:23');
  });
});

describe('cellLabel and cellState', () => {
  it('says the row and column from 1, the number if there is one, and whether the square is on the line', () => {
    expect(cellLabel({ cell: 7, size: 5, number: 4, state: 'on' }, en)).toBe('Row 2, column 3, number 4, on the line');
    expect(cellLabel({ cell: 0, size: 5, number: 0, state: 'free' }, en)).toBe('Row 1, column 1');
    expect(cellLabel({ cell: 24, size: 5, number: 0, state: 'on' }, en)).toBe('Row 5, column 5, on the line');
    expect(cellLabel({ cell: 7, size: 5, number: 4, state: 'end' }, en)).toBe('Row 2, column 3, number 4, end of the line');
    expect(cellLabel({ cell: 7, size: 5, number: 1, state: 'free' }, en)).toBe('Row 2, column 3, number 1');
  });

  it('is in Marathi and Hindi', () => {
    expect(cellLabel({ cell: 7, size: 5, number: 4, state: 'on' }, mr)).toBe('ओळ 2, स्तंभ 3, आकडा 4, रेषेवर');
    expect(cellLabel({ cell: 7, size: 5, number: 4, state: 'on' }, hi)).toBe('पंक्ति 2, स्तंभ 3, अंक 4, रेखा पर');
  });

  it('tells a square of the line from the end of it and from a free one', () => {
    const path: Cell[] = [3, 4, 9];
    expect(cellState(path, 3)).toBe('on');
    expect(cellState(path, 4)).toBe('on');
    expect(cellState(path, 9)).toBe('end');
    expect(cellState(path, 0)).toBe('free');
    expect(cellState([], 0)).toBe('free');
    expect(cellState([5], 5)).toBe('end');
  });
});

describe('linePoints', () => {
  it('is the middle of each square of the line, in order', () => {
    // 5 x 5 on 250 points: squares of 50, so square 0 is centred on (25, 25) and square 6 on (75, 75).
    expect(linePoints([0, 1, 6], 5, 250)).toEqual([
      { x: 25, y: 25 },
      { x: 75, y: 25 },
      { x: 75, y: 75 },
    ]);
  });

  it('is none for an empty line', () => {
    expect(linePoints([], 5, 250)).toEqual([]);
  });
});

describe('the built puzzle cache', () => {
  it('builds a puzzle the first time and hands the same one back after, with the line it was built from', () => {
    expect(puzzleCached('2031-01-01', 2)).toBeUndefined();
    const built = puzzleBuilt('2031-01-01', 2);
    expect(built.puzzle).toEqual(puzzleFor('2031-01-01', 2));
    expect(built.path).toEqual(buildPuzzle('2031-01-01', 2).path);
    expect(puzzleCached('2031-01-01', 2)).toBe(built);
    expect(puzzleBuilt('2031-01-01', 2)).toBe(built);
  });

  it('the line kept with the puzzle is its one answer: it wins, whole', () => {
    const { puzzle, path } = puzzleBuilt('2031-01-02', 3);
    expect(solved(puzzle, path)).toBe(true);
    expect(path).toHaveLength(puzzle.size * puzzle.size);
  });

  it('keeps a puzzle for each date and level apart', () => {
    const a = puzzleBuilt('2031-02-01', 1);
    const b = puzzleBuilt('2031-02-01', 3);
    const c = puzzleBuilt('2031-02-02', 1);
    expect(a.puzzle.level).toBe(1);
    expect(b.puzzle.level).toBe(3);
    expect(c.puzzle.date).toBe('2031-02-02');
    expect(puzzleCached('2031-02-01', 1)).toBe(a);
  });

  it('is small: past its size the oldest goes, and one used again is kept', () => {
    const first = '2031-03-01';
    puzzleBuilt(first, 1);
    const day = (n: number) => `2031-04-${String(n).padStart(2, '0')}`;
    for (let n = 1; n < PUZZLE_CACHE; n++) puzzleBuilt(day(n), 1);
    // The cache is full with `first` the oldest; using it again makes it the newest.
    expect(puzzleCached(first, 1)).toBeDefined();
    puzzleBuilt(first, 1);
    puzzleBuilt(day(PUZZLE_CACHE), 1);
    expect(puzzleCached(first, 1)).toBeDefined();
    expect(puzzleCached(day(1), 1)).toBeUndefined();
    expect(puzzleCached(day(PUZZLE_CACHE), 1)).toBeDefined();
  });
});

describe('the line being played', () => {
  const { puzzle, path } = buildPuzzle('2026-11-02', 1);
  const reach = (play: Play, cell: Cell, now: number) => playStep(play, { type: 'reach', puzzle, cell, now });
  /** Plays the whole answer square by square from `now`, a second apart. */
  const playAll = (now: number): Play => path.reduce<Play>((p, cell, i) => reach(p, cell, now + i * 1000), NEW_PLAY);

  it('starts with no line and no time', () => {
    expect(NEW_PLAY).toEqual({ path: [], startedAt: null, solvedAt: null, cleared: null });
    expect(playSeconds(NEW_PLAY)).toBeNull();
  });

  it('the first square of the line starts the clock, and later ones leave it', () => {
    const one = reach(NEW_PLAY, path[0], 5000);
    expect(one).toEqual({ path: [path[0]], startedAt: 5000, solvedAt: null, cleared: null });
    const two = reach(one, path[1], 9000);
    expect(two.path).toEqual([path[0], path[1]]);
    expect(two.startedAt).toBe(5000);
  });

  it('a move the puzzle does not allow changes nothing, and gives back the very same play', () => {
    expect(reach(NEW_PLAY, path[5], 5000)).toBe(NEW_PLAY);
    const one = reach(NEW_PLAY, path[0], 5000);
    expect(reach(one, path[0], 6000)).toBe(one);
    expect(reach(one, path[3], 6000)).toBe(one);
  });

  it('follows step: the line the puzzle gives is the line played', () => {
    let play = NEW_PLAY;
    let line: Cell[] = [];
    for (const cell of [path[0], path[1], path[2], path[1], path[3], path[0]]) {
      play = reach(play, cell, 1000);
      line = step(puzzle, line, cell);
      expect(play.path).toEqual(line);
    }
  });

  it('wins when the line is the whole answer, at the moment of the last square', () => {
    const won = playAll(10_000);
    expect(won.path).toEqual(path);
    expect(won.solvedAt).toBe(10_000 + (path.length - 1) * 1000);
    expect(playSeconds(won)).toBe(path.length - 1);
  });

  it('is not won a square short, and does not say how long it took', () => {
    const almost = path.slice(0, -1).reduce<Play>((p, cell, i) => reach(p, cell, 1000 + i), NEW_PLAY);
    expect(almost.solvedAt).toBeNull();
    expect(playSeconds(almost)).toBeNull();
  });

  it('seconds are whole, and a win in under a second is 0', () => {
    expect(playSeconds({ startedAt: 1000, solvedAt: 1400 })).toBe(0);
    expect(playSeconds({ startedAt: 1000, solvedAt: 1600 })).toBe(1);
    expect(playSeconds({ startedAt: 1000, solvedAt: 84_000 })).toBe(83);
  });

  it('a won line is left as it is: no move, undo or start again changes it', () => {
    const won = playAll(1000);
    expect(reach(won, path[0], 99_999)).toBe(won);
    expect(playStep(won, { type: 'undo' })).toBe(won);
    expect(playStep(won, { type: 'again' })).toBe(won);
  });

  it('undo takes the line back one square, and back to no line stops the clock', () => {
    let play = reach(reach(NEW_PLAY, path[0], 5000), path[1], 6000);
    play = playStep(play, { type: 'undo' });
    expect(play).toEqual({ path: [path[0]], startedAt: 5000, solvedAt: null, cleared: null });
    play = playStep(play, { type: 'undo' });
    expect(play).toEqual(NEW_PLAY);
  });

  it('undo on an empty line is the same play', () => {
    expect(playStep(NEW_PLAY, { type: 'undo' })).toBe(NEW_PLAY);
  });

  it('start again clears the line and the clock, and keeps the line it cleared', () => {
    const play = reach(reach(NEW_PLAY, path[0], 5000), path[1], 6000);
    const again = playStep(play, { type: 'again' });
    expect(again).toEqual({ path: [], startedAt: null, solvedAt: null, cleared: { path: [path[0], path[1]], startedAt: 5000 } });
    expect(playStep(NEW_PLAY, { type: 'again' })).toBe(NEW_PLAY);
  });

  it('undo on an empty line right after start again brings the line back, with its clock, once', () => {
    const play = reach(reach(reach(NEW_PLAY, path[0], 5000), path[1], 6000), path[2], 7000);
    const again = playStep(play, { type: 'again' });
    const back = playStep(again, { type: 'undo' });
    expect(back).toEqual({ path: [path[0], path[1], path[2]], startedAt: 5000, solvedAt: null, cleared: null });
    // Once: with the line back, undo is one step back as always, and start again can be taken back again.
    expect(playStep(back, { type: 'undo' }).path).toEqual([path[0], path[1]]);
    const twice = playStep(playStep(NEW_PLAY, { type: 'undo' }), { type: 'undo' });
    expect(twice).toBe(NEW_PLAY);
  });

  it('a second start again on the empty line changes nothing, so the line it cleared is still there to bring back', () => {
    const play = reach(reach(NEW_PLAY, path[0], 5000), path[1], 6000);
    const again = playStep(play, { type: 'again' });
    expect(playStep(again, { type: 'again' })).toBe(again);
    expect(playStep(playStep(again, { type: 'again' }), { type: 'undo' }).path).toEqual([path[0], path[1]]);
  });

  it('any new move forgets the cleared line: the next undo goes back along the new line, then to nothing', () => {
    const play = reach(reach(NEW_PLAY, path[0], 5000), path[1], 6000);
    const again = playStep(play, { type: 'again' });
    // A move the puzzle does not allow is no move: the cleared line waits.
    expect(reach(again, path[5], 8000)).toBe(again);
    const fresh = reach(again, path[0], 9000);
    expect(fresh).toEqual({ path: [path[0]], startedAt: 9000, solvedAt: null, cleared: null });
    const undone = playStep(fresh, { type: 'undo' });
    expect(undone).toEqual(NEW_PLAY);
    expect(playStep(undone, { type: 'undo' })).toBe(undone);
  });

  it('canUndo: a line to take a step back from, or a cleared one to bring back; not an empty play nor a won one', () => {
    const one = reach(NEW_PLAY, path[0], 5000);
    expect(canUndo(NEW_PLAY)).toBe(false);
    expect(canUndo(one)).toBe(true);
    expect(canUndo(playStep(one, { type: 'again' }))).toBe(true);
    expect(canUndo(playStep(playStep(one, { type: 'again' }), { type: 'undo' }))).toBe(true);
    expect(canUndo(playAll(1000))).toBe(false);
  });

  it('never changes the line it was given', () => {
    const play = reach(reach(NEW_PLAY, path[0], 5000), path[1], 6000);
    const before = [...play.path];
    reach(play, path[2], 7000);
    playStep(play, { type: 'undo' });
    expect(play.path).toEqual(before);
  });
});

describe('the line kept when leaving', () => {
  const { puzzle, path } = buildPuzzle('2026-11-02', 1);
  const reach = (play: Play, cell: Cell, now: number) => playStep(play, { type: 'reach', puzzle, cell, now });
  const two = reach(reach(NEW_PLAY, path[0], 5000), path[1], 6000);

  it('hands back the play that was kept for a date and level, as it was, and nothing for one that was not', () => {
    expect(keptPlay('2032-01-01', 1)).toBeUndefined();
    keepPlay('2032-01-01', 1, two);
    expect(keptPlay('2032-01-01', 1)).toBe(two);
    expect(keptPlay('2032-01-01', 2)).toBeUndefined();
  });

  it('keeps each level of the day apart, and the latest play of one', () => {
    const one = reach(NEW_PLAY, path[0], 5000);
    keepPlay('2032-01-02', 1, one);
    keepPlay('2032-01-02', 2, two);
    expect(keptPlay('2032-01-02', 1)).toBe(one);
    keepPlay('2032-01-02', 1, two);
    expect(keptPlay('2032-01-02', 1)).toBe(two);
    expect(keptPlay('2032-01-02', 2)).toBe(two);
  });

  it('keeps the cleared line with it, so start again can still be taken back after coming back', () => {
    const again = playStep(two, { type: 'again' });
    keepPlay('2032-01-03', 1, again);
    const back = playStep(keptPlay('2032-01-03', 1) ?? NEW_PLAY, { type: 'undo' });
    expect(back.path).toEqual(two.path);
    expect(back.startedAt).toBe(5000);
  });

  it('forgets the play when it wins, and when there is nothing left to keep', () => {
    const won = path.reduce<Play>((p, cell, i) => reach(p, cell, 1000 + i), NEW_PLAY);
    expect(won.solvedAt).not.toBeNull();
    keepPlay('2032-01-04', 1, two);
    keepPlay('2032-01-04', 1, won);
    expect(keptPlay('2032-01-04', 1)).toBeUndefined();
    keepPlay('2032-01-04', 1, two);
    keepPlay('2032-01-04', 1, NEW_PLAY);
    expect(keptPlay('2032-01-04', 1)).toBeUndefined();
  });

  it('only the latest date lives: reading a new date drops the others, and an older date is never kept over a newer', () => {
    keepPlay('2032-02-01', 1, two);
    keepPlay('2032-02-01', 3, two);
    expect(keptPlay('2032-02-02', 1)).toBeUndefined();
    // The day before is gone, and it stays gone.
    expect(keptPlay('2032-02-01', 1)).toBeUndefined();
    keepPlay('2032-02-02', 1, two);
    keepPlay('2032-02-01', 1, two);
    expect(keptPlay('2032-02-01', 1)).toBeUndefined();
    expect(keptPlay('2032-02-02', 1)).toBe(two);
  });
});
