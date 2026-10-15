# One eating pattern, and an app that reaches out

Date: 2026-10-15. Status: approved for planning.

## What Varad asked for

On 15 October he wrote that he had missed logging for two or three days and
got no reminder; that on Sundays he wants to decide the month's food by
calories; that he eats in three fixed stages (morning, lunch at one, a light
dinner at seven or eight) plus an extra when needed; that his intake feels
too low and the cravings that follow are why he wants a fixed pattern; that
when he adds a food he wants the day's calories to come down ("total 100,
methi bhaji one bowl is 20, so 80 left"); and that he wants the plan written
in advance, with any change logged in the app.

## What is already built, and the gap

Three pieces exist and do not know about each other:

- **Routine** (Food tab, last section): editable meal slots with times, a
  weekday bhaji, an avoid list and a rupee budget. Off by default. Its
  "log or skip?" prompt only works while the app is open.
- **Week plan** (Food tab, first section): seven days, each meal line by
  line, totals against the target, a red warning below the floor, Balance,
  swaps, copy to weekdays, log a meal with one tap.
- **Budget** (Today): target, eaten, left for the whole day; a "what fits"
  card that splits what is left across four hard-coded meal windows.

The code holds three meal structures: four windows in `nutrition.ts`, the
routine's slots, and seven meal names hard-coded in `buildWeekPlan`. A
three-slot day cannot be expressed; the per-meal budget ignores the
routine; the log screen never shows what is left for this meal while foods
are added; and nothing compares what was planned with what was eaten.

Reminders: every one is either a fixed daily time with fixed words, or an
in-app timer. No code looks at days since the last log. The in-app "log"
nudge (`nudge.ts`) fires only when a meal was already logged today more
than five hours ago, so a day with no logs never triggers it. On the PC the
app is a browser tab (the Windows shell is unbuilt, the relay undeployed),
so with the tab closed nothing can fire.

## Decisions

1. **The routine's slots are the eating pattern, and the pattern is the one
   source of truth.** Each slot has a time and a share of the day's
   calories. The per-slot budget, the week plan's meals, the "what fits"
   plates, the log screen and the reminders all derive from the slots.
2. **`routine.enabled` is the switch**, reworded "Follow my eating pattern".
   On: everything below. Off: today's behaviour (four windows, no slot
   budget, no slot reminders). The week plan is always built from the
   slots, since it is a template.
3. **A week that repeats is the month plan.** No per-date calendar. Any
   day of the week can be edited; the Sunday session is the plan screen.
4. **Deviations are just logs.** Logging anything against a slot is the
   deviation; the slot shows planned beside eaten. No extra step.
5. **Reaching out: the phone gets OS-scheduled reminders that fire with
   the app closed; the web build stays in-app** until the Windows shell
   or the relay exists. Absence reminders stop after three days: nagging
   gets an app uninstalled.
6. **Code does the numbers, the model does the words.** Every rule below
   is a pure function in `src/core` with tests.

## Part 1: the pattern (core)

### Slot shares: `src/core/routine.ts`, `src/core/pattern.ts`

`RoutineSlot` gains `share?: number`, a whole-number weight. A slot without
one uses `DEFAULT_SHARE` by type: breakfast 25, lunch 35, snack 10, dinner
30. Shares are weights, not percentages: `pattern(routine)` returns the
slots sorted by time with shares normalised to fractions summing to 1, so
editing one slot never breaks the others and the slot allowances always add
up to the target. All-zero shares become equal shares.

```ts
export type PatternSlot = { id: string; type: MealType; minutes: number; share: number; slot: RoutineSlot };
export function pattern(routine: Routine): PatternSlot[];
export function allowance(target: number, p: PatternSlot): number;   // round(target * share)
```

`DEFAULT_ROUTINE` gains a dinner slot (`dinner`, 20:00, with bhaji, empty
option) and explicit shares: fruit 15, dry-fruit 10, lunch 35, tea 5, bhel
10, milk 5, dinner 20.

### Which slot a meal belongs to

`Meal` gains `slotId?: string`. Every place that logs a meal sets it: the
log screen, the slot sheet on Today, the plan screen, the fits card.

