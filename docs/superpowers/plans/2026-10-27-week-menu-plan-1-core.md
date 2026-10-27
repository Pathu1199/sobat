# Week menu redesign, Plan 1 of 4: core data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Sobat the data the redesign stands on: a menu per date that a new week copies from the week before, skips that keep their date, meals that know whether they came from the plan, an exact day-by-day record and streak, the new settings, a version-7 migration, a sync merge that keeps the newer menu edit, and one meal clock (`slotAt`) that every meal-shaped decision reads. The existing screens keep working on top of it; no new screens.

**Architecture:** Pure functions in `src/core` do every rule: `menu.ts` (menus per date, skips, meals from the plan, auto-fill, saved meals, a bridge for the old plan screen), `record.ts` (the record and the streak), `tiles.ts` (tile maths), `tabs.ts` (tab and card ids). A date's menu is a view: the stored menu, else the same weekday a week earlier, else the newest earlier one of that weekday, else the pattern; only edits (and the migrated week) are stored. `AppProvider` wraps each rule in a thin action, runs auto-fill on open, every minute and on returning to the front, and keeps the old plan screen editing this week's menus through `app.weekPlan`. `migrate.ts` brings stores to version 7; `sync.ts` merges the new collections record by record, newer `editedAt` first for menus.

**Tech Stack:** Expo SDK 57, expo-router, React Native 0.86, TypeScript (strict), vitest 4 (TZ pinned to Asia/Kolkata in `vitest.config.mts`; `react-native` is stubbed there so `src/store/*` can be tested), npm.

Spec: `docs/superpowers/specs/2026-10-27-week-menu-redesign-design.md` (sections "Decisions", "Part 1: data (core)", "Part 3: making the meal clocks agree", "Living tiles → Pure helpers", "Testing", "Files").

## Global Constraints

- npm, not bun (there is no `bun.lock`): every command is `npx …` or `npm …`.
- Dependencies only through `npx expo install <package>`; none are expected in this plan.
- Never push. Every push to `main` deploys the website and publishes an APK. Commit after each task; do not push at the end either.
- Before a task is done: `npx tsc --noEmit`, `npx expo lint` and `npx vitest run` are all clean. At the start tsc and lint are clean and 648 tests pass; the count only goes up.
- Firebase is Auth only. The data is one state file per user, synced through the relay; never Firestore.
- Every meal-shaped thing reads the eating pattern (slots, keyed by slot id), never a fixed list of meal hours.
- Every meal added to the state goes through `withSlot` (in the store, through `withMeal`).
- Calories always come from the food database × grams (`lineInfo` → `toMealItem`), never typed or guessed.
- Match the surrounding comment density and naming: plain sentences, no em-dashes in copy, no new `eslint-disable` lines. React Compiler rules apply: no synchronous set-state in an effect body (use a timer or a listener callback), no ref reads in render.
- The user is "the user", "they" or "the person" (as the code says), never he or she.
- Do not create or edit `ios/` or `android/`.
- Commit messages are plain-English sentences describing behaviour, and end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

Created:

- `src/core/tabs.ts`: the extra-tab ids, Today card ids, their defaults, and `normalizeTabs`.
- `src/core/menu.ts`: everything about the day's menu: `DayMenu`, viewing a date or a week, per-date edits, following the slots, skips, meals made from planned lines, auto-fill, confirming, saved meals, the template migration, and the bridge the old plan screen edits through.
- `src/core/record.ts`: `dayRecord`, `weekRecord`, `recordStreak`.
- `src/core/tiles.ts`: tile fill fractions, bottles and minutes left, goal reached, the weight line's points.
- Tests: `src/core/__tests__/tabs.test.ts`, `menu.test.ts`, `record.test.ts`, `tiles.test.ts`.

Modified:

- `src/core/types.ts`: new settings fields and ids, `Meal.source`, `SlotSkip`, `SavedMeal`, `AppState.menus/slotSkips/savedMeals`.
- `src/core/date.ts`: `mondayOf`, `weekDates`.
- `src/core/weekPlan.ts`: `planDayFor` and `alignDay` split out so one date can be built or aligned.
- `src/core/routine.ts`: `DEFAULT_SLOTS` (the only use of `MEAL_WINDOWS` left in core), `SKIP_PREFIX`.
- `src/core/pattern.ts`: `skippedSlots` by slot id, generic `slotOf`, `slotAt`, `expectedKcalByHour` (moved from `nutrition.ts`).
- `src/core/nutrition.ts`: `expectedKcalByHour` removed.
- `src/core/insights.ts`, `coach.ts`, `dayPlan.ts`, `offlineCoach.ts`: read the pattern by slot id.
- `src/core/activity.ts`: `walkLog`.
- `src/core/sync.ts`: the three new collections, newer `editedAt` wins for menus.
- `src/store/defaults.ts`, `src/store/migrate.ts`, `src/store/AppProvider.tsx`.
- Existing UI, only so it compiles and keeps working: `RoutineCard.tsx`, `PlanTodayCard.tsx`, `FitsCard.tsx`, `useCoach.ts`, `useWorkSchedule.ts`, `useScheduledReminders.ts`, `usePhotoQueue.ts`, `(tabs)/log.tsx`, `(tabs)/coach.tsx`, `(tabs)/index.tsx`, `plan.tsx`, `routine.tsx`, and the ten files that read `settings.glassMl`.
- Existing tests that encoded old behaviour: `migrate.test.ts`, `sync.test.ts`, `pattern.test.ts`, `insights.test.ts`, `coach.test.ts`, `dayPlan.test.ts`, `offlineCoach.test.ts`, `date.test.ts`, `activity.test.ts`. Each change says why.

---

### Task 1: Settings: bottles, the walk goal, tabs, Today cards, features and reminders

**Files:**
- Create: `src/core/tabs.ts`
- Modify: `src/core/types.ts` (`Settings`, lines 30-61; new types after `Diet`, line 63)
- Modify: `src/store/defaults.ts` (`DEFAULT_SETTINGS`, lines 29-51)
- Modify: `src/store/migrate.ts` (`upgradeAppSettings`, lines 85-90)
- Modify (rename `settings.glassMl` → `settings.bottleMl`): `src/components/StartHereCard.tsx`, `src/components/TrackerGrid.tsx`, `src/app/(tabs)/log.tsx`, `src/components/BreakCheckin.tsx`, `src/components/CoachStrip.tsx`, `src/components/NowStrip.tsx`, `src/services/useNudges.ts`, `src/components/CravingSOS.tsx`, `src/components/WaterSheet.tsx`, `src/components/Sidebar.tsx`
- Test: `src/core/__tests__/tabs.test.ts` (new), `src/core/__tests__/migrate.test.ts`, `src/core/__tests__/sync.test.ts` (lines 159 and 162)

**Interfaces:**
- Consumes: `isRecord`, `EMPTY_STATE` (existing, `src/store/migrate.ts`, `src/store/defaults.ts`).
- Produces:
  - `type TabId = 'progress' | 'coach' | 'body' | 'sleep' | 'plan'` and `type TodayCardId = 'coach' | 'waterWalk' | 'menu' | 'weight' | 'sleep' | 'steps' | 'climb' | 'mantra'` in `types.ts`.
  - `Settings` loses `glassMl` and gains `bottleMl: number; walkGoalMin: number; tabs: TabId[]; todayCards: { id: TodayCardId; on: boolean }[]; features: { breaks: boolean; mantra: boolean; autoPlates: boolean }; reminders: { mealPrompt: boolean; fillYesterday: boolean; planWeek: boolean; weeklyReport: boolean }`.
  - From `tabs.ts`: `TAB_IDS: TabId[]`, `MAX_EXTRA_TABS = 2`, `DEFAULT_TABS: TabId[]`, `TODAY_CARD_IDS: TodayCardId[]`, `DEFAULT_TODAY_CARDS: { id: TodayCardId; on: boolean }[]`, `normalizeTabs(tabs: unknown): TabId[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/tabs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_TODAY_CARDS, normalizeTabs } from '../tabs';

describe('normalizeTabs', () => {
  it('keeps known tabs in the order chosen, and an empty choice', () => {
    expect(normalizeTabs(['coach', 'progress'])).toEqual(['coach', 'progress']);
    expect(normalizeTabs([])).toEqual([]);
  });

  it('drops unknown ids and duplicates, so a bad value from sync cannot hide the fixed tabs', () => {
    expect(normalizeTabs(['today', 'coach', 'me', 'coach', 42, null])).toEqual(['coach']);
  });

  it('keeps at most two', () => {
    expect(normalizeTabs(['progress', 'coach', 'body', 'sleep'])).toEqual(['progress', 'coach']);
  });

  it('gives the default to anything that is not a list', () => {
    expect(normalizeTabs(undefined)).toEqual(['progress']);
    expect(normalizeTabs('progress')).toEqual(['progress']);
  });
});

describe('DEFAULT_TODAY_CARDS', () => {
  it('has the menu, the coach line and water and walk on, in that order, and every other card off', () => {
    expect(DEFAULT_TODAY_CARDS.map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk', 'weight', 'sleep', 'steps', 'climb', 'mantra']);
    expect(DEFAULT_TODAY_CARDS.filter((c) => c.on).map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk']);
  });
});
```

In `src/core/__tests__/migrate.test.ts`, add inside `describe('migrateState', ...)`, after the last `it(...)`:

```ts
  it('version 7: the old default glass becomes a 500 ml bottle, a size the person chose stays, and the new settings get their defaults', () => {
    const s = migrateState(v1);
    expect(s.settings.bottleMl).toBe(500);
    expect((s.settings as unknown as Record<string, unknown>).glassMl).toBeUndefined();
    expect(migrateState({ ...v1, settings: { ...v1.settings, glassMl: 750 } }).settings.bottleMl).toBe(750);
    expect(s.settings.walkGoalMin).toBe(30);
    expect(s.settings.tabs).toEqual(['progress']);
    expect(s.settings.features).toEqual({ breaks: false, mantra: false, autoPlates: false });
    expect(s.settings.reminders).toEqual({ mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false });
    expect(s.settings.todayCards.filter((c) => c.on).map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk']);
  });

  it('version 7: a choice made after the migration survives the next load, and a bad tab list is cleaned', () => {
    const once = migrateState(v1);
    const chosen = { ...once, settings: { ...once.settings, bottleMl: 1000, tabs: ['coach', 'sleep', 'body'], features: { ...once.settings.features, mantra: true } } };
    const again = migrateState(chosen);
    expect(again.settings.bottleMl).toBe(1000);
    expect(again.settings.tabs).toEqual(['coach', 'sleep']);
    expect(again.settings.features.mantra).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/tabs.test.ts src/core/__tests__/migrate.test.ts`
Expected: FAIL. `tabs.test.ts`: "Failed to resolve import "../tabs"". `migrate.test.ts`: the two new tests fail on `bottleMl` being `undefined`.

- [ ] **Step 3: Add the types to `src/core/types.ts`**

In `Settings`, replace the line `  glassMl: number;` with:

```ts
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
```

After the line `export type Diet = 'veg' | 'egg' | 'nonveg';` add:

```ts

/** A tab the person may add beside Today, ➕ and Me. */
export type TabId = 'progress' | 'coach' | 'body' | 'sleep' | 'plan';
/** A card the person may show on Today, under the calories left. */
export type TodayCardId = 'coach' | 'waterWalk' | 'menu' | 'weight' | 'sleep' | 'steps' | 'climb' | 'mantra';
```

- [ ] **Step 4: Create `src/core/tabs.ts`**

```ts
import type { TabId, TodayCardId } from './types';

/**
 * What the person chose to see: up to two extra tabs beside the fixed Today,
 * ➕ and Me, and the cards on Today in their order. Pure, so a value that
 * arrives from sync or an old file is cleaned the same way everywhere.
 */
export const TAB_IDS: TabId[] = ['progress', 'coach', 'body', 'sleep', 'plan'];
export const MAX_EXTRA_TABS = 2;
export const DEFAULT_TABS: TabId[] = ['progress'];

export const TODAY_CARD_IDS: TodayCardId[] = ['menu', 'coach', 'waterWalk', 'weight', 'sleep', 'steps', 'climb', 'mantra'];

/** The day's menu, the coach line and the water and walk tiles are on; the rest can be added. */
export const DEFAULT_TODAY_CARDS: { id: TodayCardId; on: boolean }[] = TODAY_CARD_IDS.map((id) => ({ id, on: id === 'menu' || id === 'coach' || id === 'waterWalk' }));

/** Known ids only, each once, at most two. Anything that is not a list gets the default. */
export function normalizeTabs(tabs: unknown): TabId[] {
  if (!Array.isArray(tabs)) return [...DEFAULT_TABS];
  const out: TabId[] = [];
  for (const t of tabs) {
    if (out.length === MAX_EXTRA_TABS) break;
    if (typeof t === 'string' && (TAB_IDS as string[]).includes(t) && !out.includes(t as TabId)) out.push(t as TabId);
  }
  return out;
}
```

- [ ] **Step 5: Defaults in `src/store/defaults.ts`**

Add the import after `import { DEFAULT_SCHEDULE } from '../core/schedule';`:

```ts
import { DEFAULT_TABS, DEFAULT_TODAY_CARDS } from '../core/tabs';
```

In `DEFAULT_SETTINGS`, replace `  glassMl: 250,` with:

```ts
  // Water is counted in bottles and walking in minutes, one tap at a time.
  bottleMl: 500,
  walkGoalMin: 30,
  tabs: [...DEFAULT_TABS],
  todayCards: DEFAULT_TODAY_CARDS.map((c) => ({ ...c })),
  // Off unless switched on: the screen breaks, the mantra and the plates the app makes up.
  features: { breaks: false, mantra: false, autoPlates: false },
  // Only the meal-time prompt is on; the rest are a switch away.
  reminders: { mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false },
```

- [ ] **Step 6: The settings part of the migration in `src/store/migrate.ts`**

Add the import after `import { slotShare } from '../core/pattern';`:

```ts
import { DEFAULT_TODAY_CARDS, normalizeTabs } from '../core/tabs';
```

Replace the whole `upgradeAppSettings` function (the doc comment line and the function) with:

```ts
/** An address nobody changed from the old placeholder moves to this platform's default; settings added later get their defaults. */
function upgradeAppSettings(old: unknown): AppState['settings'] {
  const raw: Record<string, unknown> = isRecord(old) ? old : {};
  const s = { ...EMPTY_STATE.settings, ...raw } as AppState['settings'] & { glassMl?: unknown };
  if (s.ollamaUrl === OLD_OLLAMA_PLACEHOLDER) s.ollamaUrl = DEFAULT_OLLAMA_URL;
  // Version 7: water is counted in bottles. The old default glass becomes the default 500 ml bottle; a size the person chose stays.
  const glass = raw.glassMl;
  if (typeof glass === 'number' && glass > 0 && typeof raw.bottleMl !== 'number') s.bottleMl = glass === 250 ? 500 : glass;
  delete s.glassMl;
  s.features = { ...EMPTY_STATE.settings.features, ...(isRecord(raw.features) ? raw.features : {}) } as AppState['settings']['features'];
  s.reminders = { ...EMPTY_STATE.settings.reminders, ...(isRecord(raw.reminders) ? raw.reminders : {}) } as AppState['settings']['reminders'];
  // A tab list from sync or an old file can never hide Today, ➕ or Me.
  s.tabs = normalizeTabs(s.tabs);
  if (!Array.isArray(s.todayCards)) s.todayCards = DEFAULT_TODAY_CARDS.map((c) => ({ ...c }));
  return s;
}
```

- [ ] **Step 7: Rename the reads of the old field**

Run:

```bash
sed -i '' 's/settings\.glassMl/settings.bottleMl/g' src/components/StartHereCard.tsx src/components/TrackerGrid.tsx "src/app/(tabs)/log.tsx" src/components/BreakCheckin.tsx src/components/CoachStrip.tsx src/components/NowStrip.tsx src/services/useNudges.ts src/components/CravingSOS.tsx src/components/WaterSheet.tsx src/components/Sidebar.tsx
```

In `src/core/__tests__/sync.test.ts` (the test "a setting changed elsewhere arrives; one changed here is kept"), the field no longer exists: replace `glassMl: 300` with `bottleMl: 750` (line 159) and `.settings.glassMl).toBe(300)` with `.settings.bottleMl).toBe(750)` (line 162).

Then `grep -rn "glassMl" src` must list only `src/store/migrate.ts`, the raw `v1` fixture on line 11 of `migrate.test.ts`, and the new migration test. The words on screen still say "glasses" until a later plan rebuilds the water tile; one tap now adds one bottle.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/core/__tests__/tabs.test.ts src/core/__tests__/migrate.test.ts src/core/__tests__/sync.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 655 tests.

- [ ] **Step 10: Commit**

```bash
git add src/core/tabs.ts src/core/types.ts src/store/defaults.ts src/store/migrate.ts src/components/StartHereCard.tsx src/components/TrackerGrid.tsx "src/app/(tabs)/log.tsx" src/components/BreakCheckin.tsx src/components/CoachStrip.tsx src/components/NowStrip.tsx src/services/useNudges.ts src/components/CravingSOS.tsx src/components/WaterSheet.tsx src/components/Sidebar.tsx src/core/__tests__/tabs.test.ts src/core/__tests__/migrate.test.ts src/core/__tests__/sync.test.ts
git commit -m "$(cat <<'EOF'
Water is counted in 500 ml bottles and walking in minutes toward 30; settings gain the extra tabs, Today's cards, the features that stay off and the reminders, and a tab list from sync can never hide the fixed tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Week dates and per-date menus

**Files:**
- Modify: `src/core/date.ts` (append)
- Modify: `src/core/weekPlan.ts` (`buildWeekPlan` lines 180-188, `alignWeekPlan` lines 196-234)
- Create: `src/core/menu.ts`
- Modify: `src/core/types.ts` (`AppState`), `src/store/defaults.ts` (`EMPTY_STATE`)
- Test: `src/core/__tests__/menu.test.ts` (new), `src/core/__tests__/date.test.ts`

**Interfaces:**
- Consumes: `addDays` (`date.ts`), `weekdayOf`, `PlanLine`, `Routine` (`routine.ts`), `slotPlanLines`, `pattern`, `PlanMeal`, `PlanDay` (`weekPlan.ts`, `pattern.ts`), `stable` (`sync.ts`).
- Produces:
  - `date.ts`: `mondayOf(date: ISODate): ISODate`, `weekDates(monday: ISODate): ISODate[]`.
  - `weekPlan.ts`: `planDayFor(routine: Routine, weekday: number, foods: FoodItem[]): PlanDay`, `alignDay(day: PlanDay, routine: Routine, weekday: number, foods?: FoodItem[]): PlanDay`.
  - `menu.ts`: `type DayMenu = { date: ISODate; meals: PlanMeal[]; editedAt: string }`, `NOT_EDITED = ''`, `menuFor(date, menus): DayMenu | null`, `startingMenu(date, menus, routine, foods): DayMenu`, `ensureWeek(monday, menus, routine, foods): DayMenu[]`, `alignMenu(menu, routine, today, foods?): DayMenu`, `alignMenus(menus, routine, today, foods?): DayMenu[]`, `viewMenu(date, menus, routine, today, foods): DayMenu`, `viewWeek(monday, menus, routine, today, foods): DayMenu[]`, `setMenuDay(menus, day: DayMenu, meals: PlanMeal[], now: Date): DayMenu[]`, `setMenuLine(menus, day, mealId: string, lineIdx: number, next: PlanLine | null, now): DayMenu[]`, `addMenuLine(menus, day, mealId, line: PlanLine, now): DayMenu[]`, `setMenuMeal(menus, day, meal: PlanMeal, now): DayMenu[]`, `copyDay(from: DayMenu, to: ISODate, menus, now): DayMenu[]`.
  - `AppState.menus: DayMenu[]`; `EMPTY_STATE.menus = []`.

Adjustments to the spec, from the code: the edits take the day **as shown** (`day: DayMenu`) rather than a date, because a date that was never edited has no stored record (its menu is a view, see `viewMenu`); `copyDay` takes the source menu for the same reason; `alignMenu` needs `today` (only today and later follow the slots) and optionally `foods` (a new slot gets the pattern's lines); every edit takes `now` so tests are exact. A menu the app writes carries `editedAt: ''` (`NOT_EDITED`) so any real edit is newer in a sync merge.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/date.test.ts`, replace the import line with:

```ts
import { formatDayLabel, localDate, localHHMM, localHour, mondayOf, msToNextMinute, weekDates } from '../date';
```

and append at the end of the file:

```ts
describe('weeks', () => {
  it('finds the Monday of any date; weeks run Monday to Sunday', () => {
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(mondayOf('2026-10-27')).toBe('2026-10-26');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });

  it('lists the seven dates from Monday', () => {
    expect(weekDates('2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
});
```

