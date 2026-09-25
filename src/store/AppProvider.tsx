import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import foodsJson from '../data/foods.json';
import exercisesJson from '../data/exercises.json';
import { toISODate } from '../core/date';
import { budget as calcBudget, dailyTargets, sumTotals, type Budget, type Targets } from '../core/nutrition';
import { streak } from '../core/insights';
import { lastNDates } from '../core/date';
import type { AppState, ChatMsg, Exercise, FoodItem, Meal, MoodLog, Profile, Settings, SleepLog, WaterLog, WeightLog, WorkoutLog } from '../core/types';
import { EMPTY_STATE } from './defaults';

const KEY = 'sobat.state.v1';

const FOODS = foodsJson as unknown as FoodItem[];
const EXERCISES = exercisesJson as unknown as Exercise[];

type Ctx = {
  ready: boolean;
  state: AppState;
  foods: FoodItem[];
  exercises: Exercise[];
  today: string;
  targets: Targets;
  budget: Budget;
  waterToday: number;
  streakDays: number;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  addMeal: (m: Meal) => void;
  removeMeal: (id: string) => void;
  addWater: (ml: number) => void;
  undoWater: () => void;
  addWeight: (w: WeightLog) => void;
  addMood: (m: MoodLog) => void;
  addSleep: (s: SleepLog) => void;
  addWorkout: (w: WorkoutLog) => void;
  logNudge: (type: string, action: 'done' | 'snooze' | 'skip') => void;
  addChat: (m: ChatMsg) => void;
  clearChat: () => void;
  addCustomFood: (f: FoodItem) => void;
  resetAll: () => void;
  exportJSON: () => string;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AppState;
          setState({ ...EMPTY_STATE, ...parsed, profile: { ...EMPTY_STATE.profile, ...parsed.profile }, settings: { ...EMPTY_STATE.settings, ...parsed.settings } });
        }
      } catch {
        // A corrupt store should not brick the app; start fresh instead.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Debounced so rapid edits do not thrash storage.
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
    }, 250);
  }, [state, ready]);

  const today = toISODate();
  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const value = useMemo<Ctx>(() => {
    const targets = dailyTargets(state.profile);
    const todayMeals = state.meals.filter((m) => m.date === today);
    const totals = sumTotals(todayMeals.flatMap((m) => m.items));
    const hour = new Date().getHours();
    const budget = calcBudget(targets, totals, hour);
    const waterToday = state.water.filter((w) => w.date === today).reduce((a, w) => a + w.ml, 0);
    const dates = lastNDates(60, today);
    const mealDates = new Set(state.meals.map((m) => m.date));
    const streakDays = streak(dates, (d) => mealDates.has(d));

    return {
      ready,
      state,
      foods: [...FOODS, ...state.customFoods],
      exercises: EXERCISES,
      today,
      targets,
      budget,
      waterToday,
      streakDays,
      setProfile: (p) => update((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      setSettings: (x) => update((s) => ({ ...s, settings: { ...s.settings, ...x } })),
      addMeal: (m) => update((s) => ({ ...s, meals: [...s.meals, m] })),
      removeMeal: (id) => update((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) })),
      addWater: (ml) =>
        update((s) => ({ ...s, water: [...s.water, { id: String(Date.now()), at: new Date().toISOString(), date: toISODate(), ml }] })),
      undoWater: () =>
        update((s) => {
          const d = toISODate();
          const idx = [...s.water].map((w, i) => ({ w, i })).filter(({ w }) => w.date === d).pop();
          if (!idx) return s;
          return { ...s, water: s.water.filter((_, i) => i !== idx.i) };
        }),
      addWeight: (w) => update((s) => ({ ...s, weights: [...s.weights.filter((x) => x.date !== w.date), w], profile: { ...s.profile, weightKg: w.kg } })),
      addMood: (m) => update((s) => ({ ...s, moods: [...s.moods, m] })),
      addSleep: (sl) => update((s) => ({ ...s, sleep: [...s.sleep.filter((x) => x.date !== sl.date), sl] })),
      addWorkout: (w) => update((s) => ({ ...s, workouts: [...s.workouts.filter((x) => x.date !== w.date), w] })),
      logNudge: (type, action) =>
        update((s) => ({ ...s, nudges: [...s.nudges, { id: String(Date.now()), at: new Date().toISOString(), date: toISODate(), type, action }] })),
      addChat: (m) => update((s) => ({ ...s, chat: [...s.chat.slice(-60), m] })),
      clearChat: () => update((s) => ({ ...s, chat: [] })),
      addCustomFood: (f) => update((s) => ({ ...s, customFoods: [...s.customFoods, f] })),
      resetAll: () => {
        setState(EMPTY_STATE);
        AsyncStorage.removeItem(KEY).catch(() => {});
      },
      exportJSON: () => JSON.stringify(state, null, 2),
    };
  }, [state, ready, today, update]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
