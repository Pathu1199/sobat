# Eating Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the routine's meal slots the one eating pattern that the per-meal budget, the week plan, the log screen, the fits card and the reminders all derive from, and have the app reach out when days go unlogged.

**Architecture:** Pure functions in `src/core` (`pattern.ts`, `reminders.ts`, `intake.ts`, changes to `weekPlan.ts`, `dayPlan.ts`, `nudge.ts`) do every number; screens read them; the store realigns the week plan when slots change; a v6 migration carries existing data. On the phone, `useScheduledReminders` reconciles a week of OS notifications against the pattern.

**Tech Stack:** Expo SDK 57, expo-router, React Native 0.86, expo-notifications ~57.0.21, TypeScript, vitest 4 (TZ pinned to Asia/Kolkata in `vitest.config.mts`).

Spec: `docs/superpowers/specs/2026-10-15-eating-pattern-design.md`.

## Global Constraints

- Run `npx tsc --noEmit`, `npx expo lint` and `npx vitest run` before every commit. Lint is clean at the start (no problems) and must stay clean. 381 tests pass at the start; the count only goes up.
- Never add `eslint-disable` comments. React Compiler rules apply: no ref reads or writes during render, no set-state in an effect body without a condition, derive values with `useMemo`.
- Every new i18n key is added to all three dicts in `src/i18n/index.ts`: `en` (closes at the `};` near line 950), `mr` (closes near line 1901), `hi` (closes near line 2850). `mr` and `hi` spread `...en`, so a missing key falls back silently; add it anyway. Before adding a key, `grep -n "^  <key>:" src/i18n/index.ts` must print nothing (a duplicate key is a TS1117 error). Add new keys as the last lines before each dict's closing `};`.
- Copy is plain sentences; numbers are digits; no em-dashes.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never push: every push to `main` deploys the website and publishes an APK.
- Do not create or edit `ios/` or `android/`.
- The three test fixtures below are reused across tasks; copy them verbatim where a task says so.

---

### Task 1: Slot shares and the pattern core

**Files:**
- Modify: `src/core/routine.ts` (the `RoutineSlot` type near line 17, `DEFAULT_ROUTINE` near line 81)
- Modify: `src/core/types.ts` (the `Meal` type near line 77)
- Create: `src/core/pattern.ts`
- Test: `src/core/__tests__/pattern.test.ts`

**Interfaces:**
- Produces: `RoutineSlot.share?: number`; `DINNER_SLOT: RoutineSlot`; `Meal.slotId?: string`; from `pattern.ts`: `DEFAULT_SHARE`, `slotShare(slot)`, `PatternSlot`, `pattern(routine)`, `allowance(target, p)`, `slotOf(meal, slots)`, `SlotState`, `slotStates(input)`, `nextSlot(states)`, `slotForNow(states, nowMinutes)`.

- [ ] **Step 1: Add the share field and the dinner slot to `src/core/routine.ts`**

In the `RoutineSlot` type, after `time?: string;` add:

```ts
  /** Weight of the day's calories this meal gets. Missing means the usual share for its kind of meal. */
  share?: number;
```

Before `export const DEFAULT_ROUTINE` add:

```ts
/** A dinner for routines saved before there was one: the week plan needs a slot to put dinner in. */
export const DINNER_SLOT: RoutineSlot = {
  id: 'dinner',
  time: '20:00',
  type: 'dinner',
  label_en: 'Dinner',
  label_mr: 'रात्रीचे जेवण',
  label_hi: 'रात का खाना',
  options: [[]],
  withBhaji: true,
  share: 20,
};
```

In `DEFAULT_ROUTINE.slots` give every slot a share and insert the dinner between `bhel` and `milk`:

- `fruit`: add `share: 15,` after `time: '08:30',`
- `dry-fruit`: add `share: 10,`
- `lunch`: add `share: 35,`
- `tea`: add `share: 5,`
- `bhel`: add `share: 10,`
- after the `bhel` slot object, add the line `DINNER_SLOT,`
- `milk`: add `share: 5,`

- [ ] **Step 2: Add `slotId` to `Meal` in `src/core/types.ts`**

After `note?: string;` in `Meal` add:

```ts
  /** The pattern slot this meal was logged against. Older meals have none and are matched by type and time. */
  slotId?: string;
```

- [ ] **Step 3: Write the failing tests**

Create `src/core/__tests__/pattern.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { allowance, DEFAULT_SHARE, nextSlot, pattern, slotForNow, slotOf, slotShare, slotStates } from '../pattern';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { Meal } from '../types';

export const slot = (id: string, type: RoutineSlot['type'], time: string, share?: number): RoutineSlot => ({
  id,
  type,
  time,
  label_en: id,
  label_mr: '',
  label_hi: '',
  options: [[]],
  withBhaji: false,
  share,
});
const routine: Routine = {
  ...DEFAULT_ROUTINE,
  enabled: true,
  slots: [slot('dinner', 'dinner', '19:30', 35), slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40)],
};
const at = (hhmm: string) => new Date(`2026-10-12T${hhmm}:00`).toISOString();
const meal = (type: Meal['type'], hhmm: string, kcal: number, slotId?: string): Meal => ({
  id: `${type}-${hhmm}`,
  at: at(hhmm),
  date: '2026-10-12',
  type,
  items: [],
  kcal,
  protein: 0,
  slotId,
});

describe('pattern', () => {
  it('sorts the slots by time and turns shares into fractions that add up to one', () => {
    const p = pattern(routine);
    expect(p.map((s) => s.id)).toEqual(['morning', 'lunch', 'dinner']);
    expect(p.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
    expect(p[1].share).toBeCloseTo(0.4);
    expect(p[1].minutes).toBe(13 * 60);
  });

  it('gives a slot without a share the usual one for its kind, and all-zero shares equal ones', () => {
    expect(slotShare(slot('x', 'snack', '16:00'))).toBe(DEFAULT_SHARE.snack);
    expect(slotShare(slot('x', 'snack', '16:00', -4))).toBe(0);
    const zero = pattern({ ...routine, slots: [slot('a', 'lunch', '13:00', 0), slot('b', 'dinner', '20:00', 0)] });
    expect(zero.map((s) => s.share)).toEqual([0.5, 0.5]);
  });

  it('allowances add up to the target, give or take rounding', () => {
    const p = pattern(routine);
    const sum = p.reduce((a, s) => a + allowance(1600, s), 0);
    expect(Math.abs(sum - 1600)).toBeLessThanOrEqual(2);
    expect(allowance(1600, p[1])).toBe(640);
  });
});

describe('slotOf', () => {
  const p = pattern(routine);
  it('trusts a slot id that still exists', () => {
    expect(slotOf(meal('snack', '09:00', 100, 'dinner'), p)?.id).toBe('dinner');
  });

  it('otherwise takes the slot of the same type nearest in time', () => {
    expect(slotOf(meal('lunch', '14:30', 500), p)?.id).toBe('lunch');
    expect(slotOf(meal('breakfast', '10:00', 200, 'gone'), p)?.id).toBe('morning');
  });

  it('falls back to the nearest slot of any type, and null with no slots', () => {
    expect(slotOf(meal('snack', '18:00', 120), p)?.id).toBe('dinner');
    expect(slotOf(meal('snack', '18:00', 120), [])).toBeNull();
  });
});

describe('slotStates', () => {
  it('sums what was eaten per slot, keeps what is left, and reads the status off the clock', () => {
    const meals = [meal('breakfast', '08:40', 300), meal('lunch', '13:10', 400), meal('snack', '13:30', 150, 'lunch')];
    const s = slotStates({ routine, target: 1600, meals, nowMinutes: 19 * 60 + 15, skipped: [], planned: { dinner: 500 } });
    expect(s.map((x) => x.slot.id)).toEqual(['morning', 'lunch', 'dinner']);
    expect(s[0]).toMatchObject({ allowance: 400, eaten: 300, left: 100, status: 'done' });
    expect(s[1]).toMatchObject({ allowance: 640, eaten: 550, left: 90, status: 'done' });
    expect(s[1].meals).toHaveLength(2);
    expect(s[2]).toMatchObject({ allowance: 560, planned: 500, eaten: 0, left: 560, status: 'now' });
  });

  it('shows skipped, missed and later', () => {
    const s = slotStates({ routine, target: 1600, meals: [], nowMinutes: 14 * 60, skipped: ['skip_morning'] });
    expect(s.map((x) => x.status)).toEqual(['skipped', 'missed', 'later']);
  });

  it('nextSlot is the one on now, else the missed one, else the next; slotForNow falls back to the nearest', () => {
    const midday = slotStates({ routine, target: 1600, meals: [], nowMinutes: 12 * 60 + 45, skipped: [] });
    expect(nextSlot(midday)?.slot.id).toBe('lunch');
    const morningOnly = slotStates({ routine, target: 1600, meals: [], nowMinutes: 10 * 60, skipped: [] });
    expect(nextSlot(morningOnly)?.slot.id).toBe('morning');
    const done = slotStates({
      routine,
      target: 1600,
      meals: [meal('breakfast', '08:40', 300), meal('lunch', '13:10', 400), meal('dinner', '19:40', 500)],
      nowMinutes: 21 * 60,
      skipped: [],
    });
    expect(nextSlot(done)).toBeNull();
    expect(slotForNow(done, 21 * 60)?.slot.id).toBe('dinner');
    expect(slotForNow([], 21 * 60)).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/pattern.test.ts`
Expected: FAIL, "Failed to resolve import "../pattern"".

- [ ] **Step 5: Create `src/core/pattern.ts`**

```ts
import { skipKey, slotMinutes, slotStatus, type Routine, type RoutineSlot, type SlotStatus } from './routine';
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

/** The slot to eat next: the one on now, else the one missed, else the next one. Null once the day is done. */
export function nextSlot(states: SlotState[]): SlotState | null {
  return states.find((s) => s.status === 'now') ?? states.find((s) => s.status === 'missed') ?? states.find((s) => s.status === 'later') ?? null;
}

/** The slot a meal logged right now belongs to: the next one to eat, else the nearest by time. */
export function slotForNow(states: SlotState[], nowMinutes: number): SlotState | null {
  if (states.length === 0) return null;
  const next = nextSlot(states);
  if (next) return next;
  return states.reduce((best, s) => (gap(s.slot.minutes, nowMinutes) < gap(best.slot.minutes, nowMinutes) ? s : best));
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/core/__tests__/pattern.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Run the whole suite, typecheck and lint**

Run: `npx vitest run && npx tsc --noEmit && npx expo lint`
Expected: all pass. `routine.test.ts` still passes: the dinner slot has an empty option, so `planKcal` on Monday only gains the bhaji.

- [ ] **Step 8: Commit**

```bash
git add src/core/routine.ts src/core/types.ts src/core/pattern.ts src/core/__tests__/pattern.test.ts
git commit -m "$(cat <<'EOF'
The eating pattern: slots with a share of the day, and meals that know their slot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The week plan follows the slots

**Files:**
- Modify: `src/core/weekPlan.ts` (`buildWeekPlan` near line 137, the `editMeal`/`bumpRole`/`addTo`/`addIfMissing`/`dropFrom` helpers and `balanceDay` near lines 180-283)
- Modify: `src/store/AppProvider.tsx` (`setRoutine` near line 250, the `WeekPlan` import near line 20)
- Modify: `src/app/plan.tsx`, `src/components/PlanTodayCard.tsx`
- Modify: `src/i18n/index.ts` (one key)
- Test: `src/core/__tests__/weekPlan.test.ts`

**Interfaces:**
- Consumes: `pattern(routine)` and `PatternSlot` from Task 1.
- Produces: `slotPlanLines(routine, slot, weekday, foods): PlanLine[]`; `buildWeekPlan(routine, foods): WeekPlan` with one meal per slot, `id` = slot id; `alignWeekPlan(plan, routine, foods?): WeekPlan`; `balanceDay` unchanged in signature, but `changes[].params.meal` is now a `MealType`.

- [ ] **Step 1: Add the failing tests**

In `src/core/__tests__/weekPlan.test.ts`, change the import lines to:

```ts
import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { DEFAULT_ROUTINE, type Routine } from '../routine';
import type { FoodItem } from '../types';
import { alignWeekPlan, balanceDay, buildWeekPlan, copyToWeekdays, dayStatus, dayTotals, lineInfo, roleOf, setLine, swapsFor, type WeekPlan } from '../weekPlan';
```

Append inside the outer `describe('weekPlan', ...)` block, after the last existing `it(...)`:

