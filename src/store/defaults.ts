import { DEFAULT_BREAK_SETTINGS } from '../core/breaks';
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

export const DEFAULT_SETTINGS: Settings = {
  // Your Windows PC on the home network. Change the IP in Settings.
  ollamaUrl: 'http://192.168.1.10:11434',
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
};
