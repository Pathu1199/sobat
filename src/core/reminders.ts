import type { BreakSettings } from './breaks';
import { addDays, isIsoDate, weekDates } from './date';
import { menuSlots, skippedOn, type DayMenu } from './menu';
import { inQuietHours } from './nudge';
import { pattern, slotOf } from './pattern';
import { completeIntake, fullDays } from './progress';
import type { DayRecord, DayRecordState } from './record';
import { slotLabel, type Routine } from './routine';
import { shownWeight, signedKg } from './tileText';
import type { ISODate, Lang, Meal, SlotSkip, WeightLog } from './types';
import { isOffDay } from './week';
import { fill, numberText } from '../i18n';

/**
 * Everything the app will say on its own over the next week, worked out in
 * advance so the phone can hand it to the OS and be closed. Each kind has its
 * own switch in Settings. The meal-time prompt (on by default) comes at each
 * slot's time, today and the next two days, titled with the slot and what is
 * planned and carrying "Ate as planned"; never for a slot done, skipped or
 * planned empty, on an off day, or on the day the person finished setup.
 * Fill in yesterday, plan next week and the weekly report are off by
 * default, and so are the lines after days away, which stop after the fourth
 * day: an app that keeps nagging gets uninstalled. Today's reminders stay in
 * the list through their own minute, so a reconcile in that minute never
 * cancels one as it goes out.
 */
export type ReminderKind = 'slot' | 'fill' | 'planweek' | 'report' | 'away';
export type Reminder = {
  id: string;
  date: ISODate;
  time: string;
  title: string;
  body: string;
  /** What a tap opens and what its button acts on: `kind`, `date`, and `slotId` for a slot. Strings only, as a notification carries them. */
  data: Record<string, string>;
  /** The notification's buttons: 'meal' carries "Ate as planned". */
  category?: 'meal';
};

export type ReminderInput = {
  today: ISODate;
  nowMinutes: number;
  /** How many days ahead, today included. */
  days?: number;
  routine: Routine;
  /** `settings.reminders.mealPrompt`: the slot prompts follow it. */
  mealPrompt: boolean;
  /** `settings.reminders.away`: the lines after days without a log. */
  awayLines: boolean;
  /** The day the person finished setup: no slot prompt on it, and no "fill in" for it or the days before. Missing on older profiles. */
  onboardedOn?: ISODate;
  /** Slots done or skipped today; a meal the app filled in counts as eaten. */
  doneSlotIds: string[];
  /** Slots skipped ahead, on any day: none of them is prompted. */
  skips?: SlotSkip[];
  /** Calories planned for each slot, by `${date}:${slotId}`. A slot planned empty (0) gets no prompt; one not in here gets the plain question. */
  plannedKcal: Record<string, number>;
  /** The last day with a meal logged, today included; null when nothing was ever logged. */
  lastLogDate: ISODate | null;
  offDays: number[];
  quietStartHour: number;
  quietEndHour: number;
  lang: Lang;
  t: (key: string) => string;
  /** `settings.reminders.fillYesterday`. */
  fillYesterday: boolean;
  /** The record of yesterday and today by date. Only a day partly filled in or empty gets a "fill in"; one not in here gets none. */
  records: Record<ISODate, DayRecordState>;
  /** `settings.reminders.planWeek`. */
  planWeek: boolean;
  /** Mondays of the weeks already looked over and saved on the plan screen. */
  reviewedWeeks: ISODate[];
  /** The weekly report for the Monday it goes out; null while it is off or there is nothing to say. */
  report: { monday: ISODate; text: string } | null;
};

