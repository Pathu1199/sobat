import { defaultPortion } from './foods';
import { kcalForGrams } from './nutrition';
import { pattern } from './pattern';
import { slotTime, type PlanLine, type Routine, type RoutineSlot } from './routine';
import type { FoodItem, MealType } from './types';

/**
 * The week written down in advance: for each weekday, the meals, and in each
 * meal the foods with a measure and a count. The person edits it line by line
 * (bhakri for chapati, palak for methi, two pieces for three), and every
 * change shows the day's total against the target at once, so a plan that
 * quietly drifts too low is caught before it is eaten.
 *
 * Built from the routine the first time: the weekday bhaji, the fixed fruit,
 * nuts, tea, bhel and taak; lunch and dinner are full plates. Pure functions
 * only; the store keeps the result.
 */
export type PlanMeal = { id: string; type: MealType; time: string; lines: PlanLine[] };
export type PlanDay = { meals: PlanMeal[] };
/** Index 0 is Sunday, as Date.getDay() counts. */
export type WeekPlan = { days: PlanDay[] };

export type Role = 'bread' | 'rice' | 'bhaji' | 'dal' | 'dairy' | 'fruit' | 'nuts' | 'snack' | 'drink' | 'salad' | 'breakfast' | 'other';

export function roleOf(f: FoodItem): Role {
  if (f.tags.includes('healthy_swap') && f.category === 'veg' && /koshimbir|salad|kachumber/i.test(f.id + f.name_en)) return 'salad';
  if (f.category === 'grain') {
    if (f.tags.includes('breakfast')) return 'breakfast';
    return f.portions.some((p) => p.unit === 'piece') ? 'bread' : 'rice';
  }
  if (f.category === 'veg') return 'bhaji';
  if (f.category === 'dryfruit') return 'nuts';
  if (f.category === 'vegetable') return 'salad';
  if (f.category === 'dal' || f.tags.includes('usal')) return 'dal';
  if (f.category === 'dairy') return 'dairy';
  if (f.category === 'fruit') return 'fruit';
  if (f.category === 'beverage') return 'drink';
  if (f.category === 'snack') return /almond|walnut|badam|akrod|peanut|shengdana|chana|makhana|nut/i.test(f.id + f.name_en) ? 'nuts' : 'snack';
  return 'other';
}

export type LineInfo = { food: FoodItem; unit: string; label: string; grams: number; kcal: number; protein: number };

export function lineInfo(line: PlanLine, foods: FoodItem[], lang: 'en' | 'mr' | 'hi' = 'en'): LineInfo | null {
  const food = foods.find((f) => f.id === line.foodId);
  if (!food) return null;
  const portion = food.portions.find((p) => p.unit === line.unit) ?? defaultPortion(food);
  if (!portion) return null;
  const grams = Math.round(portion.grams * line.qty);
  const n = kcalForGrams(food, grams);
  const label = lang === 'mr' ? portion.label_mr : lang === 'hi' ? portion.label_hi : portion.label_en;
  return { food, unit: portion.unit, label, grams, kcal: n.kcal, protein: Math.round(n.protein * 10) / 10 };
}

export type Totals = { kcal: number; protein: number };

export function mealTotals(meal: PlanMeal, foods: FoodItem[]): Totals {
  let kcal = 0;
  let protein = 0;
  for (const l of meal.lines) {
    const i = lineInfo(l, foods);
    if (i) {
      kcal += i.kcal;
      protein += i.protein;
    }
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein) };
}

export function dayTotals(day: PlanDay, foods: FoodItem[]): Totals {
  return day.meals.reduce((a, m) => {
    const t = mealTotals(m, foods);
    return { kcal: a.kcal + t.kcal, protein: a.protein + t.protein };
  }, { kcal: 0, protein: 0 });
}

export type DayStatus = 'low' | 'under' | 'on' | 'over';

/** Below the floor or 15% under is "low": too little to keep muscle and the mood that keeps a plan going. */
export function dayStatus(kcal: number, target: number, floor: number): DayStatus {
  if (kcal < floor || kcal < target * 0.85) return 'low';
  if (kcal < target * 0.95) return 'under';
  if (kcal <= target * 1.05) return 'on';
  return 'over';
}

/** A sensible starting line for a food: a piece count for breads, its default measure otherwise. */
export function lineFor(food: FoodItem, qty?: number): PlanLine {
  const role = roleOf(food);
  const piece = food.portions.find((p) => p.unit === 'piece');
  if (role === 'bread' && piece) return { foodId: food.id, unit: 'piece', qty: qty ?? 2 };
  const p = defaultPortion(food);
  return { foodId: food.id, unit: p?.unit ?? food.default_portion, qty: qty ?? 1 };
}

