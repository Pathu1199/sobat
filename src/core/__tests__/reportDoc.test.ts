import { describe, expect, it } from 'vitest';
import { keysOf, makeT, t as tr } from '../../i18n';
import { PALETTE_IDS } from '../palette';
import { PALETTE_SETS } from '../../ui/theme';
import { formatDayLabel, formatDayLong, formatDayMonthYear } from '../date';
import { compareReport, periodOf, periodReport, type DayFacts, type ReportInput } from '../report';
import { markWord, reportColors, reportDoc, statLines } from '../reportDoc';
import type { DayScore } from '../teacher';
import type { Lang } from '../types';
import { isOffDay } from '../week';

// October 2026 is the month, made on 2 November: it is over, and September before it is the whole month it is compared with.
const TODAY = '2026-11-02';
const SINCE = '2026-09-01';
const GOALS = { kcal: 1760, protein: 112, waterMl: 2500, walkMin: 30 };

const score = (p: Partial<DayScore> = {}): DayScore => ({ meals: { done: 0, of: 0 }, jobs: { done: 0, of: 0, next: null }, water: { ml: 0, goal: 0 }, walk: { min: 0, goal: 0 }, ...p });
const FULL_DAY = score({ meals: { done: 4, of: 4 }, jobs: { done: 3, of: 3, next: null }, water: { ml: 2500, goal: 2500 } });

/**
 * October: the first 21 days full, the last 10 partly logged, five perfect days. September: 10 full days, the rest partly logged.
 * Days that do not count are marked as the record would mark them; `shape` changes any day on top of that.
 */
function inputOf(over: Partial<Omit<ReportInput, 'factsOn'>> & { shape?: (date: string) => Partial<DayFacts> } = {}): ReportInput {
  const { shape = () => ({}), ...rest } = over;
  const base = { today: TODAY, nowMinutes: 600, since: SINCE, offDays: [] as number[], goals: GOALS, weights: [], perfectWeekMondays: [], ...rest };
  return {
    ...base,
    factsOn: (date) => {
      const day = Number(date.slice(8, 10));
      const counts = date <= base.today && date >= base.since && !isOffDay(base.offDays, date);
      const october = date.startsWith('2026-10');
      const good = october ? day <= 21 : day <= 10;
      const pattern: Partial<DayFacts> = good
        ? { mark: 'full', kcal: october ? 1700 : 1500, protein: october ? 90 : 70, waterMl: 2500, walkMin: october ? 30 : 10, jobs: { done: 3, total: 3, minutes: 20 }, score: FULL_DAY }
        : { mark: 'missing', kcal: october ? 400 : 300, protein: october ? 20 : 10, waterMl: october ? 500 : 0, walkMin: 0, jobs: { done: october ? 1 : 0, total: 3, minutes: october ? 5 : 0 }, score: score() };
      const off: Partial<DayFacts> = counts ? {} : { mark: date > base.today ? 'planned' : date < base.since ? 'none' : 'off' };
      return {
        date,
        counts,
        mark: 'full',
        perfect: october && [3, 7, 10, 14, 30].includes(day),
        kcal: 0,
        protein: 0,
        waterMl: 0,
        walkMin: 0,
        jobs: { done: 0, total: 0, minutes: 0 },
        score: score(),
        ...pattern,
        ...off,
        ...shape(date),
      };
    },
  };
}

const OCT = periodOf('month', '2026-10-15');
type DocInput = Parameters<typeof reportDoc>[0];
function build(over: Parameters<typeof inputOf>[0] = {}, extra: Partial<DocInput> = {}, lang: Lang = 'en') {
  const inp = inputOf(over);
  const report = periodReport(OCT, inp);
  return reportDoc({ report, before: compareReport(report, inp), goals: inp.goals, name: 'Varad Shinde', lang, medalsHeld: 9, madeOn: inp.today, ...extra });
}
const byId = (stats: { id: string }[]) => Object.fromEntries(stats.map((s) => [s.id, s])) as Record<string, ReturnType<typeof statLines>[number]>;

