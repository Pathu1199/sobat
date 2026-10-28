import type { BreakSettings } from './breaks';
import { addDays, isIsoDate, toISODate, weekDates } from './date';
import { menuSlots, skippedOn, type DayMenu } from './menu';
import { inQuietHours } from './nudge';
import { pattern, slotOf } from './pattern';
import { completeIntake, fullDays } from './progress';
import type { DayRecord, DayRecordState } from './record';
import { slotLabel, type Routine } from './routine';
import { orderedBlocks, toMinutes, type WorkSchedule } from './schedule';
import { shownWeight, signedKg } from './tileText';
import type { AppState, FoodItem, ISODate, Lang, Meal, Settings, SlotSkip, WeightLog } from './types';
import { isOffDay } from './week';
import { plannedKcal as linesKcal } from './weekPlan';
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

/**
 * Settings → Reminders: one switch for each reminder the app sends on its
 * own, in the order they come in a day and a week, the meal-time prompt
 * first. Each row's words are `rem_<name>` and `rem_<name>_desc`.
 */
export const REMINDER_ROWS: { key: keyof Settings['reminders']; name: string }[] = [
  { key: 'mealPrompt', name: 'meal_prompt' },
  { key: 'fillYesterday', name: 'fill' },
  { key: 'planWeek', name: 'planweek' },
  { key: 'weeklyReport', name: 'report' },
  { key: 'sleepCheckin', name: 'sleep' },
  { key: 'water', name: 'water' },
  { key: 'dayReview', name: 'review' },
  { key: 'away', name: 'away' },
];
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
  /**
   * Calories planned for each slot, by `${date}:${slotId}`; null for a slot
   * planned empty (no lines), which gets no prompt. A slot is planned by its
   * lines, as the record reads it, so lines that add up to no calories (black
   * tea) are still asked about. One not in here gets the plain question.
   */
  plannedKcal: Record<string, number | null>;
  /** The last day with a meal logged, today included; null when nothing was ever logged. */
  lastLogDate: ISODate | null;
  offDays: number[];
  quietStartHour: number;
  quietEndHour: number;
  lang: Lang;
  t: (key: string) => string;
  /**
   * `settings.reminders.fillYesterday`. It is worked out at an open, from the
   * record as that open reads it, and the phone shows it later without asking
   * again: so it covers only yesterday and today as this open sees them. A
   * day after this open, which the app may never be opened on, gets none (the
   * lines after days away speak for an absence), and on a day the app was
   * opened the meals it fills in from the plan may complete yesterday before
   * nine: its words ask to look and confirm, never that meals are missing.
   */
  fillYesterday: boolean;
  /** The record of yesterday and today by date. Only a day partly filled in or empty gets a "fill in"; one not in here gets none. */
  records: Record<ISODate, DayRecordState>;
  /** `settings.reminders.planWeek`. */
  planWeek: boolean;
  /** Mondays of the weeks already looked over and saved on the plan screen. */
  reviewedWeeks: ISODate[];
  /** The weekly report for the Monday it goes out (`weeklyReport`); null while it is off or there is nothing to say. */
  report: { monday: ISODate; text: string } | null;
};

/** iOS keeps at most 64 pending notifications for an app and drops the rest without a word. */
export const PENDING_LIMIT = 64;

/**
 * What fits under the phone's cap, in the order they matter: the meal-time
 * prompts and the other planned reminders first (the soonest of them, as
 * `plannedReminders` sorts them), then the office day's weekly blocks, then
 * the daily reminders; the long breaks get what is left (`dailyReminders`
 * with `room`). `planned` is how many of the planned list to hold, `office`
 * how many of the office day's, `daily` the room for the daily ones. More
 * than 64 planned cannot come up (three days of meal-time prompts and a few
 * morning lines stay far under it), but the cap would hold if it did.
 */
export function pendingFit(planned: number, office: number, limit = PENDING_LIMIT): { planned: number; office: number; daily: number } {
  const kept = Math.min(planned, limit);
  const work = Math.min(office, limit - kept);
  return { planned: kept, office: work, daily: Math.max(0, limit - kept - work) };
}

/** Days planned ahead, today included: a week and a day, so a report worked out on a Monday after its moment is next Monday's. */
const PLAN_DAYS = 8;
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

/**
 * Whether a slot gets the meal-time prompt on a date: one rule for the
 * phone's planned prompts and the app's own on the web. Never on a free day,
 * on the day the person finished setup, for a slot planned empty, or for one
 * eaten or skipped. The switch, the time of day and quiet hours are the
 * caller's to judge.
 */
