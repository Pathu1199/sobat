import { addDays } from './date';
import { defaultPortion, toMealItem } from './foods';
import { tokenize } from './memory';
import type { FoodItem, ISODate, Lang, Meal, MealItem, MealType } from './types';

/**
 * A fixed daily routine: what to eat at each point in the day, which bhaji
 * goes with lunch on which weekday, what to stay away from, and what the food
 * costs. All of it is plain data the person can edit; nothing here asks a
 * model anything.
 */

/** One line of a planned meal: a database food, a portion unit and how many. */
export type PlanLine = { foodId: string; unit: string; qty: number };

/** A fixed point in the day. `options` are alternatives; the first is the default. */
export type RoutineSlot = {
  id: string;
  type: MealType;
  label_en: string;
  label_mr: string;
  label_hi: string;
  options: PlanLine[][];
  /** The day's bhaji goes into this meal, on top of whichever option is picked. */
  withBhaji: boolean;
};

/**
 * Something the person decided to stop eating. Matched by database id, or by
 * whole words in the name for lines that came from a photo or a custom food.
 */
export type AvoidRule = {
  id: string;
  label_en: string;
  label_mr: string;
  label_hi: string;
  foodIds: string[];
  words: string[];
  /** What to have instead, best first. */
  swapIds: string[];
};

export type SpendCategory = 'fruit' | 'veg' | 'dry' | 'milk' | 'other';

/**
 * Money spent on food. A bulk buy is spread over the days it lasts, so a
 * month of badam does not blow one day's budget and leave the rest looking free.
 */
export type SpendLog = {
  id: string;
  date: ISODate;
  at: string;
  category: SpendCategory;
  rupees: number;
  spreadDays: number;
};

export type Routine = {
  enabled: boolean;
  walk: boolean;
  /** Bhaji choices per weekday, index 0 = Sunday as `Date.getDay()` counts. The first is the default. */
  week: string[][];
  bhajiUnit: string;
  slots: RoutineSlot[];
  avoid: AvoidRule[];
  budgetMin: number;
  budgetMax: number;
};

export const SPEND_CATEGORIES: SpendCategory[] = ['fruit', 'veg', 'dry', 'milk', 'other'];

/** How long a purchase in each category usually lasts, as the default spread. */
export const DEFAULT_SPREAD: Record<SpendCategory, number> = { fruit: 7, veg: 1, dry: 30, milk: 1, other: 1 };

export const MAX_BHAJI_CHOICES = 2;

export const DEFAULT_ROUTINE: Routine = {
  enabled: true,
  walk: true,
  week: [
    [],
    ['dudhi-bhaji'],
    ['palak-bhaji', 'methi-bhaji'],
    ['cabbage-matar-bhaji'],
    ['tomato-kanda-bhaji'],
    ['bhindi-bhaji'],
    ['shepu-bhaji', 'mixed-veg'],
  ],
  bhajiUnit: 'katori',
  slots: [
    {
      id: 'fruit',
      type: 'breakfast',
      label_en: 'Fruit',
      label_mr: 'फळ',
      label_hi: 'फल',
      options: [[{ foodId: 'papaya', unit: 'katori', qty: 1 }], [{ foodId: 'apple', unit: 'medium', qty: 1 }]],
      withBhaji: false,
    },
    {
      id: 'dry-fruit',
      type: 'snack',
      label_en: 'Badam and akrod at the office',
      label_mr: 'ऑफिसमध्ये बदाम-अक्रोड',
      label_hi: 'ऑफिस में बादाम-अखरोट',
      options: [
        [
          { foodId: 'almonds', unit: 'handful', qty: 1 },
          { foodId: 'walnuts', unit: 'piece', qty: 2 },
        ],
      ],
      withBhaji: false,
    },
    {
      id: 'lunch',
      type: 'lunch',
      label_en: 'Lunch',
      label_mr: 'दुपारचे जेवण',
      label_hi: 'दोपहर का खाना',
      options: [
        [{ foodId: 'chapati', unit: 'piece', qty: 2 }],
        [{ foodId: 'moong-dal', unit: 'vati', qty: 1 }],
        [{ foodId: 'masoor-dal', unit: 'vati', qty: 1 }],
      ],
      withBhaji: true,
    },
    {
      id: 'tea',
      type: 'snack',
      label_en: 'Afternoon black tea',
      label_mr: 'दुपारचा कोरा चहा',
      label_hi: 'दोपहर की काली चाय',
      options: [[{ foodId: 'black-tea', unit: 'cup', qty: 1 }]],
      withBhaji: false,
    },
    {
      id: 'bhel',
      type: 'snack',
      label_en: 'Evening murmura bhel',
      label_mr: 'संध्याकाळची मुरमुरे भेळ',
      label_hi: 'शाम की मुरमुरा भेल',
      options: [[{ foodId: 'murmura-bhel', unit: 'katori', qty: 1 }]],
      withBhaji: false,
    },
    {
      id: 'milk',
      type: 'snack',
      label_en: 'Milk or taak',
      label_mr: 'दूध किंवा ताक',
      label_hi: 'दूध या छाछ',
      options: [[{ foodId: 'taak', unit: 'glass', qty: 1 }], [{ foodId: 'toned-milk', unit: 'glass', qty: 1 }]],
      withBhaji: false,
    },
  ],
  avoid: [
    {
      id: 'sugar-tea',
      label_en: 'Milk tea with sugar',
      label_mr: 'दूध-साखरेचा चहा',
      label_hi: 'दूध-चीनी वाली चाय',
      foodIds: ['chai-with-sugar'],
      words: [],
      swapIds: ['black-tea'],
    },
    {
      id: 'cashews',
      label_en: 'Cashews',
      label_mr: 'काजू',
      label_hi: 'काजू',
      foodIds: ['cashews'],
      words: ['cashew', 'cashews', 'kaju', 'काजू'],
      swapIds: ['almonds', 'walnuts'],
    },
    {
      id: 'fried-snacks',
      label_en: 'Shev, namkeen, biscuits, fried bhaji',
      label_mr: 'शेव, नमकीन, बिस्किटे, भजी',
      label_hi: 'सेव, नमकीन, बिस्कुट, पकौड़े',
      foodIds: ['shev', 'namkeen-mixture', 'farsan-mix', 'chivda', 'parle-g-biscuit', 'marie-biscuit', 'kanda-bhaji'],
      words: ['shev', 'sev', 'शेव', 'namkeen', 'नमकीन', 'farsan', 'फरसाण', 'biscuit', 'biscuits', 'बिस्किट', 'papad', 'पापड', 'pakora', 'pakoda', 'भजी'],
      swapIds: ['roasted-chana', 'murmura-bhel'],
    },
  ],
  budgetMin: 170,
  budgetMax: 200,
};

