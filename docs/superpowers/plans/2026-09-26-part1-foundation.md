# Part 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three review bugs, give Sobat one compact shell with a five-slot phone tab bar, rebuild Today with a real hierarchy on phone and desktop, and give the other five tabs true desktop layouts, all on the existing palette and primitives.

**Architecture:** New pure helpers in `src/core` (local time, day-score "later", pattern keys) with vitest tests; new UI primitives in `src/ui` (TopBar/Page, HeroRing, Tile, Checklist, Sheet, Toast, Face, Skeleton, Cols) built on React Native's own `Animated` so they behave identically on web and Android; screens in `src/app` composed from those primitives with a `wide` branch for desktop. One break-monitor instance lives in a provider so the sidebar, Now strip and overlay read the same clock.

**Tech Stack:** Expo SDK 57, expo-router 57, React Native 0.86, react-native-web 0.21, react-native-svg 15, expo-haptics 57, vitest 4, TypeScript 6.

**Deviation from the spec, on purpose:** the spec named Reanimated as the animation layer. Part 1 uses React Native's built-in `Animated` instead, because animating SVG stroke offsets from Reanimated on web needs `setNativeProps` support that cannot be verified without running it. Every animation here is a value that drives React state, which works on both platforms today. Part 2's breathing ring can adopt Reanimated once it is verified in the browser.

## Global Constraints

- Colours only from `src/ui/theme.ts`; no hex literals in screens.
- No React in `src/core`. Every new branch there has a vitest test.
- Every user-visible string goes through `makeT(lang)`; English first, chosen language beside it (`BiText`) where the design shows both.
- Layouts: phone below 760 px, desktop at 1080 px and above (`useBreakpoint`). Phone gutter 16, desktop gutter 24, desktop max width 1360.
- Before finishing any task that touches the interface: `npx tsc --noEmit` clean, `npm test` green, and the affected screens looked at in the browser at 375 px and 1440 px with ten days of seeded data (seeding recipe in Task 0).
- Commit after every task on branch `premium-ui`. End commit messages with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Timezone: the app runs in `Asia/Kolkata`; tests pin `TZ` so a UTC machine catches the same bugs.

---

### Task 0: Baseline, lint config, and the seed recipe

**Files:**
- Create: `eslint.config.js` (generated)
- Create: `scripts/seed-state.js`
- Modify: `vitest.config.mts`
- Modify: `package.json` (scripts only)

**Interfaces:**
- Produces: `npm run seed` prints a JSON blob that, pasted into the browser console, fills `localStorage['sobat.state.v1']` with ten days of data. Every later task's verification step uses it.

- [ ] **Step 1: Confirm the baseline is green**

Run: `cd /Users/varad/Documents/Projects/sobat && git status --short && npm test 2>&1 | tail -5 && npx tsc --noEmit && echo TSC_OK`
Expected: no uncommitted files, `Test Files 13 passed`, `TSC_OK`.

- [ ] **Step 2: Pin the test timezone**

Replace `vitest.config.mts` with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/core/**/*.test.ts'],
    environment: 'node',
    // The app is used in India. A UTC laptop must see the same clock bugs.
    env: { TZ: 'Asia/Kolkata' },
  },
});
```

Run: `npm test 2>&1 | tail -3`
Expected: still `13 passed`.

- [ ] **Step 3: Bootstrap ESLint**

Run: `npx expo lint`
If it asks to set up ESLint, accept the defaults. Expected at the end: a new `eslint.config.js` and either `✔ No ESLint warnings found` or a list of existing warnings. Note the count; Part 1 must not add to it.

- [ ] **Step 4: Write the seed script**

Create `scripts/seed-state.js`:

```js
// Prints an AppState JSON with ten days of history. Paste the output into the
// browser console as:  localStorage.setItem('sobat.state.v1', <paste>); location.reload()
// Or run:  npm run seed | pbcopy
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString(); };
const days = [];
for (let i = 9; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(12, 0, 0, 0); days.push(d); }
const today = days[days.length - 1];
const item = (foodId, name_en, name_mr, grams, kcal, protein, carbs, fat) => ({ foodId, name_en, name_mr, grams, kcal, protein, carbs, fat, estimated: false });
const B = [[item('poha', 'Poha', 'पोहे', 150, 240, 4, 45, 6), item('chai', 'Tea with milk', 'चहा', 150, 60, 2, 8, 2)], [item('upma', 'Upma', 'उपमा', 150, 260, 6, 42, 8)], [item('idli', 'Idli', 'इडली', 120, 180, 6, 36, 1), item('sambar', 'Sambar', 'सांबार', 150, 110, 5, 14, 3)]];
const L = [[item('chapati', 'Chapati', 'चपाती', 80, 238, 8, 42, 4), item('dal-tadka', 'Dal Tadka', 'डाळ', 150, 170, 9, 20, 5), item('bhendi', 'Bhendi Bhaji', 'भेंडीची भाजी', 100, 120, 2, 10, 8)], [item('jowar-bhakri', 'Jowar Bhakri', 'ज्वारीची भाकरी', 120, 390, 10, 80, 3), item('pithla', 'Pithla', 'पिठलं', 150, 190, 9, 20, 8)], [item('steamed-rice', 'Steamed Rice', 'शिजवलेला भात', 150, 195, 4, 42, 0), item('varan', 'Varan', 'वरण', 150, 150, 8, 22, 3), item('curd', 'Curd', 'दही', 100, 60, 3, 4, 3)]];
const S = [[item('chai', 'Tea with milk', 'चहा', 150, 60, 2, 8, 2), item('biscuit', 'Marie Biscuit', 'बिस्किट', 20, 90, 1, 15, 3)], [item('banana', 'Banana', 'केळं', 100, 90, 1, 23, 0)], [item('chivda', 'Chivda', 'चिवडा', 40, 190, 3, 22, 10)]];
const D = [[item('chapati', 'Chapati', 'चपाती', 80, 238, 8, 42, 4), item('paneer-bhurji', 'Paneer Bhurji', 'पनीर भुर्जी', 120, 290, 16, 6, 22)], [item('khichdi', 'Moong Dal Khichdi', 'खिचडी', 250, 330, 12, 55, 6), item('curd', 'Curd', 'दही', 100, 60, 3, 4, 3)], [item('steamed-rice', 'Steamed Rice', 'शिजवलेला भात', 150, 195, 4, 42, 0), item('egg-curry', 'Egg Curry', 'अंडा करी', 150, 280, 14, 8, 20)]];
const sum = (items, k) => Math.round(items.reduce((a, x) => a + x[k], 0));
const meal = (d, type, items, h, m) => ({ id: `${iso(d)}-${type}`, at: at(d, h, m), date: iso(d), type, items, kcal: sum(items, 'kcal'), protein: sum(items, 'protein') });
const meals = [], water = [], moods = [], workouts = [], sleep = [], weights = [], usage = [], breaks = [];
const hourNow = new Date().getHours();
days.forEach((d, i) => {
  const isToday = i === days.length - 1;
  meals.push(meal(d, 'breakfast', B[i % 3], 8, 40));
  if (!isToday || hourNow >= 13) meals.push(meal(d, 'lunch', L[i % 3], 13, 20));
  if (!isToday || hourNow >= 17) meals.push(meal(d, 'snack', S[i % 3], 17, 10));
  if (!isToday || hourNow >= 21) meals.push(meal(d, 'dinner', D[i % 3], i === 2 || i === 6 ? 22 : 21, 15));
  const glasses = isToday ? Math.min(12, Math.max(2, Math.floor(hourNow / 2))) : 7 + (i % 4);
  for (let g = 0; g < glasses; g++) water.push({ id: `${iso(d)}-w${g}`, at: at(d, 8 + g, 15), date: iso(d), ml: 250 });
  moods.push({ id: `${iso(d)}-m`, at: at(d, 10, 5), date: iso(d), score: [3, 4, 3, 2, 4, 4, 3, 4, 3, 4][i], note: i === 3 ? 'Tired, long meeting day' : i === 7 ? 'Walk felt good' : undefined });
  if ([0, 1, 3, 4, 6, 7, 8].includes(i)) workouts.push({ id: iso(d), date: iso(d), exerciseIds: [], minutes: 18 + ((i * 3) % 12), status: 'done', felt: 3 + (i % 2), pain: false });
  if (i === 5) workouts.push({ id: iso(d), date: iso(d), exerciseIds: [], minutes: 0, status: 'skipped' });
  const bed = ['23:30', '00:10', '23:45', '00:40', '23:20', '23:55', '23:30', '00:05', '23:40', '23:35'][i];
  const wake = ['07:00', '07:10', '06:50', '07:30', '06:45', '07:20', '07:00', '07:15', '06:55', '07:05'][i];
  const [bh, bm] = bed.split(':').map(Number); const [wh, wm] = wake.split(':').map(Number);
  const minutes = wh * 60 + wm - (bh * 60 + bm) + (bh >= 12 ? 1440 : 0);
  const quality = [4, 3, 4, 2, 4, 3, 4, 3, 4, 4][i], wakeups = [0, 1, 0, 2, 0, 1, 0, 1, 0, 0][i], energy = [4, 3, 4, 2, 4, 3, 4, 3, 4, 4][i];
  const score = Math.max(30, Math.min(95, Math.round(40 + (minutes - 360) / 3 + quality * 6 - wakeups * 5 + energy * 3)));
  sleep.push({ date: iso(d), bed, wake, quality, wakeups, energy, minutes, score });
  if (i % 2 === 0 || isToday) weights.push({ date: iso(d), kg: Math.round((100.2 - i * 0.17) * 10) / 10 });
  const hours = isToday ? [9, 10, 11, 12, 13, 14, 15, 16, 17, 18].filter((h) => h <= hourNow) : [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  hours.forEach((h) => usage.push({ date: iso(d), hour: h, activeMinutes: h === 13 ? 20 : 38 + ((h * 7 + i) % 20) }));
  const nb = isToday ? Math.max(1, Math.min(6, Math.floor((hourNow - 9) / 1.5))) : 8;
  for (let b = 0; b < nb; b++) breaks.push({ id: `${iso(d)}-b${b}`, date: iso(d), at: at(d, 9 + b, 20), action: b % 4 === 3 ? 'skipped' : 'taken', workedMinutes: 20 });
});
const state = {
  version: 1,
  profile: { name: 'Varad', sex: 'male', birthYear: 1998, heightCm: 172, weightKg: weights[weights.length - 1].kg, activity: 'sedentary', goalWeightKg: 80, rateKgPerWeek: 0.5, lang: process.env.LANG_OVERRIDE || 'mr', onboarded: true },
  settings: { ollamaUrl: 'http://192.168.1.10:11434', ollamaFallbackUrl: '', textModel: 'qwen3:8b', visionModel: 'qwen2.5vl:7b', nudgeMinutes: 30, nudgesEnabled: true, quietStartHour: 22, quietEndHour: 7, waterGoalMl: 3000, glassMl: 250 },
  meals, water, weights, sleep, moods, workouts, nudges: [], customFoods: [], memory: [], usage, breaks,
  breakSettings: { enabled: true, workMinutes: 20, breakSeconds: 60, allowSkip: true, quietStartHour: 22, quietEndHour: 7 },
  tips: [{ date: iso(today), text: 'तू सलग ९ दिवस लॉग करतो आहेस. आज दुपारी १५ मिनिटं चाल. प्रोटीन थोडं कमी आहे, संध्याकाळी दही किंवा अंडं घे.', lang: 'mr' }],
  photoQueue: [], steps: [{ date: iso(today), count: 4180 }],
  chat: [
    { id: 'c1', role: 'user', text: 'आता काय खाऊ?', at: at(today, 12, 30) },
    { id: 'c2', role: 'assistant', text: 'तुझ्याकडे आज अजून ~९०० kcal शिल्लक आहेत आणि प्रोटीन कमी आहे. दुपारी २ चपाती + १ वाटी डाळ + थोडं दही घे.', at: at(today, 12, 31), options: [{ foodId: 'chapati', name_en: 'Chapati', name_mr: 'चपाती', grams: 80, kcal: 238, protein: 8 }, { foodId: 'dal-tadka', name_en: 'Dal Tadka', name_mr: 'डाळ', grams: 150, kcal: 170, protein: 9 }, { foodId: 'curd', name_en: 'Curd', name_mr: 'दही', grams: 100, kcal: 60, protein: 3 }] },
  ],
};
process.stdout.write(JSON.stringify(JSON.stringify(state)));
```

Add to `package.json` scripts: `"seed": "node scripts/seed-state.js"`.

Run: `npm run seed | head -c 120`
Expected: a JSON string starting with `"{\"version\":1,`.

**How every later verification step uses it:** with the dev server up (`npx expo start --web --port 8082`), open the browser console on `http://localhost:8082`, paste `localStorage.setItem('sobat.state.v1', ` + the printed value + `); location.reload()`. Then check the screen at 375 px and 1440 px widths.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.mts eslint.config.js package.json package-lock.json scripts/seed-state.js
git commit -m "Pin the test timezone, add lint config and a seed script for interface review

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 1: Local-time helpers, used everywhere an ISO string was sliced

**Files:**
- Modify: `src/core/date.ts`
- Create: `src/core/__tests__/date.test.ts`
- Modify: `src/core/insights.ts:101-127`
- Modify: `src/app/(tabs)/index.tsx:44-46` and `:241`
- Modify: `src/app/(tabs)/log.tsx:229`
- Modify: `src/app/(tabs)/mind.tsx:107`
- Modify: `src/app/sleep.tsx:18-23`

**Interfaces:**
- Produces: `localHHMM(iso: string): string` ("08:40"), `localHour(iso: string): number`, `localDate(iso: string): ISODate`, `formatDayLabel(date: ISODate, lang: Lang): string` ("Sat 26 Sep", localised). Later tasks call these; never slice an ISO string again.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDayLabel, localDate, localHHMM, localHour } from '../date';