```ts
export function slotOf(meal: Pick<Meal, 'slotId' | 'type' | 'at'>, slots: PatternSlot[]): PatternSlot | null;
```

Order: a `slotId` that still exists; else the slot of the same type nearest
in time; else the slot nearest in time; null only when there are no slots.
Meals logged before this version therefore land in sensible slots.

### The day, slot by slot

```ts
export type SlotState = { slot: PatternSlot; allowance: number; planned: number; eaten: number; left: number; status: SlotStatus; meals: Meal[] };
export function slotStates(input: { routine: Routine; target: number; meals: Meal[]; nowMinutes: number; skipped: string[]; planned?: Record<string, number> }): SlotState[];
export function currentSlot(states: SlotState[], nowMinutes: number): SlotState | null;
```

`status` is `done` when any meal is assigned to the slot (a different food
still counts as the meal having happened), `skipped` when its skip key is
in today's done actions, otherwise `now`, `missed` or `later` by time, with
the existing grace of 45 minutes and early window of 30. `planned` is the
week plan's total for that slot today, when a plan exists. `left` is
`allowance - eaten`. `currentSlot` is the slot a meal eaten now belongs
to: the latest slot whose window has opened (its time minus the early
margin) and that is not done or skipped, so a late lunch is still lunch
when breakfast was never logged; before any window opens, the first open
slot; once every opened slot is done, the next one; when the day is done,
the nearest by time. Null only with no slots. A meal that names no slot
(a photo, a recipe, the coach) is stamped with it when it is added.

`slotLogged` (food-id matching) is replaced by assignment everywhere it was
used: the routine card, the slot prompt in `useWorkSchedule`.

### The week plan follows the slots: `src/core/weekPlan.ts`

`buildWeekPlan(routine, foods)` makes one `PlanMeal` per slot, in time
order, `id` = slot id, `type` and `time` from the slot. Lines by type:

- breakfast: the slot's default option, plus the rotating breakfast dish
  when the option holds no breakfast-role food;
- lunch: the day's bhaji when the slot takes it, the default option, then
  the staples the plate is missing: two chapati when there is no bread, the
  rotating lunch dal when there is no dal, kakdi koshimbir when there is no
  salad;
- dinner: bhaji, option, then the rotating dinner bread, dal and green
  salad when missing;
- snack: the default option only.

Empty meals are kept, so a slot with nothing planned can still be filled
on the plan screen.

`alignWeekPlan(plan, routine, foods?)` reshapes a saved plan to the
current slots, day by day: a meal whose id matches a slot keeps its lines
and takes the slot's type and time; a meal with no matching id is matched
to the still-unmatched slot of the same type nearest its own time (this is
how the old seven names migrate); anything left unmatched is dropped; a
slot with no meal gets a freshly built one when `foods` is given, an empty
one otherwise. `setRoutine` in the store runs it whenever slots change.

`balanceDay` stops addressing meals by name. Its steps address a meal
type: the first lunch-type meal, the first dinner-type meal, the first
breakfast-type meal, the last snack before dinner for fruit and sprouts,
the first snack for chana. `changes[].params.meal` becomes the meal type,
which the screens already know how to name.

### What fits, from the slots: `src/core/dayPlan.ts`

`DayPlanInput` gains `slots?: PatternSlot[]`, `loggedSlotIds?: string[]`
and `nowMinutes?: number`. With slots, the meals still ahead are the slots
not logged whose turn has not passed: a slot stays ahead until the next
slot's window opens, so a late lunch is still lunch; each gets what is left in
proportion to its share; plates are built by the slot's type; `SlotPlan`
carries the slot `id` so a tap logs against it. Without slots the four
windows behave as today.

### Migration: version 6, `src/store/migrate.ts`

- every slot without a share gets `DEFAULT_SHARE[type]`;
- a routine with no dinner-type slot gets the default dinner slot appended;
- a saved week plan is passed through `alignWeekPlan` without foods, so the
  seven old names land on the slots by type and time and nothing is lost;
- `version` becomes 6; the v5 test fixture gains a v5 to v6 case.

## Part 2: the screens

### Routine screen: shares

