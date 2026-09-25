# Sobat — design brief for Stitch

18 screens to design. Each one has a **paste-into-Stitch prompt**, the data it
shows, and the states it needs.

Send me the images afterwards, one per screen, and say which screen each is.
I will rebuild the interface to match. The logic underneath stays as it is, so
nothing you design is limited by what is already built.

---

## 0. The style block — paste this at the top of EVERY Stitch prompt

```
Dark premium mobile health app called Sobat. Calm, confident, editorial.
Background near-black green-black #0B1412. Cards #152826 with 1px border
#24423D and 16px radius. Primary accent deep emerald #1D9E75. Secondary accents:
amber #EF9F27 for warnings, soft red #E24B4A for over-limit, blue #378ADD for
water and sleep, violet #7F77DD for protein.
Text: white-green #ECF6F3 primary, #9DB8B2 secondary, #6D8A84 hints.
Typography: one clean geometric sans. Big numbers are large, tight and light-
weight; labels are small and quiet. Only two weights, regular and medium.
Generous spacing, lots of breathing room, no clutter.
No gradients, no glow, no drop shadows, no 3D, no stock photos, no emoji.
Data is shown with thin rings, thin bars and small sparklines, never pie charts.
Must support Devanagari text (Marathi) alongside English without breaking.
```

Add `Desktop web layout, 1440px wide, left sidebar navigation` for the three
desktop screens. Everything else is a 390px phone screen.

---

## 1. Landing page (web only)

**Purpose:** the page someone sees before they install. It has to say what this
is in five seconds and make privacy the headline, not a footnote.

**Sections:** sticky slim header with wordmark and a Get started button; hero
with one-line promise and a phone mockup; a row of three proof numbers (209
Indian foods, 50 joint-safe exercises, 0 data sent anywhere); six feature cards;
a "your data never leaves your devices" band; a three-step how-it-works strip;
download row for Windows and Android; quiet footer with the MIT licence.

```
Landing page for Sobat, a private health companion app. Hero: large headline
"Your health, on your own machine", one supporting line, two buttons Get started
and See how it works, and a floating phone mockup on the right showing a dark
dashboard with a calorie ring. Below the hero, a thin row of three statistics.
Then a 3x2 grid of feature cards, each with a thin line icon, a short title and
two lines of text: Track what you eat, Photo to calories, Sleep check-in,
Joint-safe workouts, Break reminders, AI coach on your own PC. Then a full-width
privacy band with a lock icon and the line "No account. No cloud. Nothing
uploaded." Then a three-step strip: install, connect your PC, log your first
meal. Then a download row with a Windows button and an Android button. Minimal
footer. Lots of vertical whitespace.
```

## 2. Onboarding, three steps

**Purpose:** collect eight numbers without feeling like a form, and show the
result immediately so the person trusts it.

**Data:** name, sex, birth year, height, weight, goal weight, activity level,
loss rate. Live output: daily calorie target, protein target, BMI, healthy
weight range for that height.

```
Three-step onboarding for a dark health app, shown as three separate phone
screens side by side. A thin 3-segment progress bar at the top of each.
Step 1: language choice as three pills English, मराठी, हिंदी, then a name field
and a two-option sex selector.
Step 2: four number fields in a 2x2 grid, birth year, height in cm, weight in
kg, goal weight in kg. Large, easy to tap.
Step 3: activity level as four stacked selectable rows each with a title and a
one-line description, then loss-per-week as four pills 0.25 0.5 0.75 1 kg.
Under it, a highlighted emerald result card showing a very large number
"1778 kcal", a protein line, a BMI line, and a healthy-weight-range line.
Full-width Start button at the bottom.
```

## 3. Today, phone

**Purpose:** the screen opened twenty times a day. One glance answers "how am I
doing and what do I do next".

**Data:** greeting and streak, calories remaining in a ring, eaten vs target,
protein bar, water bar, three quick-add buttons, the decision card, a sleep
row, five score rings, today's meal list.

