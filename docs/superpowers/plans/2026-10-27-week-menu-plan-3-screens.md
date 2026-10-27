# Week menu redesign, Plan 3 of 4: screens I (tiles, tab bar and Me, Today, the add sheet) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the week menu in front of the person. Every tracker becomes a living tile that shows its value with its own art; the tab bar becomes Today · the chosen extras · ➕ · Me, with a plain Me list; Today becomes four calm blocks (the week strip with calories left, the day's menu in past, today and future modes, one coach line, and the Water and Walk tiles); and the ➕ opens one add sheet that logs any meal for the date and slot being looked at, with calories from the database. The open UI items left by Plans 1 and 2 are folded in.

**Architecture:** Every rule a screen needs is a pure, tested function: `src/core/tileText.ts` (tile numbers and short lines), `src/ui/tileGeometry.ts` (tile sizes and art shapes), `src/core/bar.ts` (tab bar and Me rows), `src/core/screenTitle.ts`, `src/core/basket.ts` (the add sheet's basket), `src/core/addSheet.ts` (the add sheet's rows), `src/core/dayView.ts` (the day's menu rows and their modes), `src/core/weekStrip.ts`, `src/core/todayLayout.ts`, and `findFoods` / `itemName` in `src/core/foods.ts`. Components only lay these out: `src/components/tiles/` (one frame, `LivingTile`, and one tile per tracker on Reanimated shared values and react-native-svg), `TabBar`, `Sidebar`, `(tabs)/me.tsx`, `WeekStrip`, `CaloriesLeft`, `DayMenu`, `CoachLine`, and `AddSheet` (a provider in the tabs layout, opened by ➕, by Today's menu rows and by the old `/log` address). The store gains only `addWater(ml, date)` returning an id, `removeWater(id)` and `planFoods`; everything else is Plan 1's.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.25), React Native 0.86.3, expo-router ~57.0.23 (typed routes and the React Compiler are on in `app.json`), react-native-reanimated 4.5.1 with react-native-worklets 0.10.1, react-native-svg 15.15.4, expo-haptics ~57.0.3 (through `useFeedback().haptic`), fuse.js 7.5, TypeScript ~6.0 strict, vitest 4.1 (TZ pinned to Asia/Kolkata; `react-native` is stubbed in `vitest.config.mts`, so tests import only `src/core/**` and `src/ui/**` modules that do not import React Native), npm.

Spec: `docs/superpowers/specs/2026-10-27-week-menu-redesign-design.md` ("Decisions", "Part 2: screens" → "Tab bar and Me", "Today", "The tank tiles", "Living tiles", "The add sheet"; "Testing"). Style rules: `docs/superpowers/plans/2026-10-27-week-menu-plan-2-style.md`. Data: `docs/superpowers/plans/2026-10-27-week-menu-plan-1-core.md`. Later decisions: `.superpowers/sdd/progress.md` from "## REDESIGN Plan 2".

## Built Plan 1 interfaces

Plan 1 is built (HEAD `3ff9926`, its clean-ups A and B included). This plan uses these as they are in the code:

- **The store** (`src/store/AppProvider.tsx`, `Ctx`): `menuOn(date): DayMenu` (a date nobody wrote shows the app's suggestion fitted to the person's target), `weekMenus(monday)`, `isSuggestedMenu(day)`, `suggestionOn(date)`; `editMenuLine(day, mealId, lineIdx, next | null)` (`null` removes the line), `editMenuMeal(day, meal)`, `editMenuDay`, `addMenuFood`, `copyMenuDay`; `addMealFromPlan(date, slotId, source?)` and `fillDayFromPlan(date)`, which do nothing for a date after today; `confirmMeal(id)`, `confirmDay(date)`, `runAutoFill()`; `addSavedMeal(name, lines)`, `removeSavedMeal(id)`; `logWalk(date, minutes): string` with `removeActivity(id)` for undo; `streakDays` (`recordStreak`: a day settled only by skips ends the run, as `bestStreak` in Task 1 does); `addMeal(m)` (`withMealAdded`: the meal lands in its slot and lifts a skip there); `removeMeal(id)` (`withMealRemoved`: once the slot's moment to be filled in from the plan has passed, whatever the meal's source, a slot left empty is marked skipped so it is not filled straight back; before that moment nothing is marked); `updateMeal` (`editedMeal`: the stored meal's source decides, a filled-in meal edited becomes `plan`). `planFoods` is a memo, `useMemo(() => allFoods(state.customFoods), [state.customFoods])` with `allFoods` from `src/store/defaults.ts`, already in the value's dependency list but not in `Ctx`: Task 3 exposes it.
- **The state**: `savedMeals`, `slotSkips`, `menus`; `openedDates` (this device only, never synced; nothing here reads it); `Profile.onboardedOn` (filling in from the plan ignores one after today); `Settings.bottleMl`, `walkGoalMin`, `tabs`, `todayCards`, `features`, `reminders` (a stored switch that is not true or false reads off; a missing or broken `mealPrompt` follows `nudgesEnabled`), `offDays`.
- **The core**: `record.ts` `dayRecord`, `weekRecord`, `recordStreak({ limit? })`; `tiles.ts` `waterTile`, `walkTile`, `sleepFraction`, `streakFraction`, `weightPoints` (its first line is `import type { WeightLog } from './types';`, which Task 3 replaces); `activity.ts` `WALK_ACTIVITY_ID`, `walkLog`; `menu.ts` `menuSlots`, `mealFromLines` (null for a date after today), `skippedOn`, `settleAuto`; `pattern.ts` `slotStates`, `settledSlotIds` and `currentSlot` (a slot holding only a filled-in meal stays open until a later slot whose window has opened holds a real meal or is skipped); `coach.ts` reads the hour off `nowMinutes` (there is no `CoachInput.hour`) and `nextPlate.id` is required; `useCoach(nowMinutes): Advice[]`, and `CoachStrip` still exports `adviceText` and `useAdviceAction`.
- **The plan screen**: `plan.tsx` still reads `app.weekPlan`; Task 18 edits only its stepper, link, day-chip and protein lines, matched by text (Plan 4 rewrites the screen on the per-date menus).

Every task below was applied to `3ff9926` and checked (see "Self-review").

## Decisions taken in this plan

Where the spec leaves a choice open or two parts of it meet, this plan decides as follows; each is repeated in the task that does it.

- **Tile type.** The spec's tile layout gives its own sizes (name 13, number 30, unit 14, line 12) beside the app's four sizes. They are defined once, in `src/ui/tileGeometry.ts`, scaled by the text-size setting, and used only inside `LivingTile`. A tile stays square at text scale 1 and grows taller than wide only when a larger text scale needs the room, so the art zone never overlaps the words.
- **The ➕ in the middle.** The bar is Today, the extras, Me, with ➕ inserted at the middle index (`floor(n / 2)` of the other items): Today · ➕ · Me; Today · ➕ · Progress · Me (decision 4); Today · Progress · ➕ · Coach · Me.
- **Sleep and Diet plan as tabs** are two hidden tab routes, `(tabs)/sleep-tab.tsx` and `(tabs)/plan-tab.tsx`, because `/sleep` and `/plan` are stack screens and a tab must live under `(tabs)`. The old addresses keep working.
- **Me** follows the spec's list and adds a Progress row while Progress is not one of the person's tabs, so a hidden tab's page is always reachable from Me. Plan 4 adds "Start a new chapter" and "Customize" to the same data-driven list.
- **Today's viewed date** lives in the address as `/?date=YYYY-MM-DD` (no param for today), so the ➕ in the tab bar and the sidebar can read it, a reload keeps it, and a notification can open a day. The week strip moves a week at a time and keeps the weekday.
- **The week strip's arrows** sit in a header row with the week's dates, so each of the seven day buttons gets a full seventh of the width (49 pt at 375 pt) instead of being squeezed under 44 pt beside two arrows.
- **On a past day** the coach line and the mantra are hidden (they speak about now); **on a future day** the Water and Walk tiles are hidden too (nothing is drunk in the future).
- **Undo** for a tile tap is a line under the tiles with a 44 pt Undo button, as the spec says, not the app-wide toast (whose action button is 36 pt).
- **Breathe's icon** is `leaf-outline`: Ionicons has no wind icon.
- **"Best" on the streak tile** is the longest run of full days in the last 90 days, never less than today's streak.
- **Water words move to bottles.** Every place a tap adds `bottleMl` says bottle; the craving helper, whose first step says "a glass of water", logs a 250 ml glass.
- **Photo and barcode** from the add sheet open the existing screens, which log for today, as before.
- **What leaves Today** with no new home in this plan: the notification-permission nudge, the break panel and check-in, the away card, the decision card, the day score, the tip, the day review and the timing card. Their code stays; Plan 4 (reminders, Settings and Customize) decides where each goes.

## API notes (checked for the installed versions)

- **Reanimated 4.5.1 + worklets 0.10.1.** `docs.expo.dev/versions/v57.0.0/sdk/reanimated`: installed with `react-native-worklets`, "no additional configuration"; web is supported. `node_modules/babel-preset-expo/build/configs/expo.js` lines 96-107 add `react-native-worklets/plugin` on its own when the package is installed, so no `babel.config.js` is needed. Reduce motion: `useReducedMotion()` from `react-native-reanimated` (`lib/typescript/hook/useReducedMotion.d.ts`) returns the setting at app start and does not re-render on change; web supported. Shared values have `get()` and `set()` (`lib/typescript/commonTypes.d.ts` lines 129-136); the Reanimated docs say to use them instead of `.value` under the React Compiler and never to read or write a shared value during render, so every read here is inside `useAnimatedStyle` / `useAnimatedProps` and every write inside `useEffect`. SVG: the "Animating SVG" guide wraps react-native-svg elements with `Animated.createAnimatedComponent(Circle)` and drives them with `useAnimatedProps`; `strokeDashoffset` animates on Android, iOS and web; on web `useAnimatedProps` is the way for props that are not CSS (`cx`, `cy`, `r`). Exports used: `createAnimatedComponent` (default `Animated`), `useSharedValue`, `useAnimatedStyle`, `useAnimatedProps`, `withTiming`, `withRepeat`, `withSequence`, `cancelAnimation`, `Easing`, `useReducedMotion`, `type SharedValue` (`lib/typescript/index.d.ts`).
- **react-native-svg 15.15.4.** `strokeDasharray?: ReadonlyArray<NumberProp> | NumberProp`, `strokeDashoffset?: NumberProp` (`lib/typescript/lib/extract/types.d.ts` lines 61-62); `Svg` takes `viewBox` and `preserveAspectRatio` strings (default `xMidYMid meet`, which keeps the art's aspect ratio).
- **expo-haptics ~57.0.3.** `docs.expo.dev/versions/v57.0.0/sdk/haptics`: `impactAsync(ImpactFeedbackStyle.Light)`, `notificationAsync(NotificationFeedbackType.Success)`; web uses the Vibration API; on Android the docs prefer `performAndroidHapticsAsync`. The app already wraps the first two in `useFeedback().haptic('light' | 'success')` (`src/services/feedback.tsx`, silent on the web); the tiles use that wrapper, so this plan adds no haptics code.
- **expo-router ~57.0.23.** `docs.expo.dev/router/advanced/tabs`: `<Tabs.Screen name="…" options={{ href: null }} />` keeps a route out of the bar while it stays reachable (already used in `(tabs)/_layout.tsx`). `router.setParams(params)` merges into the focused route (`build/global-state/router.js` line 126) and the address is built with `query-string`'s `stringify` (`build/fork/getPathFromState-forks.js` line 71), which drops `undefined` values, so `router.setParams({ s: undefined })` clears `?s=`. The empty web page title comes from `ExpoRoot` passing `documentTitle: { enabled: false }` (`build/ExpoRoot.js` line 65); `import Head from 'expo-router/head'` sets it (`expo-router/entry` wraps the app in `Head.Provider`, `build/qualified-entry.js` line 20; `ExpoHead.android.js` renders nothing). `typedRoutes` is on and `.expo/types/router.d.ts` is only regenerated by the dev server, so code here never writes a typed literal for a route this plan adds (`me`, `sleep-tab`, `plan-tab`): the tab bar navigates by route name and the sidebar casts as the existing code does.
- **React Native 0.86.** `fontVariant: ['tabular-nums']` for the tile numbers; `style.pointerEvents` (not the deprecated prop, which react-native-web warns about); `PanResponder` for the week strip's swipe (the app has no `GestureHandlerRootView`, so react-native-gesture-handler is not used); `Pressable` `onLongPress` with `delayLongPress`.

## Global Constraints

- npm, not bun (there is no `bun.lock`): every command is `npx …` or `npm …`.
- Dependencies only through `npx expo install <package>`; none are expected in this plan.
- Never push. Every push to `main` deploys the website and publishes an APK. Commit after each task; do not push at the end either.
- Before a task is done: `npx tsc --noEmit`, `npx expo lint` and `npx vitest run` are all clean. Write down the test count at the start of Task 1; each task says how many it adds, and the count only goes up.
- Firebase is Auth only. The data is one state file per user, synced through the relay; never Firestore.
- Every meal-shaped thing reads the eating pattern (slots, keyed by slot id), never a fixed list of meal hours.
- Every meal added to the state goes through `app.addMeal` / `addMealFromPlan` / `fillDayFromPlan` (the store's `withMeal` → `withSlot` path).
- Calories always come from the food database × grams (`lineInfo`, `toMealItem`, `kcalForGrams`), never typed or guessed.
- Match the surrounding comment density and naming: plain sentences, no em-dashes in copy, no new `eslint-disable` lines. React Compiler rules apply: no synchronous set-state in an effect body (use a timer or a listener callback), no ref reads in render; Reanimated shared values are read and written only with `get()` / `set()` inside worklets and effects.
- The user is "the user", "they" or "the person", never he or she.
- Do not create or edit `ios/` or `android/`.
- Commit messages are plain-English sentences describing behaviour, and end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Controls**: every pressable is at least 44 pt on every platform. The web ignores `hitSlop`, so size the box itself (`minHeight` / `minWidth` / `width` / `height` of `S.touch`), never rely on `hitSlop`. Every pressable has `accessibilityRole` and an `accessibilityLabel` when its visible text is not the whole name; selected state is `aria-selected`, open state `aria-expanded`, as Plan 2 set up.
- **Words**: every visible string and every accessibility label comes from `src/i18n/index.ts`, in `en`, `mr` and `hi`, in plain words: no TDEE, BMR, XP, "swaps", "day score" or "verified record". New keys go before the `};` that closes each dict; `grep -n '^};' src/i18n/index.ts` prints the three closing lines (en, mr, hi, in that order). A duplicate key is a TS1117 error, which `tsc` catches.
- **Style** (Plan 2): sizes from `F` (`number`, `title`, `body`, `small`) with `lh()` line heights, weights `'400'` and `'500'` only, colours from `C` (teal words in `C.accentText`, words on a teal fill in `C.onAccent`), labels in normal case, no `fontFamily`, no `letterSpacing`, no gradients, no emoji in food rows. The one exception is the living tile's own type (see "Decisions").
- **Verification greps** after each UI task, on the files the task touched: `grep -nE "fontFamily|eslint-disable|textGhost|letterSpacing|toUpperCase|fontWeight: '[6-9]00'|LinearGradient|hitSlop" <files>` prints nothing, and `grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" <files>` prints nothing (no hard-coded English).
- macOS tools: `sed -i ''` and `perl -pi -e`; every sweep is followed by the grep it names.

## File Structure

Created:

| File | Responsibility |
|---|---|
| `src/core/tileText.ts` | Each tile's number (with its unit key) and short line (key and params); walk minutes of a day; the best streak; the breathing phase |
| `src/ui/tileGeometry.ts` | The tile's type sizes and minimum height at a text scale; the art shapes in a 100 × 42 box; point-along-a-path (a worklet) |
| `src/components/tiles/motion.ts` | `useTileProgress`, `useDrawOn`, `useLoop`, `useBreath`: shared values that follow the motion rules |
| `src/components/tiles/LivingTile.tsx` | The frame: square, 22 radius, hairline; words pinned top, art in the bottom 42% |
| `src/components/tiles/WaterTile.tsx`, `WalkTile.tsx`, `SleepTile.tsx`, `WeightTile.tsx`, `StreakTile.tsx`, `BreatheTile.tsx` | One tracker each: its art, words and tap |
| `src/components/tiles/TileRow.tsx`, `UndoLine.tsx`, `TileSheet.tsx`, `WaterWalk.tsx`, `WalkSleep.tsx` | Two tiles in a row; "Added … · Undo" for 5 s; the long-press sheet; the Water + Walk pair (Today) and the Walk + Sleep pair (Body) |
| `src/core/bar.ts` | The tab bar's items and the Me rows, from `settings.tabs` |
| `src/app/(tabs)/me.tsx`, `sleep-tab.tsx`, `plan-tab.tsx` | Me; Sleep and Diet plan as tabs |
| `src/components/SavedMealsSheet.tsx` | Me → Saved meals: the list, with delete |
| `src/ui/useSectionParam.ts` | A tab section picked by `?s=`, the param cleared once applied |
| `src/core/screenTitle.ts` | The web page title for each address |
| `src/core/basket.ts` | The add sheet's basket: steps, counts, grams, totals, plan lines, the meal it saves, the slot preview |
| `src/ui/QtyStepper.tsx` | − count + with two 44 pt buttons |
| `src/core/addSheet.ts` | The add sheet's rows, in order |
| `src/components/AddSheet.tsx`, `AddSheetRows.tsx` | The ➕ sheet (provider, modal, search, slot, basket, save) and its rows |
| `src/core/dayView.ts` | The day's menu, row by row: done, skipped, current, open, later or plan; totals; missing; fill |
| `src/core/weekStrip.ts`, `src/components/WeekStrip.tsx` | The week strip's marks and swipe; the strip |
| `src/components/DayMenu.tsx` | The day's menu in today, past and future modes |
| `src/core/todayLayout.ts` | Today's blocks from `settings.todayCards` |
| `src/components/CaloriesLeft.tsx`, `CoachLine.tsx`, `MantraCard.tsx`, `StepsCard.tsx` | Today's header numbers, the one coach sentence, and two optional cards |
| Tests | `src/core/__tests__/tileText.test.ts`, `bar.test.ts`, `screenTitle.test.ts`, `basket.test.ts`, `addSheet.test.ts`, `dayView.test.ts`, `weekStrip.test.ts`, `todayLayout.test.ts`; `src/ui/__tests__/tileGeometry.test.ts` |

Modified: `src/core/tiles.ts` (`waterLog`), `src/core/foods.ts` (`findFoods`, `itemName`, `includeScore`), `src/core/date.ts` (`formatDayMonth`), `src/store/AppProvider.tsx` (`addWater`, `removeWater`, `planFoods`), `src/components/TabBar.tsx`, `src/components/Sidebar.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/index.tsx` (rewritten), `src/app/(tabs)/log.tsx` (now only opens the add sheet), `src/app/(tabs)/food.tsx`, `body.tsx`, `progress.tsx`, `fit.tsx`, `mind.tsx`, `src/app/journey.tsx`, `src/app/_layout.tsx`, `src/app/+html.tsx`, `src/app/plan.tsx`, `src/components/FoodDetailSheet.tsx`, `src/components/CravingSOS.tsx`, the Hindi-name sweep (`foods.tsx`, `photo.tsx`, `routine.tsx`, `scan.tsx`, `coach.tsx`, `MealSheet.tsx`, `SlotEditor.tsx`, `RoutineCard.tsx`), `src/i18n/index.ts`, and the tests `tiles.test.ts`, `foods.test.ts`, `date.test.ts`.

---

### Task 1: Tile words and numbers

**Files:**
- Create: `src/core/tileText.ts`
- Test: `src/core/__tests__/tileText.test.ts` (new)

**Interfaces:**
- Consumes: `waterTile`, `walkTile` (`src/core/tiles.ts`, Plan 1 Task 11), `WALK_ACTIVITY_ID` (`src/core/activity.ts`, Plan 1 Task 11), `dayRecord`, `DayRecordState` (`src/core/record.ts`), `DayMenu` (`src/core/menu.ts`), `addDays` (`src/core/date.ts`).
- Produces: `type TilePart = { num: string; unitKey?: string }`, `type TileLine = { key: string; params?: Record<string, string | number> }`, `type TileWords = { parts: TilePart[]; line: TileLine }`; `SLEEP_TARGET_MIN = 480`, `BREATHE_SESSION_MS = 60000`, `BREATHE_HALF_MS = 4000`, `WEIGHT_CHANGE_DAYS = 21`, `BEST_STREAK_DAYS = 90`; `oneDecimal(n): string`, `signedKg(kg): string`, `waterWords(ml, goalMl, bottleMl): TileWords`, `walkWords(minutes, goalMin): TileWords`, `sleepWords(minutes: number | null, targetMin?): TileWords`, `weightChange(weights, today, days?): { kg: number; weeks: number } | null`, `weightWords(weights, goalKg, today): TileWords`, `streakWords(streak, best): TileWords`, `bestRun(states: DayRecordState[]): number`, `bestStreak(input: { today; menuOn; routine; meals; skips; offDays; days? }): number`, `breathePhase(elapsedMs): { done: boolean; inhale: boolean; leftSec: number }`, `clockText(sec): string`, `breatheWords(elapsedMs: number | null): TileWords`, `walkMinutesOn(logs: ActivityLog[], date): number`.

The functions return i18n keys, not words, so they stay pure and testable; the tile turns them into words (Task 3). The line keys are added to `src/i18n/index.ts` in Task 3.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/tileText.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addSkip, type DayMenu } from '../menu';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import {
  bestRun,
  bestStreak,
  breathePhase,
  breatheWords,
  clockText,
  signedKg,
  sleepWords,
  streakWords,
  walkMinutesOn,
  walkWords,
  waterWords,
  weightWords,
} from '../tileText';
import type { ActivityLog, Meal } from '../types';

describe('water and walk', () => {
  it('shows litres with one decimal and the bottles left, rounded up', () => {
    expect(waterWords(1000, 3000, 500)).toEqual({ parts: [{ num: '1.0', unitKey: 'tile_unit_l' }], line: { key: 'tile_bottles_left', params: { n: 4 } } });
    expect(waterWords(2600, 3000, 500).line).toEqual({ key: 'tile_bottle_left' });
    // 1.5 L left is two 1 L bottles.
    expect(waterWords(1500, 3000, 1000).line).toEqual({ key: 'tile_bottles_left', params: { n: 2 } });
  });

  it('says the goal is reached, and keeps counting the litres past it', () => {
    expect(waterWords(3500, 3000, 750)).toEqual({ parts: [{ num: '3.5', unitKey: 'tile_unit_l' }], line: { key: 'tile_goal_reached' } });
  });

  it('shows walking minutes and the minutes left, never "of 30" without a unit', () => {
    expect(walkWords(10, 30)).toEqual({ parts: [{ num: '10', unitKey: 'tile_unit_min' }], line: { key: 'tile_min_left', params: { n: 20 } } });
    expect(walkWords(40, 30).line).toEqual({ key: 'tile_goal_reached' });
  });

  it('counts only walks toward the walk tile, and only on that date', () => {
    const log = (id: string, date: string, activityId: string, minutes: number): ActivityLog => ({ id, date, at: `${date}T06:00:00.000Z`, activityId, minutes, intensity: 1, kcal: 30 });
    const logs = [log('a', '2026-10-27', 'walk', 10), log('b', '2026-10-27', 'walk', 20), log('c', '2026-10-27', 'yoga', 15), log('d', '2026-10-26', 'walk', 30)];
    expect(walkMinutesOn(logs, '2026-10-27')).toBe(30);
  });
});

describe('sleep', () => {
  it('shows hours and minutes, the hour alone when there are no minutes, a dash before the check-in, and the goal', () => {
    expect(sleepWords(430)).toEqual({ parts: [{ num: '7', unitKey: 'tile_unit_h' }, { num: '10', unitKey: 'tile_unit_m' }], line: { key: 'tile_sleep_goal', params: { h: 8 } } });
    expect(sleepWords(420).parts).toEqual([{ num: '7', unitKey: 'tile_unit_h' }]);
    expect(sleepWords(null).parts).toEqual([{ num: '—' }]);
  });
});

describe('weight', () => {
  const w = (date: string, kg: number) => ({ date, kg });

  it('shows the latest weigh-in and the change over the last three weeks, with a real minus sign', () => {
    expect(weightWords([w('2026-10-06', 100), w('2026-10-13', 99.2), w('2026-10-27', 98.4)], 80, '2026-10-27')).toEqual({
      parts: [{ num: '98.4', unitKey: 'unit_kg' }],
      line: { key: 'tile_weight_change', params: { kg: '−1.6', weeks: 3 } },
    });
    expect(weightWords([w('2026-10-20', 99), w('2026-10-27', 98.4)], 80, '2026-10-27').line).toEqual({ key: 'tile_weight_change_1', params: { kg: '−0.6' } });
  });

  it('shows the goal when there is nothing to compare in the last three weeks, and a dash with no weigh-in', () => {
    expect(weightWords([w('2026-09-20', 101), w('2026-10-27', 98.4)], 80, '2026-10-27').line).toEqual({ key: 'tile_weight_goal', params: { kg: '80' } });
    expect(weightWords([], 79.5, '2026-10-27')).toEqual({ parts: [{ num: '—' }], line: { key: 'tile_weight_goal', params: { kg: '79.5' } } });
  });

  it('signs a change: a minus sign, a plus, and no sign at zero', () => {
    expect(signedKg(-1.6)).toBe('−1.6');
    expect(signedKg(0.4)).toBe('+0.4');
    expect(signedKg(-0.04)).toBe('0.0');
  });
});

describe('streak', () => {
  it('shows the streak in days, one day singular, and the best never below today', () => {
    expect(streakWords(5, 12)).toEqual({ parts: [{ num: '5', unitKey: 'tile_unit_days' }], line: { key: 'tile_best', params: { n: 12 } } });
    expect(streakWords(1, 0)).toEqual({ parts: [{ num: '1', unitKey: 'tile_unit_day' }], line: { key: 'tile_best', params: { n: 1 } } });
  });

  it('finds the longest run of full days; an off day neither breaks it nor counts', () => {
    expect(bestRun(['full', 'full', 'partial', 'full', 'off', 'full', 'full', 'empty'])).toBe(3);
    expect(bestRun([])).toBe(0);
  });

  it('looks back over the menus as shown, and a day of nothing but skips does not count', () => {
    const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
    const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('lunch', 'lunch', '13:00', 100)] };
    const menuOn = (date: string): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] });
    const ate = (date: string): Meal => ({ id: date, at: new Date(`${date}T13:00:00`).toISOString(), date, type: 'lunch', slotId: 'lunch', items: [], kcal: 300, protein: 9 });
    const meals = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-24', '2026-10-25'].map(ate);
    const base = { today: '2026-10-27', menuOn, routine, meals, skips: [], offDays: [] as number[] };
    expect(bestStreak(base)).toBe(3);
    // 23 October skipped: a complete record, but not a day eaten, so the run still ends there.
    expect(bestStreak({ ...base, skips: addSkip([], '2026-10-23', 'lunch') })).toBe(3);
    expect(bestStreak({ ...base, meals: [...meals, ate('2026-10-23')] })).toBe(6);
  });
});

