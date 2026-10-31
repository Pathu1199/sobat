import { t } from '../i18n';
import { addDays, formatDayLabel } from './date';
import { recordStart } from './menu';
import type { DayRecord } from './record';
import type { ISODate, Lang, Meal, Profile } from './types';

/**
 * The week strip on Today: Monday to Sunday of the week being looked at,
 * each day with a mark from the record. Full is a filled teal dot, a past day
 * with meals missing amber, a planned day (and today, until it is full) an
 * outline; a full day of meals all skipped with nothing eaten is a grey dot of
 * its own, a complete record but never praised as full; a day still holding
 * meals filled in from the plan is drawn lighter; an off day, a past day that
 * planned nothing and ate nothing, and a day before the person started have
 * no dot. Pure.
 */
export type StripMark = 'full' | 'skipped' | 'missing' | 'today' | 'planned' | 'off' | 'unplanned' | 'none';
export type StripDay = {
  date: ISODate;
  /** Date.getDay(): 0 is Sunday, for the weekday's short name. */
  weekday: number;
  /** The day of the month. */
  day: number;
  mark: StripMark;
  light: boolean;
  isToday: boolean;
  selected: boolean;
};

export function weekStrip(input: { monday: ISODate; today: ISODate; viewed: ISODate; records: DayRecord[]; since: ISODate }): StripDay[] {
  return input.records.slice(0, 7).map((r, i) => {
    const date = addDays(input.monday, i);
    return {
      date,
      weekday: (i + 1) % 7,
      day: Number(date.slice(8, 10)),
      ...markOf(r, date, input.today, input.since),
      isToday: date === input.today,
      selected: date === input.viewed,
    };
  });
}

/**
 * One day's mark from its record, the same on the week strip and on
 * Progress's calendar. A day before the person started shows nothing, a free
 * weekday too: the record starts on `since`. A full day with nothing eaten
 * (every meal skipped, a drink at most) is `skipped`, never `full`: the
 * record is complete, but skipping is not praised, as the streak never
 * counts it.
 */
export function markOf(r: DayRecord, date: ISODate, today: ISODate, since: ISODate): { mark: StripMark; light: boolean } {
  const mark = markFor(r, date, today, since);
  return { mark, light: r.fromPlan && (mark === 'full' || mark === 'missing' || mark === 'today') };
}

function markFor(r: DayRecord, date: ISODate, today: ISODate, since: ISODate): StripMark {
  if (date < since) return 'none';
  if (r.state === 'off') return 'off';
  if (date > today) return 'planned';
  // A full day with nothing eaten is never praised as full. On a day that planned nothing it is meals skipped only when one was
  // skipped; a drink there and nothing skipped is a day with nothing planned, except today, which is still going and keeps its mark.
  if (r.state === 'full') return !r.nothingEaten ? 'full' : r.nothingPlanned && !r.skipped ? (date === today ? 'today' : 'unplanned') : 'skipped';
  if (date === today) return 'today';
  return r.nothingPlanned ? 'unplanned' : 'missing';
}

/** The words for each mark: a free day in the words used for one everywhere, a day with nothing planned as the menu says it. */
function markWords(mark: StripMark): string {
  return mark === 'off' ? 'free_day' : mark === 'unplanned' ? 'menu_nothing_planned' : `strip_${mark}`;
}

/**
 * What a screen reader hears for a day on the strip and on the calendar: the
 * date, "today" for today (its mark says so already while it is still going),
 * what the dot means, and whether meals were filled in from the plan.
 */
export function stripDayLabel(d: { date: ISODate; mark: StripMark; light: boolean; isToday: boolean }, lang: Lang): string {
  const today = d.isToday && d.mark !== 'today' ? `, ${t(lang, 'today_short')}` : '';
  const plan = d.light ? `, ${t(lang, 'strip_from_plan')}` : '';
  return `${formatDayLabel(d.date, lang)}${today}, ${t(lang, markWords(d.mark))}${plan}`;
}

/**
 * Where the record starts: the date `recordStart` gives, the start the app's own filling in keeps to (the later of the day
 * setup finished and the day the store moved to this version, never a date after today); with neither, the first meal ever
 * logged, else today. Days before it have nothing to miss.
 */
export function stripSince(profile: Pick<Profile, 'onboardedOn' | 'autoFillFrom'>, meals: Pick<Meal, 'date'>[], today: ISODate): ISODate {
  const started = recordStart(profile, today);
  if (started) return started;
  let first = today;
  for (const m of meals) if (m.date < first) first = m.date;
  return first;
}

/** A swipe on the strip: left for the next week, right for the one before. Shorter than 48 points, or more up-and-down than sideways, is not a swipe. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 48 || Math.abs(dx) < 2 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** How far a sideways scroll goes before it moves a week, and how long it rests before the next one can. */
export const WHEEL_STEP = 80;
export const WHEEL_REST_MS = 300;

/** A sideways scroll so far: its distance, whether it has moved a week yet, and when it last moved. */
export type WheelRun = { sum: number; fired: boolean; at: number };
export const WHEEL_IDLE: WheelRun = { sum: 0, fired: false, at: -Infinity };

/**
 * A two-finger swipe on a trackpad (on the web it comes as wheel events, not
 * a drag), added up: once it has gone WHEEL_STEP points sideways it moves one
 * week, left for the next and right for the one before, as a swipe does; the
 * rest of that swipe, and the glide after it, move nothing more until the
 * scroll has rested WHEEL_REST_MS. A scroll more up-and-down than sideways is
 * the page's, never a week. Pure.
 */
export function wheelStep(run: WheelRun, dx: number, dy: number, now: number): { run: WheelRun; step: -1 | 0 | 1 } {
  const live = now - run.at <= WHEEL_REST_MS ? run : WHEEL_IDLE;
  if (Math.abs(dx) <= Math.abs(dy)) return { run: { ...live, at: now }, step: 0 };
  const sum = live.sum + dx;
  if (live.fired || Math.abs(sum) < WHEEL_STEP) return { run: { sum, fired: live.fired, at: now }, step: 0 };
  return { run: { sum: 0, fired: true, at: now }, step: sum > 0 ? 1 : -1 };
}