export type Swap = { line: PlanLine; kcal: number; diff: number };

/**
 * What can take a line's place: the same kind of food (another bread for a
 * bread, another bhaji for a bhaji), in the same count where that makes
 * sense, with the calories it would change.
 */
export function swapsFor(line: PlanLine, foods: FoodItem[], avoided: Set<string>, limit = 12): Swap[] {
  const current = lineInfo(line, foods);
  if (!current) return [];
  const role = roleOf(current.food);
  return foods
    .filter((f) => f.id !== current.food.id && !avoided.has(f.id) && roleOf(f) === role && !f.tags.includes('fried') && !f.tags.includes('nonveg'))
    .map((f) => {
      const keepCount = f.portions.some((p) => p.unit === current.unit);
      let next: PlanLine = keepCount ? { foodId: f.id, unit: current.unit, qty: line.qty } : lineFor(f, role === 'bread' ? line.qty : 1);
      // Breads are swapped by what fills the plate, not by count: one bhakri stands in for two chapati.
      if (role === 'bread') {
        const one = lineInfo({ ...next, qty: 1 }, foods);
        if (one && one.kcal > 0) next = { ...next, qty: Math.min(3, Math.max(1, Math.round(current.kcal / one.kcal))) };
      }
      const info = lineInfo(next, foods);
      return info ? { line: next, kcal: info.kcal, diff: info.kcal - current.kcal } : null;
    })
    .filter((s): s is Swap => !!s)
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
    .slice(0, limit);
}

const has = (foods: FoodItem[], id: string) => foods.some((f) => f.id === id);
const pick = (foods: FoodItem[], ids: string[], i: number) => {
  const ok = ids.filter((id) => has(foods, id));
  return ok.length ? ok[i % ok.length] : null;
};

const BREAKFASTS = ['poha', 'upma', 'thalipeeth', 'moong-dal-chilla', 'idli', 'ghavan', 'dalia'];
const LUNCH_DALS = ['moong-dal', 'varan', 'masoor-dal', 'amti', 'moong-dal', 'kadhi', 'masoor-dal'];
const DINNER_DALS = ['matki-usal', 'moong-usal', 'pithla', 'varan', 'chavli-usal', 'moong-dal', 'akha-masoor-usal'];
const DINNER_BREADS = ['jowar-bhakri', 'chapati', 'jowar-bhakri', 'phulka', 'bajra-bhakri', 'chapati', 'ragi-roti'];
const SPARE_BHAJI = ['mixed-veg', 'methi-bhaji', 'palak-bhaji', 'dudhi-bhaji', 'cabbage-matar-bhaji', 'bhindi-bhaji', 'tondli-bhaji'];

function hasRole(lines: PlanLine[], foods: FoodItem[], role: Role): boolean {
  return lines.some((l) => {
    const f = foods.find((x) => x.id === l.foodId);
    return !!f && roleOf(f) === role;
  });
}

/**
 * One slot's lines on one weekday: the day's bhaji where the slot takes it,
 * the person's own fixed items, then the staples a plate is missing (bread,
 * dal, salad for lunch and dinner; the rotating dish for breakfast). A
 * snack is its fixed items only.
 */
