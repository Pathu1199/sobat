# Abhyas: today's list, timers and reminders that reach the phone

Date: 2026-10-31. Status: design approved in conversation; written spec waiting for the user's review.

## What Varad asked for

Varad uses Sobat as a web app pinned to the iPhone home screen and gets no
notifications or reminders at all. They want a section where they can add
their own reminders, such as English reading or coding, each with its own
time; the app should track how much they studied today; and, in their
words, "yoga done, study done, English speaking done, or any work at all,
I should be able to add it, like my work list: today I have to do this."
The app should work across sectors, not only health, and feel like their
own.

## Why there are no reminders today

- On an iPhone, a pinned web app only gets a reminder while closed through
  **web push**, and only on iOS 16.4 or newer, only when the app was added
  to the Home Screen, and only after the user taps "Allow" inside the app.
- Push comes from the relay (`relay/`), which is deployed but has **no
  public address yet**, and the app's `relayUrl` in `app.json` is empty. So
  `pushConfigured()` in `src/services/push.ts` is false, and nothing is
  ever sent.
- The app never asks for permission on its own: the "Reminders while
  closed" switch is inside Settings, off by default (`pushRelay: false`).
- The phone-side pieces exist and are tested: `public/sw.js` shows a push
  and opens the app on tap; `usePushSync` uploads the schedule; the relay
  sends what is due every five minutes.

## Decisions

Made with Varad on 2026-10-31:

1. **Fix reminders first.** Finish the relay's address, put it in the app,
   and let the app ask for permission with one tap on Today.
2. **The new section is "Abhyas"** (अभ्यास: practice, study). Shown as
   "Abhyas" in English and "अभ्यास" in Marathi and Hindi.
3. **It is today's list.** Any job: repeating ones (yoga, study, English
   speaking) and one-off ones for a date ("fix the bike"). Each has a tick.
4. **Minutes are counted by a start/stop timer** on items that have a
   minutes target. The timer remembers when it started, so closing the app
   loses nothing.
5. **Reminders are times the user chooses**, one or more per item, on the
   item's days, quiet once the item is done.
6. **Where it lives:** an Abhyas card on Today, an Abhyas tab (one of the
   two free tab slots) with the full list and history, and a row under Me.
7. **A done item earns climb points,** so one mountain reflects the whole
   day: 15 points each, the same as a day that met its water goal.

Two decisions follow from the user's "simple, no clutter" rule and are
made here:

- **One timer at a time.** Starting a second item stops the first.
- **A timer stops itself at 3 hours.** A forgotten timer never writes a
  12-hour study day.

## Part 1: reminders that reach the phone

### The relay's address

`app.json` → `expo.extra.push.relayUrl` gets the worker's URL once the
user registers a workers.dev name in the Cloudflare dashboard. Nothing in
the app's push code changes for this.

### Asking for permission on Today: `src/components/RemindersBanner.tsx` (new)

A one-line card at the top of Today, under the week strip, shown only when
reminders cannot reach this device:

| State | Line | Tap |
|---|---|---|
| Web, not standalone, iPhone or iPad | "Add Sobat to your Home Screen to get reminders" | opens Me → Guide, which gains a short "Add to Home Screen" section |
| Web, standalone, permission not asked, relay configured | "Turn on reminders" | `requestPermission()` inside the tap (iOS needs a gesture), then `setSettings({ pushRelay: true })` |
| Web, standalone, permission denied | "Reminders are blocked in Settings" | opens Me → Guide, section on allowing notifications |
| Web, not standalone, a computer (permission denied or not) | not shown: a desktop tab is not where reminders come, and would otherwise say "blocked" every day | |
| Android, permission not granted | "Turn on reminders" | `requestPermission()` |
| Anything else | not shown | |

A pure `bannerState(input)` in `src/core/remindersBanner.ts` decides the
row from `{ platform, standalone, permission, pushConfigured, pushRelay }`
and is unit tested. "Standalone" is `window.navigator.standalone === true`
or `matchMedia('(display-mode: standalone)').matches`.

