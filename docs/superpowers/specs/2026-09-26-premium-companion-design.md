# Sobat v0.4 — premium interface and a companion that reaches out

**Date:** 2026-09-26
**Status:** design, awaiting Varad's approval
**Scope:** three parts, each becoming its own implementation plan, built in order

## 1. What this version is for

Varad's brief, in his words: the app solves his diet, takes care of his
health, makes him happy and energetic, always approaches him, gives proper
feedback, and uses AI to make his lifestyle better. He also wants the
LookAway class of screen-break features, water reminders, and a premium
interface that is laid out differently on the phone and on the desktop.

The review on 2026-09-26 (ten days of seeded data, 375 px and 1440 px) found:

- Two stacked headers on every phone tab; the first screen is mostly chrome.
- Ten same-weight cards on Today; nothing leads the eye.
- No motion anywhere. Rings and bars snap, taps only dim.
- Only Today has a desktop layout. The other five tabs are the phone column
  centred in a 1440 px window.
- Real bugs: clock times shown in UTC (`03:10` for an 08:40 breakfast, which
  also disables the late-eating rule), day-score rings that read `0%` at
  noon, and untranslated leftovers in a Marathi interface.
- Nothing the app does is initiated by the app. Every card waits to be opened.

## 2. Principles that do not change

1. **Code does the numbers, the model does the words.** Every new decision in
   this version (which break is due, how far behind on water, whether the
   coach should speak first) is a pure function in `src/core` with tests. The
   model only rewords, and its output still passes `guardrails.ts`.
2. **Restyle through tokens and primitives.** Screens are composed from
   `src/ui/theme.ts` and `src/ui/components.tsx`. A future Stitch batch
   retokens everything at once. No screen carries its own colours.
3. **Works with the PC off.** Every reminder, break and score has a fallback
   that is plain templated text.
4. **Never nags.** Anything that interrupts backs off when skipped, respects
   quiet hours and a work schedule, and is quiet when the desk is empty.

## 3. Design language additions

**Tokens** (`theme.ts`)

- Motion: `M.fast 180 ms`, `M.base 320 ms`, `M.slow 600 ms`, one ease-out
  curve. Rings and bars fill on mount; pressables scale to 0.98; toasts slide
  up. Reanimated is already installed and unused; it becomes the animation
  layer. Reduced-motion preference turns all of it off.
- Type: add `F.hero 56` (weight 200, letter-spacing -2) for the one big number
  on Today and the break countdown.
- Layout: `S.gutter 16` phone, `S.gutterWide 24` desktop, `S.maxWide 1360`, a
  12-column desktop grid helper. Breakpoints stay at 760 and 1080.
- Card variants: `rail` (2 px coloured left edge, used only for the decision
  card and alerts), `flat` (exists), and `tile` (compact, for the strip).

**New primitives** (`components.tsx` or `src/ui/`)

- `TopBar`: one compact bar per tab replacing the stock navigation header.
  Title in English with the chosen language beside it, right-side slot for
  chips and actions, 56 px tall.
- `HeroRing`: animated ring with the big number inside and a caption.
- `Tile`: 96 px wide compact stat for horizontal strips.
- `Checklist`: rows with a check circle; state persists for the day.
- `Sheet`: bottom sheet on phone, centred modal on desktop.
- `Toast`: the single in-app interrupt surface (nudges, water, posture,
  pre-break warning), bottom on phone, bottom-right on desktop.
- `Face`: five drawn SVG mood faces, replacing emoji.
- `Skeleton`: placeholder while the store loads.
- Charts gain axes: day letters under bars, min and max labels on lines, a
  labelled target line.

**Navigation**

- Phone: five slots. Today · Growth · **+** (raised centre button opening the
  Log sheet) · Move · Mind. Coach becomes a chat icon in every TopBar with a
  dot when the coach has spoken first. Six tabs at 375 px is why the labels
  are 10 px today.
