# The week's menu, a calm app, and an exact calorie record

Date: 2026-10-27. Status: design approved in conversation; written spec waiting for the user's review.

## What Varad asked for

After many days without logging, Varad wanted to start fresh and found the
app too complicated. In their words, the app should be "premium, simple,
useful and easy to access", with "no clutter" (गिचमिड), simple words and a
sober font. The core of the app, as they described it:

- On Sunday they decide what they will eat for the whole week: every day,
  every meal, every food with its quantity.
- All week the app shows that day's menu and they follow it.
- Any day, not only Sunday, they can change a day's menu: today, a future
  day, anything.
- They can go back to any past day and fill in what was eaten.
- When a food and its quantity are entered, the calories are measured from
  them. The main motive is a perfect calorie record.

They also asked that people can add the tabs they want and hide the ones
they don't need, without the app getting confusing.

## What is already built, and the gap

- **Week plan** (`src/core/weekPlan.ts`, `src/app/plan.tsx`): one repeating
  template, `WeekPlan = { days: PlanDay[7] }`, index 0 = Sunday. Each meal is
  keyed by a pattern slot id and holds lines `{ foodId, unit, qty }`.
  `lineInfo`, `dayTotals` and `dayStatus` check a day against the target;
  `balanceDay`, `swapsFor` and `copyToWeekdays` exist. Changing "this
  Wednesday" changes every Wednesday.
- **Eating pattern** (`src/core/pattern.ts`, `routine.ts`): slots with times
  and calorie shares; `slotStates`, `withSlot`, `currentSlot`. It can be
  switched off (`routine.enabled`). The fixed `MEAL_WINDOWS` list in
  `nutrition.ts` is still used beside it by `coach.ts`, `dayPlan.ts`,
  `usePhotoQueue.ts`, `insights.ts` and `offlineCoach.ts`.
- **Logging past days**: `log.tsx` has a `DateStrip` and can add meals to a
  past date. Skips live in `actionsDone`, which only keeps today's entries,
  so a past day cannot record "didn't eat dinner".
- **Today** (`src/app/(tabs)/index.tsx`) renders up to 14 card slots above
  "More today" and is about 3.7 phone screens long for a new user. "Add food"
  is offered five ways. The diet plan is one small card in the middle.
- **Tabs**: Today, Food, Body, Progress (`src/app/(tabs)/_layout.tsx`, custom
  `TabBar`; `Sidebar` on wide screens). The coach sits inside Progress, Mind
  inside Body.
- **Style**: ALL-CAPS `MICRO` labels with letter spacing (`theme.ts:165`), a
  gradient hero card, coloured tiles, emoji in food rows, Mukta on web only,
  white text on the accent at 1.9:1 in dark mode, a native app locked to
  dark (`app.json` `userInterfaceStyle: "dark"`).

## Decisions

Made with Varad on 2026-10-27, one question at a time:

1. **Each week is its own menu.** Menus are stored per date. A new week
   starts as a copy of the week before, so nothing has to be planned if
   nothing changes. An edit changes only that date. There is no "this day
   or every week?" question.
2. **Today's main job**: the calories left, and the day's menu to tick off.
   The ➕ button is for anything eaten that is not on the menu.
3. **Today shows four things**: the week strip with calories left, the day's
   menu, one coach line, and water + protein. Everything else leaves Today
   or can be added back through Customize.
4. **Tabs**: Today · ➕ · Progress · Me. Today, ➕ and Me are locked. The user
   may add up to two extra tabs (Progress is one of them by default) from
   Progress, Coach, Body, Sleep and Diet plan. That makes five items at
   most. A hidden tab's page stays reachable from Me.
5. **Today's cards**: "Calories left" is locked. The coach line, water +
   protein and the day's menu can be switched off and reordered. Weight,
   sleep check-in, steps, streak + mountain and the daily mantra can be
   added. A Reset restores the default.
6. **Fast logging**: "Ate as planned" (one tap logs the planned foods and
   quantities), "Same as yesterday", saved meals ("my usual thali"), and a
   − / + stepper with a grams field.
7. **Off by default** (code kept, a switch in Settings): eye-care screen
   breaks, the daily mantra, the auto-generated "What fits today" plates,
   and every reminder except the meal-time prompt.
8. **Reminders**: on by default, only the meal-time prompt ("Lunch as
   planned?") with an "Ate as planned" action. Off by default: "Fill
   yesterday", "Plan next week", the Monday report.
9. **Setup**: four quick steps, with empty fields and placeholders.
10. **Look**: follow the phone (light or dark), one teal accent.
11. **Sober style**: simple words, no ALL-CAPS labels, one font, two
    weights, four sizes, no gradients, no emoji in food rows, at most five
    blocks per screen.
12. **Font**: the phone's own font (Roboto with Noto Sans Devanagari on
    Android, the system stack on web).
