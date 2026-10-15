import { toISODate } from './date';
import { skipKey, SLOT_EARLY_MIN, slotMinutes, slotStatus, type Routine, type RoutineSlot, type SlotStatus } from './routine';
import type { Meal, MealType } from './types';

/**
 * The eating pattern: the routine's slots in time order, each with a share
 * of the day's calories. Shares are weights, not percentages, so changing
 * one slot never breaks the others, and the allowances always add up to
 * the target. Everything that divides a day by meal (the budget per meal,
 * the week plan, what fits, the reminders) reads this, never its own list
 * of meals.
 */
export const DEFAULT_SHARE: Record<MealType, number> = { breakfast: 25, lunch: 35, snack: 10, dinner: 30 };

export type PatternSlot = {
  id: string;
  type: MealType;
  /** Minutes after midnight. */
  minutes: number;
  /** Fraction of the day's calories, 0 to 1; all slots add up to 1. */
  share: number;
  slot: RoutineSlot;
};

/** The slot's weight: its own, else the usual one for its kind of meal. Never negative. */
export function slotShare(slot: RoutineSlot): number {
  const own = typeof slot.share === 'number' && Number.isFinite(slot.share) ? slot.share : DEFAULT_SHARE[slot.type];
  return Math.max(0, own);
}

export function pattern(routine: Routine): PatternSlot[] {
  const slots = [...routine.slots].sort((a, b) => slotMinutes(a) - slotMinutes(b));
  const weights = slots.map(slotShare);
  const sum = weights.reduce((a, w) => a + w, 0);
  return slots.map((slot, i) => ({
    id: slot.id,
    type: slot.type,
    minutes: slotMinutes(slot),
    share: sum > 0 ? weights[i] / sum : 1 / Math.max(1, slots.length),
    slot,
  }));
}

/** This slot's calories for the day. */
export function allowance(target: number, p: PatternSlot): number {
  return Math.round(target * p.share);
}

function minutesOfIso(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** Minutes between two clock times, the short way round midnight. */
function gap(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
}

function nearestTo(list: PatternSlot[], minutes: number): PatternSlot {
  return list.reduce((best, s) => (gap(s.minutes, minutes) < gap(best.minutes, minutes) ? s : best));
}

/**
 * Which slot a meal belongs to: the id it was logged against if that slot
 * still exists; else the slot of the same type nearest in time; else the
 * nearest slot of any type. Null only when there are no slots at all.
 */
export function slotOf(meal: Pick<Meal, 'slotId' | 'type' | 'at'>, slots: PatternSlot[]): PatternSlot | null {
  if (slots.length === 0) return null;
  const byId = meal.slotId ? slots.find((s) => s.id === meal.slotId) : undefined;
  if (byId) return byId;
  const m = minutesOfIso(meal.at);
  const sameType = slots.filter((s) => s.type === meal.type);
  return nearestTo(sameType.length ? sameType : slots, m);
}

export type SlotState = {
  slot: PatternSlot;
  allowance: number;
  /** The week plan's total for this slot today; 0 when there is no plan. */
  planned: number;
  eaten: number;
  /** allowance minus eaten; negative when over. */
  left: number;
  status: SlotStatus;
  meals: Meal[];
};

/** The day slot by slot: what each may have, what it got, and where it stands at this minute. */
export function slotStates(input: {
  routine: Routine;
  target: number;
  meals: Meal[];
  nowMinutes: number;
  /** Today's done-keys; a slot whose skip key is here was skipped on purpose. */
  skipped: string[];
  planned?: Record<string, number>;
}): SlotState[] {
  const slots = pattern(input.routine);
  const byId = new Map<string, Meal[]>(slots.map((s) => [s.id, []]));
  for (const m of input.meals) {
    const s = slotOf(m, slots);
    if (s) byId.get(s.id)!.push(m);
  }
  return slots.map((p) => {
    const meals = byId.get(p.id) ?? [];
    const eaten = meals.reduce((a, m) => a + m.kcal, 0);
    const allow = allowance(input.target, p);
    return {
      slot: p,
      allowance: allow,
      planned: input.planned?.[p.id] ?? 0,
      eaten,
      left: allow - eaten,
      status: slotStatus(p.slot, input.nowMinutes, meals.length > 0, input.skipped.includes(skipKey(p.slot))),
      meals,
    };
  });
}

/**
 * The slot a meal eaten right now belongs to. The latest slot whose window
 * has opened (its time minus the early margin), when it is not yet done or
 * skipped, so a late lunch at 14:00 is still lunch even when breakfast was
 * never logged. Once that slot is done or skipped, the next one after it,
 * so a snack after lunch is not taken for a missed breakfast; with nothing
 * after it left, the latest earlier slot still open. Before any window has
 * opened, the first open slot of the day; when the day is done, the
 * nearest by time. Null only with no slots.
 */
export function currentSlot(states: SlotState[], nowMinutes: number): SlotState | null {
  if (states.length === 0) return null;
  const open = (s: SlotState) => s.status !== 'done' && s.status !== 'skipped';
  // States are in time order, so the opened ones are a prefix; -1 when none has opened yet.
  let last = -1;
  states.forEach((s, i) => {
    if (nowMinutes >= s.slot.minutes - SLOT_EARLY_MIN) last = i;
  });
  if (last >= 0 && open(states[last])) return states[last];
  const next = states.slice(last + 1).find(open);
  if (next) return next;
  const missed = states.slice(0, Math.max(0, last)).filter(open).pop();
  if (missed) return missed;
  return states.reduce((best, s) => (gap(s.slot.minutes, nowMinutes) < gap(best.slot.minutes, nowMinutes) ? s : best));
}

/** How far a meal's own time may be from the clock and still count as eaten now. */
export const EATEN_NOW_MS = 10 * 60000;

/**
 * A meal that names no slot (one from a photo, a recipe or the coach) gets
 * the slot it is eaten in: eaten now, today, the current slot and its type;
 * eaten earlier or on another day, as a queued photo or an undone delete,
 * the slot its own time and type put it in. `meals` and `skipped` are
 * today's. Unchanged when it already names a slot or there are none.
 */
export function withSlot(meal: Meal, input: { routine: Routine; target: number; meals: Meal[]; skipped: string[]; now: Date }): Meal {
  if (meal.slotId) return meal;
  const nowMinutes = input.now.getHours() * 60 + input.now.getMinutes();
  if (meal.date === toISODate(input.now) && Math.abs(Date.parse(meal.at) - input.now.getTime()) <= EATEN_NOW_MS) {
    const cur = currentSlot(slotStates({ routine: input.routine, target: input.target, meals: input.meals, nowMinutes, skipped: input.skipped }), nowMinutes);
    return cur ? { ...meal, slotId: cur.slot.id, type: cur.slot.type } : meal;
  }
  const p = slotOf(meal, pattern(input.routine));
  return p ? { ...meal, slotId: p.id, type: p.type } : meal;
}