Create `src/core/__tests__/menu.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { addMenuLine, alignMenu, alignMenus, copyDay, ensureWeek, menuFor, NOT_EDITED, setMenuLine, setMenuMeal, viewMenu, viewWeek, type DayMenu } from '../menu';
import { DEFAULT_ROUTINE, type PlanLine, type Routine, type RoutineSlot } from '../routine';
import type { FoodItem } from '../types';
import { planDayFor, type PlanMeal } from '../weekPlan';

const foods = foodsJson as FoodItem[];
const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '20:00', 35)] };
const chapati = (qty: number): PlanLine => ({ foodId: 'chapati', unit: 'piece', qty });
/** A menu whose lunch is `qty` chapati; breakfast and dinner have nothing planned. */
const menu = (date: string, qty: number, editedAt = '2026-10-01T09:00:00.000Z'): DayMenu => ({
  date,
  editedAt,
  meals: [
    { id: 'morning', type: 'breakfast', time: '08:30', lines: [] },
    { id: 'lunch', type: 'lunch', time: '13:00', lines: [chapati(qty)] },
    { id: 'dinner', type: 'dinner', time: '20:00', lines: [] },
  ],
});
const lunchQty = (m: { meals: PlanMeal[] } | null | undefined) => m?.meals.find((x) => x.id === 'lunch')?.lines[0]?.qty;
// vitest pins TZ to Asia/Kolkata. 26 October 2026 is a Monday.
const MON = '2026-10-26';
const NOW = new Date('2026-10-27T10:00:00');

describe('ensureWeek', () => {
  it('copies each date from the same weekday a week earlier, as written by the app', () => {
    const lastWeek = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d, i) => menu(d, i + 1));
    const week = ensureWeek(MON, lastWeek, routine, foods);
    expect(week.map((m) => m.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(week.map(lunchQty)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(week.every((m) => m.editedAt === NOT_EDITED)).toBe(true);
  });

  it('falls back to the newest earlier menu of that weekday, then to the pattern', () => {
    const week = ensureWeek(MON, [menu('2026-10-07', 2), menu('2026-10-14', 3)], routine, foods);
    // Wednesday the 28th: the 14th is the newest earlier Wednesday.
    expect(lunchQty(week[2])).toBe(3);
    // Thursday: nothing earlier, so the pattern's own lines, as the week plan was built.
    expect(week[3].meals).toEqual(planDayFor(routine, 4, foods).meals);
  });

  it('never overwrites a stored date', () => {
    const stored = menu('2026-10-28', 9);
    expect(ensureWeek(MON, [menu('2026-10-21', 1), stored], routine, foods)[2]).toBe(stored);
  });

  it('a copy is its own: changing it does not change the week it came from', () => {
    const source = menu('2026-10-21', 2);
    const week = ensureWeek(MON, [source], routine, foods);
    week[2].meals[1].lines[0].qty = 5;
    expect(lunchQty(source)).toBe(2);
  });
});

describe('editing one date', () => {
  const wed = menu('2026-10-28', 2);
  const thu = menu('2026-10-29', 2);
  const menus = [wed, thu];

  it('changes only that date, and stamps it', () => {
    const out = setMenuLine(menus, wed, 'lunch', 0, chapati(3), NOW);
    expect(lunchQty(menuFor('2026-10-28', out))).toBe(3);
    expect(menuFor('2026-10-28', out)!.editedAt).toBe(NOW.toISOString());
    expect(menuFor('2026-10-29', out)).toBe(thu);
    expect(lunchQty(wed)).toBe(2);
  });

  it('a quantity of 0 removes the line; the same food in the same measure again is a bigger portion', () => {
    expect(menuFor('2026-10-28', setMenuLine(menus, wed, 'lunch', 0, chapati(0), NOW))!.meals[1].lines).toEqual([]);
    expect(menuFor('2026-10-28', addMenuLine(menus, wed, 'lunch', chapati(1), NOW))!.meals[1].lines).toEqual([chapati(3)]);
    expect(menuFor('2026-10-28', addMenuLine(menus, wed, 'lunch', { foodId: 'moong-dal', unit: 'katori', qty: 1 }, NOW))!.meals[1].lines).toHaveLength(2);
  });

  it('replaces one meal, and stores a date that was only shown until now', () => {
    const dinner: PlanMeal = { id: 'dinner', type: 'dinner', time: '20:00', lines: [chapati(1)] };
    expect(menuFor('2026-10-28', setMenuMeal(menus, wed, dinner, NOW))!.meals[2]).toEqual(dinner);
    const shown = menu('2026-10-30', 2, NOT_EDITED);
    const out = setMenuLine(menus, shown, 'lunch', 0, chapati(4), NOW);
    expect(out).toHaveLength(3);
    expect(lunchQty(menuFor('2026-10-30', out))).toBe(4);
  });

  it('copies a day onto another date as its own copy', () => {
    const out = copyDay(wed, '2026-10-29', menus, NOW);
    const copy = menuFor('2026-10-29', out)!;
    expect(copy.meals).toEqual(wed.meals);
    expect(copy.meals[1].lines[0]).not.toBe(wed.meals[1].lines[0]);
    expect(copy.editedAt).toBe(NOW.toISOString());
    expect(menuFor('2026-10-28', out)).toBe(wed);
  });
});

describe('following the slots', () => {
  const withTea: Routine = { ...routine, slots: [...routine.slots, slot('tea', 'snack', '16:00', 5)] };

  it('today and later dates take a new slot and keep their lines and stamp; a past date stays as it was', () => {
    const past = menu('2026-10-26', 2);
    expect(alignMenu(past, withTea, '2026-10-27', foods)).toBe(past);
    const ahead = alignMenu(menu('2026-10-28', 2), withTea, '2026-10-27', foods);
    expect(ahead.meals.map((m) => m.id)).toEqual(['morning', 'lunch', 'tea', 'dinner']);
    expect(lunchQty(ahead)).toBe(2);
    expect(ahead.editedAt).toBe('2026-10-01T09:00:00.000Z');
  });

  it('drops a slot that is gone, from today on', () => {
    const noDinner: Routine = { ...routine, slots: routine.slots.filter((s) => s.id !== 'dinner') };
    expect(alignMenu(menu('2026-10-27', 2), noDinner, '2026-10-27').meals.map((m) => m.id)).toEqual(['morning', 'lunch']);
  });

  it('gives back the same object and the same list when nothing moves', () => {
    const m = menu('2026-10-28', 2);
    expect(alignMenu(m, routine, '2026-10-27')).toBe(m);
    const list = [m, menu('2026-10-20', 1)];
    expect(alignMenus(list, routine, '2026-10-27')).toBe(list);
  });

  it('shows a date as stored or as it starts, following the slots', () => {
    const shown = viewMenu('2026-10-28', [menu('2026-10-21', 3)], withTea, '2026-10-27', foods);
    expect(lunchQty(shown)).toBe(3);
    expect(shown.meals.map((m) => m.id)).toContain('tea');
    expect(viewWeek(MON, [], routine, '2026-10-27', foods)).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/menu.test.ts src/core/__tests__/date.test.ts`
Expected: FAIL. `menu.test.ts`: "Failed to resolve import "../menu"". `date.test.ts`: "mondayOf is not a function".

- [ ] **Step 3: Add the week helpers to `src/core/date.ts`**

Append after `addDays`:

```ts
/** The Monday of the week a date is in. Weeks run Monday to Sunday, the way the plan screen shows them. */
export function mondayOf(date: ISODate): ISODate {
  return addDays(date, -((new Date(date + 'T12:00:00').getDay() + 6) % 7));
}

/** The seven dates of the week starting on `monday`. */
export function weekDates(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
```

- [ ] **Step 4: Split one day out of `src/core/weekPlan.ts`**

Replace the whole `buildWeekPlan` function (with its doc comment) with:

```ts
/** One weekday from the pattern: a meal per slot, in time order, with that weekday's lines. Empty meals stay, so a slot can be filled later. */
export function planDayFor(routine: Routine, weekday: number, foods: FoodItem[]): PlanDay {
  return { meals: pattern(routine).map((p) => ({ id: p.id, type: p.type, time: slotTime(p.slot), lines: slotPlanLines(routine, p.slot, weekday, foods) })) };
}

/** The week from the pattern: one meal per slot, every day, in time order. */
export function buildWeekPlan(routine: Routine, foods: FoodItem[]): WeekPlan {
  const days: PlanDay[] = [];
  for (let d = 0; d < 7; d++) days.push(planDayFor(routine, d, foods));
  return { days };
}
```

Replace the whole `alignWeekPlan` function (keep its doc comment above it) with:

```ts
export function alignWeekPlan(plan: WeekPlan, routine: Routine, foods?: FoodItem[]): WeekPlan {
  return { days: plan.days.map((day, d) => alignDay(day, routine, d, foods)) };
}

/** One day reshaped to the current slots, the way alignWeekPlan reshapes each; `weekday` picks the lines a newly added slot gets. */
export function alignDay(day: PlanDay, routine: Routine, weekday: number, foods?: FoodItem[]): PlanDay {
  const slots = pattern(routine);
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
    meals.push({ id: p.id, type: p.type, time: slotTime(p.slot), lines: foods ? slotPlanLines(routine, p.slot, weekday, foods) : [] });
  }
  const order = new Map(slots.map((p, i) => [p.id, i]));
  meals.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { meals };
}
```

- [ ] **Step 5: Create `src/core/menu.ts`**

```ts
import { addDays, weekDates } from './date';
import { weekdayOf, type PlanLine, type Routine } from './routine';
import { stable } from './sync';
import type { FoodItem, ISODate } from './types';
import { alignDay, planDayFor, type PlanMeal } from './weekPlan';

/**
 * The menu, date by date. Each date holds its own meals, one per slot of the
 * eating pattern, each with its foods and quantities, so changing this
 * Wednesday never changes next Wednesday. A date nobody has written yet
 * starts as a copy of the same weekday a week earlier, so a week that is not
 * planned repeats the one before; with nothing earlier, it starts from the
 * pattern. The week is a view over seven dates, Monday to Sunday, never a
 * stored object. Pure functions; the store keeps the dates that were written.
 */
export type DayMenu = {
  date: ISODate;
  /** One meal per slot; `id` is the slot id. */
  meals: PlanMeal[];
  /** ISO time of the last edit, so sync keeps the newer of two edits. NOT_EDITED for a menu the app wrote and nobody changed. */
  editedAt: string;
};

/** The stamp of a menu the app wrote and nobody has edited: any real edit is newer. */
export const NOT_EDITED = '';

export function menuFor(date: ISODate, menus: DayMenu[]): DayMenu | null {
  return menus.find((m) => m.date === date) ?? null;
}

function copyMeals(meals: PlanMeal[]): PlanMeal[] {
  return meals.map((m) => ({ ...m, lines: m.lines.map((l) => ({ ...l })) }));
}

/**
 * The menu a date starts as when nothing is stored for it: the same weekday a
 * week earlier; else the newest earlier menu of that weekday; else the
 * pattern's own lines for that weekday, the way the week plan was built.
 */
export function startingMenu(date: ISODate, menus: DayMenu[], routine: Routine, foods: FoodItem[]): DayMenu {
  const wd = weekdayOf(date);
  const source =
    menuFor(addDays(date, -7), menus) ??
    menus.filter((m) => m.date < date && weekdayOf(m.date) === wd).sort((a, b) => b.date.localeCompare(a.date))[0] ??
    null;
  return { date, meals: source ? copyMeals(source.meals) : planDayFor(routine, wd, foods).meals, editedAt: NOT_EDITED };
}

/** The seven menus of the week starting on `monday`, Monday first: a stored one as it is, a missing one as it starts. Never overwrites a stored date. */
export function ensureWeek(monday: ISODate, menus: DayMenu[], routine: Routine, foods: FoodItem[]): DayMenu[] {
  return weekDates(monday).map((date) => menuFor(date, menus) ?? startingMenu(date, menus, routine, foods));
}

/**
 * A date's meals reshaped to the current slots, the way alignWeekPlan
 * reshapes the plan. Only today and later dates follow the slots; a past date
 * is history and keeps the meals it had. The same object comes back when
 * nothing moves. The stamp is kept: following the slots is not an edit, and
 * every device reshapes the same way.
 */
export function alignMenu(menu: DayMenu, routine: Routine, today: ISODate, foods?: FoodItem[]): DayMenu {
  if (menu.date < today) return menu;
  const meals = alignDay({ meals: menu.meals }, routine, weekdayOf(menu.date), foods).meals;
  return stable(meals) === stable(menu.meals) ? menu : { ...menu, meals };
}

/** Every stored menu from today on, following the slots. The same list when none moved. */
export function alignMenus(menus: DayMenu[], routine: Routine, today: ISODate, foods?: FoodItem[]): DayMenu[] {
  let changed = false;
  const out = menus.map((m) => {
    const next = alignMenu(m, routine, today, foods);
    if (next !== m) changed = true;
    return next;
  });
  return changed ? out : menus;
}

/** The menu a date shows: the stored one or the one it starts as, following the slots from today on. */
export function viewMenu(date: ISODate, menus: DayMenu[], routine: Routine, today: ISODate, foods: FoodItem[]): DayMenu {
  return alignMenu(menuFor(date, menus) ?? startingMenu(date, menus, routine, foods), routine, today, foods);
}

/** The week starting on `monday` as it shows, Monday first. */
export function viewWeek(monday: ISODate, menus: DayMenu[], routine: Routine, today: ISODate, foods: FoodItem[]): DayMenu[] {
  return ensureWeek(monday, menus, routine, foods).map((m) => alignMenu(m, routine, today, foods));
}

/** Write one date's meals, stamped now. `day` is that date's menu as it was shown, stored or not; every other date is left as it is. */
export function setMenuDay(menus: DayMenu[], day: DayMenu, meals: PlanMeal[], now: Date): DayMenu[] {
  const next: DayMenu = { date: day.date, meals, editedAt: now.toISOString() };
  return menus.some((m) => m.date === day.date) ? menus.map((m) => (m.date === day.date ? next : m)) : [...menus, next];
}

/** Change one line of one meal on one date. Null or a quantity of 0 removes the line. */
export function setMenuLine(menus: DayMenu[], day: DayMenu, mealId: string, lineIdx: number, next: PlanLine | null, now: Date): DayMenu[] {
  const meals = day.meals.map((m) => {
    if (m.id !== mealId) return m;
    const lines = m.lines.map((l, j) => (j === lineIdx ? next : l)).filter((l): l is PlanLine => !!l && l.qty > 0);
    return { ...m, lines };
  });
  return setMenuDay(menus, day, meals, now);
}

/** Add a food to one meal on one date. The same food in the same measure again is a bigger portion, not a second line. */
export function addMenuLine(menus: DayMenu[], day: DayMenu, mealId: string, line: PlanLine, now: Date): DayMenu[] {
  const meals = day.meals.map((m) => {
    if (m.id !== mealId) return m;
    const same = m.lines.findIndex((l) => l.foodId === line.foodId && l.unit === line.unit);
    const lines = same >= 0 ? m.lines.map((l, j) => (j === same ? { ...l, qty: l.qty + line.qty } : l)) : [...m.lines, line];
    return { ...m, lines };
  });
  return setMenuDay(menus, day, meals, now);
}

/** Replace one meal of one date, matched by its slot id. */
export function setMenuMeal(menus: DayMenu[], day: DayMenu, meal: PlanMeal, now: Date): DayMenu[] {
  return setMenuDay(menus, day, day.meals.map((m) => (m.id === meal.id ? meal : m)), now);
}

/** Copy one date's meals onto another date. The copy is its own, so editing one never edits the other. */
export function copyDay(from: DayMenu, to: ISODate, menus: DayMenu[], now: Date): DayMenu[] {
  const target = menuFor(to, menus) ?? { date: to, meals: [], editedAt: NOT_EDITED };
  return setMenuDay(menus, target, copyMeals(from.meals), now);
}
```

- [ ] **Step 6: Give the state its menus**

In `src/core/types.ts`, inside `AppState` after the `groceryTicks` field, add:

```ts
  /** The menu of each date that was written: edited, or carried over from the old week plan. Other dates show as they start (see core/menu.ts). */
  menus: import('./menu').DayMenu[];
```

In `src/store/defaults.ts`, in `EMPTY_STATE` after `groceryTicks: null,` add:

```ts
  menus: [],
```

`migrateState` spreads `EMPTY_STATE` under the stored blob, so an older store loads with `menus: []`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/core/__tests__/menu.test.ts src/core/__tests__/date.test.ts src/core/__tests__/weekPlan.test.ts`
Expected: PASS (`weekPlan.test.ts` unchanged: `buildWeekPlan` and `alignWeekPlan` give the same results).

- [ ] **Step 8: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean.

- [ ] **Step 9: Commit**

```bash
git add src/core/date.ts src/core/weekPlan.ts src/core/menu.ts src/core/types.ts src/store/defaults.ts src/core/__tests__/menu.test.ts src/core/__tests__/date.test.ts
git commit -m "$(cat <<'EOF'
Menus are kept per date: a date nobody wrote starts as the same weekday a week earlier, else the newest one before it, else the pattern; an edit changes only its own date, and from today on a menu follows the slots while past days stay as they were

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Skips that last

**Files:**
- Modify: `src/core/types.ts` (new `SlotSkip`; `AppState.slotSkips`), `src/store/defaults.ts`
- Modify: `src/core/menu.ts` (append the skip helpers)
- Modify: `src/core/pattern.ts` (import line 2; `slotStates` lines 91-120; `withSlot` lines 151-167)
- Modify: `src/store/AppProvider.tsx` (imports, `Ctx`, a new `withMeal`, the value: lines 235-237, 265-272, 339-345)
- Modify: `src/components/RoutineCard.tsx` (import line 14, lines 89-92, 205, 220), `src/services/useWorkSchedule.ts` (lines 5, 74, 77), `src/services/useScheduledReminders.ts` (lines 100, 105), `src/app/(tabs)/coach.tsx` (line 151), `src/app/(tabs)/log.tsx` (lines 80-81), `src/components/useCoach.ts` (lines 13, 22, 55), `src/components/FitsCard.tsx` (lines 42, 45)
- Test: `src/core/__tests__/menu.test.ts`, `src/core/__tests__/pattern.test.ts`

**Interfaces:**
- Consumes: `DayMenu` (Task 2).
- Produces:
  - `type SlotSkip = { id: string; date: ISODate; slotId: string }`; `AppState.slotSkips: SlotSkip[]`.
  - `menu.ts`: `skipId(date, slotId): string`, `addSkip(skips: SlotSkip[], date: ISODate, slotId: string): SlotSkip[]`, `removeSkip(skips, date, slotId): SlotSkip[]`, `skippedOn(skips, date): string[]`.
  - `pattern.ts`: `slotStates` and `withSlot` take `skippedSlots: string[]` (slot ids skipped on the day being looked at) instead of `skipped` (done-keys).
  - `AppProvider` `Ctx`: `skippedToday: string[]`, `skipSlot(date: ISODate, slotId: string): void`, `unskipSlot(date: ISODate, slotId: string): void`; a module-level `withMeal(s: AppState, m: Meal, target: number, now: Date): AppState` that every added meal goes through.

The field is renamed rather than reused so the compiler finds every caller still passing done-keys.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/menu.test.ts`, replace the `../menu` import line with:

```ts
import { addMenuLine, addSkip, alignMenu, alignMenus, copyDay, ensureWeek, menuFor, NOT_EDITED, removeSkip, setMenuLine, setMenuMeal, skippedOn, viewMenu, viewWeek, type DayMenu } from '../menu';
```

and append:

```ts
describe('skips', () => {
  it('records one skip per date and slot, with the same id on every device', () => {
    const once = addSkip([], '2026-10-27', 'lunch');
    expect(once).toEqual([{ id: '2026-10-27:lunch', date: '2026-10-27', slotId: 'lunch' }]);
    expect(addSkip(once, '2026-10-27', 'lunch')).toBe(once);
  });

  it('a skip on a past date lasts, and only that date reads it', () => {
    const skips = addSkip(addSkip([], '2026-10-20', 'dinner'), '2026-10-27', 'lunch');
    expect(skippedOn(skips, '2026-10-20')).toEqual(['dinner']);
    expect(skippedOn(skips, '2026-10-27')).toEqual(['lunch']);
    expect(skippedOn(skips, '2026-10-21')).toEqual([]);
  });

  it('clears a skip, and leaves the list alone when there was none', () => {
    const skips = addSkip([], '2026-10-27', 'lunch');
    expect(removeSkip(skips, '2026-10-27', 'lunch')).toEqual([]);
    expect(removeSkip(skips, '2026-10-27', 'dinner')).toBe(skips);
  });
});
```

In `src/core/__tests__/pattern.test.ts`, the input now names skipped slots by id, not by done-key. Run:

```bash
sed -i '' -e "s/skipped: \[/skippedSlots: [/g" -e "s/'skip_morning'/'morning'/g" src/core/__tests__/pattern.test.ts
```

then replace the `at14` helper (line 93):

```ts
  const at14 = (meals: Meal[], skipped: string[] = []) => slotStates({ routine, target: 1600, meals, nowMinutes: 14 * 60, skipped });
```

with:

```ts
  const at14 = (meals: Meal[], skippedSlots: string[] = []) => slotStates({ routine, target: 1600, meals, nowMinutes: 14 * 60, skippedSlots });
```

`grep -n "skipped:" src/core/__tests__/pattern.test.ts` must then print nothing.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/menu.test.ts src/core/__tests__/pattern.test.ts`
Expected: FAIL. `menu.test.ts`: "addSkip is not a function". `pattern.test.ts`: "shows skipped, missed and later" gets `['missed', 'missed', 'later']` (and the `currentSlot` skip case fails), because `slotStates` still reads `input.skipped`.

- [ ] **Step 3: The type and the empty list**

In `src/core/types.ts`, after the `NudgeLog` type, add:

```ts
/** A slot not eaten on purpose on one date. One per date and slot. */
export type SlotSkip = { id: string; date: ISODate; slotId: string };
```

and in `AppState`, after the `actionsDone` field, add:

```ts
  /** Slots skipped on purpose, by date. A meal later logged in the slot takes its skip away. */
  slotSkips: SlotSkip[];
```

In `src/store/defaults.ts`, in `EMPTY_STATE` after `actionsDone: [],` add `  slotSkips: [],`.

- [ ] **Step 4: The skip helpers in `src/core/menu.ts`**

Change the types import to:

```ts
import type { FoodItem, ISODate, SlotSkip } from './types';
```

and append:

```ts
/** One skip per date and slot, with an id every device gives it, so two devices skipping the same meal merge into one record. */
export function skipId(date: ISODate, slotId: string): string {
  return `${date}:${slotId}`;
}

/** Record that a slot was not eaten on a date. The same list when it is already recorded. */
export function addSkip(skips: SlotSkip[], date: ISODate, slotId: string): SlotSkip[] {
  if (skips.some((s) => s.date === date && s.slotId === slotId)) return skips;
  return [...skips, { id: skipId(date, slotId), date, slotId }];
}

/** Take a skip away: "Ate this" or "Ate other" on a skipped slot. The same list when there was none. */
export function removeSkip(skips: SlotSkip[], date: ISODate, slotId: string): SlotSkip[] {
  const has = skips.some((s) => s.date === date && s.slotId === slotId);
  return has ? skips.filter((s) => !(s.date === date && s.slotId === slotId)) : skips;
}

/** The slot ids skipped on one date. */
export function skippedOn(skips: SlotSkip[], date: ISODate): string[] {
  return skips.filter((s) => s.date === date).map((s) => s.slotId);
}
```

- [ ] **Step 5: `src/core/pattern.ts` reads skips by slot id**

Replace line 2 with:

```ts
import { SLOT_EARLY_MIN, slotMinutes, slotStatus, type Routine, type RoutineSlot, type SlotStatus } from './routine';
```

In `slotStates`, replace the input field

```ts
  /** Today's done-keys; a slot whose skip key is here was skipped on purpose. */
  skipped: string[];
```

with

```ts
  /** Slot ids skipped on purpose on the day being looked at. */
  skippedSlots: string[];
```

and in its body replace `input.skipped.includes(skipKey(p.slot))` with `input.skippedSlots.includes(p.id)`.

In `withSlot`, change the doc comment's "`meals` and `skipped` are today's" to "`meals` and `skippedSlots` are today's", the parameter type `skipped: string[]` to `skippedSlots: string[]`, and the inner call's `skipped: input.skipped` to `skippedSlots: input.skippedSlots`.

- [ ] **Step 6: The store**

In `src/store/AppProvider.tsx`:

After `import { slotStates, withSlot } from '../core/pattern';` add:

```ts
import { addSkip, removeSkip, skippedOn } from '../core/menu';
```

In `Ctx`, after `  toggleAction: (key: string) => void;` add:

```ts
  /** Slot ids skipped today. */
  skippedToday: string[];
  /** Record that a slot was not eaten on a date; a meal later logged in it takes the skip away. */
  skipSlot: (date: ISODate, slotId: string) => void;
  unskipSlot: (date: ISODate, slotId: string) => void;
```

Before `export function AppProvider(` add:

```ts
/**
 * Every meal goes into the state this way: into the slot it is eaten in when
 * it names none (a photo, a recipe, the coach), and a slot that gets a meal on
 * a date is no longer marked skipped that date.
 */
function withMeal(s: AppState, m: Meal, target: number, now: Date): AppState {
  const today = toISODate(now);
  const meal = s.routine.enabled
    ? withSlot(m, { routine: s.routine, target, meals: s.meals.filter((x) => x.date === today), skippedSlots: skippedOn(s.slotSkips, today), now })
    : m;
  const slotSkips = meal.slotId ? removeSkip(s.slotSkips, meal.date, meal.slotId) : s.slotSkips;
  return { ...s, meals: [...s.meals, meal], slotSkips };
}
```

In the value, replace

```ts
    const actionsDoneToday = state.actionsDone.filter((a) => a.date === today).map((a) => a.key);
    // With the pattern on, the meals left are its slots still to eat, not the fixed windows; a pattern with no slots falls back to the windows.
    const patternStates = state.routine.enabled ? slotStates({ routine: state.routine, target: targets.kcal, meals: todayMeals, nowMinutes: hour * 60, skipped: actionsDoneToday }) : [];
```

with

