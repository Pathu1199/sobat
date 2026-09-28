import type { BreakLog, BreakSettings } from './breaks';
import type { MemoryItem } from './memory';
import type { QueuedPhoto } from './queue';
import type { UsageBucket } from './usage';

export type Lang = 'en' | 'mr' | 'hi';
export type ISODate = string;

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active';
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type Profile = {
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goalWeightKg: number;
  rateKgPerWeek: number;
  lang: Lang;
  onboarded: boolean;
};

export type Settings = {
  ollamaUrl: string;
  ollamaFallbackUrl: string;
  textModel: string;
  visionModel: string;
  nudgeMinutes: number;
  nudgesEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
  waterGoalMl: number;
  glassMl: number;
};

export type MealItem = {
  foodId?: string;
  name_en: string;
  name_mr: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  estimated: boolean;
};

export type Meal = {
  id: string;
  at: string;
  date: ISODate;
  type: MealType;
  items: MealItem[];
  kcal: number;
  protein: number;
  photoUri?: string;
  note?: string;
};

export type WaterLog = { id: string; at: string; date: ISODate; ml: number };
export type WeightLog = { date: ISODate; kg: number; waistCm?: number };
export type MoodLog = { id: string; at: string; date: ISODate; score: number; note?: string };

export type SleepLog = {
  date: ISODate;
  bed: string;
  wake: string;
  quality: number;
  wakeups: number;
  energy: number;
  minutes: number;
  score: number;
};

export type WorkoutLog = {
  id: string;
  date: ISODate;
  exerciseIds: string[];
  minutes: number;
  status: 'done' | 'skipped';
  felt?: number;
  pain?: boolean;
};

export type NudgeLog = { id: string; at: string; date: ISODate; type: string; action: 'done' | 'snooze' | 'skip' };
export type ChatOption = { foodId: string; name_en: string; name_mr: string; grams: number; kcal: number; protein: number };

export type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  /** Real options from the food database, so a suggestion can be logged in one tap. */
  options?: ChatOption[];
};

export type FoodPortion = { unit: string; label_en: string; label_mr: string; label_hi: string; grams: number };

export type FoodItem = {
  id: string;
  name_en: string;
  name_mr: string;
  name_hi: string;
  category: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  portions: FoodPortion[];
  default_portion: string;
  tags: string[];
  source: string;
};

export type Exercise = {
  id: string;
  name_en: string;
  name_mr: string;
  name_hi: string;
  category: 'walk' | 'mobility' | 'strength' | 'cardio_low' | 'stretch' | 'breathing' | 'balance';
  impact: 'low' | 'medium';
  level: 1 | 2 | 3;
  equipment: string;
  mode: 'time' | 'reps';
  default_seconds?: number;
  default_reps?: number;
  default_sets: number;
  rest_seconds: number;
  instructions_en: string[];
  instructions_mr: string[];
  instructions_hi: string[];
  safety_en: string;
  muscles: string[];
};

export type DailyTip = { date: ISODate; text: string; lang: Lang };

export type AppState = {
  /** 1 = the original single-timer break settings. 2 = four break kinds. */
  version: number;
  profile: Profile;
  settings: Settings;
  meals: Meal[];
  water: WaterLog[];
  weights: WeightLog[];
  sleep: SleepLog[];
  moods: MoodLog[];
  workouts: WorkoutLog[];
  nudges: NudgeLog[];
  chat: ChatMsg[];
  customFoods: FoodItem[];
  memory: MemoryItem[];
  usage: UsageBucket[];
  breaks: BreakLog[];
  breakSettings: BreakSettings;
  tips: DailyTip[];
  photoQueue: QueuedPhoto[];
  steps: StepLog[];
  /** Decision-card actions ticked off, kept only for the day they belong to. */
  actionsDone: { date: ISODate; key: string }[];
};

export type StepLog = { date: ISODate; count: number };