The slot editor gains a share row under the time: a stepper in steps of 5
from 0 to 60, showing the share and what it means today: "35 · 560 kcal".
Each slot row on the routine screen shows its allowance beside the time.
The screen's title copy becomes "My eating pattern"; the switch becomes
"Follow my eating pattern" with the description "Budget, plan and reminders
follow these meals".

### Log screen: the live slot budget

When the pattern is on, the four-type segmented control is replaced by one
chip per slot in time order ("Lunch 13:00 · 560 left"), preselected to the
slot a new meal belongs to now (`currentSlot`). A
`?slot=` parameter preselects one. Choosing a chip sets the meal type and
the slot id. Under the basket, a line reads

> Lunch: 85 of 560 · 475 left for lunch · 1,240 left today

and turns amber when the basket passes the slot's allowance, red when it
passes the day. On another day than today the same chips appear and the
meal's time is the slot's time. When the pattern is off the screen is as
it is now.

### Today: the pattern card

`RoutineCard` becomes the pattern card and the one place today's meals are
planned, logged and compared. Header: "My pattern · Mon", and when a week
plan exists the day's planned total against the target. One row per slot
in time order:

- status icon and label, the time or "now" or "missed";
- the planned lines for today, from the week plan when it has them, else
  the slot's default option with the day's bhaji;
- numbers: before eating "320 planned"; after, "eaten / allowance" and the
  difference against the plan, amber when over, dim when under;
- actions: not yet eaten: a one-tap "Log as planned" (opens the slot sheet
  seeded with the plan's lines; the option and bhaji pickers appear only
  when there is no plan for the slot) and "Different", which opens the log
  screen with the slot preselected; eaten: the existing unlog; missed: the
  existing skip.

The walk checklist, avoid hits and the rupee section stay as they are.
`PlanTodayCard` keeps its place on Today only while the pattern is off;
with it on, the pattern card has its job and it is hidden. The fits card
stays where it is and, with the pattern on, builds its plates from the
slots.

### Plan screen and grocery

Meal headings use the slot's label (`slotLabel`), falling back to the meal
type. The `MEAL_KEY` tables in `plan.tsx` and `PlanTodayCard.tsx` go. A
line under the day picker says "Meals follow your pattern · edit", linking
to the routine section. The grocery sheet reads lines only and is
unchanged.

## Part 3: reaching out

### Planned reminders: `src/core/reminders.ts`

```ts
export type Reminder = { id: string; date: ISODate; time: string; title: string; body: string };
export function plannedReminders(input: {
  today: ISODate; nowMinutes: number; days?: number;        // default 7
  routine: Routine; doneSlotIds: string[]; lastLogDate: ISODate | null;
  offDays: number[]; quietStartHour: number; quietEndHour: number;
  lang: Lang; t: (key: string) => string;
}): Reminder[];
```

Pure. For each of the next seven days (slot prompts only for today and the next two, so a week away is not fifty prompts), skipping off days and any time in
quiet hours:

- **Slot prompts**, only when the pattern is on: one per slot at its time
  plus the 45-minute grace, id `slot:<slotId>:<date>`, title
  "<slot label>?", body the existing `slot_prompt`. Today's are left out
  for slots already done or skipped, and for times already past.