13. **Existing users get the new defaults once**, through the migration.
    Everything turned off can be turned back on.

One decision follows from the others and is made here: **the eating pattern
is always on.** A menu is a list of slots, so the app cannot have a menu
without slots. `routine.enabled` is retired (read as true), and the four
`MEAL_WINDOWS` become nothing more than the default slot set for a new
person.

## Part 1: data (core)

### Menus per date: `src/core/menu.ts` (new)

```ts
export type DayMenu = {
  date: ISODate;
  meals: PlanMeal[];   // reuses weekPlan.ts: { id: slotId, type, time, lines }
  editedAt: string;    // ISO time of the last change, for sync
};
```

State gains `menus: DayMenu[]`, one record per date. The week is a view, not
a stored object: Monday to Sunday, the way `plan.tsx` already orders it.

Pure functions, all unit tested:

- `menuFor(date, menus)`: the stored menu or null.
- `ensureWeek(monday, menus, routine, foods)`: returns the seven menus for
  that week. For each missing date it copies the same weekday from the
  previous week (`date − 7`); failing that, from the newest earlier menu
  with the same weekday; failing that, `slotPlanLines` from the pattern, as
  `buildWeekPlan` does today. It never overwrites an existing date.
- `setMenuLine`, `addMenuLine`, `setMenuMeal`: edit one date only. They
  return a new array and stamp `editedAt`.
- `copyDay(from, to, menus)`: the existing "copy to weekdays", now by date.
- `alignMenu(menu, routine)`: when the pattern's slots change, a date's
  meals follow them, as `alignWeekPlan` does. Only today and future dates
  are aligned. Past dates are history.

`dayTotals`, `dayStatus`, `balanceDay`, `lineInfo` and `swapsFor` take a
`PlanDay`-shaped `{ meals }` and are reused unchanged.

### Skips that last: `slotSkips`

State gains `slotSkips: { id: string; date: ISODate; slotId: string }[]`.
"Skipped" on any date writes one record, and "Ate this" or "Ate other" for
that slot removes it. `slotStates` and `withSlot` read skips for the date
being looked at, not `actionsDone`. Today's skip keys in `actionsDone` move
across in the migration.

### What was eaten, against the plan

`Meal` gains `fromPlan?: boolean`. "Ate as planned" logs a meal with
`slotId`, `date` (the date being viewed, not always today),
`fromPlan: true`, and one `MealItem` per line with grams from `lineInfo`.
Calories always come from the food database × grams. Custom foods keep
`estimated: true`. Every `addMeal` still goes through `withSlot`.

### The record: `dayRecord` in `src/core/record.ts` (new)

```ts
type DayRecord = 'full' | 'partial' | 'empty' | 'planned' | 'off';
dayRecord(input: { date; today; menu; meals; skips; offDays }): DayRecord
```

- `off`: an off day in `settings.offDays`.
- `planned`: a date after today.
- `full`: every slot in that date's menu has a meal or a skip.
- `partial`: some slots have one.
- `empty`: none.
- **Today counts too**: it is `partial` until its last slot is settled.

`weekRecord(monday, …)` returns the seven values for the strip, and
`recordStreak` counts the full days in a row. A day with nothing logged yet
today doesn't break the streak; this also fixes the "streak 0 every
morning" bug in `insights.ts`.

### Saved meals

State gains `savedMeals: { id: string; name: string; lines: PlanLine[] }[]`.
"Save as my meal" is offered after logging any meal with two or more items.
Logging a saved meal uses the same path as "Ate as planned".

### Settings

`Settings` gains:

```ts
tabs: TabId[];                 // extras only, max 2; default ['progress']
todayCards: { id: TodayCardId; on: boolean }[];
features: { breaks: boolean; mantra: boolean; autoPlates: boolean };
reminders: { mealPrompt: boolean; fillYesterday: boolean; planWeek: boolean; weeklyReport: boolean };
```

- `TabId` is one of `progress | coach | body | sleep | plan`.
- `TodayCardId` is one of `coach | waterProtein | menu | weight | sleep | steps | climb | mantra`.
- A pure `normalizeTabs` drops unknown ids and duplicates and keeps at most
  two, so a bad value from sync can never hide the core tabs.

### Migration: version 7, `src/store/migrate.ts`

It builds on `STATE_VERSION` from the sync-fix branch, so that branch must
be merged first.