export function slotPlanLines(routine: Routine, slot: RoutineSlot, d: number, foods: FoodItem[]): PlanLine[] {
  const lines: PlanLine[] = [];
  const add = (id: string | null, line?: PlanLine) => {
    if (!id || !has(foods, id) || lines.some((l) => l.foodId === id)) return;
    lines.push(line ?? lineFor(foods.find((f) => f.id === id)!));
  };
  if (slot.withBhaji && (slot.type === 'lunch' || slot.type === 'dinner')) {
    const bhaji = routine.week[d] ?? [];
    const i = slot.type === 'lunch' ? 0 : 1;
    const own = bhaji[i] && has(foods, bhaji[i]) ? bhaji[i] : pick(foods, SPARE_BHAJI, d + (slot.type === 'lunch' ? 0 : 3));
    if (own) lines.push({ foodId: own, unit: routine.bhajiUnit || 'katori', qty: 1 });
  }
  for (const l of slot.options[0] ?? []) add(l.foodId, l);
  if (slot.type === 'breakfast') {
    if (!hasRole(lines, foods, 'breakfast')) add(pick(foods, BREAKFASTS, d));
  } else if (slot.type === 'lunch') {
    if (!hasRole(lines, foods, 'bread') && !hasRole(lines, foods, 'rice')) add('chapati', { foodId: 'chapati', unit: 'piece', qty: 2 });
    if (!hasRole(lines, foods, 'dal')) add(pick(foods, LUNCH_DALS, d));
    if (!hasRole(lines, foods, 'salad')) add('kakdi-koshimbir', { foodId: 'kakdi-koshimbir', unit: 'vati', qty: 1 });
  } else if (slot.type === 'dinner') {
    if (!hasRole(lines, foods, 'bread') && !hasRole(lines, foods, 'rice')) {
      const b = pick(foods, DINNER_BREADS, d);
      if (b) add(b, lineFor(foods.find((f) => f.id === b)!, b.includes('bhakri') || b === 'ragi-roti' ? 1 : 2));
    }
    if (!hasRole(lines, foods, 'dal')) add(pick(foods, DINNER_DALS, d));
    if (!hasRole(lines, foods, 'salad')) add('green-salad', { foodId: 'green-salad', unit: 'katori', qty: 1 });
  }
  return lines;
}