The banner is dismissable for the day. It never shows when
`settings.reminders` are all off.

## Part 2: Abhyas data (core)

### Types: `src/core/types.ts`

```ts
export type AbhyasItem = {
  id: string;
  name: string;
  /** An Ionicons name from the picker's short list. */
  icon: string;
  kind: 'repeat' | 'once';
  /** Weekdays it repeats on, 0 = Sunday. Empty for a one-off. */
  days: number[];
  /** The one day a one-off belongs to. */
  date?: ISODate;
  /** Minutes a day the timer fills toward; absent for a tick-only item. */
  targetMin?: number;
  /** Reminder times, "HH:MM", at most three. */
  times: string[];
  order: number;
  createdAt: string;
  /** Set when the user removes it; history stays readable. */
  archivedAt?: string;
};

export type AbhyasSession = { id: string; itemId: string; date: ISODate; startedAt: string; endedAt: string; minutes: number };
export type AbhyasTick = { id: string; itemId: string; date: ISODate; at: string };
export type AbhyasRunning = { itemId: string; startedAt: string };
```

`AppState` gains `abhyasItems: AbhyasItem[]`, `abhyasSessions:
AbhyasSession[]`, `abhyasTicks: AbhyasTick[]` and `abhyasRunning:
AbhyasRunning | null`. `Settings.reminders` gains `abhyas: boolean`, on
by default. `TabId` gains `'abhyas'`; `TodayCardId` gains `'abhyas'`.

### Rules: `src/core/abhyas.ts` (new), pure and unit tested

- `itemsOn(items, date)`: the items that belong to a date, in `order`:
  repeating ones whose `days` include the weekday, one-offs whose `date`
  matches, archived ones excluded.
- `minutesOn(sessions, running, itemId, date, now)`: finished sessions on
  that date plus the running one when it is this item and today.
- `isDone(item, date, ticks, minutes)`: a tick exists, or `targetMin` is
  set and `minutes >= targetMin`.
- `dayStatus(items, date, …)` → `{ total, done }` for the record and the
  card's header.
- `start(itemId, now)`, `stop(running, now)` → the session to append. A
  session shorter than one minute is dropped. `stop` caps `minutes` at
  `MAX_SESSION_MIN = 180` and ends the session at that point.
- `closeStale(running, now)`: on open or each clock tick, a running timer
  older than three hours is stopped at three hours; a running timer that
  started before today is stopped at midnight of its own day.
- `streak(items, ticks, sessions, today)`: days in a row, ending yesterday
  or today, on which every item planned for that day was done. Days with no
  items don't break it. Today counts when all its items are done.
- `reorder`, `archive`, `addItem` helpers that return new arrays.

### Game: `src/core/game.ts`

`GameInput` gains `abhyasDone: number`, the count of done items over the
chapter. `xp` adds 15 points per done item, the same as a water-goal day
(`xp` today: meals 10, water-goal day 15, weigh-in 25, night 10, workout
20, streak day 5). No new badge.

### Record and Progress

`dayRecord` is unchanged: a day's record is about meals. Abhyas has its
own status (`dayStatus`) and streak.

### Store: `src/store/AppProvider.tsx`

Thin actions over the pure functions: `addAbhyasItem`, `setAbhyasItem`,
`archiveAbhyasItem`, `reorderAbhyas`, `tickAbhyas(itemId, date)`,
`untickAbhyas`, `startAbhyas(itemId)`, `stopAbhyas()`, and a clock-tick
hook that runs `closeStale`. The running timer is read on every minute
tick, so the card's "12 of 30 min" moves without a session being written.

### Migration: version 8, `src/store/migrate.ts`

- Adds the four collections, empty, and `abhyasRunning: null`.
- `settings.reminders.abhyas = true`.
- `todayCards` gains `{ id: 'abhyas', on: true }` after `waterWalk`;
  `normalizeTodayCards` and `normalizeTabs` accept the new ids.
- Nothing logged is touched. `STATE_VERSION` becomes 8.

