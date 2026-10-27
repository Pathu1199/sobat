import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import {
  addMenuLine,
  addSkip,
  alignMenu,
  alignMenus,
  autoFill,
  autoMealId,
  copyDay,
  editedMeal,
  ensureWeek,
  fillFromPlan,
  mealFromLines,
  menuFor,
  NOT_EDITED,
  removeSkip,
  setMenuLine,
  setMenuMeal,
  settleAuto,
  skippedOn,
  skipsAfterRemove,
  viewMenu,
  viewWeek,
  withDayConfirmed,
  withMealAdded,
  withMealConfirmed,
  withoutSavedMeal,
  withSavedMeal,
  withSkipAdded,
  type DayMenu,
} from '../menu';
import { kcalForGrams } from '../nutrition';
import { DEFAULT_ROUTINE, type PlanLine, type Routine, type RoutineSlot } from '../routine';
import type { FoodItem, Meal, MealSource, SlotSkip } from '../types';
import { lineInfo, planDayFor, type PlanMeal } from '../weekPlan';

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

describe('meals from the plan', () => {
  const lunch: PlanMeal = { id: 'lunch', type: 'lunch', time: '13:00', lines: [chapati(2)] };

  it('"Ate as planned" on a past date logs to that date and slot, with the database calories', () => {
    const m = mealFromLines({ id: 'x', date: '2026-10-20', slot: lunch, lines: lunch.lines, foods, source: 'plan', now: NOW })!;
    const info = lineInfo(chapati(2), foods)!;
    expect(m).toMatchObject({ date: '2026-10-20', slotId: 'lunch', type: 'lunch', source: 'plan' });
    expect(m.at).toBe(new Date('2026-10-20T13:00:00').toISOString());
    expect(m.items[0]).toMatchObject({ foodId: 'chapati', grams: info.grams, kcal: kcalForGrams(info.food, info.grams).kcal, estimated: false });
    expect(m.kcal).toBe(m.items[0].kcal);
  });

  it('a slot whose time has not come is logged now; a made-up food stays estimated; no known food, no meal', () => {
    expect(mealFromLines({ id: 'x', date: '2026-10-27', slot: lunch, lines: lunch.lines, foods, source: 'plan', now: NOW })!.at).toBe(NOW.toISOString());
    const mine: FoodItem = { ...foods.find((f) => f.id === 'poha')!, id: 'my-poha', tags: ['custom'] };
    const custom = mealFromLines({ id: 'x', date: '2026-10-20', slot: lunch, lines: [{ foodId: 'my-poha', unit: 'katori', qty: 1 }], foods: [...foods, mine], source: 'plan', now: NOW })!;
    expect(custom.items[0].estimated).toBe(true);
    expect(mealFromLines({ id: 'x', date: '2026-10-20', slot: lunch, lines: [{ foodId: 'nope', unit: 'piece', qty: 1 }], foods, source: 'plan', now: NOW })).toBeNull();
  });

  it('"Fill this day from plan" logs every open slot of an older day as planned', () => {
    const old: DayMenu = { ...menu('2026-10-20', 2), meals: [...menu('2026-10-20', 2).meals.slice(0, 2), { id: 'dinner', type: 'dinner', time: '20:00', lines: [chapati(1)] }] };
    const out = fillFromPlan({ now: NOW, menu: old, meals: [], skips: addSkip([], '2026-10-20', 'dinner'), foods });
    expect(out.map((m) => [m.slotId, m.source])).toEqual([['lunch', 'plan']]);
  });
});