- **Absence lines**: with `lastLogDate` null (never logged) there are none.
  Otherwise, for each future date, the gap is the days since the last log
  that are not off days (`missedDays`; today counts as logged when it has a
  meal, and an off day is neither logged nor missed). A gap of 2, 3 or 4 schedules
  one line at 09:00, id `away:<date>`, with copy that escalates gently
  (`away_2`, `away_3`, `away_4`: "Nothing logged yesterday. One meal is
  enough.", "Two days quiet. Your plan is still here.", "Three days. Come
  back when you can; the streak restarts the moment you log."). A gap of
  five or more schedules nothing.

Sorted by date and time.

### Native: reconcile, not re-register

`notify.ts` gains `scheduleAt(id, date, title, body)` (a `DATE` trigger on
the `sobat` channel) and `scheduledIds()` (identifiers from
`getAllScheduledNotificationsAsync`). `useScheduledReminders` computes
`plannedReminders`, lists what is scheduled under the prefix `sobat-r-`,
cancels what is no longer wanted and schedules what is missing. It re-runs
when the wanted set changes (meals today, skips, slots, quiet hours, off
days, the date, the language), keyed on the joined ids so a state change
that does not alter the set does nothing. The generic 19:30 dinner line is
dropped while the pattern is on; the slot prompt covers it. The daily slot
registrations in `useWorkSchedule` go; the office-day blocks stay.

Because every open reschedules a week ahead, a phone that stays closed
for days still gets three days of slot prompts and its absence lines.

### Web and in-app

Unchanged mechanism, corrected rules: the minute tick in `useWorkSchedule`
keeps prompting slots in the open app, now by assignment. The in-app log
nudge rule becomes: nothing logged today and it is 11:00 or later, or the
last meal was more than five hours ago.

### The away card

`daysAway(meals, today, offDays)` is the days since the last log, off days
left out, 0 when today has one or nothing was ever logged. From two days on, Today shows a card at
the top: "3 days without a log", "Everything is still here. Log one meal
and today counts.", with "Add food" and "OK". OK records `away_seen` in
today's done actions and the card stays away for the day.

### The low-intake rule: `src/core/intake.ts`

```ts
export type Intake = { avg: number; limit: number; days: number } | null;
export function lowIntake(input: { meals: Meal[]; today: ISODate; target: number; floor: number; offDays: number[]; lookback?: number }): Intake;
export function intakeFact(intake: Intake): string | null;
```

A day counts when it is before today, not an off day, and has at least two
meals logged, so a half-logged day does not drag the average down. The
last three counted days within fourteen are averaged; with fewer than
three there is no verdict. The limit is the higher of the floor and 85
percent of the target. Below it, Today shows one card: "1,180 kcal a day
over your last 3 logged days. Below the 1,500 line. Cravings come from
this, not from weak will. Today's plan is 1,600." with a link to the plan.
The same fact, as a sentence, joins the coach's and the tip's context so
the model can word it but never change it.

## Not in this spec

A per-date month calendar; deploying the relay; building the Windows
shell; a battery-optimisation step on the permissions screen; moving the
pattern into onboarding; Health Connect. The `SCHEDULE_EXACT_ALARM`
permission is not requested: inexact delivery within a few minutes is fine
for a meal prompt, and the daily reminders already live with it.

## Testing

Core, with vitest: `pattern` (normalisation, zero shares, assignment order,
statuses, currentSlot), `weekPlan` (one meal per slot, staples added only when
missing, align keeps lines and maps the old names by type and time, drops
orphans, balance by type), `dayPlan` with slots, `reminders` (seven days,
off days, quiet hours, done slots today, absence gaps 2 to 4 and the stop
at 5, never-logged), `intake` (counting rule, fewer than three, limit),
`nudge` (log rule), `migrate` (v5 to v6: shares, dinner slot, plan ids).
Screens are verified in the browser with the seed state at phone and
desktop widths in Marathi and English: chips and the live line on the log
screen, the pattern card's numbers before and after logging, the plan
screen's headings, the away and intake cards. `tsc`, lint and the full
suite pass before anything is committed; nothing is pushed.

## Files

New: `src/core/pattern.ts`, `src/core/reminders.ts`, `src/core/intake.ts`,
`src/components/AwayCard.tsx`, `src/components/IntakeCard.tsx`, their
tests.
Changed: `src/core/routine.ts`, `src/core/types.ts`, `src/core/weekPlan.ts`,
`src/core/dayPlan.ts`, `src/core/nudge.ts`, `src/store/defaults.ts`,
`src/store/migrate.ts`, `src/store/AppProvider.tsx`, `src/services/notify.ts`,
`src/services/useScheduledReminders.ts`, `src/services/useWorkSchedule.ts`,
`src/components/RoutineCard.tsx`, `src/components/SlotEditor.tsx`,
`src/components/FitsCard.tsx`, `src/components/PlanTodayCard.tsx`,
`src/components/TipCard.tsx`, `src/app/(tabs)/log.tsx`,
`src/app/(tabs)/index.tsx`, `src/app/(tabs)/coach.tsx`, `src/app/plan.tsx`,
`src/app/routine.tsx`, `src/i18n/index.ts`.
