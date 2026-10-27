import { addDays, weekDates } from './date';
import { weekdayOf, type PlanLine, type Routine } from './routine';
import { stable } from './sync';
import type { FoodItem, ISODate } from './types';
import { alignDay, planDayFor, type PlanMeal } from './weekPlan';

/**
 * The menu, date by date. Each date holds its own meals, one per slot of the
 * eating pattern, each with its foods and quantities, so changing this
 * Wednesday never changes next Wednesday. A date nobody has written yet
 * starts as a copy of the same weekday a week earlier, so a week that is not
 * planned repeats the one before; with nothing earlier, it starts from the
 * pattern. The week is a view over seven dates, Monday to Sunday, never a
 * stored object. Pure functions; the store keeps the dates that were written.
 */
export type DayMenu = {
  date: ISODate;
  /** One meal per slot; `id` is the slot id. */
  meals: PlanMeal[];
  /** ISO time of the last edit, so sync keeps the newer of two edits. NOT_EDITED for a menu the app wrote and nobody changed. */
  editedAt: string;
};

/** The stamp of a menu the app wrote and nobody has edited: any real edit is newer. */
export const NOT_EDITED = '';

export function menuFor(date: ISODate, menus: DayMenu[]): DayMenu | null {
  return menus.find((m) => m.date === date) ?? null;
}

function copyMeals(meals: PlanMeal[]): PlanMeal[] {
  return meals.map((m) => ({ ...m, lines: m.lines.map((l) => ({ ...l })) }));
}

/**
 * The menu a date starts as when nothing is stored for it: the same weekday a
 * week earlier; else the newest earlier menu of that weekday; else the
 * pattern's own lines for that weekday, the way the week plan was built.
 */
export function startingMenu(date: ISODate, menus: DayMenu[], routine: Routine, foods: FoodItem[]): DayMenu {
  const wd = weekdayOf(date);
  const source =
    menuFor(addDays(date, -7), menus) ??
    menus.filter((m) => m.date < date && weekdayOf(m.date) === wd).sort((a, b) => b.date.localeCompare(a.date))[0] ??
    null;
  return { date, meals: source ? copyMeals(source.meals) : planDayFor(routine, wd, foods).meals, editedAt: NOT_EDITED };
}

/** The seven menus of the week starting on `monday`, Monday first: a stored one as it is, a missing one as it starts. Never overwrites a stored date. */
export function ensureWeek(monday: ISODate, menus: DayMenu[], routine: Routine, foods: FoodItem[]): DayMenu[] {
  return weekDates(monday).map((date) => menuFor(date, menus) ?? startingMenu(date, menus, routine, foods));
}

/**
 * A date's meals reshaped to the current slots, the way alignWeekPlan
 * reshapes the plan. Only today and later dates follow the slots; a past date
 * is history and keeps the meals it had. The same object comes back when
 * nothing moves. The stamp is kept: following the slots is not an edit, and
 * every device reshapes the same way.
 */
export function alignMenu(menu: DayMenu, routine: Routine, today: ISODate, foods?: FoodItem[]): DayMenu {
  if (menu.date < today) return menu;
  const meals = alignDay({ meals: menu.meals }, routine, weekdayOf(menu.date), foods).meals;
  return stable(meals) === stable(menu.meals) ? menu : { ...menu, meals };
}

/** Every stored menu from today on, following the slots. The same list when none moved. */
export function alignMenus(menus: DayMenu[], routine: Routine, today: ISODate, foods?: FoodItem[]): DayMenu[] {
  let changed = false;
  const out = menus.map((m) => {
    const next = alignMenu(m, routine, today, foods);
    if (next !== m) changed = true;
    return next;
  });
  return changed ? out : menus;
}

/** The menu a date shows: the stored one or the one it starts as, following the slots from today on. */
export function viewMenu(date: ISODate, menus: DayMenu[], routine: Routine, today: ISODate, foods: FoodItem[]): DayMenu {
  return alignMenu(menuFor(date, menus) ?? startingMenu(date, menus, routine, foods), routine, today, foods);
}

/** The week starting on `monday` as it shows, Monday first. */
export function viewWeek(monday: ISODate, menus: DayMenu[], routine: Routine, today: ISODate, foods: FoodItem[]): DayMenu[] {
  return ensureWeek(monday, menus, routine, foods).map((m) => alignMenu(m, routine, today, foods));
}

/** Write one date's meals, stamped now. `day` is that date's menu as it was shown, stored or not; every other date is left as it is. */
export function setMenuDay(menus: DayMenu[], day: DayMenu, meals: PlanMeal[], now: Date): DayMenu[] {
  const next: DayMenu = { date: day.date, meals, editedAt: now.toISOString() };
  return menus.some((m) => m.date === day.date) ? menus.map((m) => (m.date === day.date ? next : m)) : [...menus, next];
}

/** Change one line of one meal on one date. Null or a quantity of 0 removes the line. */
export function setMenuLine(menus: DayMenu[], day: DayMenu, mealId: string, lineIdx: number, next: PlanLine | null, now: Date): DayMenu[] {
  const meals = day.meals.map((m) => {
    if (m.id !== mealId) return m;
    const lines = m.lines.map((l, j) => (j === lineIdx ? next : l)).filter((l): l is PlanLine => !!l && l.qty > 0);
    return { ...m, lines };
  });
  return setMenuDay(menus, day, meals, now);
}

/** Add a food to one meal on one date. The same food in the same measure again is a bigger portion, not a second line. */
export function addMenuLine(menus: DayMenu[], day: DayMenu, mealId: string, line: PlanLine, now: Date): DayMenu[] {
  const meals = day.meals.map((m) => {
    if (m.id !== mealId) return m;
    const same = m.lines.findIndex((l) => l.foodId === line.foodId && l.unit === line.unit);
    const lines = same >= 0 ? m.lines.map((l, j) => (j === same ? { ...l, qty: l.qty + line.qty } : l)) : [...m.lines, line];
    return { ...m, lines };
  });
  return setMenuDay(menus, day, meals, now);
}

/** Replace one meal of one date, matched by its slot id. */
export function setMenuMeal(menus: DayMenu[], day: DayMenu, meal: PlanMeal, now: Date): DayMenu[] {
  return setMenuDay(menus, day, day.meals.map((m) => (m.id === meal.id ? meal : m)), now);
}

/** Copy one date's meals onto another date. The copy is its own, so editing one never edits the other. */
export function copyDay(from: DayMenu, to: ISODate, menus: DayMenu[], now: Date): DayMenu[] {
  const target = menuFor(to, menus) ?? { date: to, meals: [], editedAt: NOT_EDITED };
  return setMenuDay(menus, target, copyMeals(from.meals), now);
}