```ts
    const actionsDoneToday = state.actionsDone.filter((a) => a.date === today).map((a) => a.key);
    const skippedToday = skippedOn(state.slotSkips, today);
    // With the pattern on, the meals left are its slots still to eat, not the fixed windows; a pattern with no slots falls back to the windows.
    const patternStates = state.routine.enabled ? slotStates({ routine: state.routine, target: targets.kcal, meals: todayMeals, nowMinutes: hour * 60, skippedSlots: skippedToday }) : [];
```

Replace the whole `addMeal: (m) => update((s) => { ... }),` entry (seven lines starting `      addMeal: (m) =>`) with:

```ts
      addMeal: (m) => update((s) => withMeal(s, m, targets.kcal, new Date())),
```

After the `toggleAction: (key) => update(...)` entry, add:

```ts
      skippedToday,
      skipSlot: (date, slotId) =>
        update((s) => {
          const slotSkips = addSkip(s.slotSkips, date, slotId);
          return slotSkips === s.slotSkips ? s : { ...s, slotSkips };
        }),
      unskipSlot: (date, slotId) =>
        update((s) => {
          const slotSkips = removeSkip(s.slotSkips, date, slotId);
          return slotSkips === s.slotSkips ? s : { ...s, slotSkips };
        }),
```

- [ ] **Step 7: The screens that read skips**

`src/components/RoutineCard.tsx`: delete the line `  skipKey,` from the `../core/routine` import. Replace

```ts
    () => slotStates({ routine, target: targets.kcal, meals: todayMeals, nowMinutes: minute, skipped: app.actionsDoneToday, planned }),
    [routine, targets.kcal, todayMeals, minute, app.actionsDoneToday, planned],
```

with

```ts
    () => slotStates({ routine, target: targets.kcal, meals: todayMeals, nowMinutes: minute, skippedSlots: app.skippedToday, planned }),
    [routine, targets.kcal, todayMeals, minute, app.skippedToday, planned],
```

Replace `<Pressable onPress={() => app.toggleAction(skipKey(slot))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('undo')}>` with `<Pressable onPress={() => app.unskipSlot(today, slot.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('undo')}>`, and `<Pressable onPress={() => app.toggleAction(skipKey(slot))} hitSlop={6} accessibilityRole="button">` with `<Pressable onPress={() => app.skipSlot(today, slot.id)} hitSlop={6} accessibilityRole="button">`.

`src/services/useWorkSchedule.ts`: replace line 5 with `import { slotLabel, slotsDueBetween } from '../core/routine';`; in the slot prompt block replace `skipped: app.actionsDoneToday })` with `skippedSlots: app.skippedToday })` and `|| app.actionsDoneToday.includes(skipKey(s))) continue;` with `|| app.skippedToday.includes(s.id)) continue;`.

`src/services/useScheduledReminders.ts`: replace `skipped: app.actionsDoneToday })` with `skippedSlots: app.skippedToday })` and, in that memo's dependency list, `app.actionsDoneToday]` with `app.skippedToday]`.

`src/app/(tabs)/coach.tsx`: replace `skipped: app.actionsDoneToday })` with `skippedSlots: app.skippedToday })`.

`src/app/(tabs)/log.tsx`: add `import { skippedOn } from '../../core/menu';` after the `../../core/foods` import, and replace

```ts
    () => (patternOn ? slotStates({ routine: app.state.routine, target: app.targets.kcal, meals: dayMeals, nowMinutes: isToday ? minute : 1440, skipped: isToday ? app.actionsDoneToday : [] }) : []),
    [patternOn, app.state.routine, app.targets.kcal, dayMeals, isToday, minute, app.actionsDoneToday],
```

with (a past day now shows its own skips):

```ts
    () => (patternOn ? slotStates({ routine: app.state.routine, target: app.targets.kcal, meals: dayMeals, nowMinutes: isToday ? minute : 1440, skippedSlots: skippedOn(app.state.slotSkips, viewDate) }) : []),
    [patternOn, app.state.routine, app.targets.kcal, dayMeals, isToday, minute, app.state.slotSkips, viewDate],
```

`src/components/useCoach.ts`: in the destructuring line replace `actionsDoneToday` with `skippedToday`; replace `skipped: actionsDoneToday })` with `skippedSlots: skippedToday })`; in the dependency list replace `actionsDoneToday,` with `skippedToday,`.

`src/components/FitsCard.tsx`: replace `skipped: app.actionsDoneToday })` with `skippedSlots: app.skippedToday })`, and in that memo's dependency list `app.actionsDoneToday]` with `app.skippedToday]`.

Then `grep -rn "skipped: app\.\|skipped: actionsDone\|skipped: input\|skipKey(slot)\|skipKey(s)\|skipKey(p\.slot)" src` must print nothing.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/core/__tests__/menu.test.ts src/core/__tests__/pattern.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean.

- [ ] **Step 10: Commit**

```bash
git add src/core/types.ts src/store/defaults.ts src/core/menu.ts src/core/pattern.ts src/store/AppProvider.tsx src/components/RoutineCard.tsx src/services/useWorkSchedule.ts src/services/useScheduledReminders.ts "src/app/(tabs)/coach.tsx" "src/app/(tabs)/log.tsx" src/components/useCoach.ts src/components/FitsCard.tsx src/core/__tests__/menu.test.ts src/core/__tests__/pattern.test.ts
git commit -m "$(cat <<'EOF'
A skipped meal is its own record with its date, so a past day can say it skipped dinner; the slots read the skips of the day being looked at, and eating in a skipped slot takes the skip away

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Meals from the plan, auto-fill, confirming and saved meals

**Files:**
- Modify: `src/core/types.ts` (`MealSource`, `Meal.source`, `SavedMeal`, `AppState.savedMeals`; `routine` type import line 4), `src/store/defaults.ts`
- Modify: `src/core/pattern.ts` (`nearestTo` line 60, `slotOf` lines 64-76)
- Modify: `src/core/menu.ts` (imports; append)
- Test: `src/core/__tests__/menu.test.ts`

**Interfaces:**
- Consumes: `lineInfo` (`weekPlan.ts`), `toMealItem` (`foods.ts`), `isOffDay` (`week.ts`), `toISODate`, `addDays` (`date.ts`), `DayMenu`, `addSkip`, `skippedOn` (Tasks 2, 3).
- Produces:
  - `types.ts`: `type MealSource = 'manual' | 'plan' | 'auto'`, `Meal.source?: MealSource`, `type SavedMeal = { id: string; name: string; lines: PlanLine[] }`, `AppState.savedMeals: SavedMeal[]`.
  - `pattern.ts`: `type SlotPoint = { id: string; type: MealType; minutes: number }`; `slotOf<S extends SlotPoint>(meal: Pick<Meal, 'slotId' | 'type' | 'at'>, slots: S[]): S | null`.
  - `menu.ts`: `menuSlots(menu: DayMenu): (SlotPoint & { meal: PlanMeal })[]`, `eatenSlotIds(menu: DayMenu, meals: Meal[]): Set<string>`, `mealFromLines(input: { id: string; date: ISODate; slot: Pick<PlanMeal, 'id' | 'type' | 'time'>; lines: PlanLine[]; foods: FoodItem[]; source: MealSource; now: Date }): Meal | null`, `AUTO_FILL_AFTER_MIN = 90`, `autoMealId(date, slotId): string`, `autoFill(input: { date: ISODate; now: Date; menu: DayMenu | null; meals: Meal[]; skips: SlotSkip[]; openedDates: ISODate[]; offDays: number[]; foods: FoodItem[] }): Meal[]`, `fillFromPlan(input: { now: Date; menu: DayMenu; meals: Meal[]; skips: SlotSkip[]; foods: FoodItem[] }): Meal[]`, `withMealConfirmed(meals: Meal[], id: string): Meal[]`, `withDayConfirmed(meals: Meal[], date: ISODate): Meal[]`, `skipsAfterRemove(skips: SlotSkip[], removed: Meal, rest: Meal[]): SlotSkip[]`, `withSavedMeal(list: SavedMeal[], meal: SavedMeal): SavedMeal[]`, `withoutSavedMeal(list: SavedMeal[], id: string): SavedMeal[]`.

Adjustments to the spec, from the code: `autoFill` also takes `offDays` (it never fills an off day) and `foods` (calories come from the database). "Custom foods keep `estimated: true`": database foods also carry `source: 'estimate'` in `foods.json` (for example `poha`), so a made-up food is recognised by its `custom` tag, which `CustomFoodForm` sets. One rule the spec did not state is added, because without it an auto-filled meal could never be deleted (it would be filled straight back within a minute): deleting a meal that came from the plan (`auto` or `plan`) and leaves its slot empty that date marks the slot skipped (`skipsAfterRemove`).

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/menu.test.ts`, replace the import block (the lines from `import foodsJson` through the `../weekPlan` import) with:

```ts
import foodsJson from '../../data/foods.json';
import {
  addMenuLine,
  addSkip,
  alignMenu,
  alignMenus,
  autoFill,
  copyDay,
  ensureWeek,
  fillFromPlan,
  mealFromLines,
  menuFor,
  NOT_EDITED,
  removeSkip,
  setMenuLine,
  setMenuMeal,
  skippedOn,
  skipsAfterRemove,
  viewMenu,
  viewWeek,
  withDayConfirmed,
  withMealConfirmed,
  withoutSavedMeal,
  withSavedMeal,
  type DayMenu,
} from '../menu';
import { kcalForGrams } from '../nutrition';
import { DEFAULT_ROUTINE, type PlanLine, type Routine, type RoutineSlot } from '../routine';
import type { FoodItem, Meal, SlotSkip } from '../types';
import { lineInfo, planDayFor, type PlanMeal } from '../weekPlan';
```

and append:

```ts
describe('meals from the plan', () => {
  const lunch: PlanMeal = { id: 'lunch', type: 'lunch', time: '13:00', lines: [chapati(2)] };

  it('"Ate as planned" on a past date logs to that date and slot, with the database calories', () => {
    const m = mealFromLines({ id: 'x', date: '2026-10-20', slot: lunch, lines: lunch.lines, foods, source: 'plan', now: NOW })!;
    const info = lineInfo(chapati(2), foods)!;
    expect(m).toMatchObject({ date: '2026-10-20', slotId: 'lunch', type: 'lunch', source: 'plan' });
    expect(m.at).toBe(new Date('2026-10-20T13:00:00').toISOString());
    expect(m.items[0]).toMatchObject({ foodId: 'chapati', grams: info.grams, kcal: kcalForGrams(info.food, info.grams).kcal, estimated: false });
    expect(m.kcal).toBe(m.items[0].kcal);
  });

  it('a slot whose time has not come is logged now; a made-up food stays estimated; no known food, no meal', () => {
    expect(mealFromLines({ id: 'x', date: '2026-10-27', slot: lunch, lines: lunch.lines, foods, source: 'plan', now: NOW })!.at).toBe(NOW.toISOString());
    const mine: FoodItem = { ...foods.find((f) => f.id === 'poha')!, id: 'my-poha', tags: ['custom'] };
    const custom = mealFromLines({ id: 'x', date: '2026-10-20', slot: lunch, lines: [{ foodId: 'my-poha', unit: 'katori', qty: 1 }], foods: [...foods, mine], source: 'plan', now: NOW })!;
    expect(custom.items[0].estimated).toBe(true);
    expect(mealFromLines({ id: 'x', date: '2026-10-20', slot: lunch, lines: [{ foodId: 'nope', unit: 'piece', qty: 1 }], foods, source: 'plan', now: NOW })).toBeNull();
  });

  it('"Fill this day from plan" logs every open slot of an older day as planned', () => {
    const old: DayMenu = { ...menu('2026-10-20', 2), meals: [...menu('2026-10-20', 2).meals.slice(0, 2), { id: 'dinner', type: 'dinner', time: '20:00', lines: [chapati(1)] }] };
    const out = fillFromPlan({ now: NOW, menu: old, meals: [], skips: addSkip([], '2026-10-20', 'dinner'), foods });
    expect(out.map((m) => [m.slotId, m.source])).toEqual([['lunch', 'plan']]);
  });
});

describe('autoFill', () => {
  const today = '2026-10-27';
  const at = (hhmm: string, date = today) => new Date(`${date}T${hhmm}:00`);
  const base = { date: today, menu: menu(today, 2), meals: [] as Meal[], skips: [] as SlotSkip[], openedDates: [] as string[], offDays: [] as number[], foods };

  it('fills a slot 90 minutes after its time, and not a minute before', () => {
    expect(autoFill({ ...base, now: at('14:29') })).toEqual([]);
    const out = autoFill({ ...base, now: at('14:30') });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'auto-2026-10-27-lunch', slotId: 'lunch', source: 'auto', date: today });
    expect(out[0].at).toBe(at('13:00').toISOString());
  });

  it('never fills an off day, a skipped slot, a slot with any meal in it, or a slot with nothing planned', () => {
    const late = at('22:00');
    // 27 October 2026 is a Tuesday.
    expect(autoFill({ ...base, now: late, offDays: [2] })).toEqual([]);
    expect(autoFill({ ...base, now: late, skips: addSkip([], today, 'lunch') })).toEqual([]);
    const ate: Meal = { id: 'm', at: at('13:20').toISOString(), date: today, type: 'lunch', items: [], kcal: 400, protein: 10 };
    expect(autoFill({ ...base, now: late, meals: [ate] })).toEqual([]);
    expect(autoFill({ ...base, now: late }).map((m) => m.slotId)).toEqual(['lunch']);
  });

  it('fills yesterday only when the app was open yesterday, and never an older day', () => {
    const yesterday = { ...base, date: '2026-10-26', menu: menu('2026-10-26', 2), now: at('09:00') };
    expect(autoFill(yesterday)).toEqual([]);
    expect(autoFill({ ...yesterday, openedDates: ['2026-10-26'] })).toHaveLength(1);
    expect(autoFill({ ...base, date: '2026-10-25', menu: menu('2026-10-25', 2), now: at('09:00'), openedDates: ['2026-10-25'] })).toEqual([]);
  });
});

describe('confirming and taking away', () => {
  const auto = (id: string, date: string, slotId: string): Meal => ({ id, at: `${date}T07:30:00.000Z`, date, type: 'lunch', slotId, items: [], kcal: 300, protein: 10, source: 'auto' });

  it('"Day looks right" turns every filled-in meal of that day into a planned one, and only that day', () => {
    const out = withDayConfirmed([auto('a', '2026-10-27', 'lunch'), auto('b', '2026-10-27', 'dinner'), auto('c', '2026-10-26', 'lunch')], '2026-10-27');
    expect(out.map((m) => m.source)).toEqual(['plan', 'plan', 'auto']);
    expect(withDayConfirmed(out, '2026-10-27')).toBe(out);
  });

  it('tapping one filled-in meal confirms that one', () => {
    expect(withMealConfirmed([auto('a', '2026-10-27', 'lunch'), auto('b', '2026-10-27', 'dinner')], 'b').map((m) => m.source)).toEqual(['auto', 'plan']);
  });

  it('deleting a meal from the plan marks its slot skipped so it is not filled again; a hand-typed one does not', () => {
    const gone = auto('a', '2026-10-27', 'lunch');
    expect(skipsAfterRemove([], gone, [])).toEqual([{ id: '2026-10-27:lunch', date: '2026-10-27', slotId: 'lunch' }]);
    expect(skipsAfterRemove([], { ...gone, source: undefined }, [])).toEqual([]);
    const other: Meal = { ...auto('b', '2026-10-27', 'lunch'), source: 'manual' };
    expect(skipsAfterRemove([], gone, [other])).toEqual([]);
  });
});

describe('saved meals', () => {
  const thali = { id: 's1', name: ' My usual thali ', lines: [chapati(2), { foodId: 'moong-dal', unit: 'katori', qty: 1 }] };

  it('saves under a trimmed name, replaces by id, refuses an empty one, and removes', () => {
    const list = withSavedMeal([], thali);
    expect(list).toEqual([{ ...thali, name: 'My usual thali' }]);
    expect(withSavedMeal(list, { ...thali, name: 'Thali' })).toEqual([{ ...thali, name: 'Thali' }]);
    expect(withSavedMeal(list, { id: 's2', name: '  ', lines: [chapati(1)] })).toBe(list);
    expect(withSavedMeal(list, { id: 's2', name: 'Nothing', lines: [] })).toBe(list);
    expect(withoutSavedMeal(list, 's1')).toEqual([]);
  });

  it('logs the same way as "Ate as planned", with database calories', () => {
    const m = mealFromLines({ id: 'x', date: '2026-10-20', slot: { id: 'lunch', type: 'lunch', time: '13:00' }, lines: thali.lines, foods, source: 'manual', now: NOW })!;
    expect(m.items.map((i) => i.foodId)).toEqual(['chapati', 'moong-dal']);
    expect(m.kcal).toBe(m.items.reduce((a, i) => a + i.kcal, 0));
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/menu.test.ts`
Expected: FAIL: "mealFromLines is not a function" (and the other new names).

- [ ] **Step 3: Types**

In `src/core/types.ts`, change line 4 to:

```ts
import type { PlanLine, Routine, SpendLog } from './routine';
```

Before `export type Meal = {` add:

```ts
/** Where a meal came from: typed, searched, a photo or a barcode ('manual'); eaten as planned or confirmed ('plan'); filled in by the app from the plan and not confirmed yet ('auto'). */
export type MealSource = 'manual' | 'plan' | 'auto';

```

In `Meal`, after the `slotId` field, add:

```ts
  /** Missing means 'manual', for meals logged before there was a plan to log from. */
  source?: MealSource;
```

After the `SlotSkip` type add:

```ts
/** A meal the person logs often, saved under their own name ("my usual thali"). */
export type SavedMeal = { id: string; name: string; lines: PlanLine[] };
```

In `AppState`, after `slotSkips`, add:

```ts
  /** Meals saved to log again in one tap. */
  savedMeals: SavedMeal[];
```

In `src/store/defaults.ts`, in `EMPTY_STATE` after `slotSkips: [],` add `  savedMeals: [],`.

- [ ] **Step 4: `slotOf` matches a menu's slots too, in `src/core/pattern.ts`**

Replace the `nearestTo` function and the whole `slotOf` function (with its doc comment) with:

```ts
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
```

- [ ] **Step 5: The plan-to-meal functions in `src/core/menu.ts`**

Replace the import block at the top with:

```ts
import { addDays, toISODate, weekDates } from './date';
import { toMealItem } from './foods';
import { slotOf, type SlotPoint } from './pattern';
import { weekdayOf, type PlanLine, type Routine } from './routine';
import { stable } from './sync';
import type { FoodItem, ISODate, Meal, MealItem, MealSource, SavedMeal, SlotSkip } from './types';
import { isOffDay } from './week';
import { alignDay, lineInfo, planDayFor, type PlanMeal } from './weekPlan';
```

and append:

```ts
function minutesOf(hhmm: string | undefined): number {
  const [h, m] = (hhmm ?? '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** A clock time to build a date-time from; noon when a menu meal has none. */
function clockOf(hhmm: string | undefined): string {
  return hhmm && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm) ? hhmm : '12:00';
}

/** A date's slots as its menu has them, to match meals against. */
export function menuSlots(menu: DayMenu): (SlotPoint & { meal: PlanMeal })[] {
  return menu.meals.map((m) => ({ id: m.id, type: m.type, minutes: minutesOf(m.time), meal: m }));
}

/** The menu's slots that hold any meal on its date, matched the way the day's slots are. */
export function eatenSlotIds(menu: DayMenu, meals: Meal[]): Set<string> {
  const slots = menuSlots(menu);
  const out = new Set<string>();
  for (const m of meals) {
    if (m.date !== menu.date) continue;
    const s = slotOf(m, slots);
    if (s) out.add(s.id);
  }
  return out;
}

/**
 * A meal made from planned lines: one item per line, its grams from the
 * line's measure, its calories from the food database at those grams. A food
 * the person made up keeps its estimated mark. It is logged at the slot's
 * time on that date, or now when that time has not come yet. Null when no
 * line names a food that exists.
 */
export function mealFromLines(input: {
  id: string;
  date: ISODate;
  slot: Pick<PlanMeal, 'id' | 'type' | 'time'>;
  lines: PlanLine[];
  foods: FoodItem[];
  source: MealSource;
  now: Date;
}): Meal | null {
  const items: MealItem[] = [];
  for (const line of input.lines) {
    const info = lineInfo(line, input.foods);
    if (info && info.grams > 0) items.push(toMealItem(info.food, info.grams, info.food.tags.includes('custom')));
  }
  if (items.length === 0) return null;
  const planned = new Date(`${input.date}T${clockOf(input.slot.time)}:00`);
  const at = planned.getTime() > input.now.getTime() ? input.now : planned;
  return {
    id: input.id,
    at: at.toISOString(),
    date: input.date,
    type: input.slot.type,
    slotId: input.slot.id,
    items,
    kcal: items.reduce((a, i) => a + i.kcal, 0),
    protein: Math.round(items.reduce((a, i) => a + i.protein, 0)),
    source: input.source,
  };
}

/** Minutes after a slot's time before the app fills it in from the plan. */
export const AUTO_FILL_AFTER_MIN = 90;

/** The id of a meal the app filled in: the same on every device, so two devices filling one slot make one meal, not two. */
export function autoMealId(date: ISODate, slotId: string): string {
  return `auto-${date}-${slotId}`;
}

/** The open slots of a date's menu: something planned, nothing eaten, not skipped. */
function openSlots(menu: DayMenu, meals: Meal[], skips: SlotSkip[]): PlanMeal[] {
  const eaten = eatenSlotIds(menu, meals);
  const skipped = new Set(skippedOn(skips, menu.date));
  return menu.meals.filter((m) => m.lines.length > 0 && !eaten.has(m.id) && !skipped.has(m.id));
}

/**
 * The planned meals the app logs by itself: a slot of the date's menu with
 * nothing eaten in it and no skip gets its planned meal 90 minutes after the
 * slot's time, marked 'auto' until the person confirms it. Only today, and
 * yesterday when the app was open yesterday; never an off day. Returns the
 * meals to add.
 */
export function autoFill(input: {
  date: ISODate;
  now: Date;
  menu: DayMenu | null;
  meals: Meal[];
  skips: SlotSkip[];
  /** Dates the app was open on (the usage buckets). */
  openedDates: ISODate[];
  offDays: number[];
  foods: FoodItem[];
}): Meal[] {
  const { date, now, menu } = input;
  if (!menu || menu.date !== date) return [];
  const today = toISODate(now);
  const yesterdayOpened = date === addDays(today, -1) && input.openedDates.includes(date);
  if (date !== today && !yesterdayOpened) return [];
  if (isOffDay(input.offDays, date)) return [];
  const out: Meal[] = [];
  for (const slot of openSlots(menu, input.meals, input.skips)) {
    const due = new Date(`${date}T${clockOf(slot.time)}:00`).getTime() + AUTO_FILL_AFTER_MIN * 60000;
    if (now.getTime() < due) continue;
    const meal = mealFromLines({ id: autoMealId(date, slot.id), date, slot, lines: slot.lines, foods: input.foods, source: 'auto', now });
    if (meal) out.push(meal);
  }
  return out;
}

/** "Fill this day from plan": every open slot of an older day, the kind the app was never open on, logged as planned. */
export function fillFromPlan(input: { now: Date; menu: DayMenu; meals: Meal[]; skips: SlotSkip[]; foods: FoodItem[] }): Meal[] {
  const { menu } = input;
  const out: Meal[] = [];
  for (const slot of openSlots(menu, input.meals, input.skips)) {
    const meal = mealFromLines({ id: `plan-${menu.date}-${slot.id}`, date: menu.date, slot, lines: slot.lines, foods: input.foods, source: 'plan', now: input.now });
    if (meal) out.push(meal);
  }
  return out;
}

/** A meal the app filled in, confirmed by the person: it now reads as eaten as planned. */
export function withMealConfirmed(meals: Meal[], id: string): Meal[] {
  if (!meals.some((m) => m.id === id && m.source === 'auto')) return meals;
  return meals.map((m): Meal => (m.id === id ? { ...m, source: 'plan' } : m));
}

/** "Day looks right": every meal the app filled in on that date, confirmed at once. */
export function withDayConfirmed(meals: Meal[], date: ISODate): Meal[] {
  if (!meals.some((m) => m.date === date && m.source === 'auto')) return meals;
  return meals.map((m): Meal => (m.date === date && m.source === 'auto' ? { ...m, source: 'plan' } : m));
}

/**
 * The skips after a meal is taken away. A meal that came from the plan and
 * is deleted was not eaten that way: when nothing else is left in its slot
 * that date, the slot is marked skipped, so the app does not fill it straight
 * back in. A meal typed in by hand leaves the skips as they are.
 */
export function skipsAfterRemove(skips: SlotSkip[], removed: Meal, rest: Meal[]): SlotSkip[] {
  if ((removed.source !== 'auto' && removed.source !== 'plan') || !removed.slotId) return skips;
  if (rest.some((m) => m.date === removed.date && m.slotId === removed.slotId)) return skips;
  return addSkip(skips, removed.date, removed.slotId);
}

/** Add or replace a saved meal. One without a name or without a line is not saved. */
export function withSavedMeal(list: SavedMeal[], meal: SavedMeal): SavedMeal[] {
  const name = meal.name.trim();
  if (!name || meal.lines.length === 0) return list;
  return [...list.filter((m) => m.id !== meal.id), { ...meal, name }];
}

export function withoutSavedMeal(list: SavedMeal[], id: string): SavedMeal[] {
  return list.some((m) => m.id === id) ? list.filter((m) => m.id !== id) : list;
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/core/__tests__/menu.test.ts src/core/__tests__/pattern.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/store/defaults.ts src/core/pattern.ts src/core/menu.ts src/core/__tests__/menu.test.ts
git commit -m "$(cat <<'EOF'
Meals know where they came from: a planned meal is logged on its own date with database calories, a slot fills itself 90 minutes after its time today or on a yesterday the app was open, never on an off day, a skipped slot or one already eaten, and filled-in meals are confirmed one by one or a whole day at once; saved meals log the same way

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The record

**Files:**
- Create: `src/core/record.ts`
- Test: `src/core/__tests__/record.test.ts` (new)

**Interfaces:**
- Consumes: `menuSlots`, `skippedOn`, `DayMenu`, `addSkip` (Tasks 2-4), `slotOf`, `SlotPoint`, `pattern` (`pattern.ts`), `isOffDay` (`week.ts`), `addDays`, `weekDates` (`date.ts`).
- Produces: `type DayRecordState = 'full' | 'partial' | 'empty' | 'planned' | 'off'`; `type DayRecord = { state: DayRecordState; fromPlan: boolean }`; `dayRecord(input: { date: ISODate; today: ISODate; menu: DayMenu | null; routine: Routine; meals: Meal[]; skips: SlotSkip[]; offDays: number[] }): DayRecord`; `weekRecord(input: { monday: ISODate; today; menuOn: (date: ISODate) => DayMenu | null; routine; meals; skips; offDays }): DayRecord[]`; `recordStreak(input: { today; menuOn; routine; meals; skips; offDays; limit?: number }): number`.

Adjustments to the spec, from the code: `dayRecord` returns `{ state, fromPlan }` as the spec's prose says (its sketch shows only the state). It takes `routine` too, for a date with no menu at all, where every slot of the pattern must be settled. A slot of the date's menu with nothing planned (a snack slot with no fixed items) does not count against the day; a meal eaten in it still counts toward "something logged". `weekRecord` and `recordStreak` take `menuOn(date)` rather than the stored list, because a date that was never edited shows its starting menu (`viewMenu`), and the record must judge the menu the person saw. An off day neither breaks the streak nor adds to it; the streak looks back at most 60 days, as the old one did.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/record.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addSkip, type DayMenu } from '../menu';
import { dayRecord, recordStreak, weekRecord } from '../record';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { Meal } from '../types';

const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '20:00', 35)] };
const line = { foodId: 'chapati', unit: 'piece', qty: 2 };
/** Breakfast, lunch and dinner planned; a tea slot with nothing planned. */
const menu = (date: string): DayMenu => ({
  date,
  editedAt: '',
  meals: [
    { id: 'morning', type: 'breakfast', time: '08:30', lines: [line] },
    { id: 'lunch', type: 'lunch', time: '13:00', lines: [line] },
    { id: 'tea', type: 'snack', time: '16:00', lines: [] },
    { id: 'dinner', type: 'dinner', time: '20:00', lines: [line] },
  ],
});
const meal = (date: string, slotId: string, source?: Meal['source']): Meal => ({ id: `${date}-${slotId}`, at: new Date(`${date}T12:00:00`).toISOString(), date, type: 'lunch', slotId, items: [], kcal: 400, protein: 10, source });
const fullDay = (date: string) => [meal(date, 'morning'), meal(date, 'lunch'), meal(date, 'dinner')];
// 27 October 2026 is a Tuesday.
const TODAY = '2026-10-27';
const base = { today: TODAY, routine, skips: [], offDays: [] as number[] };
const rec = (date: string, meals: Meal[], extra: Partial<Parameters<typeof dayRecord>[0]> = {}) => dayRecord({ ...base, date, menu: menu(date), meals, ...extra });

describe('dayRecord', () => {
  it('is full when every planned meal was eaten or skipped; a slot with nothing planned does not count', () => {
    const d = '2026-10-26';
    expect(rec(d, [meal(d, 'morning'), meal(d, 'lunch')], { skips: addSkip([], d, 'dinner') })).toEqual({ state: 'full', fromPlan: false });
  });

  it('is partial with some, empty with none, and partial when only an unplanned slot was eaten', () => {
    const d = '2026-10-26';
    expect(rec(d, [meal(d, 'lunch')]).state).toBe('partial');
    expect(rec(d, []).state).toBe('empty');
    expect(rec(d, [meal(d, 'tea')]).state).toBe('partial');
  });

  it('counts today too: partial until its last slot is settled', () => {
    expect(rec(TODAY, [meal(TODAY, 'morning'), meal(TODAY, 'lunch')]).state).toBe('partial');
    expect(rec(TODAY, fullDay(TODAY)).state).toBe('full');
  });

  it('a date after today is planned, and an off day is off', () => {
    expect(rec('2026-10-28', []).state).toBe('planned');
    // 25 October 2026 is a Sunday.
    expect(rec('2026-10-25', [], { offDays: [0] }).state).toBe('off');
  });

  it('marks a day while any meal of it is still filled in from the plan', () => {
    const d = '2026-10-26';
    expect(rec(d, [meal(d, 'morning', 'auto'), meal(d, 'lunch', 'plan'), meal(d, 'dinner')])).toEqual({ state: 'full', fromPlan: true });
    expect(rec(d, [meal(d, 'morning', 'plan'), meal(d, 'lunch', 'plan'), meal(d, 'dinner', 'plan')]).fromPlan).toBe(false);
  });

  it('judges a date with no menu against every slot of the pattern', () => {
    const d = '2026-10-20';
    expect(dayRecord({ ...base, date: d, menu: null, meals: [meal(d, 'morning'), meal(d, 'lunch')] }).state).toBe('partial');
    expect(dayRecord({ ...base, date: d, menu: null, meals: fullDay(d) }).state).toBe('full');
  });
});

describe('weekRecord', () => {
  it('gives the seven days from Monday for the week strip', () => {
    const out = weekRecord({ ...base, monday: '2026-10-26', menuOn: menu, meals: fullDay('2026-10-26') });
    expect(out.map((r) => r.state)).toEqual(['full', 'empty', 'planned', 'planned', 'planned', 'planned', 'planned']);
  });
});

describe('recordStreak', () => {
  const streakOf = (meals: Meal[], offDays: number[] = []) => recordStreak({ ...base, offDays, menuOn: menu, meals });

  it('does not drop to 0 in the morning: a today with nothing yet keeps yesterday\'s streak', () => {
    expect(streakOf([...fullDay('2026-10-24'), ...fullDay('2026-10-25'), ...fullDay('2026-10-26')])).toBe(3);
  });

  it('counts today once it is full', () => {
    expect(streakOf([...fullDay('2026-10-24'), ...fullDay('2026-10-25'), ...fullDay('2026-10-26'), ...fullDay(TODAY)])).toBe(4);
  });

  it('a partial day breaks it', () => {
    expect(streakOf([...fullDay('2026-10-24'), meal('2026-10-25', 'lunch'), ...fullDay('2026-10-26')])).toBe(1);
  });

  it('an off day neither breaks it nor counts', () => {
    expect(streakOf([...fullDay('2026-10-24'), ...fullDay('2026-10-26')], [0])).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/record.test.ts`
Expected: FAIL: "Failed to resolve import "../record"".

- [ ] **Step 3: Create `src/core/record.ts`**

```ts
import { addDays, weekDates } from './date';
import { menuSlots, skippedOn, type DayMenu } from './menu';
import { pattern, slotOf, type SlotPoint } from './pattern';
import type { Routine } from './routine';
import type { ISODate, Meal, SlotSkip } from './types';
import { isOffDay } from './week';

/**
 * The calorie record, day by day. A day is full when every meal it planned
 * was logged or skipped, partial when some were, empty when none; a day after
 * today is only planned, and an off day is off. A day holding a meal the app
 * filled in that nobody confirmed is marked, so the record shows which days
 * were really checked. Pure; the week strip, the calendar and the streak all
 * read it.
 */
export type DayRecordState = 'full' | 'partial' | 'empty' | 'planned' | 'off';

export type DayRecord = {
  state: DayRecordState;
  /** Some meal that day was filled in from the plan and is not confirmed yet. */
  fromPlan: boolean;
};

type RecordBase = { today: ISODate; routine: Routine; meals: Meal[]; skips: SlotSkip[]; offDays: number[] };

export function dayRecord(input: RecordBase & { date: ISODate; menu: DayMenu | null }): DayRecord {
  const dayMeals = input.meals.filter((m) => m.date === input.date);
  const fromPlan = dayMeals.some((m) => m.source === 'auto');
  if (isOffDay(input.offDays, input.date)) return { state: 'off', fromPlan };
  if (input.date > input.today) return { state: 'planned', fromPlan };
  // Meals are matched against every slot of the date; only the ones with something planned must be settled.
  // A date with no menu at all is judged against the pattern's slots, every one of them.
  const all: (SlotPoint & { planned: boolean })[] = input.menu
    ? menuSlots(input.menu).map((s) => ({ id: s.id, type: s.type, minutes: s.minutes, planned: s.meal.lines.length > 0 }))
    : pattern(input.routine).map((p) => ({ id: p.id, type: p.type, minutes: p.minutes, planned: true }));
  const required = all.filter((s) => s.planned);
  if (required.length === 0) return { state: dayMeals.length > 0 ? 'full' : 'empty', fromPlan };
  const skipped = new Set(skippedOn(input.skips, input.date));
  const eaten = new Set<string>();
  for (const m of dayMeals) {
    const s = slotOf(m, all);
    if (s) eaten.add(s.id);
  }
  const settled = required.filter((s) => eaten.has(s.id) || skipped.has(s.id)).length;
  if (settled === required.length) return { state: 'full', fromPlan };
  return { state: settled > 0 || dayMeals.length > 0 ? 'partial' : 'empty', fromPlan };
}

/** The seven records of the week starting on `monday`, Monday first, for the week strip. */
export function weekRecord(input: RecordBase & { monday: ISODate; menuOn: (date: ISODate) => DayMenu | null }): DayRecord[] {
  return weekDates(input.monday).map((date) => dayRecord({ ...input, date, menu: input.menuOn(date) }));
}

/**
 * Full days in a row, back from today. Today counts once it is full, but a
 * today not settled yet never breaks the run, so in the morning the streak is
 * yesterday's, not 0. An off day neither breaks it nor counts. Looks back at
 * most `limit` days.
 */
export function recordStreak(input: RecordBase & { menuOn: (date: ISODate) => DayMenu | null; limit?: number }): number {
  const byDate = new Map<ISODate, Meal[]>();
  for (const m of input.meals) {
    const list = byDate.get(m.date);
    if (list) list.push(m);
    else byDate.set(m.date, [m]);
  }
  let n = 0;
  for (let i = 0; i < (input.limit ?? 60); i++) {
    const date = addDays(input.today, -i);
    const r = dayRecord({ ...input, meals: byDate.get(date) ?? [], date, menu: input.menuOn(date) });
    if (r.state === 'full') n++;
    else if (r.state !== 'off' && i > 0) break;
  }
  return n;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/core/__tests__/record.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/record.ts src/core/__tests__/record.test.ts
git commit -m "$(cat <<'EOF'
The record says whether each day is full, partial, empty, planned or off, and marks days still holding meals the app filled in; the streak counts full days and no longer drops to 0 every morning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Migration to version 7, and the pattern always on

**Files:**
- Modify: `src/core/routine.ts` (import line 1; `DEFAULT_ROUTINE` comment line 97; `skipKey` lines 446-449; new `DEFAULT_SLOTS` after `TYPE_TIME`, line 422)
- Modify: `src/core/menu.ts` (append `menusFromTemplate`; `weekPlan` import)
- Modify: `src/store/defaults.ts` (`STATE_VERSION`, `EMPTY_STATE.routine`)
- Modify: `src/store/migrate.ts` (imports; `upgradeRoutine`; `migrateState`)
- Modify: `src/store/AppProvider.tsx` (`withMeal`; `setRoutine`)
- Modify: `src/app/routine.tsx` (lines 62-63)
- Test: `src/core/__tests__/migrate.test.ts`, `src/core/__tests__/sync.test.ts` (the sync-round tests' `supported: 6`)

**Interfaces:**
- Consumes: `addSkip` (Task 3), `DayMenu`, `NOT_EDITED`, `menuFor`, `copyMeals` (Task 2, `copyMeals` is module-local in `menu.ts`), `mondayOf`, `toISODate`, `weekDates` (`date.ts`), `stable` (`sync.ts`), `MEAL_WINDOWS` (`nutrition.ts`).
- Produces:
  - `routine.ts`: `SKIP_PREFIX = 'skip_'`; `DEFAULT_SLOTS: RoutineSlot[]` (ids `breakfast`, `lunch`, `snack`, `dinner`; times 08:30, 13:00, 16:00, 20:30; shares 25, 35, 10, 30).
  - `menu.ts`: `menusFromTemplate(plan: WeekPlan, monday: ISODate, menus: DayMenu[]): DayMenu[]`.
  - `migrate.ts`: `migrateState(raw: unknown, now: Date = new Date()): AppState`.
  - `STATE_VERSION = 7`; `EMPTY_STATE.routine = { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_SLOTS }`.

How "a person with no custom slots gets the default slots" is read here, because the store cannot tell custom slots from the shipped ones directly: the four default slots replace the stored ones when the store has no slots at all, or when it is older than version 7, the pattern was never switched on, no week was ever planned, and the slots are exactly the shipped example routine's. Anyone who switched the pattern on, planned a week or edited a slot keeps their slots. `routine.enabled` is set to true on every load (not only once), so a value merged in from an older file can never switch it off again. The conversions of the old shapes (template, skip keys, `glassMl`) run whenever the old shape is present, so a merge that lands an older file is converted too. The old `weekPlan` stays in this task so the existing plan screen keeps working; Task 8 moves that screen to the menus and drops it.

- [ ] **Step 1: Write the failing tests, and update the ones that encoded version 6**

In `src/core/__tests__/migrate.test.ts`:

Replace the routine import line with:

```ts
import { DEFAULT_ROUTINE, DEFAULT_SLOTS } from '../routine';
```

After the `v1` fixture add:

```ts
// A Wednesday; its week runs from Monday 26 October to Sunday 1 November.
const NOW = new Date('2026-10-28T10:00:00');
```

In "marks the result as the current version and is idempotent", change `expect(once.version).toBe(6);` to `expect(once.version).toBe(7);`.

In "gives an older store the default routine and keeps an edited one", change `expect(edited.routine.enabled).toBe(false);` to:

```ts
    // Since version 7 the pattern is always on: a menu is a list of slots.
    expect(edited.routine.enabled).toBe(true);
```

Replace the whole test "switches an older store's routine off once, and leaves a version-3 store alone" (it encoded the opt-in pattern that version 7 retires) with:

```ts
  it('version 7: the pattern is always on, whatever the store said', () => {
    expect(migrateState({ ...v1, routine: { ...DEFAULT_ROUTINE, enabled: false, slots: DEFAULT_ROUTINE.slots.slice(1) } }).routine.enabled).toBe(true);
    expect(migrateState({ ...v1, version: 7, routine: { ...DEFAULT_ROUTINE, enabled: false } }).routine.enabled).toBe(true);
  });
```

In "gives routine meals saved without a time their default time", replace the first line

```ts
    const old = { ...v1, routine: { ...EMPTY_STATE.routine, slots: EMPTY_STATE.routine.slots.map(({ time: _t, ...s }) => s) } };
```

with (the empty state's slots are the four default ones now, and an untouched example routine that was never switched on becomes those four, so this test switches the example on to keep testing the times):

```ts
    const old = { ...v1, routine: { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_ROUTINE.slots.map(({ time: _t, ...s }) => s) } };
```

In "version 6: slots get shares, a dinner appears, and plan meals take the slot names", change `const out = migrateState(v5);` to `const out = migrateState(v5, NOW);`, `expect(out.version).toBe(6);` to `expect(out.version).toBe(7);`, and `expect(migrateState(out)).toEqual(out);` to `expect(migrateState(out, NOW)).toEqual(out);`.

In "version 6: a default routine without shares gets the same allowances as a fresh one", change the `routine:` line of its `v5` to (switched on, so version 7 keeps the example slots this test is about):

```ts
      routine: { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_ROUTINE.slots.filter((s) => s.type !== 'dinner').map((s) => ({ ...s, share: undefined })) },
```

Append inside the `describe`:

```ts
  it('version 7: the week plan becomes this week\'s menus, date by date, with Sunday at index 0', () => {
    const days = Array.from({ length: 7 }, (_, d) => ({ meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: d + 1 }] }] }));
    const out = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile, onboarded: true }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: true }, weekPlan: { days } }, NOW);
    expect(out.menus.map((m) => m.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    const lunchQty = (date: string) => out.menus.find((m) => m.date === date)!.meals.find((m) => m.id === 'lunch')!.lines[0].qty;
    expect(lunchQty('2026-10-26')).toBe(2); // Monday is index 1
    expect(lunchQty('2026-11-01')).toBe(1); // Sunday is index 0
    expect(out.menus.every((m) => m.editedAt === '')).toBe(true);
  });

  it('version 7: a date that already has a menu keeps it', () => {
    const days = Array.from({ length: 7 }, () => ({ meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] }));
    const mine = { date: '2026-10-28', editedAt: '2026-10-27T18:00:00.000Z', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 4 }] }] };
    const out = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: true }, weekPlan: { days }, menus: [mine] }, NOW);
    expect(out.menus.find((m) => m.date === '2026-10-28')).toEqual(mine);
    expect(out.menus).toHaveLength(7);
  });

  it('version 7: someone who never used the pattern starts from the four meals of the day; a planned or used routine keeps its slots', () => {
    const never = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: false } }, NOW);
    expect(never.routine.slots.map((s) => s.id)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    const planned = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: false }, weekPlan: { days: Array.from({ length: 7 }, () => ({ meals: [] })) } }, NOW);
    expect(planned.routine.slots.map((s) => s.id)).toContain('bhel');
    const used = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: true } }, NOW);
    expect(used.routine.slots.map((s) => s.id)).toContain('bhel');
    const none = migrateState({ version: 7, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, slots: [] } }, NOW);
    expect(none.routine.slots).toEqual(DEFAULT_SLOTS);
  });

  it('version 7: skip keys move to slot skips with their dates, and other done-keys stay', () => {
    const out = migrateState({ ...v1, actionsDone: [{ date: '2026-10-28', key: 'skip_lunch' }, { date: '2026-10-28', key: 'weigh_later' }, { date: '2026-10-27', key: 'skip_dinner' }] }, NOW);
    expect(out.slotSkips).toEqual([
      { id: '2026-10-28:lunch', date: '2026-10-28', slotId: 'lunch' },
      { id: '2026-10-27:dinner', date: '2026-10-27', slotId: 'dinner' },
    ]);
    expect(out.actionsDone).toEqual([{ date: '2026-10-28', key: 'weigh_later' }]);
  });

  it('version 7: nothing logged is touched, and a second load changes nothing', () => {
    const logs = {
      meals: [{ id: 'm1', at: '2026-10-27T07:30:00.000Z', date: '2026-10-27', type: 'lunch', items: [], kcal: 520, protein: 18 }],
      water: [{ id: 'w1', at: '2026-10-27T05:00:00.000Z', date: '2026-10-27', ml: 250 }],
      weights: [{ date: '2026-10-25', kg: 98.4 }],
      sleep: [{ date: '2026-10-27', bed: '23:00', wake: '06:30', quality: 4, wakeups: 0, energy: 4, minutes: 450, score: 80 }],
      activities: [{ id: 'a1', date: '2026-10-27', at: '2026-10-27T01:00:00.000Z', activityId: 'walk', minutes: 30, intensity: 1, kcal: 150 }],
    };
    const once = migrateState({ ...v1, ...logs }, NOW);
    expect(once.meals).toEqual(logs.meals);
    expect(once.water).toEqual(logs.water);
    expect(once.weights).toEqual(logs.weights);
    expect(once.sleep).toEqual(logs.sleep);
    expect(once.activities).toEqual(logs.activities);
    expect(migrateState(once, NOW)).toEqual(once);
  });
```

In `src/core/__tests__/sync.test.ts`, the sync-round tests hard-code the newest version this build understands as 6; with `STATE_VERSION` at 7 every state they build (from `EMPTY_STATE`) would read as written by a newer build and stop with `update_app`. Tie them to the constant instead. Replace `import { EMPTY_STATE } from '../../store/defaults';` with:

```ts
import { EMPTY_STATE, STATE_VERSION } from '../../store/defaults';
```

then run:

```bash
sed -i '' 's/supported: 6/supported: STATE_VERSION/g' src/core/__tests__/sync.test.ts
```

(seven calls), and in "a file written by a newer build is neither merged nor written over" replace `const newer = { ...cloudOf(used([v('a', 1)])), version: 7 };` with `const newer = { ...cloudOf(used([v('a', 1)])), version: STATE_VERSION + 1 };`. The `fromNewerApp` unit test with the literals 5, 6 and 7 stays as it is: it tests the comparison, not this build.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/migrate.test.ts src/core/__tests__/sync.test.ts`
Expected: FAIL in `migrate.test.ts`: the import of `DEFAULT_SLOTS` is `undefined` (`toEqual(undefined)` fails), the version reads 6, `routine.enabled` stays false, `menus` and `slotSkips` are empty. `sync.test.ts` still passes at this point (the state is still version 6).

- [ ] **Step 3: `DEFAULT_SLOTS` and the skip prefix in `src/core/routine.ts`**

Replace line 1 with:

```ts
import { addDays } from './date';
import { MEAL_WINDOWS } from './nutrition';
```

In `DEFAULT_ROUTINE`, replace the comment `  // Off until the person turns it on: Today should show what they ate, not a plan they did not ask for.` with:

```ts
  // How older stores saved it. Since version 7 every loaded store has the pattern on (store/migrate.ts).
```