describe('reportDoc: the header and the summary', () => {
  it('names the file, the title and the month, and the person by their first name', () => {
    const doc = build();
    expect(doc.fileName).toBe('dhyey-report-2026-10.pdf');
    expect(doc.title).toBe('Monthly report');
    expect(doc.month).toBe('October 2026');
    expect(doc.name).toBe('Varad');
    expect(doc.app).toBe('Dhyey');
    expect(doc.lang).toBe('en');
    expect(build({}, { name: '   ' }).name).toBe('');
    expect(build({}, { name: '' }).name).toBe('');
    expect(build({}, { name: 'Asha' }).name).toBe('Asha');
  });

  it('sums up the month in one line: full days, perfect days and the best day', () => {
    const report = periodReport(OCT, inputOf());
    expect(report.best).not.toBeNull();
    expect(build().summary).toBe(`21 of 31 full days · 5 perfect days · best day ${formatDayLong(report.best!.date, 'en')}`);
  });

  it('says "so far" while the month is still running, and a single day or perfect day in the singular', () => {
    const today = '2026-10-03';
    const inp = inputOf({ today });
    const report = periodReport(OCT, inp);
    const doc = reportDoc({ report, before: compareReport(report, inp), goals: GOALS, name: '', lang: 'en', medalsHeld: 0, madeOn: today });
    expect(doc.summary.startsWith('3 of 3 full days so far · 1 perfect day · best day')).toBe(true);
    expect(doc.stats[0].sub).toBe('full days so far');
    const first = '2026-10-01';
    const one = periodReport(periodOf('month', first), inputOf({ today: first }));
    const solo = reportDoc({ report: one, before: null, goals: GOALS, name: '', lang: 'en', medalsHeld: 0, madeOn: first });
    expect(solo.summary.startsWith('1 of 1 full day so far')).toBe(true);
    expect(solo.summary).not.toContain('perfect');
  });

  it('leaves out the parts with nothing to say, and says so when nothing counts yet', () => {
    const inp = inputOf({ shape: () => ({ perfect: false, mark: 'missing', score: score() }) });
    const doc = reportDoc({ report: periodReport(OCT, inp), before: null, goals: GOALS, name: '', lang: 'en', medalsHeld: 0, madeOn: TODAY });
    expect(doc.summary).toBe('0 of 31 full days');
    const none = reportDoc({ report: periodReport(periodOf('month', '2026-12-10'), inputOf()), before: null, goals: GOALS, name: '', lang: 'en', medalsHeld: 0, madeOn: TODAY });
    expect(none.summary).toBe('Nothing to report for this month yet.');
    expect(none.stats).toEqual([]);
  });

  it('writes the footer with the date it was made, and in Marathi names the app ध्येय', () => {
    expect(build().footer).toBe('Made with Dhyey on 2 Nov 2026 · Dhyey is not a doctor');
    const mr = build({}, {}, 'mr');
    expect(mr.footer).toContain(formatDayMonthYear(TODAY, 'mr'));
    expect(mr.footer).toContain('ध्येय');
    expect(mr.footer).not.toMatch(/Dhyey/);
  });
});

