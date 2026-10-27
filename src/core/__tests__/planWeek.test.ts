import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import type { DayMenu } from '../menu';
import { foodsForDiet } from '../foods';
import { balanceAvoided, defaultPlanWeek, mainDish, planRowTone, planWeekRows, weekAverage, withReviewedWeek } from '../planWeek';
import type { FoodItem } from '../types';
import type { PlanLine } from '../routine';
import { balanceDay, dayTotals, type PlanMeal } from '../weekPlan';

const foods = foodsJson as unknown as FoodItem[];
const day = (date: string, lines: PlanLine[]): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines }] });
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

  it('never calls a day already past suggested: what it held is weighed like any plan', () => {
    const two = planWeekRows({ week: [day('2026-10-27', thali), day('2026-10-28', thali)], today: TODAY, target, floor: 300, offDays: [], foods, suggested: () => true });
    expect(two.map((r) => r.status)).toEqual(['on', 'suggested']);
    expect(two.map((r) => r.suggested)).toEqual([false, true]);
  });

  it('a suggestion under the safe minimum is low all the same', () => {
    const tiny = planWeekRows({ week: [day('2026-10-29', [{ foodId: 'chapati', unit: 'piece', qty: 1 }])], today: TODAY, target: 1800, floor: 1500, offDays: [], foods, suggested: () => true });
    expect(tiny[0].status).toBe('low');
    expect(tiny[0].suggested).toBe(true);
  });

  it('a day planned under the safe minimum is low even on a free day, so saving the week never passes it as free', () => {
    const one = [{ foodId: 'chapati', unit: 'piece', qty: 1 }];
    // Thursday is a free day here; one chapati is under the floor of 300, the thali is not.
    const free = planWeekRows({ week: [day('2026-10-29', one), day('2026-11-05', thali), day('2026-11-12', [])], today: TODAY, target, floor: 300, offDays: [4], foods, suggested: () => false });
    expect(free.map((r) => r.status)).toEqual(['low', 'off', 'off']);
    expect(free.map((r) => r.off)).toEqual([true, true, true]);
    // A free day stays out of the week's average, low or not.
    expect(weekAverage(free, target)).toBeNull();
  });

  it('85 to 95% of the target is on target, 105% still is, a calorie more is high', () => {
    const k = kcal(week[3]);
    expect(planWeekRows({ week: [week[3]], today: TODAY, target: k / 0.9, floor: 300, offDays: [], foods, suggested: () => false })[0].status).toBe('on');
    expect(planWeekRows({ week: [week[3]], today: TODAY, target: k / 0.8, floor: 300, offDays: [], foods, suggested: () => false })[0].status).toBe('low');
    // One bowl of varan is 210 kcal: 105% of 200, a little over 105% of 199.
    const varan = day('2026-10-29', [{ foodId: 'varan', unit: 'bowl', qty: 1 }]);
    expect(kcal(varan)).toBe(210);
    expect(planWeekRows({ week: [varan], today: TODAY, target: 200, floor: 100, offDays: [], foods, suggested: () => false })[0].status).toBe('on');
    expect(planWeekRows({ week: [varan], today: TODAY, target: 199, floor: 100, offDays: [], foods, suggested: () => false })[0].status).toBe('high');
  });

  it("the person's own plan under the safe minimum is low, even at 85% of the target or more", () => {
    const one = day('2026-10-29', [{ foodId: 'chapati', unit: 'piece', qty: 1 }]);
    const r = planWeekRows({ week: [one], today: TODAY, target: kcal(one) / 0.9, floor: kcal(one) + 1, offDays: [], foods, suggested: () => false })[0];
    expect(r.status).toBe('low');
    expect(r.suggested).toBe(false);
  });

  it('averages the planned days, off and empty ones left out', () => {
    const avg = weekAverage(rows, target)!;
    const counted = [2, 3, 4, 5, 6].map((i) => rows[i].kcal);
    expect(avg.avg).toBe(Math.round(counted.reduce((a, b) => a + b, 0) / counted.length));
    expect(avg.diff).toBe(avg.avg - target);
    expect(weekAverage(rows.slice(0, 2), target)).toBeNull();
  });
});

describe('the tone of a row', () => {
  const one = [{ foodId: 'chapati', unit: 'piece', qty: 1 }];
  const at = (suggested: boolean) => planWeekRows({ week: [day('2026-10-29', one)], today: TODAY, target: 1800, floor: 1500, offDays: [], foods, suggested: () => suggested })[0];

  it("the app's own suggestion under the safe minimum is amber, as in the opened menu; the person's own plan there is red", () => {
    expect(planRowTone(at(true))).toBe('amber');
    expect(planRowTone(at(false))).toBe('red');
  });

  it('high is amber, on target is teal, the rest are grey', () => {
    const base = at(false);
    expect(planRowTone({ ...base, status: 'high' })).toBe('amber');
    expect(planRowTone({ ...base, status: 'on' })).toBe('accent');
    expect(planRowTone({ ...base, status: 'suggested' })).toBe('dim');
    expect(planRowTone({ ...base, status: 'off' })).toBe('dim');
    expect(planRowTone({ ...base, status: 'empty' })).toBe('dim');
  });
});