```ts
  it('makes one meal per slot of the pattern, in time order, under the slot ids', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    expect(plan.days[1].meals.map((m) => m.id)).toEqual(['fruit', 'dry-fruit', 'lunch', 'tea', 'bhel', 'dinner', 'milk']);
    expect(plan.days[1].meals.map((m) => m.time)).toEqual(['08:30', '11:00', '13:00', '15:45', '18:30', '20:00', '21:00']);
  });

  it('adds a staple only when the plate has none of its kind', () => {
    const bhakriLunch: Routine = {
      ...DEFAULT_ROUTINE,
      slots: DEFAULT_ROUTINE.slots.map((s) => (s.id === 'lunch' ? { ...s, options: [[{ foodId: 'jowar-bhakri', unit: 'piece', qty: 1 }]] } : s)),
    };
    const lunch = buildWeekPlan(bhakriLunch, foods).days[1].meals.find((m) => m.id === 'lunch')!;
    expect(lunch.lines.some((l) => l.foodId === 'chapati')).toBe(false);
    expect(lunch.lines.some((l) => l.foodId === 'jowar-bhakri')).toBe(true);
    expect(lunch.lines.filter((l) => roleOf(byId(l.foodId)) === 'dal')).toHaveLength(1);
  });

  it('names the meal it changed by its type', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const before = dayTotals(plan.days[1], foods).kcal;
    const { changes } = balanceDay(plan.days[1], foods, before + 400, new Set());
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) expect(['breakfast', 'lunch', 'snack', 'dinner']).toContain(c.params.meal);
  });

  describe('alignWeekPlan', () => {
    const legacy: WeekPlan = {
      days: Array.from({ length: 7 }, () => ({
        meals: [
          { id: 'breakfast', type: 'breakfast', time: '08:30', lines: [{ foodId: 'poha', unit: 'plate', qty: 1 }] },
          { id: 'mid', type: 'snack', time: '11:00', lines: [{ foodId: 'almonds', unit: 'handful', qty: 1 }] },
          { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 3 }] },
          { id: 'tea', type: 'snack', time: '15:45', lines: [{ foodId: 'black-tea', unit: 'cup', qty: 1 }] },
          { id: 'evening', type: 'snack', time: '18:30', lines: [{ foodId: 'murmura-bhel', unit: 'katori', qty: 1 }] },
          { id: 'dinner', type: 'dinner', time: '20:00', lines: [{ foodId: 'jowar-bhakri', unit: 'piece', qty: 1 }] },
          { id: 'night', type: 'snack', time: '21:30', lines: [{ foodId: 'taak', unit: 'glass', qty: 1 }] },
          { id: 'ghost', type: 'snack', time: '23:00', lines: [{ foodId: 'banana', unit: 'medium', qty: 1 }] },
        ],
      })),
    };

    it('lands the old seven names on the slots by type and time, keeps their lines, drops the rest', () => {
      const day = alignWeekPlan(legacy, DEFAULT_ROUTINE).days[2];
      expect(day.meals.map((m) => m.id)).toEqual(['fruit', 'dry-fruit', 'lunch', 'tea', 'bhel', 'dinner', 'milk']);
      expect(day.meals.find((m) => m.id === 'fruit')!.lines[0].foodId).toBe('poha');
      expect(day.meals.find((m) => m.id === 'lunch')!.lines[0].qty).toBe(3);
      expect(day.meals.find((m) => m.id === 'milk')!.lines[0].foodId).toBe('taak');
      expect(day.meals.some((m) => m.lines.some((l) => l.foodId === 'banana'))).toBe(false);
    });

    it('gives a new slot an empty meal without foods and a built one with them, and keeps edited lines', () => {
      const withLate: Routine = {
        ...DEFAULT_ROUTINE,
        slots: [...DEFAULT_ROUTINE.slots, { id: 'late', type: 'snack', time: '22:30', label_en: 'Late', label_mr: '', label_hi: '', options: [[{ foodId: 'apple', unit: 'medium', qty: 1 }]], withBhaji: false, share: 5 }],
      };
      const built = buildWeekPlan(DEFAULT_ROUTINE, foods);
      expect(alignWeekPlan(built, withLate).days[0].meals.find((m) => m.id === 'late')!.lines).toEqual([]);
      const withFoods = alignWeekPlan(built, withLate, foods);
      expect(withFoods.days[0].meals.find((m) => m.id === 'late')!.lines[0].foodId).toBe('apple');
      expect(withFoods.days[0].meals.find((m) => m.id === 'lunch')!.lines).toEqual(built.days[0].meals.find((m) => m.id === 'lunch')!.lines);
    });
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/weekPlan.test.ts`
Expected: FAIL; `alignWeekPlan` is not exported and the slot-id test gets the old names.

- [ ] **Step 3: Rewrite the plan builder in `src/core/weekPlan.ts`**

Add to the imports at the top:

```ts
import { pattern } from './pattern';
import { slotTime, type PlanLine, type Routine, type RoutineSlot } from './routine';
```

(Replace the existing `import type { PlanLine, Routine } from './routine';` line with the second line above.)

Replace everything from `/** The week from the routine: ...` through the end of `buildWeekPlan` with:

```ts
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
```

- [ ] **Step 4: Make `balanceDay` address meals by type**

Replace everything from `type Step = ...` through the end of `balanceDay` with:

```ts
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
```

Leave `setLine`, `addLine`, `setDay`, `copyToWeekdays` as they are.

- [ ] **Step 5: Run the weekPlan tests**

Run: `npx vitest run src/core/__tests__/weekPlan.test.ts`
Expected: PASS. If the older test "brings a day that is too low back up" checks `changes[0].key` it still reads `bal_add_bread`; nothing else in it depends on meal ids.

- [ ] **Step 6: Realign the plan in the store when slots change**

In `src/store/AppProvider.tsx`, change `import type { WeekPlan } from '../core/weekPlan';` to:

```ts
import { alignWeekPlan, type WeekPlan } from '../core/weekPlan';
```

Replace the `setRoutine` line with:

```ts
      setRoutine: (r) =>
        update((s) => {
          const routine = { ...s.routine, ...r };
          // The plan is written against the slots; when they change, it follows.
          const slotsChanged = r.slots !== undefined && r.slots !== s.routine.slots;
          const weekPlan = slotsChanged && s.weekPlan ? alignWeekPlan(s.weekPlan, routine, [...FOODS, ...s.customFoods]) : s.weekPlan;
          return { ...s, routine, weekPlan };
        }),
```

- [ ] **Step 7: Name plan meals after their slot on the plan screen and the plan card**

Add the i18n key to all three dicts (last line before each closing `};`):

```ts
  plan_follows_pattern: 'Meals follow your eating pattern · edit',
```
```ts
  plan_follows_pattern: 'जेवणं तुमच्या खाण्याच्या पद्धतीनुसार · बदला',
```
```ts
  plan_follows_pattern: 'खाने आपके खाने के पैटर्न के अनुसार · बदलें',
```

In `src/app/plan.tsx`:

1. Add `import { useRouter } from 'expo-router';` and change the routine import to `import { avoidedFoodIds, planItems, type PlanLine, slotLabel, weekdayOf } from '../core/routine';`.
2. Delete the `const MEAL_KEY ...` line.
3. Inside `PlanScreen`, after `const t = makeT(lang);` add:

```ts
  const router = useRouter();
  const mealName = (meal: PlanMeal) => {
    const s = state.routine.slots.find((x) => x.id === meal.id);
    return (s && slotLabel(s, lang)) || t(meal.type);
  };
```

4. In `balance()`, replace `{ meal: t(MEAL_KEY[String(c.params.meal)] ?? String(c.params.meal)).toLowerCase() }` with `{ meal: t(String(c.params.meal)).toLowerCase() }`.
5. In `logMeal`, add `slotId: meal.id` to the `app.addMeal({...})` object, after `type: meal.type,`.
6. Replace `{`${t(MEAL_KEY[meal.id] ?? meal.type)} · ${meal.time}`}` in the meal card heading with `{`${mealName(meal)} · ${meal.time}`}`.
7. Right after the closing `</Row>` of the day picker (the `ORDER.map` row), add:

```tsx
      <Pressable onPress={() => router.push('/food?s=routine')} accessibilityRole="button" style={{ paddingVertical: 2 }}>
        <Micro color={C.accent}>{`${t('plan_follows_pattern')} ›`}</Micro>
      </Pressable>
```

In `src/components/PlanTodayCard.tsx`:

1. Change the routine import to `import { planItems, slotLabel, weekdayOf } from '../core/routine';`.
2. Delete the `const MEAL_KEY ...` line.
3. After `const t = makeT(lang);` add the same `mealName` helper as above (it reads `state.routine.slots`).
4. In `log(meal)`, add `slotId: meal.id` after `type: meal.type,`.
5. Replace `{`${t(MEAL_KEY[meal.id] ?? meal.type)} · ${meal.time}`}` with `{`${mealName(meal)} · ${meal.time}`}`.

- [ ] **Step 8: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/weekPlan.ts src/core/__tests__/weekPlan.test.ts src/store/AppProvider.tsx src/app/plan.tsx src/components/PlanTodayCard.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The week plan is one meal per slot of the pattern, and follows the slots when they change

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migration to version 6

**Files:**
- Modify: `src/store/migrate.ts`, `src/store/defaults.ts` (`version: 5` in `EMPTY_STATE`)
- Test: `src/core/__tests__/migrate.test.ts`

**Interfaces:**
- Consumes: `DINNER_SLOT` (Task 1), `slotShare` (Task 1), `alignWeekPlan` (Task 2).
- Produces: stored states at version 6 with a share on every slot, a dinner-type slot, and plan meals named after slots.

- [ ] **Step 1: Write the failing test**

In `src/core/__tests__/migrate.test.ts`, add `import { DEFAULT_ROUTINE } from '../routine';` if it is not already imported, then add inside `describe('migrateState', ...)`:

```ts
  it('version 6: slots get shares, a dinner appears, and plan meals take the slot names', () => {
    const v5 = {
      version: 5,
      profile: { ...EMPTY_STATE.profile, onboarded: true },
      meals: [],
      routine: { ...DEFAULT_ROUTINE, slots: DEFAULT_ROUTINE.slots.filter((s) => s.type !== 'dinner').map((s) => ({ ...s, share: undefined })) },
      weekPlan: {
        days: Array.from({ length: 7 }, () => ({
          meals: [
            { id: 'evening', type: 'snack', time: '18:30', lines: [{ foodId: 'murmura-bhel', unit: 'katori', qty: 2 }] },
            { id: 'dinner', type: 'dinner', time: '20:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
          ],
        })),
      },
    };
    const out = migrateState(v5);
    expect(out.version).toBe(6);
    expect(out.routine.slots.every((s) => typeof s.share === 'number')).toBe(true);
    expect(out.routine.slots.find((s) => s.id === 'lunch')!.share).toBe(35);
    expect(out.routine.slots.some((s) => s.type === 'dinner')).toBe(true);
    const day = out.weekPlan!.days[3];
    expect(day.meals.find((m) => m.id === 'bhel')!.lines[0].qty).toBe(2);
    expect(day.meals.find((m) => m.id === 'dinner')!.lines[0].foodId).toBe('chapati');
    expect(day.meals.map((m) => m.id)).toContain('fruit');
    expect(migrateState(out)).toEqual(out);
  });
```

Also change `expect(once.version).toBe(5);` (in the idempotency test near line 61) to `expect(once.version).toBe(6);`.

- [ ] **Step 2: Run the migrate tests to see them fail**

Run: `npx vitest run src/core/__tests__/migrate.test.ts`
Expected: FAIL on `version` 5 vs 6.

- [ ] **Step 3: Bump the version and write the upgrade**

In `src/store/defaults.ts` change `version: 5,` to `version: 6,`.

In `src/store/migrate.ts`:

1. Change the routine import to `import { DEFAULT_ROUTINE, DINNER_SLOT } from '../core/routine';` and add:

```ts
import { slotShare } from '../core/pattern';
import { alignWeekPlan, type WeekPlan } from '../core/weekPlan';
```

2. In `upgradeRoutine`, before `return r;` add:

```ts
  // Version 6: every slot carries a share of the day's calories, and there is a dinner to plan.
  r.slots = r.slots.map((s) => (typeof s.share === 'number' ? s : { ...s, share: slotShare(s) }));
  if (!r.slots.some((s) => s.type === 'dinner')) {
    r.slots = [...r.slots, { ...DINNER_SLOT, id: r.slots.some((s) => s.id === 'dinner') ? 'dinner-2' : 'dinner' }];
  }
```

3. In `migrateState`, replace the return statement with:

```ts
  const routine = upgradeRoutine(raw.routine, fromVersion);
  // A plan that is not seven days of meals is not a plan; rebuild it from the routine on next open.
  const rawPlan = isRecord(raw.weekPlan) && Array.isArray((raw.weekPlan as { days?: unknown }).days) && (raw.weekPlan as { days: unknown[] }).days.length === 7 ? (raw.weekPlan as WeekPlan) : null;
  return {
    ...EMPTY_STATE,
    ...(raw as Partial<AppState>),
    version: 6,
    profile,
    settings,
    breakSettings,
    breaks: upgradeLogs(raw.breaks, breakSettings.micro.seconds),
    // Older stores have no routine; one saved before a field existed gets the default for it.
    routine,
    spend: Array.isArray(raw.spend) ? (raw.spend as AppState['spend']) : [],
    schedule: { ...EMPTY_STATE.schedule, ...(isRecord(raw.schedule) ? raw.schedule : {}) },
    // Version 6: plan meals are named after the pattern's slots; older names land on the slot of their type nearest their time.
    weekPlan: rawPlan ? alignWeekPlan(rawPlan, routine) : null,
  };
```

- [ ] **Step 4: Run the tests, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npx expo lint`
Expected: all pass. `pattern.test.ts` imports nothing from the store, so no cycle.

- [ ] **Step 5: Commit**

```bash
git add src/store/migrate.ts src/store/defaults.ts src/core/__tests__/migrate.test.ts
git commit -m "$(cat <<'EOF'
Version 6: shares on every slot, a dinner to plan, and plan meals named after their slots

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: What fits, from the slots

**Files:**
- Modify: `src/core/dayPlan.ts`
- Modify: `src/components/FitsCard.tsx`
- Test: `src/core/__tests__/dayPlan.test.ts`

**Interfaces:**
- Consumes: `PatternSlot`, `pattern`, `slotStates` (Task 1); `SLOT_EARLY_MIN` from `routine.ts`.
- Produces: `DayPlanInput.slots?`, `.loggedSlotIds?`, `.nowMinutes?`; `SlotPlan.id?`; `DayPlan.nowId?`.

- [ ] **Step 1: Write the failing test**

In `src/core/__tests__/dayPlan.test.ts` add to the imports:

```ts
import { pattern } from '../pattern';
import { DEFAULT_ROUTINE, type RoutineSlot } from '../routine';
```

and add inside `describe('dayPlan', ...)`:

```ts
  it('with the pattern on, the meals ahead are its slots, each with its share of what is left', () => {
    const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
    const slots = pattern({ ...DEFAULT_ROUTINE, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '19:30', 35)] });
    const base = { remaining: 1000, hour: 14, loggedTypes: [], foods, avoided: new Set<string>(), slots, loggedSlotIds: ['morning'] };
    const p = dayPlan({ ...base, nowMinutes: 14 * 60 });
    expect(p.slots.map((s) => s.id)).toEqual(['lunch', 'dinner']);
    expect(p.nowId).toBe('lunch');
    expect(p.now).toBe('lunch');
    expect(p.slots[0].budget).toBe(Math.round((1000 * 0.4) / 0.75));
    // Once dinner's window is near, a lunch never eaten drops off.
    const late = dayPlan({ ...base, nowMinutes: 19 * 60 + 10 });
    expect(late.slots.map((s) => s.id)).toEqual(['dinner']);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/core/__tests__/dayPlan.test.ts`
Expected: FAIL; `p.slots` still lists the four windows and `nowId` is undefined.

- [ ] **Step 3: Teach `dayPlan` the slots**

In `src/core/dayPlan.ts`:

1. Add imports:

```ts
import type { PatternSlot } from './pattern';
import { SLOT_EARLY_MIN } from './routine';
```

2. Change `SlotPlan` and `DayPlan`:

```ts
export type SlotPlan = { /** The pattern slot this plate is for, when the pattern is on. */ id?: string; type: MealType; budget: number; picks: Pick[]; kcal: number; protein: number };
export type DayPlan = {
  remaining: number;
  /** True when what is left is too little to eat anything but water or fruit. */
  stop: boolean;
  slots: SlotPlan[];
  /** The meal that is on now, or next. */
  now: MealType;
  /** The slot that is on now or next, when the pattern is on. */
  nowId?: string;
};
```

3. Add to `DayPlanInput`:

```ts
  /** The eating pattern, when it is on: the meals ahead are its slots, not the fixed windows. */
  slots?: PatternSlot[];
  /** Slots already eaten or skipped today. */
  loggedSlotIds?: string[];
  /** Minutes after midnight; defaults to the hour. */
  nowMinutes?: number;
```

4. Replace the `dayPlan` function with:

```ts
type Ahead = { id?: string; type: MealType; share: number };

/** The meals still to come. A slot stays ahead until the next slot's window opens, so a late lunch is still lunch. */
function mealsAhead(input: DayPlanInput): { ahead: Ahead[]; now: MealType; nowId?: string } {
  if (input.slots && input.slots.length > 0) {
    const now = input.nowMinutes ?? input.hour * 60;
    const logged = new Set(input.loggedSlotIds ?? []);
    const ahead = input.slots
      .filter((s, i) => {
        const end = i + 1 < input.slots!.length ? input.slots![i + 1].minutes - SLOT_EARLY_MIN : 1440;
        return !logged.has(s.id) && now < end;
      })
      .map((s) => ({ id: s.id, type: s.type, share: s.share }));
    return { ahead, now: ahead[0]?.type ?? 'snack', nowId: ahead[0]?.id };
  }
  const windowsLeft = MEAL_WINDOWS.filter((w) => w.endHour > input.hour && !input.loggedTypes.includes(w.type));
  const nowWindow = MEAL_WINDOWS.find((w) => input.hour >= w.startHour && input.hour < w.endHour);
  return { ahead: windowsLeft.map((w) => ({ type: w.type, share: w.share })), now: nowWindow?.type ?? windowsLeft[0]?.type ?? 'snack' };
}

export function dayPlan(input: DayPlanInput): DayPlan {
  const remaining = Math.max(0, Math.round(input.remaining));
  const { ahead, now, nowId } = mealsAhead(input);
  const stop = remaining < STOP_BELOW;
  if (stop || ahead.length === 0) return { remaining, stop, slots: [], now, nowId };
  const shareSum = ahead.reduce((a, w) => a + w.share, 0);
  const slots: SlotPlan[] = ahead.map((w, i) => {
    const budget = Math.round((remaining * w.share) / shareSum);
    const picks = plate(w.type, budget, input, i);
    return { id: w.id, type: w.type, budget, picks, kcal: picks.reduce((a, p) => a + p.kcal, 0), protein: Math.round(picks.reduce((a, p) => a + p.protein, 0)) };
  });
  return { remaining, stop, slots, now, nowId };
}

/** The whole day on the target, every meal, as a sheet to plan from in the morning. */
export function fullDayPlan(input: Omit<DayPlanInput, 'hour' | 'loggedTypes' | 'loggedSlotIds' | 'nowMinutes'>): DayPlan {
  return dayPlan({ ...input, hour: 0, loggedTypes: [], loggedSlotIds: [], nowMinutes: 0 });
}
```

- [ ] **Step 4: Run the dayPlan tests**

Run: `npx vitest run src/core/__tests__/dayPlan.test.ts`
Expected: PASS, including the older window tests.

- [ ] **Step 5: Pass the slots from the fits card**

In `src/components/FitsCard.tsx`:

1. Add imports:

```ts
import { pattern, slotStates } from '../core/pattern';
import { slotLabel } from '../core/routine';
import { useMinute } from '../services/useWorkSchedule';
```

(Keep the existing `avoidedFoodIds, bhajiFor` import from `../core/routine` and merge `slotLabel` into it.)

2. After `const [swapsFor, setSwapsFor] = useState<string | null>(null);` add:

```ts
  const minute = useMinute();
  const patternOn = state.routine.enabled;
  const slots = useMemo(() => (patternOn ? pattern(state.routine) : undefined), [patternOn, state.routine]);
  const loggedSlotIds = useMemo(() => {
    if (!patternOn) return [];
    const todayMeals = state.meals.filter((m) => m.date === today);
    return slotStates({ routine: state.routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: minute, skipped: app.actionsDoneToday })
      .filter((s) => s.status === 'done' || s.status === 'skipped')
      .map((s) => s.slot.id);
  }, [patternOn, state.routine, state.meals, today, app.targets.kcal, minute, app.actionsDoneToday]);
```

3. Replace the `plan` memo with:

```ts
  const plan = useMemo(() => {
    const base = { foods, avoided: avoidedFoodIds({ ...state.routine, enabled: true }), preferred: state.routine.enabled ? bhajiFor(state.routine, today) : [], seed, slots };
    return mode === 'day' ? fullDayPlan({ ...base, remaining: app.targets.kcal }) : dayPlan({ ...base, remaining: budget.remaining, hour, loggedTypes, loggedSlotIds, nowMinutes: minute });
  }, [mode, app.targets.kcal, budget.remaining, hour, loggedTypes, loggedSlotIds, minute, foods, state.routine, today, seed, slots]);
```

4. Change `log` to take the slot id:

```ts
  function log(type: MealType, foodId: string, grams: number, slotId?: string) {
    const food = foods.find((f) => f.id === foodId);
    if (!food) return;
    const item = toMealItem(food, grams);
    app.addMeal({ id: newId(), at: new Date().toISOString(), date: today, type, items: [item], kcal: item.kcal, protein: Math.round(item.protein), slotId });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: item.kcal }));
  }
```

and change the two `log(s.type, p.food.id, p.grams)` / `log(s.type, a.food.id, a.grams)` calls to pass `s.id` as the fourth argument.

5. In the slot list, add after the `.map((s, i) => (` opening a label and an is-now helper, by replacing the first `<Micro color={mode === 'rest' && s.type === plan.now ? ...}>` line and its content with:

```tsx
              <Micro color={mode === 'rest' && isNow(s) ? C.accent : C.textFaint}>{`${labelOf(s)}${mode === 'rest' && isNow(s) ? ` · ${t('fits_now')}` : ''}`}</Micro>
```

and add, just above the line `if (isOffDay(state.settings.offDays, today)) return null;`:

```ts
  const isNow = (s: { id?: string; type: MealType }) => (plan.nowId ? s.id === plan.nowId : s.type === plan.now);
  const labelOf = (s: { id?: string; type: MealType }) => {
    const slot = s.id ? state.routine.slots.find((x) => x.id === s.id) : undefined;
    return (slot && slotLabel(slot, lang)) || t(s.type);
  };
```

6. Change `key={s.type}` on the slot `View` to `key={s.id ?? s.type}`, the `.filter((s) => !compact || allMeals || mode === 'day' || s.type === plan.now || plan.slots[0] === s)` to use `isNow(s)` instead of `s.type === plan.now`, and `swapsFor !== s.type` / `setSwapsFor(s.type)` / `swapsFor === s.type` to use `(s.id ?? s.type)`.

- [ ] **Step 6: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/dayPlan.ts src/core/__tests__/dayPlan.test.ts src/components/FitsCard.tsx
git commit -m "$(cat <<'EOF'
What fits today is split across the pattern's slots, and a tap logs against the slot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Shares on the routine screen

**Files:**
- Modify: `src/components/SlotEditor.tsx`, `src/app/routine.tsx`, `src/i18n/index.ts`

**Interfaces:**
- Consumes: `pattern`, `allowance`, `slotShare` (Task 1), `updateSlot` from `routine.ts`.

- [ ] **Step 1: Add the i18n keys** (all three dicts, last lines before each closing `};`)

en:
```ts
  pattern_title: 'My eating pattern',
  pattern_follow: 'Follow my eating pattern',
  pattern_follow_desc: 'Budget, plan and reminders follow these meals',
  pattern_share: 'Share of the day',
  pattern_share_kcal: '= {kcal} kcal today',
  pattern_share_hint: 'Weights, not percentages: the meals always add up to your target.',
```
mr:
```ts
  pattern_title: 'माझी खाण्याची पद्धत',
  pattern_follow: 'माझ्या खाण्याच्या पद्धतीनुसार चला',
  pattern_follow_desc: 'बजेट, नियोजन आणि आठवणी याच जेवणांनुसार',
  pattern_share: 'दिवसाचा वाटा',
  pattern_share_kcal: '= आज {kcal} kcal',
  pattern_share_hint: 'हे वजन आहेत, टक्के नाहीत: सगळी जेवणं मिळून नेहमी तुमचं लक्ष्य होतं.',
```
hi:
```ts
  pattern_title: 'मेरा खाने का पैटर्न',
  pattern_follow: 'मेरे खाने के पैटर्न के हिसाब से चलो',
  pattern_follow_desc: 'बजट, प्लान और रिमाइंडर इन्हीं खानों के हिसाब से',
  pattern_share: 'दिन का हिस्सा',
  pattern_share_kcal: '= आज {kcal} kcal',
  pattern_share_hint: 'ये वज़न हैं, प्रतिशत नहीं: सारे खाने मिलकर हमेशा आपका लक्ष्य बनते हैं.',
```