export function weekdayOf(date: ISODate): number {
  return new Date(date + 'T12:00:00').getDay();
}

/** The bhaji choices for a date. Empty means a free day. */
export function bhajiFor(routine: Routine, date: ISODate): string[] {
  return routine.week[weekdayOf(date)] ?? [];
}

/** Add a bhaji to a day, or take it off if it is already there. Keeps at most two. */
export function toggleBhaji(week: string[][], day: number, foodId: string): string[][] {
  return week.map((list, i) => {
    if (i !== day) return list;
    if (list.includes(foodId)) return list.filter((x) => x !== foodId);
    return [...list, foodId].slice(-MAX_BHAJI_CHOICES);
  });
}

export function slotLabel(slot: Pick<RoutineSlot, 'label_en' | 'label_mr' | 'label_hi'>, lang: Lang): string {
  if (lang === 'mr') return slot.label_mr || slot.label_en;
  if (lang === 'hi') return slot.label_hi || slot.label_en;
  return slot.label_en;
}

/** Plan lines as meal lines with real numbers. Foods that no longer exist are dropped. */
export function planItems(lines: PlanLine[], foods: FoodItem[]): MealItem[] {
  const out: MealItem[] = [];
  for (const l of lines) {
    const food = foods.find((f) => f.id === l.foodId);
    if (!food) continue;
    const portion = food.portions.find((p) => p.unit === l.unit) ?? defaultPortion(food);
    out.push(toMealItem(food, (portion?.grams ?? 100) * l.qty));
  }
  return out;
}

/** What a slot logs: the chosen option, plus the day's bhaji where it belongs. */
export function slotLines(routine: Routine, slot: RoutineSlot, optionIdx: number, bhajiId: string | null): PlanLine[] {
  const option = slot.options[optionIdx] ?? slot.options[0] ?? [];
  if (!slot.withBhaji || !bhajiId) return option;
  return [{ foodId: bhajiId, unit: routine.bhajiUnit, qty: 1 }, ...option];
}

/** Every food that would count as having eaten this slot today. */
function slotFoodIds(slot: RoutineSlot, bhaji: string[]): Set<string> {
  const ids = new Set(slot.options.flat().map((l) => l.foodId));
  if (slot.withBhaji) bhaji.forEach((b) => ids.add(b));
  return ids;
}

/**
 * A slot is done once a meal of its type holds one of its foods. Matched on
 * the meal type too, so a chapati at dinner does not tick off lunch.
 */
export function slotLogged(slot: RoutineSlot, bhaji: string[], meals: Meal[]): boolean {
  const ids = slotFoodIds(slot, bhaji);
  return meals.some((m) => m.type === slot.type && m.items.some((it) => !!it.foodId && ids.has(it.foodId)));
}

