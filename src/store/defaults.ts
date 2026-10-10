import { Platform } from 'react-native';
import { DEFAULT_BREAK_SETTINGS } from '../core/breaks';
import { DEFAULT_ROUTINE } from '../core/routine';
import { DEFAULT_SCHEDULE } from '../core/schedule';
import type { AppState, Profile, Settings } from '../core/types';

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
  nudgesEnabled: true,
  quietStartHour: 22,
  quietEndHour: 7,
  waterGoalMl: 3000,
  glassMl: 250,
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

export const EMPTY_STATE: AppState = {
  version: 5,
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
  breaks: [],
  breakSettings: DEFAULT_BREAK_SETTINGS,
  tips: [],
  photoQueue: [],
  steps: [],
  actionsDone: [],
  routine: DEFAULT_ROUTINE,
  spend: [],
  schedule: DEFAULT_SCHEDULE,
  weekPlan: null,
  celebrated: null,
  activities: [],
};