- [ ] **Step 2: The share stepper in `src/components/SlotEditor.tsx`**

Add imports:

```ts
import { allowance, pattern, slotShare } from '../core/pattern';
import { addLine, removeLine, renameSlot, setLineQty, slotLabel, slotTime, updateSlot, type RoutineSlot } from '../core/routine';
```

(Merge `updateSlot` into the existing routine import.)

After `const [time, setTime] = useState(slotTime(slot));` add:

```ts
  // What this share means in calories today, with this edit already in the pattern.
  const share = slotShare(slot);
  const kcalToday = (() => {
    const p = pattern({ ...app.state.routine, slots: updateSlot(app.state.routine.slots, slot.id, slot) }).find((x) => x.id === slot.id);
    return p ? allowance(app.targets.kcal, p) : 0;
  })();
  const setShare = (next: number) => onChange({ ...slot, share: Math.max(0, Math.min(60, next)) });
```

After the closing `</Row>` of the name/time row, add:

```tsx
      <View style={{ gap: 6 }}>
        <Micro>{t('pattern_share')}</Micro>
        <Row style={{ gap: 10 }}>
          <Pressable onPress={() => setShare(share - 5)} hitSlop={6} accessibilityLabel="−" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="remove" size={16} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700', minWidth: 32, textAlign: 'center' }}>{String(share)}</Text>
          <Pressable onPress={() => setShare(share + 5)} hitSlop={6} accessibilityLabel="+" style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={16} color={C.text} />
          </Pressable>
          <Small color={C.textDim}>{fill(t('pattern_share_kcal'), { kcal: kcalToday })}</Small>
        </Row>
        <Micro color={C.textFaint}>{t('pattern_share_hint')}</Micro>
      </View>
```

- [ ] **Step 3: The routine screen shows allowances and the new copy**

In `src/app/routine.tsx`:

1. Add `import { allowance, pattern } from '../core/pattern';`.
2. After `const t = makeT(lang);` add `const slotKcal = new Map(pattern(routine).map((p) => [p.id, allowance(app.targets.kcal, p)]));`.
3. Change the first `Toggle` to `<Toggle title={t('pattern_follow')} desc={t('pattern_follow_desc')} on={routine.enabled} onToggle={() => app.setRoutine({ enabled: !routine.enabled })} />`.
4. Change the `SectionHeader` for slots to `<SectionHeader title={t('pattern_title')} meta={`${routine.slots.length}`} />`.
5. In the slot `ListRow`, change `sub={`${t(s.type)} · ...`}` to start with the allowance: `sub={`${slotKcal.get(s.id) ?? 0} kcal · ${t(s.type)} · ${s.options.map(...)...}`}` (keep the rest of the template exactly as it is).

- [ ] **Step 4: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SlotEditor.tsx src/app/routine.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Each meal of the pattern gets a share of the day, shown as today's calories

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The live slot budget on the log screen

**Files:**
- Modify: `src/app/(tabs)/log.tsx`, `src/i18n/index.ts`

**Interfaces:**
- Consumes: `slotStates`, `slotForNow`, `SlotState` (Task 1); `slotLabel`, `slotTime` from `routine.ts`; `useMinute` from `services/useWorkSchedule.ts`.
- Produces: meals saved from the log screen carry `slotId` when the pattern is on; `/log?slot=<id>` preselects a slot.

- [ ] **Step 1: Add the i18n keys** (all three dicts)

en:
```ts
  log_slot_left: '{kcal} left',
  log_left_for: '{kcal} left for {slot}',
  log_over_for: '{kcal} over for {slot}',
  log_left_today: '{kcal} left today',
  log_over_today: '{kcal} over today',
```
mr:
```ts
  log_slot_left: '{kcal} बाकी',
  log_left_for: '{slot}साठी {kcal} बाकी',
  log_over_for: '{slot}साठी {kcal} जास्त',
  log_left_today: 'आज {kcal} बाकी',
  log_over_today: 'आज {kcal} जास्त',
```
hi:
```ts
  log_slot_left: '{kcal} बाकी',
  log_left_for: '{slot} के लिए {kcal} बाकी',
  log_over_for: '{slot} के लिए {kcal} ज़्यादा',
  log_left_today: 'आज {kcal} बाकी',
  log_over_today: 'आज {kcal} ज़्यादा',
```

- [ ] **Step 2: Wire the slots into `src/app/(tabs)/log.tsx`**

1. Add imports:

```ts
import { slotForNow, slotStates } from '../../core/pattern';
import { avoidHits, slotLabel, slotTime } from '../../core/routine';
import { fill, makeT } from '../../i18n';
import { useMinute } from '../../services/useWorkSchedule';
```

(Replace the existing `import { avoidHits } from '../../core/routine';` and `import { makeT } from '../../i18n';` lines.)

2. Replace the `useLocalSearchParams` line and the lines around it so the slot parameter is read too:

```ts
  const { date: dateParam, slot: slotParam } = useLocalSearchParams<{ date?: string; slot?: string }>();
  const wanted = typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : app.today;
  const wantedSlot = typeof slotParam === 'string' ? slotParam : null;
  const [slotId, setSlotId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      // The day and slot shown follow the way in, so a stale pick from last time never sticks.
      setViewDate(wanted);
      setSlotId(wantedSlot);
    }, [wanted, wantedSlot]),
  );
```

3. After `const dayKcal = ...;` add:

```ts
  // With the pattern on, a meal is logged against one of its slots, and the slot's budget shrinks as the basket fills.
  const patternOn = app.state.routine.enabled;
  const minute = useMinute();
  const states = useMemo(
    () => (patternOn ? slotStates({ routine: app.state.routine, target: app.targets.kcal, meals: dayMeals, nowMinutes: isToday ? minute : 1440, skipped: isToday ? app.actionsDoneToday : [] }) : []),
    [patternOn, app.state.routine, app.targets.kcal, dayMeals, isToday, minute, app.actionsDoneToday],
  );
  const chosen = patternOn ? (states.find((s) => s.slot.id === slotId) ?? slotForNow(states, minute)) : null;
  const effectiveType: MealType = chosen ? chosen.slot.type : mealType;
```

Note: `dayMeals` is computed with `.filter` on every render; wrap it in `useMemo` so the `states` memo is stable:

```ts
  const dayMeals = useMemo(() => app.state.meals.filter((m) => m.date === viewDate), [app.state.meals, viewDate]);
```

4. Replace `atFor` with:

```ts
  /** When a meal "happened": now for today; the slot's time, or the usual hour of that meal, for an earlier day. */
  function atFor(type: MealType): string {
    if (isToday) return new Date().toISOString();
    if (chosen) return new Date(`${viewDate}T${slotTime(chosen.slot.slot)}:00`).toISOString();
    const h = (MEAL_WINDOWS.find((w) => w.type === type)?.startHour ?? 12) + 1;
    return new Date(`${viewDate}T${String(h).padStart(2, '0')}:00:00`).toISOString();
  }
```

5. In `saveMeal`, change the `addMeal` call to:

```ts
    app.addMeal({ id: newId(), at: atFor(effectiveType), date: viewDate, type: effectiveType, items: basketItems, kcal: basketKcal, protein: basketProtein, slotId: chosen?.slot.id });
```

and change `const yesterdaySame = ... m.type === mealType)` to use `effectiveType`.

6. In `searchBlock`, replace `<SectionHeader title={t('add_food')} meta={t(mealType)} />` and the `<Segmented .../>` line with:

```tsx
      <SectionHeader title={t('add_food')} meta={chosen ? slotLabel(chosen.slot.slot, lang) : t(mealType)} />
      {patternOn && states.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {states.map((s) => (
            <Pill
              key={s.slot.id}
              label={`${slotLabel(s.slot.slot, lang)} ${slotTime(s.slot.slot)} · ${s.status === 'done' ? t('routine_logged') : fill(t('log_slot_left'), { kcal: Math.max(0, s.left) })}`}
              active={chosen?.slot.id === s.slot.id}
              onPress={() => {
                setSlotId(s.slot.id);
                setMealType(s.slot.type);
              }}
            />
          ))}
        </ScrollView>
      ) : (
        <Segmented value={mealType} onChange={setMealType} options={MEAL_TYPES.map((m) => ({ key: m, label: en(m) }))} />
      )}
```

7. Just above `const basketCard =` add the live line:

```tsx
  const slotLeft = chosen ? chosen.left - basketKcal : 0;
  const dayLeft = (isToday ? app.budget.remaining : app.targets.kcal - dayKcal) - basketKcal;
  const budgetLine =
    chosen ? (
      <Text style={{ color: dayLeft < 0 ? C.red : slotLeft < 0 ? C.amber : C.textDim, fontSize: F.small, lineHeight: 18 }}>
        {[
          `${slotLabel(chosen.slot.slot, lang)}: ${basketKcal} / ${chosen.allowance}`,
          slotLeft >= 0 ? fill(t('log_left_for'), { kcal: slotLeft, slot: slotLabel(chosen.slot.slot, lang) }) : fill(t('log_over_for'), { kcal: -slotLeft, slot: slotLabel(chosen.slot.slot, lang) }),
          dayLeft >= 0 ? fill(t('log_left_today'), { kcal: dayLeft }) : fill(t('log_over_today'), { kcal: -dayLeft }),
        ].join(' · ')}
      </Text>
    ) : null;
```

8. In `basketCard`, inside the `wide ? (...)` branch, add `{budgetLine}` right after `<Divider />`. In the phone bottom bar, replace `<Micro>{`${basket.length} ${t('items').toLowerCase()} · ${basketProtein} g ${t('protein')}`}</Micro>` with:

```tsx
            {budgetLine ?? <Micro>{`${basket.length} ${t('items').toLowerCase()} · ${basketProtein} g ${t('protein')}`}</Micro>}
```

- [ ] **Step 3: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all pass. If lint flags `react-hooks/exhaustive-deps` on the `states` memo, add the named dependency it asks for rather than disabling the rule.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/log.tsx" src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Logging picks a slot of the pattern and shows what is left for it as the basket fills

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The pattern card on Today

**Files:**
- Modify: `src/components/RoutineCard.tsx` (rewrite the `RoutineCard` component and `SlotSheet`; keep `lineLabel` and `swapText` exported unchanged; keep `SpendSheet` unchanged)
- Modify: `src/app/(tabs)/index.tsx` (two lines)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `slotStates`, `SlotState` (Task 1); `mealTotals`, `dayTotals`, `dayStatus` from `weekPlan.ts`; `KCAL_FLOOR` from `nutrition.ts`.

- [ ] **Step 1: Add the i18n keys** (all three dicts)

en:
```ts
  pattern_log_planned: 'Log as planned',
  pattern_log_other: 'Different',
  pattern_planned: '{kcal} planned',
  pattern_vs_plan: 'vs plan',
```
mr:
```ts
  pattern_log_planned: 'नियोजनाप्रमाणे नोंदवा',
  pattern_log_other: 'वेगळं',
  pattern_planned: '{kcal} नियोजित',
  pattern_vs_plan: 'नियोजनापेक्षा',
```
hi:
```ts
  pattern_log_planned: 'प्लान के हिसाब से दर्ज करें',
  pattern_log_other: 'अलग',
  pattern_planned: '{kcal} प्लान में',
  pattern_vs_plan: 'प्लान से',
```

- [ ] **Step 2: Rewrite `RoutineCard` and `SlotSheet` in `src/components/RoutineCard.tsx`**

Replace the import block with:

```ts
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { foodName, searchFoods } from '../core/foods';
import { newId } from '../core/id';
import { KCAL_FLOOR } from '../core/nutrition';
import { slotStates, type SlotState } from '../core/pattern';
import {
  avoidHits,
  bhajiFor,
  DEFAULT_SPREAD,
  planItems,
  skipKey,
  slotLabel,
  slotLines,
  slotTime,
  SPEND_CATEGORIES,
  spendStatus,
  weekdayOf,
  type AvoidHit,
  type PlanLine,
  type RoutineSlot,
  type SpendCategory,
} from '../core/routine';
import type { FoodItem, Lang } from '../core/types';
import { dayStatus, dayTotals, mealTotals } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Bar, BiText, Btn, Card, Divider, Field, Micro, Pill, Row, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { Checklist } from '../ui/tiles';
import { C, F } from '../ui/theme';
```

