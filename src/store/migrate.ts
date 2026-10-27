import { Platform } from 'react-native';
import { DEFAULT_BREAK_SETTINGS, type BreakLog, type BreakSettings } from '../core/breaks';
import { mondayOf, toISODate } from '../core/date';
import { addSkip, menusFromTemplate, settleAuto, type DayMenu } from '../core/menu';
import { slotShare } from '../core/pattern';
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, DINNER_SLOT, NEUTRAL_ROUTINE, SKIP_PREFIX, type RoutineSlot } from '../core/routine';
import { forCloud, stable, type CloudState } from '../core/sync';
import { normalizeTabs, normalizeTodayCards } from '../core/tabs';
import type { AppState, FoodItem, ISODate, Meal, SavedMeal, SlotSkip } from '../core/types';
import { alignWeekPlan, type WeekPlan } from '../core/weekPlan';
import { allFoods, DEFAULT_OLLAMA_URL, EMPTY_STATE, OLD_OLLAMA_PLACEHOLDER, STATE_VERSION } from './defaults';

/** The shape break settings had in version 1. */
type V1BreakSettings = {
  enabled?: boolean;
  workMinutes?: number;
  breakSeconds?: number;
  allowSkip?: boolean;
  quietStartHour?: number;
  quietEndHour?: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** True once the settings carry the four-kind shape. */
function isV2Settings(v: unknown): v is BreakSettings {
  return isRecord(v) && isRecord(v.micro) && isRecord(v.long);
}

function upgradeSettings(old: unknown): BreakSettings {
  // A phone should not blank its own screen every twenty minutes. Long breaks
  // and posture still arrive as notifications.
  const phone = Platform.OS !== 'web';
  const base: BreakSettings = phone
    ? { ...DEFAULT_BREAK_SETTINGS, micro: { ...DEFAULT_BREAK_SETTINGS.micro, enabled: false } }
    : DEFAULT_BREAK_SETTINGS;
  if (isV2Settings(old)) return { ...base, ...old };
  const v1 = (isRecord(old) ? old : {}) as V1BreakSettings;
  return {
    ...base,
    enabled: v1.enabled ?? base.enabled,
    micro: {
      ...base.micro,
      everyMinutes: v1.workMinutes ?? base.micro.everyMinutes,
      seconds: v1.breakSeconds ?? base.micro.seconds,
    },
    strictness: v1.allowSkip === false ? 'strict' : 'normal',
    quietStartHour: v1.quietStartHour ?? base.quietStartHour,
    quietEndHour: v1.quietEndHour ?? base.quietEndHour,
  };
}

function upgradeLogs(old: unknown, microSeconds: number): BreakLog[] {
  if (!Array.isArray(old)) return [];
  return old.map((raw) => {
    const l = (isRecord(raw) ? raw : {}) as Partial<BreakLog> & { workedMinutes?: number };
    return {
      id: String(l.id ?? Date.now()),
      date: String(l.date ?? ''),
      at: String(l.at ?? ''),
      // Every break logged before this version was the single timer, i.e. micro.
      kind: l.kind ?? 'micro',
      action: l.action === 'skipped' ? 'skipped' : 'taken',
      workedMinutes: Number(l.workedMinutes ?? 0),
      seconds: Number(l.seconds ?? microSeconds),
    };
  });
}

/** The shipped example routine, never edited: the same slots, compared by id. */
function untouchedExample(slots: RoutineSlot[]): boolean {
  const byId = (list: RoutineSlot[]) => stable([...list].sort((a, b) => a.id.localeCompare(b.id)));
  return byId(slots) === byId(DEFAULT_ROUTINE.slots);
}

/** The four meals of the day, each with its own lists. */
function defaultSlots(): RoutineSlot[] {
  return DEFAULT_SLOTS.map((s) => ({ ...s, options: [[]] }));
}

/** True when a stored field still holds the shipped example's value. */
function untouched(value: unknown, example: unknown): boolean {
  return stable(value) === stable(example);
}

/** Routine meals saved before they had times get the default time for their id, else a sensible one by meal. */
function upgradeRoutine(old: unknown, fromVersion: number, hadPlan: boolean): AppState['routine'] {
  const r = { ...EMPTY_STATE.routine, ...(isRecord(old) ? old : {}) } as AppState['routine'];
  // Before version 3 the pattern was on by default, not by choice (version 3 switched every older store off).
  const wasOn = fromVersion >= 3 && r.enabled === true;
  const byType: Record<string, string> = { breakfast: '08:30', lunch: '13:00', snack: '16:00', dinner: '20:30' };
  r.slots = (Array.isArray(r.slots) ? r.slots : []).map((s) =>
    s.time ? s : { ...s, time: DEFAULT_ROUTINE.slots.find((d) => d.id === s.id)?.time ?? byType[s.type] ?? '13:00' },
  );
  // Version 6: every slot carries a share of the day's calories (a default slot the curated one, so a migrated routine divides the day like a fresh one), and a store from before it gets a dinner to plan; one removed on purpose later stays removed.
  r.slots = r.slots.map((s) => (typeof s.share === 'number' ? s : { ...s, share: DEFAULT_ROUTINE.slots.find((d) => d.id === s.id)?.share ?? slotShare(s) }));
  if (fromVersion < 6 && !r.slots.some((s) => s.type === 'dinner')) {
    r.slots = [...r.slots, { ...DINNER_SLOT, id: r.slots.some((s) => s.id === 'dinner') ? 'dinner-2' : 'dinner' }];
  }
  // Version 7: the pattern is always on, because a menu is a list of slots. Someone who never switched it on, never planned
  // a week and never touched the shipped example slots starts from the four meals of the day. The routine screen still let
  // them edit the rest, so each other field goes neutral only while it still holds the example's value: an edited bhaji
  // week, avoid list, budget, walk or picked bhaji is theirs and stays. Anyone who used the pattern keeps all of it.
  // Nobody is left with no slots.
  if (fromVersion < 7 && !wasOn && !hadPlan && untouchedExample(r.slots)) {
    r.slots = defaultSlots();
    if (untouched(r.week, DEFAULT_ROUTINE.week)) r.week = NEUTRAL_ROUTINE.week.map((d) => [...d]);
    if (untouched(r.avoid, DEFAULT_ROUTINE.avoid)) r.avoid = [];
    // The budget is one pair: either end changed keeps both.
    if (untouched([r.budgetMin, r.budgetMax], [DEFAULT_ROUTINE.budgetMin, DEFAULT_ROUTINE.budgetMax])) {
      r.budgetMin = NEUTRAL_ROUTINE.budgetMin;
      r.budgetMax = NEUTRAL_ROUTINE.budgetMax;
    }
    if (untouched(r.walk, DEFAULT_ROUTINE.walk)) r.walk = NEUTRAL_ROUTINE.walk;
    // The example picked no bhaji for any date; one picked is the person's.
    if (untouched(r.overrides ?? {}, DEFAULT_ROUTINE.overrides ?? {})) r.overrides = {};
  } else if (r.slots.length === 0) {
    r.slots = defaultSlots();
  }
  r.enabled = true;
  return r;
}

/** A size or a goal: a number above 0. Anything else, NaN included, is not one. */
function isPositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** A record of switches, as stored: an object that is not a list. */
function isSwitches(v: unknown): v is Record<string, unknown> {
  return isRecord(v) && !Array.isArray(v);
}

/**
 * Each known switch true or false. One that is missing takes its default; one
 * stored as anything but a boolean reads off, so a corrupt value never turns
 * anything on. Unknown keys are dropped, and anything not a record of switches
 * gets the defaults.
 */
function upgradeSwitches<T extends Record<string, boolean>>(old: unknown, defaults: T): T {
  const out = { ...defaults };
  if (!isSwitches(old)) return out;
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const v = old[key];
    if (v !== undefined) out[key] = (v === true) as T[keyof T & string];
  }
  return out;
}