describe('breathe', () => {
  it('breathes in for four seconds and out for four, for one minute', () => {
    expect(breathePhase(0)).toEqual({ done: false, inhale: true, leftSec: 60 });
    expect(breathePhase(4000).inhale).toBe(false);
    expect(breathePhase(8000).inhale).toBe(true);
    expect(breathePhase(18000).leftSec).toBe(42);
    expect(breathePhase(60000).done).toBe(true);
  });

  it('shows "1 min" and "Tap to start" at rest, and the time left with in or out during a session', () => {
    expect(breatheWords(null)).toEqual({ parts: [{ num: '1', unitKey: 'tile_unit_min' }], line: { key: 'tile_tap_to_start' } });
    expect(breatheWords(18000)).toEqual({ parts: [{ num: '0:42' }], line: { key: 'breathe_in' } });
    expect(breatheWords(5000).line).toEqual({ key: 'breathe_out' });
    expect(clockText(60)).toBe('1:00');
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/tileText.test.ts`
Expected: FAIL: `Failed to resolve import "../tileText"`.

- [ ] **Step 3: Create `src/core/tileText.ts`**

```ts
import { WALK_ACTIVITY_ID } from './activity';
import { addDays } from './date';
import type { DayMenu } from './menu';
import { dayRecord, type DayRecordState } from './record';
import type { Routine } from './routine';
import { walkTile, waterTile } from './tiles';
import type { ActivityLog, ISODate, Meal, SlotSkip, WeightLog } from './types';

/**
 * The words and numbers on the living tiles, worked out once so every tile
 * reads the same way: a number with its unit, and one short line that says
 * what is left or what the goal is ("4 bottles left", "Goal 8 h", "Best 12"),
 * never "of 30" without a unit. Keys and values only: the tile turns the keys
 * into words in the person's language.
 */

/** One number on a tile, with its unit beside it in a smaller size: "1.0" "L", or "7" "h" "10" "m". */
export type TilePart = { num: string; unitKey?: string };
/** The short line under the number: an i18n key and what it fills in. */
export type TileLine = { key: string; params?: Record<string, string | number> };
export type TileWords = { parts: TilePart[]; line: TileLine };

/** The night the sleep tile fills toward, in minutes. */
export const SLEEP_TARGET_MIN = 480;
/** One breathing session: a minute, four seconds in and four seconds out. */
export const BREATHE_SESSION_MS = 60000;
export const BREATHE_HALF_MS = 4000;
/** How far back the weight tile looks for its change. */
export const WEIGHT_CHANGE_DAYS = 21;
/** How far back the streak tile looks for the best run. */
export const BEST_STREAK_DAYS = 90;

/** One place after the point, always shown: 1 → "1.0". */
export function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** A weight without a needless ".0": 80 → "80", 79.5 → "79.5". */
function kgText(kg: number): string {
  return String(Math.round(kg * 10) / 10);
}

/** A change with its sign, the minus a real minus sign: −1.6, +0.4, and 0.0 for no change. */
export function signedKg(kg: number): string {
  const r = Math.round(kg * 10) / 10;
  if (r < 0) return `−${oneDecimal(-r)}`;
  if (r > 0) return `+${oneDecimal(r)}`;
  return '0.0';
}

/** Litres drunk, and the bottles still to go (rounded up) or the goal reached. */
export function waterWords(ml: number, goalMl: number, bottleMl: number): TileWords {
  const w = waterTile(ml, goalMl, bottleMl);
  const line: TileLine = w.reached ? { key: 'tile_goal_reached' } : w.bottlesLeft === 1 ? { key: 'tile_bottle_left' } : { key: 'tile_bottles_left', params: { n: w.bottlesLeft } };
  return { parts: [{ num: oneDecimal(ml / 1000), unitKey: 'tile_unit_l' }], line };
}

/** Minutes walked, and the minutes still to go or the goal reached. */
export function walkWords(minutes: number, goalMin: number): TileWords {
  const w = walkTile(minutes, goalMin);
  return {
    parts: [{ num: String(Math.round(minutes)), unitKey: 'tile_unit_min' }],
    line: w.reached ? { key: 'tile_goal_reached' } : { key: 'tile_min_left', params: { n: w.minutesLeft } },
  };
}

/** Hours and minutes slept, "7 h 10 m" ("7 h" on the hour); a dash before the check-in. The line is the goal. */
export function sleepWords(minutes: number | null, targetMin = SLEEP_TARGET_MIN): TileWords {
  const line: TileLine = { key: 'tile_sleep_goal', params: { h: Math.round((targetMin / 60) * 10) / 10 } };
  if (minutes === null || !(minutes > 0)) return { parts: [{ num: '—' }], line };
  const total = Math.round(minutes);
  const parts: TilePart[] = [{ num: String(Math.floor(total / 60)), unitKey: 'tile_unit_h' }];
  if (total % 60 > 0) parts.push({ num: String(total % 60), unitKey: 'tile_unit_m' });
  return { parts, line };
}

/**
 * The change from the first weigh-in of the last `days` to the latest one,
 * and over how many weeks (at least one). Null when the window holds no
 * earlier weigh-in to compare with.
 */
export function weightChange(weights: WeightLog[], today: ISODate, days = WEIGHT_CHANGE_DAYS): { kg: number; weeks: number } | null {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const from = addDays(today, -days);
  const first = sorted.find((w) => w.date >= from && w.date < latest.date);
  if (!first) return null;
  const span = Math.round((new Date(`${latest.date}T12:00:00`).getTime() - new Date(`${first.date}T12:00:00`).getTime()) / 86400000);
  return { kg: Math.round((latest.kg - first.kg) * 10) / 10, weeks: Math.max(1, Math.round(span / 7)) };
}

/** The latest weigh-in, and its change over the last three weeks or, with nothing to compare, the goal. */
export function weightWords(weights: WeightLog[], goalKg: number, today: ISODate): TileWords {
  const latest = [...weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const change = weightChange(weights, today);
  const line: TileLine = !change
    ? { key: 'tile_weight_goal', params: { kg: kgText(goalKg) } }
    : change.weeks === 1
      ? { key: 'tile_weight_change_1', params: { kg: signedKg(change.kg) } }
      : { key: 'tile_weight_change', params: { kg: signedKg(change.kg), weeks: change.weeks } };
  return { parts: [latest ? { num: oneDecimal(latest.kg), unitKey: 'unit_kg' } : { num: '—' }], line };
}

/** Today's streak in days, and the best run, never shown lower than today's. */
export function streakWords(streak: number, best: number): TileWords {
  return {
    parts: [{ num: String(streak), unitKey: streak === 1 ? 'tile_unit_day' : 'tile_unit_days' }],
    line: { key: 'tile_best', params: { n: Math.max(best, streak) } },
  };
}

/** The longest run of full days, oldest first. An off day neither breaks a run nor adds to it. */
export function bestRun(states: DayRecordState[]): number {
  let run = 0;
  let best = 0;
  for (const s of states) {
    if (s === 'off') continue;
    run = s === 'full' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * The best run of full days in the last `days`, judged on the menus as they
 * show, the way the streak is. A day settled only by skips is a complete
 * record but not a day eaten as planned, so it ends a run, as it ends the
 * streak: skipping is never rewarded.
 */
export function bestStreak(input: {
  today: ISODate;
  menuOn: (date: ISODate) => DayMenu | null;
  routine: Routine;
  meals: Meal[];
  skips: SlotSkip[];
  offDays: number[];
  days?: number;
}): number {
  const byDate = new Map<ISODate, Meal[]>();
  for (const m of input.meals) {
    const list = byDate.get(m.date);
    if (list) list.push(m);
    else byDate.set(m.date, [m]);
  }
  const states: DayRecordState[] = [];
  for (let i = (input.days ?? BEST_STREAK_DAYS) - 1; i >= 0; i--) {
    const date = addDays(input.today, -i);
    const meals = byDate.get(date) ?? [];
    const r = dayRecord({ date, today: input.today, menu: input.menuOn(date), routine: input.routine, meals, skips: input.skips, offDays: input.offDays });
    // Skips alone: the run ends here, as it ends the streak (recordStreak).
    states.push(r.state === 'full' && meals.length === 0 ? 'partial' : r.state);
  }
  return bestRun(states);
}

/** Where a breathing session is: breathing in or out, seconds left, or done after a minute. */
export function breathePhase(elapsedMs: number): { done: boolean; inhale: boolean; leftSec: number } {
  if (elapsedMs >= BREATHE_SESSION_MS) return { done: true, inhale: false, leftSec: 0 };
  const t = Math.max(0, elapsedMs);
  return { done: false, inhale: Math.floor(t / BREATHE_HALF_MS) % 2 === 0, leftSec: Math.ceil((BREATHE_SESSION_MS - t) / 1000) };
}

/** Seconds as a clock: 42 → "0:42". */
export function clockText(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** At rest: "1 min" and "Tap to start". During a session: the time left, and "Breathe in" or "Breathe out". */
export function breatheWords(elapsedMs: number | null): TileWords {
  if (elapsedMs === null) return { parts: [{ num: String(BREATHE_SESSION_MS / 60000), unitKey: 'tile_unit_min' }], line: { key: 'tile_tap_to_start' } };
  const p = breathePhase(elapsedMs);
  return { parts: [{ num: clockText(p.leftSec) }], line: { key: p.inhale ? 'breathe_in' : 'breathe_out' } };
}

/** Minutes of walking logged on a date; other activities do not fill the walk tile. */
export function walkMinutesOn(logs: ActivityLog[], date: ISODate): number {
  return logs.filter((l) => l.date === date && l.activityId === WALK_ACTIVITY_ID).reduce((a, l) => a + l.minutes, 0);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/core/__tests__/tileText.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 13 more tests than at the start.

- [ ] **Step 6: Commit**

```bash
git add src/core/tileText.ts src/core/__tests__/tileText.test.ts
git commit -m "$(cat <<'EOF'
Every tile's number and short line is worked out in one place: litres and the bottles left, walking minutes and what is left, hours and minutes slept against 8 h, the weight with its change over three weeks or the goal, the streak with the best run, and a one-minute breath that says in or out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Tile sizes and art shapes

**Files:**
- Create: `src/ui/tileGeometry.ts`
- Test: `src/ui/__tests__/tileGeometry.test.ts` (new)

**Interfaces:**
- Consumes: `lh`, `TEXT_SCALES` (`src/ui/theme.ts`).
- Produces: `type Pt = { x: number; y: number }`; `ART_W = 100`, `ART_H = 42`, `ART_SHARE = 0.42`, `TILE_TOP = 14`, `TILE_SIDE = 15`, `TILE_RADIUS = 22`, `TILE_LINE_GAP = 2`; `type TileType = { name; number; unit; line }`, `tileType(scale): TileType`, `tileTextHeight(scale): number`, `tileMinHeight(scale): number`; `toPath(points): string`, `polylineLength(points): number`, `pointAlong(points, fraction): Pt` (worklet), `cubicPoints(p0, p1, p2, p3, n?)`, `arcPoints(cx, cy, r, fromDeg, toDeg, n?)`, `wavePath(width, wavelength, amp, height): string`, `starOpacity(t, i): number` (worklet); the art: `WALK_PATH`, `WALK_GOAL`, `NIGHT_ARC`, `STARS`, `MOUNTAIN`, `RIDGE`, `SUMMIT`, `FLAG_TOP`, `FLAG_D`, `BREATHE_CENTRE`, `BREATHE_MIN_R`, `BREATHE_MAX_R`.

Every art component draws in a `viewBox="0 0 100 42"`: the bottom 42% of a square tile is exactly 100 × 42, and `preserveAspectRatio` (default `xMidYMid meet`) keeps that ratio on a taller tile, so the flag stays on the summit. `pointAlong` and `starOpacity` start with the `'worklet'` directive: they run on the UI thread inside `useAnimatedProps`, and the directive is an ordinary string statement to vitest.

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/tileGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TEXT_SCALES } from '../theme';
import {
  ART_H,
  ART_SHARE,
  ART_W,
  arcPoints,
  MOUNTAIN,
  NIGHT_ARC,
  pointAlong,
  polylineLength,
  RIDGE,
  STARS,
  starOpacity,
  SUMMIT,
  TILE_TOP,
  tileMinHeight,
  tileTextHeight,
  tileType,
  toPath,
  WALK_GOAL,
  WALK_PATH,
  wavePath,
} from '../tileGeometry';

describe('tile type and height', () => {
  it('uses the tile sizes from the spec at scale 1: name 13, number 30, unit 14, line 12', () => {
    expect(tileType(1)).toEqual({ name: 13, number: 30, unit: 14, line: 12 });
    expect(tileType(1.25)).toEqual({ name: 16, number: 38, unit: 18, line: 15 });
  });

  it('is square at scale 1 on a phone, and grows only as tall as the words need, so the art never reaches them', () => {
    expect(tileMinHeight(1)).toBe(164);
    expect(tileMinHeight(1.25)).toBe(195);
    for (const s of TEXT_SCALES) expect(TILE_TOP + tileTextHeight(s)).toBeLessThanOrEqual((1 - ART_SHARE) * tileMinHeight(s));
  });
});

describe('paths', () => {
  const L = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  it('writes a path and measures it', () => {
    expect(toPath(L)).toBe('M0 0 L10 0 L10 10');
    expect(polylineLength(L)).toBe(20);
  });

  it('finds the point a fraction of the way along, held at both ends', () => {
    expect(pointAlong(L, 0.25)).toEqual({ x: 5, y: 0 });
    expect(pointAlong(L, 0.5)).toEqual({ x: 10, y: 0 });
    expect(pointAlong(L, 1)).toEqual({ x: 10, y: 10 });
    expect(pointAlong(L, 2)).toEqual({ x: 10, y: 10 });
    expect(pointAlong(L, -1)).toEqual({ x: 0, y: 0 });
  });

  it('draws an arc from the left over the top to the right', () => {
    expect(arcPoints(50, 40, 32, 180, 360, 2)).toEqual([{ x: 18, y: 40 }, { x: 50, y: 8 }, { x: 82, y: 40 }]);
  });

  it('keeps every piece of art inside the 100 × 42 box', () => {
    for (const p of [...WALK_PATH, WALK_GOAL, ...NIGHT_ARC, ...STARS, ...MOUNTAIN]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(ART_W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(ART_H);
    }
  });

  it('ends the climb on the summit, so a full streak puts the climber under the flag', () => {
    expect(RIDGE[RIDGE.length - 1]).toEqual(SUMMIT);
    expect(pointAlong(RIDGE, 1)).toEqual(SUMMIT);
  });

  it('writes a wave twice as wide as the tile, so sliding it one tile width loops without a seam', () => {
    const d = wavePath(200, 100, 3, 8);
    expect(d.startsWith('M0 3')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(4);
    expect(d.endsWith('L200 8 L0 8 Z')).toBe(true);
  });

  it('lets the stars twinkle between faint and full', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      for (const i of [0, 1, 2]) {
        expect(starOpacity(t, i)).toBeGreaterThanOrEqual(0.35);
        expect(starOpacity(t, i)).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/ui/__tests__/tileGeometry.test.ts`
Expected: FAIL: `Failed to resolve import "../tileGeometry"`.

- [ ] **Step 3: Create `src/ui/tileGeometry.ts`**

```ts
import { lh } from './theme';

/**
 * Where the living tiles draw. The words sit in a fixed place at the top of
 * every tile; the art has the bottom 42%, which on a square tile is a 100 × 42
 * box, and every art component draws in that box so a marker such as the flag
 * stays exactly where it belongs. The tile's own type sizes (from the spec's
 * tile layout) scale with the person's text size; at a large size the tile
 * grows taller rather than letting the art reach the words. Pure: the point
 * lookups also run on the UI thread inside animations, so they are worklets.
 */
export type Pt = { x: number; y: number };

export const ART_W = 100;
export const ART_H = 42;
/** The share of the tile's height the art may use, from the bottom. */
export const ART_SHARE = 0.42;
/** The words' margins: from the top, and from both sides. */
export const TILE_TOP = 14;
export const TILE_SIDE = 15;
export const TILE_RADIUS = 22;
/** Space between the name, the number and the short line. */
export const TILE_LINE_GAP = 2;
/** Room left under the short line before the art zone starts. */
const TILE_GAP = 6;

const BASE = { name: 13, number: 30, unit: 14, line: 12 };
export type TileType = typeof BASE;

/** The tile's type at a text scale, in whole points. */
export function tileType(scale: number): TileType {
  return {
    name: Math.round(BASE.name * scale),
    number: Math.round(BASE.number * scale),
    unit: Math.round(BASE.unit * scale),
    line: Math.round(BASE.line * scale),
  };
}

/** The height of the words: the name line, the number (tight, it has no matras) and the short line. */
export function tileTextHeight(scale: number): number {
  const ty = tileType(scale);
  return lh(ty.name) + TILE_LINE_GAP + lh(ty.number, true) + TILE_LINE_GAP + lh(ty.line);
}

/** The least height that keeps the words above the art zone. A tile is square unless this is taller. */
export function tileMinHeight(scale: number): number {
  return Math.ceil((TILE_TOP + tileTextHeight(scale) + TILE_GAP) / (1 - ART_SHARE));
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** An SVG path through the points. */
export function toPath(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r1(p.x)} ${r1(p.y)}`).join(' ');
}

export function polylineLength(points: Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** The point a fraction of the way along the points, held at both ends. Runs inside animations. */
export function pointAlong(points: Pt[], fraction: number): Pt {
  'worklet';
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || fraction <= 0) return points[0];
  // The ends exactly, so a full streak sits on the summit and not a rounding error short of it.
  if (fraction >= 1) return points[points.length - 1];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  let want = fraction * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg > 0 && want <= seg) {
      const k = want / seg;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    want -= seg;
  }
  return points[points.length - 1];
}

/** A smooth curve through four control points, as `n` straight pieces. */
export function cubicPoints(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: r1(u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x),
      y: r1(u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y),
    });
  }
  return out;
}

/** Part of a circle, from one angle to another in degrees (0 points right, 270 straight up on screen), as `n` pieces. */
export function arcPoints(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    out.push({ x: r1(cx + r * Math.cos(a)), y: r1(cy + r * Math.sin(a)) });
  }
  return out;
}

/** The top of the water: a gentle wave `amp` high, filled down to `height`, `width` wide. */
export function wavePath(width: number, wavelength: number, amp: number, height: number): string {
  const half = wavelength / 2;
  let d = `M0 ${amp}`;
  let up = true;
  for (let x = 0; x < width - 0.01; x += half) {
    d += ` Q${r1(x + half / 2)} ${up ? 0 : 2 * amp} ${r1(x + half)} ${amp}`;
    up = !up;
  }
  return `${d} L${r1(width)} ${height} L0 ${height} Z`;
}

/** How bright star `i` of three is at loop time `t` (0 to 1): each twinkles a third of a turn after the one before. */
export function starOpacity(t: number, i: number): number {
  'worklet';
  return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t + i / 3)));
}

/** Walk: a dotted path from the start to a goal ring; the walker dot rides it. */
export const WALK_PATH: Pt[] = cubicPoints({ x: 6, y: 34 }, { x: 34, y: 46 }, { x: 58, y: 0 }, { x: 84, y: 16 });
export const WALK_GOAL: Pt = { x: 90, y: 14 };

/** Sleep: a night arc from the left over the top to the right, and three stars. */
export const NIGHT_ARC: Pt[] = arcPoints(50, 40, 32, 180, 360);
export const STARS: Pt[] = [
  { x: 10, y: 10 },
  { x: 90, y: 7 },
  { x: 50, y: 28 },
];

/** Streak: a mountain; the climb runs up its left ridge to the summit, where the flag stands. */
export const MOUNTAIN: Pt[] = [
  { x: 2, y: 42 },
  { x: 26, y: 24 },
  { x: 38, y: 30 },
  { x: 64, y: 10 },
  { x: 80, y: 22 },
  { x: 98, y: 42 },
];
export const RIDGE: Pt[] = MOUNTAIN.slice(0, 4);
export const SUMMIT: Pt = MOUNTAIN[3];
export const FLAG_TOP: Pt = { x: 64, y: 0 };
export const FLAG_D = 'M64 0 L73 2.5 L64 5 Z';

/** Breathe: a circle in the middle that grows and shrinks between these radii. */
export const BREATHE_CENTRE: Pt = { x: 50, y: 21 };
export const BREATHE_MIN_R = 7;
export const BREATHE_MAX_R = 19;
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/ui/__tests__/tileGeometry.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 9 more tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/tileGeometry.ts src/ui/__tests__/tileGeometry.test.ts
git commit -m "$(cat <<'EOF'
The living tiles have one layout: their type sizes, a square that grows taller only when a large text size needs the room so the art never reaches the words, and the art's shapes in one box, with the climb ending exactly under the flag and a wave that loops without a seam

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 3: The tile frame, the Water and Walk tiles, and water by date in the store

**Files:**
- Modify: `src/core/tiles.ts` (imports, line 1; append `waterLog`), `src/core/__tests__/tiles.test.ts` (import line; append)
- Modify: `src/store/AppProvider.tsx` (`Ctx`: `foods`, `addWater`; the value: `foods`, `addWater`; one import)
- Create: `src/components/tiles/motion.ts`, `src/components/tiles/LivingTile.tsx`, `src/components/tiles/WaterTile.tsx`, `src/components/tiles/WalkTile.tsx`
- Modify: `src/i18n/index.ts` (the tile keys, in all three dicts)

**Interfaces:**
- Consumes: Task 1 (`waterWords`, `walkWords`, `walkMinutesOn`, `oneDecimal`, `TileWords`), Task 2 (`tileType`, `tileMinHeight`, `ART_SHARE`, `TILE_*`, `wavePath`, `WALK_PATH`, `WALK_GOAL`, `toPath`, `polylineLength`, `pointAlong`, `ART_W`, `ART_H`), `waterTile`, `walkTile` (Plan 1 Task 11), `Ctx.logWalk` (Plan 1 Task 12), the `planFoods` memo (Plan 1 Task 8), `useFeedback().haptic`.
- Produces:
  - `tiles.ts`: `waterLog(input: { id: string; date: ISODate; ml: number; now: Date }): WaterLog`.
  - `Ctx`: `addWater: (ml: number, date?: ISODate) => string` (was `(ml) => void`; returns the log's id), `removeWater: (id: string) => void`, `planFoods: FoodItem[]`.
  - `motion.ts`: `TILE_MS = 900`, `useTileProgress(target): SharedValue<number>`, `useDrawOn(key): SharedValue<number>`, `useLoop(active, ms): SharedValue<number>`, `useBreath(active, halfMs): SharedValue<number>`.
  - `LivingTile.tsx`: `type TileSize = { w: number; h: number }`, `type ShownWords = { parts: { num: string; unit?: string }[]; line: string; value: string }`, `shownWords(words: TileWords, t): ShownWords`, `LivingTile(props: { icon; tint; name; words: ShownWords; done?; art?; behind?: (size: TileSize) => ReactNode; onPress; onLongPress?; label; hint? })`.
  - `WaterTile({ date, onAdded?: (id: string, ml: number) => void, onHold? })`, `WalkTile({ date, onAdded?: (id: string, minutes: number) => void, onHold? })`, `WALK_STEP_MIN = 10`.
  - i18n: every `tile_*` key below.

`addWater` keeps working for every existing caller (`app.addWater(app.state.settings.bottleMl)` still logs one bottle for today); its return value is new. The tiles reach a screen in Task 5 (Body and Progress); Today's Water and Walk pair arrives with the new Today in Task 17.

- [ ] **Step 1: Write the failing test**

In `src/core/__tests__/tiles.test.ts`, replace the `../tiles` import line with:

```ts
import { fillFraction, sleepFraction, streakFraction, walkTile, waterLog, waterTile, weightPoints } from '../tiles';
```

and append:

```ts
describe('waterLog', () => {
  it('a tap logs now for today and at noon for an earlier day, like a walk', () => {
    const now = new Date('2026-10-27T18:05:00');
    expect(waterLog({ id: 'w1', date: '2026-10-27', ml: 500, now })).toEqual({ id: 'w1', at: now.toISOString(), date: '2026-10-27', ml: 500 });
    expect(waterLog({ id: 'w2', date: '2026-10-25', ml: 750, now }).at).toBe(new Date('2026-10-25T12:00:00').toISOString());
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/tiles.test.ts`
Expected: FAIL: `waterLog is not a function`.

- [ ] **Step 3: `waterLog` in `src/core/tiles.ts`**

Replace the line `import type { WeightLog } from './types';` with:

```ts
import { toISODate } from './date';
import type { ISODate, WaterLog, WeightLog } from './types';
```

and append:

```ts
/** A water log from the water tile: today's is logged now, one added to an earlier day at its noon, the way a walk is. */
export function waterLog(input: { id: string; date: ISODate; ml: number; now: Date }): WaterLog {
  const at = input.date === toISODate(input.now) ? input.now : new Date(`${input.date}T12:00:00`);
  return { id: input.id, at: at.toISOString(), date: input.date, ml: input.ml };
}
```

Run: `npx vitest run src/core/__tests__/tiles.test.ts`
Expected: PASS.

- [ ] **Step 4: The store, in `src/store/AppProvider.tsx`**

After the line that closes the `../core/menu` import (`} from '../core/menu';`), add:

```ts
import { waterLog } from '../core/tiles';
```

In `Ctx`, after `  foods: FoodItem[];` add:

```ts
  /** Every food a planned line or a saved meal can name: the database and the person's own, whatever the diet filter shows. */
  planFoods: FoodItem[];
```

and replace `  addWater: (ml: number) => void;` with:

```ts
  /** One water log on a date, today when none is given. Returns its id, so a tap can be undone. */
  addWater: (ml: number, date?: ISODate) => string;
  /** Take one water log away, by its id. */
  removeWater: (id: string) => void;
```

In the value, after the line that begins `      foods: foodsForDiet(` (Plan 1 left it as `foods: foodsForDiet(planFoods, state.settings.diet),`) add:

```ts
      planFoods,
```

(`planFoods` is the memo Plan 1 added, `const planFoods = useMemo(() => allFoods(state.customFoods), [state.customFoods]);`, already in the value's dependency list; see "Built Plan 1 interfaces".)

Replace

```ts
      addWater: (ml) =>
        update((s) => ({ ...s, water: [...s.water, { id: newId(), at: new Date().toISOString(), date: toISODate(), ml }] })),
```

with

```ts
      addWater: (ml, date) => {
        const id = newId();
        update((s) => ({ ...s, water: [...s.water, waterLog({ id, date: date ?? toISODate(), ml, now: new Date() })] }));
        return id;
      },
      removeWater: (id) => update((s) => (s.water.some((w) => w.id === id) ? { ...s, water: s.water.filter((w) => w.id !== id) } : s)),
```

- [ ] **Step 5: The tile keys in `src/i18n/index.ts`**

Before the `};` that closes `en`, add:

```ts
  tile_unit_l: 'L', tile_unit_min: 'min', tile_unit_h: 'h', tile_unit_m: 'm', tile_unit_day: 'day', tile_unit_days: 'days',
  tile_bottles_left: '{n} bottles left', tile_bottle_left: '1 bottle left', tile_goal_reached: 'Goal reached today',
  tile_min_left: '{n} min left', tile_sleep_goal: 'Goal {h} h',
  tile_weight_change: '{kg} kg in {weeks} weeks', tile_weight_change_1: '{kg} kg in a week', tile_weight_goal: 'Goal {kg} kg',
  tile_best: 'Best {n}', tile_tap_to_start: 'Tap to start', tile_walk: 'Walk', tile_streak: 'Streak',
  tile_water_a11y: 'Add one bottle of water. {now} of {goal} litres.',
  tile_walk_a11y: 'Add {step} minutes of walking. {now} of {goal} minutes.',
  tile_open_a11y: '{name}: {value}. {line}.',
  tile_hint_water: 'Hold to change the bottle size or add another amount.',
  tile_hint_walk: 'Hold to change the walk goal or add other minutes.',
  tile_hint_sleep: 'Opens the sleep check-in.',
  tile_hint_weight: 'Opens the weight entry.',
  tile_hint_streak: 'Opens Progress.',
  tile_hint_breathe_start: 'Starts one minute of slow breathing.',
  tile_hint_breathe_stop: 'Stops the breathing session.',
  tile_added_water: 'Added {ml} ml water', tile_added_walk: 'Added {min} min walk',
  tile_bottle_size: 'Bottle size', tile_other_amount: 'Another amount', tile_amount_ml: 'Amount in ml', tile_amount_min: 'Minutes',
```

Before the `};` that closes `mr`, add:

```ts
  tile_unit_l: 'लि', tile_unit_min: 'मि', tile_unit_h: 'ता', tile_unit_m: 'मि', tile_unit_day: 'दिवस', tile_unit_days: 'दिवस',
  tile_bottles_left: '{n} बाटल्या बाकी', tile_bottle_left: '1 बाटली बाकी', tile_goal_reached: 'आजचं लक्ष्य पूर्ण',
  tile_min_left: '{n} मि बाकी', tile_sleep_goal: 'लक्ष्य {h} तास',
  tile_weight_change: '{weeks} आठवड्यांत {kg} किलो', tile_weight_change_1: 'एका आठवड्यात {kg} किलो', tile_weight_goal: 'लक्ष्य {kg} किलो',
  tile_best: 'सर्वाधिक {n}', tile_tap_to_start: 'सुरू करायला दाबा', tile_walk: 'चालणं', tile_streak: 'सलग दिवस',
  tile_water_a11y: 'पाण्याची एक बाटली घाला. {goal} पैकी {now} लिटर.',
  tile_walk_a11y: '{step} मिनिटं चालणं नोंदवा. {goal} पैकी {now} मिनिटं.',
  tile_open_a11y: '{name}: {value}. {line}.',
  tile_hint_water: 'बाटलीचा आकार बदलायला किंवा दुसरं प्रमाण घालायला दाबून धरा.',
  tile_hint_walk: 'चालण्याचं लक्ष्य बदलायला किंवा इतर मिनिटं घालायला दाबून धरा.',
  tile_hint_sleep: 'झोपेची नोंद उघडते.',
  tile_hint_weight: 'वजनाची नोंद उघडते.',
  tile_hint_streak: 'प्रगती उघडते.',
  tile_hint_breathe_start: 'एक मिनिट सावकाश श्वास सुरू करते.',
  tile_hint_breathe_stop: 'श्वासाचा सराव थांबवते.',
  tile_added_water: '{ml} ml पाणी नोंदवलं', tile_added_walk: '{min} मि चालणं नोंदवलं',
  tile_bottle_size: 'बाटलीचा आकार', tile_other_amount: 'दुसरं प्रमाण', tile_amount_ml: 'प्रमाण (ml)', tile_amount_min: 'मिनिटं',
```

Before the `};` that closes `hi`, add:

```ts
  tile_unit_l: 'ली', tile_unit_min: 'मि', tile_unit_h: 'घं', tile_unit_m: 'मि', tile_unit_day: 'दिन', tile_unit_days: 'दिन',
  tile_bottles_left: '{n} बोतलें बाकी', tile_bottle_left: '1 बोतल बाकी', tile_goal_reached: 'आज का लक्ष्य पूरा',
  tile_min_left: '{n} मि बाकी', tile_sleep_goal: 'लक्ष्य {h} घंटे',
  tile_weight_change: '{weeks} हफ़्तों में {kg} किलो', tile_weight_change_1: 'एक हफ़्ते में {kg} किलो', tile_weight_goal: 'लक्ष्य {kg} किलो',
  tile_best: 'सबसे ज़्यादा {n}', tile_tap_to_start: 'शुरू करने के लिए दबाएँ', tile_walk: 'टहलना', tile_streak: 'लगातार दिन',
  tile_water_a11y: 'पानी की एक बोतल जोड़ें. {goal} में से {now} लीटर.',
  tile_walk_a11y: '{step} मिनट टहलना जोड़ें. {goal} में से {now} मिनट.',
  tile_open_a11y: '{name}: {value}. {line}.',
  tile_hint_water: 'बोतल का आकार बदलने या दूसरी मात्रा जोड़ने के लिए दबाकर रखें.',
  tile_hint_walk: 'चलने का लक्ष्य बदलने या दूसरे मिनट जोड़ने के लिए दबाकर रखें.',
  tile_hint_sleep: 'नींद की जाँच खोलता है.',
  tile_hint_weight: 'वज़न दर्ज करना खोलता है.',
  tile_hint_streak: 'प्रगति खोलता है.',
  tile_hint_breathe_start: 'एक मिनट धीमी साँस शुरू करता है.',
  tile_hint_breathe_stop: 'साँस का अभ्यास रोकता है.',
  tile_added_water: '{ml} ml पानी जोड़ा', tile_added_walk: '{min} मि टहलना जोड़ा',
  tile_bottle_size: 'बोतल का आकार', tile_other_amount: 'दूसरी मात्रा', tile_amount_ml: 'मात्रा (ml)', tile_amount_min: 'मिनट',
```

- [ ] **Step 6: Create `src/components/tiles/motion.ts`**

```ts
import { useEffect } from 'react';
import { cancelAnimation, Easing, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

/**
 * How the living tiles move. A change eases in within the 1.1 s a tile may
 * take, on one ease-out curve; a tap made while it moves only moves the
 * target, so taps add up and the art catches up. Only the water wave, the
 * sleep stars and a breathing session loop. With reduce motion on (read once,
 * at start, by Reanimated), nothing loops and values land at once. Shared
 * values are written with set() in effects and read with get() in worklets,
 * never with .value and never during render, as the React Compiler needs.
 */
export const TILE_MS = 900;

const EASE = { duration: TILE_MS, easing: Easing.out(Easing.cubic) };

/** A fill or a drawn line, 0 to 1: from 0 when the tile first appears, then easing to each new target. */
export function useTileProgress(target: number): SharedValue<number> {
  const reduce = useReducedMotion();
  const v = useSharedValue(reduce ? target : 0);
  useEffect(() => {
    v.set(reduce ? target : withTiming(target, EASE));
  }, [target, reduce, v]);
  return v;
}

/** A line that draws itself, 0 to 1, again each time `key` changes (the weight line when a weigh-in is added). */
export function useDrawOn(key: string): SharedValue<number> {
  const reduce = useReducedMotion();
  const v = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    v.set(reduce ? 1 : withSequence(withTiming(0, { duration: 0 }), withTiming(1, EASE)));
  }, [key, reduce, v]);
  return v;
}

/** 0 to 1 over `ms`, again and again, while `active`; still at 0 otherwise, and always under reduce motion. */
export function useLoop(active: boolean, ms: number): SharedValue<number> {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(v);
    v.set(0);
    if (!active || reduce) return;
    v.set(withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(v);
  }, [active, reduce, ms, v]);
  return v;
}

/** A breath: 0 to 1 over `halfMs` and back, for as long as `active`; still at 0 otherwise and under reduce motion. */
export function useBreath(active: boolean, halfMs: number): SharedValue<number> {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(v);
    v.set(0);
    if (!active || reduce) return;
    const half = { duration: halfMs, easing: Easing.inOut(Easing.sin) };
    v.set(withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1, false));
    return () => cancelAnimation(v);
  }, [active, reduce, halfMs, v]);
  return v;
}
```

- [ ] **Step 7: Create `src/components/tiles/LivingTile.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TileWords } from '../../core/tileText';
import { fill } from '../../i18n';
import { C, lh, textScale } from '../../ui/theme';
import { TILE_LINE_GAP, TILE_RADIUS, TILE_SIDE, TILE_TOP, tileMinHeight, tileType } from '../../ui/tileGeometry';

export type TileSize = { w: number; h: number };
/** A tile's number and line in words: each part with its unit, the line filled in, and the value as one phrase for screen readers. */
export type ShownWords = { parts: { num: string; unit?: string }[]; line: string; value: string };

/** Turns a tile's keys (core/tileText.ts) into words in the person's language. */
export function shownWords(words: TileWords, t: (key: string) => string): ShownWords {
  const parts = words.parts.map((p) => ({ num: p.num, unit: p.unitKey ? t(p.unitKey) : undefined }));
  return {
    parts,
    line: fill(t(words.line.key), words.line.params ?? {}),
    value: parts.map((p) => (p.unit ? `${p.num} ${p.unit}` : p.num)).join(' '),
  };
}

/**
 * The one frame every tracker sits in: a square with a 22 radius and a
 * hairline edge, two to a row. The words are pinned to the top, 14 from the
 * top and 15 from the sides, in the same place in every tile: the icon and
 * name, the number with its unit smaller, and one short line. The art has the
 * bottom 42% and never reaches the words; `behind` is the one exception, drawn
 * under the words across the whole tile (the water tank). The tile grows
 * taller than square only when the text size needs the room. Each tracker
 * brings its art, its words and its tap.
 */
export function LivingTile({
  icon,
  tint,
  name,
  words,
  done,
  art,
  behind,
  onPress,
  onLongPress,
  label,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** The tracker's own colour, for its icon. */
  tint: string;
  name: string;
  words: ShownWords;
  /** At the goal: a tick beside the name. */
  done?: boolean;
  art?: React.ReactNode;
  behind?: (size: TileSize) => React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  label: string;
  hint?: string;
}) {
  const scale = textScale();
  const type = tileType(scale);
  // The tank behind the words needs the tile's size in points; the art in the bottom zone scales by itself.
  const [size, setSize] = useState<TileSize | null>(null);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 1,
        minHeight: tileMinHeight(scale),
        borderRadius: TILE_RADIUS,
        borderWidth: 0.5,
        borderColor: C.border,
        backgroundColor: C.card,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}>
      {behind && size ? behind(size) : null}
      {art ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', pointerEvents: 'none' }}>{art}</View> : null}
      <View style={{ position: 'absolute', top: TILE_TOP, left: TILE_SIDE, right: TILE_SIDE, gap: TILE_LINE_GAP, pointerEvents: 'none' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={icon} size={type.name + 2} color={tint} />
          <Text numberOfLines={1} style={{ flex: 1, color: C.textDim, fontSize: type.name, lineHeight: lh(type.name), fontWeight: '500' }}>
            {name}
          </Text>
          {done ? <Ionicons name="checkmark-circle" size={type.name + 4} color={C.accentText} /> : null}
        </View>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: type.number, lineHeight: lh(type.number, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
          {words.parts.map((p, i) => (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : ''}
              {p.num}
              {p.unit ? <Text style={{ color: C.textDim, fontSize: type.unit, fontWeight: '400' }}>{` ${p.unit}`}</Text> : null}
            </React.Fragment>
          ))}
        </Text>
        <Text numberOfLines={1} style={{ color: C.textDim, fontSize: type.line, lineHeight: lh(type.line), fontWeight: '400' }}>
          {words.line}
        </Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 8: Create `src/components/tiles/WaterTile.tsx`**

```tsx
import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { oneDecimal, waterWords } from '../../core/tileText';
import { waterTile } from '../../core/tiles';
import type { ISODate } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { wavePath } from '../../ui/tileGeometry';
import { LivingTile, shownWords, type TileSize } from './LivingTile';
import { useLoop, useTileProgress } from './motion';

/** Water at about a quarter strength, so the words read over it in light and in dark. */
const WATER_ALPHA = 0.26;
/** The wave along the top of the water, in points. */
const WAVE_H = 8;

/**
 * Water, counted in bottles. One tap adds a bottle for the date shown; the
 * tank behind the words fills from the bottom toward the day's goal with a
 * gentle wave on top, and stays full with a tick once the goal is reached.
 */
export function WaterTile({ date, onAdded, onHold }: { date: ISODate; onAdded?: (id: string, ml: number) => void; onHold?: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const { bottleMl, waterGoalMl } = app.state.settings;
  const ml = app.state.water.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0);
  const tank = waterTile(ml, waterGoalMl, bottleMl);
  const level = useTileProgress(tank.fraction);
  return (
    <LivingTile
      icon="water"
      tint={C.cyan}
      name={t('water')}
      words={shownWords(waterWords(ml, waterGoalMl, bottleMl), t)}
      done={tank.reached}
      behind={(size) => <WaterTank size={size} level={level} waving={tank.fraction > 0 && tank.fraction < 1} />}
      onPress={() => {
        const id = app.addWater(bottleMl, date);
        fb.haptic('light');
        onAdded?.(id, bottleMl);
      }}
      onLongPress={onHold}
      label={fill(t('tile_water_a11y'), { now: oneDecimal(ml / 1000), goal: oneDecimal(waterGoalMl / 1000) })}
      hint={t('tile_hint_water')}
    />
  );
}

/** The water: a column that rises with the level, its top a wave sliding sideways one tile width per loop. */
function WaterTank({ size, level, waving }: { size: TileSize; level: SharedValue<number>; waving: boolean }) {
  const loop = useLoop(waving, 2600);
  // Empty: the column sits just below the tile. Full: the wave rises out of sight and the water fills it.
  const column = useAnimatedStyle(() => ({ transform: [{ translateY: size.h * (1 - level.get()) - WAVE_H * Math.min(1, level.get() * 20) }] }));
  const wave = useAnimatedStyle(() => ({ transform: [{ translateX: -size.w * loop.get() }] }));
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: size.w, height: size.h, overflow: 'hidden', pointerEvents: 'none' }}>
      <Animated.View style={[{ width: size.w, height: size.h + WAVE_H }, column]}>
        <Animated.View style={[{ width: size.w * 2, height: WAVE_H }, wave]}>
          <Svg width={size.w * 2} height={WAVE_H}>
            <Path d={wavePath(size.w * 2, size.w / 2, 3, WAVE_H)} fill={C.cyan} fillOpacity={WATER_ALPHA} />
          </Svg>
        </Animated.View>
        <View style={{ width: size.w, height: size.h, backgroundColor: C.cyan, opacity: WATER_ALPHA }} />
      </Animated.View>
    </View>
  );
}
```

- [ ] **Step 9: Create `src/components/tiles/WalkTile.tsx`**

```tsx
import React from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { walkMinutesOn, walkWords } from '../../core/tileText';
import { walkTile } from '../../core/tiles';
import type { ISODate } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { ART_H, ART_W, pointAlong, polylineLength, toPath, WALK_GOAL, WALK_PATH } from '../../ui/tileGeometry';
import { LivingTile, shownWords } from './LivingTile';
import { useTileProgress } from './motion';

/** Minutes one tap on the walk tile adds. */
export const WALK_STEP_MIN = 10;

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const WALK_D = toPath(WALK_PATH);
const WALK_LEN = polylineLength(WALK_PATH);

/**
 * Walking, in minutes toward the day's goal. One tap logs a ten-minute walk
 * for the date shown (an activity like any other, so its calories are earned
 * the usual way); the path draws itself from the start and the walker dot
 * sits on the minutes walked.
 */
