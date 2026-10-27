import { toISODate } from './date';
import { SLOT_EARLY_MIN, SLOT_GRACE_MIN, slotMinutes, slotStatus, type Routine, type RoutineSlot, type SlotStatus } from './routine';
import type { ISODate, Meal, MealType } from './types';

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

/** What matching a meal to a slot needs; a date's menu meal fits it as well as a pattern slot. */
export type SlotPoint = { id: string; type: MealType; minutes: number };

function nearestTo<S extends SlotPoint>(list: S[], minutes: number): S {
  return list.reduce((best, s) => (gap(s.minutes, minutes) < gap(best.minutes, minutes) ? s : best));
}

/**
 * Which slot a meal belongs to: the id it was logged against if that slot
 * still exists; else the slot of the same type nearest in time; else the
 * nearest slot of any type. Null only when there are no slots at all.
 */
export function slotOf<S extends SlotPoint>(meal: Pick<Meal, 'slotId' | 'type' | 'at'>, slots: S[]): S | null {
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
  /** Marked skipped on the day, whatever it holds; `status` reads done when a meal is still in it. */
  skipped: boolean;
  meals: Meal[];
};

/** The day slot by slot: what each may have, what it got, and where it stands at this minute. */
export function slotStates(input: {
  routine: Routine;
  target: number;
  meals: Meal[];
  nowMinutes: number;
  /** Slot ids skipped on purpose on the day being looked at. */
  skippedSlots: string[];
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
    const skipped = input.skippedSlots.includes(p.id);
    return {
      slot: p,
      allowance: allow,
      planned: input.planned?.[p.id] ?? 0,
      eaten,
      left: allow - eaten,
      status: slotStatus(p.slot, input.nowMinutes, meals.length > 0, skipped),
      skipped,
      meals,
    };
  });
}

/**
 * The slots settled for the day: eaten or skipped. A slot holding only a meal
 * the app filled in from the plan counts as eaten as planned. The coach, the
 * plates and the fits card all go by this.
 */
export function settledSlotIds(states: SlotState[]): string[] {
  return states.filter((s) => s.status === 'done' || s.status === 'skipped').map((s) => s.slot.id);
}

/** A slot that holds meals, every one of them filled in by the app from the plan and not yet confirmed. */
export function onlyFilledIn(s: SlotState): boolean {
  return s.meals.length > 0 && s.meals.every((m) => m.source === 'auto');
}

/**
 * The slot a meal eaten right now belongs to. The latest slot whose window
 * has opened (its time minus the early margin), when it is not yet done or
 * skipped, so a late lunch at 14:00 is still lunch even when breakfast was
 * never logged. Once that slot is done or skipped, the next one after it,
 * so a snack after lunch is not taken for a missed breakfast; with nothing
 * after it left, the latest earlier slot still open. Before any window has
 * opened, the first open slot of the day; when the day is done, the
 * nearest by time. A slot holding only a meal the app filled in from the plan
 * is still open here, though it counts as eaten, so a real meal eaten in it
 * replaces that copy; but only while no later slot whose window has opened
 * holds a real meal or is skipped: once the day has moved past it, a meal
 * eaten late is not taken for the planned one. A tea logged ahead into a slot
 * whose window has not opened yet has not moved the day on. A skipped slot is
 * never open, whatever it holds. Null only with no slots.
 */
export function currentSlot(states: SlotState[], nowMinutes: number): SlotState | null {
  if (states.length === 0) return null;
  // States are in time order, so the opened ones are a prefix; -1 when none has opened yet.
  let last = -1;
  states.forEach((s, i) => {
    if (nowMinutes >= s.slot.minutes - SLOT_EARLY_MIN) last = i;
  });
  // An opened slot with a real meal or a skip settles every filled-in slot before it.
  const settled = (s: SlotState, i: number) => i <= last && (s.skipped || s.meals.some((m) => m.source !== 'auto'));
  const lastSettled = states.reduce((at, s, i) => (settled(s, i) ? i : at), -1);
  const open = (s: SlotState, i: number) => !s.skipped && (s.status !== 'done' || (onlyFilledIn(s) && i > lastSettled));
  if (last >= 0 && open(states[last], last)) return states[last];
  const next = states.find((s, i) => i > last && open(s, i));
  if (next) return next;
  const missed = states.filter((s, i) => i < last && open(s, i)).pop();
  if (missed) return missed;
  return states.reduce((best, s) => (gap(s.slot.minutes, nowMinutes) < gap(best.slot.minutes, nowMinutes) ? s : best));
}

/** How far a meal's own time may be from the clock and still count as eaten now. */
export const EATEN_NOW_MS = 10 * 60000;