// vitest.config.mts pins TZ to Asia/Kolkata (UTC+5:30).
describe('local time from ISO strings', () => {
  const breakfast = '2026-09-26T03:10:00.000Z'; // 08:40 IST
  const lateDinner = '2026-09-26T17:00:00.000Z'; // 22:30 IST
  const afterMidnight = '2026-09-26T19:30:00.000Z'; // 01:00 IST on the 27th

  it('formats the clock in local time, not UTC', () => {
    expect(localHHMM(breakfast)).toBe('08:40');
    expect(localHHMM(lateDinner)).toBe('22:30');
  });

  it('gives the local hour so a 22:30 dinner counts as late', () => {
    expect(localHour(lateDinner)).toBe(22);
    expect(localHour(breakfast)).toBe(8);
  });

  it('gives the local calendar date across midnight', () => {
    expect(localDate(afterMidnight)).toBe('2026-09-27');
    expect(localDate(breakfast)).toBe('2026-09-26');
  });

  it('accepts zone-less strings as local time', () => {
    expect(localHHMM('2026-09-21T13:00')).toBe('13:00');
    expect(localHour('2026-09-21T13:00')).toBe(13);
  });

  it('labels a day without crashing in any language', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const label = formatDayLabel('2026-09-26', lang);
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toBe('2026-09-26');
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/core/__tests__/date.test.ts`
Expected: FAIL, `localHHMM is not a function` (or similar import error).

- [ ] **Step 3: Add the helpers**

Append to `src/core/date.ts`:

```ts
/** Clock time of an ISO timestamp in the device's own zone. Never slice the string. */
export function localHHMM(iso: string): string {
  return hhmm(new Date(iso));
}

export function localHour(iso: string): number {
  return new Date(iso).getHours();
}

/** Calendar date of an ISO timestamp in the device's own zone. */
export function localDate(iso: string): ISODate {
  return toISODate(new Date(iso));
}

const LOCALE: Record<string, string> = { en: 'en-IN', mr: 'mr-IN', hi: 'hi-IN' };

/** "Sat 26 Sep" in the chosen language. Falls back to the ISO date if Intl is missing. */
export function formatDayLabel(date: ISODate, lang: string): string {
  try {
    const d = new Date(date + 'T12:00:00');
    const s = d.toLocaleDateString(LOCALE[lang] ?? 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return s && s !== 'Invalid Date' ? s : date;
  } catch {
    return date;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/__tests__/date.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Replace every slice site**

In `src/core/insights.ts`, change the imports and three lines:

```ts
import { addDays, lastNDates, localHour } from './date';
```

Line 103-106 (next-day key) becomes:

```ts
  for (const s of input.sleep) {
    const key = addDays(s.date, 1);
    const kcal = byDate.get(key);
    if (kcal !== undefined) pairs.push({ short: s.minutes < 360, kcal });
  }
```

Line 120: `const lateCount = input.meals.filter((m) => localHour(m.at) >= 22).length;`
Line 126: `const h = localHour(m.at);`

In `src/app/(tabs)/index.tsx`: add `localHHMM, localHour` to the `../../core/date` import. Line 45 becomes `() => new Set(state.meals.filter((m) => localHour(m.at) >= 22).map((m) => m.date)).size,` and line 241's `${m.at.slice(11, 16)}` becomes `${localHHMM(m.at)}`.

In `src/app/(tabs)/log.tsx`: import `localHHMM` from `../../core/date` and change `sub={m.at.slice(11, 16)}` to `sub={localHHMM(m.at)}`.

In `src/app/(tabs)/mind.tsx`: import `localHHMM` from `../../core/date` (the file already imports `toISODate` from there) and change `sub={m.at.slice(11, 16)}` to `sub={localHHMM(m.at)}`.

In `src/app/sleep.tsx`, the guess block becomes:

```ts
  const guess = useMemo(() => {
    const all = [...app.state.meals.map((m) => m.at), ...app.state.water.map((w) => w.at), ...app.state.moods.map((m) => m.at)].sort();
    const yesterdayLast = all.filter((a) => localDate(a) < app.today).slice(-1)[0];
    const todayFirst = all.filter((a) => localDate(a) === app.today)[0];
    return prefillAnswers(yesterdayLast ? localHHMM(yesterdayLast) : null, todayFirst ? localHHMM(todayFirst) : null);
  }, [app.state.meals, app.state.water, app.state.moods, app.today]);
```

with `localDate, localHHMM` added to its `../core/date` import.

- [ ] **Step 6: Prove nothing slices any more, then typecheck and test**

Run: `grep -rn "slice(11\|slice(0, 10)" src --include='*.ts' --include='*.tsx' | grep -v __tests__; npx tsc --noEmit && npm test 2>&1 | tail -3`
Expected: the grep prints nothing; `TSC` silent; `14 passed`.

- [ ] **Step 7: Look at it**

Seed the browser (Task 0 recipe), open Today at 375 px. The breakfast row must read `08:40`, not `03:10`.

- [ ] **Step 8: Commit**

```bash
git add src/core/date.ts src/core/__tests__/date.test.ts src/core/insights.ts "src/app/(tabs)/index.tsx" "src/app/(tabs)/log.tsx" "src/app/(tabs)/mind.tsx" src/app/sleep.tsx
git commit -m "Show and judge clock times in local time, not UTC

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Day score says "later" before a metric's window, and names its biggest lever

**Files:**
- Modify: `src/core/insights.ts:5-57`
- Modify: `src/core/__tests__/insights.test.ts`
- Modify: `src/core/nudge.ts` (export stays; nothing changes) — `expectedWaterByHour` is imported into insights
- Modify: `src/app/(tabs)/index.tsx:70-83` (pass `expectedWaterMl`)

**Interfaces:**
- Produces: `DayScore` where `movement` and `water` are `number | null`; `scoreDay` gains optional `expectedWaterMl?: number`; new `biggestLever(score: DayScore): LeverKey | null` with `type LeverKey = 'eating' | 'movement' | 'water' | 'sleep' | 'mood'`.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/__tests__/insights.test.ts` inside `describe('scoreDay', ...)` after the last `it`:

```ts
  it('shows movement as "later" at noon when nothing is done yet', () => {
    const s = scoreDay({ ...b, workedOut: false, workoutMinutes: 0, kcal: 500, waterMl: 1000, hour: 12 });
    expect(s.movement).toBeNull();
  });

  it('scores movement once a session is done, even at noon', () => {
    const s = scoreDay({ ...b, kcal: 500, waterMl: 1000, hour: 12 });
    expect(s.movement).toBe(100);
  });

  it('scores movement as zero after 18:00 with nothing done', () => {
    const s = scoreDay({ ...b, workedOut: false, workoutMinutes: 0, kcal: 500, waterMl: 1000, hour: 19 });
    expect(s.movement).toBe(0);
  });

  it('judges water against the pace so far, not the whole goal', () => {
    // Noon, 1.5 L drunk, 3 L goal. Half the goal at noon is on pace.
    const s = scoreDay({ ...b, kcal: 500, waterMl: 1500, hour: 12, expectedWaterMl: 1071 });
    expect(s.water).toBe(100);
    const late = scoreDay({ ...b, kcal: 1800, waterMl: 1500 });
    expect(late.water).toBe(50);
  });

  it('leaves water unknown before the pace window opens', () => {
    const s = scoreDay({ ...b, kcal: 0, waterMl: 0, hour: 6, expectedWaterMl: 0 });
    expect(s.water).toBeNull();
  });
```

And a new describe block at the end of the file:

```ts
describe('biggestLever', () => {
  it('names the lowest known metric when it is dragging', () => {
    const s = scoreDay({ date: '2026-09-25', kcal: 1800, kcalTarget: 1800, waterMl: 600, waterGoalMl: 3000, workedOut: true, workoutMinutes: 40, sleepScore: 80, moodScore: 4 });
    expect(biggestLever(s)).toBe('water');
  });

  it('ignores metrics that are not known yet', () => {
    const s = scoreDay({ date: '2026-09-25', kcal: 450, kcalTarget: 1800, waterMl: 700, waterGoalMl: 3000, workedOut: false, workoutMinutes: 0, hour: 11, expectedWaterMl: 857 });
    // Movement is null at 11am; nothing else is below 60.
    expect(biggestLever(s)).toBeNull();
  });

  it('returns null when everything is fine', () => {
    const s = scoreDay({ date: '2026-09-25', kcal: 1800, kcalTarget: 1800, waterMl: 3000, waterGoalMl: 3000, workedOut: true, workoutMinutes: 40, sleepScore: 90, moodScore: 5 });
    expect(biggestLever(s)).toBeNull();
  });
});
```

Add `biggestLever` to the import from `'../insights'`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/core/__tests__/insights.test.ts`
Expected: FAIL on the new cases (`expected 0 to be null`, `biggestLever is not a function`).

- [ ] **Step 3: Change the score**

In `src/core/insights.ts` replace the `DayScore` type and `scoreDay` with:

```ts
/** null means 'not known yet today', which is different from a score of zero. */
export type DayScore = {
  date: ISODate;
  eating: number | null;
  movement: number | null;
  water: number | null;
  sleep: number | null;
  mood: number | null;
  total: number;
};

export type LeverKey = 'eating' | 'movement' | 'water' | 'sleep' | 'mood';

/** Movement is only judged once the evening window opens, unless it already happened. */
const MOVEMENT_JUDGED_FROM_HOUR = 18;

export function scoreDay(input: {
  date: ISODate;
  kcal: number;
  kcalTarget: number;
  waterMl: number;
  waterGoalMl: number;
  workedOut: boolean;
  workoutMinutes: number;
  sleepScore?: number;
  moodScore?: number;
  /** Hour of day when the day is still running. Omit to score a finished day. */
  hour?: number;
  /** How much water a person on pace would have drunk by `hour`. Only used while running. */
  expectedWaterMl?: number;
}): DayScore {
  // Mid-day, judge against what a normal eater would have had by now. Judging a
  // half-eaten day against the full target reads as failure at breakfast.
  const running = input.hour !== undefined && input.hour < 21;
  const denominator = running ? Math.max(expectedKcalByHour(input.kcalTarget, input.hour!), 1) : input.kcalTarget;

  let eating: number | null;
  if (input.kcal === 0) {
    eating = running ? null : 0;
  } else if (denominator <= 0) {
    eating = null;
  } else {
    const ratio = input.kcal / denominator;
    // Over the target hurts more than under it, in both modes.
    eating = ratio <= 1 ? clamp100(100 - Math.abs(1 - ratio) * 120) : clamp100(100 - (ratio - 1) * 220);
  }

  let movement: number | null;
  if (input.workedOut) movement = clamp100(60 + Math.min(input.workoutMinutes, 40));
  else if (running && input.hour! < MOVEMENT_JUDGED_FROM_HOUR) movement = null;
  else movement = 0;

  let water: number | null;
  if (running && input.expectedWaterMl !== undefined) {
    water = input.expectedWaterMl <= 0 ? null : clamp100((input.waterMl / input.expectedWaterMl) * 100);
  } else {
    water = clamp100((input.waterMl / Math.max(input.waterGoalMl, 1)) * 100);
  }

  const sleep = input.sleepScore === undefined ? null : clamp100(input.sleepScore);
  const mood = input.moodScore === undefined ? null : clamp100(((input.moodScore - 1) / 4) * 100);

  const known = [eating, movement, water, sleep, mood].filter((n): n is number => n !== null);
  const total = known.length > 0 ? clamp100(known.reduce((a, b) => a + b, 0) / known.length) : 0;
  return { date: input.date, eating, movement, water, sleep, mood, total };
}

/** The one known metric doing the most damage, or null when nothing is below 60. */
export function biggestLever(score: DayScore): LeverKey | null {
  const keys: LeverKey[] = ['eating', 'movement', 'water', 'sleep', 'mood'];
  let worst: LeverKey | null = null;
  let worstValue = 60;
  for (const k of keys) {
    const v = score[k];
    if (v !== null && v < worstValue) {
      worst = k;
      worstValue = v;
    }
  }
  return worst;
}
```

- [ ] **Step 4: Pass the pace from Today**

In `src/app/(tabs)/index.tsx` add `import { expectedWaterByHour } from '../../core/nudge';` and in the `scoreDay({...})` call add `expectedWaterMl: expectedWaterByHour(hour, state.settings.waterGoalMl),` after `hour,`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run src/core/__tests__/insights.test.ts && npx tsc --noEmit && echo OK`
Expected: all insights tests pass (existing ones unchanged), `OK`.

- [ ] **Step 6: Look at it**

Seeded browser, Today at 375 px, before 18:00: the "Moved" ring shows `--`, not `0%`. The water ring is near 100% rather than 44%.

- [ ] **Step 7: Commit**

```bash
git add src/core/insights.ts src/core/__tests__/insights.test.ts "src/app/(tabs)/index.tsx"
git commit -m "Score movement and water as 'later' before their window, and name the biggest lever

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Every visible string through i18n — pattern sentences, readiness reasons, exercise categories, units

**Files:**
- Modify: `src/core/insights.ts` (`Correlation` shape)
- Modify: `src/core/__tests__/insights.test.ts` (pattern assertions)
- Modify: `src/i18n/index.ts` (new keys in `en`, `mr`, `hi`)
- Modify: `src/app/(tabs)/index.tsx` (patterns block, `"Protein"`, `"Water"`, `Score`, `kg`)
- Modify: `src/app/(tabs)/fit.tsx` (reason pills, category pills)
- Modify: `src/app/session.tsx` (category micro)
- Modify: `src/app/settings.tsx` (`kg` count label)

**Interfaces:**
- Produces: `Correlation = { key: string; strength: number; params: Record<string, string | number> }`. UI renders `t('pattern_' + key)` with `{name}` placeholders replaced from `params`. New i18n keys listed in Step 3; later tasks use `later`, `day_score`, `lever_*`, `energy`, `next_break`, `on_pace`, `behind_glasses`, `ahead_glasses`, `check_in`, `log_mood`, `yesterday`, `close`, `recent`, `same_as_yesterday`, `toast_*`, `phase_of`, `todays_numbers`, `offered`, `score`, `unit_kg`.

- [ ] **Step 1: Change the pattern tests to assert keys and params**

In `src/core/__tests__/insights.test.ts`, `describe('findPatterns')`:

Replace `expect(p.some((x) => x.key === 'sleep_vs_kcal')).toBe(true);` with:

```ts
    const hit = p.find((x) => x.key === 'sleep_vs_kcal');
    expect(hit).toBeDefined();
    expect(String(hit!.params.diff)).toMatch(/^\+\d+$/);
```

Replace `expect(p.some((x) => x.key === 'snack_hour')).toBe(true);` with:

```ts
    const hit = p.find((x) => x.key === 'snack_hour');
    expect(hit).toBeDefined();
    expect(hit!.params).toEqual({ h: 16, n: 3 });
```

Replace `expect(p.some((x) => x.key === 'move_vs_mood')).toBe(true);` with:

```ts
    const hit = p.find((x) => x.key === 'move_vs_mood');
    expect(hit).toBeDefined();
    expect(hit!.params.d).toBe('1.5');
```

Run: `npx vitest run src/core/__tests__/insights.test.ts`
Expected: FAIL, `params` undefined.

- [ ] **Step 2: Carry params instead of English**

In `src/core/insights.ts` replace the `Correlation` type and the four `out.push` lines:

```ts
export type Correlation = { key: string; strength: number; params: Record<string, string | number> };
```

```ts
      out.push({ key: 'sleep_vs_kcal', strength: Math.min(1, Math.abs(diff) / 600), params: { diff: `${diff > 0 ? '+' : ''}${diff}` } });
```

```ts
  if (lateCount >= 3) out.push({ key: 'late_eating', strength: Math.min(1, lateCount / 10), params: { n: lateCount } });
```

```ts
  if (topCount >= 3) out.push({ key: 'snack_hour', strength: Math.min(1, topCount / 7), params: { h: topHour, n: topCount } });
```

```ts
    if (a - b >= 0.4) out.push({ key: 'move_vs_mood', strength: Math.min(1, (a - b) / 2), params: { d: (a - b).toFixed(1) } });
```

Run: `npx vitest run src/core/__tests__/insights.test.ts`
Expected: all pass.

- [ ] **Step 3: Add the keys in three languages**

In `src/i18n/index.ts`, change `tab_fit: 'Fit'` to `tab_fit: 'Move'` in the `en` block. Then, immediately before the closing `};` of the `en` block (line 234), add:

```ts
  // Part 1 additions
  pattern_sleep_vs_kcal: '{diff} kcal after short sleep',
  pattern_late_eating: '{n} meals after 10pm',
  pattern_snack_hour: 'Snack around {h}:00 on {n} days',
  pattern_move_vs_mood: 'Mood {d} higher on workout days',
  reason_short_sleep: 'short sleep', reason_good_sleep: 'good sleep', reason_low_energy: 'low energy',
  reason_pain_reported: 'pain last time', reason_hard_last_session: 'hard last session', reason_low_mood: 'low mood', reason_sore: 'sore',
  cat_walk: 'walk', cat_mobility: 'mobility', cat_strength: 'strength', cat_cardio_low: 'easy cardio',
  cat_stretch: 'stretch', cat_breathing: 'breathing', cat_balance: 'balance',
  unit_kg: 'kg', score: 'Score', later: 'later',
  day_score: 'Day score',
  lever_eating: 'Eating is pulling this down', lever_movement: 'Movement is pulling this down',
  lever_water: 'Water is pulling this down', lever_sleep: 'Sleep is pulling this down', lever_mood: 'Mood is pulling this down',
  lever_none: 'Everything is holding up',
  energy: 'Energy', next_break: 'Next break', on_pace: 'On pace', behind_glasses: '{n} behind', ahead_glasses: '{n} ahead',
  check_in: 'Check in', log_mood: 'Log mood', yesterday: 'Yesterday', close: 'Close',
  recent: 'Recent', same_as_yesterday: 'Same as yesterday', items: 'Items', edit_meal: 'Edit meal',
  toast_water_added: '+1 glass', toast_meal_saved: 'Saved · {kcal} kcal', toast_session_done: 'Session saved', toast_break_done: 'Break done',
  phase_of: 'Phase {p} · week {w} of {n}',
  todays_numbers: "Today's numbers", offered: 'Offered', no_chat_yet: 'Ask anything about food, movement or a hard day.',
  water_glasses: 'glasses today',
```

Before the closing `};` of the `mr` block (line 470 before your edit; find it with the `grep -n "^};"` from Task 0's context), add:

```ts
  tab_fit: 'हालचाल',
  pattern_sleep_vs_kcal: 'कमी झोपेनंतर {diff} kcal',
  pattern_late_eating: 'रात्री १० नंतर {n} जेवणं',
  pattern_snack_hour: '{n} दिवस {h}:00 च्या सुमारास नाश्ता',
  pattern_move_vs_mood: 'व्यायामाच्या दिवशी मूड {d} ने चांगला',
  reason_short_sleep: 'कमी झोप', reason_good_sleep: 'चांगली झोप', reason_low_energy: 'कमी ऊर्जा',
  reason_pain_reported: 'मागच्या वेळी दुखलं', reason_hard_last_session: 'मागचा सराव कठीण', reason_low_mood: 'मूड खालावलेला', reason_sore: 'अंग दुखतंय',
  cat_walk: 'चालणे', cat_mobility: 'लवचिकता', cat_strength: 'ताकद', cat_cardio_low: 'हलका कार्डिओ',
  cat_stretch: 'ताण', cat_breathing: 'श्वास', cat_balance: 'तोल',
  unit_kg: 'किलो', score: 'गुण', later: 'नंतर',
  day_score: 'आजचे गुण',
  lever_eating: 'जेवण मागे खेचतंय', lever_movement: 'हालचाल मागे खेचतेय',
  lever_water: 'पाणी मागे खेचतंय', lever_sleep: 'झोप मागे खेचतेय', lever_mood: 'मूड मागे खेचतोय',
  lever_none: 'सगळं व्यवस्थित चालू आहे',
  energy: 'ऊर्जा', next_break: 'पुढचा ब्रेक', on_pace: 'वेळेत', behind_glasses: '{n} मागे', ahead_glasses: '{n} पुढे',
  check_in: 'नोंद करा', log_mood: 'मूड नोंदवा', yesterday: 'काल', close: 'बंद',
  recent: 'अलीकडचे', same_as_yesterday: 'कालसारखंच', items: 'पदार्थ', edit_meal: 'जेवण बदला',
  toast_water_added: '+१ ग्लास', toast_meal_saved: 'नोंदवलं · {kcal} kcal', toast_session_done: 'सराव नोंदवला', toast_break_done: 'ब्रेक झाला',
  phase_of: 'टप्पा {p} · आठवडा {w} / {n}',
  todays_numbers: 'आजचे आकडे', offered: 'सुचवलेले', no_chat_yet: 'जेवण, हालचाल किंवा कठीण दिवसाबद्दल काहीही विचारा.',
  water_glasses: 'ग्लास आज',
```

Before the closing `};` of the `hi` block, add:

```ts
  tab_fit: 'हलचल',
  pattern_sleep_vs_kcal: 'कम नींद के बाद {diff} kcal',
  pattern_late_eating: 'रात 10 के बाद {n} बार खाना',
  pattern_snack_hour: '{n} दिन {h}:00 के आसपास नाश्ता',
  pattern_move_vs_mood: 'कसरत वाले दिन मूड {d} बेहतर',
  reason_short_sleep: 'कम नींद', reason_good_sleep: 'अच्छी नींद', reason_low_energy: 'कम ऊर्जा',
  reason_pain_reported: 'पिछली बार दर्द', reason_hard_last_session: 'पिछला सत्र कठिन', reason_low_mood: 'मूड ठीक नहीं', reason_sore: 'बदन दुख रहा',
  cat_walk: 'चलना', cat_mobility: 'लचीलापन', cat_strength: 'ताकत', cat_cardio_low: 'हल्का कार्डियो',
  cat_stretch: 'स्ट्रेच', cat_breathing: 'साँस', cat_balance: 'संतुलन',
  unit_kg: 'किलो', score: 'अंक', later: 'बाद में',
  day_score: 'आज के अंक',
  lever_eating: 'खाना पीछे खींच रहा है', lever_movement: 'हलचल पीछे खींच रही है',
  lever_water: 'पानी पीछे खींच रहा है', lever_sleep: 'नींद पीछे खींच रही है', lever_mood: 'मूड पीछे खींच रहा है',
  lever_none: 'सब ठीक चल रहा है',
  energy: 'ऊर्जा', next_break: 'अगला ब्रेक', on_pace: 'समय पर', behind_glasses: '{n} पीछे', ahead_glasses: '{n} आगे',
  check_in: 'दर्ज करें', log_mood: 'मूड दर्ज करें', yesterday: 'कल', close: 'बंद',
  recent: 'हाल के', same_as_yesterday: 'कल जैसा ही', items: 'चीज़ें', edit_meal: 'खाना बदलें',
  toast_water_added: '+1 गिलास', toast_meal_saved: 'दर्ज · {kcal} kcal', toast_session_done: 'सत्र दर्ज', toast_break_done: 'ब्रेक हो गया',
  phase_of: 'चरण {p} · हफ़्ता {w} / {n}',
  todays_numbers: 'आज के आँकड़े', offered: 'सुझाए गए', no_chat_yet: 'खाने, हलचल या मुश्किल दिन के बारे में कुछ भी पूछें.',
  water_glasses: 'गिलास आज',
```

- [ ] **Step 4: Use the keys**

`src/app/(tabs)/index.tsx`:
- The patterns block renders `<Small key={p.key}>{fill(t(`pattern_${p.key}`), p.params)}</Small>` where `fill` is a local helper added at the bottom of the file:

```ts
function fill(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), template);
}
```
- `label="Protein"` → `label={en('protein')}`; `label="Water"` → `label={en('water')}`; `<Micro>Score</Micro>` → `<Micro>{t('score')}</Micro>`; `label="kg"` → `label={t('unit_kg')}`.

`src/app/(tabs)/fit.tsx`:
- `<Pill key={x} label={x.replace(/_/g, ' ')} />` → `<Pill key={x} label={t(`reason_${x}`)} />`
- `<Pill label={e.category.replace('_', ' ')} />` → `<Pill label={t(`cat_${e.category}`)} />`

`src/app/session.tsx`: `current.category.replace('_', ' ')` → `t(`cat_${current.category}`)`.

`src/app/settings.tsx`: `<Count label="kg" ...>` → `<Count label={t('unit_kg')} ...>`.

- [ ] **Step 5: Typecheck, test, look**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3 && grep -n "replace(/_/g\|replace('_'" "src/app/(tabs)"/*.tsx src/app/*.tsx`
Expected: clean, tests green, grep prints nothing.

Seeded browser in Marathi: Move tab chips read `चांगली झोप` and `लवचिकता`; Today's patterns card is Marathi with the hour in local time.

- [ ] **Step 6: Commit**

```bash
git add src/core/insights.ts src/core/__tests__/insights.test.ts src/i18n/index.ts "src/app/(tabs)/index.tsx" "src/app/(tabs)/fit.tsx" src/app/session.tsx src/app/settings.tsx
git commit -m "Route patterns, readiness reasons, categories and units through i18n

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Motion tokens and the new primitives (HeroRing, Tile, Checklist, Skeleton, Cols, PressScale, rail cards, animated bars and rings)

**Files:**
- Modify: `src/ui/theme.ts`
- Create: `src/ui/animated.ts`
- Create: `src/ui/HeroRing.tsx`
- Create: `src/ui/PressScale.tsx`
- Create: `src/ui/tiles.tsx`
- Modify: `src/ui/components.tsx` (`Card`, `Bar`, `Ring`, `MeterRow`)

**Interfaces:**
- Produces: `M = { fast: 180, base: 320, slow: 600 }`, `F.hero = 56`, `S.gutter = 16`, `S.gutterWide = 24`, `S.maxWide = 1360`; `useEased(target: number, duration?: number): number`; `useReducedMotion(): boolean`; `HeroRing({ value, max, size?, color, big, caption, children? })`; `PressScale({ onPress, children, style, disabled, accessibilityLabel })`; `Tile({ label, value, sub, color, onPress })`; `Checklist({ items: { key, label, done }[], onToggle, color })`; `Skeleton({ height, width? })`; `Cols({ weights, gap?, children })`; `Card` gains `rail?: string`; `Bar` gains `marker?: number` (0..1) and eases; `MeterRow` gains `marker?: number`.

No unit tests: these are React Native views and the repo has no component test runner. Verification is typecheck plus the browser.

- [ ] **Step 1: Tokens**

In `src/ui/theme.ts` add after `S`:

```ts
/** Durations in ms. One curve for everything, ease-out cubic. */
export const M = { fast: 180, base: 320, slow: 600 };
```

Add to `S`: `gutter: 16,`, `gutterWide: 24,`, `maxWide: 1360,`. Add to `F`: `hero: 56,`. Add to `C`: `scrim: 'rgba(4, 6, 11, 0.7)',` (the backdrop behind sheets; the only translucent colour in the app).

- [ ] **Step 2: The eased-number hook**

Create `src/ui/animated.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { M } from './theme';

let cachedReduce: boolean | null = null;

/** True when the OS asks for less motion. Everything animated checks this. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(cachedReduce ?? false);
  useEffect(() => {
    if (cachedReduce !== null) return;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        cachedReduce = v;
        setReduce(v);
      })
      .catch(() => {});
  }, []);
  return reduce;
}

/**
 * A number that eases toward `target`. Rings, bars and counters render from
 * it, so they fill instead of snapping. Plain React state underneath, which is
 * why it behaves the same on the web and on Android.
 */
export function useEased(target: number, duration: number = M.slow): number {
  const reduce = useReducedMotion();
  const value = useRef(new Animated.Value(target)).current;
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    if (reduce) {
      value.setValue(target);
      setCurrent(target);
      return;
    }
    const id = value.addListener(({ value: v }) => setCurrent(v));
    const anim = Animated.timing(value, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => {
      anim.stop();
      value.removeListener(id);
    };
  }, [target, duration, reduce, value]);

  return current;
}
```

- [ ] **Step 3: Press feedback**

Create `src/ui/PressScale.tsx`:

```tsx
import React, { useRef } from 'react';
import { Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { M } from './theme';

/** A pressable that shrinks to 0.98 while held. The whole app's touch feel. */
export function PressScale({
  onPress,
  children,
  style,
  disabled,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.timing(scale, { toValue: v, duration: M.fast, useNativeDriver: true }).start();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => to(0.98)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      style={{ opacity: disabled ? 0.4 : 1 }}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Hero ring**

Create `src/ui/HeroRing.tsx`:

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useEased } from './animated';
import { C, F, MICRO } from './theme';

/** The one large ring on Today: a big light number, a tiny caption, an eased fill. */
export function HeroRing({
  value,
  max,
  size = 156,
  stroke = 8,
  color = C.accent,
  big,
  caption,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  big: string;
  caption: string;
  children?: React.ReactNode;
}) {
  const safe = Math.max(60, size);
  const r = (safe - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const pct = useEased(target);
  return (
    <View style={{ width: safe, height: safe, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={safe} height={safe} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={safe / 2} cy={safe / 2} r={r} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={safe / 2}
          cy={safe / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ color: C.text, fontSize: safe >= 150 ? F.hero * 0.72 : 27, fontWeight: '200', letterSpacing: -1.6 }}>{big}</Text>
        <Text style={[MICRO, { color: C.textFaint }]}>{caption}</Text>
        {children}
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Tiles, checklist, skeleton, columns**

Create `src/ui/tiles.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from './animated';
import { PressScale } from './PressScale';
import { C, F, M, MICRO, S } from './theme';

/** A compact stat for horizontal strips: caption, value, one quiet line. */
export function Tile({
  label,
  value,
  sub,
  color = C.text,
  onPress,
  width = 112,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  onPress?: () => void;
  width?: number;
}) {
  const body = (
    <View
      style={{
        width,
        backgroundColor: C.card,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radiusSm,
        paddingVertical: 12,
        paddingHorizontal: 13,
        gap: 5,
      }}>
      <Text style={[MICRO, { color: C.textFaint }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color, fontSize: F.h2, fontWeight: '300', letterSpacing: -0.5 }} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={{ color: C.textFaint, fontSize: F.tiny }} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
  return onPress ? <PressScale onPress={onPress}>{body}</PressScale> : body;
}

/** Rows with a check circle. The decision card's actions. */
export function Checklist({
  items,
  onToggle,
  color = C.accent,
}: {
  items: { key: string; label: string; done: boolean }[];
  onToggle: (key: string) => void;
  color?: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      {items.map((i) => (
        <Pressable
          key={i.key}
          onPress={() => onToggle(i.key)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: i.done }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7, opacity: pressed ? 0.7 : 1 })}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: i.done ? color : C.borderStrong,
              backgroundColor: i.done ? color : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {i.done ? <Ionicons name="checkmark" size={13} color={C.white} /> : null}
          </View>
          <Text
            style={{
              color: i.done ? C.textFaint : C.text,
              fontSize: F.body,
              lineHeight: 20,
              flex: 1,
              textDecorationLine: i.done ? 'line-through' : 'none',
            }}>
            {i.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A shimmering placeholder block while the store loads. */
export function Skeleton({ height, width = '100%', style }: { height: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const reduce = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: M.slow, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: M.slow, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  return <Animated.View style={[{ height, width, borderRadius: S.radiusSm, backgroundColor: C.cardAlt, opacity: pulse }, style]} />;
}

/** Desktop columns. `weights` are flex values, one per child. */
export function Cols({ weights, gap = 14, children }: { weights: number[]; gap?: number; children: React.ReactNode }) {
  const kids = React.Children.toArray(children);
  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
      {kids.map((k, i) => (
        <View key={i} style={{ flex: weights[i] ?? 1, gap: 14 }}>
          {k}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 6: Rail cards, eased bars and rings, pace marker**

In `src/ui/components.tsx`:

Add `import { useEased } from './animated';` at the top.

Replace `Card` with:

```tsx
export function Card({ children, style, tone, flat, rail }: { children: React.ReactNode; style?: ViewStyle; tone?: string; flat?: boolean; rail?: string }) {
  return (
    <View
      style={[
        st.card,
        flat && { backgroundColor: 'transparent', borderColor: 'transparent', padding: 0 },
        tone ? { borderColor: tone } : null,
        rail ? { borderLeftWidth: 2, borderLeftColor: rail } : null,
        style,
      ]}>
      {children}
    </View>
  );
}
```

Replace `Bar` with:

```tsx
export function Bar({ value, max, color = C.accent, height = 4, marker }: { value: number; max: number; color?: string; height?: number; marker?: number }) {
  const target = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const pct = useEased(target);
  return (
    <View style={[st.barTrack, { height, borderRadius: height }]}>
      <View style={{ width: `${pct * 100}%`, backgroundColor: color, height, borderRadius: height }} />
      {marker !== undefined && marker > 0 && marker < 1 ? (
        <View
          style={{
            position: 'absolute',
            left: `${marker * 100}%`,
            top: -2,
            width: 2,
            height: height + 4,
            borderRadius: 1,
            backgroundColor: C.textDim,
          }}
        />
      ) : null}
    </View>
  );
}
```

In `MeterRow`, add `marker?: number` to the props type and pass it: `<Bar value={value} max={total} color={color} marker={marker} />`.

In `Ring`, replace the `const pct = ...` line with:

```tsx
  const target = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const pct = useEased(target);
```

Set `st.barTrack` to `{ backgroundColor: C.cardAlt, overflow: 'visible', width: '100%' }` so the marker can poke above the track.

- [ ] **Step 7: Typecheck and look**

Run: `npx tsc --noEmit && echo OK`
Expected: `OK`.

Seeded browser, Today at 375 px: on reload the hero ring and the three meters fill over roughly half a second instead of appearing full. Nothing else has changed yet.

- [ ] **Step 8: Commit**

```bash
git add src/ui/theme.ts src/ui/animated.ts src/ui/HeroRing.tsx src/ui/PressScale.tsx src/ui/tiles.tsx src/ui/components.tsx
git commit -m "Add motion tokens, eased rings and bars, and the tile, checklist, skeleton and column primitives

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Feedback on every action — toast and haptics

**Files:**
- Create: `src/services/feedback.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/(tabs)/index.tsx` (quick water action)
- Modify: `src/app/(tabs)/log.tsx` (`saveMeal`) — note this file moves in Task 7; edit it where it is now
- Modify: `src/app/session.tsx` (`finish`)
- Modify: `src/components/BreakOverlay.tsx` (`finish`)

**Interfaces:**
- Produces: `FeedbackProvider` (wraps the app), `useFeedback(): { notify: (text: string) => void; haptic: (kind: 'light' | 'success') => void }`. Later tasks call `notify` after any save.

- [ ] **Step 1: The provider**

Create `src/services/feedback.tsx`:

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, M, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

type Feedback = {
  /** A one-line confirmation that fades after two seconds. */
  notify: (text: string) => void;
  /** A tap on the phone. Silent on the web. */
  haptic: (kind: 'light' | 'success') => void;
};

const Ctx = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeedback must be used inside FeedbackProvider');
  return c;
}

async function vibrate(kind: 'light' | 'success') {
  if (Platform.OS === 'web') return;
  try {
    const H = require('expo-haptics') as typeof import('expo-haptics');
    if (kind === 'success') await H.notificationAsync(H.NotificationFeedbackType.Success);
    else await H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch {
    // No haptics engine. Nothing to do.
  }
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(
    (t: string) => {
      setText(t);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: M.fast, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: M.base, useNativeDriver: true }).start(() => setText(null));
      }, 2000);
    },
    [opacity],
  );

  const haptic = useCallback((kind: 'light' | 'success') => {
    vibrate(kind).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ notify, haptic }), [notify, haptic]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {text ? <ToastView text={text} opacity={opacity} /> : null}
    </Ctx.Provider>
  );
}

function ToastView({ text, opacity }: { text: string; opacity: Animated.Value }) {
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'mobile';
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: (wide ? 24 : 84) + insets.bottom,
        right: wide ? 24 : undefined,
        alignSelf: wide ? 'flex-end' : 'center',
        left: wide ? undefined : 0,
        width: wide ? undefined : '100%',
        alignItems: 'center',
        opacity,
        zIndex: 950,
      }}>
      <View
        style={{
          backgroundColor: C.cardHigh,
          borderWidth: S.hairline,
          borderColor: C.borderStrong,
          borderRadius: 999,
          paddingVertical: 10,
          paddingHorizontal: 16,
        }}>
        <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{text}</Text>
      </View>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Wrap the app**

