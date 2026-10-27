import { Platform } from 'react-native';
import foodsJson from '../data/foods.json';
import { DEFAULT_BREAK_SETTINGS } from '../core/breaks';
import { NEUTRAL_ROUTINE } from '../core/routine';
import { DEFAULT_SCHEDULE } from '../core/schedule';
import { DEFAULT_TABS, DEFAULT_TODAY_CARDS } from '../core/tabs';
import type { AppState, FoodItem, Profile, Settings } from '../core/types';

const FOODS = foodsJson as unknown as FoodItem[];

/** Every food there is: the database and the person's own. Planned lines can name any of them, whatever the diet filter shows. */
export function allFoods(customFoods: FoodItem[]): FoodItem[] {
  return [...FOODS, ...customFoods];
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  sex: 'male',
  birthYear: 1998,
  heightCm: 170,
  weightKg: 80,
  activity: 'sedentary',
  goalWeightKg: 70,
  rateKgPerWeek: 0.5,
  lang: 'en',
  onboarded: false,
};

/** The placeholder address older versions shipped with. */
export const OLD_OLLAMA_PLACEHOLDER = 'http://192.168.1.10:11434';

/**
 * In a browser or the desktop shell, Ollama runs on the same machine. On a
 * phone, localhost is the phone itself, so it needs the PC's address instead.
 */
export const DEFAULT_OLLAMA_URL = Platform.OS === 'web' ? 'http://localhost:11434' : OLD_OLLAMA_PLACEHOLDER;

export const DEFAULT_SETTINGS: Settings = {
  ollamaUrl: DEFAULT_OLLAMA_URL,
  // A Tailscale name reaches the same PC from outside home.
  ollamaFallbackUrl: '',
  textModel: 'qwen3:8b',
  visionModel: 'qwen2.5vl:7b',
  nudgeMinutes: 60,
  notifyGapMinutes: 60,
  // The hourly in-app nudges are off unless switched on in Settings.
  nudgesEnabled: false,
  quietStartHour: 22,
  quietEndHour: 7,
  waterGoalMl: 3000,
  // Water is counted in bottles and walking in minutes, one tap at a time.
  bottleMl: 500,
  walkGoalMin: 30,
  tabs: [...DEFAULT_TABS],
  todayCards: DEFAULT_TODAY_CARDS.map((c) => ({ ...c })),
  // Off unless switched on: the screen breaks, the mantra and the plates the app makes up.
  features: { breaks: false, mantra: false, autoPlates: false },
  // Only the meal-time prompt is on; the rest are a switch away.
  reminders: { mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false, away: false, water: false, sleepCheckin: false, dayReview: false },
  // Most of the people this is built for are vegetarian; the setting is one tap away.
  diet: 'veg',
  appearance: 'system',
  textScale: 1,
  pushRelay: false,
  weighDay: 0,
  offDays: [0],
  myActivities: [],
  lowImpactOnly: false,
};

/** The newest shape of the stored state this build knows. A file written by a later one is left for that build to change. */
export const STATE_VERSION = 7;

export const EMPTY_STATE: AppState = {
  version: STATE_VERSION,
  profile: DEFAULT_PROFILE,
  settings: DEFAULT_SETTINGS,
  meals: [],
  water: [],
  weights: [],
  sleep: [],
  moods: [],
  workouts: [],
  nudges: [],
  chat: [],
  customFoods: [],
  memory: [],
  usage: [],
  openedDates: [],
  breaks: [],
  breakSettings: DEFAULT_BREAK_SETTINGS,
  tips: [],
  photoQueue: [],
  steps: [],
  actionsDone: [],
  slotSkips: [],
  savedMeals: [],
  // A new person's pattern: the four meals of the day, on, with no bhaji week, avoid list, budget or walk.
  // Every list is a copy of NEUTRAL_ROUTINE's, so no two states ever share a list.
  routine: {
    ...NEUTRAL_ROUTINE,
    week: NEUTRAL_ROUTINE.week.map((d) => [...d]),
    avoid: [...NEUTRAL_ROUTINE.avoid],
    overrides: { ...NEUTRAL_ROUTINE.overrides },
    slots: NEUTRAL_ROUTINE.slots.map((s) => ({ ...s, options: s.options.map((o) => o.map((l) => ({ ...l }))) })),
  },
  spend: [],
  schedule: DEFAULT_SCHEDULE,
  weekPlan: null,
  celebrated: null,
  activities: [],
  groceryTicks: null,
  menus: [],
};
