import type { Budget } from './nutrition';

export type Situation =
  | 'over_budget'
  | 'way_over'
  | 'protein_low'
  | 'under_eating'
  | 'late_eating'
  | 'on_track'
  | 'day_start';

export type DecisionInput = {
  budget: Budget;
  hour: number;
  waterMl: number;
  waterGoalMl: number;
  movedToday: boolean;
  lateMealDays: number;
};

export type Decision = {
  situation: Situation;
  severity: 'good' | 'watch' | 'act';
  /** Facts the card must show, so the advice is auditable. */
  facts: { label: string; value: string }[];
  actionKeys: string[];
  /** Minimum kcal the next meal should still have. Never zero: no skipping. */
  nextMealMin: number;
  nextMealMax: number;
};

const MIN_MEAL_KCAL = 300;

/**
 * Pure rules. No AI. The model only turns this into friendly wording later,
 * so a wrong or offline model can never change the actual advice.
 */
export function decide(input: DecisionInput): Decision {
  const { budget: b, hour } = input;
  const facts: { label: string; value: string }[] = [
    { label: 'target', value: `${b.target} kcal` },
    { label: 'eaten', value: `${b.consumed} kcal` },
    { label: 'left', value: `${b.remaining} kcal` },
    { label: 'protein', value: `${b.proteinConsumed}/${b.proteinTarget} g` },
  ];

  const nextMealMax = b.mealsLeft > 0 ? Math.max(b.perMeal, MIN_MEAL_KCAL) : 0;

  if (b.consumed === 0) {
    return {
      situation: 'day_start',
      severity: 'good',
      facts,
      actionKeys: ['log_first_meal', 'drink_water'],
      nextMealMin: MIN_MEAL_KCAL,
      nextMealMax: Math.max(Math.round(b.target * 0.3), MIN_MEAL_KCAL),
    };
  }

  if (b.consumed > b.target * 1.2) {
    return {
      situation: 'way_over',
      severity: 'act',
      facts,
      actionKeys: ['walk_20', 'water_2_glass', 'light_dinner', 'no_fasting_tomorrow', 'sleep_early'],
      nextMealMin: MIN_MEAL_KCAL,
      nextMealMax: MIN_MEAL_KCAL + 100,
    };
  }

  if (b.remaining < 0 || (hour < 20 && b.consumed > b.target * 0.9 && b.mealsLeft > 0)) {
    return {
      situation: 'over_budget',
      severity: 'act',
      facts,
      actionKeys: ['light_dinner', 'walk_20', 'water_2_glass', 'protein_first'],
      nextMealMin: MIN_MEAL_KCAL,
      nextMealMax: Math.max(MIN_MEAL_KCAL, Math.round(b.remaining)),
    };
  }

  if (hour >= 22 && input.lateMealDays >= 3) {
    return {
      situation: 'late_eating',
      severity: 'watch',
      facts,
      actionKeys: ['earlier_dinner', 'sleep_early', 'no_screen_bed'],
      nextMealMin: 0,
      nextMealMax: 0,
    };
  }

  if (hour >= 20 && b.remaining > b.target * 0.3) {
    return {
      situation: 'under_eating',
      severity: 'watch',
      facts,
      actionKeys: ['eat_something_light', 'protein_first'],
      nextMealMin: MIN_MEAL_KCAL,
      nextMealMax: Math.round(b.remaining),
    };
  }

  if (hour >= 18 && b.proteinConsumed < b.proteinTarget * 0.6) {
    return {
      situation: 'protein_low',
      severity: 'watch',
      facts,
      actionKeys: ['add_dal', 'add_curd', 'add_egg_or_paneer'],
      nextMealMin: MIN_MEAL_KCAL,
      nextMealMax: nextMealMax,
    };
  }

  const actions = ['keep_going'];
  if (input.waterMl < input.waterGoalMl * 0.5 && hour >= 14) actions.push('drink_water');
  if (!input.movedToday && hour >= 17) actions.push('walk_20');

  return { situation: 'on_track', severity: 'good', facts, actionKeys: actions, nextMealMin: MIN_MEAL_KCAL, nextMealMax: nextMealMax };
}
