import { describe, expect, it } from 'vitest';
import { keysOf, makeT } from '../../i18n';
import { formatDayLong, formatDayMonth, formatDayMonthYear, formatMonthYear } from '../date';
import { periodOf, periodReport, type DayFacts, type ReportInput } from '../report';
import { calorieBars, dayStats, dayWord, headline, medalLine, periodName, reportView, stepAnchor } from '../reportScreen';
import type { DayScore } from '../teacher';

// Monday 2 November 2026, and the user started on 1 October.
const TODAY = '2026-11-02';
const SINCE = '2026-10-01';
const GOALS = { kcal: 1760, protein: 112, waterMl: 2500, walkMin: 30 };
const en = makeT('en');
const mr = makeT('mr');

const score = (p: Partial<DayScore> = {}): DayScore => ({ meals: { done: 0, of: 0 }, jobs: { done: 0, of: 0, next: null }, water: { ml: 0, goal: 0 }, walk: { min: 0, goal: 0 }, ...p });
const fact = (date: string, p: Partial<DayFacts> = {}): DayFacts => ({
  date,
  counts: date <= TODAY && date >= SINCE,
  mark: 'full',
  perfect: false,
  kcal: 0,
  protein: 0,
  waterMl: 0,
  walkMin: 0,
  jobs: { done: 0, total: 0, minutes: 0 },
  score: score(),
  ...p,
});
const inputOf = (by: Record<string, Partial<DayFacts>> = {}, over: Partial<ReportInput> = {}): ReportInput => ({
  today: TODAY,
  nowMinutes: 600,
  since: SINCE,
  offDays: [],
  goals: GOALS,
  factsOn: (d) => fact(d, by[d]),
  weights: [],
  perfectWeekMondays: [],
  ...over,
});

describe('reportView: the route\'s p and d', () => {
  it('opens on this week when there is nothing, or nothing it knows', () => {
    expect(reportView(undefined, undefined, TODAY, SINCE)).toEqual({ kind: 'week', anchor: TODAY });
    expect(reportView('year', 'soon', TODAY, SINCE)).toEqual({ kind: 'week', anchor: TODAY });
    expect(reportView('', '', TODAY, SINCE)).toEqual({ kind: 'week', anchor: TODAY });
    expect(reportView('Week', undefined, TODAY, SINCE).kind).toBe('week');
  });

  it('takes day, week or month, and the first of a list (a link may carry the name twice)', () => {
    expect(reportView('day', undefined, TODAY, SINCE).kind).toBe('day');
    expect(reportView('week', undefined, TODAY, SINCE).kind).toBe('week');
    expect(reportView('month', undefined, TODAY, SINCE).kind).toBe('month');
    expect(reportView(['month', 'day'], ['2026-10-14', '2026-10-15'], TODAY, SINCE)).toEqual({ kind: 'month', anchor: '2026-10-14' });
    expect(reportView([], [], TODAY, SINCE)).toEqual({ kind: 'week', anchor: TODAY });
  });

  it('keeps a date that is a real day between the start and today', () => {
    expect(reportView('week', '2026-10-12', TODAY, SINCE)).toEqual({ kind: 'week', anchor: '2026-10-12' });
    expect(reportView('day', SINCE, TODAY, SINCE).anchor).toBe(SINCE);
    expect(reportView('day', TODAY, TODAY, SINCE).anchor).toBe(TODAY);
  });

  it('a date after today is today, and one before the start is the start', () => {
    expect(reportView('week', '2026-11-20', TODAY, SINCE).anchor).toBe(TODAY);
    expect(reportView('month', '2027-01-01', TODAY, SINCE).anchor).toBe(TODAY);
    expect(reportView('week', '2026-09-14', TODAY, SINCE).anchor).toBe(SINCE);
    expect(reportView('day', '1999-01-01', TODAY, SINCE).anchor).toBe(SINCE);
  });

  it('a date that is not a day (2026-02-30, a word, a time) is today', () => {
    expect(reportView('day', '2026-02-30', TODAY, SINCE).anchor).toBe(TODAY);
    expect(reportView('day', '12/10/2026', TODAY, SINCE).anchor).toBe(TODAY);
    expect(reportView('day', '2026-10-12T10:00', TODAY, SINCE).anchor).toBe(TODAY);
  });

  it('a user who started today can open nothing but today', () => {
    expect(reportView('month', '2026-10-05', TODAY, TODAY).anchor).toBe(TODAY);
  });
});

