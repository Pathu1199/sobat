import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { EMPTY_STATE } from '../../store/defaults';
import { addDays } from '../date';
import {
  addMenuLine,
  addSkip,
  alignMenu,
  alignMenus,
  applyWeekPlan,
  autoFill,
  autoMealId,
  copyDay,
  dueAutoFills,
  editedMeal,
  ensureWeek,
  fillFromPlan,
  hasPlan,
  isSuggested,
  mealFromLines,
  menuFor,
  menusFromTemplate,
  NOT_EDITED,
  removeSkip,
  setMenuDay,
  setMenuLine,
  setMenuMeal,
  settleAuto,
  skippedOn,
  skipsAfterRemove,
  viewMenu,
  viewWeek,
  weekPlanView,
  withDayConfirmed,
  withMealAdded,
  withAutoFill,
  withMealConfirmed,
  withMealRemoved,
  withOpened,
  withoutSavedMeal,
  withSavedMeal,
  withSkipAdded,
  type DayMenu,
} from '../menu';
import { kcalForGrams } from '../nutrition';
import { forCloud, isPristine } from '../sync';
import { DEFAULT_ROUTINE, NEUTRAL_ROUTINE, type PlanLine, type Routine, type RoutineSlot } from '../routine';
import type { FoodItem, Meal, MealSource, SlotSkip } from '../types';
import { buildWeekPlan, lineInfo, planDayFor, type PlanMeal } from '../weekPlan';

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

  it('an edit that names no meal or line of that date, or changes nothing, leaves the menus as they were and stamps nothing', () => {
    const supper: PlanMeal = { id: 'supper', type: 'dinner', time: '21:00', lines: [chapati(1)] };
    expect(setMenuMeal(menus, wed, supper, NOW)).toBe(menus);
    expect(setMenuLine(menus, wed, 'supper', 0, chapati(3), NOW)).toBe(menus);
    expect(addMenuLine(menus, wed, 'supper', chapati(1), NOW)).toBe(menus);
    expect(setMenuLine(menus, wed, 'lunch', 5, chapati(3), NOW)).toBe(menus);
    expect(setMenuLine(menus, wed, 'lunch', -1, null, NOW)).toBe(menus);
    expect(setMenuLine(menus, wed, 'lunch', 0, chapati(2), NOW)).toBe(menus);
    expect(setMenuMeal(menus, wed, { ...wed.meals[1], lines: [chapati(2)] }, NOW)).toBe(menus);
    // A date that is only shown is not stored by an edit that names nothing on it.
    expect(setMenuLine(menus, menu('2026-10-30', 2, NOT_EDITED), 'supper', 0, chapati(4), NOW)).toBe(menus);
  });

  it('writing a date the meals it already has, or a deep copy of them, leaves the menus as they were and stamps nothing', () => {
    expect(setMenuDay(menus, wed, wed.meals, NOW)).toBe(menus);
    expect(setMenuDay(menus, wed, JSON.parse(JSON.stringify(wed.meals)), NOW)).toBe(menus);
    // A date that is only shown is not stored for being shown as it is.
    const shown = menu('2026-10-30', 2, NOT_EDITED);
    expect(setMenuDay(menus, shown, shown.meals, NOW)).toBe(menus);
    // Different meals are written and stamped.
    const out = setMenuDay(menus, wed, menu('2026-10-28', 4).meals, NOW);
    expect(lunchQty(menuFor('2026-10-28', out))).toBe(4);
    expect(menuFor('2026-10-28', out)!.editedAt).toBe(NOW.toISOString());
  });

  it('a copy is a deliberate act: it is stamped even when the date already had the same meals', () => {
    // Thursday already holds what Wednesday holds.
    const out = copyDay(wed, '2026-10-29', menus, NOW);
    expect(out).not.toBe(menus);
    expect(menuFor('2026-10-29', out)!.editedAt).toBe(NOW.toISOString());
    // An empty day copied onto a date nobody wrote is stored, stamped.
    const empty: DayMenu = { date: '2026-10-27', meals: [], editedAt: NOT_EDITED };
    const copied = copyDay(empty, '2026-10-31', menus, NOW);
    expect(menuFor('2026-10-31', copied)).toEqual({ date: '2026-10-31', meals: [], editedAt: NOW.toISOString() });
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

describe('the plan screen\'s view of this week', () => {
  it('shows the week Sunday first, as the old plan was', () => {
    const plan = weekPlanView(ensureWeek(MON, [menu('2026-10-26', 1), menu('2026-11-01', 7)], routine, foods));
    expect(lunchQty(plan.days[1])).toBe(1);
    expect(lunchQty(plan.days[0])).toBe(7);
  });

  it('writes back only the weekday that changed, to its own date', () => {
    const stored = [menu('2026-10-26', 1), menu('2026-10-28', 3)];
    const week = ensureWeek(MON, stored, routine, foods);
    const plan = weekPlanView(week);
    const edited = { days: plan.days.map((d, i) => (i === 3 ? { meals: d.meals.map((m) => (m.id === 'lunch' ? { ...m, lines: [chapati(5)] } : m)) } : d)) };
    const out = applyWeekPlan(edited, week, stored, NOW);
    expect(lunchQty(menuFor('2026-10-28', out))).toBe(5);
    expect(menuFor('2026-10-28', out)!.editedAt).toBe(NOW.toISOString());
    expect(menuFor('2026-10-26', out)).toBe(stored[0]);
    expect(out).toHaveLength(2);
    expect(applyWeekPlan(plan, week, stored, NOW)).toBe(stored);
  });

  it('a deep copy of the same plan, the way a screen hands it back, changes nothing', () => {
    const stored = [menu('2026-10-26', 1), menu('2026-10-28', 3)];
    const week = ensureWeek(MON, stored, routine, foods);
    const copy = JSON.parse(JSON.stringify(weekPlanView(week)));
    expect(applyWeekPlan(copy, week, stored, NOW)).toBe(stored);
  });
});

describe('a day with a plan', () => {
  it('is a day where some meal holds a line; meals with nothing planned are not a plan', () => {
    expect(hasPlan(menu('2026-10-28', 2))).toBe(true);
    expect(hasPlan({ meals: menu('2026-10-28', 2).meals.map((m) => ({ ...m, lines: [] })) })).toBe(false);
    expect(hasPlan({ meals: [] })).toBe(false);
    // A pattern whose slots the app has nothing to fill in with starts each day with empty meals: that is not a plan.
    const snacks: Routine = { ...routine, slots: [slot('mid', 'snack', '11:00', 50), slot('tea', 'snack', '17:00', 50)] };
    const fresh = viewMenu('2026-10-28', [], snacks, '2026-10-27', foods);
    expect(fresh.meals).toHaveLength(2);
    expect(hasPlan(fresh)).toBe(false);
    expect(hasPlan(viewMenu('2026-10-28', [], routine, '2026-10-27', foods))).toBe(true);
  });
});

describe('a suggested day', () => {
  const WED = '2026-10-28';
  const LAST_WED = '2026-10-21';

  it('is a day nobody wrote, as the app built it from the pattern, for a new person and for any pattern', () => {
    expect(isSuggested(viewMenu(WED, [], NEUTRAL_ROUTINE, '2026-10-27', foods), NEUTRAL_ROUTINE, foods)).toBe(true);
    expect(isSuggested(viewMenu(WED, [], routine, '2026-10-27', foods), routine, foods)).toBe(true);
    // Today, as the Today screen shows it.
    expect(isSuggested(viewMenu('2026-10-27', [], NEUTRAL_ROUTINE, '2026-10-27', foods), NEUTRAL_ROUTINE, foods)).toBe(true);
  });

  it('is not a day the person edited', () => {
    const shown = viewMenu(WED, [], NEUTRAL_ROUTINE, '2026-10-27', foods);
    const edited = addMenuLine([], shown, 'snack', { foodId: 'banana', unit: 'medium', qty: 1 }, NOW);
    expect(isSuggested(viewMenu(WED, edited, NEUTRAL_ROUTINE, '2026-10-27', foods), NEUTRAL_ROUTINE, foods)).toBe(false);
    expect(isSuggested(menu(WED, 2), routine, foods)).toBe(false);
  });

  it('is not a day carried forward from a day the person edited last week, though it carries no stamp', () => {
    const lastWeek = viewMenu(LAST_WED, [], NEUTRAL_ROUTINE, '2026-10-20', foods);
    const edited = addMenuLine([], lastWeek, 'snack', { foodId: 'banana', unit: 'medium', qty: 1 }, NOW);
    const carried = viewMenu(WED, edited, NEUTRAL_ROUTINE, '2026-10-27', foods);
    expect(carried.editedAt).toBe(NOT_EDITED);
    expect(isSuggested(carried, NEUTRAL_ROUTINE, foods)).toBe(false);
  });

  it('is not a day the old week plan was migrated onto when it differs from the pattern; one that matches the pattern still is', () => {
    const own = buildWeekPlan(NEUTRAL_ROUTINE, foods);
    own.days[3] = { meals: own.days[3].meals.map((m) => (m.id === 'lunch' ? { ...m, lines: [chapati(3)] } : m)) };
    const migrated = menusFromTemplate(own, MON, []);
    expect(menuFor(WED, migrated)!.editedAt).toBe(NOT_EDITED);
    expect(isSuggested(viewMenu(WED, migrated, NEUTRAL_ROUTINE, '2026-10-27', foods), NEUTRAL_ROUTINE, foods)).toBe(false);
    // Thursday kept the plan the app had built.
    expect(isSuggested(viewMenu('2026-10-29', migrated, NEUTRAL_ROUTINE, '2026-10-27', foods), NEUTRAL_ROUTINE, foods)).toBe(true);
  });
});

describe('dueAutoFills', () => {
  const state = {
    profile: { ...EMPTY_STATE.profile, onboarded: true },
    menus: [menu('2026-10-26', 2), menu('2026-10-27', 3)],
    routine,
    meals: [] as Meal[],
    slotSkips: [] as SlotSkip[],
    usage: [{ date: '2026-10-26', hour: 20, activeMinutes: 5 }],
    openedDates: [] as string[],
    settings: { ...EMPTY_STATE.settings, offDays: [] },
  };
  const now = new Date('2026-10-27T15:00:00');

  it('fills today and, when the app was open then, yesterday', () => {
    expect(dueAutoFills({ state, now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-26-lunch', 'auto-2026-10-27-lunch']);
    expect(dueAutoFills({ state: { ...state, usage: [] }, now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-27-lunch']);
  });

  it('never fills for someone who has not finished setup, and never twice', () => {
    expect(dueAutoFills({ state: { ...state, profile: { ...state.profile, onboarded: false } }, now, foods })).toEqual([]);
    const once = dueAutoFills({ state, now, foods });
    expect(dueAutoFills({ state: { ...state, meals: once }, now, foods })).toEqual([]);
  });

  it('fills nothing on or before the day setup was finished, as no meal prompt comes that day either', () => {
    const since = (onboardedOn: string) => ({ ...state, profile: { ...state.profile, onboardedOn } });
    expect(dueAutoFills({ state: since('2026-10-27'), now, foods })).toEqual([]);
    expect(dueAutoFills({ state: since('2026-10-26'), now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-27-lunch']);
  });

  it('counts a day the app was opened on even with no usage recorded, as on a phone', () => {
    const phone = { ...state, usage: [], openedDates: ['2026-10-26'] };
    expect(dueAutoFills({ state: phone, now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-26-lunch', 'auto-2026-10-27-lunch']);
  });
});

describe('the days the app was opened on', () => {
  it('adds today once and keeps the newest fourteen', () => {
    const once = withOpened([], '2026-10-27');
    expect(once).toEqual(['2026-10-27']);
    expect(withOpened(once, '2026-10-27')).toBe(once);
    const fortnight = Array.from({ length: 14 }, (_, i) => addDays('2026-10-13', i));
    expect(withOpened(fortnight, '2026-10-27')).toEqual([...fortnight.slice(1), '2026-10-27']);
  });
});

describe('the app\'s own run on open, every minute and on coming back to the front', () => {
  const now = new Date('2026-10-27T15:00:00');
  const person = {
    ...EMPTY_STATE,
    profile: { ...EMPTY_STATE.profile, onboarded: true },
    routine,
    menus: [menu('2026-10-26', 2), menu('2026-10-27', 3)],
    settings: { ...EMPTY_STATE.settings, offDays: [] },
  };

  it('leaves a device holding nobody\'s data exactly as it was, so it still reads as never used', () => {
    const out = withAutoFill(EMPTY_STATE, now, foods, 1600);
    expect(out).toBe(EMPTY_STATE);
    expect(isPristine(forCloud(out))).toBe(true);
  });

  it('marks today as a day the app was open and fills in what is due in one change, then has nothing more to do', () => {
    const out = withAutoFill(person, now, foods, 1600);
    expect(out.openedDates).toEqual(['2026-10-27']);
    expect(out.meals.map((m) => [m.id, m.source])).toEqual([['auto-2026-10-27-lunch', 'auto']]);
    expect(withAutoFill(out, now, foods, 1600)).toBe(out);
  });

  it('fills yesterday the next morning when the app was open yesterday', () => {
    const monday = withAutoFill(person, new Date('2026-10-26T09:00:00'), foods, 1600);
    expect(monday.meals).toEqual([]);
    const tuesday = withAutoFill(monday, new Date('2026-10-27T09:00:00'), foods, 1600);
    expect(tuesday.meals.map((m) => m.id)).toEqual(['auto-2026-10-26-lunch']);
    expect(tuesday.openedDates).toEqual(['2026-10-26', '2026-10-27']);
  });
});

describe('taking a meal away', () => {
  const d = '2026-10-27';
  const logged = (id: string, slotId: string, source: MealSource | undefined): Meal => ({ id, at: `${d}T07:30:00.000Z`, date: d, type: 'lunch', slotId, items: [], kcal: 400, protein: 10, source });

  it('a meal from the plan taken away marks its slot skipped, so the app does not fill it straight back', () => {
    const state = { meals: [logged(autoMealId(d, 'lunch'), 'lunch', 'auto')], slotSkips: [] as SlotSkip[] };
    const out = withMealRemoved(state, autoMealId(d, 'lunch'));
    expect(out.meals).toEqual([]);
    expect(out.slotSkips.map((s) => s.id)).toEqual(['2026-10-27:lunch']);
    const late = new Date(`${d}T22:00:00`);
    expect(autoFill({ date: d, now: late, menu: menu(d, 2), meals: out.meals, skips: out.slotSkips, openedDates: [], offDays: [], foods })).toEqual([]);
  });

  it('a hand-typed meal taken away leaves the skips as they are; an id that is not there changes nothing', () => {
    const state = { meals: [logged('m1', 'lunch', 'manual')], slotSkips: [] as SlotSkip[] };
    expect(withMealRemoved(state, 'm1')).toEqual({ meals: [], slotSkips: [] });
    expect(withMealRemoved(state, 'nope')).toBe(state);
  });

  it('leaves the meals settled, as every writer does: a filled-in copy in a slot skipped that date goes', () => {
    const state = { meals: [logged('p1', 'lunch', 'plan'), logged(autoMealId(d, 'dinner'), 'dinner', 'auto')], slotSkips: addSkip([], d, 'dinner') };
    const out = withMealRemoved(state, 'p1');
    expect(out.meals).toEqual([]);
    expect(out.slotSkips.map((s) => s.id)).toEqual(['2026-10-27:dinner', '2026-10-27:lunch']);
  });
});
