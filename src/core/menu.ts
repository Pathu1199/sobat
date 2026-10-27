import { addDays, toISODate, weekDates } from './date';
import { toMealItem } from './foods';
import { slotOf, withSlot, type SlotPoint } from './pattern';
import { weekdayOf, type PlanLine, type Routine } from './routine';
import { stable } from './sync';
import type { FoodItem, ISODate, Meal, MealItem, MealSource, SavedMeal, SlotSkip } from './types';
import { isOffDay } from './week';
import { alignDay, lineInfo, planDayFor, type PlanMeal, type WeekPlan } from './weekPlan';

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

/** One skip per date and slot, with an id every device gives it, so two devices skipping the same meal merge into one record. */
export function skipId(date: ISODate, slotId: string): string {
  return `${date}:${slotId}`;
}

/** Record that a slot was not eaten on a date. The same list when it is already recorded. */
export function addSkip(skips: SlotSkip[], date: ISODate, slotId: string): SlotSkip[] {
  if (skips.some((s) => s.date === date && s.slotId === slotId)) return skips;
  return [...skips, { id: skipId(date, slotId), date, slotId }];
}

/** Take a skip away: "Ate this" or "Ate other" on a skipped slot. The same list when there was none. */
export function removeSkip(skips: SlotSkip[], date: ISODate, slotId: string): SlotSkip[] {
  const has = skips.some((s) => s.date === date && s.slotId === slotId);
  return has ? skips.filter((s) => !(s.date === date && s.slotId === slotId)) : skips;
}

/** The slot ids skipped on one date. */
export function skippedOn(skips: SlotSkip[], date: ISODate): string[] {
  return skips.filter((s) => s.date === date).map((s) => s.slotId);
}