describe('stepAnchor: the date a view opens on after a step', () => {
  const today = '2026-10-29';
  it('the end of the period stepped to, or today when that period is not over', () => {
    expect(stepAnchor(periodOf('week', today), -1, today)).toBe('2026-10-25');
    expect(stepAnchor(periodOf('week', '2026-10-20'), 1, today)).toBe(today);
    expect(stepAnchor(periodOf('week', '2026-10-13'), 1, today)).toBe('2026-10-25');
    expect(stepAnchor(periodOf('month', today), -1, today)).toBe('2026-09-30');
    expect(stepAnchor(periodOf('month', '2026-09-10'), 1, today)).toBe(today);
    expect(stepAnchor(periodOf('day', today), -1, today)).toBe('2026-10-28');
    expect(stepAnchor(periodOf('day', '2026-10-28'), 1, today)).toBe(today);
  });
});

describe('periodName', () => {
  it('a day: Today, Yesterday, or the day in full', () => {
    expect(periodName(periodOf('day', TODAY), TODAY, 'en', en)).toBe('Today');
    expect(periodName(periodOf('day', '2026-11-01'), TODAY, 'en', en)).toBe('Yesterday');
    expect(periodName(periodOf('day', '2026-10-30'), TODAY, 'en', en)).toBe(formatDayLong('2026-10-30', 'en'));
    expect(periodName(periodOf('day', TODAY), TODAY, 'mr', mr)).toBe('आज');
    expect(periodName(periodOf('day', '2026-11-01'), TODAY, 'mr', mr)).toBe('काल');
  });

  it('a week: This week, or its days from Monday to Sunday', () => {
    expect(periodName(periodOf('week', TODAY), TODAY, 'en', en)).toBe('This week');
    expect(periodName(periodOf('week', '2026-10-30'), TODAY, 'en', en)).toBe(`${formatDayMonth('2026-10-26', 'en')} – ${formatDayMonth('2026-11-01', 'en')}`);
    expect(periodName(periodOf('week', '2026-10-30'), '2026-11-04', 'en', en)).toBe(`${formatDayMonth('2026-10-26', 'en')} – ${formatDayMonth('2026-11-01', 'en')}`);
    expect(periodName(periodOf('week', TODAY), TODAY, 'mr', mr)).toBe('हा आठवडा');
  });

  it('a week not in this year says the year at its end, and one that turns the year says both', () => {
    expect(periodName(periodOf('week', '2025-06-10'), TODAY, 'en', en)).toBe(`${formatDayMonth('2025-06-09', 'en')} – ${formatDayMonthYear('2025-06-15', 'en')}`);
    expect(periodName(periodOf('week', '2026-12-31'), '2027-01-20', 'en', en)).toBe(`${formatDayMonthYear('2026-12-28', 'en')} – ${formatDayMonthYear('2027-01-03', 'en')}`);
  });

  it('a month: This month, or the month and year', () => {
    expect(periodName(periodOf('month', TODAY), TODAY, 'en', en)).toBe('This month');
    expect(periodName(periodOf('month', '2026-10-15'), TODAY, 'en', en)).toBe(formatMonthYear('2026-10-01', 'en'));
    expect(periodName(periodOf('month', '2026-10-15'), TODAY, 'en', en)).toContain('October 2026');
    expect(periodName(periodOf('month', TODAY), TODAY, 'mr', mr)).toBe('हा महिना');
  });
});

