import type { BreakLog, BreakSettings } from './breaks';
import type { MemoryItem } from './memory';
import type { QueuedPhoto } from './queue';
import type { PlanLine, Routine, SpendLog } from './routine';
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
  /** The day setup was finished, when no meal-time prompt goes out. Missing on older profiles: they are not on day one. */
  onboardedOn?: ISODate;
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
  /** One tap on the water tile adds a bottle of this many ml. */
  bottleMl: number;
  /** Minutes of walking a day the walk tile fills toward. */
  walkGoalMin: number;
  /** Extra tabs beside Today, ➕ and Me, in order; at most two. */
  tabs: TabId[];
  /** The cards on Today under the calories left, in order, each on or off. */
  todayCards: { id: TodayCardId; on: boolean }[];
  /** Parts of the app that stay off unless switched on in Settings. */
  features: { breaks: boolean; mantra: boolean; autoPlates: boolean };
  /** Which reminders go out. Only the meal-time prompt is on by default. */
  reminders: { mealPrompt: boolean; fillYesterday: boolean; planWeek: boolean; weeklyReport: boolean };
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

/** A tab the person may add beside Today, ➕ and Me. */
export type TabId = 'progress' | 'coach' | 'body' | 'sleep' | 'plan';
/** A card the person may show on Today, under the calories left. */
export type TodayCardId = 'coach' | 'waterWalk' | 'menu' | 'weight' | 'sleep' | 'steps' | 'climb' | 'mantra';

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

/** Where a meal came from: typed, searched, a photo or a barcode ('manual'); eaten as planned or confirmed ('plan'); filled in by the app from the plan and not confirmed yet ('auto'). */
export type MealSource = 'manual' | 'plan' | 'auto';

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
  /** The pattern slot this meal was logged against. Older meals have none and are matched by type and time. */
  slotId?: string;
  /** Missing means 'manual', for meals logged before there was a plan to log from. */
  source?: MealSource;
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
/** A slot not eaten on purpose on one date. One per date and slot. */
export type SlotSkip = { id: string; date: ISODate; slotId: string };
/** A meal the person logs often, saved under their own name ("my usual thali"). */
export type SavedMeal = { id: string; name: string; lines: PlanLine[] };
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
  /** Slots skipped on purpose, by date. A meal later logged in the slot takes its skip away. */
  slotSkips: SlotSkip[];
  /** Meals saved to log again in one tap. */
  savedMeals: SavedMeal[];
  /** The fixed daily food routine: weekly bhaji, meal slots, avoid list, budget. */
  routine: Routine;
  /** Rupees spent on food. */
  spend: SpendLog[];
  /** The office day: start, breaks, lunch, tea, end. */
  schedule: WorkSchedule;
  /** Retired in version 7: the one-week template became this week's `menus`. Always null after a load; kept so a merge with an older file clears it. */
  weekPlan?: import('./weekPlan').WeekPlan | null;
  /** Wins already celebrated (badge:, level:, challenge: ids). Null until first seeded. */
  celebrated?: string[] | null;
  /** Activities done, by the person's own choice. */
  activities: ActivityLog[];
  /** Grocery lines ticked off, for one week at a time. */
  groceryTicks?: { week: string; ids: string[] } | null;
  /** The menu of each date that was written: edited, or carried over from the old week plan. Other dates show as they start (see core/menu.ts). */
  menus: import('./menu').DayMenu[];
};

export type StepLog = { date: ISODate; count: number };
