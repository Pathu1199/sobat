import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import foodsJson from '../data/foods.json';
import exercisesJson from '../data/exercises.json';
import { lastNDates, mondayOf, toISODate } from '../core/date';
import { foodsForDiet } from '../core/foods';
import { newId } from '../core/id';
import { prunePhotos } from '../services/photoStore';
import { useClock } from '../services/useClock';
import { budget as calcBudget, dailyTargets, sumTotals, type Budget, type Targets } from '../core/nutrition';
import { parkedPhotoIds, switchStored } from '../core/accounts';
import { burnedOn, eatBack } from '../core/activity';
import { streak } from '../core/insights';
import { isOffDay } from '../core/week';
import { addMemory, makeMemory, prune as pruneMemory, removeMemory, type MemoryType } from '../core/memory';
import { addActive, minutesOn, pruneUsage } from '../core/usage';
import { dequeue, enqueue, markFailed, type QueuedPhoto } from '../core/queue';
import { slotStates } from '../core/pattern';
import {
  addMenuLine,
  alignMenus,
  applyWeekPlan,
  copyDay,
  editedMeal,
  removeSkip,
  setMenuDay,
  setMenuLine,
  setMenuMeal,
  skippedOn,
  viewMenu,
  viewWeek,
  weekPlanView,
  withMealAdded,
  withSkipAdded,
  type DayMenu,
} from '../core/menu';
import { pruneSpend, spentOn, type PlanLine, type Routine, type SpendLog } from '../core/routine';
import type { WorkSchedule } from '../core/schedule';
import type { PlanMeal, WeekPlan } from '../core/weekPlan';
import type { BreakKind, BreakSettings } from '../core/breaks';
import type { ActivityLog, AppState, ChatMsg, Exercise, FoodItem, ISODate, Meal, MoodLog, Profile, Settings, SleepLog, WeightLog, WorkoutLog } from '../core/types';
import { EMPTY_STATE } from './defaults';
import { migrateState } from './migrate';

export const STATE_KEY = 'sobat.state.v1';
/** The account file the stored state was last merged with. Only ever written in the same call as the state, and removed with it. */
export const CLOUD_BASE_KEY = 'sobat.state.v1.cloudBase';
/** Whose data the stored state is, so another account signing in never sees or syncs it. */
export const OWNER_KEY = 'sobat.cloud.owner';

const FOODS = foodsJson as unknown as FoodItem[];
const EXERCISES = exercisesJson as unknown as Exercise[];

/** Every food there is: the database and the person's own. Planned lines can name any of them, whatever the diet filter shows. */
function allFoods(customFoods: FoodItem[]): FoodItem[] {
  return [...FOODS, ...customFoods];
}