Keep `SPREADS`, `lineLabel`, `foodLabel`, `swapText` exactly as they are. Replace the whole `RoutineCard` function with:

```tsx
/**
 * Today's eating pattern: one row per slot with what is planned, what was
 * eaten against what it may have, and the difference. A slot not yet eaten
 * logs as planned in one tap or opens the log screen for something else.
 * The bhaji, the walk, the avoid list and the money stay where they were.
 */
export function RoutineCard() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, foods, today, targets } = app;
  const routine = state.routine;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [openSlot, setOpenSlot] = useState<SlotState | null>(null);
  const [spendOpen, setSpendOpen] = useState(false);
  const minute = useMinute();

  const bhaji = bhajiFor(routine, today);
  const todayMeals = useMemo(() => state.meals.filter((m) => m.date === today), [state.meals, today]);
  const planDay = state.weekPlan?.days[weekdayOf(today)];
  const planned = useMemo(() => (planDay ? Object.fromEntries(planDay.meals.map((m) => [m.id, mealTotals(m, foods).kcal])) : undefined), [planDay, foods]);
  const states = useMemo(
    () => slotStates({ routine, target: targets.kcal, meals: todayMeals, nowMinutes: minute, skipped: app.actionsDoneToday, planned }),
    [routine, targets.kcal, todayMeals, minute, app.actionsDoneToday, planned],
  );

  if (!routine.enabled) return null;

  const hits = avoidHits(todayMeals.flatMap((m) => m.items), routine.avoid);
  const status = spendStatus(app.spentToday, routine.budgetMin, routine.budgetMax);
  const spendColor = status === 'over' ? C.red : status === 'in' ? C.green : C.cyan;
  const spendNote =
    status === 'over'
      ? fill(t('routine_budget_over'), { n: app.spentToday - routine.budgetMax })
      : status === 'in'
        ? t('routine_budget_in')
        : fill(t('routine_budget_under'), { n: routine.budgetMin - app.spentToday });
  const planTotal = planDay ? dayTotals(planDay, foods) : null;
  const planStatus = planTotal ? dayStatus(planTotal.kcal, targets.kcal, KCAL_FLOOR[state.profile.sex]) : null;

  /** The lines a slot is planned to hold today: the week plan's when it has them, else the slot's own default with the day's bhaji. */
  function plannedLines(s: SlotState): PlanLine[] {
    const fromPlan = planDay?.meals.find((m) => m.id === s.slot.id)?.lines ?? [];
    return fromPlan.length > 0 ? fromPlan : slotLines(routine, s.slot.slot, 0, bhaji[0] ?? null);
  }

  /** Take back the newest meal logged against a slot. */
  function unlog(s: SlotState) {
    const meal = s.meals[s.meals.length - 1];
    if (!meal) return;
    app.removeMeal(meal.id);
    fb.notify(t('meal_removed'), { label: t('undo'), onPress: () => app.addMeal(meal) });
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro color={C.textDim}>{`${t('pattern_title')} · ${t(`wd_${weekdayOf(today)}`)}`}</Micro>
        <Row style={{ gap: 14 }}>
          <Pressable onPress={() => router.push('/food?s=routine')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('edit')}>
            <Ionicons name="create-outline" size={18} color={C.textFaint} />
          </Pressable>
          <Pressable onPress={() => app.setRoutine({ enabled: false })} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('routine_hide')}>
            <Ionicons name="eye-off-outline" size={18} color={C.textFaint} />
          </Pressable>
        </Row>
      </Row>

      {planTotal ? (
        <Pressable onPress={() => router.push('/food?s=plan')} accessibilityRole="button" style={{ gap: 2 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro color={C.textDim}>{t('plan_today')}</Micro>
            <Text style={{ color: C.text, fontSize: F.body, fontWeight: '700' }}>
              {planTotal.kcal}
              <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '500' }}>{` / ${targets.kcal} kcal`}</Text>
            </Text>
          </Row>
          {planStatus === 'low' ? <Small color={C.red}>{fill(t('plan_status_low_short'), { gap: targets.kcal - planTotal.kcal })}</Small> : null}
        </Pressable>
      ) : null}

      <View style={{ gap: 4 }}>
        <Micro>{t('routine_bhaji')}</Micro>
        {bhaji.length > 0 ? (
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>
            {bhaji.map((id) => foodLabel(id, foods, lang)).join(lang === 'mr' ? ' किंवा ' : lang === 'hi' ? ' या ' : ' or ')}
          </Text>
        ) : (
          <Small>{t('routine_free_day')}</Small>
        )}
      </View>

      {routine.walk ? (
        <Checklist
          color={C.green}
          items={[{ key: 'routine_walk', label: t('routine_walk'), done: app.actionsDoneToday.includes('routine_walk') }]}
          onToggle={app.toggleAction}
        />
      ) : null}

      <View>
        {states.map((s, i) => {
          const slot = s.slot.slot;
          const lines = plannedLines(s);
          const plannedKcal = s.planned > 0 ? s.planned : planItems(lines, foods).reduce((a, x) => a + x.kcal, 0);
          const done = s.status === 'done';
          const skipped = s.status === 'skipped';
          const quiet = done || skipped;
          const diff = done && plannedKcal > 0 ? s.eaten - plannedKcal : null;
          const tone = done ? C.accent : s.status === 'now' ? C.amber : s.status === 'missed' ? C.red : C.borderStrong;
          return (
            <View key={slot.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 }}>
                <Ionicons name={done ? 'checkmark-circle' : skipped ? 'remove-circle-outline' : s.status === 'now' ? 'time' : 'ellipse-outline'} size={20} color={tone} />
                <Pressable onPress={() => (quiet ? undefined : setOpenSlot(s))} disabled={quiet} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed && !quiet ? 0.7 : 1 })}>
                  <Row style={{ gap: 8 }}>
                    <Text style={{ color: quiet ? C.textFaint : C.text, fontSize: F.body, fontWeight: '500', textDecorationLine: skipped ? 'line-through' : 'none' }}>{slotLabel(slot, lang)}</Text>
                    <Micro color={s.status === 'now' ? C.amber : s.status === 'missed' ? C.red : C.textGhost}>{s.status === 'missed' ? t('slot_missed') : s.status === 'now' ? t('slot_now') : slotTime(slot)}</Micro>
                  </Row>
                  <Text style={{ color: C.textFaint, fontSize: F.tiny }} numberOfLines={1}>
                    {done ? s.meals.flatMap((m) => m.items.map((it) => (lang === 'en' ? it.name_en : it.name_mr || it.name_en))).join(', ') : lines.map((l) => lineLabel(l, foods, lang)).join(' + ')}
                  </Text>
                </Pressable>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  {done ? (
                    <>
                      <Text style={{ color: s.left < 0 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>
                        {s.eaten}
                        <Text style={{ color: C.textFaint, fontWeight: '500' }}>{` / ${s.allowance}`}</Text>
                      </Text>
                      {diff !== null ? <Micro color={diff > 0 ? C.amber : C.textFaint}>{`${diff > 0 ? '+' : ''}${diff} ${t('pattern_vs_plan')}`}</Micro> : null}
                    </>
                  ) : (
                    <Text style={{ color: C.textDim, fontSize: F.small }}>{fill(t('pattern_planned'), { kcal: plannedKcal })}</Text>
                  )}
                </View>
                {done ? (
                  <Pressable onPress={() => unlog(s)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('undo')}>
                    <Micro color={C.accent}>{`${t('routine_logged')} ×`}</Micro>
                  </Pressable>
                ) : skipped ? (
                  <Pressable onPress={() => app.toggleAction(skipKey(slot))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('undo')}>
                    <Micro color={C.textFaint}>{`${t('slot_skipped')} ×`}</Micro>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setOpenSlot(s)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('pattern_log_planned')}>
                    <Ionicons name="add-circle" size={28} color={C.accent} />
                  </Pressable>
                )}
              </View>
              {!quiet ? (
                <Row style={{ gap: 14, paddingLeft: 31, paddingBottom: 6 }}>
                  <Pressable onPress={() => router.push({ pathname: '/log', params: { slot: slot.id } })} accessibilityRole="button" hitSlop={6}>
                    <Micro color={C.accent}>{`${t('pattern_log_other')} ›`}</Micro>
                  </Pressable>
                  {s.status === 'missed' ? (
                    <Pressable onPress={() => app.toggleAction(skipKey(slot))} hitSlop={6} accessibilityRole="button">
                      <Micro color={C.textFaint}>{t('slot_skip')}</Micro>
                    </Pressable>
                  ) : null}
                </Row>
              ) : null}
            </View>
          );
        })}
      </View>

      {hits.length > 0 ? (
        <View style={{ gap: 6 }}>
          {hits.map((h) => (
            <Row key={h.rule.id} style={{ gap: 8, alignItems: 'flex-start' }}>
              <Ionicons name="swap-horizontal" size={14} color={C.amber} style={{ marginTop: 2 }} />
              <Text style={{ color: C.amber, fontSize: F.small, lineHeight: 18, flex: 1 }}>{swapText(h, foods, lang)}</Text>
            </Row>
          ))}
        </View>
      ) : null}

      <Divider />
      <Pressable onPress={() => setSpendOpen(true)} accessibilityRole="button" style={({ pressed }) => ({ gap: 7, opacity: pressed ? 0.7 : 1 })}>
        <Row style={{ justifyContent: 'space-between' }}>
          <BiText en={t('routine_budget')} alt={lang === 'en' ? undefined : t('routine_budget')} size={F.small} color={C.textDim} weight="400" />
          <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
            {`₹${app.spentToday}`}
            <Text style={{ color: C.textFaint, fontWeight: '500' }}>{` / ₹${routine.budgetMin}–${routine.budgetMax}`}</Text>
          </Text>
        </Row>
        <Bar value={app.spentToday} max={routine.budgetMax} color={spendColor} marker={routine.budgetMin / Math.max(1, routine.budgetMax)} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Small color={spendColor}>{spendNote}</Small>
          <Micro color={C.accent}>{`+ ${t('routine_add_spend')}`}</Micro>
        </Row>
      </Pressable>

      <SlotSheet state={openSlot} planLines={openSlot ? (planDay?.meals.find((m) => m.id === openSlot.slot.id)?.lines ?? []) : []} bhaji={bhaji} onClose={() => setOpenSlot(null)} />
      <SpendSheet open={spendOpen} onClose={() => setSpendOpen(false)} />
    </Card>
  );
}
```

Replace the `SlotSheet` function with:

```tsx
/**
 * Log a slot as planned. With a week plan the lines are the plan's for today
 * and there is nothing to pick; without one, pick the option and the bhaji.
 */
function SlotSheet({ state: s, planLines, bhaji, onClose }: { state: SlotState | null; planLines: PlanLine[]; bhaji: string[]; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const { foods, state } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [option, setOption] = useState(0);
  const [bhajiIdx, setBhajiIdx] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  // Ate a different bhaji than planned: pick any vegetable dish instead.
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherQuery, setOtherQuery] = useState('');
  const [otherId, setOtherId] = useState<string | null>(null);

  // A different slot starts from its defaults again.
  const slotId = s?.slot.id ?? null;
  if (slotId !== openId) {
    setOpenId(slotId);
    setOption(0);
    setBhajiIdx(0);
    setOtherOpen(false);
    setOtherQuery('');
    setOtherId(null);
  }

  if (!s) return null;
  const current: RoutineSlot = s.slot.slot;
  const fromPlan = planLines.length > 0;
  const chosenBhaji = otherId ?? bhaji[bhajiIdx] ?? null;
  const lines = fromPlan ? planLines : slotLines(state.routine, current, option, chosenBhaji);
  const otherResults = otherOpen && otherQuery.trim() ? searchFoods(foods, otherQuery, 6).filter((f) => f.category === 'veg' || f.category === 'dal') : [];
  const items = planItems(lines, foods);
  const kcal = items.reduce((a, i) => a + i.kcal, 0);
  const protein = Math.round(items.reduce((a, i) => a + i.protein, 0));

  function log() {
    if (items.length === 0) return;
    const now = new Date();
    app.addMeal({ id: newId(), at: now.toISOString(), date: app.today, type: current.type, items, kcal, protein, slotId: current.id });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal }));
    onClose();
  }

  return (
    <Sheet open title={slotLabel(current, lang)} onClose={onClose}>
      {!fromPlan && current.withBhaji ? (
        <View style={{ gap: 8 }}>
          <Micro>{t('routine_bhaji')}</Micro>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {bhaji.map((id, i) => (
              <Pill key={id} label={foodLabel(id, foods, lang)} active={otherId === null && bhajiIdx === i} onPress={() => { setBhajiIdx(i); setOtherId(null); setOtherOpen(false); }} />
            ))}
            {otherId ? <Pill label={foodLabel(otherId, foods, lang)} active onPress={() => setOtherOpen(true)} /> : null}
            <Pill label={`${t('other_bhaji')}…`} active={otherOpen && !otherId} onPress={() => setOtherOpen((o) => !o)} />
          </Row>
          {otherOpen ? (
            <View style={{ gap: 4 }}>
              <Field value={otherQuery} onChangeText={setOtherQuery} placeholder={t('search_food')} autoFocus />
              {otherResults.map((f) => (
                <Pressable key={f.id} onPress={() => { setOtherId(f.id); setOtherOpen(false); setOtherQuery(''); }} style={({ pressed }) => ({ paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                  <BiText en={f.name_en} alt={lang === 'en' ? undefined : f.name_mr} size={F.body} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {!fromPlan && current.options.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Micro>{t('routine_pick')}</Micro>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {current.options.map((o, i) => (
              <Pill key={i} label={o.map((l) => lineLabel(l, foods, lang)).join(' + ')} active={option === i} onPress={() => setOption(i)} />
            ))}
          </Row>
        </View>
      ) : null}
      <View>
        {items.map((it, i) => (
          <View key={`${it.foodId}-${i}`}>
            {i > 0 ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between', paddingVertical: 9 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <BiText en={it.name_en} alt={lang === 'en' ? undefined : it.name_mr} size={F.body} />
                <Micro>{`${it.grams} g · ${Math.round(it.protein)} g ${t('protein').toLowerCase()}`}</Micro>
              </View>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
                {it.kcal}
                <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '500' }}> kcal</Text>
              </Text>
            </Row>
          </View>
        ))}
      </View>
      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '500' }}>{kcal}</Text>
          <Micro>{`kcal · ${protein} g ${t('protein').toLowerCase()} · ${t(current.type)}`}</Micro>
        </View>
        <Btn label={t('pattern_log_planned')} onPress={log} disabled={items.length === 0} style={{ minWidth: 120 }} />
      </Row>
    </Sheet>
  );
}
```