export function promptDue(p: {
  date: ISODate;
  slotId: string;
  offDays: number[];
  onboardedOn?: ISODate;
  /** The slot's planned calories that day, as `slotPlans` gives them: null for a slot planned empty, missing when its plan is not known. */
  planned: number | null | undefined;
  /** Slots eaten or skipped that day, as the record reads them; a meal the app filled in counts as eaten. */
  settled: string[];
  /** Slots skipped ahead, on any day. */
  skips: SlotSkip[];
}): boolean {
  if (isOffDay(p.offDays, p.date) || p.date === p.onboardedOn) return false;
  if (p.planned === null) return false;
  if (p.settled.includes(p.slotId)) return false;
  return !skippedOn(p.skips, p.date).includes(p.slotId);
}

/**
 * Each slot's planned calories on a day's menu, by slot id; null for a slot
 * planned empty (no lines). A slot is planned by its lines, as the record
 * reads it, so lines that add up to no calories (black tea) are a plan.
 */
export function slotPlans(menu: DayMenu, foods: FoodItem[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const m of menu.meals) out[m.id] = m.lines.length > 0 ? linesKcal(m.lines, foods) : null;
  return out;
}

export function plannedReminders(input: ReminderInput): Reminder[] {
  const days = input.days ?? PLAN_DAYS;
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

    for (const p of k < SLOT_DAYS ? slots : []) {
      if (quiet(p.minutes) || !ahead(k, p.minutes)) continue;
      const kcal = input.plannedKcal[`${date}:${p.id}`];
      if (!promptDue({ date, slotId: p.id, offDays: input.offDays, onboardedOn: input.onboardedOn, planned: kcal, settled: k === 0 ? input.doneSlotIds : [], skips })) continue;
      const label = slotLabel(p.slot, input.lang);
      // A slot planned empty never gets here; one whose plan is not known gets the plain question.
      const planned = typeof kcal === 'number';
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

/**
 * The weekly report as an open can plan it. Its words are fixed when it is
 * planned and the phone shows them on Monday without asking again, so it
 * never states numbers Progress would contradict: only a report worked out
 * once the week has ended (on the Monday itself, before its moment) carries
 * them, judged on that Monday; one worked out earlier says only that the
 * week is ready to see on Progress, since days logged after this open would
 * change them. None for a week with nothing in it, or when every part of it
 * would be left out.
 */
export function weeklyReport(input: {
  today: ISODate;
  nowMinutes: number;
  /** The report's moment: nine, or when quiet hours end. */
  atMinutes?: number;
  since: ISODate;
  recordOn: (date: ISODate) => DayRecord;
  meals: Pick<Meal, 'date' | 'kcal'>[];
  weights: WeightLog[];
  goal: number;
  t: (key: string) => string;
}): { monday: ISODate; text: string } | null {
  const monday = reportMonday(input.today, input.nowMinutes, input.atMinutes);
  const ended = input.today === monday;
  const r = weekReport({ monday, today: ended ? monday : input.today, since: input.since, recordOn: input.recordOn, meals: input.meals, weights: input.weights, goal: input.goal });
  const text = r ? reportText(r, input.t) : '';
  if (!text) return null;
  return { monday, text: ended ? text : input.t('rem_report_ready') };
}

/**
 * Where a tap on a notification goes: Today on the day it is about, the plan
 * screen at next week, or Progress for the report; for a daily one, the
 * check-in for the morning check-in, and Today for the rest, the day's line
 * included.
 */
export function tapRoute(data: Record<string, unknown>, today: ISODate): string {
  const date = isIsoDate(data.date) ? data.date : null;
  if (data.kind === 'slot' || data.kind === 'fill') return date && date !== today ? `/?date=${date}` : '/';
  if (data.kind === 'planweek') return date ? `/plan?date=${date}` : '/plan';
  if (data.kind === 'report') return '/progress';
  if (data.kind === 'sleep') return '/sleep';
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
export function tapPlan(input: {
  action: 'open' | 'ate';
  data: Record<string, unknown>;
  today: ISODate;
  menuOn: (date: ISODate) => DayMenu;
  meals: Meal[];
  skips: SlotSkip[];
}): TapPlan {
  const { data } = input;
  const route = tapRoute(data, input.today);
  if (input.action !== 'ate' || data.kind !== 'slot' || !isIsoDate(data.date) || typeof data.slotId !== 'string' || data.date > input.today) return { route, ate: null };
  const outcome = promptOutcome({ menu: input.menuOn(data.date), meals: input.meals, skips: input.skips, slotId: data.slotId });
  return { route, ate: { date: data.date, slotId: data.slotId, outcome } };
}

/**
 * `tapPlan` for a tap as it arrives, on the store as it is then. Today is the
 * date on the clock at the tap (`now`), never the store's own, which on an
 * app the tap has just woken can still be yesterday: a prompt for this
 * morning would read as a day still to come and log nothing, and a tap just
 * after midnight on yesterday's prompt would open the new day.
 */
export function tapPlanAt(input: {
  action: 'open' | 'ate';
  data: Record<string, unknown>;
  now: Date;
  menuOn: (date: ISODate) => DayMenu;
  state: Pick<AppState, 'meals' | 'slotSkips'>;
}): TapPlan {
  const { meals, slotSkips } = input.state;
  return tapPlan({ action: input.action, data: input.data, today: toISODate(input.now), menuOn: input.menuOn, meals, skips: slotSkips });
}

/**
 * One tap on one delivery of a notification: the button and the body of one
 * delivery are two taps, and a reminder that comes back the next day (the
 * same id) is a new one.
 */
export function tapKey(id: string, action: 'open' | 'ate', deliveredAt: number): string {
  return `${id}|${action}|${deliveredAt}`;
}

/**
 * Whether a tap is acted on: only the first time its key comes. Returns the
 * keys with this one added when it is new, null when it was already acted on,
 * so the same tap read at start and from the listener is acted on once. Pure:
 * the keys given are left as they were.
 */
export function firstTap(seen: ReadonlySet<string>, key: string): ReadonlySet<string> | null {
  return seen.has(key) ? null : new Set([...seen, key]);
}

/** A reminder the OS repeats every day at one clock time, app closed or not. `data.kind` says what a tap on it opens (`tapRoute`). */
export type DailyReminder = { id: string; hour: number; minute: number; title: string; body: string; data: { kind: 'sleep' | 'mantra' | 'water' | 'review' | 'break' } };

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
  /** Room left under the phone's cap (`pendingFit`): the fixed ones first, then the long breaks, earliest first. No cap when missing. */
  room?: number;
};

/** `dinner` is no longer registered (the pattern is always on and its dinner slot asks); it stays here so a device that still holds it has it cancelled. */
export const DAILY_IDS = { sleep: 'sobat-sleep-checkin', mantra: 'sobat-mantra', water: 'sobat-water', dinner: 'sobat-dinner', review: 'sobat-day-review' } as const;
/** Every long-break reminder's id starts with this; older builds used it alone, for one repeating notification. */
export const LONG_BREAK_ID = 'sobat-long-break';

/** Everything planned a week ahead carries this on the phone, so it can be told apart from the daily ones. */
export const PLANNED_PREFIX = 'sobat-r-';
/** Every office-day reminder's id starts with this; older builds registered each block daily under it with the block's id alone. */
export const OFFICE_PREFIX = 'sobat-sched-';

/** A reminder the OS repeats every week on one weekday at one clock time, app closed or not: one office block on one working day. */
export type WeeklyReminder = {
  id: string;
  /** 1 is Sunday and 7 Saturday, as the phone counts them (Date.getDay() + 1). */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
};

/**
 * The office day as the phone holds it: each block at its start, every week
 * on each weekday the person chose, so a day switched off stays quiet (a
 * daily reminder cannot pick days). None while the check-ins are off or on a
 * device that is signed out or reset. A block with a broken time is left out.
 */
export function officeReminders(input: { active: boolean; schedule: WorkSchedule; t: (key: string) => string }): WeeklyReminder[] {
  const { schedule: s, t } = input;
  if (!input.active || !s.enabled) return [];
  const days = [...new Set(s.days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
  const blocks = orderedBlocks(s);
  const out: WeeklyReminder[] = [];
  for (const day of days) {
    for (const b of blocks) {
      const m = toMinutes(b.start);
      out.push({ id: `${OFFICE_PREFIX}${b.id}@${day + 1}`, weekday: day + 1, hour: Math.floor(m / 60), minute: m % 60, title: t(`ntf_${b.kind}`), body: t(`ntf_${b.kind}_body`) });
    }
  }
  return out;
}

/** One step of bringing the phone's pending notifications to what is wanted. */
export type ReminderOp =
  | { kind: 'cancel'; id: string }
  | { kind: 'daily'; reminder: DailyReminder }
  | { kind: 'weekly'; reminder: WeeklyReminder }
  | { kind: 'at'; id: string; reminder: Reminder };

/**
 * One run that brings the phone to what is wanted, the planned reminders, the
 * office day and the daily ones together: every cancel, of any kind, before
 * any add, so the pending count never passes the phone's cap on the way (a
 * cap of 64 that drops the rest without a word). `have` is what the phone
 * holds; `planned` the planned ones to hold, each with its id on the phone,
 * null to leave them as they are; `office` and `daily` the lists to register
 * whole, null to leave them (not known yet, or the same list already
 * registered). A planned one the phone holds is left; one whose moment has
 * passed is not planned, as it would fire at once. The adds go the meal-time
 * prompts first, as they matter most, then the office day, then the daily
 * ones. Pure.
 */
export function reminderOps(input: {
  have: string[];
  planned: { osId: string; reminder: Reminder }[] | null;
  daily: DailyReminder[] | null;
  office?: WeeklyReminder[] | null;
  nowMs: number;
}): ReminderOp[] {
  const cancels = new Set<string>();
  const adds: ReminderOp[] = [];
  if (input.planned) {
    const want = new Set(input.planned.map((p) => p.osId));
    for (const id of input.have) if (id.startsWith(PLANNED_PREFIX) && !want.has(id)) cancels.add(id);
    for (const p of input.planned) {
      if (input.have.includes(p.osId)) continue;
      if (new Date(`${p.reminder.date}T${p.reminder.time}:00`).getTime() <= input.nowMs) continue;
      adds.push({ kind: 'at', id: p.osId, reminder: p.reminder });
    }
  }
  if (input.office) {
    const ids = new Set(input.office.map((r) => r.id));
    for (const id of input.have) if (id.startsWith(OFFICE_PREFIX) && !ids.has(id)) cancels.add(id);
    for (const reminder of input.office) adds.push({ kind: 'weekly', reminder });
  }
  if (input.daily) {
    const ids = new Set(input.daily.map((r) => r.id));
    for (const id of [...Object.values(DAILY_IDS), LONG_BREAK_ID]) if (!ids.has(id)) cancels.add(id);
    for (const id of input.have) if (id.startsWith(LONG_BREAK_ID) && !ids.has(id)) cancels.add(id);
    for (const reminder of input.daily) adds.push({ kind: 'daily', reminder });
  }
  return [...[...cancels].map((id): ReminderOp => ({ kind: 'cancel', id })), ...adds];
}

/**
 * The list a step to the phone belongs to: an add by its kind, a cancel by its
 * id (the office day's ids, old and new; the planned ones; else the daily ones
 * and the long breaks, the only other ids `reminderOps` cancels). A refused
 * step marks its own list to be tried again whole on the next run, a refused
 * cancel too, so a reminder the phone still holds is cancelled in the end.
 * Pure.
 */
export function opList(op: ReminderOp): 'planned' | 'office' | 'daily' {
  if (op.kind === 'at') return 'planned';
  if (op.kind === 'weekly') return 'office';
  if (op.kind === 'daily') return 'daily';
  if (op.id.startsWith(OFFICE_PREFIX)) return 'office';
  if (op.id.startsWith(PLANNED_PREFIX)) return 'planned';
  return 'daily';
}

/** The daily reminders this device should hold. Anything registered and not in here is to be cancelled. */
export function dailyReminders(input: DailyInput): DailyReminder[] {
  if (!input.active) return [];
  const { t } = input;
  const out: DailyReminder[] = [];
  // Morning check-in, while last night is still fresh.
  if (input.sleepCheckin) out.push({ id: DAILY_IDS.sleep, hour: 7, minute: 30, title: t('sleep_checkin'), body: t('bed_time'), data: { kind: 'sleep' } });
  // The day's line, at eight. Re-registered daily so it is that day's line.
  if (input.mantra) out.push({ id: DAILY_IDS.mantra, hour: 8, minute: 0, title: t('mantra_title'), body: input.mantra, data: { kind: 'mantra' } });
  // A single mid-afternoon water prompt; the in-app engine handles the rest.
  if (input.water) out.push({ id: DAILY_IDS.water, hour: 15, minute: 0, title: t('add_water'), body: t('act_drink_water'), data: { kind: 'water' } });
  // The day recap, just before things wind down.
  if (input.dayReview) out.push({ id: DAILY_IDS.review, hour: 21, minute: 30, title: t('day_review'), body: t('write_review'), data: { kind: 'review' } });
  const room = Math.max(0, input.room ?? Infinity);
  // A fixed one whose hour falls in quiet hours is dropped: the night is the person's.
  const fixed = out.filter((r) => !inQuietHours(r.hour, input.quietStartHour, input.quietEndHour)).slice(0, room);
  return [...fixed, ...longBreaks(input).slice(0, room - fixed.length)];
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
    out.push({ id: `${LONG_BREAK_ID}@${hhmm(at)}`, hour, minute: at % 60, title: input.t('brk_long'), body: input.t('brk_long_hint'), data: { kind: 'break' } });
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