describe('autoFill', () => {
  const today = '2026-10-27';
  const at = (hhmm: string, date = today) => new Date(`${date}T${hhmm}:00`);
  const base = { date: today, menu: menu(today, 2), meals: [] as Meal[], skips: [] as SlotSkip[], openedDates: [] as string[], offDays: [] as number[], foods };

  it('fills a slot 90 minutes after its time, and not a minute before', () => {
    expect(autoFill({ ...base, now: at('14:29') })).toEqual([]);
    const out = autoFill({ ...base, now: at('14:30') });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'auto-2026-10-27-lunch', slotId: 'lunch', source: 'auto', date: today });
    expect(out[0].at).toBe(at('13:00').toISOString());
  });

  it('never fills an off day, a skipped slot, a slot with any meal in it, or a slot with nothing planned', () => {
    const late = at('22:00');
    // 27 October 2026 is a Tuesday.
    expect(autoFill({ ...base, now: late, offDays: [2] })).toEqual([]);
    expect(autoFill({ ...base, now: late, skips: addSkip([], today, 'lunch') })).toEqual([]);
    const ate: Meal = { id: 'm', at: at('13:20').toISOString(), date: today, type: 'lunch', items: [], kcal: 400, protein: 10 };
    expect(autoFill({ ...base, now: late, meals: [ate] })).toEqual([]);
    expect(autoFill({ ...base, now: late }).map((m) => m.slotId)).toEqual(['lunch']);
  });

  it('fills yesterday only when the app was open yesterday, and never an older day', () => {
    const yesterday = { ...base, date: '2026-10-26', menu: menu('2026-10-26', 2), now: at('09:00') };
    expect(autoFill(yesterday)).toEqual([]);
    expect(autoFill({ ...yesterday, openedDates: ['2026-10-26'] })).toHaveLength(1);
    expect(autoFill({ ...base, date: '2026-10-25', menu: menu('2026-10-25', 2), now: at('09:00'), openedDates: ['2026-10-25'] })).toEqual([]);
  });
});

describe('confirming and taking away', () => {
  const auto = (id: string, date: string, slotId: string): Meal => ({ id, at: `${date}T07:30:00.000Z`, date, type: 'lunch', slotId, items: [], kcal: 300, protein: 10, source: 'auto' });

  it('"Day looks right" turns every filled-in meal of that day into a planned one, and only that day', () => {
    const out = withDayConfirmed([auto('a', '2026-10-27', 'lunch'), auto('b', '2026-10-27', 'dinner'), auto('c', '2026-10-26', 'lunch')], '2026-10-27');
    expect(out.map((m) => m.source)).toEqual(['plan', 'plan', 'auto']);
    expect(withDayConfirmed(out, '2026-10-27')).toBe(out);
  });

  it('tapping one filled-in meal confirms that one', () => {
    expect(withMealConfirmed([auto('a', '2026-10-27', 'lunch'), auto('b', '2026-10-27', 'dinner')], 'b').map((m) => m.source)).toEqual(['auto', 'plan']);
  });

  it('deleting a meal from the plan marks its slot skipped so it is not filled again; a hand-typed one does not', () => {
    const gone = auto('a', '2026-10-27', 'lunch');
    expect(skipsAfterRemove([], gone, [])).toEqual([{ id: '2026-10-27:lunch', date: '2026-10-27', slotId: 'lunch' }]);
    expect(skipsAfterRemove([], { ...gone, source: undefined }, [])).toEqual([]);
    const other: Meal = { ...auto('b', '2026-10-27', 'lunch'), source: 'manual' };
    expect(skipsAfterRemove([], gone, [other])).toEqual([]);
  });
});

