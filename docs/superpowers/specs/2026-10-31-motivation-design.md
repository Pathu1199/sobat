# Part A: motivation and design polish

Date: 2026-10-31. Status: decisions made with Varad in conversation (the Part A brief, and the palettes added the same day); the points the brief left open are settled here, each with its reason. Written spec waiting for the user's review.

Plan: `docs/superpowers/plans/2026-10-31-motivation.md`. Approved looks: https://claude.ai/artifact/NMpYSSn5pUQXZcXkdpkRDs (trophy shelf, gold calendar stars, teacher card, shield note) and https://claude.ai/artifact/QQzaawABLeEoDiceQpooL8 (the three palettes).

## What Varad asked for

Varad uses Dhyey (ध्येय) as a web app pinned to an iPhone. They want it loved and premium, never demotivating, and pushing them to be consistent every day. In their words about the look: "tab size, letter size, make it proper as an expert designer". They chose all four rewards offered (a streak shield, milestone medals, goal medals, a perfect-day star), a kind teacher's tone for the coach, a daily "next challenge", a push toward consistency on the evening notification, a luxury touch in gold, the list renamed from Abhyas, ➕ that logs anything, and a choice of three palettes.

## What is already built, and the gap

- **The look.** One teal palette in light and dark (`src/ui/theme.ts`), every word at 4.5:1 (`src/ui/__tests__/contrast.test.ts`). Type sizes 44 / 20 / 16 / 13 with weights 400 and 500; screen margin 16, card padding 16, 16 between cards. The tab bar (`src/components/TabBar.tsx`) is 64 tall plus the safe area, a 48 × 32 pill behind the active icon, ➕ 60 across with a teal glow and a ring. Tabs paint the page colour behind their header.
- **The list** is called "Abhyas" / "अभ्यास" (`abhyas`, `cust_card_abhyas`, `rem_abhyas`, `push_desc`, `rem_web_note`). Its id, route and data keys are `abhyas`.
- **➕** opens the food sheet only (`src/components/AddSheet.tsx`). Water and a walk are logged from Today's tiles, the weight from its tile or sheet, the list from its card.
- **The game** (`src/core/game.ts`, all derived from the logs): points (meals 10, a water-goal day 15, a list item done 15, a weigh-in 25, a night 10, a workout 20, a streak day 5) and six camps as levels; 15 badges (firsts, the 7 and 30-day streak, 100 meals, water days, nights, steps, workouts, weigh-ins, the first and fifth kilo, halfway, the summit); one weekly challenge of five in turn. A badge, a camp or the week's challenge is celebrated once in a sheet on Today (`src/components/Celebration.tsx`) and its id kept in `celebrated` (`badge:…`, `level:…`, `challenge:<week>`), which also keeps a badge earned. The Journey page shows the level, the challenge and every badge; Progress's climb row shows "level · points · badges".
- **Streaks.** The meal record's streak (`recordStreak`, `bestStreak` in `src/core/record.ts`, `tileText.ts`): full days eaten at the safe minimum or more, looking back 90 days; a full day with every meal skipped ends it; a day under the safe minimum holds it. The list's streak (`streak` in `src/core/abhyas.ts`): days with every item done. Neither forgives a single day off.
- **The coach** on Today is one line of advice for the minute (`CoachLine`); the evening review (`DayReview`) is the day's numbers as sentences, or a model's text. "Day so far" (`src/core/checklist.ts`) is a checklist of ✓ and ○, with no word about a streak.
- **Words** that scold: "missed", "missing", "behind", "below the line" in English, "चुकले", "राहिली", "मागे आहे", "रेषेखाली" in Marathi, "छूटे", "पीछे है", "रेखा से नीचे" in Hindi (the full list is in Words below).

The gap: no rest day, no perfect day, no daily challenge, two reward systems would overlap if medals were added beside badges and points, the evening has no kind voice, and the look is one palette at sizes that read small on an iPhone.

## Decisions

Made with Varad on 2026-10-31 (binding):

