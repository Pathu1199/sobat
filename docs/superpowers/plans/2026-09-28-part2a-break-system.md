# Part 2A — Break System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sobat's single fixed break timer with a four-kind break system in the LookAway class: micro, long, posture and blink, with strictness modes, a daily skip budget, smart pause, a work schedule, a rebuilt overlay, and the Windows shell pieces that make it behave on a real PC.

**Architecture:** All scheduling rules become pure functions in `src/core/breaks.ts` driven by one `BreakContext`, so every rule is unit tested without a timer or a window. The existing `useBreakClock` inside `src/services/useBreakMonitor.tsx` becomes a thin loop that builds that context once a second and reacts to what `nextDue` and `isPaused` return. The overlay and the pre-break toast read the monitor through the context that already exists. Windows-specific facts (system idle, foreground app, fullscreen, on-call) stay behind `src/services/platform.ts`, which returns null off the shell so the browser and Android builds keep working unchanged.

**Tech Stack:** Expo SDK 57, expo-router 57, React Native 0.86, react-native-web 0.21, react-native-svg 15, expo-haptics 57, vitest 4, TypeScript 6, Tauri 2 (written here, compiled on the user's Windows PC).

## Global Constraints

- Colours only from `src/ui/theme.ts`; no hex or rgba literals in screens or components. `C.scrim` is the only translucent token.
- No React in `src/core`. Every new branch there has a vitest test.
- Every user-visible string goes through `makeT(lang)`, present in all three dictionaries (`en`, `mr`, `hi`) in `src/i18n/index.ts`.
- Animations use React Native's built-in `Animated` and honour `useReducedMotion()` from `src/ui/animated.ts`.
- Phone below 760 px, desktop at 1080 px and above, via `useBreakpoint()`.
- `npx tsc --noEmit` clean and `npm test` green before any task is finished. `npx expo lint` must not rise above **66 problems**; `eslint-disable` is not an acceptable way to hold that number. If the React Compiler rule objects, extract the expression into a `useMemo` beside its inputs.
- Tests run with `TZ=Asia/Kolkata` pinned by `vitest.config.mts`.
- Commit after every task on branch `part2-companion`, message ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **This repository is local only.** Never add a git remote, never push, never open a pull request.
- The user runs the app in Marathi. Any screen you change must be checked in Marathi, not only English.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/core/breaks.ts` | All break scheduling rules as pure functions. Rewritten, not extended. |
| `src/core/__tests__/breaks.test.ts` | Tests for every rule. Rewritten alongside. |
| `src/core/types.ts` | `AppState.version` 2, `BreakLog` gains `kind` and `seconds`. |
| `src/store/defaults.ts` | New `DEFAULT_BREAK_SETTINGS` shape. |
| `src/store/migrate.ts` | **New.** One pure function that upgrades a stored v1 state to v2. |
| `src/core/__tests__/migrate.test.ts` | **New.** Tests the migration against a realistic v1 blob. |
| `src/store/AppProvider.tsx` | Runs the migration on load; `logBreak` takes a kind and seconds. |
| `src/services/useBreakMonitor.tsx` | The one-second loop, now driven by `nextDue`/`isPaused`. |
| `src/services/platform.ts` | Adds `foregroundState()` and `pauseBreaksFor()`. |
| `src/components/BreakOverlay.tsx` | Rewritten: breathing ring, per-kind copy, long-break mobility moves. |
| `src/components/BreakToast.tsx` | **New.** The pre-break warning and the posture/blink nudges. |
| `src/components/BreakPanel.tsx` | Shows the next kind, and gains pause and take-now buttons. |
| `src/app/settings.tsx` | The Breaks group, rebuilt for four kinds and the new options. |
| `src/i18n/index.ts` | New keys in all three languages. |
| `desktop/src-tauri/src/main.rs` | `foreground_state`, global shortcuts, tray additions. |
| `desktop/src-tauri/Cargo.toml` | The global-shortcut plugin. |

---

### Task 1: The break settings shape, and a migration that cannot lose data

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/breaks.ts` (types and defaults only; the rules come in Task 2)
- Create: `src/store/migrate.ts`
- Create: `src/core/__tests__/migrate.test.ts`
- Modify: `src/store/defaults.ts`
- Modify: `src/store/AppProvider.tsx`

**Interfaces:**
- Produces: `BreakKind = 'micro' | 'long' | 'posture' | 'blink'`; `Strictness = 'gentle' | 'normal' | 'strict'`; the new `BreakSettings`; `DEFAULT_BREAK_SETTINGS`; `BreakLog` with `kind: BreakKind` and `seconds: number`; `migrateState(raw: unknown): AppState` in `src/store/migrate.ts`.
- Consumed by every later task.

- [ ] **Step 1: Write the failing migration test**

Create `src/core/__tests__/migrate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { migrateState } from '../../store/migrate';
import { EMPTY_STATE } from '../../store/defaults';

// A realistic v1 blob: the shape the app has been writing until now.
const v1 = {
  version: 1,
  profile: { name: 'Varad', sex: 'male', birthYear: 1998, heightCm: 172, weightKg: 98.7, activity: 'sedentary', goalWeightKg: 80, rateKgPerWeek: 0.5, lang: 'mr', onboarded: true },
  settings: { ollamaUrl: 'http://192.168.1.10:11434', ollamaFallbackUrl: '', textModel: 'qwen3:8b', visionModel: 'qwen2.5vl:7b', nudgeMinutes: 30, nudgesEnabled: true, quietStartHour: 22, quietEndHour: 7, waterGoalMl: 3000, glassMl: 250 },
  meals: [{ id: 'm1', at: '2026-09-26T03:10:00.000Z', date: '2026-09-26', type: 'breakfast', items: [], kcal: 300, protein: 6 }],
  water: [], weights: [], sleep: [], moods: [], workouts: [], nudges: [], chat: [], customFoods: [], memory: [], usage: [],
  breaks: [
    { id: 'b1', date: '2026-09-26', at: '2026-09-26T09:20:00.000Z', action: 'taken', workedMinutes: 20 },
    { id: 'b2', date: '2026-09-26', at: '2026-09-26T10:20:00.000Z', action: 'skipped', workedMinutes: 20 },
  ],
  breakSettings: { enabled: true, workMinutes: 20, breakSeconds: 60, allowSkip: true, quietStartHour: 22, quietEndHour: 7 },
  tips: [], photoQueue: [], steps: [], actionsDone: [],
};

describe('migrateState', () => {
  it('carries the old interval and length into the micro break', () => {
    const s = migrateState({ ...v1, breakSettings: { ...v1.breakSettings, workMinutes: 30, breakSeconds: 45 } });
    expect(s.breakSettings.micro.everyMinutes).toBe(30);
    expect(s.breakSettings.micro.seconds).toBe(45);
    expect(s.breakSettings.enabled).toBe(true);
  });

  it('maps the old allowSkip onto a strictness', () => {
    expect(migrateState(v1).breakSettings.strictness).toBe('normal');
    expect(migrateState({ ...v1, breakSettings: { ...v1.breakSettings, allowSkip: false } }).breakSettings.strictness).toBe('strict');
  });

  it('stamps old break logs as micro breaks with the old length', () => {
    const s = migrateState(v1);
    expect(s.breaks).toHaveLength(2);
    expect(s.breaks[0].kind).toBe('micro');
    expect(s.breaks[0].seconds).toBe(60);
    // Everything the old log carried survives.
    expect(s.breaks[1].action).toBe('skipped');
    expect(s.breaks[1].workedMinutes).toBe(20);
  });

  it('keeps every other slice untouched', () => {
    const s = migrateState(v1);
    expect(s.meals).toHaveLength(1);
    expect(s.meals[0].kcal).toBe(300);
    expect(s.profile.name).toBe('Varad');
    expect(s.settings.waterGoalMl).toBe(3000);
  });

  it('marks the result as version 2 and is idempotent', () => {
    const once = migrateState(v1);
    expect(once.version).toBe(2);
    const twice = migrateState(once);
    expect(twice).toEqual(once);
  });

  it('fills defaults for a blob with no break settings at all', () => {
    const s = migrateState({ ...v1, breakSettings: undefined });
    expect(s.breakSettings.micro.everyMinutes).toBe(20);
    expect(s.breakSettings.long.everyMinutes).toBe(60);
  });

  it('returns a fresh state for junk input rather than throwing', () => {
    expect(migrateState(null).version).toBe(EMPTY_STATE.version);
    expect(migrateState('nonsense').profile.onboarded).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/__tests__/migrate.test.ts`
Expected: FAIL, `Failed to resolve import "../../store/migrate"`.

- [ ] **Step 3: The new types**

In `src/core/breaks.ts`, replace the `BreakSettings` type, `DEFAULT_BREAK_SETTINGS` and the `BreakLog` type with:

```ts
export type BreakKind = 'micro' | 'long' | 'posture' | 'blink';

/** How hard the app is allowed to insist. */
export type Strictness = 'gentle' | 'normal' | 'strict';

export type KindSettings = { enabled: boolean; everyMinutes: number; seconds: number };

export type BreakSettings = {
  enabled: boolean;
  micro: KindSettings;
  long: KindSettings;
  posture: KindSettings;
  blink: KindSettings;
  strictness: Strictness;
  maxSkipsPerDay: number;
  snoozeMinutes: number[];
  smartPause: { whenFullscreen: boolean; whenOnCall: boolean; apps: string[] };
  schedule: { days: number[]; startHour: number; endHour: number } | null;
  quietStartHour: number;
  quietEndHour: number;
  sound: boolean;
  /** Epoch ms until which every break is held. Null when not paused. */
  pausedUntilMs: number | null;
};

export const DEFAULT_BREAK_SETTINGS: BreakSettings = {
  enabled: true,
  // 20-20-20: every twenty minutes, look twenty feet away for twenty seconds.
  micro: { enabled: true, everyMinutes: 20, seconds: 20 },
  long: { enabled: true, everyMinutes: 60, seconds: 180 },
  posture: { enabled: true, everyMinutes: 30, seconds: 6 },
  // Off by default: a blink prompt every ten minutes is a lot to ask for.
  blink: { enabled: false, everyMinutes: 10, seconds: 3 },
  strictness: 'normal',
  maxSkipsPerDay: 3,
  snoozeMinutes: [1, 5, 15],
  smartPause: { whenFullscreen: true, whenOnCall: true, apps: [] },
  schedule: null,
  quietStartHour: 22,
  quietEndHour: 7,
  sound: true,
  pausedUntilMs: null,
};

export type BreakLog = {
  id: string;
  date: string;
  at: string;
  kind: BreakKind;
  action: 'taken' | 'skipped';
  workedMinutes: number;
  seconds: number;
};
```

Leave the rest of the file alone for now; Task 2 rewrites the rules. The file will not typecheck until Step 5.

- [ ] **Step 4: Bump the state version**

In `src/core/types.ts`, change the `AppState` doc so `version` is documented as 2, by replacing the line `  version: number;` with:

```ts
  /** 1 = the original single-timer break settings. 2 = four break kinds. */
  version: number;
```

In `src/store/defaults.ts`, change `version: 1,` to `version: 2,`.

- [ ] **Step 5: The migration**

Create `src/store/migrate.ts`:

```ts
import { DEFAULT_BREAK_SETTINGS, type BreakLog, type BreakSettings } from '../core/breaks';
import type { AppState } from '../core/types';
import { EMPTY_STATE } from './defaults';

/** The shape break settings had in version 1. */
type V1BreakSettings = {
  enabled?: boolean;
  workMinutes?: number;
  breakSeconds?: number;
  allowSkip?: boolean;
  quietStartHour?: number;
  quietEndHour?: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** True once the settings carry the four-kind shape. */
function isV2Settings(v: unknown): v is BreakSettings {
  return isRecord(v) && isRecord(v.micro) && isRecord(v.long);
}

function upgradeSettings(old: unknown): BreakSettings {
  if (isV2Settings(old)) {
    // Already migrated; fill any key a newer default added.
    return { ...DEFAULT_BREAK_SETTINGS, ...old };
  }
  const v1 = (isRecord(old) ? old : {}) as V1BreakSettings;
  return {
    ...DEFAULT_BREAK_SETTINGS,
    enabled: v1.enabled ?? DEFAULT_BREAK_SETTINGS.enabled,
    // The one timer the person had configured becomes the micro break.
    micro: {
      ...DEFAULT_BREAK_SETTINGS.micro,
      everyMinutes: v1.workMinutes ?? DEFAULT_BREAK_SETTINGS.micro.everyMinutes,
      seconds: v1.breakSeconds ?? DEFAULT_BREAK_SETTINGS.micro.seconds,
    },
    // "Skipping not allowed" was the old way of saying strict.
    strictness: v1.allowSkip === false ? 'strict' : 'normal',
    quietStartHour: v1.quietStartHour ?? DEFAULT_BREAK_SETTINGS.quietStartHour,
    quietEndHour: v1.quietEndHour ?? DEFAULT_BREAK_SETTINGS.quietEndHour,
  };
}

function upgradeLogs(old: unknown, microSeconds: number): BreakLog[] {
  if (!Array.isArray(old)) return [];
  return old.map((raw) => {
    const l = (isRecord(raw) ? raw : {}) as Partial<BreakLog> & { workedMinutes?: number };
    return {
      id: String(l.id ?? Date.now()),
      date: String(l.date ?? ''),
      at: String(l.at ?? ''),
      // Every break logged before this version was the single timer, i.e. micro.
      kind: l.kind ?? 'micro',
      action: l.action === 'skipped' ? 'skipped' : 'taken',
      workedMinutes: Number(l.workedMinutes ?? 0),
      seconds: Number(l.seconds ?? microSeconds),
    };
  });
}

/**
 * Brings a stored blob up to the current shape. Never throws: a corrupt or
 * foreign file yields a fresh state rather than bricking the app.
 */
export function migrateState(raw: unknown): AppState {
  if (!isRecord(raw) || !isRecord(raw.profile)) return { ...EMPTY_STATE };
  const breakSettings = upgradeSettings(raw.breakSettings);
  return {
    ...EMPTY_STATE,
    ...(raw as Partial<AppState>),
    version: 2,
    profile: { ...EMPTY_STATE.profile, ...(raw.profile as object) },
    settings: { ...EMPTY_STATE.settings, ...(isRecord(raw.settings) ? raw.settings : {}) },
    breakSettings,
    breaks: upgradeLogs(raw.breaks, breakSettings.micro.seconds),
  };
}
```

- [ ] **Step 6: Run the migration tests**

Run: `npx vitest run src/core/__tests__/migrate.test.ts`
Expected: 7 passed.

- [ ] **Step 7: Use it on load and on import**

In `src/store/AppProvider.tsx`, add `import { migrateState } from './migrate';` and replace the body of the load effect's `if (raw)` branch so the parsed blob goes through the migration:

```ts
        if (raw) {
          setState(migrateState(JSON.parse(raw)));
        }
```

In the same file, `importState` does its own merge. Replace the `setState({...})` call inside it with:

```ts
          setState(migrateState(parsed));
```

keeping the shape check above it exactly as it is.

Then update `logBreak`. Its signature in the `Ctx` type becomes:

```ts
  logBreak: (kind: BreakKind, action: 'taken' | 'skipped', workedMinutes: number, seconds: number) => void;
```

with `BreakKind` added to the `../core/breaks` import, and its implementation becomes:

```ts
      logBreak: (kind, action, workedMinutes, seconds) =>
        update((s) => ({
          ...s,
          breaks: [...s.breaks.slice(-500), { id: String(Date.now()), date: toISODate(), at: new Date().toISOString(), kind, action, workedMinutes, seconds }],
        })),
```

- [ ] **Step 8: Typecheck will fail, and that is expected**

Run: `npx tsc --noEmit`
Expected: errors in `src/core/breaks.ts`, `src/services/useBreakMonitor.tsx`, `src/components/BreakPanel.tsx` and `src/app/settings.tsx`, all about the removed `workMinutes`/`breakSeconds`/`allowSkip` fields and the changed `logBreak`. Do not fix them here; Tasks 2 and 3 replace that code. Record the error list in your report.

To keep the tree compiling between tasks, make these three holding edits, each marked so the later task can find it:

In `src/services/useBreakMonitor.tsx`, replace `const settings = app.state.breakSettings;` with:

```ts
  // Task 2 replaces this loop wholesale. Until then, drive it from the micro
  // break so the app keeps running.
  const settings = app.state.breakSettings;
  const workMinutes = settings.micro.everyMinutes;
  const breakSeconds = settings.micro.seconds;
  const allowSkip = settings.strictness !== 'strict';
```

and inside the file replace every `settings.workMinutes` with `workMinutes`, every `settings.breakSeconds` with `breakSeconds`, and every `settings.allowSkip` with `allowSkip`. The `ctx` object passed to the core functions needs `settings: { ...settings, workMinutes, breakSeconds, allowSkip }` — but since Task 2 rewrites those functions, instead change the four call sites (`minutesUntilBreak`, `shouldStartBreak`, `resetPointFor`, `workedMinutes`) to pass a locally built object:

```ts
      const ctx = { nowMs: now, workingSinceMs: workingSince.current, idleSeconds, hour, settings: { enabled: settings.enabled, workMinutes, breakSeconds, allowSkip, quietStartHour: settings.quietStartHour, quietEndHour: settings.quietEndHour } };
```

and in `endBreak` change the `app.logBreak(action, worked)` call to `app.logBreak('micro', action, worked, breakSeconds)`.

In `src/core/breaks.ts`, the old rule functions reference the old settings type. Give them a local type so they still compile:

```ts
/** The shape the old single-timer rules below still expect. Task 2 removes them. */
type LegacySettings = { enabled: boolean; workMinutes: number; breakSeconds: number; allowSkip: boolean; quietStartHour: number; quietEndHour: number };
```

and change `BreakContext`'s `settings: BreakSettings` to `settings: LegacySettings`.

In `src/components/BreakPanel.tsx` and `src/app/settings.tsx`, replace each `br.workMinutes` with `br.micro.everyMinutes`, each `br.breakSeconds` with `br.micro.seconds`, and each `br.allowSkip` with `(br.strictness !== 'strict')`. In `settings.tsx` the two pill rows that set those values become `app.setBreakSettings({ micro: { ...br.micro, everyMinutes: m } })` and `app.setBreakSettings({ micro: { ...br.micro, seconds: sec } })`, and the allow-skip toggle becomes `app.setBreakSettings({ strictness: br.strictness === 'strict' ? 'normal' : 'strict' })`. Task 5 rebuilds this group properly.

Also update `breakStats` in `src/core/breaks.ts` to keep compiling: it reads only `action` and `workedMinutes`, both still present, so no change is needed. Confirm that.

- [ ] **Step 9: Everything green**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3 && npx expo lint 2>&1 | grep problems`
Expected: no type errors, all test files passing (one more file than before), `66 problems` or fewer.

- [ ] **Step 10: Check the app still runs**

The controller will do the browser check. Report that you skipped it.

- [ ] **Step 11: Commit**

```bash
git add src/core/types.ts src/core/breaks.ts src/store/migrate.ts src/core/__tests__/migrate.test.ts src/store/defaults.ts src/store/AppProvider.tsx src/services/useBreakMonitor.tsx src/components/BreakPanel.tsx src/app/settings.tsx
git commit -m "Four break kinds in the settings shape, with a migration that keeps old logs

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The scheduling rules

Everything the system decides lives here as pure functions over one context object. The old single-timer rules are deleted in the same commit, so there is exactly one set of rules in the codebase.

**Files:**
- Modify: `src/core/breaks.ts` (the rules; the types from Task 1 stay)
- Modify: `src/core/__tests__/breaks.test.ts` (rewritten)

**Interfaces:**
- Consumes: `BreakKind`, `Strictness`, `BreakSettings`, `BreakLog`, `DEFAULT_BREAK_SETTINGS` from Task 1.
- Produces:
  - `type BreakClocks = Record<BreakKind, number>` — epoch ms when each kind's clock last restarted.
  - `type BreakContext = { nowMs: number; clocks: BreakClocks; idleSeconds: number; hour: number; weekday: number; settings: BreakSettings; foreground: ForegroundState | null; logsToday: BreakLog[] }`
  - `type ForegroundState = { fullscreen: boolean; exe: string; onCall: boolean }`
  - `type Due = { kind: BreakKind; inSeconds: number }`
  - `nextDue(ctx: BreakContext): Due | null`
  - `isPaused(ctx: BreakContext): boolean`
  - `takesScreen(kind: BreakKind): boolean`
  - `clocksAfter(kind: BreakKind, clocks: BreakClocks, nowMs: number): BreakClocks`
  - `clocksAfterIdle(ctx: BreakContext): BreakClocks | null`
  - `canSkip(logsToday: BreakLog[], settings: BreakSettings): boolean`
  - `skipsLeft(logsToday: BreakLog[], settings: BreakSettings): number`
  - `breakStats(logs: BreakLog[]): BreakStats` with `BreakStats = { taken: number; skipped: number; compliancePct: number; longestStretchMinutes: number; byKind: Record<BreakKind, { taken: number; offered: number }>; eyeCareScore: number }`
  - `suggestLongerInterval(logs: BreakLog[], kind: BreakKind, current: number): number | null`
  - `IDLE_RESETS_SHORT_SECONDS = 180`, `IDLE_RESETS_LONG_SECONDS = 300`
  - `inQuiet(hour, start, end)` stays exactly as it is today.

- [ ] **Step 1: Write the failing tests**

Replace `src/core/__tests__/breaks.test.ts` in full:

```ts
import { describe, expect, it } from 'vitest';
import {
  breakStats,
  canSkip,
  clocksAfter,
  clocksAfterIdle,
  DEFAULT_BREAK_SETTINGS,
  inQuiet,
  isPaused,
  nextDue,
  skipsLeft,
  suggestLongerInterval,
  takesScreen,
  type BreakClocks,
  type BreakContext,
  type BreakLog,
  type BreakSettings,
} from '../breaks';

const T0 = new Date('2026-09-28T10:00:00+05:30').getTime();
const MIN = 60_000;

function clocks(at: number = T0): BreakClocks {
  return { micro: at, long: at, posture: at, blink: at };
}

function ctx(over: Partial<BreakContext> = {}): BreakContext {
  return {
    nowMs: T0,
    clocks: clocks(T0),
    idleSeconds: 0,
    hour: 10,
    weekday: 1,
    settings: DEFAULT_BREAK_SETTINGS,
    foreground: null,
    logsToday: [],
    ...over,
  };
}

function settings(over: Partial<BreakSettings> = {}): BreakSettings {
  return { ...DEFAULT_BREAK_SETTINGS, ...over };
}

describe('nextDue', () => {
  it('counts down to the soonest enabled kind', () => {
    // Nothing elapsed: posture is every 30, micro every 20, blink off.
    const d = nextDue(ctx())!;
    expect(d.kind).toBe('micro');
    expect(d.inSeconds).toBe(20 * 60);
  });

  it('reports a kind as due when its interval has elapsed', () => {
    const d = nextDue(ctx({ nowMs: T0 + 20 * MIN }))!;
    expect(d.kind).toBe('micro');
    expect(d.inSeconds).toBe(0);
  });

  it('prefers the long break when both are due at the same moment', () => {
    // At 60 minutes micro (3rd) and long (1st) both come due; the long one wins.
    const d = nextDue(ctx({ nowMs: T0 + 60 * MIN, clocks: clocks(T0) }))!;
    expect(d.kind).toBe('long');
  });

  it('skips a kind that is switched off', () => {
    const d = nextDue(ctx({ settings: settings({ micro: { ...DEFAULT_BREAK_SETTINGS.micro, enabled: false } }) }))!;
    // Posture at 30 minutes is now the soonest.
    expect(d.kind).toBe('posture');
    expect(d.inSeconds).toBe(30 * 60);
  });

  it('includes blink only when it has been switched on', () => {
    const on = settings({ blink: { ...DEFAULT_BREAK_SETTINGS.blink, enabled: true } });
    expect(nextDue(ctx({ settings: on }))!.kind).toBe('blink');
    expect(nextDue(ctx())!.kind).toBe('micro');
  });

  it('returns null when the monitor is off entirely', () => {
    expect(nextDue(ctx({ settings: settings({ enabled: false }) }))).toBeNull();
  });
});

describe('isPaused', () => {
  it('holds everything until the pause expires', () => {
    const paused = settings({ pausedUntilMs: T0 + 30 * MIN });
    expect(isPaused(ctx({ settings: paused }))).toBe(true);
    expect(isPaused(ctx({ nowMs: T0 + 31 * MIN, settings: paused }))).toBe(false);
  });

  it('respects quiet hours across midnight', () => {
    expect(isPaused(ctx({ hour: 23 }))).toBe(true);
    expect(isPaused(ctx({ hour: 3 }))).toBe(true);
    expect(isPaused(ctx({ hour: 10 }))).toBe(false);
  });

  it('holds outside the working schedule when one is set', () => {
    // Monday to Friday, 9 to 18.
    const s = settings({ schedule: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 } });
    expect(isPaused(ctx({ settings: s, weekday: 1, hour: 10 }))).toBe(false);
    expect(isPaused(ctx({ settings: s, weekday: 1, hour: 19 }))).toBe(true);
    expect(isPaused(ctx({ settings: s, weekday: 0, hour: 10 }))).toBe(true);
  });

  it('holds during fullscreen and calls when smart pause asks it to', () => {
    const fg = { fullscreen: true, exe: 'vlc.exe', onCall: false };
    expect(isPaused(ctx({ foreground: fg }))).toBe(true);
    expect(isPaused(ctx({ foreground: { ...fg, fullscreen: false } }))).toBe(false);
    expect(isPaused(ctx({ foreground: { fullscreen: false, exe: 'zoom.exe', onCall: true } }))).toBe(true);
  });

  it('ignores fullscreen and calls when smart pause is switched off', () => {
    const s = settings({ smartPause: { whenFullscreen: false, whenOnCall: false, apps: [] } });
    expect(isPaused(ctx({ settings: s, foreground: { fullscreen: true, exe: 'vlc.exe', onCall: true } }))).toBe(false);
  });

  it('holds while a named app is in front, case-insensitively', () => {
    const s = settings({ smartPause: { whenFullscreen: false, whenOnCall: false, apps: ['Photoshop.exe'] } });
    expect(isPaused(ctx({ settings: s, foreground: { fullscreen: false, exe: 'photoshop.exe', onCall: false } }))).toBe(true);
    expect(isPaused(ctx({ settings: s, foreground: { fullscreen: false, exe: 'code.exe', onCall: false } }))).toBe(false);
  });

  it('is never paused by a foreground state the platform could not read', () => {
    expect(isPaused(ctx({ foreground: null }))).toBe(false);
  });
});

describe('takesScreen', () => {
  it('is true only for the kinds that blank the screen', () => {
    expect(takesScreen('micro')).toBe(true);
    expect(takesScreen('long')).toBe(true);
    expect(takesScreen('posture')).toBe(false);
    expect(takesScreen('blink')).toBe(false);
  });
});

describe('clocksAfter', () => {
  it('restarts only its own clock for a micro break', () => {
    const next = clocksAfter('micro', clocks(T0), T0 + 20 * MIN);
    expect(next.micro).toBe(T0 + 20 * MIN);
    expect(next.long).toBe(T0);
  });

  it('restarts micro and posture as well after a long break', () => {
    // A three-minute pause has already rested the eyes and the back.
    const next = clocksAfter('long', clocks(T0), T0 + 60 * MIN);
    expect(next.long).toBe(T0 + 60 * MIN);
    expect(next.micro).toBe(T0 + 60 * MIN);
    expect(next.posture).toBe(T0 + 60 * MIN);
    expect(next.blink).toBe(T0);
  });
});

describe('clocksAfterIdle', () => {
  it('does nothing while the person is at the desk', () => {
    expect(clocksAfterIdle(ctx({ idleSeconds: 30 }))).toBeNull();
  });

  it('restarts the short clocks after three minutes away', () => {
    const next = clocksAfterIdle(ctx({ idleSeconds: 180, nowMs: T0 + 5 * MIN }))!;
    expect(next.micro).toBe(T0 + 5 * MIN);
    expect(next.posture).toBe(T0 + 5 * MIN);
    expect(next.long).toBe(T0);
  });

  it('restarts the long clock too after five minutes away', () => {
    const next = clocksAfterIdle(ctx({ idleSeconds: 300, nowMs: T0 + 9 * MIN }))!;
    expect(next.long).toBe(T0 + 9 * MIN);
    expect(next.micro).toBe(T0 + 9 * MIN);
  });
});

describe('canSkip and skipsLeft', () => {
  const skip = (n: number): BreakLog[] =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), date: '2026-09-28', at: '', kind: 'micro' as const, action: 'skipped' as const, workedMinutes: 20, seconds: 20 }));

  it('always allows skipping in gentle mode', () => {
    const s = settings({ strictness: 'gentle' });
    expect(canSkip(skip(99), s)).toBe(true);
    expect(skipsLeft(skip(99), s)).toBe(Infinity);
  });

  it('never allows skipping in strict mode', () => {
    const s = settings({ strictness: 'strict' });
    expect(canSkip([], s)).toBe(false);
    expect(skipsLeft([], s)).toBe(0);
  });

  it('spends a daily budget in normal mode', () => {
    const s = settings({ strictness: 'normal', maxSkipsPerDay: 3 });
    expect(skipsLeft(skip(0), s)).toBe(3);
    expect(canSkip(skip(2), s)).toBe(true);
    expect(skipsLeft(skip(2), s)).toBe(1);
    expect(canSkip(skip(3), s)).toBe(false);
    expect(skipsLeft(skip(3), s)).toBe(0);
  });

  it('counts only skips, not taken breaks', () => {
    const s = settings({ strictness: 'normal', maxSkipsPerDay: 1 });
    const taken: BreakLog[] = [{ id: 't', date: '2026-09-28', at: '', kind: 'micro', action: 'taken', workedMinutes: 20, seconds: 20 }];
    expect(canSkip(taken, s)).toBe(true);
  });
});

describe('breakStats', () => {
  const log = (kind: BreakLog['kind'], action: BreakLog['action'], workedMinutes = 20): BreakLog => ({
    id: Math.random().toString(), date: '2026-09-28', at: '', kind, action, workedMinutes, seconds: 20,
  });

  it('reports totals and per-kind counts', () => {
    const s = breakStats([log('micro', 'taken'), log('micro', 'skipped'), log('long', 'taken')]);
    expect(s.taken).toBe(2);
    expect(s.skipped).toBe(1);
    expect(s.compliancePct).toBe(67);
    expect(s.byKind.micro).toEqual({ taken: 1, offered: 2 });
    expect(s.byKind.long).toEqual({ taken: 1, offered: 1 });
    expect(s.byKind.blink).toEqual({ taken: 0, offered: 0 });
  });

  it('weights a long break twice as heavily in the eye-care score', () => {
    // One micro taken of one offered, one long skipped of one offered:
    // weighted taken 1, weighted offered 3 → 33.
    const s = breakStats([log('micro', 'taken'), log('long', 'skipped')]);
    expect(s.eyeCareScore).toBe(33);
    // The mirror image scores far better.
    expect(breakStats([log('micro', 'skipped'), log('long', 'taken')]).eyeCareScore).toBe(67);
  });

  it('is zero, not NaN, with nothing logged', () => {
    const s = breakStats([]);
    expect(s.compliancePct).toBe(0);
    expect(s.eyeCareScore).toBe(0);
    expect(s.longestStretchMinutes).toBe(0);
  });

  it('reports the longest stretch worked', () => {
    expect(breakStats([log('micro', 'taken', 22), log('micro', 'taken', 47)]).longestStretchMinutes).toBe(47);
  });
});

describe('suggestLongerInterval', () => {
  const skipped = (kind: BreakLog['kind'], n: number): BreakLog[] =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), date: '2026-09-28', at: '', kind, action: 'skipped' as const, workedMinutes: 20, seconds: 20 }));

  it('suggests a longer gap after five skips of that kind in a row', () => {
    expect(suggestLongerInterval(skipped('micro', 5), 'micro', 20)).toBe(35);
  });

  it('ignores skips of a different kind', () => {
    expect(suggestLongerInterval(skipped('long', 5), 'micro', 20)).toBeNull();
  });

  it('says nothing until there are five', () => {
    expect(suggestLongerInterval(skipped('micro', 4), 'micro', 20)).toBeNull();
  });

  it('stops suggesting once the gap is already long', () => {
    expect(suggestLongerInterval(skipped('micro', 5), 'micro', 90)).toBeNull();
  });

  it('resets once a break of that kind is taken', () => {
    const logs = [...skipped('micro', 5), { id: 'x', date: '2026-09-28', at: '', kind: 'micro' as const, action: 'taken' as const, workedMinutes: 20, seconds: 20 }];
    expect(suggestLongerInterval(logs, 'micro', 20)).toBeNull();
  });
});

describe('inQuiet', () => {
  it('handles a window that wraps midnight', () => {
    expect(inQuiet(23, 22, 7)).toBe(true);
    expect(inQuiet(3, 22, 7)).toBe(true);
    expect(inQuiet(12, 22, 7)).toBe(false);
  });

  it('is never quiet when the window is empty', () => {
    expect(inQuiet(5, 7, 7)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/__tests__/breaks.test.ts`
Expected: FAIL — `nextDue`, `isPaused`, `takesScreen`, `clocksAfter`, `clocksAfterIdle`, `canSkip`, `skipsLeft` are not exported.

- [ ] **Step 3: Write the rules**

In `src/core/breaks.ts`, delete `BreakPhase`, `LegacySettings`, `BreakContext`, `IDLE_COUNTS_AS_BREAK_SECONDS`, `workedMinutes`, `minutesUntilBreak`, `shouldStartBreak`, `resetPointFor`, `breakRemainingSeconds`, `isBreakOver`, the old `BreakStats`, the old `breakStats` and the old `suggestLongerInterval`. Keep the file's header comment, `inQuiet`, and everything Task 1 added. Then append:

```ts
/** What the desktop shell can tell us about the window in front. */
export type ForegroundState = { fullscreen: boolean; exe: string; onCall: boolean };

/** When each kind's clock last restarted, in epoch ms. */
export type BreakClocks = Record<BreakKind, number>;

export type BreakContext = {
  nowMs: number;
  clocks: BreakClocks;
  idleSeconds: number;
  hour: number;
  /** 0 is Sunday, matching Date.getDay(). */
  weekday: number;
  settings: BreakSettings;
  /** Null in a browser or on a phone, where these facts are unknowable. */
  foreground: ForegroundState | null;
  logsToday: BreakLog[];
};

export type Due = { kind: BreakKind; inSeconds: number };

/** Away this long and the eyes and back have already had their rest. */
export const IDLE_RESETS_SHORT_SECONDS = 180;
/** Away this long and even the long break can start over. */
export const IDLE_RESETS_LONG_SECONDS = 300;

/** Micro and long blank the screen. Posture and blink are only a toast. */
export function takesScreen(kind: BreakKind): boolean {
  return kind === 'micro' || kind === 'long';
}

/** Longest first, so a tie is resolved in favour of the more restful break. */
const PRIORITY: BreakKind[] = ['long', 'micro', 'posture', 'blink'];

function kindSettings(s: BreakSettings, kind: BreakKind): KindSettings {
  return s[kind];
}

/**
 * The next break to offer and how long until it is due, or null when nothing
 * is scheduled. Does not consider pausing: ask `isPaused` separately, so the
 * interface can still show a countdown while a pause is in force.
 */
export function nextDue(ctx: BreakContext): Due | null {
  if (!ctx.settings.enabled) return null;
  let best: Due | null = null;
  for (const kind of PRIORITY) {
    const k = kindSettings(ctx.settings, kind);
    if (!k.enabled) continue;
    const elapsed = Math.max(0, ctx.nowMs - ctx.clocks[kind]) / 1000;
    const inSeconds = Math.max(0, Math.round(k.everyMinutes * 60 - elapsed));
    // Strictly less keeps PRIORITY's order on a tie.
    if (best === null || inSeconds < best.inSeconds) best = { kind, inSeconds };
  }
  return best;
}

/** Every reason the app should hold its tongue right now. */
export function isPaused(ctx: BreakContext): boolean {
  const s = ctx.settings;
  if (!s.enabled) return true;
  if (s.pausedUntilMs !== null && ctx.nowMs < s.pausedUntilMs) return true;
  if (inQuiet(ctx.hour, s.quietStartHour, s.quietEndHour)) return true;
  if (s.schedule) {
    const { days, startHour, endHour } = s.schedule;
    if (!days.includes(ctx.weekday)) return true;
    if (ctx.hour < startHour || ctx.hour >= endHour) return true;
  }
  const fg = ctx.foreground;
  if (fg) {
    if (s.smartPause.whenFullscreen && fg.fullscreen) return true;
    if (s.smartPause.whenOnCall && fg.onCall) return true;
    const exe = fg.exe.toLowerCase();
    if (s.smartPause.apps.some((a) => a.toLowerCase() === exe)) return true;
  }
  return false;
}

/**
 * The clocks to run after a break of this kind ends. A long break has already
 * rested the eyes and the back, so it restarts those clocks too.
 */
export function clocksAfter(kind: BreakKind, clocks: BreakClocks, nowMs: number): BreakClocks {
  if (kind === 'long') return { ...clocks, long: nowMs, micro: nowMs, posture: nowMs };
  return { ...clocks, [kind]: nowMs };
}

/** New clocks when the desk has been empty long enough to count, else null. */
export function clocksAfterIdle(ctx: BreakContext): BreakClocks | null {
  if (ctx.idleSeconds >= IDLE_RESETS_LONG_SECONDS) {
    return { micro: ctx.nowMs, long: ctx.nowMs, posture: ctx.nowMs, blink: ctx.nowMs };
  }
  if (ctx.idleSeconds >= IDLE_RESETS_SHORT_SECONDS) {
    return { ...ctx.clocks, micro: ctx.nowMs, posture: ctx.nowMs, blink: ctx.nowMs };
  }
  return null;
}

/** How many skips are left today. Infinity in gentle mode, zero in strict. */
export function skipsLeft(logsToday: BreakLog[], settings: BreakSettings): number {
  if (settings.strictness === 'gentle') return Infinity;
  if (settings.strictness === 'strict') return 0;
  const used = logsToday.filter((l) => l.action === 'skipped').length;
  return Math.max(0, settings.maxSkipsPerDay - used);
}

export function canSkip(logsToday: BreakLog[], settings: BreakSettings): boolean {
  return skipsLeft(logsToday, settings) > 0;
}

export type BreakStats = {
  taken: number;
  skipped: number;
  compliancePct: number;
  longestStretchMinutes: number;
  byKind: Record<BreakKind, { taken: number; offered: number }>;
  /** Taken over offered, counting a long break twice. 0 to 100. */
  eyeCareScore: number;
};

const KINDS: BreakKind[] = ['micro', 'long', 'posture', 'blink'];
/** A long break is worth two of anything else to the eyes. */
const WEIGHT: Record<BreakKind, number> = { micro: 1, long: 2, posture: 1, blink: 1 };

export function breakStats(logs: BreakLog[]): BreakStats {
  const byKind = Object.fromEntries(KINDS.map((k) => [k, { taken: 0, offered: 0 }])) as BreakStats['byKind'];
  let weightedTaken = 0;
  let weightedOffered = 0;
  for (const l of logs) {
    const bucket = byKind[l.kind];
    if (!bucket) continue;
    bucket.offered += 1;
    weightedOffered += WEIGHT[l.kind];
    if (l.action === 'taken') {
      bucket.taken += 1;
      weightedTaken += WEIGHT[l.kind];
    }
  }
  const taken = logs.filter((l) => l.action === 'taken').length;
  const skipped = logs.filter((l) => l.action === 'skipped').length;
  const total = taken + skipped;
  return {
    taken,
    skipped,
    compliancePct: total === 0 ? 0 : Math.round((taken / total) * 100),
    longestStretchMinutes: logs.reduce((m, l) => Math.max(m, Math.round(l.workedMinutes)), 0),
    byKind,
    eyeCareScore: weightedOffered === 0 ? 0 : Math.round((weightedTaken / weightedOffered) * 100),
  };
}

/**
 * Skipping the same kind five times running means its interval is wrong for
 * how this person works. Suggest a longer one rather than nagging on.
 */
export function suggestLongerInterval(logs: BreakLog[], kind: BreakKind, current: number): number | null {
  const forKind = logs.filter((l) => l.kind === kind);
  const recent = forKind.slice(-5);
  if (recent.length < 5) return null;
  if (!recent.every((l) => l.action === 'skipped')) return null;
  const next = Math.min(current + 15, 90);
  return next === current ? null : next;
}
```

Add `KindSettings` to the type import list at the top if the file does not already declare it above this code — it is declared in Task 1, in the same file, so no import is needed. Confirm that.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/__tests__/breaks.test.ts`
Expected: all passing, roughly 35 tests.

- [ ] **Step 5: Expect the monitor to break**

Run: `npx tsc --noEmit`
Expected: errors only in `src/services/useBreakMonitor.tsx`, because the functions its holding edit called are gone. Task 3 rewrites that file. Record the exact error list in your report and do not fix it here.

- [ ] **Step 6: Commit**

The tree does not typecheck at this commit, which is deliberate and recorded in the message so a bisect knows.

```bash
git add src/core/breaks.ts src/core/__tests__/breaks.test.ts
git commit -m "Break scheduling rules for four kinds, with pause, skip budget and per-kind stats

The monitor still calls the old rules and is fixed in the next commit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The monitor loop, rebuilt on the new rules

**Files:**
- Modify: `src/services/platform.ts`
- Modify: `src/services/useBreakMonitor.tsx` (the clock is rewritten; the provider and consumer hook at the bottom stay)

**Interfaces:**
- Consumes: everything Task 2 produced, plus `app.logBreak(kind, action, workedMinutes, seconds)` from Task 1.
- Produces `platform.ts`: `foregroundState(): Promise<ForegroundState | null>` and `pauseBreaksFor(minutes: number): void` is **not** added here — pausing is store state, handled in Task 5.
- Produces the monitor's return shape, which Tasks 4, 5 and 7 all read:

```ts
{
  phase: 'working' | 'warning' | 'breaking';
  kind: BreakKind | null;        // what is due or running
  remaining: number;             // seconds left of a running break
  secondsLeft: number;           // seconds until the next break is due
  nextKind: BreakKind | null;
  enabled: boolean;
  paused: boolean;
  sound: boolean;
  skipsLeft: number;
  takenToday: number;
  suggestion: { kind: BreakKind; minutes: number } | null;
  finish: () => void;
  skip: () => void;
  snooze: (minutes: number) => void;
  takeNow: (kind: BreakKind) => void;
}
```

- [ ] **Step 1: Teach the platform layer about the foreground window**

In `src/services/platform.ts`, add `import type { ForegroundState } from '../core/breaks';` and append:

```ts
/**
 * What the Windows shell can see about the window in front. Null everywhere
 * else, which the rules read as "no reason to pause".
 */
export async function foregroundState(): Promise<ForegroundState | null> {
  if (!isDesktopShell()) return null;
  try {
    const mod = await import('@tauri-apps/api/core');
    const raw = await mod.invoke<{ fullscreen: boolean; exe: string; onCall: boolean }>('foreground_state');
    return { fullscreen: !!raw.fullscreen, exe: String(raw.exe ?? ''), onCall: !!raw.onCall };
  } catch {
    // The command is missing or failed; never let that force a break.
    return null;
  }
}
```

- [ ] **Step 2: Rewrite the clock**

In `src/services/useBreakMonitor.tsx`, replace everything from the imports down to the end of `function useBreakClock() { ... }` — leaving the `Monitor` type, `Ctx`, `BreakMonitorProvider` and `useBreakMonitor` at the bottom of the file exactly as they are — with:

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import {
  clocksAfter,
  clocksAfterIdle,
  isPaused,
  nextDue,
  skipsLeft as computeSkipsLeft,
  suggestLongerInterval,
  takesScreen,
  type BreakClocks,
  type BreakKind,
  type ForegroundState,
} from '../core/breaks';
import { useApp } from '../store/AppProvider';
import { notifyNow } from './notify';
import { foregroundState, systemIdleSeconds } from './platform';

export type BreakPhase = 'working' | 'warning' | 'breaking';

const TICK_MS = 1000;
/** How long before a screen-taking break the warning toast appears. */
const WARNING_SECONDS = 60;
const KINDS: BreakKind[] = ['micro', 'long', 'posture', 'blink'];

/**
 * One clock for the whole app, mounted by BreakMonitorProvider. Each second it
 * builds a context from the store and the platform, asks the rules what is due,
 * and reacts. All the judgement lives in src/core/breaks.ts.
 */
function useBreakClock() {
  const app = useApp();
  const settings = app.state.breakSettings;

  const [phase, setPhase] = useState<BreakPhase>('working');
  const [kind, setKind] = useState<BreakKind | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(Infinity);
  const [nextKind, setNextKind] = useState<BreakKind | null>(null);
  const [paused, setPaused] = useState(false);

  const clocks = useRef<BreakClocks>({ micro: Date.now(), long: Date.now(), posture: Date.now(), blink: Date.now() });
  const breakStartedAt = useRef<number | null>(null);
  const runningKind = useRef<BreakKind | null>(null);
  const lastActivity = useRef(Date.now());
  const warnedFor = useRef<BreakKind | null>(null);
  /** While a toast-only nudge is on screen, no other break is offered. */
  const nudgeUntil = useRef<number | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const systemIdle = useRef<number | null>(null);
  const foreground = useRef<ForegroundState | null>(null);

  // Any input counts as being at the desk.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, touch));
  }, []);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') lastActivity.current = Date.now();
    });
    return () => sub.remove();
  }, []);

  // The shell knows real system idle time and what is in front. Off the shell
  // both stay null and the rules fall back to what the window can see.
  useEffect(() => {
    const id = setInterval(() => {
      systemIdleSeconds()
        .then((v) => {
          systemIdle.current = v;
        })
        .catch(() => {});
      foregroundState()
        .then((v) => {
          foreground.current = v;
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const logsToday = useMemo(() => app.state.breaks.filter((b) => b.date === app.today), [app.state.breaks, app.today]);

  const buildCtx = useCallback(
    (now: number) => {
      const windowIdle = Math.round((now - lastActivity.current) / 1000);
      const d = new Date(now);
      return {
        nowMs: now,
        clocks: clocks.current,
        idleSeconds: systemIdle.current ?? windowIdle,
        hour: d.getHours(),
        weekday: d.getDay(),
        settings,
        foreground: foreground.current,
        logsToday,
      };
    },
    [settings, logsToday],
  );

  /** End the running break, write it down, and restart the right clocks. */
  const endBreak = useCallback(
    (action: 'taken' | 'skipped') => {
      const now = Date.now();
      const k = runningKind.current ?? 'micro';
      const workedMinutes = Math.max(0, (breakStartedAt.current ?? now) - clocks.current[k]) / 60000;
      app.logBreak(k, action, workedMinutes, settings[k].seconds);
      clocks.current = clocksAfter(k, clocks.current, now);
      breakStartedAt.current = null;
      runningKind.current = null;
      warnedFor.current = null;
      setKind(null);
      setPhase('working');
    },
    [app, settings],
  );

  /** Start a break of this kind right now. */
  const start = useCallback((k: BreakKind, now: number) => {
    breakStartedAt.current = now;
    runningKind.current = k;
    setKind(k);
    setPhase('breaking');
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();

      // A break is running: count it down and stop there.
      if (breakStartedAt.current !== null && runningKind.current !== null) {
        const total = settings[runningKind.current].seconds;
        setRemaining(Math.max(0, Math.ceil((breakStartedAt.current + total * 1000 - now) / 1000)));
        return;
      }

      // A toast-only nudge is showing; let it finish before offering another.
      if (nudgeUntil.current !== null) {
        if (now < nudgeUntil.current) return;
        nudgeUntil.current = null;
      }

      const ctx = buildCtx(now);

      // Stepping away already gave the rest, so restart the clocks it earned.
      const rested = clocksAfterIdle(ctx);
      if (rested) {
        clocks.current = rested;
        warnedFor.current = null;
      }

      const held = isPaused(ctx);
      setPaused(held);

      const due = nextDue(ctx);
      setNextKind(due?.kind ?? null);
      setSecondsLeft(due ? due.inSeconds : Infinity);

      if (held || !due) {
        setPhase('working');
        return;
      }

      if (due.inSeconds <= 0) {
        if (takesScreen(due.kind)) {
          start(due.kind, now);
        } else {
          // Posture and blink never take the screen. Show them, write them
          // down as taken, and restart their clock.
          const seconds = settings[due.kind].seconds;
          setKind(due.kind);
          setPhase('breaking');
          app.logBreak(due.kind, 'taken', 0, seconds);
          clocks.current = clocksAfter(due.kind, clocks.current, now);
          // Hold off every other kind until this toast has had its seconds,
          // and keep the handle so teardown can cancel it.
          nudgeUntil.current = now + seconds * 1000;
          if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
          nudgeTimer.current = setTimeout(() => {
            nudgeTimer.current = null;
            setKind(null);
            setPhase('working');
          }, seconds * 1000);
        }
        return;
      }

      if (takesScreen(due.kind) && due.inSeconds <= WARNING_SECONDS) {
        if (warnedFor.current !== due.kind) {
          warnedFor.current = due.kind;
          notifyNow('Break in 1 minute', 'Finish what you are typing.').catch(() => {});
        }
        setPhase('warning');
        return;
      }

      setPhase('working');
    }, TICK_MS);
    return () => {
      clearInterval(id);
      if (nudgeTimer.current) {
        clearTimeout(nudgeTimer.current);
        nudgeTimer.current = null;
      }
      nudgeUntil.current = null;
    };
  }, [settings, buildCtx, start, app]);

  const snooze = useCallback(
    (minutes: number) => {
      const k = runningKind.current ?? nextKind ?? 'micro';
      // Push this kind's clock forward so it comes due again in `minutes`.
      const now = Date.now();
      clocks.current = { ...clocks.current, [k]: now - Math.max(0, settings[k].everyMinutes - minutes) * 60000 };
      breakStartedAt.current = null;
      runningKind.current = null;
      warnedFor.current = null;
      setKind(null);
      setPhase('working');
    },
    [settings, nextKind],
  );

  const takeNow = useCallback(
    (k: BreakKind) => {
      if (!takesScreen(k)) return;
      start(k, Date.now());
    },
    [start],
  );

  const suggestion = useMemo(() => {
    for (const k of KINDS) {
      const minutes = suggestLongerInterval(app.state.breaks, k, settings[k].everyMinutes);
      if (minutes !== null) return { kind: k, minutes };
    }
    return null;
  }, [app.state.breaks, settings]);

  return {
    phase,
    kind,
    remaining,
    secondsLeft,
    nextKind,
    enabled: settings.enabled,
    paused,
    sound: settings.sound,
    skipsLeft: computeSkipsLeft(logsToday, settings),
    takenToday: logsToday.filter((b) => b.action === 'taken').length,
    suggestion,
    finish: () => endBreak('taken'),
    skip: () => endBreak('skipped'),
    snooze,
    takeNow,
  };
}
```

- [ ] **Step 3: Typecheck and fix the two readers**

Run: `npx tsc --noEmit`

Expect errors in `src/components/BreakOverlay.tsx` and `src/components/BreakPanel.tsx`, which still read `minutesLeft`, `breakSeconds`, `workMinutes` and `allowSkip`. Apply these holding edits so the tree compiles; Tasks 4 and 5 rewrite both files properly.

In `src/components/BreakPanel.tsx`, replace every `monitor.minutesLeft` with `Math.ceil(monitor.secondsLeft / 60)`, every `monitor.workMinutes` with `app.state.breakSettings.micro.everyMinutes`, and delete the `monitor.suggestion` line's use of `monitor.suggestion` in favour of:

```tsx
      {monitor.suggestion ? <Micro color={C.amber}>{`${t('break_every')} ${monitor.suggestion.minutes} ${t('minutes')}?`}</Micro> : null}
```

In `src/components/BreakOverlay.tsx`, replace `monitor.breakSeconds` with `app.state.breakSettings[monitor.kind ?? 'micro'].seconds`, and `monitor.allowSkip` with `monitor.skipsLeft > 0`. The `BreakWarning` sub-component reads `monitor.minutesLeft`; replace that with `monitor.secondsLeft`, and its `const seconds = Math.max(0, Math.round(monitor.minutesLeft * 60));` becomes `const seconds = Math.max(0, Math.round(monitor.secondsLeft));`.

Run `npx tsc --noEmit` again. Expected: clean.

- [ ] **Step 4: Everything green**

Run: `npm test 2>&1 | tail -3 && npx expo lint 2>&1 | grep problems`
Expected: all test files passing, `66 problems` or fewer.

If the React Compiler rule objects to the new loop, extract the offending expression into a `useMemo` beside its inputs. Do not add an `eslint-disable`; if you cannot hold 66 without one, report DONE_WITH_CONCERNS naming the rule and line.

- [ ] **Step 5: Commit**

```bash
git add src/services/platform.ts src/services/useBreakMonitor.tsx src/components/BreakPanel.tsx src/components/BreakOverlay.tsx
git commit -m "Drive the break monitor from the new rules, one clock per kind

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The overlay and the nudge toast

**Files:**
- Create: `src/components/BreakToast.tsx`
- Modify: `src/components/BreakOverlay.tsx` (rewritten)
- Modify: `src/i18n/index.ts`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: the monitor shape from Task 3, `takesScreen` from Task 2, `useReducedMotion` from `src/ui/animated.ts`, the exercise list via `useApp().exercises`.
- Produces: `BreakToast` rendered once in `AppShell`, beside `BreakOverlay`.

- [ ] **Step 1: The new strings**

In `src/i18n/index.ts`, before the closing `};` of the `en` block, add:

```ts
  brk_micro: 'Look away',
  brk_long: 'Stand up and move',
  brk_posture: 'Sit back',
  brk_blink: 'Blink slowly',
  brk_micro_hint: 'Focus on something far away for twenty seconds.',
  brk_long_hint: 'Stand, stretch, and let your eyes rest.',
  brk_posture_hint: 'Shoulders down, back against the chair.',
  brk_blink_hint: 'Ten slow blinks. Your eyes are drier than they feel.',
  brk_done_early: 'I am done',
  brk_snooze_n: '+{n} min',
  brk_skips_left: '{n} skips left today',
  brk_no_skips: 'No skips left today',
  brk_strict: 'Breaks are set to strict',
  brk_counter: '{kind} break {n} today · next {next} in {m} min',
  brk_try_these: 'Two moves while you are up',
  brk_paused_until: 'Breaks paused',
  brk_pause_hour: 'Pause 1 hour',
  brk_resume: 'Resume breaks',
  brk_take_now: 'Break now',
  brk_kinds: 'Break kinds',
  brk_strictness: 'How insistent',
  brk_gentle: 'Gentle', brk_normal: 'Normal', brk_strict_mode: 'Strict',
  brk_gentle_desc: 'Leave any break whenever you like.',
  brk_normal_desc: 'Skip up to {n} times a day.',
  brk_strict_desc: 'No skipping. The break runs its course.',
  brk_smart_pause: 'Stay quiet when busy',
  brk_when_fullscreen: 'During fullscreen video',
  brk_when_oncall: 'During calls',
  brk_schedule: 'Only during work hours',
  brk_sound: 'Soft chime',
  brk_eye_care: 'Eye care',
  brk_offered: 'offered',
  brk_streak: 'day break streak',
```

Before the closing `};` of the `mr` block, add:

```ts
  brk_micro: 'लांब बघा',
  brk_long: 'उठा आणि हालचाल करा',
  brk_posture: 'नीट बसा',
  brk_blink: 'सावकाश डोळे मिचकावा',
  brk_micro_hint: 'वीस सेकंद लांब कुठेतरी बघा.',
  brk_long_hint: 'उभे रहा, ताण द्या, डोळ्यांना आराम द्या.',
  brk_posture_hint: 'खांदे खाली, पाठ खुर्चीला टेकवा.',
  brk_blink_hint: 'दहा वेळा सावकाश डोळे मिचकावा. डोळे कोरडे झाले आहेत.',
  brk_done_early: 'झाले',
  brk_snooze_n: '+{n} मिनिटे',
  brk_skips_left: 'आज {n} वेळा टाळता येईल',
  brk_no_skips: 'आज आणखी टाळता येणार नाही',
  brk_strict: 'ब्रेक कडक ठेवले आहेत',
  brk_counter: 'आजचा {kind} ब्रेक {n} · पुढचा {next} {m} मिनिटांत',
  brk_try_these: 'उठला आहात तर या दोन हालचाली',
  brk_paused_until: 'ब्रेक थांबवले आहेत',
  brk_pause_hour: '१ तास थांबवा',
  brk_resume: 'ब्रेक पुन्हा सुरू करा',
  brk_take_now: 'आताच ब्रेक',
  brk_kinds: 'ब्रेकचे प्रकार',
  brk_strictness: 'किती आग्रही',
  brk_gentle: 'मवाळ', brk_normal: 'नेहमीचे', brk_strict_mode: 'कडक',
  brk_gentle_desc: 'कोणताही ब्रेक कधीही सोडता येईल.',
  brk_normal_desc: 'दिवसातून {n} वेळा टाळता येईल.',
  brk_strict_desc: 'टाळता येणार नाही. ब्रेक पूर्ण होईल.',
  brk_smart_pause: 'कामात असताना गप्प रहा',
  brk_when_fullscreen: 'पूर्ण स्क्रीन व्हिडिओ चालू असताना',
  brk_when_oncall: 'कॉलवर असताना',
  brk_schedule: 'फक्त कामाच्या वेळेत',
  brk_sound: 'मंद आवाज',
  brk_eye_care: 'डोळ्यांची काळजी',
  brk_offered: 'सुचवले',
  brk_streak: 'दिवस ब्रेक सलग',
```

Before the closing `};` of the `hi` block, add:

```ts
  brk_micro: 'दूर देखें',
  brk_long: 'उठें और चलें',
  brk_posture: 'सीधे बैठें',
  brk_blink: 'धीरे पलक झपकाएँ',
  brk_micro_hint: 'बीस सेकंड दूर कहीं देखें.',
  brk_long_hint: 'खड़े हों, स्ट्रेच करें, आँखों को आराम दें.',
  brk_posture_hint: 'कंधे नीचे, पीठ कुर्सी से लगाएँ.',
  brk_blink_hint: 'दस बार धीरे पलक झपकाएँ. आँखें सूखी हैं.',
  brk_done_early: 'हो गया',
  brk_snooze_n: '+{n} मिनट',
  brk_skips_left: 'आज {n} बार टाल सकते हैं',
  brk_no_skips: 'आज और नहीं टाल सकते',
  brk_strict: 'ब्रेक सख़्त हैं',
  brk_counter: 'आज का {kind} ब्रेक {n} · अगला {next} {m} मिनट में',
  brk_try_these: 'उठे हैं तो ये दो हरकतें',
  brk_paused_until: 'ब्रेक रोके गए हैं',
  brk_pause_hour: '1 घंटा रोकें',
  brk_resume: 'ब्रेक फिर शुरू करें',
  brk_take_now: 'अभी ब्रेक',
  brk_kinds: 'ब्रेक के प्रकार',
  brk_strictness: 'कितना आग्रही',
  brk_gentle: 'नरम', brk_normal: 'सामान्य', brk_strict_mode: 'सख़्त',
  brk_gentle_desc: 'कोई भी ब्रेक कभी भी छोड़ सकते हैं.',
  brk_normal_desc: 'दिन में {n} बार टाल सकते हैं.',
  brk_strict_desc: 'टाल नहीं सकते. ब्रेक पूरा चलेगा.',
  brk_smart_pause: 'व्यस्त होने पर चुप रहें',
  brk_when_fullscreen: 'फ़ुलस्क्रीन वीडियो के दौरान',
  brk_when_oncall: 'कॉल के दौरान',
  brk_schedule: 'केवल काम के घंटों में',
  brk_sound: 'हल्की ध्वनि',
  brk_eye_care: 'आँखों की देखभाल',
  brk_offered: 'सुझाए',
  brk_streak: 'दिन ब्रेक लगातार',
```

Run: `npx tsc --noEmit` — expected clean.

- [ ] **Step 2: The toast**

Create `src/components/BreakToast.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { takesScreen } from '../core/breaks';
import { fill, makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { C, F, MICRO, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

/**
 * Two jobs, one surface: the quiet heads-up a minute before a screen-taking
 * break, and the posture and blink nudges, which never take the screen at all.
 */
export function BreakToast() {
  const monitor = useBreakMonitor();
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'mobile';

  const nudging = monitor.phase === 'breaking' && monitor.kind !== null && !takesScreen(monitor.kind);
  const warning = monitor.phase === 'warning' && monitor.nextKind !== null;
  if (!state.profile.onboarded || (!nudging && !warning)) return null;

  const kind = nudging ? monitor.kind! : monitor.nextKind!;
  const title = nudging ? t(`brk_${kind}`) : t('break_soon').replace('{s}', String(Math.max(0, Math.round(monitor.secondsLeft))));
  const body = nudging ? t(`brk_${kind}_hint`) : t('break_soon_hint');

  return (
    <View
      style={{
        position: 'absolute',
        right: wide ? 20 : 12,
        left: wide ? undefined : 12,
        bottom: (wide ? 20 : 96) + insets.bottom,
        maxWidth: 360,
        alignSelf: wide ? 'flex-end' : 'center',
        backgroundColor: C.cardHigh,
        borderWidth: S.hairline,
        borderColor: C.borderStrong,
        borderRadius: S.radius,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 6,
        zIndex: 940,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={nudging ? 'body-outline' : 'time-outline'} size={15} color={nudging ? C.cyan : C.amber} />
        <Text style={[MICRO, { color: nudging ? C.cyan : C.amber }]}>{title}</Text>
      </View>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: 18 }}>{body}</Text>

      {warning ? (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
          {state.breakSettings.snoozeMinutes.map((m) => (
            <Pressable key={m} onPress={() => monitor.snooze(m)} hitSlop={6} accessibilityRole="button">
              <Text style={{ color: C.accent, fontSize: F.small, fontWeight: '600' }}>{fill(t('brk_snooze_n'), { n: m })}</Text>
            </Pressable>
          ))}
          {monitor.skipsLeft > 0 ? (
            <Pressable onPress={monitor.skip} hitSlop={6} accessibilityRole="button">
              <Text style={{ color: C.textFaint, fontSize: F.small }}>{t('break_skip')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 3: Mount it**

In `src/app/_layout.tsx`, add `import { BreakToast } from '../components/BreakToast';` and render it immediately after `<BreakOverlay />` inside `AppShell`.

- [ ] **Step 4: Rewrite the overlay**

Replace `src/components/BreakOverlay.tsx` in full:

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { takesScreen, type BreakKind } from '../core/breaks';
import type { Exercise } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { useReducedMotion } from '../ui/animated';
import { C, F, MICRO } from '../ui/theme';

/** Calm, low-effort moves worth doing while you are already standing. */
const LONG_BREAK_CATEGORIES = ['mobility', 'stretch', 'breathing'];

/**
 * Takes the whole screen for a micro or long break. Deliberately almost empty:
 * the point is to stop looking at it. A long break also offers two moves,
 * because three minutes standing still is harder than three minutes moving.
 */
export function BreakOverlay() {
  const monitor = useBreakMonitor();
  const app = useApp();
  const fb = useFeedback();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const fade = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  const kind: BreakKind = monitor.kind ?? 'micro';
  const showing = app.state.profile.onboarded && monitor.phase === 'breaking' && takesScreen(kind);
  const total = app.state.breakSettings[kind].seconds;
  const over = monitor.remaining <= 0;

  // Two moves, chosen once per break rather than on every tick.
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (showing) setSeed(Date.now());
  }, [showing]);

  const moves: Exercise[] = useMemo(() => {
    if (kind !== 'long') return [];
    const pool = app.exercises.filter((e) => LONG_BREAK_CATEGORIES.includes(e.category));
    if (pool.length === 0) return [];
    const a = pool[seed % pool.length];
    const b = pool[(seed + 7) % pool.length];
    return a.id === b.id ? [a] : [a, b];
  }, [kind, app.exercises, seed]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: showing ? 1 : 0,
      duration: showing ? 600 : 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [showing, fade]);

  // The ring breathes so the screen is alive without being interesting.
  useEffect(() => {
    if (!showing || reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showing, reduce, breathe]);

  if (!showing) return null;

  const size = Math.max(160, Math.min(260, Math.min(width, height) * 0.5));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? monitor.remaining / total : 0;
  const mins = Math.floor(monitor.remaining / 60);
  const secs = monitor.remaining % 60;
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const nextIn = Number.isFinite(monitor.secondsLeft) ? Math.ceil(monitor.secondsLeft / 60) : 0;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fade,
        zIndex: 999,
      }}>
      <Text style={{ color: C.textDim, fontSize: F.h2, fontWeight: '300', marginBottom: 8, textAlign: 'center', paddingHorizontal: 24, letterSpacing: -0.2 }}>
        {t(`brk_${kind}`)}
      </Text>
      <Text style={{ color: C.textFaint, fontSize: F.body, marginBottom: 36, textAlign: 'center', paddingHorizontal: 32 }}>{t(`brk_${kind}_hint`)}</Text>

      <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={kind === 'long' ? C.cyan : C.accent}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circ}`}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={{ color: C.text, fontSize: size * 0.24, fontWeight: '200', letterSpacing: -2 }}>
          {mins}:{String(secs).padStart(2, '0')}
        </Text>
      </Animated.View>

      {moves.length > 0 ? (
        <View style={{ marginTop: 36, gap: 10, paddingHorizontal: 32, maxWidth: 520 }}>
          <Text style={[MICRO, { color: C.textGhost, textAlign: 'center' }]}>{t('brk_try_these')}</Text>
          {moves.map((e) => (
            <Text key={e.id} style={{ color: C.textDim, fontSize: F.small, textAlign: 'center', lineHeight: 19 }}>
              {lang === 'mr' ? e.name_mr : lang === 'hi' ? e.name_hi : e.name_en}
              <Text style={{ color: C.textGhost }}>
                {'  '}
                {(lang === 'mr' ? e.instructions_mr : lang === 'hi' ? e.instructions_hi : e.instructions_en)[0]}
              </Text>
            </Text>
          ))}
        </View>
      ) : null}

      <View
        style={{
          position: 'absolute',
          bottom: 48,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 40,
          alignItems: 'center',
        }}>
        {!over && monitor.skipsLeft > 0 ? (
          <Pressable onPress={monitor.skip} accessibilityRole="button" accessibilityLabel={t('break_skip')}>
            <Text style={{ color: C.textFaint, fontSize: F.small }}>{t('break_skip')}</Text>
          </Pressable>
        ) : !over ? (
          <Text style={{ color: C.textGhost, fontSize: F.small }}>{monitor.skipsLeft === 0 ? t('brk_no_skips') : ''}</Text>
        ) : (
          <View />
        )}
        {over ? (
          <Pressable
            onPress={() => {
              monitor.finish();
              fb.notify(t('toast_break_done'));
            }}
            accessibilityRole="button"
            style={{ backgroundColor: C.accent, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999 }}>
            <Text style={{ color: C.white, fontSize: F.body, fontWeight: '600' }}>{t('break_done')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <Text style={[MICRO, { position: 'absolute', top: 30, right: 30, color: C.textGhost }]}>
        {fill(t('brk_counter'), {
          kind: t(`brk_${kind}`),
          n: monitor.takenToday + 1,
          next: monitor.nextKind ? t(`brk_${monitor.nextKind}`) : '—',
          m: nextIn,
        })}
      </Text>
    </Animated.View>
  );
}
```

The old `BreakWarning` sub-component is gone; `BreakToast` replaces it.

- [ ] **Step 5: Everything green**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3 && npx expo lint 2>&1 | grep problems`
Expected: clean, all tests passing, `66 problems` or fewer.

- [ ] **Step 6: Commit**

```bash
git add src/components/BreakOverlay.tsx src/components/BreakToast.tsx src/app/_layout.tsx src/i18n/index.ts
git commit -m "Per-kind break overlay with a breathing ring, and a toast for nudges and warnings

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The Breaks settings group, and pausing

**Files:**
- Modify: `src/app/settings.tsx` (the Breaks group only)
- Modify: `src/components/BreakPanel.tsx`
- Modify: `src/store/AppProvider.tsx` (a `pauseBreaks` action)

**Interfaces:**
- Produces: `app.pauseBreaks(minutes: number | null)` — sets `breakSettings.pausedUntilMs` to now plus the minutes, or clears it when passed null.
- `BreakPanel` gains a pause/resume control and a "break now" control, both desktop-only since that is where the panel lives.

- [ ] **Step 1: The store action**

In `src/store/AppProvider.tsx`, add to the `Ctx` type beside `setBreakSettings`:

```ts
  pauseBreaks: (minutes: number | null) => void;
```

and implement it next to `setBreakSettings`:

```ts
      pauseBreaks: (minutes) =>
        update((s) => ({
          ...s,
          breakSettings: { ...s.breakSettings, pausedUntilMs: minutes === null ? null : Date.now() + minutes * 60000 },
        })),
```

- [ ] **Step 2: The panel's controls**

In `src/components/BreakPanel.tsx`, add `Btn` to the `../ui/components` import and `fill` to the `../i18n` import. Replace the block that renders the suggestion line at the bottom with:

```tsx
      <Row style={{ gap: 8 }}>
        {monitor.paused ? (
          <Btn small tone="soft" label={t('brk_resume')} onPress={() => app.pauseBreaks(null)} style={{ flex: 1 }} />
        ) : (
          <Btn small tone="ghost" label={t('brk_pause_hour')} onPress={() => app.pauseBreaks(60)} style={{ flex: 1 }} />
        )}
        <Btn small tone="soft" label={t('brk_take_now')} onPress={() => monitor.takeNow('micro')} style={{ flex: 1 }} />
      </Row>
      {monitor.paused ? <Micro color={C.amber}>{t('brk_paused_until')}</Micro> : null}
      {monitor.suggestion ? (
        <Micro color={C.amber}>{`${t(`brk_${monitor.suggestion.kind}`)} · ${t('break_every')} ${monitor.suggestion.minutes} ${t('minutes')}?`}</Micro>
      ) : null}
```

Also change the panel's headline number so it names the kind that is coming. Replace the `Micro` under the ring that currently reads `{t('break_next')}` with:

```tsx
              <Micro>{monitor.nextKind ? `${t('break_next')} · ${t(`brk_${monitor.nextKind}`)}` : t('break_next')}</Micro>
```

- [ ] **Step 3: Rebuild the Breaks group in settings**

In `src/app/settings.tsx`, replace the whole `<View style={{ gap: 10 }}>` block whose `SectionHeader` title is `en('break_monitor')` with this. Everything else on the screen stays as it is.

```tsx
      <View style={{ gap: 10 }}>
        <SectionHeader title={en('break_monitor')} meta={br.enabled ? 'On' : 'Off'} />
        <Card>
          <Toggle
            title={t('break_monitor')}
            desc={en('break_monitor_desc')}
            on={br.enabled}
            onToggle={() => app.setBreakSettings({ enabled: !br.enabled })}
          />

          <Divider />
          <Micro>{t('brk_kinds')}</Micro>
          {(['micro', 'long', 'posture', 'blink'] as const).map((k) => (
            <View key={k} style={{ gap: 7 }}>
              <Toggle
                title={t(`brk_${k}`)}
                desc={t(`brk_${k}_hint`)}
                on={br[k].enabled}
                onToggle={() => app.setBreakSettings({ [k]: { ...br[k], enabled: !br[k].enabled } } as Partial<typeof br>)}
              />
              {br[k].enabled ? (
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {(k === 'micro' ? [15, 20, 30, 45] : k === 'long' ? [45, 60, 90, 120] : k === 'posture' ? [20, 30, 45, 60] : [5, 10, 15, 20]).map((m) => (
                    <Pill
                      key={m}
                      label={`${m}m`}
                      active={br[k].everyMinutes === m}
                      onPress={() => app.setBreakSettings({ [k]: { ...br[k], everyMinutes: m } } as Partial<typeof br>)}
                    />
                  ))}
                </Row>
              ) : null}
            </View>
          ))}

          <Divider />
          <Micro>{t('brk_strictness')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {(['gentle', 'normal', 'strict'] as const).map((s) => (
              <Pill
                key={s}
                label={t(s === 'strict' ? 'brk_strict_mode' : `brk_${s}`)}
                active={br.strictness === s}
                onPress={() => app.setBreakSettings({ strictness: s })}
              />
            ))}
          </Row>
          <Micro>
            {br.strictness === 'gentle'
              ? t('brk_gentle_desc')
              : br.strictness === 'strict'
                ? t('brk_strict_desc')
                : fill(t('brk_normal_desc'), { n: br.maxSkipsPerDay })}
          </Micro>
          {br.strictness === 'normal' ? (
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 3, 5].map((n) => (
                <Pill key={n} label={String(n)} active={br.maxSkipsPerDay === n} onPress={() => app.setBreakSettings({ maxSkipsPerDay: n })} />
              ))}
            </Row>
          ) : null}

          <Divider />
          <Micro>{t('brk_smart_pause')}</Micro>
          <Toggle
            title={t('brk_when_fullscreen')}
            desc={en('break_monitor_desc')}
            on={br.smartPause.whenFullscreen}
            onToggle={() => app.setBreakSettings({ smartPause: { ...br.smartPause, whenFullscreen: !br.smartPause.whenFullscreen } })}
          />
          <Toggle
            title={t('brk_when_oncall')}
            desc={en('break_monitor_desc')}
            on={br.smartPause.whenOnCall}
            onToggle={() => app.setBreakSettings({ smartPause: { ...br.smartPause, whenOnCall: !br.smartPause.whenOnCall } })}
          />

          <Divider />
          <Toggle
            title={t('brk_schedule')}
            desc={en('break_monitor_desc')}
            on={br.schedule !== null}
            onToggle={() =>
              app.setBreakSettings({ schedule: br.schedule === null ? { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 } : null })
            }
          />
          {br.schedule ? (
            <Row style={{ gap: 12 }}>
              <Field
                label="from"
                value={String(br.schedule.startHour)}
                onChangeText={(v) => app.setBreakSettings({ schedule: { ...br.schedule!, startHour: Number(v) || 0 } })}
                keyboardType="numeric"
              />
              <Field
                label="to"
                value={String(br.schedule.endHour)}
                onChangeText={(v) => app.setBreakSettings({ schedule: { ...br.schedule!, endHour: Number(v) || 0 } })}
                keyboardType="numeric"
              />
            </Row>
          ) : null}

          <Divider />
          <Toggle title={t('brk_sound')} desc={en('break_monitor_desc')} on={br.sound} onToggle={() => app.setBreakSettings({ sound: !br.sound })} />

          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>{en('break_compliance')}</Micro>
            <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
              {app.state.breaks.filter((b) => b.action === 'taken').length}
              <Text style={{ color: C.textFaint, fontWeight: '400' }}> / {app.state.breaks.length}</Text>
            </Text>
          </Row>
        </Card>
      </View>
```

Add `fill` to the `../i18n` import in this file if it is not already there.

**A note on the repeated `desc={en('break_monitor_desc')}`:** that is a placeholder and it is not acceptable. Give each toggle its own description key. Add these to all three dictionaries in `src/i18n/index.ts`, alongside the keys from Task 4:

`en`:
```ts
  brk_fullscreen_desc: 'A film or a presentation should not be interrupted.',
  brk_oncall_desc: 'Stay quiet while the microphone or camera is in use.',
  brk_schedule_desc: 'Outside these hours the app says nothing.',
  brk_sound_desc: 'A short chime when a break starts and ends.',
```
`mr`:
```ts
  brk_fullscreen_desc: 'सिनेमा किंवा सादरीकरण मध्येच तोडू नये.',
  brk_oncall_desc: 'माइक किंवा कॅमेरा चालू असताना गप्प रहा.',
  brk_schedule_desc: 'या वेळेबाहेर अॅप काहीच बोलणार नाही.',
  brk_sound_desc: 'ब्रेक सुरू आणि संपताना मंद आवाज.',
```
`hi`:
```ts
  brk_fullscreen_desc: 'फ़िल्म या प्रेज़ेंटेशन बीच में न रुके.',
  brk_oncall_desc: 'माइक या कैमरा चालू हो तो चुप रहें.',
  brk_schedule_desc: 'इन घंटों के बाहर ऐप कुछ नहीं कहेगा.',
  brk_sound_desc: 'ब्रेक शुरू और ख़त्म होने पर हल्की ध्वनि.',
```

Then use them: `desc={t('brk_fullscreen_desc')}`, `desc={t('brk_oncall_desc')}`, `desc={t('brk_schedule_desc')}`, `desc={t('brk_sound_desc')}`.

- [ ] **Step 4: Everything green**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3 && npx expo lint 2>&1 | grep problems`
Expected: clean, all tests passing, `66 problems` or fewer.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings.tsx src/components/BreakPanel.tsx src/store/AppProvider.tsx src/i18n/index.ts
git commit -m "Settings for four break kinds, strictness, smart pause and a schedule

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The Windows shell pieces

Written here, compiled on the user's PC. Nothing in this task can be run on macOS, so its verification is "the web build is unaffected" plus a careful read.

**Files:**
- Modify: `desktop/src-tauri/Cargo.toml`
- Modify: `desktop/src-tauri/src/main.rs`
- Modify: `desktop/src-tauri/capabilities/default.json`
- Modify: `desktop/README.md`

**Interfaces:**
- Produces the Tauri command `foreground_state` returning `{ fullscreen: bool, exe: String, onCall: bool }`, which `foregroundState()` in `src/services/platform.ts` already calls.
- Produces three global shortcuts that dispatch DOM events the web app listens for: `sobat:take-break`, `sobat:pause-breaks`, `sobat:add-water`.

- [ ] **Step 1: The dependency**

In `desktop/src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
tauri-plugin-global-shortcut = "2"
```

and extend the Windows-only dependency's feature list so it reads:

```toml
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.59", features = ["Win32_System_SystemInformation", "Win32_UI_Input_KeyboardAndMouse", "Win32_UI_WindowsAndMessaging", "Win32_Graphics_Gdi", "Win32_System_Threading", "Win32_System_ProcessStatus", "Win32_System_Registry", "Win32_Foundation"] }
```

- [ ] **Step 2: The command**

In `desktop/src-tauri/src/main.rs`, add this above `fn main()`:

```rust
/// What the window in front is doing, so the break monitor can stay quiet
/// through a film or a call. Every failure reads as "nothing special", which
/// means a break still happens — the safe direction to fail in.
#[derive(serde::Serialize, Default)]
struct ForegroundState {
    fullscreen: bool,
    exe: String,
    #[serde(rename = "onCall")]
    on_call: bool,
}

#[tauri::command]
fn foreground_state() -> ForegroundState {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::{HWND, RECT};
        use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
        use windows_sys::Win32::System::ProcessStatus::GetModuleBaseNameW;
        use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
        use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId};

        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd.is_null() {
                return ForegroundState::default();
            }

            // Fullscreen: the window covers its whole monitor.
            let mut win: RECT = std::mem::zeroed();
            let mut fullscreen = false;
            if GetWindowRect(hwnd, &mut win) != 0 {
                let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                let mut mi: MONITORINFO = std::mem::zeroed();
                mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
                if GetMonitorInfoW(monitor, &mut mi) != 0 {
                    let m = mi.rcMonitor;
                    fullscreen = win.left <= m.left && win.top <= m.top && win.right >= m.right && win.bottom >= m.bottom;
                }
            }

            // The process image name, e.g. "chrome.exe".
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let mut exe = String::new();
            if pid != 0 {
                let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
                if !handle.is_null() {
                    let mut buf = [0u16; 260];
                    let len = GetModuleBaseNameW(handle, std::ptr::null_mut(), buf.as_mut_ptr(), buf.len() as u32);
                    if len > 0 {
                        exe = String::from_utf16_lossy(&buf[..len as usize]);
                    }
                    windows_sys::Win32::Foundation::CloseHandle(handle);
                }
            }

            ForegroundState { fullscreen, exe, on_call: microphone_in_use() }
        }
    }

    #[cfg(not(windows))]
    {
        ForegroundState::default()
    }
}

/// Windows records a stop time for every app that has used the microphone.
/// A zero stop time means it is using it right now, which is as close to
/// "on a call" as we can get without asking for permissions of our own.
#[cfg(windows)]
fn microphone_in_use() -> bool {
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ, REG_QWORD,
    };

    const ROOT: &str = r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone";

    unsafe fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe {
        let mut root: HKEY = std::ptr::null_mut();
        if RegOpenKeyExW(HKEY_CURRENT_USER, wide(ROOT).as_ptr(), 0, KEY_READ, &mut root) != 0 {
            return false;
        }
        let mut in_use = false;
        let mut index = 0u32;
        loop {
            let mut name = [0u16; 512];
            let mut len = name.len() as u32;
            if RegEnumKeyExW(root, index, name.as_mut_ptr(), &mut len, std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut()) != 0 {
                break;
            }
            index += 1;

            let mut sub: HKEY = std::ptr::null_mut();
            if RegOpenKeyExW(root, name.as_ptr(), 0, KEY_READ, &mut sub) == 0 {
                let mut value: u64 = 0;
                let mut size = std::mem::size_of::<u64>() as u32;
                let mut kind: u32 = 0;
                let ok = RegQueryValueExW(
                    sub,
                    wide("LastUsedTimeStop").as_ptr(),
                    std::ptr::null_mut(),
                    &mut kind,
                    &mut value as *mut u64 as *mut u8,
                    &mut size,
                );
                RegCloseKey(sub);
                // Zero means "still running".
                if ok == 0 && kind == REG_QWORD && value == 0 {
                    in_use = true;
                    break;
                }
            }
        }
        RegCloseKey(root);
        in_use
    }
}
```

Add `serde` to the imports the file already has (it is already a dependency in `Cargo.toml`).

- [ ] **Step 3: Register it, with the shortcuts**

In `main()`, change the plugin and handler lines so they read:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_idle_seconds, foreground_state])
```

and inside `.setup(|app| { ... })`, before `Ok(())`, add:

```rust
            // Three keys that work anywhere, because the point of a break
            // reminder is that you are not looking at this window.
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let handle = app.handle().clone();
                let fire = move |event: &str| {
                    if let Some(w) = handle.get_webview_window("main") {
                        let _ = w.eval(&format!("window.dispatchEvent(new CustomEvent('{}'))", event));
                    }
                };
                let f1 = fire.clone();
                let _ = app.global_shortcut().on_shortcut("CmdOrCtrl+Alt+B", move |_, _, _| f1("sobat:take-break"));
                let f2 = fire.clone();
                let _ = app.global_shortcut().on_shortcut("CmdOrCtrl+Alt+P", move |_, _, _| f2("sobat:pause-breaks"));
                let f3 = fire.clone();
                let _ = app.global_shortcut().on_shortcut("CmdOrCtrl+Alt+W", move |_, _, _| f3("sobat:add-water"));
            }