- Desktop: sidebar keeps all six destinations plus Memory and Settings; the
  bottom of the sidebar carries a live break countdown ring and pause button,
  water glasses so far, and the AI status. That is the LookAway menu bar,
  moved indoors.

## 4. Part 1 — Foundation: shell, Today, desktop layouts, bugs

**Bugs first, each with a test.**

- Local-time helpers in `core/date.ts` (`localHHMM`, `localHour`) replace
  every `slice(11, ...)` on ISO strings. A test pins `TZ=Asia/Kolkata`.
- Day score: before a metric's window, the ring shows "later" not `0%`.
  Movement is `null` until 18:00 unless a session is done; eating is `null`
  until the first meal; water is judged against pace, not the full goal.
  `scoreDay` already takes `hour`; movement and water follow eating's pattern.
- Every visible string goes through i18n, including pattern sentences (built
  from keys plus numbers), exercise categories, readiness reasons, units.

**Phone Today**, top to bottom:

1. TopBar: "Good afternoon, Varad" as the title (one line, `F.h2`), date and
   streak as the subtitle, AI dot, coach icon, settings.
2. HeroRing 156 px with kcal remaining; meters for eaten, protein, water (with
   a pace tick), steps; three quick actions. The only large card.
3. Decision card with a coloured rail, one line of words, actions as a
   `Checklist`, and the BMR/TDEE numbers behind a "Why" disclosure.
4. **Now strip**: horizontal tiles. Energy (readiness), Sleep, Next break,
   Mood, Water pace. Tap opens the relevant screen. Replaces three cards.
5. Day score: five rings under a composite number and one sentence naming the
   biggest lever ("sleep is pulling this down").
6. Morning brief or evening review card, only in its window (see Part 2).
7. Today's meals, each row tappable → meal `Sheet` with items, portion pills,
   delete. Date chevrons for yesterday and back.
8. Medical note.

Week summary and patterns move to Growth. Break monitor detail moves into the
Now strip and the break panel.