describe('a real meal replaces the filled-in one', () => {
  const d = '2026-10-27';
  const filled = (slotId: string, date = d): Meal => ({ id: autoMealId(date, slotId), at: `${date}T07:30:00.000Z`, date, type: 'lunch', slotId, items: [], kcal: 600, protein: 20, source: 'auto' });
  const ate = (id: string, slotId: string | undefined, source: MealSource | undefined, date = d): Meal => ({ id, at: `${date}T09:30:00.000Z`, date, type: 'lunch', slotId, items: [], kcal: 450, protein: 15, source });

  it('a meal eaten in a slot the app filled in takes the filled-in one away, so the day counts lunch once', () => {
    const real = ate('m1', 'lunch', 'manual');
    expect(settleAuto([filled('lunch'), real], [])).toEqual([real]);
    // A meal with no source was logged before there was a plan: typed in by the person.
    const old = ate('m2', 'lunch', undefined);
    expect(settleAuto([old, filled('lunch')], [])).toEqual([old]);
  });

  it('"Ate as planned" in that slot takes it away too', () => {
    const planned = ate('p1', 'lunch', 'plan');
    expect(settleAuto([filled('lunch'), planned], [])).toEqual([planned]);
  });

  it('a skip on that date and slot takes it away', () => {
    expect(settleAuto([filled('lunch'), filled('dinner')], addSkip([], d, 'lunch'))).toEqual([filled('dinner')]);
  });

  it('a confirmed one stays, and so does one in another slot or on another date', () => {
    const confirmed = withMealConfirmed([filled('lunch')], autoMealId(d, 'lunch'));
    expect(settleAuto(confirmed, [])).toBe(confirmed);
    const others = [filled('dinner'), filled('lunch', '2026-10-26'), ate('m1', 'lunch', 'manual'), filled('morning', '2026-10-28')];
    const skips = addSkip(addSkip([], d, 'morning'), '2026-10-26', 'dinner');
    expect(settleAuto(others, skips).map((m) => m.id)).toEqual(['auto-2026-10-27-dinner', 'auto-2026-10-26-lunch', 'm1', 'auto-2026-10-28-morning']);
  });

  it('a meal that names no slot never takes anything away', () => {
    const list = [filled('lunch'), ate('m1', undefined, 'manual'), ate('m2', undefined, 'plan')];
    expect(settleAuto(list, [])).toBe(list);
  });

  it('gives back the same list when nothing goes, and settling again changes nothing', () => {
    const list = [filled('lunch'), filled('dinner'), ate('m1', 'morning', 'manual')];
    expect(settleAuto(list, addSkip([], '2026-10-26', 'lunch'))).toBe(list);
    const empty: Meal[] = [];
    expect(settleAuto(empty, [])).toBe(empty);
    const once = settleAuto([filled('lunch'), ate('m1', 'lunch', 'manual'), filled('dinner')], []);
    expect(settleAuto(once, [])).toBe(once);
  });

  it('a confirmed meal and a hand-typed one in the same slot and date both stay while a filled-in one there goes', () => {
    const confirmed: Meal = { ...filled('lunch'), source: 'plan' };
    const real = ate('m1', 'lunch', 'manual');
    const stray: Meal = { ...filled('lunch'), id: 'auto-stray' };
    expect(settleAuto([confirmed, real, stray, filled('dinner')], [])).toEqual([confirmed, real, filled('dinner')]);
  });
});

describe('editing a meal', () => {
  const base: Meal = { id: 'a', at: '2026-10-27T07:30:00.000Z', date: '2026-10-27', type: 'lunch', slotId: 'lunch', items: [], kcal: 600, protein: 20 };
  const edit = (m: Meal): Meal => ({ ...m, kcal: 450, protein: 15 });

  it('a filled-in meal the person corrects is confirmed, so a later meal or a sync never takes it away', () => {
    const prev: Meal = { ...base, source: 'auto' };
    expect(editedMeal(prev, edit(prev))).toEqual({ ...edit(prev), source: 'plan' });
  });

  it('any other meal keeps its source, and comes back as it was given', () => {
    for (const source of ['manual', 'plan', undefined] as const) {
      const prev: Meal = { ...base, source };
      const next = edit(prev);
      expect(editedMeal(prev, next)).toBe(next);
      expect(editedMeal(prev, next).source).toBe(source);
    }
  });
});

