# Sobat

**सोबत** — Marathi for *company*, *being with you*.

A local-first health companion for one person. It tracks what you eat, how you
sleep, how you move and how you feel, then turns that into a small number of
concrete things to do today. The AI runs on your own PC through
[Ollama](https://ollama.com). No account, no cloud, no data leaving your devices.

Runs on **Android** and in the **browser** from one codebase. The browser build
is what the Windows desktop shell loads.

## Get it

| | |
| --- | --- |
| **Web** | <https://sobat-a56c7.web.app> — works in any browser, data stays in that browser |
| **Android** | <https://github.com/Pathu1199/sobat/releases/latest/download/sobat.apk> — or tap **Download for Android** on the site |
| **Windows** | build the installer with `desktop/build-windows.ps1`, see [SETUP.md](SETUP.md) |

Every push to `main` is tested, built and deployed by GitHub Actions; the
website and the APK are always the latest `main`.

> Sobat is not a doctor or a counsellor. Get your blood pressure, sugar and
> thyroid checked before starting hard exercise, and talk to a real person when
> things feel heavy.

---

## What it does

### Calories that lead to a decision
Your daily target comes from Mifflin-St Jeor, your activity level and a deficit
capped at 1 kg per week. It is then clamped to a calorie floor, so an
over-ambitious goal quietly becomes a safe one.

After every meal the app works out the situation in plain code — over budget,
protein low, eating too little, late-night habit — and shows a card with the
actions and the numbers behind them. It never tells you to skip a meal.

### Photo to calories, editable, in English and Marathi
Take a picture of your plate. A vision model on your PC names the dishes and
estimates the portions. **It is not allowed to guess calories** — those come from
the food database. Anything with no database match is badged `estimated`.

Every line is editable: change the dish, change the portion, delete it, add one.
Your corrections are stored and fed back to the model as examples next time.

### Sleep, by asking
Bedtime and wake time are guessed from your own activity, so the morning
check-in is a confirm rather than a form. Five questions, about twenty seconds.
You get a sleep score, a 7-day debt figure and a bedtime-regularity number.

If long nights keep leaving you tired, it suggests asking a doctor about sleep
apnea. That is common at higher body weight and it blocks fat loss.

### Movement that adapts
A readiness score from sleep, soreness and mood decides whether today is green,
yellow or red. Red days become breathing and stretching, never nothing. Miss
three days and the plan gets **easier**, not louder. 50 joint-safe exercises,
nothing with jumping or running at level 1.

### A mind that gets checked on
Mood check-ins, a breathing box, 5-4-3-2-1 grounding, gratitude lines. If what
you write sounds like a crisis, the helpline card is shown **by code**, before
the model ever sees the text. Tele-MANAS, KIRAN and iCall, tappable to dial.

### A routine you set once
Pick the bhaji for each weekday, the fixed meals of your day and the foods you
have decided to stop. The Today screen shows the plan, logs any meal in one tap
with real numbers from the food database, flags an avoided food with a swap, and
keeps a daily food budget in rupees — bulk buys are spread over the days they
last. Everything about it is editable in the app.

### Reminders that back off
Every 30 minutes by default. It stays quiet when you are idle, during quiet
hours, and it drops the frequency of any nudge type you keep skipping. Every
nudge carries a two-minute task with a timer, not just a sentence.

---

## The one rule that makes it trustworthy

> **Code does the numbers. The model does the words.**

Calorie targets, budgets, sleep scores, readiness and every decision are pure
TypeScript in `src/core`, covered by 78 unit tests. The language model only
identifies food in photos and rewrites the already-decided advice in a friendlier
voice. Its output then passes through `guardrails.ts`, which rejects calorie
figures below the floor, meal skipping and anything that reads as a diagnosis.

A small local model can be wrong. It cannot be wrong about your calories.

---

## Quick start

```bash
npm install
npm run web        # browser, works immediately
npm run android    # needs Android Studio, or use Expo Go
npm test           # 78 core tests
```

The app works fully offline. Point it at your Ollama when you want the AI parts.

### Connect it to Ollama on Windows

Step by step, including the phone and troubleshooting: [SETUP.md](SETUP.md).
The short version:


Ollama only listens on localhost by default. On the PC, once:

```powershell
setx OLLAMA_HOST 0.0.0.0
netsh advfirewall firewall add rule name="Ollama LAN" dir=in action=allow protocol=TCP localport=11434 profile=private
```

Restart Ollama, then pull the models:

```powershell
ollama pull qwen3:8b
ollama pull qwen2.5vl:7b
```

Find the PC's address with `ipconfig`, put `http://<that-ip>:11434` into
Settings, and press **Test connection**. To reach it from outside the house,
install [Tailscale](https://tailscale.com) on both devices and put the Tailscale
name in the fallback field. Never port-forward Ollama to the open internet.

### When the PC is off

Logging, targets, decisions, reminders, the food database and the fitness plan
all keep working. Chat is unavailable and photos are queued. The badge at the
top of Today always says which of these you are in.

---

## Project layout

```
src/
  core/         Pure domain logic, no React, fully unit tested
    nutrition   BMR, TDEE, targets, calorie floor, budgets
    decide      Situation rules and the action list
    sleep       Score, debt, bedtime regularity, red flags
    fitness     Readiness, phases, session builder
    nudge       Which reminder, when, and when to shut up
    guardrails  Crisis detection and model-output checks
    insights    Day scores, streaks, weight trend, patterns
    foods       Fuzzy search across English, Marathi and Hindi
  ai/           Ollama client, fallback routing, prompts, schemas
  data/         234 Indian foods, 50 exercises, nudge messages
  store/        State and AsyncStorage persistence
  i18n/         English, Marathi, Hindi
  ui/           Theme tokens and shared components
  app/          Screens (Expo Router)
docs/
  ARCHITECTURE.md   The full end-to-end design
  FEATURES.md       The complete feature list
```

## Data

- **234 foods**, 90 of them Maharashtrian, with names in English, Marathi and
  Hindi and portions in katori, vati, plate, piece and glass. Values based on the
  Indian Food Composition Tables 2017 where available.
- **50 exercises**, all low impact, with steps in three languages and a safety
  line each.

Both are plain JSON. Add your own, send a pull request.

## Privacy

Everything sits in local storage on the device. Nothing is uploaded. There is no
account and no analytics. Settings has a one-click JSON export and an erase
button.

## Windows

The desktop app is a thin Tauri shell around this same web build. It adds
autostart at login, a tray icon, and real system-wide idle detection, which is
what makes the break monitor skip itself when you have already stepped away.
It has to be built on the PC: see [SETUP.md](SETUP.md) for every command
from a blank machine to a working install.

## Status

v0.4 part 2a. Working: everything in v0.3, plus one compact top bar per tab, a
five-slot phone tab bar with a centre "+", a Today screen with a hero ring,
decision checklist, Now strip and day score, tappable and editable meals with
a yesterday view, desktop layouts for every tab, local-time clocks, and toasts
on every save.

And now four kinds of screen break rather than one timer: a twenty-second
micro break on the 20-20-20 rule, a longer one that suggests two mobility
moves, and posture and blink nudges that never take the screen. Each has its
own interval. Breaks can be gentle, normal with a daily skip budget, or
strict. They stay quiet during fullscreen video and calls, outside your work
hours, and while you are away from the desk. Growth shows how the week went
per kind, with a streak.

Not built yet: water pace reminders, the app reaching out on its own,
phone-to-PC sync, Health Connect, and the Windows installer itself, which has
to be produced on the PC. The Windows shell code for smart pause and the
global shortcuts is written but has only ever been compiled on paper: it needs
a build on the PC.

## Licence

MIT.
