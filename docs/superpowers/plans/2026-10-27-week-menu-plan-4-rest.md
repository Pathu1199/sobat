# Week menu redesign, Plan 4 of 4: the rest (plan next week, Progress, setup, Customize, a new chapter, reminders, Settings) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the redesign. The plan screen becomes "plan next week": a week of dated rows with a status each, the week's average, a day opened in the same plan-mode menu as Today's future days, and one "Looks good, save week". Progress shows the trend, the record and the climb in five calm blocks. Setup is four short steps with empty fields. Customize lets the person choose two extra tabs and their Today cards. "Start a new chapter" restarts the climb without deleting anything. Reminders become the meal-time prompt with an "Ate as planned" button plus three optional ones, every old nudge off by default with its own switch, and Settings gets a switch for each reminder and each feature that is now off by default.

**Architecture:** Rules stay pure and tested in `src/core`: `planWeek.ts` (week rows, average, the week to open, the reviewed stamp), `progress.ts` (month grid), `setup.ts` (setup checks and the target in words), `customize.ts` (tabs and cards), `chapter.ts` (a new chapter and how far back the streak looks), and `reminders.ts` (every reminder, the weekly report, what a tap on a notification does). `insights.ts` gets a time-weighted `weightTrend`, `game.ts` a chapter start for the weekly challenge, `sync.ts` a field-by-field merge of the profile and the settings, `dayView.ts` a plan-only mode. Screens lay these out: `plan.tsx`, `(tabs)/progress.tsx`, `onboarding.tsx`, `customize.tsx` (new), `(tabs)/me.tsx`, `settings.tsx` (two new cards). `notify.ts` gains the meal category and tap handling; `useScheduledReminders.ts` is rewritten around the new `plannedReminders`; a new `useNotificationResponses.ts` acts on taps.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.25), React Native 0.86.3, expo-router ~57.0.23 (typed routes and the React Compiler on), expo-notifications ~57.0.21, react-native-svg 15.15.4, TypeScript ~6.0 strict, vitest 4.1 (TZ pinned to Asia/Kolkata; `react-native` stubbed, so tests import only `src/core/**` and `src/ui/**` modules without React Native), npm.

Spec: `docs/superpowers/specs/2026-10-27-week-menu-redesign-design.md` ("Plan next week", "Progress", "Setup", "Customize", "Start a new chapter", "Part 4: reminders", "Decisions" 4, 5, 7, 8, 9 and 13). Built on: Plan 3 (`docs/superpowers/plans/2026-10-27-week-menu-plan-3-screens.md`, all 19 tasks assumed built as written, reconciled with the built Plan 1) and Plan 1 as built at `3ff9926` (every task and both clean-ups). Later decisions: `.superpowers/sdd/progress.md`.

## Assumptions about Plan 1 and Plan 3

Before dispatching Task 1, the controller checks each line against the built code and corrects this plan's code where a name or shape differs:

1. **Plan 1, built (all tasks and both clean-ups, `3ff9926`):** `Ctx.weekMenus(monday)`, `Ctx.menuOn(date)`, `Ctx.editMenuDay(day, meals)`, `Ctx.editMenuLine(day, mealId, idx, next)`, `Ctx.isSuggestedMenu(day)` (the "suggested day" rule from the Task 8/9 fixes), `hasPlan`, `isSuggested` in `menu.ts`, `settings.reminders.{mealPrompt, fillYesterday, planWeek, weeklyReport}`, `profile.onboardedOn`, `upgradeAppSettings` cleaning `reminders` against the defaults' keys (`upgradeSwitches` in `src/store/migrate.ts`: a key added to the defaults arrives with its default, a stored value that is not true or false reads off, and a missing or broken `mealPrompt` follows the stored `nudgesEnabled`).
2. **Plan 1 Task 12 (built; the validation below used `3ff9926`):** `Ctx.addMealFromPlan(date, slotId)`, `Ctx.confirmMeal(id)`; the `streakDays` memo calls `recordStreak({` with `today,` as its first property and lists its dependencies in one array ending `planFoods, fit]` (Task 7 here adds `limit` and `state.profile.chapterStart`). The follow-up that balances the app's own suggested day to the target (`8961f73`) is in; this plan only calls `isSuggestedMenu`, whatever it compares.
3. **Plan 3, as written (reconciled with the built Plan 1 at `3ff9926`):** `dayView` (Task 13), `DayMenu` (Task 15, including the `stepperLine` and `status === 'low'` blocks quoted in Task 2 here), `WeekStrip`'s marks (Task 14), `StreakTile` (Task 5), `bar.ts` `meRows` and its test (Task 6), `(tabs)/me.tsx` (Task 6), `TabBar` after Task 11 (no `useRouter`; `TabButton({ item, focused, label, onPress })`), `(tabs)/progress.tsx` after Task 7 (`useSectionParam`), `journey.tsx`'s Weight and Streak row (Task 5), `screenTitle.ts` (Task 7), `tileText.ts` (`oneDecimal`, `signedKg`, `bestStreak` with `days?`), `UndoLine`, `TileRow`, `WeightTile`, `StreakTile`.
4. **Plan 1 decision kept:** slot prompts follow `reminders.mealPrompt` and are silent on `profile.onboardedOn`; a signed-out or reset device holds no reminders (`useReminderGate`).
5. **Whole-file rewrites keep later fixes:** Task 8 replaces `useScheduledReminders.ts` and `reminders.ts` whole, and Tasks 2, 4, 5 and 7 replace `plan.tsx`, `progress.tsx`, `onboarding.tsx` and `me.tsx`. The new files carry every change up to `3ff9926` (the `doneKey` memo reads `settledSlotIds`, as clean-up B made it); the implementer keeps any change made to those files after `3ff9926` rather than dropping it.

## Decisions taken in this plan

- **The meal prompt's "Ate as planned" button opens the app.** The coordinator asked for no app opening "where the platform allows". The installed expo-notifications says an action with `opensAppToForeground: false` reaches no listener when the app is killed (`build/Notifications.types.d.ts`, `NotificationAction.options.opensAppToForeground`), and its Android service queues such a response in memory only (`ExpoHandlingDelegate.kt`, "the listeners are not set up when the app is killed ... this code is a noop"). Logging without opening while killed needs `expo-task-manager` plus a headless task writing the state outside the store, racing the app's own saves. A tap that silently logs nothing would break the exact calorie record, so the button opens the app, which logs the planned meal at once and shows Today on that day. Flipping one boolean in `setMealCategory` (Task 9) changes this.
- **Prompts go out at the slot's own time** (the spec says "at each slot time"), not at the time plus the grace as before, and for today and the next two days (unchanged: it keeps the iOS cap of 64 pending notifications well away; every open reschedules).
- **A suggested day is "Suggested", not "low"**, in the week rows and in the plan-mode menu, unless it is under the safe minimum, which always shows. This follows the Plan 1 decision on `isSuggested`.
- **Past days of a week are read-only on the plan screen**, with a way to open them on Today; edits go date by date through `editMenu*`, never through the old whole-week `setWeekPlan`.
- **The plan screen opens on this week from Monday to Friday and on next week at the weekend**, and on the week of `?date=` when a link gives one.
- **The reviewed stamp** is `settings.reviewedWeeks` (newest eight Mondays): a small list that syncs with the settings.
- **The profile and the settings merge field by field in sync.** Both are single objects; whole-object merging lets a new chapter on one device lose to a language change on another. Same rule as before inside a field: this device's change wins.
- **A new chapter** sets `startWeightKg` to the latest weigh-in and `chapterStart` to today; the weekly challenge, the streak and the best run count from that date; badges, points and every log stay.
- **Old reminders get their own switches**: `reminders.away`, `water`, `sleepCheckin`, `dayReview` (all off by default); the hourly in-app nudges stay `nudgesEnabled`, now off by default and switched off once for stores older than version 7 (the live site's users, who migrate from version 6). The mantra notification follows `features.mantra`, the long-break notifications `features.breaks`.
- **"What fits today" plates** (`features.autoPlates`) gate the plate the coach suggests and a plates card on the Coach screen; with Plan 3 no other screen shows them.
- **Setup keeps activity and pace on its third step**, pre-set to "mostly sitting" and 0.5 kg a week: nothing else in the app edits the activity level (the pace is also in the weigh-in sheet), so leaving them out of setup would make them unchangeable.
- **Customize reorders with up and down buttons**, not drag handles: the brief asks for an accessible reorder, and a button pair works with a screen reader, a keyboard and a mouse alike.
- **Progress** is five blocks: the Weight and Streak tiles, the weight trend, three stat cards, the record calendar, and one card with the week's average and the climb (badges behind it on the climb page, History and Charts as links). Old `?s=coach` and `?s=charts` links go to the Coach and Charts pages.

## API notes (checked for the installed versions)

- **expo-notifications 57.0.21** (`docs.expo.dev/versions/v57.0.0/sdk/notifications` and `node_modules/expo-notifications/build/*.d.ts`): `setNotificationCategoryAsync(identifier, actions, options?)` (Android and iOS; "Don't use the characters `:` or `-` in your category identifier"); `NotificationAction = { identifier, buttonTitle, textInput?, options?: { isDestructive?, isAuthenticationRequired?, opensAppToForeground? } }`; `NotificationContentInput.categoryIdentifier` and `data` (the Android service reads `categoryIdentifier` too, `ArgumentsNotificationContentBuilder.java`); `addNotificationResponseReceivedListener(listener) → EventSubscription` (`.remove()`); `getLastNotificationResponse()` (synchronous; the `…Async` form is deprecated) and `clearLastNotificationResponse()`; `NotificationResponse = { notification, actionIdentifier, userText? }`, `DEFAULT_ACTION_IDENTIFIER` for a tap on the body; the docs' router examples read `getLastNotificationResponse()` at start beside the listener so a tap that launched the app is handled. Background notification tasks (`registerTaskAsync`) need `expo-task-manager`, which is not installed. Web is not supported: the app's `notify.ts` already loads expo-notifications only off the web, and the web keeps its in-app prompts.
- **expo-router ~57.0.23**: `router.navigate(href)` and `router.replace(href)` with a string that carries a query (`'/?date=2026-10-25'`); typed routes are on, so a route this plan adds (`/customize`) is written `'/customize' as never` until the dev server regenerates `.expo/types`. `useLocalSearchParams<{ date?: string }>()` on the plan screen.
- **react-native-svg 15.15.4**: `Svg` `viewBox` and `preserveAspectRatio="none"` for the sparkline (it has no marker whose place matters).
- **Intl**: `toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })` and `{ month: 'long', year: 'numeric' }`, the way `formatDayLabel` already formats dates.

## Global Constraints

- npm, not bun: every command is `npx …` or `npm …`. No new dependency is expected; any would go through `npx expo install`.
- Never push. Commit after each task; do not push at the end.
- Before a task is done: `npx tsc --noEmit`, `npx expo lint` and `npx vitest run` are all clean. Write down the test count at the start; each task says how many it adds.
- Firebase is Auth only; the data is one state file per user, synced through the relay.
- Every meal-shaped thing reads the eating pattern by slot id; every meal added goes through the store (`addMeal`, `addMealFromPlan`, `fillDayFromPlan`); calories always come from the food database × grams.
- Plain sentences in comments, no em-dashes in copy, no new `eslint-disable` lines. React Compiler rules: no synchronous set-state in an effect body, no ref reads or writes during render (writing a ref inside an effect is fine).
- The user is "the user", "they" or "the person". Do not create or edit `ios/` or `android/`.
- Commit messages are plain-English behaviour sentences ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Controls**: at least 44 pt on every platform, sized by the box itself (the web ignores `hitSlop`); `accessibilityRole` on every pressable; `aria-selected`, `aria-checked` or `aria-expanded` for state, as Plan 2 set up.
- **Words**: every string in `src/i18n/index.ts` in `en`, `mr` and `hi`, plain words (no TDEE, BMR, XP, "swaps", "day score"). New keys go before the `};` that closes each dict (`grep -n '^};' src/i18n/index.ts` prints en, mr, hi in that order). Changed values are given byte for byte.
- **Style** (Plan 2): `F` sizes with `lh()`, weights `'400'`/`'500'`, colours from `C` (teal words `C.accentText`, words on teal `C.onAccent`), normal-case labels, no `fontFamily`, no `letterSpacing`, no gradients, no emoji in food rows, at most five blocks per screen.
- **Verification greps** after each UI task, on the files it touched: `grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|LinearGradient|hitSlop" <files>` and `grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint|desc)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" <files>` print nothing.

## File Structure

Created:

| File | Responsibility |
|---|---|
| `src/core/planWeek.ts` | The plan screen's week: rows with a status, the main dish, the average, the week to open, the reviewed stamp |
| `src/core/progress.ts` | The record calendar's month grid and month steps |
| `src/core/setup.ts` | Setup checks (adult year, height, weight, goal not under the healthy minimum) and the target in words |
| `src/core/customize.ts` | Extra tabs (at most two, replace a third), Today cards (switch, move, every card once), reset |
| `src/core/chapter.ts` | A new chapter's profile fields, and how many days the streak may look back |
| `src/app/customize.tsx` | Customize |
| `src/components/WeightTrendCard.tsx`, `RecordCalendar.tsx`, `ChapterSheet.tsx`, `ReminderSettings.tsx`, `FeatureSettings.tsx` | Progress's trend and calendar; the new chapter sheet; the two new Settings cards |
| `src/services/useNotificationResponses.ts` | Acts on a tap on a notification or its "Ate as planned" button |
| Tests | `src/core/__tests__/planWeek.test.ts`, `progress.test.ts`, `setup.test.ts`, `customize.test.ts`, `chapter.test.ts` |

Modified: `src/core/dayView.ts`, `insights.ts`, `weekStrip.ts`, `date.ts`, `game.ts`, `sync.ts`, `reminders.ts` (rewritten), `pushSchedule.ts`, `bar.ts`, `screenTitle.ts`, `types.ts`; `src/store/defaults.ts`, `migrate.ts`, `AppProvider.tsx`; `src/services/notify.ts`, `useScheduledReminders.ts` (rewritten), `useMantra.ts`, `useBreakMonitor.tsx`; `src/components/DayMenu.tsx`, `WeekStrip.tsx`, `TabBar.tsx`, `TopBarActions.tsx`, `MountainCard.tsx`, `useCoach.ts`, `tiles/StreakTile.tsx`; `src/app/plan.tsx` (rewritten), `(tabs)/progress.tsx` (rewritten), `onboarding.tsx` (rewritten), `(tabs)/me.tsx` (rewritten), `journey.tsx`, `guide.tsx`, `settings.tsx`, `(tabs)/coach.tsx`, `_layout.tsx`; `src/i18n/index.ts`; tests `dayView.test.ts`, `insights.test.ts`, `weekStrip.test.ts`, `date.test.ts`, `game.test.ts`, `sync.test.ts`, `reminders.test.ts` (rewritten), `migrate.test.ts`, `bar.test.ts`.

---

### Task 1: The plan screen's week, worked out

**Files:**
- Create: `src/core/planWeek.ts`, `src/core/__tests__/planWeek.test.ts`
- Modify: `src/core/dayView.ts` (the input type; the `mode` line), `src/core/__tests__/dayView.test.ts` (append)
- Modify: `src/core/types.ts` (`Settings`: one optional field)

**Interfaces:**
- Consumes: `hasPlan`, `DayMenu` (`menu.ts`), `dayStatus`, `dayTotals`, `lineInfo`, `roleOf`, `PlanMeal` (`weekPlan.ts`), `isOffDay` (`week.ts`), `addDays`, `mondayOf` (`date.ts`).
- Produces: `type PlanRowStatus = 'on' | 'high' | 'low' | 'off' | 'suggested' | 'empty'`, `type PlanRow = { date; weekday; kcal; protein; mainFoodId: string | null; status; past: boolean }`, `planWeekRows(input: { week: DayMenu[]; today; target; floor; offDays; foods; suggested: (d: DayMenu) => boolean }): PlanRow[]`, `mainDish(day: { meals: PlanMeal[] }, foods): string | null`, `weekAverage(rows, target): { avg: number; diff: number } | null`, `defaultPlanWeek(today): ISODate`, `withReviewedWeek(list: ISODate[] | undefined, monday): ISODate[]`; `dayView` input gains `planOnly?: boolean`; `Settings.reviewedWeeks?: ISODate[]`.

The status follows `dayStatus`: on target (also "a little under", which the app calls fine), "high", or "low" (under 85% of the target or under the safe minimum). A day the app built and nobody changed (`isSuggestedMenu`) is "Suggested" rather than "low", unless it is under the safe minimum. An off day is "off" whatever it holds; a day with nothing planned is "empty".

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/planWeek.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import type { DayMenu } from '../menu';
import { defaultPlanWeek, mainDish, planWeekRows, weekAverage, withReviewedWeek } from '../planWeek';
import type { FoodItem } from '../types';
import { dayTotals } from '../weekPlan';

const foods = foodsJson as unknown as FoodItem[];
const day = (date: string, lines: { foodId: string; unit: string; qty: number }[]): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines }] });
const kcal = (d: DayMenu) => dayTotals({ meals: d.meals }, foods).kcal;
// 26 October 2026 is a Monday; today is Wednesday the 28th.
const TODAY = '2026-10-28';