In `src/app/_layout.tsx` add `import { FeedbackProvider } from '../services/feedback';` and change `RootLayout` to:

```tsx
export default function RootLayout() {
  return (
    <AppProvider>
      <FeedbackProvider>
        <AppShell />
      </FeedbackProvider>
    </AppProvider>
  );
}
```

- [ ] **Step 3: Call it from the four saves**

`src/app/(tabs)/index.tsx`: add `import { useFeedback } from '../../services/feedback';`, `const fb = useFeedback();` after `const router = useRouter();`, and change the water quick action to:

```tsx
<QuickAction icon="water-outline" label={t('add_water')} onPress={() => { app.addWater(state.settings.glassMl); fb.haptic('light'); fb.notify(t('toast_water_added')); }} />
```

`src/app/(tabs)/log.tsx`: add the same import (`'../../services/feedback'`), `const fb = useFeedback();`, and at the end of `saveMeal` after `setQuery('')`:

```ts
    fb.haptic('success');
    fb.notify(t('toast_meal_saved').replace('{kcal}', String(basketKcal)));
```

Also in the water card's `+1` button: `onPress={() => { app.addWater(app.state.settings.glassMl); fb.haptic('light'); fb.notify(t('toast_water_added')); }}`.

`src/app/session.tsx`: import `useFeedback` from `'../services/feedback'`, `const fb = useFeedback();`, and in `finish` before `router.replace('/fit')`: `if (status === 'done') { fb.haptic('success'); fb.notify(t('toast_session_done')); }`. Remove the now-unused `buzz` calls? Keep `buzz` for the set-end tick; it is a different moment.

`src/components/BreakOverlay.tsx`: import `useFeedback` from `'../services/feedback'`; inside `BreakOverlay` add `const fb = useFeedback();` and change the done button's `onPress={monitor.finish}` to `onPress={() => { monitor.finish(); fb.notify(t('toast_break_done')); }}`.

- [ ] **Step 4: Typecheck and look**

Run: `npx tsc --noEmit && echo OK`

Seeded browser, 375 px: tap Water on Today; a pill "+१ ग्लास" appears above the tab bar and fades. At 1440 px it appears bottom-right.

- [ ] **Step 5: Commit**

```bash
git add src/services/feedback.tsx src/app/_layout.tsx "src/app/(tabs)/index.tsx" "src/app/(tabs)/log.tsx" src/app/session.tsx src/components/BreakOverlay.tsx
git commit -m "Confirm every save with a toast, and a haptic on the phone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: One break-monitor instance for the whole app

Today `useBreakMonitor()` is called by both `BreakOverlay` and `BreakCard`, and each call runs its own timer and its own clock. The card's copy flips to "breaking" with no buttons and freezes. The sidebar ring and the Now strip will read this clock too, so it must exist once.

**Files:**
- Rename: `src/services/useBreakMonitor.ts` → `src/services/useBreakMonitor.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Produces: `BreakMonitorProvider` and an unchanged `useBreakMonitor()` return shape: `{ phase, remaining, minutesLeft, enabled, allowSkip, breakSeconds, workMinutes, takenToday, suggestion, finish, skip, snooze }`. Callers do not change.

- [ ] **Step 1: Rename and wrap**

Run: `git mv src/services/useBreakMonitor.ts src/services/useBreakMonitor.tsx`

In the renamed file, change the first import line to `import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';`, rename `export function useBreakMonitor()` to `function useBreakClock()`, and append at the end of the file:

```tsx
type Monitor = ReturnType<typeof useBreakClock>;
const Ctx = createContext<Monitor | null>(null);

/** Mount once, above every screen. The clock runs here and nowhere else. */
export function BreakMonitorProvider({ children }: { children: React.ReactNode }) {
  const monitor = useBreakClock();
  return <Ctx.Provider value={monitor}>{children}</Ctx.Provider>;
}

export function useBreakMonitor(): Monitor {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBreakMonitor must be used inside BreakMonitorProvider');
  return c;
}
```

- [ ] **Step 2: Mount it**

In `src/app/_layout.tsx` add `import { BreakMonitorProvider } from '../services/useBreakMonitor';` and nest it inside `FeedbackProvider`:

```tsx
export default function RootLayout() {
  return (
    <AppProvider>
      <FeedbackProvider>
        <BreakMonitorProvider>
          <AppShell />
        </BreakMonitorProvider>
      </FeedbackProvider>
    </AppProvider>
  );
}
```

- [ ] **Step 3: Typecheck, then prove there is one clock**

Run: `npx tsc --noEmit && grep -rn "useBreakMonitor()" src | wc -l`
Expected: clean; the count is 2 (BreakOverlay, BreakCard), both now reading the context.

Browser proof: seed, then in the console run `const s = JSON.parse(localStorage['sobat.state.v1']); s.breakSettings.workMinutes = 1; localStorage['sobat.state.v1'] = JSON.stringify(s); location.reload()`. Keep the mouse moving on Today. After about a minute the overlay appears once; press "I'm done"; the break card's countdown restarts from 1 minute instead of freezing.

- [ ] **Step 4: Commit**