```
Phone home screen for a dark health app. Top row: greeting "Good evening,
Varad" with a small streak chip "12 day streak", and a tiny status dot with the
label "AI: PC".
Hero card: a large thin emerald progress ring on the left with the number 1508
inside and "kcal left" under it. On the right, three compact stat rows, Eaten
270 / 1778, Protein with a thin violet bar, Water with a thin blue bar.
Under them three equal quick-add buttons: Add food, Photo, Water.
Next, a decision card with a coloured left accent, a title "On track", two
sentences of friendly advice, a short bulleted action list with small dots, and
a row of four tiny grey chips showing the numbers behind the advice.
Then a compact sleep row: 7h 15m, score 74, with a chevron.
Then a row of five small thin rings labelled Food, Move, Water, Sleep, Mind.
Then today's meals as a simple list with name, meal type, time and calories.
Bottom tab bar with five items: Today, Log, Move, Mind, Coach.
```

## 4. Today, desktop

Same information, arranged for a wide screen instead of stacked.

```
Desktop dashboard 1440px for a dark health app. Fixed left sidebar 260px with
the Sobat wordmark, six nav items with thin line icons (Today, Log, Growth,
Move, Mind, Coach), and a settings item pinned at the bottom with a small
"AI: PC connected" status.
Main area is a three-column grid. Column one: tall hero card with a big calorie
ring and the stat rows under it, then quick-add buttons. Column two: the
decision card, then a daily tip card with a small lightbulb icon. Column three:
a break-monitor card showing "Next break in 14 min" with a thin progress bar,
then today's meals list, then the five score rings in a vertical stack.
A slim top bar shows today's date on the left and the streak on the right.
```

## 5. Growth

**Purpose:** proof that it is working. This is the screen that keeps someone
using the app in month two.

**Data:** Today / Week / Month switch. Ten metrics with previous-period
comparison: average calories, days on target, days logged, workout days, move
minutes, average sleep, average water, average mood, screen time, weight change.
Charts: weight line, calories bars against a target line, sleep bars, screen
time bars, and a consistency strip of one cell per day.

```
Phone screen titled Growth for a dark health app. Under the title, a segmented
control with three options Today, Week, Month, the middle one selected.
First, a headline card: very large number "-1.8 kg" with the label "this month"
and a small emerald downward arrow chip showing the comparison.
Then a 2x2 grid of metric tiles. Each tile has a small label at the top, a large
number, a unit, and a tiny coloured arrow chip with a percentage against the
period before. Use green when the change is good and amber when it is not.
Then a weight chart card: a thin white line chart with small dots, a dashed
horizontal goal line, and a soft area under the line.
Then a calories card: vertical bars, one per day, with a dashed horizontal
target line across them; bars over the line are amber, bars under are emerald.
Then a consistency card: a strip of small rounded squares, one per day, filled
emerald when logged and on target, hollow when not, with weekday letters under.
Then a sleep bars card and a screen-time bars card, same style, smaller.
```

## 6. Log food

**Purpose:** add a meal in under ten seconds.

**Data:** meal-type pills, search box, results list with Marathi and English
names and calories per portion, a basket with portion multipliers and unit
choice, a running total, today's entries.

```
Phone screen for adding food to a dark health app. Top: two wide buttons, Photo
and Water. Then a small weight-entry card with one number field and a save
button.
Main card: four meal pills Breakfast, Lunch, Snack, Dinner with one selected.
A search field with a magnifier and the placeholder "Search food, e.g. poha".
Below it a results list; each row shows the food name in Marathi as the main
line with the English name smaller beneath, the portion on the left in grey,
calories on the right, and a plus button.
Under the search, a basket section: each chosen food on its own block with the
name, the gram weight, the calories on the right, a small x to remove, and
below it a row of portion pills 0.5, 1, 1.5, 2, 3 plus unit pills katori and
plate. A divider, then the running total "270 kcal, 5 g protein" on the left and
a Save button on the right.
Finally a Today card listing what has been logged with a delete icon per row.
```

## 7. Photo to calories

**Purpose:** the feature people will show their friends. It must look confident
but make correcting it feel expected, not like failure.

**States:** empty, camera, analysing, results, nothing recognised, PC offline.