/** An address nobody changed from the old placeholder moves to this platform's default; settings added later get their defaults. */
function upgradeAppSettings(old: unknown): AppState['settings'] {
  const raw: Record<string, unknown> = isRecord(old) ? old : {};
  const defaults = EMPTY_STATE.settings;
  const s = { ...defaults, ...raw } as AppState['settings'] & { glassMl?: unknown };
  if (s.ollamaUrl === OLD_OLLAMA_PLACEHOLDER) s.ollamaUrl = DEFAULT_OLLAMA_URL;
  // Version 7: water is counted in bottles. The old default glass becomes the default 500 ml bottle; a size the person chose stays.
  // Only a build from before version 7 wrote a glass, and none of them wrote a bottle: a default bottle beside a glass is the one
  // this device filled in under an older account file as it landed, so the glass decides. A bottle size someone picked stays;
  // a bottle that is no size at all was never picked.
  const glass = raw.glassMl;
  const bottleFilledIn = !isPositive(raw.bottleMl) || raw.bottleMl === defaults.bottleMl;
  if (isPositive(glass) && bottleFilledIn) s.bottleMl = glass === 250 ? 500 : glass;
  delete s.glassMl;
  // A bottle or a walk goal that is not a number above 0 cannot be counted toward: it takes the default.
  if (!isPositive(s.bottleMl)) s.bottleMl = defaults.bottleMl;
  if (!isPositive(s.walkGoalMin)) s.walkGoalMin = defaults.walkGoalMin;
  s.features = upgradeSwitches(raw.features, defaults.features);
  s.reminders = upgradeSwitches(raw.reminders, defaults.reminders);
  // A meal-time prompt nobody set, or one that is not true or false, follows the app's reminders switch: someone who switched those
  // off before these switches existed, or whose stored switch is corrupt, does not get the prompt switched on by an update.
  const prompt = isSwitches(raw.reminders) ? raw.reminders.mealPrompt : undefined;
  if (typeof prompt !== 'boolean') s.reminders.mealPrompt = raw.nudgesEnabled !== false;
  // A tab list or a card list from sync or an old file can never hide Today, ➕ or Me, or lose a card for good.
  s.tabs = normalizeTabs(s.tabs);
  s.todayCards = normalizeTodayCards(s.todayCards);
  return s;
}

