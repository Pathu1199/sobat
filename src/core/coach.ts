import type { ISODate, Meal, MealType, SleepLog, WaterLog, WeightLog } from './types';
import { expectedWaterByHour, inQuietHours } from './nudge';
import type { Budget } from './nutrition';
import { pattern, slotAt } from './pattern';
import { weighInDue } from './plan';
import { wasHeavy } from './review';
import { SLOT_GRACE_MIN, slotTime, type Routine } from './routine';

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
  /** The words' key when they are not `key`'s own (one bottle, not several); `key` names the advice, so it is said once a day whatever the count. */
  words?: string;
  kind: AdviceKind;
  urgency: Urgency;
  action: Action;
  params: Record<string, string | number>;
};

export type CoachInput = {
  today: ISODate;
  /** Minutes after midnight, as `useMinute` gives them: the one clock the coach reads, the hour included. */
  nowMinutes: number;
  budget: Budget;
  meals: Meal[];
  water: WaterLog[];
  sleep: SleepLog[];
  weights: WeightLog[];
  steps: number;
  waterGoalMl: number;
  /** The person's bottle: a tap on the water advice adds one, so the advice counts in them. */
  bottleMl: number;
  weighDay: number;
  kcalTarget: number;
  streakDays: number;
  /** The eating pattern: the meals the coach speaks of are its slots, by id. */
  routine: Routine;
  /** Slots eaten (a meal the app filled in from the plan counts as eaten as planned) or skipped today. */
  settledSlotIds: string[];
  /** The plate the day plan laid for the slot that is on now, if any. */
  nextPlate?: { id: string; type: MealType; budget: number; kcal: number; names: string[] } | null;
  /** The calories each slot plans on today's menu, by slot id; a slot with nothing planned is not in it. */
  plannedKcal?: Record<string, number>;
};

const ORDER: Record<Urgency, number> = { now: 0, soon: 1, note: 2 };

