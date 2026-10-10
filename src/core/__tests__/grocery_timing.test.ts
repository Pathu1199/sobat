import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { groceryList, groceryWeekKey } from '../grocery';
import { DEFAULT_ROUTINE } from '../routine';
import { dayTiming, fmtDuration } from '../timing';
import type { FoodItem, Meal } from '../types';
import { buildWeekPlan } from '../weekPlan';

const foods = foodsJson as FoodItem[];

describe('groceryList', () => {
  it('adds the week up by food, groups it for the market, and rounds to buying amounts', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const groups = groceryList(plan, foods);
    expect(groups.length).toBeGreaterThan(2);
    const keys = groups.map((g) => g.key);
    expect(keys.indexOf('veg')).toBeLessThan(keys.indexOf('grain'));
    const all = groups.flatMap((g) => g.lines);
    const chapati = all.find((l) => l.foodId === 'chapati')!;
    expect(chapati.unit).toBe('piece');
    expect(Number(chapati.amount)).toBeGreaterThanOrEqual(7);
    const almonds = all.find((l) => l.foodId === 'almonds')!;
    expect(almonds.times).toBe(7);
    expect(almonds.unit).toBe('g');
    for (const l of all) expect(l.grams).toBeGreaterThan(0);
  });

  it('can list part of the week, and keys ticks by the week', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const mon = groceryList(plan, foods, [1]).flatMap((g) => g.lines);
    const week = groceryList(plan, foods).flatMap((g) => g.lines);
    expect(mon.length).toBeLessThanOrEqual(week.length);
    expect(groceryWeekKey('2026-10-07', 0)).toBe('2026-10-04');
    expect(groceryWeekKey('2026-10-04', 0)).toBe('2026-10-04');
  });
});

describe('dayTiming', () => {
  const m = (at: string): Meal => ({ id: at, at: `2026-10-10T${at}:00`, date: '2026-10-10', type: 'lunch', items: [], kcal: 300, protein: 10 });
  it('reads the window, the longest gap and a late dinner', () => {
    const t = dayTiming([m('08:30'), m('13:00'), m('16:00'), m('21:30')], '2026-10-10');
    expect(t.first).toBe('08:30');
    expect(t.last).toBe('21:30');
    expect(t.windowMinutes).toBe(13 * 60);
    expect(t.longestGapMinutes).toBe(330);
    expect(t.lateDinner).toBe(true);
    expect(t.verdict).toBe('both');
    expect(dayTiming([m('08:30'), m('13:00'), m('20:00')], '2026-10-10').verdict).toBe('good');
    expect(dayTiming([], '2026-10-10').verdict).toBe('none');
    expect(fmtDuration(330)).toBe('5 h 30 m');
  });
});
