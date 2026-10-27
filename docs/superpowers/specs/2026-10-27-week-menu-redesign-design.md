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
3. **Today shows four things**: the week strip with calories left (with
   protein as a small line under it), the day's menu, one coach line, and
   two square tiles, Water and Walk. Everything else leaves Today
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
14. **Water and Walk are square tank tiles.**
    - **Water** is counted in bottles, 500 ml by default; 750 ml or 1 L can
      be chosen in Settings.
    - **Walk** is counted in minutes, 10 per tap, toward 30 a day.
    - **One tap adds**, and the tank fills smoothly, showing what is left.
    - Undo lasts 5 seconds; there are no confirm dialogs.
15. **Meals fill themselves from the plan.** A filled meal counts, but
    keeps a "from plan" mark until it is confirmed (the user's choice).
16. **Every tracker is a "living tile"**: the same square frame, with its
    own symbol and its own animation that shows the value. See "Living
    tiles".

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

`Meal` gains `source?: 'manual' | 'plan' | 'auto'`. A missing value reads
as `manual`, for older meals.

- **`manual`**: typed, searched, a photo or a barcode.
- **`plan`**: "Ate as planned", or confirmed from the plan.
- **`auto`**: filled in by the app from the plan and not confirmed yet.

A meal from the plan has `slotId`, `date` (the date being viewed, not
always today) and one `MealItem` per line, with grams from `lineInfo`.
Calories always come from the food database × grams. Custom foods keep
`estimated: true`. Every `addMeal` still goes through `withSlot`.

### Meals that fill themselves: `autoFill` in `src/core/menu.ts`

The user should not have to type what they planned and then ate.

- **When**: 90 minutes after a slot's time, a slot with no meal and no skip
  on that date gets the planned meal logged with `source: 'auto'`.
- **It counts**: in calories and toward a full record, like any meal.
- **Only for today**, and for yesterday when the app was opened yesterday
  (`usage` has a bucket that day). The pure
  `autoFill({ date, now, menu, meals, skips, openedDates })` returns the
  meals to add. `AppProvider` runs it on open and on each clock tick. An
  older day the app was never opened stays `empty`; it offers one button,
  "Fill this day from plan", which logs every open slot with
  `source: 'plan'`.
- **Confirming**: tapping a filled meal sets it to `plan`, and Change opens
  the add sheet. At 21:00 or later, a "Day looks right" button confirms
  every `auto` meal of the day at once.
- **What is never auto-filled**: off days, a slot the user skipped, or a
  slot that already has any meal.
- **Unconfirmed meals stay `auto` for good** (the user's choice). The
  record keeps a small "from plan" mark for those days, so the user can
  see which days were really checked.

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
- `dayRecord` also returns `fromPlan: boolean`, which is true when any
  meal that day is still `auto`. The week strip and the record calendar
  draw such a day in a lighter tone, and History shows "from plan".

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
- `TodayCardId` is one of `coach | waterWalk | menu | weight | sleep | steps | climb | mantra`.
- `glassMl` is renamed `bottleMl`. The migration sets it to 500 when it was
  the old default of 250 and keeps any other value. `walkGoalMin` is added,
  default 30. `waterGoalMl` stays (3000).
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
   · Goal Y". For a past day it shows "Eaten X of Y" instead. A second small
   line shows "Protein 38 of 112 g".
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
5. **Water and Walk**: two square tiles side by side. See "The tank tiles"
   below.

### The tank tiles: `src/components/TankTile.tsx` (new)

- **One component, two uses.**
  - **Water**: blue at about 26% opacity, so text stays readable over it in
    light and dark mode.
  - **Walk**: teal.
- **The tile is a square button.** Top left: the icon and the name. Middle:
  the big amount ("1.5 L", "20 min"). Under it: "of 3.0 L · 3 bottles left"
  or "of 30 min · 10 left". Bottom: a "+ 500 ml" or "+ 10 min" chip.
- **The fill**:
  - It rises from the bottom to `min(1, amount / goal)`, with a Reanimated
    timing of about 900 ms on an ease-out curve.
  - A gentle wave runs along the top edge of the water: a react-native-svg
    path, translated in a loop.
  - When "reduce motion" is on (`AccessibilityInfo.isReduceMotionEnabled`),
    there is no wave and the fill changes instantly.
- **A tap**:
  - **Water** adds one `WaterLog` of `bottleMl` for the viewed date.
  - **Walk** adds one `ActivityLog` (walking, 10 minutes, normal effort) for
    the viewed date, so earned calories follow the same path as every other
    activity.
  - **Both** give a light haptic (expo-haptics) and show "Added 500 ml
    water · Undo" under the tiles for 5 seconds. Undo removes that one
    record.
- **At the goal**: the tank stays full with a ✓, and the line says "Goal
  reached today". Further taps are still recorded.
- **Accessibility**: `accessibilityRole="button"`, with a label such as "Add
  one bottle of water. 1.5 of 3 litres." The value updates after each tap.
  Each tile is far bigger than 44 pt.
- **A long press** opens a small sheet to change the bottle size, enter
  another amount, or change the walk goal.

### Living tiles: `src/components/tiles/` (new; `TankTile` becomes the Water tile)

The user liked the running water and asked that every tracker look like
this, each with its own symbol and its own animation. Every animation
shows the value; none is only decoration.

**One frame, `LivingTile.tsx`**. The user saw the first mockup and said the
positions and numbers looked wrong, so the layout is fixed and the same in
every tile:
- A square with a 22 radius and a 0.5 hairline border. Today shows two per
  row.
- **The text block is pinned to the top**, 14 from the top and 15 from the
  sides, in the same place in every tile:
  - The icon and name: 13, secondary.
  - The number: 30, medium, tabular figures, with its **unit smaller**
    (14, secondary).
  - One short line: 12, secondary.
- **The art zone is the bottom 42% of the tile.** Art never reaches into
  the text block. The one exception is the Water tank, whose
  semi-transparent water rises behind the text; that is the tank's point.
- **The art's aspect ratio is kept.** No stretching, so a marker such as
  the flag stays exactly on the summit.
- **A marker dot sits on the current value** where it helps: the walker on
  the path, and the climber on the ridge.
- **Number formats**:
  - Water: "1.0 L".
  - Walk: "10 min".
  - Sleep: "7 h 10 m".
  - Weight: "98.4 kg".
  - Streak: "5 days".
  - Breathe: "1 min", then "0:42" during a session.
- **The short line says what's left, or the goal**: "4 bottles left", "20
  min left", "Goal 8 h", "−1.6 kg in 3 weeks", "Best 12", "Tap to start".
  It becomes "Breathe in" / "Breathe out" during a session. It never says
  "of 30" without a unit.
- Each tracker supplies only its art, its value, its line and its tap.

| Tile | Symbol | The art shows the value | Tap |
|---|---|---|---|
| Water | droplet | A tank filling from the bottom, with a gentle wave on top | +1 bottle |
| Walk | walker | A dotted path to a goal ring, drawn from the start, with a walker dot on the current minutes | +10 min |
| Sleep | moon | A night arc that fills to hours ÷ target, with three faint stars that twinkle | Opens the sleep check-in |
| Weight | scale | The last 8 weigh-ins as a line that draws itself, with a dot on the latest | Opens the weight entry |
| Streak | flame | A mountain with the flag fixed on the summit; the climbed part of the ridge is drawn and a climber dot sits on today's streak (full at the best streak) | Opens Progress |
| Breathe | wind | A circle that grows for 4 s and shrinks for 4 s during a 1-minute session | Starts or stops the session |

**Where the tiles appear**:
- **Today**: Water and Walk by default. Sleep, Weight, Streak and Breathe
  can be added in Customize; they replace the old `TrackerGrid`.
- **Body**: Walk, Sleep and Breathe.
- **Progress**: Weight and Streak.

**Colour**:
- Each tracker has one muted identity colour, used only inside its tile.
  Fills sit at about 25% opacity and lines at full strength, so text stays
  readable in light and dark mode.
  - Water: blue.
  - Walk: teal.
  - Sleep: purple.
  - Weight: ink grey.
  - Streak: amber.
  - Breathe: pink.
- Teal is still the only colour for actions (buttons, ticks).

**Motion rules**:
- Animate on a change, or once when the tile first appears, for at most
  1.1 s with an ease-out curve.
- Only three things move continuously: the water wave, the sleep stars,
  and the breathing circle during a session.
- With reduce motion on, nothing loops and values change instantly.
- An animation never blocks a tap. Taps made during an animation add up
  and the fill catches up.
- Build it with Reanimated shared values for fills and stroke offsets and
  react-native-svg for the paths. Read reduce motion through Reanimated's
  hook or `AccessibilityInfo`; check the installed version's API.

**Pure helpers**: `src/core/tiles.ts` (new) holds each tile's fraction
(water, walk, sleep and streak, capped at 1), the "left" text inputs, and
the weight line's points. All are unit tested.

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
   past/today/future modes, coach line, the Water and Walk tank tiles.
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
  - `autoFill`: only after slot time + 90 min; never on off days, skipped slots or slots that already have a meal; yesterday only when the app was opened that day; "Day looks right" turns every `auto` meal into `plan`; `dayRecord` reports `fromPlan`.
  - Tank-tile maths, as a pure helper: amount to fill fraction (capped at
    1), the "N bottles left" count (rounded up) for each bottle size, and
    goal reached.
  - A walk tap writes an `ActivityLog` that the earned-calories code
    counts.
  - The `glassMl` → `bottleMl` migration.
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
    `src/components/DayMenu.tsx`, `src/components/tiles/` (`LivingTile.tsx` and one art component per tracker), `src/core/tiles.ts`
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