### Sync: `src/core/sync.ts`

Items, sessions and ticks merge per id like the other collections.

- **Items** stay in the user's order (`order`). Two items in the same place,
  one added on each device, go by id, so every device holds the list the
  same way.
- **Ticks:** the id is the item's and the date's, so the same tick made on
  two devices is one tick.
- **Sessions:** the id is the item's and the start's. The same timer stopped
  on two devices is one session, the stop that came first. A copy the app
  cannot read (a field missing, or an end that is not a time) never wins
  over one it can.
- Sessions and ticks at the same time go by id, so the round after a merge
  writes nothing.

**The running timer** (`abhyasRunning`, `mergeRunning`) has one rule,
whatever was running at the last sync:

- A device has moved when its timer is not the last sync's, or it started
  or stopped a timer since. A timer started and stopped between two syncs
  counts as a move.
- Moved on one device only: that device's timer. A timer started on the
  phone shows on the PC and can be stopped there.
- Moved on both: the moves go in time order, as one device would have made
  them. The device that moved last decides, and a timer still running on
  the other stops at the first move made after it started, keeping its
  minutes.
  - A stop made after the other device's start ends that timer there. A
    start made after a stop keeps running.
  - A different item started on each: the later start runs, and the earlier
    timer ends where it began.
  - Stopped on both: no timer, and one session, the first stop's.
- A timer that ran out by itself (three hours, or midnight), or one stopped
  inside its first minute, leaves no time to go by, so it never ends a timer
  started on the other device.
- A stop inside the first minute writes no session. When one device stopped
  the last sync's timer that way, a session another device wrote for it
  because it ran out by itself (three hours or midnight) is dropped: Start
  and Stop tapped by mistake on the phone, then the PC, closed meanwhile,
  closing that timer when it opens, leave no three hours nobody spent. A
  session the other device stopped by hand stays, since the user was at it
  there.
- Moves from before the last sync's timer started (a third device's older
  sessions, merged in since) do not count.
- Ties: a start beats a stop; of two starts, the item with the lower id.
- Known limit: sessions already written stay as written. Timers that ran on
  two devices at once, neither knowing of the other, can overlap for that
  time, three hours at most.

## Part 3: screens

### The Abhyas card on Today: `src/components/AbhyasCard.tsx` (new)

Under the Water and Walk tiles by default (movable in Customize):

- **Header:** "Abhyas · 2 of 4 done", with a + that opens the item sheet
  for a one-off on the viewed date.
- **One row per item on the viewed date**, in order:
  - A tick box (44 pt) that ticks or unticks.
  - The name and, for a timed item, "12 of 30 min".
  - For a timed item, **Start** (teal) or **Stop** (outline) at the right.
    A running item's row shows a small moving dot.
  - A done row is greyed with its tick filled.
- **Empty state:** "Add a job for today" with the +.
- **Past dates:** ticks can be set; timers cannot start.
- **Future dates:** the list shows what's planned; ticks are disabled.

The card follows the living-tile rules: one accent, no gradients, 44 pt
controls, roles and states on every control.

### The item sheet: `src/components/AbhyasItemSheet.tsx` (new)

From the card's + or the tab's list:

1. **Name** (text, required).
2. **Icon**: a short row of Ionicons (book, code-slash, fitness, language,
   leaf, briefcase, musical-notes, pencil); default `book-outline`.
3. **Repeat**: a segmented "Repeats / One day". Repeating: seven weekday
   chips (Mon–Sun), all on by default. One day: a date, default the viewed
   date.
4. **Time target**: chips Off · 15 · 30 · 45 · 60 min, plus a number
   field for any other value.
5. **Remind me at**: up to three times, each a time picker row with a
   remove; "Add a time" below.
6. **Save**, and **Remove** on an existing item (archives it, with Undo for
   five seconds).

### The Abhyas tab: `src/app/(tabs)/abhyas.tsx` (new)

- **Today** section: the same rows as the card.
- **Repeating** section: every repeating item with its days, target and
  times; tap to edit; drag handle to reorder.
