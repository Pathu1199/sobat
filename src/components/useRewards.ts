import { useMemo } from 'react';
import { challengeProgress, dailyChallenge, type ChallengeData } from '../core/challenge';
import { useApp } from '../store/AppProvider';

/** What the challenges read, from the store: a new object only when one of its parts changes. */
export function useChallengeData(): ChallengeData {
  const { state, targets, abhyas } = useApp();
  const { meals, water, activities, settings } = state;
  return useMemo(
    () => ({
      meals,
      water,
      activities: activities ?? [],
      abhyas,
      bottleMl: settings.bottleMl,
      waterGoalMl: settings.waterGoalMl,
      proteinTarget: targets.proteinG,
      offDays: settings.offDays ?? [],
      // An area the user switched off on Today gets no challenge (fdeaf74).
      waterWalk: settings.todayCards.some((c) => c.id === 'waterWalk' && c.on),
      routine: settings.todayCards.some((c) => c.id === 'abhyas' && c.on),
    }),
    [meals, water, activities, abhyas, settings.bottleMl, settings.waterGoalMl, settings.offDays, settings.todayCards, targets.proteinG],
  );
}

/** Today's challenge and how far it has come; null on an off day. */
export function useTodayChallenge() {
  const { today } = useApp();
  const data = useChallengeData();
  return useMemo(() => {
    const challenge = dailyChallenge(data, today);
    return challenge ? { challenge, progress: challengeProgress(data, challenge) } : null;
  }, [data, today]);
}
