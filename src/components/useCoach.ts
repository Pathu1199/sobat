import { useMemo } from 'react';
import { coachAdvice, type Advice } from '../core/coach';
import { dayPlan } from '../core/dayPlan';
import { foodName } from '../core/foods';
import { avoidedFoodIds, bhajiFor } from '../core/routine';
import { useApp } from '../store/AppProvider';

/** The coach's advice for this minute, from the store. Shared by the strip, the Coach tab and the monitor. */
export function useCoach(minute: number): Advice[] {
  const app = useApp();
  const { state, budget, today, hour, foods, targets } = app;
  const lang = state.profile.lang;
  return useMemo(() => {
    const loggedTypes = Array.from(new Set(state.meals.filter((m) => m.date === today).map((m) => m.type)));
    const plan = dayPlan({
      remaining: budget.remaining,
      hour,
      loggedTypes,
      foods,
      avoided: avoidedFoodIds({ ...state.routine, enabled: true }),
      preferred: state.routine.enabled ? bhajiFor(state.routine, today) : [],
    });
    const slot = plan.slots.find((s) => s.type === plan.now) ?? plan.slots[0];
    return coachAdvice({
      today,
      hour,
      minute,
      budget,
      meals: state.meals,
      water: state.water,
      sleep: state.sleep,
      weights: state.weights,
      steps: app.stepsToday,
      waterGoalMl: state.settings.waterGoalMl,
      weighDay: state.settings.weighDay,
      kcalTarget: targets.kcal,
      streakDays: app.streakDays,
      nextPlate: slot ? { type: slot.type, budget: slot.budget, kcal: slot.kcal, names: slot.picks.map((p) => foodName(p.food, lang)) } : null,
    });
    // The minute is the clock; everything else is read when it ticks or the logs change.
  }, [minute, today, hour, budget, state.meals, state.water, state.sleep, state.weights, state.routine, state.settings.waterGoalMl, state.settings.weighDay, foods, targets.kcal, app.stepsToday, app.streakDays, lang]);
}
