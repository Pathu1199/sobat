import type { BreakSettings } from './breaks';
import { addDays } from './date';
import { inQuietHours } from './nudge';
import { pattern } from './pattern';
import { SLOT_GRACE_MIN, slotLabel, type Routine } from './routine';
import type { ISODate, Lang, Meal } from './types';
import { isOffDay } from './week';

/**
 * Everything the app will say on its own over the next week, worked out in
 * advance so the phone can hand it to the OS and be closed. Two kinds: a
 * "log or skip?" prompt for each slot of the pattern, for today and the
 * next two days only (a week away is not fifty prompts), and a morning
 * line when days go by without a log. The absence lines escalate gently
 * for three days and then stop; an app that keeps nagging gets uninstalled.
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

/** Days of slot prompts, today included; the absence lines cover the whole window. */
const SLOT_DAYS = 3;
const AWAY_HOUR = 9;
const AWAY_FIRST = 2;
const AWAY_LAST = 4;

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

/** Days since the last log that count: off days are neither logged nor missed. */
export function missedDays(lastLogDate: ISODate, date: ISODate, offDays: number[]): number {
  let n = 0;
  for (let d = addDays(lastLogDate, 1); d <= date; d = addDays(d, 1)) if (!isOffDay(offDays, d)) n++;
  return n;
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

    for (const p of k < SLOT_DAYS ? slots : []) {
      const at = p.minutes + SLOT_GRACE_MIN;
      if (at >= 1440 || quiet(at)) continue;
      if (k === 0 && (input.doneSlotIds.includes(p.id) || at <= input.nowMinutes)) continue;
      out.push({ id: `slot:${p.id}:${date}`, date, time: hhmm(at), title: `${slotLabel(p.slot, input.lang)}?`, body: input.t('slot_prompt') });
    }

    if (k > 0 && input.lastLogDate) {
      const gap = missedDays(input.lastLogDate, date, input.offDays);
      if (gap >= AWAY_FIRST && gap <= AWAY_LAST && !quiet(awayAt)) {
        out.push({ id: `away:${date}`, date, time: hhmm(awayAt), title: input.t(`away_${gap}_title`), body: input.t(`away_${gap}_body`) });
      }
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

/** A reminder the OS repeats every day at one clock time, app closed or not. */
export type DailyReminder = { id: string; hour: number; minute: number; title: string; body: string };

export type DailyInput = {
  /** False on a device that is signed out or reset: reminders belong to a person. */
  active: boolean;
  nudgesEnabled: boolean;
  /** The pattern prompts its own dinner slot. */
  routineEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
  /** The day's line; empty when there is none. */
  mantra: string;
  breaks: BreakSettings;
  nowMs: number;
  t: (key: string) => string;
};

export const DAILY_IDS = { sleep: 'sobat-sleep-checkin', mantra: 'sobat-mantra', water: 'sobat-water', dinner: 'sobat-dinner', review: 'sobat-day-review' } as const;
/** Every long-break reminder's id starts with this; older builds used it alone, for one repeating notification. */
export const LONG_BREAK_ID = 'sobat-long-break';

/** The daily reminders this device should hold. Anything registered and not in here is to be cancelled. */
export function dailyReminders(input: DailyInput): DailyReminder[] {
  if (!input.active || !input.nudgesEnabled) return [];
  const { t } = input;
  const out: DailyReminder[] = [];
  // Morning check-in, while last night is still fresh.
  out.push({ id: DAILY_IDS.sleep, hour: 7, minute: 30, title: t('sleep_checkin'), body: t('bed_time') });
  // The day's line, at eight. Re-registered daily so it is that day's line.
  if (input.mantra) out.push({ id: DAILY_IDS.mantra, hour: 8, minute: 0, title: t('mantra_title'), body: input.mantra });
  // A single mid-afternoon water prompt; the in-app engine handles the rest.
  out.push({ id: DAILY_IDS.water, hour: 15, minute: 0, title: t('add_water'), body: t('act_drink_water') });
  // Dinner, earlier than the quiet hours start. With the pattern on, the dinner slot's own prompt does this.
  if (!input.routineEnabled) out.push({ id: DAILY_IDS.dinner, hour: Math.max(18, input.quietStartHour - 3), minute: 30, title: t('dinner'), body: t('act_light_dinner') });
  // The day recap, just before things wind down.
  out.push({ id: DAILY_IDS.review, hour: 21, minute: 30, title: t('day_review'), body: t('write_review') });
  return [...out, ...longBreaks(input)];
}

/**
 * The phone cannot blank its own screen, so a long break is a notification.
 * A repeating one cannot keep to quiet hours, so instead there is one daily
 * reminder per interval across the waking day, counted from the end of the
 * night, and none in the break's quiet hours or the app's. A work schedule
 * picks days, which a daily reminder cannot: none then.
 */
function longBreaks(input: DailyInput): DailyReminder[] {
  const br = input.breaks;
  const paused = br.pausedUntilMs !== null && input.nowMs < br.pausedUntilMs;
  if (!br.enabled || !br.long.enabled || paused || br.schedule !== null) return [];
  const every = Math.max(15, br.long.everyMinutes);
  const from = br.quietStartHour === br.quietEndHour ? 0 : br.quietEndHour * 60;
  const out: DailyReminder[] = [];
  for (let m = from + every; m < from + 1440; m += every) {
    const at = m % 1440;
    const hour = Math.floor(at / 60);
    if (inQuietHours(hour, br.quietStartHour, br.quietEndHour) || inQuietHours(hour, input.quietStartHour, input.quietEndHour)) continue;
    out.push({ id: `${LONG_BREAK_ID}@${hhmm(at)}`, hour, minute: at % 60, title: input.t('brk_long'), body: input.t('brk_long_hint') });
  }
  return out;
}

/** The most recent day on or before today with a meal logged; null when there is none. */
export function lastLogDate(meals: Pick<Meal, 'date'>[], today: ISODate): ISODate | null {
  let best: ISODate | null = null;
  for (const m of meals) if (m.date <= today && (best === null || m.date > best)) best = m.date;
  return best;
}

/** Days since the last log, off days left out: 0 when today has one, and 0 when nothing was ever logged. */
export function daysAway(meals: Pick<Meal, 'date'>[], today: ISODate, offDays: number[] = []): number {
  const last = lastLogDate(meals, today);
  return last ? missedDays(last, today, offDays) : 0;
}