/** The day as planned, default options only. A rough figure for the card, not a target. */
export function planKcal(routine: Routine, foods: FoodItem[], date: ISODate): number {
  const bhaji = bhajiFor(routine, date)[0] ?? null;
  return routine.slots.reduce((sum, s) => sum + planItems(slotLines(routine, s, 0, bhaji), foods).reduce((a, i) => a + i.kcal, 0), 0);
}

export type AvoidHit = { rule: AvoidRule; name: string; foodId?: string };

function ruleMatches(rule: AvoidRule, item: Pick<MealItem, 'foodId' | 'name_en' | 'name_mr'>): boolean {
  if (item.foodId && rule.foodIds.includes(item.foodId)) return true;
  if (rule.words.length === 0) return false;
  // Whole words, so "sev" catches sev puri but not sevai upma.
  const words = new Set(tokenize(`${item.name_en} ${item.name_mr}`));
  return rule.words.some((w) => words.has(w.toLowerCase()));
}

/** Avoided foods among these lines, one hit per rule. */
export function avoidHits(items: Pick<MealItem, 'foodId' | 'name_en' | 'name_mr'>[], rules: AvoidRule[]): AvoidHit[] {
  const out: AvoidHit[] = [];
  for (const rule of rules) {
    const hit = items.find((it) => ruleMatches(rule, it));
    if (hit) out.push({ rule, name: hit.name_en, foodId: hit.foodId });
  }
  return out;
}

/** A rule for one food, made from the routine screen's search. */
export function ruleForFood(food: FoodItem): AvoidRule {
  return {
    id: `food-${food.id}`,
    label_en: food.name_en,
    label_mr: food.name_mr,
    label_hi: food.name_hi,
    foodIds: [food.id],
    words: [],
    swapIds: [],
  };
}

/** Rupees that count against one day, with bulk buys spread over their days. */
export function spentOn(logs: SpendLog[], date: ISODate): number {
  let total = 0;
  for (const l of logs) {
    const days = Math.max(1, Math.round(l.spreadDays));
    if (l.date <= date && date < addDays(l.date, days)) total += l.rupees / days;
  }
  return Math.round(total);
}

export function spendStatus(spent: number, min: number, max: number): 'under' | 'in' | 'over' {
  if (spent > max) return 'over';
  if (spent >= min) return 'in';
  return 'under';
}

/** Old logs stop mattering once their spread has ended. */
export function pruneSpend(logs: SpendLog[], today: ISODate, keepDays = 120): SpendLog[] {
  const cutoff = addDays(today, -keepDays);
  return logs.filter((l) => addDays(l.date, Math.max(1, l.spreadDays)) > cutoff);
}

/** The routine in plain sentences, for the coach's context. */
export function routineFacts(routine: Routine, foods: FoodItem[], date: ISODate, todayMeals: Meal[], spentToday: number): string[] {
  if (!routine.enabled) return [];
  const name = (id: string) => foods.find((f) => f.id === id)?.name_en ?? id;
  const facts: string[] = [];
  const bhaji = bhajiFor(routine, date);
  const day = new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long' });
  facts.push(
    bhaji.length > 0
      ? `Their routine: today (${day}) the bhaji is ${bhaji.map(name).join(' or ')}, cooked in a kadhai with little oil.`
      : `Their routine: today (${day}) has no fixed bhaji.`,
  );
  for (const s of routine.slots) {
    const opts = s.options.map((o) => o.map((l) => `${l.qty} ${l.unit} ${name(l.foodId)}`).join(' + ')).join(' or ');
    facts.push(`Routine ${s.label_en}: ${opts}${s.withBhaji ? ' with the day’s bhaji' : ''}.`);
  }
  if (routine.walk) facts.push('They walk every morning and do no heavy exercise.');
  if (routine.avoid.length > 0) {
    facts.push(
      'Foods they chose to avoid, never suggest these: ' +
        routine.avoid.map((r) => (r.swapIds.length > 0 ? `${r.label_en} (have ${r.swapIds.map(name).join(' or ')} instead)` : r.label_en)).join('; ') +
        '.',
    );
  }
  facts.push(`They live in a PG. Daily food budget ₹${routine.budgetMin} to ₹${routine.budgetMax}; spent about ₹${spentToday} today.`);
  const hits = avoidHits(todayMeals.flatMap((m) => m.items), routine.avoid);
  if (hits.length > 0) facts.push(`Eaten today despite the avoid list: ${hits.map((h) => h.name).join(', ')}. Be kind about it.`);
  return facts;
}

/** Foods the routine says to stay away from, for filtering suggestions. */
export function avoidedFoodIds(routine: Routine): Set<string> {
  return new Set(routine.enabled ? routine.avoid.flatMap((r) => r.foodIds) : []);
}