```

Add `"Take a break now"` to the tray menu beside the existing items, wired to the same `sobat:take-break` event, by adding a `MenuItem` and a match arm mirroring how `"pause"` already works.

- [ ] **Step 4: The capability**

In `desktop/src-tauri/capabilities/default.json`, add `"global-shortcut:default"` to the `permissions` array.

- [ ] **Step 5: Listen on the web side**

In `src/services/useBreakMonitor.tsx`, inside `useBreakClock`, add one effect that turns those events into actions:

```tsx
  // The desktop shell fires these from global shortcuts and the tray.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const take = () => takeNow('micro');
    const pause = () => app.pauseBreaks(60);
    window.addEventListener('sobat:take-break', take);
    window.addEventListener('sobat:pause-breaks', pause);
    return () => {
      window.removeEventListener('sobat:take-break', take);
      window.removeEventListener('sobat:pause-breaks', pause);
    };
  }, [takeNow, app]);
```

Place it after `takeNow` is defined. The water shortcut belongs to the water plan, not this one; leave `sobat:add-water` unhandled for now and say so in your report.

- [ ] **Step 6: Document it**

In `desktop/README.md`, under the existing build instructions, add:

```markdown
## What the shell adds to breaks

- **Real system idle time**, so switching to another program still counts as
  being at the desk.