- **Coming up**: one-off items for future dates.
- **Last 14 days**: one compact row per day, "3 of 4 · 85 min", with the
  streak above it ("5 days in a row").
- Reachable from the tab bar when chosen in Customize, and always from a
  row under Me ("Abhyas").

### Progress: `src/app/(tabs)/progress.tsx`

One row under the weekly average: "Abhyas · 18 of 21 this week · 5-day
streak", tapping to the tab. Minutes per item per week are in the tab, not
here.

### Customize and Me

- `src/core/tabs.ts` and `src/core/bar.ts`: `'abhyas'` is an offered extra
  tab with its icon (`book-outline`) and label.
- `src/app/customize.tsx`: "Abhyas" appears in the tab list and the Today
  cards list.
- `src/app/(tabs)/me.tsx`: a row "Abhyas" above "Saved meals".

### Words

All new strings in `src/i18n/index.ts` in English, Marathi and Hindi:
"Abhyas"/"अभ्यास", "Add a job for today", "Repeats", "One day", "Time
target", "Remind me at", "Add a time", "Start", "Stop", "n of m done",
"n of m min", "days in a row", "Turn on reminders", "Add Sobat to your
Home Screen to get reminders", "Reminders are blocked in Settings".

## Part 4: Abhyas reminders

### Phone (Android): `src/core/reminders.ts`, `src/services/useScheduledReminders.ts`

- `ReminderKind` gains `'abhyas'`. `plannedReminders` adds, for each of
  the next `PLAN_DAYS` days and each item on that day and each of its
  `times`, a reminder titled with the item's name and a body "0 of 30 min
  today" (timed) or "Today's list" (tick-only), unless the item is done on
  that day, and never in quiet hours.
- `data: { kind: 'abhyas', itemId, date }`; `tapRoute` sends the tap to
  `/` with the card scrolled into view.
- `REMINDER_ROWS` gains the "Abhyas" switch.
- The planned list is reconciled as today: ticking an item removes its
  pending prompts on the next reconcile.

### Web and iPhone, through the relay: `src/core/pushSchedule.ts`, `relay/src/schedule.ts`

`PushSchedule` becomes `v: 2` and gains:

```ts
abhyas: { id: string; days: number[]; times: string[]; title: string; body: string }[];
once: { date: ISODate; time: string; title: string; body: string }[];
/** Items already done today; the relay skips them on `doneDate` only. */
doneToday: string[];
doneDate: ISODate;
```

`dueAt` in the relay adds the matching rows, respecting quiet hours and
`doneToday` on `doneDate`. The relay accepts `v: 1` schedules unchanged,
so an older app keeps working. A tick on the app re-uploads the schedule
through `usePushSync`, which already re-sends when the payload changes.

### The day checklist: "Day so far"

Varad asked (2026-10-31) for an iPhone notification that shows, as a
checklist, what is done and what is missed. One notification, at times the
user chooses:

- **Times:** `settings.reminders.checklistTimes: string[]`, default
  `['21:30']`, up to three, edited in Settings → Reminders. The switch is
  `settings.reminders.checklist`, on by default. (21:30, not 20:30: at 20:30
  the default dinner's own prompt comes and dinner would be listed as not
  done while it is still being eaten; 21:30 is still before the default
  quiet hours at 22:00. A time already stored is kept.)
- **Body:** built by a pure `dayChecklist(input)` in `src/core/checklist.ts`
  from the viewed day's menu, meals, skips, water, walk minutes and Abhyas
  items. Lines, in this order, each item marked ✓ (done) or ○ (not yet):
  1. Meals: `✓ Breakfast · ✓ Lunch · ○ Dinner` (slot names from the
     pattern; a skipped slot shows as ✓ with "skipped").
  2. Abhyas: `✓ Yoga 20 min · ○ English reading 12/30 min · ○ Coding`.
  3. Water and walk: `○ Water, 2 bottles left · ✓ Walk 30 min`.
  The title is `Dhyey · Day so far`. Lines that have nothing to say are
  left out. If every item is done, nothing is sent. A meal slot not done
  or skipped whose window is still open at the last of the day's times
  (not due yet, or within its 45 minutes) is left out rather than marked
  ○: it is not late at any of them.
