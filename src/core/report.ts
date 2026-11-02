import { addDays, mondayOf, weekDates } from './date';
import { shiftMonth } from './progress';
import type { DayRecord } from './record';
import { scoreOf, type DayScore } from './teacher';
import type { ISODate, Meal, WeightLog } from './types';
import { isOffDay } from './week';
import { markOf, type StripMark } from './weekStrip';

/**
 * Reports, worked out: a day, a week or a month read the way Progress reads a
 * day (the record's mark, the perfect day, the complete days of the average),
 * its figures, the best day, and the earlier span to compare it with. A day
 * is never computed a second way here: `dayFacts` reads one through the same
 * `markOf`, and `periodReport` only adds those facts up. Pure.
 */
export type ReportKind = 'day' | 'week' | 'month';
export type ReportPeriod = { kind: ReportKind; start: ISODate; end: ISODate; dates: ISODate[] };

/** The period of a kind that holds `anchor`: the day itself, its Monday-to-Sunday week, or its month from the 1st to the last day. */
export function periodOf(kind: ReportKind, anchor: ISODate): ReportPeriod {
  if (kind === 'day') return { kind, start: anchor, end: anchor, dates: [anchor] };
  if (kind === 'week') {
    const dates = weekDates(mondayOf(anchor));
    return { kind, start: dates[0], end: dates[6], dates };
  }
  const month = anchor.slice(0, 7);
  const dates: ISODate[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) dates.push(d);
  return { kind, start: dates[0], end: dates[dates.length - 1], dates };
}

/** The period before (-1) or after (+1) this one, of the same kind. */
export function shiftPeriod(p: ReportPeriod, by: -1 | 1): ReportPeriod {
  if (p.kind === 'day') return periodOf('day', addDays(p.start, by));
  if (p.kind === 'week') return periodOf('week', addDays(p.start, 7 * by));
  return periodOf('month', `${shiftMonth(p.start.slice(0, 7), by)}-01`);
}

/** Whether the screen steps back (the period before ends on or after the day the user started) and forward (this one ends before today). */
export function periodSteps(p: ReportPeriod, today: ISODate, since: ISODate): { prev: boolean; next: boolean } {
  return { prev: addDays(p.start, -1) >= since, next: p.end < today };
}

/**
 * The earlier dates a period is compared with, as fair as can be. A period that holds today is compared with the same span of the
 * one before it: Monday to today against last Monday to the same weekday, the 1st to today against the same days of last month, cut
 * to that month's length (the 31st against a 30-day month takes the whole of it). A period that is over is compared with the whole
 * one before it, and so is one still to come, which has nothing to say. A day is compared with the day before it.
 */
export function compareSpan(p: ReportPeriod, today: ISODate): ISODate[] {
  if (p.kind === 'day') return [addDays(p.start, -1)];
  const before = shiftPeriod(p, -1).dates;
  const at = p.dates.indexOf(today);
  return at < 0 ? before : before.slice(0, at + 1);
}

/** Whether a date is one that counts: today or before, the day the user started or after, and not a free day. The rest are shown as such and never judged. */
function dayCounts(date: ISODate, today: ISODate, since: ISODate, offDays: number[]): boolean {
  return date <= today && date >= since && !isOffDay(offDays, date);
}

/** Of these dates, the ones that count. */
export function countedDates(dates: ISODate[], today: ISODate, since: ISODate, offDays: number[]): ISODate[] {
  return dates.filter((d) => dayCounts(d, today, since, offDays));
}

/** One day as a report reads it: what the record, the meals, the tiles and the routine say of that date, and how the teacher scores it. */
export type DayFacts = {
  date: ISODate;
  /** A day that counts: see `countedDates`. */
  counts: boolean;
  /** The strip's mark for the day, `markOf(record, date, today, since).mark`. */
  mark: StripMark;
  perfect: boolean;
  /** Eaten that date. */
  kcal: number;
  protein: number;
  waterMl: number;
  walkMin: number;
  /** The routine's jobs on the date: `dayStatus`. */
  jobs: { done: number; total: number; minutes: number };
  /** The teacher's `dayScore`: at 1440 minutes for a day gone by, the minute now for today. */
  score: DayScore;
};

/**
 * A day's facts from plain inputs, so the screen reads each store hook once and the rules (what counts, the mark, the totals of the
 * date's meals) are here. `meals` may be any meals: only the ones on `date` are added up.
 */
export function dayFacts(input: {
  date: ISODate;
  today: ISODate;
  since: ISODate;
  offDays: number[];
  record: DayRecord;
  perfect: boolean;
  meals: Pick<Meal, 'date' | 'kcal' | 'protein'>[];
  waterMl: number;
  walkMin: number;
  jobs: { done: number; total: number; minutes: number };
  score: DayScore;
}): DayFacts {
  const meals = input.meals.filter((m) => m.date === input.date);
  return {
    date: input.date,
    counts: dayCounts(input.date, input.today, input.since, input.offDays),
    mark: markOf(input.record, input.date, input.today, input.since).mark,
    perfect: input.perfect,
    kcal: meals.reduce((a, m) => a + m.kcal, 0),
    protein: meals.reduce((a, m) => a + m.protein, 0),
    waterMl: input.waterMl,
    walkMin: input.walkMin,
    jobs: input.jobs,
    score: input.score,
  };
}

export type ReportInput = {
  today: ISODate;
  nowMinutes: number;
  since: ISODate;
  offDays: number[];
  goals: { kcal: number; protein: number; waterMl: number; walkMin: number };
  /** A date's facts: the screen builds this from the store's hooks. */
  factsOn: (date: ISODate) => DayFacts;
  weights: WeightLog[];
  /** The Mondays of the perfect-week medals (`perfectWeeks`), one for each medal. */
  perfectWeekMondays: ISODate[];
};

