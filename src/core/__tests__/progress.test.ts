import { describe, expect, it } from 'vitest';
import { fullDays, monthCells, monthMarks, monthSteps, oldProgressLink, recentIntake, shiftMonth, weightIsStale } from '../progress';
import type { DayRecord } from '../record';

describe('monthCells', () => {
  it('lays a month out in weeks from Monday, blank before the 1st and after the last day', () => {
    // 1 October 2026 is a Thursday.
    const weeks = monthCells('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks[4]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('a February that starts on a Monday is four full weeks', () => {
    const weeks = monthCells('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2027-02-01');
    expect(weeks[3][6]).toBe('2027-02-28');
  });
});

describe('shiftMonth', () => {
  it('steps months across the turn of a year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-10', -12)).toBe('2025-10');
  });
});

describe('the record calendar', () => {
  // Wednesday 28 October 2026; the person started on the 5th.
  const TODAY = '2026-10-28';
  const SINCE = '2026-10-05';
  const r = (state: DayRecord['state'], fromPlan = false, nothingEaten = false): DayRecord => ({ state, fromPlan, nothingEaten });

  it('marks each day of the month as the week strip does, blank around it', () => {
    const recordOn = (d: string): DayRecord =>
      d === '2026-10-20' ? r('full', true) : d === '2026-10-21' ? r('partial') : d === '2026-10-22' ? r('full', false, true) : d === '2026-10-25' ? r('off') : d > TODAY ? r('planned') : r('full');
    const weeks = monthMarks('2026-10', recordOn, TODAY, SINCE);
    expect(weeks).toHaveLength(5);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    const day = (d: string) => weeks.flat().find((c) => c?.date === d);
    expect(day('2026-10-20')).toEqual({ date: '2026-10-20', mark: 'full', light: true });
    expect(day('2026-10-21')).toEqual({ date: '2026-10-21', mark: 'missing', light: false });
    // Every meal skipped and nothing eaten: its own quiet mark, never a full day.
    expect(day('2026-10-22')?.mark).toBe('skipped');
    expect(day('2026-10-25')?.mark).toBe('off');
    expect(day(TODAY)?.mark).toBe('full');
    expect(day('2026-10-30')?.mark).toBe('planned');
  });

  it('shows nothing before the person started, a free weekday too', () => {
    const weeks = monthMarks('2026-10', (d) => (d === '2026-10-04' ? r('off') : r('full')), TODAY, SINCE);
    const before = weeks.flat().filter((c) => c !== null && c.date < SINCE);
    expect(before.map((c) => c!.mark)).toEqual(['none', 'none', 'none', 'none']);
  });

  it('steps back to the month the person started and forward to this one, no further', () => {
    expect(monthSteps('2026-10', TODAY, SINCE)).toEqual({ prev: false, next: false });
    expect(monthSteps('2026-10', TODAY, '2026-08-30')).toEqual({ prev: true, next: false });
    expect(monthSteps('2026-08', TODAY, '2026-08-30')).toEqual({ prev: false, next: true });
  });
});

describe("this week's full days", () => {
  const TODAY = '2026-10-28';
  const r = (state: DayRecord['state'], nothingEaten = false): DayRecord => ({ state, fromPlan: false, nothingEaten });
  const week = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

  it('counts the days the strip marks full: not a day of meals all skipped, not a free day, not one before the start', () => {
    const recs: Record<string, DayRecord> = { '2026-10-26': r('full'), '2026-10-27': r('full', true), '2026-10-28': r('full') };
    const recordOn = (d: string) => recs[d] ?? r('planned');
    expect(fullDays(week, recordOn, TODAY, '2026-10-01').n).toBe(2);
    // The person started on Tuesday: Monday was before the start.
    expect(fullDays(week, recordOn, TODAY, '2026-10-27').n).toBe(1);
    expect(fullDays(week, () => r('off'), TODAY, '2026-10-01').n).toBe(0);
  });

  it('says of how many: the days of the week that can be full, free days and days before the start left out', () => {
    const recs: Record<string, DayRecord> = { '2026-10-26': r('full'), '2026-10-28': r('full'), '2026-11-01': r('off') };
    const recordOn = (d: string) => recs[d] ?? r('planned');
    // Sunday is a free day: six days this week can be full, the days still to come too.
    expect(fullDays(week, recordOn, TODAY, '2026-10-01')).toEqual({ n: 2, of: 6 });
    // Started on Tuesday: Monday was never a day to fill.
    expect(fullDays(week, recordOn, TODAY, '2026-10-27')).toEqual({ n: 1, of: 5 });
    expect(fullDays(week, () => r('off'), TODAY, '2026-10-01')).toEqual({ n: 0, of: 0 });
  });
});