1. **Expert sizing.** Tab bar 60 plus the safe area, icons 24, labels 12 at weight 500, the active tab on a soft 56 × 32 pill, ➕ 56 across, centred, lifted half its height, with a soft shadow. Type: big number 48, screen title 22, body 16, small 13, line heights from `lh()`, weights 400 and 500 and 600 only for screen titles and the big number. Screen side margin 20, card padding 18, 16 between cards. Contrast tests pass; Devanagari never clips at text scale 1.25.
2. **Rename** the list: Routine, दिनक्रम, दिनचर्या in every user-facing string. The id `abhyas` stays everywhere. Tab bar: Today · Routine · ➕ · Progress · Me.
3. **➕ logs anything**: Food (default), Water (+1 bottle, Undo), Walk (+10 min, Undo), Weight (the weight entry), Routine (today's list). One sheet.
4. **Rewards**: the streak shield (one rest day a week, Monday to Sunday, for every streak shown); milestone medals at 3, 7, 21, 30, 66, 100 days with a full-screen gold celebration and a trophy shelf on Progress; goal medals (each kilo, halfway, the goal, a perfect week of a routine job); a gold star on a perfect day. One "earned and celebrated once" mechanism, not a second system.
5. **The kind teacher**: what went well first, then one small tip for tomorrow; "Welcome back" and an easier target after a day with nothing done; the best day of the week said; "not yet", never "missed" or "failed"; a sweep of scolding words in all three languages, safety lines keeping their meaning.
6. **A daily challenge** from the last 7 days, one area, a little past the user's own usual and capped; new every day; a small celebration; "challenges done" medals at 10, 30, 100; it replaces the weekly challenge on screen.
7. **Consistency**: with a streak of 3 days or more and today not complete, "Day so far" starts with one kind line. App-side text only: no relay change.
8. **Luxury**: `C.gold`, `C.goldSoft`, `C.goldInk`, on reward surfaces only (medals, the shield note, stars, celebrations, the best-day line), ink on fill at 4.5:1. The action colour stays the only action colour. Celebrations: a soft shine, sparse sparks, a light haptic, all still with reduce motion.
9. **Palettes** (added 2026-10-31): the user chooses in Settings → Appearance among three, each with light and dark: Emerald and gold (default), Indigo and amber, Forest and saffron, each one action colour, a soft tint band at the top of every tab and a reward colour on reward surfaces only. Stored as `settings.palette` (`'emerald' | 'indigo' | 'saffron'`), normalised on load and sync like the other settings, applied with `applyTheme` as light and dark are. The logo tile follows the action colour. Every text pair at 4.5:1, tested for all three palettes in both modes.

Settled here (the brief left them open), each with its reason:

- **A. One reward system: medals.** The badges, the points with their camps, and the weekly challenge stop showing and their code goes; medals and the daily challenge take their place through the same mechanism (earned from the logs, kept once their id is in `celebrated`). *Why:* three overlapping systems (points, badges, medals) would tell the user three different things about the same day. The streak and kilo badges a user already won count as the medals they became (`badge:streak_7` is `medal:meals:7`, `badge:streak_30` is `medal:meals:30`, `badge:kg_1` and `badge:kg_5` the kilo medals, `badge:halfway` and `badge:summit` halfway and the goal). The other badges (firsts, counts of meals, water days, nights, steps, workouts, weigh-ins) are retired: the streaks already reward showing up, and a count of logs is not a goal. The mountain on the Journey page stays, as the picture of the weight; its camps stop being levels. Old ids stay in `celebrated`, unread, so nothing is lost and an older build still reads its own.
- **B. No flood on the update.** The first time the app runs with medals (no `medals:seeded` id in `celebrated`), every medal already earned and a challenge already done today are marked seen at once, as the game's first run did. *Why:* a user with a 30-day streak would otherwise get four celebrations in a row.
- **C. Medals on both streaks.** The 3 to 100-day medals are earned by the meal record's streak and, separately, by the routine's: two tracks, "Meals" and "Routine" on the shelf. *Why:* the brief puts the shield on both streaks and Varad is most of all building a routine; a medal for one streak only would leave the other unrewarded. Each is earned by the best run over the whole journey, with the shield, as the streak badges were. The meal streak's window grows from 90 to 120 days so the 100-day medal can be reached; 120 is how long a lived day's menu is kept, so every day in the window is still judged on the menu it showed (no storage grows).
- **D. Kilo medals.** One per whole kilo lost from the very first start (`firstStartWeightKg`, else the plan's start) to the weight Progress shows (the smoothed weight), only while there is a loss to aim for (start above the goal). Halfway and the goal by the same numbers. *Why:* the smoothed weight is what Progress shows, so a medal never appears for a single low reading the card does not show.
- **E. A perfect week** of a job is a Monday to Sunday week in which it was due on 3 days or more and was done on every one of them, each due day today or before; finished timers only. *Why:* a job due once or twice a week is "done or not", not a week's effort; finished timers keep a medal from appearing and disappearing while a timer runs.
- **F. The shield, computed.** One pure rule (`runOf`) over a run's days, oldest first, each `count`, `hold` or `break`, and whether a break may be covered. A break is covered when the run before it has at least one day and no day of the same Monday to Sunday week was covered yet; then it holds (neither counts nor ends the run). A second break in the week ends the run as before. A break with no run before it uses nothing ("a day that would break a streak": with no streak nothing would break). The meal streak never covers a full day with nothing eaten: skipping every meal must never be kept alive by the streak (the safety rule `streakStep` already keeps). Today not settled yet holds, so it never uses the shield before the day is over. Each streak has its own shield. The note says "Shield used this week." while a covered day is in the current week, "Shield ready: …" otherwise, and shows only while there is a streak.
- **G. A perfect day** is one the meal streak counts (record full, eaten at the safe minimum or more: so never a day of meals all skipped, one eaten under the minimum, an off day or a day to come), with every routine job on it done (none due counts as all done) and the water goal met (a goal of 0 never is). *Why:* the star must never reward under-eating, and it reads the record by the same rule as the streak, so the two never disagree.
- **H. The daily challenge** is in Part 4. In short: four areas in a fixed turn (water, walk, a job's start, protein); the day's number picks one among those the 7 days before it say something about; the target a little past the usual and capped as the table says; with no history, two bottles of water or a ten-minute walk; none on an off day. An area the user switched off on Today is not offered. *Why not "log the first meal by a time":* a meal logged from the plan ("Ate as planned", "Ate this") is stamped with its slot's planned time once that has passed (`mealFromLines`), so the challenge would complete itself and inflate `challengesDone`, which feeds the challenge medals. The count of challenges done is worked out again from the logs (at most 400 days back), so it needs no storage and is the same on every device.
- **I. Where the teacher speaks.** "Every evening line" is the coach on Today from 18:00 (the coach line becomes the teacher's card) and the evening review when no model writes it (praise, the day's numbers, the tip). The morning coach stays the coach. *Why:* those are the two places the app speaks in the evening on screen; the notifications in the evening are "Day so far" (Decision 7) and the review prompt.
- **J. "Welcome back" and the easier target.** On an evening with nothing done the teacher says "Not yet today, and that's okay." and gives one easier thing for tomorrow (a bottle of water on waking). On the first evening after a day with nothing done (not an off day, not before the user started) the praise opens with "Welcome back." *Why:* the easier target belongs to the day after the quiet one, said the evening before; the welcome belongs to the day the user came back.
- **K. The best day** is today when its score (meals logged + jobs done + 1 for the water goal) is above 0 and above every earlier day of this Monday to Sunday week that counts (off days and days before the start left out); a tie is not the best, and Monday has no earlier day. Said as "Today was your best day this week: {n} of {m} done.", in the reward ink.
- **L. The streak line on "Day so far"**: the routine's streak while jobs are left today ("Your 21-day routine streak needs one more job today."), else the meal streak's while a meal is ("Your 7-day streak needs today's meals too."), from 3 days, only when the day is not complete (the list is sent at all). The phone gives today's text the streaks; the relay's text is built with them at upload. *Why:* the jobs left are concrete, so they come first; the schedule's shape is unchanged.
- **M. Scolding words**: the rule is that what is not done is "not yet" (or just what is left), never missed, missing, failed, behind or below the line, in English, and never चुकले / राहिलं / मागे आहे / रेषेखाली in Marathi, छूटे / छूटने / पीछे है / रेखा से नीचे in Hindi. The rewrites are in Words. A test holds every dictionary to the rule; four lines keep such a word for something that is not the user's day (a save or sign-in that did not go through, "the maths behind it", a pain that stays). The low-intake note keeps its meaning and its strength ("under your safe minimum"); "Stop eating for today" and "kcal over" stay, as the safety guidance they are; nothing in the helpline or the guardrails changes.
- **N. Emerald's action colour.** The mockup's `#0E8A6A` carries white words at 4.32:1, under 4.5. It is one shade deeper, `#0C8263` (4.78:1); the swatch and every action use it. Indigo `#4B4FD6` (6.20) and forest `#0F6B52` (6.47) are as chosen. *Why:* the binding rule is every text pair at 4.5:1.
- **O. Gold for marks.** The reward metal (`gold`) is a fill only (a medal's ring, a spark); a star, an icon or a number on a reward surface is in `goldInk`. *Why:* the chosen golds are 2.5 to 2.9:1 on the light pages, under the 3:1 a mark needs; `goldInk` is 7:1 or more.
- **P. Storage.** The only new stored value is `settings.palette`, normalised on every load and sync landing; a store without it reads emerald, so no version step is needed and `STATE_VERSION` stays 8. A day's challenge id stays in `celebrated` for a fortnight only (`withCelebrated`), so the list never grows by one a day for good.

## Part 1: the look

### Palettes: `src/core/palette.ts` (new), `src/ui/theme.ts`

`PALETTE_IDS = ['emerald', 'indigo', 'saffron']`, `paletteOf(v)` (anything else is `'emerald'`). Each palette has the same tokens in light and dark (`PALETTE_SETS[id][mode]`); `PALETTES` is emerald, so pure helpers and tests that name no palette read the default. Four tokens are new everywhere: `tint`, `gold`, `goldSoft`, `goldInk`. `applyTheme(mode, palette = the one in use)`, `paletteNow()`, `cardShadow(mode, web, palette = 'emerald')`. `GOLD_NOTE = { fill: 'goldSoft', words: 'goldInk' }`.

| Token | Emerald light | Emerald dark | Indigo light | Indigo dark | Saffron light | Saffron dark |
|---|---|---|---|---|---|---|
| `bg` (page) | `#F3F7F6` | `#0B1014` | `#F4F5FB` | `#0D0F1A` | `#F8F5EF` | `#12100B` |
| `card` | `#FFFFFF` | `#151D23` | `#FFFFFF` | `#171A2B` | `#FFFFFF` | `#1E1A14` |
| `tint` | `#E9F4F0` | `#0E1C19` | `#ECEDFB` | `#151830` | `#FBEEDB` | `#231B10` |
| `text` | `#14201D` | `#F1F6F5` | `#171A2E` | `#EEF0FA` | `#1E1A14` | `#F6F1E8` |
| `textDim` | `#43534F` | `#A3B3B8` | `#474B66` | `#A9ADC6` | `#504A3F` | `#B8AE9E` |
| `textFaint` | `#5D6C68` | `#7E9095` | `#5F637E` | `#8589A6` | `#6A6254` | `#958B7B` |
| `accent` | `#0C8263` | `#2DD4A3` | `#4B4FD6` | `#8E91F7` | `#0F6B52` | `#3CC79A` |
| `accentSoft` | `#E2F3EC` | `#145243` | `#E8E9FB` | `#2D2F6B` | `#E2EFE8` | `#15453A` |
| `accentText` | `#0A6B52` | `#2DD4A3` | `#3E42C4` | `#A5A8FA` | `#0F6B52` | `#4FD1A6` |
| `onAccent` | `#FFFFFF` | `#0B1014` | `#FFFFFF` | `#0D0F1A` | `#FFFFFF` | `#12100B` |
| `gold` | `#B98A2C` | `#E2B654` | `#C2852A` | `#E8B25E` | `#D9822B` | `#F0A24F` |
| `goldSoft` | `#F6EEDC` | `#3A2E14` | `#F8EEDD` | `#3A2C12` | `#FBEBD8` | `#3D2810` |
| `goldInk` | `#654A0F` | `#F3D99A` | `#6B450C` | `#F5D9A3` | `#6E3B08` | `#F8D2A6` |

Emerald dark is today's dark palette with the four new tokens. The light status colours (green `#0F7646`, cyan `#066E8A`, pink `#B92B6E`, the rest as now) go a shade deeper so they hold 4.5:1 on the new tints and the indigo and saffron cards; the dark ones are unchanged. Every palette keeps `bgAlt`, `pageAlt`, `cardAlt`, `cardHigh`, `border`, `borderStrong`, `accentDim`, the status colours, `white`, `scrim` and `shadow` (emerald's shadow stays `#10211D` light and black dark).

The contrast test runs for all six: every word colour (`text`, `textDim`, `textFaint`, `accentText`, the status colours) at 4.5:1 on `bg`, `pageAlt`, `card`, `cardAlt` and `tint`; `onAccent` on `accent`; `accentText` on `accentDim` and `accentSoft`; `text` on `accentSoft`; `goldInk` on `goldSoft` and on every surface; `text` and `textDim` on `goldSoft` (the celebration's page); the week strip's dots at 3:1 on the tint too; and every palette has the same tokens.

### Sizes: `src/ui/theme.ts`, `src/ui/barGeometry.ts` (new)

- `F`: number 48, title 22, body 16, small 13, times the text size; `lh()` as now. `TITLE_WEIGHT = '600'` for a screen's title (`TopBar`) and the one big number (Today's calories left, Progress's smoothed weight); everything else 400 or 500.
- `S.gutter` 20 (the screen's side margin; `Screen` pads by it, the week strip's row and its swipe edges follow), `S.cardPad` 18, `S.cardGap` 16.
- The bar: `BAR_HEIGHT` 60, `TAB_ICON` 24, `TAB_LABEL` 12 (times the text size: 11, 12, 13, 15), `TAB_PILL` 56 × 32, `TAB_PAD` 4 above the pill and below the label, `TAB_GAP` 2, `PLUS_SIZE` 56, `PLUS_LIFT` 28. `barHeight(scale)` is 60, or what the pill and a label need at that size with room for matras: 64 at 1.25. Five places fit a 320 point phone (64 each).
- At 20 points a side, two tiles are square from a 375 point phone; on a 360 point phone they are 3 points taller than wide, the words still clear of the art.

### The tint band: `src/ui/TopBar.tsx`

`TintBand` is drawn first in every tab (`Page`, and the Body and Sleep tabs): `C.tint`, from the top of the screen to 168 points under the safe area, behind the header and the first block (on Today, the week strip). The top bar no longer paints the page colour, and the scrolling page lets the band show through (`Screen`'s `onBand`), so the page scrolls over it. Words on the band are held to 4.5:1 by the contrast test.

### Gold, and what is not gold

Reward surfaces only: the streak pill on Today (`goldSoft` with `goldInk`), the shield note, the challenge card's icon tile, the best-day line, medals, a perfect day on the calendar, the celebration's page, the routine streak's flame. Buttons, ticks, the selected tab, links and the plus stay the action colour. The active tab's pill becomes `accentSoft` (the mockup's), its icon and label `accentText`.

### Settings → Appearance

Under Same as phone / Light / Dark, a "Colours" row of three swatches (`PaletteSwatches`): each a 40 point circle in the palette's action colour with its reward colour on it, the name under it, the chosen one ringed and announced as chosen (`chosenProps`). A tap sets `settings.palette`; the app remounts in the new palette, as it does for light and dark (`Themed` in `src/app/_layout.tsx` applies `applyTheme(mode, palette)` before paint). The logo tile reads `C.accent`, so it follows with no change; the PNG app icons do not change.

## Part 2: Routine

Every user-facing name of the list says Routine (English), दिनक्रम (Marathi), दिनचर्या (Hindi): the tab label, the Today card's header, the Customize rows, the reminder switch, the push description and the web reminders note, the ➕ sheet's panel. The keys keep their names (`abhyas`, `cust_card_abhyas`, `rem_abhyas`), as do the tab id, the Today card id, the route `/abhyas`, the data keys and the reminder ids. Words that use अभ्यास for "practice" elsewhere (breathing, yoga) are not the list and stay.

## Part 3: ➕ logs anything

`quickActions(mode, isToday)` in `src/core/addSheet.ts`, pure:

| Action | Icon | What a tap does |
|---|---|---|
| Food | `restaurant-outline` | Shows the food search (where the sheet opens) |
| Water | `water-outline` | Adds a bottle (`bottleMl`) to the date; the sheet closes; the toast "Added 500 ml water" has Undo, which takes that record away |
| Walk | `walk-outline` | Adds a 10-minute walk (`WALK_STEP_MIN`) to the date; the toast "Added 10 min walk" with Undo |
| Weight | `scale-outline` | Opens the weight entry over the sheet; closing it closes both. Only on today (the one day a weigh-in is entered for) |
| Routine | `book-outline` | Shows the date's list, the same card as on Today: tick, start, stop, add |

The row shows only when logging (`mode === 'log'`); a menu being changed is food alone. Food and Routine are panels (announced as chosen), the others buttons; each is 56 tall, a fifth of the row. The plus is named "Add" (`add_any`) on the bar, in Customize and on the wide screen's header, since it adds more than food. The Undo is the toast's, as for a one-tap meal: the toast shows after the sheet closes.

## Part 4: rewards

### The shield: `src/core/shield.ts` (new)

```ts
export type RunDay = { date: ISODate; step: StreakStep; coverable: boolean };
export type Run = { days: number; best: number; covered: ISODate[] };
export function runOf(days: readonly RunDay[], shield: boolean): Run;
export function shieldNote(covered: readonly ISODate[], today: ISODate): 'ready' | 'used';
```

The meal streak: `recordRun(input & { days?: number; shield?: boolean }): Run` in `src/core/record.ts` builds the window's days oldest first (each by `streakStep`; today not settled holds; a break is coverable unless the day was full with nothing eaten). `recordStreak` is `recordRun(…).days` without the shield, as before. `STREAK_LOOKBACK_DAYS` becomes 120. `chapterStreaks(input & { shield?: boolean })` gives `covered` (the chapter window's) when asked; the store asks.

The routine streak: `streakRun(data, today, now, shield = false): Run` in `src/core/abhyas.ts`, from the first item's day to today (no items: hold; all done: count; today not done: hold; any other day not done: a coverable break). `streak` is `streakRun(…).days` without the shield.

Every streak the app shows uses the shield: the store's (the pill, the tile, the medals), the Routine tab's, Progress's routine row (`abhyasProgress`), the medals' routine streak and the streak line on "Day so far".

### Medals: `src/core/medals.ts` (new)

```ts
export type MedalTrack = 'meals' | 'routine' | 'kg' | 'halfway' | 'goal' | 'week' | 'challenges';
export type Medal = { id: string; track: MedalTrack; n: number; name?: string };
export type MedalInput = {
  meals: { now: number; best: number };
  routine: { now: number; best: number } | null;
  lostKg: number;
  totalKg: number;
  weeks: { itemId: string; monday: ISODate; name: string }[];
  challengesDone: number;
  celebrated: readonly string[] | null | undefined;
};
export function earnedMedals(input: MedalInput): Medal[];
export function nextMedals(input: MedalInput, earned: readonly Medal[]): (Medal & { toGo: number })[];
export function shelf(input: MedalInput): ShelfTile[];
export function medalFace(track: MedalTrack, n: number): string;
export function medalWords(m: Pick<Medal, 'track' | 'n' | 'name'>, t: (key: string) => string): { title: string; line: string };
export function shelfWords(tile: ShelfTile, t: (key: string) => string): { label: string; sub: string | null };
export function nextWin(input: { medals: readonly Medal[]; challengeDone: boolean; today: ISODate; celebrated: readonly string[] | null | undefined; waiting?: boolean }): { seed: string[] | null; next: Win | null };
export function withCelebrated(celebrated: readonly string[] | null | undefined, ids: readonly string[], today: ISODate): string[];
```

| Track | Ids | Earned when | Next shows |
|---|---|---|---|
| Meals | `medal:meals:3` … `:100` (3, 7, 21, 30, 66, 100) | the meal streak's best run over the journey, with the shield, reaches it | days from today's streak |
| Routine | `medal:routine:3` … `:100` | the routine streak's best run reaches it; only with a list | days from today's streak |
| Kilos | `medal:kg:1`, `:2`, … | `lostKg` (first start to the weight shown) reaches it; only with a loss to aim for | kilos to one decimal |
| Halfway | `medal:halfway` | half of `totalKg` lost | kilos |
| Goal | `medal:goal` | `totalKg` lost | kilos |
| Perfect week | `medal:week:<itemId>:<monday>` | `perfectWeeks` | — |
| Challenges | `medal:challenges:10`, `:30`, `:100` | `challengesDone` reaches it | challenges |

A medal whose id (or the badge it was, decision A) is in `celebrated` stays earned. The shelf lists every medal earned in the tracks' order (the kilos as the highest one; a job's perfect weeks as one place with "×3"), then the next medal of each track, faded, with "… to go". Its header: "Trophy shelf · {n} earned".

`nextWin`: without `medals:seeded` in `celebrated` (a new user, or one coming from the badges), everything earned and today's challenge if done are the seed, marked seen, and nothing is celebrated. Then the first medal not seen (smallest first, in track order), then today's challenge done (`challenge:day:<date>`). While the add sheet, its "Save as my meal?", a toast with Undo or an Undo line is on screen, nothing yet. `withCelebrated` adds ids once and drops days' challenge ids older than 14 days.

### Perfect days and weeks: `src/core/perfect.ts` (new)

```ts
export function perfectDay(day: { step: StreakStep; jobs: { done: number; total: number }; waterMl: number; waterGoalMl: number }): boolean;
export const PERFECT_WEEK_MIN_DAYS = 3;
export function perfectWeeks(data: Omit<AbhyasData, 'running'>, today: ISODate): { itemId: string; monday: ISODate }[];
```

`usePerfectOn()` (`src/store/usePerfectOn.ts`) reads a date's record on the menu it shows, `streakStep` at the user's safe minimum (`fitOn(…).floor`), the date's routine status on finished timers, and the water drunk.

### The daily challenge: `src/core/challenge.ts` (new)

```ts
export type ChallengeKind = 'water' | 'walk' | 'start' | 'protein';
export type DailyChallenge = { date: ISODate; kind: ChallengeKind; target: number; usual: number; itemId?: string; name?: string };
export type ChallengeData = { meals: Meal[]; water: WaterLog[]; activities: ActivityLog[]; abhyas: AbhyasData; bottleMl: number; waterGoalMl: number; proteinTarget: number; offDays: number[]; waterWalk?: boolean; routine?: boolean };
export function challengeChoices(data: ChallengeData, date: ISODate): DailyChallenge[];
export function dailyChallenge(data: ChallengeData, date: ISODate): DailyChallenge | null;
export function challengeProgress(data: ChallengeData, ch: DailyChallenge): { n: number; of: number; done: boolean };
export function challengesDone(data: ChallengeData, today: ISODate): number;
export function challengeText(ch: DailyChallenge, t: (key: string) => string): string;
```

The usual is read from the 7 days before the date, never the date itself, so the challenge holds all day: logging water, a walk or a meal, or starting a timer, today changes neither the day's challenge nor its choices.

`waterWalk` and `routine` say which areas the user still has: both default to on, `waterWalk: false` offers no water and no walk, `routine: false` offers no job's start. Whoever builds `ChallengeData` reads them from `settings.todayCards`: `waterWalk` is whether the `waterWalk` card is on, `routine` whether the `abhyas` card is on (as `pushSchedule` already reads `waterWalk`). With no area left (both off and no protein gap) the day has no challenge, as on an off day, and `challengesDone` counts none of those days.

| Area (turn order) | Usual | Target | Offered when | Done when |
|---|---|---|---|---|
| Water | average ml a day ÷ bottle, rounded | usual + 1 bottle, at least 2, never past the day's goal in bottles | a water goal and a bottle size, and the water and walk card on | whole bottles drunk ≥ target |
| Walk | average walk minutes a day, rounded | usual + 5, up to the next 5, from 10 to 60 | the water and walk card on | walk minutes ≥ target |
| A job's start | the first timed job on the day with timer starts on 2 of the 7 days: their average first start | 15 minutes before the usual (to 5 minutes), never earlier than the week's earliest start | such a job, and the routine card on | its timer started by the target (a running one counts) |
| Protein | average grams on days something was eaten | usual + 10 g, up to the next 5, never past the protein target | 3 such days and the usual under the target | grams eaten ≥ target |

The day's challenge is `choices[daysSince(2026-01-05) mod choices.length]`: the same all day, on every device, a different area most days, and harder as the usual rises (a 30-minute walker is asked 10, 10, 15, 20, 25, 30, then 35 minutes over their first week). With no history the choices are 2 bottles of water and a 10-minute walk. None on an off day, or with every area switched off. `challengesDone` counts days from the first day anything was logged (at most 400 back) whose challenge was done, on finished timers. A water challenge of one bottle (a goal of one bottle) is worded in the singular, with `chal_water_one` and `chal_water_more_one`.

### Celebrations: `src/components/Celebration.tsx`, `MedalArt.tsx`

A medal fills the screen (a `Modal`) on `goldSoft`: the medal (a ribbon in `accent` and `accentText`, a `gold` ring, a `goldSoft` face, its number, ½, ★ or ✓ in `goldInk`), a soft band of light crossing its face every 3.2 s (`useLoop`), three `gold` sparks rising and fading, "New medal" in `goldInk`, the title at the title size and weight 600, the line, then Keep going (primary) and See my medals (opens Progress). A light tap (`useFeedback().haptic('light')`: expo-haptics `impactAsync(ImpactFeedbackStyle.Light)`, silent on the web) when it appears. With reduce motion on (Reanimated's `useReducedMotion`) there is no shine and no sparks. Today's challenge done is a sheet: a `goldSoft` panel with a check, the challenge's words and "{n} challenges done so far." (the first: "Your first challenge done."), and Keep going. It still waits for the add sheet and any Undo, as the old celebration did.

## Part 5: the teacher and the streak line

### `src/core/teacher.ts` (new)

```ts
export type DayScore = { meals: { done: number; of: number }; jobs: { done: number; of: number; next: string | null }; water: { ml: number; goal: number }; walk: { min: number; goal: number } };
export function dayScore(input: { date: ISODate; routine: Routine; meals: Meal[]; skips: SlotSkip[]; nowMinutes: number; abhyas: AbhyasData; now: Date; water: WaterLog[]; activities: ActivityLog[]; waterGoalMl: number; walkGoalMin: number }): DayScore;
export function scoreOf(d: DayScore): number;
export function nothingDone(d: DayScore): boolean;
export function teacherWords(input: { today: DayScore; yesterday: DayScore | null; earlier: DayScore[] }, t: (key: string) => string): { lead: string; best: string | null; tip: string };
```

Meals count the pattern's slots due by `nowMinutes` (so at 18:00 a 20:30 dinner is not yet one), a skipped slot neither. The lead lists what went well, jobs first: "Well done today: 2 of 3 jobs done, every meal logged, water goal met, 15 min walked." (water only when the goal is met; with only some water: "Well done today: you made a start."). The tip is the first of: start the first job not done a little earlier; log each meal as it is eaten; a bottle before lunch; a ten-minute walk after a meal; the same again.

On Today from 18:00 (`EVENING_FROM`), the coach is `TeacherCard`: "Your coach · this evening", the lead, the best-day line in a small `goldSoft` note with a star when there is one, and "→" the tip. `useTeacherWords()` reads today at this minute, yesterday and this week's earlier days that count (not off days, not before the user started). The evening review's plain text is the lead, the best-day line, the day's numbers (`dayReviewLines`) and the tip.

### "Day so far": `src/core/checklist.ts`, `src/core/pushSchedule.ts`

`ChecklistInput.streaks?: { meals: number; routine: number }` and `STREAK_NUDGE_DAYS = 3`, decision L. The phone (`useScheduledReminders`) passes the store's meal streak and the routine streak on finished timers for today's text only. The relay's text: `buildPushSchedule(state, today, t, tz, menu, mealStreak)` works the routine streak out itself; `usePushSync` passes the store's streak. The `PushSchedule` fields are unchanged, so the relay needs no deploy; the body stays under the 800 characters the relay takes (`clip`).

## Data, migration and sync

- `Settings.palette: PaletteId`, default `'emerald'` (`src/store/defaults.ts`). `upgradeAppSettings` sets `s.palette = paletteOf(raw.palette)` on every load and sync landing. Not a device setting: it merges field by field with the other settings, so a choice on the phone reaches the PC, and the later choice wins.
- No version step: `STATE_VERSION` stays 8 (decision P).
- The store (`AppProvider`) works its streaks out with the shield (`chapterStreaks({ …, shield: true })`) and gives `streakCovered` for the note. `markCelebrated` goes through `withCelebrated`.
- Nothing else is stored: medals, perfect days and weeks, challenges and the count of challenges done are worked out from the logs. `celebrated` keeps the new ids (`medal:…`, `medals:seeded`, `challenge:day:…` for a fortnight) beside the old ones.

## Screens

- **Today:** the header and week strip on the tint band; the streak pill gold; under the low-intake note and the reminders line, "Today's challenge" (a card: a `goldSoft` icon tile with a flag, or a check once done; "Today's challenge"; the challenge; "3 of 5" or "Done. Well done!" in `goldInk`), today only, nothing on an off day; from 18:00 the coach block is the teacher's card; the celebration as above.
- **The ➕ sheet:** Part 3.
- **Routine:** the header on the tint; Last 14 days opens with the streak (a gold flame, "8 days in a row") and the shield note under it.
- **Progress:** the weight card; the Streak tile with the shield note under it while there is a streak; Lost, To go, full days; the trophy shelf; the calendar with gold perfect days (the reward fill, the date in `goldInk`, a star in place of the dot, "Perfect day" in its name for a screen reader); the routine row (with the shield); nutrition; the climb row (the bar only); History and Charts.
- **Journey:** the mountain, Lost, To go, the goal and the weigh-in history; no level, challenge or badges.
- **Settings:** the palette swatches under Appearance.

## Words

New keys, in all three languages:

| Key | English | मराठी | हिंदी |
|---|---|---|---|
| `chal_title` | Today's challenge | आजचं आव्हान | आज की चुनौती |
| `chal_water` | Drink {n} bottles of water | {n} बाटल्या पाणी प्या | {n} बोतल पानी पिएँ |
| `chal_water_more` | Drink {n} bottles of water, {d} more than your usual | {n} बाटल्या पाणी प्या, नेहमीपेक्षा {d} जास्त | {n} बोतल पानी पिएँ, आम दिनों से {d} ज़्यादा |
| `chal_water_one` | Drink {n} bottle of water | {n} बाटली पाणी प्या | {n} बोतल पानी पिएँ |
| `chal_water_more_one` | Drink {n} bottle of water, {d} more than your usual | {n} बाटली पाणी प्या, नेहमीपेक्षा {d} जास्त | {n} बोतल पानी पिएँ, आम दिनों से {d} ज़्यादा |
| `chal_walk` | Walk {n} min | {n} मिनिटे चाला | {n} मिनट टहलें |
| `chal_walk_more` | Walk {n} min, {d} more than your usual | {n} मिनिटे चाला, नेहमीपेक्षा {d} जास्त | {n} मिनट टहलें, आम दिनों से {d} ज़्यादा |
| `chal_protein` | Eat {n} g of protein, {d} g more than your usual | {n} ग्रॅम प्रथिने खा, नेहमीपेक्षा {d} ग्रॅम जास्त | {n} ग्राम प्रोटीन खाएँ, आम दिनों से {d} ग्राम ज़्यादा |
| `chal_start` | Start {name} by {time} | {name} {time} पर्यंत सुरू करा | {name} {time} तक शुरू करें |
| `chal_start_earlier` | Start {name} by {time}, a little earlier than usual | {name} {time} पर्यंत सुरू करा, नेहमीपेक्षा थोडं लवकर | {name} {time} तक शुरू करें, आम दिनों से थोड़ा पहले |
| `chal_progress` | {n} of {m} | {m} पैकी {n} | {m} में से {n} |
| `chal_done` | Done. Well done! | पूर्ण झालं. छान! | हो गया. बहुत बढ़िया! |
| `chal_done_title` | Challenge done | आव्हान पूर्ण | चुनौती पूरी |
| `chal_count` | {n} challenges done so far. | आतापर्यंत {n} आव्हानं पूर्ण. | अब तक {n} चुनौतियाँ पूरी. |
| `chal_count_one` | Your first challenge done. | तुमचं पहिलं आव्हान पूर्ण. | आपकी पहली चुनौती पूरी. |
| `medal_streak_days` | {n} days | {n} दिवस | {n} दिन |
| `medal_meals_title` | {n} days of meals in a row | सलग {n} दिवस जेवणाची नोंद | लगातार {n} दिन खाना दर्ज |
| `medal_routine_title` | {n} days of your routine in a row | सलग {n} दिवस दिनक्रम पूर्ण | लगातार {n} दिन दिनचर्या पूरी |
| `medal_kg_title` | {n} kg lost | {n} किलो कमी | {n} किलो कम |
| `medal_halfway` | Halfway to your goal | लक्ष्याचा अर्धा टप्पा | लक्ष्य का आधा रास्ता |
| `medal_goal` | Goal reached | लक्ष्य गाठलं | लक्ष्य पूरा |
| `medal_week` | Perfect week: {name} | परिपूर्ण आठवडा: {name} | पूरा हफ़्ता: {name} |
| `medal_challenges_title` | {n} challenges done | {n} आव्हानं पूर्ण | {n} चुनौतियाँ पूरी |
| `medal_track_meals` | Meals | जेवण | खाना |
| `medal_track_routine` | Routine | दिनक्रम | दिनचर्या |
| `medal_to_go` | {n} to go | अजून {n} | {n} और |
| `medal_to_go_kg` | {n} kg to go | अजून {n} किलो | {n} किलो और |
| `medal_new` | New medal | नवं पदक | नया पदक |
| `medal_sub_streak` | Showing up, day after day. This is how a routine becomes who you are. | रोज थोडं, रोज हजर. असाच दिनक्रम तुमची ओळख बनतो. | रोज़ थोड़ा, रोज़ हाज़िर. ऐसे ही दिनचर्या आपकी पहचान बनती है. |
| `medal_sub_kg` | Every kilo is real work. Well done. | प्रत्येक किलो ही खरी मेहनत आहे. छान. | हर किलो असली मेहनत है. बहुत बढ़िया. |
| `medal_sub_halfway` | Half the way is done. | अर्धा रस्ता पार केलात. | आधा रास्ता तय हो गया. |
| `medal_sub_goal` | You did what you set out to do. | जे ठरवलं होतं ते तुम्ही करून दाखवलं. | जो ठाना था, वह कर दिखाया. |
| `medal_sub_week` | Done on every day it was due this week. | या आठवड्यात ठरलेल्या प्रत्येक दिवशी पूर्ण. | इस हफ़्ते हर तय दिन पूरा. |
| `medal_sub_challenges` | Small steps, done again and again. | छोटी पावलं, पुन्हा पुन्हा. | छोटे कदम, बार-बार. |
| `shelf_title` | Trophy shelf | पदकांचं कपाट | पदकों की अलमारी |
| `shelf_count` | {n} earned | {n} मिळाली | {n} मिले |
| `teach_title` | Your coach · this evening | तुमचा कोच · आज संध्याकाळी | आपका कोच · आज शाम |
| `teach_lead` | Well done today: {parts}. | आज छान केलंत: {parts}. | आज बढ़िया किया: {parts}. |
| `teach_lead_small` | Well done today: you made a start. | आज छान केलंत: सुरुवात झाली. | आज बढ़िया किया: शुरुआत हो गई. |
| `teach_jobs` | {n} of {m} jobs done | {m} पैकी {n} कामं पूर्ण | {m} में से {n} काम पूरे |
| `teach_meals_all` | every meal logged | सगळी जेवणं नोंदवली | सारे खाने दर्ज |
| `teach_meals` | {n} meals logged | {n} जेवणं नोंदवली | {n} खाने दर्ज |
| `teach_meal_one` | 1 meal logged | 1 जेवण नोंदवलं | 1 खाना दर्ज |
| `teach_water` | water goal met | पाण्याचं लक्ष्य पूर्ण | पानी का लक्ष्य पूरा |
| `teach_walk` | {n} min walked | {n} मिनिटे चाललात | {n} मिनट टहले |
| `teach_welcome` | Welcome back. | पुन्हा स्वागत आहे. | फिर से स्वागत है. |
| `teach_not_yet` | Not yet today, and that's okay. | आज अजून काही झालं नाही, आणि ते ठीक आहे. | आज अभी कुछ नहीं हुआ, और यह ठीक है. |
| `teach_best` | Today was your best day this week: {n} of {m} done. | आज या आठवड्यातला तुमचा सर्वोत्तम दिवस: {m} पैकी {n} पूर्ण. | आज इस हफ़्ते का आपका सबसे अच्छा दिन रहा: {m} में से {n} पूरे. |
| `teach_tip_job` | Tomorrow, start {name} a little earlier. | उद्या {name} थोडं लवकर सुरू करा. | कल {name} थोड़ा पहले शुरू करें. |
| `teach_tip_meals` | Tomorrow, log each meal as you eat it. | उद्या प्रत्येक जेवण खाल्ल्यावर लगेच नोंदवा. | कल हर खाना खाते ही दर्ज करें. |
| `teach_tip_water` | Tomorrow, one bottle of water before lunch. | उद्या दुपारच्या जेवणाआधी एक बाटली पाणी. | कल दोपहर के खाने से पहले एक बोतल पानी. |
| `teach_tip_walk` | Tomorrow, a ten-minute walk after a meal. | उद्या जेवणानंतर दहा मिनिटे चाला. | कल खाने के बाद दस मिनट टहलें. |
| `teach_tip_same` | Tomorrow, the same again. You know how. | उद्याही असंच. तुम्हाला जमतंय. | कल भी ऐसे ही. आपसे हो रहा है. |
| `teach_tip_easy` | Tomorrow, just one small thing: a bottle of water when you wake up. | उद्या फक्त एक छोटी गोष्ट: उठल्यावर एक बाटली पाणी. | कल बस एक छोटी चीज़: उठते ही एक बोतल पानी. |
| `rem_streak_job_one` | Your {n}-day routine streak needs one more job today. | तुमच्या {n} दिवसांच्या दिनक्रम मालिकेला आज अजून एक काम हवं. | आपके {n} दिन के दिनचर्या सिलसिले को आज एक और काम चाहिए. |
| `rem_streak_jobs` | Your {n}-day routine streak needs {k} more jobs today. | तुमच्या {n} दिवसांच्या दिनक्रम मालिकेला आज अजून {k} कामं हवीत. | आपके {n} दिन के दिनचर्या सिलसिले को आज {k} और काम चाहिए. |
| `rem_streak_meals` | Your {n}-day streak needs today's meals too. | तुमच्या {n} दिवसांच्या मालिकेला आजची जेवणंही हवीत. | आपके {n} दिन के सिलसिले को आज के खाने भी चाहिए. |
| `palette_title` | Colours | रंग | रंग |
| `palette_emerald` | Emerald and gold | पाचू आणि सोनेरी | पन्ना और सुनहरा |
| `palette_indigo` | Indigo and amber | नीळ आणि अंबर | नील और अंबर |
| `palette_saffron` | Forest and saffron | वनहिरवा आणि केशरी | गहरा हरा और केसरिया |
| `add_any` | Add | जोडा | जोड़ें |
| `quick_food` | Food | जेवण | खाना |
| `quick_water_a11y` | Add {ml} ml of water | {ml} ml पाणी जोडा | {ml} ml पानी जोड़ें |
| `quick_walk_a11y` | Add a {min}-minute walk | {min} मिनिटांचं चालणं जोडा | {min} मिनट की सैर जोड़ें |
| `shield_ready` | Shield ready: one rest day this week won't break your streak. | ढाल तयार: या आठवड्यात एक दिवस विश्रांती घेतली तरी मालिका तुटणार नाही. | ढाल तैयार: इस हफ़्ते एक दिन आराम से भी सिलसिला नहीं टूटेगा. |
| `shield_used` | Shield used this week. | या आठवड्याची ढाल वापरली. | इस हफ़्ते की ढाल लग चुकी. |
| `perfect_day` | Perfect day | सोनेरी दिवस | सुनहरा दिन |
| `celebrate_keep_going` | Keep going | असंच चालू ठेवा | ऐसे ही चलते रहें |
| `celebrate_see_medals` | See my medals | माझी पदकं पाहा | मेरे पदक देखें |

Rewritten (the rename and the kind sweep; the Marathi and Hindi before were the matching scolding words named in the brief):

| Key | Was (English) | Now (English) | Now (मराठी) | Now (हिंदी) |
|---|---|---|---|---|
| `w_f4_b` | A bad night makes today easier, not louder. Miss three days and the plan shrinks to meet you. | A bad night makes today easier, not louder. Away for three days? The plan shrinks to meet you. | रात्र वाईट गेली तर आजचा दिवस सोपा होतो, मोठ्याने बोलत नाही. तीन दिवस दूर गेलात तर योजना तुमच्यापर्यंत खाली येते. | रात खराब रही तो आज आसान हो जाता है, तेज़ नहीं. तीन दिन दूर रहे तो योजना खुद छोटी हो जाती है. |
| `plan_eased` | Plan eased after three missed days. | Plan eased after three quiet days. | तीन शांत दिवसांनंतर योजना सोपी केली. | तीन शांत दिनों के बाद योजना आसान की. |
| `coach_protein` | Protein is behind: {g} g still to go. Dal, curd, paneer or sprouts in the next meal. | Protein: {g} g still to go. Dal, curd, paneer or sprouts in the next meal. | प्रथिने: अजून {g} ग्रॅ हवीत. पुढच्या जेवणात डाळ, दही, पनीर किंवा मोड. | प्रोटीन: अभी {g} ग्राम और चाहिए. अगले खाने में दाल, दही, पनीर या अंकुरित. |
| `coach_water` | You are behind on water: {bottles} bottles to catch up. One now. | Water: {bottles} bottles to go. One now. | पाणी: अजून {bottles} बाटल्या. एक आत्ता. | पानी: अभी {bottles} बोतलें और. एक अभी. |
| `coach_after_heavy` | Yesterday was heavy. Today: a lighter lunch, an early dinner, extra water. | A fresh day: a lighter lunch, an early dinner, extra water. | नवा दिवस: हलकं जेवण, लवकर रात्रीचं जेवण, जास्त पाणी. | नया दिन: हल्का दोपहर का खाना, जल्दी रात का खाना, ज़्यादा पानी. |
| `coach_streak` | {n} days logged in a row. Keep the chain. | {n} days logged in a row. Well done; today adds one more. | {n} दिवस सलग नोंद. छान; आज आणखी एक. | {n} दिन लगातार दर्ज. बहुत बढ़िया; आज एक और. |
| `push_desc` | Meals, Abhyas, Day so far, water and breaks, on the lock screen. | Meals, Routine, Day so far, water and breaks, on the lock screen. | जेवण, दिनक्रम, आतापर्यंतचा दिवस, पाणी आणि ब्रेक, लॉक स्क्रीनवर. | खाना, दिनचर्या, अब तक का दिन, पानी और ब्रेक, लॉक स्क्रीन पर. |
| `intake_note` | Last {days} days averaged {avg} kcal, below the line. Eat today's plan in full. | Last {days} days averaged {avg} kcal, under your safe minimum. Eat today's plan in full. | गेल्या {days} दिवसांत सरासरी {avg} kcal, सुरक्षित किमानपेक्षा कमी. आजचं नियोजन पूर्ण खा. | पिछले {days} दिनों में औसत {avg} kcal, सुरक्षित न्यूनतम से कम. आज का प्लान पूरा खाएँ. |
| `strip_missing` | Meals missing | Meals not logged yet | काही जेवणं अजून नोंदवायची | कुछ खाने अभी दर्ज नहीं |
| `menu_missing` | {n} meals missing | {n} meals not logged yet | {n} जेवणं अजून नोंदवायची | {n} खाने अभी दर्ज नहीं |
| `menu_missing_one` | 1 meal missing | 1 meal not logged yet | 1 जेवण अजून नोंदवायचं | 1 खाना अभी दर्ज नहीं |
| `coach_water_one` | You are behind on water: one bottle to catch up. Start it now. | Water: one bottle to go. Start it now. | पाणी: अजून एक बाटली. ती आत्ता सुरू करा. | पानी: अभी एक बोतल और. अभी शुरू करें. |
| `cust_card_abhyas` | Abhyas | Routine | दिनक्रम | दिनचर्या |
| `abhyas` | Abhyas | Routine | दिनक्रम | दिनचर्या |
| `chapter_body` | Your climb starts again today, from {kg} kg. Lost counts from here, and the weekly challenge and the streak start fresh. Nothing is deleted: every meal, weigh-in and badge stays, and History shows everything. | Your climb starts again today, from {kg} kg. Lost counts from here, and the streak starts fresh. Nothing is deleted: every meal, weigh-in and medal stays, and History shows everything. | तुमची चढाई आज {kg} किलोपासून पुन्हा सुरू होते. कमी झालेलं वजन इथून मोजलं जातं, आणि सलग दिवस नव्याने सुरू होतात. काहीही पुसलं जात नाही: प्रत्येक जेवण, वजन आणि पदक राहतं, आणि इतिहासात सगळं दिसतं. | आपकी चढ़ाई आज {kg} किलो से फिर शुरू होती है. कम हुआ वज़न यहीं से गिना जाता है, और लगातार दिन नए सिरे से शुरू होते हैं. कुछ भी मिटता नहीं: हर खाना, वज़न और पदक रहता है, और इतिहास में सब दिखता है. |
| `rem_fill_body` | Take a look at yesterday: confirm what was filled in from the plan and add anything missing. | Take a look at yesterday: confirm what was filled in from the plan and add anything not logged yet. | कालचा दिवस एकदा पाहा: नियोजनावरून भरलेलं पक्कं करा आणि अजून न नोंदवलेलं जोडा. | कल का दिन एक बार देखें: प्लान से भरा हुआ पक्का करें और जो अभी दर्ज नहीं, वह जोड़ें. |
| `rem_abhyas` | Abhyas | Routine | दिनक्रम | दिनचर्या |
| `rem_web_note` | Here only the meal-time prompt, Abhyas and Day so far come, by the relay. | Here only the meal-time prompt, Routine and Day so far come, by the relay. | इथे फक्त जेवणाच्या वेळची आठवण, दिनक्रम आणि आतापर्यंतचा दिवस येतात, रिलेमार्फत. | यहाँ सिर्फ़ खाने के वक़्त की याद, दिनचर्या और अब तक का दिन आते हैं, रिले से. |
| `review_no_workout` | No workout today. | A rest day from workouts. | आज व्यायामाला विश्रांती. | आज कसरत से आराम. |

Retired with the old game (no screen reads them): `celebrate_title`, `celebrate_badge`, `celebrate_level`, `celebrate_challenge`, `celebrate_keep`, `celebrate_see`, `celebrate_footer`, `xp_how`, `badges`, `badge_earned`, every `badge_*`, `level_*` and `challenge_*` key, `points_n`, `progress_badges`, `progress_climb_a11y`.

## Testing

- **Unit (vitest):**
  - Palettes: every palette and mode has the same tokens; every word pair above at 4.5:1; `paletteOf`; `applyTheme(mode, palette)` swaps the colours and the shadow and keeps the palette when only the mode changes.
  - Sizes: `scaledSizes` (48 / 22 / 16 / 13 and their scaled values), `TITLE_WEIGHT`, the bar's numbers, `barHeight` at every text size with room for matras (64 at 1.25), five places on 320 points; the strip's row at the new gutter; tiles square from 375 points.
  - Shield: `runOf` with and without it, a second break in a week, a break with no run, an uncoverable break, Sunday and the next Monday, `shieldNote`; `recordRun` on real records (two covered days, a day of meals all skipped never covered, today not settled); `chapterStreaks` with `covered`, a chapter's window; `streakRun` for the routine.
  - Perfect: `perfectDay` (hold, break, a job not done, water short, no goal); `perfectWeeks` (a missed day, a timed job, two due days, the last day, order, a job added mid-week).
  - Challenge: no history; off day; each area's target and cap; the turn by day; growing targets and `challengesDone`; `challengeProgress` for counts and start times (a running timer); a day's choices unchanged by logging on the day itself; `challengesDone` ignoring a running timer; the turn with three and four areas and before the epoch; switched-off areas; one bottle in the singular; words in three languages.
  - Medals: each track; kept ids and the old badges; `nextMedals`; `shelf`; the words; `nextWin` (seed, order, the challenge, waiting); `withCelebrated`.
  - Teacher: `dayScore` at 18:00 and at the end of a day; `teacherWords` (praise, each tip, not yet, welcome back, best day, a tie, Marathi and Hindi).
  - "Day so far": the routine line (one job, two), the meal line, under 3 days, a complete day, Marathi; `buildPushSchedule` with the streak and the same fields.
  - Store: the palette from an old store, a choice kept, an unknown value; the palette merging across devices.
  - ➕: `quickActions` for log, another day and plan; every label in three languages.
  - Words: no scolding word in any dictionary but the four named lines; the list's name in three languages; the rewrites in the tests that quote them.
- **On screen:** the web preview at 375 points, light and dark, the three palettes, Marathi at text scale 1.25: Today (tint, pill, challenge, tab bar), the ➕ sheet (each action), Routine (streak and shield), Progress (shield note, trophy shelf, stars), a medal's celebration, Settings' swatches. No console error.
- **Done means** `npx tsc --noEmit`, `npx expo lint`, `npx vitest run` and `cd relay && npx vitest run` are clean (at the end: 1827 tests, relay 73).

## Not in this spec

- Part B (reports, comparisons, a monthly PDF) and Part C (the path-puzzle game).
- A star on Today's week strip (the calendar only, as the brief says), a medal's date on the shelf (it would need a stored date), sounds, and new app icons per palette.
- Any change to the relay or the `PushSchedule` fields.

## Order of work

1. Pure core with tests: palettes, sizes, the shield, perfect days and weeks, the challenge, medals, the teacher and the streak line.
2. The store: the palette setting, the streaks with the shield, `withCelebrated`.
3. Screens: the look (palettes, tint, tab bar, swatches), ➕, Today, Progress and Routine, the celebration, then the old game's code retired.
4. Words: Routine and the kind sweep.
5. A look on a phone-sized screen.

## Files

- **New:** `src/core/palette.ts`, `shield.ts`, `perfect.ts`, `challenge.ts`, `medals.ts`, `teacher.ts`; `src/ui/barGeometry.ts`; `src/components/PaletteSwatches.tsx`, `useRewards.ts`, `ChallengeCard.tsx`, `TeacherCard.tsx`, `MedalArt.tsx`, `ShieldNote.tsx`, `TrophyShelf.tsx`; `src/store/usePerfectOn.ts`; and their tests (`palette`, `shield`, `perfect`, `challenge`, `medals`, `teacher`, `kindWords`, `barGeometry`).
- **Changed:** `src/ui/theme.ts`, `components.tsx`, `TopBar.tsx`, `stripGeometry.ts`; `src/core/record.ts`, `abhyas.ts`, `abhyasView.ts`, `chapter.ts`, `checklist.ts`, `pushSchedule.ts`, `addSheet.ts`, `bar.ts`, `game.ts`, `types.ts`; `src/store/defaults.ts`, `migrate.ts`, `AppProvider.tsx`; `src/services/useScheduledReminders.ts`, `usePushSync.ts`; `src/app/_layout.tsx`, `settings.tsx`, `customize.tsx`, `journey.tsx`, `(tabs)/index.tsx`, `progress.tsx`, `abhyas.tsx`, `body.tsx`, `sleep-tab.tsx`; `src/components/TabBar.tsx`, `StreakPill.tsx`, `CaloriesLeft.tsx`, `WeightTrendCard.tsx`, `WeekStrip.tsx`, `AddSheet.tsx`, `TopBarActions.tsx`, `CoachLine.tsx`, `DayReview.tsx`, `RecordCalendar.tsx`, `Celebration.tsx`, `useGame.ts`, `ChapterSheet.tsx`; `src/i18n/index.ts`; tests that quote changed words or retired code.