- **Smart pause**: the app stays quiet during a fullscreen window and while the
  microphone is in use. Both are read best-effort; if either lookup fails the
  break happens anyway.
- **Global shortcuts**: Ctrl+Alt+B takes a break now, Ctrl+Alt+P pauses breaks
  for an hour, Ctrl+Alt+W is reserved for water.
- **Tray**: "Take a break now" and "Pause breaks for an hour".

None of this compiles on macOS. Build on the PC as described above.
```

- [ ] **Step 7: Verify what can be verified here**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3 && npx expo lint 2>&1 | grep problems`
Expected: clean, all tests passing, `66 problems` or fewer. The Rust is not compiled; say so plainly in your report and do not claim otherwise.

- [ ] **Step 8: Commit**

```bash
git add desktop src/services/useBreakMonitor.tsx
git commit -m "Windows shell: foreground state, global shortcuts and tray break controls

Rust is written but not compiled here; it builds on the PC.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: The eye-care section on Growth, and the sweep

**Files:**
- Modify: `src/core/insights.ts`
- Modify: `src/core/__tests__/insights.test.ts`
- Modify: `src/app/(tabs)/growth.tsx`
- Modify: `README.md`

**Interfaces:**
- Produces: `breakStreak(logs: BreakLog[], dates: ISODate[]): number` in `src/core/insights.ts` — consecutive days ending today whose compliance was at least 70 %.

- [ ] **Step 1: Write the failing test**

Append to `src/core/__tests__/insights.test.ts`, adding `breakStreak` to the `'../insights'` import and `import type { BreakLog } from '../breaks';` at the top:

```ts
describe('breakStreak', () => {
  const day = (date: string, taken: number, skipped: number): BreakLog[] => [
    ...Array.from({ length: taken }, (_, i) => ({ id: `t${date}${i}`, date, at: '', kind: 'micro' as const, action: 'taken' as const, workedMinutes: 20, seconds: 20 })),
    ...Array.from({ length: skipped }, (_, i) => ({ id: `s${date}${i}`, date, at: '', kind: 'micro' as const, action: 'skipped' as const, workedMinutes: 20, seconds: 20 })),
  ];

  it('counts back from today while compliance holds at 70 percent', () => {
    const dates = lastNDates(4, '2026-09-28');
    const logs = [...day(dates[3], 8, 2), ...day(dates[2], 7, 3), ...day(dates[1], 5, 5), ...day(dates[0], 9, 1)];
    // Today 80%, yesterday 70%, the day before 50% stops it.
    expect(breakStreak(logs, dates)).toBe(2);
  });

  it('is zero when today falls short', () => {
    const dates = lastNDates(2, '2026-09-28');
    expect(breakStreak([...day(dates[1], 1, 9), ...day(dates[0], 10, 0)], dates)).toBe(0);
  });

  it('is zero when nothing was logged today', () => {
    const dates = lastNDates(2, '2026-09-28');
    expect(breakStreak(day(dates[0], 10, 0), dates)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/core/__tests__/insights.test.ts`
Expected: FAIL, `breakStreak is not a function`.

- [ ] **Step 3: Implement it**

Append to `src/core/insights.ts`, adding `import { breakStats, type BreakLog } from './breaks';` to its imports:

```ts
/** A day counts when at least seven in ten offered breaks were taken. */
const BREAK_STREAK_PCT = 70;

/** Consecutive days ending today whose break compliance held up. */
export function breakStreak(logs: BreakLog[], dates: ISODate[]): number {
  const byDate = new Map<ISODate, BreakLog[]>();
  for (const l of logs) {
    const list = byDate.get(l.date);
    if (list) list.push(l);
    else byDate.set(l.date, [l]);
  }
  return streak(dates, (d) => {
    const day = byDate.get(d);
    if (!day || day.length === 0) return false;
    return breakStats(day).compliancePct >= BREAK_STREAK_PCT;
  });
}
```

Run the test again: expected 3 passed.

- [ ] **Step 4: The Growth section**

In `src/app/(tabs)/growth.tsx`, add `import { breakStats } from '../../core/breaks';`, `breakStreak` to the `../../core/insights` import, and `fill` to the `../../i18n` import. Add this constant beside the other card constants:

```tsx
  const eyeCare = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('brk_eye_care')} meta={`${breakStats(app.state.breaks.filter((b) => summary.dates.includes(b.date))).eyeCareScore}%`} />
      <Card>
        <Row style={{ flexWrap: 'wrap', rowGap: 16 }}>
          {(['micro', 'long', 'posture'] as const).map((k) => {
            const s = breakStats(app.state.breaks.filter((b) => summary.dates.includes(b.date))).byKind[k];
            return (
              <View key={k} style={{ minWidth: 92, flexGrow: 1, gap: 5 }}>
                <Micro>{t(`brk_${k}`)}</Micro>
                <Row style={{ gap: 5, alignItems: 'baseline' }}>
                  <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '300' }}>{s.taken}</Text>
                  <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{`/ ${s.offered} ${t('brk_offered')}`}</Text>
                </Row>
              </View>
            );
          })}
        </Row>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{t('brk_streak')}</Micro>
          <Text style={{ color: C.cyan, fontSize: F.small, fontWeight: '600' }}>{breakStreak(app.state.breaks, summary.dates)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{en('longest_sitting')}</Micro>
          <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>{formatMinutes(sitting)}</Text>
        </Row>
      </Card>
    </View>
  );
```

The repeated `breakStats(...)` call above recomputes on every row, which is wasteful and hard to read. Hoist it instead, immediately above the constant:

```tsx
  const periodBreaks = useMemo(
    () => breakStats(app.state.breaks.filter((b) => summary.dates.includes(b.date))),
    [app.state.breaks, summary.dates],
  );
```

and use `periodBreaks.eyeCareScore` and `periodBreaks.byKind[k]` in the JSX.

Render `{eyeCare}` in both layouts: in the phone return, immediately after `{screenCard}`; in the wide return, replace the `<Cols weights={[1, 1]}>` that holds `{sleepChart}` and `{screenCard}` so it becomes a three-wide row:

```tsx
        <Cols weights={[1, 1, 1]}>
          {sleepChart}
          {screenCard}
          {eyeCare}
        </Cols>
```

- [ ] **Step 5: README**

In `README.md`, replace the `## Status` opening sentence with:

```markdown
v0.4 part 2a. Working: everything in part 1, plus four kinds of screen break
(micro, long, posture, blink) with strictness modes, a daily skip budget,
smart pause during fullscreen video and calls, a work-hours schedule, a
rebuilt break overlay with mobility moves, and an eye-care section on Growth.
```

and in the "Not built yet" paragraph, add `water pace reminders, the app reaching out on its own,` before `phone-to-PC sync`.

- [ ] **Step 6: The full sweep**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -4 && npx expo lint 2>&1 | grep problems`
Expected: clean, all tests passing, `66 problems` or fewer.

Then, with the seeded browser (`npm run seed`, paste into `localStorage['sobat.state.v1']`, reload), check in Marathi at 375 px and 1440 px and tick each:

- Settings shows four break kinds, each with its own intervals, plus strictness, smart pause, schedule and sound. Turning a kind off hides its intervals.
- Setting the micro interval to 1 minute makes the overlay appear within a minute, with a breathing ring and the micro copy.
- The pre-break toast appears about a minute before with the three snooze options; snoozing pushes the break back.
- In strict mode the overlay has no skip. In normal mode the skip count falls and reaches "no skips left".
- A long break shows two mobility moves with their first instruction line.
- Posture arrives as a toast, never as a full screen.
- The desktop break panel names the next kind and its pause and break-now buttons work.
- Growth shows the eye-care card with per-kind counts and a streak.
- Nothing on any of these screens is in English except the units.

Report anything that fails rather than fixing it outside its task.

- [ ] **Step 7: Commit**

```bash
git add src/core/insights.ts src/core/__tests__/insights.test.ts "src/app/(tabs)/growth.tsx" README.md
git commit -m "Eye-care section on Growth, and a break streak

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## What this plan deliberately leaves out

- **Water and outreach.** They are the other two thirds of Part 2 and get their own plans, because each produces working software on its own and mixing them here would make every task depend on the last.
- **The per-monitor always-on-top overlay window.** The spec describes the overlay as its own Tauri window per monitor. This plan keeps the in-app overlay, which is correct in the browser and on Android and adequate on the PC while the Sobat window is focused. The separate window is worth doing only once the rest is proven on the real machine, and it needs a `/break` route that does not exist yet.
- **Bundled chime audio.** The `sound` setting is stored and shown, but nothing plays yet: adding two audio files and an `expo-audio` dependency is a change worth making on its own, after the timing is known to be right.

---

### Task 8: What each platform can actually do

The spec asks for three different behaviours on three platforms, and only the Windows shell was covered above. This task closes the other two.

**Files:**
- Modify: `src/services/platform.ts`
- Modify: `src/services/useBreakMonitor.tsx`
- Modify: `src/store/migrate.ts`
- Modify: `src/core/__tests__/migrate.test.ts`
- Modify: `src/services/useScheduledReminders.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `browserForegroundState(): ForegroundState | null` in `platform.ts`, used as the fallback when the shell is absent.

- [ ] **Step 1: The browser knows less, but not nothing**

A browser tab cannot see other programs, but it can see whether *it* is fullscreen, whether a video is playing picture-in-picture, and whether the tab is hidden. That is enough for the two smart-pause switches to mean something on the web build.

In `src/services/platform.ts`, add above `foregroundState`:

```ts
/**
 * What a plain browser tab can work out about itself. A tab cannot see other
 * programs, so `exe` is always empty and the app list never matches here.
 */
export function browserForegroundState(): ForegroundState | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const doc = document as Document & { pictureInPictureElement?: Element | null };
  const fullscreen = document.fullscreenElement !== null || !!doc.pictureInPictureElement;
  return { fullscreen, exe: '', onCall: false };
}
```

and change `foregroundState` so it falls back to it:

```ts
export async function foregroundState(): Promise<ForegroundState | null> {
  if (!isDesktopShell()) return browserForegroundState();
  try {
    const mod = await import('@tauri-apps/api/core');
    const raw = await mod.invoke<{ fullscreen: boolean; exe: string; onCall: boolean }>('foreground_state');
    return { fullscreen: !!raw.fullscreen, exe: String(raw.exe ?? ''), onCall: !!raw.onCall };
  } catch {
    // The command is missing or failed; fall back to what the page can see.
    return browserForegroundState();
  }
}
```

`Platform` is already imported in this file. Confirm that.

- [ ] **Step 2: A hidden tab is an empty desk**

In `src/services/useBreakMonitor.tsx`, the loop treats "no input" as idle, but a tab that is hidden altogether is a stronger signal: the person is somewhere else entirely. Add this effect beside the other listeners:

```tsx
  // A hidden tab means the person is elsewhere, which counts as a longer
  // absence than merely not typing.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') lastActivity.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
```

This deliberately only resets the activity stamp on *return*. While the tab is hidden the stamp goes stale on its own, so idle grows and `clocksAfterIdle` restarts the clocks, which is exactly the wanted behaviour.

- [ ] **Step 3: A phone should not blank its own screen**

Micro breaks taking over a phone screen every twenty minutes would be intolerable, and the spec says so. Make the default depend on the platform, at migration time, so an existing store is corrected once rather than every launch.

In `src/store/migrate.ts`, add `import { Platform } from 'react-native';` and change `upgradeSettings` so the two screen-taking kinds start off on a phone:

```ts
function upgradeSettings(old: unknown): BreakSettings {
  // A phone should not blank its own screen every twenty minutes. Long breaks
  // and posture still arrive as notifications.
  const phone = Platform.OS !== 'web';
  const base: BreakSettings = phone
    ? { ...DEFAULT_BREAK_SETTINGS, micro: { ...DEFAULT_BREAK_SETTINGS.micro, enabled: false } }
    : DEFAULT_BREAK_SETTINGS;
  if (isV2Settings(old)) return { ...base, ...old };
  const v1 = (isRecord(old) ? old : {}) as V1BreakSettings;
  return {
    ...base,
    enabled: v1.enabled ?? base.enabled,
    micro: {
      ...base.micro,
      everyMinutes: v1.workMinutes ?? base.micro.everyMinutes,
      seconds: v1.breakSeconds ?? base.micro.seconds,
    },
    strictness: v1.allowSkip === false ? 'strict' : 'normal',
    quietStartHour: v1.quietStartHour ?? base.quietStartHour,
    quietEndHour: v1.quietEndHour ?? base.quietEndHour,
  };
}
```

Because the vitest environment is `node`, `Platform.OS` there is not `'web'`, so the existing migration tests would now see micro disabled. Rather than let the tests drift from the browser's behaviour, pin the expectation explicitly. In `src/core/__tests__/migrate.test.ts`, add this test to the `describe('migrateState')` block:

```ts
  it('leaves micro breaks off where the screen is the phone itself', () => {
    // vitest runs under the node platform, which is the non-web branch.
    expect(migrateState(v1).breakSettings.micro.enabled).toBe(false);
    // The kinds that only ever show a notification stay on.
    expect(migrateState(v1).breakSettings.long.enabled).toBe(true);
    expect(migrateState(v1).breakSettings.posture.enabled).toBe(true);
  });
```

and change the first test's assertions so they no longer assume `enabled`:

```ts
  it('carries the old interval and length into the micro break', () => {
    const s = migrateState({ ...v1, breakSettings: { ...v1.breakSettings, workMinutes: 30, breakSeconds: 45 } });
    expect(s.breakSettings.micro.everyMinutes).toBe(30);
    expect(s.breakSettings.micro.seconds).toBe(45);
    expect(s.breakSettings.enabled).toBe(true);
  });
```

(that is unchanged — `enabled` there is the whole monitor, not the micro kind — so confirm it still passes rather than editing it.)

- [ ] **Step 4: The phone's break reminders**

`src/services/useScheduledReminders.ts` registers the notifications that fire while the app is closed. Add the long break to them, respecting the schedule.

In that file, add `long: 'sobat-long-break'` to the `IDS` object, and inside the effect, after the existing `scheduleDaily` calls, add:

```ts
      // The phone cannot blank its own screen, so a long break is a
      // notification. Only inside the working window, if one is set.
      const br = app.state.breakSettings;
      if (br.enabled && br.long.enabled) {
        await scheduleRepeating(IDS.long, br.long.everyMinutes * 60, t('brk_long'), t('brk_long_hint'));
      } else {
        await cancel(IDS.long);
      }
```

and add `app.state.breakSettings` to the effect's dependency array. `scheduleRepeating` and `cancel` are already imported in this file; confirm that.

- [ ] **Step 5: Everything green**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3 && npx expo lint 2>&1 | grep problems`
Expected: clean, all test files passing, `66 problems` or fewer.

- [ ] **Step 6: Check the browser behaviour by hand**

With the seeded app open, set the micro interval to 1 minute in Settings, then put any video or the page itself into fullscreen and confirm no overlay appears while it is fullscreen, and that one appears shortly after leaving fullscreen. Report what you saw.

- [ ] **Step 7: Commit**

```bash
git add src/services/platform.ts src/services/useBreakMonitor.tsx src/store/migrate.ts src/core/__tests__/migrate.test.ts src/services/useScheduledReminders.ts
git commit -m "Smart pause in a plain browser tab, and phone-appropriate break defaults

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
