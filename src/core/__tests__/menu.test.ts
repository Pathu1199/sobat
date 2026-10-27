import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { EMPTY_STATE } from '../../store/defaults';
import { addDays, weekDates } from '../date';
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
  fitFor,
  hasPlan,
  isSuggested,
  mealFromLines,
  menuFor,
  menuSlots,
  menusFromTemplate,
  NOT_EDITED,
  removeSkip,
  setMenuDay,
  setMenuLine,
  setMenuMeal,
  settleAuto,
  skippedOn,
  skipsAfterRemove,
  suggestionFor,
  viewMenu,
  viewWeek,
  weekPlanView,
  withDayConfirmed,
  withMealAdded,
  withAutoFill,
  withMealConfirmed,
  withMealRemoved,
  withOpened,
  withoutOrphanedAuto,
  withoutSavedMeal,
  withSavedMeal,
  withSavedMealAt,
  withSkipAdded,
  type DayMenu,
  type MenuFit,
} from '../menu';
import { dailyTargets, KCAL_FLOOR, kcalForGrams } from '../nutrition';
import { dayRecord } from '../record';
import { forCloud, isPristine } from '../sync';
import { DEFAULT_ROUTINE, NEUTRAL_ROUTINE, ruleForFood, type PlanLine, type Routine, type RoutineSlot } from '../routine';
import type { FoodItem, Meal, MealSource, Profile, SlotSkip } from '../types';
import { buildWeekPlan, dayTotals, lineInfo, planDayFor, type PlanMeal } from '../weekPlan';

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
/** 20 October's menu, written then: an early breakfast, a midday meal and a supper, not the slots of today's pattern. */
const oldMenu: DayMenu = {
  date: '2026-10-20',
  editedAt: '2026-10-19T09:00:00.000Z',
  meals: [
    { id: 'early', type: 'breakfast', time: '07:00', lines: [] },
    { id: 'midday', type: 'lunch', time: '12:30', lines: [chapati(2)] },
    { id: 'supper', type: 'dinner', time: '19:00', lines: [] },
  ],
};
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

  it('no line in its place removes the line, and only that one, stamped', () => {
    const two = setMenuDay(menus, wed, menu('2026-10-28', 2).meals.map((m) => (m.id === 'lunch' ? { ...m, lines: [chapati(2), { foodId: 'moong-dal', unit: 'katori', qty: 1 }] } : m)), NOW);
    const out = setMenuLine(two, menuFor('2026-10-28', two)!, 'lunch', 0, null, NOW);
    expect(menuFor('2026-10-28', out)!.meals[1].lines).toEqual([{ foodId: 'moong-dal', unit: 'katori', qty: 1 }]);
    expect(menuFor('2026-10-28', setMenuLine(menus, wed, 'lunch', 0, null, NOW))!.meals[1].lines).toEqual([]);
    expect(menuFor('2026-10-28', setMenuLine(menus, wed, 'lunch', 0, null, NOW))!.editedAt).toBe(NOW.toISOString());
    expect(menuFor('2026-10-29', setMenuLine(menus, wed, 'lunch', 0, null, NOW))).toBe(thu);
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

  it('reshapes only the stored dates from today on; a past date comes back as the same object', () => {
    const past = menu('2026-10-26', 2);
    const list = [past, menu('2026-10-27', 2), menu('2026-10-29', 3)];
    const out = alignMenus(list, withTea, '2026-10-27', foods);
    expect(out[0]).toBe(past);
    expect(out.map((m) => m.meals.map((x) => x.id))).toEqual([
      ['morning', 'lunch', 'dinner'],
      ['morning', 'lunch', 'tea', 'dinner'],
      ['morning', 'lunch', 'tea', 'dinner'],
    ]);
    expect(out.map(lunchQty)).toEqual([2, 2, 3]);
    expect(out.map((m) => m.editedAt)).toEqual(list.map((m) => m.editedAt));
  });

  it('shows a stored date exactly as it is stored: the same object, a past one even when the slots have changed since', () => {
    const past = menu('2026-10-20', 1);
    const ahead = menu('2026-10-28', 2);
    const menus = [past, ahead];
    expect(viewMenu('2026-10-20', menus, withTea, '2026-10-27', foods)).toBe(past);
    expect(viewMenu('2026-10-28', menus, routine, '2026-10-27', foods)).toBe(ahead);
    expect(viewMenu('2026-10-28', menus, routine, '2026-10-27', foods, fitFor(EMPTY_STATE.profile, routine))).toBe(ahead);
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

  it('logs nothing into the future: a date after today gives no meal, and filling it from the plan gives none', () => {
    expect(mealFromLines({ id: 'x', date: '2026-10-28', slot: lunch, lines: lunch.lines, foods, source: 'plan', now: NOW })).toBeNull();
    expect(fillFromPlan({ now: NOW, menu: menu('2026-10-28', 2), meals: [], skips: [], foods })).toEqual([]);
    // Today, even before the slot's time, still logs.
    expect(fillFromPlan({ now: NOW, menu: menu('2026-10-27', 2), meals: [], skips: [], foods }).map((m) => m.slotId)).toEqual(['lunch']);
  });

  it('a menu meal with no usable time is read at the usual time for its kind of meal, as a slot is', () => {
    const dinner: PlanMeal = { id: 'dinner', type: 'dinner', time: '', lines: [chapati(1)] };
    expect(mealFromLines({ id: 'x', date: '2026-10-20', slot: dinner, lines: dinner.lines, foods, source: 'plan', now: NOW })!.at).toBe(new Date('2026-10-20T20:30:00').toISOString());
    const odd: DayMenu = { date: '2026-10-20', editedAt: '', meals: [dinner, { id: 'tea', type: 'snack', time: '25:99', lines: [] }] };
    expect(menuSlots(odd).map((s) => s.minutes)).toEqual([20 * 60 + 30, 16 * 60]);
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

  it('fills a 23:00 slot at 00:30 the next morning, on the slot\'s own date and at its own time', () => {
    const late: DayMenu = { date: '2026-10-26', editedAt: '', meals: [{ id: 'late', type: 'snack', time: '23:00', lines: [chapati(1)] }] };
    const yesterday = { ...base, date: '2026-10-26', menu: late, openedDates: ['2026-10-26'] };
    expect(autoFill({ ...yesterday, now: at('00:29') })).toEqual([]);
    const out = autoFill({ ...yesterday, now: at('00:30') });
    expect(out.map((m) => [m.id, m.date, m.slotId])).toEqual([['auto-2026-10-26-late', '2026-10-26', 'late']]);
    expect(out[0].at).toBe(at('23:00', '2026-10-26').toISOString());
  });

  it('fills a menu meal with no usable time 90 minutes after the usual time for its kind of meal', () => {
    const odd: DayMenu = { date: today, editedAt: '', meals: [{ id: 'dinner', type: 'dinner', time: '', lines: [chapati(1)] }] };
    expect(autoFill({ ...base, menu: odd, now: at('21:59') })).toEqual([]);
    expect(autoFill({ ...base, menu: odd, now: at('22:00') }).map((m) => m.at)).toEqual([at('20:30').toISOString()]);
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

  it('a meal taken away once its slot\'s fill-in moment has passed marks the slot skipped, whatever it was, so the plan does not fill it back', () => {
    const gone = auto('a', '2026-10-27', 'lunch');
    // Lunch is at 13:00, so the app would fill it in at 14:30.
    const after = { routine, menus: [] as DayMenu[], now: new Date('2026-10-27T14:30:00') };
    for (const source of ['auto', 'plan', 'manual', undefined] as const) {
      expect(skipsAfterRemove([], { ...gone, source }, [], after), String(source)).toEqual([{ id: '2026-10-27:lunch', date: '2026-10-27', slotId: 'lunch' }]);
    }
    // A meal that names no slot is matched to the slot it was eaten in, as the day's record matches it.
    expect(skipsAfterRemove([], { ...gone, slotId: undefined }, [], after).map((s) => s.id)).toEqual(['2026-10-27:lunch']);
  });

  it('before that moment nothing is marked: a meal logged into lunch by mistake at 08:00 and taken away leaves lunch to come', () => {
    const typo: Meal = { ...auto('a', '2026-10-27', 'lunch'), source: 'manual' };
    expect(skipsAfterRemove([], typo, [], { routine, menus: [], now: new Date('2026-10-27T08:00:00') })).toEqual([]);
    expect(skipsAfterRemove([], typo, [], { routine, menus: [], now: new Date('2026-10-27T14:29:00') })).toEqual([]);
    expect(skipsAfterRemove([], { ...typo, source: 'plan' }, [], { routine, menus: [], now: new Date('2026-10-27T14:29:00') })).toEqual([]);
  });

  it('on an earlier date the moment is that date\'s slot time plus 90 minutes too: yesterday\'s 20:00 dinner has passed in the small hours; on a later date it has not', () => {
    const now = new Date('2026-10-27T00:10:00');
    expect(skipsAfterRemove([], auto('a', '2026-10-26', 'dinner'), [], { routine, menus: [], now }).map((s) => s.id)).toEqual(['2026-10-26:dinner']);
    expect(skipsAfterRemove([], auto('a', '2026-10-20', 'morning'), [], { routine, menus: [], now }).map((s) => s.id)).toEqual(['2026-10-20:morning']);
    expect(skipsAfterRemove([], auto('a', '2026-10-28', 'morning'), [], { routine, menus: [], now: new Date('2026-10-27T22:00:00') })).toEqual([]);
  });

  it('yesterday\'s 23:00 slot is not filled in until 00:30: a meal taken away from it at 00:15 leaves it to come, and from 00:30 marks it', () => {
    const late: Routine = { ...routine, slots: [...routine.slots, slot('late', 'snack', '23:00', 10)] };
    const gone: Meal = { ...auto('a', '2026-10-26', 'late'), type: 'snack' };
    for (const source of ['auto', 'manual'] as const) {
      expect(skipsAfterRemove([], { ...gone, source }, [], { routine: late, menus: [], now: new Date('2026-10-27T00:15:00') }), source).toEqual([]);
      expect(skipsAfterRemove([], { ...gone, source }, [], { routine: late, menus: [], now: new Date('2026-10-27T00:30:00') }).map((s) => s.id), source).toEqual(['2026-10-26:late']);
    }
  });

  it('a hand-typed meal taken away from a date before yesterday marks nothing: the app never fills that date in, and an unasked skip would read the slot as settled', () => {
    const now = new Date('2026-10-27T10:00:00');
    const typed: Meal = { ...auto('a', '2026-10-25', 'lunch'), source: 'manual' };
    for (const source of ['manual', undefined] as const) {
      expect(skipsAfterRemove([], { ...typed, source }, [], { routine, menus: [], now }), String(source)).toEqual([]);
    }
    expect(withMealRemoved({ routine, menus: [], meals: [typed], slotSkips: [] }, 'a', now)).toEqual({ meals: [], slotSkips: [] });
    // Yesterday the app may still fill the slot in, so taking a typed meal away there marks it, as before.
    expect(skipsAfterRemove([], { ...typed, date: '2026-10-26' }, [], { routine, menus: [], now }).map((s) => s.id)).toEqual(['2026-10-26:lunch']);
    // A meal from the plan taken away marks its slot skipped on any date: the person said it was not eaten.
    for (const source of ['plan', 'auto'] as const) {
      expect(skipsAfterRemove([], { ...typed, source }, [], { routine, menus: [], now }).map((s) => s.id), source).toEqual(['2026-10-25:lunch']);
    }
  });

  it('a slot that still holds another meal that date is not marked', () => {
    const gone = auto('a', '2026-10-27', 'lunch');
    const other: Meal = { ...auto('b', '2026-10-27', 'lunch'), source: 'manual' };
    expect(skipsAfterRemove([], gone, [other], { routine, menus: [], now: new Date('2026-10-27T22:00:00') })).toEqual([]);
  });

  it('a meal that names no slot, taken away, is matched against its own date\'s menu, and the usual rule follows', () => {
    const loose: Meal = { id: 'x', at: new Date('2026-10-20T13:20:00').toISOString(), date: '2026-10-20', type: 'lunch', items: [], kcal: 400, protein: 10, source: 'manual' };
    // The next morning: a hand-typed meal is only marked up to yesterday.
    const at = { routine, menus: [oldMenu], now: new Date('2026-10-21T10:00:00') };
    expect(skipsAfterRemove([], loose, [], at).map((s) => s.id)).toEqual(['2026-10-20:midday']);
    // Another meal still in that slot, named or not, leaves it unmarked.
    expect(skipsAfterRemove([], loose, [{ ...loose, id: 'y', at: new Date('2026-10-20T12:50:00').toISOString() }], at)).toEqual([]);
    expect(skipsAfterRemove([], loose, [{ ...loose, id: 'z', slotId: 'midday' }], at)).toEqual([]);
    // Taken away through the state, the same.
    expect(withMealRemoved({ routine, menus: [oldMenu], meals: [loose], slotSkips: [] }, 'x', at.now).slotSkips.map((s) => s.id)).toEqual(['2026-10-20:midday']);
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

  it('any other meal keeps its source, and comes back with the edit', () => {
    for (const source of ['manual', 'plan', undefined] as const) {
      const prev: Meal = { ...base, source };
      const next = edit(prev);
      expect(editedMeal(prev, next)).toEqual(next);
      expect(editedMeal(prev, next).source).toBe(source);
    }
  });

  it('takes the source from the meal the state holds, not the copy the sheet opened with: confirmed meanwhile, it stays planned', () => {
    const snapshot: Meal = { ...base, source: 'auto' };
    expect(editedMeal({ ...base, source: 'plan' }, edit(snapshot))).toEqual({ ...edit(snapshot), source: 'plan' });
    expect(editedMeal({ ...base, source: 'manual' }, edit(snapshot)).source).toBe('manual');
    // Still filled in by the app when the edit lands: the edit confirms it, whatever the copy said.
    expect(editedMeal({ ...base, source: 'auto' }, edit({ ...base, source: 'manual' })).source).toBe('plan');
  });
});

describe('adding a meal to the state', () => {
  const d = '2026-10-27';
  const at = (hhmm: string, date = d) => new Date(`${date}T${hhmm}:00`);
  const real = (id: string, slotId: string | undefined, hhmm: string, date = d): Meal => ({ id, at: at(hhmm, date).toISOString(), date, type: 'snack', slotId, items: [], kcal: 300, protein: 10, source: 'manual' });
  const filled = (slotId: string, date = d): Meal => ({ id: autoMealId(date, slotId), at: at('13:00', date).toISOString(), date, type: 'lunch', slotId, items: [], kcal: 600, protein: 20, source: 'auto' });
  const state = (meals: Meal[], slotSkips: SlotSkip[] = [], menus: DayMenu[] = []) => ({ routine, menus, meals, slotSkips });

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

  it('a meal already in the state, by its id, is not added again, so it never counts twice', () => {
    const s = state([filled('lunch')], addSkip([], d, 'dinner'));
    const out = withMealAdded(s, filled('lunch'), 1600, at('15:00'));
    expect(out.meals).toBe(s.meals);
    expect(out.slotSkips).toBe(s.slotSkips);
  });

  it('Undo of a meal that replaced the one filled in from the plan: taking it away and putting the filled-in meal back through addMeal leaves the slot as it was, not skipped', () => {
    const before = state([filled('lunch')]);
    const now = at('15:00');
    const logged = { ...before, ...withMealAdded(before, real('m1', 'lunch', '14:50'), 1600, now) };
    expect(logged.meals.map((m) => m.id)).toEqual(['m1']);
    const removed = { ...logged, ...withMealRemoved(logged, 'm1', now) };
    expect(removed.slotSkips.map((x) => x.id)).toEqual(['2026-10-27:lunch']);
    const back = withMealAdded(removed, filled('lunch'), 1600, now);
    expect(back).toEqual({ meals: before.meals, slotSkips: [] });
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

  it('a meal on an earlier date that names no slot lands in a slot of that date\'s menu, never one of today\'s pattern', () => {
    const lunchThen: Meal = { ...real('m1', undefined, '13:20', '2026-10-20'), type: 'lunch' };
    expect(withMealAdded(state([], [], [oldMenu]), lunchThen, 1600, at('10:00')).meals[0]).toMatchObject({ slotId: 'midday', type: 'lunch' });
    // A date with no menu of its own shows the same weekday a week earlier, and takes its slots from there.
    expect(withMealAdded(state([], [], [{ ...oldMenu, date: '2026-10-13' }]), lunchThen, 1600, at('10:00')).meals[0]).toMatchObject({ slotId: 'midday' });
    // With no menu to show, the date shows the pattern's own slots.
    expect(withMealAdded(state([]), lunchThen, 1600, at('10:00')).meals[0]).toMatchObject({ slotId: 'lunch' });
    // Today's meals follow today's pattern, whatever an old menu said.
    const today: Meal = { ...real('m2', undefined, '09:10'), type: 'breakfast' };
    expect(withMealAdded(state([], [], [{ ...oldMenu, date: '2026-10-20' }]), today, 1600, at('15:00')).meals[0]).toMatchObject({ slotId: 'morning' });
  });

  it('a meal on an earlier date naming a slot that date does not have lands in a slot of that date\'s menu, so the filled-in meal there gives way and its skip lifts', () => {
    // A photo read a week late, or a meal typed on that date, named after today's pattern: 20 October's menu has a midday meal, not a lunch.
    const photo: Meal = { ...real('q-1', 'lunch', '12:45', '2026-10-20'), type: 'lunch', source: undefined, note: 'needs_review' };
    const settled = withMealAdded(state([filled('midday', '2026-10-20')], [], [oldMenu]), photo, 1600, at('10:00'));
    expect(settled.meals.map((m) => [m.id, m.slotId, m.type])).toEqual([['q-1', 'midday', 'lunch']]);
    const unskipped = withMealAdded(state([], addSkip([], '2026-10-20', 'midday'), [oldMenu]), photo, 1600, at('10:00'));
    expect(unskipped.slotSkips).toEqual([]);
    // A slot the date has is kept as named.
    const named = withMealAdded(state([], [], [oldMenu]), { ...photo, slotId: 'supper' }, 1600, at('10:00'));
    expect(named.meals[0]).toMatchObject({ slotId: 'supper', type: 'lunch' });
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

  it('a saved meal saved again under the same name moves to the end', () => {
    const poha = { id: 's2', name: 'Poha', lines: [{ foodId: 'poha', unit: 'katori', qty: 1 }] };
    const list = withSavedMeal(withSavedMeal([], thali), poha);
    expect(list.map((m) => m.id)).toEqual(['s1', 's2']);
    const again = withSavedMeal(list, { ...thali, name: 'My usual thali', lines: [chapati(3)] });
    expect(again.map((m) => [m.id, m.name])).toEqual([['s2', 'Poha'], ['s1', 'My usual thali']]);
    expect(again[1].lines).toEqual([chapati(3)]);
  });

  it('Undo puts a deleted saved meal back as it was: the same id, at the place it had', () => {
    const poha = { id: 's2', name: 'Poha', lines: [{ foodId: 'poha', unit: 'katori', qty: 1 }] };
    const upma = { id: 's3', name: 'Upma', lines: [{ foodId: 'upma', unit: 'katori', qty: 1 }] };
    const list = [thali, poha, upma];
    const after = withoutSavedMeal(list, 's2');
    expect(withSavedMealAt(after, poha, 1)).toEqual(list);
    expect(withSavedMealAt(withoutSavedMeal(list, 's1'), thali, 0)).toEqual(list);
    expect(withSavedMealAt(withoutSavedMeal(list, 's3'), upma, 2)).toEqual(list);
  });

  it('Undo puts it at the end when the list got shorter meanwhile, and does nothing when it is already back', () => {
    const poha = { id: 's2', name: 'Poha', lines: [{ foodId: 'poha', unit: 'katori', qty: 1 }] };
    expect(withSavedMealAt([thali], poha, 5).map((m) => m.id)).toEqual(['s1', 's2']);
    expect(withSavedMealAt([thali], poha, -1).map((m) => m.id)).toEqual(['s2', 's1']);
    const both = [thali, poha];
    expect(withSavedMealAt(both, poha, 0)).toBe(both);
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

describe('the app\'s suggestion fits the person\'s day', () => {
  const TODAY = '2026-10-27';
  const WED = '2026-10-28';
  // A new person: an 1800 kcal day, a 1200 kcal safe minimum, nothing avoided.
  const fit: MenuFit = { target: 1800, floor: 1200, avoided: new Set() };
  const kcal = (m: { meals: PlanMeal[] }) => dayTotals(m, foods).kcal;

  it('balances a new person\'s day to within 5% of the target, never under the floor, where the pattern alone is not enough', () => {
    // 5% either way is the band balanceDay stops in; a new person's four meals reach it on every weekday.
    for (const date of weekDates(MON)) {
      expect(kcal(viewMenu(date, [], NEUTRAL_ROUTINE, TODAY, foods))).toBeLessThan(1200);
      const k = kcal(viewMenu(date, [], NEUTRAL_ROUTINE, TODAY, foods, fit));
      expect(k).toBeGreaterThanOrEqual(1200);
      expect(k).toBeGreaterThanOrEqual(1800 * 0.95);
      expect(k).toBeLessThanOrEqual(1800 * 1.05);
    }
    // The week shows the same days.
    const week = viewWeek(MON, [], NEUTRAL_ROUTINE, TODAY, foods, fit);
    expect(week.map(kcal)).toEqual(weekDates(MON).map((d) => kcal(viewMenu(d, [], NEUTRAL_ROUTINE, TODAY, foods, fit))));
    expect(week.every((m) => m.editedAt === NOT_EDITED)).toBe(true);
  });

  it('never leaves a person whose target is the floor under it, on any weekday', () => {
    const floored: MenuFit = { target: 1200, floor: 1200, avoided: new Set() };
    for (const date of weekDates(MON)) {
      const k = kcal(viewMenu(date, [], NEUTRAL_ROUTINE, TODAY, foods, floored));
      expect(k).toBeGreaterThanOrEqual(1200);
      expect(k).toBeLessThanOrEqual(1200 * 1.1);
    }
  });

  it('never changes a stored day, or a day carried forward from an earlier week', () => {
    const stored = menu(WED, 2);
    expect(viewMenu(WED, [stored], routine, TODAY, foods, fit)).toBe(stored);
    expect(viewWeek(MON, [stored], routine, TODAY, foods, fit)[2]).toBe(stored);
    expect(viewMenu(WED, [menu('2026-10-21', 3)], routine, TODAY, foods, fit).meals).toEqual(menu('2026-10-21', 3).meals);
    expect(viewMenu(WED, [menu('2026-10-07', 4)], routine, TODAY, foods, fit).meals).toEqual(menu('2026-10-07', 4).meals);
  });

  it('reads the fitted day as the app\'s suggestion, and a day the person edited as theirs', () => {
    const shown = viewMenu(WED, [], NEUTRAL_ROUTINE, TODAY, foods, fit);
    expect(isSuggested(shown, NEUTRAL_ROUTINE, foods, fit)).toBe(true);
    const edited = addMenuLine([], shown, 'snack', { foodId: 'banana', unit: 'medium', qty: 1 }, NOW);
    expect(isSuggested(viewMenu(WED, edited, NEUTRAL_ROUTINE, TODAY, foods, fit), NEUTRAL_ROUTINE, foods, fit)).toBe(false);
    // The pattern's own lines, under the target, are not what the app suggests any more.
    expect(isSuggested(viewMenu(WED, [], NEUTRAL_ROUTINE, TODAY, foods), NEUTRAL_ROUTINE, foods, fit)).toBe(false);
  });

  it('is the pattern\'s own day when every food is avoided: nothing is added or made bigger, and it still reads as the suggestion', () => {
    const avoidAll: MenuFit = { target: 1800, floor: 1200, avoided: new Set(foods.map((f) => f.id)) };
    for (const date of weekDates(MON)) {
      const shown = viewMenu(date, [], NEUTRAL_ROUTINE, TODAY, foods, avoidAll);
      expect(shown.meals).toEqual(viewMenu(date, [], NEUTRAL_ROUTINE, TODAY, foods).meals);
      expect(kcal(shown)).toBeLessThan(1200);
      // So the line under the safe minimum, with the way to Balance, still shows.
      expect(isSuggested(shown, NEUTRAL_ROUTINE, foods, avoidAll)).toBe(true);
    }
  });

  it('never gives a person who avoids chapati more chapati than the pattern gave, and the app fills in no more of it', () => {
    const chapatiFood = foods.find((f) => f.id === 'chapati')!;
    const avoids = fitFor({ ...EMPTY_STATE.profile, sex: 'female' }, { ...NEUTRAL_ROUTINE, avoid: [ruleForFood(chapatiFood)] });
    expect([...avoids.avoided]).toEqual(['chapati']);
    const noChapati: MenuFit = { ...fit, avoided: avoids.avoided };
    const chapatiIn = (m: PlanMeal) => m.lines.filter((l) => l.foodId === 'chapati').reduce((a, l) => a + l.qty, 0);
    let pattern = 0;
    for (const date of weekDates(MON)) {
      const raw = viewMenu(date, [], NEUTRAL_ROUTINE, TODAY, foods);
      const shown = viewMenu(date, [], NEUTRAL_ROUTINE, TODAY, foods, noChapati);
      for (const m of shown.meals) expect(chapatiIn(m)).toBeLessThanOrEqual(chapatiIn(raw.meals.find((r) => r.id === m.id)!));
      pattern += raw.meals.reduce((a, m) => a + chapatiIn(m), 0);
      // The rest of the day is still fitted.
      expect(kcal(shown)).toBeGreaterThan(kcal(raw));
    }
    // The pattern does give chapati, so there was something to keep from growing.
    expect(pattern).toBeGreaterThan(0);
    const state = {
      profile: { ...EMPTY_STATE.profile, onboarded: true },
      menus: [] as DayMenu[],
      routine: NEUTRAL_ROUTINE,
      meals: [] as Meal[],
      slotSkips: [] as SlotSkip[],
      usage: [] as typeof EMPTY_STATE.usage,
      openedDates: [] as string[],
      settings: { ...EMPTY_STATE.settings, offDays: [] },
    };
    const now = new Date('2026-10-27T22:00:00');
    const chapatiGrams = (meals: Meal[]) => meals.flatMap((m) => m.items).filter((i) => i.foodId === 'chapati').reduce((a, i) => a + i.grams, 0);
    const filled = dueAutoFills({ state, now, foods, fit: noChapati });
    expect(filled.length).toBeGreaterThan(0);
    expect(chapatiGrams(filled)).toBeLessThanOrEqual(chapatiGrams(dueAutoFills({ state, now, foods })));
  });

  it('is what Rebuild puts back: the meals a date nobody wrote shows, as its own copy, so the day reads as the suggestion again', () => {
    const rebuilt = suggestionFor(WED, NEUTRAL_ROUTINE, foods, fit);
    expect(rebuilt.meals).toEqual(viewMenu(WED, [], NEUTRAL_ROUTINE, TODAY, foods, fit).meals);
    // Not the pattern's own lines, which are under the target.
    expect(rebuilt.meals).not.toEqual(viewMenu(WED, [], NEUTRAL_ROUTINE, TODAY, foods).meals);
    // Its own copy: changing it changes neither the next one nor the day shown.
    const before = structuredClone(rebuilt.meals);
    rebuilt.meals[1].lines[0].qty = 9;
    rebuilt.meals[1].lines.push(chapati(4));
    expect(suggestionFor(WED, NEUTRAL_ROUTINE, foods, fit).meals).toEqual(before);
    expect(viewMenu(WED, [], NEUTRAL_ROUTINE, TODAY, foods, fit).meals).toEqual(before);
    // A Wednesday the person edited, rebuilt through the plan screen's week, is the suggestion again.
    const week = viewWeek(MON, [], NEUTRAL_ROUTINE, TODAY, foods, fit);
    const edited = addMenuLine([], week[2], 'snack', { foodId: 'banana', unit: 'medium', qty: 1 }, NOW);
    const shownWeek = viewWeek(MON, edited, NEUTRAL_ROUTINE, TODAY, foods, fit);
    const plan = weekPlanView(shownWeek);
    plan.days[3] = suggestionFor(WED, NEUTRAL_ROUTINE, foods, fit);
    const later = new Date('2026-10-27T11:00:00');
    const out = applyWeekPlan(plan, shownWeek, edited, later);
    expect(menuFor(WED, out)!.editedAt).toBe(later.toISOString());
    expect(isSuggested(viewMenu(WED, out, NEUTRAL_ROUTINE, TODAY, foods, fit), NEUTRAL_ROUTINE, foods, fit)).toBe(true);
    // Rebuilding a day nobody wrote writes nothing.
    const fresh = weekPlanView(week);
    fresh.days[3] = suggestionFor(WED, NEUTRAL_ROUTINE, foods, fit);
    expect(applyWeekPlan(fresh, week, [], later)).toEqual([]);
  });

  it('is what the app fills in: the fitted lines, with calories from the food database at their grams', () => {
    const state = {
      profile: { ...EMPTY_STATE.profile, onboarded: true },
      menus: [] as DayMenu[],
      routine: NEUTRAL_ROUTINE,
      meals: [] as Meal[],
      slotSkips: [] as SlotSkip[],
      usage: [] as typeof EMPTY_STATE.usage,
      openedDates: [] as string[],
      settings: { ...EMPTY_STATE.settings, offDays: [] },
    };
    const now = new Date('2026-10-27T15:00:00');
    const planned = viewMenu(TODAY, [], NEUTRAL_ROUTINE, TODAY, foods, fit);
    const filled = dueAutoFills({ state, now, foods, fit });
    expect(filled.map((m) => m.slotId)).toEqual(['breakfast', 'lunch']);
    for (const m of filled) {
      const lines = planned.meals.find((p) => p.id === m.slotId)!.lines;
      const expected = lines.map((l) => {
        const i = lineInfo(l, foods)!;
        return [l.foodId, i.grams, kcalForGrams(i.food, i.grams).kcal];
      });
      expect(m.items.map((i) => [i.foodId, i.grams, i.kcal])).toEqual(expected);
      expect(m.kcal).toBe(m.items.reduce((a, i) => a + i.kcal, 0));
    }
    // Lunch is the fitted one, not the pattern's own.
    const raw = dueAutoFills({ state, now, foods });
    expect(filled[1].kcal).toBeGreaterThan(raw[1].kcal);
    // The app's own run fills in the same.
    const run = withAutoFill({ ...EMPTY_STATE, ...state }, now, foods, 1800, fit);
    expect(run.meals.map((m) => [m.id, m.kcal])).toEqual(filled.map((m) => [m.id, m.kcal]));
  });

  it('is fitted to the target and the floor Today shows, without the foods the person avoids', () => {
    const profile = { ...EMPTY_STATE.profile, sex: 'female' as const };
    const rice = foods.find((f) => f.id === 'steamed-rice')!;
    const f = fitFor(profile, { ...NEUTRAL_ROUTINE, avoid: [ruleForFood(rice)] });
    expect(f.target).toBe(dailyTargets(profile).kcal);
    expect(f.floor).toBe(KCAL_FLOOR.female);
    expect([...f.avoided]).toEqual(['steamed-rice']);
  });

  it('is fitted to the target of the date it is worked out on, as the person\'s age counts toward it', () => {
    const profile = { ...EMPTY_STATE.profile, sex: 'male' as const, birthYear: 1990, weightKg: 90, heightCm: 175, goalWeightKg: 75 };
    const eve = new Date('2026-12-31T12:00:00');
    const newYear = new Date('2027-01-01T12:00:00');
    expect(fitFor(profile, NEUTRAL_ROUTINE, eve).target).toBe(dailyTargets(profile, eve).kcal);
    expect(fitFor(profile, NEUTRAL_ROUTINE, newYear).target).toBe(dailyTargets(profile, newYear).kcal);
    expect(fitFor(profile, NEUTRAL_ROUTINE, newYear).target).toBeLessThan(fitFor(profile, NEUTRAL_ROUTINE, eve).target);
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

  it('fills nothing on or before the day the store moved to this version, read like the setup day; with both, the later holds', () => {
    const moved = (autoFillFrom: string, onboardedOn?: string) => ({ ...state, profile: { ...state.profile, autoFillFrom, onboardedOn } });
    expect(dueAutoFills({ state: moved('2026-10-27'), now, foods })).toEqual([]);
    expect(dueAutoFills({ state: moved('2026-10-26'), now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-27-lunch']);
    // One after today came from a clock that ran ahead, and is not heeded.
    expect(dueAutoFills({ state: moved('2026-10-29'), now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-26-lunch', 'auto-2026-10-27-lunch']);
    expect(dueAutoFills({ state: moved('2026-10-20', '2026-10-27'), now, foods })).toEqual([]);
    expect(dueAutoFills({ state: moved('2026-10-27', '2026-10-20'), now, foods })).toEqual([]);
    expect(dueAutoFills({ state: moved('2026-10-29', '2026-10-26'), now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-27-lunch']);
  });

  it('pays no heed to a setup date after today, as from a device whose clock ran ahead', () => {
    const ahead = { ...state, profile: { ...state.profile, onboardedOn: '2026-10-29' } };
    expect(dueAutoFills({ state: ahead, now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-26-lunch', 'auto-2026-10-27-lunch']);
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
  const late = new Date(`${d}T22:00:00`);
  const logged = (id: string, slotId: string, source: MealSource | undefined): Meal => ({ id, at: `${d}T07:30:00.000Z`, date: d, type: 'lunch', slotId, items: [], kcal: 400, protein: 10, source });

  it('a meal from the plan taken away marks its slot skipped, so the app does not fill it straight back', () => {
    const state = { routine, menus: [] as DayMenu[], meals: [logged(autoMealId(d, 'lunch'), 'lunch', 'auto')], slotSkips: [] as SlotSkip[] };
    const out = withMealRemoved(state, autoMealId(d, 'lunch'), late);
    expect(out.meals).toEqual([]);
    expect(out.slotSkips.map((s) => s.id)).toEqual(['2026-10-27:lunch']);
    expect(autoFill({ date: d, now: late, menu: menu(d, 2), meals: out.meals, skips: out.slotSkips, openedDates: [], offDays: [], foods })).toEqual([]);
  });

  it('a hand-typed meal taken away before its slot is filled in leaves the skips as they are; an id that is not there changes nothing', () => {
    const state = { routine, menus: [] as DayMenu[], meals: [logged('m1', 'lunch', 'manual')], slotSkips: [] as SlotSkip[] };
    expect(withMealRemoved(state, 'm1', new Date(`${d}T08:00:00`))).toEqual({ meals: [], slotSkips: [] });
    expect(withMealRemoved(state, 'nope', late)).toBe(state);
  });

  it('a hand-typed meal taken away after its slot would be filled in, as an Undo, marks it skipped so it is not filled back; eating there again lifts the skip', () => {
    const state = { routine, menus: [] as DayMenu[], meals: [logged('m1', 'lunch', 'manual')], slotSkips: [] as SlotSkip[] };
    const undone = withMealRemoved(state, 'm1', late);
    expect(undone.slotSkips.map((s) => s.id)).toEqual(['2026-10-27:lunch']);
    expect(autoFill({ date: d, now: late, menu: menu(d, 2), meals: undone.meals, skips: undone.slotSkips, openedDates: [], offDays: [], foods })).toEqual([]);
    expect(withMealAdded({ ...undone, routine, menus: [] }, logged('m2', 'lunch', 'manual'), 1600, late).slotSkips).toEqual([]);
  });

  it('leaves the meals settled, as every writer does: a filled-in copy in a slot skipped that date goes', () => {
    const state = { routine, menus: [] as DayMenu[], meals: [logged('p1', 'lunch', 'plan'), logged(autoMealId(d, 'dinner'), 'dinner', 'auto')], slotSkips: addSkip([], d, 'dinner') };
    const out = withMealRemoved(state, 'p1', late);
    expect(out.meals).toEqual([]);
    expect(out.slotSkips.map((s) => s.id)).toEqual(['2026-10-27:dinner', '2026-10-27:lunch']);
  });
});

describe('lived days keep their menu', () => {
  const TODAY = '2026-10-27';
  // 20 October 2026 is the Tuesday a week before.
  const TUE = '2026-10-20';
  const NOW_ = new Date('2026-10-27T10:00:00');
  const fit1800: MenuFit = { target: 1800, floor: 1200, avoided: new Set() };
  const fit1900: MenuFit = { target: 1900, floor: 1200, avoided: new Set() };
  const ate = (date: string, slotId: string, type: Meal['type']): Meal => ({ id: `${date}-${slotId}`, at: new Date(`${date}T12:00:00`).toISOString(), date, type, slotId, items: [], kcal: 600, protein: 20, source: 'manual' });
  const tuesday = [ate(TUE, 'breakfast', 'breakfast'), ate(TUE, 'lunch', 'lunch'), ate(TUE, 'dinner', 'dinner')];
  const person = {
    ...EMPTY_STATE,
    profile: { ...EMPTY_STATE.profile, onboarded: true },
    routine: NEUTRAL_ROUTINE,
    meals: tuesday,
    settings: { ...EMPTY_STATE.settings, offDays: [] },
  };
  const recordOn = (date: string, menus: DayMenu[], fit: MenuFit, meals = tuesday) =>
    dayRecord({ date, today: TODAY, menu: viewMenu(date, menus, NEUTRAL_ROUTINE, TODAY, foods, fit), routine: NEUTRAL_ROUTINE, meals, skips: [], offDays: [] }).state;

  it('a past Tuesday eaten in full stays full when the target moves, once kept', () => {
    expect(recordOn(TUE, [], fit1800)).toBe('full');
    // Rebuilt from today's fit, a day already lived would change: at 1900 the app's suggestion adds a snack the person never saw planned.
    expect(recordOn(TUE, [], fit1900)).toBe('partial');
    const run = withAutoFill(person, NOW_, foods, 1800, fit1800);
    expect(menuFor(TUE, run.menus)).toMatchObject({ editedAt: NOT_EDITED, frozen: true });
    expect(menuFor(TUE, run.menus)!.meals).toEqual(viewMenu(TUE, [], NEUTRAL_ROUTINE, TODAY, foods, fit1800).meals);
    expect(recordOn(TUE, run.menus, fit1900)).toBe('full');
  });

  it('keeps yesterday and every date of the fourteen before today with a meal or a skip, as it showed; a stored menu is never touched', () => {
    const edited = { ...menu('2026-10-23', 4) };
    const s = {
      ...person,
      menus: [edited],
      meals: [...tuesday, ate('2026-10-12', 'lunch', 'lunch'), ate('2026-10-23', 'lunch', 'lunch')],
      slotSkips: addSkip([], '2026-10-15', 'lunch'),
    };
    const out = withAutoFill(s, NOW_, foods, 1800, fit1800);
    // 12 October is fifteen days back, 22 October holds nothing, and today is still being lived.
    expect(out.menus.map((m) => m.date).sort()).toEqual(['2026-10-15', '2026-10-20', '2026-10-23', '2026-10-26']);
    expect(menuFor('2026-10-23', out.menus)).toBe(edited);
    for (const d of ['2026-10-15', TUE, '2026-10-26']) expect(menuFor(d, out.menus)).toEqual({ ...viewMenu(d, s.menus, NEUTRAL_ROUTINE, TODAY, foods, fit1800), frozen: true });
    // In the same change as the meals filled in today.
    expect(out.meals.filter((m) => m.source === 'auto').map((m) => m.id)).toEqual(['auto-2026-10-27-breakfast']);
    // Nothing more to do: the same state comes back.
    expect(withAutoFill(out, NOW_, foods, 1800, fit1800)).toBe(out);
  });

  it('keeps nothing on a device holding nobody\'s data, or on or before the day setup was finished or the store moved to this version', () => {
    const lived = { ...person, meals: [...tuesday, ate('2026-10-24', 'lunch', 'lunch')] };
    const nobody = { ...EMPTY_STATE, meals: lived.meals };
    expect(withAutoFill(nobody, NOW_, foods, 1800, fit1800)).toBe(nobody);
    const kept = (p: Partial<Profile>) => withAutoFill({ ...lived, profile: { ...lived.profile, ...p } }, NOW_, foods, 1800, fit1800).menus.map((m) => m.date).sort();
    expect(kept({})).toEqual(['2026-10-20', '2026-10-24', '2026-10-26']);
    expect(kept({ onboardedOn: '2026-10-21' })).toEqual(['2026-10-24', '2026-10-26']);
    expect(kept({ autoFillFrom: '2026-10-24' })).toEqual(['2026-10-26']);
    expect(kept({ onboardedOn: '2026-10-21', autoFillFrom: '2026-10-26' })).toEqual([]);
    // One after today came from a clock that ran ahead, and is not heeded.
    expect(kept({ autoFillFrom: '2026-10-29' })).toEqual(['2026-10-20', '2026-10-24', '2026-10-26']);
  });

  it('changes nothing another date shows: a kept day is that day\'s record, never carried forward to a later week', () => {
    const run = withAutoFill(person, NOW_, foods, 1800, fit1800);
    for (const d of [TODAY, '2026-10-28', '2026-11-02', '2026-11-03']) {
      expect(viewMenu(d, run.menus, NEUTRAL_ROUTINE, TODAY, foods, fit1900)).toEqual(viewMenu(d, person.menus, NEUTRAL_ROUTINE, TODAY, foods, fit1900));
    }
    // Once the person edits a kept day it is theirs, and a later week starts from it like any edited day.
    const kept = menuFor(TUE, run.menus)!;
    const edited = setMenuLine(run.menus, kept, 'lunch', 0, null, NOW_);
    expect(menuFor(TUE, edited)!.frozen).toBeUndefined();
    expect(viewMenu('2026-11-03', edited, NEUTRAL_ROUTINE, TODAY, foods, fit1900).meals).toEqual(menuFor(TUE, edited)!.meals);
  });
});

describe('slots taken out of the pattern', () => {
  const fill = (date: string, slotId: string, source: MealSource = 'auto'): Meal => ({ id: `${source}-${date}-${slotId}`, at: `${date}T10:30:00.000Z`, date, type: 'snack', slotId, items: [], kcal: 200, protein: 5, source });

  it('drop the meals the app filled in today and later in a slot the pattern no longer has, and no other meal', () => {
    // The routine has morning, lunch and dinner: the tea slot was taken out.
    const meals = [fill('2026-10-27', 'tea'), fill('2026-10-27', 'lunch'), fill('2026-10-26', 'tea'), fill('2026-10-27', 'tea', 'manual'), fill('2026-10-27', 'tea', 'plan')];
    const out = withoutOrphanedAuto(meals, routine, '2026-10-27');
    expect(out.map((m) => m.id)).toEqual(['auto-2026-10-27-lunch', 'auto-2026-10-26-tea', 'manual-2026-10-27-tea', 'plan-2026-10-27-tea']);
    expect(withoutOrphanedAuto(out, routine, '2026-10-27')).toBe(out);
  });
});
