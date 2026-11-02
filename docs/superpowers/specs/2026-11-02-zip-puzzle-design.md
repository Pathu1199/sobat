# Today's puzzle: a Zip path puzzle as the Routine's reward

Date: 2026-11-02. Status: Part C of the roadmap. Varad asked for "a Zip path
puzzle (one line through 1→N filling every square), unlocked by finishing the
day's routine, new every day, harder with the streak, never required", and said
"start 5 then 6".

## Why

Finishing the day's Routine earns a medal only on milestone days. A small
puzzle that opens the moment the last job is done is a reward on every good
day: something to look forward to, over in a minute or two, and never a chore.
It grows harder as the Routine streak grows, so it keeps pace with the user.

## The puzzle

- A square grid. Some squares hold numbers 1, 2, … N.
- Draw one line, square to square (up, down, left, right), that starts on 1,
  passes the numbers in order, ends on N, and goes through every square once.
- Any line that does all that wins, not only the one the puzzle was built
  from. Each puzzle is built to have one answer (see Generator) so it can be
  reasoned out, not guessed.

## Rules that hold everywhere

- **Never required.** Nothing counts against the user for not playing: no
  streak, no medal, no reminder, no "missed" word. A day without a puzzle is a
  day without a puzzle.
- **Opens with the day's Routine.** Today's puzzle is open when every Routine
  job due today is done (`abhyasCard(app.abhyas, today, today, now)`, the count
  the Routine tab's header shows: `total > 0` and `done >= total`, the running
  timer's minutes included). On a day with no
  Routine job due, it opens when today's meals are all logged or skipped (the
  record's complete mark, `isCompleteMark` on today's `markOf`), and on a free
  (off) day with no job due it is simply open: a rest day's small treat. Nothing about
  opening is stored: undo a tick and the unsolved puzzle closes again; a
  solved one stays solved.
- **New every day, the same everywhere.** The puzzle is built from the date
  and the level alone, by a seeded generator, so the phone and the website
  show the same puzzle on the same day.
- **Harder with the streak.** The level comes from the Routine streak with
  its shield (`streakRun(app.abhyas, today, now, true).days`), the same number
  the Routine tab shows. It is read when the puzzle opens and kept for the
  day once solved (the stored level), so solving it does not change it.
- **Kind tone.** "Opens when today's Routine is done · 2 of 4", never
  "locked" or "you haven't". A wrong move simply does not happen (the line
  does not go there); no red, no buzz for errors.

## Levels

| Level | Routine streak | Grid | Numbers |
|---|---|---|---|
| 1 | 0–2 days | 5 × 5 | generous: about 12 |
| 2 | 3–6 | 6 × 6 | generous: about 16 |
| 3 | 7–20 | 6 × 6 | only what one answer needs (about 11) |
| 4 | 21–29 | 7 × 7 | generous: about 20 |
| 5 | 30–65 | 7 × 7 | only what one answer needs (about 15) |
| 6 | 66 and more | 8 × 8 | only what one answer needs (about 21) |

Without walls, one answer needs roughly a third of the squares numbered, so a
grid's hardest form is the fewest numbers that keep one answer. The first
level at each grid size is made gentler by giving more numbers than that (the
target count), spread evenly along the line. The generator never gives fewer
than one answer needs, never fewer than 1 and N.

## Core: `src/core/zip.ts` (pure, tested)

```ts
export type ZipLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type Cell = number;                       // index = row * size + col
export type ZipPuzzle = { date: ISODate; level: ZipLevel; size: number; clues: Record<number, number>; last: number };

levelFor(streak: number): ZipLevel
puzzleFor(date: ISODate, level: ZipLevel): ZipPuzzle   // deterministic
solutions(p: ZipPuzzle, cap: number, budget: number): { count: number; complete: boolean }
step(p: ZipPuzzle, path: Cell[], cell: Cell): Cell[]  // the line after the finger reaches `cell`
solved(p: ZipPuzzle, path: Cell[]): boolean
```

- **Random.** A small seeded generator (mulberry32 or the like) seeded from a
  hash of `"zip:" + date + ":" + level`. No `Math.random` anywhere.