- **Phone (Android):** scheduled through `plannedReminders` with kind
  `'checklist'` for the next `PLAN_DAYS` days; the body is recomputed on
  every reconcile, so it is current as of the last open.
- **Web and iPhone, through the relay:** `PushSchedule` v2 gains
  `checklist: { times: string[]; title: string; body: string; date: ISODate }`.
  The body is today's text at upload time; the relay sends it at each time
  on `date` only (a stale body is never sent on a later day). Every tick in
  the app re-uploads the schedule through `usePushSync`, so the text is as
  fresh as the last time the app was open.
- **Tap:** opens Today.
- **Not sent** in quiet hours or on an off day.

### Not in this spec

- Tiles per Abhyas item on Today (the card is the Today presence; tiles
  can come later through Customize).
- Categories or sectors beyond the item list, sharing, suggestions from
  the coach, and Drive sync of anything new beyond the merge rules above.
- The Windows app.

## Testing

- **Unit (vitest):**
  - `itemsOn` for weekdays, one-offs, archived items and order.
  - `minutesOn` with finished sessions, a running session today, and a
    running session that belongs to another item.
  - `isDone` by tick and by target; `dayStatus`.
  - `start`/`stop`: the one-minute floor, the 180-minute cap, and
    `closeStale` at three hours and across midnight.
  - `streak` across days with no items, today done and today not yet done.
  - `xp` with `abhyasDone`.
  - Migration v8: collections added, reminder switch on, Today card added
    after `waterWalk`, logs untouched.
  - `merge3` for items, sessions, ticks and the running timer.
  - `plannedReminders` with Abhyas items: times, days, done items skipped,
    quiet hours.
  - `buildPushSchedule` v2 and the relay's `dueAt` with `abhyas`, `once`,
    `doneToday`, and a `v: 1` schedule.
  - `bannerState` for every row of the table in Part 1.
  - `dayChecklist`: marks, order, skipped slots, bottles left, the all-done
    case returning null, and lines left out when empty.
- **On screen:** the web preview at 375 px, light and dark, English and
  Marathi at 1.25: the banner's rows, the card with running and done
  items, the item sheet, the tab, Customize with the new tab and card.
- **On the iPhone (the user):** add to Home Screen, tap "Turn on
  reminders", allow, and receive the test push from Settings.
- **Done means** `npx tsc --noEmit`, `npx expo lint`, `npx vitest run` and
  `cd relay && npx vitest run` are all clean.

## Order of work

1. **Reminders live:** `relayUrl` in `app.json`, the banner, the Guide
   section. Push only with the user's OK.
2. **Abhyas core:** types, `abhyas.ts`, game, store actions, migration v8,
   sync.
3. **Screens:** the card, the item sheet, the tab, Customize, Me, Progress,
   words.
4. **Abhyas reminders:** phone and relay.

## Files

- **New:** `src/core/abhyas.ts`, `src/core/remindersBanner.ts`, `src/core/checklist.ts`,
  `src/components/AbhyasCard.tsx`, `src/components/AbhyasItemSheet.tsx`,
  `src/components/RemindersBanner.tsx`, `src/app/(tabs)/abhyas.tsx`, and
  their tests.
- **Changed:** `src/core/types.ts`, `game.ts`, `reminders.ts`,
  `pushSchedule.ts`, `sync.ts`, `tabs.ts`, `bar.ts`; `src/store/defaults.ts`,
  `migrate.ts`, `AppProvider.tsx`; `src/app/(tabs)/index.tsx`,
  `progress.tsx`, `me.tsx`, `_layout.tsx`; `src/app/customize.tsx`,
  `guide.tsx`; `src/services/useScheduledReminders.ts`; `src/i18n/index.ts`;
  `src/data/guide.ts`; `app.json`; `relay/src/schedule.ts` and its test.
