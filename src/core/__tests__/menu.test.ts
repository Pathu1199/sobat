import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { addMenuLine, addSkip, alignMenu, alignMenus, copyDay, ensureWeek, menuFor, NOT_EDITED, removeSkip, setMenuLine, setMenuMeal, skippedOn, viewMenu, viewWeek, type DayMenu } from '../menu';
import { DEFAULT_ROUTINE, type PlanLine, type Routine, type RoutineSlot } from '../routine';
import type { FoodItem } from '../types';
import { planDayFor, type PlanMeal } from '../weekPlan';

const foods = foodsJson as FoodItem[];
const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '20:00', 35)] };
const chapati = (qty: number): PlanLine => ({ foodId: 'chapati', unit: 'piece', qty });
/** A menu whose lunch is `qty` chapati; breakfast and dinner have nothing planned. */
const menu = (date: string, qty: number, editedAt = '2026-10-01T09:00:00.000Z'): DayMenu => ({
  date,
  editedAt,
  meals: [
    { id: 'morning', type: 'breakfast', time: '08:30', lines: [] },
    { id: 'lunch', type: 'lunch', time: '13:00', lines: [chapati(qty)] },
    { id: 'dinner', type: 'dinner', time: '20:00', lines: [] },
  ],
});
const lunchQty = (m: { meals: PlanMeal[] } | null | undefined) => m?.meals.find((x) => x.id === 'lunch')?.lines[0]?.qty;
// vitest pins TZ to Asia/Kolkata. 26 October 2026 is a Monday.
const MON = '2026-10-26';
const NOW = new Date('2026-10-27T10:00:00');

describe('ensureWeek', () => {
  it('copies each date from the same weekday a week earlier, as written by the app', () => {
    const lastWeek = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d, i) => menu(d, i + 1));
    const week = ensureWeek(MON, lastWeek, routine, foods);
    expect(week.map((m) => m.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(week.map(lunchQty)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week.every((m) => m.editedAt === NOT_EDITED)).toBe(true);
  });

  it('falls back to the newest earlier menu of that weekday, then to the pattern', () => {
    const week = ensureWeek(MON, [menu('2026-10-07', 2), menu('2026-10-14', 3)], routine, foods);
    // Wednesday the 28th: the 14th is the newest earlier Wednesday.
    expect(lunchQty(week[2])).toBe(3);
    // Thursday: nothing earlier, so the pattern's own lines, as the week plan was built.
    expect(week[3].meals).toEqual(planDayFor(routine, 4, foods).meals);
  });

  it('never overwrites a stored date', () => {
    const stored = menu('2026-10-28', 9);
    expect(ensureWeek(MON, [menu('2026-10-21', 1), stored], routine, foods)[2]).toBe(stored);
  });

  it('a copy is its own: changing it does not change the week it came from', () => {
    const source = menu('2026-10-21', 2);
    const week = ensureWeek(MON, [source], routine, foods);
    week[2].meals[1].lines[0].qty = 5;
    expect(lunchQty(source)).toBe(2);
  });
});

