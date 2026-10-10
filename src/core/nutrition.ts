import type { Activity, MealType, Profile, Sex } from './types';

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

/** Never go below this, whatever the deficit maths says. */
export const KCAL_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

/** Losing faster than this is not sustainable and costs muscle. */
export const MAX_RATE_KG_PER_WEEK = 1;
const KCAL_PER_KG_FAT = 7700;

export function ageFrom(birthYear: number, now: Date = new Date()): number {
  return Math.max(1, now.getFullYear() - birthYear);
}

/** Mifflin-St Jeor resting energy expenditure, kcal/day. */
export function bmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'birthYear'>, now?: Date): number {
  const age = ageFrom(p.birthYear, now);
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age;
  return Math.round(base + (p.sex === 'male' ? 5 : -161));
}

/** Maintenance calories, kcal/day. */
export function tdee(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'birthYear' | 'activity'>, now?: Date): number {
  return Math.round(bmr(p, now) * ACTIVITY_FACTOR[p.activity]);
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiBand(value: number): 'under' | 'normal' | 'over' | 'obese' {
  if (value < 18.5) return 'under';
  if (value < 25) return 'normal';
  if (value < 30) return 'over';
  return 'obese';
}

export type Targets = {
  bmr: number;
  tdee: number;
  kcal: number;
  proteinG: number;
  deficit: number;
  rateKgPerWeek: number;
  floored: boolean;
  bmi: number;
  band: ReturnType<typeof bmiBand>;
};

/**
 * Daily targets. The deficit is capped at 1 kg/week and the result is clamped
 * to a calorie floor, so an aggressive goal silently becomes a safe one.
 */
export function dailyTargets(p: Profile, now?: Date): Targets {
  const maintenance = tdee(p, now);
  const rate = Math.min(Math.max(p.rateKgPerWeek, 0), MAX_RATE_KG_PER_WEEK);
  const wantedDeficit = Math.round((rate * KCAL_PER_KG_FAT) / 7);
  const floor = KCAL_FLOOR[p.sex];
  const raw = maintenance - wantedDeficit;
  const kcal = Math.max(raw, floor);
  const goal = p.goalWeightKg > 0 ? p.goalWeightKg : p.weightKg;
  // 1.4 g per kg of goal weight keeps muscle while losing fat.
  const proteinG = Math.round(1.4 * Math.min(goal, p.weightKg));
  const value = bmi(p.weightKg, p.heightCm);
  return {
    bmr: bmr(p, now),
    tdee: maintenance,
    kcal,
    proteinG,
    deficit: maintenance - kcal,
    rateKgPerWeek: Math.round(((maintenance - kcal) * 7 / KCAL_PER_KG_FAT) * 100) / 100,
    floored: raw < floor,
    bmi: value,
    band: bmiBand(value),
  };
}

/** Healthy weight range for this height, BMI 18.5 to 24.9. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const m = heightCm / 100;
  return { min: Math.round(18.5 * m * m), max: Math.round(24.9 * m * m) };
}

/** Rough weeks to reach the goal at the achieved rate. */
export function weeksToGoal(p: Profile, t: Targets): number | null {
  if (t.rateKgPerWeek <= 0) return null;
  const toLose = p.weightKg - p.goalWeightKg;
  if (toLose <= 0) return 0;
  return Math.ceil(toLose / t.rateKgPerWeek);
}

export type Totals = { kcal: number; protein: number; carbs: number; fat: number };

export function sumTotals(items: { kcal: number; protein: number; carbs: number; fat: number }[]): Totals {
  return items.reduce<Totals>(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export const MEAL_WINDOWS: { type: MealType; startHour: number; endHour: number; share: number }[] = [
  { type: 'breakfast', startHour: 5, endHour: 11, share: 0.25 },
  { type: 'lunch', startHour: 11, endHour: 16, share: 0.35 },
  { type: 'snack', startHour: 16, endHour: 19, share: 0.1 },
  { type: 'dinner', startHour: 19, endHour: 23, share: 0.3 },
];

export function mealTypeForHour(hour: number): MealType {
  const w = MEAL_WINDOWS.find((x) => hour >= x.startHour && hour < x.endHour);
  return w ? w.type : 'snack';
}

/** Which meals are still ahead of us today. */
export function mealsRemaining(hour: number): MealType[] {
  return MEAL_WINDOWS.filter((w) => hour < w.endHour).map((w) => w.type);
}

/**
 * How much of the day's target a normal eater would have had by this hour.
 * Used to judge a day that is still running, instead of comparing a half-eaten
 * day against a full-day target.
 */
export function expectedKcalByHour(target: number, hour: number): number {
  let share = 0;
  for (const w of MEAL_WINDOWS) {
    if (hour >= w.endHour) share += w.share;
    else if (hour > w.startHour) share += w.share * ((hour - w.startHour) / (w.endHour - w.startHour));
  }
  return Math.round(target * Math.min(1, share));
}

export type Budget = {
  target: number;
  consumed: number;
  remaining: number;
  /** Calories added to the day by activity (the eat-back share of the burn). */
  earned: number;
  perMeal: number;
  mealsLeft: number;
  proteinTarget: number;
  proteinConsumed: number;
  proteinLeft: number;
  pct: number;
};

export function budget(targets: Targets, consumed: Totals, hour: number, earned = 0): Budget {
  const left = mealsRemaining(hour);
  // Movement earns room, but only part of it: the rest of the burn stays a deficit.
  const remaining = targets.kcal + earned - consumed.kcal;
  return {
    target: targets.kcal,
    consumed: Math.round(consumed.kcal),
    remaining: Math.round(remaining),
    earned: Math.round(earned),
    mealsLeft: left.length,
    perMeal: left.length > 0 ? Math.round(Math.max(remaining, 0) / left.length) : 0,
    proteinTarget: targets.proteinG,
    proteinConsumed: Math.round(consumed.protein),
    proteinLeft: Math.round(Math.max(targets.proteinG - consumed.protein, 0)),
    pct: targets.kcal > 0 ? Math.round((consumed.kcal / targets.kcal) * 100) : 0,
  };
}

export function kcalForGrams(food: { kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number }, grams: number) {
  const f = grams / 100;
  return {
    kcal: Math.round(food.kcal_100g * f),
    protein: Math.round(food.protein_100g * f * 10) / 10,
    carbs: Math.round(food.carbs_100g * f * 10) / 10,
    fat: Math.round(food.fat_100g * f * 10) / 10,
  };
}