export function WalkTile({ date, onAdded, onHold }: { date: ISODate; onAdded?: (id: string, minutes: number) => void; onHold?: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const goal = app.state.settings.walkGoalMin;
  const minutes = walkMinutesOn(app.state.activities ?? [], date);
  const walk = walkTile(minutes, goal);
  const level = useTileProgress(walk.fraction);
  return (
    <LivingTile
      icon="walk"
      tint={C.accent}
      name={t('tile_walk')}
      words={shownWords(walkWords(minutes, goal), t)}
      done={walk.reached}
      art={<WalkArt level={level} />}
      onPress={() => {
        const id = app.logWalk(date, WALK_STEP_MIN);
        fb.haptic('light');
        onAdded?.(id, WALK_STEP_MIN);
      }}
      onLongPress={onHold}
      label={fill(t('tile_walk_a11y'), { step: WALK_STEP_MIN, now: minutes, goal })}
      hint={t('tile_hint_walk')}
    />
  );
}

function WalkArt({ level }: { level: SharedValue<number> }) {
  const walked = useAnimatedProps(() => ({ strokeDashoffset: WALK_LEN * (1 - level.get()) }));
  const walker = useAnimatedProps(() => {
    const p = pointAlong(WALK_PATH, level.get());
    return { cx: p.x, cy: p.y };
  });
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ART_W} ${ART_H}`}>
      <Path d={WALK_D} stroke={C.accent} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" fill="none" />
      <APath d={WALK_D} stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" fill="none" strokeDasharray={`${WALK_LEN} ${WALK_LEN}`} animatedProps={walked} />
      <Circle cx={WALK_GOAL.x} cy={WALK_GOAL.y} r={5} stroke={C.accent} strokeWidth={2} fill={C.accent} fillOpacity={0.25} />
      <ACircle r={3.5} fill={C.accent} animatedProps={walker} />
    </Svg>
  );
}
```

- [ ] **Step 10: Typecheck, lint, suite, and the web build**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 1 more test.

Reanimated is used here for the first time in the app, so check that the web build still renders statically:

Run: `npx expo export -p web --output-dir "$(mktemp -d)/web"`
Expected: it ends with a list of exported files and exits 0. If it fails inside `react-native-reanimated` or `react-native-worklets`, stop and report BLOCKED with the error; do not work around it.

Verification greps:

```bash
grep -nE "fontFamily|eslint-disable|textGhost|letterSpacing|toUpperCase|fontWeight: '[6-9]00'|LinearGradient|hitSlop|\b(v|level|loop|draw|breath|twinkle)\.value\b" src/components/tiles/*.ts src/components/tiles/*.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/tiles/*.tsx
```

Expected: both print nothing.

- [ ] **Step 11: Commit**

```bash
git add src/core/tiles.ts src/core/__tests__/tiles.test.ts src/store/AppProvider.tsx src/i18n/index.ts src/components/tiles/motion.ts src/components/tiles/LivingTile.tsx src/components/tiles/WaterTile.tsx src/components/tiles/WalkTile.tsx
git commit -m "$(cat <<'EOF'
The living tile frame, with the words in the same place in every tile and the art below them, and the Water and Walk tiles: one tap adds a bottle or ten minutes of walking to the day shown, the tank fills with a gentle wave and the walker moves along the path, and nothing loops when the phone asks for less motion; water can now be logged for any date and taken back by its id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Water and Walk together: undo, and the long-press sheet

**Files:**
- Create: `src/components/tiles/TileRow.tsx`, `src/components/tiles/UndoLine.tsx`, `src/components/tiles/TileSheet.tsx`, `src/components/tiles/WaterWalk.tsx`

**Interfaces:**
- Consumes: `WaterTile`, `WalkTile` (Task 3), `Ctx.addWater`, `Ctx.removeWater` (Task 3), `Ctx.logWalk`, `Ctx.removeActivity`, `Ctx.setSettings`, `Sheet`, `Pill`, `Field`, `Btn`, `Micro`, `Row`.
- Produces: `TileRow({ children })`; `UNDO_MS = 5000`, `type Added = { kind: 'water' | 'walk'; id: string; amount: number }`, `useAddedLine(): { added: Added | null; show: (a: Added) => void; clear: () => void }`, `addedText(a: Added, t): string`, `UndoLine({ text, undoLabel, onUndo })`; `TileSheet({ kind: 'water' | 'walk' | null; date; onClose; onAdded: (a: Added) => void })`; `WaterWalkTiles({ date })`.

The undo line has no ref and no confirm dialog: `added` is state, and an effect starts a 5-second timer whenever it changes; the timer's callback clears it (setting state in a timer callback, not in the effect body). A new tap replaces the line and restarts the timer.

- [ ] **Step 1: Create `src/components/tiles/TileRow.tsx`**

```tsx
import React from 'react';
import { View } from 'react-native';
import { S } from '../../ui/theme';

/** Two tiles side by side, the same width. A row with one tile puts an empty `<View style={{ flex: 1 }} />` beside it. */
export function TileRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: S.gap }}>{children}</View>;
}
```

- [ ] **Step 2: Create `src/components/tiles/UndoLine.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fill } from '../../i18n';
import { C, F, lh, S } from '../../ui/theme';

/** How long "Added … · Undo" stays under the tiles. */
export const UNDO_MS = 5000;

/** What a tile tap just added: which record, so Undo takes that one away. */
export type Added = { kind: 'water' | 'walk'; id: string; amount: number };

/** The last thing a tap added, cleared after five seconds; a new tap replaces it and starts the five seconds again. */
export function useAddedLine(): { added: Added | null; show: (a: Added) => void; clear: () => void } {
  const [added, setAdded] = useState<Added | null>(null);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [added]);
  return { added, show: (a) => setAdded(a), clear: () => setAdded(null) };
}

/** "Added 500 ml water", "Added 10 min walk". */
export function addedText(a: Added, t: (key: string) => string): string {
  return a.kind === 'water' ? fill(t('tile_added_water'), { ml: a.amount }) : fill(t('tile_added_walk'), { min: a.amount });
}

/** The line under the tiles: what was added, and an Undo a finger wide. No confirm dialogs: a wrong tap is one more tap to put right. */
export function UndoLine({ text, undoLabel, onUndo }: { text: string; undoLabel: string; onUndo: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch }}>
      <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>
        {text}
      </Text>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel={`${undoLabel}: ${text}`}
        style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.accentSoft : C.accentDim })}>
        <Text style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{undoLabel}</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3: Create `src/components/tiles/TileSheet.tsx`**

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import type { ISODate } from '../../core/types';
import { makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { Btn, Field, Micro, Pill, Row } from '../../ui/components';
import { Sheet } from '../../ui/Sheet';
import type { Added } from './UndoLine';

const BOTTLES = [500, 750, 1000];
const WALK_GOALS = [20, 30, 45, 60];

/** A long press on the water or walk tile: the bottle size or the walk goal, and another amount for the day shown. */
export function TileSheet({ kind, date, onClose, onAdded }: { kind: 'water' | 'walk' | null; date: ISODate; onClose: () => void; onAdded: (a: Added) => void }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  return (
    <Sheet open={kind !== null} title={kind === 'walk' ? t('tile_walk') : t('water')} onClose={onClose}>
      {kind ? <TileSheetBody key={kind} kind={kind} date={date} onClose={onClose} onAdded={onAdded} /> : null}
    </Sheet>
  );
}

function TileSheetBody({ kind, date, onClose, onAdded }: { kind: 'water' | 'walk'; date: ISODate; onClose: () => void; onAdded: (a: Added) => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const { bottleMl, walkGoalMin } = app.state.settings;
  const [amount, setAmount] = useState('');
  const n = Math.round(parseFloat(amount));
  const ok = kind === 'water' ? Number.isFinite(n) && n >= 10 && n <= 3000 : Number.isFinite(n) && n >= 1 && n <= 300;

  function add() {
    if (!ok) return;
    const id = kind === 'water' ? app.addWater(n, date) : app.logWalk(date, n);
    fb.haptic('light');
    onAdded({ kind, id, amount: n });
    onClose();
  }

  return (
    <View style={{ gap: 14 }}>
      <Micro>{kind === 'water' ? t('tile_bottle_size') : t('walk_target')}</Micro>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {kind === 'water'
          ? BOTTLES.map((ml) => (
              <Pill key={ml} label={ml >= 1000 ? `${ml / 1000} ${t('tile_unit_l')}` : `${ml} ml`} active={bottleMl === ml} onPress={() => app.setSettings({ bottleMl: ml })} />
            ))
          : WALK_GOALS.map((m) => <Pill key={m} label={`${m} ${t('tile_unit_min')}`} active={walkGoalMin === m} onPress={() => app.setSettings({ walkGoalMin: m })} />)}
      </Row>
      <Micro>{t('tile_other_amount')}</Micro>
      <Row style={{ gap: 10, alignItems: 'flex-end' }}>
        <Field label={kind === 'water' ? t('tile_amount_ml') : t('tile_amount_min')} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder={kind === 'water' ? '250' : '15'} />
        <Btn label={t('water_add')} onPress={add} disabled={!ok} />
      </Row>
    </View>
  );
}
```

- [ ] **Step 4: Create `src/components/tiles/WaterWalk.tsx`**

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import type { ISODate } from '../../core/types';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { TileRow } from './TileRow';
import { TileSheet } from './TileSheet';
import { addedText, UndoLine, useAddedLine } from './UndoLine';
import { WalkTile } from './WalkTile';
import { WaterTile } from './WaterTile';

/** Today's pair: Water and Walk side by side, "Added … · Undo" under them for five seconds, and a long press for the sheet. */
export function WaterWalkTiles({ date }: { date: ISODate }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const [sheet, setSheet] = useState<'water' | 'walk' | null>(null);
  const { added, show, clear } = useAddedLine();

  function undo() {
    if (!added) return;
    if (added.kind === 'water') app.removeWater(added.id);
    else app.removeActivity(added.id);
    clear();
  }

  return (
    <View style={{ gap: 8 }}>
      <TileRow>
        <WaterTile date={date} onAdded={(id, ml) => show({ kind: 'water', id, amount: ml })} onHold={() => setSheet('water')} />
        <WalkTile date={date} onAdded={(id, minutes) => show({ kind: 'walk', id, amount: minutes })} onHold={() => setSheet('walk')} />
      </TileRow>
      {added ? <UndoLine text={addedText(added, t)} undoLabel={t('undo')} onUndo={undo} /> : null}
      <TileSheet kind={sheet} date={date} onClose={() => setSheet(null)} onAdded={show} />
    </View>
  );
}
```

- [ ] **Step 5: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests (the pieces are pure layout over Tasks 1-3).

```bash
grep -nE "fontFamily|eslint-disable|textGhost|letterSpacing|toUpperCase|fontWeight: '[6-9]00'|LinearGradient|hitSlop|useRef" src/components/tiles/TileRow.tsx src/components/tiles/UndoLine.tsx src/components/tiles/TileSheet.tsx src/components/tiles/WaterWalk.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/tiles/TileSheet.tsx src/components/tiles/UndoLine.tsx src/components/tiles/WaterWalk.tsx
```

Expected: both print nothing.

- [ ] **Step 6: Commit**

```bash
git add src/components/tiles/TileRow.tsx src/components/tiles/UndoLine.tsx src/components/tiles/TileSheet.tsx src/components/tiles/WaterWalk.tsx
git commit -m "$(cat <<'EOF'
Water and Walk sit side by side with "Added 500 ml water · Undo" under them for five seconds, Undo taking back exactly that one record with no confirm dialog; a long press opens a small sheet to pick a 500 ml, 750 ml or 1 L bottle or the walk goal, or to add another amount

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The Sleep, Weight, Streak and Breathe tiles, on Body and Progress

**Files:**
- Create: `src/components/tiles/SleepTile.tsx`, `WeightTile.tsx`, `StreakTile.tsx`, `BreatheTile.tsx`, `WalkSleep.tsx`
- Modify: `src/app/(tabs)/fit.tsx` (imports; the two `<ActivityPanel />` lines), `src/app/(tabs)/mind.tsx` (imports; the two `{crisisCard}` lines), `src/app/journey.tsx` (imports; the line after `    <Screen>`)

**Interfaces:**
- Consumes: Tasks 1-4, `sleepFraction`, `streakFraction`, `weightPoints` (Plan 1 Task 11), `Ctx.menuOn`, `Ctx.streakDays` (Plan 1 Tasks 8 and 12), `WeightSheet`.
- Produces: `SleepTile({ date })`, `WeightTile()`, `StreakTile()`, `BreatheTile()`, `WalkSleepTiles()`.

Where the tiles appear, as the spec lists: Body shows Walk, Sleep and Breathe (Walk and Sleep at the top of Move, Breathe at the top of Mind); Progress shows Weight and Streak (at the top of the climb section). Today's optional Sleep, Weight and Streak tiles come with Task 17.

- [ ] **Step 1: Create `src/components/tiles/SleepTile.tsx`**

```tsx
import { useRouter } from 'expo-router';
import React from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { SLEEP_TARGET_MIN, sleepWords } from '../../core/tileText';
import { sleepFraction } from '../../core/tiles';
import type { ISODate } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { ART_H, ART_W, NIGHT_ARC, polylineLength, STARS, starOpacity, toPath } from '../../ui/tileGeometry';
import { LivingTile, shownWords } from './LivingTile';
import { useLoop, useTileProgress } from './motion';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const ARC_D = toPath(NIGHT_ARC);
const ARC_LEN = polylineLength(NIGHT_ARC);

/** Sleep: the night arc fills to hours slept over eight, with three faint stars that twinkle. A tap opens the sleep check-in. */
export function SleepTile({ date }: { date: ISODate }) {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const minutes = app.state.sleep.find((s) => s.date === date)?.minutes ?? null;
  const words = shownWords(sleepWords(minutes), t);
  const level = useTileProgress(sleepFraction(minutes ?? 0, SLEEP_TARGET_MIN));
  const name = t('sleep_title');
  return (
    <LivingTile
      icon="moon"
      tint={C.violet}
      name={name}
      words={words}
      done={(minutes ?? 0) >= SLEEP_TARGET_MIN}
      art={<SleepArt level={level} />}
      onPress={() => router.push('/sleep')}
      label={fill(t('tile_open_a11y'), { name, value: words.value, line: words.line })}
      hint={t('tile_hint_sleep')}
    />
  );
}

function SleepArt({ level }: { level: SharedValue<number> }) {
  const twinkle = useLoop(true, 2400);
  const slept = useAnimatedProps(() => ({ strokeDashoffset: ARC_LEN * (1 - level.get()) }));
  const s0 = useAnimatedProps(() => ({ opacity: starOpacity(twinkle.get(), 0) }));
  const s1 = useAnimatedProps(() => ({ opacity: starOpacity(twinkle.get(), 1) }));
  const s2 = useAnimatedProps(() => ({ opacity: starOpacity(twinkle.get(), 2) }));
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ART_W} ${ART_H}`}>
      <Path d={ARC_D} stroke={C.violet} strokeOpacity={0.25} strokeWidth={3} strokeLinecap="round" fill="none" />
      <APath d={ARC_D} stroke={C.violet} strokeWidth={3} strokeLinecap="round" fill="none" strokeDasharray={`${ARC_LEN} ${ARC_LEN}`} animatedProps={slept} />
      <ACircle cx={STARS[0].x} cy={STARS[0].y} r={1.6} fill={C.violet} animatedProps={s0} />
      <ACircle cx={STARS[1].x} cy={STARS[1].y} r={1.6} fill={C.violet} animatedProps={s1} />
      <ACircle cx={STARS[2].x} cy={STARS[2].y} r={1.6} fill={C.violet} animatedProps={s2} />
    </Svg>
  );
}
```

- [ ] **Step 2: Create `src/components/tiles/WeightTile.tsx`**

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { weightWords } from '../../core/tileText';
import { weightPoints } from '../../core/tiles';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { ART_H, ART_W, polylineLength, toPath, type Pt } from '../../ui/tileGeometry';
import { WeightSheet } from '../WeightSheet';
import { LivingTile, shownWords } from './LivingTile';
import { useDrawOn } from './motion';

const APath = Animated.createAnimatedComponent(Path);
/** Room around the line inside the art box, so the dot and the stroke are never cut at the edge. */
const INSET = 4;

/** Weight: the last eight weigh-ins as a line that draws itself, a dot on the latest. A tap opens the weight entry. */
export function WeightTile() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const [open, setOpen] = useState(false);
  const { weights, profile } = app.state;
  const words = shownWords(weightWords(weights, profile.goalWeightKg, app.today), t);
  const points = weightPoints(weights, ART_W - 2 * INSET, ART_H - 2 * INSET).map((p) => ({ x: p.x + INSET, y: p.y + INSET }));
  // The line draws itself again whenever its shape changes, that is when a weigh-in is added or corrected.
  const draw = useDrawOn(toPath(points));
  const name = t('add_weight');
  return (
    <View style={{ flex: 1 }}>
      <LivingTile
        icon="scale"
        tint={C.textDim}
        name={name}
        words={words}
        art={points.length > 0 ? <WeightArt points={points} draw={draw} /> : undefined}
        onPress={() => setOpen(true)}
        label={fill(t('tile_open_a11y'), { name, value: words.value, line: words.line })}
        hint={t('tile_hint_weight')}
      />
      <WeightSheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

function WeightArt({ points, draw }: { points: Pt[]; draw: SharedValue<number> }) {
  const len = polylineLength(points);
  const drawn = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - draw.get()) }));
  const last = points[points.length - 1];
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ART_W} ${ART_H}`}>
      {points.length > 1 ? (
        <APath d={toPath(points)} stroke={C.textDim} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={`${len} ${len}`} animatedProps={drawn} />
      ) : null}
      <Circle cx={last.x} cy={last.y} r={3.5} fill={C.textDim} />
    </Svg>
  );
}
```

- [ ] **Step 3: Create `src/components/tiles/StreakTile.tsx`**

```tsx
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { bestStreak, streakWords } from '../../core/tileText';
import { streakFraction } from '../../core/tiles';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { ART_H, ART_W, FLAG_D, FLAG_TOP, MOUNTAIN, pointAlong, polylineLength, RIDGE, SUMMIT, toPath } from '../../ui/tileGeometry';
import { LivingTile, shownWords } from './LivingTile';
import { useTileProgress } from './motion';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const MOUNTAIN_D = `${toPath(MOUNTAIN)} Z`;
const RIDGE_D = toPath(RIDGE);
const RIDGE_LEN = polylineLength(RIDGE);

/** Streak: a mountain with the flag on its summit; the climbed part of the ridge is drawn and the climber sits on today's streak, at the top at the best one. */
export function StreakTile() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const { state, today, streakDays, menuOn } = app;
  const best = useMemo(
    () => bestStreak({ today, menuOn, routine: state.routine, meals: state.meals, skips: state.slotSkips, offDays: state.settings.offDays ?? [] }),
    [today, menuOn, state.routine, state.meals, state.slotSkips, state.settings.offDays],
  );
  const words = shownWords(streakWords(streakDays, best), t);
  const level = useTileProgress(streakFraction(streakDays, best));
  const name = t('tile_streak');
  return (
    <LivingTile
      icon="flame"
      tint={C.amber}
      name={name}
      words={words}
      art={<StreakArt level={level} />}
      onPress={() => router.push('/progress')}
      label={fill(t('tile_open_a11y'), { name, value: words.value, line: words.line })}
      hint={t('tile_hint_streak')}
    />
  );
}

function StreakArt({ level }: { level: SharedValue<number> }) {
  const climbed = useAnimatedProps(() => ({ strokeDashoffset: RIDGE_LEN * (1 - level.get()) }));
  const climber = useAnimatedProps(() => {
    const p = pointAlong(RIDGE, level.get());
    return { cx: p.x, cy: p.y };
  });
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ART_W} ${ART_H}`}>
      <Path d={MOUNTAIN_D} fill={C.amber} fillOpacity={0.25} />
      <APath d={RIDGE_D} stroke={C.amber} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={`${RIDGE_LEN} ${RIDGE_LEN}`} animatedProps={climbed} />
      <Line x1={SUMMIT.x} y1={SUMMIT.y} x2={FLAG_TOP.x} y2={FLAG_TOP.y} stroke={C.amber} strokeWidth={1.5} />
      <Path d={FLAG_D} fill={C.amber} />
      <ACircle r={3.5} fill={C.amber} stroke={C.card} strokeWidth={1.5} animatedProps={climber} />
    </Svg>
  );
}
```

- [ ] **Step 4: Create `src/components/tiles/BreatheTile.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { BREATHE_HALF_MS, BREATHE_SESSION_MS, breatheWords } from '../../core/tileText';
import { fill, makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { ART_H, ART_W, BREATHE_CENTRE, BREATHE_MAX_R, BREATHE_MIN_R } from '../../ui/tileGeometry';
import { LivingTile, shownWords } from './LivingTile';
import { useBreath } from './motion';

const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * Breathe: a tap starts one minute of slow breathing and another stops it.
 * The circle grows for four seconds and shrinks for four while the number
 * counts down and the line says in or out; with reduce motion on, the words
 * alone lead the breath.
 */
export function BreatheTile() {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => {
      const n = Date.now();
      if (n - startedAt >= BREATHE_SESSION_MS) setStartedAt(null);
      else setNow(n);
    }, 250);
    return () => clearInterval(timer);
  }, [startedAt]);
  const running = startedAt !== null;
  const words = shownWords(breatheWords(startedAt === null ? null : Math.max(0, now - startedAt)), t);
  const breath = useBreath(running, BREATHE_HALF_MS);
  const name = t('breathe');
  return (
    <LivingTile
      icon="leaf-outline"
      tint={C.pink}
      name={name}
      words={words}
      art={<BreatheArt breath={breath} />}
      onPress={() => {
        if (running) {
          setStartedAt(null);
          return;
        }
        const n = Date.now();
        setNow(n);
        setStartedAt(n);
        fb.haptic('light');
      }}
      label={fill(t('tile_open_a11y'), { name, value: words.value, line: words.line })}
      hint={running ? t('tile_hint_breathe_stop') : t('tile_hint_breathe_start')}
    />
  );
}

function BreatheArt({ breath }: { breath: SharedValue<number> }) {
  const circle = useAnimatedProps(() => ({ r: BREATHE_MIN_R + (BREATHE_MAX_R - BREATHE_MIN_R) * breath.get() }));
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ART_W} ${ART_H}`}>
      <Circle cx={BREATHE_CENTRE.x} cy={BREATHE_CENTRE.y} r={BREATHE_MAX_R} stroke={C.pink} strokeOpacity={0.25} strokeWidth={1.5} fill="none" />
      <ACircle cx={BREATHE_CENTRE.x} cy={BREATHE_CENTRE.y} fill={C.pink} fillOpacity={0.25} stroke={C.pink} strokeWidth={2} animatedProps={circle} />
    </Svg>
  );
}
```

- [ ] **Step 5: Create `src/components/tiles/WalkSleep.tsx`**

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { SleepTile } from './SleepTile';
import { TileRow } from './TileRow';
import { TileSheet } from './TileSheet';
import { addedText, UndoLine, useAddedLine } from './UndoLine';
import { WalkTile } from './WalkTile';

/** Body's pair for today: Walk (with its undo line and long-press sheet) beside Sleep. */
export function WalkSleepTiles() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const [sheet, setSheet] = useState<'walk' | null>(null);
  const { added, show, clear } = useAddedLine();
  return (
    <View style={{ gap: 8 }}>
      <TileRow>
        <WalkTile date={app.today} onAdded={(id, minutes) => show({ kind: 'walk', id, amount: minutes })} onHold={() => setSheet('walk')} />
        <SleepTile date={app.today} />
      </TileRow>
      {added ? (
        <UndoLine
          text={addedText(added, t)}
          undoLabel={t('undo')}
          onUndo={() => {
            app.removeActivity(added.id);
            clear();
          }}
        />
      ) : null}
      <TileSheet kind={sheet} date={app.today} onClose={() => setSheet(null)} onAdded={show} />
    </View>
  );
}
```

- [ ] **Step 6: Place them on Body and Progress**

`src/app/(tabs)/fit.tsx`: after `import { ActivityPanel } from '../../components/ActivityPanel';` add `import { WalkSleepTiles } from '../../components/tiles/WalkSleep';`, then put the pair above the activity panel in both layouts:

```bash
perl -pi -e 's/^(\s*)<ActivityPanel \/>$/$1<WalkSleepTiles \/>\n$1<ActivityPanel \/>/' "src/app/(tabs)/fit.tsx"
```

`grep -c "<WalkSleepTiles />" "src/app/(tabs)/fit.tsx"` prints `2`.

`src/app/(tabs)/mind.tsx`: after `import { CravingSOS } from '../../components/CravingSOS';` add:

```ts
import { BreatheTile } from '../../components/tiles/BreatheTile';
import { TileRow } from '../../components/tiles/TileRow';
```

then:

```bash
perl -pi -e 's/^(\s*)\{crisisCard\}$/$1\{crisisCard\}\n$1<TileRow>\n$1  <BreatheTile \/>\n$1  <View style=\{\{ flex: 1 \}\} \/>\n$1<\/TileRow>/' "src/app/(tabs)/mind.tsx"
```

`grep -c "<BreatheTile />" "src/app/(tabs)/mind.tsx"` prints `2` (`View` is already imported there).

`src/app/journey.tsx`: after `import { WeightSheet } from '../components/WeightSheet';` add:

```ts
import { StreakTile } from '../components/tiles/StreakTile';
import { TileRow } from '../components/tiles/TileRow';
import { WeightTile } from '../components/tiles/WeightTile';
```

and replace the one line `    <Screen>` with:

```tsx
    <Screen>
      <TileRow>
        <WeightTile />
        <StreakTile />
      </TileRow>
```

- [ ] **Step 7: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests.

```bash
grep -nE "fontFamily|eslint-disable|textGhost|letterSpacing|toUpperCase|fontWeight: '[6-9]00'|LinearGradient|hitSlop|\b(v|level|loop|draw|breath|twinkle)\.value\b" src/components/tiles/SleepTile.tsx src/components/tiles/WeightTile.tsx src/components/tiles/StreakTile.tsx src/components/tiles/BreatheTile.tsx src/components/tiles/WalkSleep.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/tiles/*.tsx
```

Expected: both print nothing.

- [ ] **Step 8: Commit**

```bash
git add src/components/tiles/SleepTile.tsx src/components/tiles/WeightTile.tsx src/components/tiles/StreakTile.tsx src/components/tiles/BreatheTile.tsx src/components/tiles/WalkSleep.tsx "src/app/(tabs)/fit.tsx" "src/app/(tabs)/mind.tsx" src/app/journey.tsx
git commit -m "$(cat <<'EOF'
Sleep, weight, streak and breathing are living tiles too: a night arc that fills toward eight hours under twinkling stars, the last eight weigh-ins drawing themselves, a climber on the ridge with the flag on the summit at the best streak, and a one-minute breath that grows and shrinks; Body shows walk, sleep and breathe, and Progress shows weight and streak

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 6: The tab bar, the sidebar and Me

**Files:**
- Create: `src/core/bar.ts`, `src/core/__tests__/bar.test.ts`
- Create: `src/app/(tabs)/me.tsx`, `src/app/(tabs)/sleep-tab.tsx`, `src/app/(tabs)/plan-tab.tsx`, `src/components/SavedMealsSheet.tsx`
- Modify (whole file): `src/components/TabBar.tsx`, `src/components/Sidebar.tsx`, `src/app/(tabs)/_layout.tsx`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `normalizeTabs` (`src/core/tabs.ts`, Plan 1 Task 1), `Ctx.planFoods` (Task 3), `Ctx.removeSavedMeal`, `Ctx.addSavedMeal` (Plan 1 Task 12), `lineInfo`.
- Produces:
  - `bar.ts`: `type BarKey`, `type BarItem = { key: BarKey; route: string | null; icon: string; labelKey: string }`, `barItems(tabs: unknown): BarItem[]`, `type MeRow = { key: string; icon: string; labelKey: string; subKey?: string; href?: string; sheet?: 'savedMeals' }`, `meRows(tabs: unknown): MeRow[]`.
  - `TabBar.tsx`: `viewedDate(routes): string | undefined` (Today's `?date=`), `TabBar`.
  - Tab routes `me`, `sleep-tab`, `plan-tab`; `SavedMealsSheet({ open, onClose })`.
  - i18n: `tab_me`, `tab_plan`, `me_coach`, `me_body_sub`, `me_plan`, `me_saved`, `me_saved_empty`, `me_saved_delete`, `me_grocery`, `add_bar`, `add_bar_one`.

The ➕ opens `/log` with Today's date in this task; Task 11 points it at the add sheet. The Me list is data: a new row is one entry in `meRows` (Plan 4 adds "Start a new chapter" and "Customize" before Settings, and wires a long press on the bar to Customize once that screen exists). The sidebar's water line, which still counted "glasses", goes: Today's water tile shows it.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/bar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { barItems, meRows } from '../bar';

describe('barItems', () => {
  it('puts ➕ in the middle: Today · ➕ · Progress · Me by default', () => {
    expect(barItems(['progress']).map((i) => i.key)).toEqual(['today', 'add', 'progress', 'me']);
    expect(barItems([]).map((i) => i.key)).toEqual(['today', 'add', 'me']);
    expect(barItems(['progress', 'coach']).map((i) => i.key)).toEqual(['today', 'progress', 'add', 'coach', 'me']);
  });

  it('sends Sleep and Diet plan to their tab routes; ➕ is a button with no route', () => {
    expect(barItems(['sleep', 'plan']).map((i) => i.route)).toEqual(['index', 'sleep-tab', null, 'plan-tab', 'me']);
  });

  it('a bad value from sync can never hide Today, ➕ or Me, nor show more than two extras', () => {
    expect(barItems('progress').map((i) => i.key)).toEqual(['today', 'add', 'progress', 'me']);
    expect(barItems(['me', 'today', 'body', 'coach', 'sleep']).map((i) => i.key)).toEqual(['today', 'body', 'add', 'coach', 'me']);
  });
});

describe('meRows', () => {
  it('lists the pages in a plain order, with Progress while it is not a tab', () => {
    expect(meRows([]).map((r) => r.key)).toEqual(['coach', 'progress', 'body', 'plan', 'saved', 'grocery', 'settings', 'guide']);
    expect(meRows(['progress']).map((r) => r.key)).toEqual(['coach', 'body', 'plan', 'saved', 'grocery', 'settings', 'guide']);
  });

  it('every row goes somewhere: a page, or the saved meals sheet', () => {
    for (const r of meRows([])) expect(Boolean(r.href) !== Boolean(r.sheet)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/bar.test.ts`
Expected: FAIL: `Failed to resolve import "../bar"`.

- [ ] **Step 3: Create `src/core/bar.ts`**

```ts
import { normalizeTabs } from './tabs';
import type { TabId } from './types';

/**
 * The tab bar and the Me list, from the extra tabs the person chose. Today
 * and Me are always there, and ➕ (a button, not a tab: it opens the add
 * sheet) sits in the middle of the others. Each item names its tab route, an
 * Ionicons name and a label key, so the bar on a phone and the sidebar on a
 * wide screen show the same list in the same order, and Me always reaches the
 * page of a tab that is not on the bar.
 */
export type BarKey = 'today' | TabId | 'add' | 'me';
export type BarItem = { key: BarKey; route: string | null; icon: string; labelKey: string };

const TODAY: BarItem = { key: 'today', route: 'index', icon: 'today-outline', labelKey: 'tab_today' };
const ADD: BarItem = { key: 'add', route: null, icon: 'add', labelKey: 'add_food' };
const ME: BarItem = { key: 'me', route: 'me', icon: 'person-circle-outline', labelKey: 'tab_me' };
const EXTRA: Record<TabId, BarItem> = {
  progress: { key: 'progress', route: 'progress', icon: 'trending-up-outline', labelKey: 'tab_progress' },
  coach: { key: 'coach', route: 'coach', icon: 'chatbubble-ellipses-outline', labelKey: 'tab_coach' },
  body: { key: 'body', route: 'body', icon: 'body-outline', labelKey: 'tab_body' },
  sleep: { key: 'sleep', route: 'sleep-tab', icon: 'moon-outline', labelKey: 'sleep_title' },
  plan: { key: 'plan', route: 'plan-tab', icon: 'calendar-outline', labelKey: 'tab_plan' },
};

/** Today, the extras, Me, with ➕ inserted in the middle: Today · ➕ · Progress · Me by default. */
export function barItems(tabs: unknown): BarItem[] {
  const around = [TODAY, ...normalizeTabs(tabs).map((id) => EXTRA[id]), ME];
  const middle = Math.floor(around.length / 2);
  return [...around.slice(0, middle), ADD, ...around.slice(middle)];
}

export type MeRow = { key: string; icon: string; labelKey: string; subKey?: string; href?: string; sheet?: 'savedMeals' };

/** Me's plain list. Rows are data: a new one is one entry here. */
export function meRows(tabs: unknown): MeRow[] {
  const rows: MeRow[] = [
    { key: 'coach', icon: 'chatbubble-ellipses-outline', labelKey: 'me_coach', href: '/coach' },
    { key: 'body', icon: 'body-outline', labelKey: 'tab_body', subKey: 'me_body_sub', href: '/body' },
    { key: 'plan', icon: 'calendar-outline', labelKey: 'me_plan', href: '/food?s=plan' },
    { key: 'saved', icon: 'bookmark-outline', labelKey: 'me_saved', sheet: 'savedMeals' },
    { key: 'grocery', icon: 'basket-outline', labelKey: 'me_grocery', href: '/food?s=recipes' },
    { key: 'settings', icon: 'settings-outline', labelKey: 'settings', href: '/settings' },
    { key: 'guide', icon: 'help-circle-outline', labelKey: 'hdr_guide', href: '/guide' },
  ];
  // Progress taken off the bar stays one tap away.
  if (!normalizeTabs(tabs).includes('progress')) rows.splice(1, 0, { key: 'progress', icon: 'trending-up-outline', labelKey: 'tab_progress', href: '/progress' });
  return rows;
}
```

Run: `npx vitest run src/core/__tests__/bar.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 4: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`, add:

```ts
  tab_me: 'Me', tab_plan: 'Plan',
  me_coach: 'Coach chat', me_body_sub: 'Move, yoga, sleep, mind', me_plan: 'Diet plan and eating pattern', me_grocery: 'Grocery and recipes',
  me_saved: 'Saved meals', me_saved_empty: 'Meals you save after logging them show here.', me_saved_delete: 'Delete {name}',
  add_bar: '{n} items · {kcal} kcal', add_bar_one: '1 item · {kcal} kcal',
```

Before the `};` that closes `mr`, add:

```ts
  tab_me: 'मी', tab_plan: 'नियोजन',
  me_coach: 'कोचशी गप्पा', me_body_sub: 'हालचाल, योग, झोप, मन', me_plan: 'आहार नियोजन आणि खाण्याची पद्धत', me_grocery: 'किराणा आणि रेसिपी',
  me_saved: 'जतन केलेली जेवणं', me_saved_empty: 'नोंदवल्यावर जतन केलेली जेवणं इथे दिसतात.', me_saved_delete: '{name} काढा',
  add_bar: '{n} पदार्थ · {kcal} kcal', add_bar_one: '1 पदार्थ · {kcal} kcal',
```

Before the `};` that closes `hi`, add:

```ts
  tab_me: 'मैं', tab_plan: 'प्लान',
  me_coach: 'कोच से बात', me_body_sub: 'हलचल, योग, नींद, मन', me_plan: 'डाइट प्लान और खाने का पैटर्न', me_grocery: 'किराना और विधियाँ',
  me_saved: 'सहेजे हुए खाने', me_saved_empty: 'दर्ज करने के बाद सहेजे गए खाने यहाँ दिखते हैं.', me_saved_delete: '{name} हटाएँ',
  add_bar: '{n} चीज़ें · {kcal} kcal', add_bar_one: '1 चीज़ · {kcal} kcal',
```

- [ ] **Step 5: Replace the whole of `src/components/TabBar.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { barItems, type BarItem } from '../core/bar';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, F, lh, lift, S } from '../ui/theme';

/**
 * The bar: Today, the extra tabs the person chose (Progress unless changed),
 * ➕ in the middle, and Me. core/bar.ts sets the order, so the sidebar on a
 * wide screen shows the same list. ➕ is a button, not a tab: it adds food
 * for the day Today is showing. Hand-rolled because the stock bar gives its
 * label a box that clips Devanagari marks on the web.
 */
type IconName = keyof typeof Ionicons.glyphMap;
type Route = { key: string; name: string; params?: object };

