import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import type { DayMenu } from '../menu';
import { defaultPlanWeek, mainDish, planWeekRows, weekAverage, withReviewedWeek } from '../planWeek';
import type { FoodItem } from '../types';
import { dayTotals } from '../weekPlan';

const foods = foodsJson as unknown as FoodItem[];
const day = (date: string, lines: { foodId: string; unit: string; qty: number }[]): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines }] });
const kcal = (d: DayMenu) => dayTotals({ meals: d.meals }, foods).kcal;
// 26 October 2026 is a Monday; today is Wednesday the 28th.
const TODAY = '2026-10-28';

describe('planWeekRows', () => {
  // Bread and rice are sides: the bhaji is the main dish.
  const thali = [{ foodId: 'chapati', unit: 'piece', qty: 4 }, { foodId: 'palak-bhaji', unit: 'katori', qty: 1 }, { foodId: 'steamed-rice', unit: 'katori', qty: 1 }];
  const week: DayMenu[] = [
    day('2026-10-26', thali),
    day('2026-10-27', []),
    day('2026-10-28', thali),
    day('2026-10-29', thali),
    day('2026-10-30', [...thali, { foodId: 'chapati', unit: 'piece', qty: 6 }]),
    day('2026-10-31', [{ foodId: 'chapati', unit: 'piece', qty: 1 }]),
    day('2026-11-01', thali),
  ];
  const target = kcal(week[3]);
  // A low floor, so the one-chapati day is the only one under it.
  const rows = planWeekRows({ week, today: TODAY, target, floor: 300, offDays: [1], foods, suggested: (d) => d.date === '2026-10-28' });

  it('gives each day a status: off, empty, suggested, on target, high, low', () => {
    expect(rows.map((r) => r.status)).toEqual(['off', 'empty', 'suggested', 'on', 'high', 'low', 'on']);
  });

  it('names the main dish, not the bread, and marks the days already past', () => {
    expect(rows[3].mainFoodId).toBe('palak-bhaji');
    expect(rows[5].mainFoodId).toBe('chapati');
    expect(rows[1].mainFoodId).toBeNull();
    expect(rows.map((r) => r.past)).toEqual([true, true, false, false, false, false, false]);
    expect(rows.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('a suggestion under the safe minimum is low all the same', () => {
    const tiny = planWeekRows({ week: [day('2026-10-29', [{ foodId: 'chapati', unit: 'piece', qty: 1 }])], today: TODAY, target: 1800, floor: 1500, offDays: [], foods, suggested: () => true });
    expect(tiny[0].status).toBe('low');
  });

  it('averages the planned days, off and empty ones left out', () => {
    const avg = weekAverage(rows, target)!;
    const counted = [2, 3, 4, 5, 6].map((i) => rows[i].kcal);
    expect(avg.avg).toBe(Math.round(counted.reduce((a, b) => a + b, 0) / counted.length));
    expect(avg.diff).toBe(avg.avg - target);
    expect(weekAverage(rows.slice(0, 2), target)).toBeNull();
  });
});

describe('the week to open and the reviewed stamp', () => {
  it('opens this week on a weekday and next week at the weekend', () => {
    expect(defaultPlanWeek('2026-10-28')).toBe('2026-10-26');
    expect(defaultPlanWeek('2026-10-30')).toBe('2026-10-26');
    expect(defaultPlanWeek('2026-10-31')).toBe('2026-11-02');
    expect(defaultPlanWeek('2026-11-01')).toBe('2026-11-02');
  });

  it('keeps the eight newest reviewed weeks, each once', () => {
    const once = withReviewedWeek(undefined, '2026-10-26');
    expect(once).toEqual(['2026-10-26']);
    expect(withReviewedWeek(once, '2026-10-26')).toBe(once);
    const many = Array.from({ length: 9 }, (_, i) => `2026-0${i % 9 + 1}-01`).reduce((l, m) => withReviewedWeek(l, m), [] as string[]);
    expect(many).toHaveLength(8);
    expect(many[0]).toBe('2026-09-01');
  });

  it('a day with nothing planned has no main dish', () => {
    expect(mainDish({ meals: [] }, foods)).toBeNull();
  });
});