describe('editing one date', () => {
  const wed = menu('2026-10-28', 2);
  const thu = menu('2026-10-29', 2);
  const menus = [wed, thu];

  it('changes only that date, and stamps it', () => {
    const out = setMenuLine(menus, wed, 'lunch', 0, chapati(3), NOW);
    expect(lunchQty(menuFor('2026-10-28', out))).toBe(3);
    expect(menuFor('2026-10-28', out)!.editedAt).toBe(NOW.toISOString());
    expect(menuFor('2026-10-29', out)).toBe(thu);
    expect(lunchQty(wed)).toBe(2);
  });

  it('a quantity of 0 removes the line; the same food in the same measure again is a bigger portion', () => {
    expect(menuFor('2026-10-28', setMenuLine(menus, wed, 'lunch', 0, chapati(0), NOW))!.meals[1].lines).toEqual([]);
    expect(menuFor('2026-10-28', addMenuLine(menus, wed, 'lunch', chapati(1), NOW))!.meals[1].lines).toEqual([chapati(3)]);
    expect(menuFor('2026-10-28', addMenuLine(menus, wed, 'lunch', { foodId: 'moong-dal', unit: 'katori', qty: 1 }, NOW))!.meals[1].lines).toHaveLength(2);
  });

  it('replaces one meal, and stores a date that was only shown until now', () => {
    const dinner: PlanMeal = { id: 'dinner', type: 'dinner', time: '20:00', lines: [chapati(1)] };
    expect(menuFor('2026-10-28', setMenuMeal(menus, wed, dinner, NOW))!.meals[2]).toEqual(dinner);
    const shown = menu('2026-10-30', 2, NOT_EDITED);
    const out = setMenuLine(menus, shown, 'lunch', 0, chapati(4), NOW);
    expect(out).toHaveLength(3);
    expect(lunchQty(menuFor('2026-10-30', out))).toBe(4);
  });

  it('copies a day onto another date as its own copy', () => {
    const out = copyDay(wed, '2026-10-29', menus, NOW);
    const copy = menuFor('2026-10-29', out)!;
    expect(copy.meals).toEqual(wed.meals);
    expect(copy.meals[1].lines[0]).not.toBe(wed.meals[1].lines[0]);
    expect(copy.editedAt).toBe(NOW.toISOString());
    expect(menuFor('2026-10-28', out)).toBe(wed);
  });
});

describe('following the slots', () => {
  const withTea: Routine = { ...routine, slots: [...routine.slots, slot('tea', 'snack', '16:00', 5)] };

  it('today and later dates take a new slot and keep their lines and stamp; a past date stays as it was', () => {
    const past = menu('2026-10-26', 2);
    expect(alignMenu(past, withTea, '2026-10-27', foods)).toBe(past);
    const ahead = alignMenu(menu('2026-10-28', 2), withTea, '2026-10-27', foods);
    expect(ahead.meals.map((m) => m.id)).toEqual(['morning', 'lunch', 'tea', 'dinner']);
    expect(lunchQty(ahead)).toBe(2);
    expect(ahead.editedAt).toBe('2026-10-01T09:00:00.000Z');
  });

  it('drops a slot that is gone, from today on', () => {
    const noDinner: Routine = { ...routine, slots: routine.slots.filter((s) => s.id !== 'dinner') };
    expect(alignMenu(menu('2026-10-27', 2), noDinner, '2026-10-27').meals.map((m) => m.id)).toEqual(['morning', 'lunch']);
  });

  it('gives back the same object and the same list when nothing moves', () => {
    const m = menu('2026-10-28', 2);
    expect(alignMenu(m, routine, '2026-10-27')).toBe(m);
    const list = [m, menu('2026-10-20', 1)];
    expect(alignMenus(list, routine, '2026-10-27')).toBe(list);
  });

  it('shows a date as stored or as it starts, following the slots', () => {
    const shown = viewMenu('2026-10-28', [menu('2026-10-21', 3)], withTea, '2026-10-27', foods);
    expect(lunchQty(shown)).toBe(3);
    expect(shown.meals.map((m) => m.id)).toContain('tea');
    expect(viewWeek(MON, [], routine, '2026-10-27', foods)).toHaveLength(7);
  });
});

describe('skips', () => {
  it('records one skip per date and slot, with the same id on every device', () => {
    const once = addSkip([], '2026-10-27', 'lunch');
    expect(once).toEqual([{ id: '2026-10-27:lunch', date: '2026-10-27', slotId: 'lunch' }]);
    expect(addSkip(once, '2026-10-27', 'lunch')).toBe(once);
  });

  it('a skip on a past date lasts, and only that date reads it', () => {
    const skips = addSkip(addSkip([], '2026-10-20', 'dinner'), '2026-10-27', 'lunch');
    expect(skippedOn(skips, '2026-10-20')).toEqual(['dinner']);
    expect(skippedOn(skips, '2026-10-27')).toEqual(['lunch']);
    expect(skippedOn(skips, '2026-10-21')).toEqual([]);
  });

  it('clears a skip, and leaves the list alone when there was none', () => {
    const skips = addSkip([], '2026-10-27', 'lunch');
    expect(removeSkip(skips, '2026-10-27', 'lunch')).toEqual([]);
    expect(removeSkip(skips, '2026-10-27', 'dinner')).toBe(skips);
  });
});
