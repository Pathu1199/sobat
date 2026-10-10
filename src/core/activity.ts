import { ACTIVITIES, activityById, type Activity } from '../data/activities';
import { lastNDates } from './date';
import type { ActivityLog, ISODate } from './types';

/**
 * What movement does to the day. Calories burned follow the MET method:
 * kcal = MET × body weight (kg) × hours, the MET per activity and effort
 * from the Compendium of Physical Activities. 7,700 kcal is about 1 kg of
 * body fat, so a session can also be read in grams. The week is counted
 * the WHO way: moderate minutes plus twice the vigorous minutes against
 * 150.
 */
export type Intensity = 0 | 1 | 2;
export const INTENSITY_KEYS = ['easy', 'normal', 'hard'] as const;

export const KCAL_PER_KG_FAT = 7700;
export const WHO_WEEKLY_MINUTES = 150;
/** Vigorous effort counts double toward the weekly minutes, as the WHO guideline allows. */
const VIGOROUS_MET = 6.0;
/** How much of the burn is eaten back into the day's budget. The rest stays a deficit, which is the point. */
export const EAT_BACK = 0.5;
export const EAT_BACK_CAP = 400;

export function metFor(activity: Activity, intensity: Intensity): number {
  return activity.met[intensity];
}

export function kcalBurned(activity: Activity, intensity: Intensity, minutes: number, weightKg: number): number {
  return Math.round((metFor(activity, intensity) * weightKg * minutes) / 60);
}

export function fatGrams(kcal: number): number {
  return Math.round((kcal / KCAL_PER_KG_FAT) * 1000);
}

export function burnedOn(logs: ActivityLog[], date: ISODate): number {
  return logs.filter((l) => l.date === date).reduce((a, l) => a + l.kcal, 0);
}

export function minutesOn(logs: ActivityLog[], date: ISODate): number {
  return logs.filter((l) => l.date === date).reduce((a, l) => a + l.minutes, 0);
}

/** The part of today's burn that goes back into the food budget. */
export function eatBack(burned: number): number {
  return Math.min(EAT_BACK_CAP, Math.round(burned * EAT_BACK));
}

export type WeekActivity = {
  /** WHO-equivalent minutes: moderate once, vigorous twice. */
  minutes: number;
  rawMinutes: number;
  target: number;
  pct: number;
  kcal: number;
  fatGrams: number;
  activeDays: number;
  /** Per activity id, total minutes this week. */
  byActivity: { id: string; minutes: number; kcal: number }[];
};

export function weekActivity(logs: ActivityLog[], today: ISODate, weekStartDay = 0): WeekActivity {
  const d = new Date(today + 'T12:00:00');
  const back = (d.getDay() - weekStartDay + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - back);
  const from = start.toISOString().slice(0, 10);
  const week = logs.filter((l) => l.date >= from && l.date <= today);
  let minutes = 0;
  let raw = 0;
  let kcal = 0;
  const by = new Map<string, { minutes: number; kcal: number }>();
  for (const l of week) {
    const a = activityById(l.activityId);
    const vigorous = a ? metFor(a, l.intensity) >= VIGOROUS_MET : false;
    minutes += vigorous ? l.minutes * 2 : l.minutes;
    raw += l.minutes;
    kcal += l.kcal;
    const cur = by.get(l.activityId) ?? { minutes: 0, kcal: 0 };
    by.set(l.activityId, { minutes: cur.minutes + l.minutes, kcal: cur.kcal + l.kcal });
  }
  return {
    minutes,
    rawMinutes: raw,
    target: WHO_WEEKLY_MINUTES,
    pct: Math.min(1, minutes / WHO_WEEKLY_MINUTES),
    kcal,
    fatGrams: fatGrams(kcal),
    activeDays: new Set(week.map((l) => l.date)).size,
    byActivity: [...by.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.minutes - a.minutes),
  };
}

/** Days with any activity in the last n days, for streaks and badges. */
export function activeDates(logs: ActivityLog[], today: ISODate, n = 365): Set<ISODate> {
  const window = new Set(lastNDates(n, today));
  return new Set(logs.filter((l) => window.has(l.date)).map((l) => l.date));
}

/** Activities that suit the body: high-impact ones hidden when a knee, back or heart flag is set. */
export function activitiesFor(flags: { lowImpactOnly?: boolean } = {}): Activity[] {
  return flags.lowImpactOnly ? ACTIVITIES.filter((a) => a.impact === 'low') : ACTIVITIES;
}
