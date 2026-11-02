import { fill, makeT, numberText } from '../i18n';
import { PALETTE_SETS } from '../ui/theme';
import { formatDayLabel, formatDayLong, formatDayMonthYear, formatMinutes, formatMonthYear } from './date';
import { paletteOf, type PaletteId } from './palette';
import { delta, type PeriodReport, type ReportInput, type ReportKind } from './report';
import { NO_VALUE, oneDecimal, signedKg } from './tileText';
import type { ISODate, Lang } from './types';
import type { StripMark } from './weekStrip';

/**
 * The monthly report as data: every string already in the user's language and every number already formatted, so the HTML the phone
 * apps print and the canvas the browser draws say the same thing. `statLines` is the eight figures of the goals card, which the Reports
 * screen draws too, for a week or a month; `markWord` is a day's mark as a word. Pure.
 */
type T = (key: string) => string;

/** The daylight colours of a palette that the report is drawn in, as plain CSS colours. */
export type ReportColors = { accent: string; accentSoft: string; text: string; textDim: string; textFaint: string; border: string; gold: string; goldSoft: string; card: string; bg: string; white: string };

/** A figure against the period before: its words, and whether they are in the good colour (only a rise in a count that is good to have more of). */
export type DocDelta = { text: string; good: boolean };

export type DocStat = {
  /** Which figure it is, for the screen's icon. */
  id: 'meals' | 'perfect' | 'kcal' | 'protein' | 'water' | 'walk' | 'jobs' | 'weight';
  label: string;
  value: string;
  sub: string | null;
  /** How far toward its goal, 0 to 1, for the thin bar; null where there is no goal to fill. */
  bar: number | null;
  delta: DocDelta | null;
};

/** A day's row. `dim` is a day that does not count (free, before the start, still to come). */
export type DocRow = { cells: string[]; perfect: boolean; dim: boolean };

export type ReportDoc = {
  /** dhyey-report-2026-10.pdf */
  fileName: string;
  /** The app's name, as it sits under the icon. */
  app: string;
  /** The language the words are in, for the page's lang. */
  lang: Lang;
  /** "Monthly report" */
  title: string;
  /** "October 2026" */
  month: string;
  /** The user's first name, '' when none. */
  name: string;
  /** "21 of 31 full days · 6 perfect days · best day Thursday, 30 October" */
  summary: string;
  stats: DocStat[];
  /** One bar a day (calories eaten), labelled with the day of the month on the 1st and every fifth day. */
  chart: { bars: { label: string; value: number }[]; goal: number; caption: string };
  table: { head: string[]; rows: DocRow[] };
  medals: string[];
  footer: string;
};

/** The daylight colours of a palette (the default for one this build does not know): a report is printed, so it is always on white paper. */
export function reportColors(palette: PaletteId): ReportColors {
  const p = PALETTE_SETS[paletteOf(palette)].light;
  return { accent: p.accent, accentSoft: p.accentSoft, text: p.text, textDim: p.textDim, textFaint: p.textFaint, border: p.border, gold: p.gold, goldSoft: p.goldSoft, card: p.card, bg: p.bg, white: p.white };
}

/** A day's mark as a short word for a table cell; a free day as the app says it everywhere, a day that is not judged as a dash. */
export function markWord(mark: StripMark, t: T): string {
  switch (mark) {
    case 'full':
      return t('rep_mark_full');
    case 'skipped':
      return t('rep_mark_skipped');
    case 'missing':
      return t('rep_mark_missing');
    case 'today':
      return t('rep_mark_today');
    case 'unplanned':
      return t('rep_mark_unplanned');
    case 'off':
      return t('free_day');
    default:
      return NO_VALUE;
  }
}

/** A count against the earlier one: "2 more than last week" in the good colour, a fall or no change plainly. `unit` follows the number ("20 min"). */
export function versus(kind: ReportKind, now: number, before: number, t: T, unit?: string): DocDelta {
  const d = delta(now, before);
  if (d.word === 'same') return { text: t(`rep_same_${kind}`), good: false };
  const n = unit ? `${numberText(d.diff)} ${unit}` : numberText(d.diff);
  return { text: fill(t(`rep_${d.word}_${kind}`), { n }), good: d.word === 'more' };
}

/** What the earlier period was, as a plain number with no colour: calories, protein and weight, where more is not better. */
export function was(kind: ReportKind, value: string, t: T): DocDelta {
  return { text: fill(t(`rep_was_${kind}`), { value }), good: false };
}