function minutesOf(hhmm: string | undefined): number {
  const [h, m] = (hhmm ?? '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** A clock time to build a date-time from; noon when a menu meal has none. */
function clockOf(hhmm: string | undefined): string {
  return hhmm && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm) ? hhmm : '12:00';
}

/** A date's slots as its menu has them, to match meals against. */
export function menuSlots(menu: DayMenu): (SlotPoint & { meal: PlanMeal })[] {
  return menu.meals.map((m) => ({ id: m.id, type: m.type, minutes: minutesOf(m.time), meal: m }));
}

/** The menu's slots that hold any meal on its date, matched the way the day's slots are. */
export function eatenSlotIds(menu: DayMenu, meals: Meal[]): Set<string> {
  const slots = menuSlots(menu);
  const out = new Set<string>();
  for (const m of meals) {
    if (m.date !== menu.date) continue;
    const s = slotOf(m, slots);
    if (s) out.add(s.id);
  }
  return out;
}

/**
 * A meal made from planned lines: one item per line, its grams from the
 * line's measure, its calories from the food database at those grams. A food
 * the person made up keeps its estimated mark. It is logged at the slot's
 * time on that date, or now when that time has not come yet. Null when no
 * line names a food that exists.
 */
export function mealFromLines(input: {
  id: string;
  date: ISODate;
  slot: Pick<PlanMeal, 'id' | 'type' | 'time'>;
  lines: PlanLine[];
  foods: FoodItem[];
  source: MealSource;
  now: Date;
}): Meal | null {
  const items: MealItem[] = [];
  for (const line of input.lines) {
    const info = lineInfo(line, input.foods);
    if (info && info.grams > 0) items.push(toMealItem(info.food, info.grams, info.food.tags.includes('custom')));
  }
  if (items.length === 0) return null;
  const planned = new Date(`${input.date}T${clockOf(input.slot.time)}:00`);
  const at = planned.getTime() > input.now.getTime() ? input.now : planned;
  return {
    id: input.id,
    at: at.toISOString(),
    date: input.date,
    type: input.slot.type,
    slotId: input.slot.id,
    items,
    kcal: items.reduce((a, i) => a + i.kcal, 0),
    protein: Math.round(items.reduce((a, i) => a + i.protein, 0)),
    source: input.source,
  };
}

/** Minutes after a slot's time before the app fills it in from the plan. */
export const AUTO_FILL_AFTER_MIN = 90;

/** The id of a meal the app filled in: the same on every device, so two devices filling one slot make one meal, not two. */
export function autoMealId(date: ISODate, slotId: string): string {
  return `auto-${date}-${slotId}`;
}

/** The open slots of a date's menu: something planned, nothing eaten, not skipped. */
function openSlots(menu: DayMenu, meals: Meal[], skips: SlotSkip[]): PlanMeal[] {
  const eaten = eatenSlotIds(menu, meals);
  const skipped = new Set(skippedOn(skips, menu.date));
  return menu.meals.filter((m) => m.lines.length > 0 && !eaten.has(m.id) && !skipped.has(m.id));
}

/**
 * The planned meals the app logs by itself: a slot of the date's menu with
 * nothing eaten in it and no skip gets its planned meal 90 minutes after the
 * slot's time, marked 'auto' until the person confirms it. Only today, and
 * yesterday when the app was open yesterday; never an off day. Returns the
 * meals to add.
 */
export function autoFill(input: {
  date: ISODate;
  now: Date;
  menu: DayMenu | null;
  meals: Meal[];
  skips: SlotSkip[];
  /** Dates the app was open on (the usage buckets). */
  openedDates: ISODate[];
  offDays: number[];
  foods: FoodItem[];
}): Meal[] {
  const { date, now, menu } = input;
  if (!menu || menu.date !== date) return [];
  const today = toISODate(now);
  const yesterdayOpened = date === addDays(today, -1) && input.openedDates.includes(date);
  if (date !== today && !yesterdayOpened) return [];
  if (isOffDay(input.offDays, date)) return [];
  const out: Meal[] = [];
  for (const slot of openSlots(menu, input.meals, input.skips)) {
    const due = new Date(`${date}T${clockOf(slot.time)}:00`).getTime() + AUTO_FILL_AFTER_MIN * 60000;
    if (now.getTime() < due) continue;
    const meal = mealFromLines({ id: autoMealId(date, slot.id), date, slot, lines: slot.lines, foods: input.foods, source: 'auto', now });
    if (meal) out.push(meal);
  }
  return out;
}

/** "Fill this day from plan": every open slot of an older day, the kind the app was never open on, logged as planned. */
export function fillFromPlan(input: { now: Date; menu: DayMenu; meals: Meal[]; skips: SlotSkip[]; foods: FoodItem[] }): Meal[] {
  const { menu } = input;
  const out: Meal[] = [];
  for (const slot of openSlots(menu, input.meals, input.skips)) {
    const meal = mealFromLines({ id: `plan-${menu.date}-${slot.id}`, date: menu.date, slot, lines: slot.lines, foods: input.foods, source: 'plan', now: input.now });
    if (meal) out.push(meal);
  }
  return out;
}

/** A meal the app filled in, confirmed by the person: it now reads as eaten as planned. */
export function withMealConfirmed(meals: Meal[], id: string): Meal[] {
  if (!meals.some((m) => m.id === id && m.source === 'auto')) return meals;
  return meals.map((m): Meal => (m.id === id ? { ...m, source: 'plan' } : m));
}

/** "Day looks right": every meal the app filled in on that date, confirmed at once. */
export function withDayConfirmed(meals: Meal[], date: ISODate): Meal[] {
  if (!meals.some((m) => m.date === date && m.source === 'auto')) return meals;
  return meals.map((m): Meal => (m.date === date && m.source === 'auto' ? { ...m, source: 'plan' } : m));
}

/**
 * The skips after a meal is taken away. A meal that came from the plan and
 * is deleted was not eaten that way: when nothing else is left in its slot
 * that date, the slot is marked skipped, so the app does not fill it straight
 * back in. A meal typed in by hand leaves the skips as they are.
 */
export function skipsAfterRemove(skips: SlotSkip[], removed: Meal, rest: Meal[]): SlotSkip[] {
  if ((removed.source !== 'auto' && removed.source !== 'plan') || !removed.slotId) return skips;
  if (rest.some((m) => m.date === removed.date && m.slotId === removed.slotId)) return skips;
  return addSkip(skips, removed.date, removed.slotId);
}

/**
 * A real meal replaces the copy the app filled in. When a slot on a date also
 * holds a meal the person ate (typed in, eaten as planned or confirmed) or is
 * marked skipped that date, the unconfirmed meal the app filled in there
 * goes, so the day counts what was eaten once. Matched by slot id: a meal
 * that names no slot never takes anything away. The same list when nothing
 * goes.
 */
export function settleAuto(meals: Meal[], skips: SlotSkip[]): Meal[] {
  if (!meals.some((m) => m.source === 'auto' && m.slotId)) return meals;
  // One key per date and slot, the way a skip is named.
  const settled = new Set(skips.map((s) => skipId(s.date, s.slotId)));
  for (const m of meals) if (m.source !== 'auto' && m.slotId) settled.add(skipId(m.date, m.slotId));
  const kept = meals.filter((m) => !(m.source === 'auto' && m.slotId && settled.has(skipId(m.date, m.slotId))));
  return kept.length === meals.length ? meals : kept;
}

/**
 * A meal after the person edits it. Correcting a meal the app filled in
 * confirms it: it now reads as eaten as planned, so a later meal in its slot
 * or another device's meals arriving never take the correction away. Any
 * other meal keeps its source.
 */
export function editedMeal(prev: Meal, next: Meal): Meal {
  return prev.source === 'auto' ? { ...next, source: 'plan' } : next;
}

/** The parts of the state a meal or a skip changes. */
export type MealsAndSkips = { meals: Meal[]; slotSkips: SlotSkip[] };

/**
 * Every meal goes into the state this way: into the slot it is eaten in when
 * it names none (a photo, a recipe, the coach), a slot that gets a meal on a
 * date is no longer marked skipped that date, and a meal the app filled in
 * there from the plan gives way to it.
 */
export function withMealAdded(state: MealsAndSkips & { routine: Routine }, m: Meal, target: number, now: Date): MealsAndSkips {
  const today = toISODate(now);
  // The pattern is always on, so every meal finds its slot.
  const meal = withSlot(m, { routine: state.routine, target, meals: state.meals.filter((x) => x.date === today), skippedSlots: skippedOn(state.slotSkips, today), now });
  const slotSkips = meal.slotId ? removeSkip(state.slotSkips, meal.date, meal.slotId) : state.slotSkips;
  return { meals: settleAuto([...state.meals, meal], slotSkips), slotSkips };
}

/** A slot marked skipped on a date: it was not eaten, so the meal the app filled in there goes. The same lists when it was already skipped. */
export function withSkipAdded(state: MealsAndSkips, date: ISODate, slotId: string): MealsAndSkips {
  const slotSkips = addSkip(state.slotSkips, date, slotId);
  if (slotSkips === state.slotSkips) return { meals: state.meals, slotSkips };
  return { meals: settleAuto(state.meals, slotSkips), slotSkips };
}

/** Add or replace a saved meal. One without a name or without a line is not saved. */
export function withSavedMeal(list: SavedMeal[], meal: SavedMeal): SavedMeal[] {
  const name = meal.name.trim();
  if (!name || meal.lines.length === 0) return list;
  return [...list.filter((m) => m.id !== meal.id), { ...meal, name }];
}

export function withoutSavedMeal(list: SavedMeal[], id: string): SavedMeal[] {
  return list.some((m) => m.id === id) ? list.filter((m) => m.id !== id) : list;
}

/**
 * The old one-week plan written onto a real week: each date of the week
 * starting on `monday` that has no menu yet takes the template's day for its
 * weekday (index 0 is Sunday). A date that has a menu keeps it. Stamped as
 * written by the app. The same list when nothing was missing.
 */
export function menusFromTemplate(plan: WeekPlan, monday: ISODate, menus: DayMenu[]): DayMenu[] {
  const missing = weekDates(monday)
    .filter((date) => !menuFor(date, menus) && plan.days[weekdayOf(date)])
    .map((date): DayMenu => ({ date, meals: copyMeals(plan.days[weekdayOf(date)].meals), editedAt: NOT_EDITED }));
  return missing.length ? [...menus, ...missing] : menus;
}
