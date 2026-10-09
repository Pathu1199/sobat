import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { DEFAULT_ROUTINE } from '../routine';
import type { FoodItem } from '../types';
import { balanceDay, buildWeekPlan, copyToWeekdays, dayStatus, dayTotals, lineInfo, roleOf, setLine, swapsFor } from '../weekPlan';

const foods = foodsJson as FoodItem[];
const byId = (id: string) => foods.find((f) => f.id === id)!;

describe('weekPlan', () => {
  it('builds seven days from the routine, with the weekday bhaji at lunch and a real dinner', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    expect(plan.days).toHaveLength(7);
    const monday = plan.days[1];
    const lunch = monday.meals.find((m) => m.id === 'lunch')!;
    expect(lunch.lines[0].foodId).toBe('dudhi-bhaji');
    expect(monday.meals.some((m) => m.id === 'dinner' && m.lines.length >= 3)).toBe(true);
    // The person's own fixed items come through.
    expect(monday.meals.flatMap((m) => m.lines).map((l) => l.foodId)).toEqual(expect.arrayContaining(['almonds', 'black-tea', 'murmura-bhel', 'taak']));
  });

  it('counts a line by its measure: 2 chapati is 2 × 40 g', () => {
    const i = lineInfo({ foodId: 'chapati', unit: 'piece', qty: 2 }, foods)!;
    expect(i.grams).toBe(80);
    expect(i.kcal).toBeGreaterThan(200);
  });

  it('offers same-kind swaps with their calorie change: bhakri for chapati, keeping the count', () => {
    expect(roleOf(byId('chapati'))).toBe('bread');
    expect(roleOf(byId('jowar-bhakri'))).toBe('bread');
    const swaps = swapsFor({ foodId: 'chapati', unit: 'piece', qty: 2 }, foods, new Set());
    const bhakri = swaps.find((s) => s.line.foodId === 'jowar-bhakri')!;
    // One bhakri stands in for two chapati, as it does on a real plate.
    expect(bhakri.line).toEqual({ foodId: 'jowar-bhakri', unit: 'piece', qty: 1 });
    expect(swaps.find((s) => s.line.foodId === 'phulka')!.line.qty).toBe(3);
    expect(typeof bhakri.diff).toBe('number');
    expect(swaps.every((s) => roleOf(byId(s.line.foodId)) === 'bread')).toBe(true);
  });

  it('brings a day that is too low back up to the target, in kitchen-sized steps', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const before = dayTotals(plan.days[1], foods).kcal;
    const target = Math.max(before + 400, 1700);
    expect(dayStatus(before, target, 1500)).toBe('low');
    const { day, changes } = balanceDay(plan.days[1], foods, target, new Set());
    const after = dayTotals(day, foods).kcal;
    expect(after).toBeGreaterThan(before);
    expect(Math.abs(after - target)).toBeLessThan(Math.abs(before - target));
    expect(changes.length).toBeGreaterThan(0);
  });

  it('puts a missing roti and dal back first when a plate was cut to bhaji only', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const cut = { meals: plan.days[5].meals.map((m) => (m.id === 'lunch' || m.id === 'dinner' ? { ...m, lines: m.lines.slice(0, 1) } : m)) };
    const { day, changes } = balanceDay(cut, foods, 1700, new Set());
    expect(changes[0].key).toBe('bal_add_bread');
    const lunch = day.meals.find((m) => m.id === 'lunch')!;
    expect(lunch.lines.some((l) => l.foodId === 'chapati')).toBe(true);
    expect(dayTotals(day, foods).kcal).toBeGreaterThanOrEqual(1700 * 0.95);
  });

  it('never stops under the safe minimum, even when the target sits just above it', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const cut = { meals: plan.days[5].meals.map((m) => (m.id === 'lunch' || m.id === 'dinner' ? { ...m, lines: m.lines.slice(0, 1) } : m)) };
    const { day } = balanceDay(cut, foods, 1524, new Set(), 1500);
    const k = dayTotals(day, foods).kcal;
    expect(k).toBeGreaterThanOrEqual(1500);
    expect(dayStatus(k, 1524, 1500)).not.toBe('low');
  });

  it('brings a day that is too high down, and never below one bread', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const before = dayTotals(plan.days[1], foods).kcal;
    const { day } = balanceDay(plan.days[1], foods, before - 300, new Set());
    expect(dayTotals(day, foods).kcal).toBeLessThan(before);
    for (const m of day.meals) for (const l of m.lines) expect(l.qty).toBeGreaterThan(0);
  });

  it('edits and copies', () => {
    let plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const lunchIdx = plan.days[1].meals.findIndex((m) => m.id === 'lunch');
    const chapatiIdx = plan.days[1].meals[lunchIdx].lines.findIndex((l) => l.foodId === 'chapati');
    plan = setLine(plan, 1, 'lunch', chapatiIdx, { foodId: 'jowar-bhakri', unit: 'piece', qty: 1 });
    expect(plan.days[1].meals[lunchIdx].lines[chapatiIdx].foodId).toBe('jowar-bhakri');
    plan = setLine(plan, 1, 'lunch', chapatiIdx, { foodId: 'jowar-bhakri', unit: 'piece', qty: 0 });
    expect(plan.days[1].meals[lunchIdx].lines.some((l) => l.foodId === 'jowar-bhakri')).toBe(false);
    const copied = copyToWeekdays(plan, 1);
    expect(copied.days[3]).toEqual(plan.days[1]);
    expect(copied.days[0]).toEqual(plan.days[0]);
  });
});
