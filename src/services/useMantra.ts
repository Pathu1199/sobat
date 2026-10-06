import { useMemo } from 'react';
import { addDays } from '../core/date';
import { pickMantra } from '../core/mantra';
import { sumTotals } from '../core/nutrition';
import { planFrom } from '../core/plan';
import { isWorkDay } from '../core/schedule';
import { MANTRAS, type Mantra } from '../data/mantras';
import { useApp } from '../store/AppProvider';

/** Today's line, chosen from yesterday's slips, the stage of the journey and the kind of day. */
export function useMantra(): Mantra | null {
  const { state, targets, today, hour } = useApp();
  const lang = state.profile.lang;
  return useMemo(() => {
    const plan = planFrom(state.profile, state.weights, targets, today);
    const yesterday = addDays(today, -1);
    const waterY = state.water.filter((w) => w.date === yesterday).reduce((a, w) => a + w.ml, 0);
    const mealsY = state.meals.filter((m) => m.date === yesterday);
    const proteinY = sumTotals(mealsY.flatMap((m) => m.items)).protein;
    const lastSleep = [...state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
    return pickMantra(
      MANTRAS[lang] ?? MANTRAS.en,
      {
        stage: plan.stage,
        // Only a logged day can slip; an empty day says nothing.
        waterLow: waterY > 0 && waterY < state.settings.waterGoalMl * 0.6,
        sleepShort: !!lastSleep && lastSleep.date >= yesterday && lastSleep.minutes < 390,
        proteinLow: mealsY.length > 0 && proteinY < targets.proteinG * 0.6,
        workDay: isWorkDay(state.schedule, today),
        evening: hour >= 18,
      },
      today,
    );
  }, [state.profile, state.weights, state.water, state.meals, state.sleep, state.settings.waterGoalMl, state.schedule, targets, today, hour, lang]);
}