describe('adding a meal to the state', () => {
  const d = '2026-10-27';
  const at = (hhmm: string, date = d) => new Date(`${date}T${hhmm}:00`);
  const real = (id: string, slotId: string | undefined, hhmm: string, date = d): Meal => ({ id, at: at(hhmm, date).toISOString(), date, type: 'snack', slotId, items: [], kcal: 300, protein: 10, source: 'manual' });
  const filled = (slotId: string, date = d): Meal => ({ id: autoMealId(date, slotId), at: at('13:00', date).toISOString(), date, type: 'lunch', slotId, items: [], kcal: 600, protein: 20, source: 'auto' });
  const state = (meals: Meal[], slotSkips: SlotSkip[] = []) => ({ routine, meals, slotSkips });

  it('a slot marked skipped is no longer skipped once a meal is eaten in it', () => {
    const out = withMealAdded(state([], addSkip([], d, 'lunch')), real('m1', 'lunch', '13:30'), 1600, at('13:30'));
    expect(out.slotSkips).toEqual([]);
    expect(out.meals.map((m) => m.id)).toEqual(['m1']);
  });

  it('a meal on a past date clears the skip of its own date only, and another slot\'s skip stays', () => {
    const skips = addSkip(addSkip(addSkip([], '2026-10-26', 'lunch'), d, 'lunch'), '2026-10-26', 'dinner');
    const out = withMealAdded(state([], skips), real('m1', 'lunch', '13:30', '2026-10-26'), 1600, at('10:00'));
    expect(out.slotSkips.map((s) => s.id)).toEqual(['2026-10-27:lunch', '2026-10-26:dinner']);
    const other = addSkip([], d, 'dinner');
    expect(withMealAdded(state([], other), real('m2', 'lunch', '13:30'), 1600, at('13:30')).slotSkips).toBe(other);
  });

  it('a meal that names no slot gets the one it is eaten in; one that names its slot keeps it', () => {
    const now = at('13:30');
    expect(withMealAdded(state([]), real('m1', undefined, '13:30'), 1600, now).meals[0]).toMatchObject({ slotId: 'lunch', type: 'lunch' });
    expect(withMealAdded(state([]), real('m2', 'dinner', '13:30'), 1600, now).meals[0]).toMatchObject({ slotId: 'dinner', type: 'snack' });
  });

  it('the meal the app filled in that slot goes, whether the new meal names the slot or is routed there', () => {
    const named = withMealAdded(state([filled('lunch'), filled('lunch', '2026-10-26')]), real('m1', 'lunch', '15:00'), 1600, at('15:00'));
    expect(named.meals.map((m) => m.id)).toEqual(['auto-2026-10-26-lunch', 'm1']);
    const routed = withMealAdded(state([filled('lunch')]), real('m2', undefined, '15:00'), 1600, at('15:00'));
    expect(routed.meals.map((m) => [m.id, m.slotId])).toEqual([['m2', 'lunch']]);
  });
});

describe('skipping a slot', () => {
  it('drops the meal the app filled in that slot on that date, and nothing else; skipping again changes nothing', () => {
    const filled = (slotId: string, date: string): Meal => ({ id: autoMealId(date, slotId), at: `${date}T07:30:00.000Z`, date, type: 'lunch', slotId, items: [], kcal: 600, protein: 20, source: 'auto' });
    const before = { meals: [filled('lunch', '2026-10-27'), filled('dinner', '2026-10-27'), filled('lunch', '2026-10-26')], slotSkips: [] as SlotSkip[] };
    const out = withSkipAdded(before, '2026-10-27', 'lunch');
    expect(out.slotSkips).toEqual([{ id: '2026-10-27:lunch', date: '2026-10-27', slotId: 'lunch' }]);
    expect(out.meals.map((m) => m.id)).toEqual(['auto-2026-10-27-dinner', 'auto-2026-10-26-lunch']);
    const again = withSkipAdded(out, '2026-10-27', 'lunch');
    expect(again.slotSkips).toBe(out.slotSkips);
    expect(again.meals).toBe(out.meals);
  });
});

describe('saved meals', () => {
  const thali = { id: 's1', name: ' My usual thali ', lines: [chapati(2), { foodId: 'moong-dal', unit: 'katori', qty: 1 }] };

  it('saves under a trimmed name, replaces by id, refuses an empty one, and removes', () => {
    const list = withSavedMeal([], thali);
    expect(list).toEqual([{ ...thali, name: 'My usual thali' }]);
    expect(withSavedMeal(list, { ...thali, name: 'Thali' })).toEqual([{ ...thali, name: 'Thali' }]);
    expect(withSavedMeal(list, { id: 's2', name: '  ', lines: [chapati(1)] })).toBe(list);
    expect(withSavedMeal(list, { id: 's2', name: 'Nothing', lines: [] })).toBe(list);
    expect(withoutSavedMeal(list, 's1')).toEqual([]);
  });

  it('logs the same way as "Ate as planned", with database calories', () => {
    const m = mealFromLines({ id: 'x', date: '2026-10-20', slot: { id: 'lunch', type: 'lunch', time: '13:00' }, lines: thali.lines, foods, source: 'manual', now: NOW })!;
    expect(m.items.map((i) => i.foodId)).toEqual(['chapati', 'moong-dal']);
    expect(m.kcal).toBe(m.items.reduce((a, i) => a + i.kcal, 0));
  });
});