After the `TYPE_TIME` constant (before `slotTime`), add:

```ts
const DEFAULT_SLOT_NAMES: Record<MealType, Pick<RoutineSlot, 'label_en' | 'label_mr' | 'label_hi'>> = {
  breakfast: { label_en: 'Breakfast', label_mr: 'नाश्ता', label_hi: 'नाश्ता' },
  lunch: { label_en: 'Lunch', label_mr: 'दुपारचे जेवण', label_hi: 'दोपहर का खाना' },
  snack: { label_en: 'Snack', label_mr: 'खाऊ', label_hi: 'स्नैक' },
  dinner: { label_en: 'Dinner', label_mr: 'रात्रीचे जेवण', label_hi: 'रात का खाना' },
};

/**
 * The slots a person starts with when they have none of their own: the four
 * meals of the day at their usual times, sharing the day the way the old
 * fixed meal windows did. Seeding these is all the windows are still for.
 */
export const DEFAULT_SLOTS: RoutineSlot[] = MEAL_WINDOWS.map((w) => ({
  id: w.type,
  type: w.type,
  time: TYPE_TIME[w.type],
  share: Math.round(w.share * 100),
  ...DEFAULT_SLOT_NAMES[w.type],
  options: [[]],
  withBhaji: w.type === 'lunch' || w.type === 'dinner',
}));
```

Replace `skipKey` and its doc comment with:

```ts
/** Older builds kept a skipped slot as a done-key with this prefix; version 7 moves them to `slotSkips`. */
export const SKIP_PREFIX = 'skip_';

/** The done-key older builds wrote for a slot skipped for the day. */
export function skipKey(slot: RoutineSlot): string {
  return `${SKIP_PREFIX}${slot.id}`;
}
```

- [ ] **Step 4: `menusFromTemplate` in `src/core/menu.ts`**

Change the `./weekPlan` import to:

```ts
import { alignDay, lineInfo, planDayFor, type PlanMeal, type WeekPlan } from './weekPlan';
```

and append:

```ts
/**
 * The old one-week plan written onto a real week: each date of the week
 * starting on `monday` that has no menu yet takes the template's day for its
 * weekday (index 0 is Sunday). A date that has a menu keeps it. Stamped as
 * written by the app. The same list when nothing was missing.
 */
export function menusFromTemplate(plan: WeekPlan, monday: ISODate, menus: DayMenu[]): DayMenu[] {
  const missing = weekDates(monday)
    .filter((date) => !menuFor(date, menus) && plan.days[weekdayOf(date)])
    .map((date): DayMenu => ({ date, meals: copyMeals(plan.days[weekdayOf(date)].meals), editedAt: NOT_EDITED }));
  return missing.length ? [...menus, ...missing] : menus;
}
```

- [ ] **Step 5: Defaults in `src/store/defaults.ts`**

Change `import { DEFAULT_ROUTINE } from '../core/routine';` to `import { DEFAULT_ROUTINE, DEFAULT_SLOTS } from '../core/routine';`, `export const STATE_VERSION = 6;` to `export const STATE_VERSION = 7;`, and in `EMPTY_STATE` `routine: DEFAULT_ROUTINE,` to:

```ts
  // A new person's pattern is the four meals of the day, and it is always on.
  routine: { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_SLOTS },
```

- [ ] **Step 6: The migration in `src/store/migrate.ts`**

Replace the import block (lines 1-7 plus the `tabs` import from Task 1) with:

```ts
import { Platform } from 'react-native';
import { DEFAULT_BREAK_SETTINGS, type BreakLog, type BreakSettings } from '../core/breaks';
import { mondayOf, toISODate } from '../core/date';
import { addSkip, menusFromTemplate, type DayMenu } from '../core/menu';
import { slotShare } from '../core/pattern';
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, DINNER_SLOT, SKIP_PREFIX, type RoutineSlot } from '../core/routine';
import { stable } from '../core/sync';
import { DEFAULT_TODAY_CARDS, normalizeTabs } from '../core/tabs';
import type { AppState, SavedMeal, SlotSkip } from '../core/types';
import { alignWeekPlan, type WeekPlan } from '../core/weekPlan';
import { DEFAULT_OLLAMA_URL, EMPTY_STATE, OLD_OLLAMA_PLACEHOLDER, STATE_VERSION } from './defaults';
```

Replace the whole `upgradeRoutine` function (and its doc comment) with:

```ts
/** The shipped example routine, never edited: the same slots, compared by id. */
function untouchedExample(slots: RoutineSlot[]): boolean {
  const byId = (list: RoutineSlot[]) => stable([...list].sort((a, b) => a.id.localeCompare(b.id)));
  return byId(slots) === byId(DEFAULT_ROUTINE.slots);
}

/** Routine meals saved before they had times get the default time for their id, else a sensible one by meal. */
function upgradeRoutine(old: unknown, fromVersion: number, hadPlan: boolean): AppState['routine'] {
  const r = { ...EMPTY_STATE.routine, ...(isRecord(old) ? old : {}) } as AppState['routine'];
  const wasOn = r.enabled === true;
  const byType: Record<string, string> = { breakfast: '08:30', lunch: '13:00', snack: '16:00', dinner: '20:30' };
  r.slots = (Array.isArray(r.slots) ? r.slots : []).map((s) =>
    s.time ? s : { ...s, time: DEFAULT_ROUTINE.slots.find((d) => d.id === s.id)?.time ?? byType[s.type] ?? '13:00' },
  );
  // Version 6: every slot carries a share of the day's calories (a default slot the curated one, so a migrated routine divides the day like a fresh one), and a store from before it gets a dinner to plan; one removed on purpose later stays removed.
  r.slots = r.slots.map((s) => (typeof s.share === 'number' ? s : { ...s, share: DEFAULT_ROUTINE.slots.find((d) => d.id === s.id)?.share ?? slotShare(s) }));
  if (fromVersion < 6 && !r.slots.some((s) => s.type === 'dinner')) {
    r.slots = [...r.slots, { ...DINNER_SLOT, id: r.slots.some((s) => s.id === 'dinner') ? 'dinner-2' : 'dinner' }];
  }
  // Version 7: the pattern is always on, because a menu is a list of slots. Someone who never switched it on, never planned
  // a week and never touched the shipped example slots starts from the four meals of the day; nobody is left with no slots.
  if (r.slots.length === 0 || (fromVersion < 7 && !wasOn && !hadPlan && untouchedExample(r.slots))) r.slots = DEFAULT_SLOTS.map((s) => ({ ...s, options: [[]] }));
  r.enabled = true;
  return r;
}
```

(The version-3 line `if (fromVersion < 3) r.enabled = false;` is gone: version 7 retires the switch.)

Add after `alignOrDrop`:

```ts
/** A done-key older builds wrote for a skipped slot. */
function isSkipKey(a: unknown): a is { date: string; key: string } {
  return isRecord(a) && typeof a.date === 'string' && typeof a.key === 'string' && a.key.startsWith(SKIP_PREFIX);
}
```

Replace the whole `migrateState` function (keep its doc comment) with:

```ts
export function migrateState(raw: unknown, now: Date = new Date()): AppState {
  if (!isRecord(raw) || !isRecord(raw.profile)) return { ...EMPTY_STATE };
  const breakSettings = upgradeSettings(raw.breakSettings);
  const fromVersion = typeof raw.version === 'number' ? raw.version : 1;
  const settings = upgradeAppSettings(raw.settings);
  // Version 4: the weigh-in moved to Sunday, and the start weight became a
  // fixed point rather than whichever weigh-in happened to be oldest.
  if (fromVersion < 4 && settings.weighDay === 1) settings.weighDay = 0;
  // Version 5: reminders space out. Nothing closer than an hour unless chosen.
  if (fromVersion < 5 && settings.nudgeMinutes < 60) settings.nudgeMinutes = 60;
  const profile = { ...EMPTY_STATE.profile, ...(raw.profile as object) } as AppState['profile'];
  if (profile.startWeightKg === undefined) {
    const weights = Array.isArray(raw.weights) ? ([...(raw.weights as AppState['weights'])].sort((a, b) => a.date.localeCompare(b.date))) : [];
    profile.startWeightKg = weights[0]?.kg ?? profile.weightKg;
  }
  // A plan that is not seven days of meals is not a plan; rebuild it from the routine on next open.
  const rawPlan = isRecord(raw.weekPlan) && Array.isArray((raw.weekPlan as { days?: unknown }).days) && (raw.weekPlan as { days: unknown[] }).days.length === 7 ? (raw.weekPlan as WeekPlan) : null;
  const routine = upgradeRoutine(raw.routine, fromVersion, rawPlan !== null);
  // Version 6: plan meals are named after the pattern's slots; older names land on the slot of their type nearest their time.
  const weekPlan = rawPlan ? alignOrDrop(rawPlan, routine) : null;
  // Version 7: the one-week template becomes this week's menus, date by date, its index 0 being Sunday. A date that already has a menu keeps it.
  const storedMenus = Array.isArray(raw.menus) ? (raw.menus as DayMenu[]) : [];
  const menus = weekPlan ? menusFromTemplate(weekPlan, mondayOf(toISODate(now)), storedMenus) : storedMenus;
  // Version 7: a skipped slot is its own record with its date, not a done-key that lasted only the day.
  const actions = Array.isArray(raw.actionsDone) ? (raw.actionsDone as unknown[]) : [];
  let slotSkips = Array.isArray(raw.slotSkips) ? (raw.slotSkips as SlotSkip[]) : [];
  for (const a of actions) if (isSkipKey(a)) slotSkips = addSkip(slotSkips, a.date, a.key.slice(SKIP_PREFIX.length));
  return {
    ...EMPTY_STATE,
    ...(raw as Partial<AppState>),
    version: STATE_VERSION,
    profile,
    settings,
    breakSettings,
    breaks: upgradeLogs(raw.breaks, breakSettings.micro.seconds),
    // Older stores have no routine; one saved before a field existed gets the default for it.
    routine,
    spend: Array.isArray(raw.spend) ? (raw.spend as AppState['spend']) : [],
    schedule: { ...EMPTY_STATE.schedule, ...(isRecord(raw.schedule) ? raw.schedule : {}) },
    weekPlan,
    menus,
    actionsDone: actions.filter((a) => !isSkipKey(a)) as AppState['actionsDone'],
    slotSkips,
    savedMeals: Array.isArray(raw.savedMeals) ? (raw.savedMeals as SavedMeal[]) : [],
  };
}
```

(`DEFAULT_TODAY_CARDS` and `normalizeTabs` stay in use by `upgradeAppSettings` from Task 1.)

- [ ] **Step 7: The store and the routine screen follow "always on"**

In `src/store/AppProvider.tsx`, inside `withMeal`, replace

```ts
  const meal = s.routine.enabled
    ? withSlot(m, { routine: s.routine, target, meals: s.meals.filter((x) => x.date === today), skippedSlots: skippedOn(s.slotSkips, today), now })
    : m;
```

with

```ts
  // The pattern is always on, so every meal finds its slot.
  const meal = withSlot(m, { routine: s.routine, target, meals: s.meals.filter((x) => x.date === today), skippedSlots: skippedOn(s.slotSkips, today), now });
```

In `setRoutine`, replace `const routine = { ...s.routine, ...r };` with:

```ts
          // The pattern is always on: a menu is a list of slots.
          const routine = { ...s.routine, ...r, enabled: true };
```

In `src/app/routine.tsx`, delete these two lines at the top of the first `Card` (the switch has nothing to switch any more):

```tsx
        <Toggle title={t('pattern_follow')} desc={t('pattern_follow_desc')} on={routine.enabled} onToggle={() => app.setRoutine({ enabled: !routine.enabled })} />
        <Divider />
```

(`Toggle` and `Divider` stay used further down the file.)

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/core/__tests__/migrate.test.ts src/core/__tests__/sync.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean.

- [ ] **Step 10: Commit**

```bash
git add src/core/routine.ts src/core/menu.ts src/store/defaults.ts src/store/migrate.ts src/store/AppProvider.tsx src/app/routine.tsx src/core/__tests__/migrate.test.ts src/core/__tests__/sync.test.ts
git commit -m "$(cat <<'EOF'
Version 7: the week plan becomes this week's menus, the eating pattern is always on, someone who never used it starts from the four meals of the day, and skipped slots keep their dates; nothing logged is touched

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Sync merges menus, skips and saved meals

**Files:**
- Modify: `src/core/sync.ts` (`COLLECTIONS` lines 28-44, `mergeCollection` lines 110-138, the loop in `merge3` line 153-155)
- Test: `src/core/__tests__/sync.test.ts`

**Interfaces:**
- Consumes: `AppState.menus`, `slotSkips`, `savedMeals` (Tasks 2-4).
- Produces: `COLLECTIONS` entries gain an optional `stampOf?: (r: AnyRecord) => string`; `menus` (id = date, stamp = `editedAt`), `slotSkips` (id), `savedMeals` (id) join the merged collections. When both sides changed a record that has a stamp, the newer stamp wins (equal stamps: this device, as before).

The "carry unknown keys" handling needs no change: an older build that meets a version-7 file stops at `fromNewerApp` and never writes over it, and the three new keys are now known to this build.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/sync.test.ts`, after the `../types` import add:

```ts
import type { DayMenu } from '../menu';
```

and append at the end of the file:

```ts
describe('menus, skips and saved meals', () => {
  const menu = (date: string, qty: number, editedAt: string): DayMenu => ({ date, editedAt, meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty }] }] });
  const qtyOn = (s: CloudState, date: string) => s.menus.find((m) => m.date === date)?.meals[0].lines[0].qty;
  const base = cloudOf(used([], { menus: [menu('2026-10-28', 2, ''), menu('2026-10-29', 2, '')] }));

  it('two devices editing different dates both keep their edit', () => {
    const local = cloudOf(used([], { menus: [menu('2026-10-28', 3, '2026-10-27T09:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    const remote = cloudOf(used([], { menus: [menu('2026-10-28', 2, ''), menu('2026-10-29', 4, '2026-10-27T10:00:00.000Z')] }));
    const out = merge3(base, local, remote);
    expect(qtyOn(out, '2026-10-28')).toBe(3);
    expect(qtyOn(out, '2026-10-29')).toBe(4);
  });

  it('the same date edited on both: the newer edit wins, whichever device made it', () => {
    const early = cloudOf(used([], { menus: [menu('2026-10-28', 3, '2026-10-27T09:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    const late = cloudOf(used([], { menus: [menu('2026-10-28', 5, '2026-10-27T10:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    expect(qtyOn(merge3(base, early, late), '2026-10-28')).toBe(5);
    expect(qtyOn(merge3(base, late, early), '2026-10-28')).toBe(5);
  });

  it('with no base, an edit beats a menu the app wrote', () => {
    const written = cloudOf(used([meal('a', '2026-10-27T08:00:00.000Z')], { menus: [menu('2026-10-28', 2, '')] }));
    const edited = cloudOf(used([meal('a', '2026-10-27T08:00:00.000Z')], { menus: [menu('2026-10-28', 4, '2026-10-27T09:00:00.000Z')] }));
    expect(qtyOn(merge3(null, written, edited), '2026-10-28')).toBe(4);
    expect(qtyOn(merge3(null, edited, written), '2026-10-28')).toBe(4);
  });

  it('skips and saved meals merge record by record', () => {
    const skip = (date: string, slotId: string) => ({ id: `${date}:${slotId}`, date, slotId });
    const thali = { id: 's1', name: 'Thali', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] };
    const b = cloudOf(used([], { slotSkips: [skip('2026-10-26', 'lunch')] }));
    const local = cloudOf(used([], { slotSkips: [skip('2026-10-26', 'lunch'), skip('2026-10-27', 'dinner')], savedMeals: [thali] }));
    const remote = cloudOf(used([], { slotSkips: [skip('2026-10-27', 'morning')] }));
    const out = merge3(b, local, remote);
    // Lunch on the 26th was un-skipped on the other device; each side added one skip.
    expect(out.slotSkips.map((s) => s.id).sort()).toEqual(['2026-10-27:dinner', '2026-10-27:morning']);
    expect(out.savedMeals).toEqual([thali]);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/sync.test.ts`
Expected: FAIL: `menus`, `slotSkips` and `savedMeals` are merged whole as unknown keys, so "two devices editing different dates" keeps only this device's menus (Wednesday 3, Thursday 2), the newer-edit tests take this device's, and the skips test keeps only this device's list.

- [ ] **Step 3: Merge them in `src/core/sync.ts`**

Replace the `COLLECTIONS` declaration with:

```ts
/** The record arrays, each with the field that identifies one record, and for some the field that says when it was last edited. */
export const COLLECTIONS: { key: keyof CloudState; idOf: (r: AnyRecord) => string; stampOf?: (r: AnyRecord) => string }[] = [
  { key: 'meals', idOf: (r) => String(r.id) },
  { key: 'water', idOf: (r) => String(r.id) },
  { key: 'weights', idOf: (r) => String(r.date) },
  { key: 'sleep', idOf: (r) => String(r.date) },
  { key: 'moods', idOf: (r) => String(r.id) },
  { key: 'workouts', idOf: (r) => String(r.id) },
  { key: 'nudges', idOf: (r) => String(r.id) },
  { key: 'customFoods', idOf: (r) => String(r.id) },
  { key: 'memory', idOf: (r) => String(r.id) },
  { key: 'breaks', idOf: (r) => String(r.id) },
  { key: 'steps', idOf: (r) => String(r.date) },
  { key: 'actionsDone', idOf: (r) => `${r.date}:${r.key}` },
  { key: 'activities', idOf: (r) => String(r.id) },
  { key: 'spend', idOf: (r) => String(r.id) },
  // One menu per date. A menu the app wrote has an empty stamp, so any real edit beats it.
  { key: 'menus', idOf: (r) => String(r.date), stampOf: (r) => String(r.editedAt ?? '') },
  { key: 'slotSkips', idOf: (r) => String(r.id) },
  { key: 'savedMeals', idOf: (r) => String(r.id) },
];
```

Replace the signature line and the `pick` function of `mergeCollection`:

```ts
function mergeCollection(idOf: (r: AnyRecord) => string, base: unknown, local: unknown, remote: unknown): AnyRecord[] {
  const b = toMap(base, idOf);
  const l = toMap(local, idOf);
  const r = toMap(remote, idOf);
  const pick = (k: string): AnyRecord | undefined => {
    const bs = stable(b.get(k));
    const lv = l.get(k);
    const rv = r.get(k);
    if (stable(lv) !== bs) return lv;
    if (stable(rv) !== bs) return rv;
    return lv;
  };
```

with:

```ts
function mergeCollection(idOf: (r: AnyRecord) => string, base: unknown, local: unknown, remote: unknown, stampOf?: (r: AnyRecord) => string): AnyRecord[] {
  const b = toMap(base, idOf);
  const l = toMap(local, idOf);
  const r = toMap(remote, idOf);
  const pick = (k: string): AnyRecord | undefined => {
    const bs = stable(b.get(k));
    const lv = l.get(k);
    const rv = r.get(k);
    const mine = stable(lv) !== bs;
    const theirs = stable(rv) !== bs;
    // Changed on both sides, and the records say when: the newer edit wins, wherever it was made.
    if (mine && theirs && stampOf && lv && rv) return stampOf(rv) > stampOf(lv) ? rv : lv;
    if (mine) return lv;
    if (theirs) return rv;
    return lv;
  };
```

In `merge3`, replace

```ts
  for (const { key, idOf } of COLLECTIONS) {
    out[key] = mergeCollection(idOf, b[key], local[key], remote[key]);
  }
```

with

```ts
  for (const { key, idOf, stampOf } of COLLECTIONS) {
    out[key] = mergeCollection(idOf, b[key], local[key], remote[key], stampOf);
  }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/__tests__/sync.test.ts`
Expected: PASS. "both edited the same record: this device wins" still passes: meals carry no stamp.

- [ ] **Step 5: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/sync.ts src/core/__tests__/sync.test.ts
git commit -m "$(cat <<'EOF'
Menus merge date by date and the newer edit wins when two devices changed the same date, so a menu the app wrote never beats a real edit; skips and saved meals merge record by record

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Menus in the store; the plan screen edits this week's menus

**Files:**
- Modify: `src/core/menu.ts` (append the bridge; `weekPlan` import)
- Modify: `src/core/types.ts` (`AppState.weekPlan` comment, line 212-213)
- Modify: `src/store/migrate.ts` (`weekPlan:` in the returned object)
- Modify: `src/store/AppProvider.tsx` (imports; `Ctx`; a `planFoods` memo; the value: `setWeekPlan`, `setRoutine`, new entries; dependency list)
- Modify: `src/app/plan.tsx` (line 3, lines 66-72), `src/components/RoutineCard.tsx` (line 87), `src/components/PlanTodayCard.tsx` (line 35), `src/app/(tabs)/index.tsx` (lines 277 and 295)
- Test: `src/core/__tests__/menu.test.ts`, `src/core/__tests__/migrate.test.ts`

