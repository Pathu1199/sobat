import { describe, expect, it } from 'vitest';
import { addDays } from '../date';
import type { DayRecord } from '../record';
import { compareReport, compareSpan, countedDates, dayFacts, delta, periodOf, periodReport, periodSteps, shiftPeriod, type DayFacts, type ReportInput } from '../report';
import { completeIntake, fullDays } from '../progress';
import type { DayScore } from '../teacher';

// Thursday 29 October 2026; the user started on 1 October. The week is 26 Oct to 1 Nov.
const TODAY = '2026-10-29';
const SINCE = '2026-10-01';

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
const input = (by: Record<string, Partial<DayFacts>> = {}, over: Partial<ReportInput> = {}): ReportInput => ({
  today: TODAY,
  nowMinutes: 600,
  since: SINCE,
  offDays: [],
  goals: { kcal: 1800, protein: 100, waterMl: 2500, walkMin: 30 },
  factsOn: (d) => fact(d, by[d]),
  weights: [],
  perfectWeekMondays: [],
  ...over,
});
const week = periodOf('week', TODAY);

describe('periodOf and shiftPeriod', () => {
  it('a day is itself, a week runs Monday to Sunday, a month the 1st to the last day', () => {
    expect(periodOf('day', '2026-10-29')).toEqual({ kind: 'day', start: '2026-10-29', end: '2026-10-29', dates: ['2026-10-29'] });
    const w = periodOf('week', '2026-10-29');
    expect(w.start).toBe('2026-10-26');
    expect(w.end).toBe('2026-11-01');
    expect(w.dates).toHaveLength(7);
    const m = periodOf('month', '2026-10-15');
    expect(m.start).toBe('2026-10-01');
    expect(m.end).toBe('2026-10-31');
    expect(m.dates).toHaveLength(31);
  });

  it('a week across the turn of a year, and a leap February', () => {
    const w = periodOf('week', '2026-12-31');
    expect(w.start).toBe('2026-12-28');
    expect(w.end).toBe('2027-01-03');
    expect(w.dates[3]).toBe('2026-12-31');
    expect(w.dates[4]).toBe('2027-01-01');
    expect(periodOf('month', '2028-02-10').dates).toHaveLength(29);
    expect(periodOf('month', '2027-02-10').dates).toHaveLength(28);
    expect(periodOf('month', '2026-12-31').end).toBe('2026-12-31');
  });

  it('steps a day, a week and a month back and forward, across month and year ends', () => {
    expect(shiftPeriod(periodOf('day', '2026-11-01'), -1).start).toBe('2026-10-31');
    expect(shiftPeriod(periodOf('day', '2026-12-31'), 1).start).toBe('2027-01-01');
    const w = periodOf('week', '2026-12-30');
    expect(shiftPeriod(w, -1).start).toBe('2026-12-21');
    expect(shiftPeriod(w, 1).start).toBe('2027-01-04');
    expect(shiftPeriod(w, 1).end).toBe('2027-01-10');
    expect(shiftPeriod(periodOf('month', '2027-01-20'), -1)).toEqual(periodOf('month', '2026-12-01'));
    expect(shiftPeriod(periodOf('month', '2026-12-05'), 1).start).toBe('2027-01-01');
    expect(shiftPeriod(periodOf('month', '2026-03-31'), -1).end).toBe('2026-02-28');
  });
});