```bash
git add src/services/useBreakMonitor.tsx src/app/_layout.tsx
git commit -m "Run the break monitor once, in a provider, instead of once per card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The shell — TopBar and Page, five-slot tab bar with a centre "+", Log as a modal route, sidebar footer

**Files:**
- Create: `src/ui/TopBar.tsx`
- Create: `src/components/TopBarActions.tsx`
- Modify: `src/ui/components.tsx` (`Screen` wide padding)
- Modify: `src/components/TabBar.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`
- Rename: `src/app/(tabs)/log.tsx` → `src/app/log.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/(tabs)/index.tsx`, `growth.tsx`, `fit.tsx`, `mind.tsx`, `coach.tsx` (wrap in `Page`)

**Interfaces:**
- Produces: `TopBar({ title, alt?, subtitle?, right?, left? })`, `Page({ title, alt?, subtitle?, right?, left?, wide?, children })` (TopBar above a `Screen`), `TopBarActions({ streak? })` (streak chip, AI dot, coach and settings buttons on phone; streak, AI dot and a "+ Log" button on desktop). Routes: `/log` is a root Stack modal; `/coach` is a hidden tab reached from the TopBar.

- [ ] **Step 1: TopBar and Page**

Create `src/ui/TopBar.tsx`:

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from './components';
import { C, F, S } from './theme';
import { useBreakpoint } from './useBreakpoint';

/** One compact bar per tab. Replaces the stock navigation header. */
export function TopBar({
  title,
  alt,
  subtitle,
  right,
  left,
}: {
  title: string;
  alt?: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() === 'desktop';
  return (
    <View style={{ backgroundColor: C.bg }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 8,
          paddingHorizontal: wide ? S.gutterWide : S.gutter,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          maxWidth: wide ? S.maxWide : 780,
          width: '100%',
          alignSelf: 'center',
          minHeight: 56 + insets.top,
        }}>
        {left}
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: C.text, fontSize: F.h2, fontWeight: '600', letterSpacing: -0.3 }}>
            {title}
            {alt ? <Text style={{ color: C.textFaint, fontWeight: '400' }}> {alt}</Text> : null}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: C.textFaint, fontSize: F.tiny, letterSpacing: 0.2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/** A tab screen: TopBar, then the scrolling body. */
export function Page({
  title,
  alt,
  subtitle,
  right,
  left,
  wide,
  children,
}: {
  title: string;
  alt?: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={title} alt={alt} subtitle={subtitle} right={right} left={left} />
      <Screen wide={wide}>{children}</Screen>
    </View>
  );
}
```

In `src/ui/components.tsx`, `Screen`'s wide style becomes `wide && { maxWidth: S.maxWide, paddingHorizontal: S.gutterWide, paddingTop: 4 }`.

- [ ] **Step 2: The right-hand actions**

Create `src/components/TopBarActions.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Row, StatusChip } from '../ui/components';
import { C } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

/** Streak, AI status, and on the phone the coach and settings buttons. */
export function TopBarActions({ streak }: { streak?: number }) {
  const router = useRouter();
  const { ai } = useAI();
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const wide = useBreakpoint() === 'desktop';
  const online = ai.route === 'primary' || ai.route === 'fallback';

  return (
    <Row style={{ gap: 4 }}>
      {streak && streak > 0 ? <StatusChip label={`${streak}d`} color={C.amber} /> : null}
      <View
        accessibilityLabel={online ? t('ai_lan') : t('ai_offline')}
        style={{ width: 7, height: 7, borderRadius: 4, marginHorizontal: 6, backgroundColor: online ? C.accent : C.textGhost }}
      />
      {wide ? (
        <IconButton name="add-circle-outline" label={t('tab_log')} onPress={() => router.push('/log')} />
      ) : (
        <>
          <IconButton name="chatbubble-ellipses-outline" label={t('tab_coach')} onPress={() => router.push('/coach')} />
          <IconButton name="settings-outline" label={t('settings')} onPress={() => router.push('/settings')} />
        </>
      )}
    </Row>
  );
}

export function IconButton({ name, label, onPress }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? C.cardAlt : 'transparent',
      })}>
      <Ionicons name={name} size={20} color={C.textDim} />
    </Pressable>
  );
}
```

- [ ] **Step 3: Five slots with a raised centre**

Replace `src/components/TabBar.tsx` with:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, F, S } from '../ui/theme';

/**
 * A hand-rolled tab bar: Today · Growth · [+] · Move · Mind.
 *
 * The stock one clips its labels on the web: it gives the text a 9px box with
 * overflow hidden, which is fine for Latin but cuts the marks above and below
 * Devanagari. Owning the layout also lets the centre button sit proud of the
 * bar. Coach is a hidden route reached from the top bar, so it is skipped here.
 */
