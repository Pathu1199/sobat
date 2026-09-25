import { describe, expect, it } from 'vitest';
import { changePct, isImprovement, previousRangeFor, rangeFor, summarize, trendDirection, type GrowthData } from '../growth';
import { addActive } from '../usage';
import { lastNDates } from '../date';
import type { Meal, WeightLog } from '../types';

const TODAY = '2026-09-25';

function meal(date: string, kcal: number): Meal {
  return { id: date + kcal, at: `${date}T13:00:00`, date, type: 'lunch', items: [], kcal, protein: 40 };
}

function baseData(over: Partial<GrowthData> = {}): GrowthData {
  return { meals: [], water: [], weights: [], sleep: [], moods: [], workouts: [], usage: [], kcalTarget: 1800, waterGoalMl: 3000, ...over };
}

describe('ranges', () => {
  it('sizes each period', () => {
    expect(rangeFor('today', TODAY)).toHaveLength(1);
    expect(rangeFor('week', TODAY)).toHaveLength(7);
    expect(rangeFor('month', TODAY)).toHaveLength(30);
  });

  it('puts the previous window immediately before, with no overlap', () => {
    const now = rangeFor('week', TODAY);
    const prev = previousRangeFor('week', TODAY);
    expect(prev).toHaveLength(7);
    expect(now.some((d) => prev.includes(d))).toBe(false);
    expect(prev[prev.length - 1] < now[0]).toBe(true);
  });
});

describe('summarize', () => {
  it('averages only the days that were logged', () => {
    const dates = lastNDates(7, TODAY);
    const meals = [meal(dates[5], 1800), meal(dates[6], 1600)];
    const s = summarize('week', TODAY, baseData({ meals }));
    expect(s.metrics.find((m) => m.key === 'avg_kcal')!.value).toBe(1700);
    expect(s.metrics.find((m) => m.key === 'logged_days')!.value).toBe(2);
  });

  it('counts a day slightly over the goal as on target', () => {
    const dates = lastNDates(7, TODAY);
    const s = summarize('week', TODAY, baseData({ meals: [meal(dates[6], 1900), meal(dates[5], 2400)] }));
    expect(s.metrics.find((m) => m.key === 'on_target')!.value).toBe(1);
  });

  it('leaves the comparison empty when there is no previous data', () => {
    const s = summarize('week', TODAY, baseData({ meals: [meal(TODAY, 1800)] }));
    expect(s.metrics.every((m) => m.previous === null)).toBe(true);
  });

  it('compares against the window before', () => {
    const now = rangeFor('week', TODAY);
    const prev = previousRangeFor('week', TODAY);
    const s = summarize('week', TODAY, baseData({ meals: [meal(now[3], 1700), meal(prev[3], 2200)] }));
    const m = s.metrics.find((x) => x.key === 'avg_kcal')!;
    expect(m.value).toBe(1700);
    expect(m.previous).toBe(2200);
    expect(isImprovement(m)).toBe(true);
  });

  it('reports weight change across the window', () => {
    const dates = lastNDates(30, TODAY);
    const weights: WeightLog[] = [
      { date: dates[0], kg: 100 },
      { date: dates[29], kg: 98.2 },
    ];
    const s = summarize('month', TODAY, baseData({ weights }));
    expect(s.metrics.find((m) => m.key === 'weight_change')!.value).toBe(-1.8);
  });

  it('builds one consistency cell per day', () => {
    const dates = lastNDates(7, TODAY);
    const s = summarize('week', TODAY, baseData({ meals: [meal(dates[6], 1700)] }));
    expect(s.consistency).toHaveLength(7);
    expect(s.consistency[6]).toMatchObject({ logged: true, onTarget: true });
    expect(s.consistency[0].logged).toBe(false);
  });

  it('includes screen time from the usage buckets', () => {
    const usage = addActive([], TODAY, 10, 45);
    const s = summarize('today', TODAY, baseData({ usage }));
    expect(s.metrics.find((m) => m.key === 'screen_time')!.value).toBe(45);
  });
});

describe('trend helpers', () => {
  const m = (value: number, previous: number | null, higherIsBetter: boolean) => ({ key: 'k', value, previous, higherIsBetter, unit: '' });

  it('computes percentage change', () => {
    expect(changePct(m(120, 100, true))).toBe(20);
    expect(changePct(m(80, 100, true))).toBe(-20);
    expect(changePct(m(80, null, true))).toBeNull();
    expect(changePct(m(80, 0, true))).toBeNull();
  });

  it('reads direction', () => {
    expect(trendDirection(m(2, 1, true))).toBe('up');
    expect(trendDirection(m(1, 2, true))).toBe('down');
    expect(trendDirection(m(1, 1, true))).toBe('flat');
  });

  it('knows that less is better for calories and more is better for workouts', () => {
    expect(isImprovement(m(1600, 1900, false))).toBe(true);
    expect(isImprovement(m(1900, 1600, false))).toBe(false);
    expect(isImprovement(m(4, 2, true))).toBe(true);
    expect(isImprovement(m(2, 2, true))).toBeNull();
  });
});