describe('reportDoc: the stats', () => {
  it('gives the goals card figures in order, each worded as the screen words them', () => {
    const doc = build({ weights: [{ date: '2026-10-02', kg: 82.4 }, { date: '2026-10-28', kg: 81.8 }] });
    expect(doc.stats.map((s) => s.id)).toEqual(['meals', 'perfect', 'kcal', 'protein', 'water', 'walk', 'jobs', 'weight']);
    const by = byId(doc.stats);
    expect(by.meals).toMatchObject({ label: 'Meals', value: '21 of 31', sub: 'full days' });
    expect(by.perfect).toMatchObject({ label: 'Perfect days', value: '5', sub: 'meals, routine and water all done' });
    expect(by.kcal).toMatchObject({ label: 'Calories', value: '1,700 kcal', sub: 'avg a day · goal 1,760' });
    expect(by.protein).toMatchObject({ label: 'Protein', value: '90 g', sub: 'avg a day · goal 112 g' });
    expect(by.water).toMatchObject({ label: 'Water', value: '21 of 31', sub: 'days the goal was met' });
    expect(by.walk).toMatchObject({ label: 'Walk', value: '630 min', sub: 'goal met on 21 days' });
    expect(by.jobs).toMatchObject({ label: 'Routine', value: '73 of 93', sub: 'jobs · 7h 50m' });
    expect(by.weight).toMatchObject({ label: 'Weight', value: '−0.6 kg', sub: '82.4 → 81.8' });
  });

  it('words the walk goal met on one day in the singular, and the jobs without a time when none was spent', () => {
    const inp = inputOf({ shape: (d) => ({ walkMin: d === '2026-10-02' ? 30 : 0, jobs: { done: 3, total: 3, minutes: 0 } }) });
    const by = byId(statLines(periodReport(OCT, inp), null, GOALS, makeT('en'), false));
    expect(by.walk.sub).toBe('goal met on 1 day');
    expect(by.jobs.sub).toBe('jobs');
  });

  it('gives a bar for a goal and none for a plain number', () => {
    const by = byId(build().stats);
    expect(by.meals.bar).toBeCloseTo(21 / 31);
    expect(by.kcal.bar).toBeCloseTo(1700 / 1760);
    expect(by.water.bar).toBeCloseTo(21 / 31);
    expect(by.walk.bar).toBeCloseTo(21 / 31);
    expect(by.jobs.bar).toBeCloseTo(73 / 93);
    expect(by.perfect.bar).toBeNull();
    const over = byId(statLines(periodReport(OCT, inputOf({ shape: () => ({ kcal: 5000 }) })), null, GOALS, makeT('en'), false));
    expect(over.kcal.bar).toBe(1);
  });

  it('puts each count against the month before in words that are good when it rose', () => {
    // September: 10 full days of 30, none perfect, 10 days of water, 100 minutes walked, 30 of 90 jobs.
    const by = byId(build().stats);
    expect(by.meals.delta).toEqual({ text: '11 more than last month', good: true });
    expect(by.perfect.delta).toEqual({ text: '5 more than last month', good: true });
    expect(by.water.delta).toEqual({ text: '11 more than last month', good: true });
    expect(by.walk.delta).toEqual({ text: '530 min more than last month', good: true });
    expect(by.jobs.delta).toEqual({ text: '43 more than last month', good: true });
  });

  it('says a fall or no change plainly, never as good', () => {
    const inp = inputOf({ shape: (d) => (d.startsWith('2026-10') ? { mark: 'missing', waterMl: 0, walkMin: 0 } : {}) });
    const report = periodReport(OCT, inp);
    const fell = byId(statLines(report, compareReport(report, inp), GOALS, makeT('en'), false));
    expect(fell.meals.delta).toEqual({ text: '10 fewer than last month', good: false });
    expect(fell.water.delta).toEqual({ text: '10 fewer than last month', good: false });
    // Two weeks that are alike.
    const alike = inputOf({ shape: () => ({ mark: 'full', waterMl: 2500 }) });
    const week = periodReport(periodOf('week', '2026-10-14'), alike);
    expect(byId(statLines(week, compareReport(week, alike), GOALS, makeT('en'), false)).meals.delta).toEqual({ text: 'Same as last week', good: false });
  });

  it('gives calories, protein and weight as plain numbers with no good or bad, so more is never praised', () => {
    const doc = build({ weights: [{ date: '2026-09-02', kg: 83 }, { date: '2026-09-28', kg: 82.8 }, { date: '2026-10-02', kg: 82.4 }, { date: '2026-10-28', kg: 81.8 }] });
    const by = byId(doc.stats);
    expect(by.kcal.delta).toEqual({ text: 'Last month: 1,500 kcal', good: false });
    expect(by.protein.delta).toEqual({ text: 'Last month: 70 g', good: false });
    expect(by.weight.delta).toEqual({ text: 'Last month: −0.2 kg', good: false });
    for (const id of ['kcal', 'protein', 'weight']) expect(by[id].delta?.good, id).toBe(false);
  });

  it('has no comparison in the first month', () => {
    expect(build({ since: '2026-10-01' }).stats.every((s) => s.delta === null)).toBe(true);
  });

  it('leaves out a routine with no job due, a weight with fewer than two weigh-ins and a walk with no goal, and has at most eight', () => {
    const doc = build({ shape: () => ({ jobs: { done: 0, total: 0, minutes: 0 } }), goals: { ...GOALS, walkMin: 0 } });
    expect(doc.stats.map((s) => s.id)).toEqual(['meals', 'perfect', 'kcal', 'protein', 'water']);
    expect(build({ weights: [{ date: '2026-10-02', kg: 82.4 }, { date: '2026-10-28', kg: 81.8 }] }).stats).toHaveLength(8);
  });

  it('shows a dash for the calories when no day is complete, with the goal alone', () => {
    const inp = inputOf({ shape: () => ({ mark: 'missing' }) });
    const doc = reportDoc({ report: periodReport(OCT, inp), before: null, goals: GOALS, name: '', lang: 'en', medalsHeld: 0, madeOn: TODAY });
    expect(byId(doc.stats).kcal).toMatchObject({ value: '–', sub: 'goal 1,760', bar: null });
  });

  it('speaks Marathi: the words are the Marathi ones, and every number is in Latin digits', () => {
    const doc = build({}, {}, 'mr');
    expect(doc.lang).toBe('mr');
    expect(doc.title).toBe(tr('mr', 'rep_pdf_title'));
    expect(doc.title).not.toBe('Monthly report');
    expect(doc.month).toMatch(/2026/);
    expect(doc.summary).not.toMatch(/full days|perfect days|best day/);
    expect(doc.stats[0].label).toBe(tr('mr', 'rep_stat_meals'));
    expect(doc.stats[0].delta?.text).toContain('मागच्या महिन्यापेक्षा');
    expect(doc.table.head[0]).toBe(tr('mr', 'rep_col_date'));
    const all = [doc.summary, doc.month, doc.footer, ...doc.stats.flatMap((s) => [s.value, s.sub ?? '', s.delta?.text ?? '']), ...doc.medals, ...doc.table.rows.flatMap((r) => r.cells)];
    expect(all.filter((s) => /[०-९]/.test(s))).toEqual([]);
  });
});