- **Generator.** Start from a serpentine path over the grid and apply a few
  thousand random "backbite" moves (a standard way to draw an even, random
  Hamiltonian path on a grid); flip it end to end at random. Put 1 on its first
  square and N on its last, and the other numbers at evenly spread points
  along it, nudged by the random generator. Then check with `solutions`
  (cap 2): while the puzzle has a second answer, or the check ran out of
  budget, add a number at the first square where a second answer leaves the
  built one (or, when out of budget, at the middle of the longest stretch
  between numbers). Numbers are renumbered in path order after each addition.
- **Solver.** Depth-first from 1, never entering number k before k−1 is
  passed, pruning when the squares left are no longer one connected piece or
  when a square left has fewer than two ways in (one for the last square).
  It stops at `cap` answers or `budget` steps.
- **Speed.** `puzzleFor` takes about 5 ms at the hardest level with a
  compiling JavaScript engine, and up to roughly 170 ms where the engine does
  not compile ahead (measured with the JIT switched off; a phone is slower than
  a laptop). So the screen builds it after its first paint and keeps it in a
  small cache; the tests build each level for 60 dates, check every result is a
  valid puzzle with one answer, and bound the slowest build generously (500 ms)
  so a loaded machine does not flake.
- **The line (`step`).** The finger is on `cell`:
  - on the line's last square: nothing changes;
  - on the square before it: the line steps back one;
  - on another square of the line: the line is cut back to it;
  - next to the line's end, not on the line, and either no number or the next
    number due: the line goes there; the last number N is accepted only as the
    last free square (it ends the line, so until then it waits);
  - an empty line accepts only square 1;
  - a jump along a row or column (a fast finger) is taken square by square
    while each square is allowed; anything else changes nothing.
- **Won** (`solved`): the line covers every square once, each step is to a
  neighbour, it starts on 1, ends on N and meets the numbers in order.

## Stored: one record per solved day

```ts
export type PuzzleLog = { date: ISODate; seconds: number; level: ZipLevel };
AppState.puzzles: PuzzleLog[]
```

- `EMPTY_STATE.puzzles = []`. `STATE_VERSION` stays 8: an older file has no
  `puzzles` and loads with the empty list (`migrateState` spreads
  `EMPTY_STATE` first); a check that it does goes in the migrate tests.
- Sync: a collection keyed by `date` in `COLLECTIONS` (`core/sync.ts`), and
  `CloudState` gains the field. Solved on two devices the same day, the date
  holds one record (the collection's usual rule picks which); nothing is lost
  that matters.
- A store action `solvePuzzle(log)` adds today's record once; a second solve
  of the same date keeps the faster time.
- A record's level is any whole number from 1, not only the levels this build
  has: a record from a newer build with a level this one lacks must survive the
  load, or the next sync would delete it on every device. The screen builds a
  puzzle for a stored level at the nearest level it has (`clampLevel`).

## Screen: `/puzzle` (`src/app/puzzle.tsx`)

- A stack screen under the header "Today's puzzle", in the app's `Screen`.
- Top: "Level 3 · grows with your Routine streak" in muted text, and the time
  (m:ss) from the first move, in the accent colour.
- The board: as wide as the screen allows (at most 380 points), squares with
  thin lines between, numbers in dark circles, the line drawn with
  react-native-svg as one thick rounded stroke in the accent colour over a
  light accent tint on the squares it covers.
- Drawing: a pan gesture (react-native-gesture-handler, works on the web)
  maps the finger to a square and feeds `step`. On a phone the page scrolls
  with Gesture Handler's `ScrollView` and the pan blocks it
  (`blocksExternalGesture` with the scroll view's ref, as the library's
  "Cross-component interactions" docs say), so a vertical stroke draws instead
  of scrolling; on the web the board's `touch-action: none` does that.
  A square's own press (a screen reader's activation, a key) is told from the
  press that comes with a finger lifting by a clock, not a timer: it counts
  only when no touch is active and the last one ended more than 300 ms ago. A tap on a square does the
  same, so it can be played one tap at a time and with a screen reader
  (each square has a label: "Row 2, column 3, number 4, on the line").