describe('dayWord: the day\'s mark in words', () => {
  it('a full, skipped, running, unplanned and free day, and one before the start or still to come', () => {
    expect(dayWord(fact('2026-10-30', { mark: 'full' }), en)).toBe('All meals logged');
    expect(dayWord(fact('2026-10-30', { mark: 'skipped' }), en)).toBe('All meals skipped');
    expect(dayWord(fact('2026-11-02', { mark: 'today' }), en)).toBe('Today, still going');
    expect(dayWord(fact('2026-10-30', { mark: 'unplanned' }), en)).toBe('Nothing planned');
    expect(dayWord(fact('2026-10-30', { mark: 'off', counts: false }), en)).toBe('Free day');
    expect(dayWord(fact('2026-11-05', { mark: 'planned', counts: false }), en)).toBe('This day has not started yet');
    expect(dayWord(fact('2026-09-20', { mark: 'none', counts: false }), en)).toBe('Before you started');
  });

  it('a day with meals missing is partly logged when something was, and empty when nothing was', () => {
    expect(dayWord(fact('2026-10-30', { mark: 'missing', kcal: 600 }), en)).toBe('Some meals logged');
    expect(dayWord(fact('2026-10-30', { mark: 'missing', score: score({ meals: { done: 1, of: 4 } }) }), en)).toBe('Some meals logged');
    expect(dayWord(fact('2026-10-30', { mark: 'missing' }), en)).toBe('No meals logged');
  });

  it('is said in Marathi', () => {
    expect(dayWord(fact('2026-10-30', { mark: 'off', counts: false }), mr)).toBe('मोकळा दिवस');
    expect(dayWord(fact('2026-10-30', { mark: 'missing' }), mr)).toBe(mr('rep_day_empty'));
  });
});

describe('dayStats: the goals card for one day', () => {
  const day = fact('2026-11-01', {
    kcal: 1640,
    protein: 70,
    waterMl: 2000,
    walkMin: 25,
    jobs: { done: 2, total: 3, minutes: 45 },
    score: score({ meals: { done: 3, of: 4 }, jobs: { done: 2, of: 3, next: 'Read' } }),
  });
  const before = fact('2026-10-31', {
    kcal: 1500,
    protein: 80,
    waterMl: 2500,
    walkMin: 30,
    jobs: { done: 3, total: 3, minutes: 60 },
    score: score({ meals: { done: 4, of: 4 }, jobs: { done: 3, of: 3, next: null } }),
  });
  const weights = [{ date: '2026-11-01', kg: 81.84 }, { date: '2026-10-25', kg: 82.4 }];

  it('each row has its value, what the goal is, how far toward it, and no word of colour for calories, protein or water', () => {
    const rows = dayStats(day, before, GOALS, weights, en);
    expect(rows.map((r) => r.id)).toEqual(['meals', 'kcal', 'protein', 'water', 'walk', 'jobs', 'weight']);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.meals).toMatchObject({ label: 'Meals', value: '3 of 4', sub: 'logged', bar: 0.75 });
    expect(byId.kcal).toMatchObject({ label: 'Calories', value: '1,640 kcal', sub: 'goal 1,760' });
    expect(byId.kcal.bar).toBeCloseTo(1640 / 1760);
    expect(byId.protein).toMatchObject({ label: 'Protein', value: '70 g', sub: 'goal 112 g' });
    expect(byId.protein.bar).toBeCloseTo(70 / 112);
    expect(byId.water).toMatchObject({ label: 'Water', value: '2.0 L', sub: 'goal 2.5 L', bar: 0.8 });
    expect(byId.walk).toMatchObject({ value: '25 min', sub: 'goal 30 min' });
    expect(byId.walk.bar).toBeCloseTo(25 / 30);
    expect(byId.jobs).toMatchObject({ label: 'Routine', value: '2 of 3' });
    expect(byId.jobs.sub).toContain('jobs');
    expect(byId.weight).toMatchObject({ label: 'Weight', value: '81.8 kg', sub: null, bar: null, delta: null });
  });

  it('is compared with the day before: a rise in a count in the good colour, a fall plainly, calories, protein and water as plain numbers', () => {
    const byId = Object.fromEntries(dayStats(day, before, GOALS, weights, en).map((r) => [r.id, r]));
    expect(byId.meals.delta).toEqual({ text: '1 fewer than the day before', good: false });
    expect(byId.kcal.delta).toEqual({ text: 'The day before: 1,500 kcal', good: false });
    expect(byId.protein.delta).toEqual({ text: 'The day before: 80 g', good: false });
    expect(byId.water.delta).toEqual({ text: 'The day before: 2.5 L', good: false });
    expect(byId.walk.delta).toEqual({ text: '5 min fewer than the day before', good: false });
    expect(byId.jobs.delta).toEqual({ text: '1 fewer than the day before', good: false });
    const up = Object.fromEntries(dayStats(before, day, GOALS, [], en).map((r) => [r.id, r]));
    expect(up.meals.delta).toEqual({ text: '1 more than the day before', good: true });
    expect(up.walk.delta).toEqual({ text: '5 min more than the day before', good: true });
    expect(up.jobs.delta).toEqual({ text: '1 more than the day before', good: true });
    expect(up.kcal.delta?.good).toBe(false);
    expect(up.water.delta?.good).toBe(false);
  });

  it('has no comparison line without an earlier day, or where either day has nothing of that figure', () => {
    for (const r of dayStats(day, null, GOALS, weights, en)) expect(r.delta).toBeNull();
    const quiet = fact('2026-10-31', { kcal: 0, protein: 0, waterMl: 0, walkMin: 0 });
    const byId = Object.fromEntries(dayStats(fact('2026-11-01', { walkMin: 0 }), quiet, GOALS, [], en).map((r) => [r.id, r]));
    expect(byId.kcal.delta).toBeNull();
    expect(byId.protein.delta).toBeNull();
    expect(byId.water.delta).toBeNull();
    expect(byId.walk.delta).toBeNull();
  });

  it('leaves out a row with nothing to say: no meal due, no job, no water or walk goal, no weigh-in that day', () => {
    const plain = fact('2026-11-01', { kcal: 900 });
    expect(dayStats(plain, null, { ...GOALS, waterMl: 0, walkMin: 0 }, [], en).map((r) => r.id)).toEqual(['kcal', 'protein']);
    expect(dayStats(day, null, GOALS, [{ date: '2026-10-31', kg: 82 }], en).map((r) => r.id)).not.toContain('weight');
  });

  it('shows a dash for calories and protein when nothing was logged', () => {
    const byId = Object.fromEntries(dayStats(fact('2026-11-01'), null, GOALS, [], en).map((r) => [r.id, r]));
    expect(byId.kcal.value).toBe('–');
    expect(byId.kcal.bar).toBeNull();
    expect(byId.protein.value).toBe('–');
  });

  it('gives no rows for a day that does not count', () => {
    expect(dayStats(fact('2026-11-05', { counts: false, mark: 'planned' }), null, GOALS, weights, en)).toEqual([]);
    expect(dayStats(fact('2026-10-30', { counts: false, mark: 'off' }), null, GOALS, weights, en)).toEqual([]);
  });

  it('is worded in Marathi', () => {
    const rows = dayStats(day, before, GOALS, [], mr);
    expect(rows.find((r) => r.id === 'meals')?.sub).toBe(mr('rep_logged'));
    expect(rows.find((r) => r.id === 'kcal')?.delta?.text).toContain('1,500');
    expect(rows.find((r) => r.id === 'kcal')?.delta?.text).not.toMatch(/The day before/);
  });
});

