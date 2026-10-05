import { Platform } from 'react-native';
import { DEFAULT_BREAK_SETTINGS } from '../core/breaks';
import { DEFAULT_ROUTINE } from '../core/routine';
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
  nudgeMinutes: 30,
  nudgesEnabled: true,
  quietStartHour: 22,
  quietEndHour: 7,
  waterGoalMl: 3000,
  glassMl: 250,
};

export const EMPTY_STATE: AppState = {
  version: 2,
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
};
