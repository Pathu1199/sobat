import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { dayMode, dayView } from '../dayView';
import type { DayMenu } from '../menu';
import type { FoodItem, Meal } from '../types';
import { lineInfo } from '../weekPlan';

const foods = foodsJson as unknown as FoodItem[];
const TODAY = '2026-10-27';
const menu = (date: string): DayMenu => ({
  date,
  editedAt: '',
  meals: [
    { id: 'breakfast', type: 'breakfast', time: '08:30', lines: [{ foodId: 'poha', unit: 'katori', qty: 1 }] },
    { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }, { foodId: 'moong-dal', unit: 'katori', qty: 0.5 }] },
    { id: 'snack', type: 'snack', time: '16:00', lines: [] },
    { id: 'dinner', type: 'dinner', time: '20:30', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
  ],
});
const meal = (date: string, slotId: string | undefined, type: Meal['type'], hhmm: string, kcal: number, source?: Meal['source']): Meal => ({
  id: `${date}-${slotId ?? type}`,
  at: new Date(`${date}T${hhmm}:00`).toISOString(),
  date,
  type,
  slotId,
  items: [],
  kcal,
  protein: 10,
  source,
});
const view = (date: string, meals: Meal[], extra: Partial<Parameters<typeof dayView>[0]> = {}) =>
  dayView({ date, today: TODAY, menu: menu(date), meals, skippedIds: [], currentId: null, foods, lang: 'en', offDay: false, ...extra });
const states = (v: ReturnType<typeof dayView>) => v.rows.map((r) => r.state);
const menuRowsPlanned = (v: ReturnType<typeof dayView>) => v.rows.map((r) => r.planned);

describe('dayMode', () => {
  it('is past, today or future', () => {
    expect([dayMode('2026-10-26', TODAY), dayMode(TODAY, TODAY), dayMode('2026-10-28', TODAY)]).toEqual(['past', 'today', 'future']);
  });
});

describe('today', () => {
  it('ticks what was eaten, opens the slot whose turn it is, and keeps the rest for later', () => {
    expect(states(view(TODAY, [meal(TODAY, 'breakfast', 'breakfast', '08:40', 300)], { currentId: 'lunch' }))).toEqual(['done', 'current', 'later', 'later']);
  });

  it('before any slot has opened, the first meal still to eat is the current one', () => {
    const v = view(TODAY, []);
    expect(states(v)).toEqual(['current', 'later', 'later', 'later']);
    // Today is still being eaten: nothing is missing yet, and it is not filled from the plan in one go.
    expect([v.missing, v.canFill, v.judged]).toEqual([0, false, true]);
  });

  it('a slot passed with nothing in it is open to fill in, before the current one', () => {
    expect(states(view(TODAY, [], { currentId: 'lunch' }))).toEqual(['open', 'current', 'later', 'later']);
  });

  it('the slot whose turn it is already eaten: the next open slot is current, and an earlier one passed empty stays open', () => {
    const v = view(TODAY, [meal(TODAY, 'lunch', 'lunch', '13:05', 420)], { currentId: 'lunch' });
    expect(states(v)).toEqual(['open', 'done', 'current', 'later']);
  });

  it('a slot the app filled in is done with its from-plan mark, and the next slot becomes current', () => {
    const v = view(TODAY, [meal(TODAY, 'breakfast', 'breakfast', '08:40', 300), meal(TODAY, 'lunch', 'lunch', '13:00', 420, 'auto')], { currentId: 'lunch' });
    expect(states(v)).toEqual(['done', 'done', 'current', 'later']);
    expect(v.rows[1].autoIds).toEqual(['2026-10-27-lunch']);
    expect(v.autoIds).toEqual(['2026-10-27-lunch']);
  });
});

