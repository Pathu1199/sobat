import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import exercisesJson from '../data/exercises.json';
import { mondayOf, toISODate } from '../core/date';
import { foodsForDiet } from '../core/foods';
import { newId } from '../core/id';
import { prunePhotos } from '../services/photoStore';
import { useClock, useMinute } from '../services/useClock';
import { budget as calcBudget, dailyTargets, sumTotals, type Budget, type Targets } from '../core/nutrition';
import { parkedPhotoIds, switchStored } from '../core/accounts';
import { burnedOn, eatBack, walkLog } from '../core/activity';
import { addMemory, makeMemory, prune as pruneMemory, removeMemory, type MemoryType } from '../core/memory';
import { addActive, minutesOn, pruneUsage } from '../core/usage';
import { dequeue, enqueue, markFailed, type QueuedPhoto } from '../core/queue';
import { slotStates } from '../core/pattern';
import { chapterStreaks } from '../core/chapter';
import {
  addMenuLine,
  alignMenus,
  editedMeal,
  editedMenus,
  fillFromPlan,
  fitFor,
  isSuggested,
  planMeal,
  removeSkip,
  setMenuDay,
  setMenuLine,
  setMenuMeal,
  skippedOn,
  viewMenu,
  viewWeek,
  weekPlanView,
  withAutoFill,
  withDayConfirmed,
  withMealAdded,
  withMealConfirmed,
  withMealRemoved,
  withoutOrphanedAuto,
  withoutSavedMeal,
  withSavedMeal,
  withSavedMealAt,
  withSkipAdded,
  type DayMenu,
  type MenuFit,
} from '../core/menu';
import { waterMlOn } from '../core/tileText';
import { withWaterAdded, withWaterRemoved } from '../core/tiles';
import { isOffDay } from '../core/week';
import { stripSince } from '../core/weekStrip';
import { toggleTick } from '../core/grocery';
import { pruneSpend, spentOn, type PlanLine, type Routine, type SpendLog } from '../core/routine';
import type { WorkSchedule } from '../core/schedule';
import type { PlanMeal, WeekPlan } from '../core/weekPlan';
import type { BreakKind, BreakSettings } from '../core/breaks';
import type { ActivityLog, AppState, ChatMsg, Exercise, FoodItem, ISODate, Meal, MealSource, MoodLog, Profile, SavedMeal, Settings, SleepLog, WeightLog, WorkoutLog } from '../core/types';
import { allFoods, EMPTY_STATE } from './defaults';
import { migrateState } from './migrate';

export const STATE_KEY = 'sobat.state.v1';
/** The account file the stored state was last merged with. Only ever written in the same call as the state, and removed with it. */
export const CLOUD_BASE_KEY = 'sobat.state.v1.cloudBase';
/** Whose data the stored state is, so another account signing in never sees or syncs it. */
export const OWNER_KEY = 'sobat.cloud.owner';

const EXERCISES = exercisesJson as unknown as Exercise[];