- **The old template becomes this week.** `weekPlan`, if present, is
  written into `menus` for the current Monday-to-Sunday dates. Index 0 of
  the template is Sunday. `weekPlan` is then dropped.
- **The pattern switches on.** `routine.enabled` is set to true. A person
  with no custom slots gets the default slots.
- **Skips move.** Today's skip keys move from `actionsDone` to `slotSkips`.
- **New defaults, once:**
  - `features` all false.
  - `reminders.mealPrompt` true and the rest false.
  - `tabs: ['progress']`.
  - The default `todayCards`.
- **Nothing logged is touched.** Meals, weights, sleep and the rest stay
  exactly as they are.

### Sync

`menus` merges per date by `editedAt`, and `slotSkips` and `savedMeals`
merge per id. Each goes into `merge3` with the other collections, using the
sync branch's "carry unknown keys" handling, so an older build keeps a
newer build's menus.

## Part 2: screens

### Style first: `src/ui/theme.ts`, `src/ui/components.tsx`

- **Type scale**: big number 44, title 20, body 16, small 13. Weights 400
  and 500 only. Line heights come from the size times the text scale, so
  Devanagari matras never clip at 1.25×.
- **Labels**: `MICRO` becomes a normal-case small label with no letter
  spacing.
- **Colour**:
  - One accent, teal, used for the main button, ticks and the current
    item.
  - A new `onAccent` dark-ink token gives text on the accent at least
    4.5:1.
  - `textGhost` is not used for text.
  - Light-mode `textFaint` is raised to at least 4.5:1.
- **Flat surfaces**: no gradients, no decorative circles, no emoji in food
  rows. The `FoodThumb` image or a neutral initial replaces the emoji.
- **Font**:
  - Native: no `fontFamily`, so the system font is used.
  - Web: `system-ui, Roboto, "Noto Sans Devanagari", sans-serif`.
  - Mukta is removed from `public/fonts`, the web CSS and the
    `@expo-google-fonts/mukta` dependency.
- **Theme**: `app.json` `userInterfaceStyle` is set to `"automatic"`. The
  status bar is chosen from `themeMode()`, not a hard-coded colour.
- **Controls**:
  - Every control is at least 44 pt.
  - `Btn`, `Pill`, `Toggle` and `Segmented` get roles and selected or
    checked state.
  - `Field` labels its input.
- **Words**: plain words only. The UI shows no TDEE, BMR, XP, "day score",
  "swaps", "verified record" or "full-day sheet". These live in `i18n` in
  all three languages. Header titles and the remaining hard-coded English
  move into `i18n` too.

### Tab bar and Me: `src/app/(tabs)/_layout.tsx`, `TabBar.tsx`, `Sidebar.tsx`

- The bar is Today, the extras from `settings.tabs`, ➕ and Me, in that
  order around the centred ➕. `Sidebar` shows the same list on wide
  screens.
- ➕ is a button, not a tab. It opens the add sheet for the date and slot
  being viewed.
- A long press on the bar opens Customize.
- `me.tsx` (new) is a plain list:
  - Coach chat.
  - Body (move, yoga, sleep, mind).
  - Diet plan and eating pattern.
  - Saved meals.
  - Grocery and recipes.
  - Start a new chapter.
  - Customize.
  - Settings.
  - Guide.
- Old routes (`food`, `body`, `log`, `growth`, `fit`, `mind`, `coach`) stay
  as hidden screens, so links and notifications keep working. Deep links
  that use `?s=` clear the param after applying it.

### Today: `src/app/(tabs)/index.tsx`

From top to bottom:

1. **Week strip.** Monday to Sunday of the viewed week, with a dot per day
   from `weekRecord`: filled teal for full, amber for missing meals, an
   outline for planned. Swiping goes to the previous or next week. Tapping
   a day views it.
2. **Calories left**, as one big number. Under it, a plain line: "Planned X
   · Goal Y". For a past day it shows "Eaten X of Y" instead.
3. **The day's menu.** One row per slot.
   - **Done**: ticked, with food names and kcal, folded to one line. Tap to
     edit.
   - **Current**: open, with each line's food, quantity and kcal, and two
     buttons, **Ate as planned** and **Change**. Change opens the add sheet
     with the planned lines already in the basket, to edit quantities or
     swap foods.
   - **Later**: one line with time and planned kcal.
   - **Past day**: an amber "N meals missing" note. Each open slot shows
     **Ate this / Ate other / Skipped**, with a − / + on each line. A
     record bar shows "2 of 3 meals".
   - **Future day**: the same rows in plan mode. Edits change that date's
     menu, and the day's total against the target updates at once.
