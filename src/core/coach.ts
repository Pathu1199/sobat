import type { ISODate, Meal, MealType, SleepLog, WaterLog, WeightLog } from './types';
import { expectedWaterByHour } from './nudge';
import { MEAL_WINDOWS } from './nutrition';
import type { Budget } from './nutrition';
import { weighInDue } from './plan';
import { wasHeavy } from './review';

/**
 * The coach that watches the day. Pure rules over the logs and the clock:
 * what to eat next and how much, when to drink, when to stop, when to
 * move, sleep, weigh. Each piece of advice carries a key for the wording,
 * the numbers it needs, an urgency, and the thing to do about it. The app
 * shows the top of the list on Today, all of it on the Coach tab, and
 * speaks the urgent ones as notifications, once each per day.
 */
export type AdviceKind = 'food' | 'stop' | 'water' | 'move' | 'sleep' | 'weigh' | 'win' | 'log';
export type Urgency = 'now' | 'soon' | 'note';
export type Action = 'log' | 'plan' | 'water' | 'walk' | 'sleep' | 'weigh' | 'none';

export type Advice = {
  key: string;
  kind: AdviceKind;
  urgency: Urgency;
  action: Action;
  params: Record<string, string | number>;
};

export type CoachInput = {
  today: ISODate;
  hour: number;
  minute: number;
  budget: Budget;
  meals: Meal[];
  water: WaterLog[];
  sleep: SleepLog[];
  weights: WeightLog[];
  steps: number;
  waterGoalMl: number;
  weighDay: number;
  kcalTarget: number;
  streakDays: number;
  /** The plate the day plan laid for the meal that is on now, if any. */
  nextPlate?: { type: MealType; budget: number; kcal: number; names: string[] } | null;
};

const ORDER: Record<Urgency, number> = { now: 0, soon: 1, note: 2 };

export function coachAdvice(input: CoachInput): Advice[] {
  const { hour, budget: b } = input;
  const out: Advice[] = [];
  const todayMeals = input.meals.filter((m) => m.date === input.today);
  const types = new Set(todayMeals.map((m) => m.type));
  const window = MEAL_WINDOWS.find((w) => hour >= w.startHour && hour < w.endHour);
  const lastMeal = [...todayMeals].sort((a, b2) => a.at.localeCompare(b2.at)).slice(-1)[0];
  const lastMealHour = lastMeal ? new Date(lastMeal.at).getHours() : null;

  // Eating: the meal that is on, with its budget, or the reason to stop.
  if (b.remaining < 80 && hour >= 12) {
    out.push({ key: b.remaining <= 0 ? 'coach_over' : 'coach_stop', kind: 'stop', urgency: 'now', action: 'water', params: { kcal: Math.max(0, b.remaining), over: Math.max(0, -b.remaining) } });
  } else if (window && !types.has(window.type) && hour >= window.startHour + 1) {
    const plate = input.nextPlate && input.nextPlate.type === window.type ? input.nextPlate : null;
    out.push({
      key: plate ? 'coach_meal_plate' : 'coach_meal_due',
      kind: 'food',
      urgency: hour >= window.endHour - 1 ? 'now' : 'soon',
      action: plate ? 'plan' : 'log',
      params: { meal: window.type, kcal: plate ? plate.budget : Math.min(b.remaining, Math.max(300, b.perMeal)), names: plate ? plate.names.join(', ') : '' },
    });
  } else if (window && types.has(window.type) && b.remaining > 0 && window.type !== 'dinner') {
    const next = MEAL_WINDOWS.find((w) => w.startHour >= window.endHour && !types.has(w.type));
    if (next) out.push({ key: 'coach_next_meal', kind: 'food', urgency: 'note', action: 'plan', params: { meal: next.type, kcal: Math.min(b.remaining, Math.max(250, b.perMeal)), at: `${String(next.startHour).padStart(2, '0')}:00` } });
  }
  if (hour >= 21 && !types.has('dinner') && b.remaining > 0) {
    out.push({ key: 'coach_late_dinner', kind: 'food', urgency: 'now', action: 'log', params: { kcal: Math.min(b.remaining, Math.max(300, b.perMeal)) } });
  }
  if (b.consumed > 0 && b.proteinConsumed < b.proteinTarget * 0.4 && hour >= 15) {
    out.push({ key: 'coach_protein', kind: 'food', urgency: 'soon', action: 'plan', params: { g: Math.max(0, Math.round(b.proteinTarget - b.proteinConsumed)) } });
  }
  if (lastMealHour !== null && hour - lastMealHour >= 5 && hour < 22 && b.remaining > 150) {
    out.push({ key: 'coach_long_gap', kind: 'food', urgency: 'soon', action: 'log', params: { h: hour - lastMealHour } });
  }

  // Water: against where the day should be by now.
  const waterMl = input.water.filter((w) => w.date === input.today).reduce((a, w) => a + w.ml, 0);
  const expected = expectedWaterByHour(hour, input.waterGoalMl);
  if (hour >= 9 && hour < 22 && waterMl < expected - 500) {
    out.push({ key: 'coach_water', kind: 'water', urgency: waterMl < expected - 1000 ? 'now' : 'soon', action: 'water', params: { glasses: Math.ceil((expected - waterMl) / 250) } });
  } else if (waterMl >= input.waterGoalMl && hour >= 12) {
    out.push({ key: 'coach_water_done', kind: 'win', urgency: 'note', action: 'none', params: {} });
  }

  // Yesterday was heavy: a lighter, earlier day, said once in the morning.
  const y = new Date(input.today + 'T12:00:00');
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  if (hour < 12 && wasHeavy(input.meals, yesterday, input.kcalTarget)) {
    out.push({ key: 'coach_after_heavy', kind: 'food', urgency: 'soon', action: 'plan', params: {} });
  }

  // Movement: an afternoon with few steps.
  if (hour >= 16 && hour < 21 && input.steps < 3000) {
    out.push({ key: 'coach_walk', kind: 'move', urgency: 'soon', action: 'walk', params: { min: 15 } });
  }

  // Sleep: the morning check-in, and the night's close.
  const sleptLogged = input.sleep.some((s) => s.date === input.today);
  if (hour >= 6 && hour < 11 && !sleptLogged) out.push({ key: 'coach_sleep_checkin', kind: 'sleep', urgency: 'note', action: 'sleep', params: {} });
  if (hour >= 22) out.push({ key: 'coach_bedtime', kind: 'sleep', urgency: 'soon', action: 'none', params: {} });

  // Weigh-in day.
  if (weighInDue(input.weights, input.today, input.weighDay) && hour >= 6 && hour < 12) {
    out.push({ key: 'coach_weigh', kind: 'weigh', urgency: 'soon', action: 'weigh', params: {} });
  }

  // Nothing logged by mid-morning: the day only counts if it is written down.
  if (todayMeals.length === 0 && hour >= 10 && hour < 22) {
    out.push({ key: 'coach_log_first', kind: 'log', urgency: hour >= 13 ? 'now' : 'soon', action: 'log', params: {} });
  }

  // A good streak deserves a word.
  if (input.streakDays >= 3 && hour >= 18 && todayMeals.length > 0) {
    out.push({ key: 'coach_streak', kind: 'win', urgency: 'note', action: 'none', params: { n: input.streakDays } });
  }

  return out.sort((a, c) => ORDER[a.urgency] - ORDER[c.urgency]);
}