describe('reportDoc: the chart and the table', () => {
  it('has one bar a day, a label on the 1st and every fifth day, the goal and a caption', () => {
    const { chart } = build();
    expect(chart.bars).toHaveLength(31);
    expect(chart.bars.map((b) => b.label).filter((l) => l !== '')).toEqual(['1', '5', '10', '15', '20', '25', '30']);
    expect(chart.bars[0]).toEqual({ label: '1', value: 1700 });
    expect(chart.bars[25].value).toBe(400);
    expect(chart.goal).toBe(1760);
    expect(chart.caption).toBe('Calories a day · the dashed line is your goal, 1,760 kcal');
  });

  it('draws a day that does not count as a bar of nothing', () => {
    // 4 Oct 2026 is a Sunday.
    const { chart } = build({ offDays: [0] });
    expect(chart.bars[3].value).toBe(0);
    expect(chart.bars[2].value).toBe(1700);
  });

  it('has a head and a row a day, each cell already worded', () => {
    const { table } = build();
    expect(table.head).toEqual(['Date', 'kcal', 'Protein', 'Water', 'Walk', 'Jobs', 'Record']);
    expect(table.rows).toHaveLength(31);
    expect(table.rows[0]).toEqual({ cells: [formatDayLabel('2026-10-01', 'en'), '1,700', '90 g', '2.5 L', '30 min', '3/3', 'Full'], perfect: false, dim: false });
    expect(table.rows[2].perfect).toBe(true);
    expect(table.rows[24].cells.slice(1)).toEqual(['400', '20 g', '0.5 L', '0 min', '1/3', 'Partly logged']);
  });

  it('shows a dash for a free day, a day before the start and a day to come, in a dim row', () => {
    const free = build({ offDays: [0] }).table.rows[3];
    expect(free).toEqual({ cells: [formatDayLabel('2026-10-04', 'en'), '–', '–', '–', '–', '–', 'Free day'], perfect: false, dim: true });
    const before = build({ since: '2026-10-05' }).table.rows[0];
    expect(before.cells.slice(1)).toEqual(['–', '–', '–', '–', '–', '–']);
    expect(before.dim).toBe(true);
    const today = '2026-10-03';
    const inp = inputOf({ today });
    const running = reportDoc({ report: periodReport(OCT, inp), before: null, goals: GOALS, name: '', lang: 'en', medalsHeld: 0, madeOn: today });
    expect(running.table.rows[3].cells.slice(1)).toEqual(['–', '–', '–', '–', '–', '–']);
    expect(running.table.rows[3].dim).toBe(true);
    expect(running.table.rows[2].dim).toBe(false);
  });

  it('shows a dash where a day counts but holds nothing: no calories logged, no job due', () => {
    const doc = build({ shape: () => ({ kcal: 0, protein: 0, jobs: { done: 0, total: 0, minutes: 0 } }) });
    expect(doc.table.rows[0].cells.slice(1, 6)).toEqual(['–', '–', '2.5 L', '30 min', '–']);
  });

  it('never marks a day that does not count as perfect', () => {
    const doc = build({ shape: () => ({ perfect: true, counts: false }) });
    expect(doc.table.rows.some((r) => r.perfect)).toBe(false);
  });
});