Remove the now-unused imports `slotLogged`, `slotMinutes`, `slotStatus` if any remain (the import block above already omits them).

- [ ] **Step 3: Hide the plan card when the pattern is on**

In `src/app/(tabs)/index.tsx`, change both occurrences of `{isToday ? <PlanTodayCard /> : null}` to `{isToday && !state.routine.enabled ? <PlanTodayCard /> : null}`.

- [ ] **Step 4: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all pass. `routine.tsx` and `log.tsx` still import `lineLabel`/`swapText` from this file.

- [ ] **Step 5: Commit**

```bash
git add src/components/RoutineCard.tsx "src/app/(tabs)/index.tsx" src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Today's pattern card: planned beside eaten for every slot, logged as planned or different

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Planned reminders and the log-nudge fix

**Files:**
- Create: `src/core/reminders.ts`
- Modify: `src/core/nudge.ts` (the `log` candidate near line 56), `src/i18n/index.ts`
- Test: `src/core/__tests__/reminders.test.ts`, `src/core/__tests__/nudge.test.ts`

**Interfaces:**
- Consumes: `pattern` (Task 1), `slotLabel`, `SLOT_GRACE_MIN` from `routine.ts`, `inQuietHours` from `nudge.ts`, `isOffDay` from `week.ts`, `addDays` from `date.ts`.
- Produces: `Reminder`, `plannedReminders(input)`, `lastLogDate(meals, today)`, `daysAway(meals, today)`, `daysBetween(a, b)`.

- [ ] **Step 1: Add the i18n keys** (all three dicts)

en:
```ts
  away_2_title: 'Nothing logged yesterday',
  away_2_body: 'One meal is enough. Everything is still here.',
  away_3_title: 'Two days quiet',
  away_3_body: 'Your plan is still here. Log whatever you eat next.',
  away_4_title: 'Three days',
  away_4_body: 'Come back when you can. The streak restarts the moment you log.',
```
mr:
```ts
  away_2_title: 'काल काहीच नोंदवलं नाही',
  away_2_body: 'एक जेवण पुरे. सगळं अजून इथेच आहे.',
  away_3_title: 'दोन दिवस शांतता',
  away_3_body: 'तुमचं नियोजन इथेच आहे. पुढचं जे खाल ते नोंदवा.',
  away_4_title: 'तीन दिवस',
  away_4_body: 'जमेल तेव्हा परत या. नोंदवताच मालिका पुन्हा सुरू होते.',
```
hi:
```ts
  away_2_title: 'कल कुछ दर्ज नहीं हुआ',
  away_2_body: 'एक खाना काफ़ी है. सब कुछ अभी भी यहीं है.',
  away_3_title: 'दो दिन चुप्पी',
  away_3_body: 'आपका प्लान यहीं है. अगला जो खाएँ, दर्ज करें.',
  away_4_title: 'तीन दिन',
  away_4_body: 'जब हो सके लौट आएँ. दर्ज करते ही सिलसिला फिर शुरू हो जाता है.',
```

- [ ] **Step 2: Write the failing reminder tests**

Create `src/core/__tests__/reminders.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { daysAway, daysBetween, lastLogDate, plannedReminders } from '../reminders';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { Meal } from '../types';

const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '19:30', 35)] };
const meal = (date: string): Meal => ({ id: date, at: `${date}T13:00:00.000Z`, date, type: 'lunch', items: [], kcal: 400, protein: 10 });
const t = (k: string) => k;
// 2026-10-12 is a Monday.
const base = { today: '2026-10-12', nowMinutes: 10 * 60, routine, doneSlotIds: [] as string[], lastLogDate: '2026-10-12', offDays: [] as number[], quietStartHour: 22, quietEndHour: 7, lang: 'en' as const, t };

describe('plannedReminders: slots', () => {
  it('prompts every slot at its time plus the grace, today and six days on, in order', () => {
    const r = plannedReminders(base).filter((x) => x.id.startsWith('slot:'));
    expect(r).toHaveLength(20);
    expect(r[0]).toMatchObject({ id: 'slot:lunch:2026-10-12', date: '2026-10-12', time: '13:45', title: 'lunch?', body: 'slot_prompt' });
    expect(r[1]).toMatchObject({ id: 'slot:dinner:2026-10-12', time: '20:15' });
    expect(r[2]).toMatchObject({ id: 'slot:morning:2026-10-13', time: '09:15' });
    expect(r[r.length - 1].date).toBe('2026-10-18');
  });

  it('leaves out today\'s slots already done and those whose moment has passed', () => {
    const r = plannedReminders({ ...base, nowMinutes: 14 * 60, doneSlotIds: ['dinner'] }).filter((x) => x.date === '2026-10-12');
    expect(r).toEqual([]);
  });

  it('skips off days and quiet hours, and says nothing when the pattern is off', () => {
    const r = plannedReminders({ ...base, offDays: [2], lastLogDate: null });
    expect(r.some((x) => x.date === '2026-10-13')).toBe(false);
    const late: Routine = { ...routine, slots: [slot('night', 'snack', '22:00', 10)] };
    expect(plannedReminders({ ...base, routine: late, lastLogDate: null })).toEqual([]);
    expect(plannedReminders({ ...base, routine: { ...routine, enabled: false }, lastLogDate: null })).toEqual([]);
  });
});