type TabBarProps = {
  state: { index: number; routes: Route[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

/** The date Today is showing, from its ?date= param; undefined while it shows today. */
export function viewedDate(routes: Route[]): string | undefined {
  const params = routes.find((r) => r.name === 'index')?.params as { date?: unknown } | undefined;
  return typeof params?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;
}

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const focused = state.routes[state.index]?.name;

  function open(item: BarItem) {
    const route = state.routes.find((r) => r.name === item.route);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (focused !== route.name && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  }

  function add() {
    const date = viewedDate(state.routes);
    router.push(date ? { pathname: '/log', params: { date } } : '/log');
  }

  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 6);
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: C.bgAlt,
        borderTopWidth: S.hairline,
        borderTopColor: C.border,
        ...lift(2),
        shadowOffset: { width: 0, height: -4 },
        minHeight: 64 + bottom,
        paddingTop: 8,
        paddingBottom: bottom,
      }}>
      {barItems(app.state.settings.tabs).map((item) =>
        item.route === null ? (
          <View key={item.key} style={{ flex: 1, alignItems: 'center' }}>
            <Pressable
              onPress={add}
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
              style={({ pressed }) => ({
                width: 60,
                height: 60,
                borderRadius: 30,
                marginTop: -26,
                backgroundColor: C.accent,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 5,
                borderColor: C.bgAlt,
                ...lift(2),
                shadowColor: C.accent,
                shadowOpacity: 0.4,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}>
              <Ionicons name="add" size={30} color={C.onAccent} />
            </Pressable>
          </View>
        ) : (
          <TabButton key={item.key} item={item} focused={focused === item.route} label={t(item.labelKey)} onPress={() => open(item)} />
        ),
      )}
    </View>
  );
}

function TabButton({ item, focused, label, onPress }: { item: BarItem; focused: boolean; label: string; onPress: () => void }) {
  const color = focused ? C.accentText : C.textFaint;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={focused || undefined}
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'flex-start', gap: 3, paddingHorizontal: 2, opacity: pressed ? 0.6 : 1 })}>
      {/* The active tab sits on a 48 × 32 tinted pill: seen before it is read. */}
      <View style={{ width: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.accentDim : 'transparent' }}>
        <Ionicons name={item.icon as IconName} size={24} color={color} />
      </View>
      <Text numberOfLines={1} style={{ color, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', includeFontPadding: false, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 6: Replace the whole of `src/components/Sidebar.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { barItems } from '../core/bar';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useAuth } from '../services/useAuth';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Ring } from '../ui/components';
import { Wordmark } from '../ui/Logo';
import { C, F, lh, MICRO, S } from '../ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** A tab route's address. */
function hrefOf(route: string): string {
  return route === 'index' ? '/' : `/${route}`;
}

/**
 * Replaces the bottom bar on wide screens with the same list in the same
 * order (core/bar.ts): Today, the person's extra tabs, Add food, and Me. The
 * break timer shows only while screen breaks are switched on.
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { date } = useGlobalSearchParams<{ date?: string }>();
  const monitor = useBreakMonitor();
  const { state } = useApp();
  const { ai } = useAI();
  const { canUseAI } = useAuth();
  const t = makeT(state.profile.lang);

  const online = ai.route === 'primary' || ai.route === 'fallback';
  const nextEvery = monitor.nextKind ? state.breakSettings[monitor.nextKind].everyMinutes : state.breakSettings.micro.everyMinutes;
  const left = Number.isFinite(monitor.secondsLeft) ? Math.ceil(monitor.secondsLeft / 60) : 0;
  const elapsed = Math.max(0, nextEvery - left);
  // The day Today is showing, so Add food logs there.
  const viewed = pathname === '/' && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  function add() {
    router.push(viewed ? { pathname: '/log', params: { date: viewed } } : '/log');
  }

  return (
    <View style={{ width: 248, backgroundColor: C.bgAlt, borderRightWidth: S.hairline, borderRightColor: C.border, paddingVertical: 24, paddingHorizontal: 14, justifyContent: 'space-between' }}>
      <View style={{ gap: 4 }}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
          <Wordmark size={21} alt={t('tagline')} />
        </View>
        {barItems(state.settings.tabs).map((item) => {
          if (item.route === null) {
            return (
              <Pressable
                key={item.key}
                onPress={add}
                accessibilityRole="button"
                accessibilityLabel={t(item.labelKey)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, marginVertical: 6, paddingHorizontal: 12, borderRadius: S.radiusSm, backgroundColor: C.accent, opacity: pressed ? 0.85 : 1 })}>
                <Ionicons name="add" size={18} color={C.onAccent} />
                <Text style={{ color: C.onAccent, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{t(item.labelKey)}</Text>
              </Pressable>
            );
          }
          const href = hrefOf(item.route);
          const active = pathname === href;
          return (
            <Pressable
              key={item.key}
              onPress={() => router.navigate(href as never)}
              accessibilityRole="button"
              aria-selected={active || undefined}
              accessibilityLabel={t(item.labelKey)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, paddingHorizontal: 12, borderRadius: S.radiusSm, backgroundColor: active ? C.cardAlt : 'transparent', borderWidth: S.hairline, borderColor: active ? C.border : 'transparent' }}>
              <Ionicons name={item.icon as IconName} size={18} color={active ? C.accentText : C.textFaint} />
              <Text style={{ color: active ? C.text : C.textDim, fontSize: F.body, lineHeight: lh(F.body), fontWeight: active ? '500' : '400' }}>{t(item.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 4 }}>
        {state.settings.features.breaks ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: S.hairline, borderTopColor: C.border }}>
            <Ring value={monitor.enabled ? elapsed : 0} max={nextEvery} size={34} stroke={3} color={C.accent}>
              <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{monitor.enabled ? left : '--'}</Text>
            </Ring>
            <View style={{ flex: 1 }}>
              <Text style={[MICRO, { color: C.textFaint }]}>{t('next_break')}</Text>
              <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{monitor.enabled ? `${left} ${t('minutes')}` : t('break_off')}</Text>
            </View>
          </View>
        ) : null}
        {canUseAI ? (
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={online ? t('ai_on') : t('ai_off')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: S.touch, paddingHorizontal: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? C.green : C.textFaint }} />
            <Text style={[MICRO, { color: online ? C.green : C.textFaint }]}>{online ? t('ai_on') : t('ai_off')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 7: Create the three tab routes and the saved-meals sheet**

`src/app/(tabs)/me.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { SavedMealsSheet } from '../../components/SavedMealsSheet';
import { meRows } from '../../core/bar';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, ListRow } from '../../ui/components';
import { C } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

type IconName = keyof typeof Ionicons.glyphMap;

/** Me: a plain list of everything that is not on the bar, each one tap from its page. */
export default function MeScreen() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const [saved, setSaved] = useState(false);
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
                if (row.sheet) setSaved(true);
                else if (row.href) router.push(row.href as never);
              }}
              trailing={<Ionicons name="chevron-forward" size={16} color={C.textFaint} />}
            />
          </View>
        ))}
      </Card>
      <SavedMealsSheet open={saved} onClose={() => setSaved(false)} />
    </Page>
  );
}
```

`src/app/(tabs)/sleep-tab.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';
import SleepScreen from '../sleep';

/** Sleep as a tab, for a person who put it on the bar. /sleep stays the page links and the sleep tile open. */
export default function SleepTab() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t('sleep_title')} />
      <SleepScreen />
    </View>
  );
}
```

`src/app/(tabs)/plan-tab.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';
import PlanScreen from '../plan';

/** The diet plan as a tab, for a person who put it on the bar. /plan and Food → Plan stay where links open it. */
export default function PlanTab() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t('hdr_plan')} />
      <PlanScreen />
    </View>
  );
}
```

`src/components/SavedMealsSheet.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';
import { lineInfo } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Divider, Empty, ListRow } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, S } from '../ui/theme';

/** Me → Saved meals: each meal the person saved, its foods and calories, and a delete with Undo. They are logged from the ➕ sheet. */
export function SavedMealsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const meals = app.state.savedMeals;
  return (
    <Sheet open={open} title={t('me_saved')} onClose={onClose}>
      {meals.length === 0 ? (
        <Empty text={t('me_saved_empty')} />
      ) : (
        meals.map((m, i) => {
          const kcal = m.lines.reduce((a, l) => a + (lineInfo(l, app.planFoods)?.kcal ?? 0), 0);
          return (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={m.name}
                sub={fill(t(m.lines.length === 1 ? 'add_bar_one' : 'add_bar'), { n: m.lines.length, kcal })}
                actions={
                  <Pressable
                    onPress={() => {
                      app.removeSavedMeal(m.id);
                      fb.notify(t('meal_removed'), { label: t('undo'), onPress: () => app.addSavedMeal(m.name, m.lines) });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={fill(t('me_saved_delete'), { name: m.name })}
                    style={({ pressed }) => ({ width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.redSoft : 'transparent' })}>
                    <Ionicons name="trash-outline" size={20} color={C.textDim} />
                  </Pressable>
                }
              />
            </View>
          );
        })
      )}
    </Sheet>
  );
}
```

- [ ] **Step 8: Replace the whole of `src/app/(tabs)/_layout.tsx`**

```tsx
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { NudgeToast } from '../../components/NudgeToast';
import { Sidebar } from '../../components/Sidebar';
import { TabBar } from '../../components/TabBar';
import { makeT } from '../../i18n';
import { firebaseEnabled } from '../../services/firebase';
import { useAuth } from '../../services/useAuth';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { Skeleton } from '../../ui/tiles';
import { useIsWide } from '../../ui/useBreakpoint';

export default function TabsLayout() {
  const { state, ready: stateReady } = useApp();
  const auth = useAuth();
  const ready = stateReady && auth.ready;
  const wide = useIsWide();
  const t = makeT(state.profile.lang);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 12, paddingTop: 72 }}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={190} />
        <Skeleton height={120} />
        <Skeleton height={96} />
      </View>
    );
  }
  // Not signed in: the landing page and nothing else, on every platform.
  if (firebaseEnabled && !auth.user) return <Redirect href="/welcome" />;
  if (!state.profile.onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      {wide ? <Sidebar /> : null}
      <View style={{ flex: 1 }}>
        <Tabs tabBar={wide ? () => null : (props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
          {/* Every tab the bar can show; which of them it shows comes from the person's settings (core/bar.ts). */}
          <Tabs.Screen name="index" options={{ title: t('tab_today') }} />
          <Tabs.Screen name="me" options={{ title: t('tab_me') }} />
          <Tabs.Screen name="progress" options={{ title: t('tab_progress') }} />
          <Tabs.Screen name="coach" options={{ title: t('tab_coach') }} />
          <Tabs.Screen name="body" options={{ title: t('tab_body') }} />
          <Tabs.Screen name="sleep-tab" options={{ title: t('sleep_title') }} />
          <Tabs.Screen name="plan-tab" options={{ title: t('tab_plan') }} />
          {/* Old addresses keep working, so links and notifications still land; they are never on the bar. */}
          <Tabs.Screen name="food" options={{ href: null }} />
          <Tabs.Screen name="log" options={{ href: null }} />
          <Tabs.Screen name="growth" options={{ href: null }} />
          <Tabs.Screen name="fit" options={{ href: null }} />
          <Tabs.Screen name="mind" options={{ href: null }} />
        </Tabs>
        <NudgeToast />
      </View>
    </View>
  );
}
```

- [ ] **Step 9: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 5 more tests.

```bash
grep -nE "fontFamily|eslint-disable|textGhost|letterSpacing|toUpperCase|fontWeight: '[6-9]00'|LinearGradient|hitSlop|water_glasses" src/components/TabBar.tsx src/components/Sidebar.tsx "src/app/(tabs)/_layout.tsx" "src/app/(tabs)/me.tsx" "src/app/(tabs)/sleep-tab.tsx" "src/app/(tabs)/plan-tab.tsx" src/components/SavedMealsSheet.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/TabBar.tsx src/components/Sidebar.tsx "src/app/(tabs)/_layout.tsx" "src/app/(tabs)/me.tsx" "src/app/(tabs)/sleep-tab.tsx" "src/app/(tabs)/plan-tab.tsx" src/components/SavedMealsSheet.tsx
```

Expected: both print nothing.

- [ ] **Step 10: Commit**

```bash
git add src/core/bar.ts src/core/__tests__/bar.test.ts src/components/TabBar.tsx src/components/Sidebar.tsx "src/app/(tabs)/_layout.tsx" "src/app/(tabs)/me.tsx" "src/app/(tabs)/sleep-tab.tsx" "src/app/(tabs)/plan-tab.tsx" src/components/SavedMealsSheet.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The tab bar is Today, the extra tabs the person chose, the ➕ in the middle and Me, and the sidebar on a wide screen shows the same list; Sleep and the diet plan can be tabs, old addresses still open, and Me is a plain list of everything else (coach chat, body, the diet plan and eating pattern, saved meals with delete, grocery and recipes, settings, the guide, and Progress whenever it is off the bar)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Section links that clear themselves, page titles, and the home-screen status bar

**Files:**
- Create: `src/ui/useSectionParam.ts`, `src/core/screenTitle.ts`, `src/core/__tests__/screenTitle.test.ts`
- Modify: `src/app/(tabs)/food.tsx`, `src/app/(tabs)/body.tsx`, `src/app/(tabs)/progress.tsx` (imports; the `?s=` block), `src/app/_layout.tsx` (imports; `AppShell`), `src/app/+html.tsx` (the status-bar meta)

**Interfaces:**
- Consumes: `useLocalSearchParams`, `useRouter`, `usePathname` (expo-router), `Head` (`expo-router/head`), the `hdr_*` and `tab_*` keys.
- Produces: `useSectionParam<T extends string>(sections: readonly T[]): [T, (s: T) => void]`; `titleKeyFor(pathname): string | null`, `pageTitle(pathname, word): string`.

A link such as `/food?s=history` opens that section, and the param is then cleared with `router.setParams({ s: undefined })` (see "API notes"), so the same link works again later and a section the person picks by hand is never pulled back by a param left in the address. The section follows a new link by adjusting state while rendering, the pattern React gives for state that follows a changed value (the same one `FoodDetailSheet` uses), which removes three `eslint-disable` lines.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/screenTitle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pageTitle, titleKeyFor } from '../screenTitle';

describe('page titles', () => {
  it('names each address, ignoring the query and a trailing slash', () => {
    expect(titleKeyFor('/')).toBe('tab_today');
    expect(titleKeyFor('/food?s=plan')).toBe('tab_food');
    expect(titleKeyFor('/settings/')).toBe('hdr_settings');
    expect(titleKeyFor('/sleep-tab')).toBe('hdr_sleep');
    expect(titleKeyFor('/welcome')).toBeNull();
  });

  it('puts the page before the app name, and the app name alone where no page is named', () => {
    const words: Record<string, string> = { tab_me: 'Me', app_name: 'Sobat' };
    const word = (k: string) => words[k] ?? k;
    expect(pageTitle('/me', word)).toBe('Me · Sobat');
    expect(pageTitle('/welcome', word)).toBe('Sobat');
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/screenTitle.test.ts`
Expected: FAIL: `Failed to resolve import "../screenTitle"`.

- [ ] **Step 3: Create `src/core/screenTitle.ts`**

```ts
/**
 * The web page title for each address, as an i18n key, so a browser tab and
 * its history say which page they are. Pages with no entry show the app name.
 */
const TITLES: Record<string, string> = {
  '/': 'tab_today',
  '/me': 'tab_me',
  '/progress': 'tab_progress',
  '/coach': 'tab_coach',
  '/body': 'tab_body',
  '/food': 'tab_food',
  '/sleep-tab': 'hdr_sleep',
  '/sleep': 'hdr_sleep',
  '/plan-tab': 'hdr_plan',
  '/plan': 'hdr_plan',
  '/log': 'add_food',
  '/settings': 'hdr_settings',
  '/history': 'hdr_history',
  '/guide': 'hdr_guide',
  '/journey': 'hdr_journey',
  '/photo': 'hdr_photo',
  '/scan': 'hdr_scan',
  '/memory': 'hdr_memory',
  '/foods': 'hdr_foods',
  '/recipes': 'hdr_recipes',
  '/session': 'hdr_session',
  '/routine': 'pattern_title',
  '/admin': 'hdr_admin',
  '/growth': 'charts',
  '/fit': 'fit_title',
  '/mind': 'mind_title',
};

export function titleKeyFor(pathname: string): string | null {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return TITLES[path] ?? null;
}

/** "Today · Sobat"; just "Sobat" where no page is named. */
export function pageTitle(pathname: string, word: (key: string) => string): string {
  const key = titleKeyFor(pathname);
  return key ? `${word(key)} · ${word('app_name')}` : word('app_name');
}
```

Run: `npx vitest run src/core/__tests__/screenTitle.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 4: Create `src/ui/useSectionParam.ts`**

```ts
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * A tab with sections that a link can name with ?s= (the coach, Me, a
 * notification). The named section opens, then the param is cleared, so the
 * same link works again later and a section picked by hand is never pulled
 * back by a param left in the address.
 */
export function useSectionParam<T extends string>(sections: readonly T[]): [T, (s: T) => void] {
  const router = useRouter();
  const { s } = useLocalSearchParams<{ s?: string }>();
  const linked = typeof s === 'string' && (sections as readonly string[]).includes(s) ? (s as T) : null;
  const [section, setSection] = useState<T>(linked ?? sections[0]);
  // A new link wins over what was open: state that follows a changed value is adjusted while rendering.
  if (linked !== null && linked !== section) setSection(linked);
  useEffect(() => {
    if (s !== undefined) router.setParams({ s: undefined });
  }, [s, router]);
  return [section, setSection];
}
```

- [ ] **Step 5: The three tabs use it**

In each of `src/app/(tabs)/food.tsx`, `src/app/(tabs)/body.tsx` and `src/app/(tabs)/progress.tsx`:

Replace the two import lines

```ts
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
```

with

```ts
import React from 'react';
```

after the line `import { SectionTabs } from '../../ui/SectionTabs';` add

```ts
import { useSectionParam } from '../../ui/useSectionParam';
```

and replace the block

```tsx
  const { s } = useLocalSearchParams<{ s?: string }>();
  const wanted = typeof s === 'string' && (SECTIONS as string[]).includes(s) ? (s as Section) : SECTIONS[0];
  const [section, setSection] = useState<Section>(wanted);
  useEffect(() => {
    // A link that names a section wins over what was open last time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof s === 'string') setSection(wanted);
  }, [s, wanted]);
```

with

```tsx
  const [section, setSection] = useSectionParam(SECTIONS);
```

Then `grep -n "eslint-disable\|useLocalSearchParams" "src/app/(tabs)/food.tsx" "src/app/(tabs)/body.tsx" "src/app/(tabs)/progress.tsx"` prints nothing.

- [ ] **Step 6: The page title, in `src/app/_layout.tsx`**

Replace `import { Redirect, Stack, useSegments } from 'expo-router';` with:

```ts
import { Redirect, Stack, usePathname, useSegments } from 'expo-router';
import Head from 'expo-router/head';
```

After `import { BreakToast } from '../components/BreakToast';` add:

```ts
import { pageTitle } from '../core/screenTitle';
```

In `AppShell`, after `  const segments = useSegments() as string[];` add:

```ts
  const pathname = usePathname();
```

and replace

```tsx
      <StatusBar style={themeMode() === 'light' ? 'dark' : 'light'} />
```

with

```tsx
      {/* The browser tab says which page this is; expo-router leaves the title to the app. */}
      {Platform.OS === 'web' ? (
        <Head>
          <title>{pageTitle(pathname, t)}</title>
        </Head>
      ) : null}
      <StatusBar style={themeMode() === 'light' ? 'dark' : 'light'} />
```

- [ ] **Step 7: The home-screen status bar, in `src/app/+html.tsx`**

Replace

```tsx
        {/* Pinned to an iPhone home screen: this icon and name, and no Safari chrome around the app. */}
```

with

```tsx
        {/* Pinned to an iPhone home screen: this icon and name, no Safari chrome around the app, and the normal status bar, not a black band above a light page. */}
```

and `<meta name="apple-mobile-web-app-status-bar-style" content="black" />` with `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`.

- [ ] **Step 8: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 2 more tests; three fewer `eslint-disable` lines in the repo (`grep -rn "eslint-disable" src | wc -l` is 3 lower than before this task).

`grep -n 'status-bar-style' src/app/+html.tsx` prints the `content="default"` line.

- [ ] **Step 9: Commit**

```bash
git add src/ui/useSectionParam.ts src/core/screenTitle.ts src/core/__tests__/screenTitle.test.ts "src/app/(tabs)/food.tsx" "src/app/(tabs)/body.tsx" "src/app/(tabs)/progress.tsx" src/app/_layout.tsx src/app/+html.tsx
git commit -m "$(cat <<'EOF'
A link that opens a section of Food, Body or Progress clears itself once followed, so the same link works again and a section picked by hand stays; each web page has a title naming the page; and the iPhone home-screen app uses the normal status bar instead of a black band

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Tighter food search, and food names in the person's language

**Files:**
- Modify: `src/core/foods.ts` (`buildIndex` options; append `MATCH_CUTOFF`, `findFoods`, `itemName`), `src/core/__tests__/foods.test.ts` (import line; append)
- Modify: `src/components/RoutineCard.tsx` (imports; delete the local `itemName`; lines with `f.name_mr` / `it.name_mr`), `src/app/foods.tsx`, `src/app/photo.tsx`, `src/app/routine.tsx`, `src/components/SlotEditor.tsx`, `src/components/MealSheet.tsx`, `src/app/(tabs)/coach.tsx`, `src/app/scan.tsx` (imports; the `alt=` lines)

**Interfaces:**
- Consumes: `Fuse` (fuse.js 7.5), `foodName`.
- Produces: `MATCH_CUTOFF = 0.5`, `findFoods(foods: FoodItem[], query: string, limit = 30): FoodItem[]` (blank query → `[]`), `itemName(item: Pick<MealItem, 'foodId' | 'name_en' | 'name_mr'>, foods: FoodItem[], lang: Lang): string`.

Why a cutoff, not a lower Fuse `threshold`: Fuse applies `threshold` key by key, and chikoo reaches "poha" through its alias "sapota", so lowering it changes nothing (checked: at 0.4, 0.3 and 0.25 "poha" still returns chikoo at a combined score of 0.59, and chapati's only hit at 0.25 drops "pear" but also real Marathi spellings elsewhere). The combined score of a real match is under 0.35 for every name the tests use and chikoo's is 0.59, so the add sheet keeps matches under 0.5. `searchFoods` (used by the photo and the coach to match a model's free-text name, where a loose match is better than none) is unchanged; `includeScore` only adds the score to the results.

A logged item has no Hindi name (`MealItem` keeps `name_en` and `name_mr`), so Hindi users saw the Marathi one. `itemName` looks the food up in the database and uses `foodName`, and falls back to the English name for Hindi.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/foods.test.ts`, add `findFoods,` and `itemName,` to the `../foods` import list (after `foodsForDiet` and `isCountable` respectively, keeping it alphabetical), and append:

```ts
describe('findFoods, the add sheet search', () => {
  const ALL = foodsJson as unknown as FoodItem[];
  const ids = (q: string) => findFoods(ALL, q).map((f) => f.id);

  it('keeps only close matches: "poha" finds poha and not chikoo', () => {
    expect(ids('poha')).toEqual(['poha']);
    expect(ids('pohe')).toEqual(['poha']);
    expect(ids('पोहे')).toEqual(['poha']);
    expect(ids('chiku')).toContain('chikoo');
    expect(ids('chiku')).not.toContain('lichi');
    expect(ids('kaju')).toEqual(['cashews', 'kaju-katli']);
  });

  it('still finds the names people type, and nothing for a blank search', () => {
    expect(ids('badam')).toContain('almonds');
    expect(ids('akrod')).toContain('walnuts');
    expect(ids('flower batata')).toContain('aloo-gobi');
    expect(ids('lal math')).toContain('lal-math-bhaji');
    expect(ids('   ')).toEqual([]);
  });
});

describe('itemName', () => {
  const ALL = foodsJson as unknown as FoodItem[];

  it('names a logged item in the chosen language: Hindi from the database, English when there is none, never the Marathi name for Hindi', () => {
    const chapati = ALL.find((f) => f.id === 'chapati')!;
    expect(itemName({ foodId: 'chapati', name_en: 'Chapati', name_mr: 'चपाती' }, ALL, 'hi')).toBe(chapati.name_hi);
    expect(itemName({ name_en: 'Home dal', name_mr: 'घरचं वरण' }, ALL, 'hi')).toBe('Home dal');
    expect(itemName({ name_en: 'Home dal', name_mr: 'घरचं वरण' }, ALL, 'mr')).toBe('घरचं वरण');
    expect(itemName({ name_en: 'Home dal', name_mr: 'घरचं वरण' }, ALL, 'en')).toBe('Home dal');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/foods.test.ts`
Expected: FAIL: `findFoods is not a function` and `itemName is not a function`.

- [ ] **Step 3: `src/core/foods.ts`**

In `buildIndex`, after `    minMatchCharLength: 2,` add:

```ts
    // The add sheet drops far-fetched matches by this score (findFoods); the other searches ignore it.
    includeScore: true,
```

Append:

```ts
/** How close a match must be for the add sheet, 0 exact to 1 anything. "poha" against chikoo (by its alias "sapota") scores about 0.59. */
export const MATCH_CUTOFF = 0.5;

/** The add sheet's search: the closest matches first, without the far-fetched ones. A blank search finds nothing. */
export function findFoods(foods: FoodItem[], query: string, limit = 30): FoodItem[] {
  const q = query.trim();
  if (!q) return [];
  if (!cached || cached.list !== foods) buildIndex(foods);
  return cached!.fuse
    .search(q, { limit })
    .filter((r) => (r.score ?? 1) < MATCH_CUTOFF)
    .map((r) => r.item);
}

/**
 * A logged item's name in the person's language: the food's own name when it
 * is in the database; otherwise what was logged, Marathi for Marathi and
 * English for the rest (a logged item has no Hindi name of its own).
 */
export function itemName(item: Pick<MealItem, 'foodId' | 'name_en' | 'name_mr'>, foods: FoodItem[], lang: Lang): string {
  const f = item.foodId ? foods.find((x) => x.id === item.foodId) : undefined;
  if (f) return foodName(f, lang);
  return lang === 'mr' ? item.name_mr || item.name_en : item.name_en;
}
```

Run: `npx vitest run src/core/__tests__/foods.test.ts`
Expected: PASS (3 new tests; the existing search tests still pass).

- [ ] **Step 4: The screens name foods in the person's language**

`src/components/RoutineCard.tsx`: replace `import { foodName, searchFoods } from '../core/foods';` with `import { foodName, itemName, searchFoods } from '../core/foods';`, replace `import type { FoodItem, Lang, MealItem } from '../core/types';` with `import type { FoodItem, Lang } from '../core/types';`, and delete the local helper (its doc comment and four lines):

```ts
/** A logged line's name in the chosen language: the database name where there is one, else its own. */
function itemName(it: Pick<MealItem, 'foodId' | 'name_en' | 'name_mr'>, foods: FoodItem[], lang: Lang): string {
  const f = it.foodId ? foods.find((x) => x.id === it.foodId) : undefined;
  return f ? foodName(f, lang) : lang === 'en' ? it.name_en : it.name_mr || it.name_en;
}
```

Imports elsewhere: in `src/app/foods.tsx` add `foodName, ` to the `../core/foods` import (`import { defaultPortion, foodName, portionLabel, searchFoods, styleOf, toMealItem } from '../core/foods';`); in `src/app/photo.tsx` likewise (`import { defaultPortion, foodName, resolveByName, searchFoods, toMealItem } from '../core/foods';`); in `src/components/MealSheet.tsx` (`import { defaultPortion, itemName, scaleMealItem, toMealItem } from '../core/foods';`); in `src/app/(tabs)/coach.tsx` (`import { foodName, itemName, suggestMeals, toMealItem } from '../../core/foods';`); in `src/app/scan.tsx` add `import { foodName } from '../core/foods';` after the `CustomFoodForm` import. `src/app/routine.tsx` and `src/components/SlotEditor.tsx` already import `foodName`.

Then run:

```bash
perl -pi -e "s/alt=\{lang === 'en' \? undefined : f\.name_mr\}/alt={lang === 'en' ? undefined : foodName(f, lang)}/g" src/app/foods.tsx src/app/photo.tsx src/app/routine.tsx src/components/SlotEditor.tsx src/components/RoutineCard.tsx
perl -pi -e "s/alt=\{lang === 'en' \? undefined : it\.name_mr\}/alt={lang === 'en' ? undefined : itemName(it, foods, lang)}/g" src/components/RoutineCard.tsx
perl -pi -e "s/alt=\{lang === 'en' \? undefined : it\.name_mr\}/alt={lang === 'en' ? undefined : itemName(it, app.foods, lang)}/g" src/components/MealSheet.tsx
perl -pi -e "s/alt=\{lang === 'en' \? undefined : o\.name_mr\}/alt={lang === 'en' ? undefined : itemName(o, app.foods, lang)}/g" "src/app/(tabs)/coach.tsx"
perl -pi -e "s/alt=\{lang === 'en' \? undefined : found\.name_mr\}/alt={lang === 'en' ? undefined : foodName(found, lang)}/g" src/app/scan.tsx
perl -pi -e "s/const displayMr = d\.food \? d\.food\.name_mr : d\.nameMrGuess;/const displayMr = d.food ? foodName(d.food, lang) : d.nameMrGuess;/" src/app/photo.tsx
```

Then `grep -rnE "alt=\{lang === 'en' \? undefined : [a-z]+\.name_mr\}|d\.food\.name_mr" src/app src/components` prints nothing. (`src/app/(tabs)/log.tsx` and `src/app/(tabs)/index.tsx` are rewritten in Tasks 11 and 17; `FoodDetailSheet.tsx` in Task 9.)

- [ ] **Step 5: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 3 more tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/foods.ts src/core/__tests__/foods.test.ts src/components/RoutineCard.tsx src/app/foods.tsx src/app/photo.tsx src/app/routine.tsx src/components/SlotEditor.tsx src/components/MealSheet.tsx "src/app/(tabs)/coach.tsx" src/app/scan.tsx
git commit -m "$(cat <<'EOF'
The food search for adding a meal keeps only close matches, so poha finds poha and not chikoo, and every name people type still works; foods and logged items are named in the person's language everywhere, so Hindi readers see Hindi names instead of Marathi ones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 9: The basket, the stepper, and a food sheet with any amount

**Files:**
- Create: `src/core/basket.ts`, `src/core/__tests__/basket.test.ts`, `src/ui/QtyStepper.tsx`
- Modify (whole file): `src/components/FoodDetailSheet.tsx`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `defaultPortion`, `toMealItem`, `foodName`, `measuresFor`, `portionLabel`, `styleOf` (`foods.ts`), `kcalForGrams`, `toISODate`, `PlanLine`, `PlanMeal`.
- Produces:
  - `basket.ts`: `type BasketLine = { foodId: string; unit: string; gramsPerUnit: number; count: number }`, `stepFor(unit): number`, `stepCount(count, unit, by: 1 | -1): number`, `lineOf(food, count?): BasketLine`, `addLine(basket, line): BasketLine[]`, `putLine(basket, line): BasketLine[]`, `setCount(basket, foodId, count): BasketLine[]`, `setGrams(basket, foodId, grams): BasketLine[]`, `lineGrams(line): number`, `basketItems(basket, foods): MealItem[]`, `basketTotals(basket, foods): { items: number; kcal: number; protein: number }`, `basketFromLines(lines, foods): BasketLine[]`, `linesFromBasket(basket, foods): PlanLine[]`, `itemsMeal(input: { id; date; slot: Pick<PlanMeal, 'id' | 'type' | 'time'>; items: MealItem[]; now: Date; source?: MealSource }): Meal | null`, `basketMeal(input: { id; date; slot; basket; foods; now; source? }): Meal | null`, `slotPreview(input: { allowance; eaten; autoKcal; basketKcal; dayLeft }): { replaces: boolean; slotLeft: number; dayLeft: number }`, `formatQty(q): string`.
  - `QtyStepper({ value, onMinus, onPlus, minusLabel, plusLabel })`.
  - `FoodDetailSheet` keeps its props (`food`, `initial`, `onAdd`, `onClose`) and its `Chosen` type; `FoodThumb({ food, size? })` keeps its props.
  - i18n: `qty_less`, `qty_more`, `qty_grams`.

`FoodDetailSheet` loses its fixed `QTYS` (0.5, 1, 1.5, 2, 3): "How many?" becomes a − / + stepper with any count and a grams box. `FoodThumb` shows the food's picture or, with none, the first letter of its name in the person's language on a plain tile, never a pictogram emoji (spec: no emoji in food rows); `foodIcon` stays in `foods.ts`, unused by food rows.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/basket.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import {
  addLine,
  basketFromLines,
  basketItems,
  basketMeal,
  basketTotals,
  formatQty,
  itemsMeal,
  lineGrams,
  lineOf,
  linesFromBasket,
  putLine,
  setCount,
  setGrams,
  slotPreview,
  stepCount,
  stepFor,
} from '../basket';
import { kcalForGrams } from '../nutrition';
import type { FoodItem } from '../types';

const foods = foodsJson as unknown as FoodItem[];
const food = (id: string) => foods.find((f) => f.id === id)!;
const NOW = new Date('2026-10-27T10:00:00');
const lunch = { id: 'lunch', type: 'lunch' as const, time: '13:00' };

describe('steps', () => {
  it('counts chapatis whole and katoris by halves, and snaps a typed amount onto the step', () => {
    expect(stepFor('piece')).toBe(1);
    expect(stepFor('katori')).toBe(0.5);
    expect(stepCount(1, 'piece', 1)).toBe(2);
    expect(stepCount(1, 'piece', -1)).toBe(0);
    expect(stepCount(1, 'katori', 1)).toBe(1.5);
    expect(stepCount(1.33, 'katori', 1)).toBe(2);
    expect(stepCount(1.33, 'katori', -1)).toBe(1);
  });
});

describe('the basket', () => {
  it('adding a food already there adds to its count, in its own measure', () => {
    const once = addLine([], lineOf(food('poha')));
    expect(once).toEqual([{ foodId: 'poha', unit: 'katori', gramsPerUnit: 150, count: 1 }]);
    expect(addLine(once, lineOf(food('poha')))[0].count).toBe(2);
    // A 200 g plate on top of a 150 g katori is 1.33 katoris more.
    expect(addLine(once, { foodId: 'poha', unit: 'plate', gramsPerUnit: 200, count: 1 })[0].count).toBe(2.33);
    expect(addLine(once, lineOf(food('chapati'), 2)).map((b) => b.foodId)).toEqual(['poha', 'chapati']);
  });

  it('the detail sheet replaces a line; a count or grams of 0 takes it out', () => {
    const b = addLine([], lineOf(food('poha')));
    expect(putLine(b, { foodId: 'poha', unit: 'plate', gramsPerUnit: 200, count: 1 })).toEqual([{ foodId: 'poha', unit: 'plate', gramsPerUnit: 200, count: 1 }]);
    expect(setCount(b, 'poha', 0)).toEqual([]);
    const typed = setGrams(b, 'poha', 200);
    expect(typed[0].count).toBe(1.33);
    expect(lineGrams(typed[0])).toBe(200);
    expect(setGrams(b, 'poha', 0)).toEqual([]);
  });

  it('counts calories from the database at the grams, and the items and protein for the bar', () => {
    const b = addLine(addLine([], lineOf(food('chapati'), 2)), lineOf(food('moong-dal')));
    const items = basketItems(b, foods);
    expect(items[0]).toMatchObject({ foodId: 'chapati', grams: 80, kcal: kcalForGrams(food('chapati'), 80).kcal, estimated: false });
    expect(basketTotals(b, foods)).toEqual({ items: 2, kcal: items[0].kcal + items[1].kcal, protein: Math.round(items[0].protein + items[1].protein) });
  });

  it("planned lines go in at their measure and come back out in the food's own measures", () => {
    const b = basketFromLines([{ foodId: 'chapati', unit: 'piece', qty: 2 }, { foodId: 'gone', unit: 'piece', qty: 1 }], foods);
    expect(b).toEqual([{ foodId: 'chapati', unit: 'piece', gramsPerUnit: 40, count: 2 }]);
    expect(linesFromBasket(b, foods)).toEqual([{ foodId: 'chapati', unit: 'piece', qty: 2 }]);
    // Four big spoons of poha (60 g) is 0.4 of its 150 g katori.
    expect(linesFromBasket([{ foodId: 'poha', unit: 'spoon_big', gramsPerUnit: 15, count: 4 }], foods)).toEqual([{ foodId: 'poha', unit: 'katori', qty: 0.4 }]);
  });
});

describe('the meal it saves', () => {
  it("is logged now for today and at the slot's time for another day, typed by hand unless said otherwise", () => {
    const b = [lineOf(food('poha'))];
    const today = basketMeal({ id: 'm1', date: '2026-10-27', slot: lunch, basket: b, foods, now: NOW })!;
    expect(today).toMatchObject({ id: 'm1', date: '2026-10-27', type: 'lunch', slotId: 'lunch', source: 'manual', at: NOW.toISOString() });
    expect(today.kcal).toBe(kcalForGrams(food('poha'), 150).kcal);
    expect(basketMeal({ id: 'm2', date: '2026-10-25', slot: lunch, basket: b, foods, now: NOW })!.at).toBe(new Date('2026-10-25T13:00:00').toISOString());
    expect(basketMeal({ id: 'm3', date: '2026-10-27', slot: lunch, basket: [], foods, now: NOW })).toBeNull();
    expect(itemsMeal({ id: 'm4', date: '2026-10-27', slot: lunch, items: today.items, now: NOW, source: 'plan' })!.source).toBe('plan');
  });

  it('a slot holding only the meal filled in from the plan is replaced, not counted twice', () => {
    expect(slotPreview({ allowance: 500, eaten: 400, autoKcal: 400, basketKcal: 450, dayLeft: 300 })).toEqual({ replaces: true, slotLeft: 50, dayLeft: 250 });
    expect(slotPreview({ allowance: 500, eaten: 600, autoKcal: 400, basketKcal: 450, dayLeft: 300 })).toEqual({ replaces: false, slotLeft: -550, dayLeft: -150 });
    expect(slotPreview({ allowance: 500, eaten: 0, autoKcal: 0, basketKcal: 450, dayLeft: 300 })).toEqual({ replaces: false, slotLeft: 50, dayLeft: -150 });
  });
});

describe('formatQty', () => {
  it('writes halves and quarters as fractions, and anything else as it is', () => {
    expect([2, 0.5, 1.5, 0.25, 2.75, 1.33, 0.4].map((q) => formatQty(q))).toEqual(['2', '½', '1½', '¼', '2¾', '1.33', '0.4']);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/basket.test.ts`
Expected: FAIL: `Failed to resolve import "../basket"`.

- [ ] **Step 3: Create `src/core/basket.ts`**

```ts
import { toISODate } from './date';
import { defaultPortion, toMealItem } from './foods';
import type { PlanLine } from './routine';
import type { FoodItem, ISODate, Meal, MealItem, MealSource } from './types';
import type { PlanMeal } from './weekPlan';

/**
 * The add sheet's basket: the foods about to be logged as one meal. Each line
 * is a food, a measure, what one measure weighs and how many; one line per
 * food, so adding a food that is already there adds to its count. Calories
 * always come from the database at those grams. Pure, so the stepper, the
 * grams box, the bottom bar, a saved meal and a day's menu all count the
 * same way.
 */
export type BasketLine = { foodId: string; unit: string; gramsPerUnit: number; count: number };

/** Measures counted whole: one chapati, one slice, one medium banana. */
const WHOLE_UNITS = ['piece', 'slice', 'small', 'medium', 'large'];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** How much one − or + changes a count: one for things counted whole, a half for the rest. */
export function stepFor(unit: string): number {
  return WHOLE_UNITS.includes(unit) ? 1 : 0.5;
}

/** The count after one − or +, kept on the step (a typed 1.33 goes to 2 or to 1); 0 means the line goes. */
export function stepCount(count: number, unit: string, by: 1 | -1): number {
  const step = stepFor(unit);
  return Math.max(0, round2(Math.round((count + by * step) / step) * step));
}

/** A food's line at its own default measure. */
export function lineOf(food: FoodItem, count = 1): BasketLine {
  const p = defaultPortion(food);
  return { foodId: food.id, unit: p?.unit ?? 'bowl', gramsPerUnit: p?.grams ?? 150, count };
}

/** Add to the basket: a food already there gets the extra amount in its own measure; a new food gets a line. */
export function addLine(basket: BasketLine[], line: BasketLine): BasketLine[] {
  const at = basket.findIndex((b) => b.foodId === line.foodId);
  if (at < 0) return line.count > 0 ? [...basket, line] : basket;
  const b = basket[at];
  const more = b.unit === line.unit ? line.count : (line.count * line.gramsPerUnit) / b.gramsPerUnit;
  return basket.map((x, i) => (i === at ? { ...x, count: round2(x.count + more) } : x));
}

/** A line as chosen in the food sheet ("Done" on a food already in the basket): it replaces that food's line. */
export function putLine(basket: BasketLine[], line: BasketLine): BasketLine[] {
  return basket.some((b) => b.foodId === line.foodId) ? basket.map((b) => (b.foodId === line.foodId ? line : b)) : [...basket, line];
}

/** Set a food's count; 0 or less takes it out. */
export function setCount(basket: BasketLine[], foodId: string, count: number): BasketLine[] {
  return count > 0 ? basket.map((b) => (b.foodId === foodId ? { ...b, count: round2(count) } : b)) : basket.filter((b) => b.foodId !== foodId);
}

/** Set a food's grams; its count follows, in its measure. 0 or less takes it out. */
export function setGrams(basket: BasketLine[], foodId: string, grams: number): BasketLine[] {
  const b = basket.find((x) => x.foodId === foodId);
  if (!b) return basket;
  return setCount(basket, foodId, b.gramsPerUnit > 0 ? grams / b.gramsPerUnit : 0);
}

export function lineGrams(line: BasketLine): number {
  return Math.round(line.gramsPerUnit * line.count);
}

/** The basket as meal items with database calories. A food the person made up stays estimated; a food that is gone is dropped. */
export function basketItems(basket: BasketLine[], foods: FoodItem[]): MealItem[] {
  const items: MealItem[] = [];
  for (const b of basket) {
    const food = foods.find((f) => f.id === b.foodId);
    const grams = lineGrams(b);
    if (food && grams > 0) items.push(toMealItem(food, grams, food.tags.includes('custom')));
  }
  return items;
}

/** "N items · X kcal" for the bottom bar, and the protein. */
export function basketTotals(basket: BasketLine[], foods: FoodItem[]): { items: number; kcal: number; protein: number } {
  const items = basketItems(basket, foods);
  return { items: items.length, kcal: items.reduce((a, i) => a + i.kcal, 0), protein: Math.round(items.reduce((a, i) => a + i.protein, 0)) };
}

/** Planned lines into the basket ("Change" on a meal of the menu), each at its own measure, the way a plan line is read. */
export function basketFromLines(lines: PlanLine[], foods: FoodItem[]): BasketLine[] {
  let basket: BasketLine[] = [];
  for (const l of lines) {
    const food = foods.find((f) => f.id === l.foodId);
    if (!food) continue;
    const p = food.portions.find((x) => x.unit === l.unit) ?? defaultPortion(food);
    if (p) basket = addLine(basket, { foodId: food.id, unit: p.unit, gramsPerUnit: p.grams, count: l.qty });
  }
  return basket;
}

/**
 * The basket as planned lines, for a saved meal or a day's menu. A line in
 * one of the food's own measures stays in it; a household measure (a bowl, a
 * spoon) becomes the food's default measure at the same grams, because a
 * planned line is read in the food's own measures.
 */
export function linesFromBasket(basket: BasketLine[], foods: FoodItem[]): PlanLine[] {
  const lines: PlanLine[] = [];
  for (const b of basket) {
    const food = foods.find((f) => f.id === b.foodId);
    if (!food || b.count <= 0) continue;
    if (food.portions.some((p) => p.unit === b.unit)) {
      lines.push({ foodId: b.foodId, unit: b.unit, qty: round2(b.count) });
      continue;
    }
    const p = defaultPortion(food);
    if (p && p.grams > 0) lines.push({ foodId: b.foodId, unit: p.unit, qty: round2(lineGrams(b) / p.grams) });
  }
  return lines;
}

/** A clock time to build a date-time from; noon when a slot has none. */
function clockOf(hhmm: string | undefined): string {
  return hhmm && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm) ? hhmm : '12:00';
}

/** A meal of these items in a slot on a date: logged now for today, at the slot's time for another day. Typed by hand unless said otherwise. Null with no items. */
export function itemsMeal(input: { id: string; date: ISODate; slot: Pick<PlanMeal, 'id' | 'type' | 'time'>; items: MealItem[]; now: Date; source?: MealSource }): Meal | null {
  if (input.items.length === 0) return null;
  const at = input.date === toISODate(input.now) ? input.now : new Date(`${input.date}T${clockOf(input.slot.time)}:00`);
  return {
    id: input.id,
    at: at.toISOString(),
    date: input.date,
    type: input.slot.type,
    slotId: input.slot.id,
    items: input.items,
    kcal: input.items.reduce((a, i) => a + i.kcal, 0),
    protein: Math.round(input.items.reduce((a, i) => a + i.protein, 0)),
    source: input.source ?? 'manual',
  };
}

/** The basket as one meal in a slot on a date. */
export function basketMeal(input: { id: string; date: ISODate; slot: Pick<PlanMeal, 'id' | 'type' | 'time'>; basket: BasketLine[]; foods: FoodItem[]; now: Date; source?: MealSource }): Meal | null {
  return itemsMeal({ id: input.id, date: input.date, slot: input.slot, items: basketItems(input.basket, input.foods), now: input.now, source: input.source });
}

/**
 * What saving the basket into a slot does, for the line under the slot
 * chips. A slot that holds only the meal the app filled in from the plan gets
 * that meal replaced (the store drops it when a real meal lands there), so its
 * calories come back to the slot and the day before the basket is counted,
 * and nothing reads as over because of it.
 */
export function slotPreview(input: { allowance: number; eaten: number; autoKcal: number; basketKcal: number; dayLeft: number }): { replaces: boolean; slotLeft: number; dayLeft: number } {
  const replaces = input.autoKcal > 0 && input.eaten <= input.autoKcal;
  const back = replaces ? input.autoKcal : 0;
  return { replaces, slotLeft: input.allowance - (input.eaten - back) - input.basketKcal, dayLeft: input.dayLeft + back - input.basketKcal };
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

/** A count as people write it: 2, ½, 1½, ¾; anything else as it is (1.33). */
export function formatQty(q: number): string {
  const r = round2(q);
  const whole = Math.floor(r);
  const frac = round2(r - whole);
  if (frac === 0) return String(whole);
  const sign = FRACTIONS[String(frac)];
  if (sign) return whole === 0 ? sign : `${whole}${sign}`;
  return String(r);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/core/__tests__/basket.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Create `src/ui/QtyStepper.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, F, lh, S } from './theme';

/**
 * − count +. Each button is a full 44-point circle on every platform (the
 * web adds no reach around a control, so the box itself is that size) and is
 * named for screen readers with what it changes ("Less chapati").
 */
export function QtyStepper({ value, onMinus, onPlus, minusLabel, plusLabel }: { value: string; onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <StepButton icon="remove" label={minusLabel} onPress={onMinus} />
      <Text style={{ minWidth: 40, textAlign: 'center', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <StepButton icon="add" label={plusLabel} onPress={onPlus} />
    </View>
  );
}

function StepButton({ icon, label, onPress }: { icon: 'add' | 'remove'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.cardHigh : C.cardAlt })}>
      <Ionicons name={icon} size={18} color={C.text} />
    </Pressable>
  );
}
```

- [ ] **Step 6: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`: `  qty_less: 'Less {food}', qty_more: 'More {food}', qty_grams: 'Grams',`
Before the `};` that closes `mr`: `  qty_less: '{food} कमी', qty_more: '{food} जास्त', qty_grams: 'ग्रॅम',`
Before the `};` that closes `hi`: `  qty_less: '{food} कम', qty_more: '{food} ज़्यादा', qty_grams: 'ग्राम',`

- [ ] **Step 7: Replace the whole of `src/components/FoodDetailSheet.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatQty, stepCount, stepFor } from '../core/basket';
import { defaultPortion, foodName, measuresFor, portionLabel, styleOf } from '../core/foods';
import { kcalForGrams } from '../core/nutrition';
import type { FoodItem } from '../core/types';
import { FOOD_IMAGES } from '../data/foodImages';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Divider, Field, Micro, Pill, Row, Small } from '../ui/components';
import { QtyStepper } from '../ui/QtyStepper';
import { Sheet } from '../ui/Sheet';
import { C, F, lh, S } from '../ui/theme';

/** The food's picture or, with none, the first letter of its name on a plain tile. No pictograms: a food row carries no emoji. */
export function FoodThumb({ food, size = 44 }: { food: FoodItem; size?: number }) {
  const { state } = useApp();
  const src = FOOD_IMAGES[food.id];
  if (src) return <Image source={src} style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: C.cardAlt }} contentFit="cover" transition={150} />;
  const initial = Array.from(foodName(food, state.profile.lang).trim())[0] ?? '';
  const type = size >= 64 ? F.title : F.body;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.textDim, fontSize: type, lineHeight: lh(type), fontWeight: '500' }}>{initial}</Text>
    </View>
  );
}

