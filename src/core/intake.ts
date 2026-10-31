import { fill, numberText, t } from '../i18n';
import { lastNDates } from './date';
import type { DayRecord } from './record';
import type { ISODate, Lang, Meal } from './types';
import { isOffDay } from './week';

/**
 * Too little, for days: the thing behind most cravings. A day counts when
 * it is over, not a day off, and either has at least two meals logged or
 * its record is complete (`recordOn`, the day's record: every planned meal
 * eaten or skipped), so a day half written down does not drag the average
 * but one meal and the rest skipped, or every meal skipped, does: eating
 * too little by skipping is still eating too little. The last three
 * counted days are averaged against the higher of the floor and 85 percent
 * of the target. Code decides; the model may only word it.
 */
export type Intake = { avg: number; limit: number; days: number } | null;

const COUNTED_DAYS = 3;
const MIN_MEALS = 2;

export function lowIntake(input: {
  meals: Meal[];
  today: ISODate;
  target: number;
  floor: number;
  offDays: number[];
  recordOn: (date: ISODate) => Pick<DayRecord, 'state'>;
  lookback?: number;
}): Intake {
  const dates = lastNDates(input.lookback ?? 14, input.today).filter((d) => d < input.today && !isOffDay(input.offDays, d)).reverse();
  const counted: number[] = [];
  for (const d of dates) {
    const meals = input.meals.filter((m) => m.date === d);
    if (meals.length < MIN_MEALS && input.recordOn(d).state !== 'full') continue;
    counted.push(meals.reduce((a, m) => a + m.kcal, 0));
    if (counted.length === COUNTED_DAYS) break;
  }
  if (counted.length < COUNTED_DAYS) return null;
  const avg = Math.round(counted.reduce((a, k) => a + k, 0) / counted.length);
  const limit = Math.max(input.floor, Math.round(input.target * 0.85));
  return avg < limit ? { avg, limit, days: counted.length } : null;
}

/** The verdict as one sentence of context for the coach and the tip. */
export function intakeFact(intake: Intake): string | null {
  if (!intake) return null;
  return `Their last ${intake.days} logged days averaged ${intake.avg} kcal, under the ${intake.limit} kcal line; cravings are expected. Encourage eating the plan in full, never less.`;
}

/** The note on Today, in the user's language: "Last 3 days averaged 1,395 kcal, below the line. Eat today's plan in full." Null when there is nothing to say. */
export function intakeNote(intake: Intake, lang: Lang): string | null {
  if (!intake) return null;
  return fill(t(lang, 'intake_note'), { days: intake.days, avg: numberText(intake.avg) });
}