/** Days of slot prompts, today included: a week away is not fifty prompts, and the phone's cap on pending notifications stays far off. */
export const SLOT_DAYS = 3;
/** Mornings with a "fill in yesterday": today's and tomorrow's. */
const FILL_DAYS = 2;
/** The morning lines (fill in yesterday, the report, days away) go out at nine, or when quiet hours end. */
export const MORNING_HOUR = 9;
const PLAN_WEEK_MINUTES = 18 * 60;
const AWAY_FIRST = 2;
const AWAY_LAST = 4;

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
  const slots = input.mealPrompt ? pattern(input.routine) : [];
  const skips = input.skips ?? [];
  const morning = Math.max(MORNING_HOUR, input.quietEndHour) * 60;
  // A moment today that has passed would fire at once; one in this very minute stays, so it is not cancelled as it goes out.
  const ahead = (k: number, minutes: number) => k > 0 || minutes >= input.nowMinutes;

  for (let k = 0; k < days; k++) {
    const date = addDays(input.today, k);
    const off = isOffDay(input.offDays, date);

    const skipped = skippedOn(skips, date);
    for (const p of k < SLOT_DAYS && !off && date !== input.onboardedOn ? slots : []) {
      if (quiet(p.minutes) || !ahead(k, p.minutes)) continue;
      if ((k === 0 && input.doneSlotIds.includes(p.id)) || skipped.includes(p.id)) continue;
      const kcal = input.plannedKcal[`${date}:${p.id}`];
      // Nothing planned there: nothing to ask about.
      if (kcal === 0) continue;
      const label = slotLabel(p.slot, input.lang);
      const planned = kcal !== undefined;
      out.push({
        id: `slot:${p.id}:${date}`,
        date,
        time: hhmm(p.minutes),
        title: planned ? fill(input.t('prompt_title'), { slot: label, kcal: numberText(kcal) }) : `${label}?`,
        body: input.t(planned ? 'prompt_body' : 'slot_prompt'),
        data: { kind: 'slot', date, slotId: p.id },
        ...(planned ? { category: 'meal' as const } : {}),
      });
    }

    if (input.fillYesterday && k < FILL_DAYS && !quiet(morning) && ahead(k, morning)) {
      const yesterday = addDays(date, -1);
      const state = input.records[yesterday];
      const started = !input.onboardedOn || yesterday > input.onboardedOn;
      if (started && (state === 'partial' || state === 'empty')) {
        out.push({ id: `fill:${date}`, date, time: hhmm(morning), title: input.t('rem_fill_title'), body: input.t('rem_fill_body'), data: { kind: 'fill', date: yesterday } });
      }
    }

    // Sunday evening, off day or not: planning the week is not tracking the day.
    if (input.planWeek && new Date(`${date}T12:00:00`).getDay() === 0 && !quiet(PLAN_WEEK_MINUTES) && ahead(k, PLAN_WEEK_MINUTES)) {
      const monday = addDays(date, 1);
      if (!input.reviewedWeeks.includes(monday)) {
        out.push({ id: `planweek:${date}`, date, time: hhmm(PLAN_WEEK_MINUTES), title: input.t('rem_planweek_title'), body: input.t('rem_planweek_body'), data: { kind: 'planweek', date: monday } });
      }
    }

    if (input.report && input.report.monday === date && !quiet(morning) && ahead(k, morning)) {
      out.push({ id: `report:${date}`, date, time: hhmm(morning), title: input.t('rem_report_title'), body: input.report.text, data: { kind: 'report', date } });
    }

    if (input.awayLines && !off && k > 0 && input.lastLogDate) {
      const gap = missedDays(input.lastLogDate, date, input.offDays);
      if (gap >= AWAY_FIRST && gap <= AWAY_LAST && !quiet(morning)) {
        out.push({ id: `away:${date}`, date, time: hhmm(morning), title: input.t(`away_${gap}_title`), body: input.t(`away_${gap}_body`), data: { kind: 'away', date } });
      }
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

export type WeekReport = {
  /** Full days of the days that could be full, as Progress counts them. */
  full: { n: number; of: number };
  /** The average on the complete days, as Progress takes it; null without one. */
  avgKcal: number | null;
  goal: number;
  /** The smoothed weight's change, as Progress shows it; null while there is none to show. */
  weight: { kg: number; weeks: number } | null;
};

/**
 * The week before `monday`, by the rules Progress uses, so the report and the
 * page it opens never disagree: its full days of the days that could be full
 * (free days and days before the start left out), the average on its complete
 * days (every planned meal logged or skipped), and the weight's change as
 * Progress shows it (smoothed, over three weeks or more, none once the latest
 * weigh-in is a month old). Null for a week with no meal and no weigh-in.
 */
export function weekReport(input: {
  monday: ISODate;
  today: ISODate;
  /** Where the record starts (`stripSince`). */
  since: ISODate;
  recordOn: (date: ISODate) => DayRecord;
  meals: Pick<Meal, 'date' | 'kcal'>[];
  weights: WeightLog[];
  goal: number;
}): WeekReport | null {
  const dates = weekDates(addDays(input.monday, -7));
  const inWeek = (date: ISODate) => date >= dates[0] && date <= dates[6];
  if (!input.meals.some((m) => inWeek(m.date)) && !input.weights.some((w) => inWeek(w.date))) return null;
  const intake = completeIntake({ dates, today: input.today, since: input.since, meals: input.meals, recordOn: input.recordOn });
  return {
    full: fullDays(dates, input.recordOn, input.today, input.since),
    avgKcal: intake?.avg ?? null,
    goal: input.goal,
    weight: shownWeight(input.weights, input.today)?.change ?? null,
  };
}

/** The report in one line, in the person's words; a part with nothing to say is left out. */
export function reportText(r: WeekReport, t: (key: string) => string): string {
  const parts: string[] = [];
  if (r.full.of > 0) parts.push(fill(t('rem_report_full'), { n: r.full.n, m: r.full.of }));
  if (r.avgKcal !== null) parts.push(fill(t('rem_report_avg'), { avg: numberText(r.avgKcal), goal: numberText(r.goal) }));
  if (r.weight) parts.push(fill(t('rem_report_weight'), { kg: signedKg(r.weight.kg), weeks: r.weight.weeks }));
  return parts.join(' · ');
}

/** The Monday the next report goes out: today when it is Monday and the report's minute has not passed, else the coming one. */
export function reportMonday(today: ISODate, nowMinutes: number, atMinutes = MORNING_HOUR * 60): ISODate {
  const wd = new Date(`${today}T12:00:00`).getDay();
  if (wd === 1 && nowMinutes <= atMinutes) return today;
  return addDays(today, (8 - wd) % 7 || 7);
}

/** Where a tap on a notification goes: Today on the day it is about, the plan screen at next week, or Progress for the report. */
export function tapRoute(data: Record<string, unknown>, today: ISODate): string {
  const date = isIsoDate(data.date) ? data.date : null;
  if (data.kind === 'slot' || data.kind === 'fill') return date && date !== today ? `/?date=${date}` : '/';
  if (data.kind === 'planweek') return date ? `/plan?date=${date}` : '/plan';
  if (data.kind === 'report') return '/progress';
  return '/';
}

export type PromptOutcome = { kind: 'log' } | { kind: 'confirm'; mealId: string } | { kind: 'none' };

/**
 * What "Ate as planned" on a meal-time prompt does when it arrives, which may
 * be long after the prompt: log the slot's planned meal while the slot is
 * open, confirm the meal the app filled in meanwhile, or nothing for a slot
 * eaten, skipped or holding no plan.
 */
export function promptOutcome(input: { menu: DayMenu; meals: Meal[]; skips: SlotSkip[]; slotId: string }): PromptOutcome {
  const slots = menuSlots(input.menu);
  const slot = slots.find((s) => s.id === input.slotId);
  if (!slot || slot.meal.lines.length === 0) return { kind: 'none' };
  if (skippedOn(input.skips, input.menu.date).includes(input.slotId)) return { kind: 'none' };
  const there = input.meals.filter((m) => m.date === input.menu.date && slotOf(m, slots)?.id === input.slotId);
  const filled = there.find((m) => m.source === 'auto');
  if (filled) return { kind: 'confirm', mealId: filled.id };
  return there.length > 0 ? { kind: 'none' } : { kind: 'log' };
}

export type TapPlan = {
  /** The page the tap opens (`tapRoute`). */
  route: string;
  /** What "Ate as planned" does to the prompt's slot (`promptOutcome`); null for a tap on the body, any other notification, or a day still to come. */
  ate: { date: ISODate; slotId: string; outcome: PromptOutcome } | null;
};

/**
 * What a tap on a notification does now, worked out on the store as it is
 * when the tap arrives. The body opens the page the notification is about.
 * "Ate as planned" on a meal-time prompt also acts on that date's slot: logs
 * its planned meal while it is open, confirms the one the app filled in, or
 * nothing once it is settled, so a tap that arrives twice never logs twice;
 * and nothing is logged into a day still to come.
 */
export function tapPlan(input: { action: 'open' | 'ate'; data: Record<string, unknown>; today: ISODate; menuOn: (date: ISODate) => DayMenu; meals: Meal[]; skips: SlotSkip[] }): TapPlan {
  const { data } = input;
  const route = tapRoute(data, input.today);
  if (input.action !== 'ate' || data.kind !== 'slot' || !isIsoDate(data.date) || typeof data.slotId !== 'string' || data.date > input.today) return { route, ate: null };
  const outcome = promptOutcome({ menu: input.menuOn(data.date), meals: input.meals, skips: input.skips, slotId: data.slotId });
  return { route, ate: { date: data.date, slotId: data.slotId, outcome } };
}

/** A reminder the OS repeats every day at one clock time, app closed or not. */
export type DailyReminder = { id: string; hour: number; minute: number; title: string; body: string };

export type DailyInput = {
  /** False on a device that is signed out or reset: reminders belong to a person. */
  active: boolean;
  /** `settings.reminders.sleepCheckin`, `water`, `dayReview`: one switch each. */
  sleepCheckin: boolean;
  water: boolean;
  dayReview: boolean;
  quietStartHour: number;
  quietEndHour: number;
  /** The day's line; empty when there is none or the day's line is switched off. */
  mantra: string;
  /** Passed switched off while eye-care breaks are off in Settings. */
  breaks: BreakSettings;
  nowMs: number;
  t: (key: string) => string;
};

/** `dinner` is no longer registered (the pattern is always on and its dinner slot asks); it stays here so a device that still holds it has it cancelled. */
export const DAILY_IDS = { sleep: 'sobat-sleep-checkin', mantra: 'sobat-mantra', water: 'sobat-water', dinner: 'sobat-dinner', review: 'sobat-day-review' } as const;
/** Every long-break reminder's id starts with this; older builds used it alone, for one repeating notification. */
export const LONG_BREAK_ID = 'sobat-long-break';

/** The daily reminders this device should hold. Anything registered and not in here is to be cancelled. */
export function dailyReminders(input: DailyInput): DailyReminder[] {
  if (!input.active) return [];
  const { t } = input;
  const out: DailyReminder[] = [];
  // Morning check-in, while last night is still fresh.
  if (input.sleepCheckin) out.push({ id: DAILY_IDS.sleep, hour: 7, minute: 30, title: t('sleep_checkin'), body: t('bed_time') });
  // The day's line, at eight. Re-registered daily so it is that day's line.
  if (input.mantra) out.push({ id: DAILY_IDS.mantra, hour: 8, minute: 0, title: t('mantra_title'), body: input.mantra });
  // A single mid-afternoon water prompt; the in-app engine handles the rest.
  if (input.water) out.push({ id: DAILY_IDS.water, hour: 15, minute: 0, title: t('add_water'), body: t('act_drink_water') });
  // The day recap, just before things wind down.
  if (input.dayReview) out.push({ id: DAILY_IDS.review, hour: 21, minute: 30, title: t('day_review'), body: t('write_review') });
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
