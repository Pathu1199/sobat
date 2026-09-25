# Smart Health Assistant — Feature List

Personal, local-first, open-source health companion. Android + Windows. AI via Ollama on the PC.
See `ARCHITECTURE.md` for how each piece is built.

## 1. Daily activity journal
- Timeline of the day: wake, meals, snacks, water, exercise, screen time, mood, sleep — each a time-stamped card.
- Quick add in under 10 seconds: voice → text, photo of plate, tap a favourite, "same as yesterday".
- Indian food database with portions in roti, katori, vati, glass, piece, plate. Names in English, Marathi, Hindi.
- Night summary: "aaj ka din" in 5 lines, written by the AI from the log.
- Weekly pattern review (late-night snacking on work days, low water on weekends, etc.).

## 2. Calorie tracking and decisions
- Daily kcal + protein target from weight, height, age, activity, with a safe deficit and a calorie floor.
- Live budget: consumed / remaining / per-meal budget for the rest of the day.
- **Decision cards** after every meal: what to eat next, movement, water — with "Why" showing the numbers.
- Overeat mode: calm damage-control plan (lighter dinner from DB, walk, water, no skipping, no guilt).
- Under-eat flag, protein flag, late-night-eating flag.
- Craving SOS: 2-minute delay routine before junk food.
- "What should I eat" chat using what's in your kitchen and the remaining budget.

## 3. Photo → calories (editable, English + Marathi)
- Take a photo; the vision model names the dishes and estimates portions.
- Calories come from the food database, not the model; model-only estimates are badged "estimated".
- Editable card: change name (search DB), change portion (½ / 1 / 1½ / 2), swap, delete, add.
- Marathi + English names shown; missing Marathi name can be added and is saved for everyone.
- Learns from corrections: similar photos show your corrected answer first.
- Barcode scan for packaged food (Open Food Facts).
- Works when PC is offline: photo queued, text/voice search available immediately.

## 4. Sleep tracking with questions
- Bedtime and wake time pre-filled from phone/PC activity; you just confirm.
- Morning check-in, 20 seconds: sleep time, wake time, quality 1–5, wake-ups, energy now. Extra questions only when the score is low.
- Sleep score, 7-day sleep debt, regularity.
- Wind-down reminder and screen-off time in the evening.
- Weekly questions about snoring / daytime sleepiness → "talk to a doctor" card when a pattern appears.
- Day plan adapts to sleep: intensity, meals, bedtime.

## 5. Fitness plan ("make me fit", joint-safe at 100 kg)
- Phases: Foundation (weeks 1–4: walking 10→30 min, mobility) → Strength basics (weeks 5–12: bodyweight + bands, 2–3×/week) → Progression.
- Low-impact library with image/GIF demo, timer, rep counter.
- Daily readiness score (sleep + soreness + mood) → green / yellow / red session.
- Auto-adjust: skip 3 days → plan gets easier, not louder.
- Step counter, weekly step goal ramp, non-scale wins (waist, stairs without breathlessness).
- Workout log: done / skipped / how it felt / any pain.

## 6. Windows desktop companion
- System tray, starts with Windows, fully offline.
- Break nudge every 30 min (configurable): "Abhi 2 minute screen se hat lo" + a micro-task with timer.
- Skips when idle; focus/Pomodoro mode; quiet hours.
- Water reminder with glass counter.
- Screen-time tracker (apps/sites, local only, off by default).
- Doom-scroll guard: 45 min continuous on flagged sites → "ये नको, हे बघ" card with your progress.
- Same logging + chat as the phone.

## 7. Mind reset module
- Mood check-in twice a day (emoji + one line).
- 1–3 minute resets: breathing bubble, 5-4-3-2-1 grounding, 3 gratitude lines, brain dump, 2-minute tidy timer.
- Thought reframing with the AI (CBT self-help style).
- Motivation from your own data ("12 days logged in a row").
- Mini-apps: tap-the-dot focus, breathing bubble, one small win, gratitude jar.
- Safety net: sustained low mood or self-harm language → Indian helplines card (Tele-MANAS 14416, KIRAN 1800-599-0019, iCall 9152987821) and "talk to a person" nudge. Shown by code, not by the model.

## 8. AI assistant (Ollama, local)
- Roles: morning planner, food advisor, exercise coach, mood companion, weekly report writer.
- Tools it can call: today's totals, food search, log meal/water/mood, sleep data, meal suggestions, workout plan, reminders, insights, mini-apps.
- Memory: profile facts, preferences (from thumbs up/down), photo corrections, weekly episodes, semantic search over journal.
- Structured JSON outputs, guardrails (calorie floor, no diagnosis, no crash diets).
- Phone reaches PC Ollama over Wi-Fi / Tailscale; rule-based fallback when PC is off.

## 9. Reminders
- Water, meals, exercise slot, medicine, weekly weigh-in, sleep time. Smart snooze, quiet hours.

## 10. Reports and insights
- Daily score in five rings: eating, movement, water, sleep, mood.
- Weekly AI report (Markdown/PDF). Correlations like "sleep < 6 h → +400 kcal next day".

## 11. Privacy and open source
- Local SQLite + PocketBase on your PC. No account, no cloud.
- JSON export/import, optional encrypted backup.
- MIT licence, public repo, curated open dataset of Maharashtrian foods with mr/en/hi names.
