import { isDone, itemsOn, minutesOn, type AbhyasData } from './abhyas';
import { skippedOn } from './menu';
import { slotStates } from './pattern';
import type { Routine } from './routine';
import { walkMinutesOn, waterMlOn } from './tileText';
import type { ActivityLog, ISODate, Meal, SlotSkip, WaterLog } from './types';
import { fill } from '../i18n';

/**
 * The kind teacher: what the coach says in the evening, on Today after six
 * and in the day's review. It starts with what went well, then gives one
 * small tip for tomorrow. A day with nothing done yet is "not yet", never
 * missed or failed, with one easier thing for tomorrow; the first evening
 * after such a day opens with "Welcome back". When today did the most of the
 * week so far (meals logged, routine jobs done and the water goal), it says
 * so. Pure.
 */
export type DayScore = {
  /** Meals logged of the pattern's meals due so far (a skipped one is neither). */
  meals: { done: number; of: number };
  /** Routine jobs done of the jobs on the day, and the name of the first one not done yet. */
  jobs: { done: number; of: number; next: string | null };
  water: { ml: number; goal: number };
  walk: { min: number; goal: number };
};

/** A day as the teacher reads it, at `nowMinutes` of that day (1440 for a day gone by). `now` is for a running timer's minutes. */
export function dayScore(input: {
  date: ISODate;
  routine: Routine;
  meals: Meal[];
  skips: SlotSkip[];
  nowMinutes: number;
  abhyas: AbhyasData;
  now: Date;
  water: WaterLog[];
  activities: ActivityLog[];
  waterGoalMl: number;
  walkGoalMin: number;
}): DayScore {
  const meals = input.meals.filter((m) => m.date === input.date);
  const due = slotStates({ routine: input.routine, target: 0, meals, nowMinutes: input.nowMinutes, skippedSlots: skippedOn(input.skips, input.date) }).filter((s) => s.status !== 'later' && s.status !== 'skipped');
  const { items, ticks, sessions, running } = input.abhyas;
  const on = itemsOn(items, input.date);
  const left = on.filter((i) => !isDone(i, input.date, ticks, minutesOn(sessions, running, i.id, input.date, input.now)));
  return {
    meals: { done: due.filter((s) => s.status === 'done').length, of: due.length },
    jobs: { done: on.length - left.length, of: on.length, next: left[0]?.name ?? null },
    water: { ml: waterMlOn(input.water, input.date), goal: input.waterGoalMl },
    walk: { min: walkMinutesOn(input.activities, input.date), goal: input.walkGoalMin },
  };
}

const waterMet = (d: DayScore) => d.water.goal > 0 && d.water.ml >= d.water.goal;

/** What a day did, to compare days: meals logged, jobs done, and one for the water goal met. */
export function scoreOf(d: DayScore): number {
  return d.meals.done + d.jobs.done + (waterMet(d) ? 1 : 0);
}

/** A day with nothing done at all: no meal logged, no job done, no water and no walk. */
export function nothingDone(d: DayScore): boolean {
  return d.meals.done === 0 && d.jobs.done === 0 && d.water.ml === 0 && d.walk.min === 0;
}

/**
 * The evening words: `lead`, what went well ("Well done today: 3 of 3 jobs
 * done, water goal met."), with "Welcome back." before it on the first
 * evening after a day with nothing done; `best`, the best day of the week so
 * far, or null; and `tip`, one small thing for tomorrow. `yesterday` is null
 * for an off day or a day before the user started; `earlier` is this week's
 * days before today that count (Monday on, off days left out).
 */
export function teacherWords(input: { today: DayScore; yesterday: DayScore | null; earlier: DayScore[] }, t: (key: string) => string): { lead: string; best: string | null; tip: string } {
  const d = input.today;
  if (nothingDone(d)) return { lead: t('teach_not_yet'), best: null, tip: t('teach_tip_easy') };
  const parts = [
    d.jobs.done > 0 ? fill(t('teach_jobs'), { n: d.jobs.done, m: d.jobs.of }) : null,
    d.meals.done > 0 ? (d.meals.done === d.meals.of ? t('teach_meals_all') : d.meals.done === 1 ? t('teach_meal_one') : fill(t('teach_meals'), { n: d.meals.done })) : null,
    waterMet(d) ? t('teach_water') : null,
    d.walk.min > 0 ? fill(t('teach_walk'), { n: Math.round(d.walk.min) }) : null,
  ].filter((p): p is string => p !== null);
  const praise = parts.length > 0 ? fill(t('teach_lead'), { parts: parts.join(', ') }) : t('teach_lead_small');
  const lead = input.yesterday && nothingDone(input.yesterday) ? `${t('teach_welcome')} ${praise}` : praise;
  const score = scoreOf(d);
  const best = input.earlier.length > 0 && score > 0 && input.earlier.every((e) => scoreOf(e) < score) ? fill(t('teach_best'), { n: score, m: d.meals.of + d.jobs.of + (d.water.goal > 0 ? 1 : 0) }) : null;
  const tip =
    d.jobs.next !== null
      ? fill(t('teach_tip_job'), { name: d.jobs.next })
      : d.meals.done < d.meals.of
        ? t('teach_tip_meals')
        : d.water.goal > 0 && !waterMet(d)
          ? t('teach_tip_water')
          : d.walk.goal > 0 && d.walk.min < d.walk.goal
            ? t('teach_tip_walk')
            : t('teach_tip_same');
  return { lead, best, tip };
}