/**
 * The slot a meal eaten at `at` on `date` belongs to, judged by what was true
 * then: the day's slots as they stood with the meals logged that date up to
 * that moment and the slots skipped that date, and `currentSlot` at that
 * minute. A meal eaten now and a photo taken earlier and read later go
 * through the same rule, so a dinner photographed at 19:15 after a 16:00
 * snack is dinner, not the snack whose window it fell in. A meal stamped up
 * to EATEN_NOW_MS after the moment counts as eaten by then: another device's
 * clock may run ahead, and the old plan screen stamps a meal with its slot's
 * time. `meals` may hold any dates; `skippedSlots` are the slot ids skipped
 * on `date`. Null only with no slots.
 */
export function slotForMealAt(input: { routine: Routine; target: number; meals: Meal[]; skippedSlots: string[]; date: ISODate; at: Date }): PatternSlot | null {
  const at = input.at.getTime();
  const minutes = input.at.getHours() * 60 + input.at.getMinutes();
  const before = input.meals.filter((m) => m.date === input.date && Date.parse(m.at) <= at + EATEN_NOW_MS);
  const cur = currentSlot(slotStates({ routine: input.routine, target: input.target, meals: before, nowMinutes: minutes, skippedSlots: input.skippedSlots }), minutes);
  return cur ? cur.slot : null;
}

/**
 * A meal that names no slot (one from a recipe or the coach) gets the slot
 * it is eaten in: eaten now, today, the slot `slotForMealAt` gives now, and
 * its type; eaten earlier or on another day, as an undone delete, the slot
 * its own time and type put it in. A queued photo finds its slot before it
 * gets here. `meals` and `skippedSlots` are today's. Unchanged when it
 * already names a slot or there are none.
 */
export function withSlot(meal: Meal, input: { routine: Routine; target: number; meals: Meal[]; skippedSlots: string[]; now: Date }): Meal {
  if (meal.slotId) return meal;
  const today = toISODate(input.now);
  if (meal.date === today && Math.abs(Date.parse(meal.at) - input.now.getTime()) <= EATEN_NOW_MS) {
    const cur = slotForMealAt({ routine: input.routine, target: input.target, meals: input.meals, skippedSlots: input.skippedSlots, date: today, at: input.now });
    return cur ? { ...meal, slotId: cur.id, type: cur.type } : meal;
  }
  const p = slotOf(meal, pattern(input.routine));
  return p ? { ...meal, slotId: p.id, type: p.type } : meal;
}

/**
 * The slot whose turn it is at this minute by the clock alone: the latest one
 * whose window (its time minus the early margin) has opened; before the day's
 * first window opens, the first slot. Its one caller is the coach's meal
 * clock (`coachAdvice` in coach.ts: the slot due now, the one after it), which
 * reads this rather than a fixed list of meal hours. It does not know what was
 * eaten or skipped; the coach is told which slots are settled, and a meal being
 * logged finds its slot with `slotForMealAt`. Null only with no slots.
 */
export function slotAt(routine: Routine, minutes: number): PatternSlot | null {
  const slots = pattern(routine);
  if (slots.length === 0) return null;
  let at = slots[0];
  for (const s of slots) if (minutes >= s.minutes - SLOT_EARLY_MIN) at = s;
  return at;
}

/**
 * How much of the day's target someone following their own pattern would
 * have eaten by this minute of the day: each slot's share counts in as its
 * window runs, from its time minus the early margin to its time plus the
 * grace. The least a day still running is judged against.
 */
export function expectedKcalByMinute(target: number, minutes: number, slots: PatternSlot[]): number {
  const span = SLOT_EARLY_MIN + SLOT_GRACE_MIN;
  let share = 0;
  for (const s of slots) share += s.share * Math.min(1, Math.max(0, (minutes - (s.minutes - SLOT_EARLY_MIN)) / span));
  return Math.round(target * Math.min(1, share));
}

/**
 * The day's target over every slot whose window has opened by this minute,
 * in full: the most someone following their pattern may have eaten by now.
 * A breakfast eaten as its window opens is all allowed, not over.
 */
export function openedKcalByMinute(target: number, minutes: number, slots: PatternSlot[]): number {
  const share = slots.reduce((a, s) => (minutes >= s.minutes - SLOT_EARLY_MIN ? a + s.share : a), 0);
  return Math.round(target * Math.min(1, share));
}

/** The minute the last slot's window closes (its time plus the grace): until then the day is still running. */
export function windowsCloseAt(slots: PatternSlot[]): number {
  return slots.reduce((a, s) => Math.max(a, s.minutes + SLOT_GRACE_MIN), 0);
}
