import { useMemo } from 'react';
import { doneCount } from '../core/abhyas';
import { gameView } from '../core/game';
import { useApp } from '../store/AppProvider';

/**
 * Everything the game needs, from the store (`gameView`). Shared by the
 * Journey page, Progress and the celebration of a win. Lost, To go and the
 * climb are the chapter's, at the weight Progress shows; points and badges are
 * the whole journey's, the streak badges and the points counting the streak
 * and the Abhyas items done over the whole journey.
 */
export function useGame() {
  const { state, targets, today, streakDays, bestStreakDays, lifetimeStreakDays, lifetimeBestStreakDays } = useApp();
  // Counted again only when the list, its ticks or its finished minutes change, never for a bottle of water.
  const abhyasDone = useMemo(() => doneCount({ items: state.abhyasItems, ticks: state.abhyasTicks, sessions: state.abhyasSessions }, today), [state.abhyasItems, state.abhyasTicks, state.abhyasSessions, today]);
  return useMemo(
    () =>
      gameView({
        state: {
          profile: state.profile,
          weights: state.weights,
          meals: state.meals,
          water: state.water,
          sleep: state.sleep,
          steps: state.steps,
          workouts: state.workouts,
          celebrated: state.celebrated,
          settings: { waterGoalMl: state.settings.waterGoalMl, weighDay: state.settings.weighDay, offDays: state.settings.offDays },
        },
        targets,
        today,
        streakDays,
        bestStreakDays,
        lifetime: { streakDays: lifetimeStreakDays, bestStreakDays: lifetimeBestStreakDays },
        abhyasDone,
      }),
    [state.profile, state.weights, state.meals, state.water, state.sleep, state.steps, state.workouts, state.settings.waterGoalMl, state.settings.weighDay, state.settings.offDays, state.celebrated, streakDays, bestStreakDays, lifetimeStreakDays, lifetimeBestStreakDays, targets, today, abhyasDone],
  );
}