/** A plan that cannot be reshaped is dropped, not fatal: the week then starts from the pattern. */
function alignOrDrop(plan: WeekPlan, routine: AppState['routine']): WeekPlan | null {
  try {
    return alignWeekPlan(plan, routine);
  } catch {
    return null;
  }
}

/** The template's days as menus, leaving out a day still as the app built it; a pattern that cannot be built from what is stored writes every day, as before. */
function templateMenus(plan: WeekPlan, monday: ISODate, menus: DayMenu[], routine: AppState['routine'], customFoods: FoodItem[]): DayMenu[] {
  try {
    return menusFromTemplate(plan, monday, menus, { routine, foods: allFoods(customFoods) });
  } catch {
    return menusFromTemplate(plan, monday, menus);
  }
}

/** A done-key older builds wrote for a skipped slot. */
function isSkipKey(a: unknown): a is { date: string; key: string } {
  return isRecord(a) && typeof a.date === 'string' && typeof a.key === 'string' && a.key.startsWith(SKIP_PREFIX);
}

/**
 * Brings a stored blob up to the current shape. Never throws: a corrupt or
 * foreign file yields a fresh state rather than bricking the app.
 */
export function migrateState(raw: unknown, now: Date = new Date()): AppState {
  if (!isRecord(raw) || !isRecord(raw.profile)) return { ...EMPTY_STATE };
  const breakSettings = upgradeSettings(raw.breakSettings);
  const fromVersion = typeof raw.version === 'number' ? raw.version : 1;
  const settings = upgradeAppSettings(raw.settings);
  // Version 4: the weigh-in moved to Sunday, and the start weight became a
  // fixed point rather than whichever weigh-in happened to be oldest.
  if (fromVersion < 4 && settings.weighDay === 1) settings.weighDay = 0;
  // Version 5: reminders space out. Nothing closer than an hour unless chosen.
  if (fromVersion < 5 && settings.nudgeMinutes < 60) settings.nudgeMinutes = 60;
  const profile = { ...EMPTY_STATE.profile, ...(raw.profile as object) } as AppState['profile'];
  if (profile.startWeightKg === undefined) {
    const weights = Array.isArray(raw.weights) ? ([...(raw.weights as AppState['weights'])].sort((a, b) => a.date.localeCompare(b.date))) : [];
    profile.startWeightKg = weights[0]?.kg ?? profile.weightKg;
  }
  // A plan that is not seven days of meals is not a plan; the week starts from the pattern instead.
  const rawPlan = isRecord(raw.weekPlan) && Array.isArray((raw.weekPlan as { days?: unknown }).days) && (raw.weekPlan as { days: unknown[] }).days.length === 7 ? (raw.weekPlan as WeekPlan) : null;
  const routine = upgradeRoutine(raw.routine, fromVersion, rawPlan !== null);
  // Version 6: plan meals are named after the pattern's slots; older names land on the slot of their type nearest their time.
  const weekPlan = rawPlan ? alignOrDrop(rawPlan, routine) : null;
  // Version 7: the one-week template becomes this week's menus, date by date, its index 0 being Sunday. A date that already has a menu keeps it.
  // A day still as the app built it from this pattern is not written, so its date shows the suggestion fitted to the person.
  const storedMenus = Array.isArray(raw.menus) ? (raw.menus as DayMenu[]) : [];
  const customFoods = Array.isArray(raw.customFoods) ? (raw.customFoods as FoodItem[]) : [];
  const menus = weekPlan ? templateMenus(weekPlan, mondayOf(toISODate(now)), storedMenus, routine, customFoods) : storedMenus;
  // Version 7: a skipped slot is its own record with its date, not a done-key that lasted only the day.
  const actions = Array.isArray(raw.actionsDone) ? (raw.actionsDone as unknown[]) : [];
  let slotSkips = Array.isArray(raw.slotSkips) ? (raw.slotSkips as SlotSkip[]) : [];
  for (const a of actions) if (isSkipKey(a)) slotSkips = addSkip(slotSkips, a.date, a.key.slice(SKIP_PREFIX.length));
  // A meal eaten in a slot, or a skip, replaces the copy the app filled in there: this runs on every load and every sync
  // landing, so a lunch typed on one device and the one another device filled in are never both counted.
  const meals = Array.isArray(raw.meals) ? settleAuto(raw.meals as Meal[], slotSkips) : EMPTY_STATE.meals;
  return {
    ...EMPTY_STATE,
    ...(raw as Partial<AppState>),
    version: STATE_VERSION,
    profile,
    settings,
    breakSettings,
    breaks: upgradeLogs(raw.breaks, breakSettings.micro.seconds),
    meals,
    // Older stores have no routine; one saved before a field existed gets the default for it.
    routine,
    spend: Array.isArray(raw.spend) ? (raw.spend as AppState['spend']) : [],
    schedule: { ...EMPTY_STATE.schedule, ...(isRecord(raw.schedule) ? raw.schedule : {}) },
    // Its week is in `menus` now.
    weekPlan: null,
    menus,
    actionsDone: actions.filter((a) => !isSkipKey(a)) as AppState['actionsDone'],
    slotSkips,
    savedMeals: Array.isArray(raw.savedMeals) ? (raw.savedMeals as SavedMeal[]) : [],
    openedDates: Array.isArray(raw.openedDates) ? raw.openedDates.filter((d): d is string => typeof d === 'string') : [],
  };
}

/**
 * How a sync round brings an account file from an older build up to this one: the store's own migration at the round's
 * moment `at`, minus the caches and machine settings it fills in for a device.
 */
export function upgradeFile(at: Date): (file: CloudState) => CloudState {
  return (file) => forCloud(migrateState(file, at));
}
