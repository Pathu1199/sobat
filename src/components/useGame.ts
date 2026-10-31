import { useMemo } from 'react';
import { gameView } from '../core/game';
import { useApp } from '../store/AppProvider';

/**
 * The climb, from the store (`gameView`): Lost, To go, the mountain, its
 * camps and its trail, the chapter's, at the weight Progress shows. Shared by
 * the Journey page, Progress and the medals.
 */
export function useGame() {
  const { state, targets, today } = useApp();
  return useMemo(() => gameView({ state: { profile: state.profile, weights: state.weights }, targets, today }), [state.profile, state.weights, targets, today]);
}