export type Chosen = { food: FoodItem; unit: string; gramsPerUnit: number; count: number };

/**
 * One food, looked at properly before it goes in: the picture, the measure,
 * any amount (− / + by a whole or a half, or the grams typed), and the
 * calories and macros for exactly that amount, from the database.
 */
export function FoodDetailSheet({
  food,
  initial,
  onAdd,
  onClose,
}: {
  food: FoodItem | null;
  /** Editing a line already in the basket: start from its measure and amount. */
  initial?: { unit: string; gramsPerUnit: number; count: number } | null;
  onAdd: (c: Chosen) => void;
  onClose: () => void;
}) {
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [count, setCount] = useState(1);
  const [measure, setMeasure] = useState<{ unit: string; grams: number } | null>(null);
  // What is being typed in the grams box; null shows the grams the count works out to.
  const [gramsDraft, setGramsDraft] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // A different food starts from its own default portion again.
  const id = food?.id ?? null;
  if (id !== openId) {
    setOpenId(id);
    setCount(initial?.count ?? 1);
    setGramsDraft(null);
    const p = food ? defaultPortion(food) : undefined;
    setMeasure(initial ? { unit: initial.unit, grams: initial.gramsPerUnit } : p ? { unit: p.unit, grams: p.grams } : { unit: 'bowl', grams: 150 });
  }
  if (!food || !measure) return null;
  const f = food;
  const m = measure;
  const name = foodName(f, lang);
  const style = styleOf(f);
  const grams = Math.round(m.grams * count);
  const n = kcalForGrams(f, grams);
  const options = measuresFor(f).map((x) => ({
    ...x,
    label: x.own ? portionLabel(f.portions.find((p) => p.unit === x.unit)!, lang) : t(`measure_${x.unit}`),
  }));

  function step(by: 1 | -1) {
    setGramsDraft(null);
    setCount((c) => Math.max(stepFor(m.unit), stepCount(c, m.unit, by)));
  }

  function typeGrams(v: string) {
    setGramsDraft(v);
    const g = parseFloat(v);
    if (Number.isFinite(g) && g > 0 && g <= 3000) setCount(Math.round((g / m.grams) * 100) / 100);
  }

  return (
    <Sheet open title="" onClose={onClose}>
      <View style={{ gap: 14, marginTop: -8 }}>
        <Row style={{ gap: 14, alignItems: 'flex-start' }}>
          <FoodThumb food={f} size={88} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>{name}</Text>
            {lang !== 'en' ? <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body) }}>{f.name_en}</Text> : null}
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {style ? <Pill label={t(`style_${style}`)} /> : null}
              {f.tags.includes('healthy_swap') ? <Pill label={t('healthy_pick')} color={C.cardAlt} textColor={C.green} /> : null}
            </Row>
          </View>
        </Row>

        <View style={{ gap: 8 }}>
          <Micro>{t('measure_q')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {options.map((x) => (
              <Pill
                key={x.unit}
                label={x.label}
                active={m.unit === x.unit}
                onPress={() => {
                  setGramsDraft(null);
                  setMeasure({ unit: x.unit, grams: x.grams });
                }}
              />
            ))}
          </Row>
        </View>

        <View style={{ gap: 8 }}>
          <Micro>{t('how_many')}</Micro>
          <Row style={{ gap: 14, alignItems: 'flex-end' }}>
            <QtyStepper value={formatQty(count)} onMinus={() => step(-1)} onPlus={() => step(1)} minusLabel={fill(t('qty_less'), { food: name })} plusLabel={fill(t('qty_more'), { food: name })} />
            <View style={{ width: 120 }}>
              <Field label={t('qty_grams')} value={gramsDraft ?? String(grams)} onChangeText={typeGrams} keyboardType="numeric" />
            </View>
          </Row>
        </View>

        <Divider />
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Micro>{t('calories')}</Micro>
            <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '500' }}>
              {n.kcal}
              <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500' }}> kcal</Text>
            </Text>
          </View>
          <Small color={C.textFaint}>{`${grams} g`}</Small>
        </Row>
        <View style={{ backgroundColor: C.cardAlt, borderRadius: S.radiusSm, padding: 12, gap: 8 }}>
          <Macro icon="fitness-outline" label={t('protein')} value={n.protein} />
          <Macro icon="flame-outline" label={t('carbs')} value={n.carbs} />
          <Macro icon="water-outline" label={t('fat')} value={n.fat} />
        </View>
        {f.source === 'estimate' ? <Small color={C.textFaint}>{t('estimated_values')}</Small> : null}

        <Btn label={initial ? t('done') : t('add_item')} onPress={() => onAdd({ food: f, unit: m.unit, gramsPerUnit: m.grams, count })} />
        <Pressable onPress={onClose} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: S.touch, minWidth: S.touch, justifyContent: 'center', paddingHorizontal: 12 }}>
          <Micro color={C.textDim}>{t('cancel')}</Micro>
        </Pressable>
      </View>
    </Sheet>
  );
}

function Macro({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row style={{ gap: 8 }}>
        <Ionicons name={icon} size={14} color={C.textFaint} />
        <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{label}</Text>
      </Row>
      <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{`${Math.round(value * 10) / 10} g`}</Text>
    </Row>
  );
}
```

- [ ] **Step 8: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 8 more tests.

```bash
grep -nE "QTYS|foodIcon|fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|hitSlop" src/components/FoodDetailSheet.tsx src/ui/QtyStepper.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/FoodDetailSheet.tsx src/ui/QtyStepper.tsx
```

Expected: both print nothing.

- [ ] **Step 9: Commit**

```bash
git add src/core/basket.ts src/core/__tests__/basket.test.ts src/ui/QtyStepper.tsx src/components/FoodDetailSheet.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Any amount of a food: the food sheet's fixed choices of a half to three give way to a − / + that counts chapatis whole and katoris by halves and a grams box, both a finger wide; food thumbnails show the picture or the first letter of the name instead of an emoji; and the basket's maths (one line per food, database calories, plan lines, the meal it saves, and a slot filled from the plan being replaced rather than counted twice) is tested

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: The add sheet's rows

**Files:**
- Create: `src/core/addSheet.ts`, `src/core/__tests__/addSheet.test.ts`, `src/components/AddSheetRows.tsx`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `BasketLine`, `formatQty`, `lineGrams` (Task 9), `QtyStepper` (Task 9), `FoodThumb`, `foodName`, `portionLabel`, `defaultPortion`, `kcalForGrams`.
- Produces:
  - `addSheet.ts`: `type AddRow = { kind: 'head'; key; titleKey } | { kind: 'basket'; key; foodId } | { kind: 'planned'; key } | { kind: 'yesterday'; key } | { kind: 'saved'; key; savedId } | { kind: 'food'; key; foodId } | { kind: 'tools'; key } | { kind: 'empty'; key }`, `addRows(input: { mode: 'log' | 'plan'; query: string; results: string[]; basket: BasketLine[]; planned: boolean; yesterday: boolean; saved: string[]; recents: string[] }): AddRow[]`.
  - `AddSheetRows.tsx`: `FoodRow({ food, line, lang, onAdd, onStep, onGrams, onOpen })`, `ToolsRow({ lang, onPhoto, onBarcode, onCustom })`.
  - i18n: `add_this_meal`, `add_food_named`, `add_open_food`, `add_grams_of`.

The spec's order, top to bottom: search; eat as planned (highlighted); the same as yesterday's slot; saved meals; recent foods; photo and barcode as two small buttons. The meal being built goes first once it has a food, and a recent food already in it is not listed twice. With a search typed, the list is the matches only, so they sit right under the search box, above the keyboard.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/addSheet.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addRows } from '../addSheet';
import type { BasketLine } from '../basket';

const line = (foodId: string): BasketLine => ({ foodId, unit: 'katori', gramsPerUnit: 150, count: 1 });
const base = { mode: 'log' as const, query: '', results: [] as string[], basket: [] as BasketLine[], planned: true, yesterday: true, saved: ['s1'], recents: ['poha', 'chapati'] };
const kinds = (rows: ReturnType<typeof addRows>) =>
  rows.map((r) => (r.kind === 'food' || r.kind === 'basket' ? `${r.kind}:${r.foodId}` : r.kind === 'head' ? `head:${r.titleKey}` : r.kind));

describe('addRows', () => {
  it('with nothing typed: eat as planned, the same as yesterday, saved meals, recent foods, then photo and barcode', () => {
    expect(kinds(addRows(base))).toEqual(['planned', 'yesterday', 'head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati', 'tools']);
  });

  it('puts the meal being built first, and a recent food already in it is not listed twice', () => {
    expect(kinds(addRows({ ...base, basket: [line('poha')] }))).toEqual(['head:add_this_meal', 'basket:poha', 'planned', 'yesterday', 'head:me_saved', 'saved', 'head:recent', 'food:chapati', 'tools']);
  });

  it('with a search typed: the matches only, or one line saying nothing was found', () => {
    expect(kinds(addRows({ ...base, query: 'po', results: ['poha', 'pohe'] }))).toEqual(['food:poha', 'food:pohe']);
    expect(kinds(addRows({ ...base, query: 'zzz' }))).toEqual(['empty']);
  });

  it('changing a menu offers no eating as planned, no yesterday, no photo or barcode', () => {
    expect(kinds(addRows({ ...base, mode: 'plan' }))).toEqual(['head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati']);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/addSheet.test.ts`
Expected: FAIL: `Failed to resolve import "../addSheet"`.

- [ ] **Step 3: Create `src/core/addSheet.ts`**

```ts
import type { BasketLine } from './basket';

/**
 * What the add sheet lists, top to bottom, as rows for one FlatList. With a
 * search typed: the matches only, so they sit just under the search box and
 * above the keyboard, or one line saying nothing was found. With none: the
 * meal being built, then (when logging) eating as planned and the same as
 * yesterday, then saved meals, recent foods, and photo and barcode.
 */
export type AddRow =
  | { kind: 'head'; key: string; titleKey: string }
  | { kind: 'basket'; key: string; foodId: string }
  | { kind: 'planned'; key: string }
  | { kind: 'yesterday'; key: string }
  | { kind: 'saved'; key: string; savedId: string }
  | { kind: 'food'; key: string; foodId: string }
  | { kind: 'tools'; key: string }
  | { kind: 'empty'; key: string };

export function addRows(input: {
  mode: 'log' | 'plan';
  query: string;
  /** Food ids the search found, closest first. */
  results: string[];
  basket: BasketLine[];
  /** The slot has planned foods to log as they are. */
  planned: boolean;
  /** The same slot yesterday holds a meal to log again. */
  yesterday: boolean;
  /** Saved meal ids. */
  saved: string[];
  /** Recent food ids, most used first. */
  recents: string[];
}): AddRow[] {
  if (input.query.trim()) {
    if (input.results.length === 0) return [{ kind: 'empty', key: 'empty' }];
    return input.results.map((id): AddRow => ({ kind: 'food', key: `food:${id}`, foodId: id }));
  }
  const logging = input.mode === 'log';
  const rows: AddRow[] = [];
  if (input.basket.length > 0) {
    rows.push({ kind: 'head', key: 'head:basket', titleKey: 'add_this_meal' });
    for (const b of input.basket) rows.push({ kind: 'basket', key: `basket:${b.foodId}`, foodId: b.foodId });
  }
  if (logging && input.planned) rows.push({ kind: 'planned', key: 'planned' });
  if (logging && input.yesterday) rows.push({ kind: 'yesterday', key: 'yesterday' });
  if (input.saved.length > 0) {
    rows.push({ kind: 'head', key: 'head:saved', titleKey: 'me_saved' });
    for (const id of input.saved) rows.push({ kind: 'saved', key: `saved:${id}`, savedId: id });
  }
  const inBasket = new Set(input.basket.map((b) => b.foodId));
  const recents = input.recents.filter((id) => !inBasket.has(id));
  if (recents.length > 0) {
    rows.push({ kind: 'head', key: 'head:recent', titleKey: 'recent' });
    for (const id of recents) rows.push({ kind: 'food', key: `food:${id}`, foodId: id });
  }
  if (logging) rows.push({ kind: 'tools', key: 'tools' });
  return rows;
}
```

Run: `npx vitest run src/core/__tests__/addSheet.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  add_this_meal: 'This meal', add_food_named: 'Add {food}', add_open_food: '{food}: choose the amount', add_grams_of: 'Grams of {food}',
```

Before the `};` that closes `mr`:

```ts
  add_this_meal: 'हे जेवण', add_food_named: '{food} जोडा', add_open_food: '{food}: किती ते निवडा', add_grams_of: '{food} किती ग्रॅम',
```

Before the `};` that closes `hi`:

```ts
  add_this_meal: 'यह खाना', add_food_named: '{food} जोड़ें', add_open_food: '{food}: मात्रा चुनें', add_grams_of: '{food} कितने ग्राम',
```

- [ ] **Step 5: Create `src/components/AddSheetRows.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatQty, lineGrams, type BasketLine } from '../core/basket';
import { defaultPortion, foodName, portionLabel } from '../core/foods';
import { kcalForGrams } from '../core/nutrition';
import type { FoodItem, Lang } from '../core/types';
import { fill, makeT } from '../i18n';
import { Btn, Row } from '../ui/components';
import { QtyStepper } from '../ui/QtyStepper';
import { C, F, lh, S } from '../ui/theme';
import { FoodThumb } from './FoodDetailSheet';

/** A measure's name: one of the food's own portions, else the household measure. */
function measureName(food: FoodItem, unit: string, t: (key: string) => string, lang: Lang): string {
  const own = food.portions.find((p) => p.unit === unit);
  return own ? portionLabel(own, lang) : t(`measure_${unit}`);
}

/**
 * One food in the add sheet. Not in the meal yet: its usual portion and
 * calories, and a + a finger wide. In the meal: a − / + with any count and a
 * grams box under it. The name opens the food sheet to pick another measure.
 */
export function FoodRow({
  food,
  line,
  lang,
  onAdd,
  onStep,
  onGrams,
  onOpen,
}: {
  food: FoodItem;
  line: BasketLine | undefined;
  lang: Lang;
  onAdd: () => void;
  onStep: (by: 1 | -1) => void;
  onGrams: (grams: number) => void;
  onOpen: () => void;
}) {
  const t = makeT(lang);
  const name = foodName(food, lang);
  const p = defaultPortion(food);
  const grams = line ? lineGrams(line) : p?.grams ?? 100;
  const measure = line ? measureName(food, line.unit, t, lang) : p ? portionLabel(p, lang) : '';
  const kcal = kcalForGrams(food, grams).kcal;
  return (
    <View style={{ paddingVertical: 6, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={fill(t('add_open_food'), { food: name })}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
          <FoodThumb food={food} size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={2} style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
              {name}
            </Text>
            <Text numberOfLines={1} style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>
              {measure ? `${measure} · ${kcal} kcal` : `${kcal} kcal`}
            </Text>
          </View>
        </Pressable>
        {line ? null : (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={fill(t('add_food_named'), { food: name })}
            style={({ pressed }) => ({ width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.accentSoft : C.accentDim })}>
            <Ionicons name="add" size={22} color={C.accentText} />
          </Pressable>
        )}
      </View>
      {line ? (
        <Row style={{ gap: 12, paddingLeft: 52 }}>
          <QtyStepper value={formatQty(line.count)} onMinus={() => onStep(-1)} onPlus={() => onStep(1)} minusLabel={fill(t('qty_less'), { food: name })} plusLabel={fill(t('qty_more'), { food: name })} />
          <GramsBox grams={grams} onChange={onGrams} label={fill(t('add_grams_of'), { food: name })} />
        </Row>
      ) : null}
    </View>
  );
}

/** The grams of one line, typed; the count follows. While typing, the box keeps what is typed. */
function GramsBox({ grams, onChange, label }: { grams: number; onChange: (grams: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TextInput
        value={draft ?? String(grams)}
        onChangeText={(v) => {
          setDraft(v);
          const g = parseFloat(v);
          if (Number.isFinite(g) && g > 0 && g <= 3000) onChange(g);
        }}
        onBlur={() => setDraft(null)}
        keyboardType="numeric"
        accessibilityLabel={label}
        style={{ width: 76, minHeight: S.touch, paddingHorizontal: 10, borderRadius: 12, borderWidth: S.hairline, borderColor: C.border, backgroundColor: C.cardAlt, color: C.text, fontSize: F.body, textAlign: 'right' }}
      />
      <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>g</Text>
    </View>
  );
}

/** Photo and barcode as two small buttons, and a food of the person's own. */
export function ToolsRow({ lang, onPhoto, onBarcode, onCustom }: { lang: Lang; onPhoto: () => void; onBarcode: () => void; onCustom: () => void }) {
  const t = makeT(lang);
  return (
    <View style={{ gap: 8, paddingTop: 14 }}>
      <Row style={{ gap: 8 }}>
        <Btn small tone="soft" icon={<Ionicons name="camera-outline" size={15} color={C.accentText} />} label={t('add_photo')} onPress={onPhoto} style={{ flex: 1 }} />
        <Btn small tone="soft" icon={<Ionicons name="barcode-outline" size={15} color={C.accentText} />} label={t('scan_barcode')} onPress={onBarcode} style={{ flex: 1 }} />
      </Row>
      <Btn small tone="ghost" label={t('custom_food')} onPress={onCustom} />
    </View>
  );
}
```

- [ ] **Step 6: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 4 more tests.

```bash
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|hitSlop" src/components/AddSheetRows.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/AddSheetRows.tsx
```

Expected: both print nothing.

- [ ] **Step 7: Commit**

```bash
git add src/core/addSheet.ts src/core/__tests__/addSheet.test.ts src/components/AddSheetRows.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The add sheet's list is worked out in one tested place, in the spec's order: the meal being built, eating as planned, the same as yesterday, saved meals, recent foods, then photo and barcode, or only the matches while searching; each food row adds with one tap and, once added, has a − / + with any count and a grams box

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 11: The ➕ add sheet, opened from the bar, the sidebar and the old Log address

**Files:**
- Create: `src/components/AddSheet.tsx`
- Modify: `src/components/TabBar.tsx`, `src/components/Sidebar.tsx`, `src/app/(tabs)/_layout.tsx` (the ➕ and the provider)
- Modify (whole file): `src/app/(tabs)/log.tsx`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: Tasks 9-10 (`basket.ts`, `addRows`, `FoodRow`, `ToolsRow`), `findFoods`, `recentFoodIds`, `slotStates`, `currentSlot`, `skippedOn`, `slotLabel`, `Ctx.menuOn`, `Ctx.editMenuMeal`, `Ctx.planFoods`, `Ctx.addMeal`, `Ctx.budget`, `FoodDetailSheet`, `CustomFoodForm`, `IconButton`.
- Produces: `type AddRequest = { date: ISODate; slotId?: string; lines?: PlanLine[]; mode?: 'log' | 'plan' }`, `useAddSheet(): { open(r: AddRequest): void }`, `AddSheetProvider({ children })`; i18n `add_plan_title`, `add_save_menu`, `add_menu_saved`, `add_replaces_plan`, `add_left_day`, `add_over_day`.

The sheet lives in one provider in the tabs layout, so the ➕ in the bar, the sidebar's Add food, Today's menu (Tasks 15 and 17) and any old link to `/log` all open the same sheet. It opens on the day Today is showing and on the slot asked for, else today's current slot, else the day's first open slot; slot chips change it. The line under the chips says what saving does to the slot and the day; when the slot holds only the meal the app filled in from the plan, it says that meal will be replaced (the store's `settleAuto` drops it when a real meal lands in its slot), instead of showing an over-budget warning for calories that will not count. In plan mode (a future day's "Change", Task 15) Save writes the basket as that slot's planned lines; opened on a date after today without a mode (the ➕ while Today shows next week), the sheet is in plan mode too, as the store logs nothing into the future (`addMealFromPlan` and `fillDayFromPlan` do nothing there, and `mealFromLines` gives no meal). The fast ways in (eat as planned, the same as yesterday, saved meals) and "Save as my meal" come in Task 12.

`log.tsx`'s adding part is gone (the sheet replaces it); its water and weight boxes are the tiles now, and its list of the day's meals is Today's menu. The route stays, so links and reminders that open `/log?date=…&slot=…` keep working: it opens the sheet for that day and slot and shows Today behind it.

- [ ] **Step 1: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  add_plan_title: 'Change the menu', add_save_menu: 'Save menu', add_menu_saved: 'Menu saved',
  add_replaces_plan: 'Replaces the planned meal ({kcal} kcal)', add_left_day: '{kcal} left for the day', add_over_day: '{kcal} over for the day',
```

Before the `};` that closes `mr`:

```ts
  add_plan_title: 'मेन्यू बदला', add_save_menu: 'मेन्यू जतन करा', add_menu_saved: 'मेन्यू जतन केला',
  add_replaces_plan: 'नियोजनावरून भरलेल्या जेवणाऐवजी ({kcal} kcal)', add_left_day: 'दिवसासाठी {kcal} बाकी', add_over_day: 'दिवसासाठी {kcal} जास्त',
```

Before the `};` that closes `hi`:

```ts
  add_plan_title: 'मेन्यू बदलें', add_save_menu: 'मेन्यू सहेजें', add_menu_saved: 'मेन्यू सहेजा',
  add_replaces_plan: 'प्लान से भरे खाने की जगह ({kcal} kcal)', add_left_day: 'दिन के लिए {kcal} बाकी', add_over_day: 'दिन के लिए {kcal} ज़्यादा',
```

- [ ] **Step 2: Create `src/components/AddSheet.tsx`**

```tsx
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addRows, type AddRow } from '../core/addSheet';
import { addLine, basketFromLines, basketMeal, basketTotals, lineOf, linesFromBasket, putLine, setCount, setGrams, slotPreview, stepCount, type BasketLine } from '../core/basket';
import { addDays } from '../core/date';
import { findFoods, recentFoodIds } from '../core/foods';
import { newId } from '../core/id';
import { skippedOn } from '../core/menu';
import { currentSlot, slotStates } from '../core/pattern';
import { slotLabel, type PlanLine } from '../core/routine';
import type { FoodItem, ISODate } from '../core/types';
import type { PlanMeal } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Btn, Empty, Field, Micro, Pill } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';
import { FoodRow, ToolsRow } from './AddSheetRows';
import { CustomFoodForm } from './CustomFoodForm';
import { FoodDetailSheet } from './FoodDetailSheet';
import { IconButton } from './TopBarActions';

/**
 * What the add sheet is opened for: a date and a slot, the foods to start
 * with ("Change" puts a meal's planned foods in), and whether saving logs a
 * meal or changes that date's menu.
 */
export type AddRequest = { date: ISODate; slotId?: string; lines?: PlanLine[]; mode?: 'log' | 'plan' };

