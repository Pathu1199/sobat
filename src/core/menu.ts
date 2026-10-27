import { addDays, toISODate, weekDates } from './date';
import { toMealItem } from './foods';
import { dailyTargets, KCAL_FLOOR } from './nutrition';
import { slotOf, withSlot, type SlotPoint } from './pattern';
import { avoidedFoodIds, slotMinutes, slotTime, weekdayOf, type PlanLine, type Routine, type RoutineSlot } from './routine';
import { stable } from './sync';
import type { AppState, FoodItem, ISODate, Meal, MealItem, MealSource, Profile, SavedMeal, SlotSkip } from './types';
import { isOffDay } from './week';
import { alignDay, balanceDay, lineInfo, planDayFor, type PlanDay, type PlanMeal, type WeekPlan } from './weekPlan';

/**
 * The menu, date by date. Each date holds its own meals, one per slot of the
 * eating pattern, each with its foods and quantities, so changing this
 * Wednesday never changes next Wednesday. A date nobody has written yet
 * starts as a copy of the same weekday a week earlier, so a week that is not
 * planned repeats the one before; with nothing earlier, it starts from the
 * pattern, fitted to the person's day. The week is a view over seven dates,
 * Monday to Sunday, never a stored object. Pure functions; the store keeps
 * the dates that were written.
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

/** What the app's own suggestion is fitted to: the person's day target, never under the safe minimum, with none of the foods they avoid. */
export type MenuFit = { target: number; floor: number; avoided: Set<string> };

/**
 * The fit for this person on the date of `now`: the target and the safe
 * minimum Today shows, and the routine's avoid list, the one Balance uses.
 * The target counts the person's age, so it can change at a new year.
 */
export function fitFor(profile: Profile, routine: Routine, now?: Date): MenuFit {
  return { target: dailyTargets(profile, now).kcal, floor: KCAL_FLOOR[profile.sex], avoided: avoidedFoodIds({ ...routine, enabled: true }) };
}

// The fitted day of each weekday, worked out once per fit, pattern and food list: the streak alone reads sixty dates.
const fitted = new WeakMap<MenuFit, { routine: Routine; foods: FoodItem[]; days: Map<number, PlanDay> }>();

/**
 * What the app suggests for a weekday nobody wrote: the pattern's own lines
 * for it and, given a fit, balanced to the person's day target and never
 * under the safe minimum, or as near as the foods allowed get. The fitted day
 * is shared by every caller, so it never leaves this file uncopied.
 */
function suggestedDay(routine: Routine, weekday: number, foods: FoodItem[], fit?: MenuFit): PlanDay {
  if (!fit) return planDayFor(routine, weekday, foods);
  let memo = fitted.get(fit);
  if (!memo || memo.routine !== routine || memo.foods !== foods) {
    memo = { routine, foods, days: new Map() };
    fitted.set(fit, memo);
  }
  let day = memo.days.get(weekday);
  if (!day) {
    day = balanceDay(planDayFor(routine, weekday, foods), foods, fit.target, fit.avoided, fit.floor).day;
    memo.days.set(weekday, day);
  }
  return day;
}

/**
 * What the app suggests for a date, fitted to the person's day when a fit is
 * given, as a copy of its own to keep or edit: the meals a date nobody wrote
 * shows when there is no earlier week to carry forward. Rebuild puts it back.
 */
export function suggestionFor(date: ISODate, routine: Routine, foods: FoodItem[], fit?: MenuFit): PlanDay {
  return { meals: copyMeals(suggestedDay(routine, weekdayOf(date), foods, fit).meals) };
}

/**
 * The menu a date starts as when nothing is stored for it: the same weekday a
 * week earlier; else the newest earlier menu of that weekday; else the app's
 * suggestion for that weekday, fitted to the person's day when a fit is
 * given. A day carried forward is copied as it was, never fitted.
 */