type Ctx = {
  ready: boolean;
  state: AppState;
  foods: FoodItem[];
  /** Every food a planned line or a saved meal can name: the database and the person's own, whatever the diet filter shows. */
  planFoods: FoodItem[];
  exercises: Exercise[];
  today: string;
  /** Local hour, 0 to 23, kept fresh by the clock rather than read during render. */
  hour: number;
  targets: Targets;
  budget: Budget;
  waterToday: number;
  /** Full record days in a row, looking back no further than a new chapter's first day. */
  streakDays: number;
  /** The longest run of full days in the streak's window (from a new chapter's first day at most), by the streak's own rule: the streak tile's "Best". */
  bestStreakDays: number;
  /** The streak over the whole journey, a new chapter or not (still within the streak's own window): only the points and the streak badges count it. */
  lifetimeStreakDays: number;
  /** The best run over the whole journey, by the same rule: only the streak badges count it. */
  lifetimeBestStreakDays: number;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  addMeal: (m: Meal) => void;
  /** Take a meal away; once its slot would be filled in from the plan, the slot is marked skipped so it is not filled straight back. */
  removeMeal: (id: string) => void;
  updateMeal: (m: Meal) => void;
  /** One water log on a date, today when none is given. Returns its id, so a tap can be undone. A date after today logs nothing, and its id then names nothing. */
  addWater: (ml: number, date?: ISODate) => string;
  /** Take one water log away, by its id. */
  removeWater: (id: string) => void;
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
  /** This week's menus in the old one-week shape (index 0 = Sunday), for the grocery list. */
  weekPlan: WeekPlan;
  /** The menu a date shows: stored, or as it starts (a day nobody wrote fitted to the person's day); from today on, following the slots. */
  menuOn: (date: ISODate) => DayMenu;
  /** A day holding just what the app suggests for its weekday, fitted to the person's day: the app's suggestion, not a plan the person shaped. */
  isSuggestedMenu: (day: Pick<DayMenu, 'date' | 'meals'>) => boolean;
  /** The seven menus of the week starting on `monday`, Monday first. */
  weekMenus: (monday: ISODate) => DayMenu[];
  /**
   * Edits to one date's menu; `day` is the menu as shown, and each edit builds on the menu as stored when it lands, so two quick
   * taps both count. Every other date is left as it is, and a date before today is refused: its menu is that day's record.
   */
  editMenuDay: (day: DayMenu, meals: PlanMeal[]) => void;
  /** `next` may be worked out from the line as the stored menu holds it (a − / + step on the food tapped: `stepFoodLine`). */
  editMenuLine: (day: DayMenu, mealId: string, lineIdx: number, next: PlanLine | null | ((line: PlanLine) => PlanLine | null)) => void;
  addMenuFood: (day: DayMenu, mealId: string, line: PlanLine) => void;
  editMenuMeal: (day: DayMenu, meal: PlanMeal) => void;
  /**
   * "Ate as planned" for a slot on any date up to today: its planned lines, or the lines given (a past day's draft), logged with
   * database calories. Returns the meal's id, so the tap can be undone; null when the store refuses (a date after today, nothing
   * to log), and then nothing changes.
   */
  addMealFromPlan: (date: ISODate, slotId: string, source?: MealSource, lines?: PlanLine[]) => string | null;
  /** A meal the app filled in, confirmed as eaten. */
  confirmMeal: (id: string) => void;
  /** "Day looks right": every filled-in meal of the date confirmed. */
  confirmDay: (date: ISODate) => void;
  /** "Fill this day from plan": every open slot of an older day logged as planned. A date after today changes nothing. */
  fillDayFromPlan: (date: ISODate) => void;
  /** Fill in the planned meals that are due now; the store also does this on open, every minute and on coming back to the front. */
  runAutoFill: () => void;
  addSavedMeal: (name: string, lines: PlanLine[]) => void;
  removeSavedMeal: (id: string) => void;
  /** Undo of a delete: the saved meal back as it was, the same id at the place it had. */
  restoreSavedMeal: (meal: SavedMeal, index: number) => void;
  /** A walk from the walk tile: an activity log, so its calories are earned the usual way. Returns its id, for undo. A date after today logs nothing, and its id then names nothing. */
  logWalk: (date: ISODate, minutes: number) => string;
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

/** The fit for the person on a date: their target that date (it counts their age), the safe minimum and their avoid list. */
function fitOn(profile: Profile, routine: Routine, date: ISODate): MenuFit {
  return fitFor(profile, routine, new Date(`${date}T12:00:00`));
}

/** The app's own run, now: today marked as a day the app was open and the planned meals that are due filled in, a day nobody wrote as it shows, fitted to the person's day. The same state when there is nothing to do. */
function withAutoFillNow(s: AppState): AppState {
  const now = new Date();
  const fit = fitFor(s.profile, s.routine, now);
  return withAutoFill(s, now, allFoods(s.customFoods), fit.target, fit);
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
  const minute = useMinute();
  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const planFoods = useMemo(() => allFoods(state.customFoods), [state.customFoods]);
  // A day nobody wrote shows the app's suggestion fitted to the person's target, never under the safe minimum, without the foods they avoid.
  // The target counts the person's age, so the fit is worked out again when the date changes, as Today's targets are.
  const fit = useMemo(() => fitOn(state.profile, state.routine, today), [state.profile, state.routine, today]);
  // The menu a date shows. The same function until the menus, the pattern, the foods, the day or the profile (through `fit`)
  // change, so a memo that reads it (the streak, the best run) is not worked out again for a bottle of water.
  const menuOn = useCallback((date: ISODate) => viewMenu(date, state.menus, state.routine, today, planFoods, fit), [state.menus, state.routine, today, planFoods, fit]);

  // Full record days in a row, judged on the menus as they show; today only counts once it is full, and never breaks the run before then.
  // A full day eaten under the safe minimum neither counts nor ends the run; a full day with nothing eaten (under 50 kcal) ends it, today too.
  // A new chapter starts the streak shown and the best run again from its first day; the points and the streak badges keep the whole
  // journey's (`chapterStreaks`). Worked out once here for every tile and screen that shows them.
  const streaks = useMemo(
    () =>
      chapterStreaks({
        today,
        routine: state.routine,
        meals: state.meals,
        skips: state.slotSkips,
        offDays: state.settings.offDays ?? [],
        floor: fit.floor,
        menuOn,
        chapterStart: state.profile.chapterStart,
      }),
    [today, state.routine, state.meals, state.slotSkips, state.settings.offDays, fit.floor, menuOn, state.profile.chapterStart],
  );
  const { days: streakDays, best: bestStreakDays, lifetimeDays: lifetimeStreakDays, lifetimeBest: lifetimeBestStreakDays } = streaks;

  // Planned meals fill themselves 90 minutes after their slot, and today is noted as a day the app was open: checked once the
  // store is loaded, then on each turn of the shared minute clock, which also catches midnight and catches up when the app
  // comes back to the front. Never while one account's data is being put aside.
  useEffect(() => {
    if (!ready) return;
    const run = setTimeout(() => {
      if (!switching.current) setState(withAutoFillNow);
    }, 0);
    return () => clearTimeout(run);
  }, [ready, today, minute]);

  // The meals left today are the pattern's slots not yet eaten or skipped, read at this minute; a pattern with no slots leaves
  // it to the fixed windows. A number of its own, so the minute ticking over rebuilds nothing else.
  const patternMealsLeft = useMemo(() => {
    const states = slotStates({
      routine: state.routine,
      target: dailyTargets(state.profile).kcal,
      meals: state.meals.filter((m) => m.date === today),
      nowMinutes: minute,
      skippedSlots: skippedOn(state.slotSkips, today),
    });
    return states.length > 0 ? states.filter((x) => x.status === 'now' || x.status === 'missed' || x.status === 'later').length : undefined;
  }, [state.routine, state.profile, state.meals, state.slotSkips, today, minute]);

  // This week as the plan screen reads it, worked out only when what it shows changes: a bottle of water rebuilds no week.
  const weekPlan = useMemo(
    () => weekPlanView(viewWeek(mondayOf(today), state.menus, state.routine, today, planFoods, fit)),
    [today, state.menus, state.routine, planFoods, fit],
  );

  const value = useMemo<Ctx>(() => {
    const targets = dailyTargets(state.profile);
    const todayMeals = state.meals.filter((m) => m.date === today);
    const totals = sumTotals(todayMeals.flatMap((m) => m.items));
    const burnedToday = burnedOn(state.activities ?? [], today);
    const actionsDoneToday = state.actionsDone.filter((a) => a.date === today).map((a) => a.key);
    const skippedToday = skippedOn(state.slotSkips, today);
    const budget = calcBudget(targets, totals, hour, eatBack(burnedToday), patternMealsLeft);
    const waterToday = waterMlOn(state.water, today);
    const screenMinutesToday = minutesOn(state.usage, today);
    // A tip is only today's if it was also written in the language now selected.
    const tipRecord = state.tips.find((t) => t.date === today && t.lang === state.profile.lang);

    return {
      ready,
      state,
      foods: foodsForDiet(planFoods, state.settings.diet),
      planFoods,
      exercises: EXERCISES,
      today,
      hour,
      targets,
      budget,
      waterToday,
      streakDays,
      bestStreakDays,
      lifetimeStreakDays,
      lifetimeBestStreakDays,
      tipToday: tipRecord?.text ?? null,
      screenMinutesToday,
      stepsToday: state.steps.find((x) => x.date === today)?.count ?? 0,
      setProfile: (p) => update((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      setSettings: (x) => update((s) => ({ ...s, settings: { ...s.settings, ...x } })),
      addMeal: (m) => update((s) => withMeal(s, m, targets.kcal, new Date())),
      removeMeal: (id) =>
        update((s) => {
          // A meal taken away once its slot would be filled in from the plan marks the slot skipped, so it is not filled straight back.
          const next = withMealRemoved(s, id, new Date());
          return next.meals === s.meals ? s : { ...s, ...next };
        }),
      updateMeal: (m) => update((s) => ({ ...s, meals: s.meals.map((x) => (x.id === m.id ? editedMeal(x, m) : x)) })),
      addWater: (ml, date) => {
        const id = newId();
        update((s) => {
          const water = withWaterAdded(s.water, { id, date: date ?? toISODate(), ml, now: new Date() });
          return water === s.water ? s : { ...s, water };
        });
        return id;
      },
      removeWater: (id) =>
        update((s) => {
          const water = withWaterRemoved(s.water, id);
          return water === s.water ? s : { ...s, water };
        }),
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
          // A meal the app filled in from today on, in a slot taken out, goes with it.
          const slotsChanged = r.slots !== undefined && r.slots !== s.routine.slots;
          const menus = slotsChanged ? alignMenus(s.menus, routine, today, allFoods(s.customFoods)) : s.menus;
          const meals = slotsChanged ? withoutOrphanedAuto(s.meals, routine, today) : s.meals;
          return { ...s, routine, menus, meals };
        }),
      weekPlan,
      menuOn,
      isSuggestedMenu: (day) => isSuggested(day, state.routine, planFoods, fit),
      weekMenus: (monday) => viewWeek(monday, state.menus, state.routine, today, planFoods, fit),
      editMenuDay: (day, meals) => update((s) => withMenus(s, editedMenus(s.menus, day, today, (ms, d) => setMenuDay(ms, d, meals, new Date())))),
      editMenuLine: (day, mealId, lineIdx, next) => update((s) => withMenus(s, editedMenus(s.menus, day, today, (ms, d) => setMenuLine(ms, d, mealId, lineIdx, next, new Date())))),
      addMenuFood: (day, mealId, line) => update((s) => withMenus(s, editedMenus(s.menus, day, today, (ms, d) => addMenuLine(ms, d, mealId, line, new Date())))),
      editMenuMeal: (day, meal) => update((s) => withMenus(s, editedMenus(s.menus, day, today, (ms, d) => setMenuMeal(ms, d, meal, new Date())))),
      addMealFromPlan: (date, slotId, source = 'plan', lines) => {
        const id = newId();
        const now = new Date();
        const build = (s: AppState) => {
          const foods = allFoods(s.customFoods);
          return planMeal({ id, menu: viewMenu(date, s.menus, s.routine, today, foods, fitOn(s.profile, s.routine, today)), slotId, lines, foods, source, now });
        };
        // Refused at the tap, on the state as shown, so the caller knows nothing was logged and says nothing.
        if (!build(state)) return null;
        update((s) => {
          const meal = build(s);
          return meal ? withMeal(s, meal, targets.kcal, now) : s;
        });
        return id;
      },
      confirmMeal: (id) =>
        update((s) => {
          const meals = withMealConfirmed(s.meals, id);
          return meals === s.meals ? s : { ...s, meals };
        }),
      confirmDay: (date) =>
        update((s) => {
          const meals = withDayConfirmed(s.meals, date);
          return meals === s.meals ? s : { ...s, meals };
        }),
      fillDayFromPlan: (date) =>
        update((s) => {
          const now = new Date();
          const foods = allFoods(s.customFoods);
          const menu = viewMenu(date, s.menus, s.routine, today, foods, fitOn(s.profile, s.routine, today));
          // Nothing on an off day or before the person started (the week strip's start), where no meal is missing.
          const offDay = isOffDay(s.settings.offDays, date);
          const startDate = stripSince(s.profile.onboardedOn, s.meals, today);
          return fillFromPlan({ now, menu, meals: s.meals, skips: s.slotSkips, foods, offDay, startDate }).reduce((acc, m) => withMeal(acc, m, targets.kcal, now), s);
        }),
      runAutoFill: () => update(withAutoFillNow),
      addSavedMeal: (name, lines) =>
        update((s) => {
          const savedMeals = withSavedMeal(s.savedMeals, { id: newId(), name, lines });
          return savedMeals === s.savedMeals ? s : { ...s, savedMeals };
        }),
      removeSavedMeal: (id) =>
        update((s) => {
          const savedMeals = withoutSavedMeal(s.savedMeals, id);
          return savedMeals === s.savedMeals ? s : { ...s, savedMeals };
        }),
      restoreSavedMeal: (meal, index) =>
        update((s) => {
          const savedMeals = withSavedMealAt(s.savedMeals, meal, index);
          return savedMeals === s.savedMeals ? s : { ...s, savedMeals };
        }),
      logWalk: (date, minutes) => {
        const id = newId();
        update((s) => {
          const log = walkLog({ id, date, minutes, weightKg: s.profile.weightKg, now: new Date() });
          return log ? { ...s, activities: [...(s.activities ?? []), log] } : s;
        });
        return id;
      },
      addActivity: (a) => update((s) => ({ ...s, activities: [...(s.activities ?? []), a] })),
      removeActivity: (id) => update((s) => ({ ...s, activities: (s.activities ?? []).filter((x) => x.id !== id) })),
      burnedToday,
      toggleGrocery: (week, foodId) => update((s) => ({ ...s, groceryTicks: toggleTick(s.groceryTicks, week, foodId) })),
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
  }, [state, ready, today, hour, update, storageError, saveCloudBase, readNow, switchAccount, planFoods, fit, menuOn, streakDays, bestStreakDays, lifetimeStreakDays, lifetimeBestStreakDays, patternMealsLeft, weekPlan]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
