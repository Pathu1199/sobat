import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { groceryDates, groceryHalfLabel, groceryList, groceryThisWeek, groceryWeekKey, tickedIn, toggleTick } from '../grocery';
import { mondayOf } from '../date';
import { makeT } from '../../i18n';
import { DEFAULT_ROUTINE } from '../routine';
import type { FoodItem } from '../types';
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

  it('keys the ticks by the week shown, so next week ticked never ticks this one', () => {
    // The plan screen and Me key a week by its Monday.
    expect(groceryWeekKey('2026-10-26')).toBe('2026-10-25');
    expect(groceryWeekKey('2026-11-02')).toBe('2026-11-01');
    expect(groceryWeekKey('2026-11-02')).not.toBe(groceryWeekKey('2026-10-26'));
    // Across the turn of a year and a month.
    expect(groceryWeekKey('2027-01-04')).toBe('2027-01-03');
    expect(groceryWeekKey('2026-12-01', 1)).toBe('2026-11-30');
  });

  it('lists the week shown: all of it, or half a week from the later of today and its Monday', () => {
    const thisWeek = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    expect(groceryDates('2026-10-26', '2026-10-28', 'week')).toEqual(thisWeek);
    // This week on a Wednesday: Wednesday to Saturday.
    expect(groceryDates('2026-10-26', '2026-10-28', 'half')).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
    // Next week, looked at on a Saturday: its own Monday to Thursday, not the days after today.
    expect(groceryDates('2026-11-02', '2026-10-31', 'half')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    // Near the week's end, only the days it has left.
    expect(groceryDates('2026-10-26', '2026-10-31', 'half')).toEqual(['2026-10-31', '2026-11-01']);
    // A week already past has nothing left to buy for.
    expect(groceryDates('2026-10-19', '2026-10-28', 'half')).toEqual([]);
  });

  it('names the half week "Next 4 days" only when it starts today with four days, else by its weekdays', () => {
    const en = makeT('en');
    const half = (monday: string, today: string) => groceryHalfLabel(groceryDates(monday, today, 'half'), today, en);
    expect(half('2026-10-26', '2026-10-28')).toBe('Next 4 days');
    // Next week, looked at on a Saturday: its Monday to Thursday.
    expect(half('2026-11-02', '2026-10-31')).toBe('Mon to Thu');
    // Two days left in the week.
    expect(half('2026-10-26', '2026-10-31')).toBe('Sat to Sun');
    // One day left: that day.
    expect(half('2026-10-26', '2026-11-01')).toBe('Sun');
    // A week already past offers no half.
    expect(half('2026-10-19', '2026-10-28')).toBe('');
    expect(groceryHalfLabel(groceryDates('2026-11-02', '2026-10-31', 'half'), '2026-10-31', makeT('mr'))).toBe('सोम ते गुरु');
    expect(groceryHalfLabel(groceryDates('2026-10-26', '2026-10-28', 'half'), '2026-10-28', makeT('hi'))).toBe('अगले 4 दिन');
  });
});

describe('grocery ticks, kept per week', () => {
  const THIS = '2026-10-26';
  const NEXT = '2026-11-02';

  it('keeps this week\'s ticks when next week\'s list is ticked, and each list shows only its own', () => {
    const one = toggleTick(null, THIS, 'poha', THIS);
    const two = toggleTick(one, NEXT, 'chapati', THIS);
    expect(tickedIn(two, THIS)).toEqual(['poha']);
    expect(tickedIn(two, NEXT)).toEqual(['chapati']);
    expect(tickedIn(two, '2026-11-09')).toEqual([]);
  });

  it('unticks a food ticked already, and a week with nothing ticked is not kept', () => {
    const on = toggleTick(toggleTick(null, THIS, 'poha', THIS), THIS, 'dahi', THIS);
    expect(tickedIn(on, THIS)).toEqual(['poha', 'dahi']);
    expect(toggleTick(toggleTick(null, THIS, 'poha', THIS), THIS, 'poha', THIS)).toEqual({});
  });

  it('keeps every week from this one on and drops only the weeks before it, so old weeks do not pile up', () => {
    const LAST = '2026-10-19';
    const three = toggleTick(toggleTick(toggleTick(null, LAST, 'a', LAST), THIS, 'b', THIS), NEXT, 'c', THIS);
    expect(Object.keys(three).sort()).toEqual([THIS, NEXT]);
    // A list two weeks ahead ticked as well: this week's and next week's ticks all stay.
    expect(Object.keys(toggleTick(three, '2026-11-09', 'd', THIS)).sort()).toEqual([THIS, NEXT, '2026-11-09']);
    // The week ticked always stays, an older one too, with every week from this one on.
    expect(Object.keys(toggleTick(three, LAST, 'd', THIS)).sort()).toEqual([LAST, THIS, NEXT]);
    // A week later, last week's ticks go at the next tick.
    expect(Object.keys(toggleTick(three, NEXT, 'e', NEXT)).sort()).toEqual([NEXT]);
  });

  it('this week is the key the list of this week ticks under, on Sunday as on Monday', () => {
    for (const today of ['2026-10-26', '2026-10-28', '2026-11-01']) expect(groceryThisWeek(today)).toBe(groceryWeekKey(mondayOf(today)));
    expect(groceryThisWeek('2026-11-01')).toBe(groceryThisWeek('2026-10-26'));
    expect(groceryThisWeek('2026-11-02')).not.toBe(groceryThisWeek('2026-11-01'));
  });

  it('reads the one week an older version kept, and anything else as nothing ticked', () => {
    const old = { week: THIS, ids: ['poha'] };
    expect(tickedIn(old, THIS)).toEqual(['poha']);
    expect(tickedIn(old, NEXT)).toEqual([]);
    expect(toggleTick(old, NEXT, 'chapati', THIS)).toEqual({ [THIS]: ['poha'], [NEXT]: ['chapati'] });
    for (const bad of [undefined, null, 'x', 3, { [THIS]: 'poha' }]) expect(tickedIn(bad, THIS)).toEqual([]);
    expect(tickedIn({ [THIS]: [1, 'poha'] }, THIS)).toEqual(['poha']);
  });
});