type Ctx = {
  ready: boolean;
  state: AppState;
  foods: FoodItem[];
  exercises: Exercise[];
  today: string;
  /** Local hour, 0 to 23, kept fresh by the clock rather than read during render. */
  hour: number;
  targets: Targets;
  budget: Budget;
  waterToday: number;
  streakDays: number;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  addMeal: (m: Meal) => void;
  removeMeal: (id: string) => void;
  updateMeal: (m: Meal) => void;
  addWater: (ml: number) => void;
  undoWater: () => void;
  addWeight: (w: WeightLog) => void;
  removeWeight: (date: ISODate) => void;
  addMood: (m: MoodLog) => void;
  addSleep: (s: SleepLog) => void;
  addWorkout: (w: WorkoutLog) => void;
  logNudge: (type: string, action: 'done' | 'snooze' | 'skip') => void;
  addChat: (m: ChatMsg) => void;
  clearChat: () => void;
  addCustomFood: (f: FoodItem) => void;
  rememberText: (text: string, type?: MemoryType, source?: 'user' | 'auto') => void;
  forgetMemory: (id: string) => void;
  confirmMemory: (id: string) => void;
  trackActive: (minutes: number) => void;
  logBreak: (kind: BreakKind, action: 'taken' | 'skipped', workedMinutes: number, seconds: number) => void;
  setBreakSettings: (s: Partial<BreakSettings>) => void;
  pauseBreaks: (minutes: number | null) => void;
  setTip: (text: string) => void;
  queuePhoto: (p: QueuedPhoto) => void;
  unqueuePhoto: (id: string) => void;
  failPhoto: (id: string, error: string) => void;
  setSteps: (count: number) => void;
  stepsToday: number;
  actionsDoneToday: string[];
  toggleAction: (key: string) => void;
  /** Slot ids skipped today. */
  skippedToday: string[];
  /** Record that a slot was not eaten on a date; a meal later logged in it takes the skip away. */
  skipSlot: (date: ISODate, slotId: string) => void;
  unskipSlot: (date: ISODate, slotId: string) => void;
  setRoutine: (r: Partial<Routine>) => void;
  /** This week's menus in the old one-week shape (index 0 = Sunday), for the plan screen until it is rebuilt. */
  weekPlan: WeekPlan;
  /** Write an edit made on `weekPlan` back to this week's dates. */
  setWeekPlan: (plan: WeekPlan) => void;
  /** The menu a date shows: stored, or as it starts; from today on, following the slots. */
  menuOn: (date: ISODate) => DayMenu;
  /** The seven menus of the week starting on `monday`, Monday first. */
  weekMenus: (monday: ISODate) => DayMenu[];
  /** Edits to one date's menu; `day` is the menu as shown. Every other date is left as it is. */
  editMenuDay: (day: DayMenu, meals: PlanMeal[]) => void;
  editMenuLine: (day: DayMenu, mealId: string, lineIdx: number, next: PlanLine | null) => void;
  addMenuFood: (day: DayMenu, mealId: string, line: PlanLine) => void;
  editMenuMeal: (day: DayMenu, meal: PlanMeal) => void;
  copyMenuDay: (from: DayMenu, to: ISODate) => void;
  addActivity: (a: ActivityLog) => void;
  removeActivity: (id: string) => void;
  burnedToday: number;
  markCelebrated: (ids: string[]) => void;
  toggleGrocery: (week: string, foodId: string) => void;
  setSchedule: (s: Partial<WorkSchedule>) => void;
  addSpend: (s: Pick<SpendLog, 'category' | 'rupees' | 'spreadDays'>) => void;
  removeSpend: (id: string) => void;
  /** Rupees counted against today, bulk buys spread over their days. */
  spentToday: number;
  importState: (json: string) => { ok: boolean; error?: string };
  /** Apply a change worked out away from the store (a sync round) to the state as it is when the change lands, migrated like an import. */
  mergeState: (fn: (s: AppState) => AppState) => void;
  /** The state with every change already made applied, including one not rendered yet. */
  readNow: () => Promise<AppState>;
  /**
   * Another account signed in here: put this device's data aside for `from` (null: it holds nobody's),
   * never thrown away, and bring back what was aside for `to`, or start empty. Resolves with `to`'s
   * saved sync base, if one came back. Throws, with nothing changed, if the data could not be put aside.
   */
  switchAccount: (from: string | null, to: string) => Promise<string | null>;
  tipToday: string | null;
  screenMinutesToday: number;
  resetAll: () => void;
  /** Keep the sync base beside the state: written with the next save of the state, in the same storage call. */
  saveCloudBase: (json: string) => void;
  exportJSON: () => string;
  /** 'load': the stored state could not be read and nothing will be written over it. 'save': the last write failed. */
  storageError: 'load' | 'save' | null;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}

/** The state with these menus; the same state when an edit changed nothing. */
function withMenus(s: AppState, menus: DayMenu[]): AppState {
  return menus === s.menus ? s : { ...s, menus };
}