const share = (n: number, of: number): number => (of > 0 ? Math.min(1, n / of) : 0);

/** Minutes as the reader says them: "20 min" under an hour, hours and minutes ("7h 50m") from there. */
export function minutesText(minutes: number, t: T): string {
  return minutes < 60 ? `${numberText(minutes)} ${t('tile_unit_min')}` : formatMinutes(minutes, t);
}

/**
 * The figures of a week or a month, as the goals card gives them: meals, perfect days, calories, protein, water, walk, routine and
 * weight, each with its comparison against `before`. A figure with nothing to say is left out (no job due, fewer than two weigh-ins,
 * no water or walk goal), and none are given for a period with no day that counts. `running` is whether the period holds today, which
 * makes the full days read "so far". Calories, protein and weight are the earlier number in plain words (`good` false); the counts say
 * more, fewer or the same, and are good only for more.
 */
export function statLines(report: PeriodReport, before: PeriodReport | null, goals: ReportInput['goals'], t: T, running: boolean): DocStat[] {
  if (report.counted === 0) return [];
  const kind = report.period.kind;
  const out: DocStat[] = [];
  const kcal = (n: number) => `${numberText(n)} kcal`;
  const grams = (n: number) => `${numberText(n)} g`;
  /** Calories or protein: the average of the complete days, its goal, and the earlier average as plain words. */
  const average = (id: 'kcal' | 'protein', avg: number | null, earlier: number | null | undefined, goal: number, text: (n: number) => string, goalText: string): DocStat => ({
    id,
    label: t(id === 'kcal' ? 'calories' : 'protein'),
    value: avg === null ? NO_VALUE : text(avg),
    sub: fill(t(avg === null ? 'rep_goal_only' : 'rep_avg_goal'), { goal: goalText }),
    bar: avg !== null && goal > 0 ? share(avg, goal) : null,
    delta: earlier === null || earlier === undefined ? null : was(kind, text(earlier), t),
  });

  out.push({
    id: 'meals',
    label: t('rep_stat_meals'),
    value: fill(t('rep_of'), { n: numberText(report.full.n), of: numberText(report.full.of) }),
    sub: t(running ? 'rep_sub_full_sofar' : 'rep_sub_full'),
    bar: share(report.full.n, report.full.of),
    delta: before ? versus(kind, report.full.n, before.full.n, t) : null,
  });
  out.push({
    id: 'perfect',
    label: t('rep_stat_perfect'),
    value: numberText(report.perfect),
    sub: t('rep_stat_perfect_sub'),
    bar: null,
    delta: before ? versus(kind, report.perfect, before.perfect, t) : null,
  });
  out.push(average('kcal', report.avgKcal, before?.avgKcal, goals.kcal, kcal, numberText(goals.kcal)));
  out.push(average('protein', report.avgProtein, before?.avgProtein, goals.protein, grams, grams(goals.protein)));
  if (goals.waterMl > 0) {
    out.push({
      id: 'water',
      label: t('water'),
      value: fill(t('rep_of'), { n: numberText(report.water.n), of: numberText(report.water.of) }),
      sub: t('rep_water_sub'),
      bar: share(report.water.n, report.water.of),
      delta: before ? versus(kind, report.water.n, before.water.n, t) : null,
    });
  }
  if (goals.walkMin > 0) {
    out.push({
      id: 'walk',
      label: t('rep_stat_walk'),
      value: `${numberText(report.walk.minutes)} ${t('tile_unit_min')}`,
      sub: report.walk.n === 1 ? t('rep_walk_sub_one') : fill(t('rep_walk_sub'), { n: numberText(report.walk.n) }),
      bar: share(report.walk.n, report.walk.of),
      delta: before ? versus(kind, report.walk.minutes, before.walk.minutes, t, t('tile_unit_min')) : null,
    });
  }
  if (report.jobs) {
    out.push({
      id: 'jobs',
      label: t('abhyas'),
      value: fill(t('rep_of'), { n: numberText(report.jobs.done), of: numberText(report.jobs.due) }),
      sub: report.jobs.minutes > 0 ? fill(t('rep_jobs_sub'), { time: minutesText(report.jobs.minutes, t) }) : t('rep_jobs_sub_plain'),
      bar: share(report.jobs.done, report.jobs.due),
      delta: before?.jobs ? versus(kind, report.jobs.done, before.jobs.done, t) : null,
    });
  }
  if (report.weight) {
    out.push({
      id: 'weight',
      label: t('weight_title'),
      value: `${signedKg(report.weight.change)} ${t('unit_kg')}`,
      sub: `${oneDecimal(report.weight.from)} → ${oneDecimal(report.weight.to)}`,
      bar: null,
      delta: before?.weight ? was(kind, `${signedKg(before.weight.change)} ${t('unit_kg')}`, t) : null,
    });
  }
  return out;
}