**Desktop Today**: a top bar with the date, streak and a "+ Log" button; a
three-column grid that fills the fold: hero and meals left; decision, tip and
review centre; break panel (countdown, next kind, pause and take-now buttons,
today's compliance bar), sleep and scores right.

**Desktop layouts for the other five tabs**

- Growth: headline and consistency across the top, metric tiles five across,
  charts two across, eye-care section (Part 2) at the bottom.
- Log: two panes. Search, meal type pills and results left; basket, today's
  meals, water and weight right.
- Move: hero and today's moves left; week, phase progress and history right.
- Mind: check-in and tools left; today's entries and helpline right.
- Coach: chat centre; a right rail with today's numbers and the food options
  the coach has offered.

**Phone Log** becomes the sheet behind the centre button and stays a route on
desktop. Search is focused on open; a "recent and favourites" row with "same
as yesterday" sits above results; the basket is sticky at the bottom with the
total and Save; water and weight are a compact row at the top.

**Mind** gets `Face`, tools as three icon tiles, and the same layout on both
sizes. **Move** gets translated chips and a phase progress line.

**Feedback on every action**: haptic on phone and a toast on desktop for +1
glass, meal saved, session done, break finished.

## 5. Part 2 — Companion: breaks, water, and reaching out

### 5.1 Break system (LookAway parity, in `core/breaks.ts`)

```ts
type BreakKind = 'micro' | 'long' | 'posture' | 'blink';
type Strictness = 'gentle' | 'normal' | 'strict';

type BreakSettings = {
  enabled: boolean;
  micro:   { enabled: boolean; everyMinutes: number; seconds: number }; // 20, 20
  long:    { enabled: boolean; everyMinutes: number; seconds: number }; // 60, 180
  posture: { enabled: boolean; everyMinutes: number };                  // 30
  blink:   { enabled: boolean; everyMinutes: number };                  // off, 10
  strictness: Strictness;      // gentle: leave any time; normal: skip + snooze
                               // with a daily budget; strict: no skip, overlay
                               // takes focus
  maxSkipsPerDay: number;      // 3
  snoozeMinutes: number[];     // [1, 5, 15]
  smartPause: { whenFullscreen: boolean; whenOnCall: boolean; apps: string[] };
  schedule: { days: number[]; startHour: number; endHour: number } | null;
  quietStartHour: number; quietEndHour: number;
  sound: boolean;
  pausedUntilMs: number | null;
};
```

Pure functions, all tested:

- `nextDue(ctx)` → `{ kind, inSeconds }`. A long break resets the micro and
  posture clocks. Idle of 180 s resets micro and posture; idle of 5 min
  resets long. Posture and blink never take the screen; they are 6 s and 3 s
  toasts.
- `isPaused(ctx)` from `pausedUntilMs`, schedule, quiet hours, fullscreen,
  on-call, and the foreground app list.
- `canSkip(logsToday, settings)` enforces the daily budget in normal mode.
- `suggestLongerInterval` stays; it now works per kind.
- `BreakLog` gains `kind` and `seconds`. `breakStats` reports per kind and an
  eye-care score (taken ÷ offered, weighted micro 1, long 2).

**Overlay** (`BreakOverlay`, rewritten): near-empty screen, a slowly breathing
ring around the countdown, one calm line, and for long breaks two mobility
moves pulled from the exercise database with their steps. Bottom edge: skip
or snooze according to strictness, "I'm done" once time is up. Corner micro:
"Micro break 3 of 12 · long break in 38 min". A soft chime at start and end
when `sound` is on, two short bundled files, no downloads.

**Pre-break toast** 60 s before: "Break in 60 s" with +1 / +5 / +15 snooze
and skip per strictness.

**Windows shell** (Tauri, written here, compiled on the PC):

- Overlay as its own always-on-top, undecorated, taskbar-hidden window per
  monitor, loading the web build at a `/break` route with the kind, seconds
  and start time as query parameters. It emits `sobat:break-ended` with the
  action; the main window logs it and Rust closes the overlays.
- `foreground_state()` command returns `{ fullscreen, exe, onCall }`.
  Fullscreen: foreground window rect equals its monitor rect. `exe`: process
  image name of the foreground window. `onCall`: the CapabilityAccessManager
  consent-store registry entries for microphone and webcam with
  `LastUsedTimeStop == 0`. Best effort; any failure reads as "not paused".
- Global shortcuts via `tauri-plugin-global-shortcut`: Ctrl+Alt+B take a
  break now, Ctrl+Alt+P pause for an hour, Ctrl+Alt+W add a glass.
- Tray tooltip updated each minute: "Next break 12 min · 5/12 glasses".
- Tray menu gains "Take a break now" and "Pause until tomorrow".

**Browser tab** (no shell): overlay stays in-tab as today; fullscreen pause
uses `document.fullscreenElement` and picture-in-picture; a hidden tab counts
as idle.

**Phone**: no overlay. Micro breaks are off by default. Long breaks, posture
and water arrive as scheduled notifications inside the schedule window; the
settings object is the same one, so a change on either device is honoured
once state is shared (sync remains out of scope).

### 5.2 Water (`core/water.ts`)

- `waterPace(now, ml, goalMl, glassMl, wakeHHMM)` → expected ml by now
  (spread from wake time, or 07:00, to 21:00), glasses behind or ahead, pct.
  The existing `expectedWaterByHour` in `nudge.ts` moves here.
- `nextWaterReminderMinutes(pace, settings)`: auto mode divides remaining
  glasses by remaining hours, clamped to 30–90 min, and skips a cycle when
  ahead; fixed mode uses `everyMinutes`. Both respect quiet hours and the
  work schedule, and the existing skip-streak backoff.
- The Today water meter shows a pace tick; the Now strip shows "1 glass
  behind" or "on pace".
- Toast (desktop) or notification (phone): "Glass 5 of 12, one behind" with
  "+1 glass" and "Later". On the phone the repeating notification is
  re-registered with the computed cadence each time the app opens, replacing
  the single 15:00 reminder.
- Settings gains `water: { remindersEnabled, mode: 'auto' | 'fixed',
  everyMinutes }`.

### 5.3 Reaching out (`core/outreach.ts`)

The app initiates, on a fixed daily rhythm plus event triggers. Code picks
the moment and the facts; the model rewords; offline uses templated lines.

- **Morning brief** at 07:30 or first open: sleep check-in prompt, then a
  card with today's target, the session type from readiness, and one focus
  chosen from patterns. Dismisses itself after the check-in.
- **Midday**: the existing "log your meal" nudge, unchanged.
- **Evening review** at 21:30, generated automatically when the day has data:
  the composite score, what went well, what to fix, and one thing for
  tomorrow. Saved as the day note in memory, as today. On the phone this is
  the existing 21:30 notification, now opening straight to the card.
- **Weekly letter** on Sunday at 19:00 from the existing weekly report,
  surfaced as a notification and a Growth card.
- **Coach speaks first**: `pickOutreach(state)` returns at most one topic a
  day, with a three-day cooldown per topic, when a threshold is crossed:
  three late dinners in a week, two short nights, three skipped sessions,
  water behind three days running, mood ≤ 2 twice. The coach posts an
  opening message with one question; the TopBar coach icon shows a dot.
  Crisis wording in any reply still triggers the helpline card by code.

### 5.4 Feedback loops

- Day score names its biggest lever. Rings show "later" before their window.
- Growth gains an **eye care** section: breaks taken vs offered by kind,
  longest stretch, screen time by hour, and a break streak (days at ≥ 70 %).
- Settings shows what the app learned: suggested interval changes and why.

### 5.5 Settings, reorganised

Groups: Breaks (kinds and intervals, strictness, smart pause, schedule,
sound, shortcuts on the shell) · Water (goal, glass, reminders) · Reminders
(existing nudges, quiet hours) · Language · Connection · Memory · Data.
`AppState.version` goes to 2 with a migration that fills the new defaults;
the provider already merges defaults over stored state.

## 6. Part 3 — Finish

- Three-step onboarding as in the design brief, with the live target card.
- Empty states with a line illustration, one sentence and one button, for no
  meals, not enough Growth data, AI offline, and no memories.
- Coach empty state with four suggestion cards.
- Photo screen states as in the brief (empty, analysing, results, offline).
- Break overlay and pre-break toast get their final polish after a week of
  real use on the PC.

## 7. Data flow and error handling

- New core modules: `water.ts`, `outreach.ts`, extended `breaks.ts`,
  `date.ts` helpers. No React in `src/core`.
- Services: `useBreakMonitor` becomes the scheduler over `nextDue` and
  `isPaused`; a new `useWaterReminders`; `useOutreach` runs once a minute and
  on app focus. Platform differences stay inside `services/platform.ts`.
- Shell commands and events are best effort. If a command throws, the web
  side behaves like the browser build.
- Model calls keep their existing pattern: facts in, guarded text out, cached
  per day and language; failure falls back to templated text without a retry
  loop.

## 8. Testing

- Core: scheduler ordering, resets on idle, pause conditions, skip budget,
  water pace and cadence, outreach thresholds and cooldowns, local-time
  helpers under `TZ=Asia/Kolkata`, day-score "later" logic. Target: every
  new branch in `src/core` covered.
- Interface: after each part, seed ten days into `sobat.state.v1` and walk
  every tab at 375 px and 1440 px in the browser before calling it done.
  Screenshots go in the pull request description.
- Shell: the Rust is written here and compiled on the Windows PC. Until it is
  built, the browser build exercises the same web code with the shell hooks
  returning null.
- `npx tsc --noEmit` and `npx expo lint` clean before each part is finished.

## 9. Out of scope for v0.4

Phone-to-PC state sync, Live Activities equivalents, custom overlay
wallpapers, an automation API, Health Connect, and a Mac build. Blink
reminders ship but default off.