export function coachAdvice(input: CoachInput): Advice[] {
  const { budget: b } = input;
  const out: Advice[] = [];
  const todayMeals = input.meals.filter((m) => m.date === input.today);
  const nowMin = input.nowMinutes;
  // The hour comes off the same clock as the meals, so the two never disagree around the hour.
  const hour = Math.floor(nowMin / 60);
  const slots = pattern(input.routine);
  const settled = new Set(input.settledSlotIds);
  const cur = slotAt(input.routine, nowMin);
  const plateOf = (id: string) => (input.nextPlate && input.nextPlate.id === id ? input.nextPlate : null);
  // A slot with a plan on today's menu is spoken of with its planned calories, as the menu shows them, but never more than is
  // left today, as Calories left says; one without, with its share.
  const plannedOf = (id: string): number | null => {
    const kcal = input.plannedKcal?.[id];
    return kcal !== undefined && kcal > 0 ? Math.min(b.remaining, kcal) : null;
  };
  // The day's last dinner slot, past its own time and grace with nothing in it.
  const dinner = [...slots].reverse().find((s) => s.type === 'dinner');
  const lateDinner = dinner && !settled.has(dinner.id) && nowMin > dinner.minutes + SLOT_GRACE_MIN ? dinner : null;
  const lastMeal = [...todayMeals].sort((a, b2) => a.at.localeCompare(b2.at)).slice(-1)[0];
  const lastMealHour = lastMeal ? new Date(lastMeal.at).getHours() : null;

  // Eating: the slot whose turn it is, with its budget, or the reason to stop.
  // A skipped slot is settled like an eaten one: nothing asks for it and nothing remarks on it.
  if (b.remaining < 80 && hour >= 12) {
    out.push({ key: b.remaining <= 0 ? 'coach_over' : 'coach_stop', kind: 'stop', urgency: 'now', action: 'water', params: { kcal: Math.max(0, b.remaining), over: Math.max(0, -b.remaining) } });
  } else if (cur && !settled.has(cur.id) && cur.id !== lateDinner?.id && nowMin >= cur.minutes && b.remaining > 0) {
    // Nothing left today (a morning already over the day): no call to eat, so no calories of none or fewer are ever quoted.
    // A late dinner is called once, as late, below; not as its plate as well. A slot the menu plans is its own plate:
    // its planned calories, and a tap that logs it from the menu.
    const planned = plannedOf(cur.id);
    const plate = planned === null ? plateOf(cur.id) : null;
    out.push({
      key: plate ? 'coach_meal_plate' : 'coach_meal_due',
      kind: 'food',
      // Urgent once the slot's time and its grace have passed with nothing in it.
      urgency: nowMin > cur.minutes + SLOT_GRACE_MIN ? 'now' : 'soon',
      action: plate ? 'plan' : 'log',
      params: { meal: cur.type, slot: cur.id, kcal: planned ?? (plate ? plate.budget : Math.min(b.remaining, Math.max(300, b.perMeal))), names: plate ? plate.names.join(', ') : '' },
    });
  } else if (cur && settled.has(cur.id) && b.remaining > 0) {
    const next = slots.find((s) => s.minutes > cur.minutes && !settled.has(s.id));
    if (next) out.push({ key: 'coach_next_meal', kind: 'food', urgency: 'note', action: 'plan', params: { meal: next.type, slot: next.id, kcal: plannedOf(next.id) ?? Math.min(b.remaining, Math.max(250, b.perMeal)), at: slotTime(next.slot) } });
  }
  if (lateDinner && b.remaining > 0) {
    const plate = plateOf(lateDinner.id);
    out.push({ key: 'coach_late_dinner', kind: 'food', urgency: 'now', action: 'log', params: { slot: lateDinner.id, kcal: plannedOf(lateDinner.id) ?? plate?.budget ?? Math.min(b.remaining, Math.max(300, b.perMeal)) } });
  }
  if (b.consumed > 0 && b.proteinConsumed < b.proteinTarget * 0.4 && hour >= 15) {
    out.push({ key: 'coach_protein', kind: 'food', urgency: 'soon', action: 'plan', params: { g: Math.max(0, Math.round(b.proteinTarget - b.proteinConsumed)) } });
  }
  if (lastMealHour !== null && hour - lastMealHour >= 5 && hour < 22 && b.remaining > 150) {
    out.push({ key: 'coach_long_gap', kind: 'food', urgency: 'soon', action: 'log', params: { h: hour - lastMealHour } });
  }

  // Water: against where the day should be by now, counted in the person's bottles, as a tap on the advice adds one.
  const waterMl = input.water.filter((w) => w.date === input.today).reduce((a, w) => a + w.ml, 0);
  const expected = expectedWaterByHour(hour, input.waterGoalMl);
  if (hour >= 9 && hour < 22 && waterMl < expected - 500) {
    const bottles = Math.ceil((expected - waterMl) / Math.max(1, input.bottleMl));
    out.push({ key: 'coach_water', ...(bottles === 1 ? { words: 'coach_water_one' } : {}), kind: 'water', urgency: waterMl < expected - 1000 ? 'now' : 'soon', action: 'water', params: { bottles } });
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

/** The advice that calls a meal at its time: said out loud only while the meal-time prompt is on, as that switch speaks for it. */
export const MEAL_TIME_ADVICE: readonly string[] = ['coach_meal_due', 'coach_meal_plate', 'coach_late_dinner'];

/**
 * The one piece of advice the coach says out loud now, or null. Only to the
 * person using Sobat here: never on a device that is signed out or reset, or
 * whose store and session are not known yet, never with nudges off or in quiet
 * hours, never a call to eat at a meal's time while the meal-time prompt is
 * off, and never anything already said today (`said`) or with nothing to do.
 */
export function adviceToSay(p: {
  advice: Advice[];
  said: ReadonlySet<string>;
  known: boolean;
  active: boolean;
  nudgesEnabled: boolean;
  /** `settings.reminders.mealPrompt`. */
  mealPrompt: boolean;
  hour: number;
  quietStartHour: number;
  quietEndHour: number;
}): Advice | null {
  if (!p.known || !p.active || !p.nudgesEnabled) return null;
  if (inQuietHours(p.hour, p.quietStartHour, p.quietEndHour)) return null;
  return p.advice.find((a) => a.urgency === 'now' && a.action !== 'none' && !p.said.has(a.key) && (p.mealPrompt || !MEAL_TIME_ADVICE.includes(a.key))) ?? null;
}
