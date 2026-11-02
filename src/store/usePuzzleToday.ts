import { streakRun } from '../core/abhyas';
import { abhyasCard } from '../core/abhyasView';
import { puzzleToday, type PuzzleToday } from '../core/puzzleDay';
import { isCompleteMark, markOf, stripSince } from '../core/weekStrip';
import { useNow } from '../services/useClock';
import { useApp } from './AppProvider';
import { useRecordOn } from './useRecordOn';

/**
 * Where Today's puzzle stands now (`puzzleToday`), from the store, each part read the way the screen that shows it reads it: the
 * Routine's jobs as the Routine tab's header counts them (a running timer's minutes included, at `useNow()`), today's complete
 * mark as Progress and Reports judge a day (`useRecordOn`, `markOf`, `stripSince`: never a second way of reading a day), the
 * streak as the Routine tab shows it (with its shield), and today's solved record. Nothing about opening is stored.
 */
export function usePuzzleToday(): PuzzleToday {
  const app = useApp();
  const now = useNow();
  const recordOn = useRecordOn();
  const { today, abhyas } = app;
  const { profile, meals, puzzles } = app.state;
  const { done, total } = abhyasCard(abhyas, today, today, now);
  const since = stripSince(profile, meals, today);
  const mealsComplete = isCompleteMark(markOf(recordOn(today), today, today, since).mark);
  const streak = streakRun(abhyas, today, now, true).days;
  return puzzleToday({ routine: { done, total }, mealsComplete, streak, solved: puzzles.find((p) => p.date === today) });
}