describe('planWeekRows', () => {
  // Bread and rice are sides: the bhaji is the main dish.
  const thali = [{ foodId: 'chapati', unit: 'piece', qty: 4 }, { foodId: 'palak-bhaji', unit: 'katori', qty: 1 }, { foodId: 'steamed-rice', unit: 'katori', qty: 1 }];
  const week: DayMenu[] = [
    day('2026-10-26', thali),
    day('2026-10-27', []),
    day('2026-10-28', thali),
    day('2026-10-29', thali),
    day('2026-10-30', [...thali, { foodId: 'chapati', unit: 'piece', qty: 6 }]),
    day('2026-10-31', [{ foodId: 'chapati', unit: 'piece', qty: 1 }]),
    day('2026-11-01', thali),
  ];
  const target = kcal(week[3]);
  // A low floor, so the one-chapati day is the only one under it.
  const rows = planWeekRows({ week, today: TODAY, target, floor: 300, offDays: [1], foods, suggested: (d) => d.date === '2026-10-28' });

  it('gives each day a status: off, empty, suggested, on target, high, low', () => {
    expect(rows.map((r) => r.status)).toEqual(['off', 'empty', 'suggested', 'on', 'high', 'low', 'on']);
  });

  it('names the main dish, not the bread, and marks the days already past', () => {
    expect(rows[3].mainFoodId).toBe('palak-bhaji');
    expect(rows[5].mainFoodId).toBe('chapati');
    expect(rows[1].mainFoodId).toBeNull();
    expect(rows.map((r) => r.past)).toEqual([true, true, false, false, false, false, false]);
    expect(rows.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('a suggestion under the safe minimum is low all the same', () => {
    const tiny = planWeekRows({ week: [day('2026-10-29', [{ foodId: 'chapati', unit: 'piece', qty: 1 }])], today: TODAY, target: 1800, floor: 1500, offDays: [], foods, suggested: () => true });
    expect(tiny[0].status).toBe('low');
  });

  it('averages the planned days, off and empty ones left out', () => {
    const avg = weekAverage(rows, target)!;
    const counted = [2, 3, 4, 5, 6].map((i) => rows[i].kcal);
    expect(avg.avg).toBe(Math.round(counted.reduce((a, b) => a + b, 0) / counted.length));
    expect(avg.diff).toBe(avg.avg - target);
    expect(weekAverage(rows.slice(0, 2), target)).toBeNull();
  });
});

describe('the week to open and the reviewed stamp', () => {
  it('opens this week on a weekday and next week at the weekend', () => {
    expect(defaultPlanWeek('2026-10-28')).toBe('2026-10-26');
    expect(defaultPlanWeek('2026-10-30')).toBe('2026-10-26');
    expect(defaultPlanWeek('2026-10-31')).toBe('2026-11-02');
    expect(defaultPlanWeek('2026-11-01')).toBe('2026-11-02');
  });

  it('keeps the eight newest reviewed weeks, each once', () => {
    const once = withReviewedWeek(undefined, '2026-10-26');
    expect(once).toEqual(['2026-10-26']);
    expect(withReviewedWeek(once, '2026-10-26')).toBe(once);
    const many = Array.from({ length: 9 }, (_, i) => `2026-0${i % 9 + 1}-01`).reduce((l, m) => withReviewedWeek(l, m), [] as string[]);
    expect(many).toHaveLength(8);
    expect(many[0]).toBe('2026-09-01');
  });

  it('a day with nothing planned has no main dish', () => {
    expect(mainDish({ meals: [] }, foods)).toBeNull();
  });
});
```

In `src/core/__tests__/dayView.test.ts`, append inside the `describe('a future day', ...)` block, after its last `it(...)`:

```ts
  it('plan-only shows any date as plan, today included, so the plan screen can edit it', () => {
    expect(states(view(TODAY, [], { planOnly: true }))).toEqual(['plan', 'plan', 'plan', 'plan']);
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/planWeek.test.ts src/core/__tests__/dayView.test.ts`
Expected: FAIL: `Failed to resolve import "../planWeek"`; the new `dayView` test gets `['current', 'later', 'later', 'later']`.

- [ ] **Step 3: Create `src/core/planWeek.ts`**

```ts
import { addDays, mondayOf } from './date';
import { hasPlan, type DayMenu } from './menu';
import type { FoodItem, ISODate } from './types';
import { isOffDay } from './week';
import { dayStatus, dayTotals, lineInfo, roleOf, type PlanMeal } from './weekPlan';

/**
 * The plan screen's week: one row per date with its total, its main dish
 * and a status against the target, the week's average, the week the screen
 * opens on, and the stamp that says a week was looked over. Pure.
 */
export type PlanRowStatus = 'on' | 'high' | 'low' | 'off' | 'suggested' | 'empty';
export type PlanRow = {
  date: ISODate;
  /** Date.getDay(): 0 is Sunday. */
  weekday: number;
  kcal: number;
  protein: number;
  mainFoodId: string | null;
  status: PlanRowStatus;
  /** Before today: history, shown but not edited here. */
  past: boolean;
};

/** Parts of a plate that are not its main dish. */
const SIDES = ['bread', 'rice', 'drink', 'dairy'];

/** The day's main dish: the planned food with the most calories that is not bread, rice, a drink or milk; else the one with the most calories. */
export function mainDish(day: { meals: PlanMeal[] }, foods: FoodItem[]): string | null {
  let best: { id: string; kcal: number } | null = null;
  let any: { id: string; kcal: number } | null = null;
  for (const m of day.meals) {
    for (const l of m.lines) {
      const info = lineInfo(l, foods);
      if (!info) continue;
      if (!any || info.kcal > any.kcal) any = { id: info.food.id, kcal: info.kcal };
      if (!SIDES.includes(roleOf(info.food)) && (!best || info.kcal > best.kcal)) best = { id: info.food.id, kcal: info.kcal };
    }
  }
  return (best ?? any)?.id ?? null;
}

export function planWeekRows(input: {
  week: DayMenu[];
  today: ISODate;
  target: number;
  floor: number;
  offDays: number[];
  foods: FoodItem[];
  /** A day the app built from the pattern and nobody changed. */
  suggested: (d: DayMenu) => boolean;
}): PlanRow[] {
  return input.week.map((d) => {
    const totals = dayTotals({ meals: d.meals }, input.foods);
    let status: PlanRowStatus;
    if (isOffDay(input.offDays, d.date)) status = 'off';
    else if (!hasPlan(d)) status = 'empty';
    else if (input.suggested(d) && totals.kcal >= input.floor) status = 'suggested';
    else {
      const s = dayStatus(totals.kcal, input.target, input.floor);
      status = s === 'over' ? 'high' : s === 'low' ? 'low' : 'on';
    }
    return {
      date: d.date,
      weekday: new Date(`${d.date}T12:00:00`).getDay(),
      kcal: totals.kcal,
      protein: totals.protein,
      mainFoodId: mainDish(d, input.foods),
      status,
      past: d.date < input.today,
    };
  });
}

/** The planned calories a day on average, off and empty days left out, and how far that is from the target. Null with nothing planned. */
export function weekAverage(rows: PlanRow[], target: number): { avg: number; diff: number } | null {
  const counted = rows.filter((r) => r.status !== 'off' && r.status !== 'empty');
  if (counted.length === 0) return null;
  const avg = Math.round(counted.reduce((a, r) => a + r.kcal, 0) / counted.length);
  return { avg, diff: avg - target };
}

/** The week the plan screen opens on: this one from Monday to Friday, the next one at the weekend, when it is the one to plan. */
export function defaultPlanWeek(today: ISODate): ISODate {
  const wd = new Date(`${today}T12:00:00`).getDay();
  return wd === 0 || wd === 6 ? addDays(mondayOf(today), 7) : mondayOf(today);
}

/** Weeks marked as looked over, newest first, the eight newest kept. The same list when the week is already in it. */
export function withReviewedWeek(list: ISODate[] | undefined, monday: ISODate): ISODate[] {
  const prev = list ?? [];
  if (prev.includes(monday)) return prev;
  return [monday, ...prev].sort((a, b) => b.localeCompare(a)).slice(0, 8);
}
```

- [ ] **Step 4: `planOnly` in `src/core/dayView.ts`, and the stamp's field**

In `dayView`'s input type, after `  lang: Lang;` add:

```ts
  /** Show any date as its plan, today and past days included: the plan screen edits a day's menu, it does not log it. */
  planOnly?: boolean;
```

and replace `  const mode = dayMode(input.date, input.today);` with:

```ts
  const mode: DayMode = input.planOnly ? 'future' : dayMode(input.date, input.today);
```

In `src/core/types.ts`, in `Settings`, after the `reminders` field add:

```ts
  /** Mondays of the weeks the person looked over and saved on the plan screen, newest first. */
  reviewedWeeks?: ISODate[];
```

- [ ] **Step 5: Run the tests, then the gate**

Run: `npx vitest run src/core/__tests__/planWeek.test.ts src/core/__tests__/dayView.test.ts`
Expected: PASS (8 new tests).

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 8 more tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/planWeek.ts src/core/__tests__/planWeek.test.ts src/core/dayView.ts src/core/__tests__/dayView.test.ts src/core/types.ts
git commit -m "$(cat <<'EOF'
The plan screen's week is worked out in one tested place: each date's total, its main dish and a status of on target, high, low, off, nothing planned, or suggested for a day the app built (low all the same under the safe minimum), the week's average, the week to open (next week at the weekend), and a stamp for a week looked over; the day's menu can be shown as a plan on any date

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Plan next week

**Files:**
- Modify (whole file): `src/app/plan.tsx`
- Modify: `src/components/DayMenu.tsx` (props; the `stepperLine`; the low-plan block)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: Task 1, `Ctx.weekMenus`, `Ctx.editMenuDay`, `Ctx.editMenuLine`, `Ctx.isSuggestedMenu`, `Ctx.planFoods`, `Ctx.setSettings`, `dayView`, `DayMenu` and `AddSheetProvider` (Plan 3), `balanceDay`, `swapsFor`, `lineInfo`, `weekPlanView`, `GrocerySheet`, `FoodThumb`, `IconButton`, `formatDayMonth`.
- Produces: the plan screen at `/plan`, Food → Plan and the `plan-tab` route, opening on `?date=`'s week and day when given, with its own add sheet (`/plan` is outside the tabs, where Plan 3 mounts the shared one); `DayMenu` gains `onLinePress?: (row: MenuRow, line: RowLine) => void` and `onBalance?: () => void`; i18n `planweek_*`.

From top to bottom: the week's dates with arrows; one row per day (the day, its main dish, its total, a status); the week's average against the goal with "Looks good, save week"; the grocery list; and, once a day is tapped, that day in the same plan-mode menu as Today's future days, with Balance, the day-off switch and a swap sheet behind each food's name. A past day opens read-only with a way to Today. Every edit is per date (`editMenuDay`, `editMenuLine`, the add sheet's plan mode).

`DayMenu` also learns the suggested-day rule: on a future day the app built, it says "Suggested plan, X kcal" in grey instead of the red "too little" line, and under the safe minimum it still warns, in amber; its button is Balance when the screen gives one (the plan screen), else a link to the plan screen at that date.

- [ ] **Step 1: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  planweek_save: 'Looks good, save week', planweek_reviewed: 'This week is saved', planweek_saved: 'Week saved',
  planweek_average: 'Average {avg} kcal a day, goal {goal}', planweek_on: 'On target', planweek_high: 'High', planweek_low: 'Low',
  planweek_off: 'Day off', planweek_suggested: 'Suggested', planweek_empty: 'Nothing planned',
  planweek_row_a11y: '{day}: {dish}, {kcal} kcal, {status}', planweek_swap_a11y: 'Swap {food}',
  planweek_past_note: 'This day has passed. What was eaten is filled in on Today.', planweek_open_today: 'Open on Today',
```

Before the `};` that closes `mr`:

```ts
  planweek_save: 'बरोबर आहे, आठवडा जतन करा', planweek_reviewed: 'हा आठवडा जतन केला', planweek_saved: 'आठवडा जतन केला',
  planweek_average: 'रोज सरासरी {avg} kcal, लक्ष्य {goal}', planweek_on: 'लक्ष्यावर', planweek_high: 'जास्त', planweek_low: 'कमी',
  planweek_off: 'सुट्टी', planweek_suggested: 'सुचवलेलं', planweek_empty: 'काही ठरवलेलं नाही',
  planweek_row_a11y: '{day}: {dish}, {kcal} kcal, {status}', planweek_swap_a11y: '{food} ऐवजी दुसरं निवडा',
  planweek_past_note: 'हा दिवस गेला. काय खाल्लं ते आजच्या पानावर भरा.', planweek_open_today: 'आजच्या पानावर उघडा',
```

Before the `};` that closes `hi`:

```ts
  planweek_save: 'ठीक है, हफ़्ता सहेजें', planweek_reviewed: 'यह हफ़्ता सहेजा गया', planweek_saved: 'हफ़्ता सहेजा',
  planweek_average: 'रोज़ औसत {avg} kcal, लक्ष्य {goal}', planweek_on: 'लक्ष्य पर', planweek_high: 'ज़्यादा', planweek_low: 'कम',
  planweek_off: 'छुट्टी', planweek_suggested: 'सुझाया हुआ', planweek_empty: 'कुछ तय नहीं',
  planweek_row_a11y: '{day}: {dish}, {kcal} kcal, {status}', planweek_swap_a11y: '{food} की जगह कुछ और चुनें',
  planweek_past_note: 'यह दिन बीत गया. क्या खाया, वह आज वाले पन्ने पर भरें.', planweek_open_today: 'आज वाले पन्ने पर खोलें',
```

- [ ] **Step 2: `DayMenu` learns two props and the suggested-day rule (`src/components/DayMenu.tsx`)**

Replace the component's signature line

```tsx
export function DayMenu({ date, view, menu, onOpenMeal }: { date: ISODate; view: DayView; menu: Menu; onOpenMeal: (m: Meal) => void }) {
```

with

```tsx
export function DayMenu({
  date,
  view,
  menu,
  onOpenMeal,
  onLinePress,
  onBalance,
}: {
  date: ISODate;
  view: DayView;
  menu: Menu;
  onOpenMeal: (m: Meal) => void;
  /** Plan mode: a tap on a food's name, for the plan screen's swaps. */
  onLinePress?: (row: MenuRow, line: RowLine) => void;
  /** Plan mode: Balance, when the screen offers it; otherwise a too-low day links to the plan screen. */
  onBalance?: () => void;
}) {
```

Replace

```tsx
    <View key={l.idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={strong}>
          {l.name}
        </Text>
        <Text numberOfLines={1} style={small}>{`${unitWord(l.unit, t)} · ${l.grams} g · ${l.kcal} kcal`}</Text>
      </View>
```

with

```tsx
    <View key={l.idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={onLinePress ? () => onLinePress(row, l) : undefined}
        disabled={!onLinePress}
        accessibilityRole={onLinePress ? 'button' : 'text'}
        accessibilityLabel={onLinePress ? fill(t('planweek_swap_a11y'), { food: l.name }) : undefined}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: S.touch, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        <Text numberOfLines={1} style={strong}>
          {l.name}
        </Text>
        <Text numberOfLines={1} style={small}>{`${unitWord(l.unit, t)} · ${l.grams} g · ${l.kcal} kcal`}</Text>
      </Pressable>
```

Replace

```tsx
  const status = view.mode === 'future' ? dayStatus(view.plannedKcal, targets.kcal, KCAL_FLOOR[state.profile.sex]) : null;
```

with

```tsx
  const floor = KCAL_FLOOR[state.profile.sex];
  const status = view.mode === 'future' ? dayStatus(view.plannedKcal, targets.kcal, floor) : null;
  // The app's own suggestion is not the person's plan being too low: it says so in grey, and still warns under the safe minimum.
  const suggested = view.mode === 'future' && app.isSuggestedMenu(menu);
  const lowText = suggested ? (view.plannedKcal < floor ? fill(t('plan_suggested_floor'), { floor }) : null) : status === 'low' ? t('menu_plan_low') : null;
```

and replace the block

```tsx
      {status === 'low' ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.red, fontSize: F.small, lineHeight: lh(F.small) }}>{t('menu_plan_low')}</Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Pill label={t('menu_open_plan')} onPress={() => router.push('/food?s=plan')} />
          </View>
        </View>
      ) : null}
```

with

```tsx
      {suggested ? <Text style={small}>{fill(t('plan_suggested'), { kcal: view.plannedKcal })}</Text> : null}
      {lowText ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: suggested ? C.amber : C.red, fontSize: F.small, lineHeight: lh(F.small) }}>{lowText}</Text>
          <View style={{ alignSelf: 'flex-start' }}>
            {onBalance ? <Pill label={t('plan_balance')} onPress={onBalance} /> : <Pill label={t('menu_open_plan')} onPress={() => router.push({ pathname: '/plan', params: { date } })} />}
          </View>
        </View>
      ) : null}
```

- [ ] **Step 3: Replace the whole of `src/app/plan.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AddSheetProvider } from '../components/AddSheet';
import { DayMenu } from '../components/DayMenu';
import { FoodThumb } from '../components/FoodDetailSheet';
import { GrocerySheet } from '../components/GrocerySheet';
import { IconButton } from '../components/TopBarActions';
import { addDays, formatDayLabel, formatDayMonth, mondayOf } from '../core/date';
import { dayView } from '../core/dayView';
import { foodName } from '../core/foods';
import { weekPlanView, type DayMenu as Menu } from '../core/menu';
import { KCAL_FLOOR } from '../core/nutrition';
import { defaultPlanWeek, planWeekRows, weekAverage, withReviewedWeek, type PlanRow } from '../core/planWeek';
import { avoidedFoodIds, slotLabel } from '../core/routine';
import { balanceDay, lineInfo, swapsFor } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Micro, Row, Screen, Small, Toggle } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, lh, S } from '../ui/theme';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `/plan` is a page of its own, outside the tabs, so it brings the add sheet that the day's menu opens; inside the tabs this one is simply the nearer. */
export default function PlanScreen() {
  return (
    <AddSheetProvider>
      <PlanWeek />
    </AddSheetProvider>
  );
}

/**
 * Plan next week. The week's dates with arrows between weeks; one row per day
 * with its main dish, its total and a status; the week's average against the
 * goal and "Looks good, save week", which only marks the week as looked over
 * (the menus are stored as they are edited). A tapped day opens below in the
 * same plan-mode menu as Today's future days, with Balance and a swap behind
 * each food; a past day is history here and opens on Today. Every edit
 * changes that date only.
 */
function PlanWeek() {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const { state, targets, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const foods = app.planFoods;
  const floor = KCAL_FLOOR[state.profile.sex];
  const avoided = useMemo(() => avoidedFoodIds({ ...state.routine, enabled: true }), [state.routine]);
  const { date } = useLocalSearchParams<{ date?: string }>();
  const linked = typeof date === 'string' && ISO_DATE.test(date) ? date : null;

  const [monday, setMonday] = useState(() => (linked ? mondayOf(linked) : defaultPlanWeek(today)));
  const [open, setOpen] = useState<string | null>(linked);
  const [swap, setSwap] = useState<{ slotId: string; idx: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [grocery, setGrocery] = useState(false);

  const week = app.weekMenus(monday);
  const offDays = state.settings.offDays ?? [];
  const rows = planWeekRows({ week, today, target: targets.kcal, floor, offDays, foods, suggested: (d) => app.isSuggestedMenu(d) });
  const average = weekAverage(rows, targets.kcal);
  const reviewed = (state.settings.reviewedWeeks ?? []).includes(monday);
  const day = open ? week.find((d) => d.date === open) ?? null : null;
  const dayRow = day ? rows.find((r) => r.date === day.date) ?? null : null;
  const view = day ? dayView({ date: day.date, today, menu: day, meals: [], skippedIds: [], currentId: null, foods, lang, planOnly: true }) : null;

  const slotName = (id: string, type: string) => {
    const s = state.routine.slots.find((x) => x.id === id);
    return (s && slotLabel(s, lang)) || t(type);
  };
  const statusWord = (r: PlanRow) => t(`planweek_${r.status}`);

  function moveWeek(by: -1 | 1) {
    setMonday((m) => addDays(m, 7 * by));
    setOpen(null);
    setNote(null);
  }

  function saveWeek() {
    app.setSettings({ reviewedWeeks: withReviewedWeek(state.settings.reviewedWeeks, monday) });
    fb.haptic('success');
    fb.notify(t('planweek_saved'));
  }

  function balance(d: Menu) {
    const r = balanceDay({ meals: d.meals }, foods, targets.kcal, avoided, floor);
    app.editMenuDay(d, r.day.meals);
    setNote(r.changes.length ? r.changes.map((c) => fill(t(c.key), { meal: t(String(c.params.meal)).toLowerCase() })).join(' · ') : t('plan_nothing_to_change'));
    fb.haptic('success');
  }

  function toggleOff(d: string) {
    // Off days are weekdays in the settings: the same weekday is off every week, as the switch says.
    const wd = new Date(`${d}T12:00:00`).getDay();
    app.setSettings({ offDays: offDays.includes(wd) ? offDays.filter((x) => x !== wd) : [...offDays, wd].sort((a, b) => a - b) });
  }

  const swapMeal = day && swap ? day.meals.find((m) => m.id === swap.slotId) : undefined;
  const swapLine = swapMeal && swap ? swapMeal.lines[swap.idx] : undefined;
  const swapInfo = swapLine ? lineInfo(swapLine, foods, lang) : null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton name="chevron-back" label={t('strip_prev_week')} onPress={() => moveWeek(-1)} />
        <Text style={{ flex: 1, textAlign: 'center', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
          {`${formatDayMonth(week[0].date, lang)} – ${formatDayMonth(week[6].date, lang)}`}
        </Text>
        <IconButton name="chevron-forward" label={t('strip_next_week')} onPress={() => moveWeek(1)} />
      </View>

      <Card>
        {rows.map((r, i) => {
          const dish = r.mainFoodId ? foods.find((f) => f.id === r.mainFoodId) : undefined;
          const dishName = dish ? foodName(dish, lang) : t('planweek_empty');
          const tone = r.status === 'low' ? C.red : r.status === 'high' ? C.amber : r.status === 'on' ? C.accentText : C.textFaint;
          const selected = r.date === open;
          return (
            <View key={r.date}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => {
                  setOpen(selected ? null : r.date);
                  setNote(null);
                }}
                accessibilityRole="button"
                aria-selected={selected}
                accessibilityLabel={fill(t('planweek_row_a11y'), { day: formatDayLabel(r.date, lang), dish: dishName, kcal: r.kcal, status: statusWord(r) })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 56,
                  paddingHorizontal: 6,
                  borderRadius: S.radiusSm,
                  backgroundColor: selected ? C.accentDim : 'transparent',
                  opacity: pressed ? 0.7 : r.past ? 0.75 : 1,
                })}>
                <View style={{ width: 52 }}>
                  <Text style={{ color: r.date === today ? C.accentText : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{t(`wd_${r.weekday}`)}</Text>
                  <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{Number(r.date.slice(8))}</Text>
                </View>
                {dish ? <FoodThumb food={dish} size={32} /> : null}
                <Text numberOfLines={1} style={{ flex: 1, color: dish ? C.text : C.textFaint, fontSize: F.body, lineHeight: lh(F.body) }}>
                  {dishName}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{r.status === 'off' || r.status === 'empty' ? '' : `${r.kcal} kcal`}</Text>
                  <Row style={{ gap: 4 }}>
                    {r.status === 'on' ? <Ionicons name="checkmark-circle" size={F.small} color={C.accentText} /> : null}
                    <Text style={{ color: tone, fontSize: F.small, lineHeight: lh(F.small) }}>{statusWord(r)}</Text>
                  </Row>
                </View>
              </Pressable>
            </View>
          );
        })}
      </Card>

      <View style={{ gap: 8 }}>
        {average ? (
          <Small color={Math.abs(average.diff) <= targets.kcal * 0.05 ? C.textDim : C.amber}>{fill(t('planweek_average'), { avg: average.avg.toLocaleString(), goal: targets.kcal.toLocaleString() })}</Small>
        ) : null}
        <Btn label={reviewed ? t('planweek_reviewed') : t('planweek_save')} onPress={saveWeek} disabled={reviewed} />
        <Pressable
          onPress={() => setGrocery(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: S.radius, backgroundColor: C.card, borderWidth: S.hairline, borderColor: C.border, opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name="basket-outline" size={22} color={C.accentText} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{t('grocery_title')}</Text>
            <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{t('grocery_sub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textFaint} />
        </Pressable>
      </View>

      {day && dayRow && view ? (
        dayRow.past ? (
          <Card>
            <Micro>{formatDayLabel(day.date, lang)}</Micro>
            {view.rows.map((r) => (
              <View key={r.slotId} style={{ gap: 2 }}>
                <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{`${slotName(r.slotId, r.type)} · ${r.plannedKcal} kcal`}</Text>
                <Small color={C.textDim}>{r.lines.map((l) => `${l.name} ${l.qtyText}`).join(' · ') || t('menu_nothing_planned')}</Small>
              </View>
            ))}
            <Small color={C.textFaint}>{t('planweek_past_note')}</Small>
            <Btn small tone="soft" label={t('planweek_open_today')} onPress={() => router.navigate({ pathname: '/', params: { date: day.date } })} />
          </Card>
        ) : (
          <View style={{ gap: S.gap }}>
            <Card>
              <Toggle title={t('plan_free_toggle')} desc={t('plan_free_desc')} on={dayRow.status === 'off'} onToggle={() => toggleOff(day.date)} />
            </Card>
            {dayRow.status === 'off' ? null : (
              <>
                <DayMenu date={day.date} view={view} menu={day} onOpenMeal={() => {}} onLinePress={(row, l) => setSwap({ slotId: row.slotId, idx: l.idx })} onBalance={() => balance(day)} />
                <Btn small tone="soft" label={t('plan_balance')} onPress={() => balance(day)} />
                {note ? <Small color={C.textDim}>{note}</Small> : null}
              </>
            )}
          </View>
        )
      ) : null}

      <GrocerySheet open={grocery} onClose={() => setGrocery(false)} plan={weekPlanView(week)} />

      {/* Swap one food for another of the same kind, or take it out. */}
      <Sheet open={!!swapInfo} title={swapInfo ? fill(t('plan_swap_title'), { food: foodName(swapInfo.food, lang) }) : ''} onClose={() => setSwap(null)}>
        {swapInfo && swap && swapLine && day ? (
          <View style={{ gap: 6 }}>
            <Small color={C.textDim}>{fill(t('plan_swap_now'), { qty: swapLine.qty, unit: `${swapInfo.label} · ${swapInfo.grams} g`, kcal: swapInfo.kcal })}</Small>
            {swapsFor(swapLine, foods, avoided).map((s) => {
              const f = foods.find((x) => x.id === s.line.foodId);
              const info = lineInfo(s.line, foods, lang);
              if (!f || !info) return null;
              return (
                <Pressable
                  key={s.line.foodId}
                  onPress={() => {
                    app.editMenuLine(day, swap.slotId, swap.idx, s.line);
                    setSwap(null);
                    fb.haptic('light');
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
                  <FoodThumb food={f} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{foodName(f, lang)}</Text>
                    <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{`${info.label} · ${info.grams} g`}</Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{s.kcal}</Text>
                  <Text style={{ color: s.diff > 0 ? C.amber : s.diff < 0 ? C.green : C.textFaint, fontSize: F.small, lineHeight: lh(F.small), width: 44, textAlign: 'right' }}>
                    {s.diff === 0 ? '±0' : s.diff > 0 ? `+${s.diff}` : `${s.diff}`}
                  </Text>
                </Pressable>
              );
            })}
            <Btn
              small
              tone="danger"
              label={t('plan_remove')}
              onPress={() => {
                app.editMenuLine(day, swap.slotId, swap.idx, null);
                setSwap(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
```

- [ ] **Step 4: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests (the rules are Task 1's).

```bash
grep -nE "setWeekPlan|app\.weekPlan|copyToWeekdays|buildWeekPlan" src/app/plan.tsx
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|LinearGradient|hitSlop" src/app/plan.tsx src/components/DayMenu.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint|desc)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/app/plan.tsx src/components/DayMenu.tsx
```

Expected: all three print nothing (the plan screen never writes the whole week back).

- [ ] **Step 5: Commit**

```bash
git add src/app/plan.tsx src/components/DayMenu.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Plan next week: the week's dates with arrows, a row per day with its main dish, total and status, the week's average against the goal and "Looks good, save week"; a tapped day opens in the same plan menu as Today's future days with Balance, a swap behind each food and the day-off switch, a past day is read-only with a way to Today, and every edit changes only its own date; a suggested day says so in grey instead of "too little", and still warns under the safe minimum

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 3: Progress maths: the smoothed weight, the day's mark, the month grid

**Files:**
- Modify: `src/core/insights.ts` (`weightTrend`, and its call in `weeklyStats`), `src/core/__tests__/insights.test.ts`
- Modify: `src/core/weekStrip.ts` (`markOf`), `src/core/__tests__/weekStrip.test.ts` (append)
- Modify: `src/core/date.ts` (two formatters), `src/core/__tests__/date.test.ts` (append)
- Create: `src/core/progress.ts`, `src/core/__tests__/progress.test.ts`

**Interfaces:**
- Consumes: `addDays` (`date.ts`), `DayRecord` (`record.ts`).
- Produces: `timeWeightedKg(logs, from, to): number | null`; `weightTrend(logs, today): { current; change7; change21; change30 } | null` (a second argument, a new `change21`); `markOf(r: DayRecord, date, today, since): { mark: StripMark; light: boolean }`; `formatDayMonthYear(date, lang)` ("14 Mar 2027"), `formatMonthYear(date, lang)` ("October 2026"); `monthCells(month: 'YYYY-MM'): (ISODate | null)[][]`, `shiftMonth(month, by): string`.

`weightTrend` today averages the last seven entries, however far apart: three weigh-ins on one Sunday outweigh a week, and a weigh-in from a month ago stands in for this week. It becomes an average over a seven-day window of the calendar ending at the latest weigh-in on or before today, each weigh-in counting more the later in the window it is (weight 1 on the first day, 7 on the last); a change compares it with the same window 7, 21 and 30 days earlier. Charts (`growth.tsx`) keeps reading `current` and `change7`.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/insights.test.ts`, replace the whole `describe('weightTrend', ...)` block with:

```ts
describe('weightTrend', () => {
  it('compares 7-day windows rather than single days', () => {
    const logs = lastNDates(14, '2026-09-25').map((date, i) => ({ date, kg: 100 - i * 0.1 }));
    const t = weightTrend(logs, '2026-09-25')!;
    expect(t.change7).toBeLessThan(0);
  });

  it('returns null with no weigh-in on or before today', () => {
    expect(weightTrend([], '2026-09-25')).toBeNull();
    expect(weightTrend([{ date: '2026-09-30', kg: 80 }], '2026-09-25')).toBeNull();
  });

  it('counts days, not weigh-ins: many old entries do not outweigh this week', () => {
    const old = Array.from({ length: 20 }, () => ({ date: '2026-09-01', kg: 90 }));
    expect(weightTrend([...old, { date: '2026-09-25', kg: 80 }], '2026-09-25')!.current).toBe(80);
  });

  it('weighs the later days of the window more', () => {
    // Six days back counts once, today seven times: (80 + 7 × 79) / 8 = 79.125.
    expect(weightTrend([{ date: '2026-09-19', kg: 80 }, { date: '2026-09-25', kg: 79 }], '2026-09-25')!.current).toBe(79.1);
  });

  it('gives the change over three weeks, the window ending at the latest weigh-in', () => {
    const t = weightTrend([{ date: '2026-09-01', kg: 82 }, { date: '2026-09-22', kg: 79 }, { date: '2026-10-30', kg: 70 }], '2026-09-25')!;
    expect(t.current).toBe(79);
    expect(t.change21).toBe(-3);
    expect(t.change7).toBeNull();
  });
});
```

In `src/core/__tests__/weekStrip.test.ts`, change the import line `import { stripSince, swipeStep, weekStrip } from '../weekStrip';` to `import { markOf, stripSince, swipeStep, weekStrip } from '../weekStrip';` and append:

```ts
describe('markOf', () => {
  it('marks one day the way the strip does, for the calendar', () => {
    expect(markOf(r('full', true), '2026-10-20', TODAY, '2026-10-01')).toEqual({ mark: 'full', light: true });
    expect(markOf(r('partial'), '2026-10-20', TODAY, '2026-10-01')).toEqual({ mark: 'missing', light: false });
    expect(markOf(r('partial'), TODAY, TODAY, '2026-10-01')).toEqual({ mark: 'today', light: false });
    expect(markOf(r('empty'), '2026-09-20', TODAY, '2026-10-01')).toEqual({ mark: 'none', light: false });
    expect(markOf(r('planned'), '2026-10-30', TODAY, '2026-10-01')).toEqual({ mark: 'planned', light: false });
    expect(markOf(r('off', true), '2026-10-25', TODAY, '2026-10-01')).toEqual({ mark: 'off', light: false });
  });
});
```

In `src/core/__tests__/date.test.ts`, add `formatDayMonthYear` and `formatMonthYear` to the `../date` import and append:

```ts
describe('dates with the year', () => {
  it('writes the day, the short month and the year, and a month with its year', () => {
    const d = formatDayMonthYear('2027-03-14', 'en');
    expect(d).toMatch(/14/);
    expect(d).toMatch(/Mar/);
    expect(d).toMatch(/2027/);
    expect(formatMonthYear('2026-10-01', 'en')).toMatch(/October/);
    expect(formatMonthYear('2026-10-01', 'en')).toMatch(/2026/);
  });
});
```

Create `src/core/__tests__/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { monthCells, shiftMonth } from '../progress';

describe('monthCells', () => {
  it('lays a month out in weeks from Monday, blank before the 1st and after the last day', () => {
    // 1 October 2026 is a Thursday.
    const weeks = monthCells('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks[4]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('a February that starts on a Monday is four full weeks', () => {
    const weeks = monthCells('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2027-02-01');
    expect(weeks[3][6]).toBe('2027-02-28');
  });
});

describe('shiftMonth', () => {
  it('steps months across the turn of a year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-10', -12)).toBe('2025-10');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/insights.test.ts src/core/__tests__/weekStrip.test.ts src/core/__tests__/date.test.ts src/core/__tests__/progress.test.ts`
Expected: FAIL: `Failed to resolve import "../progress"`; `markOf`, `formatDayMonthYear` are not functions; the new `weightTrend` tests fail (no `change21`, the old one averages the last seven entries).

- [ ] **Step 3: `weightTrend` in `src/core/insights.ts`**

Replace the whole function `weightTrend` (from `export function weightTrend(` to its closing `}`) with:

```ts
const TREND_DAYS = 7;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** The weigh-ins from `from` to `to`, each counting its day's place in the window: 1 on the first day, 2 on the next, and so on. Null when there is none. */
export function timeWeightedKg(logs: WeightLog[], from: ISODate, to: ISODate): number | null {
  let sum = 0;
  let weight = 0;
  for (const l of logs) {
    if (l.date < from || l.date > to) continue;
    const w = Math.round((Date.parse(`${l.date}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000) + 1;
    sum += l.kg * w;
    weight += w;
  }
  return weight > 0 ? sum / weight : null;
}

/**
 * The weight smoothed over time, not over entries: a seven-day window ending
 * at the latest weigh-in on or before today, later days counting more, so
 * three weigh-ins on a Sunday do not outweigh a week and an old one never
 * stands in for this week. Each change compares it with the same window 7,
 * 21 and 30 days earlier; null where that window has no weigh-in.
 */
export function weightTrend(logs: WeightLog[], today: ISODate): { current: number; change7: number | null; change21: number | null; change30: number | null } | null {
  let end: ISODate | null = null;
  for (const l of logs) if (l.date <= today && (end === null || l.date > end)) end = l.date;
  if (end === null) return null;
  const last = end;
  const at = (back: number) => timeWeightedKg(logs, addDays(last, -back - (TREND_DAYS - 1)), addDays(last, -back));
  const now = at(0) ?? 0;
  const change = (back: number) => {
    const then = at(back);
    return then === null ? null : r1(now - then);
  };
  return { current: r1(now), change7: change(7), change21: change(21), change30: change(30) };
}
```

and in `weeklyStats`, replace `trend: weightTrend(input.weights) };` with `trend: weightTrend(input.weights, input.today) };`.

- [ ] **Step 4: `markOf` in `src/core/weekStrip.ts`**

Replace the whole function `weekStrip` (from `export function weekStrip(` to its closing `}`) with:

```ts
export function weekStrip(input: { monday: ISODate; today: ISODate; viewed: ISODate; records: DayRecord[]; since: ISODate }): StripDay[] {
  return input.records.slice(0, 7).map((r, i) => {
    const date = addDays(input.monday, i);
    return {
      date,
      weekday: (i + 1) % 7,
      day: Number(date.slice(8, 10)),
      ...markOf(r, date, input.today, input.since),
      isToday: date === input.today,
      selected: date === input.viewed,
    };
  });
}

/** One day's mark from its record, the same on the week strip and on Progress's calendar. */
export function markOf(r: DayRecord, date: ISODate, today: ISODate, since: ISODate): { mark: StripMark; light: boolean } {
  const mark: StripMark =
    r.state === 'off' ? 'off' : date > today ? 'planned' : date < since ? 'none' : r.state === 'full' ? 'full' : date === today ? 'today' : 'missing';
  return { mark, light: r.fromPlan && (mark === 'full' || mark === 'missing' || mark === 'today') };
}
```

- [ ] **Step 5: The formatters, in `src/core/date.ts`**

After the function `formatDayMonth`, add:

```ts
/** "14 Mar 2027" in the chosen language: a date far enough off to need its year. */
export function formatDayMonthYear(date: ISODate, lang: Lang): string {
  try {
    const s = new Date(date + 'T12:00:00').toLocaleDateString(LOCALE[lang] ?? 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return s && s !== 'Invalid Date' ? s : date;
  } catch {
    return date;
  }
}

/** "October 2026" in the chosen language, for any date in the month. */
export function formatMonthYear(date: ISODate, lang: Lang): string {
  try {
    const s = new Date(date + 'T12:00:00').toLocaleDateString(LOCALE[lang] ?? 'en-IN', { month: 'long', year: 'numeric' });
    return s && s !== 'Invalid Date' ? s : date.slice(0, 7);
  } catch {
    return date.slice(0, 7);
  }
}
```

- [ ] **Step 6: Create `src/core/progress.ts`**

```ts
import { addDays } from './date';
import type { ISODate } from './types';

/**
 * The record calendar on Progress: a month as weeks of seven days, Monday
 * first, blank before the first day and after the last, and the step from
 * one month to the next. Months are 'YYYY-MM'. Pure.
 */
export type MonthCell = ISODate | null;

export function monthCells(month: string): MonthCell[][] {
  const first = `${month}-01`;
  const lead = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  const cells: MonthCell[] = Array.from({ length: lead }, (): MonthCell => null);
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 7: Run the tests, then the gate**

Run: `npx vitest run src/core/__tests__/insights.test.ts src/core/__tests__/weekStrip.test.ts src/core/__tests__/date.test.ts src/core/__tests__/progress.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 8 more tests (insights 5 in place of 2, `markOf` 1, dates 1, progress 3).

- [ ] **Step 8: Commit**

```bash
git add src/core/insights.ts src/core/__tests__/insights.test.ts src/core/weekStrip.ts src/core/__tests__/weekStrip.test.ts src/core/date.ts src/core/__tests__/date.test.ts src/core/progress.ts src/core/__tests__/progress.test.ts
git commit -m "$(cat <<'EOF'
The weight trend is smoothed over a week of the calendar instead of the last seven entries, later days counting more, so a burst of weigh-ins on one day no longer outweighs the week and an old one never stands in for this week; it also gives the change over three weeks. A day's dot on the week strip is worked out by one function the calendar can share, dates can be written with their year, and a month is laid out as weeks from Monday

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Progress

**Files:**
- Create: `src/components/WeightTrendCard.tsx`, `src/components/RecordCalendar.tsx`
- Modify (whole file): `src/app/(tabs)/progress.tsx`
- Modify: `src/components/WeekStrip.tsx` (export the dot), `src/app/journey.tsx` (the tiles move to Progress; the Charts link), `src/components/TopBarActions.tsx` (the Coach link)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: Task 3, `useGame` (`MountainCard.tsx`), `planFrom`, `weeklyStats`, `weekRecord`, `dayRecord`, `stripSince`, `weightPoints` (`tiles.ts`), `toPath` (`ui/tileGeometry.ts`), `oneDecimal`, `signedKg` (`tileText.ts`), `TileRow`, `WeightTile`, `StreakTile`, `Page`.
- Produces: the Progress tab; `StripDot` exported from `WeekStrip.tsx`; i18n `progress_*`.

Five blocks: the Weight and Streak tiles; the weight trend (the smoothed weight, its change over three weeks, the last twelve weigh-ins as a line, the goal and the date it comes at the target pace, with its year); three numbers (Lost and To go from the chapter's start, and this week's full days of seven); the record calendar (a month of dots from `dayRecord`, lighter while the app's filled-in meals are not confirmed, a tap opening that day on Today); and one card with the last seven days' average against the goal, the climb as one row (level, points, a bar, the badges count; the mountain and every badge are a tap away on the climb page) and History and Charts as links. The sections Progress had (climb, charts, coach) are pages of their own already: `?s=coach` and `?s=charts` from older links go to them.

- [ ] **Step 1: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  progress_trend: 'Weight, smoothed', progress_change_3w: '{kg} kg in 3 weeks', progress_change_none: 'Weigh in over three weeks to see the change.',
  progress_goal_by: 'Goal {goal} kg around {date}', progress_goal_reached: 'Goal reached', progress_no_weight: 'No weigh-in yet. Tap Weight to add one.',
  progress_logged: 'Full days', progress_logged_value: '{n} of 7', progress_prev_month: 'Previous month', progress_next_month: 'Next month',
  progress_avg: 'Last 7 days: {avg} kcal a day on average, goal {goal}', progress_avg_none: 'No meals logged in the last 7 days.',
  progress_badges: '{n} of {of} badges', progress_climb_a11y: '{climb}: {level}, {points}, {badges}',
```

Before the `};` that closes `mr`:

```ts
  progress_trend: 'वजन, सरासरी', progress_change_3w: '३ आठवड्यांत {kg} kg', progress_change_none: 'बदल दिसण्यासाठी तीन आठवडे वजन नोंदवा.',
  progress_goal_by: 'लक्ष्य {goal} kg, साधारण {date}', progress_goal_reached: 'लक्ष्य गाठलं', progress_no_weight: 'अजून वजन नोंदलं नाही. नोंदवण्यासाठी वजनावर टॅप करा.',
  progress_logged: 'पूर्ण दिवस', progress_logged_value: '७ पैकी {n}', progress_prev_month: 'मागचा महिना', progress_next_month: 'पुढचा महिना',
  progress_avg: 'मागचे ७ दिवस: रोज सरासरी {avg} kcal, लक्ष्य {goal}', progress_avg_none: 'मागच्या ७ दिवसांत जेवण नोंदलं नाही.',
  progress_badges: '{of} पैकी {n} बॅज', progress_climb_a11y: '{climb}: {level}, {points}, {badges}',
```

Before the `};` that closes `hi`:

```ts
  progress_trend: 'वज़न, औसत', progress_change_3w: '3 हफ़्तों में {kg} kg', progress_change_none: 'बदलाव देखने के लिए तीन हफ़्ते वज़न दर्ज करें.',
  progress_goal_by: 'लक्ष्य {goal} kg, लगभग {date}', progress_goal_reached: 'लक्ष्य पूरा', progress_no_weight: 'अभी वज़न दर्ज नहीं. दर्ज करने के लिए वज़न पर टैप करें.',
  progress_logged: 'पूरे दिन', progress_logged_value: '7 में से {n}', progress_prev_month: 'पिछला महीना', progress_next_month: 'अगला महीना',
  progress_avg: 'पिछले 7 दिन: रोज़ औसत {avg} kcal, लक्ष्य {goal}', progress_avg_none: 'पिछले 7 दिनों में कोई खाना दर्ज नहीं.',
  progress_badges: '{of} में से {n} बैज', progress_climb_a11y: '{climb}: {level}, {points}, {badges}',
```

- [ ] **Step 2: Share the strip's dot (`src/components/WeekStrip.tsx`)**

Replace `function Dot({ mark, light }: { mark: StripDay['mark']; light: boolean }) {` with `export function StripDot({ mark, light }: { mark: StripDay['mark']; light: boolean }) {`, and `<Dot mark={d.mark} light={d.light} />` with `<StripDot mark={d.mark} light={d.light} />`.

- [ ] **Step 3: Create `src/components/WeightTrendCard.tsx`**

```tsx
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatDayMonthYear } from '../core/date';
import { weightTrend } from '../core/insights';
import { planFrom } from '../core/plan';
import { oneDecimal, signedKg } from '../core/tileText';
import { weightPoints } from '../core/tiles';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Small } from '../ui/components';
import { C, F, lh } from '../ui/theme';
import { toPath } from '../ui/tileGeometry';

const SPARK_W = 100;
const SPARK_H = 32;
/** Room above and below the line, so its stroke is never cut. */
const INSET = 3;

/**
 * The weight trend: the weight smoothed over the last week of the calendar,
 * its change over three weeks, the last twelve weigh-ins as a line, and the
 * goal with the date it comes at the target pace, year included.
 */
export function WeightTrendCard() {
  const { state, targets, today } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const trend = useMemo(() => weightTrend(state.weights, today), [state.weights, today]);
  const plan = useMemo(() => planFrom(state.profile, state.weights, targets, today), [state.profile, state.weights, targets, today]);
  const line = useMemo(
    () => (state.weights.length >= 2 ? toPath(weightPoints(state.weights, SPARK_W, SPARK_H - 2 * INSET, 12).map((p) => ({ x: p.x, y: p.y + INSET }))) : ''),
    [state.weights],
  );
  const goal =
    plan.toGoKg <= 0 ? t('progress_goal_reached') : plan.etaAtTarget ? fill(t('progress_goal_by'), { goal: plan.goalKg, date: formatDayMonthYear(plan.etaAtTarget, lang) }) : `${t('plan_goal')}: ${plan.goalKg} kg`;
  return (
    <Card>
      <Micro color={C.textDim}>{t('progress_trend')}</Micro>
      {trend ? (
        <>
          <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number), fontWeight: '400' }}>
            {oneDecimal(trend.current)}
            <Text style={{ color: C.textDim, fontSize: F.title, fontWeight: '400' }}> kg</Text>
          </Text>
          <Small color={trend.change21 !== null && trend.change21 < 0 ? C.green : C.textDim}>
            {trend.change21 !== null ? fill(t('progress_change_3w'), { kg: signedKg(trend.change21) }) : t('progress_change_none')}
          </Small>
          {line ? (
            <View style={{ height: 48 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Svg width="100%" height="100%" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
                <Path d={line} stroke={C.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </Svg>
            </View>
          ) : null}
        </>
      ) : (
        <Small color={C.textFaint}>{t('progress_no_weight')}</Small>
      )}
      <Small color={C.textDim}>{goal}</Small>
    </Card>
  );
}
```

- [ ] **Step 4: Create `src/components/RecordCalendar.tsx`**

```tsx
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDayLabel, formatMonthYear } from '../core/date';
import { monthCells, shiftMonth } from '../core/progress';
import { dayRecord } from '../core/record';
import { markOf, stripSince } from '../core/weekStrip';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';
import { IconButton } from './TopBarActions';
import { StripDot } from './WeekStrip';

/** Monday first, as the week strip; values are Date.getDay(). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/**
 * The record as a month: under each day the same dot as on Today's week
 * strip, lighter while meals the app filled in are not confirmed. The arrows
 * step a month, up to this one; tapping a day opens it on Today.
 */
export function RecordCalendar() {
  const app = useApp();
  const router = useRouter();
  const { state, today, menuOn } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const since = stripSince(state.profile.onboardedOn, state.meals, today);
  const weeks = useMemo(() => {
    const meals = state.meals.filter((m) => m.date.startsWith(month));
    const offDays = state.settings.offDays ?? [];
    return monthCells(month).map((week) =>
      week.map((date) => (date ? { date, ...markOf(dayRecord({ date, today, menu: menuOn(date), routine: state.routine, meals, skips: state.slotSkips, offDays }), date, today, since) } : null)),
    );
  }, [month, state.meals, state.routine, state.slotSkips, state.settings.offDays, today, menuOn, since]);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton name="chevron-back" label={t('progress_prev_month')} onPress={() => setMonth((m) => shiftMonth(m, -1))} />
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
          {formatMonthYear(`${month}-01`, lang)}
        </Text>
        <IconButton name="chevron-forward" label={t('progress_next_month')} onPress={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= thisMonth} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((wd) => (
          <Text key={wd} style={{ flex: 1, textAlign: 'center', color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>
            {t(`wd_${wd}`)}
          </Text>
        ))}
      </View>
      {weeks.map((week, i) => (
        <View key={`${month}-${i}`} style={{ flexDirection: 'row' }}>
          {week.map((d, j) =>
            d ? (
              <Pressable
                key={d.date}
                onPress={() => router.navigate({ pathname: '/', params: { date: d.date } })}
                accessibilityRole="button"
                accessibilityLabel={`${formatDayLabel(d.date, lang)}, ${t(`strip_${d.mark}`)}${d.light ? `, ${t('strip_from_plan')}` : ''}`}
                style={({ pressed }) => ({ flex: 1, minHeight: S.touch, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: S.radiusSm, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ color: d.date === today ? C.accentText : C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                  {Number(d.date.slice(8))}
                </Text>
                <StripDot mark={d.mark} light={d.light} />
              </Pressable>
            ) : (
              <View key={`blank-${j}`} style={{ flex: 1 }} />
            ),
          )}
        </View>
      ))}
    </Card>
  );
}
```

- [ ] **Step 5: Replace the whole of `src/app/(tabs)/progress.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useGame } from '../../components/MountainCard';
import { RecordCalendar } from '../../components/RecordCalendar';
import { StreakTile } from '../../components/tiles/StreakTile';
import { TileRow } from '../../components/tiles/TileRow';
import { WeightTile } from '../../components/tiles/WeightTile';
import { TopBarActions } from '../../components/TopBarActions';
import { WeightTrendCard } from '../../components/WeightTrendCard';
import { mondayOf } from '../../core/date';
import { weeklyStats } from '../../core/insights';
import { weekRecord } from '../../core/record';
import { oneDecimal } from '../../core/tileText';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Bar, Btn, Card, Divider, Micro, Row, Small, StatQuad } from '../../ui/components';
import { C, F, lh } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

/** Progress. Its old sections are pages of their own now: links that name one go there. */
export default function ProgressTab() {
  const { s } = useLocalSearchParams<{ s?: string }>();
  if (s === 'coach') return <Redirect href="/coach" />;
  if (s === 'charts') return <Redirect href="/growth" />;
  return <Progress />;
}

/**
 * Five blocks: the Weight and Streak tiles; the weight trend with the goal's
 * date; Lost, To go and this week's full days; the record calendar; and the
 * last seven days' average with the climb as one row (the mountain and the
 * badges a tap away) and History and Charts as links.
 */
function Progress() {
  const app = useApp();
  const router = useRouter();
  const g = useGame();
  const { state, targets, today, menuOn } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const fullDays = useMemo(
    () =>
      weekRecord({ monday: mondayOf(today), today, routine: state.routine, meals: state.meals, skips: state.slotSkips, offDays: state.settings.offDays ?? [], menuOn }).filter((r) => r.state === 'full')
        .length,
    [today, state.routine, state.meals, state.slotSkips, state.settings.offDays, menuOn],
  );
  const week = useMemo(
    () =>
      weeklyStats({
        today,
        meals: state.meals,
        water: state.water,
        workouts: state.workouts,
        sleep: state.sleep,
        weights: state.weights,
        kcalTarget: targets.kcal,
        waterGoalMl: state.settings.waterGoalMl,
      }),
    [today, state.meals, state.water, state.workouts, state.sleep, state.weights, targets.kcal, state.settings.waterGoalMl],
  );
  const earned = g.badges.filter((b) => b.earned).length;
  const level = t(`level_${g.level.key}`);
  const points = fill(t('points_n'), { n: g.points });
  const badges = fill(t('progress_badges'), { n: earned, of: g.badges.length });
  const avgOff = week.avgKcal > 0 && Math.abs(week.avgKcal - targets.kcal) > targets.kcal * 0.05;

  return (
    <Page title={t('tab_progress')} alt={lang === 'en' ? undefined : t('tab_progress')} right={<TopBarActions />}>
      <TileRow>
        <WeightTile />
        <StreakTile />
      </TileRow>

      <WeightTrendCard />

      <Card>
        <StatQuad
          items={[
            { label: t('plan_lost'), value: `${oneDecimal(g.plan.lostKg)} kg`, color: g.plan.lostKg > 0 ? C.green : undefined },
            { label: t('plan_to_go'), value: `${oneDecimal(g.plan.toGoKg)} kg` },
            { label: t('progress_logged'), value: fill(t('progress_logged_value'), { n: fullDays }) },
          ]}
        />
      </Card>

      <RecordCalendar />

      <Card>
        <Small color={avgOff ? C.amber : C.textDim}>
          {week.avgKcal > 0 ? fill(t('progress_avg'), { avg: week.avgKcal.toLocaleString(), goal: targets.kcal.toLocaleString() }) : t('progress_avg_none')}
        </Small>
        <Divider />
        <Pressable
          onPress={() => router.push('/journey')}
          accessibilityRole="button"
          accessibilityLabel={fill(t('progress_climb_a11y'), { climb: t('journey_title'), level, points, badges })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="flag-outline" size={20} color={C.cyan} />
          <View style={{ flex: 1, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{t('journey_title')}</Text>
              <Micro color={C.textDim}>{`${level} · ${points}`}</Micro>
            </Row>
            <Bar value={g.progress * 100} max={100} color={C.cyan} />
            <Micro color={C.textFaint}>{badges}</Micro>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
        </Pressable>
        <Divider />
        <Row style={{ gap: 8 }}>
          <Btn small tone="ghost" label={t('history')} onPress={() => router.push('/history')} style={{ flex: 1 }} />
          <Btn small tone="ghost" label={t('charts')} onPress={() => router.push('/growth')} style={{ flex: 1 }} />
        </Row>
      </Card>
    </Page>
  );
}
```

- [ ] **Step 6: The climb page and the Coach link**

In `src/app/journey.tsx`, delete the three import lines `import { StreakTile } from '../components/tiles/StreakTile';`, `import { TileRow } from '../components/tiles/TileRow';` and `import { WeightTile } from '../components/tiles/WeightTile';`, delete the block (Progress shows the tiles now)

```tsx
      <TileRow>
        <WeightTile />
        <StreakTile />
      </TileRow>
```

and replace `router.push('/progress?s=charts')` with `router.push('/growth')`.

In `src/components/TopBarActions.tsx`, replace `router.push('/progress?s=coach')` with `router.push('/coach')`.

- [ ] **Step 7: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests (the rules are Task 3's).

```bash
grep -rn "progress?s=" src
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|LinearGradient|hitSlop" "src/app/(tabs)/progress.tsx" src/components/WeightTrendCard.tsx src/components/RecordCalendar.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint|desc)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" "src/app/(tabs)/progress.tsx" src/components/WeightTrendCard.tsx src/components/RecordCalendar.tsx
```

Expected: all three print nothing.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(tabs)/progress.tsx" src/components/WeightTrendCard.tsx src/components/RecordCalendar.tsx src/components/WeekStrip.tsx src/app/journey.tsx src/components/TopBarActions.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Progress is one calm page: the Weight and Streak tiles, the weight smoothed over a week with its change over three weeks, a line of the last weigh-ins and the goal's date with its year, Lost, To go and this week's full days, a month calendar of the record whose days open on Today, and the last week's average against the goal with the climb as one row and History and Charts as links; older links to its coach and charts sections go to those pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Setup in four steps

**Files:**
- Create: `src/core/setup.ts`, `src/core/__tests__/setup.test.ts`
- Modify (whole file): `src/app/onboarding.tsx`
- Modify: `src/app/guide.tsx` (the tour moves here)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `isAdultBirthYear`, `healthyWeightRange`, `dailyTargets` (`nutrition.ts`), `planFrom`, `formatDayMonthYear` (Task 3), `Bar`, `Field`, `Pill`.
- Produces: `type SetupField = 'year' | 'height' | 'weight' | 'goal'`, `setupProblems(input: { birthYear; height; weight; goal }, now?): SetupField[]`, `setupNumber(text): number` (NaN for anything that is not a number; a decimal comma is read), `STEP_OF: Record<SetupField, 1 | 2>`; i18n `setup_*`.

Four steps with a line of progress: 1 the language; 2 about you (name, sex, birth year, height); 3 weight and goal with the healthy range for the height, then activity (starting at "mostly sitting") and the pace (starting at 0.5 kg a week); 4 the daily target in plain words ("Eat about 1,850 kcal a day, with about 95 g of protein. At 0.5 kg a week you could reach 72 kg around 14 Mar 2027."). Boxes start empty with an example in grey ("e.g. 72"); Next checks the step's answers and says what to fix. The checks stay: an adult's year in four digits, a height of 120 to 230 cm, a weight of 30 to 300 kg, and a goal no lower than the healthy minimum for the height (`healthyWeightRange(h).min`; the old screen only asked for 30 kg). Finishing sets the profile with `onboardedOn` and the first weigh-in as before, then goes to the permissions screen, which ends on Today; the tour is no longer forced and waits in Me → Guide ("Show the tour").

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/setup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { setupNumber, setupProblems, STEP_OF } from '../setup';

const NOW = new Date('2026-10-28T12:00:00');
const ok = { birthYear: '1990', height: '170', weight: '82', goal: '68' };

describe('setupProblems', () => {
  it('accepts a grown-up with sensible numbers', () => {
    expect(setupProblems(ok, NOW)).toEqual([]);
  });

  it('wants the four-digit year of an adult', () => {
    expect(setupProblems({ ...ok, birthYear: '90' }, NOW)).toEqual(['year']);
    expect(setupProblems({ ...ok, birthYear: '2015' }, NOW)).toEqual(['year']);
  });

  it('takes empty boxes as problems, never as zero', () => {
    expect(setupProblems({ birthYear: '', height: '', weight: '', goal: '' }, NOW)).toEqual(['year', 'height', 'weight', 'goal']);
    expect(setupProblems({ ...ok, height: '17o' }, NOW)).toEqual(['height']);
  });

  it('a goal under the healthy range for the height is a problem', () => {
    // 170 cm: the healthy range starts at 53 kg.
    expect(setupProblems({ ...ok, goal: '52' }, NOW)).toEqual(['goal']);
    expect(setupProblems({ ...ok, goal: '53' }, NOW)).toEqual([]);
  });
});

describe('setup answers', () => {
  it('reads a decimal comma, and puts each answer on its step', () => {
    expect(setupNumber('72,5')).toBe(72.5);
    expect(setupNumber(' 80 ')).toBe(80);
    expect(Number.isNaN(setupNumber(''))).toBe(true);
    expect(STEP_OF).toEqual({ year: 1, height: 1, weight: 2, goal: 2 });
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/setup.test.ts`
Expected: FAIL: `Failed to resolve import "../setup"`.

- [ ] **Step 3: Create `src/core/setup.ts`**

```ts
import { healthyWeightRange, isAdultBirthYear } from './nutrition';

/**
 * What setup checks before it moves on. Every box starts empty, so an empty
 * or unreadable answer is a problem, never a zero: a year of an adult in four
 * digits, a height of 120 to 230 cm, a weight of 30 to 300 kg, and a goal no
 * lower than the healthiest minimum for that height. Pure.
 */
export type SetupField = 'year' | 'height' | 'weight' | 'goal';
export type SetupInput = { birthYear: string; height: string; weight: string; goal: string };

/** The step each answer is asked on: 1 about you, 2 weight and goal. */
export const STEP_OF: Record<SetupField, 1 | 2> = { year: 1, height: 1, weight: 2, goal: 2 };

/** A number typed in a box, a decimal comma read as a point; NaN for anything else, an empty box included. */
export function setupNumber(text: string): number {
  const s = text.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function setupProblems(input: SetupInput, now: Date = new Date()): SetupField[] {
  const out: SetupField[] = [];
  const height = setupNumber(input.height);
  const weight = setupNumber(input.weight);
  const goal = setupNumber(input.goal);
  if (!isAdultBirthYear(input.birthYear, now)) out.push('year');
  const heightOk = height >= 120 && height <= 230;
  if (!heightOk) out.push('height');
  if (!(weight >= 30 && weight <= 300)) out.push('weight');
  // NaN fails every comparison, so an empty goal is a problem too.
  const min = heightOk ? healthyWeightRange(height).min : 30;
  if (!(goal >= min && goal <= 300)) out.push('goal');
  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/core/__tests__/setup.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  setup_step: 'Step {n} of 4', setup_lang_title: 'Choose your language', setup_about_title: 'About you', setup_weight_title: 'Your weight and goal',
  setup_done_title: 'Your daily target', setup_eg: 'e.g. {n}', setup_back: 'Back', setup_range: 'Healthy for your height: {min} to {max} kg',
  setup_bad_year: 'Write the year you were born in four digits. Sobat is for adults.', setup_bad_height: 'Height in centimetres, between 120 and 230.',
  setup_bad_weight: 'Weight in kilograms, between 30 and 300.', setup_bad_goal: 'Choose a goal of at least {min} kg, the lowest healthy weight for your height.',
  setup_target_line: 'Eat about {kcal} kcal a day, with about {protein} g of protein.', setup_goal_line: 'At {rate} kg a week you could reach {goal} kg around {date}.',
  setup_hold_line: 'For now the plan keeps your weight where it is.',
```

Before the `};` that closes `mr`:

```ts
  setup_step: '४ पैकी पायरी {n}', setup_lang_title: 'तुमची भाषा निवडा', setup_about_title: 'तुमच्याबद्दल', setup_weight_title: 'तुमचं वजन आणि लक्ष्य',
  setup_done_title: 'तुमचं रोजचं लक्ष्य', setup_eg: 'उदा. {n}', setup_back: 'मागे', setup_range: 'तुमच्या उंचीसाठी योग्य: {min} ते {max} kg',
  setup_bad_year: 'जन्मवर्ष चार अंकांत लिहा. Sobat प्रौढांसाठी आहे.', setup_bad_height: 'उंची सेंटिमीटरमध्ये, १२० ते २३० दरम्यान.',
  setup_bad_weight: 'वजन किलोमध्ये, ३० ते ३०० दरम्यान.', setup_bad_goal: 'किमान {min} kg चं लक्ष्य निवडा, तुमच्या उंचीसाठी सर्वात कमी योग्य वजन.',
  setup_target_line: 'रोज साधारण {kcal} kcal खा, त्यात साधारण {protein} g प्रथिनं.', setup_goal_line: 'आठवड्याला {rate} kg ने तुम्ही साधारण {date} पर्यंत {goal} kg गाठू शकता.',
  setup_hold_line: 'सध्या नियोजन तुमचं वजन आहे तसंच ठेवतं.',
```

Before the `};` that closes `hi`:

```ts
  setup_step: '4 में से कदम {n}', setup_lang_title: 'अपनी भाषा चुनें', setup_about_title: 'आपके बारे में', setup_weight_title: 'आपका वज़न और लक्ष्य',
  setup_done_title: 'आपका रोज़ का लक्ष्य', setup_eg: 'जैसे {n}', setup_back: 'पीछे', setup_range: 'आपकी लंबाई के लिए ठीक: {min} से {max} kg',
  setup_bad_year: 'जन्म का साल चार अंकों में लिखें. Sobat वयस्कों के लिए है.', setup_bad_height: 'लंबाई सेंटीमीटर में, 120 से 230 के बीच.',
  setup_bad_weight: 'वज़न किलो में, 30 से 300 के बीच.', setup_bad_goal: 'कम से कम {min} kg का लक्ष्य चुनें, आपकी लंबाई के लिए सबसे कम ठीक वज़न.',
  setup_target_line: 'रोज़ लगभग {kcal} kcal खाएँ, जिसमें लगभग {protein} g प्रोटीन.', setup_goal_line: 'हफ़्ते में {rate} kg से आप लगभग {date} तक {goal} kg पहुँच सकते हैं.',
  setup_hold_line: 'अभी योजना आपका वज़न जैसा है वैसा रखती है.',
```

- [ ] **Step 6: Replace the whole of `src/app/onboarding.tsx`**

```tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { formatDayMonthYear } from '../core/date';
import { dailyTargets, healthyWeightRange } from '../core/nutrition';
import { planFrom } from '../core/plan';
import { setupNumber, setupProblems, STEP_OF, type SetupField } from '../core/setup';
import type { Activity, Lang, Profile, Sex } from '../core/types';
import { fill, LANG_NAMES, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Field, H1, Micro, Pill, Row, Screen, Small } from '../ui/components';
import { C, F, lh } from '../ui/theme';

const STEPS = 4;

/**
 * Setup in four short steps with a line showing how far along it is: the
 * language; about you; weight and goal with the healthy range; and the daily
 * target in plain words. Boxes start empty with an example in grey; activity
 * starts at "mostly sitting" and the pace at half a kilo a week. Next checks
 * the step's answers (core/setup.ts) and says what to fix. Setup ends at the
 * permissions screen and then Today; the tour waits in Me → Guide.
 */
export default function Onboarding() {
  const app = useApp();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(app.state.profile.lang);
  const t = makeT(lang);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [birthYear, setBirthYear] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [activity, setActivity] = useState<Activity>('sedentary');
  const [rate, setRate] = useState(0.5);

  const problems = setupProblems({ birthYear, height: heightCm, weight: weightKg, goal: goalWeightKg });
  const shown = tried ? problems.filter((p) => STEP_OF[p] === step) : [];
  const height = setupNumber(heightCm);
  const range = height >= 120 && height <= 230 ? healthyWeightRange(height) : null;
  const draft: Profile = {
    name: name.trim(),
    sex,
    birthYear: Number(birthYear),
    heightCm: height,
    weightKg: setupNumber(weightKg),
    startWeightKg: setupNumber(weightKg),
    activity,
    goalWeightKg: setupNumber(goalWeightKg),
    rateKgPerWeek: rate,
    lang,
    onboarded: true,
    // Day one: no meal-time prompts until tomorrow.
    onboardedOn: app.today,
  };
  const targets = problems.length === 0 ? dailyTargets(draft) : null;
  const plan = targets ? planFrom(draft, [{ date: app.today, kg: draft.weightKg }], targets, app.today) : null;
  const problemText: Record<SetupField, string> = {
    year: t('setup_bad_year'),
    height: t('setup_bad_height'),
    weight: t('setup_bad_weight'),
    goal: fill(t('setup_bad_goal'), { min: range?.min ?? 30 }),
  };
  const heading = { color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' } as const;
  const eg = (n: number) => fill(t('setup_eg'), { n });

  function next() {
    if (problems.some((p) => STEP_OF[p] === step)) {
      setTried(true);
      return;
    }
    setTried(false);
    setStep((s) => Math.min(STEPS - 1, s + 1));
  }

  function back() {
    setTried(false);
    setStep((s) => Math.max(0, s - 1));
  }

  function finish() {
    if (problems.length > 0) return;
    app.setProfile(draft);
    app.addWeight({ date: app.today, kg: draft.weightKg });
    router.replace('/permissions');
  }

  return (
    <Screen>
      <View style={{ paddingTop: 36, gap: 8 }}>
        <H1>{t('app_name')}</H1>
        <Micro>{fill(t('setup_step'), { n: step + 1 })}</Micro>
        <Bar value={step + 1} max={STEPS} />
      </View>

      {step === 0 ? (
        <Card>
          <Text accessibilityRole="header" style={heading}>
            {t('setup_lang_title')}
          </Text>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
              <Pill key={l} label={LANG_NAMES[l]} active={lang === l} onPress={() => setLang(l)} />
            ))}
          </Row>
          <Small color={C.textFaint}>{t('tagline')}</Small>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <Text accessibilityRole="header" style={heading}>
            {t('setup_about_title')}
          </Text>
          <Field label={t('name_q')} value={name} onChangeText={setName} />
          <View style={{ gap: 7 }}>
            <Micro>{t('sex_q')}</Micro>
            <Row style={{ gap: 8 }}>
              <Pill label={t('male')} active={sex === 'male'} onPress={() => setSex('male')} />
              <Pill label={t('female')} active={sex === 'female'} onPress={() => setSex('female')} />
            </Row>
          </View>
          <Row style={{ gap: 12 }}>
            <Field label={t('birth_year_q')} value={birthYear} onChangeText={setBirthYear} keyboardType="numeric" placeholder={eg(1990)} />
            <Field label={t('height_q')} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" placeholder={eg(165)} />
          </Row>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <Text accessibilityRole="header" style={heading}>
            {t('setup_weight_title')}
          </Text>
          <Row style={{ gap: 12 }}>
            <Field label={t('weight_q')} value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" placeholder={eg(72)} />
            <Field label={t('goal_weight_q')} value={goalWeightKg} onChangeText={setGoalWeightKg} keyboardType="numeric" placeholder={eg(65)} />
          </Row>
          {range ? <Small color={C.textDim}>{fill(t('setup_range'), { min: range.min, max: range.max })}</Small> : null}
          <View style={{ gap: 7 }}>
            <Micro>{t('activity_q')}</Micro>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {(['sedentary', 'light', 'moderate', 'active'] as Activity[]).map((a) => (
                <Pill key={a} label={t(a)} active={activity === a} onPress={() => setActivity(a)} />
              ))}
            </Row>
          </View>
          <View style={{ gap: 7 }}>
            <Micro>{t('rate_q')}</Micro>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {[0.25, 0.5, 0.75, 1].map((r) => (
                <Pill key={r} label={`${r} kg`} active={rate === r} onPress={() => setRate(r)} />
              ))}
            </Row>
          </View>
        </Card>
      ) : null}

      {step === 3 && targets ? (
        <Card tone={C.accent}>
          <Text accessibilityRole="header" style={heading}>
            {t('setup_done_title')}
          </Text>
          <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number), fontWeight: '400' }}>
            {targets.kcal.toLocaleString()}
            <Text style={{ color: C.textDim, fontSize: F.title, fontWeight: '400' }}> kcal</Text>
          </Text>
          <Small>{fill(t('setup_target_line'), { kcal: targets.kcal.toLocaleString(), protein: targets.proteinG })}</Small>
          {targets.hold ? (
            <Small color={C.textDim}>{t('setup_hold_line')}</Small>
          ) : plan && plan.etaAtTarget && plan.toGoKg > 0 ? (
            <Small color={C.textDim}>{fill(t('setup_goal_line'), { rate, goal: plan.goalKg, date: formatDayMonthYear(plan.etaAtTarget, lang) })}</Small>
          ) : null}
          {targets.floored ? <Small color={C.amber}>{t('floor_note')}</Small> : null}
          <Micro>{t('medical_note')}</Micro>
        </Card>
      ) : null}

      {shown.length > 0 ? (
        <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
          {shown.map((p) => (
            <Small key={p} color={C.amber}>
              {problemText[p]}
            </Small>
          ))}
        </View>
      ) : null}

      <Row style={{ gap: 8 }}>
        {step > 0 ? <Btn tone="ghost" label={t('setup_back')} onPress={back} style={{ flex: 1 }} /> : null}
        {step < STEPS - 1 ? <Btn label={t('next')} onPress={next} style={{ flex: 1 }} /> : <Btn label={t('finish_setup')} onPress={finish} disabled={problems.length > 0} style={{ flex: 1 }} />}
      </Row>
    </Screen>
  );
}
```

- [ ] **Step 7: The tour moves to Me → Guide (`src/app/guide.tsx`)**

Add `import { useRouter } from 'expo-router';` after the `@expo/vector-icons` import; replace `import { Card, Divider, Screen, Small } from '../ui/components';` with `import { Btn, Card, Divider, Screen, Small } from '../ui/components';`; after the line `  const sections = GUIDE[lang] ?? GUIDE.en;` add `  const router = useRouter();`; and replace

```tsx
            <Small>{t('guide_sub')}</Small>
          </View>
        </View>
      </Card>
```

with

```tsx
            <Small>{t('guide_sub')}</Small>
          </View>
        </View>
        <Btn small tone="soft" label={t('show_tour')} onPress={() => router.push('/tour?from=settings')} />
      </Card>
```

- [ ] **Step 8: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 5 more tests.

```bash
grep -n "'/tour'\|useState('1998')\|useState('100')" src/app/onboarding.tsx
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|LinearGradient|hitSlop" src/app/onboarding.tsx src/app/guide.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint|desc)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/app/onboarding.tsx src/app/guide.tsx
```

Expected: all three print nothing.

- [ ] **Step 9: Commit**

```bash
git add src/core/setup.ts src/core/__tests__/setup.test.ts src/app/onboarding.tsx src/app/guide.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Setup is four short steps with a line of progress: the language, about you, weight and goal with the healthy range for the height, and the daily target in plain words with the date the goal comes. Boxes start empty with an example, activity starts at mostly sitting and the pace at half a kilo a week, a goal under the healthy minimum for the height is refused, and setup goes on to the permissions screen instead of the tour, which now waits in Guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Customize

**Files:**
- Create: `src/core/customize.ts`, `src/core/__tests__/customize.test.ts`, `src/app/customize.tsx`
- Modify: `src/core/bar.ts` (export one tab's item; Me's Customize row), `src/core/__tests__/bar.test.ts`
- Modify: `src/components/TabBar.tsx` (a long press opens Customize), `src/app/_layout.tsx` (the route), `src/core/screenTitle.ts`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `normalizeTabs`, `TAB_IDS`, `MAX_EXTRA_TABS`, `DEFAULT_TABS`, `TODAY_CARD_IDS`, `DEFAULT_TODAY_CARDS` (`tabs.ts`), `Toggle`, `IconButton`, `useFeedback().notify` with an undo action.
- Produces: `type CardSetting = { id: TodayCardId; on: boolean }`, `cardList(cards: unknown): CardSetting[]`, `toggleTab(tabs: unknown, id): { tabs: TabId[]; full: boolean }`, `replaceTab(tabs, out, id): TabId[]`, `toggleCard(cards, id): CardSetting[]`, `moveCard(cards, id, by: -1 | 1): CardSetting[]`, `defaultCustomize(): { tabs; todayCards }`; `extraItem(id: TabId): BarItem` (`bar.ts`); the `/customize` page; i18n `cust_*`, `hdr_customize`, `me_customize*`.

Two cards and a reset. The tab bar: Today, ➕ and Me shown as locked rows, then a switch for each extra tab; switching on a third does not happen behind the person's back: the page asks, on the page itself, which of the two it should replace (no `alert()`). Today's cards: "Calories left" locked at the top, then the cards that are on, each with its switch and up and down buttons (44 pt, with labels like "Move Coach line up"), then the cards that are off, each with its switch; a card switched on joins the end of the ones that are on. "Reset to default" puts back Progress as the one extra tab and the menu, coach line and water and walk cards, with Undo. The day's line card is listed while the day's line is switched on in Settings (Task 10). Me gets a Customize row before Settings, and holding any tab on the bar opens the page.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/customize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cardList, defaultCustomize, moveCard, replaceTab, toggleCard, toggleTab } from '../customize';
import { DEFAULT_TODAY_CARDS } from '../tabs';

describe('extra tabs', () => {
  it('switches one on while there is room, and off at any time', () => {
    expect(toggleTab(['progress'], 'coach')).toEqual({ tabs: ['progress', 'coach'], full: false });
    expect(toggleTab(['progress', 'coach'], 'progress')).toEqual({ tabs: ['coach'], full: false });
  });

  it('a third changes nothing and asks which one to replace; the answer takes its place', () => {
    expect(toggleTab(['progress', 'coach'], 'sleep')).toEqual({ tabs: ['progress', 'coach'], full: true });
    expect(replaceTab(['progress', 'coach'], 'progress', 'sleep')).toEqual(['sleep', 'coach']);
  });
});

describe("Today's cards", () => {
  it('lists every card once, those a saved list lacks added at the end, switched off', () => {
    const list = cardList([{ id: 'coach', on: true }, { id: 'menu', on: true }, { id: 'coach', on: false }, { id: 'nope', on: true }]);
    expect(list.map((c) => c.id)).toEqual(['coach', 'menu', 'waterWalk', 'weight', 'sleep', 'steps', 'climb', 'mantra']);
    expect(list.filter((c) => c.on).map((c) => c.id)).toEqual(['coach', 'menu']);
    expect(cardList('x')).toEqual(DEFAULT_TODAY_CARDS);
  });

  it('a card switched on joins the end of the ones that are on; switched off it keeps its place', () => {
    const on = toggleCard(DEFAULT_TODAY_CARDS, 'climb');
    expect(on.filter((c) => c.on).map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk', 'climb']);
    expect(toggleCard(on, 'coach').map((c) => c.id)).toEqual(on.map((c) => c.id));
    expect(toggleCard(on, 'coach').find((c) => c.id === 'coach')?.on).toBe(false);
  });

  it('moves among the cards that are on, and not past either end', () => {
    expect(moveCard(DEFAULT_TODAY_CARDS, 'waterWalk', -1).filter((c) => c.on).map((c) => c.id)).toEqual(['menu', 'waterWalk', 'coach']);
    expect(moveCard(DEFAULT_TODAY_CARDS, 'menu', -1)).toEqual(DEFAULT_TODAY_CARDS);
    expect(moveCard(DEFAULT_TODAY_CARDS, 'waterWalk', 1)).toEqual(DEFAULT_TODAY_CARDS);
  });

  it('resets to the default tabs and cards', () => {
    expect(defaultCustomize()).toEqual({ tabs: ['progress'], todayCards: DEFAULT_TODAY_CARDS });
  });
});
```

In `src/core/__tests__/bar.test.ts`, replace the two `meRows` expectations with:

```ts
    expect(meRows([]).map((r) => r.key)).toEqual(['coach', 'progress', 'body', 'plan', 'saved', 'grocery', 'customize', 'settings', 'guide']);
    expect(meRows(['progress']).map((r) => r.key)).toEqual(['coach', 'body', 'plan', 'saved', 'grocery', 'customize', 'settings', 'guide']);
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/customize.test.ts src/core/__tests__/bar.test.ts`
Expected: FAIL: `Failed to resolve import "../customize"`; the `meRows` test has no `customize`.

- [ ] **Step 3: Create `src/core/customize.ts`**

```ts
import { DEFAULT_TABS, DEFAULT_TODAY_CARDS, MAX_EXTRA_TABS, normalizeTabs, TODAY_CARD_IDS } from './tabs';
import type { TabId, TodayCardId } from './types';

/**
 * Customize's rules. Extra tabs: at most two; a third is never added
 * silently, the page asks which one it replaces. Today's cards: every card
 * once in the person's order, each on or off; one switched on joins the end
 * of the cards that are on, and moving steps over the cards that are off.
 * Pure: the page saves what these return.
 */
export type CardSetting = { id: TodayCardId; on: boolean };

/** Every Today card once, in the saved order; cards a saved list lacks are added at the end, switched off. Anything that is not a list gets the default. */
export function cardList(cards: unknown): CardSetting[] {
  const list: unknown[] = Array.isArray(cards) ? cards : DEFAULT_TODAY_CARDS;
  const out: CardSetting[] = [];
  for (const c of list) {
    if (typeof c !== 'object' || c === null) continue;
    const { id, on } = c as { id?: unknown; on?: unknown };
    if (typeof id !== 'string' || !(TODAY_CARD_IDS as string[]).includes(id) || out.some((x) => x.id === id)) continue;
    out.push({ id: id as TodayCardId, on: on === true });
  }
  for (const id of TODAY_CARD_IDS) if (!out.some((x) => x.id === id)) out.push({ id, on: false });
  return out;
}

/** An extra tab switched: off, or on while there is room. With two on already nothing changes and `full` says to ask which one to replace. */
export function toggleTab(tabs: unknown, id: TabId): { tabs: TabId[]; full: boolean } {
  const now = normalizeTabs(tabs);
  if (now.includes(id)) return { tabs: now.filter((x) => x !== id), full: false };
  if (now.length >= MAX_EXTRA_TABS) return { tabs: now, full: true };
  return { tabs: [...now, id], full: false };
}

/** `id` in the place of `out`. */
export function replaceTab(tabs: unknown, out: TabId, id: TabId): TabId[] {
  return normalizeTabs(normalizeTabs(tabs).map((x) => (x === out ? id : x)));
}

/** A card switched off keeps its place; one switched on goes after the last card that is on. */
export function toggleCard(cards: unknown, id: TodayCardId): CardSetting[] {
  const list = cardList(cards);
  const card = list.find((c) => c.id === id);
  if (!card) return list;
  if (card.on) return list.map((c) => (c.id === id ? { ...c, on: false } : c));
  const rest = list.filter((c) => c.id !== id);
  const lastOn = rest.reduce((at, c, i) => (c.on ? i : at), -1);
  return [...rest.slice(0, lastOn + 1), { id, on: true }, ...rest.slice(lastOn + 1)];
}

/** A card that is on, one place up (-1) or down (1) among the cards that are on. At either end nothing changes. */
export function moveCard(cards: unknown, id: TodayCardId, by: -1 | 1): CardSetting[] {
  const list = cardList(cards);
  const from = list.findIndex((c) => c.id === id && c.on);
  if (from < 0) return list;
  let to = from + by;
  while (to >= 0 && to < list.length && !list[to].on) to += by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function defaultCustomize(): { tabs: TabId[]; todayCards: CardSetting[] } {
  return { tabs: [...DEFAULT_TABS], todayCards: DEFAULT_TODAY_CARDS.map((c) => ({ ...c })) };
}
```

- [ ] **Step 4: `src/core/bar.ts`**

After the function `barItems`, add:

```ts
/** One extra tab's item, for Customize's list of every tab. */
export function extraItem(id: TabId): BarItem {
  return EXTRA[id];
}
```

and in `meRows`, before the line `    { key: 'settings', icon: 'settings-outline', labelKey: 'settings', href: '/settings' },` add:

```ts
    { key: 'customize', icon: 'options-outline', labelKey: 'me_customize', subKey: 'me_customize_sub', href: '/customize' },
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/core/__tests__/customize.test.ts src/core/__tests__/bar.test.ts`
Expected: PASS (6 new tests).

- [ ] **Step 6: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  hdr_customize: 'Customize', me_customize: 'Customize', me_customize_sub: 'Tabs and the cards on Today', cust_tabs: 'Tab bar',
  cust_tabs_note: 'Three tabs always stay; choose up to two more. Hold the tab bar to come back here.', cust_locked: 'always there',
  cust_on_bar: 'On the tab bar', cust_in_me: 'Opens from {me}', cust_replace_q: 'Two extra tabs is the most. Which one should {tab} replace?',
  cust_cards: 'Cards on Today', cust_more_cards: 'More cards', cust_on_today: 'On Today', cust_off_today: 'Not on Today',
  cust_card_left: 'Calories left', cust_card_menu: 'The day\'s menu', cust_card_coach: 'Coach line', cust_card_waterWalk: 'Water and walk',
  cust_card_weight: 'Weight', cust_card_sleep: 'Sleep', cust_card_steps: 'Steps', cust_card_climb: 'Streak', cust_card_mantra: 'The day\'s line',
  cust_move_up: 'Move {card} up', cust_move_down: 'Move {card} down', cust_reset: 'Reset to default', cust_reset_done: 'Tabs and cards are back to the default',
  cust_mantra_note: 'The day\'s line is switched off in Settings; switch it on there to add its card.', cust_hint: 'Hold to choose the tabs',
```

Before the `};` that closes `mr`:

```ts
  hdr_customize: 'मांडणी', me_customize: 'मांडणी', me_customize_sub: 'टॅब आणि आजच्या पानावरची कार्डं', cust_tabs: 'टॅब पट्टी',
  cust_tabs_note: 'तीन टॅब कायम राहतात; आणखी दोन निवडा. इथे परत येण्यासाठी टॅब पट्टी दाबून धरा.', cust_locked: 'कायम असतं',
  cust_on_bar: 'टॅब पट्टीवर', cust_in_me: '{me} मधून उघडतं', cust_replace_q: 'जास्तीत जास्त दोन टॅब. {tab} कोणाच्या जागी ठेवायचा?',
  cust_cards: 'आजच्या पानावरची कार्डं', cust_more_cards: 'आणखी कार्डं', cust_on_today: 'आजच्या पानावर', cust_off_today: 'आजच्या पानावर नाही',
  cust_card_left: 'उरलेल्या कॅलरी', cust_card_menu: 'दिवसाचा मेन्यू', cust_card_coach: 'कोचची ओळ', cust_card_waterWalk: 'पाणी आणि चालणं',
  cust_card_weight: 'वजन', cust_card_sleep: 'झोप', cust_card_steps: 'पावलं', cust_card_climb: 'साखळी', cust_card_mantra: 'आजची ओळ',
  cust_move_up: '{card} वर हलवा', cust_move_down: '{card} खाली हलवा', cust_reset: 'मूळ मांडणी', cust_reset_done: 'टॅब आणि कार्डं मूळ मांडणीवर आली',
  cust_mantra_note: 'आजची ओळ सेटिंग्जमध्ये बंद आहे; तिचं कार्ड जोडण्यासाठी ती तिथे सुरू करा.', cust_hint: 'टॅब निवडण्यासाठी दाबून धरा',
```

Before the `};` that closes `hi`:

```ts
  hdr_customize: 'अपनी पसंद', me_customize: 'अपनी पसंद', me_customize_sub: 'टैब और आज के पन्ने के कार्ड', cust_tabs: 'टैब पट्टी',
  cust_tabs_note: 'तीन टैब हमेशा रहते हैं; दो और चुनें. यहाँ लौटने के लिए टैब पट्टी दबाकर रखें.', cust_locked: 'हमेशा रहता है',
  cust_on_bar: 'टैब पट्टी पर', cust_in_me: '{me} से खुलता है', cust_replace_q: 'ज़्यादा से ज़्यादा दो टैब. {tab} किसकी जगह रखें?',
  cust_cards: 'आज के पन्ने के कार्ड', cust_more_cards: 'और कार्ड', cust_on_today: 'आज के पन्ने पर', cust_off_today: 'आज के पन्ने पर नहीं',
  cust_card_left: 'बची कैलोरी', cust_card_menu: 'दिन का मेन्यू', cust_card_coach: 'कोच की पंक्ति', cust_card_waterWalk: 'पानी और सैर',
  cust_card_weight: 'वज़न', cust_card_sleep: 'नींद', cust_card_steps: 'कदम', cust_card_climb: 'सिलसिला', cust_card_mantra: 'आज की पंक्ति',
  cust_move_up: '{card} ऊपर करें', cust_move_down: '{card} नीचे करें', cust_reset: 'पहले जैसा करें', cust_reset_done: 'टैब और कार्ड पहले जैसे हो गए',
  cust_mantra_note: 'आज की पंक्ति सेटिंग्स में बंद है; उसका कार्ड जोड़ने के लिए उसे वहाँ चालू करें.', cust_hint: 'टैब चुनने के लिए दबाकर रखें',
```

- [ ] **Step 7: Create `src/app/customize.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { IconButton } from '../components/TopBarActions';
import { extraItem } from '../core/bar';
import { cardList, defaultCustomize, moveCard, replaceTab, toggleCard, toggleTab } from '../core/customize';
import { normalizeTabs, TAB_IDS } from '../core/tabs';
import type { TabId, TodayCardId } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Row, Screen, SectionHeader, Small, Toggle } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Customize: the extra tabs (at most two beside Today, ➕ and Me; a third
 * asks, on the page, which one it replaces) and the cards on Today (Calories
 * left fixed at the top; the others switched on or off and moved up or
 * down). Reset puts the default back, with Undo. Held tabs on the bar and
 * Me's Customize row both open it.
 */
export default function CustomizeScreen() {
  const app = useApp();
  const fb = useFeedback();
  const s = app.state.settings;
  const t = makeT(app.state.profile.lang);
  const tabs = normalizeTabs(s.tabs);
  // The day's line card is offered while the day's line is switched on.
  const cards = cardList(s.todayCards).filter((c) => c.id !== 'mantra' || s.features.mantra);
  const onCards = cards.filter((c) => c.on);
  const offCards = cards.filter((c) => !c.on);
  const [asking, setAsking] = useState<TabId | null>(null);
  const tabName = (id: TabId) => t(extraItem(id).labelKey);
  const cardName = (id: TodayCardId) => t(`cust_card_${id}`);

  function tapTab(id: TabId) {
    const r = toggleTab(s.tabs, id);
    if (r.full) {
      setAsking(id);
      return;
    }
    setAsking(null);
    app.setSettings({ tabs: r.tabs });
    fb.haptic('light');
  }

  function replace(out: TabId) {
    if (!asking) return;
    app.setSettings({ tabs: replaceTab(s.tabs, out, asking) });
    setAsking(null);
    fb.haptic('light');
  }

  function reset() {
    const before = { tabs: s.tabs, todayCards: s.todayCards };
    app.setSettings(defaultCustomize());
    setAsking(null);
    fb.notify(t('cust_reset_done'), { label: t('undo'), onPress: () => app.setSettings(before) });
  }

  const locked = (icon: IconName, label: string) => (
    <View accessible accessibilityLabel={`${label}, ${t('cust_locked')}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch }}>
      <Ionicons name={icon} size={20} color={C.textDim} />
      <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{label}</Text>
      <Ionicons name="lock-closed-outline" size={16} color={C.textFaint} />
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('cust_tabs')} />
        <Card>
          <Small color={C.textFaint}>{t('cust_tabs_note')}</Small>
          {locked('today-outline', t('tab_today'))}
          <Divider />
          {locked('add', t('add_food'))}
          <Divider />
          {locked('person-circle-outline', t('tab_me'))}
          {TAB_IDS.map((id) => (
            <View key={id}>
              <Divider />
              <Toggle title={tabName(id)} desc={tabs.includes(id) ? t('cust_on_bar') : fill(t('cust_in_me'), { me: t('tab_me') })} on={tabs.includes(id)} onToggle={() => tapTab(id)} />
            </View>
          ))}
          {asking ? (
            <View style={{ gap: 8, padding: 12, borderRadius: S.radiusSm, backgroundColor: C.accentDim }} accessibilityLiveRegion="polite">
              <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body) }}>{fill(t('cust_replace_q'), { tab: tabName(asking) })}</Text>
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                {tabs.map((id) => (
                  <Btn key={id} small tone="soft" label={tabName(id)} onPress={() => replace(id)} />
                ))}
                <Btn small tone="ghost" label={t('cancel')} onPress={() => setAsking(null)} />
              </Row>
            </View>
          ) : null}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('cust_cards')} />
        <Card>
          {locked('flame-outline', t('cust_card_left'))}
          {onCards.map((c, i) => (
            <View key={c.id}>
              <Divider />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ flex: 1 }}>
                  <Toggle title={cardName(c.id)} desc={t('cust_on_today')} on onToggle={() => app.setSettings({ todayCards: toggleCard(s.todayCards, c.id) })} />
                </View>
                <IconButton name="chevron-up" label={fill(t('cust_move_up'), { card: cardName(c.id) })} onPress={() => app.setSettings({ todayCards: moveCard(s.todayCards, c.id, -1) })} disabled={i === 0} />
                <IconButton name="chevron-down" label={fill(t('cust_move_down'), { card: cardName(c.id) })} onPress={() => app.setSettings({ todayCards: moveCard(s.todayCards, c.id, 1) })} disabled={i === onCards.length - 1} />
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('cust_more_cards')} />
        <Card>
          {offCards.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <Toggle title={cardName(c.id)} desc={t('cust_off_today')} on={false} onToggle={() => app.setSettings({ todayCards: toggleCard(s.todayCards, c.id) })} />
            </View>
          ))}
          {s.features.mantra ? null : <Small color={C.textFaint}>{t('cust_mantra_note')}</Small>}
        </Card>
      </View>

      <Btn tone="ghost" label={t('cust_reset')} onPress={reset} />
    </Screen>
  );
}
```

- [ ] **Step 8: Hold a tab to customize (`src/components/TabBar.tsx`)**

Add `import { useRouter } from 'expo-router';` after `import { Ionicons } from '@expo/vector-icons';`. After the line `  const addSheet = useAddSheet();` add `  const router = useRouter();`. Replace

```tsx
          <TabButton key={item.key} item={item} focused={focused === item.route} label={t(item.labelKey)} onPress={() => open(item)} />
```

with

```tsx
          <TabButton
            key={item.key}
            item={item}
            focused={focused === item.route}
            label={t(item.labelKey)}
            hint={t('cust_hint')}
            onPress={() => open(item)}
            onLongPress={() => router.push('/customize' as never)}
          />
```

replace

```tsx
function TabButton({ item, focused, label, onPress }: { item: BarItem; focused: boolean; label: string; onPress: () => void }) {
```

with

```tsx
function TabButton({ item, focused, label, hint, onPress, onLongPress }: { item: BarItem; focused: boolean; label: string; hint: string; onPress: () => void; onLongPress: () => void }) {
```

and in `TabButton`, replace

```tsx
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={focused || undefined}
      accessibilityLabel={label}
```

with

```tsx
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      aria-selected={focused || undefined}
      accessibilityLabel={label}
      accessibilityHint={hint}
```

- [ ] **Step 9: The route and its title**

In `src/app/_layout.tsx`, after `        <Stack.Screen name="settings" options={{ title: t('hdr_settings') }} />` add:

```tsx
        <Stack.Screen name="customize" options={{ title: t('hdr_customize') }} />
```

In `src/core/screenTitle.ts`, after `  '/settings': 'hdr_settings',` add `  '/customize': 'hdr_customize',`.

- [ ] **Step 10: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 6 more tests. (If `.expo/types` has not been regenerated, the `as never` cast covers `/customize`; `npx expo start` regenerates it.)

```bash
grep -nE "alert\(" src/app/customize.tsx
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|LinearGradient|hitSlop" src/app/customize.tsx src/components/TabBar.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint|desc)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/app/customize.tsx src/components/TabBar.tsx
```

Expected: all three print nothing.

- [ ] **Step 11: Commit**

```bash
git add src/core/customize.ts src/core/__tests__/customize.test.ts src/app/customize.tsx src/core/bar.ts src/core/__tests__/bar.test.ts src/components/TabBar.tsx src/app/_layout.tsx src/core/screenTitle.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Customize: Today, the add button and Me stay on the bar and up to two more tabs can be switched on, a third asking on the page which one it replaces; Calories left stays at the top of Today and every other card can be switched on or off and moved up or down with buttons a finger wide; Reset to default can be undone. Me has a Customize row and holding a tab on the bar opens the page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Start a new chapter

**Files:**
- Create: `src/core/chapter.ts`, `src/core/__tests__/chapter.test.ts`, `src/components/ChapterSheet.tsx`
- Modify: `src/core/types.ts` (`Profile`: two optional fields), `src/core/game.ts` (`GameInput.since`, `weeklyChallenge`), `src/core/__tests__/game.test.ts` (append)
- Modify: `src/core/sync.ts` (the profile and the settings merge field by field), `src/core/__tests__/sync.test.ts`
- Modify: `src/core/bar.ts` (Me's chapter row), `src/core/__tests__/bar.test.ts`, `src/app/(tabs)/me.tsx` (whole file)
- Modify: `src/components/MountainCard.tsx` (`useGame`), `src/components/tiles/StreakTile.tsx`, `src/store/AppProvider.tsx` (the `streakDays` memo)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `planFrom`, `recordStreak({ limit })`, `bestStreak({ days })`, `BEST_STREAK_DAYS`, `Sheet`, `Ctx.setProfile`.
- Produces: `Profile.chapterStart?: ISODate`, `Profile.firstStartWeightKg?: number`; `newChapter(profile, weights, today): { startWeightKg; chapterStart; firstStartWeightKg }`, `chapterDays(start: ISODate | undefined, today, max): number`; `GameInput.since?: ISODate`; `MeRow.sheet?: 'savedMeals' | 'chapter'`; `ChapterSheet({ open, onClose })`; i18n `me_chapter*`, `chapter_*`.

Me → "Start a new chapter" opens one sheet in plain words; "Start from today" sets `profile.startWeightKg` to the latest weigh-in, `profile.chapterStart` to today and, the first time, `profile.firstStartWeightKg` to the old start. From then on Lost and the climb (the mountain, its camps and its trail) count from the chapter's start weight and day, the weekly challenge counts from the chapter's first day, and the streak and the best run look back no further than it. Nothing is deleted: meals, weigh-ins and History are untouched, and points and badges keep counting from the very first start, so none is taken away. Both fields are optional, so an older store reads unchanged, and they travel in the profile. The profile and the settings are single objects in the account file: merged whole, a chapter started on the phone would lose to a language changed on the PC in the same round, so both now merge field by field (this device's change to a field wins, as before for the whole object).

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/chapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chapterDays, newChapter } from '../chapter';

describe('newChapter', () => {
  const weights = [
    { date: '2026-09-01', kg: 92 },
    { date: '2026-10-25', kg: 84.6 },
    { date: '2026-11-02', kg: 84 },
  ];

  it('starts today from the latest weigh-in up to today, keeping the very first start', () => {
    expect(newChapter({ weightKg: 85, startWeightKg: 92 }, weights, '2026-10-28')).toEqual({ startWeightKg: 84.6, chapterStart: '2026-10-28', firstStartWeightKg: 92 });
  });

  it('a later chapter keeps the first start; with no weigh-in the profile weight is the start', () => {
    expect(newChapter({ weightKg: 85, startWeightKg: 84.6, firstStartWeightKg: 92 }, [], '2026-12-01')).toEqual({ startWeightKg: 85, chapterStart: '2026-12-01', firstStartWeightKg: 92 });
    expect(newChapter({ weightKg: 85 }, weights, '2026-10-28').firstStartWeightKg).toBe(92);
  });
});

describe('chapterDays', () => {
  it('lets the streak look back no further than the first day of the chapter', () => {
    expect(chapterDays(undefined, '2026-10-28', 60)).toBe(60);
    expect(chapterDays('2026-10-28', '2026-10-28', 60)).toBe(1);
    expect(chapterDays('2026-10-20', '2026-10-28', 60)).toBe(9);
    expect(chapterDays('2026-01-01', '2026-10-28', 60)).toBe(60);
    expect(chapterDays('2026-11-01', '2026-10-28', 60)).toBe(60);
  });
});
```

In `src/core/__tests__/game.test.ts`, inside `describe('game', ...)`, after the test that ends `expect(same.key).toBe(c.key);` and its closing `});`, add:

```ts
  it('a new chapter started this week counts the challenge from its first day', () => {
    const all = weeklyChallenge(base);
    const fresh = weeklyChallenge({ ...base, since: TODAY });
    expect(fresh.key).toBe(all.key);
    expect(fresh.weekStart).toBe(all.weekStart);
    expect(fresh.n).toBeLessThanOrEqual(1);
    expect(weeklyChallenge({ ...base, since: d(30) })).toEqual(all);
  });
```

In `src/core/__tests__/sync.test.ts`, in `describe('three-way merge of single values', ...)`, replace the line `    // Settings is one value: the side that changed it wins whole.` with `    // Field by field: this device's bottle size and the other side's water goal both stay.`, add after the line `    expect(merge3(base, local, remote).settings.bottleMl).toBe(750);` the line `    expect(merge3(base, local, remote).settings.waterGoalMl).toBe(2500);`, and after that test's closing `});` add:

```ts
  it('a new chapter here and a language picked there both stay', () => {
    const b = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, startWeightKg: 92 } }));
    const local = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, startWeightKg: 84, chapterStart: '2026-10-28', firstStartWeightKg: 92 } }));
    const remote = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, startWeightKg: 92, lang: 'mr' } }));
    const out = merge3(b, local, remote).profile;
    expect([out.startWeightKg, out.chapterStart, out.firstStartWeightKg, out.lang]).toEqual([84, '2026-10-28', 92, 'mr']);
  });

  it('a field taken out on one side stays out, and a field changed on both keeps this device\'s', () => {
    const b = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, chapterStart: '2026-10-01', weightKg: 90 } }));
    const local = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, weightKg: 89 } }));
    const remote = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, chapterStart: '2026-10-01', weightKg: 88, lang: 'hi' } }));
    const out = merge3(b, local, remote).profile;
    expect(out.chapterStart).toBeUndefined();
    expect([out.weightKg, out.lang]).toEqual([89, 'hi']);
  });
```

In `src/core/__tests__/bar.test.ts`, replace the two `meRows` expectations with:

```ts
    expect(meRows([]).map((r) => r.key)).toEqual(['coach', 'progress', 'body', 'plan', 'saved', 'grocery', 'customize', 'chapter', 'settings', 'guide']);
    expect(meRows(['progress']).map((r) => r.key)).toEqual(['coach', 'body', 'plan', 'saved', 'grocery', 'customize', 'chapter', 'settings', 'guide']);
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/chapter.test.ts src/core/__tests__/game.test.ts src/core/__tests__/sync.test.ts src/core/__tests__/bar.test.ts`
Expected: FAIL: `Failed to resolve import "../chapter"`; vitest does not typecheck, so the rest run and fail: the challenge counts the whole week, the settings keep the whole local object (water goal 3000), the profile loses `lang: 'mr'`, and `meRows` has no `chapter`.

- [ ] **Step 3: Create `src/core/chapter.ts`**

```ts
import type { ISODate, Profile, WeightLog } from './types';

/**
 * A new chapter: the climb starts again from the latest weigh-in and today,
 * and the streak looks back no further than that day. The very first start
 * is kept, so points and badges still count the whole journey. Nothing is
 * deleted. Pure.
 */
export function newChapter(
  profile: Pick<Profile, 'weightKg' | 'startWeightKg' | 'firstStartWeightKg'>,
  weights: WeightLog[],
  today: ISODate,
): Required<Pick<Profile, 'startWeightKg' | 'chapterStart' | 'firstStartWeightKg'>> {
  let latest: WeightLog | null = null;
  let earliest: WeightLog | null = null;
  for (const w of weights) {
    if (w.date > today) continue;
    if (!latest || w.date > latest.date) latest = w;
    if (!earliest || w.date < earliest.date) earliest = w;
  }
  return {
    startWeightKg: latest?.kg ?? profile.weightKg,
    chapterStart: today,
    // The start as planFrom reads it: the profile's, else the first weigh-in, else the profile weight.
    firstStartWeightKg: profile.firstStartWeightKg ?? profile.startWeightKg ?? earliest?.kg ?? profile.weightKg,
  };
}

/** How many days back from today, today included, the streak may look: no further than the chapter's first day, and never more than `max`. */
export function chapterDays(start: ISODate | undefined, today: ISODate, max: number): number {
  if (!start || start > today) return max;
  const days = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86400000) + 1;
  return Math.min(max, days);
}
```

- [ ] **Step 4: The fields and the challenge**

In `src/core/types.ts`, in `Profile`, after the `onboardedOn?: ISODate;` field add:

```ts
  /** The day the current chapter began ("Start a new chapter"): the climb, the weekly challenge and the streak count from it. */
  chapterStart?: ISODate;
  /** The start weight before the first new chapter: points and badges keep counting from it. */
  firstStartWeightKg?: number;
```

In `src/core/game.ts`, in `GameInput`, after `  offDays?: number[];` add:

```ts
  /** The first day of a new chapter: the weekly challenge counts from it. */
  since?: ISODate;
```

and in `weeklyChallenge`, replace `  const inWeek = week.days.filter((x) => x.date >= start.toISOString().slice(0, 10));` with:

```ts
  const weekStart = start.toISOString().slice(0, 10);
  // A chapter started this week starts the challenge again: the days before it do not count.
  const from = input.since && input.since > weekStart ? input.since : weekStart;
  const inWeek = week.days.filter((x) => x.date >= from);
```

- [ ] **Step 5: Field-by-field merge in `src/core/sync.ts`**

After the `SINGLETONS` line add:

```ts
/** Single objects merged field by field, each field one value: a chapter started on the phone and a language picked on the PC both stay. */
const BY_FIELD = new Set<string>(['profile', 'settings']);

function isPlain(v: unknown): v is AnyRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** One value, three ways: this device's change wins, else the other side's, else this device's. */
function pick(bv: string | undefined, lv: unknown, rv: unknown): unknown {
  if (stable(lv) !== bv) return lv;
  if (stable(rv) !== bv) return rv;
  return lv;
}

/** Each field picked on its own; a field taken out on one side stays out. */
function mergeFields(b: AnyRecord, l: AnyRecord, r: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  for (const f of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const v = pick(stable(b[f]), l[f], r[f]);
    if (v !== undefined) out[f] = v;
  }
  return out;
}
```

and in `merge3`, replace

```ts
    if (base === null) {
      // Unknown history: keep what this device has, fall back to the account's.
      out[key] = lv !== undefined && lv !== null ? lv : rv;
    } else if (stable(lv) !== bv) {
```

with

```ts
    const bk = (b as AnyRecord)[key];
    if (base === null) {
      // Unknown history: keep what this device has, fall back to the account's.
      out[key] = lv !== undefined && lv !== null ? lv : rv;
    } else if (BY_FIELD.has(key) && isPlain(lv) && isPlain(rv) && isPlain(bk)) {
      out[key] = mergeFields(bk, lv, rv);
    } else if (stable(lv) !== bv) {
```

- [ ] **Step 6: Me's row and the sheet**

In `src/core/bar.ts`, replace `sheet?: 'savedMeals' };` with `sheet?: 'savedMeals' | 'chapter' };`, and after the line `    { key: 'customize', icon: 'options-outline', labelKey: 'me_customize', subKey: 'me_customize_sub', href: '/customize' },` add:

```ts
    { key: 'chapter', icon: 'flag-outline', labelKey: 'me_chapter', subKey: 'me_chapter_sub', sheet: 'chapter' },
```

Before the `};` that closes `en` in `src/i18n/index.ts`:

```ts
  me_chapter: 'Start a new chapter', me_chapter_sub: 'Begin the climb again from today', chapter_title: 'Start a new chapter?',
  chapter_body: 'Your climb starts again today, from {kg} kg. Lost counts from here, and the weekly challenge and the streak start fresh. Nothing is deleted: every meal, weigh-in and badge stays, and History shows everything.',
  chapter_confirm: 'Start from today', chapter_started: 'A new chapter starts today',
```

Before the `};` that closes `mr`:

```ts
  me_chapter: 'नवा अध्याय सुरू करा', me_chapter_sub: 'आजपासून चढाई पुन्हा सुरू', chapter_title: 'नवा अध्याय सुरू करायचा?',
  chapter_body: 'तुमची चढाई आज {kg} kg पासून पुन्हा सुरू होते. घटलेलं वजन इथून मोजलं जातं, आणि आठवड्याचं आव्हान आणि साखळी नव्याने सुरू होतात. काहीही पुसलं जात नाही: प्रत्येक जेवण, वजन आणि बॅज राहतो, आणि इतिहासात सगळं दिसतं.',
  chapter_confirm: 'आजपासून सुरू करा', chapter_started: 'आजपासून नवा अध्याय',
```

Before the `};` that closes `hi`:

```ts
  me_chapter: 'नया अध्याय शुरू करें', me_chapter_sub: 'आज से चढ़ाई फिर शुरू', chapter_title: 'नया अध्याय शुरू करें?',
  chapter_body: 'आपकी चढ़ाई आज {kg} kg से फिर शुरू होती है. घटा वज़न यहीं से गिना जाता है, और हफ़्ते की चुनौती और सिलसिला नए सिरे से शुरू होते हैं. कुछ भी मिटता नहीं: हर खाना, वज़न और बैज रहता है, और इतिहास में सब दिखता है.',
  chapter_confirm: 'आज से शुरू करें', chapter_started: 'आज से नया अध्याय',
```

Create `src/components/ChapterSheet.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { newChapter } from '../core/chapter';
import { oneDecimal } from '../core/tileText';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C } from '../ui/theme';

/** "Start a new chapter", in plain words: the climb, Lost, the weekly challenge and the streak start again from today, and nothing is deleted. */
export function ChapterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const { state, today } = app;
  const t = makeT(state.profile.lang);
  const next = newChapter(state.profile, state.weights, today);
  return (
    <Sheet open={open} title={t('chapter_title')} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Small color={C.textDim}>{fill(t('chapter_body'), { kg: oneDecimal(next.startWeightKg) })}</Small>
        <Btn
          label={t('chapter_confirm')}
          onPress={() => {
            app.setProfile(next);
            fb.haptic('success');
            fb.notify(t('chapter_started'));
            onClose();
          }}
        />
        <Btn tone="ghost" label={t('cancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
```

Replace the whole of `src/app/(tabs)/me.tsx` with:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { ChapterSheet } from '../../components/ChapterSheet';
import { SavedMealsSheet } from '../../components/SavedMealsSheet';
import { meRows, type MeRow } from '../../core/bar';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, ListRow } from '../../ui/components';
import { C } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

type IconName = keyof typeof Ionicons.glyphMap;

/** Me: a plain list of everything that is not on the bar, each one tap from its page or its sheet. */
export default function MeScreen() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const [sheet, setSheet] = useState<MeRow['sheet'] | null>(null);
  return (
    <Page title={t('tab_me')}>
      <Card>
        {meRows(app.state.settings.tabs).map((row, i) => (
          <View key={row.key}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon={<Ionicons name={row.icon as IconName} size={18} color={C.textDim} />}
              title={t(row.labelKey)}
              sub={row.subKey ? t(row.subKey) : undefined}
              onPress={() => {
                if (row.sheet) setSheet(row.sheet);
                else if (row.href) router.push(row.href as never);
              }}
              trailing={<Ionicons name="chevron-forward" size={16} color={C.textFaint} />}
            />
          </View>
        ))}
      </Card>
      <SavedMealsSheet open={sheet === 'savedMeals'} onClose={() => setSheet(null)} />
      <ChapterSheet open={sheet === 'chapter'} onClose={() => setSheet(null)} />
    </Page>
  );
}
```

- [ ] **Step 7: The climb, the streak and the best run count from the chapter**

In `src/components/MountainCard.tsx`, replace the whole function `useGame` with:

```ts
export function useGame() {
  const { state, targets, today } = useApp();
  return useMemo(() => {
    const plan = planFrom(state.profile, state.weights, targets, today);
    const since = state.profile.chapterStart;
    const input: GameInput = {
      today,
      meals: state.meals,
      water: state.water,
      weights: state.weights,
      sleep: state.sleep,
      steps: state.steps,
      workouts: state.workouts,
      kcalTarget: targets.kcal,
      waterGoalMl: state.settings.waterGoalMl,
      startKg: plan.startKg,
      goalKg: plan.goalKg,
      offDays: state.settings.offDays,
      since,
    };
    // Points and badges are the whole journey's: they count from the very first start, so a new chapter takes none away.
    const lifetime: GameInput = { ...input, startKg: state.profile.firstStartWeightKg ?? plan.startKg, since: undefined };
    const total = Math.max(0, plan.startKg - plan.goalKg);
    const progress = total > 0 ? Math.min(1, Math.max(0, plan.lostKg / total)) : plan.toGoKg <= 0 ? 1 : 0;
    const camps = total > 0 ? [0.25, 0.5, 0.75].map((p) => ({ p, label: `${Math.round((plan.startKg - total * p) * 10) / 10}` })) : [];
    // The climb is the chapter's: its trail starts on the chapter's first day.
    const trailWeights = since ? state.weights.filter((w) => w.date >= since) : state.weights;
    const points = xp(lifetime);
    return {
      plan,
      input,
      progress,
      camps,
      trail: climbTrail(trailWeights, plan.startKg, plan.goalKg).map((t) => t.p),
      points,
      level: level(points),
      badges: badges(lifetime),
      challenge: weeklyChallenge(input, state.settings.weighDay),
    };
  }, [state.profile, state.weights, state.meals, state.water, state.sleep, state.steps, state.workouts, state.settings.waterGoalMl, state.settings.weighDay, state.settings.offDays, targets, today]);
}
```

In `src/components/tiles/StreakTile.tsx`, replace `import { bestStreak, streakWords } from '../../core/tileText';` with:

```ts
import { chapterDays } from '../../core/chapter';
import { BEST_STREAK_DAYS, bestStreak, streakWords } from '../../core/tileText';
```

and replace

```ts
    () => bestStreak({ today, menuOn, routine: state.routine, meals: state.meals, skips: state.slotSkips, offDays: state.settings.offDays ?? [] }),
    [today, menuOn, state.routine, state.meals, state.slotSkips, state.settings.offDays],
```

with

```ts
    // The best run is the chapter's, as the streak is.
    () =>
      bestStreak({
        today,
        menuOn,
        routine: state.routine,
        meals: state.meals,
        skips: state.slotSkips,
        offDays: state.settings.offDays ?? [],
        days: chapterDays(state.profile.chapterStart, today, BEST_STREAK_DAYS),
      }),
    [today, menuOn, state.routine, state.meals, state.slotSkips, state.settings.offDays, state.profile.chapterStart],
```

In `src/store/AppProvider.tsx`, after `import { recordStreak } from '../core/record';` add `import { chapterDays } from '../core/chapter';`; in the `streakDays` memo, replace

```ts
      recordStreak({
        today,
```

with

```ts
      recordStreak({
        today,
        // A new chapter starts the streak again: it looks back no further than the chapter's first day.
        limit: chapterDays(state.profile.chapterStart, today, 60),
```

and add `state.profile.chapterStart` at the end of that memo's dependency array (at `a185681` it reads `[today, state.routine, state.meals, state.slotSkips, state.settings.offDays, state.menus, planFoods, fit]`, which becomes `[today, state.routine, state.meals, state.slotSkips, state.settings.offDays, state.menus, planFoods, fit, state.profile.chapterStart]`).

- [ ] **Step 8: Run the tests, then the gate**

Run: `npx vitest run src/core/__tests__/chapter.test.ts src/core/__tests__/game.test.ts src/core/__tests__/sync.test.ts src/core/__tests__/bar.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 6 more tests (chapter 3, game 1, sync 2).

```bash
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|LinearGradient|hitSlop" src/components/ChapterSheet.tsx "src/app/(tabs)/me.tsx"
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint|desc)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/ChapterSheet.tsx "src/app/(tabs)/me.tsx"
```

Expected: both print nothing.

- [ ] **Step 9: Commit**

```bash
git add src/core/chapter.ts src/core/__tests__/chapter.test.ts src/core/types.ts src/core/game.ts src/core/__tests__/game.test.ts src/core/sync.ts src/core/__tests__/sync.test.ts src/core/bar.ts src/core/__tests__/bar.test.ts src/components/ChapterSheet.tsx "src/app/(tabs)/me.tsx" src/components/MountainCard.tsx src/components/tiles/StreakTile.tsx src/store/AppProvider.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Start a new chapter, from Me: one plain sheet, and the climb starts again from the latest weigh-in and today; Lost, the camps and the trail count from the chapter, the weekly challenge from its first day, and the streak and the best run look back no further than it. Nothing is deleted, and points and badges keep counting from the very first start. The profile and the settings now merge field by field when two devices sync, so a chapter started on one and a setting changed on the other both stay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Reminders worked out: the meal-time prompt with its plan, three new ones, a switch each

**Files:**
- Modify (whole file): `src/core/reminders.ts`, `src/core/__tests__/reminders.test.ts`
- Modify (whole file): `src/services/useScheduledReminders.ts`
- Modify: `src/core/types.ts` (`Settings.reminders`), `src/store/defaults.ts`, `src/store/migrate.ts`, `src/core/__tests__/migrate.test.ts`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `pattern`, `slotOf` (`pattern.ts`), `menuSlots`, `skippedOn`, `DayMenu` (`menu.ts`), `dayRecord`, `weekRecord`, `DayRecord`, `DayRecordState` (`record.ts`), `mealTotals` (`weekPlan.ts`), `signedKg` (`tileText.ts`), `Ctx.menuOn`, `Ctx.planFoods`, `settings.reviewedWeeks` (Task 1).
- Produces: `Reminder` gains `data: Record<string, string>` (`kind`: `'slot' | 'fill' | 'planweek' | 'report' | 'away'`, `date`, `slotId`) and `category?: 'meal'`; `ReminderInput` loses `nudgesEnabled` and gains `awayLines`, `plannedKcal`, `fillYesterday`, `records`, `planWeek`, `reviewedWeeks`, `report`; `SLOT_DAYS` exported; `DailyInput` loses `nudgesEnabled` and gains `sleepCheckin`, `water`, `dayReview`; new `weekReport`, `reportText`, `reportMonday`, `tapRoute`, `promptOutcome`; `Settings.reminders` gains `away`, `water`, `sleepCheckin`, `dayReview`; `DEFAULT_SETTINGS.nudgesEnabled` is false; i18n `prompt_title`, `prompt_body`, `rem_*`.

What goes out, each with its own switch:

| Reminder | When | Switch (default) |
|---|---|---|
| Meal-time prompt "Lunch · 640 kcal", with "Ate as planned" | at each slot's time today and the next two days; not for a slot done, skipped or planned empty; not on an off day or the setup day | `reminders.mealPrompt` (on) |
| Fill in yesterday | 09:00 (or when quiet hours end), this morning and tomorrow's, only when that yesterday is not complete; never for the setup day or before | `reminders.fillYesterday` (off) |
| Plan next week | Sunday 18:00, off day or not; not for a week already saved on the plan screen | `reminders.planWeek` (off) |
| Weekly report "5 of 7 days complete · average 1,820 kcal a day, goal 1,850 · weight −0.4 kg" | Monday 09:00 | `reminders.weeklyReport` (off) |
| After days away | a morning line on the second to fourth day without a log | `reminders.away` (off) |
| Morning check-in, water, evening review | 07:30, 15:00, 21:30 daily | `reminders.sleepCheckin`, `water`, `dayReview` (off) |
| The day's line | 08:00 daily | `features.mantra` (Task 10) |
| Long eye-care breaks | through the waking day | `features.breaks` (Task 10) |
| The hourly in-app nudges | while the app is open | `nudgesEnabled` (now off by default) |

A slot's planned calories come from the day's menu (`menuOn(date)`, `mealTotals`); a slot with nothing planned gets no prompt; one whose plan is not known gets the plain "Lunch?" as before. A store older than version 7 (the live site's users come from version 6) has the hourly nudges switched off once by the migration, after `upgradeAppSettings` has set a missing meal-time prompt from the nudges switch as it was stored, so a person whose nudges were off keeps the prompt off and one whose nudges were on keeps it on; every new reminder switch starts at its default through `upgradeAppSettings`. (A store already on version 7 whose `mealPrompt` is missing or broken follows its stored `nudgesEnabled`, now off by default: the prompt then reads off, the safe side of a corrupt switch.) The web and the PC keep their in-app prompts (`useWorkSchedule`); everything here is for the phone's OS.

- [ ] **Step 1: Replace the whole of `src/core/__tests__/reminders.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_BREAK_SETTINGS } from '../breaks';
import type { DayMenu } from '../menu';
import { skipId } from '../menu';
import type { DayRecord } from '../record';
import {
  DAILY_IDS,
  dailyReminders,
  daysAway,
  daysBetween,
  lastLogDate,
  missedDays,
  plannedReminders,
  promptOutcome,
  reportMonday,
  reportText,
  tapRoute,
  weekReport,
  type ReminderInput,
} from '../reminders';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { Meal } from '../types';

const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '19:30', 35)] };
const meal = (date: string): Meal => ({ id: date, at: `${date}T13:00:00.000Z`, date, type: 'lunch', items: [], kcal: 400, protein: 10 });
const WORDS: Record<string, string> = { prompt_title: '{slot} · {kcal} kcal', rem_report_full: '{n} of 7 full', rem_report_avg: 'average {avg}, goal {goal}', rem_report_weight: 'weight {kg} kg' };
const t = (k: string) => WORDS[k] ?? k;
const plannedKcal: Record<string, number> = {};
for (const d of ['2026-10-12', '2026-10-13', '2026-10-14']) Object.assign(plannedKcal, { [`${d}:morning`]: 300, [`${d}:lunch`]: 600, [`${d}:dinner`]: 500 });
// 2026-10-12 is a Monday.
const base: ReminderInput = {
  today: '2026-10-12',
  nowMinutes: 10 * 60,
  routine,
  mealPrompt: true,
  awayLines: true,
  doneSlotIds: [],
  plannedKcal,
  lastLogDate: '2026-10-12',
  offDays: [],
  quietStartHour: 22,
  quietEndHour: 7,
  lang: 'en',
  t,
  fillYesterday: false,
  records: {},
  planWeek: false,
  reviewedWeeks: [],
  report: null,
};
const quiet: ReminderInput = { ...base, mealPrompt: false, awayLines: false };

describe('plannedReminders: the meal-time prompt', () => {
  it('prompts every planned slot at its own time, titled with what is planned, today and the next two days only', () => {
    const r = plannedReminders(base).filter((x) => x.id.startsWith('slot:'));
    // Monday at 10:00: lunch and dinner today, then all three on Tuesday and Wednesday.
    expect(r).toHaveLength(2 + 3 + 3);
    expect(r[0]).toMatchObject({
      id: 'slot:lunch:2026-10-12',
      date: '2026-10-12',
      time: '13:00',
      title: 'lunch · 600 kcal',
      body: 'prompt_body',
      category: 'meal',
      data: { kind: 'slot', date: '2026-10-12', slotId: 'lunch' },
    });
    expect(r[1]).toMatchObject({ id: 'slot:dinner:2026-10-12', time: '19:30' });
    expect(r[2]).toMatchObject({ id: 'slot:morning:2026-10-13', time: '08:30' });
    expect(r.some((x) => x.date > '2026-10-14')).toBe(false);
  });

  it('a slot planned empty gets no prompt; one whose plan is not known gets the plain question, without the button', () => {
    const empty = plannedReminders({ ...base, plannedKcal: { ...plannedKcal, '2026-10-12:dinner': 0 } }).filter((x) => x.date === '2026-10-12');
    expect(empty.map((x) => x.id)).toEqual(['slot:lunch:2026-10-12']);
    const plain = plannedReminders({ ...base, plannedKcal: {} })[0];
    expect(plain).toMatchObject({ id: 'slot:lunch:2026-10-12', title: 'lunch?', body: 'slot_prompt' });
    expect(plain.category).toBeUndefined();
  });

  it('leaves out today\'s slots already done and those whose moment has passed', () => {
    const r = plannedReminders({ ...base, nowMinutes: 14 * 60, doneSlotIds: ['dinner'] }).filter((x) => x.date === '2026-10-12');
    expect(r).toEqual([]);
  });

  it('skips off days and quiet hours, and says nothing when the meal-time prompt is off', () => {
    const r = plannedReminders({ ...base, offDays: [2], lastLogDate: null });
    expect(r.some((x) => x.date === '2026-10-13')).toBe(false);
    const late: Routine = { ...routine, slots: [slot('night', 'snack', '22:00', 10)] };
    expect(plannedReminders({ ...base, routine: late, lastLogDate: null })).toEqual([]);
    expect(plannedReminders({ ...base, mealPrompt: false, lastLogDate: null })).toEqual([]);
  });
});

describe('plannedReminders: the switches and the first day', () => {
  const slots = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('slot:'));
  const away = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('away:'));

  it('with the meal-time prompt off there is no slot prompt, and the away lines still come while they are on', () => {
    const r = plannedReminders({ ...base, mealPrompt: false });
    expect(slots(r)).toEqual([]);
    expect(away(r).map((x) => x.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
  });

  it('with the away lines off and the meal-time prompt on there are slot prompts and no away lines', () => {
    const r = plannedReminders({ ...base, awayLines: false });
    expect(slots(r)).toHaveLength(2 + 3 + 3);
    expect(away(r)).toEqual([]);
  });

  it('no slot prompt on the day the person finished setup; they start the next day', () => {
    const r = slots(plannedReminders({ ...base, onboardedOn: '2026-10-12' }));
    expect(r.some((x) => x.date === '2026-10-12')).toBe(false);
    expect(r.filter((x) => x.date === '2026-10-13').map((x) => x.id)).toEqual(['slot:morning:2026-10-13', 'slot:lunch:2026-10-13', 'slot:dinner:2026-10-13']);
    expect(r).toHaveLength(3 + 3);
    // A setup day long past changes nothing.
    expect(slots(plannedReminders({ ...base, onboardedOn: '2026-09-01' }))).toHaveLength(2 + 3 + 3);
  });
});

describe('plannedReminders: absence', () => {
  const away = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('away:'));
  it('with a log today, says something on the second, third and fourth quiet day, then stops', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false }));
    expect(r.map((x) => [x.date, x.time, x.title])).toEqual([
      ['2026-10-14', '09:00', 'away_2_title'],
      ['2026-10-15', '09:00', 'away_3_title'],
      ['2026-10-16', '09:00', 'away_4_title'],
    ]);
    expect(r[0].body).toBe('away_2_body');
  });

  it('counts from the last log when today has none, and never nags someone who has never logged', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false, lastLogDate: '2026-10-11' }));
    expect(r.map((x) => x.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    expect(away(plannedReminders({ ...base, lastLogDate: null }))).toEqual([]);
    expect(away(plannedReminders({ ...base, lastLogDate: '2026-10-01' }))).toEqual([]);
  });

  it('does not count an off day as a day away: last log Saturday, Sunday off, the lines start Tuesday', () => {
    // 2026-10-10 is a Saturday; counted days after it are Monday (1), Tuesday (2), Wednesday (3), Thursday (4).
    const r = away(plannedReminders({ ...base, mealPrompt: false, lastLogDate: '2026-10-10', offDays: [0] }));
    expect(r.map((x) => [x.date, x.title])).toEqual([
      ['2026-10-13', 'away_2_title'],
      ['2026-10-14', 'away_3_title'],
      ['2026-10-15', 'away_4_title'],
    ]);
    expect(r.some((x) => x.date === '2026-10-12')).toBe(false);
  });

  it('planned on a Saturday with a log and Sunday off, says nothing on Monday', () => {
    const r = away(plannedReminders({ ...base, today: '2026-10-10', mealPrompt: false, lastLogDate: '2026-10-10', offDays: [0] }));
    expect(r.map((x) => [x.date, x.title])).toEqual([
      ['2026-10-13', 'away_2_title'],
      ['2026-10-14', 'away_3_title'],
      ['2026-10-15', 'away_4_title'],
    ]);
  });

  it('waits for quiet hours to end before the morning line', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false, quietEndHour: 10 }));
    expect(r[0].time).toBe('10:00');
  });
});