type TabIconProps = { focused: boolean; color: string; size: number };

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<string, { options: { title?: string; tabBarIcon?: (p: TabIconProps) => React.ReactNode; tabBarAccessibilityLabel?: string } }>;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const HIDDEN = new Set(['coach']);
const CENTRE_AFTER = 'growth';

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state: app } = useApp();
  const t = makeT(app.profile.lang);

  const slots: React.ReactNode[] = [];
  state.routes.forEach((route, index) => {
    if (HIDDEN.has(route.name)) return;
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const color = focused ? C.accent : C.textFaint;
    const label = typeof options.title === 'string' ? options.title : route.name;

    slots.push(
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 5, paddingHorizontal: 2, opacity: pressed ? 0.6 : 1 })}>
        {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 21 }) : null}
        <Text
          numberOfLines={1}
          style={{ color, fontSize: F.micro, lineHeight: 15, fontWeight: focused ? '600' : '500', letterSpacing: 0.3, includeFontPadding: false, textAlign: 'center' }}>
          {label}
        </Text>
      </Pressable>,
    );

    if (route.name === CENTRE_AFTER) {
      slots.push(
        <View key="centre" style={{ flex: 1, alignItems: 'center' }}>
          <Pressable
            onPress={() => router.push('/log')}
            accessibilityRole="button"
            accessibilityLabel={t('tab_log')}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: 26,
              marginTop: -22,
              backgroundColor: C.accent,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 4,
              borderColor: C.bgAlt,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}>
            <Ionicons name="add" size={26} color={C.white} />
          </Pressable>
        </View>,
      );
    }
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: C.bgAlt,
        borderTopWidth: S.hairline,
        borderTopColor: C.border,
        paddingTop: 9,
        paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 6),
      }}>
      {slots}
    </View>
  );
}
```

- [ ] **Step 4: Tabs layout without headers, coach hidden, log gone**

Replace the `return` of `src/app/(tabs)/_layout.tsx` (keep the `!ready` and `!onboarded` branches, remove `settingsButton` and the `Pressable`, `Ionicons`-for-settings and `F`, `S` imports if unused):

```tsx
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      {wide ? <Sidebar /> : null}
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={wide ? () => null : (props) => <TabBar {...props} />}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: C.bg },
            tabBarActiveTintColor: C.accent,
            tabBarInactiveTintColor: C.textFaint,
          }}>
          <Tabs.Screen name="index" options={{ title: t('tab_today'), tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="growth" options={{ title: t('growth'), tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="fit" options={{ title: t('tab_fit'), tabBarIcon: ({ color, size }) => <Ionicons name="walk-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="mind" options={{ title: t('tab_mind'), tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="coach" options={{ title: t('tab_coach'), href: null }} />
        </Tabs>
        <NudgeToast />
      </View>
    </View>
  );
```

- [ ] **Step 5: Log becomes a root modal route**

Run: `git mv "src/app/(tabs)/log.tsx" src/app/log.tsx`

In `src/app/log.tsx` change every `'../../` import to `'../` (there are eight: CustomFoodForm, core/date, core/foods, core/nutrition, core/types, i18n, store, ui/components, ui/theme, services/feedback). Add `import { Page } from '../ui/TopBar';` and `import { IconButton } from '../components/TopBarActions';`. Replace the outer `<Screen>` … `</Screen>` with:

```tsx
    <Page
      title={en('tab_log')}
      alt={lang === 'en' ? undefined : t('tab_log')}
      right={<IconButton name="close" label={t('close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}>
```

closing with `</Page>`. Remove `Screen` from the components import.

In `src/app/_layout.tsx` add, right after the `(tabs)` screen: `<Stack.Screen name="log" options={{ presentation: 'modal', headerShown: false }} />`.

- [ ] **Step 6: Sidebar footer with the live clock**

In `src/components/Sidebar.tsx` add imports `import { useBreakMonitor } from '../services/useBreakMonitor';` and `import { Ring } from '../ui/components';`, and inside the component `const monitor = useBreakMonitor(); const app = useApp();` (replace the existing `const { state } = useApp();` with `const app = useApp(); const { state } = app;`). Add before the bottom `<View style={{ gap: 4 }}>`'s AI row, a footer block:

```tsx
        <View style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderTopWidth: S.hairline, borderTopColor: C.border, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ring value={monitor.enabled ? monitor.workMinutes - monitor.minutesLeft : 0} max={monitor.workMinutes} size={34} stroke={3} color={C.accent}>
              <Text style={{ color: C.text, fontSize: F.micro, fontWeight: '600' }}>{monitor.enabled ? Math.ceil(monitor.minutesLeft) : '--'}</Text>
            </Ring>
            <View style={{ flex: 1 }}>
              <Text style={[MICRO, { color: C.textFaint }]}>{t('next_break')}</Text>
              <Text style={{ color: C.textDim, fontSize: F.small }}>{monitor.enabled ? `${Math.ceil(monitor.minutesLeft)} ${t('minutes')}` : t('break_off')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="water-outline" size={16} color={C.cyan} />
            <Text style={{ color: C.textDim, fontSize: F.small }}>
              {Math.round(app.waterToday / state.settings.glassMl)}
              <Text style={{ color: C.textFaint }}> / {Math.round(state.settings.waterGoalMl / state.settings.glassMl)} {t('water_glasses')}</Text>
            </Text>
          </View>
        </View>
```

Keep the existing AI status row after it.

- [ ] **Step 7: Every tab gets a TopBar**

`src/app/(tabs)/index.tsx`: import `Page` from `'../../ui/TopBar'`, `TopBarActions` from `'../../components/TopBarActions'`, `formatDayLabel` from `'../../core/date'`. Delete the `header` const entirely. Define:

```tsx
  const subtitle = `${formatDayLabel(today, lang)}${streakDays > 0 ? ` · ${streakDays} ${t('streak_days')}` : ''}`;
  const titleName = `${greeting}, ${state.profile.name || 'there'}`;
```

Both returns become `<Page title={titleName} alt={greetingAlt ?? undefined} subtitle={subtitle} right={<TopBarActions streak={streakDays} />} wide={wide}>` … `</Page>` (drop `{header}`; keep the queued-photos line as the first child when `queued > 0`). Remove `H1`, `StatusChip`, `Screen` from the components import if unused.

`src/app/(tabs)/growth.tsx`: `<Screen>` → `<Page title={en('growth')} alt={lang === 'en' ? undefined : t('growth')} right={<TopBarActions />}>`.

`src/app/(tabs)/fit.tsx`: `<Page title={en('fit_title')} alt={lang === 'en' ? undefined : t('fit_title')} right={<TopBarActions />}>`.

`src/app/(tabs)/mind.tsx`: `<Page title={en('mind_title')} alt={lang === 'en' ? undefined : t('mind_title')} right={<TopBarActions />}>`.

`src/app/(tabs)/coach.tsx`: import `TopBar` from `'../../ui/TopBar'` and `IconButton, TopBarActions` from `'../../components/TopBarActions'`; as the first child of the outer `<View style={{ flex: 1, backgroundColor: C.bg }}>` add:

```tsx
      <TopBar
        title={en('coach_title')}
        alt={lang === 'en' ? undefined : t('coach_title')}
        left={wide ? undefined : <IconButton name="chevron-back" label={t('cancel')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
        right={<TopBarActions />}
      />
```

with `const wide = useBreakpoint() === 'desktop';` (import `useBreakpoint` from `'../../ui/useBreakpoint'`). Remove the in-body `StatusChip` (the dot is in the bar now) but keep the memory count and "+ New" row.

- [ ] **Step 8: Typecheck, lint, look**

Run: `npx tsc --noEmit && npx expo lint 2>&1 | tail -3`
Expected: clean, no new warnings.

Seeded browser, 375 px: no stock header; the bar shows Today · Growth · a raised blue "+" · Move · Mind; "+" opens Log full screen with a close button; the coach icon in the bar opens Coach with a back chevron; Today's title is one line with the date under it. 1440 px: sidebar has the break ring, the glasses count and the AI dot at the bottom; the top bar shows the streak, the AI dot and a "+" that opens Log.

- [ ] **Step 9: Commit**

```bash
git add -A src/ui/TopBar.tsx src/components/TopBarActions.tsx src/ui/components.tsx src/components/TabBar.tsx "src/app/(tabs)" src/app/log.tsx src/app/_layout.tsx src/components/Sidebar.tsx
git commit -m "One compact top bar per tab, a five-slot tab bar with a centre plus, Log as a modal, sidebar footer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Today, phone — hero, decision checklist, Now strip, day score, meals with date chevrons

**Files:**
- Modify: `src/core/types.ts` (`AppState.actionsDone`)
- Modify: `src/store/defaults.ts` (`actionsDone: []`)
- Modify: `src/store/AppProvider.tsx` (`actionsDoneToday`, `toggleAction`)
- Modify: `src/components/DecisionCard.tsx` (rail, checklist, Why disclosure)
- Create: `src/components/NowStrip.tsx`
- Create: `src/components/DayScore.tsx`
- Modify: `src/components/TopBarActions.tsx` (`IconButton` gains `disabled`)
- Modify: `src/app/(tabs)/index.tsx` (rewritten)

**Interfaces:**
- Consumes: `HeroRing`, `Tile`, `Checklist`, `Cols`, `Page`, `TopBarActions`, `useFeedback`, `useBreakMonitor`, `scoreDay`/`biggestLever`, `localHHMM`/`localHour`/`formatDayLabel`/`addDays`.
- Produces: `app.actionsDoneToday: string[]`, `app.toggleAction(key: string)`; `NowStrip({ wide })`; `DayScoreCard({ score })`; `index.tsx` exports nothing new but keeps these local names for Tasks 9 and 10 to hook into: `viewDate`, `isToday`, `dayMeals`, `mealsBlock`, `heroCard`, `rightColumn`.

- [ ] **Step 1: Persist checked actions for the day**

`src/core/types.ts`: add to `AppState` after `steps: StepLog[];`:

```ts
  /** Decision-card actions ticked off, kept only for the day they belong to. */
  actionsDone: { date: ISODate; key: string }[];
```

`src/store/defaults.ts`: add `actionsDone: [],` to `EMPTY_STATE`.

`src/store/AppProvider.tsx`: in the `Ctx` type add `actionsDoneToday: string[];` and `toggleAction: (key: string) => void;`. In the returned object add:

```ts
      actionsDoneToday: state.actionsDone.filter((a) => a.date === today).map((a) => a.key),
      toggleAction: (key) =>
        update((s) => {
          const kept = s.actionsDone.filter((a) => a.date === today);
          const has = kept.some((a) => a.key === key);
          return { ...s, actionsDone: has ? kept.filter((a) => a.key !== key) : [...kept, { date: today, key }] };
        }),
```

Run: `npx tsc --noEmit && echo OK` — expected `OK` (the stored-state merge in the provider fills the missing array from `EMPTY_STATE`).

- [ ] **Step 2: Decision card with a rail, a checklist and a Why disclosure**

In `src/components/DecisionCard.tsx`:

- Change the React import to `import React, { useEffect, useState } from 'react';` (already so) and add `import { Pressable } from 'react-native';` to the react-native import, `import { Checklist } from '../ui/tiles';`.
- After `const [loading, setLoading] = useState(false);` add `const [why, setWhy] = useState(false);`.
- Replace `<Card>` with `<Card rail={tone}>`.
- Replace the header `<Micro>{`${t('metabolic_rule')} ${decision.situation.length}`}</Micro>` with:

```tsx
        <Pressable onPress={() => setWhy((w) => !w)} hitSlop={8} accessibilityRole="button">
          <Micro color={why ? C.text : C.textFaint}>{t('why')}</Micro>
        </Pressable>
```

- Replace the actions block (`<View style={{ gap: 4 }}>` … `</View>`) with:

```tsx
      <Checklist
        color={tone}
        items={decision.actionKeys.map((k, i) => ({ key: k, label: actionText[i], done: app.actionsDoneToday.includes(k) }))}
        onToggle={app.toggleAction}
      />
```

- Replace `<Divider /><StatQuad items={quad} />` with `{why ? (<><Divider /><StatQuad items={quad} /></>) : null}`.
- Remove the `Bullet` import if unused.

- [ ] **Step 3: The Now strip**

Create `src/components/NowStrip.tsx`:

```tsx
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { formatMinutes } from '../core/date';
import { readiness } from '../core/fitness';
import { expectedWaterByHour } from '../core/nudge';
import { makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Tile } from '../ui/tiles';
import { C, readinessColor, scoreColor } from '../ui/theme';

/** Energy, sleep, next break, mood, water pace. One glance, five taps. */
export function NowStrip({ wide }: { wide?: boolean }) {
  const app = useApp();
  const router = useRouter();
  const monitor = useBreakMonitor();
  const { state, today, waterToday } = app;
  const t = makeT(state.profile.lang);
  const hour = new Date().getHours();

  const sleepLast = useMemo(() => [...state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0], [state.sleep]);
  const sleepToday = state.sleep.some((s) => s.date === today);
  const lastWorkout = useMemo(() => [...state.workouts].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0], [state.workouts]);
  const moodToday = state.moods.filter((m) => m.date === today).slice(-1)[0];
  const r = readiness({ lastSleep: sleepLast, lastWorkout, moodScore: moodToday?.score });

  const glass = Math.max(1, state.settings.glassMl);
  const expected = expectedWaterByHour(hour, state.settings.waterGoalMl);
  const diffGlasses = Math.round((waterToday - expected) / glass);
  const waterSub = diffGlasses === 0 ? t('on_pace') : diffGlasses < 0 ? t('behind_glasses').replace('{n}', String(-diffGlasses)) : t('ahead_glasses').replace('{n}', String(diffGlasses));
  const glasses = Math.round(waterToday / glass);
  const glassGoal = Math.round(state.settings.waterGoalMl / glass);

  const tiles = [
    <Tile key="energy" label={t('energy')} value={String(r.score)} sub={t(`reason_${r.reasons[0] ?? 'good_sleep'}`)} color={readinessColor(r.level)} onPress={() => router.push('/fit')} />,
    <Tile
      key="sleep"
      label={t('sleep_title')}
      value={sleepToday && sleepLast ? formatMinutes(sleepLast.minutes) : t('check_in')}
      sub={sleepToday && sleepLast ? `${t('score')} ${sleepLast.score}` : undefined}
      color={sleepToday && sleepLast ? scoreColor(sleepLast.score) : C.cyan}
      onPress={() => router.push('/sleep')}
    />,
    <Tile
      key="break"
      label={t('next_break')}
      value={monitor.enabled ? `${Math.ceil(monitor.minutesLeft)}m` : '--'}
      sub={monitor.enabled ? `${monitor.takenToday} ${t('break_compliance')}` : t('break_off')}
      color={monitor.enabled && monitor.minutesLeft <= 2 ? C.amber : C.text}
      onPress={() => router.push('/settings')}
    />,
    <Tile
      key="mood"
      label={t('mind_title')}
      value={moodToday ? `${moodToday.score}/5` : t('log_mood')}
      sub={moodToday?.note}
      color={moodToday ? scoreColor(((moodToday.score - 1) / 4) * 100) : C.violet}
      onPress={() => router.push('/mind')}
    />,
    <Tile key="water" label={t('water')} value={`${glasses}/${glassGoal}`} sub={waterSub} color={diffGlasses < 0 ? C.amber : C.cyan} onPress={() => router.push('/log')} />,
  ];

  if (wide) {
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{tiles}</View>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }} style={{ marginHorizontal: -2 }}>
      {tiles}
    </ScrollView>
  );
}
```

- [ ] **Step 4: The day score card**

Create `src/components/DayScore.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { biggestLever, type DayScore } from '../core/insights';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, RingStat, Row, Small } from '../ui/components';
import { C, F, scoreColor } from '../ui/theme';

/** Five rings, one composite number, and the sentence that explains it. */
export function DayScoreCard({ score }: { score: DayScore }) {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const lever = biggestLever(score);
  const known = [score.eating, score.movement, score.water, score.sleep, score.mood].filter((n) => n !== null).length;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Micro>{t('day_score')}</Micro>
        <Row style={{ gap: 6, alignItems: 'baseline' }}>
          <Text style={{ color: known > 0 ? scoreColor(score.total) : C.textGhost, fontSize: F.h1, fontWeight: '300', letterSpacing: -1 }}>
            {known > 0 ? score.total : '--'}
          </Text>
          <Micro>/ 100</Micro>
        </Row>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <RingStat label={t('eaten')} value={score.eating} color={scoreColor(score.eating)} />
        <RingStat label={t('burned')} value={score.movement} color={scoreColor(score.movement)} />
        <RingStat label={t('water')} value={score.water} color={scoreColor(score.water)} />
        <RingStat label={t('sleep_title')} value={score.sleep} color={scoreColor(score.sleep)} />
        <RingStat label={t('mind_title')} value={score.mood} color={scoreColor(score.mood)} />
      </Row>
      <Small color={lever ? C.amber : C.textFaint}>{lever ? t(`lever_${lever}`) : t('lever_none')}</Small>
    </Card>
  );
}
```

In `src/ui/components.tsx`, `RingStat` shows `t('later')`-style text for null: change the inner text to `{value === null ? '·' : `${value}%`}` (a middle dot reads as "not yet" without needing i18n inside a primitive).

- [ ] **Step 5: IconButton can be disabled**

In `src/components/TopBarActions.tsx`, `IconButton` gains `disabled?: boolean`: add it to the props type, pass `disabled={disabled}` and `onPress={disabled ? undefined : onPress}` to the `Pressable`, and include `opacity: disabled ? 0.3 : 1` in its style object.

- [ ] **Step 6: Rewrite Today**

Replace `src/app/(tabs)/index.tsx` in full:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BreakCard } from '../../components/BreakCard';
import { DayReview } from '../../components/DayReview';
import { DayScoreCard } from '../../components/DayScore';
import { DecisionCard } from '../../components/DecisionCard';
import { NowStrip } from '../../components/NowStrip';
import { TipCard } from '../../components/TipCard';
import { IconButton, TopBarActions } from '../../components/TopBarActions';
import { addDays, formatDayLabel, localHHMM, localHour } from '../../core/date';
import { decide } from '../../core/decide';
import { scoreDay } from '../../core/insights';
import { expectedWaterByHour } from '../../core/nudge';
import { sumTotals } from '../../core/nutrition';
import { pendingCount } from '../../core/queue';
import type { Meal } from '../../core/types';
import { makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, ListRow, MeterRow, Micro, Row, Small } from '../../ui/components';
import { HeroRing } from '../../ui/HeroRing';
import { Page } from '../../ui/TopBar';
import { Cols } from '../../ui/tiles';
import { C, F, S } from '../../ui/theme';
import { useBreakpoint } from '../../ui/useBreakpoint';

export default function TodayScreen() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, budget, targets, waterToday, streakDays, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  // The design leads in English with the chosen language beside it.
  const en = makeT('en');
  const hour = new Date().getHours();
  const wide = useBreakpoint() === 'desktop';

  // Today by default; the chevrons under the meals walk back a day at a time.
  const [viewDate, setViewDate] = useState(today);
  const isToday = viewDate === today;

  const greetKey = hour < 12 ? 'good_morning' : hour < 17 ? 'good_afternoon' : 'good_evening';
  const greeting = en(greetKey);
  const greetingAlt = lang === 'en' ? undefined : t(greetKey);

  const dayMeals = state.meals.filter((m) => m.date === viewDate);
  const dayTotals = sumTotals(dayMeals.flatMap((m) => m.items));
  const dayWater = isToday ? waterToday : state.water.filter((w) => w.date === viewDate).reduce((a, w) => a + w.ml, 0);
  const daySteps = state.steps.find((s) => s.date === viewDate)?.count ?? 0;
  const workoutDay = state.workouts.find((w) => w.date === viewDate && w.status === 'done');
  const moodDay = state.moods.filter((m) => m.date === viewDate).slice(-1)[0];
  const sleepDay = state.sleep.find((s) => s.date === viewDate);

  // Today uses the live budget; an earlier day is judged against the full target.
  const dayBudget = isToday
    ? budget
    : {
        target: targets.kcal,
        consumed: dayTotals.kcal,
        remaining: targets.kcal - dayTotals.kcal,
        proteinTarget: targets.proteinG,
        proteinConsumed: Math.round(dayTotals.protein),
      };
  const over = dayBudget.remaining < 0;

  const lateMealDays = useMemo(() => new Set(state.meals.filter((m) => localHour(m.at) >= 22).map((m) => m.date)).size, [state.meals]);

  const decision = useMemo(
    () =>
      decide({
        budget,
        hour,
        waterMl: waterToday,
        waterGoalMl: state.settings.waterGoalMl,
        movedToday: !!state.workouts.find((w) => w.date === today && w.status === 'done'),
        lateMealDays,
      }),
    [budget, hour, waterToday, state.settings.waterGoalMl, state.workouts, today, lateMealDays],
  );

  const score = scoreDay({
    date: viewDate,
    kcal: dayBudget.consumed,
    kcalTarget: dayBudget.target,
    waterMl: dayWater,
    waterGoalMl: state.settings.waterGoalMl,
    workedOut: !!workoutDay,
    workoutMinutes: workoutDay?.minutes ?? 0,
    sleepScore: sleepDay?.score,
    moodScore: moodDay?.score,
    hour: isToday ? hour : undefined,
    expectedWaterMl: isToday ? expectedWaterByHour(hour, state.settings.waterGoalMl) : undefined,
  });

  const queued = pendingCount(state.photoQueue);
  const subtitle = `${formatDayLabel(today, lang)}${streakDays > 0 ? ` · ${streakDays} ${t('streak_days')}` : ''}`;
  const titleName = `${greeting}, ${state.profile.name || 'there'}`;
  const waterMarker = isToday ? expectedWaterByHour(hour, state.settings.waterGoalMl) / Math.max(1, state.settings.waterGoalMl) : undefined;

  function addGlass() {
    app.addWater(state.settings.glassMl);
    fb.haptic('light');
    fb.notify(t('toast_water_added'));
  }

  const heroCard = (
    <Card>
      <Row style={{ gap: 18, alignItems: 'center' }}>
        <HeroRing
          value={dayBudget.consumed}
          max={dayBudget.target}
          size={wide ? 176 : 148}
          color={over ? C.red : C.accent}
          big={String(Math.abs(dayBudget.remaining))}
          caption={over ? t('kcal_over') : t('kcal_left')}
        />
        <View style={{ flex: 1, gap: 13 }}>
          <MeterRow label={en('eaten')} alt={lang === 'en' ? undefined : t('eaten')} value={dayBudget.consumed} total={dayBudget.target} unit="kcal" color={C.accent} />
          <MeterRow label={en('protein')} alt={lang === 'en' ? undefined : t('protein')} value={dayBudget.proteinConsumed} total={dayBudget.proteinTarget} unit="g" color={C.violet} />
          <MeterRow label={en('water')} alt={lang === 'en' ? undefined : t('water')} value={dayWater} total={state.settings.waterGoalMl} unit="ml" color={C.cyan} marker={waterMarker} />
          {daySteps > 0 ? <MeterRow label={en('steps_today')} alt={lang === 'en' ? undefined : t('steps_today')} value={daySteps} total={8000} color={C.green} /> : null}
        </View>
      </Row>
      {isToday ? (
        <>
          <Divider />
          <Row style={{ gap: 8 }}>
            <QuickAction icon="add" label={t('add_food')} onPress={() => router.push('/log')} />
            <QuickAction icon="camera-outline" label={t('add_photo')} onPress={() => router.push('/photo')} />
            <QuickAction icon="water-outline" label={t('add_water')} onPress={addGlass} />
          </Row>
        </>
      ) : null}
    </Card>
  );

  const dayLabel = isToday ? t('tab_today') : viewDate === addDays(today, -1) ? t('yesterday') : formatDayLabel(viewDate, lang);

  const mealsBlock = (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 0 }}>
          <IconButton name="chevron-back" label={t('yesterday')} onPress={() => setViewDate(addDays(viewDate, -1))} />
          <Micro color={C.textDim}>{`${t('logged_intake')} · ${dayLabel}`}</Micro>
          <IconButton name="chevron-forward" label={t('tab_today')} disabled={isToday} onPress={() => setViewDate(addDays(viewDate, 1))} />
        </Row>
        <Micro>{`${dayMeals.length} ${dayMeals.length === 1 ? t('session_one') : t('session_many')}`}</Micro>
      </Row>
      <Card>
        {dayMeals.length === 0 ? (
          <Small color={C.textGhost}>{t('nothing_logged')}</Small>
        ) : (
          dayMeals.map((m, i) => <MealRow key={m.id} meal={m} first={i === 0} lang={lang} onPress={() => {}} />)
        )}
      </Card>
    </View>
  );

  const rightColumn = (
    <>
      <BreakCard />
      <NowStrip wide />
      <DayScoreCard score={score} />
    </>
  );

  if (wide) {
    return (
      <Page title={titleName} alt={greetingAlt} subtitle={subtitle} right={<TopBarActions streak={streakDays} />} wide>
        {queued > 0 ? <Small color={C.cyan}>{(queued === 1 ? t('photos_queued') : t('photos_queued_plural')).replace('{n}', String(queued))}</Small> : null}
        <Cols weights={[1.15, 1, 0.95]}>
          <>
            {heroCard}
            {mealsBlock}
          </>
          <>
            {isToday ? <DecisionCard decision={decision} lang={lang} targets={targets} budget={budget} /> : null}
            <TipCard />
            <DayReview />
          </>
          {rightColumn}
        </Cols>
        <Small color={C.textGhost}>{t('medical_note')}</Small>
      </Page>
    );
  }

  return (
    <Page title={titleName} alt={greetingAlt} subtitle={subtitle} right={<TopBarActions streak={streakDays} />}>
      {queued > 0 ? <Small color={C.cyan}>{(queued === 1 ? t('photos_queued') : t('photos_queued_plural')).replace('{n}', String(queued))}</Small> : null}
      {heroCard}
      {isToday ? <DecisionCard decision={decision} lang={lang} targets={targets} budget={budget} /> : null}
      {isToday ? <NowStrip /> : null}
      <DayScoreCard score={score} />
      {isToday ? <TipCard /> : null}
      {isToday ? <DayReview /> : null}
      {mealsBlock}
      <Small color={C.textGhost}>{t('medical_note')}</Small>
    </Page>
  );
}

/** One logged meal: type, first items, time, calories. */
export function MealRow({ meal, first, lang, onPress }: { meal: Meal; first: boolean; lang: 'en' | 'mr' | 'hi'; onPress: () => void }) {
  const t = makeT(lang);
  const names = meal.items.map((x) => x.name_en).filter(Boolean);
  const alt = lang !== 'en' ? meal.items.map((x) => x.name_mr).filter(Boolean)[0] : undefined;
  return (
    <View>
      {!first ? <Divider /> : null}
      <ListRow
        icon={<Ionicons name="restaurant-outline" size={15} color={C.textDim} />}
        title={t(meal.type)}
        alt={names[0] ? `· ${names.slice(0, 2).join(', ')}` : alt}
        sub={meal.note === 'needs_review' ? t('needs_review') : `${localHHMM(meal.at)} · ${meal.items.some((x) => x.estimated) ? t('estimated') : t('verified_record')}`}
        value={String(meal.kcal)}
        valueUnit="kcal"
        onPress={onPress}
        trailing={<Ionicons name="chevron-forward" size={15} color={C.textGhost} />}
      />
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: C.cardAlt,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radiusSm,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Ionicons name={icon} size={15} color={C.textDim} />
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}
```

The week summary, patterns, sleep card, five-ring block and the old `Metric` helper are gone from this file on purpose; Task 11 puts week and patterns on Growth.

- [ ] **Step 7: Typecheck and look**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3`

Seeded browser, 375 px, Marathi: the first screen shows the top bar, the hero with a 148 px ring and a pace tick on the water meter, then the decision card with a coloured left edge and tickable rows; ticking one strikes it through and survives a reload. Below: a horizontal strip of five tiles, the day score card with `--` on the score before 18:00 and a lever sentence, then the meals with `‹ Logged intake · Today ›`. Tap `‹`: yesterday's meals and totals appear, the decision card and strip hide, `›` re-enables. 1440 px: three columns, no week card in the left column.

- [ ] **Step 8: Commit**

```bash
git add src/core/types.ts src/store/defaults.ts src/store/AppProvider.tsx src/components/DecisionCard.tsx src/components/NowStrip.tsx src/components/DayScore.tsx src/components/TopBarActions.tsx src/ui/components.tsx "src/app/(tabs)/index.tsx"
git commit -m "Rebuild Today: hero ring, decision checklist, Now strip, day score with its lever, meals by day

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Meal sheet — open a logged meal, change portions, delete

**Files:**
- Modify: `src/core/foods.ts` (`scaleMealItem`)
- Modify: `src/core/__tests__/nutrition.test.ts` (or a new `foods.test.ts` if none imports foods)
- Modify: `src/store/AppProvider.tsx` (`updateMeal`)
- Create: `src/ui/Sheet.tsx`
- Create: `src/components/MealSheet.tsx`
- Modify: `src/app/(tabs)/index.tsx` (open the sheet from `MealRow`)

**Interfaces:**
- Produces: `scaleMealItem(item: MealItem, grams: number): MealItem`; `app.updateMeal(m: Meal)`; `Sheet({ open, onClose, title, children })` (bottom sheet on phone, centred modal on desktop); `MealSheet({ meal, onClose })`.

- [ ] **Step 1: Failing test for scaling**

Create `src/core/__tests__/foods.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scaleMealItem } from '../foods';
import type { MealItem } from '../types';

describe('scaleMealItem', () => {
  const item: MealItem = { name_en: 'Chapati', name_mr: 'चपाती', grams: 80, kcal: 238, protein: 8, carbs: 42, fat: 4, estimated: false };

  it('scales every nutrient with the weight', () => {
    const half = scaleMealItem(item, 40);
    expect(half.grams).toBe(40);
    expect(half.kcal).toBe(119);
    expect(half.protein).toBe(4);
    expect(half.carbs).toBe(21);
    expect(half.fat).toBe(2);
    expect(half.estimated).toBe(false);
  });

  it('never divides by zero', () => {
    const zero = scaleMealItem({ ...item, grams: 0 }, 50);
    expect(zero.grams).toBe(50);
    expect(zero.kcal).toBe(0);
  });
});
```

Run: `npx vitest run src/core/__tests__/foods.test.ts` — expected FAIL, `scaleMealItem` not exported.

- [ ] **Step 2: The scaler**

Append to `src/core/foods.ts`:

```ts
/** The same item at a different weight. Used when a logged line has no database food behind it. */
export function scaleMealItem(item: MealItem, grams: number): MealItem {
  const ratio = item.grams > 0 ? grams / item.grams : 0;
  const r1 = (n: number) => Math.round(n * ratio * 10) / 10;
  return { ...item, grams: Math.round(grams), kcal: Math.round(item.kcal * ratio), protein: r1(item.protein), carbs: r1(item.carbs), fat: r1(item.fat) };
}
```

Run the test again — expected 2 passed.

- [ ] **Step 3: `updateMeal` in the provider**

`src/store/AppProvider.tsx`: add `updateMeal: (m: Meal) => void;` to `Ctx` and, next to `removeMeal`:

```ts
      updateMeal: (m) => update((s) => ({ ...s, meals: s.meals.map((x) => (x.id === m.id ? m : x)) })),
```

- [ ] **Step 4: The sheet primitive**

Create `src/ui/Sheet.tsx`:

```tsx
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, S } from './theme';
import { useBreakpoint } from './useBreakpoint';

/** A bottom sheet on the phone, a centred panel on the desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const wide = useBreakpoint() !== 'mobile';
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: C.scrim, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: wide ? 520 : undefined,
            maxHeight: '88%',
            backgroundColor: C.card,
            borderWidth: S.hairline,
            borderColor: C.borderStrong,
            borderTopLeftRadius: S.radius + 4,
            borderTopRightRadius: S.radius + 4,
            borderBottomLeftRadius: wide ? S.radius + 4 : 0,
            borderBottomRightRadius: wide ? S.radius + 4 : 0,
            paddingBottom: wide ? 0 : insets.bottom,
          }}>
          {!wide ? <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, marginTop: 8 }} /> : null}
          <View style={{ paddingHorizontal: S.padLg, paddingTop: 14, paddingBottom: 6 }}>
            <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{title}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: S.padLg, paddingBottom: S.padLg, gap: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 5: The meal sheet**

Create `src/components/MealSheet.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { localHHMM } from '../core/date';
import { defaultPortion, scaleMealItem, toMealItem } from '../core/foods';
import type { Meal, MealItem } from '../core/types';
import { makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { BiText, Btn, Divider, Micro, Pill, Row } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F } from '../ui/theme';

const MULTIPLIERS = [0.5, 1, 1.5, 2];

/** Shows a logged meal's lines; portions can be changed, lines removed, the meal deleted. */
export function MealSheet({ meal, onClose }: { meal: Meal | null; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [items, setItems] = useState<MealItem[]>(meal?.items ?? []);
  const [base, setBase] = useState<number[]>([]);

  // Portion pills multiply the weight the line had when the sheet opened.
  useEffect(() => {
    setItems(meal?.items ?? []);
    setBase((meal?.items ?? []).map((i) => i.grams));
  }, [meal]);

  if (!meal) return null;

  const kcal = items.reduce((a, i) => a + i.kcal, 0);
  const protein = Math.round(items.reduce((a, i) => a + i.protein, 0));
  const changed = JSON.stringify(items) !== JSON.stringify(meal.items);

  function setGrams(index: number, grams: number) {
    setItems((list) =>
      list.map((it, i) => {
        if (i !== index) return it;
        const food = it.foodId ? app.foods.find((f) => f.id === it.foodId) : undefined;
        return food ? toMealItem(food, grams, it.estimated) : scaleMealItem(it, grams);
      }),
    );
  }

  function save() {
    app.updateMeal({ ...meal, items, kcal, protein });
    fb.haptic('success');
    fb.notify(t('toast_meal_saved').replace('{kcal}', String(kcal)));
    onClose();
  }

  function remove() {
    app.removeMeal(meal.id);
    fb.haptic('light');
    onClose();
  }

  return (
    <Sheet open={!!meal} onClose={onClose} title={`${t(meal.type)} · ${localHHMM(meal.at)}`}>
      {items.length === 0 ? <Micro>{t('nothing_logged')}</Micro> : null}
      {items.map((it, idx) => {
        const food = it.foodId ? app.foods.find((f) => f.id === it.foodId) : undefined;
        const portion = food ? defaultPortion(food) : undefined;
        const unitGrams = portion?.grams ?? base[idx] ?? it.grams;
        return (
          <View key={`${it.name_en}-${idx}`} style={{ gap: 8 }}>
            {idx > 0 ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 3 }}>
                <BiText en={it.name_en} alt={lang === 'en' ? undefined : it.name_mr} />
                <Micro>{`${it.grams} g${it.estimated ? ` · ${t('estimated')}` : ''}`}</Micro>
              </View>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
                {it.kcal}
                <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '400' }}> kcal</Text>
              </Text>
              <Pressable onPress={() => setItems((l) => l.filter((_, i) => i !== idx))} hitSlop={8} accessibilityLabel={t('delete')}>
                <Ionicons name="close" size={17} color={C.textFaint} />
              </Pressable>
            </Row>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {MULTIPLIERS.map((m) => (
                <Pill key={m} label={`${m}x`} active={Math.round(unitGrams * m) === it.grams} onPress={() => setGrams(idx, unitGrams * m)} />
              ))}
            </Row>
          </View>
        );
      })}
      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{kcal}</Text>
          <Micro>{`kcal · ${protein} g ${t('protein')}`}</Micro>
        </View>
        <Row style={{ gap: 8 }}>
          <Btn small tone="danger" label={t('delete')} onPress={remove} />
          <Btn small label={t('save')} onPress={save} disabled={!changed || items.length === 0} />
        </Row>
      </Row>
    </Sheet>
  );
}
```

- [ ] **Step 6: Open it from Today**

In `src/app/(tabs)/index.tsx`: import `MealSheet` from `'../../components/MealSheet'`; add `const [openMeal, setOpenMeal] = useState<Meal | null>(null);` under `viewDate`; change the meal rows to `onPress={() => setOpenMeal(m)}`; render `<MealSheet meal={openMeal} onClose={() => setOpenMeal(null)} />` as the last child inside both `Page` returns.

- [ ] **Step 7: Typecheck, test, look**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3`
Expected: clean, `15 passed`.

Seeded browser, 375 px: tap the breakfast row; a sheet slides up with Poha and Tea, each with 0.5x/1x/1.5x/2x pills; choose 2x on Poha; the total updates; Save closes it and the row shows the new calories; reopen and Delete removes the meal. 1440 px: the same sheet appears centred.

- [ ] **Step 8: Commit**

```bash
git add src/core/foods.ts src/core/__tests__/foods.test.ts src/store/AppProvider.tsx src/ui/Sheet.tsx src/components/MealSheet.tsx "src/app/(tabs)/index.tsx"
git commit -m "Open a logged meal in a sheet to change portions or delete it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Today, desktop — the break panel and a grid that fills the fold

**Files:**
- Create: `src/components/BreakPanel.tsx`
- Delete: `src/components/BreakCard.tsx`
- Modify: `src/app/(tabs)/index.tsx` (`rightColumn`)

**Interfaces:**
- Consumes: `useBreakMonitor`, `breakStats`, `Ring`, `Bar`.
- Produces: `BreakPanel()`; shown only on desktop. Part 2 adds its pause and take-now buttons.

- [ ] **Step 1: The panel**

Create `src/components/BreakPanel.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { breakStats } from '../core/breaks';
import { formatMinutes } from '../core/date';
import { longestStretchMinutes, minutesOn } from '../core/usage';
import { makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Micro, Ring, Row } from '../ui/components';
import { C, F } from '../ui/theme';

/** The desktop break panel: a countdown ring, today's compliance, the longest stretch. */
export function BreakPanel() {
  const app = useApp();
  const monitor = useBreakMonitor();
  const t = makeT(app.state.profile.lang);

  const todayBreaks = app.state.breaks.filter((b) => b.date === app.today);
  const stats = breakStats(todayBreaks);
  const screen = minutesOn(app.state.usage, app.today);
  const sitting = longestStretchMinutes(app.state.usage, app.today);
  const left = Number.isFinite(monitor.minutesLeft) ? Math.ceil(monitor.minutesLeft) : 0;
  const elapsed = monitor.workMinutes - left;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <Ionicons name="timer-outline" size={15} color={C.accent} />
          <Micro color={C.accent}>{t('break_monitor')}</Micro>
        </Row>
        <Micro>{`${t('screen_time')} ${formatMinutes(screen)}`}</Micro>
      </Row>

      {monitor.enabled ? (
        <Row style={{ gap: 16, alignItems: 'center' }}>
          <Ring value={elapsed} max={monitor.workMinutes} size={88} stroke={5} color={left <= 1 ? C.amber : C.accent}>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '200', letterSpacing: -1 }}>{left}</Text>
            <Micro>{t('minutes')}</Micro>
          </Ring>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Micro>{t('break_next')}</Micro>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{`${left} ${t('minutes')}`}</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Micro>{t('break_compliance')}</Micro>
                <Text style={{ color: stats.compliancePct >= 60 ? C.cyan : C.textDim, fontSize: F.small, fontWeight: '600' }}>
                  {stats.taken}
                  <Text style={{ color: C.textFaint, fontWeight: '400' }}> / {todayBreaks.length}</Text>
                </Text>
              </Row>
              <Bar value={stats.taken} max={Math.max(1, todayBreaks.length)} color={C.cyan} />
            </View>
          </View>
        </Row>
      ) : (
        <Micro>{t('break_off')}</Micro>
      )}

      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{t('longest_sitting')}</Micro>
        <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>{formatMinutes(sitting)}</Text>
      </Row>
      {monitor.suggestion ? <Micro color={C.amber}>{`${t('break_every')} ${monitor.suggestion} ${t('minutes')}?`}</Micro> : null}
    </Card>
  );
}
```

- [ ] **Step 2: Swap it in and drop the old card**

In `src/app/(tabs)/index.tsx`: replace `import { BreakCard } from '../../components/BreakCard';` with `import { BreakPanel } from '../../components/BreakPanel';` and in `rightColumn` replace `<BreakCard />` with `<BreakPanel />`.

Run: `git rm src/components/BreakCard.tsx` then `grep -rn "BreakCard" src` — expected: nothing.

- [ ] **Step 3: Typecheck and look**

Run: `npx tsc --noEmit && echo OK`

Seeded browser at 1440 px: the right column starts with the break panel (ring, next break, compliance bar), then the five tiles wrapping into a grid, then the day score; the fold is full, no empty band at the bottom. The phone view has no break panel; the Now strip's break tile covers it.

- [ ] **Step 4: Commit**

```bash
git add src/components/BreakPanel.tsx "src/app/(tabs)/index.tsx"
git rm -q --cached src/components/BreakCard.tsx 2>/dev/null; git add -A src/components
git commit -m "Desktop break panel on Today; retire the old break card

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Growth — week summary and patterns move here, charts get axes, desktop grid

**Files:**
- Modify: `src/i18n/index.ts` (export `fill`)
- Modify: `src/ui/charts.tsx` (`BarChart.labels`, `LineChart` date labels)
- Modify: `src/app/(tabs)/growth.tsx`

**Interfaces:**
- Produces: `fill(template: string, params: Record<string, string | number>): string` exported from `src/i18n`; `BarChart` gains `labels?: string[]`; `LineChart` gains `dateLabel?: (date: string) => string`.

- [ ] **Step 1: A shared placeholder filler**

Append to `src/i18n/index.ts`:

```ts
/** Replaces {name} placeholders. Used for every sentence that carries a number. */
export function fill(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), template);
}
```

- [ ] **Step 2: Axes on the charts**

In `src/ui/charts.tsx`:

`BarChart` props gain `labels?: string[]`. After the `</Svg>` and before the target label, add:

```tsx
      {labels && labels.length === data.length ? (
        <View style={{ flexDirection: 'row', paddingHorizontal: pad, marginTop: 4 }}>
          {labels.map((l, i) => (
            <Text key={data[i].date} style={[MICRO, { color: C.textGhost, flex: 1, textAlign: 'center', fontSize: 9 }]} numberOfLines={1}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}
```

`LineChart` props gain `dateLabel?: (date: string) => string`. Replace its bottom label row with:

```tsx
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: C.textFaint, fontSize: F.tiny }}>
          {dateLabel ? `${dateLabel(points[0].date)} · ` : ''}
          {format(points[0].value)}
        </Text>
        <Text style={{ color: C.text, fontSize: F.tiny }}>
          {dateLabel ? `${dateLabel(points[points.length - 1].date)} · ` : ''}
          {format(points[points.length - 1].value)}
        </Text>
      </View>
```

- [ ] **Step 3: Growth, rebuilt around the period**

Replace `src/app/(tabs)/growth.tsx` in full:

```tsx
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { TopBarActions } from '../../components/TopBarActions';
import { WeeklyReport } from '../../components/WeeklyReport';
import { formatDayLabel, formatMinutes } from '../../core/date';
import { changePct, isImprovement, summarize, type Metric, type Period } from '../../core/growth';
import { findPatterns, weeklyStats } from '../../core/insights';
import { hourlyProfile, longestStretchMinutes, minutesOn } from '../../core/usage';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { BarChart, ConsistencyStrip, HourStrip, LineChart } from '../../ui/charts';
import { Bar, Card, Divider, Micro, Row, SectionHeader, Segmented, Small } from '../../ui/components';
import { Page } from '../../ui/TopBar';
import { Cols } from '../../ui/tiles';
import { C, F, S } from '../../ui/theme';
import { useBreakpoint } from '../../ui/useBreakpoint';

const METRIC_LABEL: Record<string, string> = {
  avg_kcal: 'avg_kcal_m',
  on_target: 'on_target',
  logged_days: 'logged_days_m',
  workout_days: 'workout_days_m',
  move_minutes: 'move_minutes',
  avg_sleep: 'avg_sleep_m',
  avg_water: 'avg_water',
  avg_mood: 'avg_mood',
  screen_time: 'screen_time',
  weight_change: 'weight_change',
};

const WEEKDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function GrowthScreen() {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
  const wide = useBreakpoint() === 'desktop';
  const [period, setPeriod] = useState<Period>('week');

  const summary = useMemo(
    () =>
      summarize(period, app.today, {
        meals: app.state.meals,
        water: app.state.water,
        weights: app.state.weights,
        sleep: app.state.sleep,
        moods: app.state.moods,
        workouts: app.state.workouts,
        usage: app.state.usage,
        kcalTarget: app.targets.kcal,
        waterGoalMl: app.state.settings.waterGoalMl,
      }),
    [period, app.today, app.state, app.targets.kcal],
  );

  const week = useMemo(
    () =>
      weeklyStats({
        today: app.today,
        meals: app.state.meals,
        water: app.state.water,
        workouts: app.state.workouts,
        sleep: app.state.sleep,
        weights: app.state.weights,
        kcalTarget: app.targets.kcal,
        waterGoalMl: app.state.settings.waterGoalMl,
      }),
    [app.today, app.state.meals, app.state.water, app.state.workouts, app.state.sleep, app.state.weights, app.targets.kcal, app.state.settings.waterGoalMl],
  );

  const patterns = useMemo(
    () => findPatterns({ meals: app.state.meals, sleep: app.state.sleep, moods: app.state.moods, workouts: app.state.workouts, kcalTarget: app.targets.kcal }),
    [app.state.meals, app.state.sleep, app.state.moods, app.state.workouts, app.targets.kcal],
  );

  const weightMetric = summary.metrics.find((m) => m.key === 'weight_change')!;
  const hasAnything = summary.metrics.some((m) => m.value !== 0);
  const screenToday = minutesOn(app.state.usage, app.today);
  const sitting = longestStretchMinutes(app.state.usage, app.today);
  const breaksToday = app.state.breaks.filter((b) => b.date === app.today);
  const breaksTaken = breaksToday.filter((b) => b.action === 'taken').length;

  const toGoal = Math.max(0, Math.round((app.state.profile.weightKg - app.state.profile.goalWeightKg) * 10) / 10);
  const startWeight = app.state.weights[0]?.kg ?? app.state.profile.weightKg;
  const totalToLose = Math.max(1, startWeight - app.state.profile.goalWeightKg);
  const progressed = Math.max(0, startWeight - app.state.profile.weightKg);

  const label = (m: Metric) => t(METRIC_LABEL[m.key] ?? m.key);
  // Weekday letters for a week; day-of-month every fifth day for a month.
  const barLabels = summary.kcalSeries.map((d, i) =>
    summary.kcalSeries.length <= 7 ? WEEKDAY[(new Date(d.date + 'T12:00:00').getDay() + 6) % 7] : i % 5 === 0 ? d.date.slice(8) : '',
  );
  const dayLabel = (d: string) => formatDayLabel(d, lang);

  const periodSwitch = (
    <Segmented
      value={period}
      onChange={setPeriod}
      options={[
        { key: 'today', label: en('period_today') },
        { key: 'week', label: en('period_week') },
        { key: 'month', label: en('period_month') },
      ]}
    />
  );

  const headline = (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{`${en('weight_change')} · ${en(`period_${period}`)}`}</Micro>
        <Micro color={weightMetric.value <= 0 ? C.cyan : C.amber}>{weightMetric.value <= 0 ? en('on_track_short') : en('watch_short')}</Micro>
      </Row>
      <Row style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ color: C.text, fontSize: 42, fontWeight: '200', letterSpacing: -1.5 }}>
          {weightMetric.value > 0 ? '+' : ''}
          {weightMetric.value.toFixed(1)}
        </Text>
        <Text style={{ color: C.textDim, fontSize: F.h2, marginBottom: 8 }}>{t('unit_kg')}</Text>
      </Row>
      <View style={{ gap: 7 }}>
        <Bar value={progressed} max={totalToLose} color={C.accent} height={5} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{`${app.state.profile.weightKg} ${t('unit_kg')} ${en('now')}`}</Micro>
          <Micro>{`${toGoal} ${t('unit_kg')} ${en('to_goal')}`}</Micro>
        </Row>
      </View>
    </Card>
  );

  const consistency = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={`${en('consistency')} · ${en(`period_${period}`)}`} meta={`${summary.consistency.filter((c) => c.onTarget).length}/${summary.consistency.length}`} />
      <Card>
        <ConsistencyStrip data={summary.consistency} labels={period === 'week' ? WEEKDAY : undefined} />
      </Card>
    </View>
  );

  const tiles = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {summary.metrics
        .filter((m) => m.key !== 'weight_change')
        .map((m) => (
          <MetricTile key={m.key} metric={m} label={label(m)} lang={lang} wide={wide} />
        ))}
    </View>
  );

  const weightChart = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('weight_trend')} meta={lang === 'en' ? undefined : t('weight_trend')} />
      <Card>
        {summary.weightSeries.length >= 2 ? (
          <LineChart data={summary.weightSeries} goal={app.state.profile.goalWeightKg} format={(v) => `${v.toFixed(1)} ${t('unit_kg')}`} dateLabel={dayLabel} />
        ) : (
          <Small color={C.textGhost}>{t('log_more_days')}</Small>
        )}
      </Card>
    </View>
  );

  const kcalChart = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('calories_vs_target')} meta={`${app.targets.kcal} kcal`} />
      <Card>
        <BarChart data={summary.kcalSeries} target={app.targets.kcal} format={(v) => `${v} kcal`} labels={barLabels} />
      </Card>
    </View>
  );

  const sleepChart = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('sleep_hours')} meta="7h 30m" />
      <Card>
        <BarChart data={summary.sleepSeries} target={450} color={C.violet} format={(v) => formatMinutes(v)} labels={barLabels} />
      </Card>
    </View>
  );

  const screenCard = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('screen_time')} meta={formatMinutes(screenToday)} />
      <Card>
        <HourStrip hours={hourlyProfile(app.state.usage, app.today)} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>00</Micro>
          <Micro>12</Micro>
          <Micro>23</Micro>
        </Row>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{en('longest_sitting')}</Micro>
          <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>{formatMinutes(sitting)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{en('break_compliance')}</Micro>
          <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
            {breaksTaken}
            <Text style={{ color: C.textFaint, fontWeight: '400' }}> / {breaksToday.length}</Text>
          </Text>
        </Row>
      </Card>
    </View>
  );

  const weekCard = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('week_summary')} meta={`${week.loggedDays}/7`} />
      <Card>
        <Row style={{ flexWrap: 'wrap', rowGap: 18 }}>
          <Stat label={t('avg_kcal')} value={String(week.avgKcal)} />
          <Stat label={t('over_days')} value={String(week.overDays)} />
          <Stat label={t('workout_days')} value={String(week.workoutDays)} />
          <Stat label={t('avg_sleep')} value={week.avgSleepMinutes ? formatMinutes(week.avgSleepMinutes) : '--'} />
          {week.trend ? (
            <Stat
              label={t('unit_kg')}
              value={`${week.trend.current}`}
              delta={week.trend.change7 !== null ? `${week.trend.change7 > 0 ? '+' : ''}${week.trend.change7}` : undefined}
              deltaGood={week.trend.change7 !== null ? week.trend.change7 <= 0 : undefined}
            />
          ) : null}
        </Row>
      </Card>
    </View>
  );

  const patternsCard = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('patterns')} />
      <Card>
        {patterns.length === 0 ? (
          <Small color={C.textGhost}>{t('no_patterns')}</Small>
        ) : (
          patterns.slice(0, 4).map((p) => <Small key={p.key}>{fill(t(`pattern_${p.key}`), p.params)}</Small>)
        )}
      </Card>
    </View>
  );

  const empty = !hasAnything ? (
    <Card>
      <Small>{t('log_more_days')}</Small>
    </Card>
  ) : null;

  if (wide) {
    return (
      <Page title={en('growth')} alt={lang === 'en' ? undefined : t('growth')} right={<TopBarActions />} wide>
        <View style={{ maxWidth: 420 }}>{periodSwitch}</View>
        {empty}
        <Cols weights={[1.2, 1]}>
          {headline}
          {consistency}
        </Cols>
        {tiles}
        <Cols weights={[1, 1]}>
          {weightChart}
          {kcalChart}
        </Cols>
        <Cols weights={[1, 1]}>
          {sleepChart}
          {screenCard}
        </Cols>
        <Cols weights={[1, 1]}>
          {weekCard}
          {patternsCard}
        </Cols>
        {period !== 'today' ? <WeeklyReport summary={summary} /> : null}
      </Page>
    );
  }

  return (
    <Page title={en('growth')} alt={lang === 'en' ? undefined : t('growth')} right={<TopBarActions />}>
      {periodSwitch}
      {headline}
      {empty}
      {tiles}
      {consistency}
      {period !== 'today' ? <WeeklyReport summary={summary} /> : null}
      {weightChart}
      {kcalChart}
      {sleepChart}
      {screenCard}
      {weekCard}
      {patternsCard}
    </Page>
  );
}

function MetricTile({ metric, label, lang, wide }: { metric: Metric; label: string; lang: 'en' | 'mr' | 'hi'; wide: boolean }) {
  const t = makeT(lang);
  const isTime = metric.unit === 'min' && metric.value >= 60;
  const value = isTime ? formatMinutes(metric.value) : metric.decimals ? metric.value.toFixed(metric.decimals) : String(metric.value);
  const unit = isTime ? '' : metric.unit;
  const pct = changePct(metric);
  const good = isImprovement(metric);
  const deltaColor = good === null ? C.textGhost : good ? C.cyan : C.amber;

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: wide ? '18%' : '46%',
        backgroundColor: C.card,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radius,
        padding: 16,
        gap: 9,
      }}>
      <Micro>{label}</Micro>
      <Row style={{ alignItems: 'baseline', gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '300', letterSpacing: -0.5 }}>{value}</Text>
        {unit ? <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{unit}</Text> : null}
      </Row>
      <View style={{ alignSelf: 'flex-start', backgroundColor: C.cardAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: S.hairline, borderColor: C.border }}>
        <Text style={{ color: deltaColor, fontSize: F.micro, fontWeight: '500' }}>{pct === null ? t('vs_previous') : `${pct > 0 ? '+' : ''}${pct}% ${t('vs_previous')}`}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, delta, deltaGood }: { label: string; value: string; delta?: string; deltaGood?: boolean }) {
  return (
    <View style={{ minWidth: 76, flexGrow: 1, gap: 5 }}>
      <Micro>{label}</Micro>
      <Row style={{ gap: 6, alignItems: 'baseline' }}>
        <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{value}</Text>
        {delta ? <Text style={{ color: deltaGood ? C.cyan : C.amber, fontSize: F.tiny }}>{delta}</Text> : null}
      </Row>
    </View>
  );
}
```

- [ ] **Step 4: Typecheck and look**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3`

Seeded browser, 375 px, Growth: weekday letters under the calorie and sleep bars, dates beside the first and last weight values, and at the bottom the week summary and a Marathi patterns card. 1440 px: headline and consistency side by side, five tiles across, charts two across, nothing centred in a narrow column.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/index.ts src/ui/charts.tsx "src/app/(tabs)/growth.tsx"
git commit -m "Growth: week summary and patterns live here, charts get axes, desktop grid

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Log — recent foods and "same as yesterday", a sticky basket, compact water and weight, two desktop panes

**Files:**
- Modify: `src/core/foods.ts` (`recentFoodIds`)
- Modify: `src/core/__tests__/foods.test.ts`
- Modify: `src/ui/components.tsx` (`Field.autoFocus`)
- Modify: `src/app/log.tsx` (rewritten)

**Interfaces:**
- Produces: `recentFoodIds(meals: Meal[], sinceDate: ISODate, limit?: number): string[]` — most-used database foods since a date, most frequent first.

- [ ] **Step 1: Failing test**

Append to `src/core/__tests__/foods.test.ts`:

```ts
import { recentFoodIds } from '../foods';
import type { Meal } from '../types';

describe('recentFoodIds', () => {
  const mk = (date: string, ids: (string | undefined)[]): Meal => ({
    id: date,
    at: `${date}T13:00`,
    date,
    type: 'lunch',
    items: ids.map((foodId) => ({ foodId, name_en: foodId ?? 'x', name_mr: '', grams: 100, kcal: 100, protein: 5, carbs: 10, fat: 2, estimated: false })),
    kcal: 100,
    protein: 5,
  });

  it('ranks by how often a food was logged, most first', () => {
    const meals = [mk('2026-09-20', ['chapati', 'dal']), mk('2026-09-21', ['chapati', 'rice']), mk('2026-09-22', ['chapati', 'dal'])];
    expect(recentFoodIds(meals, '2026-09-01')).toEqual(['chapati', 'dal', 'rice']);
  });

  it('ignores lines without a database food and days before the cutoff', () => {
    const meals = [mk('2026-08-01', ['old']), mk('2026-09-22', [undefined, 'curd'])];
    expect(recentFoodIds(meals, '2026-09-01')).toEqual(['curd']);
  });

  it('caps the list', () => {
    const meals = [mk('2026-09-22', ['a', 'b', 'c', 'd'])];
    expect(recentFoodIds(meals, '2026-09-01', 2)).toHaveLength(2);
  });
});
```

Move the `import type { MealItem }` line at the top to `import type { Meal, MealItem } from '../types';` and merge the two `from '../foods'` imports into one. Run the file — expected FAIL, `recentFoodIds` missing.

- [ ] **Step 2: The ranker**

Append to `src/core/foods.ts` (add `Meal` and `ISODate` to its `./types` import):

```ts
/** Database foods logged since `sinceDate`, most often first. Feeds the "recent" row. */
export function recentFoodIds(meals: Meal[], sinceDate: ISODate, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const m of meals) {
    if (m.date < sinceDate) continue;
    for (const it of m.items) if (it.foodId) counts.set(it.foodId, (counts.get(it.foodId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}
```

Run: `npx vitest run src/core/__tests__/foods.test.ts` — expected 5 passed.

- [ ] **Step 3: The search field can take focus**

In `src/ui/components.tsx`, `Field` gains `autoFocus?: boolean` in its props type and passes `autoFocus={autoFocus}` to its `TextInput`.

- [ ] **Step 4: Rewrite Log**

Replace `src/app/log.tsx` in full:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomFoodForm } from '../components/CustomFoodForm';
import { IconButton } from '../components/TopBarActions';
import { addDays, localHHMM, toISODate } from '../core/date';
import { defaultPortion, portionLabel, recentFoodIds, searchFoods, toMealItem } from '../core/foods';
import { mealTypeForHour } from '../core/nutrition';
import type { FoodItem, MealItem, MealType } from '../core/types';
import { makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { BiText, Btn, Card, Divider, Empty, Field, ListRow, Micro, Pill, Row, SectionHeader, Segmented, Small } from '../ui/components';
import { TopBar } from '../ui/TopBar';
import { C, F, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function LogScreen() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const insets = useSafeAreaInsets();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
  const wide = useBreakpoint() === 'desktop';

  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState<MealType>(mealTypeForHour(new Date().getHours()));
  const [basket, setBasket] = useState<{ food: FoodItem; count: number; unit: string }[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

  const results = useMemo(() => searchFoods(app.foods, query, 30), [app.foods, query]);
  const todayMeals = app.state.meals.filter((m) => m.date === app.today);
  const recents = useMemo(() => {
    const ids = recentFoodIds(app.state.meals, addDays(app.today, -30), 8);
    return ids.map((id) => app.foods.find((f) => f.id === id)).filter((f): f is FoodItem => !!f);
  }, [app.state.meals, app.foods, app.today]);
  const yesterdaySame = app.state.meals.find((m) => m.date === addDays(app.today, -1) && m.type === mealType);

  const basketItems: MealItem[] = basket.map((b) => {
    const p = b.food.portions.find((x) => x.unit === b.unit) ?? defaultPortion(b.food);
    return toMealItem(b.food, (p?.grams ?? 100) * b.count);
  });
  const basketKcal = basketItems.reduce((a, i) => a + i.kcal, 0);
  const basketProtein = Math.round(basketItems.reduce((a, i) => a + i.protein, 0));

  function addToBasket(food: FoodItem) {
    fb.haptic('light');
    setBasket((b) => {
      const existing = b.find((x) => x.food.id === food.id);
      if (existing) return b.map((x) => (x.food.id === food.id ? { ...x, count: x.count + 0.5 } : x));
      return [...b, { food, count: 1, unit: food.default_portion }];
    });
  }

  function saveMeal() {
    if (basketItems.length === 0) return;
    const now = new Date();
    app.addMeal({ id: String(now.getTime()), at: now.toISOString(), date: toISODate(now), type: mealType, items: basketItems, kcal: basketKcal, protein: basketProtein });
    setBasket([]);
    setQuery('');
    fb.haptic('success');
    fb.notify(t('toast_meal_saved').replace('{kcal}', String(basketKcal)));
  }

  function repeatYesterday() {
    if (!yesterdaySame) return;
    const now = new Date();
    app.addMeal({ ...yesterdaySame, id: String(now.getTime()), at: now.toISOString(), date: toISODate(now), note: undefined });
    fb.haptic('success');
    fb.notify(t('toast_meal_saved').replace('{kcal}', String(yesterdaySame.kcal)));
  }

  function saveWeight() {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg < 25 || kg > 350) return;
    app.addWeight({ date: app.today, kg });
    setWeightInput('');
    fb.notify(`${kg} ${t('unit_kg')}`);
  }

  function addGlass() {
    app.addWater(app.state.settings.glassMl);
    fb.haptic('light');
    fb.notify(t('toast_water_added'));
  }

  const glasses = Math.round(app.waterToday / app.state.settings.glassMl);
  const glassGoal = Math.round(app.state.settings.waterGoalMl / app.state.settings.glassMl);

  const quickRow = (
    <Row style={{ gap: 10, alignItems: 'stretch' }}>
      <Pressable
        onPress={addGlass}
        style={({ pressed }) => ({ flex: 1, backgroundColor: C.card, borderWidth: S.hairline, borderColor: C.border, borderRadius: S.radius, padding: 14, gap: 4, opacity: pressed ? 0.7 : 1 })}>
        <Row style={{ gap: 6 }}>
          <Ionicons name="water-outline" size={15} color={C.cyan} />
          <Micro>{en('water')}</Micro>
        </Row>
        <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '300' }}>
          +1 <Text style={{ color: C.textFaint, fontSize: F.small }}>{`${glasses} / ${glassGoal}`}</Text>
        </Text>
      </Pressable>
      <View style={{ flex: 1, backgroundColor: C.card, borderWidth: S.hairline, borderColor: C.border, borderRadius: S.radius, padding: 14, gap: 6 }}>
        <Micro>{en('add_weight')}</Micro>
        <Row style={{ gap: 8 }}>
          <Field value={weightInput} onChangeText={setWeightInput} keyboardType="numeric" placeholder={`${app.state.profile.weightKg}`} />
          <Pressable onPress={saveWeight} disabled={!weightInput.trim()} hitSlop={6} accessibilityLabel={t('save')} style={{ opacity: weightInput.trim() ? 1 : 0.35, justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={26} color={C.accent} />
          </Pressable>
        </Row>
      </View>
    </Row>
  );

  const tools = (
    <Row style={{ gap: 8 }}>
      <Btn small tone="soft" icon={<Ionicons name="camera-outline" size={15} color={C.accent} />} label={t('add_photo')} onPress={() => router.push('/photo')} style={{ flex: 1 }} />
      <Btn small tone="soft" icon={<Ionicons name="barcode-outline" size={15} color={C.accent} />} label={t('scan_barcode')} onPress={() => router.push('/scan')} style={{ flex: 1 }} />
    </Row>
  );

  const searchBlock = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('add_food')} meta={t(mealType)} />
      <Segmented value={mealType} onChange={setMealType} options={MEAL_TYPES.map((m) => ({ key: m, label: en(m) }))} />
      <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} autoFocus={!wide} />
      {query.trim() === '' && (recents.length > 0 || yesterdaySame) ? (
        <View style={{ gap: 8 }}>
          <Micro>{t('recent')}</Micro>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {yesterdaySame ? <Pill label={`↻ ${t('same_as_yesterday')} · ${yesterdaySame.kcal} kcal`} tone={C.accent} textColor={C.text} onPress={repeatYesterday} /> : null}
            {recents.map((f) => (
              <Pill key={f.id} label={lang === 'en' ? f.name_en : f.name_mr || f.name_en} onPress={() => addToBasket(f)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  const basketCard =
    basket.length > 0 ? (
      <Card tone={C.accent}>
        {basket.map((b, idx) => {
          const p = b.food.portions.find((x) => x.unit === b.unit) ?? defaultPortion(b.food);
          const item = basketItems[idx];
          return (
            <View key={b.food.id} style={{ gap: 9 }}>
              {idx > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <BiText en={b.food.name_en} alt={lang === 'en' ? undefined : b.food.name_mr} />
                  <Micro>{`${p ? portionLabel(p, lang) : ''} · ${item.grams} g`}</Micro>
                </View>
                <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
                  {item.kcal}
                  <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '400' }}> kcal</Text>
                </Text>
                <Pressable onPress={() => setBasket((x) => x.filter((y) => y.food.id !== b.food.id))} hitSlop={8}>
                  <Ionicons name="close" size={17} color={C.textFaint} />
                </Pressable>
              </Row>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                {[0.5, 1, 1.5, 2, 3].map((n) => (
                  <Pill key={n} label={`${n}x`} active={b.count === n} onPress={() => setBasket((x) => x.map((y) => (y.food.id === b.food.id ? { ...y, count: n } : y)))} />
                ))}
                {b.food.portions.length > 1
                  ? b.food.portions.map((pp) => (
                      <Pill key={pp.unit} label={pp.unit} active={b.unit === pp.unit} onPress={() => setBasket((x) => x.map((y) => (y.food.id === b.food.id ? { ...y, unit: pp.unit } : y)))} />
                    ))
                  : null}
              </Row>
            </View>
          );
        })}
        {wide ? (
          <>
            <Divider />
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{basketKcal}</Text>
                <Micro>{`kcal · ${basketProtein} g ${en('protein')}`}</Micro>
              </View>
              <Btn label={t('save')} onPress={saveMeal} />
            </Row>
          </>
        ) : null}
      </Card>
    ) : null;

  const resultsCard = (
    <Card>
      {results.length === 0 ? (
        <View style={{ gap: 10 }}>
          <Empty text={t('no_results')} />
          <Btn small tone="soft" label={query.trim() ? t('add_as_custom').replace('{q}', query.trim()) : t('custom_food')} onPress={() => setCustomOpen(true)} />
        </View>
      ) : (
        <>
          {results.slice(0, 20).map((f, i) => {
            const p = defaultPortion(f);
            const kcal = p ? Math.round((f.kcal_100g * p.grams) / 100) : f.kcal_100g;
            return (
              <View key={f.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow title={f.name_en} alt={lang === 'en' ? undefined : f.name_mr} sub={p ? portionLabel(p, lang) : undefined} value={String(kcal)} valueUnit="kcal" onPress={() => addToBasket(f)} trailing={<Ionicons name="add" size={17} color={C.accent} />} />
              </View>
            );
          })}
          <Divider />
          <Btn small tone="ghost" label={t('custom_food')} onPress={() => setCustomOpen(true)} />
        </>
      )}
    </Card>
  );

  const customForm = customOpen ? (
    <CustomFoodForm
      initialName={query}
      onSaved={(f) => {
        setCustomOpen(false);
        addToBasket(f);
        setQuery('');
      }}
      onCancel={() => setCustomOpen(false)}
    />
  ) : null;

  const todayCard = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('logged_intake')} meta={`${todayMeals.length}`} />
      <Card>
        {todayMeals.length === 0 ? (
          <Empty text={t('nothing_logged')} />
        ) : (
          todayMeals.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon={<Ionicons name="restaurant-outline" size={15} color={C.textDim} />}
                title={t(m.type)}
                alt={m.items[0]?.name_en ? `· ${m.items.map((x) => x.name_en).slice(0, 2).join(', ')}` : undefined}
                sub={localHHMM(m.at)}
                value={String(m.kcal)}
                valueUnit="kcal"
                trailing={
                  <Pressable onPress={() => app.removeMeal(m.id)} hitSlop={8} accessibilityLabel={t('delete')}>
                    <Ionicons name="trash-outline" size={16} color={C.textGhost} />
                  </Pressable>
                }
              />
            </View>
          ))
        )}
      </Card>
    </View>
  );

  const bar = (
    <TopBar title={en('tab_log')} alt={lang === 'en' ? undefined : t('tab_log')} right={<IconButton name="close" label={t('close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />} />
  );

  const scroll = { padding: S.pad, gap: S.gap } as const;

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {bar}
        <View style={{ flex: 1, flexDirection: 'row', maxWidth: S.maxWide, width: '100%', alignSelf: 'center' }}>
          <ScrollView style={{ flex: 1.2 }} contentContainerStyle={{ ...scroll, paddingHorizontal: S.gutterWide }} keyboardShouldPersistTaps="handled">
            {tools}
            {searchBlock}
            {customForm}
            {resultsCard}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...scroll, paddingHorizontal: S.gutterWide }} keyboardShouldPersistTaps="handled">
            {quickRow}
            {basketCard}
            {todayCard}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {bar}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...scroll, maxWidth: 780, width: '100%', alignSelf: 'center', paddingBottom: basket.length > 0 ? 120 : 40 }} keyboardShouldPersistTaps="handled">
        {quickRow}
        {tools}
        {searchBlock}
        {basketCard}
        {customForm}
        {resultsCard}
        {todayCard}
      </ScrollView>
      {basket.length > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: S.pad,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: C.bgAlt,
            borderTopWidth: S.hairline,
            borderTopColor: C.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{basketKcal}</Text>
            <Micro>{`${basket.length} ${t('items').toLowerCase()} · ${basketProtein} g ${en('protein')}`}</Micro>
          </View>
          <Btn label={t('save')} onPress={saveMeal} style={{ minWidth: 120 }} />
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 5: Typecheck, test, look**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3`

Seeded browser, 375 px, tap "+": the sheet opens with water and weight as one compact row, then Photo and Scan, then the meal type switch, the search field, and a "Recent" row that starts with "↻ Same as yesterday · N kcal". Tap a recent chip; a sticky bar appears at the bottom with the total and Save; Save shows the toast and clears it. 1440 px: search left, basket and today's meals right, no sticky bar.

- [ ] **Step 6: Commit**

```bash
git add src/core/foods.ts src/core/__tests__/foods.test.ts src/ui/components.tsx src/app/log.tsx
git commit -m "Log: recent foods and same-as-yesterday, a sticky basket, compact water and weight, two desktop panes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Move — phase progress line and a two-column desktop

**Files:**
- Modify: `src/core/fitness.ts` (`phaseProgress`)
- Modify: `src/core/__tests__/fitness.test.ts`
- Modify: `src/app/(tabs)/fit.tsx`

**Interfaces:**
- Produces: `phaseProgress(week: number): { phase: 1 | 2 | 3; weekInPhase: number; phaseWeeks: number | null }` (`phaseWeeks` is null in the open-ended third phase).

- [ ] **Step 1: Failing test**

Append to `src/core/__tests__/fitness.test.ts` (add `phaseProgress` to its `'../fitness'` import):

```ts
describe('phaseProgress', () => {
  it('counts weeks inside the first two phases', () => {
    expect(phaseProgress(1)).toEqual({ phase: 1, weekInPhase: 1, phaseWeeks: 4 });
    expect(phaseProgress(4)).toEqual({ phase: 1, weekInPhase: 4, phaseWeeks: 4 });
    expect(phaseProgress(5)).toEqual({ phase: 2, weekInPhase: 1, phaseWeeks: 8 });
    expect(phaseProgress(12)).toEqual({ phase: 2, weekInPhase: 8, phaseWeeks: 8 });
  });

  it('is open-ended after week 12', () => {
    expect(phaseProgress(15)).toEqual({ phase: 3, weekInPhase: 3, phaseWeeks: null });
  });
});
```

Run: `npx vitest run src/core/__tests__/fitness.test.ts` — expected FAIL.

- [ ] **Step 2: The helper**

Append to `src/core/fitness.ts` after `phaseForWeek`:

```ts
/** Where this week sits inside its phase, for the progress line on Move. */
export function phaseProgress(week: number): { phase: 1 | 2 | 3; weekInPhase: number; phaseWeeks: number | null } {
  if (week <= 4) return { phase: 1, weekInPhase: week, phaseWeeks: 4 };
  if (week <= 12) return { phase: 2, weekInPhase: week - 4, phaseWeeks: 8 };
  return { phase: 3, weekInPhase: week - 12, phaseWeeks: null };
}
```

Run the test — expected pass.

- [ ] **Step 3: Move's layout**

In `src/app/(tabs)/fit.tsx`:

- Imports: add `phaseProgress` to the `'../../core/fitness'` import; add `import { fill } from '../../i18n';` (merge with `makeT`), `import { Cols } from '../../ui/tiles';`, `import { useBreakpoint } from '../../ui/useBreakpoint';`, `import { formatDayLabel } from '../../core/date';`, and `Bar` to the components import.
- After `const phase = phaseForWeek(week);` add `const prog = phaseProgress(week); const wide = useBreakpoint() === 'desktop';`.
- After `{eased ? <Small color={C.amber}>{en('plan_eased')}</Small> : null}` inside the hero card add:

```tsx
        <View style={{ gap: 6 }}>
          <Micro>{prog.phaseWeeks ? fill(t('phase_of'), { p: prog.phase, w: prog.weekInPhase, n: prog.phaseWeeks }) : `${t('phase_label')} ${prog.phase} · ${t('week_label')} ${week}`}</Micro>
          {prog.phaseWeeks ? <Bar value={prog.weekInPhase} max={prog.phaseWeeks} color={C.accent} height={3} /> : null}
        </View>
```

- Name the three existing blocks so both layouts can place them: wrap the hero `<Card>…</Card>` as `const hero = (…)`, the "today's moves" `<View style={{ gap: 10 }}>…</View>` as `const moves = (…)`, and the week summary block as `const weekCard = (…)`. Add a history block:

```tsx
  const history = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('workout_days_m')} meta={`${doneCount} ${en('total')}`} />
      <Card>
        {[...app.state.workouts]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map((w, i) => (
            <View key={w.id}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <Small>{formatDayLabel(w.date, lang)}</Small>
                <Small color={w.status === 'done' ? C.accent : C.textFaint}>{w.status === 'done' ? `${t('done')} · ${w.minutes} min` : t('skip_session')}</Small>
              </Row>
            </View>
          ))}
        {app.state.workouts.length === 0 ? <Small color={C.textGhost}>{t('no_data_yet')}</Small> : null}
      </Card>
    </View>
  );
```

- Replace the return with:

```tsx
  if (wide) {
    return (
      <Page title={en('fit_title')} alt={lang === 'en' ? undefined : t('fit_title')} right={<TopBarActions />} wide>
        <Cols weights={[1.3, 1]}>
          <>
            {hero}
            {moves}
          </>
          <>
            {weekCard}
            {history}
            <Small color={C.textGhost}>{t('medical_note')}</Small>
          </>
        </Cols>
      </Page>
    );
  }

  return (
    <Page title={en('fit_title')} alt={lang === 'en' ? undefined : t('fit_title')} right={<TopBarActions />}>
      {hero}
      {moves}
      {weekCard}
      {history}
      <Small color={C.textGhost}>{t('medical_note')}</Small>
    </Page>
  );
```

- [ ] **Step 4: Typecheck, test, look**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3`

Seeded browser, 375 px, Move: under the readiness stats a line "टप्पा 1 · आठवडा 2 / 4" with a thin bar half full; chips read "चांगली झोप" and "लवचिकता". 1440 px: hero and moves left, week card and a dated history right.

- [ ] **Step 5: Commit**

```bash
git add src/core/fitness.ts src/core/__tests__/fitness.test.ts "src/app/(tabs)/fit.tsx"
git commit -m "Move: phase progress line, workout history, two desktop columns

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Mind — drawn faces instead of emoji, tool tiles, two desktop columns

**Files:**
- Create: `src/ui/Face.tsx`
- Modify: `src/app/(tabs)/mind.tsx`

**Interfaces:**
- Produces: `Face({ score, size?, color? })` — an SVG face for a 1–5 mood score. `MOODS` (the emoji array) is deleted.

- [ ] **Step 1: The face**

Create `src/ui/Face.tsx`:

```tsx
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { C } from './theme';

/**
 * A line-drawn face for a 1–5 mood. The mouth's curve is the score: a frown
 * at 1, flat at 3, a smile at 5. No emoji, so it matches the rest of the
 * instrument panel and renders identically on every platform.
 */
export function Face({ score, size = 28, color = C.textDim }: { score: number; size?: number; color?: string }) {
  const s = Math.max(1, Math.min(5, score));
  const r = size / 2;
  const cx = r;
  const cy = r;
  const stroke = Math.max(1.5, size / 16);
  const eyeY = cy - r * 0.18;
  const eyeX = r * 0.32;
  const mouthY = cy + r * 0.28;
  const mouthHalf = r * 0.38;
  // Control point moves from above the mouth (frown) to below it (smile).
  const bend = (s - 3) * r * 0.24;
  const mouth = `M ${cx - mouthHalf} ${mouthY} Q ${cx} ${mouthY + bend} ${cx + mouthHalf} ${mouthY}`;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r - stroke} stroke={color} strokeWidth={stroke} fill="none" />
      <Circle cx={cx - eyeX} cy={eyeY} r={stroke * 0.9} fill={color} />
      <Circle cx={cx + eyeX} cy={eyeY} r={stroke * 0.9} fill={color} />
      <Path d={mouth} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
```

- [ ] **Step 2: Mind uses it, and gets tiles and columns**

In `src/app/(tabs)/mind.tsx`:

- Imports: add `import { Face } from '../../ui/Face';`, `import { Ionicons } from '@expo/vector-icons';`, `import { PressScale } from '../../ui/PressScale';`, `import { Cols } from '../../ui/tiles';`, `import { useBreakpoint } from '../../ui/useBreakpoint';`, `import { Page } from '../../ui/TopBar';` (already from Task 7), and `formatDayLabel`, `localHHMM` from `'../../core/date'`.
- Delete `const MOODS = […]`.
- Add `const wide = useBreakpoint() === 'desktop';` after the state hooks.
- Replace the five mood `Pressable`s' inner `<Text style={{ fontSize: 22 }}>{m}</Text>` with `<Face score={i + 1} size={26} color={score === i + 1 ? C.accent : C.textDim} />`, iterating `[1, 2, 3, 4, 5].map((n, i) => …)` instead of `MOODS.map`, keys `n`.
- Replace the three-button tool row with:

```tsx
  const toolTiles = (
    <Row style={{ gap: 8 }}>
      {(
        [
          { key: 'breathe', icon: 'cloud-outline', label: t('breathe') },
          { key: 'grounding', icon: 'hand-left-outline', label: t('grounding') },
          { key: 'gratitude', icon: 'sparkles-outline', label: t('gratitude') },
        ] as const
      ).map((x) => (
        <PressScale key={x.key} onPress={() => setTool(tool === x.key ? null : x.key)} style={{ flex: 1 }}>
          <View
            style={{
              backgroundColor: tool === x.key ? C.accentDim : C.card,
              borderWidth: S.hairline,
              borderColor: tool === x.key ? C.accent : C.border,
              borderRadius: S.radius,
              paddingVertical: 16,
              alignItems: 'center',
              gap: 8,
            }}>
            <Ionicons name={x.icon} size={20} color={tool === x.key ? C.accent : C.textDim} />
            <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{x.label}</Text>
          </View>
        </PressScale>
      ))}
    </Row>
  );
```

- In the today's-entries list replace `icon={<Text style={{ fontSize: 17 }}>{MOODS[m.score - 1]}</Text>}` with `icon={<Face score={m.score} size={20} />}` and `sub={m.at.slice(11, 16)}`-style time with `sub={localHHMM(m.at)}` (already done in Task 1; keep it).
- Name the blocks: `const crisisCard = crisis ? (…) : null;`, `const checkIn = (<Card>…mood…</Card>)`, `const toolPanel = (<>{tool === 'breathe' ? <BreatheBox lang={lang} /> : null}{tool === 'grounding' ? <Grounding lang={lang} /> : null}{tool === 'gratitude' ? <Gratitude lang={lang} /> : null}</>)`, `const entries = todayMoods.length > 0 ? (…) : null`.
- Replace the return with:

```tsx
  if (wide) {
    return (
      <Page title={en('mind_title')} alt={lang === 'en' ? undefined : t('mind_title')} right={<TopBarActions />} wide>
        {crisisCard}
        <Cols weights={[1.1, 1]}>
          <>
            {checkIn}
            {toolTiles}
            {toolPanel}
          </>
          <>
            {entries}
            <CravingSOS />
            <Reframe onCrisis={() => setCrisis(true)} />
          </>
        </Cols>
      </Page>
    );
  }

  return (
    <Page title={en('mind_title')} alt={lang === 'en' ? undefined : t('mind_title')} right={<TopBarActions />}>
      {crisisCard}
      {checkIn}
      {toolTiles}
      {toolPanel}
      <CravingSOS />
      <Reframe onCrisis={() => setCrisis(true)} />
      {entries}
    </Page>
  );
```

- [ ] **Step 3: Typecheck and look**

Run: `npx tsc --noEmit && grep -n "😞\|🙂\|😄" "src/app/(tabs)/mind.tsx"`
Expected: clean, grep prints nothing.

Seeded browser, 375 px, Mind: five line-drawn faces, the selected one blue; three tool tiles with icons; today's entries with small faces. 1440 px: check-in and tools left, entries, craving and reframe right.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Face.tsx "src/app/(tabs)/mind.tsx"
git commit -m "Mind: drawn mood faces, tool tiles, two desktop columns

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Coach — a right rail on desktop, a first line when the chat is empty

**Files:**
- Modify: `src/app/(tabs)/coach.tsx`

**Interfaces:**
- Consumes: `TopBar`, `TopBarActions`, `IconButton` (Task 7), `useBreakpoint`, `formatMinutes`.

- [ ] **Step 1: The rail and the empty line**

In `src/app/(tabs)/coach.tsx`:

- Imports: add `import { formatMinutes } from '../../core/date';`, add `Card, Micro, Row, Small, Divider` to the components import if missing.
- After `const scroller = useRef<ScrollView>(null);` add:

```tsx
  const lastSleep = [...app.state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const lastOptions = [...app.state.chat].reverse().find((m) => m.role === 'assistant' && m.options && m.options.length > 0)?.options ?? [];

  const rail = (
    <View style={{ width: 300, gap: 14, paddingVertical: S.pad, paddingRight: S.gutterWide }}>
      <Card>
        <Micro>{t('todays_numbers')}</Micro>
        <Stat label={t('kcal_left')} value={String(Math.max(0, app.budget.remaining))} />
        <Stat label={t('protein')} value={`${app.budget.proteinConsumed} / ${app.budget.proteinTarget} g`} />
        <Stat label={t('water')} value={`${app.waterToday} / ${app.state.settings.waterGoalMl} ml`} />
        <Stat label={t('sleep_title')} value={lastSleep ? `${formatMinutes(lastSleep.minutes)} · ${lastSleep.score}` : '--'} />
        <Divider />
        <Pressable onPress={() => router.push('/memory')}>
          <Small color={C.accent}>{`${app.state.memory.length} ${en('mem_fact')} ›`}</Small>
        </Pressable>
      </Card>
      {lastOptions.length > 0 ? (
        <Card>
          <Micro>{t('offered')}</Micro>
          {lastOptions.map((o) => (
            <Pressable key={o.foodId} onPress={() => logOption(o)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                <BiText en={o.name_en} alt={lang === 'en' ? undefined : o.name_mr} size={F.small} />
                <Small>{`${o.kcal} kcal`}</Small>
              </Row>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
```

and at the bottom of the file:

```tsx
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Micro>{label}</Micro>
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{value}</Text>
    </Row>
  );
}
```

- Wrap the existing `<ScrollView …>` and the input bar in a column, and put the rail beside that column on desktop. The outer return becomes:

```tsx
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar … (from Task 7, unchanged) />
      <View style={{ flex: 1, flexDirection: 'row', maxWidth: S.maxWide, width: '100%', alignSelf: 'center' }}>
        <View style={{ flex: 1 }}>
          <ScrollView … existing … />
          <View … existing input bar … />
        </View>
        {wide ? rail : null}
      </View>
    </View>
  );
```

- In the empty state (`app.state.chat.length === 0`), render `<Small color={C.textDim}>{t('no_chat_yet')}</Small>` above the quick-question pills.

- [ ] **Step 2: Typecheck and look**

Run: `npx tsc --noEmit && echo OK`

Seeded browser, 1440 px, Coach: the chat in the centre with a 300 px rail on the right showing calories left, protein, water, last night's sleep, the memory link and the three offered foods; clicking an offered food logs it and goes to Today. 375 px: no rail; with an empty chat the line "जेवण, हालचाल किंवा…" sits above the four pills.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tabs)/coach.tsx"
git commit -m "Coach: desktop rail with today's numbers and offered foods, a first line for an empty chat

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Loose ends and the full sweep

**Files:**
- Modify: `src/app/(tabs)/_layout.tsx` (Skeleton while loading)
- Modify: `README.md` (status paragraph)

- [ ] **Step 1: Skeleton instead of a spinner**

In `src/app/(tabs)/_layout.tsx` add `import { Skeleton } from '../../ui/tiles';` and replace the `!ready` branch with:

```tsx
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
```

Remove the `ActivityIndicator` import if now unused.

- [ ] **Step 2: Everything green**

Run: `npx tsc --noEmit && npx expo lint 2>&1 | tail -3 && npm test 2>&1 | tail -4`
Expected: no type errors, no new lint warnings beyond the Task 0 count, `16 test files passed`.

- [ ] **Step 3: The walk-through**

Start the server if needed (`npx expo start --web --port 8082`), seed, and walk every screen at 375 px and at 1440 px, in Marathi and then in English (`LANG_OVERRIDE=en npm run seed`). Tick each:

- Today: single top bar; hero ring fills; water pace tick; decision checklist persists a tick across reload; Now strip scrolls; day score shows `·` on movement before 18:00 and a lever sentence; meals open in a sheet; `‹` shows yesterday, `›` disabled at today.
- Log via "+": recent row, same-as-yesterday, sticky Save bar; desktop two panes.
- Growth: axes on charts; week summary and patterns present; desktop grid.
- Move: phase line and bar; translated chips; desktop two columns with history.
- Mind: drawn faces; tiles; desktop columns.
- Coach: back chevron on phone; rail on desktop.
- Tab bar: five slots, raised "+", Devanagari labels unclipped.
- Sidebar: break ring, glasses, AI dot at the bottom.
- Toasts on: +1 glass, meal saved, session saved (run a session: Move → Start → Finish → Save), break done (set `workMinutes` to 1 as in Task 6).
- Nothing in English when Marathi is selected except food names shown as `BiText` pairs and the kcal unit.

Anything that fails goes back to its task; do not patch it here without the task's test.

- [ ] **Step 4: README status**

In `README.md` replace the `## Status` paragraph's first sentence with: `v0.4 part 1. Working: everything in v0.3, plus one compact top bar per tab, a five-slot phone tab bar with a centre "+", a Today screen with a hero ring, decision checklist, Now strip and day score, tappable and editable meals with a yesterday view, desktop layouts for every tab, local-time clocks, and toasts on every save.` Keep the rest.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/_layout.tsx" README.md
git commit -m "Skeleton while the store loads; README status for v0.4 part 1

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Part 1 is complete when Task 16's sweep passes. Hand over with the `superpowers:finishing-a-development-branch` skill.
