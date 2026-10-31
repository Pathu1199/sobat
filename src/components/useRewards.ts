import { useMemo } from 'react';
import { streakRun } from '../core/abhyas';
import { challengeProgress, challengesDone, dailyChallenge, type ChallengeData } from '../core/challenge';
import { earnedMedals, namesOfJobs, type MedalInput } from '../core/medals';
import { perfectWeeks } from '../core/perfect';
import { useApp } from '../store/AppProvider';
import { useGame } from './useGame';

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

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Everything the medals read, from the store, and the medals earned: both
 * streaks over the whole journey with the shield (the routine's on finished
 * timers, so a medal is earned when a timer stops), the kilos from the very
 * first start to the weight Progress shows, the perfect weeks, and the
 * challenges done. Shared by the trophy shelf and the celebration.
 */
export function useMedals() {
  const app = useApp();
  const { state, today, lifetimeStreakDays, lifetimeBestStreakDays } = app;
  const { abhyasItems: items, abhyasTicks: ticks, abhyasSessions: sessions, profile, celebrated } = state;
  const g = useGame();
  const data = useChallengeData();
  const done = useMemo(() => challengesDone(data, today), [data, today]);
  const routine = useMemo(() => streakRun({ items, ticks, sessions, running: null }, today, new Date(0), true), [items, ticks, sessions, today]);
  const weeks = useMemo(() => perfectWeeks({ items, ticks, sessions }, today).map((w) => ({ ...w, name: items.find((i) => i.id === w.itemId)?.name ?? '' })), [items, ticks, sessions, today]);
  return useMemo(() => {
    const firstStart = profile.firstStartWeightKg ?? g.plan.startKg;
    const input: MedalInput = {
      meals: { now: lifetimeStreakDays, best: lifetimeBestStreakDays },
      routine: items.length > 0 ? { now: routine.days, best: routine.best } : null,
      lostKg: round1(firstStart - g.plan.currentKg),
      totalKg: round1(firstStart - profile.goalWeightKg),
      weeks,
      challengesDone: done,
      celebrated,
      // Names for kept perfect-week medals, removed jobs included (98383c1).
      jobNames: namesOfJobs(items),
    };
    return { input, medals: earnedMedals(input) };
  }, [profile.firstStartWeightKg, profile.goalWeightKg, g.plan.startKg, g.plan.currentKg, lifetimeStreakDays, lifetimeBestStreakDays, items, routine, weeks, done, celebrated]);
}