describe('plannedReminders: fill in yesterday', () => {
  const on: ReminderInput = { ...quiet, nowMinutes: 8 * 60, fillYesterday: true };

  it('at nine when yesterday is not complete, and tomorrow too while today is not', () => {
    const r = plannedReminders({ ...on, records: { '2026-10-11': 'partial', '2026-10-12': 'empty' } });
    expect(r.map((x) => [x.id, x.time, x.data])).toEqual([
      ['fill:2026-10-12', '09:00', { kind: 'fill', date: '2026-10-11' }],
      ['fill:2026-10-13', '09:00', { kind: 'fill', date: '2026-10-12' }],
    ]);
    expect(r[0]).toMatchObject({ title: 'rem_fill_title', body: 'rem_fill_body' });
  });

  it('says nothing for a complete or off yesterday, once nine has passed, for the setup day or before, or with the switch off', () => {
    expect(plannedReminders({ ...on, records: { '2026-10-11': 'full', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, records: { '2026-10-11': 'off', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, nowMinutes: 10 * 60, records: { '2026-10-11': 'partial', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, onboardedOn: '2026-10-12' })).toEqual([]);
    expect(plannedReminders({ ...on, fillYesterday: false })).toEqual([]);
  });
});

describe('plannedReminders: plan next week and the weekly report', () => {
  it('plan next week on Sunday at six, off day or not, opening next week; not for a week already saved', () => {
    expect(plannedReminders({ ...quiet, planWeek: true, offDays: [0] })).toEqual([
      { id: 'planweek:2026-10-18', date: '2026-10-18', time: '18:00', title: 'rem_planweek_title', body: 'rem_planweek_body', data: { kind: 'planweek', date: '2026-10-19' } },
    ]);
    expect(plannedReminders({ ...quiet, planWeek: true, reviewedWeeks: ['2026-10-19'] })).toEqual([]);
  });

  it('the report on the Monday it was worked out for, at nine', () => {
    expect(plannedReminders({ ...quiet, today: '2026-10-13', report: { monday: '2026-10-19', text: '5 of 7 full' } })).toEqual([
      { id: 'report:2026-10-19', date: '2026-10-19', time: '09:00', title: 'rem_report_title', body: '5 of 7 full', data: { kind: 'report', date: '2026-10-19' } },
    ]);
  });
});

describe('weekReport', () => {
  const monday = '2026-10-19';
  const records = (['full', 'full', 'partial', 'full', 'empty', 'full', 'off'] as const).map((state): DayRecord => ({ state, fromPlan: false }));
  const meals = [
    { date: '2026-10-12', kcal: 1800 },
    { date: '2026-10-13', kcal: 1600 },
    { date: '2026-10-13', kcal: 400 },
    { date: '2026-10-19', kcal: 900 },
  ];
  const weights = [
    { date: '2026-10-04', kg: 80 },
    { date: '2026-10-11', kg: 79.4 },
    { date: '2026-10-18', kg: 78.9 },
  ];

  it('counts the full days, averages the days with meals, and gives the weight\'s change over the week', () => {
    expect(weekReport({ monday, records, meals, weights, goal: 1850 })).toEqual({ full: 4, avgKcal: 1900, goal: 1850, weightChange: -0.5 });
  });

  it('says the week in one line, and nothing for a week with no meal and no weigh-in', () => {
    expect(reportText(weekReport({ monday, records, meals, weights, goal: 1850 })!, t)).toBe('4 of 7 full · average 1900, goal 1850 · weight −0.5 kg');
    expect(weekReport({ monday, records, meals: [], weights: [], goal: 1850 })).toBeNull();
  });

  it('goes out on the coming Monday: today while it is not nine yet', () => {
    expect(reportMonday('2026-10-19', 8 * 60)).toBe('2026-10-19');
    expect(reportMonday('2026-10-19', 10 * 60)).toBe('2026-10-26');
    expect(reportMonday('2026-10-21', 0)).toBe('2026-10-26');
    expect(reportMonday('2026-10-25', 0)).toBe('2026-10-26');
  });
});

describe('a tap on a notification', () => {
  const menu: DayMenu = {
    date: '2026-10-12',
    editedAt: '',
    meals: [
      { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
      { id: 'dinner', type: 'dinner', time: '19:30', lines: [] },
    ],
  };
  const lunch = (source?: Meal['source']): Meal => ({ id: 'm1', at: new Date('2026-10-12T13:10:00').toISOString(), date: '2026-10-12', type: 'lunch', slotId: 'lunch', items: [], kcal: 300, protein: 10, source });

  it('"Ate as planned" logs the planned meal while the slot is open, and confirms the one the app filled in', () => {
    expect(promptOutcome({ menu, meals: [], skips: [], slotId: 'lunch' })).toEqual({ kind: 'log' });
    expect(promptOutcome({ menu, meals: [lunch('auto')], skips: [], slotId: 'lunch' })).toEqual({ kind: 'confirm', mealId: 'm1' });
  });

  it('does nothing for a slot eaten, skipped, or with nothing planned', () => {
    expect(promptOutcome({ menu, meals: [lunch('manual')], skips: [], slotId: 'lunch' })).toEqual({ kind: 'none' });
    expect(promptOutcome({ menu, meals: [], skips: [{ id: skipId('2026-10-12', 'lunch'), date: '2026-10-12', slotId: 'lunch' }], slotId: 'lunch' })).toEqual({ kind: 'none' });
    expect(promptOutcome({ menu, meals: [], skips: [], slotId: 'dinner' })).toEqual({ kind: 'none' });
  });

  it('opens the day it is about, next week\'s plan, or Progress', () => {
    expect(tapRoute({ kind: 'slot', date: '2026-10-12', slotId: 'lunch' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'slot', date: '2026-10-13', slotId: 'lunch' }, '2026-10-12')).toBe('/?date=2026-10-13');
    expect(tapRoute({ kind: 'fill', date: '2026-10-11' }, '2026-10-12')).toBe('/?date=2026-10-11');
    expect(tapRoute({ kind: 'planweek', date: '2026-10-19' }, '2026-10-12')).toBe('/plan?date=2026-10-19');
    expect(tapRoute({ kind: 'report', date: '2026-10-19' }, '2026-10-19')).toBe('/progress');
    expect(tapRoute({ kind: 'away', date: 'soon' }, '2026-10-12')).toBe('/');
    expect(tapRoute({}, '2026-10-12')).toBe('/');
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

  it('leaves off days out of the count, so an off Sunday is not a day away on Monday', () => {
    expect(missedDays('2026-10-10', '2026-10-12', [0])).toBe(1);
    expect(missedDays('2026-10-10', '2026-10-12', [])).toBe(2);
    expect(missedDays('2026-10-12', '2026-10-12', [])).toBe(0);
    expect(daysAway([meal('2026-10-10')], '2026-10-12', [0])).toBe(1);
    expect(daysAway([meal('2026-10-10')], '2026-10-12', [])).toBe(2);
  });
});

describe('dailyReminders', () => {
  const day = { active: true, sleepCheckin: true, water: true, dayReview: true, quietStartHour: 22, quietEndHour: 7, mantra: 'Steady.', breaks: DEFAULT_BREAK_SETTINGS, nowMs: 0, t };
  const longs = (x: ReturnType<typeof dailyReminders>) => x.filter((r) => r.id.startsWith('sobat-long-break'));
  const at = (r: { hour: number; minute: number }) => `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`;
  const ids = (x: ReturnType<typeof dailyReminders>) => x.filter((r) => !r.id.startsWith('sobat-long-break')).map((r) => `${r.id} ${at(r)}`);

  it('a device that is signed out or reset keeps no daily reminders at all', () => {
    expect(dailyReminders({ ...day, active: false })).toEqual([]);
  });

  it('the long-break reminder never falls in quiet hours: hourly from the end of the night to the start of the next', () => {
    const r = longs(dailyReminders(day));
    expect(r.map(at)).toEqual(['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']);
    expect(r[0]).toMatchObject({ title: 'brk_long', body: 'brk_long_hint' });
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
  });

  it('the app\'s own quiet hours hold it back too', () => {
    const r = longs(dailyReminders({ ...day, quietStartHour: 20, quietEndHour: 9 }));
    expect(r.map(at)[0]).toBe('09:00');
    expect(r.every((x) => x.hour >= 9 && x.hour < 20)).toBe(true);
  });

  it('none while breaks are off, paused, or kept to a work schedule a daily reminder cannot follow', () => {
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, enabled: false } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, long: { ...DEFAULT_BREAK_SETTINGS.long, enabled: false } } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, nowMs: 1000, breaks: { ...DEFAULT_BREAK_SETTINGS, pausedUntilMs: 5000 } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, schedule: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 } } }))).toEqual([]);
  });

  it('keeps the fixed day, each reminder with its own switch: check-in, the day\'s line, water and the recap', () => {
    expect(ids(dailyReminders(day))).toEqual(['sobat-sleep-checkin 07:30', 'sobat-mantra 08:00', 'sobat-water 15:00', 'sobat-day-review 21:30']);
    expect(ids(dailyReminders({ ...day, mantra: '' }))).toEqual(['sobat-sleep-checkin 07:30', 'sobat-water 15:00', 'sobat-day-review 21:30']);
    expect(ids(dailyReminders({ ...day, sleepCheckin: false, water: false, dayReview: false }))).toEqual(['sobat-mantra 08:00']);
  });

  it('never holds the old dinner reminder: the pattern is always on and its dinner slot asks; the id stays known so a device that holds it cancels it', () => {
    for (const quietStartHour of [20, 22, 23]) expect(dailyReminders({ ...day, quietStartHour }).some((r) => r.id === DAILY_IDS.dinner)).toBe(false);
    expect(Object.values(DAILY_IDS)).toContain('sobat-dinner');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/reminders.test.ts`
Expected: FAIL: `promptOutcome`, `reportMonday`, `reportText`, `tapRoute` and `weekReport` are not exported; the slot prompts are at the time plus the grace, titled "lunch?".

- [ ] **Step 3: Replace the whole of `src/core/reminders.ts`**

```ts
import type { BreakSettings } from './breaks';
import { addDays } from './date';
import { menuSlots, skippedOn, type DayMenu } from './menu';
import { inQuietHours } from './nudge';
import { pattern, slotOf } from './pattern';
import type { DayRecord, DayRecordState } from './record';
import { slotLabel, type Routine } from './routine';
import { signedKg } from './tileText';
import type { ISODate, Lang, Meal, SlotSkip, WeightLog } from './types';
import { isOffDay } from './week';

/**
 * Everything the app will say on its own over the next week, worked out in
 * advance so the phone can hand it to the OS and be closed. Each kind has its
 * own switch in Settings. The meal-time prompt (on by default) comes at each
 * slot's time, today and the next two days, titled with the slot and what is
 * planned and carrying "Ate as planned"; never for a slot done, skipped or
 * planned empty, on an off day, or on the day the person finished setup.
 * Fill in yesterday, plan next week and the weekly report are off by
 * default, and so are the lines after days away, which stop after the fourth
 * day: an app that keeps nagging gets uninstalled.
 */
export type ReminderKind = 'slot' | 'fill' | 'planweek' | 'report' | 'away';
export type Reminder = {
  id: string;
  date: ISODate;
  time: string;
  title: string;
  body: string;
  /** What a tap opens and what its button acts on: `kind`, `date`, and `slotId` for a slot. Strings only, as a notification carries them. */
  data: Record<string, string>;
  /** The notification's buttons: 'meal' carries "Ate as planned". */
  category?: 'meal';
};

export type ReminderInput = {
  today: ISODate;
  nowMinutes: number;
  /** How many days ahead, today included. */
  days?: number;
  routine: Routine;
  /** `settings.reminders.mealPrompt`: the slot prompts follow it. */
  mealPrompt: boolean;
  /** `settings.reminders.away`: the lines after days without a log. */
  awayLines: boolean;
  /** The day the person finished setup: no slot prompt on it, and no "fill in" for it or the days before. Missing on older profiles. */
  onboardedOn?: ISODate;
  /** Slots logged or skipped today. */
  doneSlotIds: string[];
  /** Calories planned for each slot, by `${date}:${slotId}`. A slot planned empty (0) gets no prompt; one not in here gets the plain question. */
  plannedKcal: Record<string, number>;
  /** The last day with a meal logged, today included; null when nothing was ever logged. */
  lastLogDate: ISODate | null;
  offDays: number[];
  quietStartHour: number;
  quietEndHour: number;
  lang: Lang;
  t: (key: string) => string;
  /** `settings.reminders.fillYesterday`. */
  fillYesterday: boolean;
  /** The record of yesterday and today by date. A day not in here counts as not complete: nobody has opened the app to fill it. */
  records: Record<ISODate, DayRecordState>;
  /** `settings.reminders.planWeek`. */
  planWeek: boolean;
  /** Mondays of the weeks already looked over and saved on the plan screen. */
  reviewedWeeks: ISODate[];
  /** The weekly report for the Monday it goes out; null while it is off or there is nothing to say. */
  report: { monday: ISODate; text: string } | null;
};

/** Days of slot prompts, today included: a week away is not fifty prompts, and the phone's cap on pending notifications stays far off. */
export const SLOT_DAYS = 3;
/** Mornings with a "fill in yesterday": today's and tomorrow's. */
const FILL_DAYS = 2;
const MORNING_HOUR = 9;
const PLAN_WEEK_MINUTES = 18 * 60;
const AWAY_FIRST = 2;
const AWAY_LAST = 4;

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

/** Days since the last log that count: off days are neither logged nor missed. */
export function missedDays(lastLogDate: ISODate, date: ISODate, offDays: number[]): number {
  let n = 0;
  for (let d = addDays(lastLogDate, 1); d <= date; d = addDays(d, 1)) if (!isOffDay(offDays, d)) n++;
  return n;
}

function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** A template with each {name} replaced; the words come from the caller, the core has no dictionary. */
function fillIn(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

export function plannedReminders(input: ReminderInput): Reminder[] {
  const days = input.days ?? 7;
  const out: Reminder[] = [];
  const quiet = (minutes: number) => inQuietHours(Math.floor(minutes / 60), input.quietStartHour, input.quietEndHour);
  const slots = input.mealPrompt ? pattern(input.routine) : [];
  const morning = Math.max(MORNING_HOUR, input.quietEndHour) * 60;
  // A moment today that has passed would fire at once.
  const ahead = (k: number, minutes: number) => k > 0 || minutes > input.nowMinutes;

  for (let k = 0; k < days; k++) {
    const date = addDays(input.today, k);
    const off = isOffDay(input.offDays, date);

    for (const p of k < SLOT_DAYS && !off && date !== input.onboardedOn ? slots : []) {
      if (quiet(p.minutes) || !ahead(k, p.minutes)) continue;
      if (k === 0 && input.doneSlotIds.includes(p.id)) continue;
      const kcal = input.plannedKcal[`${date}:${p.id}`];
      // Nothing planned there: nothing to ask about.
      if (kcal === 0) continue;
      const label = slotLabel(p.slot, input.lang);
      const planned = kcal !== undefined;
      out.push({
        id: `slot:${p.id}:${date}`,
        date,
        time: hhmm(p.minutes),
        title: planned ? fillIn(input.t('prompt_title'), { slot: label, kcal }) : `${label}?`,
        body: input.t(planned ? 'prompt_body' : 'slot_prompt'),
        data: { kind: 'slot', date, slotId: p.id },
        ...(planned ? { category: 'meal' as const } : {}),
      });
    }

    if (input.fillYesterday && k < FILL_DAYS && !quiet(morning) && ahead(k, morning)) {
      const yesterday = addDays(date, -1);
      const state = input.records[yesterday];
      const started = !input.onboardedOn || yesterday > input.onboardedOn;
      if (started && !isOffDay(input.offDays, yesterday) && state !== 'full' && state !== 'off') {
        out.push({ id: `fill:${date}`, date, time: hhmm(morning), title: input.t('rem_fill_title'), body: input.t('rem_fill_body'), data: { kind: 'fill', date: yesterday } });
      }
    }

    // Sunday evening, off day or not: planning the week is not tracking the day.
    if (input.planWeek && new Date(`${date}T12:00:00`).getDay() === 0 && !quiet(PLAN_WEEK_MINUTES) && ahead(k, PLAN_WEEK_MINUTES)) {
      const monday = addDays(date, 1);
      if (!input.reviewedWeeks.includes(monday)) {
        out.push({ id: `planweek:${date}`, date, time: hhmm(PLAN_WEEK_MINUTES), title: input.t('rem_planweek_title'), body: input.t('rem_planweek_body'), data: { kind: 'planweek', date: monday } });
      }
    }

    if (input.report && input.report.monday === date && !quiet(morning) && ahead(k, morning)) {
      out.push({ id: `report:${date}`, date, time: hhmm(morning), title: input.t('rem_report_title'), body: input.report.text, data: { kind: 'report', date } });
    }

    if (input.awayLines && !off && k > 0 && input.lastLogDate) {
      const gap = missedDays(input.lastLogDate, date, input.offDays);
      if (gap >= AWAY_FIRST && gap <= AWAY_LAST && !quiet(morning)) {
        out.push({ id: `away:${date}`, date, time: hhmm(morning), title: input.t(`away_${gap}_title`), body: input.t(`away_${gap}_body`), data: { kind: 'away', date } });
      }
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

export type WeekReport = { full: number; avgKcal: number | null; goal: number; weightChange: number | null };

/**
 * The week before `monday`: its full days on the record, the average on the
 * days with meals, and the weight's change from the last weigh-in before the
 * week to the last one in it. Null for a week with no meal and no weigh-in.
 */
export function weekReport(input: { monday: ISODate; records: DayRecord[]; meals: Pick<Meal, 'date' | 'kcal'>[]; weights: WeightLog[]; goal: number }): WeekReport | null {
  const from = addDays(input.monday, -7);
  const to = addDays(input.monday, -1);
  const byDay = new Map<ISODate, number>();
  for (const m of input.meals) if (m.date >= from && m.date <= to) byDay.set(m.date, (byDay.get(m.date) ?? 0) + m.kcal);
  const days = [...byDay.values()].filter((k) => k > 0);
  const latest = (until: ISODate, after?: ISODate) => {
    let best: WeightLog | null = null;
    for (const w of input.weights) if (w.date <= until && (!after || w.date >= after) && (!best || w.date > best.date)) best = w;
    return best;
  };
  const inWeek = latest(to, from);
  const before = latest(addDays(from, -1));
  if (days.length === 0 && !inWeek) return null;
  return {
    full: input.records.filter((r) => r.state === 'full').length,
    avgKcal: days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    goal: input.goal,
    weightChange: inWeek && before ? Math.round((inWeek.kg - before.kg) * 10) / 10 : null,
  };
}

/** The report in one line, from the person's words. */
export function reportText(r: WeekReport, t: (key: string) => string): string {
  const parts = [fillIn(t('rem_report_full'), { n: r.full })];
  if (r.avgKcal !== null) parts.push(fillIn(t('rem_report_avg'), { avg: r.avgKcal, goal: r.goal }));
  if (r.weightChange !== null) parts.push(fillIn(t('rem_report_weight'), { kg: signedKg(r.weightChange) }));
  return parts.join(' · ');
}

/** The Monday the next report goes out: today when it is Monday before the report's time, else the coming one. */
export function reportMonday(today: ISODate, nowMinutes: number, atMinutes = MORNING_HOUR * 60): ISODate {
  const wd = new Date(`${today}T12:00:00`).getDay();
  if (wd === 1 && nowMinutes < atMinutes) return today;
  return addDays(today, (8 - wd) % 7 || 7);
}

/** Where a tap on a notification goes: Today on the day it is about, the plan screen at next week, or Progress for the report. */
export function tapRoute(data: Record<string, unknown>, today: ISODate): string {
  const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null;
  if (data.kind === 'slot' || data.kind === 'fill') return date && date !== today ? `/?date=${date}` : '/';
  if (data.kind === 'planweek') return date ? `/plan?date=${date}` : '/plan';
  if (data.kind === 'report') return '/progress';
  return '/';
}

export type PromptOutcome = { kind: 'log' } | { kind: 'confirm'; mealId: string } | { kind: 'none' };

/**
 * What "Ate as planned" on a meal-time prompt does when it arrives, which may
 * be long after the prompt: log the slot's planned meal while the slot is
 * open, confirm the meal the app filled in meanwhile, or nothing for a slot
 * eaten, skipped or holding no plan.
 */
export function promptOutcome(input: { menu: DayMenu; meals: Meal[]; skips: SlotSkip[]; slotId: string }): PromptOutcome {
  const slots = menuSlots(input.menu);
  const slot = slots.find((s) => s.id === input.slotId);
  if (!slot || slot.meal.lines.length === 0) return { kind: 'none' };
  if (skippedOn(input.skips, input.menu.date).includes(input.slotId)) return { kind: 'none' };
  const there = input.meals.filter((m) => m.date === input.menu.date && slotOf(m, slots)?.id === input.slotId);
  const filled = there.find((m) => m.source === 'auto');
  if (filled) return { kind: 'confirm', mealId: filled.id };
  return there.length > 0 ? { kind: 'none' } : { kind: 'log' };
}

/** A reminder the OS repeats every day at one clock time, app closed or not. */
export type DailyReminder = { id: string; hour: number; minute: number; title: string; body: string };

export type DailyInput = {
  /** False on a device that is signed out or reset: reminders belong to a person. */
  active: boolean;
  /** `settings.reminders.sleepCheckin`, `water`, `dayReview`: one switch each. */
  sleepCheckin: boolean;
  water: boolean;
  dayReview: boolean;
  quietStartHour: number;
  quietEndHour: number;
  /** The day's line; empty when there is none or the day's line is switched off. */
  mantra: string;
  /** Passed switched off while eye-care breaks are off in Settings. */
  breaks: BreakSettings;
  nowMs: number;
  t: (key: string) => string;
};

/** `dinner` is no longer registered (the pattern is always on and its dinner slot asks); it stays here so a device that still holds it has it cancelled. */
export const DAILY_IDS = { sleep: 'sobat-sleep-checkin', mantra: 'sobat-mantra', water: 'sobat-water', dinner: 'sobat-dinner', review: 'sobat-day-review' } as const;
/** Every long-break reminder's id starts with this; older builds used it alone, for one repeating notification. */
export const LONG_BREAK_ID = 'sobat-long-break';

/** The daily reminders this device should hold. Anything registered and not in here is to be cancelled. */
export function dailyReminders(input: DailyInput): DailyReminder[] {
  if (!input.active) return [];
  const { t } = input;
  const out: DailyReminder[] = [];
  // Morning check-in, while last night is still fresh.
  if (input.sleepCheckin) out.push({ id: DAILY_IDS.sleep, hour: 7, minute: 30, title: t('sleep_checkin'), body: t('bed_time') });
  // The day's line, at eight. Re-registered daily so it is that day's line.
  if (input.mantra) out.push({ id: DAILY_IDS.mantra, hour: 8, minute: 0, title: t('mantra_title'), body: input.mantra });
  // A single mid-afternoon water prompt; the in-app engine handles the rest.
  if (input.water) out.push({ id: DAILY_IDS.water, hour: 15, minute: 0, title: t('add_water'), body: t('act_drink_water') });
  // The day recap, just before things wind down.
  if (input.dayReview) out.push({ id: DAILY_IDS.review, hour: 21, minute: 30, title: t('day_review'), body: t('write_review') });
  return [...out, ...longBreaks(input)];
}

/**
 * The phone cannot blank its own screen, so a long break is a notification.
 * A repeating one cannot keep to quiet hours, so instead there is one daily
 * reminder per interval across the waking day, counted from the end of the
 * night, and none in the break's quiet hours or the app's. A work schedule
 * picks days, which a daily reminder cannot: none then.
 */
function longBreaks(input: DailyInput): DailyReminder[] {
  const br = input.breaks;
  const paused = br.pausedUntilMs !== null && input.nowMs < br.pausedUntilMs;
  if (!br.enabled || !br.long.enabled || paused || br.schedule !== null) return [];
  const every = Math.max(15, br.long.everyMinutes);
  const from = br.quietStartHour === br.quietEndHour ? 0 : br.quietEndHour * 60;
  const out: DailyReminder[] = [];
  for (let m = from + every; m < from + 1440; m += every) {
    const at = m % 1440;
    const hour = Math.floor(at / 60);
    if (inQuietHours(hour, br.quietStartHour, br.quietEndHour) || inQuietHours(hour, input.quietStartHour, input.quietEndHour)) continue;
    out.push({ id: `${LONG_BREAK_ID}@${hhmm(at)}`, hour, minute: at % 60, title: input.t('brk_long'), body: input.t('brk_long_hint') });
  }
  return out;
}

/** The most recent day on or before today with a meal logged; null when there is none. */
export function lastLogDate(meals: Pick<Meal, 'date'>[], today: ISODate): ISODate | null {
  let best: ISODate | null = null;
  for (const m of meals) if (m.date <= today && (best === null || m.date > best)) best = m.date;
  return best;
}

/** Days since the last log, off days left out: 0 when today has one, and 0 when nothing was ever logged. */
export function daysAway(meals: Pick<Meal, 'date'>[], today: ISODate, offDays: number[] = []): number {
  const last = lastLogDate(meals, today);
  return last ? missedDays(last, today, offDays) : 0;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/__tests__/reminders.test.ts`
Expected: PASS (30 tests, 11 more than before).

- [ ] **Step 5: The switches, the defaults and the migration**

In `src/core/types.ts`, replace

```ts
  /** Which reminders go out. Only the meal-time prompt is on by default. */
  reminders: { mealPrompt: boolean; fillYesterday: boolean; planWeek: boolean; weeklyReport: boolean };
```

with

```ts
  /** Which reminders go out, one switch each. Only the meal-time prompt is on by default. */
  reminders: {
    mealPrompt: boolean;
    fillYesterday: boolean;
    planWeek: boolean;
    weeklyReport: boolean;
    /** The lines after two to four days without a log. */
    away: boolean;
    /** Water at 15:00. */
    water: boolean;
    /** The morning check-in at 07:30. */
    sleepCheckin: boolean;
    /** The evening review at 21:30. */
    dayReview: boolean;
  };
```

In `src/store/defaults.ts`, replace `  nudgesEnabled: true,` with `  // The hourly in-app nudges are off unless switched on in Settings.\n  nudgesEnabled: false,` (two lines), and replace

```ts
  reminders: { mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false },
```

with

```ts
  reminders: { mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false, away: false, water: false, sleepCheckin: false, dayReview: false },
```

In `src/store/migrate.ts`, after the line `  if (fromVersion < 5 && settings.nudgeMinutes < 60) settings.nudgeMinutes = 60;` add the line below. It must stay after `const settings = upgradeAppSettings(raw.settings);`: that call sets a missing `reminders.mealPrompt` from the switch as it was stored (`raw.nudgesEnabled !== false`), so someone whose nudges were off keeps the prompt off and someone whose nudges were on keeps it on, and only then are the nudges themselves turned off.

```ts
  // Version 7: the old nudges are off unless switched on again, each with its own switch; the hourly in-app ones too.
  // After upgradeAppSettings, which read the stored switch to set the meal-time prompt: that choice is already made.
  if (fromVersion < 7) settings.nudgesEnabled = false;
```

In `src/core/__tests__/migrate.test.ts`, replace

```ts
    expect(s.settings.reminders).toEqual({ mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false });
```

with

```ts
    expect(s.settings.reminders).toEqual({ mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false, away: false, water: false, sleepCheckin: false, dayReview: false });
```

in `describe('settings in an odd shape, from sync or an old file', ...)` replace

```ts
  const REMINDERS = { mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false };
```

with

```ts
  const REMINDERS = { mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false, away: false, water: false, sleepCheckin: false, dayReview: false };
```

and

```ts
    expect(s.reminders).toEqual({ mealPrompt: true, fillYesterday: false, planWeek: true, weeklyReport: false });
```

with

```ts
    expect(s.reminders).toEqual({ ...REMINDERS, planWeek: true });
```

and after the test that ends `    expect(migrateState(off)).toEqual(off);` and its closing `  });` add:

```ts
  it('version 7: the hourly nudges are switched off once, after the meal-time prompt has followed them as stored, and a later choice stays', () => {
    // Nudges off before: the prompt stays off.
    const off = migrateState({ ...v1, version: 6, settings: { ...v1.settings, nudgesEnabled: false } });
    expect([off.settings.nudgesEnabled, off.settings.reminders.mealPrompt]).toEqual([false, false]);
    // Nudges on before: the prompt is on, though the nudges now start off; a second load keeps both.
    const on = migrateState({ ...v1, version: 6, settings: { ...v1.settings, nudgesEnabled: true } });
    expect([on.settings.nudgesEnabled, on.settings.reminders.mealPrompt]).toEqual([false, true]);
    expect(migrateState(on)).toEqual(on);
    // A store already on version 7 keeps its own choice.
    expect(migrateState({ ...v1, version: 7, settings: { ...v1.settings, nudgesEnabled: true } }).settings.nudgesEnabled).toBe(true);
  });
```

- [ ] **Step 6: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  prompt_title: '{slot} · {kcal} kcal', prompt_body: 'Eaten as planned? Tap the button, or open Sobat to change it.',
  rem_fill_title: 'Fill in yesterday', rem_fill_body: 'Some of yesterday\'s meals are missing. It takes a minute.',
  rem_planweek_title: 'Plan next week', rem_planweek_body: 'Look over next week\'s menu and save it.',
  rem_report_title: 'Your week', rem_report_full: '{n} of 7 days complete', rem_report_avg: 'average {avg} kcal a day, goal {goal}', rem_report_weight: 'weight {kg} kg',
```

Before the `};` that closes `mr`:

```ts
  prompt_title: '{slot} · {kcal} kcal', prompt_body: 'ठरल्याप्रमाणे खाल्लं? बटण दाबा, किंवा बदलण्यासाठी Sobat उघडा.',
  rem_fill_title: 'कालचं भरा', rem_fill_body: 'कालची काही जेवणं राहिली आहेत. एक मिनिट लागेल.',
  rem_planweek_title: 'पुढच्या आठवड्याचं नियोजन', rem_planweek_body: 'पुढच्या आठवड्याचा मेन्यू पाहा आणि जतन करा.',
  rem_report_title: 'तुमचा आठवडा', rem_report_full: '७ पैकी {n} दिवस पूर्ण', rem_report_avg: 'रोज सरासरी {avg} kcal, लक्ष्य {goal}', rem_report_weight: 'वजन {kg} kg',
```

Before the `};` that closes `hi`:

```ts
  prompt_title: '{slot} · {kcal} kcal', prompt_body: 'तय के मुताबिक खाया? बटन दबाएँ, या बदलने के लिए Sobat खोलें.',
  rem_fill_title: 'कल का भरें', rem_fill_body: 'कल के कुछ खाने बाकी हैं. एक मिनट लगेगा.',
  rem_planweek_title: 'अगले हफ़्ते की योजना', rem_planweek_body: 'अगले हफ़्ते का मेन्यू देखें और सहेजें.',
  rem_report_title: 'आपका हफ़्ता', rem_report_full: '7 में से {n} दिन पूरे', rem_report_avg: 'रोज़ औसत {avg} kcal, लक्ष्य {goal}', rem_report_weight: 'वज़न {kg} kg',
```

- [ ] **Step 7: Replace the whole of `src/services/useScheduledReminders.ts`**

```ts
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import type { BreakSettings } from '../core/breaks';
import { addDays } from '../core/date';
import { settledSlotIds, slotStates } from '../core/pattern';
import { dayRecord, weekRecord, type DayRecordState } from '../core/record';
import { DAILY_IDS, dailyReminders, LONG_BREAK_ID, lastLogDate, plannedReminders, reportMonday, reportText, SLOT_DAYS, weekReport, type Reminder } from '../core/reminders';
import { mealTotals } from '../core/weekPlan';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { firebaseEnabled } from './firebase';
import { cancel, scheduleAt, scheduleDaily, scheduledIds, setupAndroidChannel } from './notify';
import { useAuth } from './useAuth';
import { useMantra } from './useMantra';

/** Everything planned a week ahead carries this, so it can be told apart from the daily ones. */
const PLANNED = 'sobat-r-';

/** A short signature of when and what a reminder says and does, so a changed slot time, plan, name or language replaces the pending notification instead of leaving the old one. */
function signature(r: Reminder): string {
  const s = `${r.time}\n${r.title}\n${r.body}\n${r.category ?? ''}\n${JSON.stringify(r.data)}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const osId = (r: Reminder) => `${PLANNED}${r.id}@${signature(r)}`;

// Runs are chained so two never interleave their cancels and adds.
let chain: Promise<void> = Promise.resolve();
let dailyChain: Promise<void> = Promise.resolve();

/**
 * Whether this device may hold reminders, and whether that is known yet.
 * Reminders belong to a person: a device that is signed out, or reset and not
 * onboarded again, holds none, so nothing keeps pinging after either. Not
 * known until the store has loaded and the session has been reported; a store
 * that failed to load is never taken as the person's.
 */
export function useReminderGate(): { known: boolean; active: boolean } {
  const { ready, storageError, state } = useApp();
  const { user, ready: authReady } = useAuth();
  const known = ready && storageError !== 'load' && (!firebaseEnabled || authReady);
  const active = state.profile.onboarded && (!firebaseEnabled || user !== null);
  return { known, active };
}

/**
 * Registers the reminders that must fire while the app is closed, each kind
 * by its own switch in Settings (core/reminders.ts says what and when). The
 * daily ones are re-registered on change; the week of meal-time prompts and
 * the other planned ones are reconciled against what the OS still holds, so a
 * logged slot's prompt is cancelled and a quiet week stays covered. The web
 * keeps its in-app prompts instead.
 */
export function useScheduledReminders() {
  const app = useApp();
  const { quietStartHour, quietEndHour, offDays, reminders, features, reviewedWeeks } = app.state.settings;
  const { lang, onboardedOn } = app.state.profile;
  const mantra = useMantra();
  const mantraText = mantra?.text ?? '';
  const routine = app.state.routine;
  // By value: a sync landing rebuilds this object unchanged, and must not re-register the day's reminders.
  // Eye-care breaks off in Settings means no long-break notifications, whatever the break panel says.
  const breaksJson = JSON.stringify(features.breaks ? app.state.breakSettings : { ...app.state.breakSettings, enabled: false });
  const { today, hour, menuOn, planFoods } = app;
  const { known, active } = useReminderGate();
  const { sleepCheckin, water, dayReview } = reminders;

  // The daily ones: whatever the plan does not hold is cancelled, so a sign-out
  // or a reset clears them and the repeating long break older builds left goes too.
  useEffect(() => {
    if (Platform.OS === 'web' || !known) return;
    const want = dailyReminders({
      active,
      sleepCheckin,
      water,
      dayReview,
      quietStartHour,
      quietEndHour,
      mantra: mantraText,
      breaks: JSON.parse(breaksJson) as BreakSettings,
      nowMs: Date.now(),
      t: makeT(lang),
    });
    let stale = false;
    dailyChain = dailyChain
      .then(async () => {
        if (stale) return;
        await setupAndroidChannel();
        const ids = new Set(want.map((r) => r.id));
        for (const id of [...Object.values(DAILY_IDS), LONG_BREAK_ID]) if (!ids.has(id)) await cancel(id);
        for (const id of await scheduledIds()) if (id.startsWith(LONG_BREAK_ID) && !ids.has(id)) await cancel(id);
        for (const r of want) await scheduleDaily(r.id, r.hour, r.minute, r.title, r.body);
      })
      .catch(() => {
        // Permission refused or the OS declined. The app still works.
      });
    return () => {
      stale = true;
    };
  }, [known, active, sleepCheckin, water, dayReview, quietStartHour, quietEndHour, lang, breaksJson, mantraText]);

  // Slots done or skipped today, as one string so the plan below only moves when the set does.
  const doneKey = useMemo(() => {
    if (!routine.enabled) return '';
    const todayMeals = app.state.meals.filter((m) => m.date === today);
    return settledSlotIds(slotStates({ routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: hour * 60, skippedSlots: app.skippedToday }))
      .sort()
      .join(',');
  }, [routine, app.state.meals, today, app.targets.kcal, hour, app.skippedToday]);
  const lastLog = useMemo(() => lastLogDate(app.state.meals, today), [app.state.meals, today]);

  // Each slot's planned calories on the days that get prompts, as one string for the same reason.
  const plannedJson = useMemo(() => {
    const out: Record<string, number> = {};
    for (let k = 0; k < SLOT_DAYS; k++) {
      const date = addDays(today, k);
      for (const m of menuOn(date).meals) out[`${date}:${m.id}`] = mealTotals(m, planFoods).kcal;
    }
    return JSON.stringify(out);
  }, [menuOn, planFoods, today]);

  // Yesterday's and today's record, for "fill in yesterday".
  const recordsJson = useMemo(() => {
    const at = (date: string) => dayRecord({ date, today, menu: menuOn(date), routine, meals: app.state.meals, skips: app.state.slotSkips, offDays: offDays ?? [] }).state;
    const yesterday = addDays(today, -1);
    return JSON.stringify({ [yesterday]: at(yesterday), [today]: at(today) });
  }, [menuOn, today, routine, app.state.meals, app.state.slotSkips, offDays]);

  // The coming Monday's report, as things stand; every open works it out again.
  const morning = Math.max(9, quietEndHour) * 60;
  const reportJson = useMemo(() => {
    if (!reminders.weeklyReport) return '';
    const monday = reportMonday(today, hour * 60, morning);
    const records = weekRecord({ monday: addDays(monday, -7), today, routine, meals: app.state.meals, skips: app.state.slotSkips, offDays: offDays ?? [], menuOn });
    const r = weekReport({ monday, records, meals: app.state.meals, weights: app.state.weights, goal: app.targets.kcal });
    return r ? JSON.stringify({ monday, text: reportText(r, makeT(lang)) }) : '';
  }, [reminders.weeklyReport, today, hour, morning, routine, app.state.meals, app.state.slotSkips, app.state.weights, offDays, menuOn, app.targets.kcal, lang]);

  const anyOn = reminders.mealPrompt || reminders.away || reminders.fillYesterday || reminders.planWeek || reminders.weeklyReport;
  const wanted = useMemo(() => {
    if (Platform.OS === 'web' || !active || !anyOn) return [];
    return plannedReminders({
      today,
      nowMinutes: hour * 60,
      routine,
      mealPrompt: reminders.mealPrompt,
      awayLines: reminders.away,
      onboardedOn,
      doneSlotIds: doneKey ? doneKey.split(',') : [],
      plannedKcal: JSON.parse(plannedJson) as Record<string, number>,
      lastLogDate: lastLog,
      offDays: offDays ?? [],
      quietStartHour,
      quietEndHour,
      lang,
      t: makeT(lang),
      fillYesterday: reminders.fillYesterday,
      records: JSON.parse(recordsJson) as Record<string, DayRecordState>,
      planWeek: reminders.planWeek,
      reviewedWeeks: reviewedWeeks ?? [],
      report: reportJson ? (JSON.parse(reportJson) as { monday: string; text: string }) : null,
    });
  }, [active, anyOn, reminders.mealPrompt, reminders.away, reminders.fillYesterday, reminders.planWeek, onboardedOn, today, hour, routine, doneKey, plannedJson, lastLog, offDays, quietStartHour, quietEndHour, lang, recordsJson, reviewedWeeks, reportJson]);

  // Runs once the store and the session are known, whoever is there: after a sign-out or a reset `wanted` is
  // empty and the planned week is cancelled. Never on a store that failed to load, whose empty state is not the person's.
  useEffect(() => {
    if (Platform.OS === 'web' || !known) return;
    let stale = false;
    chain = chain
      .then(async () => {
        if (stale) return;
        const have = (await scheduledIds()).filter((id) => id.startsWith(PLANNED));
        const want = new Map(wanted.map((r) => [osId(r), r]));
        for (const id of have) {
          if (stale) return;
          if (!want.has(id)) await cancel(id);
        }
        const now = Date.now();
        for (const [id, r] of want) {
          if (stale) return;
          if (have.includes(id)) continue;
          const at = new Date(`${r.date}T${r.time}:00`);
          // A moment already past would fire at once; the next tick plans the rest.
          if (at.getTime() <= now) continue;
          try {
            await scheduleAt(id, at, r.title, r.body);
          } catch {
            // One refused reminder must not stop the rest.
          }
        }
      })
      .catch(() => {
        // Permission refused or the OS declined. The app still works.
      });
    return () => {
      stale = true;
    };
  }, [wanted, known]);
}
```

- [ ] **Step 8: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 12 more tests (reminders 11, migrate 1).

```bash
grep -rn "nudgesEnabled" src/core/reminders.ts src/services/useScheduledReminders.ts
```

Expected: prints nothing.

- [ ] **Step 9: Commit**

```bash
git add src/core/reminders.ts src/core/__tests__/reminders.test.ts src/services/useScheduledReminders.ts src/core/types.ts src/store/defaults.ts src/store/migrate.ts src/core/__tests__/migrate.test.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The meal-time prompt comes at each meal's own time titled with the meal and its planned calories, and none comes for a meal planned empty; three new reminders, each off until switched on: fill in yesterday at nine when yesterday has meals missing, plan next week on Sunday evening unless that week is already saved, and a Monday report of full days, average calories against the goal and the change in weight. The morning check-in, water, evening review and the lines after days away each have their own switch and start off, and the hourly nudges are switched off once for everyone coming from an older version

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: "Ate as planned" on the phone, and taps that open the right page

**Files:**
- Modify: `src/services/notify.ts` (`scheduleAt` carries data and a category; the meal category; taps)
- Modify: `src/services/useScheduledReminders.ts` (registers the category; passes data and category)
- Create: `src/services/useNotificationResponses.ts`
- Modify: `src/app/_layout.tsx` (`AppShell` calls it)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: Task 8 (`Reminder.data`, `Reminder.category`, `promptOutcome`, `tapRoute`), `Ctx.addMealFromPlan`, `Ctx.confirmMeal`, `Ctx.menuOn`, `useReminderGate`, expo-notifications `setNotificationCategoryAsync`, `addNotificationResponseReceivedListener`, `getLastNotificationResponse`, `clearLastNotificationResponse`, `dismissNotificationAsync` (see "API notes").
- Produces: `scheduleAt(id, at, title, body, extra?: { data?: Record<string, string>; category?: string })`, `MEAL_CATEGORY = 'sobatmeal'`, `ATE_ACTION = 'ate'`, `setMealCategory(buttonTitle)`, `type TapResponse = { id; action: 'open' | 'ate'; data }`, `onTap(cb): () => void`, `lastTap(): TapResponse | null`, `clearLastTap()`, `dismiss(id)`; `useNotificationResponses()`; i18n `prompt_logged`, `prompt_already`.

The meal-time prompt carries the "Ate as planned" button (`menu_ate_planned`, already in the three languages) through the category `sobatmeal`. The button opens the app (see "Decisions": a killed app reaches no listener otherwise), which then works out what the tap means now with `promptOutcome`: log the slot's planned meal through `addMealFromPlan` (database calories, the slot's date), confirm the meal the app filled in meanwhile, or nothing for a slot already settled; it says which in a toast, takes the notification off the tray, and opens Today on that day. A tap on the body opens the page `tapRoute` names. A tap that launched the app is read once the store and the session are known (`getLastNotificationResponse`), then cleared so a remount (the theme remounts the shell) does not log the meal twice; later taps arrive through the listener. Nothing happens on a signed-out or reset device, or on the web.

- [ ] **Step 1: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`: `  prompt_logged: 'Logged as planned', prompt_already: 'Already on the record',`

Before the `};` that closes `mr`: `  prompt_logged: 'ठरल्याप्रमाणे नोंदलं', prompt_already: 'आधीच नोंदलेलं आहे',`

Before the `};` that closes `hi`: `  prompt_logged: 'तय के मुताबिक दर्ज किया', prompt_already: 'पहले से दर्ज है',`

- [ ] **Step 2: `src/services/notify.ts`**

Replace the whole function `scheduleAt` (with its comment line) with:

```ts
/** A one-off reminder at a clock time on a date. Fires with the app closed. `data` rides along for a tap; `category` adds the buttons registered under it. */
export async function scheduleAt(id: string, at: Date, title: string, body: string, extra?: { data?: Record<string, string>; category?: string }): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await n.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, ...(extra?.data ? { data: extra.data } : {}), ...(extra?.category ? { categoryIdentifier: extra.category } : {}) },
    trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'sobat' },
  });
}
```

and at the end of the file add:

```ts
/** The meal-time prompt's buttons. The docs: no ':' or '-' in a category id. */
export const MEAL_CATEGORY = 'sobatmeal';
/** "Ate as planned". A tap on the notification itself arrives as expo-notifications' DEFAULT_ACTION_IDENTIFIER. */
export const ATE_ACTION = 'ate';

/**
 * Registers "Ate as planned" in the person's language. It opens the app,
 * which logs the meal (useNotificationResponses): with the app killed, a
 * button that leaves it closed reaches no listener on either platform
 * without a background task, and a tap that logged nothing would break the
 * calorie record.
 */
export async function setMealCategory(buttonTitle: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await n.setNotificationCategoryAsync(MEAL_CATEGORY, [{ identifier: ATE_ACTION, buttonTitle, options: { opensAppToForeground: true } }]);
}

/** A tap on a notification: on its body ('open') or on "Ate as planned" ('ate'), with the notification's id and data. */
export type TapResponse = { id: string; action: 'open' | 'ate'; data: Record<string, unknown> };
type NativeResponse = Parameters<Parameters<NativeModule['addNotificationResponseReceivedListener']>[0]>[0];

function toTap(r: NativeResponse): TapResponse {
  return { id: r.notification.request.identifier, action: r.actionIdentifier === ATE_ACTION ? 'ate' : 'open', data: r.notification.request.content.data ?? {} };
}

/** Calls back on every tap while the app runs; returns the way to stop listening. Nothing on the web. */
export function onTap(cb: (r: TapResponse) => void): () => void {
  const n = loadNative();
  if (!n) return () => {};
  const sub = n.addNotificationResponseReceivedListener((r) => cb(toTap(r)));
  return () => sub.remove();
}

/** The tap that opened the app, if one did and it has not been cleared. */
export function lastTap(): TapResponse | null {
  const n = loadNative();
  if (!n) return null;
  try {
    const r = n.getLastNotificationResponse();
    return r ? toTap(r) : null;
  } catch {
    return null;
  }
}

/** Forgets the last tap once it has been acted on, so a remount does not act on it again. */
export function clearLastTap(): void {
  const n = loadNative();
  if (!n) return;
  try {
    n.clearLastNotificationResponse();
  } catch {
    // Nothing to clear.
  }
}

/** Takes a notification off the tray once its button has done its work. */
export async function dismiss(id: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  try {
    await n.dismissNotificationAsync(id);
  } catch {
    // Already gone.
  }
}
```

- [ ] **Step 3: The category and the data, in `src/services/useScheduledReminders.ts`**

Replace `import { cancel, scheduleAt, scheduleDaily, scheduledIds, setupAndroidChannel } from './notify';` with:

```ts
import { cancel, MEAL_CATEGORY, scheduleAt, scheduleDaily, scheduledIds, setMealCategory, setupAndroidChannel } from './notify';
```

Before the line `  // Slots done or skipped today, as one string so the plan below only moves when the set does.` add:

```ts
  // "Ate as planned" on the meal-time prompt, in the person's language; registered before the prompts fire, kept current on a language change.
  useEffect(() => {
    if (Platform.OS === 'web' || !known || !active) return;
    setMealCategory(makeT(lang)('menu_ate_planned')).catch(() => {
      // Without the button the prompt still opens Today.
    });
  }, [known, active, lang]);

```

and replace `            await scheduleAt(id, at, r.title, r.body);` with:

```ts
            await scheduleAt(id, at, r.title, r.body, { data: r.data, category: r.category === 'meal' ? MEAL_CATEGORY : undefined });
```

- [ ] **Step 4: Create `src/services/useNotificationResponses.ts`**

```ts
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { promptOutcome, tapRoute } from '../core/reminders';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useFeedback } from './feedback';
import { clearLastTap, dismiss, lastTap, onTap, type TapResponse } from './notify';
import { useReminderGate } from './useScheduledReminders';

/**
 * Acts on a tap on a notification. The body opens the page it is about:
 * Today on that day for a meal-time prompt or "fill in yesterday", next
 * week's plan, or Progress for the report. "Ate as planned" logs the slot's
 * planned meal through the store, or confirms the one the app filled in
 * meanwhile, or does nothing for a slot already settled; it says which, and
 * opens Today on that day. A tap that launched the app is read once the
 * store and the session are known; later ones come through the listener.
 * Never on a device that holds nobody's data, and not on the web.
 */
export function useNotificationResponses() {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const { known, active } = useReminderGate();
  // The store as it is now, for a listener registered once.
  const latest = useRef({ app, fb });
  useEffect(() => {
    latest.current = { app, fb };
  });
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (Platform.OS === 'web' || !known || !active) return;
    const handle = (r: TapResponse) => {
      // Acted on once: neither a second delivery nor a remount logs the meal again.
      const key = `${r.id}:${r.action}`;
      clearLastTap();
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const { app: a, fb: f } = latest.current;
      const { data } = r;
      if (r.action === 'ate' && data.kind === 'slot' && typeof data.date === 'string' && typeof data.slotId === 'string') {
        const t = makeT(a.state.profile.lang);
        const out = promptOutcome({ menu: a.menuOn(data.date), meals: a.state.meals, skips: a.state.slotSkips, slotId: data.slotId });
        if (out.kind === 'log') a.addMealFromPlan(data.date, data.slotId);
        if (out.kind === 'confirm') a.confirmMeal(out.mealId);
        f.notify(t(out.kind === 'none' ? 'prompt_already' : 'prompt_logged'));
        void dismiss(r.id);
      }
      router.navigate(tapRoute(data, a.today) as never);
    };
    const first = lastTap();
    if (first) handle(first);
    return onTap(handle);
  }, [known, active, router]);
}
```

- [ ] **Step 5: Call it in `src/app/_layout.tsx`**

After `import { useScheduledReminders } from '../services/useScheduledReminders';` add `import { useNotificationResponses } from '../services/useNotificationResponses';`, and replace the line `  useScheduledReminders();` (in `AppShell`) with:

```ts
  useScheduledReminders();
  useNotificationResponses();
```

- [ ] **Step 6: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests (the rules are Task 8's; the platform calls are checked on a phone in Task 11).

```bash
grep -n "opensAppToForeground" src/services/notify.ts
grep -nE "categoryIdentifier|MEAL_CATEGORY" src/services/notify.ts src/services/useScheduledReminders.ts
```

Expected: the first prints the one `setMealCategory` line with `opensAppToForeground: true`; the second prints the `scheduleAt` content line, the constant and its use in `setMealCategory`, and the import and the `scheduleAt` call in `useScheduledReminders.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/services/notify.ts src/services/useScheduledReminders.ts src/services/useNotificationResponses.ts src/app/_layout.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The meal-time prompt on a phone carries an Ate as planned button: it opens Sobat, which logs that meal as planned with its database calories, or confirms the one the app already filled in, or says it is already on the record, and shows Today on that day. Tapping any reminder opens the page it is about: Today on its day, next week's plan, or Progress for the weekly report. A tap that started the app is acted on once, never again on a remount

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Settings: a switch for every reminder and for the features that start off

**Files:**
- Create: `src/components/ReminderSettings.tsx`, `src/components/FeatureSettings.tsx`
- Modify: `src/app/settings.tsx` (the Reminders section; a Features section)
- Modify: `src/services/useBreakMonitor.tsx`, `src/services/useMantra.ts`, `src/components/useCoach.ts`, `src/app/(tabs)/coach.tsx`, `src/core/pushSchedule.ts`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: Task 8 (`Settings.reminders` with eight switches), `settings.features { breaks, mantra, autoPlates }`, `Ctx.setSettings`, `Ctx.setBreakSettings`, `Toggle`, `FitsCard`.
- Produces: `ReminderSettings()`, `FeatureSettings()`; the features gate what they name; i18n `rem_*` (switch names), `features_title`, `feat_*`.

Settings → Reminders opens with one card holding a switch for each reminder, in the order they come in a day and a week (the meal-time prompt first, the only one on by default), and a note on the web that reminders there show while Sobat is open; the existing card with the hourly nudges, the gap, the permission and test buttons, the relay and the quiet hours follows unchanged. The section header loses its hard-coded English "On"/"Off". A new Features section has three switches: eye-care breaks (switching them on also turns the break panel's own switch on, and the break panel further down shows only while they are on), the day's line, and "What fits today". Off means off everywhere: the break clock sees the breaks as off and no long-break notification is planned (Task 8); `useMantra` gives no line, so neither the Today card nor the 08:00 notification has one; the coach suggests no made-up plate, and the Coach page shows the plates card only while it is on. The relay's copy of the schedule (`pushSchedule.ts`, web with background reminders) follows the same two switches.

- [ ] **Step 1: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  rem_meal_prompt: 'Meal-time prompt', rem_meal_prompt_desc: 'At each meal\'s time, with an Ate as planned button.',
  rem_fill: 'Fill in yesterday', rem_fill_desc: 'At 9:00, only when yesterday has meals missing.', rem_planweek: 'Plan next week', rem_planweek_desc: 'Sunday at 18:00.',
  rem_report: 'Weekly report', rem_report_desc: 'Monday at 9:00: full days, average calories against the goal, the change in weight.',
  rem_sleep: 'Morning check-in', rem_sleep_desc: 'At 7:30: how you slept.', rem_water: 'Water', rem_water_desc: 'Once, at 15:00.',
  rem_review: 'Evening review', rem_review_desc: 'At 21:30: today in five lines.', rem_away: 'After days away', rem_away_desc: 'A short line after two to four days with nothing logged, then quiet.',
  rem_web_note: 'In a browser and on the PC, reminders show while Sobat is open: the meal-time prompt and the nudges below. The others come on the phone.',
  features_title: 'Features', feat_breaks: 'Eye-care breaks', feat_breaks_desc: 'Look away every 20 minutes and stand up every hour while you work.',
  feat_mantra: 'The day\'s line', feat_mantra_desc: 'A short line each morning, at 8:00 and as a card you can add to Today.',
  feat_plates: 'What fits today', feat_plates_desc: 'Plates the app puts together from what is left of the day, on the Coach page.',
```

Before the `};` that closes `mr`:

```ts
  rem_meal_prompt: 'जेवणाच्या वेळची आठवण', rem_meal_prompt_desc: 'प्रत्येक जेवणाच्या वेळी, "ठरवल्याप्रमाणे खाल्लं" बटणासह.',
  rem_fill: 'कालचं भरा', rem_fill_desc: 'सकाळी ९ वाजता, कालची जेवणं राहिली असतील तरच.', rem_planweek: 'पुढच्या आठवड्याचं नियोजन', rem_planweek_desc: 'रविवारी संध्याकाळी ६ वाजता.',
  rem_report: 'आठवड्याचा अहवाल', rem_report_desc: 'सोमवारी सकाळी ९ वाजता: पूर्ण दिवस, लक्ष्याशी तुलना करून सरासरी कॅलरी, वजनातला बदल.',
  rem_sleep: 'सकाळची विचारपूस', rem_sleep_desc: 'सकाळी ७:३० वाजता: झोप कशी झाली.', rem_water: 'पाणी', rem_water_desc: 'एकदा, दुपारी ३ वाजता.',
  rem_review: 'संध्याकाळचा आढावा', rem_review_desc: 'रात्री ९:३० वाजता: आजचा दिवस पाच ओळींत.', rem_away: 'काही दिवस नोंद नसल्यास', rem_away_desc: 'दोन ते चार दिवस काहीच नोंदलं नाही तर एक छोटी ओळ, मग शांत.',
  rem_web_note: 'ब्राउझरमध्ये आणि PC वर Sobat उघडं असताना आठवणी दिसतात: जेवणाच्या वेळची आठवण आणि खालच्या सूचना. बाकीच्या फोनवर येतात.',
  features_title: 'सुविधा', feat_breaks: 'डोळ्यांसाठी विश्रांती', feat_breaks_desc: 'काम करताना दर २० मिनिटांनी दूर पाहा आणि दर तासाला उठा.',
  feat_mantra: 'आजची ओळ', feat_mantra_desc: 'रोज सकाळी एक छोटी ओळ, ८ वाजता आणि आजच्या पानावर जोडता येणारं कार्ड म्हणून.',
  feat_plates: 'आज काय बसतं', feat_plates_desc: 'दिवसाच्या उरलेल्या कॅलरींमधून ॲपने बनवलेली ताटं, कोचच्या पानावर.',
```

Before the `};` that closes `hi`:

```ts
  rem_meal_prompt: 'खाने के वक़्त की याद', rem_meal_prompt_desc: 'हर खाने के वक़्त, "प्लान के मुताबिक़ खाया" बटन के साथ.',
  rem_fill: 'कल का भरें', rem_fill_desc: 'सुबह 9 बजे, सिर्फ़ तब जब कल के खाने बाकी हों.', rem_planweek: 'अगले हफ़्ते की योजना', rem_planweek_desc: 'रविवार शाम 6 बजे.',
  rem_report: 'हफ़्ते की रिपोर्ट', rem_report_desc: 'सोमवार सुबह 9 बजे: पूरे दिन, लक्ष्य के मुकाबले औसत कैलोरी, वज़न में बदलाव.',
  rem_sleep: 'सुबह का हालचाल', rem_sleep_desc: 'सुबह 7:30 बजे: नींद कैसी रही.', rem_water: 'पानी', rem_water_desc: 'एक बार, दोपहर 3 बजे.',
  rem_review: 'शाम की समीक्षा', rem_review_desc: 'रात 9:30 बजे: आज का दिन पाँच पंक्तियों में.', rem_away: 'कुछ दिन दर्ज न हो तो', rem_away_desc: 'दो से चार दिन कुछ दर्ज न हो तो एक छोटी पंक्ति, फिर चुप.',
  rem_web_note: 'ब्राउज़र में और PC पर Sobat खुला हो तब याद दिखती है: खाने के वक़्त की याद और नीचे के संकेत. बाकी फ़ोन पर आती हैं.',
  features_title: 'सुविधाएँ', feat_breaks: 'आँखों के लिए विराम', feat_breaks_desc: 'काम करते समय हर 20 मिनट दूर देखें और हर घंटे उठें.',
  feat_mantra: 'आज की पंक्ति', feat_mantra_desc: 'हर सुबह एक छोटी पंक्ति, 8 बजे और आज के पन्ने पर जोड़ने लायक कार्ड के रूप में.',
  feat_plates: 'आज क्या फिट बैठता है', feat_plates_desc: 'दिन की बची कैलोरी से ऐप की बनाई थालियाँ, कोच के पन्ने पर.',
```

- [ ] **Step 2: Create `src/components/ReminderSettings.tsx`**

```tsx
import React from 'react';
import { Platform, View } from 'react-native';
import type { Settings } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Small, Toggle } from '../ui/components';
import { C } from '../ui/theme';

type ReminderKey = keyof Settings['reminders'];

/** In the order they come in a day and a week. Each row's words are `rem_<name>` and `rem_<name>_desc`. */
const ROWS: { key: ReminderKey; name: string }[] = [
  { key: 'mealPrompt', name: 'meal_prompt' },
  { key: 'fillYesterday', name: 'fill' },
  { key: 'planWeek', name: 'planweek' },
  { key: 'weeklyReport', name: 'report' },
  { key: 'sleepCheckin', name: 'sleep' },
  { key: 'water', name: 'water' },
  { key: 'dayReview', name: 'review' },
  { key: 'away', name: 'away' },
];

/** Settings → Reminders: one switch for each reminder the app sends on its own. Only the meal-time prompt starts on. */
export function ReminderSettings() {
  const app = useApp();
  const r = app.state.settings.reminders;
  const t = makeT(app.state.profile.lang);
  return (
    <Card>
      {ROWS.map((row, i) => (
        <View key={row.key}>
          {i > 0 ? <Divider /> : null}
          <Toggle title={t(`rem_${row.name}`)} desc={t(`rem_${row.name}_desc`)} on={r[row.key]} onToggle={() => app.setSettings({ reminders: { ...r, [row.key]: !r[row.key] } })} />
        </View>
      ))}
      {Platform.OS === 'web' ? <Small color={C.textFaint}>{t('rem_web_note')}</Small> : null}
    </Card>
  );
}
```

- [ ] **Step 3: Create `src/components/FeatureSettings.tsx`**

```tsx
import React from 'react';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Toggle } from '../ui/components';

/** Settings → Features: the parts of the app that stay off unless switched on here. */
export function FeatureSettings() {
  const app = useApp();
  const f = app.state.settings.features;
  const t = makeT(app.state.profile.lang);
  return (
    <Card>
      <Toggle
        title={t('feat_breaks')}
        desc={t('feat_breaks_desc')}
        on={f.breaks}
        onToggle={() => {
          // Switched on here, the breaks run: the break panel's own switch may have been turned off before.
          if (!f.breaks && !app.state.breakSettings.enabled) app.setBreakSettings({ enabled: true });
          app.setSettings({ features: { ...f, breaks: !f.breaks } });
        }}
      />
      <Divider />
      <Toggle title={t('feat_mantra')} desc={t('feat_mantra_desc')} on={f.mantra} onToggle={() => app.setSettings({ features: { ...f, mantra: !f.mantra } })} />
      <Divider />
      <Toggle title={t('feat_plates')} desc={t('feat_plates_desc')} on={f.autoPlates} onToggle={() => app.setSettings({ features: { ...f, autoPlates: !f.autoPlates } })} />
    </Card>
  );
}
```

- [ ] **Step 4: `src/app/settings.tsx`**

After `import { OllamaSetup } from '../components/OllamaSetup';` add:

```ts
import { FeatureSettings } from '../components/FeatureSettings';
import { ReminderSettings } from '../components/ReminderSettings';
```

Replace

```tsx
        <SectionHeader title={t('reminders')} meta={s.nudgesEnabled ? 'On' : 'Off'} icon={<Ionicons name="notifications-outline" size={13} color={C.textFaint} />} />
```

with

```tsx
        <SectionHeader title={t('reminders')} icon={<Ionicons name="notifications-outline" size={13} color={C.textFaint} />} />
        <ReminderSettings />
```

and before

```tsx
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('water_goal')}
```

add

```tsx
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('features_title')} icon={<Ionicons name="options-outline" size={13} color={C.textFaint} />} />
        <FeatureSettings />
      </View>

```

Further down, the break panel shows only while eye-care breaks are on (its own switch would otherwise read on while nothing runs), and its header loses the English "On"/"Off" too. Replace

```tsx
          <View style={{ gap: 10 }}>
            <SectionHeader title={t('break_monitor')} meta={br.enabled ? 'On' : 'Off'} />
```

with

```tsx
          {s.features.breaks ? (
          <View style={{ gap: 10 }}>
            <SectionHeader title={t('break_monitor')} />
```

and close it after the panel's card: replace

```tsx
                  <Text style={{ color: C.textFaint, fontWeight: '500' }}> / {app.state.breaks.length}</Text>
                </Text>
              </Row>
            </Card>
          </View>
```

with

```tsx
                  <Text style={{ color: C.textFaint, fontWeight: '500' }}> / {app.state.breaks.length}</Text>
                </Text>
              </Row>
            </Card>
          </View>
          ) : null}
```

- [ ] **Step 5: Off means off**

In `src/services/useBreakMonitor.tsx`, replace `  const settings = app.state.breakSettings;` with:

```ts
  // Eye-care breaks are off unless switched on in Settings: with the feature off the clock reads the breaks as off.
  const breaksOn = app.state.settings.features.breaks;
  const stored = app.state.breakSettings;
  const settings = useMemo(() => (breaksOn ? stored : { ...stored, enabled: false }), [breaksOn, stored]);
```

In `src/services/useMantra.ts`, replace

```ts
  return useMemo(() => {
    const plan = planFrom(state.profile, state.weights, targets, today);
```

with

```ts
  const on = state.settings.features.mantra;
  return useMemo(() => {
    // The day's line is off unless switched on in Settings: no card, no morning notification.
    if (!on) return null;
    const plan = planFrom(state.profile, state.weights, targets, today);
```

and replace its dependency line `  }, [state.profile, state.weights, state.water, state.meals, state.sleep, state.settings.waterGoalMl, state.schedule, targets, today, hour, lang]);` with `  }, [on, state.profile, state.weights, state.water, state.meals, state.sleep, state.settings.waterGoalMl, state.schedule, targets, today, hour, lang]);`.

In `src/components/useCoach.ts`, replace the line that begins `      nextPlate: slot ? {` with:

```ts
      // A plate the app puts together is offered only while "What fits today" is switched on.
      nextPlate: state.settings.features.autoPlates && slot ? { id: slot.id, type: slot.type, budget: slot.budget, kcal: slot.kcal, names: slot.picks.map((p) => foodName(p.food, lang)) } : null,
```

and in its dependency array, replace `app.streakDays, lang]);` with `app.streakDays, state.settings.features.autoPlates, lang]);`.

In `src/app/(tabs)/coach.tsx`, after `import { adviceText, CoachStrip } from '../../components/CoachStrip';` add `import { FitsCard } from '../../components/FitsCard';`, and replace `            <CoachStrip max={8} />` with:

```tsx
            <CoachStrip max={8} />
            {app.state.settings.features.autoPlates ? <FitsCard compact /> : null}
```

In `src/core/pushSchedule.ts`, replace `      sched.enabled && br.enabled && br.micro.enabled` with `      state.settings.features.breaks && sched.enabled && br.enabled && br.micro.enabled`, and replace the line `    mantras,` with `    mantras: state.settings.features.mantra ? mantras : [],`.

- [ ] **Step 6: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests.

```bash
grep -n "'On' : 'Off'" src/app/settings.tsx
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|LinearGradient|hitSlop" src/components/ReminderSettings.tsx src/components/FeatureSettings.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint|desc)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/ReminderSettings.tsx src/components/FeatureSettings.tsx
```

Expected: all three print nothing.

- [ ] **Step 7: Commit**

```bash
git add src/components/ReminderSettings.tsx src/components/FeatureSettings.tsx src/app/settings.tsx src/services/useBreakMonitor.tsx src/services/useMantra.ts src/components/useCoach.ts "src/app/(tabs)/coach.tsx" src/core/pushSchedule.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Settings has a switch for every reminder, the meal-time prompt first and the only one on to begin with, and a Features section for eye-care breaks, the day's line and What fits today, all off until switched on; off means off everywhere: no break clock or break notifications, no line on Today or at eight, no made-up plates from the coach, and the relay's schedule follows the same switches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Controller screen check (web at 375 px, light and dark, English and Marathi at 1.25; one phone check)

This task is for the controller, not an implementer, and changes no code unless it finds a defect (then fix it in a follow-up commit named for the behaviour, and re-check).

- [ ] **Step 1: Start the web preview and seed it**

Start the `sobat-web` configuration from `.claude/launch.json` (port 8082) and seed it as in Plan 3's Task 19 (`/seed-dev.json` into `localStorage['sobat.state.v1']`, reload). Resize to 375 × 812. Check `JSON.parse(localStorage.getItem('sobat.state.v1')).version` reads 7 and `settings.nudgesEnabled` reads false (the migration), `settings.reminders` has eight keys with only `mealPrompt` true.

- [ ] **Step 2: Screens to capture**

In each of light and dark, and in each of English at text scale 1 and Marathi at text scale 1.25, take a screenshot of:

1. **Plan next week** (Me → Diet plan, and `/plan` directly; on a Saturday or Sunday it opens on next week, otherwise on this one): the dates with arrows, seven rows with a main dish, a total and a status (on target with a tick, High in amber, Low in red, Suggested and Day off in grey, Nothing planned), the average line, "Looks good, save week" (tap it: "Week saved", the button turns to "This week is saved" and stays so after a reload), the grocery row. Tap a future day: the plan-mode menu with − / +, the day-off switch, Balance (a note says what changed), a food's name opens the swap sheet (pick one; the row's total changes at once). Tap a past day of this week: the planned lines read-only, the note, "Open on Today" goes to Today on that date. `/plan?date=2026-11-04` opens that week with the 4th open. A suggested day under the safe minimum (make a day of one chapati in the console, or pick the lightest suggested day with a 1,500 kcal floor) shows the amber line with Balance.
2. **Progress**: the Weight and Streak tiles; the trend card (smoothed weight, "−x.x kg in 3 weeks" or the "weigh in over three weeks" line, the line of weigh-ins, "Goal NN kg around DD Mon YYYY"); Lost, To go, "N of 7"; the calendar of this month (dots like the strip, lighter where filled from the plan; the next-month arrow is off; tap the 3rd: Today shows the 3rd); the week card (average, the climb row with level, points, bar and badges count; tap: the climb page with the mountain and every badge and no tiles; History; Charts). `/progress?s=coach` lands on Coach and `/progress?s=charts` on Charts.
3. **Setup** (in the console: `const s = JSON.parse(localStorage.getItem('sobat.state.v1')); s.profile.onboarded = false; localStorage.setItem('sobat.state.v1', JSON.stringify(s)); location.reload();`): step 1 language with the progress line at a quarter; step 2 empty boxes with "e.g. 1990" and "e.g. 165", Next with an empty year says what to fix; "98" and "2015" are refused; step 3 with "e.g. 72" and "e.g. 65", the healthy range line, a goal under it refused with the minimum named, Mostly sitting and 0.5 kg selected; step 4 the target in plain words with the goal's date and year; Start goes to the permissions screen, then Today. No tour. Me → Guide has "Show the tour".
4. **Customize** (Me → Customize, and a long press on any tab): the three locked rows, the five tab switches with Progress on; switch on Coach (the bar shows it at once), then Sleep: the question on the page with two buttons and Cancel, pick Progress: the bar is Today · Sleep · ➕ · Coach · Me. Cards: Calories left locked; Menu, Coach line, Water and walk with up and down (the top up and the bottom down are dimmed); move Water and walk up: Today's order changes; switch on Weight and Streak in More cards: they join the end and appear on Today as a pair; with the day's line off in Settings its card is not listed and the note says why. Reset to default, then Undo, then Reset again.
5. **A new chapter** (Me → Start a new chapter): the sheet's words with the latest weigh-in; Start from today: the toast; Progress shows Lost 0.0 kg and the climb at its foot, the Streak tile at 0 or 1 (today if full), the climb page's challenge counting from today, every badge still earned, History unchanged. In the console the profile has `chapterStart` today and `firstStartWeightKg` the old start.
6. **Settings → Reminders**: the eight switches with the meal-time prompt alone on, the web note, then the old card with the hourly nudges switch off; the Features section with three switches off. Switch eye-care breaks on: the break panel and the sidebar entry come back (desktop width); switch the day's line on: Customize lists its card and Today shows it once added; switch What fits today on: the Coach page shows the plates card.

- [ ] **Step 3: What to check on each**

- **At most five blocks** on Progress and on the plan screen before a day is opened.
- **44 px**: the console check from Plan 3's Task 19 returns an empty list on the plan screen, Progress (the calendar's days included), setup, Customize, the chapter sheet and Settings → Reminders.
- **Words**: no English on the Marathi screens (except "kcal", "kg", "g", "PC", "Sobat" and food names without Marathi); no TDEE, BMR, XP or "swaps"; no matras clipped at 1.25 (the calendar's weekdays and days, the plan rows' statuses, the setup steps, the Customize rows).
- **Accessibility tree** (`read_page`): plan rows are buttons named "Wed 4 Nov: Palak bhaji, 1,640 kcal, On target" with `aria-selected` on the open one; the calendar's days are named with their mark; switches have `aria-checked`; the move buttons are named "Move Water and walk up"; the tab buttons carry the hint "Hold to choose the tabs".
- **Page title**: "Customize · Sobat" on `/customize`.
- **Console**: no errors while moving weeks and months, opening days, and switching settings.

- [ ] **Step 4: One check on a phone**

On a development build (`npx expo run:ios` on the simulator, or `npx eas-cli@latest build --profile development` for a phone), with the meal-time prompt on and a slot a few minutes ahead (change the slot's time in the eating pattern):

1. The prompt arrives at the slot's time titled "Lunch · NNN kcal" with an "Ate as planned" button (long-press or pull down on iOS to see it).
2. With the app in the background: tap the button. Sobat opens on Today, the toast says "Logged as planned", the slot is ticked with the planned calories, and the notification is gone from the tray.
3. Kill the app, repeat with the next slot: the same, once (reopen the app from the switcher: the meal is not logged twice).
4. Tap the body of a prompt instead: Today opens on that day, nothing is logged.
5. Switch on Fill in yesterday, Plan next week and Weekly report, and read the pending list (`Notifications.getAllScheduledNotificationsAsync()` from a dev menu or a debug log): `sobat-r-fill:…` at 09:00 when yesterday is incomplete, `sobat-r-planweek:…` on Sunday 18:00, `sobat-r-report:…` on Monday 09:00; with them off, none.

- [ ] **Step 5: Record**

Save the screenshots in the scratchpad (`shots/plan4-*.png`) and write one line per screen and per phone step in `.superpowers/sdd/progress.md` under a Plan 4 heading: PASS, or the defect and the commit that fixed it.

---

## Self-review

**Checked before handing over:** every task was applied in order, from this document's own code blocks and replacement anchors, by a script that reads this file, to a scratch copy of the repo at `3ff9926` (Plan 1 built, both clean-ups included), after Plan 3's 19 tasks had been applied to it from Plan 3's document. Every anchor matched. After each task on its own, `tsc --noEmit`, ESLint with the repo's config (React Compiler rules included) and the whole suite were clean, the suite going 969 → 977 → 977 → 985 → 985 → 990 → 996 → 1002 → 1014 → 1014 (45 new; 907 at `3ff9926` itself). After Task 10 the copy also typechecks against the repo's generated typed routes, `npx expo export -p web` renders every route statically (`/customize` included), and the verification greps print what each step says. Not run: the screens (Task 11's first three steps) and everything that needs a phone (Task 11 step 4): the category's button, a tap reaching the listener after the app was killed, the dismissal, and the OS's pending list.

**Spec coverage:**

1. **Plan next week**: dates with arrows, a row per day with the main dish, the total and on target / high / low / off (and Suggested and Nothing planned), the week's average against the goal (Tasks 1, 2); a tapped day in the same plan-mode menu as Today's future days, Balance and swaps inside it, past days read-only with a way to Today, every edit per date through `editMenu*` and no whole-week write-back (Task 2); "Looks good, save week" only stamps `settings.reviewedWeeks` (Tasks 1, 2).
2. **Progress**: the time-weighted trend with the 3-week change, a sparkline and the goal's date with its year (Tasks 3, 4); Lost, To go and Logged of 7 (Task 4); the record calendar from `dayRecord`, lighter when filled from the plan, a tap opening Today at `?date=` (Tasks 3, 4); the weekly average against the goal, the climb as one row with the badges behind it, History as a link (Task 4).
3. **Setup**: four steps with a progress line, empty boxes with "e.g." examples, the healthy range, the target in plain words, mostly sitting and 0.5 kg a week as defaults, the adult year, four digits and the healthy minimum kept, `onboardedOn` kept, no tour after setup and the tour in Me → Guide (Task 5).
4. **Customize**: locked Today, ➕ and Me, up to two extras with the replace question on the page, locked Calories left, cards switched and moved with accessible buttons, the optional cards, Reset with Undo, a Me row and a long press on the bar (Task 6).
5. **A new chapter**: one plain sheet; `startWeightKg` from the latest weigh-in and `chapterStart` today; the weekly challenge and the streak from that day; nothing deleted; Lost and the climb from the chapter; optional fields and a field-by-field merge of the profile and the settings in sync (Task 7).
6. **Reminders**: the meal-time prompt at each slot time titled with the planned kcal, the "Ate as planned" category through expo-notifications 57 (the action opens the app, see "Decisions"), the body opening Today on that day, no prompt for a done, skipped or empty slot or on an off day, a week reconciled on every open; Fill yesterday, Plan next week and the Monday report, each off by default; the old nudges off by default through the migration with a switch each; the gates kept (Tasks 8, 9).
7. **Settings**: a switch for every reminder, `mealPrompt` included, and for eye-care breaks, the day's line and "What fits today", each switch obeyed where the feature lives (Tasks 8, 10).
8. **The controller's check** of all of the above (Task 11).

**Tests added:** 8 (plan week, plan-only day view) + 8 (trend, day mark, dates, month grid) + 5 (setup) + 6 (customize) + 6 (chapter, challenge, field merge) + 12 (reminders, migration) = 45.

**Left out, on purpose:** logging from the "Ate as planned" button without opening the app (needs `expo-task-manager` and a headless writer; see "Decisions"); the new phone reminders on the web and the PC, which keep their in-app meal prompt until the relay is deployed (the spec puts the relay outside this work); the relay's own copy of the meal prompt (`pushSchedule.ts` still says "Lunch?" at the slot time plus the grace); dragging Today's cards; and focusing a slot when Today opens from a tap (Today opens on that day, where the slot whose time it is is already the open one).