describe('periodSteps', () => {
  it('goes back while the period before it ends on or after the day the user started', () => {
    // Started Wednesday 28 October: the week of 26 October is the first, and there is nothing before it.
    const since = '2026-10-28';
    expect(periodSteps(periodOf('week', '2026-10-28'), '2026-11-02', since).prev).toBe(false);
    expect(periodSteps(periodOf('week', '2026-11-02'), '2026-11-02', since).prev).toBe(true);
    expect(periodSteps(periodOf('month', '2026-10-28'), '2026-11-02', '2026-10-15').prev).toBe(false);
    expect(periodSteps(periodOf('month', '2026-11-02'), '2026-11-02', '2026-10-15').prev).toBe(true);
    expect(periodSteps(periodOf('day', '2026-10-28'), '2026-10-30', since).prev).toBe(false);
    expect(periodSteps(periodOf('day', '2026-10-29'), '2026-10-30', since).prev).toBe(true);
  });

  it('goes forward while the period ends before today', () => {
    expect(periodSteps(periodOf('week', '2026-10-28'), '2026-11-02', '2026-10-01').next).toBe(true);
    expect(periodSteps(periodOf('week', '2026-11-02'), '2026-11-02', '2026-10-01').next).toBe(false);
    expect(periodSteps(periodOf('month', '2026-10-28'), '2026-11-02', '2026-10-01').next).toBe(true);
    expect(periodSteps(periodOf('month', '2026-11-02'), '2026-11-02', '2026-10-01').next).toBe(false);
    expect(periodSteps(periodOf('day', '2026-11-01'), '2026-11-02', '2026-10-01').next).toBe(true);
    expect(periodSteps(periodOf('day', '2026-11-02'), '2026-11-02', '2026-10-01').next).toBe(false);
    // A week that ends today holds it: nothing after it yet.
    expect(periodSteps(periodOf('week', '2026-11-01'), '2026-11-01', '2026-10-01').next).toBe(false);
  });

  it('a user who started today has nowhere to go back', () => {
    expect(periodSteps(periodOf('week', '2026-11-02'), '2026-11-02', '2026-11-02')).toEqual({ prev: false, next: false });
    expect(periodSteps(periodOf('day', '2026-11-02'), '2026-11-02', '2026-11-02')).toEqual({ prev: false, next: false });
  });
});