```
Phone screen for reading calories from a food photo, dark health app. Show four
states as four phone screens.
State 1 empty: a large dashed rounded rectangle with a thin camera icon and the
text "Take a photo of your plate", and two buttons Take photo and Choose photo,
with a small grey note "Calories come from the food list, not the photo".
State 2 analysing: the photo filling a rounded card at the top, dimmed, with a
thin circular loader over it and the caption "Reading the plate".
State 3 results: the photo as a rounded banner at top, then a meal-type pill
row, then a list of detected items. Each item block shows the English name as
the title, the Marathi name under it in emerald, the calories and gram weight
right-aligned, a small x, and a row of small pills: a confidence percentage, an
amber "estimated" pill when the item is a guess, portion multipliers 0.5x 1x
1.5x 2x, and an Edit pill. One item is expanded showing an inline search box
with four replacement suggestions.
At the bottom, a total of 620 kcal with protein underneath, and a Save button.
State 4 offline: a calm amber card saying the PC is not reachable, the photo is
queued, and a button to search the food list instead.
```

## 8. Move

**Purpose:** show today's session, sized to how the person actually slept.

**Data:** readiness ring and score, session title, week and phase, duration and
move count, a coaching line, start and skip, then the exercise list.

```
Phone screen titled Move for a dark health app. Hero card: on the left a
session title "Full session", a small grey line "Readiness 70, week 3, phase 1",
and a second line "25 min, 8 moves". On the right a thin ring with the number 70
inside, coloured emerald. Under them one sentence of coaching, then a row of
small grey reason chips. Two buttons side by side, Start and Skip today.
Below, the exercise list. Each exercise is a card with the Marathi name as the
title, the English name smaller under it, a grey line "30 sec x 2 sets, rest
20s", a small category pill on the right, and a thin chevron to expand.
One card is expanded showing numbered steps, an amber one-line safety note, and
small pills for muscles, equipment and impact.
At the bottom a weekly card with a thin progress bar for the walking target.
```

## 9. Exercise detail and timer

```
Phone screen for doing one exercise in a dark health app. A large rounded media
area at the top for a demonstration image. Under it the exercise name in Marathi
with the English name beneath. A very large centred countdown "00:28" with a
thin circular ring around it. Under that, "Set 2 of 3" and small dots showing
set progress. Three buttons: Pause, Skip, Done. Below, a collapsible list of
numbered instructions and an amber safety line. Very calm, very few elements.
```

## 10. Mind

```
Phone screen titled Mind for a dark health app. Top card asks "How are you
feeling?" with five circular mood buttons in a row, each holding a simple line-
drawn face from sad to happy, the selected one ringed in emerald. Under it a
multiline text field "One line about it, optional" and a full-width Save button.
Then a row of three tool buttons: Breathe, Grounding, Gratitude.
Then a card titled Today listing earlier check-ins, each row with a small face,
the note, and the time.
Also show a second screen variant: a calm red-bordered helpline card at the top
titled "Please talk to someone", two sentences, and three tappable helpline rows
each with a name, a description and a phone number in emerald.
```

## 11. Breathing exercise

```
Full-screen breathing exercise for a dark health app. A single large soft
emerald circle centred on a near-black background, with a large number counting
down inside it. Under the circle one word, "Breathe in". At the bottom a small
Stop button and four tiny dots showing which of the four phases is active.
Nothing else on screen. Very calm.
```

## 12. Coach chat

```
Phone chat screen for a dark health app. Header with the title Coach and a small
green dot with "AI: PC". When empty, four suggestion pills in two rows, written
as questions. Message bubbles: the person's messages right-aligned in a deep
emerald bubble, the app's messages left-aligned in a dark card bubble with a
slightly lighter border. One app message includes a small inline card with three
meal suggestions, each with a name and a calorie count. Under one app message a
small row with a thumbs up and thumbs down and the text "Remember this".
At the bottom a rounded input bar with a text field, a microphone icon and an
emerald send button.
```

## 13. What Sobat knows (memory)

**Purpose:** the thing you asked for, where you feed it information and it keeps
it for later. It must be visible and deletable, or it feels creepy.