export function startingMenu(date: ISODate, menus: DayMenu[], routine: Routine, foods: FoodItem[], fit?: MenuFit): DayMenu {
  const wd = weekdayOf(date);
  const source =
    menuFor(addDays(date, -7), menus) ??
    menus.filter((m) => m.date < date && weekdayOf(m.date) === wd).sort((a, b) => b.date.localeCompare(a.date))[0] ??
    null;
  return { date, meals: source ? copyMeals(source.meals) : suggestionFor(date, routine, foods, fit).meals, editedAt: NOT_EDITED };
}

/** The seven menus of the week starting on `monday`, Monday first: a stored one as it is, a missing one as it starts. Never overwrites a stored date. */
export function ensureWeek(monday: ISODate, menus: DayMenu[], routine: Routine, foods: FoodItem[], fit?: MenuFit): DayMenu[] {
  return weekDates(monday).map((date) => menuFor(date, menus) ?? startingMenu(date, menus, routine, foods, fit));
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
export function viewMenu(date: ISODate, menus: DayMenu[], routine: Routine, today: ISODate, foods: FoodItem[], fit?: MenuFit): DayMenu {
  return alignMenu(menuFor(date, menus) ?? startingMenu(date, menus, routine, foods, fit), routine, today, foods);
}

/** The week starting on `monday` as it shows, Monday first. */
export function viewWeek(monday: ISODate, menus: DayMenu[], routine: Routine, today: ISODate, foods: FoodItem[], fit?: MenuFit): DayMenu[] {
  return ensureWeek(monday, menus, routine, foods, fit).map((m) => alignMenu(m, routine, today, foods));
}

/**
 * A day whose meals hold at least one planned line. Meals with nothing in
 * them (every line taken out, or slots the app had nothing to fill in with)
 * are not a plan, so there is no planned total to call too low.
 */
export function hasPlan(day: { meals: PlanMeal[] }): boolean {
  return day.meals.some((m) => m.lines.length > 0);
}

/**
 * A day that holds exactly what the app suggests for its weekday, fitted the
 * same way when a fit is given: the app's suggestion, not a plan the person
 * shaped. The stamp cannot tell them apart (a day carried forward from last
 * week and the migrated old plan are unstamped too), so the meals are
 * compared. A suggestion under the target is not the person's plan being too
 * low.
 */
export function isSuggested(day: { date: ISODate; meals: PlanMeal[] }, routine: Routine, foods: FoodItem[], fit?: MenuFit): boolean {
  return stable(day.meals) === stable(suggestedDay(routine, weekdayOf(day.date), foods, fit).meals);
}

/** Store one date's meals, stamped now, whatever they were before. */
function writeDay(menus: DayMenu[], date: ISODate, meals: PlanMeal[], now: Date): DayMenu[] {
  const next: DayMenu = { date, meals, editedAt: now.toISOString() };
  return menus.some((m) => m.date === date) ? menus.map((m) => (m.date === date ? next : m)) : [...menus, next];
}

/**
 * Write one date's meals, stamped now. `day` is that date's menu as it was
 * shown, stored or not; every other date is left as it is. Meals the same as
 * the ones shown leave the menus as they were and stamp nothing, so saving an
 * unchanged day never beats a real edit from another device.
 */
export function setMenuDay(menus: DayMenu[], day: DayMenu, meals: PlanMeal[], now: Date): DayMenu[] {
  if (stable(meals) === stable(day.meals)) return menus;
  return writeDay(menus, day.date, meals, now);
}

/**
 * One meal of one date changed by `change`. The same list when the date has
 * no meal with that slot id or the change leaves the meal as it was: an edit
 * that changes nothing is not stamped, so it never beats a real edit from
 * another device.
 */
function editMeal(menus: DayMenu[], day: DayMenu, mealId: string, change: (m: PlanMeal) => PlanMeal, now: Date): DayMenu[] {
  const at = day.meals.findIndex((m) => m.id === mealId);
  if (at < 0) return menus;
  const next = change(day.meals[at]);
  if (stable(next) === stable(day.meals[at])) return menus;
  return setMenuDay(menus, day, day.meals.map((m, i) => (i === at ? next : m)), now);
}

/** Change one line of one meal on one date. Null or a quantity of 0 removes the line; a line that is not there changes nothing. */
export function setMenuLine(menus: DayMenu[], day: DayMenu, mealId: string, lineIdx: number, next: PlanLine | null, now: Date): DayMenu[] {
  return editMeal(menus, day, mealId, (m) => {
    if (lineIdx < 0 || lineIdx >= m.lines.length) return m;
    const lines = m.lines.map((l, j) => (j === lineIdx ? next : l)).filter((l): l is PlanLine => !!l && l.qty > 0);
    return { ...m, lines };
  }, now);
}

/** Add a food to one meal on one date. The same food in the same measure again is a bigger portion, not a second line. */
export function addMenuLine(menus: DayMenu[], day: DayMenu, mealId: string, line: PlanLine, now: Date): DayMenu[] {
  return editMeal(menus, day, mealId, (m) => {
    const same = m.lines.findIndex((l) => l.foodId === line.foodId && l.unit === line.unit);
    const lines = same >= 0 ? m.lines.map((l, j) => (j === same ? { ...l, qty: l.qty + line.qty } : l)) : [...m.lines, line];
    return { ...m, lines };
  }, now);
}

/** Replace one meal of one date, matched by its slot id. */
export function setMenuMeal(menus: DayMenu[], day: DayMenu, meal: PlanMeal, now: Date): DayMenu[] {
  return editMeal(menus, day, meal.id, () => meal, now);
}

/**
 * Copy one date's meals onto another date. The copy is its own, so editing
 * one never edits the other. A copy is a deliberate act, so it is stamped
 * even when the date already held the same meals.
 */
export function copyDay(from: DayMenu, to: ISODate, menus: DayMenu[], now: Date): DayMenu[] {
  return writeDay(menus, to, copyMeals(from.meals), now);
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

/** A date's slots as its menu has them, to match meals against. A meal's time is read as a slot's is (`slotTime`). */
export function menuSlots(menu: DayMenu): (SlotPoint & { meal: PlanMeal })[] {
  return menu.meals.map((m) => ({ id: m.id, type: m.type, minutes: slotMinutes(m), meal: m }));
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
 * time on that date (`slotTime`), or now when that time has not come yet.
 * Null when no line names a food that exists, and for a date after today:
 * nothing is logged into the future.
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
  if (input.date > toISODate(input.now)) return null;
  const items: MealItem[] = [];
  for (const line of input.lines) {
    const info = lineInfo(line, input.foods);
    if (info && info.grams > 0) items.push(toMealItem(info.food, info.grams, info.food.tags.includes('custom')));
  }
  if (items.length === 0) return null;
  const planned = new Date(`${input.date}T${slotTime(input.slot)}:00`);
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

/** When the app fills a slot of a date in from the plan: the slot's time that date plus AUTO_FILL_AFTER_MIN, so a 23:00 slot is filled at 00:30 the next day. */
function autoFillAt(date: ISODate, slot: Pick<RoutineSlot, 'type' | 'time'>): number {
  return new Date(`${date}T${slotTime(slot)}:00`).getTime() + AUTO_FILL_AFTER_MIN * 60000;
}

/**
 * Whether the moment the app fills a slot in from the plan has passed on a
 * date: always on an earlier date, never on a later one, and today once the
 * slot's time plus AUTO_FILL_AFTER_MIN has come.
 */
export function autoFillPassed(date: ISODate, slot: Pick<RoutineSlot, 'type' | 'time'>, now: Date): boolean {
  const today = toISODate(now);
  if (date !== today) return date < today;
  return now.getTime() >= autoFillAt(date, slot);
}

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
  /** Dates the app was open on (`dueAutoFills` reads them from the opened dates and the usage buckets). */
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
    if (now.getTime() < autoFillAt(date, slot)) continue;
    const meal = mealFromLines({ id: autoMealId(date, slot.id), date, slot, lines: slot.lines, foods: input.foods, source: 'auto', now });
    if (meal) out.push(meal);
  }
  return out;
}

/** "Fill this day from plan": every open slot of an older day, the kind the app was never open on, logged as planned. Nothing for a date after today. */
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
 * The skips after a meal is taken away. When nothing else is left in its slot
 * that date and the moment the app fills that slot in from the plan has
 * passed (`autoFillPassed`), the slot is marked skipped, whatever the meal
 * was, so the app does not fill it straight back in: a deleted meal from the
 * plan, or an Undo of one typed in by hand. Before that moment nothing is
 * marked, so a meal logged into lunch by mistake at 08:00 and taken away
 * leaves lunch to come. Eating in the slot later lifts the skip, as always.
 * Today's slot time is the pattern's (today's menu follows it); a slot no
 * longer in the pattern takes the usual time for the meal's kind.
 */
export function skipsAfterRemove(skips: SlotSkip[], removed: Meal, rest: Meal[], at: { routine: Routine; now: Date }): SlotSkip[] {
  const slotId = removed.slotId;
  if (!slotId) return skips;
  if (rest.some((m) => m.date === removed.date && m.slotId === slotId)) return skips;
  const slot = at.routine.slots.find((s) => s.id === slotId) ?? { type: removed.type };
  return autoFillPassed(removed.date, slot, at.now) ? addSkip(skips, removed.date, slotId) : skips;
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
 * A meal after the person edits it. `prev` is the meal as the state holds it
 * now, `next` the edit, made on the copy the sheet opened with; the source is
 * the state's, never the copy's, so a meal confirmed while the sheet was open
 * stays confirmed. Correcting a meal the app filled in confirms it: it now
 * reads as eaten as planned, so a later meal in its slot or another device's
 * meals arriving never take the correction away. Any other meal keeps its
 * source.
 */
export function editedMeal(prev: Meal, next: Meal): Meal {
  return { ...next, source: prev.source === 'auto' ? 'plan' : prev.source };
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

/**
 * A meal taken away. Once the app would have filled its slot in from the plan,
 * the slot is marked skipped that date when nothing else is left in it
 * (`skipsAfterRemove`), so it is not filled straight back; the meals are
 * settled again like every other write. The same state when there is no meal
 * with that id.
 */
export function withMealRemoved(state: MealsAndSkips & { routine: Routine }, id: string, now: Date): MealsAndSkips {
  const gone = state.meals.find((m) => m.id === id);
  if (!gone) return state;
  const rest = state.meals.filter((m) => m.id !== id);
  const slotSkips = skipsAfterRemove(state.slotSkips, gone, rest, { routine: state.routine, now });
  return { meals: settleAuto(rest, slotSkips), slotSkips };
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
 *
 * Given the pattern it was built from (`built`: the routine and every food,
 * the person's own included), a day still exactly as the app built it from
 * that pattern is not written either: the old plan screen saved the week it
 * built the first time it was opened, so that day is the app's and not the
 * person's, and its date shows the app's suggestion, fitted to the person,
 * like any date nobody wrote. A day the person changed is written.
 */
export function menusFromTemplate(plan: WeekPlan, monday: ISODate, menus: DayMenu[], built?: { routine: Routine; foods: FoodItem[] }): DayMenu[] {
  const asBuilt = (day: PlanDay, weekday: number) => !!built && stable(day.meals) === stable(planDayFor(built.routine, weekday, built.foods).meals);
  const missing = weekDates(monday)
    .filter((date) => !menuFor(date, menus) && plan.days[weekdayOf(date)] && !asBuilt(plan.days[weekdayOf(date)], weekdayOf(date)))
    .map((date): DayMenu => ({ date, meals: copyMeals(plan.days[weekdayOf(date)].meals), editedAt: NOT_EDITED }));
  return missing.length ? [...menus, ...missing] : menus;
}

/** The week's menus in the old one-week shape, index 0 being Sunday, for the plan screen until it is rebuilt. */
export function weekPlanView(week: DayMenu[]): WeekPlan {
  const days: PlanDay[] = Array.from({ length: 7 }, () => ({ meals: [] }));
  for (const m of week) days[weekdayOf(m.date)] = { meals: m.meals };
  return { days };
}

/** An edit made on that view, written back: each weekday that changed goes to its own date in the week, stamped now; the rest stay as they are. */
export function applyWeekPlan(plan: WeekPlan, week: DayMenu[], menus: DayMenu[], now: Date): DayMenu[] {
  let out = menus;
  for (const day of week) {
    const next = plan.days[weekdayOf(day.date)];
    if (next && stable(next.meals) !== stable(day.meals)) out = setMenuDay(out, day, next.meals, now);
  }
  return out;
}

/** How many of the dates the app was opened on this device keeps. Only yesterday is ever read. */
export const OPENED_DAYS = 14;

/** Today added to the dates the app was opened on, once, keeping the newest OPENED_DAYS. The same list when today is already there. */
export function withOpened(dates: ISODate[], today: ISODate): ISODate[] {
  return dates.includes(today) ? dates : [...dates, today].slice(-OPENED_DAYS);
}

/**
 * The meals the app fills in right now, across yesterday and today, for a
 * person who has finished setup; a device holding nobody's data stays empty.
 * Nothing is filled on or before the day setup was finished: the meals before
 * it were never planned, and no meal prompt comes that day either. A setup
 * date after today is not heeded: it came from a device whose clock ran
 * ahead, and must not hold auto-fill off on every device. The app
 * counts as open on a date it recorded opening on, or one with usage buckets.
 * A meal already in the list (same id) is not returned again. A date nobody
 * wrote fills in the app's suggestion, fitted when a fit is given.
 */
export function dueAutoFills(input: {
  state: Pick<AppState, 'profile' | 'menus' | 'routine' | 'meals' | 'slotSkips' | 'usage' | 'openedDates' | 'settings'>;
  now: Date;
  foods: FoodItem[];
  fit?: MenuFit;
}): Meal[] {
  const { state, now, foods, fit } = input;
  if (!state.profile.onboarded) return [];
  const today = toISODate(now);
  const openedDates = Array.from(new Set([...state.openedDates, ...state.usage.map((u) => u.date)]));
  const out: Meal[] = [];
  const since = state.profile.onboardedOn && state.profile.onboardedOn <= today ? state.profile.onboardedOn : undefined;
  for (const date of [addDays(today, -1), today]) {
    if (since && date <= since) continue;
    const menu = viewMenu(date, state.menus, state.routine, today, foods, fit);
    out.push(...autoFill({ date, now, menu, meals: state.meals, skips: state.slotSkips, openedDates, offDays: state.settings.offDays ?? [], foods }));
  }
  return out.filter((m) => !state.meals.some((x) => x.id === m.id));
}

/**
 * The app's own bookkeeping, run on open, every minute and whenever the app
 * comes back to the front: today is marked as a day the app was open, then
 * the planned meals that are due are filled in, all in one change. Only for a
 * person who finished setup: a device holding nobody's data is left exactly
 * as it is, so sync still treats it as never used. The same state when there
 * is nothing to do. `fit` fits the days nobody wrote, as they show.
 */
export function withAutoFill(state: AppState, now: Date, foods: FoodItem[], target: number, fit?: MenuFit): AppState {
  if (!state.profile.onboarded) return state;
  const openedDates = withOpened(state.openedDates, toISODate(now));
  const opened = openedDates === state.openedDates ? state : { ...state, openedDates };
  return dueAutoFills({ state: opened, now, foods, fit }).reduce((acc, m) => ({ ...acc, ...withMealAdded(acc, m, target, now) }), opened);
}