/** Every meal goes into the state this way; `withMealAdded` says what that does. */
function withMeal(s: AppState, m: Meal, target: number, now: Date): AppState {
  return { ...s, ...withMealAdded(s, m, target, now) };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<'load' | 'save' | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The sync base waiting to go out with the next save. A base on disk that is
  // newer than the state beside it would read the missing records as deleted here.
  const pendingBase = useRef<string | null>(null);
  const [baseTick, setBaseTick] = useState(0);
  // While one account's data is being put aside, no save may write it back over the next one's,
  // nor may a save armed before the switch ended: each switch starts a new generation.
  const switching = useRef(false);
  const saveGen = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        if (raw) {
          const loaded = migrateState(JSON.parse(raw));
          setState(loaded);
          // Photos queued by an account whose data is put aside wait for it too.
          parkedPhotoIds(AsyncStorage, STATE_KEY)
            .then((parked) => prunePhotos([...loaded.photoQueue.map((p) => p.id), ...parked]))
            .catch(() => {});
        }
      } catch {
        // The store is there but could not be read or parsed. Running on in
        // memory is fine; writing a fresh state over it would not be — that
        // is how a bad read becomes a lost year. The save effect holds off,
        // and Settings says so.
        setStorageError('load');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Debounced so rapid edits do not thrash storage.
  useEffect(() => {
    if (!ready || storageError === 'load') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Taken now, beside the state this render holds, not whatever is pending when the timer fires.
    const base = pendingBase.current;
    const gen = saveGen.current;
    saveTimer.current = setTimeout(() => {
      if (switching.current || gen !== saveGen.current) return;
      const pairs: [string, string][] = [[STATE_KEY, JSON.stringify(state)]];
      if (base !== null) pairs.push([CLOUD_BASE_KEY, base]);
      AsyncStorage.multiSet(pairs)
        .then(() => {
          if (pendingBase.current === base) pendingBase.current = null;
          setStorageError((e) => (e === 'save' ? null : e));
        })
        .catch(() => setStorageError('save'));
    }, 250);
  }, [state, ready, storageError, baseTick]);

  // Read through the update queue, so it sees a reset or a merge the moment it was asked for.
  const readNow = useCallback(
    () =>
      new Promise<AppState>((resolve) =>
        setState((s) => {
          resolve(s);
          return s;
        }),
      ),
    [],
  );

  const switchAccount = useCallback(
    async (from: string | null, to: string) => {
      switching.current = true;
      saveGen.current += 1;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingBase.current = null;
      try {
        const current = await readNow();
        const back = await switchStored(
          AsyncStorage,
          { state: STATE_KEY, base: CLOUD_BASE_KEY, owner: OWNER_KEY },
          { from, to, current: JSON.stringify(current), empty: JSON.stringify(EMPTY_STATE) },
        );
        let next = EMPTY_STATE;
        try {
          if (back.state) next = migrateState(JSON.parse(back.state));
        } catch {
          // What came back could not be read. It is on disk as the state now; nothing may be written over it.
          setStorageError('load');
        }
        setState(next);
        return back.base;
      } finally {
        saveGen.current += 1;
        switching.current = false;
      }
    },
    [readNow],
  );

  const saveCloudBase = useCallback((json: string) => {
    pendingBase.current = json;
    setBaseTick((n) => n + 1);
  }, []);

  // Not `toISODate()` at render time: nothing would re-render at midnight and
  // the whole app would keep working against yesterday.
  const { date: today, hour } = useClock();
  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const planFoods = useMemo(() => allFoods(state.customFoods), [state.customFoods]);

  const value = useMemo<Ctx>(() => {
    const targets = dailyTargets(state.profile);
    const todayMeals = state.meals.filter((m) => m.date === today);
    const totals = sumTotals(todayMeals.flatMap((m) => m.items));
    const burnedToday = burnedOn(state.activities ?? [], today);
    const actionsDoneToday = state.actionsDone.filter((a) => a.date === today).map((a) => a.key);
    const skippedToday = skippedOn(state.slotSkips, today);
    // With the pattern on, the meals left are its slots still to eat, not the fixed windows; a pattern with no slots falls back to the windows.
    const patternStates = state.routine.enabled ? slotStates({ routine: state.routine, target: targets.kcal, meals: todayMeals, nowMinutes: hour * 60, skippedSlots: skippedToday }) : [];
    const mealsLeftOverride =
      patternStates.length > 0 ? patternStates.filter((x) => x.status === 'now' || x.status === 'missed' || x.status === 'later').length : undefined;
    const budget = calcBudget(targets, totals, hour, eatBack(burnedToday), mealsLeftOverride);
    const waterToday = state.water.filter((w) => w.date === today).reduce((a, w) => a + w.ml, 0);
    const dates = lastNDates(60, today);
    const mealDates = new Set(state.meals.map((m) => m.date));
    const streakDays = streak(dates, (d) => mealDates.has(d) || isOffDay(state.settings.offDays, d));
    const screenMinutesToday = minutesOn(state.usage, today);
    // A tip is only today's if it was also written in the language now selected.
    const tipRecord = state.tips.find((t) => t.date === today && t.lang === state.profile.lang);
    const thisWeek = viewWeek(mondayOf(today), state.menus, state.routine, today, planFoods);

    return {
      ready,
      state,
      foods: foodsForDiet(planFoods, state.settings.diet),
      exercises: EXERCISES,
      today,
      hour,
      targets,
      budget,
      waterToday,
      streakDays,
      tipToday: tipRecord?.text ?? null,
      screenMinutesToday,
      stepsToday: state.steps.find((x) => x.date === today)?.count ?? 0,
      setProfile: (p) => update((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      setSettings: (x) => update((s) => ({ ...s, settings: { ...s.settings, ...x } })),
      addMeal: (m) => update((s) => withMeal(s, m, targets.kcal, new Date())),
      removeMeal: (id) => update((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) })),
      updateMeal: (m) => update((s) => ({ ...s, meals: s.meals.map((x) => (x.id === m.id ? editedMeal(x, m) : x)) })),
      addWater: (ml) =>
        update((s) => ({ ...s, water: [...s.water, { id: newId(), at: new Date().toISOString(), date: toISODate(), ml }] })),
      undoWater: () =>
        update((s) => {
          const d = toISODate();
          const idx = [...s.water].map((w, i) => ({ w, i })).filter(({ w }) => w.date === d).pop();
          if (!idx) return s;
          return { ...s, water: s.water.filter((_, i) => i !== idx.i) };
        }),
      addWeight: (w) =>
        update((s) => {
          const weights = [...s.weights.filter((x) => x.date !== w.date), w].sort((x, y) => x.date.localeCompare(y.date));
          // The profile carries the newest reading, whichever date was just edited.
          return { ...s, weights, profile: { ...s.profile, weightKg: weights[weights.length - 1].kg } };
        }),
      removeWeight: (date) =>
        update((s) => {
          const weights = s.weights.filter((x) => x.date !== date).sort((x, y) => x.date.localeCompare(y.date));
          return { ...s, weights, profile: { ...s.profile, weightKg: weights.length ? weights[weights.length - 1].kg : s.profile.weightKg } };
        }),
      addMood: (m) => update((s) => ({ ...s, moods: [...s.moods, m] })),
      addSleep: (sl) => update((s) => ({ ...s, sleep: [...s.sleep.filter((x) => x.date !== sl.date), sl] })),
      addWorkout: (w) => update((s) => ({ ...s, workouts: [...s.workouts.filter((x) => x.date !== w.date), w] })),
      logNudge: (type, action) =>
        update((s) => ({ ...s, nudges: [...s.nudges, { id: newId(), at: new Date().toISOString(), date: toISODate(), type, action }] })),
      addChat: (m) => update((s) => ({ ...s, chat: [...s.chat.slice(-60), m] })),
      clearChat: () => update((s) => ({ ...s, chat: [] })),
      addCustomFood: (f) => update((s) => ({ ...s, customFoods: [...s.customFoods, f] })),
      rememberText: (text, type = 'fact', source = 'user') =>
        update((s) => {
          const clean = text.trim();
          if (!clean) return s;
          const next = addMemory(s.memory, makeMemory({ text: clean, type, date: today, source }));
          return { ...s, memory: pruneMemory(next, today) };
        }),
      forgetMemory: (id) => update((s) => ({ ...s, memory: removeMemory(s.memory, id) })),
      confirmMemory: (id) =>
        update((s) => ({
          ...s,
          memory: s.memory.map((m) => (m.id === id ? { ...m, source: 'user' as const, weight: Math.max(m.weight, 0.8) } : m)),
        })),
      trackActive: (minutes) =>
        update((s) => {
          const now = new Date();
          const next = addActive(s.usage, toISODate(now), now.getHours(), minutes);
          // 90 days is plenty of history and keeps the store small.
          return { ...s, usage: pruneUsage(next, 90, toISODate(now)) };
        }),
      logBreak: (kind, action, workedMinutes, seconds) =>
        update((s) => ({
          ...s,
          breaks: [...s.breaks.slice(-500), { id: newId(), date: toISODate(), at: new Date().toISOString(), kind, action, workedMinutes, seconds }],
        })),
      setBreakSettings: (b) => update((s) => ({ ...s, breakSettings: { ...s.breakSettings, ...b } })),
      pauseBreaks: (minutes) =>
        update((s) => ({
          ...s,
          breakSettings: { ...s.breakSettings, pausedUntilMs: minutes === null ? null : Date.now() + minutes * 60000 },
        })),
      queuePhoto: (p) => update((s) => ({ ...s, photoQueue: enqueue(s.photoQueue, p) })),
      unqueuePhoto: (id) => update((s) => ({ ...s, photoQueue: dequeue(s.photoQueue, id) })),
      failPhoto: (id, error) => update((s) => ({ ...s, photoQueue: markFailed(s.photoQueue, id, error) })),
      setSteps: (count) =>
        update((s) => ({ ...s, steps: [...s.steps.filter((x) => x.date !== today), { date: today, count }] })),
      actionsDoneToday,
      toggleAction: (key) =>
        update((s) => {
          const kept = s.actionsDone.filter((a) => a.date === today);
          const has = kept.some((a) => a.key === key);
          return { ...s, actionsDone: has ? kept.filter((a) => a.key !== key) : [...kept, { date: today, key }] };
        }),
      skippedToday,
      skipSlot: (date, slotId) =>
        update((s) => {
          const next = withSkipAdded(s, date, slotId);
          return next.slotSkips === s.slotSkips ? s : { ...s, ...next };
        }),
      unskipSlot: (date, slotId) =>
        update((s) => {
          const slotSkips = removeSkip(s.slotSkips, date, slotId);
          return slotSkips === s.slotSkips ? s : { ...s, slotSkips };
        }),
      setRoutine: (r) =>
        update((s) => {
          // The pattern is always on: a menu is a list of slots.
          const routine = { ...s.routine, ...r, enabled: true };
          // Menus are written against the slots; when they change, today's and later ones follow. Past ones are history.
          const slotsChanged = r.slots !== undefined && r.slots !== s.routine.slots;
          const menus = slotsChanged ? alignMenus(s.menus, routine, today, allFoods(s.customFoods)) : s.menus;
          return { ...s, routine, menus };
        }),
      weekPlan: weekPlanView(thisWeek),
      setWeekPlan: (plan) =>
        update((s) => {
          const week = viewWeek(mondayOf(today), s.menus, s.routine, today, allFoods(s.customFoods));
          return withMenus(s, applyWeekPlan(plan, week, s.menus, new Date()));
        }),
      menuOn: (date) => viewMenu(date, state.menus, state.routine, today, planFoods),
      weekMenus: (monday) => viewWeek(monday, state.menus, state.routine, today, planFoods),
      editMenuDay: (day, meals) => update((s) => withMenus(s, setMenuDay(s.menus, day, meals, new Date()))),
      editMenuLine: (day, mealId, lineIdx, next) => update((s) => withMenus(s, setMenuLine(s.menus, day, mealId, lineIdx, next, new Date()))),
      addMenuFood: (day, mealId, line) => update((s) => withMenus(s, addMenuLine(s.menus, day, mealId, line, new Date()))),
      editMenuMeal: (day, meal) => update((s) => withMenus(s, setMenuMeal(s.menus, day, meal, new Date()))),
      copyMenuDay: (from, to) => update((s) => withMenus(s, copyDay(from, to, s.menus, new Date()))),
      addActivity: (a) => update((s) => ({ ...s, activities: [...(s.activities ?? []), a] })),
      removeActivity: (id) => update((s) => ({ ...s, activities: (s.activities ?? []).filter((x) => x.id !== id) })),
      burnedToday,
      toggleGrocery: (week, foodId) =>
        update((s) => {
          const cur = s.groceryTicks?.week === week ? s.groceryTicks.ids : [];
          return { ...s, groceryTicks: { week, ids: cur.includes(foodId) ? cur.filter((x) => x !== foodId) : [...cur, foodId] } };
        }),
      markCelebrated: (ids) => update((s) => ({ ...s, celebrated: Array.from(new Set([...(s.celebrated ?? []), ...ids])) })),
      setSchedule: (x) => update((s) => ({ ...s, schedule: { ...s.schedule, ...x } })),
      addSpend: (x) =>
        update((s) => ({
          ...s,
          spend: pruneSpend([...s.spend, { ...x, id: newId(), date: today, at: new Date().toISOString() }], today),
        })),
      removeSpend: (id) => update((s) => ({ ...s, spend: s.spend.filter((x) => x.id !== id) })),
      spentToday: spentOn(state.spend, today),
      importState: (json) => {
        try {
          const parsed = JSON.parse(json) as Partial<AppState>;
          // A file from another app would quietly wipe everything, so check shape first.
          if (typeof parsed !== 'object' || parsed === null || !parsed.profile || !Array.isArray(parsed.meals)) {
            return { ok: false, error: 'not_sobat_file' };
          }
          setState(migrateState(parsed));
          return { ok: true };
        } catch {
          return { ok: false, error: 'bad_json' };
        }
      },
      mergeState: (fn) => update((s) => migrateState(fn(s))),
      readNow,
      switchAccount,
      setTip: (text) =>
        update((s) => ({ ...s, tips: [...s.tips.filter((t) => t.date !== today).slice(-30), { date: today, text, lang: s.profile.lang }] })),
      resetAll: () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        pendingBase.current = null;
        setState(EMPTY_STATE);
        // A deliberate reset is the one time an unreadable store may be replaced.
        setStorageError(null);
        AsyncStorage.multiRemove([STATE_KEY, CLOUD_BASE_KEY]).catch(() => {});
      },
      saveCloudBase,
      storageError,
      exportJSON: () => JSON.stringify(state, null, 2),
    };
  }, [state, ready, today, hour, update, storageError, saveCloudBase, readNow, switchAccount, planFoods]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