describe('mainDish', () => {
  const meal = (id: PlanMeal['type'], lines: PlanLine[], type: PlanMeal['type'] = id): PlanMeal => ({ id, type, time: '12:00', lines });
  const poha = { foodId: 'poha', unit: 'plate', qty: 1 };
  const chapati = { foodId: 'chapati', unit: 'piece', qty: 3 };
  const bhaji = { foodId: 'palak-bhaji', unit: 'vati', qty: 1 };
  const dal = { foodId: 'dal-tadka', unit: 'katori', qty: 1 };
  const rice = { foodId: 'steamed-rice', unit: 'katori', qty: 1 };

  it('names the bhaji of lunch or dinner, not the bigger breakfast', () => {
    expect(mainDish({ meals: [meal('breakfast', [poha]), meal('lunch', [chapati, bhaji, dal, rice])] }, foods)).toBe('palak-bhaji');
    expect(mainDish({ meals: [meal('breakfast', [poha]), meal('lunch', [chapati, dal, rice]), meal('dinner', [chapati, bhaji])] }, foods)).toBe('palak-bhaji');
  });

  it('names the dal when lunch and dinner hold no bhaji', () => {
    expect(mainDish({ meals: [meal('breakfast', [poha]), meal('lunch', [chapati, dal, rice]), meal('dinner', [chapati])] }, foods)).toBe('dal-tadka');
  });

  it('otherwise the biggest food of lunch and dinner that is not bread, rice, a drink or milk', () => {
    const curry = { foodId: 'chicken-curry', unit: 'katori', qty: 1 };
    expect(mainDish({ meals: [meal('breakfast', [poha]), meal('dinner', [chapati, curry, rice])] }, foods)).toBe('chicken-curry');
  });

  it('a day with no lunch or dinner looks at its biggest meal', () => {
    expect(mainDish({ meals: [meal('breakfast', [poha, chapati]), meal('snack', [bhaji])] }, foods)).toBe('poha');
  });

  it('with only sides planned, the biggest of them', () => {
    expect(mainDish({ meals: [meal('lunch', [chapati, rice])] }, foods)).toBe('chapati');
  });

  it('a day with nothing planned has no main dish', () => {
    expect(mainDish({ meals: [] }, foods)).toBeNull();
    expect(mainDish({ meals: [meal('lunch', [])] }, foods)).toBeNull();
  });
});

describe('the week to open and the reviewed stamp', () => {
  it('opens this week on a weekday and next week at the weekend', () => {
    expect(defaultPlanWeek('2026-10-28')).toBe('2026-10-26');
    expect(defaultPlanWeek('2026-10-30')).toBe('2026-10-26');
    expect(defaultPlanWeek('2026-10-31')).toBe('2026-11-02');
    expect(defaultPlanWeek('2026-11-01')).toBe('2026-11-02');
  });

  it('keeps the eight newest reviewed weeks, each once, and drops the oldest', () => {
    const once = withReviewedWeek(undefined, '2026-10-26');
    expect(once).toEqual(['2026-10-26']);
    expect(withReviewedWeek(once, '2026-10-26')).toBe(once);
    const many = Array.from({ length: 9 }, (_, i) => `2026-0${i % 9 + 1}-01`).reduce((l, m) => withReviewedWeek(l, m), [] as string[]);
    expect(many).toHaveLength(8);
    expect(many[0]).toBe('2026-09-01');
    expect(many[7]).toBe('2026-02-01');
    expect(many).not.toContain('2026-01-01');
  });

  it('gives back the same list when a week older than the eight kept would be dropped at once', () => {
    const eight = ['2026-09-01', '2026-08-01', '2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01', '2026-03-01', '2026-02-01'];
    expect(withReviewedWeek(eight, '2026-01-01')).toBe(eight);
  });
});

describe('Balance on the plan screen', () => {
  const veg = foodsForDiet(foods, 'veg');
  const lunch = (lines: PlanLine[]) => ({ meals: [{ id: 'lunch', type: 'lunch' as const, time: '13:00', lines }] });

  it('counts with every food a plan names, as the totals on screen, and treats foods outside the diet as avoided', () => {
    const avoided = balanceAvoided(new Set(['shev']), foods, veg);
    expect(avoided.has('shev')).toBe(true);
    expect(avoided.has('chicken-curry')).toBe(true);
    expect(avoided.has('chapati')).toBe(false);
    // Chicken curry and chapati, the total on screen on target: Balance changes nothing.
    const d = lunch([{ foodId: 'chicken-curry', unit: 'katori', qty: 1 }, { foodId: 'chapati', unit: 'piece', qty: 2 }]);
    const target = dayTotals(d, foods).kcal;
    expect(balanceDay(d, foods, target, avoided, 0).changes).toEqual([]);
    // Counted with the diet's list alone, the curry was nothing and the same day looked short.
    expect(balanceDay(d, veg, target, avoided, 0).changes.length).toBeGreaterThan(0);
  });

  it('never adds a food outside the diet, nor makes one bigger', () => {
    const avoided = balanceAvoided(new Set(), foods, veg);
    const d = lunch([{ foodId: 'chicken-curry', unit: 'katori', qty: 1 }]);
    const r = balanceDay(d, foods, dayTotals(d, foods).kcal + 600, avoided, 0);
    const ids = r.day.meals.flatMap((m) => m.lines.map((l) => l.foodId));
    expect(ids.filter((id) => avoided.has(id))).toEqual(['chicken-curry']);
    expect(r.day.meals[0].lines.find((l) => l.foodId === 'chicken-curry')!.qty).toBe(1);
  });
});