/** The week from the pattern: one meal per slot, every day, in time order. Empty meals stay, so a slot can be filled later. */
export function buildWeekPlan(routine: Routine, foods: FoodItem[]): WeekPlan {
  const slots = pattern(routine);
  const days: PlanDay[] = [];
  for (let d = 0; d < 7; d++) {
    days.push({ meals: slots.map((p) => ({ id: p.id, type: p.type, time: slotTime(p.slot), lines: slotPlanLines(routine, p.slot, d, foods) })) });
  }
  return { days };
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Reshapes a saved plan to the current slots. A meal whose id matches a slot
 * keeps its lines and takes the slot's type and time; one with no matching
 * id lands on the still-free slot of its type nearest its own time (this is
 * how plans saved under the old seven names come across); anything left
 * over is dropped; a slot with no meal gets a built one when foods are
 * given, an empty one otherwise.
 */
export function alignWeekPlan(plan: WeekPlan, routine: Routine, foods?: FoodItem[]): WeekPlan {
  const slots = pattern(routine);
  const days = plan.days.map((day, d) => {
    const meals: PlanMeal[] = [];
    const taken = (id: string) => meals.some((m) => m.id === id);
    const usedOld = new Set<string>();
    for (const p of slots) {
      const m = day.meals.find((x) => x.id === p.id);
      if (m) {
        usedOld.add(m.id);
        meals.push({ ...m, type: p.type, time: slotTime(p.slot) });
      }
    }
    for (const m of day.meals) {
      if (usedOld.has(m.id)) continue;
      const free = slots.filter((p) => p.type === m.type && !taken(p.id));
      if (free.length === 0) continue;
      const best = free.reduce((a, b) => (Math.abs(b.minutes - toMin(m.time)) < Math.abs(a.minutes - toMin(m.time)) ? b : a));
      usedOld.add(m.id);
      meals.push({ ...m, id: best.id, type: best.type, time: slotTime(best.slot) });
    }
    for (const p of slots) {
      if (taken(p.id)) continue;
      meals.push({ id: p.id, type: p.type, time: slotTime(p.slot), lines: foods ? slotPlanLines(routine, p.slot, d, foods) : [] });
    }
    const order = new Map(slots.map((p, i) => [p.id, i]));
    meals.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { meals };
  });
  return { days };
}

type Step = { key: string; params: Record<string, string | number>; apply: (d: PlanDay) => PlanDay | null };

/** Which meal of a day a step means: the first of a type, the last, or the last snack before dinner. */
type Where = { type: MealType; which?: 'first' | 'last' | 'beforeDinner' };
const BREAKFAST: Where = { type: 'breakfast' };
const LUNCH: Where = { type: 'lunch' };
const DINNER: Where = { type: 'dinner' };
const MID: Where = { type: 'snack' };
const EVENING: Where = { type: 'snack', which: 'beforeDinner' };

function findMeal(day: PlanDay, w: Where): PlanMeal | undefined {
  const list = day.meals.filter((m) => m.type === w.type);
  if (w.which === 'last') return list[list.length - 1];
  if (w.which === 'beforeDinner') {
    const dinner = day.meals.find((m) => m.type === 'dinner');
    const before = dinner ? list.filter((m) => m.time < dinner.time) : list;
    return before[before.length - 1] ?? list[list.length - 1];
  }
  return list[0];
}

function editMeal(day: PlanDay, w: Where, fn: (m: PlanMeal) => PlanMeal | null): PlanDay | null {
  const m = findMeal(day, w);
  if (!m) return null;
  const next = fn(m);
  return next ? { meals: day.meals.map((x) => (x.id === m.id ? next : x)) } : null;
}

function bumpRole(day: PlanDay, foods: FoodItem[], w: Where, role: Role, by: number, min: number, max: number): PlanDay | null {
  return editMeal(day, w, (m) => {
    const i = m.lines.findIndex((l) => {
      const f = foods.find((x) => x.id === l.foodId);
      return f && roleOf(f) === role;
    });
    if (i < 0) return null;
    const q = m.lines[i].qty + by;
    if (q < min || q > max) return null;
    return { ...m, lines: m.lines.map((l, j) => (j === i ? { ...l, qty: q } : l)) };
  });
}

function addTo(day: PlanDay, foods: FoodItem[], w: Where, foodId: string, unit?: string): PlanDay | null {
  const food = foods.find((f) => f.id === foodId);
  if (!food) return null;
  return editMeal(day, w, (m) => (m.lines.some((l) => l.foodId === foodId) ? null : { ...m, lines: [...m.lines, unit ? { foodId, unit, qty: 1 } : lineFor(food, 1)] }));
}

/** Puts a staple back on a plate that has none of its kind: a roti where there is no bread, a dal where there is no dal. */
function addIfMissing(day: PlanDay, foods: FoodItem[], w: Where, role: Role, line: PlanLine): PlanDay | null {
  if (!has(foods, line.foodId)) return null;
  return editMeal(day, w, (m) => (hasRole(m.lines, foods, role) ? null : { ...m, lines: [...m.lines, line] }));
}

/** Takes a food off whichever meal of that type holds it. */
function dropFrom(day: PlanDay, type: MealType, foodId: string): PlanDay | null {
  const m = day.meals.find((x) => x.type === type && x.lines.some((l) => l.foodId === foodId));
  if (!m) return null;
  return { meals: day.meals.map((x) => (x.id === m.id ? { ...x, lines: x.lines.filter((l) => l.foodId !== foodId) } : x)) };
}

export type Balanced = { day: PlanDay; changes: { key: string; params: Record<string, string | number> }[] };

/**
 * Nudges a day toward the target, one kitchen-sized step at a time: another
 * chapati or bhakri, a katori of curd, a fruit, a handful of chana; or the
 * other way, one roti fewer, rice off, bhel off. Protein-first when adding.
 * Stops inside ±5% or when nothing sensible is left to change. Each change
 * names the meal by its type, which every screen can translate.
 */
export function balanceDay(day: PlanDay, foods: FoodItem[], target: number, avoided: Set<string>, floor = 0): Balanced {
  const ok = (id: string) => has(foods, id) && !avoided.has(id);
  const ups: Step[] = [
    // A plate first gets its staples back, then extras.
    { key: 'bal_add_bread', params: { meal: 'lunch' }, apply: (d) => (ok('chapati') ? addIfMissing(d, foods, LUNCH, 'bread', { foodId: 'chapati', unit: 'piece', qty: 2 }) : null) },
    { key: 'bal_add_bread', params: { meal: 'dinner' }, apply: (d) => (ok('jowar-bhakri') ? addIfMissing(d, foods, DINNER, 'bread', { foodId: 'jowar-bhakri', unit: 'piece', qty: 1 }) : null) },
    { key: 'bal_add_dal', params: { meal: 'lunch' }, apply: (d) => (ok('moong-dal') ? addIfMissing(d, foods, LUNCH, 'dal', { foodId: 'moong-dal', unit: 'katori', qty: 1 }) : null) },
    { key: 'bal_add_dal', params: { meal: 'dinner' }, apply: (d) => (ok('varan') ? addIfMissing(d, foods, DINNER, 'dal', lineFor(foods.find((f) => f.id === 'varan')!)) : null) },
    { key: 'bal_add_curd', params: { meal: 'lunch' }, apply: (d) => (ok('curd') ? addTo(d, foods, LUNCH, 'curd') : null) },
    { key: 'bal_more_bread', params: { meal: 'dinner' }, apply: (d) => bumpRole(d, foods, DINNER, 'bread', 1, 1, 3) },
    { key: 'bal_more_bread', params: { meal: 'lunch' }, apply: (d) => bumpRole(d, foods, LUNCH, 'bread', 1, 1, 3) },
    { key: 'bal_add_sprouts', params: { meal: 'snack' }, apply: (d) => (ok('sprouts-boiled') ? addTo(d, foods, EVENING, 'sprouts-boiled') : null) },
    { key: 'bal_add_fruit', params: { meal: 'snack' }, apply: (d) => (ok('banana') ? addTo(d, foods, EVENING, 'banana') : ok('apple') ? addTo(d, foods, EVENING, 'apple') : null) },
    { key: 'bal_add_rice', params: { meal: 'lunch' }, apply: (d) => (ok('steamed-rice') ? addTo(d, foods, LUNCH, 'steamed-rice', 'katori') : null) },
    { key: 'bal_add_chana', params: { meal: 'snack' }, apply: (d) => (ok('roasted-chana') ? addTo(d, foods, MID, 'roasted-chana') : null) },
    { key: 'bal_more_dal', params: { meal: 'dinner' }, apply: (d) => bumpRole(d, foods, DINNER, 'dal', 0.5, 0.5, 1.5) },
  ];
  const downs: Step[] = [
    { key: 'bal_drop_rice', params: { meal: 'lunch' }, apply: (d) => dropFrom(d, 'lunch', 'steamed-rice') },
    { key: 'bal_less_bread', params: { meal: 'dinner' }, apply: (d) => bumpRole(d, foods, DINNER, 'bread', -1, 1, 3) },
    { key: 'bal_less_bread', params: { meal: 'lunch' }, apply: (d) => bumpRole(d, foods, LUNCH, 'bread', -1, 1, 3) },
    { key: 'bal_drop_bhel', params: { meal: 'snack' }, apply: (d) => dropFrom(d, 'snack', 'murmura-bhel') },
    { key: 'bal_less_breakfast', params: { meal: 'breakfast' }, apply: (d) => bumpRole(d, foods, BREAKFAST, 'breakfast', -0.5, 0.5, 2) },
  ];
  // The band to land in: within 5% of the target, and never under the safe minimum.
  const lo = Math.max(target * 0.95, floor);
  const hi = Math.max(target * 1.05, lo + 50);
  const off = (k: number) => (k < lo ? lo - k : k > hi ? k - hi : 0);
  let cur = day;
  const changes: Balanced['changes'] = [];
  for (let guard = 0; guard < 14; guard++) {
    const kcal = dayTotals(cur, foods).kcal;
    if (off(kcal) === 0) break;
    const list = kcal < lo ? ups : downs;
    let moved = false;
    for (const s of list) {
      const next = s.apply(cur);
      if (!next) continue;
      const after = dayTotals(next, foods).kcal;
      // Only a step that gets closer to the band counts; an add that overshoots by more than it fixed is skipped.
      if (off(after) < off(kcal)) {
        cur = next;
        changes.push({ key: s.key, params: s.params });
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return { day: cur, changes };
}

/** Change one line in one meal of one day. A qty of 0 removes the line. */
export function setLine(plan: WeekPlan, dayIdx: number, mealId: string, lineIdx: number, next: PlanLine | null): WeekPlan {
  return {
    days: plan.days.map((d, i) =>
      i !== dayIdx
        ? d
        : {
            meals: d.meals.map((m) => {
              if (m.id !== mealId) return m;
              const lines = m.lines.map((l, j) => (j === lineIdx ? next : l)).filter((l): l is PlanLine => !!l && l.qty > 0);
              return { ...m, lines };
            }),
          },
    ),
  };
}

export function addLine(plan: WeekPlan, dayIdx: number, mealId: string, line: PlanLine): WeekPlan {
  return { days: plan.days.map((d, i) => (i !== dayIdx ? d : { meals: d.meals.map((m) => (m.id === mealId ? { ...m, lines: [...m.lines, line] } : m)) })) };
}

export function setDay(plan: WeekPlan, dayIdx: number, day: PlanDay): WeekPlan {
  return { days: plan.days.map((d, i) => (i === dayIdx ? day : d)) };
}

/** Copy one day over the weekdays (Monday to Friday), keeping the weekend as it is. */
export function copyToWeekdays(plan: WeekPlan, fromIdx: number): WeekPlan {
  const src = plan.days[fromIdx];
  return { days: plan.days.map((d, i) => (i >= 1 && i <= 5 && i !== fromIdx ? JSON.parse(JSON.stringify(src)) : d)) };
}
