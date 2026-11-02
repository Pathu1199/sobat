import { fill, numberText } from '../i18n';
import { addDays, formatDayLong, formatDayMonth, formatDayMonthYear, formatMonthYear, isIsoDate } from './date';
import type { DayFacts, PeriodReport, ReportInput, ReportKind, ReportPeriod } from './report';
import { shiftPeriod } from './report';
import { kcalBarTone, minutesText, versus, was, type DocStat } from './reportDoc';
import { NO_VALUE, oneDecimal } from './tileText';
import type { ISODate, Lang, WeightLog } from './types';
import type { StripMark } from './weekStrip';

/**
 * What the Reports screen works out before it draws: the view its address opens, the period's name, a day's words and its rows of the
 * goals card, the headline over a week or a month, the medal line and the calorie bars. The figures themselves are `core/report.ts`'s
 * and the words of a week's or a month's rows are `statLines`'s in `core/reportDoc.ts`, so the screen and the PDF say the same things. Pure.
 */
type T = (key: string) => string;

export type ReportView = { kind: ReportKind; anchor: ISODate };

const KINDS: readonly ReportKind[] = ['day', 'week', 'month'];

/** An address parameter is a string, or a list of them when it is given twice: its first. */
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * The view an address opens (`/reports?p=week&d=2026-11-02`): the kind it names, or the week; the day it names, or today. A day after
 * today is today and one before the user started is the day they started, since there is nothing to read outside those.
 */
export function reportView(p: string | string[] | undefined, d: string | string[] | undefined, today: ISODate, since: ISODate): ReportView {
  const name = first(p);
  const kind = KINDS.find((k) => k === name) ?? 'week';
  const date = first(d);
  const anchor = isIsoDate(date) ? date : today;
  return { kind, anchor: anchor > today ? today : anchor < since ? since : anchor };
}

/** The day the view rests on after a step to the period before (-1) or after (+1): the last day of that period, or today when it is not over. */
export function stepAnchor(period: ReportPeriod, by: -1 | 1, today: ISODate): ISODate {
  const { end } = shiftPeriod(period, by);
  return end > today ? today : end;
}

/** The name between the chevrons: Today, Yesterday or the day in full; This week or its first and last day; This month or the month and year. */
export function periodName(period: ReportPeriod, today: ISODate, lang: Lang, t: T): string {
  if (period.kind === 'day') {
    return period.start === today ? t('tab_today') : period.start === addDays(today, -1) ? t('yesterday') : formatDayLong(period.start, lang);
  }
  const current = period.dates.includes(today);
  if (period.kind === 'month') return current ? t('rep_this_month') : formatMonthYear(period.start, lang);
  if (current) return t('rep_this_week');
  // A week says its year when it is not this year's, at its end; one that turns the year says both.
  const turns = period.start.slice(0, 4) !== period.end.slice(0, 4);
  const start = turns ? formatDayMonthYear(period.start, lang) : formatDayMonth(period.start, lang);
  const end = turns || period.end.slice(0, 4) !== today.slice(0, 4) ? formatDayMonthYear(period.end, lang) : formatDayMonth(period.end, lang);
  return `${start} – ${end}`;
}

/**
 * A day's mark in words, as the calendar says it (all meals logged, a free day) with the two the record folds into one split: meals
 * missing is "some meals logged" when anything was and "no meals logged" when nothing was.
 */
export function dayWord(day: DayFacts, t: T): string {
  const words: Record<StripMark, string> = {
    full: t('strip_full'),
    skipped: t('strip_skipped'),
    missing: day.kcal > 0 || day.score.meals.done > 0 ? t('rep_day_partial') : t('rep_day_empty'),
    today: t('strip_today'),
    unplanned: t('menu_nothing_planned'),
    off: t('free_day'),
    planned: t('rep_day_future'),
    none: t('strip_none'),
  };
  return words[day.mark];
}

const share = (n: number, of: number): number => (of > 0 ? Math.min(1, n / of) : 0);

/**
 * The goals card of a day: meals logged, calories, protein, water, walk, routine and the weigh-in, each with its value, its goal, a bar
 * toward it where there is one, and a line against the day before (`before`, null when that day does not count). A count that is good
 * to have more of says more, fewer or the same; calories, protein and water say what the day before was, plainly. A row with nothing
 * to say is left out (no meal due, no job, no goal for water or walk, no weigh-in that day), and a day that does not count has none.
 */