```
Phone screen titled "What Sobat knows about you" in a dark health app. At the
top, an input card with a text field "Tell Sobat something to remember" and an
emerald Add button, plus three example chips like "I am vegetarian", "My knee
hurts on stairs", "I work night shifts".
Below, memories grouped under small section headers: About you, Preferences,
Goals, Day notes. Each memory is a row with the text, a tiny grey source label
saying either "you told me" or "learned", the date on the right, and an x to
delete. Rows the app learned itself have a slightly dimmer text colour.
At the bottom a small grey line: "Stored only on this device. 42 of 200."
```

## 14. Sleep check-in

```
Phone screen for a morning sleep check-in, dark health app. Title "Morning
check-in" with a grey line "Times are guessed from your activity, just fix them
if wrong". Two time fields side by side, Slept at and Woke at, each showing a
prefilled time in large text.
Then three question blocks, each with a small label and a row of five selectable
pills: How was it, How many times did you wake, Energy right now.
Then a result strip with a thin ring showing a score of 74 on the left and
"7h 15m" in large text on the right. A full-width Save button.
Below, a history card listing the last seven nights, one row each with the date,
the duration and the score, and a small amber note at the top when a pattern
needs attention.
```

## 15. Break overlay — the 20-minute pause

**Purpose:** the screen that takes over the PC. It must feel like relief, not
punishment, and it must be obvious how long it lasts.

```
Full-screen break overlay for a dark app, desktop 1440px. Almost entirely empty
near-black screen. Centred: a very large thin countdown ring with "0:47" inside
it. Above the ring one calm line, "Look away from the screen". Under the ring
one small grey line with a suggestion, "Focus on something far away, roll your
shoulders". At the very bottom, two small quiet buttons far apart: "Skip this
break" on the left in grey, and "I'm done" on the right in emerald, the second
one only appearing once the countdown ends. A tiny line in the corner reads
"Break 4 of 12 today". No other UI, no navigation, no cards.
```

Also design the small pre-warning that appears 60 seconds before:

```
Small toast notification for a dark app, bottom right of a desktop screen. A
compact card with a thin clock icon, the line "Break in 1 minute", a short grey
sub-line "Finish what you are typing", and two small text buttons, Snooze 10 min
and Skip.
```

## 16. Nudge card

```
Small floating notification card for a dark health phone app, sitting above the
bottom tab bar. It has a title "Water break", one line of body text, an emerald
one-line task "Drink a full glass", a large centred countdown number when the
task timer is running, and three small buttons in a row: Start, 10 min, Skip.
Compact, rounded, with a thin emerald border.
```

## 17. Settings

```
Phone settings screen for a dark health app, organised as grouped cards with
small section headers. Groups: Language with three pills. Connection with two
address fields, two model-name fields, a Test connection button and a green
"Connected, 2 models" result line. Break monitor with an on/off switch, interval
pills 15 20 30 45 60 minutes, a break-length row, an allow-skip switch, and a
small grey explanation line. Reminders with an on/off switch, interval pills and
two quiet-hours time fields. Water goal as five pills. Your data with three
counts, an Export button, and a red Erase everything button at the bottom.
Every switch row has a title and a one-line grey description under it.
```

## 18. Empty and first-run states

```
Four empty states for a dark health app, shown as four phone screens. Each has a
simple thin line illustration in emerald on near-black, a short title and one
line of grey text, plus a single button.
1. No meals logged today, button Add your first meal.
2. Not enough data for Growth yet, showing a faint skeleton chart behind, with
   the line "Log three more days to see your patterns".
3. AI not connected, with a small unplugged icon, the line "Everything still
   works, Sobat just cannot talk right now", button Set up connection.
4. No memories yet, with the line "Tell Sobat something about you".
```

---

## What I need back

For each screen, one image and its number. If Stitch gives you variants, send
the one you like. If you change your mind about the colours, send the new hex
values with the images and I will retheme everything at once.

Screens 3, 5 and 12 matter most. If you only design a few, do those three plus
the landing page, and I will derive the rest from them so the app stays
consistent.
