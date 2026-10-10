import type { BreakLog, BreakSettings } from './breaks';
import type { MemoryItem } from './memory';
import type { QueuedPhoto } from './queue';
import type { Routine, SpendLog } from './routine';
import type { WorkSchedule } from './schedule';
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
  /** The foot of the mountain: set once at the first weigh-in and never moved by later ones. */
  startWeightKg?: number;
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
  /** Minimum minutes between any two reminders the app sends on its own. */
  notifyGapMinutes: number;
  quietStartHour: number;
  quietEndHour: number;
  waterGoalMl: number;
  glassMl: number;
  /** When the last Google Drive backup was written, ISO time. */
  driveBackupAt?: string;
  /** What the food list may show. 'veg' hides meat, fish and eggs. */
  diet: Diet;
  /** Follow the phone, or force light or dark. */
  appearance: 'system' | 'light' | 'dark';
  /** Multiplier on every type size; 1 is the design size. */
  textScale: number;
  /** Web only: reminders through the relay while the app is closed. */
  pushRelay: boolean;
  /** Weekday to weigh in, 0 = Sunday. */
  weighDay: number;
  /** Weekdays (Date.getDay(), 0 = Sunday) the person takes off: nothing is tracked or judged. */
  offDays: number[];
  /** The activities the person picked to track; empty until chosen. */
  myActivities: string[];
  /** Hide high-impact activities (knee, back, heart). */
  lowImpactOnly: boolean;
};

export type Diet = 'veg' | 'egg' | 'nonveg';

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

/** One bout of an activity the person chose: what, how long, how hard, and the calories it cost at their weight then. */
export type ActivityLog = {
  id: string;
  date: ISODate;
  at: string;
  activityId: string;
  minutes: number;
  /** 0 easy, 1 normal, 2 hard. */
  intensity: 0 | 1 | 2;
  kcal: number;
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
  /** Other names people type, often Marathi in English letters: "flower batata", "patal bhaji". */
  aliases?: string[];
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
  /** The fixed daily food routine: weekly bhaji, meal slots, avoid list, budget. */
  routine: Routine;
  /** Rupees spent on food. */
  spend: SpendLog[];
  /** The office day: start, breaks, lunch, tea, end. */
  schedule: WorkSchedule;
  /** The week written down in advance, Sunday first. Null until the plan screen is first opened. */
  weekPlan?: import('./weekPlan').WeekPlan | null;
  /** Wins already celebrated (badge:, level:, challenge: ids). Null until first seeded. */
  celebrated?: string[] | null;
  /** Activities done, by the person's own choice. */
  activities: ActivityLog[];
  /** Grocery lines ticked off, for one week at a time. */
  groceryTicks?: { week: string; ids: string[] } | null;
};

export type StepLog = { date: ISODate; count: number };