/** The summary line: full days (so far while the period runs), perfect days and the best day; a part with nothing to say is left out. */
function summaryOf(report: PeriodReport, running: boolean, lang: Lang, t: T): string {
  if (report.counted === 0) return t('rep_pdf_nothing');
  const { n, of } = report.full;
  const key = running ? 'rep_sum_full_sofar' : 'rep_sum_full';
  const parts = [fill(t(of === 1 ? `${key}_one` : key), { n: numberText(n), of: numberText(of) })];
  if (report.perfect === 1) parts.push(t('rep_sum_perfect_one'));
  else if (report.perfect > 1) parts.push(fill(t('rep_sum_perfect'), { n: numberText(report.perfect) }));
  if (report.best) parts.push(fill(t('rep_sum_best'), { day: formatDayLong(report.best.date, lang) }));
  return parts.join(' · ');
}

/** One day's row: the figures of a day that counts, a dash for each on a day that does not (a free day says so in the record's column). */
function rowOf(day: PeriodReport['days'][number], lang: Lang, t: T): DocRow {
  const date = formatDayLabel(day.date, lang);
  if (!day.counts) return { cells: [date, NO_VALUE, NO_VALUE, NO_VALUE, NO_VALUE, NO_VALUE, markWord(day.mark === 'off' ? 'off' : 'none', t)], perfect: false, dim: true };
  return {
    cells: [
      date,
      day.kcal > 0 ? numberText(day.kcal) : NO_VALUE,
      day.protein > 0 ? `${numberText(day.protein)} g` : NO_VALUE,
      `${oneDecimal(day.waterMl / 1000)} ${t('tile_unit_l')}`,
      `${numberText(day.walkMin)} ${t('tile_unit_min')}`,
      day.jobs.total > 0 ? `${day.jobs.done}/${day.jobs.total}` : NO_VALUE,
      markWord(day.mark, t),
    ],
    perfect: day.perfect,
    dim: false,
  };
}

/**
 * The month's report, worded. `before` is the earlier month it is compared with (`compareReport`; null in the first month), `medalsHeld`
 * the medals on the shelf now, `madeOn` today: a month that holds it is still running, and its full days read "so far".
 */
export function reportDoc(input: { report: PeriodReport; before: PeriodReport | null; goals: ReportInput['goals']; name: string; lang: Lang; medalsHeld: number; madeOn: ISODate }): ReportDoc {
  const { report, before, goals, lang } = input;
  const t = makeT(lang);
  const running = report.period.dates.includes(input.madeOn);
  const medals: string[] = [];
  if (report.perfectWeeks > 0) medals.push(fill(t('rep_medal_weeks'), { n: numberText(report.perfectWeeks) }));
  if (input.medalsHeld > 0) medals.push(fill(t('rep_medal_held'), { n: numberText(input.medalsHeld) }));
  return {
    fileName: `dhyey-report-${report.period.start.slice(0, 7)}.pdf`,
    app: t('app_name'),
    lang,
    title: t('rep_pdf_title'),
    month: formatMonthYear(report.period.start, lang),
    name: input.name.trim().split(/\s+/)[0],
    summary: summaryOf(report, running, lang, t),
    stats: statLines(report, before, goals, t, running),
    chart: {
      bars: report.days.map((d) => {
        const day = Number(d.date.slice(8, 10));
        return { label: day === 1 || day % 5 === 0 ? String(day) : '', value: d.counts ? d.kcal : 0 };
      }),
      goal: goals.kcal,
      caption: fill(t('rep_chart_caption'), { goal: numberText(goals.kcal) }),
    },
    table: {
      head: [t('rep_col_date'), t('rep_col_kcal'), t('protein'), t('water'), t('rep_stat_walk'), t('rep_col_jobs'), t('rep_col_record')],
      rows: report.days.map((d) => rowOf(d, lang, t)),
    },
    medals,
    footer: fill(t('rep_pdf_footer'), { date: formatDayMonthYear(input.madeOn, lang) }),
  };
}