describe('the last seven days on average', () => {
  const TODAY = '2026-10-28';
  const meal = (date: string, kcal: number) => ({ date, kcal });
  const r = (state: DayRecord['state'], nothingEaten = false): DayRecord => ({ state, fromPlan: false, nothingEaten });

  it('averages what was eaten on the full days of the last seven, today included once full', () => {
    const meals = [meal('2026-10-22', 1500), meal('2026-10-22', 300), meal('2026-10-27', 1600), meal(TODAY, 1700), meal('2026-10-21', 2500)];
    const recordOn = (d: string) => (['2026-10-22', '2026-10-27', TODAY, '2026-10-21'].includes(d) ? r('full') : r('partial'));
    // The 21st is eight days back, outside the seven.
    expect(recentIntake({ today: TODAY, since: '2026-10-01', meals, recordOn })).toEqual({ avg: 1700, days: 3 });
  });

  it('counts a day of meals all skipped, so skipping shows in the average; leaves out free days, days with meals missing and days before the start', () => {
    const meals = [meal('2026-10-24', 3000), meal('2026-10-25', 900), meal('2026-10-26', 100), meal('2026-10-27', 1800), meal('2026-10-23', 2200)];
    const recs: Record<string, DayRecord> = {
      '2026-10-23': r('full'),
      '2026-10-24': r('off'),
      '2026-10-25': r('partial'),
      '2026-10-26': r('full', true),
      '2026-10-27': r('full'),
    };
    const recordOn = (d: string) => recs[d] ?? r('empty');
    // The 23rd, the 26th (every meal skipped, a 100 kcal drink) and the 27th: (2200 + 100 + 1800) / 3.
    expect(recentIntake({ today: TODAY, since: '2026-10-01', meals, recordOn })).toEqual({ avg: 1367, days: 3 });
    // Started on the 24th: the 23rd is before the start.
    expect(recentIntake({ today: TODAY, since: '2026-10-24', meals, recordOn })).toEqual({ avg: 950, days: 2 });
  });

  it('a day of meals all skipped and nothing eaten counts as nothing eaten', () => {
    const recordOn = (d: string) => (d === TODAY ? r('full', true) : d === '2026-10-27' ? r('full') : r('empty'));
    expect(recentIntake({ today: TODAY, since: '2026-10-01', meals: [meal('2026-10-27', 1600)], recordOn })).toEqual({ avg: 800, days: 2 });
  });

  it('is nothing without a full day', () => {
    expect(recentIntake({ today: TODAY, since: '2026-10-01', meals: [meal(TODAY, 500)], recordOn: () => r('partial') })).toBeNull();
  });
});

describe('a weigh-in gone stale', () => {
  it('is more than thirty days before today', () => {
    expect(weightIsStale('2026-09-28', '2026-10-28')).toBe(false);
    expect(weightIsStale('2026-09-27', '2026-10-28')).toBe(true);
    expect(weightIsStale('2026-10-28', '2026-10-28')).toBe(false);
  });
});

describe('older links to the sections Progress had', () => {
  it('send the coach and the charts to their own pages, and leave the rest on Progress', () => {
    expect(oldProgressLink('coach')).toBe('/coach');
    expect(oldProgressLink('charts')).toBe('/growth');
    expect(oldProgressLink('climb')).toBeNull();
    expect(oldProgressLink(undefined)).toBeNull();
    // A repeated ?s= names no one section.
    expect(oldProgressLink(['coach', 'charts'])).toBeNull();
  });
});