export type PeriodReport = {
  period: ReportPeriod;
  /** Every date of the period, in order. */
  days: DayFacts[];
  /** Days that count. */
  counted: number;
  /** Days marked full, of the days that count. */
  full: { n: number; of: number };
  perfect: number;
  /** The calories a day on average over the complete days (every planned meal logged or skipped), as `completeIntake` takes it. Null without one. */
  avgKcal: number | null;
  /** The protein a day on average over those same days. */
  avgProtein: number | null;
  /** Days the water goal was met, of the days that count. */
  water: { n: number; of: number };
  /** Minutes walked on the days that count, and the days the walk goal was met. */
  walk: { minutes: number; n: number; of: number };
  /** Jobs done, due and minutes spent on the days that count. Null when no job was due. */
  jobs: { done: number; due: number; minutes: number } | null;
  /** The first and last weigh-in in the period, and the change between them; null with fewer than two. */
  weight: { from: number; to: number; change: number } | null;
  /** The day that did the most, with what it did and what it held; null when no day did at least half, and always for a day. */
  best: { date: ISODate; done: number; of: number; perfect: boolean } | null;
  /** Perfect-week medals whose Monday is in the period. */
  perfectWeeks: number;
};

/** What a day held, as the teacher card counts it: meals due, jobs due and one for a water goal. */
function possibleOf(s: DayScore): number {
  return s.meals.of + s.jobs.of + (s.water.goal > 0 ? 1 : 0);
}

/**
 * The best of the days that count (today included). A day qualifies when it did something and at least half of what it held, as the
 * teacher card says it. A perfect day ranks above any that is not; then the higher score, then the higher share of what the day held,
 * then the later day.
 */
function bestDay(days: DayFacts[]): PeriodReport['best'] {
  let best: { facts: DayFacts; done: number; of: number } | null = null;
  for (const d of days) {
    if (!d.counts) continue;
    const done = scoreOf(d.score);
    const of = possibleOf(d.score);
    if (done <= 0 || done * 2 < of) continue;
    if (best && !beats({ facts: d, done, of }, best)) continue;
    best = { facts: d, done, of };
  }
  return best ? { date: best.facts.date, done: best.done, of: best.of, perfect: best.facts.perfect } : null;
}

/** Whether `a` ranks above `b`, a later day than `b`: ties go to `a`. */
function beats(a: { facts: DayFacts; done: number; of: number }, b: { facts: DayFacts; done: number; of: number }): boolean {
  if (a.facts.perfect !== b.facts.perfect) return a.facts.perfect;
  if (a.done !== b.done) return a.done > b.done;
  // The shares done/of compared without dividing: a.done / a.of against b.done / b.of.
  const share = a.done * b.of - b.done * a.of;
  return share !== 0 ? share > 0 : a.facts.date >= b.facts.date;
}

/** A period's figures, from each of its days' facts: the days that count are judged, the rest are in `days` and nothing more. */
export function periodReport(p: ReportPeriod, input: ReportInput): PeriodReport {
  const days = p.dates.map((d) => input.factsOn(d));
  const counted = days.filter((d) => d.counts);
  const complete = counted.filter((d) => d.mark === 'full' || d.mark === 'skipped');
  const avg = (pick: (d: DayFacts) => number) => (complete.length > 0 ? Math.round(complete.reduce((a, d) => a + pick(d), 0) / complete.length) : null);
  const due = counted.reduce((a, d) => a + d.jobs.total, 0);
  const weighed = input.weights.filter((w) => p.dates.includes(w.date)).sort((a, b) => a.date.localeCompare(b.date));
  return {
    period: p,
    days,
    counted: counted.length,
    full: { n: counted.filter((d) => d.mark === 'full').length, of: counted.length },
    perfect: counted.filter((d) => d.perfect).length,
    avgKcal: avg((d) => d.kcal),
    avgProtein: avg((d) => d.protein),
    water: { n: input.goals.waterMl > 0 ? counted.filter((d) => d.waterMl >= input.goals.waterMl).length : 0, of: counted.length },
    walk: {
      minutes: counted.reduce((a, d) => a + d.walkMin, 0),
      n: input.goals.walkMin > 0 ? counted.filter((d) => d.walkMin >= input.goals.walkMin).length : 0,
      of: counted.length,
    },
    jobs: due > 0 ? { done: counted.reduce((a, d) => a + d.jobs.done, 0), due, minutes: counted.reduce((a, d) => a + d.jobs.minutes, 0) } : null,
    weight: weighed.length >= 2 ? { from: weighed[0].kg, to: weighed[weighed.length - 1].kg, change: Math.round((weighed[weighed.length - 1].kg - weighed[0].kg) * 10) / 10 } : null,
    best: p.kind === 'day' ? null : bestDay(days),
    perfectWeeks: input.perfectWeekMondays.filter((m) => p.dates.includes(m)).length,
  };
}

/** The same figures over the earlier span (`compareSpan`), or null when it has no day that counts: the first week has nothing to be compared with. */
export function compareReport(now: PeriodReport, input: ReportInput): PeriodReport | null {
  const dates = compareSpan(now.period, input.today);
  if (dates.length === 0) return null;
  const report = periodReport({ kind: now.period.kind, start: dates[0], end: dates[dates.length - 1], dates }, input);
  return report.counted > 0 ? report : null;
}

/** How a figure stands against its earlier one: by how much, and as more, fewer or the same. */
export function delta(now: number, before: number): { diff: number; word: 'more' | 'fewer' | 'same' } {
  return { diff: Math.abs(now - before), word: now > before ? 'more' : now < before ? 'fewer' : 'same' };
}