4. **Coach line**, one sentence. It reads the pattern via `slotAt` (see
   Part 3).
5. **Water and protein**: two small bars, with a + on water.

Cards switched on in Customize render after these, in the user's order.
`StartHereCard`, the tracker grid, `FitsCard`, `PlanTodayCard`, the
mountain and the mantra no longer render on Today by default.

### The add sheet: `src/components/AddSheet.tsx` (new), replacing the adding part of `log.tsx`

From top to bottom:

1. **Search** at the top, so results sit above the keyboard. Fuse runs
   through `useDeferredValue`, with tighter matching so "poha" doesn't
   return chikoo.
2. **Eat as planned** for the viewed slot, highlighted.
3. **Same as yesterday's** slot.
4. **Saved meals.**
5. **Recent foods.**
6. **Photo and barcode**, as two small buttons.

Results and lists use `FlatList`. Each food row has a − / + stepper with
any count and a grams field; `FoodDetailSheet` loses its fixed `QTYS`.
Adding a food that is already in the basket increases its count instead of
replacing it. A bottom bar shows "N items · X kcal" and **Save**.

### Plan next week: rework of `src/app/plan.tsx`

- **Top**: the week's dates, with arrows to move between weeks.
- **One row per day**: the day, its main dish, its total, and a status: ✓
  on target, "high", "low", or "off" for off days.
- **Below**: the week's average against the goal.
- **Tap a day** to open it in the same plan-mode menu as Today's future
  days.
- **One button**: "Looks good, save week". Saving only stamps the week as
  reviewed; the menus are already stored.
- Balance and swaps stay inside the day view.

### Progress: `src/app/(tabs)/progress.tsx`

1. **Weight trend**: the latest smoothed weight. `weightTrend` uses a
   time-weighted average instead of the last N entries. It shows the change
   over the last 3 weeks, a sparkline, and the goal with its date and
   **year**.
2. **Stat cards**: Lost, To go, and Logged (full days this week out of 7).
3. **Record calendar**: the month as a grid of dots coloured by
   `dayRecord`. Tapping a day opens it on Today.
4. **Weekly average** calories against the goal.
5. **The mountain** as one progress row (camp and XP). Badges are behind
   it. History is a link.

### Setup: `src/app/onboarding.tsx`

Four short steps with a progress line:

1. **Language.**
2. **About you**: sex, birth year, height.
3. **Weight and goal**, with the healthy range for that height shown.
4. **Done**: shows the daily target in plain words.

- Fields start empty, with placeholders such as "e.g. 72". They are not
  pre-filled.
- Activity starts as "mostly sitting" and the pace as 0.5 kg a week. Both
  can be changed in Me → Settings.
- The validation already on the safety branch stays: adult ages, a
  four-digit year, a goal no lower than the healthy minimum.
- The tour is not shown after setup. It moves to Me → Guide.

### Customize: `src/app/customize.tsx` (new)

- **Tab bar**: Today, ➕ and Me shown locked. Up to two extras from the
  list. Switching a third on asks which one to replace.
- **Today**: the locked "Calories left", the three default cards with
  switches and drag handles, and the optional cards.
- **Reset to default.**

### Start a new chapter

This is in Me. One confirm sheet explains it in plain words. It:

- Sets `profile.startWeightKg` to the latest weight and records a
  `chapterStart` date.
- Resets the weekly challenge.
- Starts the streak from today.
- Deletes nothing. Progress counts "Lost" and the climb from the chapter
  start, and History still shows everything.

## Part 3: making the meal clocks agree

`slotAt(routine, minutes)` is added to `pattern.ts`. Every meal-shaped
decision reads it and keys by slot id:

- `coach.ts` (next meal, late dinner).
- `dayPlan.ts`.
- `usePhotoQueue.ts`, instead of `mealTypeForHour`.
- `expectedKcalByHour`.
- `useCoach.ts` and `offlineCoach.ts`, when they pick a plate.

The work-schedule "Next: lunch at 13:00" in `BreakCheckin` only shows when
breaks are on. Once all of these use `slotAt`, `MEAL_WINDOWS` is used only
to build the default slots.

## Part 4: reminders

`src/core/reminders.ts` and `src/services/useScheduledReminders.ts`:

- **Meal-time prompt** (on by default): one notification at each slot time
  of today's menu, titled with the slot and the planned kcal.
  - It carries an **Ate as planned** action through an expo-notifications
    category. Check the SDK 57 API for categories and response handling
    before writing it.
  - Tapping the action logs the planned meal for that date and slot without
    opening the app. Tapping the body opens Today on that slot.
  - A slot that is already done or skipped is not prompted.
  - It reschedules a week ahead on open, as now, and skips off days.