export function dayStats(day: DayFacts, before: DayFacts | null, goals: ReportInput['goals'], weights: WeightLog[], t: T): DocStat[] {
  if (!day.counts) return [];
  const out: DocStat[] = [];
  const kcal = (n: number) => `${numberText(n)} kcal`;
  const grams = (n: number) => `${numberText(n)} g`;
  const litres = (ml: number) => `${oneDecimal(ml / 1000)} ${t('tile_unit_l')}`;
  const goalOf = (goal: string) => fill(t('rep_goal_only'), { goal });
  /** What the day before was, when it had any: calories, protein and water are not better for being more. */
  const plain = (earlier: number | undefined, text: (n: number) => string) => (earlier !== undefined && earlier > 0 ? was('day', text(earlier), t) : null);

  const meals = day.score.meals;
  if (meals.of > 0) {
    out.push({
      id: 'meals',
      label: t('rep_stat_meals'),
      value: fill(t('rep_of'), { n: numberText(meals.done), of: numberText(meals.of) }),
      sub: t('rep_logged'),
      bar: share(meals.done, meals.of),
      barTone: 'accent',
      delta: before && before.score.meals.of > 0 ? versus('day', meals.done, before.score.meals.done, t) : null,
    });
  }
  out.push({
    id: 'kcal',
    label: t('calories'),
    value: day.kcal > 0 ? kcal(day.kcal) : NO_VALUE,
    sub: goalOf(numberText(goals.kcal)),
    bar: day.kcal > 0 && goals.kcal > 0 ? share(day.kcal, goals.kcal) : null,
    barTone: kcalBarTone(day.kcal, goals.kcal),
    delta: plain(before?.kcal, kcal),
  });
  out.push({
    id: 'protein',
    label: t('protein'),
    value: day.protein > 0 ? grams(day.protein) : NO_VALUE,
    sub: goalOf(grams(goals.protein)),
    bar: day.protein > 0 && goals.protein > 0 ? share(day.protein, goals.protein) : null,
    barTone: 'accent',
    delta: plain(before?.protein, grams),
  });
  if (goals.waterMl > 0) {
    out.push({
      id: 'water',
      label: t('water'),
      value: litres(day.waterMl),
      sub: goalOf(litres(goals.waterMl)),
      bar: share(day.waterMl, goals.waterMl),
      barTone: 'accent',
      delta: plain(before?.waterMl, litres),
    });
  }
  if (goals.walkMin > 0) {
    const unit = t('tile_unit_min');
    out.push({
      id: 'walk',
      label: t('rep_stat_walk'),
      value: `${numberText(day.walkMin)} ${unit}`,
      sub: goalOf(`${numberText(goals.walkMin)} ${unit}`),
      bar: share(day.walkMin, goals.walkMin),
      barTone: 'accent',
      // Nothing to compare when neither day walked: "same as the day before" under a zero is only noise.
      delta: before && (day.walkMin > 0 || before.walkMin > 0) ? versus('day', day.walkMin, before.walkMin, t, unit) : null,
    });
  }
  if (day.jobs.total > 0) {
    out.push({
      id: 'jobs',
      label: t('abhyas'),
      value: fill(t('rep_of'), { n: numberText(day.jobs.done), of: numberText(day.jobs.total) }),
      sub: day.jobs.minutes > 0 ? fill(t('rep_jobs_sub'), { time: minutesText(day.jobs.minutes, t) }) : t('rep_jobs_sub_plain'),
      bar: share(day.jobs.done, day.jobs.total),
      barTone: 'accent',
      delta: before && before.jobs.total > 0 ? versus('day', day.jobs.done, before.jobs.done, t) : null,
    });
  }
  const weighed = weights.find((w) => w.date === day.date);
  if (weighed) out.push({ id: 'weight', label: t('weight_title'), value: `${oneDecimal(weighed.kg)} ${t('unit_kg')}`, sub: null, bar: null, barTone: 'accent', delta: null });
  return out;
}

/** The card at the top of a week or a month. `spoken` is its big number as a screen reader says it ("5 of 7 full days"); `perfect` and `best` are null when there is nothing to say; `best.perfect` puts a star on it. */
export type Headline = { big: string; label: string; spoken: string; perfect: string | null; best: { text: string; perfect: boolean } | null };

/** The full days over the days that count ("so far" while the period runs), the perfect days, and the best day with what it did of what it held. */
export function headline(report: PeriodReport, lang: Lang, t: T, running: boolean): Headline {
  const { n, of } = report.full;
  const best = report.best;
  const sum = running ? 'rep_sum_full_sofar' : 'rep_sum_full';
  return {
    big: `${numberText(n)} / ${numberText(of)}`,
    label: t(running ? 'rep_sub_full_sofar' : 'rep_sub_full'),
    spoken: fill(t(of === 1 ? `${sum}_one` : sum), { n: numberText(n), of: numberText(of) }),
    perfect: report.perfect === 0 ? null : report.perfect === 1 ? t('rep_sum_perfect_one') : fill(t('rep_sum_perfect'), { n: numberText(report.perfect) }),
    best: best ? { text: fill(t('rep_best'), { day: formatDayLong(best.date, lang), n: numberText(best.done), of: numberText(best.of) }), perfect: best.perfect } : null,
  };
}

/** The perfect-week medals the period holds, worded as medals; null when it holds none. */
export function medalLine(report: PeriodReport, t: T): string | null {
  return report.perfectWeeks > 0 ? fill(t('rep_medals'), { n: numberText(report.perfectWeeks) }) : null;
}

/**
 * The calorie chart of a week or a month: one bar a day (what was eaten on a day that counts, nothing on one that does not), labelled
 * with the weekday over a week, and the day of the month on the 1st and every fifth day over a month, as the PDF's chart is.
 */
export function calorieBars(report: PeriodReport, t: T): { bars: { date: ISODate; value: number }[]; labels: string[] } {
  const week = report.period.kind === 'week';
  return {
    bars: report.days.map((d) => ({ date: d.date, value: d.counts ? d.kcal : 0 })),
    labels: report.days.map((d, i) => {
      if (week) return t(`wd_${(i + 1) % 7}`);
      const day = Number(d.date.slice(8, 10));
      return day === 1 || day % 5 === 0 ? String(day) : '';
    }),
  };
}