describe('reportDoc: the medals', () => {
  it('says the perfect-week medals of the month and the medals held', () => {
    const doc = build({ perfectWeekMondays: ['2026-10-05', '2026-10-12'] });
    expect(doc.medals).toEqual(['Perfect-week medals this month: 2', 'Medals held: 9']);
  });

  it('leaves out a line with nothing to say', () => {
    expect(build({}, { medalsHeld: 0 }).medals).toEqual([]);
    expect(build({ perfectWeekMondays: ['2026-10-05'] }, { medalsHeld: 0 }).medals).toEqual(['Perfect-week medals this month: 1']);
    expect(build({}, { medalsHeld: 4 }).medals).toEqual(['Medals held: 4']);
  });
});

describe('markWord', () => {
  it('words each mark, short enough for a table cell, a free day as everywhere and a day that is not judged as a dash', () => {
    const t = makeT('en');
    expect(markWord('full', t)).toBe('Full');
    expect(markWord('skipped', t)).toBe('Skipped');
    expect(markWord('missing', t)).toBe('Partly logged');
    expect(markWord('today', t)).toBe('Today');
    expect(markWord('unplanned', t)).toBe('No plan');
    expect(markWord('off', t)).toBe('Free day');
    expect(markWord('none', t)).toBe('–');
    expect(markWord('planned', t)).toBe('–');
  });
});

describe('reportColors', () => {
  it('reads the daylight colours of the palette', () => {
    for (const id of PALETTE_IDS) {
      const p = PALETTE_SETS[id].light;
      expect(reportColors(id), id).toEqual({ accent: p.accent, accentSoft: p.accentSoft, text: p.text, textDim: p.textDim, textFaint: p.textFaint, border: p.border, gold: p.gold, goldSoft: p.goldSoft, card: p.card, bg: p.bg, white: p.white });
    }
  });
});

describe('the report words', () => {
  it('has Marathi and Hindi words for every rep_ key, none left to fall back to English', () => {
    const rep = keysOf('en').filter((k) => k.startsWith('rep_'));
    expect(rep.length).toBeGreaterThan(30);
    // Units that are the same in every language.
    const SAME = ['rep_col_kcal'];
    for (const lang of ['mr', 'hi'] as const) {
      expect(rep.filter((k) => !SAME.includes(k) && tr(lang, k) === tr('en', k)), lang).toEqual([]);
    }
  });
});
