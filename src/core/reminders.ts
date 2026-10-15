import { addDays } from './date';
import { inQuietHours } from './nudge';
import { pattern } from './pattern';
import { SLOT_GRACE_MIN, slotLabel, type Routine } from './routine';
import type { ISODate, Lang, Meal } from './types';
import { isOffDay } from './week';

/**
 * Everything the app will say on its own over the next week, worked out in
 * advance so the phone can hand it to the OS and be closed. Two kinds: a
 * "log or skip?" prompt for each slot of the pattern, and a morning line
 * when days go by without a log. The absence lines escalate gently for
 * three days and then stop; an app that keeps nagging gets uninstalled.
 */
export type Reminder = { id: string; date: ISODate; time: string; title: string; body: string };

export type ReminderInput = {
  today: ISODate;
  nowMinutes: number;
  /** How many days ahead, today included. */
  days?: number;
  routine: Routine;
  /** Slots logged or skipped today. */
  doneSlotIds: string[];
  /** The last day with a meal logged, today included; null when nothing was ever logged. */
  lastLogDate: ISODate | null;
  offDays: number[];
  quietStartHour: number;
  quietEndHour: number;
  lang: Lang;
  t: (key: string) => string;
};

const AWAY_HOUR = 9;
const AWAY_FIRST = 2;
const AWAY_LAST = 4;

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function plannedReminders(input: ReminderInput): Reminder[] {
  const days = input.days ?? 7;
  const out: Reminder[] = [];
  const quiet = (minutes: number) => inQuietHours(Math.floor(minutes / 60), input.quietStartHour, input.quietEndHour);
  const slots = input.routine.enabled ? pattern(input.routine) : [];
  const awayAt = Math.max(AWAY_HOUR, input.quietEndHour) * 60;

  for (let k = 0; k < days; k++) {
    const date = addDays(input.today, k);
    if (isOffDay(input.offDays, date)) continue;

    for (const p of slots) {
      const at = p.minutes + SLOT_GRACE_MIN;
      if (at >= 1440 || quiet(at)) continue;
      if (k === 0 && (input.doneSlotIds.includes(p.id) || at <= input.nowMinutes)) continue;
      out.push({ id: `slot:${p.id}:${date}`, date, time: hhmm(at), title: `${slotLabel(p.slot, input.lang)}?`, body: input.t('slot_prompt') });
    }

    if (k > 0 && input.lastLogDate) {
      const gap = daysBetween(input.lastLogDate, date);
      if (gap >= AWAY_FIRST && gap <= AWAY_LAST && !quiet(awayAt)) {
        out.push({ id: `away:${date}`, date, time: hhmm(awayAt), title: input.t(`away_${gap}_title`), body: input.t(`away_${gap}_body`) });
      }
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

/** The most recent day on or before today with a meal logged; null when there is none. */
export function lastLogDate(meals: Pick<Meal, 'date'>[], today: ISODate): ISODate | null {
  let best: ISODate | null = null;
  for (const m of meals) if (m.date <= today && (best === null || m.date > best)) best = m.date;
  return best;
}

/** Days since the last log: 0 when today has one, and 0 when nothing was ever logged. */
export function daysAway(meals: Pick<Meal, 'date'>[], today: ISODate): number {
  const last = lastLogDate(meals, today);
  return last ? daysBetween(last, today) : 0;
}
