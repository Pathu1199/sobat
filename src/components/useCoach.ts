import { useMemo } from 'react';
import { coachAdvice, type Advice } from '../core/coach';
import { dayPlan } from '../core/dayPlan';
import { foodName } from '../core/foods';
import { pattern, slotStates } from '../core/pattern';
import { avoidedFoodIds, bhajiFor } from '../core/routine';
import { isOffDay } from '../core/week';
import { useApp } from '../store/AppProvider';

/** The coach's advice for this minute, from the store. Shared by the strip, the Coach tab and the monitor. */
export function useCoach(minute: number): Advice[] {
  const app = useApp();
  const { state, budget, today, hour, foods, targets, actionsDoneToday } = app;
  const lang = state.profile.lang;
  return useMemo(() => {
    if (isOffDay(state.settings.offDays, today)) return [];
    const todayMeals = state.meals.filter((m) => m.date === today);
    const loggedTypes = Array.from(new Set(todayMeals.map((m) => m.type)));
    // With the pattern on, the plates are its slots still to eat, the way the fits card shows them.
    const patternOn = state.routine.enabled;
    const loggedSlotIds = patternOn
      ? slotStates({ routine: state.routine, target: targets.kcal, meals: todayMeals, nowMinutes: minute, skipped: actionsDoneToday })
          .filter((s) => s.status === 'done' || s.status === 'skipped')
          .map((s) => s.slot.id)
      : [];
    const plan = dayPlan({
      remaining: budget.remaining,
      hour,
      loggedTypes,
      foods,
      avoided: avoidedFoodIds({ ...state.routine, enabled: true }),
      preferred: patternOn ? bhajiFor(state.routine, today) : [],
      slots: patternOn ? pattern(state.routine) : undefined,
      loggedSlotIds,
      nowMinutes: minute,
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
  }, [minute, today, hour, budget, state.meals, state.water, state.sleep, state.weights, state.routine, state.settings.waterGoalMl, state.settings.weighDay, state.settings.offDays, foods, targets.kcal, actionsDoneToday, app.stepsToday, app.streakDays, lang]);
}