- **Fill yesterday** (off by default): 09:00, only if yesterday is
  `partial` or `empty`.
- **Plan next week** (off by default): Sunday 18:00.
- **Weekly report** (off by default): Monday 09:00 with full days, average
  calories against the goal, and the weight change.
- **Off by default too**: the hourly nudges, water, eye breaks, the sleep
  check-in and the "away" lines. Their code stays.
- **Web and PC**: in-app only until the relay is deployed. That is not in
  this spec.

## Safety

- A planned day below the floor shows "low" and offers Balance. It is never
  saved silently as a plan to eat under the floor.
- Skipping is recorded as a fact and never praised. Once skipped slots push
  three days below the line, the existing `lowIntake` message shows.
- Custom foods ask for calories per 100 g and are marked estimated, so a
  full record still says how much of it was estimated.
- The safety branch's target rules apply to every planned day and every
  total.

## Not in this spec

- Deploying the relay, moving away from Drive, or Play Store work.
- Splitting `AppProvider`. Derived values that the new screens read are
  memoized where they are touched.
- The icon-import cleanup and the `animated.ts` per-frame re-render, except
  where a rebuilt screen replaces the component anyway.
- New foods in the database.

## Order of work

Each step is its own commit series and is tested before the next.

0. **Merge the two fix branches** (`refs/heads/claude/quizzical-jang-818250`,
   `refs/heads/claude/zealous-cori-0b7468`) into `main`, with the user's OK.
1. **Style**: theme tokens, type scale, contrast, the system font,
   follow-the-phone, the status bar, accessible controls, words.
2. **Data**: `menu.ts`, `record.ts`, `slotSkips`, `savedMeals`, settings,
   migration v7, sync merge, `slotAt`.
3. **Tab bar and Me.**
4. **Today**: week strip, calories left, the day's menu with
   past/today/future modes, coach line, water + protein.
5. **The add sheet.**
6. **Plan next week.**
7. **Progress.**
8. **Setup.**
9. **Customize and Start a new chapter.**
10. **Reminders.**

## Testing

- **Unit (vitest)**:
  - `ensureWeek`: copies from the previous week, falls back to the newest
    same weekday, then to the pattern, and never overwrites.
  - Per-date edits leave other dates alone.
  - `alignMenu` leaves past dates alone.
  - `dayRecord`: every state, including off days and today.
  - `recordStreak` doesn't drop to 0 in the morning.
  - `slotSkips` set and clear.
  - "Ate as planned" on a past date logs to that date with database
    calories.
  - Saved meals.
  - `normalizeTabs`: unknown, duplicate and more than two.
  - Migration v7: template → this week's dates, Sunday mapping, skips
    moved, defaults set once, logs untouched.
  - `merge3` with menus edited on two devices.
  - `slotAt` with a 21:30 dinner and two snack slots.
- **On screen**: the web preview at 375 px in light and dark, in English
  and Marathi at text scale 1.25. Check each step's screen; take
  screenshots of Today (past, today, future), the add sheet, plan next
  week, Progress, setup and Customize.
- **Done means**: `npx tsc --noEmit`, `npx expo lint` and `npx vitest run`
  are all clean.

## Files

- **New**:
  - `src/core/menu.ts`, `src/core/record.ts`
  - `src/components/AddSheet.tsx`, `src/components/WeekStrip.tsx`,
    `src/components/DayMenu.tsx`
  - `src/app/(tabs)/me.tsx`, `src/app/customize.tsx`
  - tests for each new core module
- **Changed**:
  - **Core**: `src/core/types.ts`, `pattern.ts`, `weekPlan.ts` (shared
    helpers stay), `coach.ts`, `dayPlan.ts`, `insights.ts`,
    `offlineCoach.ts`, `reminders.ts`, `sync.ts`
  - **Store**: `src/store/migrate.ts`, `defaults.ts`, `AppProvider.tsx`
  - **UI**: `src/ui/theme.ts`, `components.tsx`, `TabBar.tsx`,
    `Sidebar.tsx`, `FoodDetailSheet.tsx`
  - **Screens**: `src/app/(tabs)/_layout.tsx`, `index.tsx`, `progress.tsx`,
    `src/app/plan.tsx`, `onboarding.tsx`, `_layout.tsx`, `+html.tsx`
  - **Services**: `src/services/useScheduledReminders.ts`,
    `usePhotoQueue.ts`
  - **Text**: `src/i18n/index.ts`
  - **Config**: `app.json`
- **Removed from use**: Mukta fonts, `StartHereCard` on Today, the tour
  after setup, the template `weekPlan` (after migration).