type AddSheetApi = { open: (r: AddRequest) => void };
const AddCtx = createContext<AddSheetApi | null>(null);

/** Opens the add sheet from anywhere under the tabs: the ➕, Today's menu, the old /log address. */
export function useAddSheet(): AddSheetApi {
  const c = useContext(AddCtx);
  if (!c) throw new Error('useAddSheet must be used inside AddSheetProvider');
  return c;
}

/** Holds the one add sheet. Each opening starts it fresh. */
export function AddSheetProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<(AddRequest & { n: number }) | null>(null);
  const api = useMemo<AddSheetApi>(() => ({ open: (r) => setRequest((p) => ({ ...r, n: (p?.n ?? 0) + 1 })) }), []);
  return (
    <AddCtx.Provider value={api}>
      {children}
      {request ? <AddSheet key={request.n} request={request} onClose={() => setRequest(null)} /> : null}
    </AddCtx.Provider>
  );
}

/**
 * The ➕ sheet: anything eaten that is not ticked off the menu, for the date
 * and slot being looked at. Search sits at the top so its matches stay above
 * the keyboard; under it the fast ways in, then any food with a − / + and a
 * grams box, and a bar with "N items · X kcal" and Save. Every meal goes
 * through the store's addMeal with calories from the database. Opened in
 * plan mode, Save changes that date's menu instead.
 */
function AddSheet({ request, onClose }: { request: AddRequest; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'mobile';
  const minute = useMinute();
  const { state, today, targets } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  // Nothing is logged into the future (the store refuses it): opened on a later date, the sheet changes that date's menu.
  const mode = request.mode ?? (request.date > today ? 'plan' : 'log');
  const date = request.date;
  const isToday = date === today;
  const foods = app.planFoods;

  const [query, setQuery] = useState('');
  // Typing stays quick: the search runs on the deferred text.
  const deferred = useDeferredValue(query);
  const results = useMemo(() => findFoods(app.foods, deferred), [app.foods, deferred]);
  const [basket, setBasket] = useState<BasketLine[]>(() => basketFromLines(request.lines ?? [], app.planFoods));
  const [detail, setDetail] = useState<FoodItem | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  // The slot: the one asked for; else, today, the one whose turn it is; else the day's first still open.
  const menu = app.menuOn(date);
  const dayMeals = state.meals.filter((m) => m.date === date);
  const states = slotStates({ routine: state.routine, target: targets.kcal, meals: dayMeals, nowMinutes: isToday ? minute : 1440, skippedSlots: skippedOn(state.slotSkips, date) });
  const [slotId, setSlotId] = useState<string | undefined>(
    () => request.slotId ?? (isToday ? currentSlot(states, minute)?.slot.id : states.find((s) => s.status !== 'done' && !s.skipped)?.slot.id),
  );
  const slot: PlanMeal | undefined = menu.meals.find((m) => m.id === slotId) ?? menu.meals[0];
  const slotName = (m: Pick<PlanMeal, 'id' | 'type'>) => {
    const s = state.routine.slots.find((x) => x.id === m.id);
    return (s && slotLabel(s, lang)) || t(m.type);
  };

  const totals = basketTotals(basket, foods);
  // What saving does to the slot and the day. A slot holding only the meal filled in from the plan gets that meal replaced.
  const st = slot ? states.find((s) => s.slot.id === slot.id) : undefined;
  const autoKcal = st ? st.meals.filter((m) => m.source === 'auto').reduce((a, m) => a + m.kcal, 0) : 0;
  const dayLeft = isToday ? app.budget.remaining : targets.kcal - dayMeals.reduce((a, m) => a + m.kcal, 0);
  const preview = mode === 'log' && st ? slotPreview({ allowance: st.allowance, eaten: st.eaten, autoKcal, basketKcal: totals.kcal, dayLeft }) : null;
  const previewText =
    preview && slot
      ? [
          preview.replaces
            ? fill(t('add_replaces_plan'), { kcal: autoKcal })
            : fill(t(preview.slotLeft >= 0 ? 'log_left_for' : 'log_over_for'), { kcal: Math.abs(preview.slotLeft), slot: slotName(slot) }),
          fill(t(preview.dayLeft >= 0 ? (isToday ? 'log_left_today' : 'add_left_day') : isToday ? 'log_over_today' : 'add_over_day'), { kcal: Math.abs(preview.dayLeft) }),
        ].join(' · ')
      : '';
  const previewColor = !preview ? C.textDim : preview.dayLeft < 0 ? C.red : !preview.replaces && preview.slotLeft < 0 ? C.amber : C.textDim;

  const recents = useMemo(() => recentFoodIds(state.meals, addDays(today, -30), 8), [state.meals, today]);
  const rows = addRows({ mode, query: deferred, results: results.map((f) => f.id), basket, planned: false, yesterday: false, saved: [], recents });
  const editing = detail ? basket.find((b) => b.foodId === detail.id) ?? null : null;

  function addFood(food: FoodItem) {
    fb.haptic('light');
    setBasket((b) => addLine(b, lineOf(food)));
  }

  function step(foodId: string, by: 1 | -1) {
    setBasket((b) => {
      const l = b.find((x) => x.foodId === foodId);
      return l ? setCount(b, foodId, stepCount(l.count, l.unit, by)) : b;
    });
  }

  function save() {
    if (!slot) return;
    if (mode === 'plan') {
      app.editMenuMeal(menu, { ...slot, lines: linesFromBasket(basket, foods) });
      fb.haptic('success');
      fb.notify(t('add_menu_saved'));
      onClose();
      return;
    }
    const meal = basketMeal({ id: newId(), date, slot, basket, foods, now: new Date() });
    if (!meal) return;
    app.addMeal(meal);
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: meal.kcal }));
    onClose();
  }

  function renderRow({ item }: { item: AddRow }) {
    switch (item.kind) {
      case 'head':
        return (
          <View style={{ paddingTop: 14, paddingBottom: 2 }}>
            <Micro>{t(item.titleKey)}</Micro>
          </View>
        );
      case 'basket':
      case 'food': {
        const food = foods.find((f) => f.id === item.foodId);
        if (!food) return null;
        return (
          <FoodRow
            food={food}
            line={basket.find((b) => b.foodId === food.id)}
            lang={lang}
            onAdd={() => addFood(food)}
            onStep={(by) => step(food.id, by)}
            onGrams={(g) => setBasket((b) => setGrams(b, food.id, g))}
            onOpen={() => setDetail(food)}
          />
        );
      }
      case 'tools':
        return (
          <ToolsRow
            lang={lang}
            onPhoto={() => {
              onClose();
              router.push('/photo');
            }}
            onBarcode={() => {
              onClose();
              router.push('/scan');
            }}
            onCustom={() => setCustomOpen(true)}
          />
        );
      case 'empty':
        return (
          <View style={{ gap: 10 }}>
            <Empty text={t('no_results')} />
            <Btn small tone="soft" label={fill(t('add_as_custom'), { q: query.trim() })} onPress={() => setCustomOpen(true)} />
          </View>
        );
      default:
        return null;
    }
  }

  const top = (
    <View style={{ gap: 8, paddingBottom: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: S.padLg }}>
        {menu.meals.map((m) => (
          <Pill key={m.id} label={`${slotName(m)} ${m.time}`} active={slot?.id === m.id} onPress={() => setSlotId(m.id)} />
        ))}
      </ScrollView>
      {previewText ? <Text style={{ color: previewColor, fontSize: F.small, lineHeight: lh(F.small), paddingHorizontal: S.padLg }}>{previewText}</Text> : null}
      <View style={{ paddingHorizontal: S.padLg }}>
        <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} accessibilityLabel={t('search_food')} />
      </View>
    </View>
  );

  const listAndBar = (
    <>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: S.padLg, paddingBottom: S.padLg }}
        ListFooterComponent={
          customOpen ? (
            <CustomFoodForm
              initialName={query}
              onSaved={(f) => {
                setCustomOpen(false);
                addFood(f);
                setQuery('');
              }}
              onCancel={() => setCustomOpen(false)}
            />
          ) : null
        }
      />
      {basket.length > 0 || mode === 'plan' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.padLg, paddingVertical: 12, borderTopWidth: S.hairline, borderTopColor: C.border, backgroundColor: C.bgAlt }}>
          <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
            {fill(t(totals.items === 1 ? 'add_bar_one' : 'add_bar'), { n: totals.items, kcal: totals.kcal })}
          </Text>
          <Btn label={mode === 'plan' ? t('add_save_menu') : t('save')} onPress={save} style={{ minWidth: 120 }} />
        </View>
      ) : null}
    </>
  );

  return (
    <Modal visible transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        {/* The dimmed page behind closes the sheet on a tap; screen readers close it with their escape gesture or Back. */}
        <Pressable onPress={onClose} accessible={false} style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim }]} />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={{
            width: '100%',
            maxWidth: wide ? 560 : undefined,
            height: wide ? '86%' : '92%',
            backgroundColor: C.card,
            borderWidth: S.hairline,
            borderColor: C.borderStrong,
            borderTopLeftRadius: S.radius + 4,
            borderTopRightRadius: S.radius + 4,
            borderBottomLeftRadius: wide ? S.radius + 4 : 0,
            borderBottomRightRadius: wide ? S.radius + 4 : 0,
            paddingBottom: wide ? 0 : insets.bottom,
            overflow: 'hidden',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: S.padLg, paddingRight: 8, paddingTop: 8 }}>
            <Text accessibilityRole="header" style={{ flex: 1, color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
              {mode === 'plan' ? t('add_plan_title') : t('add_food')}
            </Text>
            <IconButton name="close" label={t('close')} onPress={onClose} />
          </View>
          {top}
          {listAndBar}
        </View>
      </View>
      <FoodDetailSheet
        food={detail}
        initial={editing ? { unit: editing.unit, gramsPerUnit: editing.gramsPerUnit, count: editing.count } : null}
        onAdd={(c) => {
          fb.haptic('light');
          // From a food already in the meal, the sheet's Done sets its line; from a new one it adds a line.
          setBasket((b) => putLine(b, { foodId: c.food.id, unit: c.unit, gramsPerUnit: c.gramsPerUnit, count: c.count }));
          setDetail(null);
          setQuery('');
        }}
        onClose={() => setDetail(null)}
      />
    </Modal>
  );
}
```

- [ ] **Step 3: The ➕ opens the sheet**

`src/components/TabBar.tsx`: delete the line `import { useRouter } from 'expo-router';`, add after the `../core/bar` import:

```ts
import { useAddSheet } from './AddSheet';
```

replace `  const router = useRouter();` with `  const addSheet = useAddSheet();`, and replace

```ts
  function add() {
    const date = viewedDate(state.routes);
    router.push(date ? { pathname: '/log', params: { date } } : '/log');
  }
```

with

```ts
  function add() {
    addSheet.open({ date: viewedDate(state.routes) ?? app.today });
  }
```

`src/components/Sidebar.tsx`: add after the `../core/bar` import:

```ts
import { useAddSheet } from './AddSheet';
```

replace `  const { state } = useApp();` with:

```ts
  const { state, today } = useApp();
  const addSheet = useAddSheet();
```

and replace

```ts
  function add() {
    router.push(viewed ? { pathname: '/log', params: { date: viewed } } : '/log');
  }
```

with

```ts
  function add() {
    addSheet.open({ date: viewed ?? today });
  }
```

`src/app/(tabs)/_layout.tsx`: after `import { NudgeToast } from '../../components/NudgeToast';` add `import { AddSheetProvider } from '../../components/AddSheet';`, then wrap the returned tree: replace

```tsx
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
```

with

```tsx
  return (
    // One add sheet for the whole tab area: the ➕, the sidebar, Today's menu and the /log address all open it.
    <AddSheetProvider>
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
```

and the last lines of the component

```tsx
        <NudgeToast />
      </View>
    </View>
  );
}
```

with

```tsx
        <NudgeToast />
      </View>
    </View>
    </AddSheetProvider>
  );
}
```

(`npx expo lint` does not reformat; indent the inner block one level if you like, it is not required.)

- [ ] **Step 4: Replace the whole of `src/app/(tabs)/log.tsx`**

```tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useAddSheet } from '../../components/AddSheet';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';

/**
 * The old Log address. Adding food happens in the ➕ sheet now, so a link to
 * /log (the coach line, a reminder, an older screen) opens that sheet for the
 * day and slot it names, with Today showing that day behind it.
 */
export default function LogRoute() {
  const app = useApp();
  const router = useRouter();
  const addSheet = useAddSheet();
  const { date, slot } = useLocalSearchParams<{ date?: string; slot?: string }>();
  const today = app.today;
  const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const slotId = typeof slot === 'string' ? slot : undefined;
  useFocusEffect(
    useCallback(() => {
      addSheet.open({ date: day, slotId });
      router.replace(day === today ? '/' : { pathname: '/', params: { date: day } });
    }, [addSheet, router, day, slotId, today]),
  );
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}
```

- [ ] **Step 5: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests (the sheet lays out `basket.ts` and `addSheet.ts`, tested in Tasks 9 and 10).

```bash
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|hitSlop|Ionicons" src/components/AddSheet.tsx "src/app/(tabs)/log.tsx"
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/AddSheet.tsx "src/app/(tabs)/log.tsx"
grep -rn "router.push('/log')\|pathname: '/log'" src/components/TabBar.tsx src/components/Sidebar.tsx
```

Expected: all three print nothing. (Other screens still link to `/log`; that address now opens the sheet.)

- [ ] **Step 6: Commit**

```bash
git add src/components/AddSheet.tsx src/components/TabBar.tsx src/components/Sidebar.tsx "src/app/(tabs)/_layout.tsx" "src/app/(tabs)/log.tsx" src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The ➕ opens one add sheet for the day Today is showing and the slot whose turn it is: search at the top with only close matches, recent foods, any amount with − / + or grams, "N items · X kcal" and Save, calories from the database; the line under the slot says when the meal replaces the one filled in from the plan instead of warning about calories that will not count; old links to Log open the same sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: The fast ways in: eat as planned, the same as yesterday, saved meals, and "Save as my meal"

**Files:**
- Modify: `src/components/AddSheetRows.tsx` (imports; append `PlannedCard`, `OneTapRow`, `SaveAsOffer`)
- Modify: `src/components/AddSheet.tsx` (imports; one state; the `rows` line; three functions; `renderRow`'s `default`; `save`'s log branch; the body)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `Ctx.addMealFromPlan`, `Ctx.addSavedMeal`, `Ctx.removeMeal`, `mealFromLines` (`menu.ts`), `itemsMeal`, `basketFromLines`, `linesFromBasket`, `formatQty` (Task 9), `lineInfo`, `foodName`, `itemName`, `state.savedMeals`.
- Produces: `PlannedCard({ title, summary, kcal, lang, onAte, onChange })`, `OneTapRow({ icon, title, sub, label, onPress })`, `SaveAsOffer({ lang, onSave, onSkip })`; i18n `add_eat_planned`, `add_same_yesterday`, `add_log_saved`, `add_save_as_title`, `add_save_as_body`, `add_meal_name`, `add_meal_name_hint`, `add_not_now`, `add_saved_meal`, `menu_ate_planned`, `menu_change`.

Eat as planned is offered while the slot has planned foods and no meal logged by hand, on today or an earlier date only; it logs through the store's `addMealFromPlan` (database calories, on the date shown) and replaces a filled-in copy. Undo on a meal just logged takes it away through `removeMeal`; once that slot's moment to be filled in from the plan has passed, the store then marks the slot skipped (so the app does not fill it straight back), and the day's menu shows it skipped with its own Undo. The same as yesterday logs yesterday's meals in that slot again, as a meal typed by hand. A saved meal logs in one tap with Undo; in plan mode it goes into the basket instead. After a logged meal of two or more foods, the sheet offers to save it under a name.

- [ ] **Step 1: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  add_eat_planned: 'Eat as planned · {slot}', add_same_yesterday: '{slot} same as yesterday', add_log_saved: 'Log {name}',
  add_save_as_title: 'Save as my meal?', add_save_as_body: 'Next time it is one tap.', add_meal_name: 'Name', add_meal_name_hint: 'e.g. My usual thali',
  add_not_now: 'Not now', add_saved_meal: 'Saved to your meals',
  menu_ate_planned: 'Ate as planned', menu_change: 'Change',
```

Before the `};` that closes `mr`:

```ts
  add_eat_planned: 'नियोजनाप्रमाणे · {slot}', add_same_yesterday: 'कालसारखाच {slot}', add_log_saved: '{name} नोंदवा',
  add_save_as_title: 'माझं जेवण म्हणून जतन करायचं?', add_save_as_body: 'पुढच्या वेळी एका टॅपमध्ये नोंद होईल.', add_meal_name: 'नाव', add_meal_name_hint: 'उदा. माझं नेहमीचं ताट',
  add_not_now: 'आत्ता नको', add_saved_meal: 'तुमच्या जेवणांत जतन केलं',
  menu_ate_planned: 'ठरवल्याप्रमाणे खाल्लं', menu_change: 'बदला',
```

Before the `};` that closes `hi`:

```ts
  add_eat_planned: 'प्लान के मुताबिक़ · {slot}', add_same_yesterday: 'कल जैसा {slot}', add_log_saved: '{name} दर्ज करें',
  add_save_as_title: 'मेरे खाने के रूप में सहेजें?', add_save_as_body: 'अगली बार एक टैप में दर्ज होगा.', add_meal_name: 'नाम', add_meal_name_hint: 'जैसे मेरी रोज़ की थाली',
  add_not_now: 'अभी नहीं', add_saved_meal: 'आपके खानों में सहेजा',
  menu_ate_planned: 'प्लान के मुताबिक़ खाया', menu_change: 'बदलें',
```

- [ ] **Step 2: The rows, in `src/components/AddSheetRows.tsx`**

Replace `import { Btn, Row } from '../ui/components';` with `import { Btn, Field, Row } from '../ui/components';`, and append:

```tsx
/** The slot as planned, highlighted: its foods and calories, Ate as planned, and Change to put them in the meal to adjust. */
export function PlannedCard({ title, summary, kcal, lang, onAte, onChange }: { title: string; summary: string; kcal: number; lang: Lang; onAte: () => void; onChange: () => void }) {
  const t = makeT(lang);
  return (
    <View style={{ marginTop: 10, padding: 14, gap: 10, borderRadius: S.radiusSm, borderWidth: 1, borderColor: C.accent, backgroundColor: C.accentDim }}>
      <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{title}</Text>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{`${summary} · ${kcal} kcal`}</Text>
      <Row style={{ gap: 8 }}>
        <Btn small label={t('menu_ate_planned')} onPress={onAte} style={{ flex: 1 }} />
        <Btn small tone="ghost" label={t('menu_change')} onPress={onChange} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

/** One row that logs in one tap: the same as yesterday, or a saved meal. */
export function OneTapRow({ icon, title, sub, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={C.accentText} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>
          {sub}
        </Text>
      </View>
      <Ionicons name="add-circle-outline" size={22} color={C.accentText} />
    </Pressable>
  );
}

/** After a logged meal of two or more foods: keep it as one of the person's meals, under a name they choose. */
export function SaveAsOffer({ lang, onSave, onSkip }: { lang: Lang; onSave: (name: string) => void; onSkip: () => void }) {
  const t = makeT(lang);
  const [name, setName] = useState('');
  return (
    <View style={{ padding: S.padLg, gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
        {t('add_save_as_title')}
      </Text>
      <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body) }}>{t('add_save_as_body')}</Text>
      <Field label={t('add_meal_name')} value={name} onChangeText={setName} placeholder={t('add_meal_name_hint')} autoFocus />
      <Row style={{ gap: 8 }}>
        <Btn label={t('save')} onPress={() => onSave(name.trim())} disabled={!name.trim()} style={{ flex: 1 }} />
        <Btn tone="ghost" label={t('add_not_now')} onPress={onSkip} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}
```

- [ ] **Step 3: The sheet uses them, in `src/components/AddSheet.tsx`**

Imports: replace the `../core/basket` import with

```ts
import { addLine, basketFromLines, basketMeal, basketTotals, formatQty, itemsMeal, lineOf, linesFromBasket, putLine, setCount, setGrams, slotPreview, stepCount, type BasketLine } from '../core/basket';
```

`import { findFoods, recentFoodIds } from '../core/foods';` with `import { findFoods, foodName, itemName, recentFoodIds } from '../core/foods';`, `import { skippedOn } from '../core/menu';` with `import { mealFromLines, skippedOn } from '../core/menu';`, `import type { FoodItem, ISODate } from '../core/types';` with `import type { FoodItem, ISODate, SavedMeal } from '../core/types';`, `import type { PlanMeal } from '../core/weekPlan';` with `import { lineInfo, type PlanMeal } from '../core/weekPlan';`, and `import { FoodRow, ToolsRow } from './AddSheetRows';` with `import { FoodRow, OneTapRow, PlannedCard, SaveAsOffer, ToolsRow } from './AddSheetRows';`.

After `  const [customOpen, setCustomOpen] = useState(false);` add:

```tsx
  // After a logged meal of two or more foods: its lines, offered as a saved meal.
  const [offer, setOffer] = useState<PlanLine[] | null>(null);
```

Replace the line

```tsx
  const rows = addRows({ mode, query: deferred, results: results.map((f) => f.id), basket, planned: false, yesterday: false, saved: [], recents });
```

with

```tsx
  // The fast ways in: the slot as planned (while nothing typed by hand is in it), the same slot yesterday, and saved meals.
  // Never on a date after today: the store logs nothing into the future, and a toast must not say it did.
  const planned = mode === 'log' && date <= today && !!slot && slot.lines.length > 0 && !(st?.meals.some((m) => m.source !== 'auto') ?? false);
  const yesterdayMeals = slot ? state.meals.filter((m) => m.date === addDays(date, -1) && (m.slotId === slot.id || (!m.slotId && m.type === slot.type))) : [];
  const saved = state.savedMeals;
  const rows = addRows({ mode, query: deferred, results: results.map((f) => f.id), basket, planned, yesterday: mode === 'log' && yesterdayMeals.length > 0, saved: saved.map((s) => s.id), recents });
  const linesKcal = (lines: PlanLine[]) => lines.reduce((a, l) => a + (lineInfo(l, foods)?.kcal ?? 0), 0);
  const summary = (lines: PlanLine[]) =>
    lines
      .flatMap((l) => {
        const info = lineInfo(l, foods, lang);
        return info ? [`${foodName(info.food, lang)} ${formatQty(l.qty)}`] : [];
      })
      .join(' · ');
```

After the `step` function add:

```tsx
  function atePlanned() {
    if (!slot) return;
    app.addMealFromPlan(date, slot.id);
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: linesKcal(slot.lines) }));
    onClose();
  }

  function repeatYesterday() {
    if (!slot) return;
    const meal = itemsMeal({ id: newId(), date, slot, items: yesterdayMeals.flatMap((m) => m.items), now: new Date() });
    if (!meal) return;
    app.addMeal(meal);
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: meal.kcal }), { label: t('undo'), onPress: () => app.removeMeal(meal.id) });
    onClose();
  }

  function logSaved(s: SavedMeal) {
    if (!slot) return;
    if (mode === 'plan') {
      fb.haptic('light');
      setBasket((b) => basketFromLines(s.lines, foods).reduce((acc, l) => addLine(acc, l), b));
      return;
    }
    const meal = mealFromLines({ id: newId(), date, slot, lines: s.lines, foods, source: 'manual', now: new Date() });
    if (!meal) return;
    app.addMeal(meal);
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: meal.kcal }), { label: t('undo'), onPress: () => app.removeMeal(meal.id) });
    onClose();
  }
```

In `save()`, replace the last three lines of the log branch

```tsx
    fb.notify(fill(t('toast_meal_saved'), { kcal: meal.kcal }));
    onClose();
  }
```

with

```tsx
    fb.notify(fill(t('toast_meal_saved'), { kcal: meal.kcal }));
    // A meal of two or more foods may be one the person eats often: offer to keep it for one-tap logging.
    if (basket.length >= 2) setOffer(linesFromBasket(basket, foods));
    else onClose();
  }
```

In `renderRow`, replace

```tsx
      default:
        return null;
```

with

```tsx
      case 'planned':
        return slot ? (
          <PlannedCard
            title={fill(t('add_eat_planned'), { slot: slotName(slot) })}
            summary={summary(slot.lines)}
            kcal={linesKcal(slot.lines)}
            lang={lang}
            onAte={atePlanned}
            onChange={() => setBasket(basketFromLines(slot.lines, foods))}
          />
        ) : null;
      case 'yesterday': {
        if (!slot) return null;
        const title = fill(t('add_same_yesterday'), { slot: slotName(slot) });
        const items = yesterdayMeals.flatMap((m) => m.items);
        return (
          <OneTapRow
            icon="refresh"
            title={title}
            sub={`${items.map((it) => itemName(it, foods, lang)).join(', ')} · ${yesterdayMeals.reduce((a, m) => a + m.kcal, 0)} kcal`}
            label={title}
            onPress={repeatYesterday}
          />
        );
      }
      case 'saved': {
        const s = saved.find((x) => x.id === item.savedId);
        if (!s) return null;
        return (
          <OneTapRow
            icon="bookmark-outline"
            title={s.name}
            sub={fill(t(s.lines.length === 1 ? 'add_bar_one' : 'add_bar'), { n: s.lines.length, kcal: linesKcal(s.lines) })}
            label={fill(t('add_log_saved'), { name: s.name })}
            onPress={() => logSaved(s)}
          />
        );
      }
      default:
        return null;
```

In the returned body, replace

```tsx
          {top}
          {listAndBar}
```

with

```tsx
          {offer ? null : top}
          {offer ? (
            <SaveAsOffer
              lang={lang}
              onSave={(name) => {
                app.addSavedMeal(name, offer);
                fb.notify(t('add_saved_meal'));
                onClose();
              }}
              onSkip={onClose}
            />
          ) : (
            listAndBar
          )}
```

- [ ] **Step 4: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests (the pieces are `addRows`, `itemsMeal`, `mealFromLines` and `linesFromBasket`, tested in Tasks 9-10 and Plan 1).

```bash
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|hitSlop" src/components/AddSheet.tsx src/components/AddSheetRows.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/AddSheet.tsx src/components/AddSheetRows.tsx
```

Expected: both print nothing.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddSheet.tsx src/components/AddSheetRows.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The add sheet's fast ways in: the slot's planned meal, highlighted, logs in one tap with database calories or goes into the meal to change; the same slot yesterday logs again in one tap; saved meals log in one tap with Undo; and after a meal of two or more foods the sheet offers to save it under the person's own name

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 13: The day's menu, row by row

**Files:**
- Create: `src/core/dayView.ts`, `src/core/__tests__/dayView.test.ts`

**Interfaces:**
- Consumes: `menuSlots`, `DayMenu` (`menu.ts`), `slotOf` (`pattern.ts`), `lineInfo` (`weekPlan.ts`), `foodName` (`foods.ts`), `formatQty` (Task 9).
- Produces: `type DayMode = 'past' | 'today' | 'future'`, `dayMode(date, today): DayMode`, `type RowState = 'done' | 'skipped' | 'current' | 'open' | 'later' | 'plan'`, `type RowLine = { idx; foodId; name; qty; qtyText; unit; grams; kcal; protein }`, `type MenuRow = { slotId; type; time; lines: RowLine[]; plannedKcal; meals: Meal[]; eatenKcal; state: RowState; autoIds: string[] }`, `type DayView = { mode; rows; required; settled; missing; plannedKcal; plannedProtein; eatenKcal; eatenProtein; autoIds; canFill }`, `dayView(input: { date; today; menu: DayMenu; meals: Meal[]; skippedIds: string[]; currentId: string | null; foods: FoodItem[]; lang: Lang }): DayView`.

The rules, from the spec's "The day's menu": a slot that holds a meal is done (a meal the app filled in is done too, with its id in `autoIds` for the "from plan" mark); a skipped slot is skipped; a future day's slots are all plan. Today, the current slot is the first slot still open at or after the slot whose turn it is (`currentId`, from `currentSlot` on the pattern), so once lunch is filled in, the snack is current; slots before it that are still open are open (to fill in), and the rest are later. On a past day every slot not settled is open. `required` counts the slots with something planned, and only those count as missing, as in `dayRecord`. A past day with nothing logged and nothing skipped can be filled from the plan in one go. `idx` is the line's place in the menu meal, so − / + edits the right line.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/dayView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { dayMode, dayView } from '../dayView';
import type { DayMenu } from '../menu';
import type { FoodItem, Meal } from '../types';
import { lineInfo } from '../weekPlan';

const foods = foodsJson as unknown as FoodItem[];
const TODAY = '2026-10-27';
const menu = (date: string): DayMenu => ({
  date,
  editedAt: '',
  meals: [
    { id: 'breakfast', type: 'breakfast', time: '08:30', lines: [{ foodId: 'poha', unit: 'katori', qty: 1 }] },
    { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }, { foodId: 'moong-dal', unit: 'katori', qty: 0.5 }] },
    { id: 'snack', type: 'snack', time: '16:00', lines: [] },
    { id: 'dinner', type: 'dinner', time: '20:30', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
  ],
});
const meal = (date: string, slotId: string | undefined, type: Meal['type'], hhmm: string, kcal: number, source?: Meal['source']): Meal => ({
  id: `${date}-${slotId ?? type}`,
  at: new Date(`${date}T${hhmm}:00`).toISOString(),
  date,
  type,
  slotId,
  items: [],
  kcal,
  protein: 10,
  source,
});
const view = (date: string, meals: Meal[], extra: Partial<Parameters<typeof dayView>[0]> = {}) =>
  dayView({ date, today: TODAY, menu: menu(date), meals, skippedIds: [], currentId: null, foods, lang: 'en', ...extra });
const states = (v: ReturnType<typeof dayView>) => v.rows.map((r) => r.state);

describe('dayMode', () => {
  it('is past, today or future', () => {
    expect([dayMode('2026-10-26', TODAY), dayMode(TODAY, TODAY), dayMode('2026-10-28', TODAY)]).toEqual(['past', 'today', 'future']);
  });
});

describe('today', () => {
  it('ticks what was eaten, opens the slot whose turn it is, and keeps the rest for later', () => {
    expect(states(view(TODAY, [meal(TODAY, 'breakfast', 'breakfast', '08:40', 300)], { currentId: 'lunch' }))).toEqual(['done', 'current', 'later', 'later']);
  });

  it('before any slot has opened, the first meal still to eat is the current one', () => {
    expect(states(view(TODAY, []))).toEqual(['current', 'later', 'later', 'later']);
  });

  it('a slot passed with nothing in it is open to fill in, before the current one', () => {
    expect(states(view(TODAY, [], { currentId: 'lunch' }))).toEqual(['open', 'current', 'later', 'later']);
  });

  it('a slot the app filled in is done with its from-plan mark, and the next slot becomes current', () => {
    const v = view(TODAY, [meal(TODAY, 'breakfast', 'breakfast', '08:40', 300), meal(TODAY, 'lunch', 'lunch', '13:00', 420, 'auto')], { currentId: 'lunch' });
    expect(states(v)).toEqual(['done', 'done', 'current', 'later']);
    expect(v.rows[1].autoIds).toEqual(['2026-10-27-lunch']);
    expect(v.autoIds).toEqual(['2026-10-27-lunch']);
  });
});

describe('a past day', () => {
  it('counts the planned meals eaten or skipped, and says how many are missing', () => {
    const d = '2026-10-25';
    const v = view(d, [meal(d, 'breakfast', 'breakfast', '08:40', 300)], { skippedIds: ['lunch'] });
    expect(states(v)).toEqual(['done', 'skipped', 'open', 'open']);
    expect([v.required, v.settled, v.missing, v.canFill]).toEqual([3, 2, 1, false]);
  });

  it('an empty day can be filled from the plan in one go', () => {
    const v = view('2026-10-20', []);
    expect([v.missing, v.canFill, v.eatenKcal]).toEqual([3, true, 0]);
  });

  it('a meal logged without a slot lands in the slot of its kind nearest its time', () => {
    const d = '2026-10-25';
    expect(view(d, [meal(d, undefined, 'dinner', '20:45', 500)]).rows[3].state).toBe('done');
  });
});

describe('a future day', () => {
  it("is all plan, its lines in the person's language with calories from the database", () => {
    const v = view('2026-10-29', []);
    expect(states(v)).toEqual(['plan', 'plan', 'plan', 'plan']);
    expect(v.rows[1].lines.map((l) => [l.idx, l.foodId, l.qtyText])).toEqual([
      [0, 'chapati', '2'],
      [1, 'moong-dal', '½'],
    ]);
    const kcal = (foodId: string, unit: string, qty: number) => lineInfo({ foodId, unit, qty }, foods)!.kcal;
    expect(v.plannedKcal).toBe(kcal('poha', 'katori', 1) + kcal('chapati', 'piece', 2) + kcal('moong-dal', 'katori', 0.5) + kcal('chapati', 'piece', 2));
    const hi = dayView({ date: '2026-10-29', today: TODAY, menu: menu('2026-10-29'), meals: [], skippedIds: [], currentId: null, foods, lang: 'hi' });
    expect(hi.rows[1].lines[0].name).toBe(foods.find((f) => f.id === 'chapati')!.name_hi);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/dayView.test.ts`
Expected: FAIL: `Failed to resolve import "../dayView"`.

- [ ] **Step 3: Create `src/core/dayView.ts`**

