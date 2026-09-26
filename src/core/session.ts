import type { Exercise } from './types';

/**
 * Turns a list of exercises into a flat list of steps to walk through, with
 * rest inserted where it belongs. Pure, so the runner screen is just a timer
 * pointed at this.
 */

export type SessionStep =
  | { kind: 'exercise'; exercise: Exercise; setIndex: number; totalSets: number; seconds?: number; reps?: number }
  | { kind: 'rest'; seconds: number; nextExercise: Exercise };

export function buildSteps(exercises: Exercise[]): SessionStep[] {
  const steps: SessionStep[] = [];

  exercises.forEach((ex, exIndex) => {
    const sets = Math.max(1, ex.default_sets);
    for (let set = 0; set < sets; set++) {
      steps.push({
        kind: 'exercise',
        exercise: ex,
        setIndex: set,
        totalSets: sets,
        seconds: ex.mode === 'time' ? ex.default_seconds : undefined,
        reps: ex.mode === 'reps' ? ex.default_reps : undefined,
      });

      const isLastSetOfLastExercise = set === sets - 1 && exIndex === exercises.length - 1;
      if (isLastSetOfLastExercise) continue;

      // Rest belongs to whatever comes next, so the screen can name it.
      const next = set === sets - 1 ? exercises[exIndex + 1] : ex;
      if (ex.rest_seconds > 0) steps.push({ kind: 'rest', seconds: ex.rest_seconds, nextExercise: next });
    }
  });

  return steps;
}

/** Rough length of the whole session, counting reps at three seconds each. */
export function totalSeconds(steps: SessionStep[]): number {
  return steps.reduce((sum, s) => {
    if (s.kind === 'rest') return sum + s.seconds;
    if (s.seconds) return sum + s.seconds;
    return sum + (s.reps ?? 10) * 3;
  }, 0);
}

export function stepSeconds(step: SessionStep): number {
  if (step.kind === 'rest') return step.seconds;
  if (step.seconds) return step.seconds;
  return (step.reps ?? 10) * 3;
}

/** How far through the session we are, for the progress bar. */
export function progressAt(steps: SessionStep[], index: number): number {
  const total = totalSeconds(steps);
  if (total === 0) return 0;
  const done = steps.slice(0, index).reduce((sum, s) => sum + stepSeconds(s), 0);
  return Math.min(1, done / total);
}

/** Only the exercises actually reached, for the workout log. */
export function completedExerciseIds(steps: SessionStep[], index: number): string[] {
  const ids = new Set<string>();
  for (const s of steps.slice(0, index)) if (s.kind === 'exercise') ids.add(s.exercise.id);
  return [...ids];
}