describe('compareSpan', () => {
  it('a running week is compared with last week up to the same weekday', () => {
    expect(compareSpan(periodOf('week', '2026-10-28'), '2026-10-28')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(compareSpan(periodOf('week', '2026-11-02'), '2026-11-02')).toEqual(['2026-10-26']);
  });

  it('a week that ends today, or is over, is compared with the whole week before', () => {
    const whole = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
    expect(compareSpan(periodOf('week', '2026-10-28'), '2026-11-01')).toEqual(whole);
    expect(compareSpan(periodOf('week', '2026-10-28'), '2026-11-04')).toEqual(whole);
  });

  it('a running month is compared with the same days of last month', () => {
    const span = compareSpan(periodOf('month', '2026-11-12'), '2026-11-12');
    expect(span).toHaveLength(12);
    expect(span[0]).toBe('2026-10-01');
    expect(span[11]).toBe('2026-10-12');
  });

  it('a month that is over is compared with the whole month before', () => {
    const span = compareSpan(periodOf('month', '2026-11-12'), '2026-12-05');
    expect(span).toHaveLength(31);
    expect(span[0]).toBe('2026-10-01');
    expect(span[30]).toBe('2026-10-31');
  });

  it('the 31st is compared with the whole of a 30-day month, February included', () => {
    const sep = compareSpan(periodOf('month', '2026-10-31'), '2026-10-31');
    expect(sep).toHaveLength(30);
    expect(sep[29]).toBe('2026-09-30');
    const feb = compareSpan(periodOf('month', '2027-03-31'), '2027-03-31');
    expect(feb).toHaveLength(28);
    expect(feb[27]).toBe('2027-02-28');
    const leap = compareSpan(periodOf('month', '2028-03-30'), '2028-03-30');
    expect(leap).toHaveLength(29);
    expect(leap[28]).toBe('2028-02-29');
    // The 5th of March is the 1st to the 5th of February.
    expect(compareSpan(periodOf('month', '2027-03-05'), '2027-03-05')).toEqual(['2027-02-01', '2027-02-02', '2027-02-03', '2027-02-04', '2027-02-05']);
  });

  it('a running month in January is compared with December', () => {
    expect(compareSpan(periodOf('month', '2027-01-03'), '2027-01-03')).toEqual(['2026-12-01', '2026-12-02', '2026-12-03']);
  });

  it('a day is compared with the day before it, whatever today is', () => {
    expect(compareSpan(periodOf('day', '2026-10-29'), '2026-10-29')).toEqual(['2026-10-28']);
    expect(compareSpan(periodOf('day', '2026-11-01'), '2026-11-20')).toEqual(['2026-10-31']);
  });
});

describe('countedDates', () => {
  it('keeps the dates from the start to today that are not free days', () => {
    // Saturday 24 Oct to Monday 2 Nov; started Sunday 25th; today is Wednesday 28th.
    const dates = Array.from({ length: 10 }, (_, i) => addDays('2026-10-24', i));
    expect(countedDates(dates, '2026-10-28', '2026-10-25', [0])).toEqual(['2026-10-26', '2026-10-27', '2026-10-28']);
    expect(countedDates(dates, '2026-10-28', '2026-10-25', [])).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
    // Tuesdays free.
    expect(countedDates(dates, '2026-10-28', '2026-10-25', [2])).toEqual(['2026-10-25', '2026-10-26', '2026-10-28']);
  });
});

describe('dayFacts', () => {
  const rec = (state: DayRecord['state'], nothingEaten = false): DayRecord => ({ state, fromPlan: false, nothingEaten });
  const base = {
    date: '2026-10-28',
    today: TODAY,
    since: SINCE,
    offDays: [] as number[],
    record: rec('full'),
    perfect: true,
    meals: [
      { date: '2026-10-28', kcal: 400, protein: 20 },
      { date: '2026-10-28', kcal: 650.5, protein: 35 },
      { date: '2026-10-27', kcal: 999, protein: 99 },
    ],
    waterMl: 2600,
    walkMin: 40,
    jobs: { done: 2, total: 3, minutes: 45 },
    score: score({ meals: { done: 2, of: 2 } }),
  };

  it('adds up that date\'s meals only, and reads the mark as the strip does', () => {
    const f = dayFacts(base);
    expect(f).toMatchObject({ date: '2026-10-28', counts: true, mark: 'full', perfect: true, kcal: 1050.5, protein: 55, waterMl: 2600, walkMin: 40, jobs: { done: 2, total: 3, minutes: 45 } });
    expect(f.score.meals).toEqual({ done: 2, of: 2 });
  });

  it('a day that counts is today or before, the start or after, and not a free day', () => {
    expect(dayFacts({ ...base, date: TODAY }).counts).toBe(true);
    expect(dayFacts({ ...base, date: '2026-10-30', record: rec('planned') })).toMatchObject({ counts: false, mark: 'planned' });
    expect(dayFacts({ ...base, date: '2026-09-30' })).toMatchObject({ counts: false, mark: 'none' });
    // 28 October 2026 is a Wednesday (3).
    expect(dayFacts({ ...base, offDays: [3], record: rec('off') })).toMatchObject({ counts: false, mark: 'off' });
  });

  it('a full day of meals all skipped is skipped, not full', () => {
    expect(dayFacts({ ...base, record: rec('full', true), meals: [] }).mark).toBe('skipped');
  });
});

describe('periodReport', () => {
  it('lists every date of the period in order and counts the days that count', () => {
    // Tuesday 27 is a free day; 30 Oct to 1 Nov are still to come.
    const r = periodReport(week, input({ '2026-10-27': { counts: false, mark: 'off' } }));
    expect(r.days.map((d) => d.date)).toEqual(week.dates);
    expect(r.period).toBe(week);
    expect(r.counted).toBe(3);
  });

  it('full days are the days marked full, of the days that count; a free or future day is not judged', () => {
    const r = periodReport(
      week,
      input({
        '2026-10-27': { counts: false, mark: 'off' },
        '2026-10-28': { mark: 'missing' },
        '2026-10-29': { mark: 'today' },
        // A future day that somehow says full is still not one that counts.
        '2026-10-30': { counts: false, mark: 'full' },
      }),
    );
    expect(r.full).toEqual({ n: 1, of: 3 });
  });

  it('counts perfect days among the days that count', () => {
    const r = periodReport(week, input({ '2026-10-26': { perfect: true }, '2026-10-28': { perfect: true }, '2026-10-31': { counts: false, perfect: true } }));
    expect(r.perfect).toBe(2);
  });

  it('water days are the days the goal was met, of the days that count', () => {
    const r = periodReport(
      week,
      input({
        '2026-10-26': { waterMl: 2500 },
        '2026-10-27': { waterMl: 2499 },
        '2026-10-28': { waterMl: 4000 },
        '2026-10-30': { counts: false, waterMl: 9000 },
      }),
    );
    expect(r.water).toEqual({ n: 2, of: 4 });
  });

  it('a water or walk goal of 0 is met on no day', () => {
    const r = periodReport(week, input({ '2026-10-26': { waterMl: 3000, walkMin: 30 } }, { goals: { kcal: 1800, protein: 100, waterMl: 0, walkMin: 0 } }));
    expect(r.water).toEqual({ n: 0, of: 4 });
    expect(r.walk.n).toBe(0);
    expect(r.walk.of).toBe(4);
  });

  it('walk is the minutes walked, and the days the goal was met', () => {
    const r = periodReport(week, input({ '2026-10-26': { walkMin: 30 }, '2026-10-27': { walkMin: 29 }, '2026-10-28': { walkMin: 45 } }));
    expect(r.walk).toEqual({ minutes: 104, n: 2, of: 4 });
  });

  it('the averages take the complete days only: full and skipped, never a day with meals missing or one still going', () => {
    const r = periodReport(
      week,
      input({
        '2026-10-26': { mark: 'full', kcal: 1800, protein: 90 },
        '2026-10-27': { mark: 'skipped', kcal: 1000, protein: 30 },
        '2026-10-28': { mark: 'missing', kcal: 500, protein: 10 },
        '2026-10-29': { mark: 'today', kcal: 900, protein: 40 },
        '2026-10-30': { counts: false, mark: 'planned', kcal: 2000, protein: 80 },
      }),
    );
    expect(r.avgKcal).toBe(1400);
    expect(r.avgProtein).toBe(60);
  });

  it('rounds the averages, and says null without a complete day', () => {
    const r = periodReport(week, input({ '2026-10-26': { kcal: 1801, protein: 81 }, '2026-10-27': { kcal: 1800, protein: 80 }, '2026-10-28': { mark: 'missing' }, '2026-10-29': { mark: 'today' } }));
    expect(r.avgKcal).toBe(1801);
    expect(r.avgProtein).toBe(81);
    const none = periodReport(week, input({ '2026-10-26': { mark: 'missing' }, '2026-10-27': { mark: 'missing' }, '2026-10-28': { mark: 'missing' }, '2026-10-29': { mark: 'today' } }));
    expect(none.avgKcal).toBeNull();
    expect(none.avgProtein).toBeNull();
  });

  it('walk minutes leave out a free day and a day still to come, however much they say', () => {
    const r = periodReport(
      week,
      input({
        '2026-10-26': { walkMin: 30 },
        '2026-10-27': { counts: false, mark: 'off', walkMin: 50 },
        '2026-10-28': { walkMin: 12 },
        '2026-10-30': { counts: false, mark: 'planned', walkMin: 40 },
      }),
    );
    expect(r.walk).toEqual({ minutes: 42, n: 1, of: 3 });
  });

  it('jobs add up what was done, what was due and the minutes, over the days that count', () => {
    const r = periodReport(
      week,
      input({
        '2026-10-26': { jobs: { done: 3, total: 3, minutes: 60 } },
        '2026-10-27': { jobs: { done: 1, total: 3, minutes: 20 } },
        '2026-10-28': { counts: false, mark: 'off', jobs: { done: 0, total: 3, minutes: 0 } },
        '2026-10-30': { counts: false, jobs: { done: 0, total: 3, minutes: 0 } },
      }),
    );
    expect(r.jobs).toEqual({ done: 4, due: 6, minutes: 80 });
  });

  it('jobs are null when none was due', () => {
    expect(periodReport(week, input()).jobs).toBeNull();
  });

  it('weight is the first and last weigh-in of the period, the change to a tenth, in date order', () => {
    const r = periodReport(
      week,
      input(
        {},
        {
          weights: [
            { date: '2026-10-29', kg: 81.8 },
            { date: '2026-10-25', kg: 90 },
            { date: '2026-10-26', kg: 82.4 },
            { date: '2026-10-28', kg: 82 },
            { date: '2026-11-02', kg: 70 },
          ],
        },
      ),
    );
    expect(r.weight).toEqual({ from: 82.4, to: 81.8, change: -0.6 });
  });

  it('a gain reads as a positive change, and one weigh-in or none says null', () => {
    const up = periodReport(week, input({}, { weights: [{ date: '2026-10-26', kg: 80 }, { date: '2026-10-27', kg: 80.7 }] }));
    expect(up.weight).toEqual({ from: 80, to: 80.7, change: 0.7 });
    expect(periodReport(week, input({}, { weights: [{ date: '2026-10-26', kg: 80 }] })).weight).toBeNull();
    expect(periodReport(week, input({}, { weights: [{ date: '2026-10-20', kg: 80 }, { date: '2026-11-03', kg: 79 }] })).weight).toBeNull();
    expect(periodReport(week, input()).weight).toBeNull();
  });

  it('counts the perfect-week medals whose Monday is in the period', () => {
    const month = periodOf('month', TODAY);
    const mondays = ['2026-09-28', '2026-10-05', '2026-10-05', '2026-10-26', '2026-11-02'];
    expect(periodReport(month, input({}, { perfectWeekMondays: mondays })).perfectWeeks).toBe(3);
    expect(periodReport(week, input({}, { perfectWeekMondays: mondays })).perfectWeeks).toBe(1);
    expect(periodReport(periodOf('week', '2026-10-12'), input({}, { perfectWeekMondays: mondays })).perfectWeeks).toBe(0);
  });
});

describe('periodReport against Progress', () => {
  const rec = (state: DayRecord['state'], nothingEaten = false, more: Partial<DayRecord> = {}): DayRecord => ({ state, fromPlan: false, nothingEaten, ...more });
  const meals = [
    { date: '2026-10-19', kcal: 900, protein: 40 },
    { date: '2026-10-20', kcal: 1800, protein: 90 },
    { date: '2026-10-21', kcal: 100, protein: 5 },
    { date: '2026-10-22', kcal: 700, protein: 30 },
    { date: '2026-10-24', kcal: 2000, protein: 80 },
  ];
  // Monday 19 October to Sunday 25 October 2026, the user started on the 20th and Sundays are free.
  const since = '2026-10-20';
  const records: Record<string, DayRecord> = {
    '2026-10-19': rec('full'),
    '2026-10-20': rec('full'),
    '2026-10-21': rec('full', true, { skipped: true }),
    '2026-10-22': rec('partial'),
    '2026-10-23': rec('empty'),
    '2026-10-24': rec('full'),
    '2026-10-25': rec('off'),
  };
  const built = (today: string) => {
    const p = periodOf('week', '2026-10-22');
    const recordOn = (d: string) => (d > today && records[d].state !== 'off' ? rec('planned') : records[d]);
    const factsOn = (date: string) =>
      dayFacts({ date, today, since, offDays: [0], record: recordOn(date), perfect: false, meals, waterMl: 0, walkMin: 0, jobs: { done: 0, total: 0, minutes: 0 }, score: score() });
    return { p, recordOn, report: periodReport(p, input({}, { today, since, offDays: [0], factsOn })) };
  };

  it('a finished week has the full days and the average Progress gives it, over the same days', () => {
    const { p, recordOn, report } = built('2026-10-29');
    const progress = fullDays(p.dates, recordOn, '2026-10-29', since);
    expect(report.full).toEqual(progress);
    expect(report.full).toEqual({ n: 2, of: 5 });
    const intake = completeIntake({ dates: p.dates, today: '2026-10-29', since, meals, recordOn });
    expect(report.avgKcal).toBe(intake?.avg);
    expect(report.avgKcal).toBe(1300);
  });

  it('a running week counts the days that count: Progress\'s days that can be full, less the ones still to come', () => {
    const { p, recordOn, report } = built('2026-10-22');
    const progress = fullDays(p.dates, recordOn, '2026-10-22', since);
    const planned = p.dates.filter((d) => report.days.find((f) => f.date === d)?.mark === 'planned').length;
    expect(planned).toBe(2);
    expect(report.full.n).toBe(progress.n);
    expect(report.full.of).toBe(progress.of - planned);
    expect(report.full).toEqual({ n: 1, of: 3 });
    expect(report.avgKcal).toBe(completeIntake({ dates: p.dates, today: '2026-10-22', since, meals, recordOn })?.avg);
  });
});

describe('the best day', () => {
  // Meals due, jobs due and a water goal: possible 8 (4 + 3 + 1), a score is meals done + jobs done + 1 for the water goal met.
  const day = (meals: number, jobs: number, water = false, ofMeals = 4, ofJobs = 3): Partial<DayFacts> => ({
    score: score({ meals: { done: meals, of: ofMeals }, jobs: { done: jobs, of: ofJobs, next: null }, water: { ml: water ? 2500 : 0, goal: 2500 } }),
  });
  const bestOf = (by: Record<string, Partial<DayFacts>>, p = week) => periodReport(p, input(by)).best;

  it('is the day that did the most, with what it held and whether it was perfect', () => {
    const best = bestOf({ '2026-10-26': day(2, 1, true), '2026-10-27': day(3, 2, true), '2026-10-28': day(3, 2, false) });
    expect(best).toEqual({ date: '2026-10-27', done: 6, of: 8, perfect: false });
  });

  it('counts today among the candidates', () => {
    expect(bestOf({ '2026-10-26': day(2, 1, true), '2026-10-29': day(4, 3, true) })?.date).toBe('2026-10-29');
  });

  it('never picks a day that does not count, however much it held', () => {
    const best = bestOf({ '2026-10-26': day(2, 1, true), '2026-10-27': { ...day(4, 3, true), counts: false, mark: 'off' }, '2026-10-30': { ...day(4, 3, true), counts: false } });
    expect(best?.date).toBe('2026-10-26');
  });

  it('needs at least half of what the day held: 4 of 8 qualifies, 3 of 8 does not, nor does nothing done', () => {
    expect(bestOf({ '2026-10-26': day(2, 1, true) })).toEqual({ date: '2026-10-26', done: 4, of: 8, perfect: false });
    expect(bestOf({ '2026-10-26': day(2, 1, false) })).toBeNull();
    expect(bestOf({ '2026-10-26': day(0, 0, false) })).toBeNull();
    expect(bestOf({})).toBeNull();
  });

  it('a lower day that qualifies beats a higher one that does not hold half', () => {
    // 5 of 13 does not qualify; 4 of 6 does.
    const best = bestOf({ '2026-10-26': day(3, 2, false, 8, 4), '2026-10-27': day(2, 2, false, 3, 2) });
    expect(best).toEqual({ date: '2026-10-27', done: 4, of: 6, perfect: false });
  });

  it('a tie in score goes to the higher share of what the day held, then to the later day', () => {
    // Both did 4; the earlier day held 6 (water goal included), the later one 8.
    const share = bestOf({ '2026-10-26': day(2, 2, false, 2, 2), '2026-10-28': day(2, 1, true) });
    expect(share).toEqual({ date: '2026-10-26', done: 4, of: 5, perfect: false });
    const later = bestOf({ '2026-10-26': day(2, 1, true), '2026-10-28': day(2, 1, true), '2026-10-27': day(1, 1, true) });
    expect(later?.date).toBe('2026-10-28');
  });

  it('a perfect day ranks above any day that is not, even one that did more', () => {
    const best = bestOf({ '2026-10-26': { ...day(3, 3, true), perfect: true }, '2026-10-27': day(4, 3, true) });
    expect(best).toEqual({ date: '2026-10-26', done: 7, of: 8, perfect: true });
    // Two perfect days: the one that did more.
    const two = bestOf({ '2026-10-26': { ...day(3, 3, true), perfect: true }, '2026-10-27': { ...day(4, 3, true), perfect: true } });
    expect(two?.date).toBe('2026-10-27');
  });

  it('a perfect day still has to hold half of what the day held', () => {
    // Perfect by its jobs alone: 3 of 8 done.
    const best = bestOf({ '2026-10-26': { ...day(0, 3, false), perfect: true }, '2026-10-27': day(2, 1, true) });
    expect(best?.date).toBe('2026-10-27');
  });

  it('a day has no best day', () => {
    expect(periodReport(periodOf('day', TODAY), input({ [TODAY]: day(4, 3, true) })).best).toBeNull();
  });

  it('a month has one too', () => {
    expect(bestOf({ '2026-10-02': day(3, 2, true), '2026-10-20': day(4, 2, true) }, periodOf('month', TODAY))?.date).toBe('2026-10-20');
  });
});

describe('compareReport', () => {
  it('builds the same figures over the earlier span, a running week against last week up to Thursday', () => {
    const now = periodReport(week, input());
    const by = { '2026-10-19': { mark: 'full' as const }, '2026-10-20': { mark: 'missing' as const }, '2026-10-21': { perfect: true }, '2026-10-22': { waterMl: 3000 } };
    const before = compareReport(now, input(by));
    expect(before).not.toBeNull();
    expect(before!.period.dates).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22']);
    expect(before!.period.start).toBe('2026-10-19');
    expect(before!.period.end).toBe('2026-10-22');
    expect(before!.period.kind).toBe('week');
    expect(before!.counted).toBe(4);
    expect(before!.full).toEqual({ n: 3, of: 4 });
    expect(before!.perfect).toBe(1);
    expect(before!.water).toEqual({ n: 1, of: 4 });
  });

  it('is null when the earlier span has no day that counts: the first week', () => {
    const now = periodReport(week, input());
    const none = Object.fromEntries(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((d) => [d, { counts: false }]));
    expect(compareReport(now, input(none))).toBeNull();
  });

  it('a day is compared with the day before', () => {
    const day = periodReport(periodOf('day', TODAY), input());
    const before = compareReport(day, input({ '2026-10-28': { kcal: 1500, waterMl: 2600 } }));
    expect(before?.period.dates).toEqual(['2026-10-28']);
    expect(before?.days[0]).toMatchObject({ kcal: 1500, waterMl: 2600 });
    expect(compareReport(day, input({ '2026-10-28': { counts: false, mark: 'off' } }))).toBeNull();
  });

  it('a finished month is compared with the whole month before', () => {
    const october = periodOf('month', '2026-10-15');
    const over = { today: '2026-11-03', factsOn: (d: string) => fact(d, { counts: true, perfect: d === '2026-09-30' }) };
    const now = periodReport(october, input({}, over));
    const before = compareReport(now, input({}, over));
    expect(before?.period.dates).toHaveLength(30);
    expect(before?.period.dates[0]).toBe('2026-09-01');
  });
});

describe('delta', () => {
  it('says how many more or fewer, or the same', () => {
    expect(delta(5, 3)).toEqual({ diff: 2, word: 'more' });
    expect(delta(3, 5)).toEqual({ diff: 2, word: 'fewer' });
    expect(delta(4, 4)).toEqual({ diff: 0, word: 'same' });
    expect(delta(0, 1)).toEqual({ diff: 1, word: 'fewer' });
  });
});