```ts
import { formatQty } from './basket';
import { foodName } from './foods';
import { menuSlots, type DayMenu } from './menu';
import { slotOf } from './pattern';
import type { FoodItem, ISODate, Lang, Meal, MealType } from './types';
import { lineInfo } from './weekPlan';

/**
 * The day's menu as Today shows it, one row per slot of that date's menu.
 * A slot holding a meal is done (one the app filled in too, marked by its
 * id until confirmed); a skipped slot is skipped; a future day is all plan.
 * Today, the current slot is the first one still open at or after the slot
 * whose turn it is, open slots before it can still be filled in, and the rest
 * are later. On a past day every slot not settled is open. Only slots with
 * something planned count as missing, as in the record. Pure.
 */
export type DayMode = 'past' | 'today' | 'future';
export type RowState = 'done' | 'skipped' | 'current' | 'open' | 'later' | 'plan';
/** One planned food: `idx` is its place in the menu meal, so − / + edits the right line. */
export type RowLine = { idx: number; foodId: string; name: string; qty: number; qtyText: string; unit: string; grams: number; kcal: number; protein: number };
export type MenuRow = {
  slotId: string;
  type: MealType;
  time: string;
  lines: RowLine[];
  plannedKcal: number;
  /** The meals eaten in this slot on the date. */
  meals: Meal[];
  eatenKcal: number;
  state: RowState;
  /** Meals here the app filled in from the plan and nobody confirmed yet. */
  autoIds: string[];
};
export type DayView = {
  mode: DayMode;
  rows: MenuRow[];
  /** Slots with something planned. */
  required: number;
  /** Of those, the ones eaten or skipped. */
  settled: number;
  /** A past day's planned slots still open; 0 on other days. */
  missing: number;
  plannedKcal: number;
  plannedProtein: number;
  eatenKcal: number;
  eatenProtein: number;
  autoIds: string[];
  /** A past day with nothing logged or skipped: "Fill this day from plan". */
  canFill: boolean;
};

export function dayMode(date: ISODate, today: ISODate): DayMode {
  return date < today ? 'past' : date > today ? 'future' : 'today';
}

export function dayView(input: {
  date: ISODate;
  today: ISODate;
  menu: DayMenu;
  meals: Meal[];
  /** Slot ids skipped on the date. */
  skippedIds: string[];
  /** Today: the slot whose turn it is, from the pattern; null on other days. */
  currentId: string | null;
  foods: FoodItem[];
  lang: Lang;
}): DayView {
  const mode = dayMode(input.date, input.today);
  const slots = menuSlots(input.menu);
  const dayMeals = input.meals.filter((m) => m.date === input.date);
  const bySlot = new Map<string, Meal[]>(slots.map((s) => [s.id, []]));
  for (const m of dayMeals) {
    const s = slotOf(m, slots);
    if (s) bySlot.get(s.id)?.push(m);
  }
  const skipped = new Set(input.skippedIds);
  const rows: MenuRow[] = slots.map((s) => {
    const lines: RowLine[] = [];
    s.meal.lines.forEach((line, idx) => {
      const info = lineInfo(line, input.foods, input.lang);
      if (info) lines.push({ idx, foodId: line.foodId, name: foodName(info.food, input.lang), qty: line.qty, qtyText: formatQty(line.qty), unit: info.unit, grams: info.grams, kcal: info.kcal, protein: info.protein });
    });
    const meals = bySlot.get(s.id) ?? [];
    const state: RowState = mode === 'future' ? 'plan' : meals.length > 0 ? 'done' : skipped.has(s.id) ? 'skipped' : 'open';
    return {
      slotId: s.id,
      type: s.type,
      time: s.meal.time,
      lines,
      plannedKcal: lines.reduce((a, l) => a + l.kcal, 0),
      meals,
      eatenKcal: meals.reduce((a, m) => a + m.kcal, 0),
      state,
      autoIds: meals.filter((m) => m.source === 'auto').map((m) => m.id),
    };
  });
  if (mode === 'today') {
    const from = Math.max(0, rows.findIndex((r) => r.slotId === input.currentId));
    const cur = rows.findIndex((r, i) => i >= from && r.state === 'open');
    rows.forEach((r, i) => {
      if (r.state === 'open' && cur >= 0 && i >= cur) r.state = i === cur ? 'current' : 'later';
    });
  }
  const required = rows.filter((r) => r.lines.length > 0);
  const settled = required.filter((r) => r.state === 'done' || r.state === 'skipped').length;
  return {
    mode,
    rows,
    required: required.length,
    settled,
    missing: mode === 'past' ? required.length - settled : 0,
    plannedKcal: rows.reduce((a, r) => a + r.plannedKcal, 0),
    plannedProtein: Math.round(rows.reduce((a, r) => a + r.lines.reduce((b, l) => b + l.protein, 0), 0)),
    eatenKcal: dayMeals.reduce((a, m) => a + m.kcal, 0),
    eatenProtein: Math.round(dayMeals.reduce((a, m) => a + m.protein, 0)),
    autoIds: rows.flatMap((r) => r.autoIds),
    canFill: mode === 'past' && required.length > 0 && dayMeals.length === 0 && rows.every((r) => r.state !== 'skipped'),
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/core/__tests__/dayView.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 9 more tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/dayView.ts src/core/__tests__/dayView.test.ts
git commit -m "$(cat <<'EOF'
The day's menu is worked out slot by slot: today's eaten slots ticked, the slot whose turn it is open and the rest for later, a filled-in slot done with its from-plan mark and the next one current; a past day's open slots and how many planned meals are missing; a future day all plan, in the person's language with database calories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: The week strip

**Files:**
- Create: `src/core/weekStrip.ts`, `src/core/__tests__/weekStrip.test.ts`, `src/components/WeekStrip.tsx`
- Modify: `src/core/date.ts` (append `formatDayMonth`), `src/core/__tests__/date.test.ts` (import line; append)
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `DayRecord` (`record.ts`), `addDays`, `formatDayLabel`, `IconButton`, `PanResponder` (react-native).
- Produces: `type StripMark = 'full' | 'missing' | 'today' | 'planned' | 'off' | 'none'`, `type StripDay = { date; weekday; day; mark; light; isToday; selected }`, `weekStrip(input: { monday; today; viewed; records: DayRecord[]; since: ISODate }): StripDay[]`, `stripSince(onboardedOn: ISODate | undefined, meals: Pick<Meal, 'date'>[], today): ISODate`, `swipeStep(dx, dy): -1 | 0 | 1`; `formatDayMonth(date, lang): string`; `WeekStrip({ days, lang, onSelect: (date) => void, onWeek: (by: -1 | 1) => void })`; i18n `strip_*`.

Marks, from the spec: filled teal for a full day, amber for a day with meals missing, an outline for a planned day; a lighter tone when the day still holds meals filled in from the plan. Two marks the spec leaves open are decided here: today, until it is full, shows an outline ("still going") rather than amber, because a day in progress is not missing anything yet; and a day before the person started (the day setup finished, else the first meal ever logged) shows no mark, so a new person's first week is not amber.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/weekStrip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DayRecord } from '../record';
import { stripSince, swipeStep, weekStrip } from '../weekStrip';

const r = (state: DayRecord['state'], fromPlan = false): DayRecord => ({ state, fromPlan });
const MON = '2026-10-26';
// A Wednesday.
const TODAY = '2026-10-28';

describe('weekStrip', () => {
  it('marks each day: full, missing, today still going, planned, off; lighter while filled in from the plan', () => {
    const days = weekStrip({ monday: MON, today: TODAY, viewed: TODAY, since: '2026-10-01', records: [r('full'), r('partial', true), r('partial'), r('planned'), r('planned'), r('off'), r('planned')] });
    expect(days.map((d) => d.mark)).toEqual(['full', 'missing', 'today', 'planned', 'planned', 'off', 'planned']);
    expect(days.map((d) => d.light)).toEqual([false, true, false, false, false, false, false]);
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days.map((d) => d.day)).toEqual([26, 27, 28, 29, 30, 31, 1]);
    expect(days.filter((d) => d.selected).map((d) => d.date)).toEqual([TODAY]);
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual([TODAY]);
  });

  it('a day before the person started has nothing to miss', () => {
    const days = weekStrip({ monday: MON, today: TODAY, viewed: MON, since: '2026-10-27', records: [r('empty'), r('empty'), r('empty'), r('planned'), r('planned'), r('planned'), r('planned')] });
    expect(days.slice(0, 3).map((d) => d.mark)).toEqual(['none', 'missing', 'today']);
    expect(days[0].selected).toBe(true);
  });
});

describe('stripSince', () => {
  it('starts on the day setup finished, else the first meal, else today', () => {
    expect(stripSince('2026-10-20', [{ date: '2026-09-01' }], TODAY)).toBe('2026-10-20');
    expect(stripSince(undefined, [{ date: '2026-10-05' }, { date: '2026-09-30' }], TODAY)).toBe('2026-09-30');
    expect(stripSince(undefined, [], TODAY)).toBe(TODAY);
  });
});

describe('swipeStep', () => {
  it('a sideways swipe left is the next week and right the week before; short or up-and-down is nothing', () => {
    expect(swipeStep(-80, 10)).toBe(1);
    expect(swipeStep(80, 10)).toBe(-1);
    expect(swipeStep(30, 0)).toBe(0);
    expect(swipeStep(80, 60)).toBe(0);
  });
});
```

In `src/core/__tests__/date.test.ts`, add `formatDayMonth, ` to the `../date` import list (after `formatDayLabel, `), and append:

```ts
describe('formatDayMonth', () => {
  it('writes the day and the short month', () => {
    expect(formatDayMonth('2026-10-26', 'en')).toMatch(/26/);
    expect(formatDayMonth('2026-10-26', 'en')).toMatch(/Oct/);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/core/__tests__/weekStrip.test.ts src/core/__tests__/date.test.ts`
Expected: FAIL: `Failed to resolve import "../weekStrip"`; `formatDayMonth is not a function`.

- [ ] **Step 3: Create `src/core/weekStrip.ts` and add `formatDayMonth`**

```ts
import { addDays } from './date';
import type { DayRecord } from './record';
import type { ISODate, Meal } from './types';

/**
 * The week strip on Today: Monday to Sunday of the week being looked at,
 * each day with a mark from the record. Full is a filled teal dot, a past day
 * with meals missing amber, a planned day (and today, until it is full) an
 * outline; a day still holding meals filled in from the plan is drawn
 * lighter; an off day and a day before the person started have no dot. Pure.
 */
export type StripMark = 'full' | 'missing' | 'today' | 'planned' | 'off' | 'none';
export type StripDay = {
  date: ISODate;
  /** Date.getDay(): 0 is Sunday, for the weekday's short name. */
  weekday: number;
  /** The day of the month. */
  day: number;
  mark: StripMark;
  light: boolean;
  isToday: boolean;
  selected: boolean;
};

export function weekStrip(input: { monday: ISODate; today: ISODate; viewed: ISODate; records: DayRecord[]; since: ISODate }): StripDay[] {
  return input.records.slice(0, 7).map((r, i) => {
    const date = addDays(input.monday, i);
    const isToday = date === input.today;
    const mark: StripMark =
      r.state === 'off' ? 'off' : date > input.today ? 'planned' : date < input.since ? 'none' : r.state === 'full' ? 'full' : isToday ? 'today' : 'missing';
    return {
      date,
      weekday: (i + 1) % 7,
      day: Number(date.slice(8, 10)),
      mark,
      light: r.fromPlan && (mark === 'full' || mark === 'missing' || mark === 'today'),
      isToday,
      selected: date === input.viewed,
    };
  });
}

/** Where the record starts: the day setup finished, else the first meal ever logged, else today. Days before it have nothing to miss. */
export function stripSince(onboardedOn: ISODate | undefined, meals: Pick<Meal, 'date'>[], today: ISODate): ISODate {
  if (onboardedOn) return onboardedOn;
  let first = today;
  for (const m of meals) if (m.date < first) first = m.date;
  return first;
}

/** A swipe on the strip: left for the next week, right for the one before. Shorter than 48 points, or more up-and-down than sideways, is not a swipe. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 48 || Math.abs(dx) < 2 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
```

In `src/core/date.ts`, after `formatDayLabel`, add:

```ts
/** "26 Oct" in the chosen language. Falls back to the ISO date if Intl is missing. */
export function formatDayMonth(date: ISODate, lang: Lang): string {
  try {
    const s = new Date(date + 'T12:00:00').toLocaleDateString(LOCALE[lang] ?? 'en-IN', { day: 'numeric', month: 'short' });
    return s && s !== 'Invalid Date' ? s : date;
  } catch {
    return date;
  }
}
```

Run: `npx vitest run src/core/__tests__/weekStrip.test.ts src/core/__tests__/date.test.ts`
Expected: PASS (5 new tests).

- [ ] **Step 4: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  strip_full: 'All meals logged', strip_missing: 'Meals missing', strip_today: 'Today, still going', strip_planned: 'Planned', strip_off: 'Day off', strip_none: 'Before you started',
  strip_from_plan: 'filled in from the plan', strip_prev_week: 'Previous week', strip_next_week: 'Next week',
```

Before the `};` that closes `mr`:

```ts
  strip_full: 'सर्व जेवणं नोंदली', strip_missing: 'काही जेवणं राहिली', strip_today: 'आज, सुरू आहे', strip_planned: 'ठरवलेलं', strip_off: 'सुट्टीचा दिवस', strip_none: 'सुरुवातीआधी',
  strip_from_plan: 'नियोजनावरून भरलेलं', strip_prev_week: 'मागचा आठवडा', strip_next_week: 'पुढचा आठवडा',
```

Before the `};` that closes `hi`:

```ts
  strip_full: 'सारे खाने दर्ज', strip_missing: 'कुछ खाने बाकी', strip_today: 'आज, जारी है', strip_planned: 'तय', strip_off: 'छुट्टी का दिन', strip_none: 'शुरुआत से पहले',
  strip_from_plan: 'प्लान से भरा', strip_prev_week: 'पिछला हफ़्ता', strip_next_week: 'अगला हफ़्ता',
```

- [ ] **Step 5: Create `src/components/WeekStrip.tsx`**

```tsx
import React, { useMemo } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { formatDayLabel, formatDayMonth } from '../core/date';
import type { Lang } from '../core/types';
import { swipeStep, type StripDay } from '../core/weekStrip';
import { makeT } from '../i18n';
import { C, F, lh, S } from '../ui/theme';
import { IconButton } from './TopBarActions';

/**
 * Monday to Sunday of the week being looked at, a dot under each day from
 * the record. Tapping a day shows it; the arrows above, or a sideways swipe,
 * move a week. The arrows sit in their own row, so each day keeps a full
 * seventh of the width, never under a finger's size.
 */
export function WeekStrip({ days, lang, onSelect, onWeek }: { days: StripDay[]; lang: Lang; onSelect: (date: string) => void; onWeek: (by: -1 | 1) => void }) {
  const t = makeT(lang);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          const by = swipeStep(g.dx, g.dy);
          if (by !== 0) onWeek(by);
        },
      }),
    [onWeek],
  );
  if (days.length === 0) return null;
  return (
    <View style={{ gap: 4 }} {...pan.panHandlers}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton name="chevron-back" label={t('strip_prev_week')} onPress={() => onWeek(-1)} />
        <Text style={{ flex: 1, textAlign: 'center', color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
          {`${formatDayMonth(days[0].date, lang)} – ${formatDayMonth(days[days.length - 1].date, lang)}`}
        </Text>
        <IconButton name="chevron-forward" label={t('strip_next_week')} onPress={() => onWeek(1)} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {days.map((d) => (
          <Pressable
            key={d.date}
            onPress={() => onSelect(d.date)}
            accessibilityRole="button"
            aria-selected={d.selected}
            accessibilityLabel={`${formatDayLabel(d.date, lang)}, ${t(`strip_${d.mark}`)}${d.light ? `, ${t('strip_from_plan')}` : ''}`}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 60,
              minWidth: S.touch,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              borderRadius: S.radiusSm,
              borderWidth: 1,
              borderColor: d.selected ? C.accent : 'transparent',
              backgroundColor: d.selected ? C.accentDim : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={{ color: d.isToday ? C.accentText : C.textFaint, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{t(`wd_${d.weekday}`)}</Text>
            <Text style={{ color: d.selected || d.isToday ? C.accentText : C.text, fontSize: F.body, lineHeight: lh(F.body, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{d.day}</Text>
            <Dot mark={d.mark} light={d.light} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Teal for full, amber for missing, an outline for planned and today; nothing for an off day or a day before the start. */
function Dot({ mark, light }: { mark: StripDay['mark']; light: boolean }) {
  if (mark === 'off' || mark === 'none') return <View style={{ width: 8, height: 8 }} />;
  const fill = mark === 'full' ? C.accent : mark === 'missing' ? C.amber : 'transparent';
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: fill,
        borderWidth: fill === 'transparent' ? 1.5 : 0,
        borderColor: C.textFaint,
        opacity: light ? 0.45 : 1,
      }}
    />
  );
}
```

- [ ] **Step 6: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 5 more tests.

```bash
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|hitSlop" src/components/WeekStrip.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/WeekStrip.tsx
```

Expected: both print nothing.

- [ ] **Step 7: Commit**

```bash
git add src/core/weekStrip.ts src/core/__tests__/weekStrip.test.ts src/core/date.ts src/core/__tests__/date.test.ts src/components/WeekStrip.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
A week strip, Monday to Sunday, with a dot under each day from the record: teal for a full day, amber for meals missing, an outline for a planned day and for today until it is full, lighter while meals filled in from the plan are unconfirmed, and nothing before the person started; arrows or a sideways swipe move a week, and each day is a full seventh of the width

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: The day's menu on screen

**Files:**
- Create: `src/components/DayMenu.tsx`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `DayView`, `MenuRow`, `RowLine` (Task 13), `stepCount` (Task 9), `QtyStepper` (Task 9), `useAddSheet` (Task 11), `itemName` (Task 8), `Ctx.addMealFromPlan`, `Ctx.confirmMeal`, `Ctx.confirmDay`, `Ctx.fillDayFromPlan`, `Ctx.editMenuLine`, `Ctx.skipSlot`, `Ctx.unskipSlot`, `Ctx.planFoods`, `dayStatus`, `KCAL_FLOOR`, `isOffDay`.
- Produces: `DayMenu({ date: ISODate; view: DayView; menu: DayMenu; onOpenMeal: (m: Meal) => void })`; i18n `menu_*` below.

Every row is one of six, from `dayView`:
- **done**: a tick, the slot name, the foods eaten (in the person's language) and their calories on one line; a tap opens the meal to change or delete. A meal the app filled in shows a "From plan · tap to confirm" chip, which confirms it.
- **skipped**: the slot, "Skipped", and an Undo a finger wide.
- **current**: open, tinted: each planned food with its amount and calories, and **Ate as planned** and **Change** (Change opens the add sheet with the planned foods in the basket). A slot with nothing planned offers Add food.
- **later**: one line, the time and the planned calories.
- **open** (a past day, or a slot today passed with nothing in it): each planned food with − / +, and **Ate this** / **Ate other** / **Skipped**.
- **plan** (a future day): each planned food with − / +, which edit that date's menu, and **Change** (the add sheet in plan mode).

A future day offers no logging: its rows are plan rows, "Fill this day from plan" and "Day looks right" are for past days (and today from 21:00), and its Change opens the add sheet in plan mode. The store refuses plan logging after today (`addMealFromPlan` and `fillDayFromPlan` do nothing there), so a button that logged would only show a toast for a meal that is not saved. A meal deleted from its sheet comes back with Undo through `addMeal`, which lifts the skip `removeMeal` may have marked (Task 17).

Above the rows: on a past day the amber "N meals missing" and the record bar "2 of 3 meals"; on a future day the total against the goal and, when the day is too low (the safety rule), a warning with a way to the diet plan, where Balance lives. Below them: "Fill this day from plan" for a past day with nothing logged, and "Day looks right" from 21:00 (or on a past day) while meals filled in from the plan are unconfirmed.

- [ ] **Step 1: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  menu_title: 'Menu', menu_planned_of: 'Planned {kcal} of {goal}', menu_day_off: 'A day off: nothing is judged.',
  menu_missing: '{n} meals missing', menu_missing_one: '1 meal missing', menu_record: '{n} of {of} meals',
  menu_plan_low: 'Too little for one day. Add food, or balance the day in the diet plan.', menu_open_plan: 'Open the diet plan',
  menu_fill_day: 'Fill this day from plan', menu_day_right: 'Day looks right', menu_day_confirmed: 'Day confirmed',
  menu_from_plan: 'From plan · tap to confirm', menu_nothing_planned: 'Nothing planned', menu_planned_kcal: '{kcal} kcal planned',
  menu_ate_this: 'Ate this', menu_ate_other: 'Ate other', menu_skipped: 'Skipped',
  menu_done_a11y: '{slot}: {foods}, {kcal} kcal', menu_open_meal: 'Opens the meal to change or remove it.',
```

Before the `};` that closes `mr`:

```ts
  menu_title: 'मेन्यू', menu_planned_of: '{goal} पैकी {kcal} ठरवलं', menu_day_off: 'सुट्टीचा दिवस: काहीही मोजलं जात नाही.',
  menu_missing: '{n} जेवणं राहिली', menu_missing_one: '1 जेवण राहिलं', menu_record: '{of} पैकी {n} जेवणं',
  menu_plan_low: 'एका दिवसासाठी खूप कमी. पदार्थ जोडा, किंवा आहार नियोजनात दिवस संतुलित करा.', menu_open_plan: 'आहार नियोजन उघडा',
  menu_fill_day: 'हा दिवस नियोजनावरून भरा', menu_day_right: 'दिवस बरोबर आहे', menu_day_confirmed: 'दिवस पक्का केला',
  menu_from_plan: 'नियोजनावरून · पक्कं करायला दाबा', menu_nothing_planned: 'काही ठरवलेलं नाही', menu_planned_kcal: '{kcal} kcal ठरवलं',
  menu_ate_this: 'हेच खाल्लं', menu_ate_other: 'दुसरं खाल्लं', menu_skipped: 'वगळलं',
  menu_done_a11y: '{slot}: {foods}, {kcal} kcal', menu_open_meal: 'जेवण बदलायला किंवा काढायला उघडते.',
```

Before the `};` that closes `hi`:

```ts
  menu_title: 'मेन्यू', menu_planned_of: '{goal} में से {kcal} तय', menu_day_off: 'छुट्टी का दिन: कुछ नहीं आँका जाता.',
  menu_missing: '{n} खाने बाकी', menu_missing_one: '1 खाना बाकी', menu_record: '{of} में से {n} खाने',
  menu_plan_low: 'एक दिन के लिए बहुत कम. खाना जोड़ें, या डाइट प्लान में दिन संतुलित करें.', menu_open_plan: 'डाइट प्लान खोलें',
  menu_fill_day: 'यह दिन प्लान से भरें', menu_day_right: 'दिन ठीक है', menu_day_confirmed: 'दिन पक्का किया',
  menu_from_plan: 'प्लान से · पक्का करने के लिए दबाएँ', menu_nothing_planned: 'कुछ तय नहीं', menu_planned_kcal: '{kcal} kcal तय',
  menu_ate_this: 'यही खाया', menu_ate_other: 'कुछ और खाया', menu_skipped: 'छोड़ा',
  menu_done_a11y: '{slot}: {foods}, {kcal} kcal', menu_open_meal: 'खाना बदलने या हटाने के लिए खोलता है.',
```

- [ ] **Step 2: Create `src/components/DayMenu.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { stepCount } from '../core/basket';
import type { DayView, MenuRow, RowLine } from '../core/dayView';
import { itemName } from '../core/foods';
import type { DayMenu as Menu } from '../core/menu';
import { KCAL_FLOOR } from '../core/nutrition';
import { slotLabel } from '../core/routine';
import type { ISODate, Meal } from '../core/types';
import { isOffDay } from '../core/week';
import { dayStatus } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Divider, Pill, Row, SectionHeader } from '../ui/components';
import { QtyStepper } from '../ui/QtyStepper';
import { C, F, lh, S } from '../ui/theme';
import { useAddSheet } from './AddSheet';

/** A measure's word ("piece", "katori"), or the unit itself when there is none. */
function unitWord(unit: string, t: (key: string) => string): string {
  const w = t(`unit_${unit}`);
  return w === `unit_${unit}` ? unit : w;
}

/**
 * The day's menu, one row per slot (core/dayView.ts decides each row's
 * state). Today: eaten slots ticked on one line, the slot whose turn it is
 * open with Ate as planned and Change, later slots one line. A past day says
 * how many meals are missing and fills each open slot as planned, with
 * something else, or as skipped, with − / + on each planned food. A future
 * day is the plan itself: − / + and Change edit that date's menu, and the
 * total against the goal updates at once. Meals the app filled in carry a
 * "from plan" chip until they are confirmed.
 */
export function DayMenu({ date, view, menu, onOpenMeal }: { date: ISODate; view: DayView; menu: Menu; onOpenMeal: (m: Meal) => void }) {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const addSheet = useAddSheet();
  const { state, targets, hour } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const small = { color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) } as const;
  const strong = { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' } as const;

  const title = (row: MenuRow) => {
    const s = state.routine.slots.find((x) => x.id === row.slotId);
    return (s && slotLabel(s, lang)) || t(row.type);
  };
  const plannedLines = (row: MenuRow) => menu.meals.find((m) => m.id === row.slotId)?.lines ?? [];

  function stepLine(row: MenuRow, l: RowLine, by: 1 | -1) {
    const line = plannedLines(row)[l.idx];
    if (!line) return;
    const qty = stepCount(line.qty, line.unit, by);
    app.editMenuLine(menu, row.slotId, l.idx, qty > 0 ? { ...line, qty } : null);
    fb.haptic('light');
  }

  function atePlanned(row: MenuRow) {
    app.addMealFromPlan(date, row.slotId);
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: row.plannedKcal }));
  }

  const head = (row: MenuRow, right?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <Text style={[strong, { flex: 1 }]}>
        {title(row)}
        <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}>{`  ${row.time}`}</Text>
      </Text>
      {right ? <Text style={[small, { fontWeight: '500' }]}>{right}</Text> : null}
    </View>
  );

  const stepperLine = (row: MenuRow, l: RowLine) => (
    <View key={l.idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={strong}>
          {l.name}
        </Text>
        <Text numberOfLines={1} style={small}>{`${unitWord(l.unit, t)} · ${l.grams} g · ${l.kcal} kcal`}</Text>
      </View>
      <QtyStepper value={l.qtyText} onMinus={() => stepLine(row, l, -1)} onPlus={() => stepLine(row, l, 1)} minusLabel={fill(t('qty_less'), { food: l.name })} plusLabel={fill(t('qty_more'), { food: l.name })} />
    </View>
  );

  function renderRow(row: MenuRow) {
    if (row.state === 'done') {
      const names = row.meals.flatMap((m) => m.items).map((it) => itemName(it, app.planFoods, lang)).join(', ');
      return (
        <View style={{ gap: 6, paddingVertical: 4 }}>
          <Pressable
            onPress={() => onOpenMeal(row.meals[0])}
            accessibilityRole="button"
            accessibilityLabel={fill(t('menu_done_a11y'), { slot: title(row), foods: names, kcal: row.eatenKcal })}
            accessibilityHint={t('menu_open_meal')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="checkmark-circle" size={20} color={C.accentText} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={strong}>
                {title(row)}
              </Text>
              {names ? (
                <Text numberOfLines={1} style={small}>
                  {names}
                </Text>
              ) : null}
            </View>
            <Text style={[small, { fontWeight: '500' }]}>{`${row.eatenKcal} kcal`}</Text>
          </Pressable>
          {row.autoIds.length > 0 ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <Pill
                label={t('menu_from_plan')}
                onPress={() => {
                  row.autoIds.forEach((id) => app.confirmMeal(id));
                  fb.haptic('light');
                }}
              />
            </View>
          ) : null}
        </View>
      );
    }
    if (row.state === 'skipped') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch }}>
          <Ionicons name="remove-circle-outline" size={20} color={C.textFaint} />
          <Text style={[small, { flex: 1, fontSize: F.body, lineHeight: lh(F.body) }]}>{`${title(row)} · ${t('slot_skipped')}`}</Text>
          <Pressable
            onPress={() => app.unskipSlot(date, row.slotId)}
            accessibilityRole="button"
            accessibilityLabel={`${t('undo')}: ${title(row)}`}
            style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: pressed ? C.accentSoft : 'transparent' })}>
            <Text style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{t('undo')}</Text>
          </Pressable>
        </View>
      );
    }
    if (row.state === 'current') {
      return (
        <View style={{ gap: 8, padding: 12, marginVertical: 4, borderRadius: S.radiusSm, borderWidth: 1, borderColor: C.accent, backgroundColor: C.accentDim }}>
          {head(row, row.lines.length > 0 ? `${row.plannedKcal} kcal` : undefined)}
          {row.lines.length > 0 ? (
            row.lines.map((l) => (
              <View key={l.idx}>
                <Text style={strong}>{l.name}</Text>
                <Text style={small}>{`${l.qtyText} ${unitWord(l.unit, t)} · ${l.grams} g · ${l.kcal} kcal`}</Text>
              </View>
            ))
          ) : (
            <Text style={small}>{t('menu_nothing_planned')}</Text>
          )}
          <Row style={{ gap: 8 }}>
            {row.lines.length > 0 ? <Btn small label={t('menu_ate_planned')} onPress={() => atePlanned(row)} style={{ flex: 1 }} /> : null}
            <Btn small tone="soft" label={row.lines.length > 0 ? t('menu_change') : t('add_food')} onPress={() => addSheet.open({ date, slotId: row.slotId, lines: plannedLines(row) })} style={{ flex: 1 }} />
          </Row>
        </View>
      );
    }
    if (row.state === 'later') {
      return <View style={{ paddingVertical: 10 }}>{head(row, row.lines.length > 0 ? fill(t('menu_planned_kcal'), { kcal: row.plannedKcal }) : t('menu_nothing_planned'))}</View>;
    }
    // Open (a past day, or a slot today passed with nothing in it) and plan (a future day): each planned food with − / +.
    return (
      <View style={{ gap: 8, paddingVertical: 8 }}>
        {head(row, row.lines.length > 0 ? `${row.plannedKcal} kcal` : undefined)}
        {row.lines.map((l) => stepperLine(row, l))}
        {row.state === 'plan' ? (
          <Btn small tone="soft" label={row.lines.length > 0 ? t('menu_change') : t('add_food')} onPress={() => addSheet.open({ date, slotId: row.slotId, lines: plannedLines(row), mode: 'plan' })} />
        ) : (
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {row.lines.length > 0 ? <Btn small label={t('menu_ate_this')} onPress={() => atePlanned(row)} style={{ flexGrow: 1 }} /> : null}
            <Btn small tone="soft" label={t('menu_ate_other')} onPress={() => addSheet.open({ date, slotId: row.slotId })} style={{ flexGrow: 1 }} />
            {row.lines.length > 0 ? (
              <Btn
                small
                tone="ghost"
                label={t('menu_skipped')}
                onPress={() => {
                  app.skipSlot(date, row.slotId);
                  fb.haptic('light');
                }}
                style={{ flexGrow: 1 }}
              />
            ) : null}
          </Row>
        )}
      </View>
    );
  }

  const status = view.mode === 'future' ? dayStatus(view.plannedKcal, targets.kcal, KCAL_FLOOR[state.profile.sex]) : null;
  const confirmDay = view.autoIds.length > 0 && (view.mode === 'past' || (view.mode === 'today' && hour >= 21));

  return (
    <Card>
      <SectionHeader title={t('menu_title')} meta={view.mode === 'future' ? fill(t('menu_planned_of'), { kcal: view.plannedKcal, goal: targets.kcal }) : undefined} />
      {isOffDay(state.settings.offDays, date) ? <Text style={small}>{t('menu_day_off')}</Text> : null}
      {view.mode === 'past' && view.missing > 0 ? (
        <Text style={{ color: C.amber, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{fill(t(view.missing === 1 ? 'menu_missing_one' : 'menu_missing'), { n: view.missing })}</Text>
      ) : null}
      {view.mode === 'past' && view.required > 0 ? (
        <View style={{ gap: 6 }}>
          <Bar value={view.settled} max={view.required} color={view.settled === view.required ? C.accent : C.amber} />
          <Text style={small}>{fill(t('menu_record'), { n: view.settled, of: view.required })}</Text>
        </View>
      ) : null}
      {status === 'low' ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.red, fontSize: F.small, lineHeight: lh(F.small) }}>{t('menu_plan_low')}</Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Pill label={t('menu_open_plan')} onPress={() => router.push('/food?s=plan')} />
          </View>
        </View>
      ) : null}
      {view.rows.map((row, i) => (
        <View key={row.slotId}>
          {i > 0 ? <Divider /> : null}
          {renderRow(row)}
        </View>
      ))}
      {view.canFill ? (
        <Btn
          tone="soft"
          label={t('menu_fill_day')}
          onPress={() => {
            app.fillDayFromPlan(date);
            fb.haptic('success');
          }}
        />
      ) : null}
      {confirmDay ? (
        <Btn
          tone="soft"
          label={t('menu_day_right')}
          onPress={() => {
            app.confirmDay(date);
            fb.haptic('success');
            fb.notify(t('menu_day_confirmed'));
          }}
        />
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests (the rules are `dayView`'s, Task 13). The menu is placed on Today in Task 17.

```bash
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|hitSlop" src/components/DayMenu.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/DayMenu.tsx
```

Expected: both print nothing.

- [ ] **Step 4: Commit**

```bash
git add src/components/DayMenu.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The day's menu on screen: eaten slots ticked on one line, the slot whose turn it is open with Ate as planned and Change, later slots one line; a past day says how many meals are missing with "2 of 3 meals", fills a slot as planned, with something else or as skipped, and an empty older day fills from the plan in one tap; a future day's − / + and Change edit only that date and the total updates at once; filled-in meals are confirmed one by one, or all at once with "Day looks right" from 21:00

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 16: Today's pieces: the layout of its cards, calories left, the coach line, and the optional cards

**Files:**
- Create: `src/core/todayLayout.ts`, `src/core/__tests__/todayLayout.test.ts`, `src/components/CaloriesLeft.tsx`, `src/components/CoachLine.tsx`, `src/components/MantraCard.tsx`, `src/components/StepsCard.tsx`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `TODAY_CARD_IDS`, `DEFAULT_TODAY_CARDS` (`tabs.ts`, Plan 1 Task 1), `DayMode`, `DayView` (Task 13), `Ctx.budget`, `Ctx.targets`, `useCoach`, `adviceText`, `useAdviceAction`, `useMantra`, `Quote`, `MeterRow`.
- Produces: `type PairTile = 'weight' | 'sleep' | 'climb'`, `type TodayBlock = { kind: 'menu' } | { kind: 'coach' } | { kind: 'waterWalk' } | { kind: 'steps' } | { kind: 'mantra' } | { kind: 'pair'; tiles: PairTile[] }`, `todayBlocks(cards: unknown): TodayBlock[]`; `CaloriesLeft({ mode, view })`, `CoachLine()`, `MantraCard()`, `StepsCard({ date })`; i18n `today_planned_goal`, `today_eaten_of`, `today_protein`, `today_left_after_plan`, `today_back`.

"Calories left" is locked at the top of Today (with the week strip); the cards under it follow `settings.todayCards` in the person's order: the menu, the coach line and the Water and Walk pair are on by default, and weight, sleep, steps, the climb and the mantra can be switched on (Plan 4's Customize). The single tiles (weight, sleep, the climb, which is the streak tile) pair up two to a row.

- [ ] **Step 1: Write the failing test**

Create `src/core/__tests__/todayLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { todayBlocks } from '../todayLayout';

const on = (id: string) => ({ id, on: true });
const off = (id: string) => ({ id, on: false });

describe('todayBlocks', () => {
  it('shows the menu, the coach line and Water and Walk by default', () => {
    expect(todayBlocks(undefined)).toEqual([{ kind: 'menu' }, { kind: 'coach' }, { kind: 'waterWalk' }]);
  });

  it("pairs the single tiles two to a row in order, and keeps the person's order around them", () => {
    expect(todayBlocks([on('menu'), on('weight'), on('sleep'), on('climb'), on('coach'), off('waterWalk')])).toEqual([
      { kind: 'menu' },
      { kind: 'pair', tiles: ['weight', 'sleep'] },
      { kind: 'pair', tiles: ['climb'] },
      { kind: 'coach' },
    ]);
    expect(todayBlocks([on('weight'), on('menu'), on('sleep')])).toEqual([{ kind: 'pair', tiles: ['weight'] }, { kind: 'menu' }, { kind: 'pair', tiles: ['sleep'] }]);
  });

  it('leaves out unknown, repeated and switched-off cards', () => {
    expect(todayBlocks([on('menu'), on('menu'), { id: 'today', on: true }, 42, off('coach'), on('steps'), on('mantra')])).toEqual([{ kind: 'menu' }, { kind: 'steps' }, { kind: 'mantra' }]);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/core/__tests__/todayLayout.test.ts`
Expected: FAIL: `Failed to resolve import "../todayLayout"`.

- [ ] **Step 3: Create `src/core/todayLayout.ts`**

```ts
import { DEFAULT_TODAY_CARDS, TODAY_CARD_IDS } from './tabs';
import type { TodayCardId } from './types';

/**
 * Today's blocks under the week strip and calories left, from the cards the
 * person has on, in their order: the menu, the coach line, the Water and Walk
 * pair, and the optional cards. The single tiles (weight, sleep, the climb)
 * pair up two to a row in the order they come; a lone one keeps half a row.
 * Unknown, repeated and switched-off cards are left out, and anything that is
 * not a list gets the default. Pure.
 */
export type PairTile = 'weight' | 'sleep' | 'climb';
export type TodayBlock = { kind: 'menu' } | { kind: 'coach' } | { kind: 'waterWalk' } | { kind: 'steps' } | { kind: 'mantra' } | { kind: 'pair'; tiles: PairTile[] };

const SINGLE_TILES: string[] = ['weight', 'sleep', 'climb'];

export function todayBlocks(cards: unknown): TodayBlock[] {
  const list: unknown[] = Array.isArray(cards) ? cards : DEFAULT_TODAY_CARDS;
  const seen = new Set<string>();
  const out: TodayBlock[] = [];
  let pending: PairTile[] = [];
  const flush = () => {
    if (pending.length > 0) out.push({ kind: 'pair', tiles: pending });
    pending = [];
  };
  for (const c of list) {
    if (typeof c !== 'object' || c === null) continue;
    const { id, on } = c as { id?: unknown; on?: unknown };
    if (typeof id !== 'string' || !(TODAY_CARD_IDS as string[]).includes(id) || seen.has(id)) continue;
    seen.add(id);
    if (on !== true) continue;
    if (SINGLE_TILES.includes(id)) {
      pending.push(id as PairTile);
      if (pending.length === 2) flush();
      continue;
    }
    flush();
    out.push({ kind: id as Exclude<TodayCardId, PairTile> });
  }
  flush();
  return out;
}
```

Run: `npx vitest run src/core/__tests__/todayLayout.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 4: The words, in `src/i18n/index.ts`**

Before the `};` that closes `en`:

```ts
  today_planned_goal: 'Planned {planned} · Goal {goal}', today_eaten_of: 'Eaten {eaten} of {goal}', today_protein: 'Protein {p} of {target} g',
  today_left_after_plan: 'kcal left after the plan', today_back: 'Back to today',
```

Before the `};` that closes `mr`:

```ts
  today_planned_goal: 'ठरवलं {planned} · लक्ष्य {goal}', today_eaten_of: '{goal} पैकी {eaten} खाल्लं', today_protein: 'प्रथिने {target} पैकी {p} ग्रॅ',
  today_left_after_plan: 'नियोजनानंतर शिल्लक कॅलरी', today_back: 'आजवर परत',
```

Before the `};` that closes `hi`:

```ts
  today_planned_goal: 'तय {planned} · लक्ष्य {goal}', today_eaten_of: '{goal} में से {eaten} खाया', today_protein: 'प्रोटीन {target} में से {p} ग्राम',
  today_left_after_plan: 'प्लान के बाद बची कैलोरी', today_back: 'आज पर वापस',
```

- [ ] **Step 5: Create the four components**

`src/components/CaloriesLeft.tsx`:

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import type { DayMode, DayView } from '../core/dayView';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Micro } from '../ui/components';
import { C, F, lh } from '../ui/theme';

/**
 * The one number the day is about: calories left. Today it is the live
 * budget (a walk earns some back), with "Planned X · Goal Y"; a past day is
 * the goal less what was eaten, with "Eaten X of Y"; a future day is what the
 * plan leaves. Protein against its target goes under it, on its own line so
 * it wraps instead of running into the edge.
 */
export function CaloriesLeft({ mode, view }: { mode: DayMode; view: DayView }) {
  const { state, budget, targets } = useApp();
  const t = makeT(state.profile.lang);
  const goal = targets.kcal;
  const left = mode === 'today' ? budget.remaining : mode === 'past' ? goal - view.eatenKcal : goal - view.plannedKcal;
  const over = left < 0;
  const n = (x: number) => x.toLocaleString();
  const label = over ? t('kcal_over') : mode === 'future' ? t('today_left_after_plan') : t('kcal_left');
  const earned = mode === 'today' && budget.earned > 0 ? ` · +${budget.earned} ${t('earned_short')}` : '';
  const line = `${mode === 'past' ? fill(t('today_eaten_of'), { eaten: n(view.eatenKcal), goal: n(goal) }) : fill(t('today_planned_goal'), { planned: n(view.plannedKcal), goal: n(goal) })}${earned}`;
  const protein = fill(t('today_protein'), {
    p: mode === 'today' ? budget.proteinConsumed : mode === 'past' ? view.eatenProtein : view.plannedProtein,
    target: mode === 'today' ? budget.proteinTarget : targets.proteinG,
  });
  return (
    <View style={{ gap: 2 }} accessible accessibilityLabel={`${n(Math.abs(left))} ${label}. ${line}. ${protein}`}>
      <Micro color={over ? C.red : C.textDim}>{label}</Micro>
      <Text style={{ color: over ? C.red : C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{n(Math.abs(left))}</Text>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{line}</Text>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{protein}</Text>
    </View>
  );
}
```

`src/components/CoachLine.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { makeT } from '../i18n';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';
import { adviceText, useAdviceAction } from './CoachStrip';
import { useCoach } from './useCoach';

/** The coach in one sentence: the one thing that matters now, and the tap that does it. Nothing when there is nothing to say. */
export function CoachLine() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const minute = useMinute();
  const advice = useCoach(minute)[0];
  const act = useAdviceAction();
  if (!advice) return null;
  const acts = advice.action !== 'none';
  const text = adviceText(advice, t);
  return (
    <Pressable
      onPress={acts ? () => act(advice) : undefined}
      disabled={!acts}
      accessibilityRole={acts ? 'button' : 'text'}
      accessibilityLabel={text}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.accentText} />
      <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400' }}>{text}</Text>
      {acts ? <Ionicons name="chevron-forward" size={16} color={C.textFaint} /> : null}
    </Pressable>
  );
}
```

`src/components/MantraCard.tsx`:

```tsx
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { makeT } from '../i18n';
import { useMantra } from '../services/useMantra';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Quote } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

/** The day's mantra, an optional card on Today: one line, and why it is said a tap away. */
export function MantraCard() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const mantra = useMantra();
  const [why, setWhy] = useState(false);
  if (!mantra) return null;
  return (
    <Card>
      <Pressable onPress={() => setWhy((w) => !w)} accessibilityRole="button" aria-expanded={why} accessibilityLabel={`${t('mantra_title')}: ${mantra.text}`} style={{ gap: 6, minHeight: S.touch }}>
        <Micro color={C.textDim}>{t('mantra_title')}</Micro>
        <Quote color={C.cyan}>{mantra.text}</Quote>
        {why ? (
          <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), paddingLeft: 14 }}>
            {`${mantra.why}\n`}
            <Text style={{ color: C.textFaint }}>{t('mantra_source')}</Text>
          </Text>
        ) : (
          <Micro color={C.accentText}>{`${t('mantra_why')} ›`}</Micro>
        )}
      </Pressable>
    </Card>
  );
}
```

`src/components/StepsCard.tsx`:

```tsx
import React from 'react';
import type { ISODate } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, MeterRow } from '../ui/components';
import { C } from '../ui/theme';

