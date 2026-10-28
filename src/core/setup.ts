import { latinDigits } from '../i18n';
import { daysBetween } from './date';
import { dailyTargets, healthyWeightRange, isAdultBirthYear } from './nutrition';
import { planFrom } from './plan';
import type { Activity, ISODate, Profile, Sex } from './types';

/**
 * What setup checks before it moves on. Every box starts empty and nothing
 * is chosen for the person, so an empty or unreadable answer is a problem,
 * never a zero or a guess: male or female chosen, a year of an adult in four
 * digits, a height of 120 to 230 cm, a weight of 30 to 300 kg, and a goal no
 * lower than the healthy minimum for that height. Digits typed on a Marathi
 * or Hindi keyboard read as the same numbers. Pure.
 */
export type SetupField = 'sex' | 'year' | 'height' | 'weight' | 'goal';
export type SetupInput = { sex: Sex | null; birthYear: string; height: string; weight: string; goal: string };

/** The step each answer is asked on, counting the language as step 0: 1 about you, 2 weight and goal. */
export const STEP_OF: Record<SetupField, 1 | 2> = { sex: 1, year: 1, height: 1, weight: 2, goal: 2 };

/** How active a day is, as setup and Settings offer it, the least first. */
export const ACTIVITIES: readonly Activity[] = ['sedentary', 'light', 'moderate', 'active'];

/** The paces a week, in kg, that setup, Settings and the weight sheet offer. */
export const PACES: readonly number[] = [0.25, 0.5, 0.75, 1];

/** A number typed in a box, a decimal comma read as a point; NaN for anything else, an empty box included. */
export function setupNumber(text: string): number {
  const s = latinDigits(text).trim().replace(',', '.');
  // "72." is a number still being typed: it reads as 72.
  return /^\d+(\.\d*)?$/.test(s) ? Number(s) : NaN;
}

export function setupProblems(input: SetupInput, now: Date = new Date()): SetupField[] {
  const out: SetupField[] = [];
  const height = setupNumber(input.height);
  const weight = setupNumber(input.weight);
  const goal = setupNumber(input.goal);
  if (input.sex !== 'male' && input.sex !== 'female') out.push('sex');
  if (!isAdultBirthYear(latinDigits(input.birthYear), now)) out.push('year');
  const heightOk = height >= 120 && height <= 230;
  if (!heightOk) out.push('height');
  // NaN fails every comparison, so an empty box is a problem too.
  if (!(weight >= 30 && weight <= 300)) out.push('weight');
  const min = heightOk ? healthyWeightRange(height).min : 30;
  if (!(goal >= min && goal <= 300)) out.push('goal');
  return out;
}

/**
 * The problems that keep a step from moving on: those asked on that step or
 * an earlier one. An answer changed after going back is caught on the way
 * forward again, and the last step is held by any problem at all, so a button
 * that does not work always has its reason on screen.
 */
export function setupBlocks(problems: SetupField[], step: number): SetupField[] {
  return problems.filter((p) => STEP_OF[p] <= step);
}

export type SetupTarget = {
  kcal: number;
  proteinG: number;
  /** The target was raised to the safe minimum, so the goal comes more slowly than the pace chosen. */
  floored: boolean;
  /** For now the plan keeps the weight where it is (at or under the goal, or underweight). */
  hold: boolean;
  /** The pace the target gives, the goal and the day it comes; null when there is nothing to lose. */
  reach: { rateKg: number; goalKg: number; date: ISODate } | null;
};

/** Slower than this a week, the goal gets no date: it would be years off. */
export const SLOWEST_DATED_PACE_KG = 0.1;
/** Further off than this, the goal gets no date: two years is too far to plan by. */
export const FARTHEST_DATED_GOAL_DAYS = 730;

/**
 * The last step's words: the day's calories and protein, and when the goal
 * would come. The date is worked out at the pace the target really gives,
 * which is slower than the one chosen when the safe minimum raised it. A pace
 * under 0.1 kg a week, or a date more than two years away, gets no date: the
 * floor note says why the pace is slow.
 */
export function setupTarget(profile: Profile, today: ISODate, now?: Date): SetupTarget {
  const targets = dailyTargets(profile, now);
  const plan = planFrom(profile, [{ date: today, kg: profile.weightKg }], targets, today);
  const hold = targets.hold !== null;
  const dated =
    !hold && !!plan.etaAtTarget && plan.toGoKg > 0 && targets.rateKgPerWeek >= SLOWEST_DATED_PACE_KG && daysBetween(today, plan.etaAtTarget) <= FARTHEST_DATED_GOAL_DAYS;
  const reach = dated && plan.etaAtTarget ? { rateKg: targets.rateKgPerWeek, goalKg: plan.goalKg, date: plan.etaAtTarget } : null;
  return { kcal: targets.kcal, proteinG: targets.proteinG, floored: targets.floored, hold, reach };
}