describe('headline', () => {
  const week = periodOf('week', TODAY);

  it('a finished week: the full days over the days that count, the perfect days and the best day', () => {
    const lastWeek = periodOf('week', '2026-10-28');
    const r = periodReport(
      lastWeek,
      inputOf({
        '2026-10-26': { mark: 'full', perfect: true, score: score({ meals: { done: 4, of: 4 }, jobs: { done: 3, of: 3, next: null }, water: { ml: 2500, goal: 2500 } }) },
        '2026-10-27': { mark: 'full', score: score({ meals: { done: 3, of: 4 }, jobs: { done: 1, of: 3, next: null } }) },
        '2026-10-28': { mark: 'missing' },
        '2026-10-29': { mark: 'full' },
        '2026-10-30': { mark: 'full', perfect: true, score: score({ meals: { done: 4, of: 4 }, jobs: { done: 3, of: 3, next: null }, water: { ml: 2500, goal: 2500 } }) },
        '2026-10-31': { mark: 'full' },
        '2026-11-01': { mark: 'full' },
      }),
    );
    const h = headline(r, 'en', en, false);
    expect(h.big).toBe('6 / 7');
    expect(h.label).toBe('full days');
    expect(h.spoken).toBe('6 of 7 full days');
    expect(h.perfect).toBe('2 perfect days');
    expect(h.best).toEqual({ text: `Best day: ${formatDayLong(r.best!.date, 'en')} · 8 of 8 done`, perfect: true });
  });

  it('a running period says so far, and one perfect day is said in the singular', () => {
    const r = periodReport(week, inputOf({ [TODAY]: { mark: 'today', perfect: true } }));
    const h = headline(r, 'en', en, true);
    expect(h.big).toBe('0 / 1');
    expect(h.label).toBe('full days so far');
    expect(h.spoken).toBe('0 of 1 full day so far');
    expect(h.perfect).toBe('1 perfect day');
  });

  it('has no perfect line and no best day when there are none', () => {
    const r = periodReport(periodOf('week', '2026-10-28'), inputOf({}));
    const h = headline(r, 'en', en, false);
    expect(h.perfect).toBeNull();
    expect(h.best).toBeNull();
  });

  it('a best day that was not perfect is not a star', () => {
    const r = periodReport(periodOf('week', '2026-10-28'), inputOf({ '2026-10-29': { score: score({ meals: { done: 3, of: 4 } }) } }));
    expect(headline(r, 'en', en, false).best).toEqual({ text: `Best day: ${formatDayLong('2026-10-29', 'en')} · 3 of 4 done`, perfect: false });
  });

  it('is said in Marathi, with Latin digits', () => {
    const r = periodReport(periodOf('week', '2026-10-28'), inputOf({ '2026-10-29': { score: score({ meals: { done: 3, of: 4 } }) } }));
    const h = headline(r, 'mr', mr, false);
    expect(h.big).toBe('7 / 7');
    expect(h.label).toBe(mr('rep_sub_full'));
    expect(h.spoken).toBe(mr('rep_sum_full').replace('{n}', '7').replace('{of}', '7'));
    expect(h.best?.text).toContain('3');
    expect(h.best?.text).not.toMatch(/Best day/);
  });
});