**Interfaces:**
- Consumes: `viewWeek`, `viewMenu`, `alignMenus`, `setMenuDay`, `setMenuLine`, `addMenuLine`, `setMenuMeal`, `copyDay` (Task 2), `mondayOf` (Task 2).
- Produces:
  - `menu.ts`: `weekPlanView(week: DayMenu[]): WeekPlan` (index 0 = Sunday), `applyWeekPlan(plan: WeekPlan, week: DayMenu[], menus: DayMenu[], now: Date): DayMenu[]`.
  - `Ctx`: `weekPlan: WeekPlan`, `setWeekPlan(plan: WeekPlan): void` (was `WeekPlan | null`; nothing passes null), `menuOn(date: ISODate): DayMenu`, `weekMenus(monday: ISODate): DayMenu[]`, `editMenuDay(day: DayMenu, meals: PlanMeal[]): void`, `editMenuLine(day: DayMenu, mealId: string, lineIdx: number, next: PlanLine | null): void`, `addMenuFood(day: DayMenu, mealId: string, line: PlanLine): void`, `editMenuMeal(day: DayMenu, meal: PlanMeal): void`, `copyMenuDay(from: DayMenu, to: ISODate): void`.
  - `migrateState` returns `weekPlan: null` always (the template lives on as this week's menus).

The store never writes a week just because it was looked at: `menuOn` and `weekMenus` are views, and only edits are stored. That keeps sync free of records written by the app on two devices at once, and needs no effect that sets state.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/menu.test.ts`, add `applyWeekPlan,` and `weekPlanView,` to the `../menu` import list (alphabetical: `applyWeekPlan` after `alignMenus`, `weekPlanView` after `viewWeek`), and append:

```ts
describe('the plan screen\'s view of this week', () => {
  it('shows the week Sunday first, as the old plan was', () => {
    const plan = weekPlanView(ensureWeek(MON, [menu('2026-10-26', 1), menu('2026-11-01', 7)], routine, foods));
    expect(lunchQty(plan.days[1])).toBe(1);
    expect(lunchQty(plan.days[0])).toBe(7);
  });

  it('writes back only the weekday that changed, to its own date', () => {
    const stored = [menu('2026-10-26', 1), menu('2026-10-28', 3)];
    const week = ensureWeek(MON, stored, routine, foods);
    const plan = weekPlanView(week);
    const edited = { days: plan.days.map((d, i) => (i === 3 ? { meals: d.meals.map((m) => (m.id === 'lunch' ? { ...m, lines: [chapati(5)] } : m)) } : d)) };
    const out = applyWeekPlan(edited, week, stored, NOW);
    expect(lunchQty(menuFor('2026-10-28', out))).toBe(5);
    expect(menuFor('2026-10-28', out)!.editedAt).toBe(NOW.toISOString());
    expect(menuFor('2026-10-26', out)).toBe(stored[0]);
    expect(out).toHaveLength(2);
    expect(applyWeekPlan(plan, week, stored, NOW)).toBe(stored);
  });
});
```

In `src/core/__tests__/migrate.test.ts`, in "version 6: slots get shares, a dinner appears, and plan meals take the slot names", replace `const day = out.weekPlan!.days[3];` with (the template now lives on as this week's menus; Wednesday is index 3):

```ts
    expect(out.weekPlan).toBeNull();
    const day = out.menus.find((m) => m.date === '2026-10-28')!;
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/menu.test.ts src/core/__tests__/migrate.test.ts`
Expected: FAIL: "weekPlanView is not a function"; the migration still returns the template, so `out.weekPlan` is not null.

- [ ] **Step 3: The bridge in `src/core/menu.ts`**

Change the `./weekPlan` import to:

```ts
import { alignDay, lineInfo, planDayFor, type PlanDay, type PlanMeal, type WeekPlan } from './weekPlan';
```

and append:

```ts
/** The week's menus in the old one-week shape, index 0 being Sunday, for the plan screen until it is rebuilt. */
export function weekPlanView(week: DayMenu[]): WeekPlan {
  const days: PlanDay[] = Array.from({ length: 7 }, () => ({ meals: [] }));
  for (const m of week) days[weekdayOf(m.date)] = { meals: m.meals };
  return { days };
}

/** An edit made on that view, written back: each weekday that changed goes to its own date in the week, stamped now; the rest stay as they are. */
export function applyWeekPlan(plan: WeekPlan, week: DayMenu[], menus: DayMenu[], now: Date): DayMenu[] {
  let out = menus;
  for (const day of week) {
    const next = plan.days[weekdayOf(day.date)];
    if (next && stable(next.meals) !== stable(day.meals)) out = setMenuDay(out, day, next.meals, now);
  }
  return out;
}
```

- [ ] **Step 4: The migration drops the template**

In `src/core/types.ts`, replace

```ts
  /** The week written down in advance, Sunday first. Null until the plan screen is first opened. */
  weekPlan?: import('./weekPlan').WeekPlan | null;
```

with

```ts
  /** Retired in version 7: the one-week template became this week's `menus`. Always null after a load; kept so a merge with an older file clears it. */
  weekPlan?: import('./weekPlan').WeekPlan | null;
```

In `src/store/migrate.ts`, in the object `migrateState` returns, replace the line `    weekPlan,` with:

```ts
    // Its week is in `menus` now.
    weekPlan: null,
```

- [ ] **Step 5: The store**

In `src/store/AppProvider.tsx`:

Replace `import { lastNDates, toISODate } from '../core/date';` with:

```ts
import { lastNDates, mondayOf, toISODate } from '../core/date';
```

Replace the `../core/menu` import with:

```ts
import { addMenuLine, addSkip, alignMenus, applyWeekPlan, copyDay, removeSkip, setMenuDay, setMenuLine, setMenuMeal, skippedOn, viewMenu, viewWeek, weekPlanView, type DayMenu } from '../core/menu';
```

Replace `import { pruneSpend, spentOn, type Routine, type SpendLog } from '../core/routine';` with:

```ts
import { pruneSpend, spentOn, type PlanLine, type Routine, type SpendLog } from '../core/routine';
```

Replace `import { alignWeekPlan, type WeekPlan } from '../core/weekPlan';` with:

```ts
import type { PlanMeal, WeekPlan } from '../core/weekPlan';
```

In `Ctx`, replace `  setWeekPlan: (plan: WeekPlan | null) => void;` with:

```ts
  /** This week's menus in the old one-week shape (index 0 = Sunday), for the plan screen until it is rebuilt. */
  weekPlan: WeekPlan;
  /** Write an edit made on `weekPlan` back to this week's dates. */
  setWeekPlan: (plan: WeekPlan) => void;
  /** The menu a date shows: stored, or as it starts; from today on, following the slots. */
  menuOn: (date: ISODate) => DayMenu;
  /** The seven menus of the week starting on `monday`, Monday first. */
  weekMenus: (monday: ISODate) => DayMenu[];
  /** Edits to one date's menu; `day` is the menu as shown. Every other date is left as it is. */
  editMenuDay: (day: DayMenu, meals: PlanMeal[]) => void;
  editMenuLine: (day: DayMenu, mealId: string, lineIdx: number, next: PlanLine | null) => void;
  addMenuFood: (day: DayMenu, mealId: string, line: PlanLine) => void;
  editMenuMeal: (day: DayMenu, meal: PlanMeal) => void;
  copyMenuDay: (from: DayMenu, to: ISODate) => void;
```

After `  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);` add:

```ts
  // Planned lines can name the person's own foods, whatever the diet filter shows.
  const planFoods = useMemo(() => [...FOODS, ...state.customFoods], [state.customFoods]);
```

In the value, after `const tipRecord = ...;` add:

```ts
    const thisWeek = viewWeek(mondayOf(today), state.menus, state.routine, today, planFoods);
```

Replace the `setRoutine` entry with:

```ts
      setRoutine: (r) =>
        update((s) => {
          // The pattern is always on: a menu is a list of slots.
          const routine = { ...s.routine, ...r, enabled: true };
          // Menus are written against the slots; when they change, today's and later ones follow. Past ones are history.
          const slotsChanged = r.slots !== undefined && r.slots !== s.routine.slots;
          const menus = slotsChanged ? alignMenus(s.menus, routine, today, [...FOODS, ...s.customFoods]) : s.menus;
          return { ...s, routine, menus };
        }),
```

Replace `      setWeekPlan: (plan) => update((s) => ({ ...s, weekPlan: plan })),` with:

```ts
      weekPlan: weekPlanView(thisWeek),
      setWeekPlan: (plan) =>
        update((s) => {
          const week = viewWeek(mondayOf(today), s.menus, s.routine, today, [...FOODS, ...s.customFoods]);
          const menus = applyWeekPlan(plan, week, s.menus, new Date());
          return menus === s.menus ? s : { ...s, menus };
        }),
      menuOn: (date) => viewMenu(date, state.menus, state.routine, today, planFoods),
      weekMenus: (monday) => viewWeek(monday, state.menus, state.routine, today, planFoods),
      editMenuDay: (day, meals) => update((s) => ({ ...s, menus: setMenuDay(s.menus, day, meals, new Date()) })),
      editMenuLine: (day, mealId, lineIdx, next) => update((s) => ({ ...s, menus: setMenuLine(s.menus, day, mealId, lineIdx, next, new Date()) })),
      addMenuFood: (day, mealId, line) => update((s) => ({ ...s, menus: addMenuLine(s.menus, day, mealId, line, new Date()) })),
      editMenuMeal: (day, meal) => update((s) => ({ ...s, menus: setMenuMeal(s.menus, day, meal, new Date()) })),
      copyMenuDay: (from, to) => update((s) => ({ ...s, menus: copyDay(from, to, s.menus, new Date()) })),
```

Change the value's dependency list `}, [state, ready, today, hour, update, storageError, saveCloudBase, readNow, switchAccount]);` to:

```ts
  }, [state, ready, today, hour, update, storageError, saveCloudBase, readNow, switchAccount, planFoods]);