describe('a past day', () => {
  it('counts the planned meals eaten or skipped, and says how many are missing', () => {
    const d = '2026-10-25';
    const v = view(d, [meal(d, 'breakfast', 'breakfast', '08:40', 300)], { skippedIds: ['lunch'] });
    expect(states(v)).toEqual(['done', 'skipped', 'open', 'open']);
    expect([v.required, v.settled, v.missing, v.canFill]).toEqual([3, 2, 1, false]);
  });

  it('an empty day can be filled from the plan in one go', () => {
    const v = view('2026-10-20', []);
    expect([v.missing, v.canFill, v.eatenKcal]).toEqual([3, true, 0]);
  });

  it('a meal the app filled in settles its slot, with its from-plan mark, and the day is no longer filled in one go', () => {
    const d = '2026-10-25';
    const v = view(d, [meal(d, 'breakfast', 'breakfast', '08:30', 300, 'auto')]);
    expect(states(v)).toEqual(['done', 'open', 'open', 'open']);
    expect(v.rows[0].autoIds).toEqual(['2026-10-25-breakfast']);
    expect([v.settled, v.missing, v.canFill, v.judged]).toEqual([1, 2, false, true]);
  });

  it('a slot whose planned food is no longer in the database still counts as planned, as in the record', () => {
    const d = '2026-10-25';
    const m = menu(d);
    const gone: DayMenu = { ...m, meals: m.meals.map((x) => (x.id === 'snack' ? { ...x, lines: [{ foodId: 'gone-food', unit: 'piece', qty: 1 }] } : x)) };
    const v = dayView({ date: d, today: TODAY, menu: gone, meals: [], skippedIds: [], currentId: null, foods, lang: 'en', offDay: false });
    // Nothing to show or log from it, but it is one of the meals the day asks for, so it can be skipped.
    expect(v.rows[2].lines).toEqual([]);
    expect(v.rows[2].planned).toBe(true);
    expect(v.rows.map((r) => r.planned)).toEqual([true, true, true, true]);
    expect([v.required, v.missing]).toEqual([4, 4]);
    expect(menuRowsPlanned(view(d, []))).toEqual([true, true, false, true]);
  });

  it('a meal logged without a slot lands in the slot of its kind nearest its time', () => {
    const d = '2026-10-25';
    expect(view(d, [meal(d, undefined, 'dinner', '20:45', 500)]).rows[3].state).toBe('done');
  });
});

describe('a day outside the record', () => {
  it('a past free day shows its rows, with nothing missing and no filling it from the plan', () => {
    const v = view('2026-10-20', [], { offDay: true });
    expect(states(v)).toEqual(['open', 'open', 'open', 'open']);
    expect([v.missing, v.canFill, v.judged]).toEqual([0, false, false]);
    expect(v.required).toBe(3);
  });

  it('a day before the person started shows its rows, with nothing missing and no filling it from the plan; the first day counts', () => {
    const before = view('2026-10-20', [], { startDate: '2026-10-22' });
    expect(states(before)).toEqual(['open', 'open', 'open', 'open']);
    expect([before.missing, before.canFill, before.judged]).toEqual([0, false, false]);
    const first = view('2026-10-22', [], { startDate: '2026-10-22' });
    expect([first.missing, first.canFill, first.judged]).toEqual([3, true, true]);
  });

  it('today on a free day: the turn of each slot as always, nothing judged', () => {
    const v = view(TODAY, [], { currentId: 'lunch', offDay: true });
    expect(states(v)).toEqual(['open', 'current', 'later', 'later']);
    expect([v.missing, v.canFill, v.judged]).toEqual([0, false, false]);
  });

  it('a future free day is still the plan, to change as any other', () => {
    const v = view('2026-10-29', [], { offDay: true });
    expect(states(v)).toEqual(['plan', 'plan', 'plan', 'plan']);
    expect([v.missing, v.canFill, v.judged]).toEqual([0, false, false]);
  });

  it('a menu with no slots has no rows and nothing to count, on any day', () => {
    for (const d of ['2026-10-20', TODAY, '2026-10-29']) {
      const v = dayView({ date: d, today: TODAY, menu: { date: d, editedAt: '', meals: [] }, meals: [], skippedIds: [], currentId: null, foods, lang: 'en', offDay: false });
      expect(v.rows).toEqual([]);
      expect([v.required, v.settled, v.missing, v.canFill, v.plannedKcal]).toEqual([0, 0, 0, false, 0]);
    }
  });
});

describe('a future day', () => {
  it("is all plan, its lines in the person's language with calories from the database", () => {
    const v = view('2026-10-29', []);
    expect(states(v)).toEqual(['plan', 'plan', 'plan', 'plan']);
    // Nothing is logged into the future: no missing meals and no filling in from the plan.
    expect([v.missing, v.canFill]).toEqual([0, false]);
    expect(v.rows[1].lines.map((l) => [l.idx, l.foodId, l.qtyText])).toEqual([
      [0, 'chapati', '2'],
      [1, 'moong-dal', '½'],
    ]);
    const kcal = (foodId: string, unit: string, qty: number) => lineInfo({ foodId, unit, qty }, foods)!.kcal;
    expect(v.plannedKcal).toBe(kcal('poha', 'katori', 1) + kcal('chapati', 'piece', 2) + kcal('moong-dal', 'katori', 0.5) + kcal('chapati', 'piece', 2));
    const hi = dayView({ date: '2026-10-29', today: TODAY, menu: menu('2026-10-29'), meals: [], skippedIds: [], currentId: null, foods, lang: 'hi', offDay: false });
    expect(hi.rows[1].lines[0].name).toBe(foods.find((f) => f.id === 'chapati')!.name_hi);
  });
});