describe('medalLine', () => {
  const month = periodOf('month', '2026-10-15');
  it('words the perfect-week medals as medals, only when there are any', () => {
    expect(medalLine(periodReport(month, inputOf({}, { perfectWeekMondays: ['2026-10-05', '2026-10-05', '2026-10-12'] })), en)).toBe('Perfect-week medals: 3');
    expect(medalLine(periodReport(month, inputOf({}, { perfectWeekMondays: ['2026-09-28'] })), en)).toBeNull();
    expect(medalLine(periodReport(month, inputOf({})), en)).toBeNull();
  });
});

describe('calorieBars', () => {
  it('a week: a bar a day, the weekday under it, nothing for a day that does not count', () => {
    const w = periodReport(periodOf('week', TODAY), inputOf({ '2026-11-02': { kcal: 1500, mark: 'today' } }));
    const c = calorieBars(w, en);
    expect(c.bars).toEqual([
      { date: '2026-11-02', value: 1500 },
      { date: '2026-11-03', value: 0 },
      { date: '2026-11-04', value: 0 },
      { date: '2026-11-05', value: 0 },
      { date: '2026-11-06', value: 0 },
      { date: '2026-11-07', value: 0 },
      { date: '2026-11-08', value: 0 },
    ]);
    expect(c.labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('a month: the day of the month on the 1st and every fifth day, as the PDF does', () => {
    const m = periodReport(periodOf('month', '2026-10-15'), inputOf({ '2026-10-14': { kcal: 1700 } }));
    const c = calorieBars(m, en);
    expect(c.bars).toHaveLength(31);
    expect(c.bars[13]).toEqual({ date: '2026-10-14', value: 1700 });
    expect(c.labels).toHaveLength(31);
    expect(c.labels.filter((l) => l !== '')).toEqual(['1', '5', '10', '15', '20', '25', '30']);
  });

  it('a day after today is a bar of nothing even if meals were somehow logged', () => {
    const m = periodReport(periodOf('month', '2026-11-10'), inputOf({ '2026-11-05': { kcal: 900 }, '2026-11-02': { kcal: 800 } }));
    const c = calorieBars(m, en);
    expect(c.bars[4].value).toBe(0);
    expect(c.bars[1].value).toBe(800);
  });
});

describe('the words', () => {
  it('every rep_ key the screen uses has its own Marathi and Hindi words', () => {
    const own = (lang: 'mr' | 'hi') => new Set(keysOf(lang));
    for (const key of ['rep_title', 'rep_day', 'rep_this_week', 'rep_this_month', 'rep_prev_day', 'rep_next_day', 'rep_best', 'rep_day_partial', 'rep_day_empty', 'rep_day_future', 'rep_none_week', 'rep_logged', 'rep_medals', 'rep_pdf_button', 'rep_pdf_preparing', 'rep_pdf_share', 'rep_pdf_save', 'rep_pdf_error', 'rep_all_charts']) {
      expect(own('mr').has(key), `mr ${key}`).toBe(true);
      expect(own('hi').has(key), `hi ${key}`).toBe(true);
    }
  });
});