describe('plannedReminders: absence', () => {
  const away = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('away:'));
  it('with a log today, says something on the second, third and fourth quiet day, then stops', () => {
    const r = away(plannedReminders({ ...base, routine: { ...routine, enabled: false } }));
    expect(r.map((x) => [x.date, x.time, x.title])).toEqual([
      ['2026-10-14', '09:00', 'away_2_title'],
      ['2026-10-15', '09:00', 'away_3_title'],
      ['2026-10-16', '09:00', 'away_4_title'],
    ]);
    expect(r[0].body).toBe('away_2_body');
  });

  it('counts from the last log when today has none, and never nags someone who has never logged', () => {
    const r = away(plannedReminders({ ...base, routine: { ...routine, enabled: false }, lastLogDate: '2026-10-11' }));
    expect(r.map((x) => x.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    expect(away(plannedReminders({ ...base, lastLogDate: null }))).toEqual([]);
    expect(away(plannedReminders({ ...base, lastLogDate: '2026-10-01' }))).toEqual([]);
  });

  it('waits for quiet hours to end before the morning line', () => {
    const r = away(plannedReminders({ ...base, routine: { ...routine, enabled: false }, quietEndHour: 10 }));
    expect(r[0].time).toBe('10:00');
  });
});

describe('days away', () => {
  it('counts days between dates and since the last log', () => {
    expect(daysBetween('2026-10-01', '2026-10-04')).toBe(3);
    expect(lastLogDate([meal('2026-10-03'), meal('2026-10-01')], '2026-10-12')).toBe('2026-10-03');
    expect(lastLogDate([meal('2026-10-20')], '2026-10-12')).toBeNull();
    expect(daysAway([meal('2026-10-09')], '2026-10-12')).toBe(3);
    expect(daysAway([meal('2026-10-12')], '2026-10-12')).toBe(0);
    expect(daysAway([], '2026-10-12')).toBe(0);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/core/__tests__/reminders.test.ts`
Expected: FAIL, cannot resolve `../reminders`.

- [ ] **Step 4: Create `src/core/reminders.ts`**

```ts
import { addDays } from './date';
import { inQuietHours } from './nudge';
import { pattern } from './pattern';
import { SLOT_GRACE_MIN, slotLabel, type Routine } from './routine';
import type { ISODate, Lang, Meal } from './types';
import { isOffDay } from './week';

/**
 * Everything the app will say on its own over the next week, worked out in
 * advance so the phone can hand it to the OS and be closed. Two kinds: a
 * "log or skip?" prompt for each slot of the pattern, and a morning line
 * when days go by without a log. The absence lines escalate gently for
 * three days and then stop; an app that keeps nagging gets uninstalled.
 */
export type Reminder = { id: string; date: ISODate; time: string; title: string; body: string };

export type ReminderInput = {
  today: ISODate;
  nowMinutes: number;
  /** How many days ahead, today included. */
  days?: number;
  routine: Routine;
  /** Slots logged or skipped today. */
  doneSlotIds: string[];
  /** The last day with a meal logged, today included; null when nothing was ever logged. */
  lastLogDate: ISODate | null;
  offDays: number[];
  quietStartHour: number;
  quietEndHour: number;
  lang: Lang;
  t: (key: string) => string;
};

const AWAY_HOUR = 9;
const AWAY_FIRST = 2;
const AWAY_LAST = 4;

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function plannedReminders(input: ReminderInput): Reminder[] {
  const days = input.days ?? 7;
  const out: Reminder[] = [];
  const quiet = (minutes: number) => inQuietHours(Math.floor(minutes / 60), input.quietStartHour, input.quietEndHour);
  const slots = input.routine.enabled ? pattern(input.routine) : [];
  const awayAt = Math.max(AWAY_HOUR, input.quietEndHour) * 60;

  for (let k = 0; k < days; k++) {
    const date = addDays(input.today, k);
    if (isOffDay(input.offDays, date)) continue;

    for (const p of slots) {
      const at = p.minutes + SLOT_GRACE_MIN;
      if (at >= 1440 || quiet(at)) continue;
      if (k === 0 && (input.doneSlotIds.includes(p.id) || at <= input.nowMinutes)) continue;
      out.push({ id: `slot:${p.id}:${date}`, date, time: hhmm(at), title: `${slotLabel(p.slot, input.lang)}?`, body: input.t('slot_prompt') });
    }

    if (k > 0 && input.lastLogDate) {
      const gap = daysBetween(input.lastLogDate, date);
      if (gap >= AWAY_FIRST && gap <= AWAY_LAST && !quiet(awayAt)) {
        out.push({ id: `away:${date}`, date, time: hhmm(awayAt), title: input.t(`away_${gap}_title`), body: input.t(`away_${gap}_body`) });
      }
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

/** The most recent day on or before today with a meal logged; null when there is none. */
export function lastLogDate(meals: Pick<Meal, 'date'>[], today: ISODate): ISODate | null {
  let best: ISODate | null = null;
  for (const m of meals) if (m.date <= today && (best === null || m.date > best)) best = m.date;
  return best;
}

/** Days since the last log: 0 when today has one, and 0 when nothing was ever logged. */
export function daysAway(meals: Pick<Meal, 'date'>[], today: ISODate): number {
  const last = lastLogDate(meals, today);
  return last ? daysBetween(last, today) : 0;
}
```

- [ ] **Step 5: Run the reminder tests**

Run: `npx vitest run src/core/__tests__/reminders.test.ts`
Expected: PASS, 8 tests. The slot count: today has 2 (morning's 09:15 is already past 10:00), six more days have 3 each, so 20.

- [ ] **Step 6: Fix the log nudge in `src/core/nudge.ts`**

Replace the `log` candidate line with:

```ts
    // Nothing logged by late morning, or the last meal long ago: either way, ask for a log.
    { type: 'log', seconds: 60, want: ctx.lastMealHoursAgo === null ? ctx.hour >= 11 : ctx.lastMealHoursAgo > 5 },
```

Add to `src/core/__tests__/nudge.test.ts`, inside `describe('pickNudge', ...)`:

```ts
  it('asks for a log when nothing was logged by late morning, not before', () => {
    const quietDesk = { ...base, sittingMinutes: 10, lastMealHoursAgo: null };
    expect(pickNudge({ ...quietDesk, hour: 14 })?.type).toBe('log');
    expect(pickNudge({ ...quietDesk, hour: 9 })?.type).not.toBe('log');
  });
```

- [ ] **Step 7: Run everything**

Run: `npx vitest run && npx tsc --noEmit && npx expo lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/reminders.ts src/core/__tests__/reminders.test.ts src/core/nudge.ts src/core/__tests__/nudge.test.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
A week of reminders worked out in advance: slot prompts and three gentle absence lines

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: The phone keeps a week of reminders scheduled

**Files:**
- Modify: `src/services/notify.ts`, `src/services/useScheduledReminders.ts`, `src/services/useWorkSchedule.ts`

**Interfaces:**
- Consumes: `plannedReminders`, `lastLogDate` (Task 8); `slotStates` (Task 1).
- Produces: `scheduleAt(id, at, title, body)`, `scheduledIds()` in `notify.ts`.

- [ ] **Step 1: Add the two primitives to `src/services/notify.ts`**

After `scheduleRepeating` add:

```ts
/** A one-off reminder at a clock time on a date. Fires with the app closed. */
export async function scheduleAt(id: string, at: Date, title: string, body: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await n.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'sobat' },
  });
}

/** Identifiers of everything the OS still holds for this app. Empty on web and on any error. */
export async function scheduledIds(): Promise<string[]> {
  const n = loadNative();
  if (!n) return [];
  try {
    const all = await n.getAllScheduledNotificationsAsync();
    return all.map((r) => r.identifier);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Reconcile in `src/services/useScheduledReminders.ts`**

Replace the whole file with:

```ts
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { slotStates } from '../core/pattern';
import { lastLogDate, plannedReminders } from '../core/reminders';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { cancel, scheduleAt, scheduleDaily, scheduledIds, scheduleRepeating, setupAndroidChannel } from './notify';
import { useMantra } from './useMantra';

const IDS = {
  sleep: 'sobat-sleep-checkin',
  water: 'sobat-water',
  dinner: 'sobat-dinner',
  review: 'sobat-day-review',
  long: 'sobat-long-break',
  mantra: 'sobat-mantra',
};

/** Everything planned a week ahead carries this, so it can be told apart from the daily ones. */
const PLANNED = 'sobat-r-';

/**
 * Registers the reminders that must fire while the app is closed. The in-app
 * nudge timer only runs when the app is open, so on a phone these are what
 * actually reach you. The daily ones are re-registered on change; the week
 * of slot prompts and absence lines is reconciled against what the OS still
 * holds, so a logged slot's prompt is cancelled and a quiet week stays covered.
 */
export function useScheduledReminders() {
  const app = useApp();
  const { nudgesEnabled, waterGoalMl, quietStartHour, quietEndHour, offDays } = app.state.settings;
  const lang = app.state.profile.lang;
  const onboarded = app.state.profile.onboarded;
  const mantra = useMantra();
  const mantraText = mantra?.text ?? '';
  const routine = app.state.routine;
  const { today, hour } = app;

  useEffect(() => {
    if (Platform.OS === 'web' || !onboarded) return;
    const t = makeT(lang);

    (async () => {
      await setupAndroidChannel();

      if (!nudgesEnabled) {
        await Promise.all(Object.values(IDS).map(cancel));
        return;
      }

      // Morning check-in, while last night is still fresh.
      await scheduleDaily(IDS.sleep, 7, 30, t('sleep_checkin'), t('bed_time'));
      // The day's line, at eight. Re-registered daily so it is that day's line.
      if (mantraText) await scheduleDaily(IDS.mantra, 8, 0, t('mantra_title'), mantraText);
      // A single mid-afternoon water prompt; the in-app engine handles the rest.
      await scheduleDaily(IDS.water, 15, 0, t('add_water'), t('act_drink_water'));
      // Nudge dinner earlier than the quiet hours start. With the pattern on, the dinner slot's own prompt does this.
      if (routine.enabled) await cancel(IDS.dinner);
      else await scheduleDaily(IDS.dinner, Math.max(18, quietStartHour - 3), 30, t('dinner'), t('act_light_dinner'));
      // The day recap, just before things wind down.
      await scheduleDaily(IDS.review, 21, 30, t('day_review'), t('write_review'));

      // The phone cannot blank its own screen, so a long break is a
      // notification. A repeating notification cannot respect quiet hours or a
      // schedule, so when either is in force, do not register it at all.
      const br = app.state.breakSettings;
      const paused = br.pausedUntilMs !== null && Date.now() < br.pausedUntilMs;
      if (br.enabled && br.long.enabled && !paused && br.schedule === null) {
        await scheduleRepeating(IDS.long, br.long.everyMinutes * 60, t('brk_long'), t('brk_long_hint'));
      } else {
        await cancel(IDS.long);
      }
    })().catch(() => {
      // Permission refused or the OS declined. The app still works.
    });
  }, [nudgesEnabled, waterGoalMl, quietStartHour, lang, onboarded, app.state.breakSettings, mantraText, routine.enabled]);

  // Slots done or skipped today, as one string so the memo below only moves when the set does.
  const doneKey = useMemo(() => {
    if (!routine.enabled) return '';
    const todayMeals = app.state.meals.filter((m) => m.date === today);
    return slotStates({ routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: hour * 60, skipped: app.actionsDoneToday })
      .filter((s) => s.status === 'done' || s.status === 'skipped')
      .map((s) => s.slot.id)
      .sort()
      .join(',');
  }, [routine, app.state.meals, today, app.targets.kcal, hour, app.actionsDoneToday]);
  const lastLog = useMemo(() => lastLogDate(app.state.meals, today), [app.state.meals, today]);

  const wanted = useMemo(() => {
    if (Platform.OS === 'web' || !onboarded || !nudgesEnabled) return [];
    return plannedReminders({
      today,
      nowMinutes: hour * 60,
      routine,
      doneSlotIds: doneKey ? doneKey.split(',') : [],
      lastLogDate: lastLog,
      offDays: offDays ?? [],
      quietStartHour,
      quietEndHour,
      lang,
      t: makeT(lang),
    });
  }, [onboarded, nudgesEnabled, today, hour, routine, doneKey, lastLog, offDays, quietStartHour, quietEndHour, lang]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const have = (await scheduledIds()).filter((id) => id.startsWith(PLANNED));
      const want = new Map(wanted.map((r) => [`${PLANNED}${r.id}`, r]));
      for (const id of have) if (!want.has(id)) await cancel(id);
      const now = Date.now();
      for (const [id, r] of want) {
        if (have.includes(id)) continue;
        const at = new Date(`${r.date}T${r.time}:00`);
        // A moment already past would fire at once; the next tick plans the rest.
        if (at.getTime() <= now) continue;
        await scheduleAt(id, at, r.title, r.body);
      }
    })().catch(() => {
      // Permission refused or the OS declined. The app still works.
    });
  }, [wanted]);
}
```

- [ ] **Step 3: Stop `useWorkSchedule` registering daily slot prompts, and prompt by assignment**

In `src/services/useWorkSchedule.ts`:

1. Change the routine import to `import { skipKey, slotLabel, slotsDueBetween } from '../core/routine';` and add `import { slotStates } from '../core/pattern';`. Remove `bhajiFor`, `slotLogged`, `slotMinutes`, `SLOT_GRACE_MIN` from the import.
2. Replace the in-app slot prompt block (from `// A routine meal whose time passed...` to the end of that `if (routine.enabled) {...}`) with:

```ts
    // A routine meal whose time passed with nothing logged against it: ask once, log or skip.
    if (routine.enabled) {
      const todayMeals = app.state.meals.filter((m) => m.date === app.today);
      const states = slotStates({ routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: minute, skipped: app.actionsDoneToday });
      for (const s of slotsDueBetween(routine, from, minute)) {
        const st = states.find((x) => x.slot.id === s.id);
        if (!st || st.status === 'done' || st.status === 'skipped' || app.actionsDoneToday.includes(skipKey(s))) continue;
        const title = `${slotLabel(s, profile.lang)}?`;
        notifyNow(title, t('slot_prompt'), { priority: 'high' })
          .then((sent) => {
            if (sent) fb.notify(`${title} · ${t('slot_prompt')}`);
          })
          .catch(() => {});
      }
    }
```

3. In the native effect, delete the slot loop and shrink `wanted` to blocks only:

```ts
  // Native: the OS fires these even with the app closed. One per block, daily.
  // Slot prompts are planned a week ahead by useScheduledReminders, not here.
  useEffect(() => {
    if (Platform.OS === 'web' || !profile.onboarded) return;
    (async () => {
      const blocks = schedule.enabled ? orderedBlocks(schedule) : [];
      for (const b of blocks) {
        const m = toMinutes(b.start);
        await scheduleDaily(`${PREFIX}${b.id}`, Math.floor(m / 60), m % 60, t(`ntf_${b.kind}`), t(`ntf_${b.kind}_body`));
      }
      const wanted = blocks.map((b) => `${PREFIX}${b.id}`);
      // Blocks removed in Settings must stop firing too, and so must the per-slot dailies older builds registered.
      for (const id of lastRegistered.current) if (!wanted.includes(id)) await cancel(id);
      for (const s of routine.slots) await cancel(`${PREFIX}slot-${s.id}`);
      lastRegistered.current = wanted;
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, routine, profile.onboarded, profile.lang]);
```

(The `eslint-disable-next-line react-hooks/exhaustive-deps` on this effect already exists in the file; keep it where it is and add none elsewhere.)

- [ ] **Step 4: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all pass. If `tsc` reports that `SchedulableTriggerInputTypes.DATE` needs `date: Date | number`, a `Date` is what is passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/notify.ts src/services/useScheduledReminders.ts src/services/useWorkSchedule.ts
git commit -m "$(cat <<'EOF'
The phone holds a week of slot prompts and absence lines, reconciled on every change

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: The away card and the low-intake rule

**Files:**
- Create: `src/core/intake.ts`, `src/components/AwayCard.tsx`, `src/components/IntakeCard.tsx`
- Modify: `src/app/(tabs)/index.tsx`, `src/components/TipCard.tsx`, `src/app/(tabs)/coach.tsx`, `src/i18n/index.ts`
- Test: `src/core/__tests__/intake.test.ts`

**Interfaces:**
- Consumes: `daysAway` (Task 8); `KCAL_FLOOR` from `nutrition.ts`; `isOffDay` from `week.ts`; `lastNDates` from `date.ts`.
- Produces: `Intake`, `lowIntake(input)`, `intakeFact(intake)`.

- [ ] **Step 1: Add the i18n keys** (all three dicts)

en:
```ts
  away_title: '{n} days without a log',
  away_body: 'Everything is still here. Log one meal and today counts.',
  away_ok: 'OK',
  intake_title: 'Eating too little',
  intake_body: '{avg} kcal a day over your last {days} logged days. Below the {limit} line. Cravings come from this, not from weak will. Today\'s plan is {target}.',
  intake_open_plan: 'Open the plan',
```
mr:
```ts
  away_title: '{n} दिवस नोंद नाही',
  away_body: 'सगळं अजून इथेच आहे. एक जेवण नोंदवा, आजचा दिवस मोजला जातो.',
  away_ok: 'ठीक',
  intake_title: 'खूप कमी खाणं',
  intake_body: 'शेवटच्या {days} नोंदवलेल्या दिवसांत दिवसाला {avg} kcal. {limit} च्या रेषेखाली. तल्लफ यामुळे येते, कमकुवत मनामुळे नाही. आजचं नियोजन {target}.',
  intake_open_plan: 'नियोजन उघडा',
```
hi:
```ts
  away_title: '{n} दिन से कुछ दर्ज नहीं',
  away_body: 'सब कुछ अभी भी यहीं है. एक खाना दर्ज करें, आज का दिन गिना जाएगा.',
  away_ok: 'ठीक',
  intake_title: 'बहुत कम खाना',
  intake_body: 'पिछले {days} दर्ज दिनों में दिन के {avg} kcal. {limit} की रेखा से नीचे. क्रेविंग इसी से आती है, कमज़ोर इरादे से नहीं. आज का प्लान {target}.',
  intake_open_plan: 'प्लान खोलें',
```

- [ ] **Step 2: Write the failing intake tests**

Create `src/core/__tests__/intake.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { intakeFact, lowIntake } from '../intake';
import type { Meal } from '../types';

const meal = (date: string, kcal: number, n = 0): Meal => ({ id: `${date}-${n}`, at: `${date}T12:00:00.000Z`, date, type: 'lunch', items: [], kcal, protein: 0 });
/** A day with two meals, so it counts. */
const day = (date: string, kcal: number) => [meal(date, kcal / 2, 0), meal(date, kcal / 2, 1)];
const base = { today: '2026-10-12', target: 1600, floor: 1500, offDays: [] as number[] };

describe('lowIntake', () => {
  it('averages the last three counted days and speaks when they sit below the line', () => {
    const meals = [...day('2026-10-11', 1200), ...day('2026-10-10', 1100), ...day('2026-10-09', 1300), ...day('2026-10-08', 2000)];
    expect(lowIntake({ ...base, meals })).toEqual({ avg: 1200, limit: 1500, days: 3 });
  });

  it('is quiet with fewer than three counted days, above the line, and ignores half-logged days, off days and today', () => {
    expect(lowIntake({ ...base, meals: [...day('2026-10-11', 1000), ...day('2026-10-10', 1000)] })).toBeNull();
    expect(lowIntake({ ...base, meals: [...day('2026-10-11', 1550), ...day('2026-10-10', 1600), ...day('2026-10-09', 1500)] })).toBeNull();
    const halfLogged = [meal('2026-10-11', 300), ...day('2026-10-10', 1000), ...day('2026-10-09', 1000), ...day('2026-10-08', 1000)];
    expect(lowIntake({ ...base, meals: halfLogged })).toEqual({ avg: 1000, limit: 1500, days: 3 });
    // 2026-10-11 is a Sunday: an off day does not count against anyone.
    expect(lowIntake({ ...base, offDays: [0], meals: [...day('2026-10-11', 500), ...day('2026-10-10', 1000), ...day('2026-10-09', 1000)] })).toBeNull();
    expect(lowIntake({ ...base, meals: [...day('2026-10-12', 200), ...day('2026-10-10', 1000), ...day('2026-10-09', 1000)] })).toBeNull();
  });

  it('uses the higher of the floor and 85 percent of the target as the line', () => {
    const meals = [...day('2026-10-11', 1700), ...day('2026-10-10', 1700), ...day('2026-10-09', 1700)];
    expect(lowIntake({ ...base, target: 2200, meals })).toEqual({ avg: 1700, limit: 1870, days: 3 });
  });

  it('writes one plain sentence for the model, or nothing', () => {
    expect(intakeFact({ avg: 1200, limit: 1500, days: 3 })).toBe('Their last 3 logged days averaged 1200 kcal, under the 1500 kcal line; cravings are expected. Encourage eating the plan in full, never less.');
    expect(intakeFact(null)).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/core/__tests__/intake.test.ts`
Expected: FAIL, cannot resolve `../intake`.

- [ ] **Step 4: Create `src/core/intake.ts`**

```ts
import { lastNDates } from './date';
import type { ISODate, Meal } from './types';
import { isOffDay } from './week';

/**
 * Too little, for days: the thing behind most cravings. A day counts when
 * it is over, not a day off, and has at least two meals logged, so a day
 * half written down does not drag the average. The last three counted
 * days are averaged against the higher of the floor and 85 percent of the
 * target. Code decides; the model may only word it.
 */
export type Intake = { avg: number; limit: number; days: number } | null;

const COUNTED_DAYS = 3;
const MIN_MEALS = 2;

export function lowIntake(input: { meals: Meal[]; today: ISODate; target: number; floor: number; offDays: number[]; lookback?: number }): Intake {
  const dates = lastNDates(input.lookback ?? 14, input.today).filter((d) => d < input.today && !isOffDay(input.offDays, d)).reverse();
  const counted: number[] = [];
  for (const d of dates) {
    const meals = input.meals.filter((m) => m.date === d);
    if (meals.length < MIN_MEALS) continue;
    counted.push(meals.reduce((a, m) => a + m.kcal, 0));
    if (counted.length === COUNTED_DAYS) break;
  }
  if (counted.length < COUNTED_DAYS) return null;
  const avg = Math.round(counted.reduce((a, k) => a + k, 0) / counted.length);
  const limit = Math.max(input.floor, Math.round(input.target * 0.85));
  return avg < limit ? { avg, limit, days: counted.length } : null;
}

/** The verdict as one sentence of context for the coach and the tip. */
export function intakeFact(intake: Intake): string | null {
  if (!intake) return null;
  return `Their last ${intake.days} logged days averaged ${intake.avg} kcal, under the ${intake.limit} kcal line; cravings are expected. Encourage eating the plan in full, never less.`;
}
```

- [ ] **Step 5: Run the intake tests**

Run: `npx vitest run src/core/__tests__/intake.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: The two cards**

Create `src/components/AwayCard.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { daysAway } from '../core/reminders';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

const SEEN = 'away_seen';

/** After two or more days without a log: a plain welcome back, no backfill asked for. Gone for the day once dismissed. */
export function AwayCard() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const days = daysAway(app.state.meals, app.today);
  if (days < 2 || app.actionsDoneToday.includes(SEEN)) return null;
  return (
    <Card rail={C.amber}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name="leaf-outline" size={20} color={C.amber} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700' }}>{fill(t('away_title'), { n: days })}</Text>
          <Small color={C.textDim}>{t('away_body')}</Small>
        </View>
      </Row>
      <Row style={{ gap: 8 }}>
        <Btn small label={t('add_food')} icon={<Ionicons name="add" size={14} color={C.white} />} onPress={() => router.push('/log')} style={{ flex: 1 }} />
        <Btn small tone="ghost" label={t('away_ok')} onPress={() => app.toggleAction(SEEN)} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}
```

Create `src/components/IntakeCard.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { lowIntake } from '../core/intake';
import { KCAL_FLOOR } from '../core/nutrition';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/** Three logged days under the line: say so once, plainly, and point at the plan. */
export function IntakeCard() {
  const app = useApp();
  const router = useRouter();
  const { state, today, targets } = app;
  const t = makeT(state.profile.lang);
  const intake = useMemo(
    () => lowIntake({ meals: state.meals, today, target: targets.kcal, floor: KCAL_FLOOR[state.profile.sex], offDays: state.settings.offDays ?? [] }),
    [state.meals, today, targets.kcal, state.profile.sex, state.settings.offDays],
  );
  if (!intake) return null;
  return (
    <Card rail={C.red}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name="warning-outline" size={20} color={C.red} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700' }}>{t('intake_title')}</Text>
          <Small color={C.textDim}>{fill(t('intake_body'), { avg: intake.avg, days: intake.days, limit: intake.limit, target: targets.kcal })}</Small>
        </View>
      </Row>
      <Pressable onPress={() => router.push('/food?s=plan')} accessibilityRole="button">
        <Micro color={C.accent}>{`${t('intake_open_plan')} ›`}</Micro>
      </Pressable>
    </Card>
  );
}
```

- [ ] **Step 7: Put them on Today and feed the fact to the coach and the tip**

In `src/app/(tabs)/index.tsx`:

1. Add `import { AwayCard } from '../../components/AwayCard';` and `import { IntakeCard } from '../../components/IntakeCard';`.
2. In both layouts, right after the `{queued > 0 ? ... : null}` line, add `{isToday ? <AwayCard /> : null}`.
3. In both layouts, right after `{isToday ? <CoachStrip ... /> : null}`, add `{isToday ? <IntakeCard /> : null}`.

In `src/components/TipCard.tsx`, add `import { intakeFact, lowIntake } from '../core/intake';` and, right after the `facts.push(...routineFacts(...))` line:

```ts
    const intake = intakeFact(lowIntake({ meals: app.state.meals, today: app.today, target: app.targets.kcal, floor: KCAL_FLOOR[app.state.profile.sex], offDays: app.state.settings.offDays ?? [] }));
    if (intake) facts.push(intake);
```

In `src/app/(tabs)/coach.tsx`, add `import { intakeFact, lowIntake } from '../../core/intake';` and `import { KCAL_FLOOR } from '../../core/nutrition';` (if not already imported), and right after the `facts.push(...routineFacts(...))` call add the same two lines.

- [ ] **Step 8: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/intake.ts src/core/__tests__/intake.test.ts src/components/AwayCard.tsx src/components/IntakeCard.tsx "src/app/(tabs)/index.tsx" "src/app/(tabs)/coach.tsx" src/components/TipCard.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
A plain welcome back after days away, and a low-intake rule that names cravings for what they are

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Verify in the browser and close out

**Files:**
- Modify: `README.md` (the Status paragraph near line 221), `docs/superpowers/specs/2026-10-15-eating-pattern-design.md` (one sentence, see Step 5)

- [ ] **Step 1: Start the dev server and seed a state**

Use the `sobat-web` configuration in `.claude/launch.json` (port 8082). Never start it with `CI=1`: that disables the file watcher. In the Terminal, run `npm run seed | pbcopy`, then in the browser console: `localStorage.setItem('sobat.state.v1', <paste>); location.reload()`. Finish onboarding if the welcome screen shows. In Food, open the Routine section and switch on "Follow my eating pattern".

- [ ] **Step 2: Check the pattern on every screen, at 375 px and 1440 px, in English and Marathi**

- Food, Routine section: each slot row shows "N kcal · type · ...", the open editor shows the share stepper and "= N kcal today"; pressing + and − changes the row's kcal and the others' too.
- Food, Plan section: the headings are the slot names (Fruit, Badam and akrod at the office, Lunch, ...), the line "Meals follow your eating pattern · edit" is under the day picker, and the day total still shows. Add a slot in Routine, come back: the plan has a meal for it.
- Today: the pattern card shows each slot with "N planned", the next one highlighted; the plan card is gone. Tap the + on a slot: the sheet lists the plan's lines; "Log as planned" logs it, the row turns to "eaten / allowance" and "+N vs plan" or "−N". "Different ›" opens the log screen with that slot's chip selected.
- Log screen: the chips row replaces the four meal types; adding a food updates the line "Lunch: 85 / 560 · 475 left for Lunch · 1,240 left today"; it turns amber past the slot and red past the day; Save returns to Today with the slot done.
- Today with the seed's history: the intake card does not show (the seed eats about 1,400 to 1,700 a day; if it shows, the numbers in it must match the last three seeded days). Edit three seeded days down to 900 kcal each in History and confirm the card appears with those numbers and "Open the plan ›" works.
- Away card: in the console, delete today's and yesterday's meals from the stored state (`meals = meals.filter(m => m.date < <two days ago>)`), reload: "2 days without a log" shows; OK hides it for the day; "Add food" opens the log screen.
- Switch the pattern off in Routine: the plan card returns on Today, the log screen shows the four meal types again.

Take a screenshot of the pattern card at 375 px (Marathi) and of the log screen with the live line, and attach both to the final report.

- [ ] **Step 3: Migration against real data**

In the browser console, before enabling anything, `JSON.parse(localStorage.getItem('sobat.state.v1')).version` must read 6 after the first load of the new build, every routine slot must have a `share`, and a `weekPlan` saved by the old build must list `fruit`, `dry-fruit`, `lunch`, `tea`, `bhel`, `dinner`, `milk` as meal ids with its lines intact.

- [ ] **Step 4: Final gate**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, every test passing with more tests than 381.

- [ ] **Step 5: Docs**

In `README.md`, in the Status paragraph, after "the rule-based coach that answers with the", find the end of the "Working:" sentence and add one clause: "; an eating pattern of meal slots with a share of the day each, which the budget, the week plan, the log screen and the reminders follow; slot prompts and absence lines scheduled a week ahead on the phone".

In the spec, under "What fits, from the slots", change "the meals still ahead are the slots not logged whose time plus grace is still ahead" to "the meals still ahead are the slots not logged whose turn has not passed: a slot stays ahead until the next slot's window opens, so a late lunch is still lunch".

- [ ] **Step 6: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-15-eating-pattern-design.md
git commit -m "$(cat <<'EOF'
Status: the eating pattern and a week of planned reminders

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

Do not push.