- Below: Undo (one step back) and Start again (back to an empty line). Start
  again can be taken back once: it keeps the line it cleared, and Undo on the
  empty line right after it brings that line (and its clock) back; any new
  move forgets it.
- The line is kept when the user leaves (Back, a back swipe, a sync turning the
  day) and is there when they return: the line, the clock's start and the
  cleared line, in a small module-level map keyed by date and level (only
  today's lives). It is forgotten when the line wins.
- Won: a light success haptic, the line turns gold, and a sheet: a gold
  check, "Solved in 1:23", "A new puzzle tomorrow", and Done. The record is
  saved once. Opening the screen again on a solved day shows the solved board,
  the one answer drawn in gold (the puzzle has no other, so it is
  `buildPuzzle(date, level).path`, kept in the cache beside the puzzle), each
  square read "on the line" to a screen reader, and "Solved in 1:23 · a new
  puzzle tomorrow". A day solved at a level this build does not know (see
  Stored) shows the nearest level's board with its numbers only.
- Not open yet (reached by a link while the Routine is unfinished): a short
  kind line and a button back to Routine.
- The board is built after the first paint (a frame, then a turn of the event
  loop, no wait on top) and shows "Preparing…" only if it is still not there
  after about 150 ms; a build already in the cache shows at once.
- The tint under the line is the accent's soft tone by day and its dim tone in
  the dark, where the soft one is heavy; solved, it is the reward colours.
- With reduce motion on, nothing animates.

## Where it shows

- **Routine tab**, under Today's list: one card.
  - Not open: a puzzle icon, "Today's puzzle", "Opens when today's Routine
    is done · 2 of 4" (on a day with no job due: "Opens when today's meals
    are logged").
  - Open: "Today's puzzle is open", "Level 3 · about a minute", and Play.
    Once the card has shown it for a moment the puzzle is built and cached in
    the background, so Play opens the board at once.
  - Solved: "Solved in 1:23" with a gold check, "A new puzzle tomorrow".
- **Today, the Routine card:** when the puzzle is open and not solved, one
  line at the foot: "Today's puzzle is open ›", which opens `/puzzle`.
- Nothing anywhere else: no notification, no medal, no Reports line.

## Words

Every new string in en, mr and hi together, keys prefixed `zip_`. Marathi and
Hindi short and natural: the puzzle is कोडं (mr) and पहेली (hi); "Today's
puzzle" is आजचं कोडं / आज की पहेली. Times use `numberText`.

## Pieces

1. `src/core/zip.ts` with `src/core/__tests__/zip.test.ts`: random, levels,
   generator, solver, `step`, `solved`.
2. The record and the rule: `PuzzleLog` in `core/types.ts`, `puzzles` in
   `EMPTY_STATE`, the sync collection, `solvePuzzle` in the store, and
   `puzzleToday` (pure, in `core/zip.ts` or a small `core/puzzleDay.ts`):
   from the Routine status, today's complete mark, the streak and the stored
   records, it says closed (with why), open (with the level) or solved
   (with the time). A hook `usePuzzleToday()` in `store/` feeds it: it reads
   the jobs with `abhyasCard(…)` as the Routine header does and today's mark as
   Progress and Reports do, and counts the streak only when the puzzle is open
   and needs its level.
3. The screen, the Routine card, the line on Today's Routine card, and the
   words.

## Testing

- Core: the random generator repeats for a seed; `levelFor` at each edge;
  every level for 60 dates builds a puzzle whose numbers sit on a Hamiltonian
  path in order and whose `solutions(…, 2)` is exactly one; `step` for each
  case above; `solved` true for the built path and false for a path that
  misses a square, breaks the order, or jumps.
- `puzzleToday`: closed with 2 of 4; open on all done; open by meals on a day
  with no job; solved shows the stored time; a solved day stays solved after
  a tick is undone.
- Sync: two devices' records for one date end as one record; records for
  different dates both stay.
- Screen: by screenshots in the browser (English and Marathi, light and dark):
  closed, open, a line half drawn, won.