```

- [ ] **Step 6: The screens read the week from the store**

`src/app/plan.tsx`: change line 3 to `import React, { useMemo, useState } from 'react';` and replace

```tsx
  // First open: write the week from the routine, so edits have something to keep.
  const plan: WeekPlan = useMemo(() => state.weekPlan ?? buildWeekPlan(state.routine, foods), [state.weekPlan, state.routine, foods]);
  useEffect(() => {
    if (!state.weekPlan) app.setWeekPlan(plan);
    // Only the missing plan triggers this; once saved it is the person's to edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.weekPlan]);
```

with

```tsx
  // This week's menus, Sunday first as this screen has always read them; an edit is written to its own date.
  const plan: WeekPlan = app.weekPlan;
```

`src/components/RoutineCard.tsx`: replace `  const planDay = state.weekPlan?.days[weekdayOf(today)];` with `  const planDay = app.menuOn(today);`.

`src/components/PlanTodayCard.tsx`: replace `  const plan = state.weekPlan;` with `  const plan = app.weekPlan;`.

`src/app/(tabs)/index.tsx`: there is always a week now, so the compact fits card always sits under "More today": delete the line

```tsx
      {isToday && !state.weekPlan ? <FitsCard compact /> : null}
```

and replace

```tsx
          {isToday && state.weekPlan ? <FitsCard compact /> : null}
```

with

```tsx
          {isToday ? <FitsCard compact /> : null}
```

Then `grep -rn "state\.weekPlan\|alignWeekPlan" src/app src/components src/store/AppProvider.tsx` must print nothing (`migrate.ts` still aligns an old template before writing it into menus).

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/core/__tests__/menu.test.ts src/core/__tests__/migrate.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean. The `eslint-disable` line removed from `plan.tsx` leaves one fewer.

- [ ] **Step 9: Commit**

```bash
git add src/core/menu.ts src/core/types.ts src/store/migrate.ts src/store/AppProvider.tsx src/app/plan.tsx src/components/RoutineCard.tsx src/components/PlanTodayCard.tsx "src/app/(tabs)/index.tsx" src/core/__tests__/menu.test.ts src/core/__tests__/migrate.test.ts
git commit -m "$(cat <<'EOF'
The store keeps menus by date and shows any date or week as it stands; the plan screen now edits this week's menus, so changing Wednesday changes only this Wednesday, and the old one-week template is gone after it has become this week

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `slotAt`, and the expected-by-now curve from the pattern

**Files:**
- Modify: `src/core/pattern.ts` (import line 2; append `slotAt`, `expectedKcalByHour`)
- Modify: `src/core/nutrition.ts` (delete `expectedKcalByHour`, lines 151-163)
- Modify: `src/core/insights.ts` (line 3; `scoreDay` input and line 44)
- Modify: `src/services/usePhotoQueue.ts` (line 5, lines 81-92)
- Modify: `src/app/(tabs)/index.tsx` (imports; the `scoreDay` call, line 114)
- Test: `src/core/__tests__/pattern.test.ts`, `src/core/__tests__/insights.test.ts`

**Interfaces:**
- Consumes: `pattern`, `PatternSlot` (`pattern.ts`), `SLOT_EARLY_MIN`, `SLOT_GRACE_MIN`, `DEFAULT_SLOTS` (Task 6).
- Produces: `slotAt(routine: Routine, minutes: number): PatternSlot | null`; `expectedKcalByHour(target: number, hour: number, slots: PatternSlot[]): number` (moved from `nutrition.ts`, now reads the slots); `scoreDay` input gains `slots?: PatternSlot[]` (default: the four default slots).

`expectedKcalByHour` moves to `pattern.ts` because `nutrition.ts` would otherwise import `routine.ts`, which already imports `nutrition.ts` through `foods.ts`.

- [ ] **Step 1: Write the failing tests, and update the curve test**

In `src/core/__tests__/pattern.test.ts`, change the first `../pattern` import to:

```ts
import { allowance, currentSlot, DEFAULT_SHARE, expectedKcalByHour, pattern, slotAt, slotOf, slotShare, slotStates, withSlot } from '../pattern';
```

and the routine import to:

```ts
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, type Routine, type RoutineSlot } from '../routine';
```

Append:

```ts
describe('slotAt', () => {
  const late: Routine = {
    ...DEFAULT_ROUTINE,
    enabled: true,
    slots: [slot('breakfast', 'breakfast', '08:30', 25), slot('mid', 'snack', '11:00', 5), slot('lunch', 'lunch', '13:30', 35), slot('evening', 'snack', '17:30', 10), slot('dinner', 'dinner', '21:30', 25)],
  };

  it('is the latest slot whose window has opened, with a 21:30 dinner and two snack slots', () => {
    expect(slotAt(late, 10 * 60 + 29)?.id).toBe('breakfast');
    expect(slotAt(late, 10 * 60 + 30)?.id).toBe('mid');
    expect(slotAt(late, 20 * 60 + 59)?.id).toBe('evening');
    expect(slotAt(late, 21 * 60)?.id).toBe('dinner');
    expect(slotAt(late, 23 * 60 + 30)?.id).toBe('dinner');
  });

  it('before the first window opens is the day\'s first slot; null with no slots', () => {
    expect(slotAt(late, 6 * 60)?.id).toBe('breakfast');
    expect(slotAt({ ...late, slots: [] }, 12 * 60)).toBeNull();
  });
});

describe('expectedKcalByHour', () => {
  const four = pattern({ ...DEFAULT_ROUTINE, slots: DEFAULT_SLOTS });

  it('rises through the day by the slots and reaches the full target by night', () => {
    expect(expectedKcalByHour(1800, 4, four)).toBe(0);
    expect(expectedKcalByHour(1800, 6, four)).toBeLessThan(150);
    expect(expectedKcalByHour(1800, 11, four)).toBe(450);
    expect(expectedKcalByHour(1800, 14, four)).toBe(1080);
    // The 16:00 snack counts in from 15:30, part of the way at 16:00.
    expect(expectedKcalByHour(1800, 16, four)).toBe(1152);
    expect(expectedKcalByHour(1800, 23, four)).toBe(1800);
  });

  it('follows a late dinner: at 21:00 a 21:30 dinner is not expected yet', () => {
    const late = pattern({ ...DEFAULT_ROUTINE, slots: DEFAULT_SLOTS.map((s) => (s.id === 'dinner' ? { ...s, time: '21:30' } : s)) });
    expect(expectedKcalByHour(1800, 21, late)).toBe(1260);
    expect(expectedKcalByHour(1800, 21, four)).toBeGreaterThan(1260);
  });

  it('never goes backwards', () => {
    let prev = -1;
    for (let h = 0; h <= 23; h++) {
      const v = expectedKcalByHour(1800, h, four);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
```

In `src/core/__tests__/insights.test.ts`, delete the line `import { expectedKcalByHour } from '../nutrition';` and the whole `describe('expectedKcalByHour', ...)` block (lines 89-106). The curve now reads the pattern and is tested in `pattern.test.ts`; its old hour-16 value (1080) came from the fixed snack window opening at 16:00, where the snack slot's window opens at 15:30. The `scoreDay` tests stay as they are: with no slots given it judges by the four default slots, which give the same 450 kcal at 11:00 the running-day tests rely on.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/pattern.test.ts src/core/__tests__/insights.test.ts`
Expected: FAIL: "slotAt is not a function" and "expectedKcalByHour is not a function" in `pattern.test.ts`.

- [ ] **Step 3: `slotAt` and the curve in `src/core/pattern.ts`**

Replace line 2 with:

```ts
import { SLOT_EARLY_MIN, SLOT_GRACE_MIN, slotMinutes, slotStatus, type Routine, type RoutineSlot, type SlotStatus } from './routine';
```

Append:

```ts
/**
 * The slot whose turn it is at this minute: the latest one whose window (its
 * time minus the early margin) has opened; before the day's first window
 * opens, the first slot. Every meal-shaped decision (the coach, the plates, a
 * photo's meal) reads this rather than a fixed list of meal hours. Null only
 * with no slots.
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
 * have eaten by this hour: each slot's share counts in as its window runs,
 * from its time minus the early margin to its time plus the grace. A day
 * still running is judged against this, not against the whole target.
 */
export function expectedKcalByHour(target: number, hour: number, slots: PatternSlot[]): number {
  const now = hour * 60;
  const span = SLOT_EARLY_MIN + SLOT_GRACE_MIN;
  let share = 0;
  for (const s of slots) share += s.share * Math.min(1, Math.max(0, (now - (s.minutes - SLOT_EARLY_MIN)) / span));
  return Math.round(target * Math.min(1, share));
}
```

- [ ] **Step 4: Remove the old curve from `src/core/nutrition.ts`**

Delete the doc comment and the `expectedKcalByHour` function (from `/**` "How much of the day's target a normal eater would have had by this hour." through its closing `}`).

- [ ] **Step 5: `src/core/insights.ts` reads the pattern**

Replace line 3 with:

```ts
import { expectedKcalByHour, pattern, type PatternSlot } from './pattern';
import { DEFAULT_ROUTINE, DEFAULT_SLOTS } from './routine';
```

After the `MOVEMENT_JUDGED_FROM_HOUR` constant add:

```ts
/** The four meals of the day, for a running day judged without the person's own pattern. */
const DEFAULT_PATTERN = pattern({ ...DEFAULT_ROUTINE, slots: DEFAULT_SLOTS });
```

In `scoreDay`'s input, after `expectedWaterMl?: number;` add:

```ts
  /** The eating pattern a running day is judged by; the four meals of the day when not given. */
  slots?: PatternSlot[];
```

and replace

```ts
  const denominator = running ? Math.max(expectedKcalByHour(input.kcalTarget, input.hour!), 1) : input.kcalTarget;
```

with

```ts
  const denominator = running ? Math.max(expectedKcalByHour(input.kcalTarget, input.hour!, input.slots ?? DEFAULT_PATTERN), 1) : input.kcalTarget;
```

- [ ] **Step 6: The photo queue and Today**

`src/services/usePhotoQueue.ts`: replace `import { mealTypeForHour } from '../core/nutrition';` with `import { slotAt } from '../core/pattern';`, and replace

```ts
        const at = new Date(photo.at || Date.now());
        store.addMeal({
          id: `q-${photo.id}`,
          at: at.toISOString(),
          date: photo.date || toISODate(at),
          type: mealTypeForHour(at.getHours()),
```

with

```ts
        const at = new Date(photo.at || Date.now());
        // The slot whose turn it was when the photo was taken, by the person's own pattern.
        const slot = slotAt(store.state.routine, at.getHours() * 60 + at.getMinutes());
        store.addMeal({
          id: `q-${photo.id}`,
          at: at.toISOString(),
          date: photo.date || toISODate(at),
          type: slot?.type ?? 'snack',
          slotId: slot?.id,
```

`src/app/(tabs)/index.tsx`: after `import { scoreDay } from '../../core/insights';` add `import { pattern } from '../../core/pattern';`, and in the `scoreDay({ ... })` call, after `hour: isToday ? hour : undefined,` add:

```tsx
    slots: pattern(state.routine),
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/core/__tests__/pattern.test.ts src/core/__tests__/insights.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean. `grep -rn "expectedKcalByHour" src` lists only `pattern.ts`, `insights.ts` and `pattern.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/core/pattern.ts src/core/nutrition.ts src/core/insights.ts src/services/usePhotoQueue.ts "src/app/(tabs)/index.tsx" src/core/__tests__/pattern.test.ts src/core/__tests__/insights.test.ts
git commit -m "$(cat <<'EOF'
The slot whose turn it is comes from the person's own pattern: a queued photo's meal takes it, and a day still running is judged against the slots due by now, so a 21:30 dinner is not expected at 21:00

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: The coach, the plates and the offline coach by slot id

**Files:**
- Modify: `src/core/coach.ts` (imports lines 1-6; `CoachInput.nextPlate` line 43; `coachAdvice` lines 48-75)
- Modify: `src/core/dayPlan.ts` (imports line 2; `DayPlanInput` lines 27-42; `mealsAhead` lines 123-139; `fullDayPlan` lines 156-159)
- Modify: `src/core/offlineCoach.ts` (line 2; `plateLine` lines 110-114; three callers)
- Modify: `src/components/useCoach.ts` (whole file), `src/components/FitsCard.tsx` (lines 37-51), `src/app/(tabs)/coach.tsx` (lines 143-165)
- Test: `src/core/__tests__/coach.test.ts`, `src/core/__tests__/dayPlan.test.ts`, `src/core/__tests__/offlineCoach.test.ts`

**Interfaces:**
- Consumes: `slotAt`, `pattern`, `PatternSlot` (Task 9), `DEFAULT_SLOTS`, `SLOT_GRACE_MIN`, `slotTime` (`routine.ts`), `skippedToday` (Task 3).
- Produces:
  - `CoachInput` gains `routine: Routine` and `settledSlotIds: string[]`; `nextPlate` gains `id?: string` and is matched by id. Food advice params gain `slot` (the slot id); `meal` stays the slot's type, which the wording translates.
  - `DayPlanInput.slots: PatternSlot[]` is required and `loggedTypes` is gone (the fixed-window branch is removed); `fullDayPlan` takes `Omit<DayPlanInput, 'hour' | 'loggedSlotIds' | 'nowMinutes'>`.
  - `offlineCoach.ts`: the plate on now is found by `dayPlan.nowId`; "plan my day" lists each slot's own plate.

- [ ] **Step 1: Write the failing tests, and update the ones that encoded the fixed windows**

`src/core/__tests__/coach.test.ts`:

Add after the `../coach` import:

```ts
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, type Routine } from '../routine';
```

After the `budget` helper add:

```ts
/** The four meals of the day: breakfast 08:30, lunch 13:00, snack 16:00, dinner 20:30. */
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_SLOTS };
```

In `base`, replace the `nextPlate` line with:

```ts
  routine,
  settledSlotIds: ['breakfast'],
  nextPlate: { id: 'lunch', type: 'lunch', budget: 600, kcal: 580, names: ['Palak bhaji', 'Chapati', 'Dal'] },
```

In "asks for the first log, a walk, the weigh-in and the morning check-in at the right hours", replace

```ts
    const noon = coachAdvice({ ...base, hour: 14, meals: [], budget: budget(0) });
    expect(noon[0].key).toBe('coach_log_first');
    expect(noon[0].urgency).toBe('now');
```

with (by the pattern, lunch at 13:00 is past its time and grace at 14:30 with nothing in it, so its plate is as urgent as the first log and was pushed first; under the fixed windows lunch only turned urgent at 15:00):

```ts
    const noon = coachAdvice({ ...base, hour: 14, meals: [], settledSlotIds: [], budget: budget(0) });
    expect(noon.slice(0, 2).map((x) => x.key)).toEqual(['coach_meal_plate', 'coach_log_first']);
    expect(noon.find((x) => x.key === 'coach_log_first')?.urgency).toBe('now');
```

Append inside `describe('coachAdvice', ...)`:

```ts
  it('reads the meal clock from the pattern: a 21:30 dinner is not late at 21:00, and is at 22:20', () => {
    const lateDinner: Routine = { ...routine, slots: DEFAULT_SLOTS.map((s) => (s.id === 'dinner' ? { ...s, time: '21:30' } : s)) };
    const at = (hour: number, minute: number) => coachAdvice({ ...base, routine: lateDinner, hour, minute, settledSlotIds: ['breakfast', 'lunch', 'snack'], budget: budget(1100) });
    expect(at(21, 0).map((x) => x.key)).not.toContain('coach_late_dinner');
    expect(at(22, 20).map((x) => x.key)).toContain('coach_late_dinner');
  });

  it('with two snack slots, the next meal is the slot after the one just eaten, at its own time', () => {
    const twoSnacks: Routine = { ...routine, slots: [...DEFAULT_SLOTS, { ...DEFAULT_SLOTS[2], id: 'evening', time: '18:30', label_en: 'Evening' }] };
    const a = coachAdvice({ ...base, routine: twoSnacks, hour: 16, minute: 30, settledSlotIds: ['breakfast', 'lunch', 'snack'], budget: budget(1100) });
    expect(a.find((x) => x.key === 'coach_next_meal')?.params).toMatchObject({ slot: 'evening', at: '18:30' });
  });
```

`src/core/__tests__/dayPlan.test.ts` (the plates no longer have a fixed-window fallback, so every call passes the pattern; the four default slots share the day exactly as the windows did, so the budgets are unchanged):

Replace the routine import with:

```ts
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, type RoutineSlot } from '../routine';
```

After `const foods = ...;` add:

```ts
const four = pattern({ ...DEFAULT_ROUTINE, slots: DEFAULT_SLOTS });
```

Replace these calls:

- `dayPlan({ remaining: 980, hour: 14, loggedTypes: ['breakfast'], foods, avoided: new Set() })` → `dayPlan({ remaining: 980, hour: 14, foods, avoided: new Set(), slots: four, loggedSlotIds: ['breakfast'] })`
- `dayPlan({ remaining: 40, hour: 20, loggedTypes: [], foods, avoided: new Set() })` → `dayPlan({ remaining: 40, hour: 20, foods, avoided: new Set(), slots: four })`
- `dayPlan({ remaining: 1200, hour: 9, loggedTypes: [], foods, avoided: new Set(['poha']) })` → `dayPlan({ remaining: 1200, hour: 9, foods, avoided: new Set(['poha']), slots: four })`
- In "puts the routine bhaji first and reshuffles the rest with the seed", the three calls → `dayPlan({ remaining: 1000, hour: 12, foods, avoided: new Set(), preferred: [veg.id], slots: four, loggedSlotIds: ['breakfast'] })`, `dayPlan({ remaining: 1000, hour: 12, foods, avoided: new Set(), seed: 3, slots: four, loggedSlotIds: ['breakfast'] })`, `dayPlan({ remaining: 1000, hour: 12, foods, avoided: new Set(), seed: 4, slots: four, loggedSlotIds: ['breakfast'] })`. By the pattern, breakfast stays ahead until lunch's window opens at 12:30, so the test logs breakfast to keep lunch first, as it was at noon under the windows.
- `fullDayPlan({ remaining: 1700, foods, avoided: new Set() })` → `fullDayPlan({ remaining: 1700, foods, avoided: new Set(), slots: four })`
- In the last two tests, delete `loggedTypes: [], ` from `const base = { ... }` and from the `dayPlan({ remaining: 800, ... })` call.

`src/core/__tests__/offlineCoach.test.ts`: append inside `describe('answerOffline', ...)`:

```ts
  it('picks the plate on now by its slot id, and lists every slot of the day once', () => {
    const tp = (k: string) => (k === 'oc_plate' ? 'plate {kcal}' : `[${k}]`);
    const pick = { food: { id: 'palak' } as never, grams: 150, kcal: 120, protein: 5 };
    const twoSnacks: OfflineCtx = {
      ...ctx,
      dayPlan: {
        remaining: 600,
        stop: false,
        now: 'snack',
        nowId: 'bhel',
        slots: [
          { id: 'tea', type: 'snack', budget: 100, kcal: 90, protein: 2, picks: [pick] },
          { id: 'bhel', type: 'snack', budget: 200, kcal: 180, protein: 4, picks: [pick] },
        ],
      },
    };
    expect(answerOffline('kiti calories baki ahet', twoSnacks, tp).text).toContain('plate 200');
    const day = answerOffline('full day plan dya', twoSnacks, tp).text;
    expect(day).toContain('plate 100');
    expect(day).toContain('plate 200');
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/coach.test.ts src/core/__tests__/dayPlan.test.ts src/core/__tests__/offlineCoach.test.ts`
Expected: FAIL. `coach.test.ts`: the updated noon check, the late-dinner test and the two-snack test fail (the windows put the first log first at 14:30, nag about dinner at 21:00 and name the next window, not the next slot). `offlineCoach.test.ts`: the new test finds `plate 100` where `plate 200` is expected. `dayPlan.test.ts` passes already (the slots branch existed); it stays in the run as the guard for Step 4.

- [ ] **Step 3: `src/core/coach.ts`**

Replace the import lines 1-6 with:

```ts
import type { ISODate, Meal, MealType, SleepLog, WaterLog, WeightLog } from './types';
import { expectedWaterByHour, inQuietHours } from './nudge';
import type { Budget } from './nutrition';
import { pattern, slotAt } from './pattern';
import { weighInDue } from './plan';
import { wasHeavy } from './review';
import { SLOT_GRACE_MIN, slotTime, type Routine } from './routine';
```

In `CoachInput`, replace

```ts
  /** The plate the day plan laid for the meal that is on now, if any. */
  nextPlate?: { type: MealType; budget: number; kcal: number; names: string[] } | null;
```

with

```ts
  /** The eating pattern: the meals the coach speaks of are its slots, by id. */
  routine: Routine;
  /** Slots eaten or skipped today. */
  settledSlotIds: string[];
  /** The plate the day plan laid for the slot that is on now, if any. */
  nextPlate?: { id?: string; type: MealType; budget: number; kcal: number; names: string[] } | null;
```

Replace the start of `coachAdvice` through the late-dinner block, that is from `export function coachAdvice(input: CoachInput): Advice[] {` down to and including

```ts
  if (hour >= 21 && !types.has('dinner') && b.remaining > 0) {
    out.push({ key: 'coach_late_dinner', kind: 'food', urgency: 'now', action: 'log', params: { kcal: Math.min(b.remaining, Math.max(300, b.perMeal)) } });
  }
```

with:

```ts
export function coachAdvice(input: CoachInput): Advice[] {
  const { hour, budget: b } = input;
  const out: Advice[] = [];
  const todayMeals = input.meals.filter((m) => m.date === input.today);
  const nowMin = hour * 60 + input.minute;
  const slots = pattern(input.routine);
  const settled = new Set(input.settledSlotIds);
  const cur = slotAt(input.routine, nowMin);
  const lastMeal = [...todayMeals].sort((a, b2) => a.at.localeCompare(b2.at)).slice(-1)[0];
  const lastMealHour = lastMeal ? new Date(lastMeal.at).getHours() : null;

  // Eating: the slot whose turn it is, with its budget, or the reason to stop.
  if (b.remaining < 80 && hour >= 12) {
    out.push({ key: b.remaining <= 0 ? 'coach_over' : 'coach_stop', kind: 'stop', urgency: 'now', action: 'water', params: { kcal: Math.max(0, b.remaining), over: Math.max(0, -b.remaining) } });
  } else if (cur && !settled.has(cur.id) && nowMin >= cur.minutes) {
    const plate = input.nextPlate && input.nextPlate.id === cur.id ? input.nextPlate : null;
    out.push({
      key: plate ? 'coach_meal_plate' : 'coach_meal_due',
      kind: 'food',
      // Urgent once the slot's time and its grace have passed with nothing in it.
      urgency: nowMin > cur.minutes + SLOT_GRACE_MIN ? 'now' : 'soon',
      action: plate ? 'plan' : 'log',
      params: { meal: cur.type, slot: cur.id, kcal: plate ? plate.budget : Math.min(b.remaining, Math.max(300, b.perMeal)), names: plate ? plate.names.join(', ') : '' },
    });
  } else if (cur && settled.has(cur.id) && b.remaining > 0) {
    const next = slots.find((s) => s.minutes > cur.minutes && !settled.has(s.id));
    if (next) out.push({ key: 'coach_next_meal', kind: 'food', urgency: 'note', action: 'plan', params: { meal: next.type, slot: next.id, kcal: Math.min(b.remaining, Math.max(250, b.perMeal)), at: slotTime(next.slot) } });
  }
  // The day's last dinner slot, past its own time and grace with nothing in it.
  const dinner = [...slots].reverse().find((s) => s.type === 'dinner');
  if (dinner && !settled.has(dinner.id) && nowMin > dinner.minutes + SLOT_GRACE_MIN && b.remaining > 0) {
    out.push({ key: 'coach_late_dinner', kind: 'food', urgency: 'now', action: 'log', params: { kcal: Math.min(b.remaining, Math.max(300, b.perMeal)) } });
  }
```

(The rest of the function, from the protein line on, is unchanged.)

- [ ] **Step 4: `src/core/dayPlan.ts`**

Replace line 2 with `import { kcalForGrams } from './nutrition';`.

In `DayPlanInput`, delete the `loggedTypes: MealType[];` line and replace

```ts
  /** The eating pattern, when it is on: the meals ahead are its slots, not the fixed windows. */
  slots?: PatternSlot[];
```

with

```ts
  /** The eating pattern: the meals ahead are its slots. */
  slots: PatternSlot[];
```

Replace `type Ahead = { id?: string; type: MealType; share: number };` and the whole `mealsAhead` function with:

```ts
type Ahead = { id: string; type: MealType; share: number };

/** The meals still to come. A slot stays ahead until the next slot's window opens, so a late lunch is still lunch. */
function mealsAhead(input: DayPlanInput): { ahead: Ahead[]; now: MealType; nowId?: string } {
  const now = input.nowMinutes ?? input.hour * 60;
  const logged = new Set(input.loggedSlotIds ?? []);
  const ahead = input.slots
    .filter((s, i) => {
      const end = i + 1 < input.slots.length ? input.slots[i + 1].minutes - SLOT_EARLY_MIN : 1440;
      return !logged.has(s.id) && now < end;
    })
    .map((s) => ({ id: s.id, type: s.type, share: s.share }));
  return { ahead, now: ahead[0]?.type ?? 'snack', nowId: ahead[0]?.id };
}
```

Replace `fullDayPlan` with:

```ts
/** The whole day on the target, every meal, as a sheet to plan from in the morning. */
export function fullDayPlan(input: Omit<DayPlanInput, 'hour' | 'loggedSlotIds' | 'nowMinutes'>): DayPlan {
  return dayPlan({ ...input, hour: 0, loggedSlotIds: [], nowMinutes: 0 });
}
```

Update the comment above `SlotPlan.id` from "when the pattern is on" to "the pattern slot this plate is for", and `DayPlan.nowId`'s from "when the pattern is on" to "the slot that is on now or next".

- [ ] **Step 5: `src/core/offlineCoach.ts`**

Replace line 2 with `import type { DayPlan, SlotPlan } from './dayPlan';`.

Replace `plateLine` with:

```ts
/** The plate to talk about: the meal asked for, else the slot on now (by its id), else the first one ahead. */
function plateFor(ctx: OfflineCtx, meal?: MealType): SlotPlan | undefined {
  const { slots, nowId, now } = ctx.dayPlan;
  if (meal) return slots.find((s) => s.type === meal);
  return (nowId ? slots.find((s) => s.id === nowId) : undefined) ?? slots.find((s) => s.type === now) ?? slots[0];
}

function plateLine(ctx: OfflineCtx, t: T, slot: SlotPlan | undefined): string | null {
  if (!slot || slot.picks.length === 0) return null;
  return f(t('oc_plate'), { meal: ctx.mealName(slot.type), kcal: slot.budget, items: slot.picks.map((p) => `${ctx.foodName(p.food.id)} (${p.kcal})`).join(', '), total: slot.kcal, protein: slot.protein });
}
```

In `answerOffline`: in the `eat_now`/`meal` case replace `const plate = plateLine(ctx, t, p.meal);` with `const plate = plateLine(ctx, t, plateFor(ctx, p.meal));`; in the `left` case replace `const plate = plateLine(ctx, t);` with `const plate = plateLine(ctx, t, plateFor(ctx));`; in the `plan_day` case replace `const l = plateLine(ctx, t, s.type);` with `const l = plateLine(ctx, t, s);`.

- [ ] **Step 6: The callers**

Replace the whole of `src/components/useCoach.ts` with:

```ts
import { useMemo } from 'react';
import { coachAdvice, type Advice } from '../core/coach';
import { dayPlan } from '../core/dayPlan';
import { foodName } from '../core/foods';
import { pattern, slotStates } from '../core/pattern';
import { avoidedFoodIds, bhajiFor } from '../core/routine';
import { isOffDay } from '../core/week';
import { useApp } from '../store/AppProvider';

/** The coach's advice for this minute, from the store. Shared by the strip, the Coach tab and the monitor. */
export function useCoach(minute: number): Advice[] {
  const app = useApp();
  const { state, budget, today, hour, foods, targets, skippedToday } = app;
  const lang = state.profile.lang;
  return useMemo(() => {
    if (isOffDay(state.settings.offDays, today)) return [];
    const todayMeals = state.meals.filter((m) => m.date === today);
    // The plates and the coach go by the pattern's slots, keyed by id, the way the fits card shows them.
    const settledSlotIds = slotStates({ routine: state.routine, target: targets.kcal, meals: todayMeals, nowMinutes: minute, skippedSlots: skippedToday })
      .filter((s) => s.status === 'done' || s.status === 'skipped')
      .map((s) => s.slot.id);
    const plan = dayPlan({
      remaining: budget.remaining,
      hour,
      foods,
      avoided: avoidedFoodIds({ ...state.routine, enabled: true }),
      preferred: bhajiFor(state.routine, today),
      slots: pattern(state.routine),
      loggedSlotIds: settledSlotIds,
      nowMinutes: minute,
    });
    const slot = plan.slots.find((s) => s.id === plan.nowId) ?? plan.slots[0];
    return coachAdvice({
      today,
      hour,
      minute,
      budget,
      meals: state.meals,
      water: state.water,
      sleep: state.sleep,
      weights: state.weights,
      steps: app.stepsToday,
      waterGoalMl: state.settings.waterGoalMl,
      weighDay: state.settings.weighDay,
      kcalTarget: targets.kcal,
      streakDays: app.streakDays,
      routine: state.routine,
      settledSlotIds,
      nextPlate: slot ? { id: slot.id, type: slot.type, budget: slot.budget, kcal: slot.kcal, names: slot.picks.map((p) => foodName(p.food, lang)) } : null,
    });
    // The minute is the clock; everything else is read when it ticks or the logs change.
  }, [minute, today, hour, budget, state.meals, state.water, state.sleep, state.weights, state.routine, state.settings.waterGoalMl, state.settings.weighDay, state.settings.offDays, foods, targets.kcal, skippedToday, app.stepsToday, app.streakDays, lang]);
}
```

`src/components/FitsCard.tsx`: replace lines 37-51 (from `  const patternOn = state.routine.enabled;` through the `plan` memo's dependency list) with:

```tsx
  const slots = useMemo(() => pattern(state.routine), [state.routine]);
  const loggedSlotIds = useMemo(() => {
    const todayMeals = state.meals.filter((m) => m.date === today);
    return slotStates({ routine: state.routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: minute, skippedSlots: app.skippedToday })
      .filter((s) => s.status === 'done' || s.status === 'skipped')
      .map((s) => s.slot.id);
  }, [state.routine, state.meals, today, app.targets.kcal, minute, app.skippedToday]);

  const plan = useMemo(() => {
    const base = { foods, avoided: avoidedFoodIds({ ...state.routine, enabled: true }), preferred: bhajiFor(state.routine, today), seed, slots };
    return mode === 'day' ? fullDayPlan({ ...base, remaining: app.targets.kcal }) : dayPlan({ ...base, remaining: budget.remaining, hour, loggedSlotIds, nowMinutes: minute });
  }, [mode, app.targets.kcal, budget.remaining, hour, loggedSlotIds, minute, foods, state.routine, today, seed, slots]);
```

`src/app/(tabs)/coach.tsx`: replace

```tsx
      const todayMeals = app.state.meals.filter((m) => m.date === app.today);
      const loggedTypes = Array.from(new Set(todayMeals.map((m) => m.type)));
      // With the pattern on, the plates are its slots still to eat, the way the fits card shows them.
      const patternOn = app.state.routine.enabled;
      const clock = new Date();
      const nowMinutes = clock.getHours() * 60 + clock.getMinutes();
      const loggedSlotIds = patternOn
        ? slotStates({ routine: app.state.routine, target: app.targets.kcal, meals: todayMeals, nowMinutes, skippedSlots: app.skippedToday })
            .filter((s) => s.status === 'done' || s.status === 'skipped')
            .map((s) => s.slot.id)
        : [];
      const dp = dayPlan({
        remaining: app.budget.remaining,
        hour: app.hour,
        loggedTypes,
        foods: app.foods,
        avoided,
        preferred: patternOn ? bhajiFor(app.state.routine, app.today) : [],
        slots: patternOn ? pattern(app.state.routine) : undefined,
        loggedSlotIds,
        nowMinutes,
      });
```

with

```tsx
      const todayMeals = app.state.meals.filter((m) => m.date === app.today);
      // The plates are the pattern's slots still to eat, the way the fits card shows them.
      const clock = new Date();
      const nowMinutes = clock.getHours() * 60 + clock.getMinutes();
      const loggedSlotIds = slotStates({ routine: app.state.routine, target: app.targets.kcal, meals: todayMeals, nowMinutes, skippedSlots: app.skippedToday })
        .filter((s) => s.status === 'done' || s.status === 'skipped')
        .map((s) => s.slot.id);
      const dp = dayPlan({
        remaining: app.budget.remaining,
        hour: app.hour,
        foods: app.foods,
        avoided,
        preferred: bhajiFor(app.state.routine, app.today),
        slots: pattern(app.state.routine),
        loggedSlotIds,
        nowMinutes,
      });
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/core/__tests__/coach.test.ts src/core/__tests__/dayPlan.test.ts src/core/__tests__/offlineCoach.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean. `grep -rn "MEAL_WINDOWS" src/core` lists only `nutrition.ts` (the definition, `mealTypeForHour`, `mealsRemaining`) and `routine.ts` (`DEFAULT_SLOTS`).

- [ ] **Step 9: Commit**

```bash
git add src/core/coach.ts src/core/dayPlan.ts src/core/offlineCoach.ts src/components/useCoach.ts src/components/FitsCard.tsx "src/app/(tabs)/coach.tsx" src/core/__tests__/coach.test.ts src/core/__tests__/dayPlan.test.ts src/core/__tests__/offlineCoach.test.ts
git commit -m "$(cat <<'EOF'
The coach, the plates and the offline answers go by the pattern's slots and their ids: the meal due is the slot whose turn it is, late dinner follows the dinner slot's own time, and with two snack slots each gets its own plate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Tile maths and the walk log

**Files:**
- Create: `src/core/tiles.ts`
- Modify: `src/core/activity.ts` (imports lines 1-3; append `walkLog`)
- Test: `src/core/__tests__/tiles.test.ts` (new), `src/core/__tests__/activity.test.ts`

**Interfaces:**
- Consumes: `ACTIVITIES` (`src/data/activities.ts`), `kcalBurned`, `burnedOn`, `eatBack` (`activity.ts`), `toISODate` (`date.ts`), `WeightLog` (`types.ts`).
- Produces:
  - `tiles.ts`: `fillFraction(amount: number, goal: number): number`, `type WaterTile = { fraction: number; bottlesLeft: number; reached: boolean }`, `waterTile(ml: number, goalMl: number, bottleMl: number): WaterTile`, `type WalkTile = { fraction: number; minutesLeft: number; reached: boolean }`, `walkTile(minutes: number, goalMin: number): WalkTile`, `sleepFraction(minutes: number, targetMinutes: number): number`, `streakFraction(streak: number, best: number): number`, `type Point = { x: number; y: number }`, `weightPoints(weights: WeightLog[], width?: number, height?: number, count?: number): Point[]`.
  - `activity.ts`: `WALK_ACTIVITY_ID = 'walk'`, `walkLog(input: { id: string; date: ISODate; minutes: number; weightKg: number; now: Date }): ActivityLog`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/tiles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fillFraction, sleepFraction, streakFraction, walkTile, waterTile, weightPoints } from '../tiles';

describe('water', () => {
  it('fills toward the goal, capped at full', () => {
    expect(waterTile(1500, 3000, 500).fraction).toBe(0.5);
    expect(waterTile(4000, 3000, 500).fraction).toBe(1);
    expect(waterTile(0, 3000, 500).fraction).toBe(0);
  });

  it('counts the bottles left, rounding up, for each bottle size', () => {
    expect(waterTile(1500, 3000, 500).bottlesLeft).toBe(3);
    expect(waterTile(1500, 3000, 750).bottlesLeft).toBe(2);
    // 1.5 L left is two 1 L bottles.
    expect(waterTile(1500, 3000, 1000).bottlesLeft).toBe(2);
    expect(waterTile(2900, 3000, 500).bottlesLeft).toBe(1);
  });

  it('says the goal is reached, and keeps counting past it', () => {
    expect(waterTile(3000, 3000, 500)).toEqual({ fraction: 1, bottlesLeft: 0, reached: true });
    expect(waterTile(3500, 3000, 500).reached).toBe(true);
    expect(waterTile(2999, 3000, 500).reached).toBe(false);
  });
});

describe('walk, sleep and streak', () => {
  it('walk fills by minutes and says what is left', () => {
    expect(walkTile(10, 30)).toEqual({ fraction: 1 / 3, minutesLeft: 20, reached: false });
    expect(walkTile(40, 30)).toEqual({ fraction: 1, minutesLeft: 0, reached: true });
  });

  it('sleep and streak are capped at full; the streak is full at the best one', () => {
    expect(sleepFraction(240, 480)).toBe(0.5);
    expect(sleepFraction(600, 480)).toBe(1);
    expect(streakFraction(5, 10)).toBe(0.5);
    expect(streakFraction(12, 10)).toBe(1);
    expect(streakFraction(0, 0)).toBe(0);
  });

  it('a goal of zero is full once anything is logged', () => {
    expect(fillFraction(0, 0)).toBe(0);
    expect(fillFraction(1, 0)).toBe(1);
  });
});

describe('weightPoints', () => {
  const w = (date: string, kg: number) => ({ date, kg });

  it('takes the last eight weigh-ins, oldest first, across a 100 × 42 box with heavier higher', () => {
    const logs = [w('2026-08-01', 105), ...Array.from({ length: 8 }, (_, i) => w(`2026-09-0${i + 1}`, 100 - i))];
    const pts = weightPoints(logs);
    expect(pts).toHaveLength(8);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 14.3, y: 6 });
    expect(pts[7]).toEqual({ x: 100, y: 42 });
  });

  it('sorts by date, puts equal weights in the middle, and one weigh-in in the centre', () => {
    expect(weightPoints([w('2026-09-02', 98), w('2026-09-01', 98)]).map((p) => p.y)).toEqual([21, 21]);
    expect(weightPoints([w('2026-09-01', 98)])).toEqual([{ x: 50, y: 21 }]);
    expect(weightPoints([])).toEqual([]);
  });
});
```

In `src/core/__tests__/activity.test.ts`, change the `../activity` import to:

```ts
import { activitiesFor, burnedOn, eatBack, fatGrams, kcalBurned, walkLog, weekActivity } from '../activity';
```

and append:

```ts
describe('walkLog', () => {
  it('a walk tap is a normal-effort walk that the earned calories count the usual way', () => {
    const now = new Date('2026-10-27T18:05:00');
    const log = walkLog({ id: 'w1', date: '2026-10-27', minutes: 10, weightKg: 80, now });
    expect(log).toMatchObject({ id: 'w1', date: '2026-10-27', activityId: 'walk', minutes: 10, intensity: 1, kcal: kcalBurned(walk, 1, 10, 80) });
    expect(log.at).toBe(now.toISOString());
    expect(burnedOn([log], '2026-10-27')).toBe(log.kcal);
    expect(eatBack(burnedOn([log, { ...log, id: 'w2' }], '2026-10-27'))).toBe(eatBack(2 * log.kcal));
  });

  it('a walk added to an earlier day is placed at noon of that day', () => {
    const log = walkLog({ id: 'w1', date: '2026-10-25', minutes: 10, weightKg: 80, now: new Date('2026-10-27T18:05:00') });
    expect(log.at).toBe(new Date('2026-10-25T12:00:00').toISOString());
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/tiles.test.ts src/core/__tests__/activity.test.ts`
Expected: FAIL: "Failed to resolve import "../tiles"" and "walkLog is not a function".

- [ ] **Step 3: Create `src/core/tiles.ts`**

```ts
import type { WeightLog } from './types';

/**
 * The numbers behind the living tiles, so every tile reads the same way and
 * each can be tested: how full the art is, what is left, whether the goal is
 * reached, and where the weight line runs. Fractions never pass 1; a tile at
 * its goal stays full while further taps are still counted.
 */

/** How full a tile is: amount over goal, from 0 to 1. A goal of 0 is full once anything is logged. */
export function fillFraction(amount: number, goal: number): number {
  if (!(goal > 0)) return amount > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, amount / goal));
}

export type WaterTile = { fraction: number; bottlesLeft: number; reached: boolean };

/** Water in bottles: the bottles still to drink are rounded up, so half a bottle left is one bottle. */
export function waterTile(ml: number, goalMl: number, bottleMl: number): WaterTile {
  const reached = ml >= goalMl;
  const bottlesLeft = reached || !(bottleMl > 0) ? 0 : Math.ceil((goalMl - ml) / bottleMl);
  return { fraction: fillFraction(ml, goalMl), bottlesLeft, reached };
}

export type WalkTile = { fraction: number; minutesLeft: number; reached: boolean };

/** Walking in minutes toward the day's goal. */
export function walkTile(minutes: number, goalMin: number): WalkTile {
  return { fraction: fillFraction(minutes, goalMin), minutesLeft: Math.max(0, Math.ceil(goalMin - minutes)), reached: minutes >= goalMin };
}

/** The night arc: minutes slept over the target. */
export function sleepFraction(minutes: number, targetMinutes: number): number {
  return fillFraction(minutes, targetMinutes);
}

/** The climb: today's streak over the best one, so the climber reaches the summit at the best streak. */
export function streakFraction(streak: number, best: number): number {
  return fillFraction(streak, Math.max(best, streak));
}

export type Point = { x: number; y: number };

/**
 * The weight line: the last eight weigh-ins, oldest first, spread across a
 * 100 × 42 box. Heavier is higher on screen, so y runs down from the top: the
 * heaviest sits at 0 and the lightest at 42; all equal sit in the middle, and
 * a single weigh-in is one point in the centre.
 */
export function weightPoints(weights: WeightLog[], width = 100, height = 42, count = 8): Point[] {
  const last = [...weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-count);
  if (last.length === 0) return [];
  const kgs = last.map((w) => w.kg);
  const max = Math.max(...kgs);
  const min = Math.min(...kgs);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return last.map((w, i) => ({
    x: last.length === 1 ? width / 2 : r1((i / (last.length - 1)) * width),
    y: max === min ? height / 2 : r1(((max - w.kg) / (max - min)) * height),
  }));
}
```

- [ ] **Step 4: `walkLog` in `src/core/activity.ts`**

Replace lines 1-3 with:

```ts
import { ACTIVITIES, activityById, type Activity } from '../data/activities';
import { lastNDates, toISODate } from './date';
import type { ActivityLog, ISODate } from './types';
```

and append:

```ts
/** The activity the walk tile logs. */
export const WALK_ACTIVITY_ID = 'walk';

/**
 * A walk from the walk tile: an activity log like any other (walking, normal
 * effort, at the person's weight then), so its calories are earned back the
 * usual way. Today's is logged now; one added to an earlier day at its noon.
 */
export function walkLog(input: { id: string; date: ISODate; minutes: number; weightKg: number; now: Date }): ActivityLog {
  const walk = ACTIVITIES.find((a) => a.id === WALK_ACTIVITY_ID) ?? ACTIVITIES[0];
  const at = input.date === toISODate(input.now) ? input.now : new Date(`${input.date}T12:00:00`);
  return { id: input.id, date: input.date, at: at.toISOString(), activityId: walk.id, minutes: input.minutes, intensity: 1, kcal: kcalBurned(walk, 1, input.minutes, input.weightKg) };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/core/__tests__/tiles.test.ts src/core/__tests__/activity.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/core/tiles.ts src/core/activity.ts src/core/__tests__/tiles.test.ts src/core/__tests__/activity.test.ts
git commit -m "$(cat <<'EOF'
Tile maths: how full each tracker is, capped at full, the bottles and minutes still to go, the goal reached, and the last eight weigh-ins as a line; a walk tap is an ordinary walking log, so its calories are earned the usual way

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Logging from the plan in the store: ate as planned, auto-fill, confirming, saved meals, the walk and the streak

**Files:**
- Modify: `src/core/menu.ts` (append `dueAutoFills`; types import)
- Modify: `src/store/AppProvider.tsx` (imports; `Ctx`; `withAutoFill`; a `streakDays` memo; an auto-fill effect; the value: `removeMeal`, the old streak lines, new entries, dependency list)
- Test: `src/core/__tests__/menu.test.ts`

**Interfaces:**
- Consumes: `autoFill`, `fillFromPlan`, `mealFromLines`, `skipsAfterRemove`, `withMealConfirmed`, `withDayConfirmed`, `withSavedMeal`, `withoutSavedMeal`, `viewMenu` (Tasks 2, 4), `recordStreak` (Task 5), `walkLog` (Task 11), `withMeal` (Task 3), `planFoods` (Task 8).
- Produces:
  - `menu.ts`: `dueAutoFills(input: { state: Pick<AppState, 'profile' | 'menus' | 'routine' | 'meals' | 'slotSkips' | 'usage' | 'settings'>; now: Date; foods: FoodItem[] }): Meal[]`.
  - `Ctx`: `addMealFromPlan(date: ISODate, slotId: string, source?: MealSource): void`, `confirmMeal(id: string): void`, `confirmDay(date: ISODate): void`, `fillDayFromPlan(date: ISODate): void`, `runAutoFill(): void`, `addSavedMeal(name: string, lines: PlanLine[]): void`, `removeSavedMeal(id: string): void`, `logWalk(date: ISODate, minutes: number): string` (the new activity's id, for undo).
  - `removeMeal` marks a slot skipped when it removes a meal from the plan (`skipsAfterRemove`); `streakDays` is now `recordStreak` over the menus as shown.

Auto-fill runs only for a person who finished setup: a device holding nobody's data must stay empty, or sync would stop treating it as never used and the first sync would no longer take the account's file wholesale (`isPristine`). It never runs while one account's data is being put aside. On a phone the usage buckets are not recorded (`useUsageTracker` returns early off the web), so yesterday is only filled on the web and desktop builds; this follows the spec's rule as written.

- [ ] **Step 1: Write the failing test**

In `src/core/__tests__/menu.test.ts`, add `dueAutoFills,` to the `../menu` import list (after `copyDay`), add `import { EMPTY_STATE } from '../../store/defaults';` after the `foods.json` import, and append:

```ts
describe('dueAutoFills', () => {
  const state = {
    profile: { ...EMPTY_STATE.profile, onboarded: true },
    menus: [menu('2026-10-26', 2), menu('2026-10-27', 3)],
    routine,
    meals: [] as Meal[],
    slotSkips: [] as SlotSkip[],
    usage: [{ date: '2026-10-26', hour: 20, activeMinutes: 5 }],
    settings: { ...EMPTY_STATE.settings, offDays: [] },
  };
  const now = new Date('2026-10-27T15:00:00');

  it('fills today and, when the app was open then, yesterday', () => {
    expect(dueAutoFills({ state, now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-26-lunch', 'auto-2026-10-27-lunch']);
    expect(dueAutoFills({ state: { ...state, usage: [] }, now, foods }).map((m) => m.id)).toEqual(['auto-2026-10-27-lunch']);
  });

  it('never fills for someone who has not finished setup, and never twice', () => {
    expect(dueAutoFills({ state: { ...state, profile: { ...state.profile, onboarded: false } }, now, foods })).toEqual([]);
    const once = dueAutoFills({ state, now, foods });
    expect(dueAutoFills({ state: { ...state, meals: once }, now, foods })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/menu.test.ts`
Expected: FAIL: "dueAutoFills is not a function".

- [ ] **Step 3: `dueAutoFills` in `src/core/menu.ts`**

Change the types import to:

```ts
import type { AppState, FoodItem, ISODate, Meal, MealItem, MealSource, SavedMeal, SlotSkip } from './types';
```

and append:

```ts
/**
 * The meals the app fills in right now, across yesterday and today, for a
 * person who has finished setup; a device holding nobody's data stays empty.
 * The store calls this on open, every minute and when the app comes back to
 * the front. A meal already in the list (same id) is not returned again.
 */
export function dueAutoFills(input: {
  state: Pick<AppState, 'profile' | 'menus' | 'routine' | 'meals' | 'slotSkips' | 'usage' | 'settings'>;
  now: Date;
  foods: FoodItem[];
}): Meal[] {
  const { state, now, foods } = input;
  if (!state.profile.onboarded) return [];
  const today = toISODate(now);
  const openedDates = Array.from(new Set(state.usage.map((u) => u.date)));
  const out: Meal[] = [];
  for (const date of [addDays(today, -1), today]) {
    const menu = viewMenu(date, state.menus, state.routine, today, foods);
    out.push(...autoFill({ date, now, menu, meals: state.meals, skips: state.slotSkips, openedDates, offDays: state.settings.offDays ?? [], foods }));
  }
  return out.filter((m) => !state.meals.some((x) => x.id === m.id));
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/core/__tests__/menu.test.ts`
Expected: PASS.

- [ ] **Step 5: The store**

In `src/store/AppProvider.tsx`:

Replace the import lines

```ts
import { lastNDates, mondayOf, toISODate } from '../core/date';
```

with

```ts
import { AppState as RNAppState } from 'react-native';
import { mondayOf, toISODate } from '../core/date';
```

Replace `import { burnedOn, eatBack } from '../core/activity';` with `import { burnedOn, eatBack, walkLog } from '../core/activity';`. Delete `import { streak } from '../core/insights';` and `import { isOffDay } from '../core/week';`. After the `../core/pattern` import add `import { recordStreak } from '../core/record';`.

Replace the `../core/menu` import with:

```ts
import {
  addMenuLine,
  addSkip,
  alignMenus,
  applyWeekPlan,
  copyDay,
  dueAutoFills,
  fillFromPlan,
  mealFromLines,
  removeSkip,
  setMenuDay,
  setMenuLine,
  setMenuMeal,
  skippedOn,
  skipsAfterRemove,
  viewMenu,
  viewWeek,
  weekPlanView,
  withDayConfirmed,
  withMealConfirmed,
  withoutSavedMeal,
  withSavedMeal,
  type DayMenu,
} from '../core/menu';
```

In the `../core/types` import list add `MealSource`.

In `Ctx`, after `copyMenuDay`, add:

```ts
  /** "Ate as planned" for a slot on any date: its planned lines logged with database calories. */
  addMealFromPlan: (date: ISODate, slotId: string, source?: MealSource) => void;
  /** A meal the app filled in, confirmed as eaten. */
  confirmMeal: (id: string) => void;
  /** "Day looks right": every filled-in meal of the date confirmed. */
  confirmDay: (date: ISODate) => void;
  /** "Fill this day from plan": every open slot of an older day logged as planned. */
  fillDayFromPlan: (date: ISODate) => void;
  /** Fill in the planned meals that are due now; the store also does this on open, every minute and on coming back to the front. */
  runAutoFill: () => void;
  addSavedMeal: (name: string, lines: PlanLine[]) => void;
  removeSavedMeal: (id: string) => void;
  /** A walk from the walk tile: an activity log, so its calories are earned the usual way. Returns its id, for undo. */
  logWalk: (date: ISODate, minutes: number) => string;
```

After `withMeal`, add:

```ts
/** The planned meals due now, filled in; the same state when there is nothing to fill. */
function withAutoFill(s: AppState, now: Date): AppState {
  const due = dueAutoFills({ state: s, now, foods: [...FOODS, ...s.customFoods] });
  if (due.length === 0) return s;
  const target = dailyTargets(s.profile).kcal;
  return due.reduce((acc, m) => withMeal(acc, m, target, now), s);
}
```

After the `planFoods` memo, add:

```ts
  // Full record days in a row, judged on the menus as they show; today only counts once it is full, and never breaks the run while it is going.
  const streakDays = useMemo(
    () =>
      recordStreak({
        today,
        routine: state.routine,
        meals: state.meals,
        skips: state.slotSkips,
        offDays: state.settings.offDays ?? [],
        menuOn: (d) => viewMenu(d, state.menus, state.routine, today, planFoods),
      }),
    [today, state.routine, state.meals, state.slotSkips, state.settings.offDays, state.menus, planFoods],
  );

  // Planned meals fill themselves 90 minutes after their slot: checked once the store is loaded, then every minute and
  // whenever the app comes back to the front. Never while one account's data is being put aside.
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      if (switching.current) return;
      setState((s) => withAutoFill(s, new Date()));
    };
    const first = setTimeout(run, 0);
    const timer = setInterval(run, 60000);
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') run();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [ready]);
```

In the value, delete these three lines (the streak now comes from the memo above):

```ts
    const dates = lastNDates(60, today);
    const mealDates = new Set(state.meals.map((m) => m.date));
    const streakDays = streak(dates, (d) => mealDates.has(d) || isOffDay(state.settings.offDays, d));
```

Replace `      removeMeal: (id) => update((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) })),` with:

```ts
      removeMeal: (id) =>
        update((s) => {
          const gone = s.meals.find((m) => m.id === id);
          if (!gone) return s;
          const meals = s.meals.filter((m) => m.id !== id);
          // A meal from the plan taken away was not eaten that way: its slot is marked skipped, so it is not filled straight back.
          return { ...s, meals, slotSkips: skipsAfterRemove(s.slotSkips, gone, meals) };
        }),
```

After the `copyMenuDay` entry, add:

```ts
      addMealFromPlan: (date, slotId, source = 'plan') =>
        update((s) => {
          const now = new Date();
          const foods = [...FOODS, ...s.customFoods];
          const slot = viewMenu(date, s.menus, s.routine, today, foods).meals.find((m) => m.id === slotId);
          const meal = slot ? mealFromLines({ id: newId(), date, slot, lines: slot.lines, foods, source, now }) : null;
          return meal ? withMeal(s, meal, targets.kcal, now) : s;
        }),
      confirmMeal: (id) =>
        update((s) => {
          const meals = withMealConfirmed(s.meals, id);
          return meals === s.meals ? s : { ...s, meals };
        }),
      confirmDay: (date) =>
        update((s) => {
          const meals = withDayConfirmed(s.meals, date);
          return meals === s.meals ? s : { ...s, meals };
        }),
      fillDayFromPlan: (date) =>
        update((s) => {
          const now = new Date();
          const foods = [...FOODS, ...s.customFoods];
          const menu = viewMenu(date, s.menus, s.routine, today, foods);
          return fillFromPlan({ now, menu, meals: s.meals, skips: s.slotSkips, foods }).reduce((acc, m) => withMeal(acc, m, targets.kcal, now), s);
        }),
      runAutoFill: () => update((s) => withAutoFill(s, new Date())),
      addSavedMeal: (name, lines) =>
        update((s) => {
          const savedMeals = withSavedMeal(s.savedMeals, { id: newId(), name, lines });
          return savedMeals === s.savedMeals ? s : { ...s, savedMeals };
        }),
      removeSavedMeal: (id) =>
        update((s) => {
          const savedMeals = withoutSavedMeal(s.savedMeals, id);
          return savedMeals === s.savedMeals ? s : { ...s, savedMeals };
        }),
      logWalk: (date, minutes) => {
        const id = newId();
        update((s) => ({ ...s, activities: [...(s.activities ?? []), walkLog({ id, date, minutes, weightKg: s.profile.weightKg, now: new Date() })] }));
        return id;
      },
```

Change the value's dependency list to:

```ts
  }, [state, ready, today, hour, update, storageError, saveCloudBase, readNow, switchAccount, planFoods, streakDays]);
```

- [ ] **Step 6: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean. If lint reports `react-hooks/set-state-in-effect` on the auto-fill effect, the `setState` call has moved out of the `run` callback; it must stay inside `run`, which only timers and the AppState listener call.

- [ ] **Step 7: Check the existing screens still work**

Start the `sobat-web` configuration from `.claude/launch.json` (port 8082). In a terminal run `npm run seed | pbcopy`; in the browser console run `localStorage.setItem('sobat.state.v1', <paste>); location.reload()`. Then:

- In the console, `JSON.parse(localStorage.getItem('sobat.state.v1')).version` reads 7 after the reload, `routine.enabled` is true, and `menus`, `slotSkips` and `savedMeals` are arrays.
- Today renders; the routine card lists the slots with their planned kcal; a slot past its time + 90 minutes with something planned shows as logged (and `meals` holds an `auto-<date>-<slotId>` record with `source: 'auto'`).
- Delete that meal from History: it does not come back on the next minute, and `slotSkips` holds the slot for today.
- Food → Plan: change a quantity on Wednesday; in the console only that Wednesday's date in `menus` has a new `editedAt`, and next Wednesday (`weekMenus` of next Monday) shows the change because it starts as a copy.
- Water and the other trackers still add (one tap adds `bottleMl`, 500 ml).

Stop the server afterwards.

- [ ] **Step 8: Commit**

```bash
git add src/core/menu.ts src/store/AppProvider.tsx src/core/__tests__/menu.test.ts
git commit -m "$(cat <<'EOF'
A planned meal can be logged straight from the plan on any date, fills itself in 90 minutes after its slot today and on a yesterday the app was open, and is confirmed one by one or a whole day at once; deleting one the app filled marks its slot skipped; saved meals, a walk tap that earns calories the usual way, and a streak of full days that no longer drops to 0 every morning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Do not push.

---

## Self-review

**Checked before handing over:** every task was applied in order, from this document's own code blocks, to a scratch copy of the repo at `74c19a2`. The result typechecks (`tsc --noEmit`), lints clean with the repo's ESLint config (React Compiler rules included), and passes 733 tests (648 at the start). The per-task "expected FAIL" notes were checked for the sync, coach and offline-coach tests.

**Spec coverage (Plan 1 scope):**

1. `src/core/menu.ts`: `DayMenu`, `menuFor`, `ensureWeek` (previous week's same weekday → newest earlier same weekday → `slotPlanLines` via `planDayFor`; never overwrites), `setMenuLine` / `addMenuLine` / `setMenuMeal` (one date, stamped), `copyDay`, `alignMenu` (today and later only): **Task 2**. `autoFill` (slot time + 90 min; today, and yesterday only if opened; never off days, skipped or already-eaten slots): **Task 4**, run by the store in **Task 12**. Template → menus: **Task 6**. The old plan screen edits menus: **Task 8**.
2. `Meal.source` (missing = manual): **Task 4**. `slotSkips` replacing skip keys, read for the viewed date by `slotStates`/`withSlot`: **Task 3** (moved from `actionsDone` in **Task 6**). `savedMeals`: **Task 4** (store actions **Task 12**).
3. `src/core/record.ts`: `dayRecord` → `{ state, fromPlan }`, `weekRecord`, `recordStreak` (today with nothing yet does not break it): **Task 5**; `streakDays` uses it: **Task 12**.
4. Settings: `tabs`, `todayCards`, `features`, `reminders`, `glassMl` → `bottleMl` (500 when it was 250), `walkGoalMin` 30, `normalizeTabs`: **Task 1**.
5. Migration v7 with `STATE_VERSION = 7`: template → this week's dates (index 0 = Sunday), `routine.enabled` → true, skip keys → `slotSkips`, new defaults once, logs untouched: **Tasks 1, 6, 8**.
6. Sync: menus per date by `editedAt`, `slotSkips` and `savedMeals` per id, through `merge3`, tested with two devices on different dates and on the same date: **Task 7**.
7. `slotAt` in `pattern.ts`; `usePhotoQueue` and `expectedKcalByHour` read it or the slots: **Task 9**. `coach.ts`, `dayPlan.ts`, `useCoach.ts`, `offlineCoach.ts` by slot id: **Task 10**. `MEAL_WINDOWS` in core only seeds `DEFAULT_SLOTS` (**Task 6**) and backs `mealTypeForHour` / `mealsRemaining` for the screens listed below.
8. `src/core/tiles.ts`: fractions (water, walk, sleep, streak; capped at 1), bottles left (rounded up), goal reached, weight line points (last 8, 100 × 42, y inverted): **Task 11**.
9. `AppProvider` actions, thin over the pure functions: `skipSlot` / `unskipSlot` (**Task 3**); menu edits, `weekPlan` / `setWeekPlan`, `menuOn`, `weekMenus` (**Task 8**); `addMealFromPlan`, `confirmMeal`, `confirmDay`, `fillDayFromPlan`, `runAutoFill` (on open, every minute, on return to the front), `addSavedMeal` / `removeSavedMeal`, `logWalk` writing a walking `ActivityLog` (**Task 12**). Every added meal goes through `withMeal` → `withSlot`.

**Spec tests:** `ensureWeek` fallbacks and never overwriting, per-date edits, `alignMenu` leaving past dates, skips set and clear, "Ate as planned" on a past date with database calories, saved meals, auto-fill rules, "Day looks right", `fromPlan` (Tasks 2-4); `dayRecord` in every state including off days and today, `recordStreak` in the morning (Task 5); migration v7 (Tasks 1, 6, 8); `merge3` with menus on two devices (Task 7); `slotAt` with a 21:30 dinner and two snack slots (Task 9); `normalizeTabs` (Task 1); tank-tile maths and a walk that the earned-calories code counts (Task 11).

**Adjustments to the spec, from the code (each noted in its task):** edits and `copyDay` take the menu as shown, not a date; `alignMenu` takes `today` (and `foods`); `autoFill` takes `offDays` and `foods`; `dayRecord` takes `routine` and returns `{ state, fromPlan }`; `weekRecord` / `recordStreak` take `menuOn`; a menu slot with nothing planned does not count against a day; "custom food" is the `custom` tag, since database foods also carry `source: 'estimate'`; menus are a view and only edits (and the migrated week) are stored, with `editedAt: ''` for anything the app wrote; deleting a meal that came from the plan marks its slot skipped; `expectedKcalByHour` moves to `pattern.ts`; `weekPlan` stays in the types, always null, so a merge with an older file clears it.

**Left to later plans, on purpose:**

- Screens: the tab bar and Me reading `settings.tabs`, the week strip and record calendar reading `weekRecord` / `dayRecord`, the day's menu in past/today/future modes, the add sheet (search, Eat as planned, Same as yesterday, saved meals, stepper), the living tiles (`TankTile` and the others reading `tiles.ts`), Plan next week rebuilt on `weekMenus` (then `app.weekPlan`, `weekPlanView` and `applyWeekPlan` can go), Customize reading `todayCards`, Progress, Setup, Start a new chapter, the `weightTrend` change.
- Wiring `features.breaks`, `features.mantra` and `features.autoPlates` into the break monitor, the mantra and the fits card; until then they are stored but read by nothing.
- Reminders: the meal-time prompt with an "Ate as planned" action (`addMealFromPlan`), "Fill yesterday", "Plan next week", the Monday report, and switching the hourly nudges and the rest off by default.
- Style: theme, type scale, fonts, words; the "glasses" wording on screens that now count bottles.
- `mealTypeForHour` / `MEAL_WINDOWS` still read by six screens (`foods.tsx`, `photo.tsx`, `log.tsx`, `(tabs)/coach.tsx`, `RecipeSheet.tsx`, `SuggestSheet.tsx`); each meal they add is re-slotted by `withSlot`, and the add sheet replaces them. `budget()`'s `mealsRemaining` fallback likewise only runs with no slots.
- "Save as my meal" from a logged meal (turning items into plan lines) belongs with the add sheet.
- The core checks of `routine.enabled` (`routineFacts`, `avoidedFoodIds`, reminders, `RoutineCard`, `TomorrowCard`) stay; the store always has it true now.