/** A day's steps against a daily goal. */
const STEP_GOAL = 8000;

/** Steps on the day shown, an optional card on Today. Counted by the phone. */
export function StepsCard({ date }: { date: ISODate }) {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const steps = state.steps.find((s) => s.date === date)?.count ?? 0;
  return (
    <Card>
      <MeterRow label={t('steps_today')} value={steps} total={STEP_GOAL} color={C.green} />
    </Card>
  );
}
```

- [ ] **Step 6: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; 3 more tests.

```bash
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|hitSlop" src/components/CaloriesLeft.tsx src/components/CoachLine.tsx src/components/MantraCard.tsx src/components/StepsCard.tsx
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" src/components/CaloriesLeft.tsx src/components/CoachLine.tsx src/components/MantraCard.tsx src/components/StepsCard.tsx
```

Expected: both print nothing.

- [ ] **Step 7: Commit**

```bash
git add src/core/todayLayout.ts src/core/__tests__/todayLayout.test.ts src/components/CaloriesLeft.tsx src/components/CoachLine.tsx src/components/MantraCard.tsx src/components/StepsCard.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Today's pieces: calories left as one number with "Planned X · Goal Y", "Eaten X of Y" for a past day and what the plan leaves for a future one, protein on its own line; the coach in one sentence; Today's cards follow the person's order with single tiles two to a row; and the mantra and steps become optional cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: The new Today

**Files:**
- Modify (whole file): `src/app/(tabs)/index.tsx`
- Modify: `src/components/MealSheet.tsx` (Undo on delete)

**Interfaces:**
- Consumes: Tasks 4, 5, 13-16, `Ctx.menuOn`, `weekRecord`, `skippedOn`, `slotStates`, `currentSlot`, `mondayOf`, `addDays`, `formatDayLabel`, `pendingCount`, `MealSheet`, `Celebration`, `IconButton`, `Page`, `Logo`.
- Produces: Today at `/` and `/?date=YYYY-MM-DD`. `MealRow` (exported from the old file, used nowhere else) is gone.

Deleting a meal now happens in `MealSheet` (a tap on a done row), so the Undo the old list's rows had moves there. The store's `removeMeal` marks the slot skipped once its moment to be filled in from the plan has passed, whatever the meal's source; Undo brings the meal back through `app.addMeal`, whose `withMealAdded` lifts that skip, and never by writing the meal back any other way. Nothing on Today logs into a date after today: a future day's menu is plan rows only, and the ➕ opens the add sheet in plan mode there (Task 11); the store refuses plan logging after today anyway.

From top to bottom: the week strip with calories left (one block), then the cards in the person's order: the day's menu, the coach line (today only), the Water and Walk tiles (not on a future day), and any optional cards. Four blocks by default. The greeting, `StartHereCard`, `TrackerGrid`, `FitsCard`, `PlanTodayCard`, the mountain and the mantra no longer render by default, and the other cards listed under "Decisions taken in this plan" leave Today. The viewed date is `?date=` (none for today): tapping a day or moving a week sets it, the header's "Back to today" clears it, and the tab bar's ➕ reads it.

- [ ] **Step 1: Replace the whole of `src/app/(tabs)/index.tsx`**

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { CaloriesLeft } from '../../components/CaloriesLeft';
import { Celebration } from '../../components/Celebration';
import { CoachLine } from '../../components/CoachLine';
import { DayMenu } from '../../components/DayMenu';
import { MantraCard } from '../../components/MantraCard';
import { MealSheet } from '../../components/MealSheet';
import { StepsCard } from '../../components/StepsCard';
import { SleepTile } from '../../components/tiles/SleepTile';
import { StreakTile } from '../../components/tiles/StreakTile';
import { TileRow } from '../../components/tiles/TileRow';
import { WaterWalkTiles } from '../../components/tiles/WaterWalk';
import { WeightTile } from '../../components/tiles/WeightTile';
import { IconButton } from '../../components/TopBarActions';
import { WeekStrip } from '../../components/WeekStrip';
import { addDays, formatDayLabel, mondayOf } from '../../core/date';
import { dayMode, dayView } from '../../core/dayView';
import { skippedOn } from '../../core/menu';
import { currentSlot, slotStates } from '../../core/pattern';
import { pendingCount } from '../../core/queue';
import { weekRecord } from '../../core/record';
import { todayBlocks, type PairTile } from '../../core/todayLayout';
import type { Meal } from '../../core/types';
import { stripSince, weekStrip } from '../../core/weekStrip';
import { fill, makeT } from '../../i18n';
import { useMinute } from '../../services/useWorkSchedule';
import { useApp } from '../../store/AppProvider';
import { Card, Small } from '../../ui/components';
import { Logo } from '../../ui/Logo';
import { C } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today: the calories left and the day's menu to tick off. The week strip
 * on top picks the day (?date=, none for today); under the number come the
 * cards the person keeps on, in their order: by default the menu, one coach
 * line and the Water and Walk tiles. A past day is filled in, a future day is
 * planned, in the same place.
 */
export default function TodayScreen() {
  const app = useApp();
  const router = useRouter();
  const { state, today, targets } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const minute = useMinute();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const viewed = typeof date === 'string' && ISO_DATE.test(date) ? date : today;
  const mode = dayMode(viewed, today);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);

  const go = useCallback((d: string) => router.setParams({ date: d === today ? undefined : d }), [router, today]);
  const onWeek = useCallback((by: -1 | 1) => go(addDays(viewed, 7 * by)), [go, viewed]);

  const menu = app.menuOn(viewed);
  const dayMeals = state.meals.filter((m) => m.date === viewed);
  const skippedIds = skippedOn(state.slotSkips, viewed);
  // Today, the slot whose turn it is by the person's own pattern.
  const currentId =
    mode === 'today' ? (currentSlot(slotStates({ routine: state.routine, target: targets.kcal, meals: dayMeals, nowMinutes: minute, skippedSlots: skippedIds }), minute)?.slot.id ?? null) : null;
  const view = dayView({ date: viewed, today, menu, meals: dayMeals, skippedIds, currentId, foods: app.planFoods, lang });

  const monday = mondayOf(viewed);
  const records = weekRecord({ monday, today, routine: state.routine, meals: state.meals, skips: state.slotSkips, offDays: state.settings.offDays ?? [], menuOn: app.menuOn });
  const days = weekStrip({ monday, today, viewed, records, since: stripSince(state.profile.onboardedOn, state.meals, today) });

  const queued = pendingCount(state.photoQueue);
  const title = mode === 'today' ? t('tab_today') : viewed === addDays(today, -1) ? t('yesterday') : formatDayLabel(viewed, lang);
  const pairTile = (id: PairTile) => (id === 'weight' ? <WeightTile key={id} /> : id === 'sleep' ? <SleepTile key={id} date={viewed} /> : <StreakTile key={id} />);

  return (
    <Page title={title} left={<Logo size={26} />} right={mode === 'today' ? undefined : <IconButton name="today-outline" label={t('today_back')} onPress={() => go(today)} />}>
      {queued > 0 ? <Small color={C.cyan}>{fill(t(queued === 1 ? 'photos_queued' : 'photos_queued_plural'), { n: queued })}</Small> : null}
      <Card>
        <WeekStrip days={days} lang={lang} onSelect={go} onWeek={onWeek} />
        <CaloriesLeft mode={mode} view={view} />
      </Card>
      {todayBlocks(state.settings.todayCards).map((b, i) => {
        if (b.kind === 'menu') return <DayMenu key="menu" date={viewed} view={view} menu={menu} onOpenMeal={setOpenMeal} />;
        // The coach and the mantra speak about now; nothing is drunk or walked on a day still to come.
        if (b.kind === 'coach') return mode === 'today' ? <CoachLine key="coach" /> : null;
        if (b.kind === 'waterWalk') return mode === 'future' ? null : <WaterWalkTiles key="waterWalk" date={viewed} />;
        if (b.kind === 'steps') return <StepsCard key="steps" date={viewed} />;
        if (b.kind === 'mantra') return mode === 'today' ? <MantraCard key="mantra" /> : null;
        return (
          <TileRow key={`pair-${i}`}>
            {b.tiles.map(pairTile)}
            {b.tiles.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </TileRow>
        );
      })}
      <Small color={C.textFaint}>{t('medical_note')}</Small>
      <MealSheet meal={openMeal} onClose={() => setOpenMeal(null)} />
      {mode === 'today' ? <Celebration /> : null}
    </Page>
  );
}
```

- [ ] **Step 2: Undo on a deleted meal (`src/components/MealSheet.tsx`)**

Replace

```tsx
  function remove() {
    app.removeMeal(current.id);
    fb.haptic('light');
    onClose();
  }
```

with

```tsx
  function remove() {
    // The meal as stored, so Undo puts back exactly what was there, through addMeal, which lifts the skip removeMeal may have marked.
    const gone = app.state.meals.find((m) => m.id === current.id) ?? current;
    app.removeMeal(current.id);
    fb.haptic('light');
    fb.notify(t('meal_removed'), { label: t('undo'), onPress: () => app.addMeal(gone) });
    onClose();
  }
```

- [ ] **Step 3: Typecheck, lint, suite, greps**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests.

```bash
grep -nE "StartHereCard|TrackerGrid|FitsCard|PlanTodayCard|MountainCard|useMantra|good_morning|MealRow|DecisionCard|BreakPanel" "src/app/(tabs)/index.tsx"
grep -rn "MealRow" src
grep -nE "fontFamily|eslint-disable|letterSpacing|fontWeight: '[6-9]00'|hitSlop" "src/app/(tabs)/index.tsx"
grep -nE "(label|title|placeholder|accessibilityLabel|accessibilityHint)=\"[A-Za-z]|>[A-Za-z][a-z]+( [a-z]+)*<" "src/app/(tabs)/index.tsx"
```

Expected: all four print nothing.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/index.tsx" src/components/MealSheet.tsx
git commit -m "$(cat <<'EOF'
The new Today is four calm blocks: the week strip with calories left, the day's menu to tick off, one coach line, and the Water and Walk tiles; any day of any week can be opened from the strip to fill in a past day or plan a future one, and the cards the person switches on follow in their order, while the greeting, the start card, the tracker grid, the plates, the plan card, the mountain and the mantra no longer crowd it. A meal deleted from its sheet can be brought back with Undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: The open UI items: the plan screen's small controls, water in bottles, and the remaining checks

**Files:**
- Modify: `src/app/plan.tsx` (imports; the day chips; the "Meals follow your eating pattern" link; the protein line; the line steppers)
- Modify: `src/components/CravingSOS.tsx` (a constant; the water it logs)
- Modify: `src/i18n/index.ts` (four values changed; one key added)

**Interfaces:**
- Consumes: `QtyStepper` (Task 9), `S.touch`.
- Produces: i18n `plan_change_unit`; the values of `glasses`, `water_glasses`, `toast_water_added`, `act_water_2_glass` now say bottles.

The ledger's open items and where each is closed:

| Item | Closed by |
|---|---|
| Web ignores `hitSlop`: plan.tsx Less/More steppers 28 px, the "Meals follow your eating pattern · edit" link 23 px | this task (44 pt boxes) |
| Day chip "रवि मोकळा" overflows at text scale 1.25 | this task (an off day shows a leaf, named for screen readers) |
| "प्रथिने 68 / 112 ग्रॅ" tight at the right edge | this task (its own line under the bar); Today's protein line is on its own line too (Task 16) |
| Empty `document.title` on the web | Task 7 |
| Water still says "glasses"; "a glass of water" logs 500 ml | this task (words say bottles; the craving helper logs a 250 ml glass); the sidebar's water line went in Task 6 |
| English Today greeting with a Marathi alt | Task 17 (Today has no greeting; its title is the day) |
| Bhaji cards for people with no bhaji week | Plan 1's Task 6 fix (`hasBhajiWeek` in `RoutineCard` and `TomorrowCard`), and neither card is on Today any more; Step 6 checks |
| The log slot preview adds the auto meal's kcal | Task 11 ("Replaces the planned meal", `slotPreview`) |
| `+html` status bar style black | Task 7 |
| Pill chips lack role and selected state | Plan 2 Task 3 (role `button`, `aria-selected` when `active` is given); Step 6 checks |
| log.tsx delete Pressable with no role, ~32 px | Task 11 (the file now only opens the add sheet) |
| Meal rows lost their Breakfast/Lunch label and start with "·" | Task 17 (`MealRow` is gone; the day's menu names each slot and lists its foods) |
| Hindi users see Marathi food names | Task 8 (`itemName`, `foodName`) |

- [ ] **Step 1: The day chips in `src/app/plan.tsx`**

After `import { Sheet } from '../ui/Sheet';` add:

```ts
import { QtyStepper } from '../ui/QtyStepper';
```

Replace

```tsx
              accessibilityRole="button"
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: S.radiusSm, backgroundColor: active ? C.accent : C.card, borderWidth: S.hairline, borderColor: d === weekdayOf(today) ? C.accent : C.border }}>
              <Text style={{ color: active ? C.onAccent : C.text, fontSize: F.small, fontWeight: '500' }}>{t(`wd_${d}`)}</Text>
              <Text style={{ color: active ? C.onAccent : offDays.includes(d) ? C.textFaint : st === 'low' ? C.red : st === 'on' ? C.green : C.textFaint, fontSize: F.small, fontWeight: '500' }}>{offDays.includes(d) ? t('free_short') : k}</Text>
```

with

```tsx
              accessibilityRole="button"
              aria-selected={active}
              accessibilityLabel={offDays.includes(d) ? `${t(`wd_${d}`)}, ${t('free_day')}` : `${t(`wd_${d}`)}, ${k} kcal`}
              style={{ flex: 1, minHeight: S.touch, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: S.radiusSm, backgroundColor: active ? C.accent : C.card, borderWidth: S.hairline, borderColor: d === weekdayOf(today) ? C.accent : C.border }}>
              <Text numberOfLines={1} style={{ color: active ? C.onAccent : C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{t(`wd_${d}`)}</Text>
              {/* An off day is a leaf, not the word: the word overflowed a seventh of a phone at large text. */}
              {offDays.includes(d) ? (
                <Ionicons name="leaf-outline" size={F.small} color={active ? C.onAccent : C.textFaint} />
              ) : (
                <Text numberOfLines={1} style={{ color: active ? C.onAccent : st === 'low' ? C.red : st === 'on' ? C.green : C.textFaint, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{k}</Text>
              )}
```

- [ ] **Step 2: The link and the protein line**

Replace

```tsx
      <Pressable onPress={() => router.push('/food?s=routine')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('plan_follows_pattern')} style={{ paddingVertical: 2 }}>
```

with

```tsx
      <Pressable onPress={() => router.push('/food?s=routine')} accessibilityRole="button" accessibilityLabel={t('plan_follows_pattern')} style={{ minHeight: S.touch, justifyContent: 'center', alignSelf: 'flex-start' }}>
```

Replace

```tsx
          <Small color={totals.protein < targets.proteinG * 0.7 ? C.amber : C.textDim}>{fill(t('plan_protein'), { p: totals.protein, target: targets.proteinG })}</Small>
        </Row>
        <Bar value={totals.kcal} max={targets.kcal} color={statusColor} />
```

with

```tsx
        </Row>
        <Bar value={totals.kcal} max={targets.kcal} color={statusColor} />
        {/* On its own line: beside the total it ran into the edge in Marathi at large text. */}
        <Small color={totals.protein < targets.proteinG * 0.7 ? C.amber : C.textDim}>{fill(t('plan_protein'), { p: totals.protein, target: targets.proteinG })}</Small>
```

- [ ] **Step 3: The line steppers**

Replace

```tsx
                  <Row style={{ gap: 4 }}>
                    <Pressable onPress={() => changeQty(meal.id, i, line, -1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('less')} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="remove" size={16} color={C.text} />
                    </Pressable>
                    <Pressable onPress={() => cycleUnit(meal.id, i, line)} style={{ minWidth: 64, alignItems: 'center' }}>
                      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{qtyText(line.qty)}</Text>
                      <Text style={{ color: C.accentText, fontSize: F.small }} numberOfLines={1}>{`${unitName(info.unit)} · ${info.grams} g`}</Text>
                    </Pressable>
                    <Pressable onPress={() => changeQty(meal.id, i, line, 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('more')} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="add" size={16} color={C.text} />
                    </Pressable>
                  </Row>
```

with

```tsx
                  <View style={{ alignItems: 'center' }}>
                    <QtyStepper
                      value={qtyText(line.qty)}
                      onMinus={() => changeQty(meal.id, i, line, -1)}
                      onPlus={() => changeQty(meal.id, i, line, 1)}
                      minusLabel={fill(t('qty_less'), { food: foodName(info.food, lang) })}
                      plusLabel={fill(t('qty_more'), { food: foodName(info.food, lang) })}
                    />
                    <Pressable onPress={() => cycleUnit(meal.id, i, line)} accessibilityRole="button" accessibilityLabel={fill(t('plan_change_unit'), { unit: unitName(info.unit) })} style={{ minHeight: S.touch, justifyContent: 'center', paddingHorizontal: 6 }}>
                      <Text style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small) }} numberOfLines={1}>{`${unitName(info.unit)} · ${info.grams} g`}</Text>
                    </Pressable>
                  </View>
```

Then `grep -n "hitSlop\|width: 28" src/app/plan.tsx` prints nothing. (`Row` stays used elsewhere in the file.)

- [ ] **Step 4: Water in bottles, in `src/i18n/index.ts` and `src/components/CravingSOS.tsx`**

Add the new key. Before the `};` that closes `en`: `  plan_change_unit: 'Change the measure, now {unit}',`; `mr`: `  plan_change_unit: 'माप बदला, आत्ता {unit}',`; `hi`: `  plan_change_unit: 'माप बदलें, अभी {unit}',`.

Change four values (the keys stay), byte for byte:

```bash
perl -pi -e "s/ glasses: 'glasses',/ glasses: 'bottles',/; s/ glasses: 'ग्लास',/ glasses: 'बाटल्या',/; s/ glasses: 'गिलास',/ glasses: 'बोतलें',/" src/i18n/index.ts
perl -pi -e "s/water_glasses: 'glasses today'/water_glasses: 'bottles today'/; s/water_glasses: 'ग्लास आज'/water_glasses: 'बाटल्या आज'/; s/water_glasses: 'गिलास आज'/water_glasses: 'बोतलें आज'/" src/i18n/index.ts
perl -pi -e "s/toast_water_added: '\+1 glass'/toast_water_added: '+1 bottle'/; s/toast_water_added: '\+१ ग्लास'/toast_water_added: '+१ बाटली'/; s/toast_water_added: '\+1 गिलास'/toast_water_added: '+1 बोतल'/" src/i18n/index.ts
perl -pi -e "s/act_water_2_glass: 'Drink 2 glasses of water'/act_water_2_glass: 'Drink a bottle of water'/; s/act_water_2_glass: '२ ग्लास पाणी प्या'/act_water_2_glass: 'एक बाटली पाणी प्या'/; s/act_water_2_glass: '2 गिलास पानी पिएँ'/act_water_2_glass: 'एक बोतल पानी पिएँ'/" src/i18n/index.ts
```

Then `grep -oE "(glasses|water_glasses|toast_water_added|act_water_2_glass): '[^']*'" src/i18n/index.ts | sed -E "s/^[a-z_0-9]+: //" | grep -E "glass|ग्लास|गिलास"` prints nothing (it also reads `behind_glasses` and `ahead_glasses`, whose values have no unit word).

In `src/components/CravingSOS.tsx`, after `const WAIT_SECONDS = 120;` add:

```ts
/** Step one says a glass of water, so a glass is what is logged, not a whole bottle. */
const GLASS_ML = 250;
```

and replace

```ts
    // Step one is a glass of water, so it may as well be counted.
    if (!waterAdded.current) {
      app.addWater(app.state.settings.bottleMl);
```

with

```ts
    // Step one is a glass of water, so it may as well be counted.
    if (!waterAdded.current) {
      app.addWater(GLASS_ML);
```

- [ ] **Step 5: Typecheck, lint, suite**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: all clean; no new tests.

- [ ] **Step 6: The checks that need no edit**

```bash
grep -n "hasBhajiWeek" src/components/RoutineCard.tsx src/components/TomorrowCard.tsx
grep -n "RoutineCard\|TomorrowCard" "src/app/(tabs)/index.tsx"
grep -n "accessibilityRole=\"button\"" src/ui/components.tsx | head -3
grep -n "aria-selected={active}" src/ui/components.tsx
grep -rn "'glasses'\|water_glasses" src/components src/app
```

Expected: the first prints a line in each card (the bhaji block is gated); the second prints nothing; the third and fourth show the Pill's role and selected state (Plan 2); the last prints only `src/components/WaterSheet.tsx`'s `t('glasses')`, which now reads "bottles".

- [ ] **Step 7: Commit**

```bash
git add src/app/plan.tsx src/components/CravingSOS.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The diet plan's − and +, its measure and its "Meals follow your eating pattern" link are a finger tall on the web too, an off day is a leaf so its chip fits at large text, and the protein line has its own line; water is counted in bottles in every word, and the craving helper logs the glass it asks for

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Controller screen check (web, 375 px, light and dark, English and Marathi at 1.25)

This task is for the controller, not an implementer, and changes no code unless it finds a defect (then fix it in a follow-up commit named for the behaviour, and re-check).

- [ ] **Step 1: Start the web preview and seed it**

Start the `sobat-web` configuration from `.claude/launch.json` (port 8082). In the page's console:

```js
const s = await (await fetch('/seed-dev.json')).json();
localStorage.setItem('sobat.state.v1', s);
location.reload();
```

(`public/seed-dev.json` holds the state as a JSON string, so `.json()` returns the string to store; it is untracked: delete it at the end of the redesign, not in this task.) Resize to 375 × 812. Check `JSON.parse(localStorage.getItem('sobat.state.v1')).version` reads 7.

- [ ] **Step 2: Screens to capture**

In each of light and dark (Settings → appearance, or the browser's colour-scheme emulation), and in each of English at text scale 1 and Marathi at text scale 1.25 (Settings → language, text size), take a screenshot of:

1. **Today, today**: the week strip with today selected, calories left, the menu with a ticked slot, the current slot open with Ate as planned and Change, later slots one line each; the coach line; Water and Walk.
2. **Today, a past day** (tap a day before today in the strip): the amber "N meals missing", "2 of 3 meals", Ate this / Ate other / Skipped with − / + on each line; a day with nothing logged shows "Fill this day from plan".
3. **Today, a future day** (next week's Wednesday via the arrow, then tap it): plan rows with − / +, "Planned X of Y", no Water and Walk, no coach line; change a quantity and see the total move at once.
4. **The add sheet**: from the ➕; type "poha" (one result, no chikoo), add it, step it to 2, type grams; the bar reads "1 item · … kcal"; open a slot that was filled in from the plan and read "Replaces the planned meal"; Eat as planned, Same as yesterday and a saved meal when present; save a two-food meal and see "Save as my meal?".
5. **The tiles**: tap Water (the tank rises, "Added 500 ml water · Undo" for 5 s, Undo removes it), tap Walk twice fast (the fill catches up), long-press Water (bottle sizes), Body → Move (Walk and Sleep), Body → Mind (Breathe: start, read "0:42" and "Breathe in/out", stop), Progress (Weight and Streak; the flag sits on the summit).
6. **Me**: the plain list; Saved meals opens its sheet; with Progress removed from the bar (temporarily in the console: `localStorage` edit of `settings.tabs` to `[]`, reload), Me shows Progress and the bar is Today · ➕ · Me.

- [ ] **Step 3: What to check on each**

- **At most five blocks** on Today by default (strip + number, menu, coach line, tiles); nothing below but the medical note.
- **44 px**: in the console, `[...document.querySelectorAll('[role=button]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map(e => e.getAttribute('aria-label') || e.textContent).slice(0, 20)` returns an empty list on Today, the add sheet, Me and the plan screen (Food → Plan), apart from controls inside third-party pieces, which are noted.
- **Words**: no English on the Marathi screens (except "kcal", "ml", "g" and food names that have no Marathi), no TDEE, BMR, XP, "swaps", "glasses"; no matras clipped at 1.25 (look at the strip's weekdays, the tile lines, the menu rows and the add sheet's bar).
- **Tiles**: the words sit in the same place in every tile; nothing of the art reaches the words; the number has its unit smaller; the line says what is left or the goal ("4 bottles left", "20 min left", "Goal 8 h", "Best N"); with the OS "reduce motion" on (emulate `prefers-reduced-motion: reduce` in the browser's rendering panel, then reload), nothing loops and values land at once.
- **Contrast**: water fill behind the words still reads in light and dark; teal words are the deeper teal; words on teal are dark ink.
- **Page title**: the browser tab reads "Today · Sobat" (or "आज · Sobat"), and changes on Me, Progress and the plan screen.
- **Links**: `/food?s=history` opens History and the address loses `?s=`; pick another section, then open the same link again: History opens again.
- **Accessibility tree** (`read_page`): the tab bar's buttons are named and the focused one is selected; each tile is a button with the label from the spec ("Add one bottle of water. 1.5 of 3 litres."); the week strip's days are named with their mark; the steppers say "Less chapati" / "More chapati".
- **Console**: no errors and no Reanimated warnings while tapping tiles and moving between weeks.

- [ ] **Step 4: Record**

Save the screenshots in the scratchpad (`shots/plan3-*.png`) and write one line per screen in `.superpowers/sdd/progress.md` under the Plan 3 heading: PASS, or the defect and the commit that fixed it.

---

## Self-review

**Checked before handing over:** every task was applied in order, from this document's own code blocks and replacement anchors, to a scratch copy of the repo at `3ff9926` (Plan 1 built, its clean-ups A and B included; nothing stubbed). Every "replace this text" anchor matched. The result typechecks (`tsc --noEmit`, also against the repo's generated typed routes), lints clean with the repo's ESLint config (React Compiler rules included), passes the whole suite with the 62 new tests (907 → 969), and `npx expo export -p web` renders every route statically with Reanimated in the bundle; Plan 4 applied on top of it passes the same checks. The verification greps were run on that copy and print what each step says. Not run: the screens themselves (Task 19 is the controller's).

**Spec coverage (Plan 3 scope):**

1. **Living tiles** (spec "Living tiles", "The tank tiles"): one frame with the fixed layout, 22 radius, 0.5 hairline, words pinned 14 / 15, number 30 with a smaller unit, short line 12, art in the bottom 42% and kept in ratio, water behind the words (Tasks 2, 3); number formats and short lines exactly as the spec lists them, never "of 30" without a unit (Task 1); motion: ≤ 1.1 s ease-out on change and on first appearance, only the wave, the stars and a breathing session loop, reduce motion means no loops and instant values, taps add up (Task 3 `motion.ts`); Water tap adds a bottle for the viewed date and Walk logs ten minutes through `logWalk`, light haptic, "Added … · Undo" for 5 s, long press for bottle size, another amount and the walk goal (Tasks 3, 4); accessibility labels as the spec gives them (Tasks 3, 5); tile maths from Plan 1's `tiles.ts` (all tasks); Sleep, Weight, Streak and Breathe with their own art and taps, on Body and Progress (Task 5) and as optional Today cards (Tasks 16, 17).
2. **Tab bar and Me**: Today, the extras (via `normalizeTabs`, at most two, default Progress), ➕ as a button, Me, and the same list in the sidebar (Task 6); old routes stay as hidden screens (Task 6); `?s=` links clear themselves (Task 7); `me.tsx` lists Coach chat, Body, Diet plan and eating pattern, Saved meals, Grocery and recipes, Settings and Guide, data-driven for Plan 4's two rows (Task 6).
3. **Today**: the week strip with record dots, swipe and arrows, tap to view (Task 14); calories left with "Planned X · Goal Y", "Eaten X of Y" and the protein line (Task 16); the day's menu with done / current / later, past-day missing count, Ate this / Ate other / Skipped, − / +, the record bar, "Fill this day from plan", future-day plan mode with an instant total, the from-plan mark with tap to confirm and "Day looks right" from 21:00 (Tasks 13, 15); one coach line, Water and Walk, the optional cards in order (Tasks 16, 17); the old cards gone from Today (Task 17).
4. **The add sheet**: search first through `useDeferredValue` with the tighter match (tested, Task 8); Eat as planned highlighted, Same as yesterday, Saved meals, Recent foods, Photo and Barcode (Tasks 10, 12); `FlatList`; − / + with any count and a grams box on every food row; `FoodDetailSheet` without its fixed amounts (Task 9); adding a food already there adds to its count (Task 9); "N items · X kcal" and Save; "Save as my meal" after two or more foods (Task 12); every meal through the store with database calories (Tasks 11, 12).
5. **Open UI items**: see the table in Task 18.

**Tests added:** 13 (tile words) + 9 (tile geometry) + 1 (water log) + 5 (bar and Me) + 2 (page titles) + 3 (search and names) + 8 (basket) + 4 (add sheet rows) + 9 (day view) + 5 (week strip and date) + 3 (Today layout) = 62.

**Left to Plan 4, on purpose:** the long press on the bar and the Customize screen (the `todayCards` and `tabs` editors), "Start a new chapter", Plan next week rebuilt on the per-date menus (the day view and the add sheet's plan mode are ready for it), Progress's record calendar and weight trend, Setup, the reminders (and with them the notification-permission card that left Today), the Settings switches for `features` (breaks, mantra, plates) and `reminders.mealPrompt`, and a home for the cards that left Today.
