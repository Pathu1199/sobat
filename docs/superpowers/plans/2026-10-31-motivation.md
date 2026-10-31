# Part A: motivation and design polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dhyey loved and never demotivating, pushing daily consistency: three palettes the user picks from, each with a soft tint at the top of every tab and a reward colour kept for rewards; an expert's sizes for the type, the margins and the tab bar; the list renamed Routine; ➕ that logs anything; a streak shield; medals on a trophy shelf with full-screen celebrations; gold stars on perfect days; a daily challenge from the user's own week; a kind evening teacher; a kind line on "Day so far" when a streak needs today; and no word that scolds, in English, Marathi and Hindi.

**Architecture:** Every rule is pure and tested first, in new core modules: `palette.ts` (the choice), `shield.ts` (one run rule both streaks feed), `perfect.ts`, `challenge.ts`, `medals.ts` (earned, next, shelf, which win next) and `teacher.ts`, plus small additions to `record.ts`, `abhyas.ts`, `chapter.ts`, `checklist.ts`, `pushSchedule.ts` and `addSheet.ts`. Nothing new is stored but `settings.palette` (normalised on load and sync, no version step): medals and challenges are worked out from the logs every time and kept through the `celebrated` ids the old game used. The screens are thin over them: a few new components (`ChallengeCard`, `TeacherCard`, `TrophyShelf`, `MedalArt`, `ShieldNote`, `PaletteSwatches`) and hooks (`useRewards`, `usePerfectOn`), and changes to Today, Progress, Routine, the ➕ sheet, the tab bar, the top bar and the celebration. The old points, camps, badges and weekly challenge are retired once nothing shows them. Words come last.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.25), React Native 0.86.3, react-native-web ~0.21, expo-router ~57.0.23, react-native-reanimated 4.5.1, react-native-svg 15.15.4, expo-haptics ~57.0.3 (already installed), TypeScript ~6.0, vitest 4.1 (TZ pinned to Asia/Kolkata), React Compiler on.

Spec: `docs/superpowers/specs/2026-10-31-motivation-design.md`.

Expo docs read for this plan (SDK 57):
- `https://docs.expo.dev/versions/v57.0.0/sdk/haptics/`: `impactAsync(style?)` and `notificationAsync(type?)` run on Android, iOS and the web (the web through the Vibration API, which needs browser support and hardware that vibrates: iPhone Safari has none); `ImpactFeedbackStyle.Light`; on iOS haptics do nothing in Low Power Mode or with the Taptic Engine off. The app's `useFeedback().haptic('light')` already wraps `impactAsync(ImpactFeedbackStyle.Light)` and skips the web, so the celebration uses it and adds no dependency.
- No other Expo API is new in this plan. Reduce motion is Reanimated's `useReducedMotion`, as the tiles already use it.

## Global Constraints

- Use npm. Any new dependency goes through `npx expo install <package>` (this plan adds none).
- Never push: every push to `main` deploys the website and publishes an APK.
- Run `npx tsc --noEmit`, `npx expo lint`, `npx vitest run` and `cd relay && npx vitest run` before every commit and before declaring done. At the start (`origin/main` at `a88c0f0`): tsc clean, lint clean, 1708 tests passing in 80 files; relay 73 tests passing. No task touches `relay/`, so on a branch with later relay commits on top (`abhyas-polish` at `e45bad4` has one, the Drive fix) every step applies the same and only the relay count differs (74 there).
- Every new i18n key goes into all three dicts in `src/i18n/index.ts` (`en`, `mr`, `hi`). Before adding a key, `grep -nE "^  <key>:" src/i18n/index.ts` must print nothing (a duplicate key is a TS1117 error). New keys go at the end of each dict: each step replaces the dict's last lines and its closing `};`, as written.
- The app's name in a sentence comes from `app_name` (or is ध्येय in Marathi and Hindi); no new string names it.
- Never add `eslint-disable` comments (Task 13 removes the two the old celebration had).
- Keep every id, storage key and channel id: the tab id, the Today card id, the data keys and the route stay `abhyas`; `sobat.state.v1`, `celebrated` and its old ids stay; no notification channel changes.
- No relay change and no change to the `PushSchedule` shape: the relay must not need a redeploy for Part A.
- `STATE_VERSION` stays 8: the one new stored value, `settings.palette`, is normalised on every load and sync landing.
- Do not create or edit `ios/` or `android/` (generated and git-ignored).
- Match the surrounding comment density and naming; refer to the person using the app as "the user" or "they" in comments and copy.
- Every edit below names the exact text to replace, so a shifted line still matches; replace each block once.

## File Structure

| File | Responsibility in this plan |
|---|---|
| `src/core/palette.ts` (new) | The three palette ids, the default, `paletteOf` |
| `src/ui/theme.ts` | Three palettes × light/dark with `tint`, `gold`, `goldSoft`, `goldInk`; `applyTheme(mode, palette)`; type 48/22; `TITLE_WEIGHT`; gutter 20, card padding 18 |
| `src/ui/barGeometry.ts` (new) | The tab bar's sizes, tested for Devanagari at 1.25 |
| `src/core/shield.ts` (new) | `runOf`: a run of days with the one-rest-day-a-week shield; `shieldNote` |
| `src/core/record.ts`, `abhyas.ts`, `chapter.ts` | `recordRun`, `streakRun`, the shield option; a 120-day streak window |
| `src/core/perfect.ts` (new) | `perfectDay`, `perfectWeeks` |
| `src/core/challenge.ts` (new) | The daily challenge: choices, the day's one, progress, the count done, words |
| `src/core/medals.ts` (new) | Medals earned and next, the shelf, the words, `nextWin`, `withCelebrated` |
| `src/core/teacher.ts` (new) | `dayScore`, `teacherWords` |
| `src/core/checklist.ts`, `pushSchedule.ts` | The streak's kind line on "Day so far" |
| `src/core/addSheet.ts`, `bar.ts` | `quickActions`; the ➕ named "Add" |
| `src/core/types.ts`, `src/store/defaults.ts`, `migrate.ts`, `AppProvider.tsx` | `settings.palette`; the store's streaks with the shield; `streakCovered`; pruned `celebrated` |
| `src/app/_layout.tsx`, `src/ui/TopBar.tsx`, `src/ui/components.tsx` | The palette applied; the tint band; `Screen`'s `onBand` |
| `src/components/TabBar.tsx`, `StreakPill.tsx`, `CaloriesLeft.tsx`, `WeightTrendCard.tsx`, `PaletteSwatches.tsx` (new), `src/app/settings.tsx` | The bar's sizes; gold pill; heavier big numbers; the swatches |
| `src/components/AddSheet.tsx` | The quick actions and the Routine panel |
| `src/components/useRewards.ts`, `ChallengeCard.tsx`, `TeacherCard.tsx` (new); `CoachLine.tsx`, `DayReview.tsx`, `src/app/(tabs)/index.tsx` | Today's challenge and the evening teacher |
| `src/components/MedalArt.tsx`, `ShieldNote.tsx`, `TrophyShelf.tsx`, `src/store/usePerfectOn.ts` (new); `RecordCalendar.tsx`, `src/app/(tabs)/progress.tsx`, `abhyas.tsx`, `src/app/journey.tsx`, `src/core/abhyasView.ts` | The trophy room, the stars, the shield notes |
| `src/components/Celebration.tsx` | Full-screen medals, the small challenge sheet |
| `src/core/game.ts`, `src/components/useGame.ts` | The climb only |
| `src/i18n/index.ts` | New words in all three languages; the retired words removed; Routine; the kind rewrites |

---

### Task 1: Three palettes with a reward colour and a top tint, every word at 4.5:1

The user picks one of three looks (Decision 9). Each palette has the same tokens, so a switch leaves no colour behind; four tokens are new in every palette: `tint` (the band at the top of every tab), `gold`, `goldSoft` and `goldInk` (rewards only). Emerald stays the default and keeps its shadow colour, so the existing shadow tests hold. The mockup's emerald `#0E8A6A` carries white words at 4.32:1, so the action colour is one shade deeper, `#0C8263` (4.78:1); the light status colours go a shade deeper so they hold 4.5:1 on the new tints.

**Files:**
- Create: `src/core/__tests__/palette.test.ts`
- Create: `src/core/palette.ts`
- Modify: `src/ui/__tests__/contrast.test.ts`
- Modify: `src/ui/__tests__/surfaces.test.ts`
- Modify: `src/ui/theme.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces, in `src/core/palette.ts`: `PALETTE_IDS: readonly ['emerald', 'indigo', 'saffron']`, `type PaletteId`, `DEFAULT_PALETTE: PaletteId`, `paletteOf(v: unknown): PaletteId`.
- Produces, in `src/ui/theme.ts`: `type Palette` (the token object), `PALETTE_SETS: Record<PaletteId, Record<ThemeMode, Palette>>`, `PALETTES` (now `PALETTE_SETS.emerald`), tokens `C.tint`, `C.gold`, `C.goldSoft`, `C.goldInk`, `paletteNow(): PaletteId`, `applyTheme(mode: ThemeMode, palette?: PaletteId): void` (the palette in use unless named), `cardShadow(mode: ThemeMode, web: boolean, palette?: PaletteId): ViewStyle`, `GOLD_NOTE = { fill: 'goldSoft', words: 'goldInk' }`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/palette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, PALETTE_IDS, paletteOf } from '../palette';

describe('paletteOf', () => {
  it('reads each of the three looks as stored', () => {
    for (const id of PALETTE_IDS) expect(paletteOf(id)).toBe(id);
    expect(PALETTE_IDS).toEqual(['emerald', 'indigo', 'saffron']);
  });

  it('reads anything else as emerald and gold, the default: a setting not stored yet, a damaged file, a look from a newer build', () => {
    expect(DEFAULT_PALETTE).toBe('emerald');
    for (const v of [undefined, null, '', 'rose', 3, {}, ['indigo']]) expect(paletteOf(v), String(v)).toBe('emerald');
  });
});
```

Replace the whole `src/ui/__tests__/contrast.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from '../contrast';
import { STRIP_CHOSEN, STRIP_DOT, STRIP_TODAY, stripDot } from '../stripGeometry';
import { PALETTE_IDS } from '../../core/palette';
import { AMBER_NOTE, GOLD_NOTE, PALETTE_SETS, PALETTES, type ThemeMode } from '../theme';

const MODES: ThemeMode[] = ['light', 'dark'];
/** What words sit on: the page, its lighter step, the cards, and the tint at the top of every tab. */
const SURFACES = ['bg', 'pageAlt', 'card', 'cardAlt', 'tint'] as const;
/** Every token the app sets words in. */
const WORDS = ['text', 'textDim', 'textFaint', 'accentText', 'red', 'amber', 'green', 'cyan', 'violet', 'pink'] as const;

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('is the same whichever colour comes first', () => {
    expect(contrastRatio('#12A57F', '#0E1B1F')).toBe(contrastRatio('#0E1B1F', '#12A57F'));
  });

  it('reads three-digit hex', () => {
    expect(luminance('#fff')).toBeCloseTo(1, 5);
    expect(luminance('#000')).toBe(0);
  });
});

describe('palette', () => {
  it('has the same tokens in every palette and mode, so a switch leaves no colour behind', () => {
    const keys = Object.keys(PALETTES.dark).sort();
    for (const id of PALETTE_IDS) for (const mode of MODES) expect(Object.keys(PALETTE_SETS[id][mode]).sort(), `${id} ${mode}`).toEqual(keys);
  });

  for (const [id, mode] of PALETTE_IDS.flatMap((p) => MODES.map((m) => [p, m] as const))) {
    const P = PALETTE_SETS[id][mode];
    describe(`${id} ${mode}`, () => {
      it(`${mode}: every colour that carries words reads at 4.5:1 on every surface`, () => {
        for (const fg of WORDS) {
          for (const bg of SURFACES) {
            expect(contrastRatio(P[fg], P[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it(`${mode}: pageAlt is the page one step lighter, short of a card`, () => {
        expect(luminance(P.pageAlt)).toBeGreaterThan(luminance(P.bg));
        expect(luminance(P.pageAlt)).toBeLessThan(luminance(P.card));
      });

      it(`${mode}: words on the accent use onAccent at 4.5:1`, () => {
        expect(contrastRatio(P.onAccent, P.accent)).toBeGreaterThanOrEqual(4.5);
      });

      it(`${mode}: soft buttons and status chips keep their words readable`, () => {
        expect(contrastRatio(P.accentText, P.accentDim), 'accentText on accentDim').toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(P.accentText, P.accentSoft), 'accentText on accentSoft').toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(P.red, P.redSoft), 'red on redSoft').toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(P.amber, P.amberSoft), 'amber on amberSoft').toBeGreaterThanOrEqual(4.5);
      });

      it(`${mode}: the amber note on Today reads at 4.5:1, its words and its △ in dark amber on soft amber`, () => {
        expect(contrastRatio(P[AMBER_NOTE.words], P[AMBER_NOTE.fill])).toBeGreaterThanOrEqual(4.5);
      });

      it(`${mode}: the current meal's block on accentSoft sets its words, the small ones too, in text or accentText`, () => {
        for (const fg of ['text', 'accentText'] as const) {
          expect(contrastRatio(P[fg], P.accentSoft), `${fg} on accentSoft`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it(`${mode}: the week strip's dots stand out at 3:1 on the page and the card (a dot sits under today's pill, never on it)`, () => {
        for (const [kind, token] of Object.entries(STRIP_DOT)) {
          for (const bg of ['bg', 'card', 'cardAlt', 'tint'] as const) {
            expect(contrastRatio(P[token], P[bg]), `${kind} dot (${token}) on ${bg}`).toBeGreaterThanOrEqual(3);
          }
        }
      });

      it(`${mode}: a day filled in from the plan keeps its dot at full colour, 3:1, and is told apart by its shape, never faded`, () => {
        for (const mark of ['full', 'missing', 'today'] as const) {
          const plain = stripDot(mark, false);
          const fromPlan = stripDot(mark, true);
          expect(fromPlan.kind, mark).toBe('ringDot');
          expect(fromPlan.kind, mark).not.toBe(plain.kind);
          if (plain.kind === 'none' || fromPlan.kind === 'none') throw new Error(mark);
          expect(fromPlan.color, mark).toBe(plain.color);
          for (const bg of ['bg', 'card', 'cardAlt', 'tint'] as const) {
            expect(contrastRatio(P[fromPlan.color], P[bg]), `${mark} from the plan on ${bg}`).toBeGreaterThanOrEqual(3);
          }
        }
        expect(stripDot('planned', false)).toEqual({ kind: 'ring', color: STRIP_DOT.outline });
        // A day of meals all skipped and nothing eaten: a quiet grey dot, never the teal of a full day.
        expect(stripDot('skipped', false)).toEqual({ kind: 'dot', color: STRIP_DOT.skipped });
        expect(stripDot('skipped', true)).toEqual({ kind: 'dot', color: STRIP_DOT.skipped });
        expect(STRIP_DOT.skipped).not.toBe(STRIP_DOT.full);
        expect(stripDot('off', true)).toEqual({ kind: 'none' });
        expect(stripDot('unplanned', false)).toEqual({ kind: 'none' });
        expect(stripDot('none', false)).toEqual({ kind: 'none' });
      });

      it(`${mode}: the chosen day's outline is the full dot's colour, 3:1 on the page and the card`, () => {
        expect(STRIP_CHOSEN).toBe(STRIP_DOT.full);
        for (const bg of ['bg', 'card', 'cardAlt', 'tint'] as const) {
          expect(contrastRatio(P[STRIP_CHOSEN], P[bg]), `chosen outline on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      });

      it(`${mode}: today's pill on the week strip sets its weekday and date in accentText on accentSoft, at 4.5:1`, () => {
        expect(contrastRatio(P[STRIP_TODAY.words], P[STRIP_TODAY.fill])).toBeGreaterThanOrEqual(4.5);
      });

      it(`${mode}: the reward words, ink on the reward fill, read at 4.5:1, and the ink holds 4.5:1 on every page and card too`, () => {
        expect(contrastRatio(P[GOLD_NOTE.words], P[GOLD_NOTE.fill])).toBeGreaterThanOrEqual(4.5);
        for (const bg of SURFACES) expect(contrastRatio(P.goldInk, P[bg]), `goldInk on ${bg}`).toBeGreaterThanOrEqual(4.5);
      });

      it(`${mode}: the celebration's words, on the reward fill, read at 4.5:1`, () => {
        for (const fg of ['text', 'textDim'] as const) expect(contrastRatio(P[fg], P.goldSoft), `${fg} on goldSoft`).toBeGreaterThanOrEqual(4.5);
      });
    });
  }

  it('has no ghost text colour left to reach for', () => {
    for (const id of PALETTE_IDS) for (const mode of MODES) expect(Object.keys(PALETTE_SETS[id][mode]), `${id} ${mode}`).not.toContain('textGhost');
  });

  it('keeps emerald and gold as the default palette', () => {
    expect(PALETTES).toBe(PALETTE_SETS.emerald);
  });
});
```

In `src/ui/__tests__/surfaces.test.ts` replace

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { luminance } from '../contrast';
import { applyTheme, cardShadow, PALETTES, S } from '../theme';
import { TILE_RADIUS } from '../tileGeometry';

describe('cardShadow', () => {
```

with

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { PALETTE_IDS } from '../../core/palette';
import { luminance } from '../contrast';
import { applyTheme, C, cardShadow, PALETTE_SETS, PALETTES, paletteNow, S, themeMode } from '../theme';
import { TILE_RADIUS } from '../tileGeometry';

describe('cardShadow', () => {
```

In `src/ui/__tests__/surfaces.test.ts` replace

```ts
    }
  });

  it('is darker than the page it falls on in both themes, so it reads as a shadow and never as a glow', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(luminance(PALETTES[mode].shadow), mode).toBeLessThan(luminance(PALETTES[mode].bg));
    }
  });
});

describe('S.shadow', () => {
  afterEach(() => applyTheme('dark'));

  it('follows the theme: applyTheme swaps it with the palette', () => {
    // Vitest runs as a phone (react-native is stubbed with Platform.OS 'ios').
```

with

```ts
    }
  });

  it('is darker than the page it falls on in every palette and both themes, so it reads as a shadow and never as a glow', () => {
    for (const id of PALETTE_IDS) {
      for (const mode of ['light', 'dark'] as const) {
        expect(luminance(PALETTE_SETS[id][mode].shadow), `${id} ${mode}`).toBeLessThan(luminance(PALETTE_SETS[id][mode].bg));
      }
    }
  });

  it("takes a palette's own shadow colour when one is named", () => {
    expect(cardShadow('light', false, 'saffron')).toMatchObject({ shadowColor: PALETTE_SETS.saffron.light.shadow });
  });
});

describe('S.shadow', () => {
  afterEach(() => applyTheme('dark', 'emerald'));

  it('follows the theme: applyTheme swaps it with the palette', () => {
    // Vitest runs as a phone (react-native is stubbed with Platform.OS 'ios').
```

In `src/ui/__tests__/surfaces.test.ts` replace

```ts
    expect(S.shadow).toEqual(cardShadow('light', false));
    applyTheme('dark');
    expect(S.shadow).toEqual(cardShadow('dark', false));
  });
});
```

with

```ts
    expect(S.shadow).toEqual(cardShadow('light', false));
    applyTheme('dark');
    expect(S.shadow).toEqual(cardShadow('dark', false));
  });
});

describe('applyTheme', () => {
  afterEach(() => applyTheme('dark', 'emerald'));

  it('swaps the live colours for the palette and mode asked for, and keeps the palette when only the mode changes', () => {
    applyTheme('light', 'indigo');
    expect(themeMode()).toBe('light');
    expect(paletteNow()).toBe('indigo');
    expect(C.accent).toBe(PALETTE_SETS.indigo.light.accent);
    expect(S.shadow).toEqual(cardShadow('light', false, 'indigo'));
    applyTheme('dark');
    expect(paletteNow()).toBe('indigo');
    expect(C.bg).toBe(PALETTE_SETS.indigo.dark.bg);
    applyTheme('dark', 'emerald');
    expect(C).toEqual(PALETTES.dark);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/palette.test.ts src/ui/__tests__/contrast.test.ts src/ui/__tests__/surfaces.test.ts`
Expected: FAIL, because the new tokens and palettes do not exist yet: `Test Files  3 failed (3)`, the first reads `Error: Cannot find module '../palette'`

- [ ] **Step 3: Create `src/core/palette.ts`**

Create `src/core/palette.ts`:

```ts
/**
 * The three looks the user picks from in Settings, each one action colour, a
 * soft tint at the top of every tab and a reward colour kept for rewards:
 * emerald and gold (the default), indigo and amber, forest and saffron. The
 * colours themselves are in src/ui/theme.ts; this is the choice as it is
 * stored and synced. Pure.
 */
export const PALETTE_IDS = ['emerald', 'indigo', 'saffron'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export const DEFAULT_PALETTE: PaletteId = 'emerald';

/** A stored choice as the app reads it: one of the three, anything else (a missing setting, a damaged file) the default. */
export function paletteOf(v: unknown): PaletteId {
  return typeof v === 'string' && (PALETTE_IDS as readonly string[]).includes(v) ? (v as PaletteId) : DEFAULT_PALETTE;
}
```

- [ ] **Step 4: Change `src/ui/theme.ts`**

Replace the whole `src/ui/theme.ts` with:

```ts
/**
 * Design tokens. Everything visual comes from here, so a change to the palette
 * moves the whole app at once.
 *
 * Three palettes the user picks from (core/palette.ts), each in light and
 * dark: one action colour for buttons, ticks and the current item, a soft
 * tint behind the top of every tab, a page and flat cards lifted by a soft
 * shadow, and a reward colour (gold, amber or saffron) used only where
 * something was earned: medals, the shield note, stars, celebrations and the
 * best-day line. Every colour that carries words reads at 4.5:1 or more on the
 * surfaces it sits on, in every palette and both modes
 * (src/ui/__tests__/contrast.test.ts holds them to that).
 */
import { Platform, type ViewStyle } from 'react-native';
import { DEFAULT_PALETTE, type PaletteId } from '../core/palette';

const listeners = new Set<() => void>();

export type ThemeMode = 'dark' | 'light';

/** The status colours in daylight, the same in every palette: each holds 4.5:1 on every page, card and tint of the three. */
const STATUS_LIGHT = {
  cyan: '#066E8A',
  cyanSoft: '#CDEEF6',
  violet: '#6E52E6',
  violetSoft: '#E6E0FD',
  green: '#0F7646',
  amber: '#8A5E07',
  amberSoft: '#FBEBC6',
  red: '#BF2A40',
  redSoft: '#FBDDE2',
  pink: '#B92B6E',
};

/** The status colours in the dark, the same in every palette. */
const STATUS_DARK: typeof STATUS_LIGHT = {
  cyan: '#38C6E8',
  cyanSoft: '#14566A',
  violet: '#A48BFF',
  violetSoft: '#463A86',
  green: '#3BD68B',
  amber: '#F5B941',
  amberSoft: '#5A3C0E',
  red: '#F2677A',
  redSoft: '#401922',
  pink: '#F06AA7',
};

/** Emerald and gold in the dark: every palette has these tokens, in this order. */
const DARK = {
  bg: '#0B1014',
  bgAlt: '#0F161B',
  /** The page one step lighter than bg, short of a card: behind sheets and tiles. */
  pageAlt: '#0F161B',
  card: '#151D23',
  cardAlt: '#1C262D',
  cardHigh: '#24313A',
  border: '#22303A',
  borderStrong: '#30414D',

  text: '#F1F6F5',
  textDim: '#A3B3B8',
  textFaint: '#7E9095',

  accent: '#2DD4A3',
  accentSoft: '#145243',
  accentDim: '#10302A',
  /** The accent when it is the colour of words: links, the selected segment, a soft button's label. */
  accentText: '#2DD4A3',
  /** Ink for words and icons on an accent fill: dark on the bright accents of the dark mode, white on the deep ones of daylight. */
  onAccent: '#0B1014',

  /** The soft band behind the top of every tab: words on it hold 4.5:1 as on the page. */
  tint: '#0E1C19',
  /** The reward metal: a medal's ring, a sparkle. Never words, and never the only mark of anything. */
  gold: '#E2B654',
  /** The fill of a reward surface: the shield note, a perfect day, the celebration's page. */
  goldSoft: '#3A2E14',
  /** Words and marks on a reward surface (a star, a medal's number): 4.5:1 on goldSoft and on every page and card colour. */
  goldInk: '#F3D99A',

  ...STATUS_DARK,

  white: '#FFFFFF',
  scrim: 'rgba(3, 8, 10, 0.72)',
  /** The colour of every shadow. Black in the dark: a tinted shadow would be lighter than the page and show as a glow. */
  shadow: '#000000',
};

export type Palette = typeof DARK;

/**
 * Emerald and gold in daylight. The action colour is the chosen #0E8A6A one
 * shade deeper, #0C8263, so white words on a button hold 4.5:1 (4.8; the
 * lighter shade gave 4.3); teal words are deeper still.
 */
const LIGHT: Palette = {
  bg: '#F3F7F6',
  bgAlt: '#FFFFFF',
  pageAlt: '#F8FBFA',
  card: '#FFFFFF',
  cardAlt: '#EEF4F2',
  cardHigh: '#E0EBE7',
  border: '#E2E9E7',
  borderStrong: '#C6D5D1',
  text: '#14201D',
  textDim: '#43534F',
  textFaint: '#5D6C68',
  accent: '#0C8263',
  accentSoft: '#E2F3EC',
  accentDim: '#EEF8F4',
  accentText: '#0A6B52',
  onAccent: '#FFFFFF',
  tint: '#E9F4F0',
  gold: '#B98A2C',
  goldSoft: '#F6EEDC',
  goldInk: '#654A0F',
  ...STATUS_LIGHT,
  white: '#FFFFFF',
  scrim: 'rgba(20, 32, 29, 0.45)',
  shadow: '#10211D',
};

/** Indigo and amber in daylight: a modern, focused look. */
const INDIGO_LIGHT: Palette = {
  bg: '#F4F5FB',
  bgAlt: '#FFFFFF',
  pageAlt: '#F9FAFD',
  card: '#FFFFFF',
  cardAlt: '#EEEFF8',
  cardHigh: '#E1E3F2',
  border: '#E3E5F2',
  borderStrong: '#C9CCE3',
  text: '#171A2E',
  textDim: '#474B66',
  textFaint: '#5F637E',
  accent: '#4B4FD6',
  accentSoft: '#E8E9FB',
  accentDim: '#F1F1FD',
  accentText: '#3E42C4',
  onAccent: '#FFFFFF',
  tint: '#ECEDFB',
  gold: '#C2852A',
  goldSoft: '#F8EEDD',
  goldInk: '#6B450C',
  ...STATUS_LIGHT,
  white: '#FFFFFF',
  scrim: 'rgba(23, 26, 46, 0.45)',
  shadow: '#171A2E',
};

/** Indigo and amber in the dark. */
const INDIGO_DARK: Palette = {
  bg: '#0D0F1A',
  bgAlt: '#11131F',
  pageAlt: '#11131F',
  card: '#171A2B',
  cardAlt: '#1E2236',
  cardHigh: '#282C44',
  border: '#242840',
  borderStrong: '#343956',
  text: '#EEF0FA',
  textDim: '#A9ADC6',
  textFaint: '#8589A6',
  accent: '#8E91F7',
  accentSoft: '#2D2F6B',
  accentDim: '#1D1F45',
  accentText: '#A5A8FA',
  onAccent: '#0D0F1A',
  tint: '#151830',
  gold: '#E8B25E',
  goldSoft: '#3A2C12',
  goldInk: '#F5D9A3',
  ...STATUS_DARK,
  white: '#FFFFFF',
  scrim: 'rgba(5, 6, 14, 0.72)',
  shadow: '#000000',
};

/** Forest and saffron in daylight: deep green actions on a warm ivory page, saffron rewards. */
const SAFFRON_LIGHT: Palette = {
  bg: '#F8F5EF',
  bgAlt: '#FFFFFF',
  pageAlt: '#FBF9F5',
  card: '#FFFFFF',
  cardAlt: '#F3EEE5',
  cardHigh: '#E9E1D3',
  border: '#ECE4D7',
  borderStrong: '#D6CCBB',
  text: '#1E1A14',
  textDim: '#504A3F',
  textFaint: '#6A6254',
  accent: '#0F6B52',
  accentSoft: '#E2EFE8',
  accentDim: '#EEF6F2',
  accentText: '#0F6B52',
  onAccent: '#FFFFFF',
  tint: '#FBEEDB',
  gold: '#D9822B',
  goldSoft: '#FBEBD8',
  goldInk: '#6E3B08',
  ...STATUS_LIGHT,
  white: '#FFFFFF',
  scrim: 'rgba(30, 26, 20, 0.45)',
  shadow: '#1E1A14',
};

/** Forest and saffron in the dark. */
const SAFFRON_DARK: Palette = {
  bg: '#12100B',
  bgAlt: '#17140F',
  pageAlt: '#17140F',
  card: '#1E1A14',
  cardAlt: '#26211A',
  cardHigh: '#302A21',
  border: '#2D271E',
  borderStrong: '#3F372B',
  text: '#F6F1E8',
  textDim: '#B8AE9E',
  textFaint: '#958B7B',
  accent: '#3CC79A',
  accentSoft: '#15453A',
  accentDim: '#10302A',
  accentText: '#4FD1A6',
  onAccent: '#12100B',
  tint: '#231B10',
  gold: '#F0A24F',
  goldSoft: '#3D2810',
  goldInk: '#F8D2A6',
  ...STATUS_DARK,
  white: '#FFFFFF',
  scrim: 'rgba(8, 6, 3, 0.72)',
  shadow: '#000000',
};

/** Every palette in both modes. */
export const PALETTE_SETS: Record<PaletteId, Record<ThemeMode, Palette>> = {
  emerald: { dark: DARK, light: LIGHT },
  indigo: { dark: INDIGO_DARK, light: INDIGO_LIGHT },
  saffron: { dark: SAFFRON_DARK, light: SAFFRON_LIGHT },
};

/** The default palette, emerald and gold, in both modes: what a pure helper or a test reads when no palette is named. */
export const PALETTES: Record<ThemeMode, Palette> = PALETTE_SETS.emerald;

/**
 * The live palette. Every component reads from this object at render, so a
 * switch is an Object.assign plus a remount of the tree (ThemeProvider does
 * that); modules that bake colours into a StyleSheet subscribe to rebuild.
 */
export const C: Palette = { ...DARK };
let current: ThemeMode = 'dark';
let currentPalette: PaletteId = DEFAULT_PALETTE;

export function themeMode(): ThemeMode {
  return current;
}

/** The palette in use. */
export function paletteNow(): PaletteId {
  return currentPalette;
}

/** Light or dark, in a palette (the one in use unless named). */
export function applyTheme(mode: ThemeMode, palette: PaletteId = currentPalette): void {
  if (mode === current && palette === currentPalette) return;
  current = mode;
  currentPalette = palette;
  Object.assign(C, PALETTE_SETS[palette][mode]);
  S.shadow = cardShadow(mode, WEB, palette);
  listeners.forEach((fn) => fn());
}

export function onThemeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}


const WEB = Platform.OS === 'web';

/** "#10211D" and 0.06 as "rgba(16,33,29,0.06)". */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(h.slice(at, at + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * The soft shadow a card or a tile takes in place of an outline, for a theme
 * and a palette (the default unless named): faint in daylight, stronger in the dark so it still shows on the deep page.
 * A phone gets the shadow props (elevation on Android); the web gets a
 * boxShadow, a tight contact shadow under a wide soft one. Pure.
 */
export function cardShadow(mode: ThemeMode, web: boolean, palette: PaletteId = DEFAULT_PALETTE): ViewStyle {
  const color = PALETTE_SETS[palette][mode].shadow;
  const alpha = mode === 'dark' ? 0.3 : 0.06;
  if (web) return { boxShadow: `0 1px 2px ${rgba(color, alpha)}, 0 8px 24px ${rgba(color, alpha)}` };
  return { shadowColor: color, shadowOpacity: alpha, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 };
}

export const S = {
  gap: 12,
  /** Between the cards and blocks of a page. */
  cardGap: 16,
  pad: 16,
  padLg: 20,
  /** Inside a card. */
  cardPad: 16,
  /** Corners: cards and tiles. */
  radius: 20,
  /** A sheet's top corners (all four where it opens as a centred panel). */
  radiusSheet: 24,
  /** Buttons, text boxes and the blocks inside a card. */
  radiusSm: 14,
  /** Chips. */
  radiusXs: 12,
  hairline: 1,
  /** The shadow under a card or a tile, for the theme in use: applyTheme replaces it, so read it at render. */
  shadow: cardShadow(current, WEB),
  /** The smallest a control may be under a finger, in points. */
  touch: 44,
  gutter: 16,
  gutterWide: 24,
  maxWide: 1360,
};

/** Durations in ms. One curve for everything, ease-out cubic. */
export const M = { fast: 180, base: 320, slow: 600 };

/**
 * The four type sizes at scale 1: the one big number a screen is about, titles,
 * body text, and small text (labels and captions use it too). Two weights go
 * with them, '400' for reading and '500' for names, numbers and buttons.
 */
const F_BASE = {
  number: 44,
  title: 20,
  body: 16,
  small: 13,
};

/** The live type sizes: F_BASE times the person's text-size setting. Mutated by applyTextScale, like C. */
export const F: typeof F_BASE = { ...F_BASE };
export const TEXT_SCALES = [0.9, 1, 1.12, 1.25] as const;
let scaleNow = 1;

export function textScale(): number {
  return scaleNow;
}

/** The four sizes for a text-size setting, rounded to whole points. */
export function scaledSizes(scale: number): typeof F_BASE {
  const out = { ...F_BASE };
  for (const k of Object.keys(F_BASE) as (keyof typeof F_BASE)[]) out[k] = Math.round(F_BASE[k] * scale);
  return out;
}

/**
 * Line height for a size that is already scaled: pass an F value. 1.45 times
 * the size leaves room for Devanagari matras above and below the line at every
 * text scale. `digits` is for a number on its own, which has no matras.
 */
export function lh(size: number, digits = false): number {
  return Math.round(size * (digits ? 1.15 : 1.45));
}

export function applyTextScale(scale: number): void {
  if (scale === scaleNow) return;
  scaleNow = scale;
  Object.assign(F, scaledSizes(scale));
  MICRO.fontSize = F.small;
  MICRO.lineHeight = lh(F.small);
  listeners.forEach((fn) => fn());
}

/** The small label over a section or beside a stat: normal case, no letter spacing, quiet. */
export const MICRO = {
  fontSize: F.small,
  lineHeight: lh(F.small),
  fontWeight: '500' as const,
};

/** A one-line warning note on a page (Today's low-intake note): dark amber words on soft amber, never red, 4.5:1 in both themes (the contrast test holds it). */
export const AMBER_NOTE = { fill: 'amberSoft', words: 'amber' } as const satisfies Record<string, keyof Palette>;

/** A reward note (the shield note, the best-day line, a perfect day): reward ink on the reward fill, 4.5:1 in every palette and mode (the contrast test holds it). */
export const GOLD_NOTE = { fill: 'goldSoft', words: 'goldInk' } as const satisfies Record<string, keyof Palette>;

export function severityColor(s: 'good' | 'watch' | 'act') {
  return s === 'good' ? C.accent : s === 'watch' ? C.amber : C.red;
}

export function readinessColor(l: 'green' | 'yellow' | 'red') {
  return l === 'green' ? C.accent : l === 'yellow' ? C.amber : C.red;
}

/** Green when the value is good, amber when it is not, quiet when unknown. */
export function scoreColor(value: number | null) {
  if (value === null) return C.textFaint;
  if (value >= 80) return C.cyan;
  if (value >= 60) return C.accent;
  if (value >= 35) return C.amber;
  return C.red;
}

/** The lift under something floating (the tab bar, the chosen segment): soft and wide in daylight, barely there in the dark. Cards and tiles take S.shadow. */
export function lift(level: 1 | 2 = 1) {
  const dark = current === 'dark';
  return {
    shadowColor: C.shadow,
    shadowOpacity: dark ? 0.35 : level === 1 ? 0.07 : 0.14,
    shadowRadius: level === 1 ? 18 : 24,
    shadowOffset: { width: 0, height: level === 1 ? 6 : 10 },
    elevation: level === 1 ? 2 : 6,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/core/__tests__/palette.test.ts src/ui/__tests__/contrast.test.ts src/ui/__tests__/surfaces.test.ts`
Expected: PASS, 92 tests.

- [ ] **Step 6: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1766 tests passing; relay 73 tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/core/__tests__/palette.test.ts src/core/palette.ts src/ui/__tests__/contrast.test.ts src/ui/__tests__/surfaces.test.ts src/ui/theme.ts
git commit -m "$(cat <<'EOF'
Dhyey can wear three palettes, emerald and gold, indigo and amber, and forest and saffron, each in light and dark, with a soft tint for the top of every tab and a reward colour kept for rewards; every word in every palette reads at 4.5:1, and emerald's action colour is a shade deeper than the mockup's so white words on a button do too

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Bigger type where it matters, wider margins, and the tab bar's sizes

Decision 1's sizes: the big number 48 and screen titles 22 (body 16 and small 13 stay), a third weight `'600'` for those two only, the screen's side margin 20, cards 18 inside, 16 between cards, and the tab bar's numbers in one pure module, tested so a Devanagari label never clips at text scale 1.25 (the bar grows from 60 to 64 there). The screen, the week strip's row and its swipe edges follow the new margin in the same task, so `stripRowWidth` never disagrees with the layout. At 20 points a side two tiles are no longer square on a 360 point phone (3 points taller than wide); the tile test now says so.

**Files:**
- Modify: `src/components/WeekStrip.tsx`
- Create: `src/ui/__tests__/barGeometry.test.ts`
- Modify: `src/ui/__tests__/stripGeometry.test.ts`
- Modify: `src/ui/__tests__/surfaces.test.ts`
- Modify: `src/ui/__tests__/tileGeometry.test.ts`
- Modify: `src/ui/__tests__/type.test.ts`
- Create: `src/ui/barGeometry.ts`
- Modify: `src/ui/components.tsx`
- Modify: `src/ui/stripGeometry.ts`
- Modify: `src/ui/theme.ts`

**Interfaces:**
- Consumes: `lh`, `S`, `TEXT_SCALES` from `src/ui/theme.ts`.
- Produces: `F.number` 48, `F.title` 22; `TITLE_WEIGHT = '600'`; `S.gutter` 20, `S.cardPad` 18; in `src/ui/barGeometry.ts`: `BAR_HEIGHT = 60`, `TAB_ICON = 24`, `TAB_LABEL = 12`, `TAB_PILL = { width: 56, height: 32 }`, `TAB_PAD = 4`, `TAB_GAP = 2`, `PLUS_SIZE = 56`, `PLUS_LIFT = 28`, `tabLabelSize(scale: number): number`, `barHeight(scale: number): number`.

- [ ] **Step 1: Write the failing tests**

Create `src/ui/__tests__/barGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BAR_HEIGHT, barHeight, PLUS_LIFT, PLUS_SIZE, TAB_GAP, TAB_ICON, TAB_LABEL, TAB_PAD, TAB_PILL, tabLabelSize } from '../barGeometry';
import { lh, S, TEXT_SCALES } from '../theme';

describe('the tab bar', () => {
  it('is 60 tall with icons 24, labels 12, the chosen pill 56 × 32 and ➕ 56 across, lifted half its height', () => {
    expect([BAR_HEIGHT, TAB_ICON, TAB_LABEL, PLUS_SIZE]).toEqual([60, 24, 12, 56]);
    expect(TAB_PILL).toEqual({ width: 56, height: 32 });
    expect(PLUS_LIFT).toBe(28);
  });

  it('scales its labels with the text size, in whole points', () => {
    expect(TEXT_SCALES.map(tabLabelSize)).toEqual([11, 12, 13, 15]);
  });

  it('holds the pill and a label with room for Devanagari matras at every text size, growing only past 60 when the label needs it', () => {
    expect(barHeight(1)).toBe(60);
    for (const scale of TEXT_SCALES) {
      const label = tabLabelSize(scale);
      expect(lh(label), `${scale}`).toBeGreaterThanOrEqual(label * 1.4);
      expect(TAB_PAD + TAB_PILL.height + TAB_GAP + lh(label) + TAB_PAD, `${scale}`).toBeLessThanOrEqual(barHeight(scale));
    }
    expect(barHeight(1.25)).toBe(64);
  });

  it('gives each of five places a finger and more on a 320 point phone, the pill and ➕ inside its share', () => {
    const share = 320 / 5;
    expect(share).toBeGreaterThanOrEqual(S.touch);
    expect(TAB_PILL.width).toBeLessThanOrEqual(share);
    expect(PLUS_SIZE).toBeLessThanOrEqual(share);
  });
});
```

In `src/ui/__tests__/stripGeometry.test.ts` replace

```ts
      // (Within a rounding error: a seventh is not a whole number of points.)
      expect(7 * stripDayWidth(row) - row, `${screen} pt`).toBeLessThanOrEqual(1e-9);
    }
    // The strip sits on the page, not in a card: 320 less the screen's padding (16) on each side.
    expect(stripRowWidth(320)).toBe(320 - 2 * 16);
  });

  it("the calendar on Progress reaches over its card's padding to STRIP_EDGE from the card's edge", () => {
```

with

```ts
      // (Within a rounding error: a seventh is not a whole number of points.)
      expect(7 * stripDayWidth(row) - row, `${screen} pt`).toBeLessThanOrEqual(1e-9);
    }
    // The strip sits on the page, not in a card: 320 less the screen's side margin (20) on each side.
    expect(stripRowWidth(320)).toBe(320 - 2 * 20);
  });

  it("the calendar on Progress reaches over its card's padding to STRIP_EDGE from the card's edge", () => {
```

In `src/ui/__tests__/surfaces.test.ts` replace

```ts
    expect(S.radiusXs).toBe(12);
  });

  it('16 inside a card, the same as the screen’s side gutter', () => {
    expect(S.cardPad).toBe(16);
    expect(S.cardPad).toBe(S.pad);
  });

  it('16 between the cards of a page; two tiles side by side keep their 12', () => {
```

with

```ts
    expect(S.radiusXs).toBe(12);
  });

  it('18 inside a card, 20 from the screen’s edge on a phone', () => {
    expect(S.cardPad).toBe(18);
    expect(S.gutter).toBe(20);
  });

  it('16 between the cards of a page; two tiles side by side keep their 12', () => {
```

In `src/ui/__tests__/tileGeometry.test.ts` replace

```ts
    for (const s of TEXT_SCALES) expect(TILE_TOP + tileTextHeight(s)).toBeLessThanOrEqual((1 - ART_SHARE) * tileMinHeight(s));
  });

  it('stays square two to a row on a 360 and a 375 point phone at text scale 1, with the words clear of the art', () => {
    for (const screen of [360, 375]) {
      // Two tiles between the 16 point gutters, with the row's gap between them.
      const w = (screen - 2 * S.gutter - S.gap) / 2;
      expect(w, `${screen}`).toBeGreaterThanOrEqual(tileMinHeight(1));
      // A square tile that wide: the art has its bottom 42%, and the words end above it.
      expect(TILE_TOP + tileTextHeight(1), `${screen}`).toBeLessThan((1 - ART_SHARE) * w);
    }
  });
});
```

with

```ts
    for (const s of TEXT_SCALES) expect(TILE_TOP + tileTextHeight(s)).toBeLessThanOrEqual((1 - ART_SHARE) * tileMinHeight(s));
  });

  it('stays square two to a row on a 375 and a 390 point phone at text scale 1, with the words clear of the art', () => {
    for (const screen of [375, 390]) {
      // Two tiles between the 20 point gutters, with the row's gap between them.
      const w = (screen - 2 * S.gutter - S.gap) / 2;
      expect(w, `${screen}`).toBeGreaterThanOrEqual(tileMinHeight(1));
      // A square tile that wide: the art has its bottom 42%, and the words end above it.
      expect(TILE_TOP + tileTextHeight(1), `${screen}`).toBeLessThan((1 - ART_SHARE) * w);
    }
  });

  it('on a 360 point phone is at most 3 points taller than wide, the words still clear of the art', () => {
    const w = (360 - 2 * S.gutter - S.gap) / 2;
    expect(tileMinHeight(1) - w).toBeLessThanOrEqual(3);
    expect(TILE_TOP + tileTextHeight(1)).toBeLessThan((1 - ART_SHARE) * w);
  });
});
```

Replace the whole `src/ui/__tests__/type.test.ts` with:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { applyTextScale, F, lh, MICRO, scaledSizes, TEXT_SCALES, TITLE_WEIGHT } from '../theme';

describe('type scale', () => {
  it('has four sizes at scale 1: number 48, title 22, body 16, small 13', () => {
    expect(scaledSizes(1)).toEqual({ number: 48, title: 22, body: 16, small: 13 });
    expect(F).toEqual(scaledSizes(1));
  });

  it('scales every size with the text setting, in whole points', () => {
    expect(scaledSizes(1.25)).toEqual({ number: 60, title: 28, body: 20, small: 16 });
    expect(scaledSizes(0.9)).toEqual({ number: 43, title: 20, body: 14, small: 12 });
  });

  it('labels are small, medium weight, normal case and untracked', () => {
    expect(MICRO).toEqual({ fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' });
  });

  it("keeps the heavier weight for a screen's title and its big number", () => {
    expect(TITLE_WEIGHT).toBe('600');
  });
});

describe('applyTextScale', () => {
  afterEach(() => applyTextScale(1));

  it('moves F and the label style to the scaled sizes, and back at scale 1', () => {
    applyTextScale(1.25);
    expect(F).toEqual({ number: 60, title: 28, body: 20, small: 16 });
    expect(MICRO.fontSize).toBe(16);
    expect(MICRO.lineHeight).toBe(lh(F.small));
    expect(MICRO.lineHeight).toBe(23);
    applyTextScale(1);
    expect(F).toEqual({ number: 48, title: 22, body: 16, small: 13 });
    expect(MICRO.fontSize).toBe(13);
    expect(MICRO.lineHeight).toBe(19);
  });
});

describe('lh', () => {
  it('leaves room for Devanagari matras at every size and every text scale', () => {
    for (const scale of TEXT_SCALES) {
      for (const size of Object.values(scaledSizes(scale))) {
        expect(lh(size), `size ${size} at ${scale}`).toBeGreaterThanOrEqual(size * 1.4);
        expect(Number.isInteger(lh(size))).toBe(true);
      }
    }
  });

  it('follows the size it is given', () => {
    expect(lh(13)).toBe(19);
    expect(lh(16)).toBe(23);
    expect(lh(22)).toBe(32);
    expect(lh(22)).toBeGreaterThan(lh(16));
  });

  it('keeps a number on its own tight', () => {
    expect(lh(48, true)).toBe(55);
    expect(lh(48, true)).toBeLessThan(lh(48));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/ui/__tests__/barGeometry.test.ts src/ui/__tests__/stripGeometry.test.ts src/ui/__tests__/surfaces.test.ts src/ui/__tests__/tileGeometry.test.ts src/ui/__tests__/type.test.ts`
Expected: FAIL, because the sizes are still the old ones and `barGeometry.ts` does not exist: `Tests  6 failed | 36 passed (42)`, the first reads `Error: Cannot find module '../barGeometry'`

- [ ] **Step 3: Change `src/components/WeekStrip.tsx`**

The invisible week-jump zones fill the gutter beside the strip.

In `src/components/WeekStrip.tsx` replace

```tsx
        { position: 'absolute', zIndex: 1 },
        focused
          ? { ...at(0), top: (STRIP_DAY_HEIGHT - S.touch) / 2, width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, ...S.shadow }
          : { ...at(-S.pad), top: 0, width: S.pad, height: STRIP_DAY_HEIGHT },
      ]}>
      {focused ? <Ionicons name={by < 0 ? 'chevron-back' : 'chevron-forward'} size={22} color={C.textDim} /> : null}
    </Pressable>
```

with

```tsx
        { position: 'absolute', zIndex: 1 },
        focused
          ? { ...at(0), top: (STRIP_DAY_HEIGHT - S.touch) / 2, width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, ...S.shadow }
          : { ...at(-S.gutter), top: 0, width: S.gutter, height: STRIP_DAY_HEIGHT },
      ]}>
      {focused ? <Ionicons name={by < 0 ? 'chevron-back' : 'chevron-forward'} size={22} color={C.textDim} /> : null}
    </Pressable>
```

- [ ] **Step 4: Create `src/ui/barGeometry.ts`**

Create `src/ui/barGeometry.ts`:

```ts
import { lh } from './theme';

/**
 * The tab bar's sizes: 60 points tall above the bottom safe area, icons 24,
 * labels 12 at weight 500 (times the text size, as every size), the chosen
 * tab's soft pill 56 × 32 behind its icon, and ➕ 56 across, lifted half its
 * height above the bar. At a larger text size the bar grows by what the label
 * needs, so a Devanagari label is never clipped. Pure.
 */
export const BAR_HEIGHT = 60;
export const TAB_ICON = 24;
export const TAB_LABEL = 12;
export const TAB_PILL = { width: 56, height: 32 } as const;
/** Above the pill, and below the label. */
export const TAB_PAD = 4;
/** Between the pill and the label. */
export const TAB_GAP = 2;
export const PLUS_SIZE = 56;
/** How far ➕ rises above the bar's top edge: half its height. */
export const PLUS_LIFT = PLUS_SIZE / 2;

/** A tab's label size for a text size, in whole points. */
export function tabLabelSize(scale: number): number {
  return Math.round(TAB_LABEL * scale);
}

/** The bar's height above the safe area for a text size: 60, or what the pill and the label at that size need, if more. */
export function barHeight(scale: number): number {
  return Math.max(BAR_HEIGHT, TAB_PAD + TAB_PILL.height + TAB_GAP + lh(tabLabelSize(scale)) + TAB_PAD);
}
```

- [ ] **Step 5: Change `src/ui/components.tsx`**

The scrolling page keeps the gutter from the screen's edges, top and bottom as before.

In `src/ui/components.tsx` replace

```tsx
function buildStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    screenContent: { padding: S.pad, gap: S.cardGap, maxWidth: 780, width: '100%', alignSelf: 'center' },
    card: { backgroundColor: C.card, borderRadius: S.radius, padding: S.cardPad, gap: 12 },
    title: { color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' },
    p: { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400' },
```

with

```tsx
function buildStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    screenContent: { paddingHorizontal: S.gutter, paddingVertical: S.pad, gap: S.cardGap, maxWidth: 780, width: '100%', alignSelf: 'center' },
    card: { backgroundColor: C.card, borderRadius: S.radius, padding: S.cardPad, gap: 12 },
    title: { color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' },
    p: { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400' },
```

- [ ] **Step 6: Change `src/ui/stripGeometry.ts`**

The week strip's row is the page less the gutter on each side.

In `src/ui/stripGeometry.ts` replace

```ts
/** The calendar's own margin on Progress: negative, so its rows reach over the card's padding to STRIP_EDGE from the card's edge. */
export const STRIP_MARGIN = STRIP_EDGE - S.cardPad;

/** The strip's row on Today for a screen this wide: the page less the screen's padding on each side. */
export function stripRowWidth(screenWidth: number): number {
  return screenWidth - 2 * S.pad;
}

type Token = keyof (typeof PALETTES)['light'];
```

with

```ts
/** The calendar's own margin on Progress: negative, so its rows reach over the card's padding to STRIP_EDGE from the card's edge. */
export const STRIP_MARGIN = STRIP_EDGE - S.cardPad;

/** The strip's row on Today for a screen this wide: the page less the screen's side margin on each side. */
export function stripRowWidth(screenWidth: number): number {
  return screenWidth - 2 * S.gutter;
}

type Token = keyof (typeof PALETTES)['light'];
```

- [ ] **Step 7: Change `src/ui/theme.ts`**

In `src/ui/theme.ts` replace

```ts
  pad: 16,
  padLg: 20,
  /** Inside a card. */
  cardPad: 16,
  /** Corners: cards and tiles. */
  radius: 20,
  /** A sheet's top corners (all four where it opens as a centred panel). */
```

with

```ts
  pad: 16,
  padLg: 20,
  /** Inside a card. */
  cardPad: 18,
  /** Corners: cards and tiles. */
  radius: 20,
  /** A sheet's top corners (all four where it opens as a centred panel). */
```

In `src/ui/theme.ts` replace

```ts
  shadow: cardShadow(current, WEB),
  /** The smallest a control may be under a finger, in points. */
  touch: 44,
  gutter: 16,
  gutterWide: 24,
  maxWide: 1360,
};
```

with

```ts
  shadow: cardShadow(current, WEB),
  /** The smallest a control may be under a finger, in points. */
  touch: 44,
  /** The screen's side margin on a phone, from the edge to the cards. */
  gutter: 20,
  gutterWide: 24,
  maxWide: 1360,
};
```

In `src/ui/theme.ts` replace

```ts
/**
 * The four type sizes at scale 1: the one big number a screen is about, titles,
 * body text, and small text (labels and captions use it too). Two weights go
 * with them, '400' for reading and '500' for names, numbers and buttons.
 */
const F_BASE = {
  number: 44,
  title: 20,
  body: 16,
  small: 13,
};
```

with

```ts
/**
 * The four type sizes at scale 1: the one big number a screen is about, titles,
 * body text, and small text (labels and captions use it too). Two weights go
 * with them, '400' for reading and '500' for names, numbers and buttons, and a
 * third, `TITLE_WEIGHT`, only for a screen's title and its big number.
 */
const F_BASE = {
  number: 48,
  title: 22,
  body: 16,
  small: 13,
};
```

In `src/ui/theme.ts` replace

```ts
  MICRO.lineHeight = lh(F.small);
  listeners.forEach((fn) => fn());
}

/** The small label over a section or beside a stat: normal case, no letter spacing, quiet. */
export const MICRO = {
```

with

```ts
  MICRO.lineHeight = lh(F.small);
  listeners.forEach((fn) => fn());
}

/** The weight of a screen's title and of the one big number a screen is about; everything else is '400' or '500'. */
export const TITLE_WEIGHT = '600' as const;

/** The small label over a section or beside a stat: normal case, no letter spacing, quiet. */
export const MICRO = {
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/ui/__tests__/barGeometry.test.ts src/ui/__tests__/stripGeometry.test.ts src/ui/__tests__/surfaces.test.ts src/ui/__tests__/tileGeometry.test.ts src/ui/__tests__/type.test.ts`
Expected: PASS, 46 tests.

- [ ] **Step 9: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1772 tests passing; relay 73 tests passing.

- [ ] **Step 10: Commit**

```bash
git add src/components/WeekStrip.tsx src/ui/__tests__/barGeometry.test.ts src/ui/__tests__/stripGeometry.test.ts src/ui/__tests__/surfaces.test.ts src/ui/__tests__/tileGeometry.test.ts src/ui/__tests__/type.test.ts src/ui/barGeometry.ts src/ui/components.tsx src/ui/stripGeometry.ts src/ui/theme.ts
git commit -m "$(cat <<'EOF'
The type is bigger where it matters, a 48 point big number and 22 point screen titles, the screen keeps 20 points from its edges and a card 18 inside, and the tab bar has its sizes: 60 tall, 24 point icons, 12 point labels, a 56 by 32 pill and a 56 point plus lifted half its height

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The streak shield, for the meal streak and the routine streak

Decision 4's shield as one pure rule (`runOf`) that both streaks feed with their days, oldest first. A day that would end a run going on is covered when it is the first such day of its Monday to Sunday week; a break with no run before it uses nothing, and a full day with nothing eaten is never covered (skipping is never kept alive, the safety rule of `streakStep`). `recordStreak` and `streak` keep their meaning without the shield, so every existing test holds; the store asks for the shield (Task 8). The meal streak's window grows from 90 to 120 days so the 100-day medal can be reached; 120 is the days a lived menu is kept (`LIVED_MENU_KEEP_DAYS`), so every day in the window is still judged on the menu it showed.

**Files:**
- Create: `src/core/__tests__/shield.test.ts`
- Modify: `src/core/__tests__/tileText.test.ts`
- Modify: `src/core/abhyas.ts`
- Modify: `src/core/chapter.ts`
- Modify: `src/core/record.ts`
- Create: `src/core/shield.ts`
- Modify: `src/store/migrate.ts`

**Interfaces:**
- Consumes: `mondayOf` from `src/core/date.ts`; `StreakStep` from `src/core/record.ts`.
- Produces, in `src/core/shield.ts`: `type RunDay = { date: ISODate; step: StreakStep; coverable: boolean }`, `type Run = { days: number; best: number; covered: ISODate[] }`, `runOf(days: readonly RunDay[], shield: boolean): Run`, `shieldNote(covered: readonly ISODate[], today: ISODate): 'ready' | 'used'`.
- Produces, in `src/core/record.ts`: `recordRun(input: RecordBase & { menuOn; floor: number; days?: number; shield?: boolean }): Run`; `STREAK_LOOKBACK_DAYS = 120`.
- Produces, in `src/core/abhyas.ts`: `streakRun(data: AbhyasData, today: ISODate, now: Date, shield = false): Run`.
- Produces, in `src/core/chapter.ts`: `chapterStreaks(input & { shield?: boolean })`, whose result gains `covered?: ISODate[]` (the chapter window's covered days) when `shield` is true.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/shield.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { streak, streakRun } from '../abhyas';
import { chapterStreaks } from '../chapter';
import { addDays } from '../date';
import { addSkip, type DayMenu } from '../menu';
import { KCAL_FLOOR } from '../nutrition';
import { recordRun, recordStreak, type StreakStep } from '../record';
import { DEFAULT_ROUTINE, type Routine } from '../routine';
import { runOf, shieldNote, type RunDay } from '../shield';
import type { AbhyasItem, AbhyasTick, Meal, SlotSkip } from '../types';

// Monday 19 October 2026 to Sunday 1 November: two whole weeks.
const MON = '2026-10-19';
/** A run of days from Monday 19 October, one step a day; every break may be covered unless `stuck` names its index. */
const days = (steps: StreakStep[], stuck: number[] = []): RunDay[] => steps.map((step, i) => ({ date: addDays(MON, i), step, coverable: !stuck.includes(i) }));

describe('runOf without the shield', () => {
  it('counts the days at the end and the best run, every break ending a run, a held day neither', () => {
    expect(runOf(days(['count', 'count', 'break', 'count', 'hold', 'count']), false)).toEqual({ days: 2, best: 2, covered: [] });
    expect(runOf(days(['count', 'count', 'count', 'break']), false)).toEqual({ days: 0, best: 3, covered: [] });
    expect(runOf([], false)).toEqual({ days: 0, best: 0, covered: [] });
  });
});

describe('runOf with the shield', () => {
  it('lets the first break of a week hold a run going on, and shows the day it covered', () => {
    expect(runOf(days(['count', 'count', 'break', 'count']), true)).toEqual({ days: 3, best: 3, covered: ['2026-10-21'] });
  });

  it('a second break in the same week ends the run; the next week has a shield of its own', () => {
    // Mon, Tue count; Wed covered; Thu ends it; Fri, Sat, Sun count; next Monday covered; Tuesday counts.
    const r = runOf(days(['count', 'count', 'break', 'break', 'count', 'count', 'count', 'break', 'count']), true);
    expect(r).toEqual({ days: 4, best: 4, covered: ['2026-10-21', '2026-10-26'] });
  });

  it('is not used by a break with no run to keep: a week that starts with a quiet day still has its shield', () => {
    expect(runOf(days(['break', 'count', 'break', 'count']), true)).toEqual({ days: 2, best: 2, covered: ['2026-10-21'] });
  });

  it('never covers a break it may not (a day of meals all skipped), and is still ready for a later one that week', () => {
    expect(runOf(days(['count', 'break', 'count', 'break', 'count'], [1]), true)).toEqual({ days: 2, best: 2, covered: ['2026-10-22'] });
  });

  it('weeks run Monday to Sunday: a break on Sunday and one on the Monday after are in two weeks', () => {
    const steps: StreakStep[] = ['count', 'count', 'count', 'count', 'count', 'count', 'break', 'break', 'count'];
    expect(runOf(days(steps), true)).toEqual({ days: 7, best: 7, covered: ['2026-10-25', '2026-10-26'] });
  });

  it('is the same run as without the shield when nothing breaks', () => {
    const steps: StreakStep[] = ['count', 'hold', 'count', 'count'];
    expect(runOf(days(steps), true)).toEqual(runOf(days(steps), false));
  });
});

describe('shieldNote', () => {
  it('is used while the shield covered a day of this week, ready from the Monday after', () => {
    expect(shieldNote(['2026-10-21'], '2026-10-25')).toBe('used');
    expect(shieldNote(['2026-10-21'], '2026-10-26')).toBe('ready');
    expect(shieldNote([], '2026-10-25')).toBe('ready');
  });
});

describe("the record's streak with the shield", () => {
  const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [{ id: 'lunch', type: 'lunch', time: '13:00', label_en: 'lunch', label_mr: '', label_hi: '', options: [[]], withBhaji: false, share: 100 }] };
  const menuOn = (date: string): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] });
  const ate = (date: string): Meal => ({ id: date, at: new Date(`${date}T13:00:00`).toISOString(), date, type: 'lunch', slotId: 'lunch', items: [], kcal: 1300, protein: 9 });
  // Wednesday 28 October; lunch logged every day from Monday 19 October but Thursday 22 and Monday 26.
  const TODAY = '2026-10-28';
  const dates = Array.from({ length: 10 }, (_, i) => addDays('2026-10-19', i)).filter((d) => d !== '2026-10-22' && d !== '2026-10-26');
  const base = { today: TODAY, menuOn, routine, meals: dates.map(ate), skips: [] as SlotSkip[], offDays: [] as number[], floor: KCAL_FLOOR.female };

  it('without the shield is the record streak as ever', () => {
    expect(recordRun(base)).toEqual({ days: 2, best: 3, covered: [] });
    expect(recordRun(base).days).toBe(recordStreak(base));
  });

  it('with it, the day with lunch not logged in each week holds the run: ten days, two of them covered', () => {
    expect(recordRun({ ...base, shield: true })).toEqual({ days: 8, best: 8, covered: ['2026-10-22', '2026-10-26'] });
  });

  it('never covers a day of meals all skipped: skipping is never kept alive by the streak', () => {
    const skipped = { ...base, skips: addSkip([], '2026-10-26', 'lunch') };
    expect(recordRun({ ...skipped, shield: true })).toEqual({ days: 2, best: 6, covered: ['2026-10-22'] });
  });

  it('a today not logged yet holds and uses no shield; the chapter streaks say the days covered', () => {
    const morning = { ...base, today: '2026-10-29' };
    expect(recordRun({ ...morning, shield: true })).toMatchObject({ days: 8, covered: ['2026-10-22', '2026-10-26'] });
    expect(chapterStreaks({ ...morning, shield: true })).toEqual({ days: 8, best: 8, lifetimeDays: 8, lifetimeBest: 8, covered: ['2026-10-22', '2026-10-26'] });
    // A chapter started on Saturday 24 October: its window starts there, and only the Monday it covered is in it.
    expect(chapterStreaks({ ...morning, shield: true, chapterStart: '2026-10-24' })).toEqual({ days: 4, best: 4, lifetimeDays: 8, lifetimeBest: 8, covered: ['2026-10-26'] });
  });
});

describe('the routine streak with the shield', () => {
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
  const yoga: AbhyasItem = { id: 'yoga', name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: [], order: 0, createdAt: at('2026-10-19', '06:00').toISOString() };
  const tick = (date: string): AbhyasTick => ({ id: `yoga@${date}`, itemId: 'yoga', date, at: at(date, '07:00').toISOString() });
  const TODAY = '2026-10-28';
  const ticks = Array.from({ length: 10 }, (_, i) => addDays('2026-10-19', i)).filter((d) => d !== '2026-10-21').map(tick);
  const data = { items: [yoga], ticks, sessions: [], running: null };

  it('holds the run over the one day not done this week, and says so', () => {
    expect(streakRun(data, TODAY, at(TODAY, '20:00'))).toEqual({ days: 7, best: 7, covered: [] });
    expect(streakRun(data, TODAY, at(TODAY, '20:00'), true)).toEqual({ days: 9, best: 9, covered: ['2026-10-21'] });
    expect(streak(data, TODAY, at(TODAY, '20:00'))).toBe(7);
  });

  it('today not done yet holds; a second day not done in the same week ends the run', () => {
    const morning = { ...data, ticks: ticks.filter((t) => t.date !== TODAY) };
    expect(streakRun(morning, TODAY, at(TODAY, '08:00'), true)).toEqual({ days: 8, best: 8, covered: ['2026-10-21'] });
    expect(streakRun({ ...data, ticks: ticks.filter((t) => t.date !== '2026-10-22') }, TODAY, at(TODAY, '20:00'), true)).toEqual({ days: 6, best: 6, covered: ['2026-10-21'] });
  });
});
```

In `src/core/__tests__/tileText.test.ts` replace

```ts
    expect(recordStreak({ ...base, meals: toYesterday })).toBe(6);
  });

  it('the streak and the best run look back over one window, so a 75-day run reads 75 days and is the best', () => {
    const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [{ id: 'lunch', type: 'lunch', time: '13:00', label_en: 'lunch', label_mr: '', label_hi: '', options: [[]], withBhaji: false, share: 100 }] };
    const menuOn = (date: string): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] });
    const run = (days: number): Meal[] =>
      Array.from({ length: days }, (_, i) => addDays('2026-10-27', -i)).map((date) => ({ id: date, at: new Date(`${date}T13:00:00`).toISOString(), date, type: 'lunch', slotId: 'lunch', items: [], kcal: 1300, protein: 9 }));
    const base = { today: '2026-10-27', menuOn, routine, skips: [], offDays: [] as number[], floor: KCAL_FLOOR.female };
    expect(STREAK_LOOKBACK_DAYS).toBe(90);
    expect(recordStreak({ ...base, meals: run(75) })).toBe(75);
    expect(bestStreak({ ...base, meals: run(75) })).toBe(75);
    expect(streakWords(recordStreak({ ...base, meals: run(75) }), bestStreak({ ...base, meals: run(75) })).line).toEqual({ key: 'tile_best', params: { n: 75 } });
    // A longer run reads the window in both, never one number for the streak and another for the best.
    expect(recordStreak({ ...base, meals: run(120) })).toBe(STREAK_LOOKBACK_DAYS);
    expect(bestStreak({ ...base, meals: run(120) })).toBe(STREAK_LOOKBACK_DAYS);
  });
});
```

with

```ts
    expect(recordStreak({ ...base, meals: toYesterday })).toBe(6);
  });

  it('the streak and the best run look back over one window, so a 105-day run reads 105 days and is the best', () => {
    const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [{ id: 'lunch', type: 'lunch', time: '13:00', label_en: 'lunch', label_mr: '', label_hi: '', options: [[]], withBhaji: false, share: 100 }] };
    const menuOn = (date: string): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] });
    const run = (days: number): Meal[] =>
      Array.from({ length: days }, (_, i) => addDays('2026-10-27', -i)).map((date) => ({ id: date, at: new Date(`${date}T13:00:00`).toISOString(), date, type: 'lunch', slotId: 'lunch', items: [], kcal: 1300, protein: 9 }));
    const base = { today: '2026-10-27', menuOn, routine, skips: [], offDays: [] as number[], floor: KCAL_FLOOR.female };
    expect(STREAK_LOOKBACK_DAYS).toBe(120);
    expect(recordStreak({ ...base, meals: run(105) })).toBe(105);
    expect(bestStreak({ ...base, meals: run(105) })).toBe(105);
    expect(streakWords(recordStreak({ ...base, meals: run(105) }), bestStreak({ ...base, meals: run(105) })).line).toEqual({ key: 'tile_best', params: { n: 105 } });
    // A longer run reads the window in both, never one number for the streak and another for the best.
    expect(recordStreak({ ...base, meals: run(150) })).toBe(STREAK_LOOKBACK_DAYS);
    expect(bestStreak({ ...base, meals: run(150) })).toBe(STREAK_LOOKBACK_DAYS);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/shield.test.ts src/core/__tests__/tileText.test.ts`
Expected: FAIL, because `../shield` does not exist yet: `Tests  1 failed | 29 passed (30)`, the first reads `Error: Cannot find module '../shield'`

- [ ] **Step 3: Change `src/core/abhyas.ts`**

`streak` becomes a wrapper over the new `streakRun`.

In `src/core/abhyas.ts` replace

```ts
import { addDays, isIsoDate, localDate, toISODate } from './date';
import { weekdayOf } from './routine';
import type { AbhyasItem, AbhyasRunning, AbhyasSession, AbhyasTick, AppState, ISODate } from './types';

/**
```

with

```ts
import { addDays, isIsoDate, localDate, toISODate } from './date';
import type { StreakStep } from './record';
import { weekdayOf } from './routine';
import { runOf, type Run, type RunDay } from './shield';
import type { AbhyasItem, AbhyasRunning, AbhyasSession, AbhyasTick, AppState, ISODate } from './types';

/**
```

In `src/core/abhyas.ts` replace

```ts
}

/**
 * Days in a row, back from today, on which every item on the day was done.
 * Today counts once all its items are done, the running timer's minutes
 * included, and never breaks the run before then, so in the morning the
 * streak is yesterday's. A day with no items neither breaks it nor counts.
 * Looks back no further than the first item.
 */
export function streak(data: AbhyasData, today: ISODate, now: Date): number {
  const first = firstDate(data.items);
  if (!first) return 0;
  const ticks = byDate(data.ticks);
  const sessions = byDate(data.sessions);
  let n = 0;
  for (let date = today; date >= first; date = addDays(date, -1)) {
    const s = statusIn(data, date, ticks.get(date) ?? [], sessions.get(date) ?? [], now);
    if (s.total === 0) continue;
    if (s.done === s.total) n++;
    else if (date !== today) break;
  }
  return n;
}

/**
```

with

```ts
}

/**
 * The list's run, from the first item's day to today: days on which every
 * item on the day was done count, a day with no items neither counts nor
 * breaks it, and a day with an item not done ends it. Today counts once all
 * its items are done, the running timer's minutes included, and never ends
 * the run before then, so in the morning the streak is yesterday's. With
 * `shield`, the streak shield covers the first such day of each week
 * (core/shield.ts), and the run says which days it covered.
 */
export function streakRun(data: AbhyasData, today: ISODate, now: Date, shield = false): Run {
  const first = firstDate(data.items);
  const days: RunDay[] = [];
  if (first) {
    const ticks = byDate(data.ticks);
    const sessions = byDate(data.sessions);
    for (let date = first; date <= today; date = addDays(date, 1)) {
      const s = statusIn(data, date, ticks.get(date) ?? [], sessions.get(date) ?? [], now);
      const step: StreakStep = s.total === 0 || (s.done < s.total && date === today) ? 'hold' : s.done === s.total ? 'count' : 'break';
      days.push({ date, step, coverable: true });
    }
  }
  return runOf(days, shield);
}

/** Days in a row, back from today, on which every item on the day was done (`streakRun`, without the shield). */
export function streak(data: AbhyasData, today: ISODate, now: Date): number {
  return streakRun(data, today, now).days;
}

/**
```

- [ ] **Step 4: Change `src/core/chapter.ts`**

With `shield`, both windows go through `recordRun` and the chapter window's covered days come back.

In `src/core/chapter.ts` replace

```ts
import { daysBetween, isIsoDate } from './date';
import type { DayMenu } from './menu';
import { recordStreak, STREAK_LOOKBACK_DAYS } from './record';
import type { Routine } from './routine';
import { bestStreak, shownWeight } from './tileText';
import type { ISODate, Meal, Profile, SlotSkip, WeightLog } from './types';
```

with

```ts
import { daysBetween, isIsoDate } from './date';
import type { DayMenu } from './menu';
import { recordRun, recordStreak, STREAK_LOOKBACK_DAYS } from './record';
import type { Routine } from './routine';
import { bestStreak, shownWeight } from './tileText';
import type { ISODate, Meal, Profile, SlotSkip, WeightLog } from './types';
```

In `src/core/chapter.ts` replace

```ts
  days: number;
  /** The best run in the same window: the streak tile's "Best". */
  best: number;
  /** The same two over the whole journey (the streak's own window), a chapter or not: the points and the streak badges count these. */
  lifetimeDays: number;
  lifetimeBest: number;
};

/**
 * The streak and the best run twice over: from the chapter's first day, as
 * the streak tile shows them, and over the whole journey, which the points and
 * the streak badges count, so a new chapter takes none of them away. Both by
 * the record's one rule (`recordStreak`, `bestStreak`). Each date's menu is
 * read once for all four.
 */
export function chapterStreaks(input: {
  today: ISODate;
```

with

```ts
  days: number;
  /** The best run in the same window: the streak tile's "Best". */
  best: number;
  /** The same two over the whole journey (the streak's own window), a chapter or not: the streak medals count these. */
  lifetimeDays: number;
  lifetimeBest: number;
  /** With the shield: the days it covered in the chapter's window, for the note beside the streak (`shieldNote`). */
  covered?: ISODate[];
};

/**
 * The streak and the best run twice over: from the chapter's first day, as
 * the streak tile shows them, and over the whole journey, which the streak
 * medals count, so a new chapter takes none of them away. Both by the
 * record's one rule (`recordStreak`, `bestStreak`), and with `shield` both
 * with the streak shield (`recordRun`), which then also says the days it
 * covered in the chapter's window. Each date's menu is read once for all four.
 */
export function chapterStreaks(input: {
  today: ISODate;
```

In `src/core/chapter.ts` replace

```ts
  floor: number;
  menuOn: (date: ISODate) => DayMenu | null;
  chapterStart?: ISODate;
}): ChapterStreaks {
  const menus = new Map<ISODate, DayMenu | null>();
  const menuOn = (date: ISODate) => {
```

with

```ts
  floor: number;
  menuOn: (date: ISODate) => DayMenu | null;
  chapterStart?: ISODate;
  shield?: boolean;
}): ChapterStreaks {
  const menus = new Map<ISODate, DayMenu | null>();
  const menuOn = (date: ISODate) => {
```

In `src/core/chapter.ts` replace

```ts
  };
  const record = { today: input.today, routine: input.routine, meals: input.meals, skips: input.skips, offDays: input.offDays, floor: input.floor, menuOn };
  const window = chapterDays(input.chapterStart, input.today, STREAK_LOOKBACK_DAYS);
  const lifetimeDays = recordStreak({ ...record, limit: STREAK_LOOKBACK_DAYS });
  const lifetimeBest = bestStreak({ ...record, days: STREAK_LOOKBACK_DAYS });
  if (window === STREAK_LOOKBACK_DAYS) return { days: lifetimeDays, best: lifetimeBest, lifetimeDays, lifetimeBest };
```

with

```ts
  };
  const record = { today: input.today, routine: input.routine, meals: input.meals, skips: input.skips, offDays: input.offDays, floor: input.floor, menuOn };
  const window = chapterDays(input.chapterStart, input.today, STREAK_LOOKBACK_DAYS);
  if (input.shield) {
    const lifetime = recordRun({ ...record, shield: true });
    const shown = window === STREAK_LOOKBACK_DAYS ? lifetime : recordRun({ ...record, days: window, shield: true });
    return { days: shown.days, best: shown.best, lifetimeDays: lifetime.days, lifetimeBest: lifetime.best, covered: shown.covered };
  }
  const lifetimeDays = recordStreak({ ...record, limit: STREAK_LOOKBACK_DAYS });
  const lifetimeBest = bestStreak({ ...record, days: STREAK_LOOKBACK_DAYS });
  if (window === STREAK_LOOKBACK_DAYS) return { days: lifetimeDays, best: lifetimeBest, lifetimeDays, lifetimeBest };
```

- [ ] **Step 5: Change `src/core/record.ts`**

The streak is worked out forward over the window (`recordDays`), the same days `recordStreak` read backward; `recordStreak` is now a wrapper, so its tests hold unchanged.

In `src/core/record.ts` replace

```ts
import { menuSlots, skippedOn, type DayMenu } from './menu';
import { pattern, slotOf, type SlotPoint } from './pattern';
import type { Routine } from './routine';
import type { ISODate, Meal, SlotSkip } from './types';
import { isOffDay } from './week';
```

with

```ts
import { menuSlots, skippedOn, type DayMenu } from './menu';
import { pattern, slotOf, type SlotPoint } from './pattern';
import type { Routine } from './routine';
import { runOf, type Run, type RunDay } from './shield';
import type { ISODate, Meal, SlotSkip } from './types';
import { isOffDay } from './week';
```

In `src/core/record.ts` replace

```ts
/** What one day does to a run of days: adds to it, leaves it as it was, or ends it. */
export type StreakStep = 'count' | 'hold' | 'break';

/** How far back the streak and the best run on the streak tile look, in days: one window, so they never disagree. */
export const STREAK_LOOKBACK_DAYS = 90;

/** A day eaten under this many kcal ate nothing: warm water, black tea or coffee, and no meal. */
export const NOTHING_EATEN_KCAL = 50;
```

with

```ts
/** What one day does to a run of days: adds to it, leaves it as it was, or ends it. */
export type StreakStep = 'count' | 'hold' | 'break';

/**
 * How far back the streak and the best run on the streak tile look, in days: one window, so they never disagree. Past the
 * 100-day medal; no longer than the app keeps a lived day's menu (`LIVED_MENU_KEEP_DAYS`), so every day in it is judged on
 * the menu it showed.
 */
export const STREAK_LOOKBACK_DAYS = 120;

/** A day eaten under this many kcal ate nothing: warm water, black tea or coffee, and no meal. */
export const NOTHING_EATEN_KCAL = 50;
```

In `src/core/record.ts` replace

```ts
  return meals.reduce((a, m) => a + m.kcal, 0);
}

/**
 * Days in a row that count (`streakStep`), back from today. Today counts once
 * it is full, but a today not settled yet never breaks the run, so in the
```

with

```ts
  return meals.reduce((a, m) => a + m.kcal, 0);
}

type RecordRunInput = RecordBase & { menuOn: (date: ISODate) => DayMenu | null; floor: number };

/**
 * The record's days as a run reads them, oldest first, the last `days` up to
 * today: each by the streak's rule (`streakStep`). A today not settled yet
 * holds, so it never ends the run and in the morning the streak is
 * yesterday's; a today already full with nothing eaten ends it at once. A day
 * that ends a run may be covered by the shield unless it was full with
 * nothing eaten: skipping every meal is never kept alive by the streak.
 */
function recordDays(input: RecordRunInput & { days: number }): RunDay[] {
  const byDate = mealsByDate(input.meals);
  const out: RunDay[] = [];
  for (let i = input.days - 1; i >= 0; i--) {
    const date = addDays(input.today, -i);
    const meals = byDate.get(date) ?? [];
    const state = dayRecord({ ...input, meals, date, menu: input.menuOn(date) }).state;
    const step = streakStep(state, meals, input.floor);
    out.push({ date, step: i === 0 && step === 'break' && state !== 'full' ? 'hold' : step, coverable: state !== 'full' });
  }
  return out;
}

/**
 * The record's run over the last `days` (the streak's window unless told):
 * the streak, the best run and, with `shield`, the days the streak shield
 * covered (core/shield.ts). `floor` is the person's safe minimum.
 */
export function recordRun(input: RecordRunInput & { days?: number; shield?: boolean }): Run {
  return runOf(recordDays({ ...input, days: input.days ?? STREAK_LOOKBACK_DAYS }), input.shield ?? false);
}

/**
 * Days in a row that count (`streakStep`), back from today. Today counts once
 * it is full, but a today not settled yet never breaks the run, so in the
```

In `src/core/record.ts` replace

```ts
 * eaten ends the run at once. `floor` is the person's safe minimum. Looks
 * back at most `limit` days, the streak window unless told.
 */
export function recordStreak(input: RecordBase & { menuOn: (date: ISODate) => DayMenu | null; floor: number; limit?: number }): number {
  const byDate = mealsByDate(input.meals);
  let n = 0;
  for (let i = 0; i < (input.limit ?? STREAK_LOOKBACK_DAYS); i++) {
    const date = addDays(input.today, -i);
    const meals = byDate.get(date) ?? [];
    const state = dayRecord({ ...input, meals, date, menu: input.menuOn(date) }).state;
    const step = streakStep(state, meals, input.floor);
    if (step === 'count') n++;
    else if (step === 'break' && (i > 0 || state === 'full')) break;
  }
  return n;
}
```

with

```ts
 * eaten ends the run at once. `floor` is the person's safe minimum. Looks
 * back at most `limit` days, the streak window unless told.
 */
export function recordStreak(input: RecordRunInput & { limit?: number }): number {
  return recordRun({ ...input, days: input.limit }).days;
}
```

- [ ] **Step 6: Create `src/core/shield.ts`**

Create `src/core/shield.ts`:

```ts
import { mondayOf } from './date';
import type { StreakStep } from './record';
import type { ISODate } from './types';

/**
 * The streak shield: one free rest day a week. In each Monday to Sunday week,
 * the first day that would end a run going on (a break the shield may cover,
 * with at least one day counted before it) holds the run instead, neither
 * counting nor ending it, and the shield is used for that week; a second such
 * day in the same week ends the run as before. It applies to every streak the
 * app shows, each with its own shield. Pure and deterministic: a run is worked
 * out from its days, oldest first, every time, so it is the same on every
 * device and nothing is stored.
 */

/** One day of a run, oldest first: what it does to the run, and whether a break that day is one the shield may cover. */
export type RunDay = { date: ISODate; step: StreakStep; coverable: boolean };

export type Run = {
  /** Days in a row at the end: the streak. */
  days: number;
  /** The longest run among the days. */
  best: number;
  /** The days the shield covered, at most one in each Monday to Sunday week. */
  covered: ISODate[];
};

/** The run through `days`, oldest first, with the shield when `shield` is true (`covered` is then the days it held), without it as every break ends a run. */
export function runOf(days: readonly RunDay[], shield: boolean): Run {
  let run = 0;
  let best = 0;
  const covered: ISODate[] = [];
  for (const d of days) {
    if (d.step === 'count') {
      run += 1;
      best = Math.max(best, run);
      continue;
    }
    if (d.step === 'hold') continue;
    const week = mondayOf(d.date);
    if (shield && d.coverable && run > 0 && !covered.some((c) => mondayOf(c) === week)) {
      covered.push(d.date);
      continue;
    }
    run = 0;
  }
  return { days: run, best, covered };
}

/** What the gold note beside a streak says: the shield is used while it covered a day of this Monday to Sunday week, ready otherwise. */
export function shieldNote(covered: readonly ISODate[], today: ISODate): 'ready' | 'used' {
  const week = mondayOf(today);
  return covered.some((d) => mondayOf(d) === week) ? 'used' : 'ready';
}
```

- [ ] **Step 7: Change `src/store/migrate.ts`**

Only the comment: the kept lived menus now cover the 120-day window exactly.

In `src/store/migrate.ts` replace

```ts
  return isRecord(a) && typeof a.date === 'string' && typeof a.key === 'string' && a.key.startsWith(SKIP_PREFIX);
}

/** How long the app keeps a lived day's menu it kept as it showed, in days: longer than the streak looks back (90). */
export const LIVED_MENU_KEEP_DAYS = 120;

/**
```

with

```ts
  return isRecord(a) && typeof a.date === 'string' && typeof a.key === 'string' && a.key.startsWith(SKIP_PREFIX);
}

/** How long the app keeps a lived day's menu it kept as it showed, in days: as long as the streak looks back (`STREAK_LOOKBACK_DAYS`, 120) at least. */
export const LIVED_MENU_KEEP_DAYS = 120;

/**
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/core/__tests__/shield.test.ts src/core/__tests__/tileText.test.ts`
Expected: PASS, 44 tests.

- [ ] **Step 9: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1786 tests passing; relay 73 tests passing.

- [ ] **Step 10: Commit**

```bash
git add src/core/__tests__/shield.test.ts src/core/__tests__/tileText.test.ts src/core/abhyas.ts src/core/chapter.ts src/core/record.ts src/core/shield.ts src/store/migrate.ts
git commit -m "$(cat <<'EOF'
Every streak has a shield: in each Monday to Sunday week the first day that would end a streak going on holds it instead, never a day of meals all skipped, and the meal streak looks back 120 days so the 100-day medal can be reached

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Perfect days and perfect weeks

The gold star and the perfect-week medal, judged in pure code. A perfect day is one the streak counts (full, eaten at the safe minimum or more: so never a day of meals all skipped, an off day or a day to come), with every routine job on it done and the water goal met. A perfect week is a job done on every day it was due in a Monday to Sunday week, due on three days or more, finished timers only.

**Files:**
- Create: `src/core/__tests__/perfect.test.ts`
- Create: `src/core/perfect.ts`

**Interfaces:**
- Consumes: `firstDate`, `isDone`, `itemsOn`, `minutesOn`, `AbhyasData` from `src/core/abhyas.ts`; `StreakStep`.
- Produces, in `src/core/perfect.ts`: `perfectDay(day: { step: StreakStep; jobs: { done: number; total: number }; waterMl: number; waterGoalMl: number }): boolean`, `PERFECT_WEEK_MIN_DAYS = 3`, `type PerfectWeek = { itemId: string; monday: ISODate }`, `perfectWeeks(data: Omit<AbhyasData, 'running'>, today: ISODate): PerfectWeek[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/perfect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays } from '../date';
import { perfectDay, perfectWeeks, PERFECT_WEEK_MIN_DAYS } from '../perfect';
import type { AbhyasItem, AbhyasSession, AbhyasTick } from '../types';

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
const item = (id: string, extra: Partial<AbhyasItem> = {}): AbhyasItem => ({ id, name: id, icon: 'book-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: [], order: 0, createdAt: at('2026-10-12', '06:00').toISOString(), ...extra });
const tick = (itemId: string, date: string): AbhyasTick => ({ id: `${itemId}@${date}`, itemId, date, at: at(date, '07:00').toISOString() });
const session = (itemId: string, date: string, minutes: number): AbhyasSession => ({ id: `${itemId}@${date}`, itemId, date, startedAt: at(date, '07:00').toISOString(), endedAt: at(date, '08:00').toISOString(), minutes });
/** The seven days of the week of Monday 19 October 2026. */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays('2026-10-19', i));
const SUNDAY = '2026-10-25';

describe('perfectDay', () => {
  const day = { step: 'count' as const, jobs: { done: 3, total: 3 }, waterMl: 3000, waterGoalMl: 3000 };

  it('is a full day eaten at the safe minimum, every job done and the water goal met', () => {
    expect(perfectDay(day)).toBe(true);
    // No job due that day: the other two decide.
    expect(perfectDay({ ...day, jobs: { done: 0, total: 0 } })).toBe(true);
  });

  it('is not a day the streak only holds (eaten under the safe minimum, an off day) or ends', () => {
    expect(perfectDay({ ...day, step: 'hold' })).toBe(false);
    expect(perfectDay({ ...day, step: 'break' })).toBe(false);
  });

  it('is not a day with a job not done, or water short of the goal, or with no water goal to meet', () => {
    expect(perfectDay({ ...day, jobs: { done: 2, total: 3 } })).toBe(false);
    expect(perfectDay({ ...day, waterMl: 2500 })).toBe(false);
    expect(perfectDay({ ...day, waterMl: 0, waterGoalMl: 0 })).toBe(false);
  });
});

describe('perfectWeeks', () => {
  it('finds the week a job was done on each of its days, Monday to Sunday', () => {
    const yoga = item('yoga');
    expect(perfectWeeks({ items: [yoga], ticks: WEEK.map((d) => tick('yoga', d)), sessions: [] }, '2026-10-28')).toEqual([{ itemId: 'yoga', monday: '2026-10-19' }]);
    // One day not done: no perfect week.
    expect(perfectWeeks({ items: [yoga], ticks: WEEK.filter((d) => d !== '2026-10-22').map((d) => tick('yoga', d)), sessions: [] }, '2026-10-28')).toEqual([]);
  });

  it("counts a job's own days only, its timer target met as done, and needs three due days or more", () => {
    expect(PERFECT_WEEK_MIN_DAYS).toBe(3);
    const study = item('study', { days: [1, 3, 5], targetMin: 30 });
    const sessions = ['2026-10-19', '2026-10-21', '2026-10-23'].map((d) => session('study', d, 30));
    expect(perfectWeeks({ items: [study], ticks: [], sessions }, '2026-10-28')).toEqual([{ itemId: 'study', monday: '2026-10-19' }]);
    // 25 minutes of 30 on Friday: not done.
    expect(perfectWeeks({ items: [study], ticks: [], sessions: [...sessions.slice(0, 2), session('study', '2026-10-23', 25)] }, '2026-10-28')).toEqual([]);
    const weekend = item('weekend', { days: [0, 6] });
    expect(perfectWeeks({ items: [weekend], ticks: ['2026-10-24', '2026-10-25'].map((d) => tick('weekend', d)), sessions: [] }, '2026-10-28')).toEqual([]);
  });

  it("is earned on the week's last due day once it is done, never before", () => {
    const yoga = item('yoga');
    const ticks = WEEK.map((d) => tick('yoga', d));
    expect(perfectWeeks({ items: [yoga], ticks, sessions: [] }, SUNDAY)).toEqual([{ itemId: 'yoga', monday: '2026-10-19' }]);
    expect(perfectWeeks({ items: [yoga], ticks: ticks.slice(0, 6), sessions: [] }, '2026-10-24')).toEqual([]);
  });

  it("keeps the user's order within a week and the weeks oldest first, and has none with no list", () => {
    const yoga = item('yoga', { order: 1 });
    const read = item('read', { order: 0 });
    const two = [...WEEK, ...WEEK.map((d) => addDays(d, 7))];
    const ticks = [...two.map((d) => tick('yoga', d)), ...WEEK.map((d) => tick('read', d))];
    expect(perfectWeeks({ items: [yoga, read], ticks, sessions: [] }, '2026-11-01')).toEqual([
      { itemId: 'read', monday: '2026-10-19' },
      { itemId: 'yoga', monday: '2026-10-19' },
      { itemId: 'yoga', monday: '2026-10-26' },
    ]);
    expect(perfectWeeks({ items: [], ticks: [], sessions: [] }, SUNDAY)).toEqual([]);
  });

  it('a job added on Thursday is due from Thursday, so Thursday to Sunday done is a perfect week', () => {
    const late = item('late', { createdAt: at('2026-10-22', '06:00').toISOString() });
    expect(perfectWeeks({ items: [late], ticks: WEEK.slice(3).map((d) => tick('late', d)), sessions: [] }, SUNDAY)).toEqual([{ itemId: 'late', monday: '2026-10-19' }]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/perfect.test.ts`
Expected: FAIL, because `../perfect` does not exist yet: `Test Files  1 failed (1)`, the first reads `Error: Cannot find module '../perfect'`

- [ ] **Step 3: Create `src/core/perfect.ts`**

Create `src/core/perfect.ts`:

```ts
import { firstDate, isDone, itemsOn, minutesOn, type AbhyasData } from './abhyas';
import { addDays, mondayOf, weekDates } from './date';
import type { StreakStep } from './record';
import type { AbhyasSession, AbhyasTick, ISODate } from './types';

/**
 * The gold days and weeks. A perfect day gets a gold star on the Progress
 * calendar; a perfect week of a routine job is a medal. Pure.
 */

/**
 * A perfect day: the meal record full and eaten at the safe minimum or more
 * (the day the streak counts, `streakStep` 'count', so a day of meals all
 * skipped, one under the safe minimum, an off day or a day still to come is
 * never one), every routine job on the day done, and the water goal met.
 */
export function perfectDay(day: { step: StreakStep; jobs: { done: number; total: number }; waterMl: number; waterGoalMl: number }): boolean {
  return day.step === 'count' && day.jobs.done >= day.jobs.total && day.waterGoalMl > 0 && day.waterMl >= day.waterGoalMl;
}

/** Days a job must be due in a week for that week to count as a perfect one: a job due once or twice a week is done or not, never a week's effort. */
export const PERFECT_WEEK_MIN_DAYS = 3;

export type PerfectWeek = { itemId: string; monday: ISODate };

/** Records of each date, so a look over many weeks reads each date's at once. */
function onDates<T extends { date: ISODate }>(list: T[]): Map<ISODate, T[]> {
  const out = new Map<ISODate, T[]>();
  for (const r of list) out.set(r.date, [...(out.get(r.date) ?? []), r]);
  return out;
}

// Finished sessions only: a perfect week is earned when the timer stops, not while it runs.
const NO_TIMER = new Date(0);

/**
 * The Monday to Sunday weeks in which a routine job was done on every day it
 * was due, from the week of the first item to this one, oldest first and in
 * the user's order within a week: due on `PERFECT_WEEK_MIN_DAYS` days or more
 * that week, each of them today or before. A job added or removed in the
 * middle of a week is due on the days it was on the list (`itemsOn`).
 */
export function perfectWeeks(data: Omit<AbhyasData, 'running'>, today: ISODate): PerfectWeek[] {
  const first = firstDate(data.items);
  if (!first) return [];
  const ticks = onDates<AbhyasTick>(data.ticks);
  const sessions = onDates<AbhyasSession>(data.sessions);
  const byOrder = [...data.items].sort((a, b) => a.order - b.order);
  const out: PerfectWeek[] = [];
  for (let monday = mondayOf(first); monday <= today; monday = addDays(monday, 7)) {
    const due = new Map<string, ISODate[]>();
    for (const date of weekDates(monday)) for (const item of itemsOn(data.items, date)) due.set(item.id, [...(due.get(item.id) ?? []), date]);
    for (const item of byOrder) {
      const days = due.get(item.id) ?? [];
      if (days.length < PERFECT_WEEK_MIN_DAYS || days[days.length - 1] > today) continue;
      const allDone = days.every((d) => isDone(item, d, ticks.get(d) ?? [], minutesOn(sessions.get(d) ?? [], null, item.id, d, NO_TIMER)));
      if (allDone) out.push({ itemId: item.id, monday });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/__tests__/perfect.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1794 tests passing; relay 73 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/core/__tests__/perfect.test.ts src/core/perfect.ts
git commit -m "$(cat <<'EOF'
A day with the meal record full, every routine job done and the water goal met is a perfect day, and a job done on every day it was due in a week, three days or more, is a perfect week

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Today's challenge

Decision 6 in pure code. Five areas in a fixed turn order (water, walk, a timed job's start, protein, the first meal logged by a time); a day's challenge is one of those the seven days before it say something about, picked by the day's number so it is new every day and the same all day on every device. Targets are a little past the user's usual and capped (see the spec's table); with no history it is two bottles or a ten-minute walk. The count of challenges done is worked out again from the logs (finished timers only), so it needs no storage and is the same on every device.

**Files:**
- Create: `src/core/__tests__/challenge.test.ts`
- Create: `src/core/challenge.ts`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `itemsOn`, `AbhyasData`; `WALK_ACTIVITY_ID`; `addDays`, `daysBetween`, `localDate`; `isOffDay`; `fill`.
- Produces, in `src/core/challenge.ts`: `type ChallengeKind = 'water' | 'walk' | 'start' | 'protein' | 'logBy'`, `type DailyChallenge = { date: ISODate; kind: ChallengeKind; target: number; usual: number; itemId?: string; name?: string }`, `type ChallengeData = { meals: Meal[]; water: WaterLog[]; activities: ActivityLog[]; abhyas: AbhyasData; bottleMl: number; waterGoalMl: number; proteinTarget: number; offDays: number[] }`, `challengeChoices(data: ChallengeData, date: ISODate): DailyChallenge[]`, `dailyChallenge(data: ChallengeData, date: ISODate): DailyChallenge | null`, `type ChallengeProgress = { n: number; of: number; done: boolean }`, `challengeProgress(data: ChallengeData, ch: DailyChallenge): ChallengeProgress`, `challengesDone(data: ChallengeData, today: ISODate): number`, `clockOf(minute: number): string`, `challengeText(ch: DailyChallenge, t: (key: string) => string): string`; constants `CHALLENGE_WINDOW = 7`, `WATER_MIN = 2`, `WALK_MIN = 10`, `WALK_MAX = 60`, `DAYS_TO_GO_BY = { start: 2, protein: 3, logBy: 3 }`, `CHALLENGE_LOOKBACK_DAYS = 400`.
- Words: the `chal_*` keys in all three languages.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/challenge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { WALK_ACTIVITY_ID } from '../activity';
import { challengeChoices, challengeProgress, challengesDone, challengeText, clockOf, dailyChallenge, type ChallengeData, type DailyChallenge } from '../challenge';
import { addDays } from '../date';
import { makeT } from '../../i18n';
import type { AbhyasItem, AbhyasSession, ActivityLog, Meal, MealSource, WaterLog } from '../types';

// Saturday 31 October 2026; the clock is Asia/Kolkata (vitest.config.mts).
const TODAY = '2026-10-31';
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
/** The seven days before today, 24 to 30 October. */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i - 7));
const meal = (date: string, hhmm: string, protein: number, source?: MealSource): Meal => ({ id: `${date}${hhmm}`, at: at(date, hhmm).toISOString(), date, type: 'lunch', items: [], kcal: 500, protein, ...(source ? { source } : {}) });
const water = (date: string, ml: number): WaterLog => ({ id: `w${date}${ml}`, at: '', date, ml });
const walk = (date: string, minutes: number): ActivityLog => ({ id: `a${date}${minutes}`, date, at: '', activityId: WALK_ACTIVITY_ID, minutes, intensity: 1, kcal: 40 });
const code: AbhyasItem = { id: 'code', name: 'Coding', icon: 'code-slash-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], targetMin: 30, times: [], order: 0, createdAt: at('2026-10-01', '06:00').toISOString() };
const session = (date: string, hhmm: string): AbhyasSession => ({ id: `code@${date}${hhmm}`, itemId: 'code', date, startedAt: at(date, hhmm).toISOString(), endedAt: at(date, '23:00').toISOString(), minutes: 30 });
const base: ChallengeData = { meals: [], water: [], activities: [], abhyas: { items: [], ticks: [], sessions: [], running: null }, bottleMl: 500, waterGoalMl: 3000, proteinTarget: 90, offDays: [] };
const choice = (data: ChallengeData, kind: DailyChallenge['kind'], date = TODAY) => challengeChoices(data, date).find((c) => c.kind === kind);

describe('dailyChallenge with no history', () => {
  it('is still one small step: two bottles of water or a ten-minute walk, in turn by the day', () => {
    expect(challengeChoices(base, TODAY)).toEqual([
      { date: TODAY, kind: 'water', target: 2, usual: 0 },
      { date: TODAY, kind: 'walk', target: 10, usual: 0 },
    ]);
    expect(dailyChallenge(base, TODAY)).toEqual({ date: TODAY, kind: 'walk', target: 10, usual: 0 });
    expect(dailyChallenge(base, '2026-11-01')).toEqual({ date: '2026-11-01', kind: 'water', target: 2, usual: 0 });
  });

  it('is the same all day and on every device, and none on an off day', () => {
    expect(dailyChallenge(base, TODAY)).toEqual(dailyChallenge({ ...base }, TODAY));
    expect(dailyChallenge({ ...base, offDays: [6] }, TODAY)).toBeNull();
  });
});

describe('challengeChoices: a little past the usual, capped so it stays doable', () => {
  it('water: one bottle past the last week, never past the day’s goal', () => {
    expect(choice({ ...base, water: WEEK.map((d) => water(d, 2000)) }, 'water')).toMatchObject({ target: 5, usual: 4 });
    expect(choice({ ...base, water: WEEK.map((d) => water(d, 3500)) }, 'water')).toMatchObject({ target: 6, usual: 7 });
    expect(choice({ ...base, waterGoalMl: 0 }, 'water')).toBeUndefined();
  });

  it('walk: five minutes past the usual, to the next five, from ten to an hour', () => {
    expect(choice({ ...base, activities: WEEK.map((d) => walk(d, 12)) }, 'walk')).toMatchObject({ target: 20, usual: 12 });
    expect(choice({ ...base, activities: WEEK.map((d) => walk(d, 58)) }, 'walk')).toMatchObject({ target: 60, usual: 58 });
  });

  it("a timed job's start: a quarter of an hour before the usual start, never earlier than the week's earliest", () => {
    const sessions = [session(WEEK[0], '21:00'), session(WEEK[2], '21:00'), session(WEEK[4], '21:00'), session(WEEK[6], '20:30')];
    const data = { ...base, abhyas: { ...base.abhyas, items: [code], sessions } };
    expect(choice(data, 'start')).toEqual({ date: TODAY, kind: 'start', target: 20 * 60 + 35, usual: 20 * 60 + 53, itemId: 'code', name: 'Coding' });
    // Started on one day of the seven: nothing to go by yet.
    expect(choice({ ...data, abhyas: { ...data.abhyas, sessions: sessions.slice(0, 1) } }, 'start')).toBeUndefined();
  });

  it('protein: ten grams past the usual on days something was eaten, never past the target, and none once the usual meets it', () => {
    const three = [WEEK[1], WEEK[3], WEEK[5]].map((d) => meal(d, '13:00', 50));
    expect(choice({ ...base, meals: three }, 'protein')).toMatchObject({ target: 60, usual: 50 });
    expect(choice({ ...base, meals: three.slice(0, 2) }, 'protein')).toBeUndefined();
    expect(choice({ ...base, meals: [WEEK[1], WEEK[3], WEEK[5]].map((d) => meal(d, '13:00', 95)) }, 'protein')).toBeUndefined();
  });

  it('the first meal logged: a quarter of an hour before the usual, never earlier than the week’s earliest; a meal the app filled in is not one logged', () => {
    const meals = [meal(WEEK[0], '09:30', 10), meal(WEEK[1], '09:40', 10), meal(WEEK[2], '10:00', 10), meal(WEEK[3], '07:00', 10, 'auto')];
    expect(choice({ ...base, meals }, 'logBy')).toMatchObject({ target: 9 * 60 + 30, usual: 9 * 60 + 43 });
  });

  it('grows with the user: the same walk every day asks for more each day until the challenge is a little past it', () => {
    // Thirty minutes a day for two weeks, from 18 October; water off, so every day is a walk.
    const data = { ...base, waterGoalMl: 0, activities: Array.from({ length: 14 }, (_, i) => walk(addDays('2026-10-18', i), 30)) };
    expect(Array.from({ length: 8 }, (_, i) => dailyChallenge(data, addDays('2026-10-18', i))?.target)).toEqual([10, 10, 15, 20, 25, 30, 35, 35]);
    expect(challengesDone(data, addDays('2026-10-18', 13))).toBe(6);
  });
});

describe('challengeProgress', () => {
  it('counts whole bottles, minutes and grams of the day toward the target', () => {
    const ch: DailyChallenge = { date: TODAY, kind: 'water', target: 5, usual: 4 };
    expect(challengeProgress({ ...base, water: [water(TODAY, 2400)] }, ch)).toEqual({ n: 4, of: 5, done: false });
    expect(challengeProgress({ ...base, water: [water(TODAY, 2500)] }, ch)).toEqual({ n: 5, of: 5, done: true });
    expect(challengeProgress({ ...base, activities: [walk(TODAY, 20)] }, { date: TODAY, kind: 'walk', target: 20, usual: 12 })).toEqual({ n: 20, of: 20, done: true });
  });

  it('a start time is done once the job started by then, the timer still running included; a first meal by its time', () => {
    const ch: DailyChallenge = { date: TODAY, kind: 'start', target: 20 * 60 + 35, usual: 21 * 60, itemId: 'code', name: 'Coding' };
    const running = { ...base, abhyas: { ...base.abhyas, items: [code], running: { itemId: 'code', startedAt: at(TODAY, '20:30').toISOString() } } };
    expect(challengeProgress(running, ch)).toEqual({ n: 1, of: 1, done: true });
    expect(challengeProgress({ ...base, abhyas: { ...base.abhyas, items: [code], sessions: [session(TODAY, '20:40')] } }, ch)).toEqual({ n: 0, of: 1, done: false });
    const log: DailyChallenge = { date: TODAY, kind: 'logBy', target: 9 * 60 + 30, usual: 9 * 60 + 43 };
    expect(challengeProgress({ ...base, meals: [meal(TODAY, '09:20', 10)] }, log).done).toBe(true);
    expect(challengeProgress({ ...base, meals: [meal(TODAY, '09:20', 10, 'auto')] }, log).done).toBe(false);
  });
});

describe('challengesDone', () => {
  it('is none with nothing logged', () => {
    expect(challengesDone(base, TODAY)).toBe(0);
  });
});

describe('challengeText', () => {
  const t = makeT('en');

  it('says the step and how it compares with the usual', () => {
    expect(challengeText({ date: TODAY, kind: 'walk', target: 15, usual: 10 }, t)).toBe('Walk 15 min, 5 more than your usual');
    expect(challengeText({ date: TODAY, kind: 'water', target: 6, usual: 7 }, t)).toBe('Drink 6 bottles of water');
    expect(challengeText({ date: TODAY, kind: 'protein', target: 60, usual: 50 }, t)).toBe('Eat 60 g of protein, 10 g more than your usual');
    expect(challengeText({ date: TODAY, kind: 'start', target: 20 * 60 + 35, usual: 20 * 60 + 53, itemId: 'code', name: 'Coding' }, t)).toBe('Start Coding by 20:35, a little earlier than usual');
    expect(challengeText({ date: TODAY, kind: 'logBy', target: 9 * 60 + 30, usual: 9 * 60 + 30 }, t)).toBe('Log your first meal by 09:30');
  });

  it('writes a time as the app does', () => {
    expect(clockOf(7 * 60 + 5)).toBe('07:05');
    expect(clockOf(0)).toBe('00:00');
  });

  it('has its words in Marathi and Hindi', () => {
    expect(challengeText({ date: TODAY, kind: 'walk', target: 15, usual: 10 }, makeT('mr'))).toBe('15 मिनिटे चाला, नेहमीपेक्षा 5 जास्त');
    expect(challengeText({ date: TODAY, kind: 'walk', target: 15, usual: 10 }, makeT('hi'))).toBe('15 मिनट टहलें, आम दिनों से 5 ज़्यादा');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/challenge.test.ts`
Expected: FAIL, because `../challenge` does not exist yet: `Test Files  1 failed (1)`, the first reads `Error: Cannot find module '../challenge'`

- [ ] **Step 3: Create `src/core/challenge.ts`**

Create `src/core/challenge.ts`:

```ts
import { itemsOn, type AbhyasData } from './abhyas';
import { WALK_ACTIVITY_ID } from './activity';
import { addDays, daysBetween, localDate } from './date';
import type { ActivityLog, ISODate, Meal, WaterLog } from './types';
import { isOffDay } from './week';
import { fill } from '../i18n';

/**
 * Today's challenge: one small, achievable step a day, worked out from the
 * user's own last seven days, new every day and harder as they improve. One
 * area a day, in turn among those the last week says something about: water,
 * walk minutes, the start time of a timed routine job, protein, and logging
 * the first meal before a time. The target is a little past the user's own
 * usual and capped so it stays doable: never past the day's water goal or
 * protein target, a walk never past an hour, a time never earlier than the
 * earliest the week already managed. With no history yet there is still one:
 * two bottles of water or a ten-minute walk. Nothing on an off day. Worked
 * out from the days before, never from the day itself, so it holds all day;
 * pure, so the count of challenges done is worked out again from the logs
 * whenever it is needed, the same on every device.
 */
export type ChallengeKind = 'water' | 'walk' | 'start' | 'protein' | 'logBy';

export type DailyChallenge = {
  date: ISODate;
  kind: ChallengeKind;
  /** Bottles, walk minutes or grams of protein; for 'start' and 'logBy', the minute of the day to do it by. */
  target: number;
  /** The user's usual over the last seven days, in the same unit. */
  usual: number;
  /** For 'start': the job, and its name for the words. */
  itemId?: string;
  name?: string;
};

export type ChallengeData = {
  meals: Meal[];
  water: WaterLog[];
  activities: ActivityLog[];
  /** The routine list; the running timer counts as started when it started on the day. */
  abhyas: AbhyasData;
  bottleMl: number;
  waterGoalMl: number;
  proteinTarget: number;
  offDays: number[];
};

/** The days the challenge reads before its own. */
export const CHALLENGE_WINDOW = 7;
/** The fewest bottles a water challenge asks for, below the goal. */
export const WATER_MIN = 2;
/** The walk challenge's floor and ceiling, in minutes. */
export const WALK_MIN = 10;
export const WALK_MAX = 60;
/** Days of the last seven with something to go by before a start time, protein or a first-meal time is a challenge. */
export const DAYS_TO_GO_BY = { start: 2, protein: 3, logBy: 3 } as const;
/** How far back the count of challenges done looks. */
export const CHALLENGE_LOOKBACK_DAYS = 400;
/** The day the turn of areas counts from: any Monday. */
const EPOCH = '2026-01-05';

/** What one day held: water, walking, protein, whether anything was eaten, when the first meal the user logged was, and when each job's timer first started. */
type DayFacts = { waterMl: number; walkMin: number; protein: number; ate: boolean; firstLog: number | null; starts: Map<string, number> };

const minuteOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const up5 = (n: number) => Math.ceil(n / 5) * 5;
const down5 = (n: number) => Math.floor(n / 5) * 5;

function byDate<T extends { date: ISODate }>(list: T[]): Map<ISODate, T[]> {
  const out = new Map<ISODate, T[]>();
  for (const r of list) out.set(r.date, [...(out.get(r.date) ?? []), r]);
  return out;
}

/** Each date's facts, worked out once per date for as long as the index lives. */
function factsIndex(data: ChallengeData): (date: ISODate) => DayFacts {
  const meals = byDate(data.meals);
  const water = byDate(data.water);
  const walks = byDate(data.activities.filter((a) => a.activityId === WALK_ACTIVITY_ID));
  const sessions = byDate(data.abhyas.sessions);
  const cache = new Map<ISODate, DayFacts>();
  return (date) => {
    const kept = cache.get(date);
    if (kept) return kept;
    const eaten = meals.get(date) ?? [];
    // A meal the app filled in from the plan is eaten, but the user did not log it.
    const own = eaten.filter((m) => m.source !== 'auto').map((m) => minuteOf(m.at));
    const starts = new Map<string, number>();
    const started = (itemId: string, at: number) => starts.set(itemId, Math.min(at, starts.get(itemId) ?? at));
    for (const s of sessions.get(date) ?? []) started(s.itemId, minuteOf(s.startedAt));
    const run = data.abhyas.running;
    if (run && localDate(run.startedAt) === date) started(run.itemId, minuteOf(run.startedAt));
    const facts: DayFacts = {
      waterMl: (water.get(date) ?? []).reduce((a, w) => a + w.ml, 0),
      walkMin: (walks.get(date) ?? []).reduce((a, w) => a + w.minutes, 0),
      protein: eaten.reduce((a, m) => a + m.protein, 0),
      ate: eaten.length > 0,
      firstLog: own.length ? Math.min(...own) : null,
      starts,
    };
    cache.set(date, facts);
    return facts;
  };
}

/** Every area the last seven days say something about, in turn order. */
function choicesWith(data: ChallengeData, facts: (date: ISODate) => DayFacts, date: ISODate): DailyChallenge[] {
  const past = Array.from({ length: CHALLENGE_WINDOW }, (_, i) => facts(addDays(date, i - CHALLENGE_WINDOW)));
  const out: DailyChallenge[] = [];
  if (data.waterGoalMl > 0 && data.bottleMl > 0) {
    const goal = Math.ceil(data.waterGoalMl / data.bottleMl);
    const usual = Math.round(avg(past.map((f) => f.waterMl)) / data.bottleMl);
    out.push({ date, kind: 'water', target: Math.min(goal, Math.max(WATER_MIN, usual + 1)), usual });
  }
  const walked = Math.round(avg(past.map((f) => f.walkMin)));
  out.push({ date, kind: 'walk', target: Math.min(WALK_MAX, Math.max(WALK_MIN, up5(walked + 5))), usual: walked });
  for (const item of itemsOn(data.abhyas.items, date)) {
    if (!(typeof item.targetMin === 'number' && item.targetMin > 0)) continue;
    const starts = past.map((f) => f.starts.get(item.id)).filter((m): m is number => m !== undefined);
    if (starts.length < DAYS_TO_GO_BY.start) continue;
    const usual = Math.round(avg(starts));
    out.push({ date, kind: 'start', target: Math.max(Math.min(...starts), down5(usual) - 15), usual, itemId: item.id, name: item.name });
    break;
  }
  const ate = past.filter((f) => f.ate);
  const protein = Math.round(avg(ate.map((f) => f.protein)));
  if (data.proteinTarget > 0 && ate.length >= DAYS_TO_GO_BY.protein && protein < data.proteinTarget) {
    out.push({ date, kind: 'protein', target: Math.min(data.proteinTarget, up5(protein + 10)), usual: protein });
  }
  const logs = past.map((f) => f.firstLog).filter((m): m is number => m !== null);
  if (logs.length >= DAYS_TO_GO_BY.logBy) {
    const usual = Math.round(avg(logs));
    out.push({ date, kind: 'logBy', target: Math.max(Math.min(...logs), down5(usual) - 15), usual });
  }
  return out;
}

function challengeWith(data: ChallengeData, facts: (date: ISODate) => DayFacts, date: ISODate): DailyChallenge | null {
  if (isOffDay(data.offDays, date)) return null;
  const list = choicesWith(data, facts, date);
  if (list.length === 0) return null;
  const turn = daysBetween(EPOCH, date) % list.length;
  return list[(turn + list.length) % list.length];
}

/** Every challenge a date could have, one per area its last seven days say something about, in turn order; the day's is one of them (`dailyChallenge`). */
export function challengeChoices(data: ChallengeData, date: ISODate): DailyChallenge[] {
  return choicesWith(data, factsIndex(data), date);
}

/** The challenge for a date: one area in turn among those its last seven days say something about; null on an off day. */
export function dailyChallenge(data: ChallengeData, date: ISODate): DailyChallenge | null {
  return challengeWith(data, factsIndex(data), date);
}

export type ChallengeProgress = { n: number; of: number; done: boolean };

function progressWith(data: ChallengeData, facts: (date: ISODate) => DayFacts, ch: DailyChallenge): ChallengeProgress {
  const f = facts(ch.date);
  if (ch.kind === 'start' || ch.kind === 'logBy') {
    const at = ch.kind === 'start' ? f.starts.get(ch.itemId ?? '') : f.firstLog;
    const done = at !== undefined && at !== null && at <= ch.target;
    return { n: done ? 1 : 0, of: 1, done };
  }
  const n = ch.kind === 'water' ? Math.floor(f.waterMl / Math.max(1, data.bottleMl)) : ch.kind === 'walk' ? f.walkMin : Math.round(f.protein);
  return { n, of: ch.target, done: n >= ch.target };
}

/** How far the day has come: bottles, minutes or grams of the target, or for a time, 1 of 1 once it was done by then. */
export function challengeProgress(data: ChallengeData, ch: DailyChallenge): ChallengeProgress {
  return progressWith(data, factsIndex(data), ch);
}

/** The first date with anything logged: a meal, water, a walk, a tick or a timer. Null with nothing. */
function firstLogged(data: ChallengeData): ISODate | null {
  let first: ISODate | null = null;
  for (const list of [data.meals, data.water, data.activities, data.abhyas.ticks, data.abhyas.sessions] as { date: ISODate }[][]) {
    for (const r of list) if (first === null || r.date < first) first = r.date;
  }
  return first;
}

/**
 * Challenges done, each day's once, from the first day with anything logged
 * (at most `CHALLENGE_LOOKBACK_DAYS` back) to today: the "challenges done"
 * medals count these. Finished timers only, so the count moves when a timer
 * stops, not while it runs.
 */
export function challengesDone(data: ChallengeData, today: ISODate): number {
  const first = firstLogged(data);
  if (!first) return 0;
  const finished = { ...data, abhyas: { ...data.abhyas, running: null } };
  const facts = factsIndex(finished);
  const from = first > addDays(today, 1 - CHALLENGE_LOOKBACK_DAYS) ? first : addDays(today, 1 - CHALLENGE_LOOKBACK_DAYS);
  let n = 0;
  for (let date = from; date <= today; date = addDays(date, 1)) {
    const ch = challengeWith(finished, facts, date);
    if (ch && progressWith(finished, facts, ch).done) n += 1;
  }
  return n;
}

/** A minute of the day as the app writes a time, "07:05". */
export function clockOf(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** The challenge in the user's language: "Walk 15 min, 5 more than your usual", "Start Coding by 20:00". */
export function challengeText(ch: DailyChallenge, t: (key: string) => string): string {
  switch (ch.kind) {
    case 'water':
      return fill(t(ch.target > ch.usual ? 'chal_water_more' : 'chal_water'), { n: ch.target, d: ch.target - ch.usual });
    case 'walk':
      return fill(t(ch.target > ch.usual ? 'chal_walk_more' : 'chal_walk'), { n: ch.target, d: ch.target - ch.usual });
    case 'protein':
      return fill(t('chal_protein'), { n: ch.target, d: ch.target - ch.usual });
    case 'start':
      return fill(t(ch.target < ch.usual ? 'chal_start_earlier' : 'chal_start'), { name: ch.name ?? '', time: clockOf(ch.target) });
    default:
      return fill(t(ch.target < ch.usual ? 'chal_log_by_earlier' : 'chal_log_by'), { time: clockOf(ch.target) });
  }
}
```

- [ ] **Step 4: Add the words to `src/i18n/index.ts`**

Add 15 keys at the end of each of the three dicts. First check that none is there yet:

Run: `grep -nE "^  (chal_title|chal_water|chal_water_more|chal_walk|chal_walk_more|chal_protein|chal_start|chal_start_earlier|chal_log_by|chal_log_by_earlier|chal_progress|chal_done|chal_done_title|chal_count|chal_count_one):" src/i18n/index.ts`
Expected: no output.

In `src/i18n/index.ts` replace

```ts
  brk_suggest_line: '"{kind}" was skipped five times in a row. A longer gap may suit your work better.',
  brk_suggest_set: 'Make "{kind}" every {n} minutes',
  brk_gap_now: '"{kind}" breaks now every {n} minutes',
};

const mr: Dict = {
```

with

```ts
  brk_suggest_line: '"{kind}" was skipped five times in a row. A longer gap may suit your work better.',
  brk_suggest_set: 'Make "{kind}" every {n} minutes',
  brk_gap_now: '"{kind}" breaks now every {n} minutes',
  chal_title: "Today's challenge",
  chal_water: 'Drink {n} bottles of water',
  chal_water_more: 'Drink {n} bottles of water, {d} more than your usual',
  chal_walk: 'Walk {n} min',
  chal_walk_more: 'Walk {n} min, {d} more than your usual',
  chal_protein: 'Eat {n} g of protein, {d} g more than your usual',
  chal_start: 'Start {name} by {time}',
  chal_start_earlier: 'Start {name} by {time}, a little earlier than usual',
  chal_log_by: 'Log your first meal by {time}',
  chal_log_by_earlier: 'Log your first meal by {time}, a little earlier than usual',
  chal_progress: '{n} of {m}',
  chal_done: 'Done. Well done!',
  chal_done_title: 'Challenge done',
  chal_count: '{n} challenges done so far.',
  chal_count_one: 'Your first challenge done.',
};

const mr: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  brk_suggest_line: '"{kind}" सलग पाच वेळा टाळले. जास्त अंतर तुमच्या कामाला बरे पडेल.',
  brk_suggest_set: '"{kind}" दर {n} मिनिटांनी करा',
  brk_gap_now: '"{kind}" ब्रेक आता दर {n} मिनिटांनी',
};

const hi: Dict = {
```

with

```ts
  brk_suggest_line: '"{kind}" सलग पाच वेळा टाळले. जास्त अंतर तुमच्या कामाला बरे पडेल.',
  brk_suggest_set: '"{kind}" दर {n} मिनिटांनी करा',
  brk_gap_now: '"{kind}" ब्रेक आता दर {n} मिनिटांनी',
  chal_title: 'आजचं आव्हान',
  chal_water: '{n} बाटल्या पाणी प्या',
  chal_water_more: '{n} बाटल्या पाणी प्या, नेहमीपेक्षा {d} जास्त',
  chal_walk: '{n} मिनिटे चाला',
  chal_walk_more: '{n} मिनिटे चाला, नेहमीपेक्षा {d} जास्त',
  chal_protein: '{n} ग्रॅम प्रथिने खा, नेहमीपेक्षा {d} ग्रॅम जास्त',
  chal_start: '{name} {time} पर्यंत सुरू करा',
  chal_start_earlier: '{name} {time} पर्यंत सुरू करा, नेहमीपेक्षा थोडं लवकर',
  chal_log_by: 'पहिलं जेवण {time} पर्यंत नोंदवा',
  chal_log_by_earlier: 'पहिलं जेवण {time} पर्यंत नोंदवा, नेहमीपेक्षा थोडं लवकर',
  chal_progress: '{m} पैकी {n}',
  chal_done: 'पूर्ण झालं. छान!',
  chal_done_title: 'आव्हान पूर्ण',
  chal_count: 'आतापर्यंत {n} आव्हानं पूर्ण.',
  chal_count_one: 'तुमचं पहिलं आव्हान पूर्ण.',
};

const hi: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  brk_suggest_line: '"{kind}" लगातार पाँच बार छोड़ा गया. लंबा अंतर आपके काम के लिए बेहतर रहेगा.',
  brk_suggest_set: '"{kind}" हर {n} मिनट पर करें',
  brk_gap_now: '"{kind}" ब्रेक अब हर {n} मिनट पर',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

with

```ts
  brk_suggest_line: '"{kind}" लगातार पाँच बार छोड़ा गया. लंबा अंतर आपके काम के लिए बेहतर रहेगा.',
  brk_suggest_set: '"{kind}" हर {n} मिनट पर करें',
  brk_gap_now: '"{kind}" ब्रेक अब हर {n} मिनट पर',
  chal_title: 'आज की चुनौती',
  chal_water: '{n} बोतल पानी पिएँ',
  chal_water_more: '{n} बोतल पानी पिएँ, आम दिनों से {d} ज़्यादा',
  chal_walk: '{n} मिनट टहलें',
  chal_walk_more: '{n} मिनट टहलें, आम दिनों से {d} ज़्यादा',
  chal_protein: '{n} ग्राम प्रोटीन खाएँ, आम दिनों से {d} ग्राम ज़्यादा',
  chal_start: '{name} {time} तक शुरू करें',
  chal_start_earlier: '{name} {time} तक शुरू करें, आम दिनों से थोड़ा पहले',
  chal_log_by: 'पहला खाना {time} तक दर्ज करें',
  chal_log_by_earlier: 'पहला खाना {time} तक दर्ज करें, आम दिनों से थोड़ा पहले',
  chal_progress: '{m} में से {n}',
  chal_done: 'हो गया. बहुत बढ़िया!',
  chal_done_title: 'चुनौती पूरी',
  chal_count: 'अब तक {n} चुनौतियाँ पूरी.',
  chal_count_one: 'आपकी पहली चुनौती पूरी.',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/core/__tests__/challenge.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1808 tests passing; relay 73 tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/core/__tests__/challenge.test.ts src/core/challenge.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Each day has one small challenge from the user's own last seven days, water, walking, a job's start time, protein or logging the first meal by a time, a little past their usual and capped so it stays doable; with no history it is two bottles of water or a ten-minute walk

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Medals, the trophy shelf and which win to celebrate

The one reward system (Decision 4 and the spec's fold of the old game). Medals are earned from the logs and kept once celebrated, through the same `celebrated` ids the badges used; a streak or kilo badge already won counts as the medal it became. `nextWin` replaces the game's: medals first, smallest first, then today's challenge; the first run with medals (no `medals:seeded` id yet, a new user or one coming from the badges) marks everything already earned as seen. `withCelebrated` keeps a day's challenge id for a fortnight only, so the list never grows by one a day for good.

**Files:**
- Create: `src/core/__tests__/medals.test.ts`
- Create: `src/core/medals.ts`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `addDays`; `fill`.
- Produces, in `src/core/medals.ts`: `type MedalTrack = 'meals' | 'routine' | 'kg' | 'halfway' | 'goal' | 'week' | 'challenges'`, `STREAK_MEDALS = [3, 7, 21, 30, 66, 100]`, `CHALLENGE_MEDALS = [10, 30, 100]`, `TRACKS`, `type Medal = { id: string; track: MedalTrack; n: number; name?: string }`, `type MedalInput = { meals: { now: number; best: number }; routine: { now: number; best: number } | null; lostKg: number; totalKg: number; weeks: { itemId: string; monday: ISODate; name: string }[]; challengesDone: number; celebrated: readonly string[] | null | undefined }`, `earnedMedals(input: MedalInput): Medal[]`, `type NextMedal = Medal & { toGo: number }`, `nextMedals(input: MedalInput, earned: readonly Medal[]): NextMedal[]`, `type ShelfTile = { key: string; track: MedalTrack; n: number; earned: boolean; name?: string; count?: number; toGo?: number }`, `shelf(input: MedalInput): ShelfTile[]`, `medalFace(track: MedalTrack, n: number): string`, `medalWords(m: Pick<Medal, 'track' | 'n' | 'name'>, t): { title: string; line: string }`, `shelfWords(tile: ShelfTile, t): { label: string; sub: string | null }`, `MEDALS_SEEDED = 'medals:seeded'`, `challengeWinId(date: ISODate): string`, `type Win = { id: string; kind: 'medal'; medal: Medal } | { id: string; kind: 'challenge'; date: ISODate }`, `nextWin(input: { medals: readonly Medal[]; challengeDone: boolean; today: ISODate; celebrated: readonly string[] | null | undefined; waiting?: boolean }): { seed: string[] | null; next: Win | null }`, `CHALLENGE_IDS_KEEP_DAYS = 14`, `withCelebrated(celebrated, ids: readonly string[], today: ISODate): string[]`.
- Words: the `medal_*` and `shelf_*` keys in all three languages.

- [ ] **Step 1: Write the failing tests**

Create `src/core/__tests__/medals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import {
  CHALLENGE_IDS_KEEP_DAYS,
  CHALLENGE_MEDALS,
  challengeWinId,
  earnedMedals,
  medalFace,
  medalWords,
  MEDALS_SEEDED,
  nextMedals,
  nextWin,
  shelf,
  shelfWords,
  STREAK_MEDALS,
  withCelebrated,
  type MedalInput,
} from '../medals';

const TODAY = '2026-10-31';
const none: MedalInput = { meals: { now: 0, best: 0 }, routine: null, lostKg: 0, totalKg: 10, weeks: [], challengesDone: 0, celebrated: [MEDALS_SEEDED] };
const ids = (input: MedalInput) => earnedMedals(input).map((m) => m.id);

describe('earnedMedals', () => {
  it('earns the streak medals at 3, 7, 21, 30, 66 and 100 days, by the best run with the shield, for the meals and for the routine', () => {
    expect(STREAK_MEDALS).toEqual([3, 7, 21, 30, 66, 100]);
    expect(ids({ ...none, meals: { now: 2, best: 8 } })).toEqual(['medal:meals:3', 'medal:meals:7']);
    expect(ids({ ...none, routine: { now: 21, best: 21 } })).toEqual(['medal:routine:3', 'medal:routine:7', 'medal:routine:21']);
    // No list: no routine medals, whatever was passed.
    expect(ids({ ...none, routine: null })).toEqual([]);
  });

  it('earns a medal for each kilo lost from the very first start, halfway and the goal; none with no loss to aim for', () => {
    expect(ids({ ...none, lostKg: 5.2 })).toEqual(['medal:kg:1', 'medal:kg:2', 'medal:kg:3', 'medal:kg:4', 'medal:kg:5', 'medal:halfway']);
    expect(ids({ ...none, lostKg: 10 })).toContain('medal:goal');
    expect(ids({ ...none, lostKg: 0.9 })).toEqual([]);
    expect(ids({ ...none, lostKg: 3, totalKg: 0 })).toEqual([]);
  });

  it('earns a medal for each perfect week of a job, and the challenge medals at 10, 30 and 100', () => {
    expect(CHALLENGE_MEDALS).toEqual([10, 30, 100]);
    const weeks = [{ itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' }];
    expect(earnedMedals({ ...none, weeks, challengesDone: 31 })).toEqual([
      { id: 'medal:week:yoga:2026-10-19', track: 'week', n: 1, name: 'Yoga' },
      { id: 'medal:challenges:10', track: 'challenges', n: 10 },
      { id: 'medal:challenges:30', track: 'challenges', n: 30 },
    ]);
  });

  it('keeps a medal once celebrated, after the run ended or the kilo came back, and counts the old badges as the medals they became', () => {
    const celebrated = [MEDALS_SEEDED, 'medal:meals:21', 'medal:kg:3', 'badge:streak_30', 'badge:kg_5', 'badge:summit'];
    expect(ids({ ...none, celebrated })).toEqual(['medal:meals:21', 'medal:meals:30', 'medal:kg:3', 'medal:kg:5', 'medal:goal']);
    // The badges retired with no medal of their own earn nothing.
    expect(ids({ ...none, celebrated: [MEDALS_SEEDED, 'badge:first_meal', 'badge:water_7', 'level:camp2', 'challenge:2026-10-25'] })).toEqual([]);
  });
});

describe('nextMedals', () => {
  it("gives each track's next medal with how far it is: days from the streak now, kilos to one decimal, challenges", () => {
    const input = { ...none, meals: { now: 5, best: 8 }, routine: { now: 2, best: 2 }, lostKg: 3.6, challengesDone: 4 };
    expect(nextMedals(input, earnedMedals(input))).toEqual([
      { id: 'medal:meals:21', track: 'meals', n: 21, toGo: 16 },
      { id: 'medal:routine:3', track: 'routine', n: 3, toGo: 1 },
      { id: 'medal:kg:4', track: 'kg', n: 4, toGo: 0.4 },
      { id: 'medal:halfway', track: 'halfway', n: 1, toGo: 1.4 },
      { id: 'medal:goal', track: 'goal', n: 1, toGo: 6.4 },
      { id: 'medal:challenges:10', track: 'challenges', n: 10, toGo: 6 },
    ]);
  });

  it('has none for a track done, the routine with no list, or kilos with no goal', () => {
    const input = { ...none, meals: { now: 100, best: 100 }, challengesDone: 100, totalKg: 0 };
    expect(nextMedals(input, earnedMedals(input))).toEqual([]);
  });
});

describe('shelf', () => {
  it('shows the medals earned, the kilos as the highest, perfect weeks as one per job with how many, then the next of each track', () => {
    const weeks = [
      { itemId: 'yoga', monday: '2026-10-12', name: 'Yoga' },
      { itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' },
    ];
    const tiles = shelf({ ...none, meals: { now: 7, best: 7 }, lostKg: 2.3, weeks, totalKg: 4 });
    expect(tiles.map((x) => x.key)).toEqual([
      'medal:meals:3',
      'medal:meals:7',
      'medal:kg',
      'medal:halfway',
      'week:yoga',
      'next:medal:meals:21',
      'next:medal:kg:3',
      'next:medal:goal',
      'next:medal:challenges:10',
    ]);
    expect(tiles.find((x) => x.key === 'medal:kg')).toEqual({ key: 'medal:kg', track: 'kg', n: 2, earned: true });
    expect(tiles.find((x) => x.key === 'week:yoga')).toEqual({ key: 'week:yoga', track: 'week', n: 1, earned: true, name: 'Yoga', count: 2 });
  });
});

describe('the words', () => {
  const t = makeT('en');

  it('names a medal and says what it took', () => {
    expect(medalWords({ track: 'routine', n: 21 }, t)).toEqual({ title: '21 days of your routine in a row', line: 'Showing up, day after day. This is how a routine becomes who you are.' });
    expect(medalWords({ track: 'week', n: 1, name: 'Yoga' }, t).title).toBe('Perfect week: Yoga');
    expect(medalWords({ track: 'goal', n: 1 }, t).title).toBe('Goal reached');
    expect(medalWords({ track: 'challenges', n: 10 }, makeT('mr')).title).toBe('10 आव्हानं पूर्ण');
  });

  it('labels a shelf place, with its track and how far one still to earn is', () => {
    expect(shelfWords({ key: 'k', track: 'meals', n: 7, earned: true }, t)).toEqual({ label: '7 days', sub: 'Meals' });
    expect(shelfWords({ key: 'k', track: 'routine', n: 30, earned: false, toGo: 9 }, t)).toEqual({ label: '30 days', sub: 'Routine · 9 to go' });
    expect(shelfWords({ key: 'k', track: 'halfway', n: 1, earned: false, toGo: 1.4 }, t)).toEqual({ label: 'Halfway to your goal', sub: '1.4 kg to go' });
    expect(shelfWords({ key: 'k', track: 'week', n: 1, earned: true, name: 'Yoga', count: 3 }, t)).toEqual({ label: 'Perfect week: Yoga', sub: '×3' });
    expect(shelfWords({ key: 'k', track: 'kg', n: 4, earned: true }, makeT('hi'))).toEqual({ label: '4 किलो कम', sub: null });
  });

  it('puts a number, ½, ★ or ✓ on the face', () => {
    expect([medalFace('meals', 21), medalFace('halfway', 1), medalFace('goal', 1), medalFace('week', 1), medalFace('kg', 3)]).toEqual(['21', '½', '★', '✓', '3']);
  });
});

describe('nextWin', () => {
  const medals = earnedMedals({ ...none, meals: { now: 7, best: 7 } });

  it('the first time, or coming from the badges, marks everything already earned seen and celebrates nothing', () => {
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: null })).toEqual({ seed: [MEDALS_SEEDED, 'medal:meals:3', 'medal:meals:7', challengeWinId(TODAY)], next: null });
    expect(nextWin({ medals, challengeDone: false, today: TODAY, celebrated: ['badge:first_meal', 'level:camp1'] }).seed).toEqual([MEDALS_SEEDED, 'medal:meals:3', 'medal:meals:7']);
  });

  it('then celebrates each medal once, smallest first, then the day’s challenge, and waits while something is open', () => {
    const celebrated = [MEDALS_SEEDED, 'medal:meals:3'];
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated }).next).toEqual({ id: 'medal:meals:7', kind: 'medal', medal: medals[1] });
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: [...celebrated, 'medal:meals:7'] }).next).toEqual({ id: 'challenge:day:2026-10-31', kind: 'challenge', date: TODAY });
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: [...celebrated, 'medal:meals:7', 'challenge:day:2026-10-31'] }).next).toBeNull();
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated, waiting: true })).toEqual({ seed: null, next: null });
  });
});

describe('withCelebrated', () => {
  it('adds the ids once each and drops the days’ challenges older than a fortnight, keeping everything else', () => {
    expect(CHALLENGE_IDS_KEEP_DAYS).toBe(14);
    const before = [MEDALS_SEEDED, 'badge:streak_7', 'challenge:2026-09-06', 'challenge:day:2026-10-16', 'challenge:day:2026-10-17'];
    expect(withCelebrated(before, ['medal:meals:3', 'badge:streak_7'], TODAY)).toEqual([MEDALS_SEEDED, 'badge:streak_7', 'challenge:2026-09-06', 'challenge:day:2026-10-17', 'medal:meals:3']);
    expect(withCelebrated(null, ['x'], TODAY)).toEqual(['x']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/medals.test.ts`
Expected: FAIL, because `../medals` does not exist yet: `Test Files  1 failed (1)`, the first reads `Error: Cannot find module '../medals'`

- [ ] **Step 3: Create `src/core/medals.ts`**

Create `src/core/medals.ts`:

```ts
import { addDays } from './date';
import type { ISODate } from './types';
import { fill } from '../i18n';

/**
 * Medals: the one reward system. A medal is earned from the logs, worked out
 * again every time like everything else in the app, and kept once celebrated:
 * its id goes into `celebrated` (the same "earned, and celebrated once" the
 * old badges used), so a run that ends or a kilo that comes back never takes
 * a medal away. The tracks: days in a row of the meal record and of the
 * routine (3, 7, 21, 30, 66 and 100, each streak with its shield), each kilo
 * lost from the very first start, halfway to the goal, the goal reached, a
 * perfect week of a routine job, and challenges done (10, 30 and 100). The
 * old streak and kilo badges a user won count as the medals they became.
 * Pure.
 */
export type MedalTrack = 'meals' | 'routine' | 'kg' | 'halfway' | 'goal' | 'week' | 'challenges';

export const STREAK_MEDALS = [3, 7, 21, 30, 66, 100] as const;
export const CHALLENGE_MEDALS = [10, 30, 100] as const;
/** The tracks in the order the shelf and the celebrations take them. */
export const TRACKS: readonly MedalTrack[] = ['meals', 'routine', 'kg', 'halfway', 'goal', 'week', 'challenges'];

/** A medal: its id (what `celebrated` keeps), its track, its number (days, kilos, challenges; 1 for the rest), and for a perfect week the job's name. */
export type Medal = { id: string; track: MedalTrack; n: number; name?: string };

export type MedalInput = {
  /** The meal record's streak now and its best run over the whole journey, both with the shield. */
  meals: { now: number; best: number };
  /** The routine's streak now and its best run, with the shield; null while the user has no list. */
  routine: { now: number; best: number } | null;
  /** Kilos lost from the very first start to the weight shown, and from that start to the goal: 0 or less is no loss to aim for, and no kilo medals. */
  lostKg: number;
  totalKg: number;
  /** Perfect weeks of routine jobs (`perfectWeeks`), each with its job's name. */
  weeks: { itemId: string; monday: ISODate; name: string }[];
  /** Challenges done (`challengesDone`). */
  challengesDone: number;
  celebrated: readonly string[] | null | undefined;
};

/** The badge each medal was before medals, so a badge already won is the medal won. */
const LEGACY: Record<string, string> = {
  'medal:meals:7': 'badge:streak_7',
  'medal:meals:30': 'badge:streak_30',
  'medal:kg:1': 'badge:kg_1',
  'medal:kg:5': 'badge:kg_5',
  'medal:halfway': 'badge:halfway',
  'medal:goal': 'badge:summit',
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Every medal earned, in the shelf's order: by rule now, or kept because it was celebrated (as itself or as the badge it was). */
export function earnedMedals(input: MedalInput): Medal[] {
  const kept = new Set(input.celebrated ?? []);
  const has = (id: string) => kept.has(id) || (LEGACY[id] !== undefined && kept.has(LEGACY[id]));
  const out: Medal[] = [];
  const steps = (track: MedalTrack, list: readonly number[], reached: number) => {
    for (const n of list) if (reached >= n || has(`medal:${track}:${n}`)) out.push({ id: `medal:${track}:${n}`, track, n });
  };
  steps('meals', STREAK_MEDALS, Math.max(input.meals.now, input.meals.best));
  steps('routine', STREAK_MEDALS, input.routine ? Math.max(input.routine.now, input.routine.best) : 0);
  const kilos = new Set<number>();
  if (input.totalKg > 0) for (let k = 1; k <= Math.floor(input.lostKg + 1e-9); k++) kilos.add(k);
  for (const id of Object.keys(LEGACY)) if (id.startsWith('medal:kg:') && has(id)) kilos.add(Number(id.slice(9)));
  for (const id of kept) if (/^medal:kg:\d+$/.test(id)) kilos.add(Number(id.slice(9)));
  for (const k of [...kilos].sort((a, b) => a - b)) out.push({ id: `medal:kg:${k}`, track: 'kg', n: k });
  if ((input.totalKg > 0 && input.lostKg >= input.totalKg / 2) || has('medal:halfway')) out.push({ id: 'medal:halfway', track: 'halfway', n: 1 });
  if ((input.totalKg > 0 && input.lostKg >= input.totalKg) || has('medal:goal')) out.push({ id: 'medal:goal', track: 'goal', n: 1 });
  for (const w of input.weeks) out.push({ id: `medal:week:${w.itemId}:${w.monday}`, track: 'week', n: 1, name: w.name });
  steps('challenges', CHALLENGE_MEDALS, input.challengesDone);
  return out;
}

/** A medal still to earn, with how far it is: days, kilos (to one decimal) or challenges. */
export type NextMedal = Medal & { toGo: number };

/** The next medal of each track still to earn, in the shelf's order: none for a track with every medal earned, the routine with no list, or the kilos with no loss to aim for. */
export function nextMedals(input: MedalInput, earned: readonly Medal[]): NextMedal[] {
  const ids = new Set(earned.map((m) => m.id));
  const out: NextMedal[] = [];
  const step = (track: MedalTrack, list: readonly number[], now: number) => {
    const n = list.find((x) => !ids.has(`medal:${track}:${x}`));
    if (n !== undefined) out.push({ id: `medal:${track}:${n}`, track, n, toGo: Math.max(1, n - now) });
  };
  step('meals', STREAK_MEDALS, input.meals.now);
  if (input.routine) step('routine', STREAK_MEDALS, input.routine.now);
  if (input.totalKg > 0) {
    const top = earned.filter((m) => m.track === 'kg').reduce((a, m) => Math.max(a, m.n), 0);
    const k = top + 1;
    if (k <= Math.ceil(input.totalKg)) out.push({ id: `medal:kg:${k}`, track: 'kg', n: k, toGo: Math.max(0.1, round1(k - input.lostKg)) });
    if (!ids.has('medal:halfway')) out.push({ id: 'medal:halfway', track: 'halfway', n: 1, toGo: Math.max(0.1, round1(input.totalKg / 2 - input.lostKg)) });
    if (!ids.has('medal:goal')) out.push({ id: 'medal:goal', track: 'goal', n: 1, toGo: Math.max(0.1, round1(input.totalKg - input.lostKg)) });
  }
  step('challenges', CHALLENGE_MEDALS, input.challengesDone);
  return out;
}

/** One place on the trophy shelf: a medal earned (the kilos as the highest one, a job's perfect weeks as one with how many), or the next to earn. */
export type ShelfTile = { key: string; track: MedalTrack; n: number; earned: boolean; name?: string; count?: number; toGo?: number };

/** The trophy shelf: every medal earned, then the next one of each track, each in the tracks' order. */
export function shelf(input: MedalInput): ShelfTile[] {
  const earned = earnedMedals(input);
  const tiles: ShelfTile[] = [];
  for (const m of earned) {
    if (m.track === 'kg') continue;
    if (m.track === 'week') {
      const id = m.id.split(':')[2];
      const same = tiles.find((x) => x.track === 'week' && x.key === `week:${id}`);
      if (same) same.count = (same.count ?? 1) + 1;
      else tiles.push({ key: `week:${id}`, track: 'week', n: 1, earned: true, name: m.name, count: 1 });
      continue;
    }
    tiles.push({ key: m.id, track: m.track, n: m.n, earned: true });
  }
  const kilos = earned.filter((m) => m.track === 'kg');
  if (kilos.length > 0) tiles.push({ key: 'medal:kg', track: 'kg', n: kilos[kilos.length - 1].n, earned: true });
  tiles.sort((a, b) => TRACKS.indexOf(a.track) - TRACKS.indexOf(b.track));
  for (const m of nextMedals(input, earned)) tiles.push({ key: `next:${m.id}`, track: m.track, n: m.n, earned: false, toGo: m.toGo });
  return tiles;
}

/** What a medal's face carries: its number for a streak, a kilo or challenges, ½ halfway, ★ at the goal, ✓ for a perfect week. */
export function medalFace(track: MedalTrack, n: number): string {
  if (track === 'halfway') return '½';
  if (track === 'goal') return '★';
  if (track === 'week') return '✓';
  return String(n);
}

/** A medal's title and its line, for the celebration: "21 days of your routine in a row", and a word of what it took. */
export function medalWords(m: Pick<Medal, 'track' | 'n' | 'name'>, t: (key: string) => string): { title: string; line: string } {
  const title =
    m.track === 'meals' || m.track === 'routine' || m.track === 'kg' || m.track === 'challenges'
      ? fill(t(`medal_${m.track}_title`), { n: m.n })
      : m.track === 'week'
        ? fill(t('medal_week'), { name: m.name ?? '' })
        : t(`medal_${m.track}`);
  const line = t(m.track === 'meals' || m.track === 'routine' ? 'medal_sub_streak' : `medal_sub_${m.track}`);
  return { title, line };
}

/** A shelf tile's words: its name ("21 days", "Halfway to your goal") and, under it, its track for a streak and how far a medal still to earn is. */
export function shelfWords(tile: ShelfTile, t: (key: string) => string): { label: string; sub: string | null } {
  const streak = tile.track === 'meals' || tile.track === 'routine';
  const label = streak ? fill(t('medal_streak_days'), { n: tile.n }) : tile.track === 'kg' || tile.track === 'challenges' ? fill(t(`medal_${tile.track}_title`), { n: tile.n }) : medalWords(tile, t).title;
  const toGo = tile.toGo === undefined ? null : fill(t(tile.track === 'kg' || tile.track === 'halfway' || tile.track === 'goal' ? 'medal_to_go_kg' : 'medal_to_go'), { n: tile.toGo });
  const parts = [streak ? t(`medal_track_${tile.track}`) : null, toGo, tile.count && tile.count > 1 ? `×${tile.count}` : null].filter((x): x is string => x !== null);
  return { label, sub: parts.length > 0 ? parts.join(' · ') : null };
}

/** Marks the store's celebrated ids as seeded for medals: until it is there, every medal already earned is marked seen at once, with no celebration. */
export const MEDALS_SEEDED = 'medals:seeded';

/** The id a day's challenge done is celebrated under. */
export function challengeWinId(date: ISODate): string {
  return `challenge:day:${date}`;
}

export type Win = { id: string; kind: 'medal'; medal: Medal } | { id: string; kind: 'challenge'; date: ISODate };

/**
 * Which win to celebrate next: a medal earned, then today's challenge done,
 * each once. The first time this runs with medals (no `MEDALS_SEEDED` in the
 * ids yet, a new user or one coming from the badges) everything already
 * earned is marked seen, the challenge too, rather than celebrated in a
 * flood. While `waiting` (the add sheet open, a toast or a line with Undo on
 * screen) nothing is celebrated yet.
 */
export function nextWin(input: { medals: readonly Medal[]; challengeDone: boolean; today: ISODate; celebrated: readonly string[] | null | undefined; waiting?: boolean }): { seed: string[] | null; next: Win | null } {
  const wins: Win[] = [...input.medals.map((medal) => ({ id: medal.id, kind: 'medal' as const, medal })), ...(input.challengeDone ? [{ id: challengeWinId(input.today), kind: 'challenge' as const, date: input.today }] : [])];
  if (!input.celebrated?.includes(MEDALS_SEEDED)) return { seed: [MEDALS_SEEDED, ...wins.map((w) => w.id)], next: null };
  if (input.waiting) return { seed: null, next: null };
  const seen = new Set(input.celebrated);
  return { seed: null, next: wins.find((w) => !seen.has(w.id)) ?? null };
}

/** How long a day's challenge stays among the celebrated ids: a fortnight, so the list never grows by one a day for good. */
export const CHALLENGE_IDS_KEEP_DAYS = 14;

/** The celebrated ids with `ids` added, once each, and every day's challenge older than a fortnight dropped; medals, badges and everything else stay. */
export function withCelebrated(celebrated: readonly string[] | null | undefined, ids: readonly string[], today: ISODate): string[] {
  const from = addDays(today, -CHALLENGE_IDS_KEEP_DAYS);
  const day = challengeWinId('');
  return [...new Set([...(celebrated ?? []), ...ids])].filter((id) => !(id.startsWith(day) && id.slice(day.length) < from));
}
```

- [ ] **Step 4: Add the words to `src/i18n/index.ts`**

Add 21 keys at the end of each of the three dicts. First check that none is there yet:

Run: `grep -nE "^  (medal_streak_days|medal_meals_title|medal_routine_title|medal_kg_title|medal_halfway|medal_goal|medal_week|medal_challenges_title|medal_track_meals|medal_track_routine|medal_to_go|medal_to_go_kg|medal_new|medal_sub_streak|medal_sub_kg|medal_sub_halfway|medal_sub_goal|medal_sub_week|medal_sub_challenges|shelf_title|shelf_count):" src/i18n/index.ts`
Expected: no output.

In `src/i18n/index.ts` replace

```ts
  chal_done_title: 'Challenge done',
  chal_count: '{n} challenges done so far.',
  chal_count_one: 'Your first challenge done.',
};

const mr: Dict = {
```

with

```ts
  chal_done_title: 'Challenge done',
  chal_count: '{n} challenges done so far.',
  chal_count_one: 'Your first challenge done.',
  medal_streak_days: '{n} days',
  medal_meals_title: '{n} days of meals in a row',
  medal_routine_title: '{n} days of your routine in a row',
  medal_kg_title: '{n} kg lost',
  medal_halfway: 'Halfway to your goal',
  medal_goal: 'Goal reached',
  medal_week: 'Perfect week: {name}',
  medal_challenges_title: '{n} challenges done',
  medal_track_meals: 'Meals',
  medal_track_routine: 'Routine',
  medal_to_go: '{n} to go',
  medal_to_go_kg: '{n} kg to go',
  medal_new: 'New medal',
  medal_sub_streak: 'Showing up, day after day. This is how a routine becomes who you are.',
  medal_sub_kg: 'Every kilo is real work. Well done.',
  medal_sub_halfway: 'Half the way is done.',
  medal_sub_goal: 'You did what you set out to do.',
  medal_sub_week: 'Done on every day it was due this week.',
  medal_sub_challenges: 'Small steps, done again and again.',
  shelf_title: 'Trophy shelf',
  shelf_count: '{n} earned',
};

const mr: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  chal_done_title: 'आव्हान पूर्ण',
  chal_count: 'आतापर्यंत {n} आव्हानं पूर्ण.',
  chal_count_one: 'तुमचं पहिलं आव्हान पूर्ण.',
};

const hi: Dict = {
```

with

```ts
  chal_done_title: 'आव्हान पूर्ण',
  chal_count: 'आतापर्यंत {n} आव्हानं पूर्ण.',
  chal_count_one: 'तुमचं पहिलं आव्हान पूर्ण.',
  medal_streak_days: '{n} दिवस',
  medal_meals_title: 'सलग {n} दिवस जेवणाची नोंद',
  medal_routine_title: 'सलग {n} दिवस दिनक्रम पूर्ण',
  medal_kg_title: '{n} किलो कमी',
  medal_halfway: 'लक्ष्याचा अर्धा टप्पा',
  medal_goal: 'लक्ष्य गाठलं',
  medal_week: 'परिपूर्ण आठवडा: {name}',
  medal_challenges_title: '{n} आव्हानं पूर्ण',
  medal_track_meals: 'जेवण',
  medal_track_routine: 'दिनक्रम',
  medal_to_go: 'अजून {n}',
  medal_to_go_kg: 'अजून {n} किलो',
  medal_new: 'नवं पदक',
  medal_sub_streak: 'रोज थोडं, रोज हजर. असाच दिनक्रम तुमची ओळख बनतो.',
  medal_sub_kg: 'प्रत्येक किलो ही खरी मेहनत आहे. छान.',
  medal_sub_halfway: 'अर्धा रस्ता पार केलात.',
  medal_sub_goal: 'जे ठरवलं होतं ते तुम्ही करून दाखवलं.',
  medal_sub_week: 'या आठवड्यात ठरलेल्या प्रत्येक दिवशी पूर्ण.',
  medal_sub_challenges: 'छोटी पावलं, पुन्हा पुन्हा.',
  shelf_title: 'पदकांचं कपाट',
  shelf_count: '{n} मिळाली',
};

const hi: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  chal_done_title: 'चुनौती पूरी',
  chal_count: 'अब तक {n} चुनौतियाँ पूरी.',
  chal_count_one: 'आपकी पहली चुनौती पूरी.',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

with

```ts
  chal_done_title: 'चुनौती पूरी',
  chal_count: 'अब तक {n} चुनौतियाँ पूरी.',
  chal_count_one: 'आपकी पहली चुनौती पूरी.',
  medal_streak_days: '{n} दिन',
  medal_meals_title: 'लगातार {n} दिन खाना दर्ज',
  medal_routine_title: 'लगातार {n} दिन दिनचर्या पूरी',
  medal_kg_title: '{n} किलो कम',
  medal_halfway: 'लक्ष्य का आधा रास्ता',
  medal_goal: 'लक्ष्य पूरा',
  medal_week: 'पूरा हफ़्ता: {name}',
  medal_challenges_title: '{n} चुनौतियाँ पूरी',
  medal_track_meals: 'खाना',
  medal_track_routine: 'दिनचर्या',
  medal_to_go: '{n} और',
  medal_to_go_kg: '{n} किलो और',
  medal_new: 'नया पदक',
  medal_sub_streak: 'रोज़ थोड़ा, रोज़ हाज़िर. ऐसे ही दिनचर्या आपकी पहचान बनती है.',
  medal_sub_kg: 'हर किलो असली मेहनत है. बहुत बढ़िया.',
  medal_sub_halfway: 'आधा रास्ता तय हो गया.',
  medal_sub_goal: 'जो ठाना था, वह कर दिखाया.',
  medal_sub_week: 'इस हफ़्ते हर तय दिन पूरा.',
  medal_sub_challenges: 'छोटे कदम, बार-बार.',
  shelf_title: 'पदकों की अलमारी',
  shelf_count: '{n} मिले',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/core/__tests__/medals.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1821 tests passing; relay 73 tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/core/__tests__/medals.test.ts src/core/medals.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Medals replace the badges: 3 to 100 days of each streak, each kilo lost, halfway, the goal, perfect weeks and challenges done, each celebrated once and kept; a streak or kilo badge already won counts as its medal, and the first run marks everything already earned as seen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The kind teacher, and the streak line on "Day so far"

Decisions 5 and 7. The teacher's words come from pure code: what went well first (jobs done, meals logged, the water goal, minutes walked), the best day of the week when today did more than every other day so far, and one small tip for tomorrow; a day with nothing done is "not yet" with one easier thing for tomorrow, and the first evening after such a day opens with "Welcome back". "Day so far" gains an optional `streaks` input: with a streak of three days or more and the day not complete, its body starts with one kind line. The phone passes the streaks for today's text only; the relay's schedule keeps its shape (`buildPushSchedule` takes the meal streak as a sixth argument and works out the routine streak itself, on finished timers).

**Files:**
- Modify: `src/core/__tests__/checklist.test.ts`
- Modify: `src/core/__tests__/pushSchedule.test.ts`
- Create: `src/core/__tests__/teacher.test.ts`
- Modify: `src/core/checklist.ts`
- Modify: `src/core/pushSchedule.ts`
- Create: `src/core/teacher.ts`
- Modify: `src/i18n/index.ts`
- Modify: `src/services/usePushSync.ts`
- Modify: `src/services/useScheduledReminders.ts`

**Interfaces:**
- Consumes: `isDone`, `itemsOn`, `minutesOn`, `streakRun`; `skippedOn`; `slotStates`; `walkMinutesOn`, `waterMlOn`; `fill`.
- Produces, in `src/core/teacher.ts`: `type DayScore = { meals: { done: number; of: number }; jobs: { done: number; of: number; next: string | null }; water: { ml: number; goal: number }; walk: { min: number; goal: number } }`, `dayScore(input: { date; routine; meals; skips; nowMinutes: number; abhyas: AbhyasData; now: Date; water; activities; waterGoalMl: number; walkGoalMin: number }): DayScore`, `scoreOf(d: DayScore): number`, `nothingDone(d: DayScore): boolean`, `teacherWords(input: { today: DayScore; yesterday: DayScore | null; earlier: DayScore[] }, t): { lead: string; best: string | null; tip: string }`.
- Produces, in `src/core/checklist.ts`: `ChecklistInput.streaks?: { meals: number; routine: number }`, `STREAK_NUDGE_DAYS = 3`.
- Produces, in `src/core/pushSchedule.ts`: `buildPushSchedule(state, today, t, tz, menu = null, mealStreak = 0): PushSchedule` (shape unchanged).
- Words: the `teach_*` and `rem_streak_*` keys in all three languages.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/checklist.test.ts` replace

```ts
    expect(withTimeAt(['13:00', '20:30'], 2, '10:30')).toBeNull();
  });
});
```

with

```ts
    expect(withTimeAt(['13:00', '20:30'], 2, '10:30')).toBeNull();
  });
});

describe('dayChecklist: the kind line for a streak', () => {
  const list = { items: [yoga, coding], ticks: [tick('coding')], sessions: [], running: null };

  it("opens with the routine streak's line while jobs are left today, from three days", () => {
    const r = dayChecklist({ ...base, meals: [meal('morning'), meal('lunch'), meal('dinner')], abhyas: list, streaks: { meals: 5, routine: 21 } });
    expect(r!.body.split('\n')[0]).toBe('Your 21-day routine streak needs one more job today.');
    const two = dayChecklist({ ...base, abhyas: { ...list, ticks: [] }, streaks: { meals: 0, routine: 3 } });
    expect(two!.body.split('\n')[0]).toBe('Your 3-day routine streak needs 2 more jobs today.');
  });

  it("else the meal record's while a meal is left, and nothing under three days or with the jobs and meals done", () => {
    const jobsDone = { ...list, ticks: [tick('coding'), tick('yoga')] };
    expect(dayChecklist({ ...base, abhyas: jobsDone, streaks: { meals: 7, routine: 9 } })!.body.split('\n')[0]).toBe("Your 7-day streak needs today's meals too.");
    expect(dayChecklist({ ...base, abhyas: list, streaks: { meals: 2, routine: 2 } })!.body.split('\n')[0]).toBe('○ Breakfast · ○ Lunch · ○ Dinner');
    // Meals and jobs done, the water left: no line, the list as ever.
    const r = dayChecklist({ ...base, meals: [meal('morning'), meal('lunch'), meal('dinner')], abhyas: jobsDone, streaks: { meals: 7, routine: 9 } });
    expect(r!.body.split('\n')[0]).toBe('✓ Breakfast · ✓ Lunch · ✓ Dinner');
    // Everything done: nothing is sent, streak or not.
    expect(dayChecklist({ ...base, meals: [meal('morning'), meal('lunch'), meal('dinner')], abhyas: jobsDone, water: [bottle(3000)], activities: [walk(30)], streaks: { meals: 7, routine: 9 } })).toBeNull();
  });

  it('in Marathi', () => {
    expect(dayChecklist({ ...base, lang: 'mr', t: makeT('mr'), abhyas: list, streaks: { meals: 0, routine: 21 } })!.body.split('\n')[0]).toBe('तुमच्या 21 दिवसांच्या दिनक्रम मालिकेला आज अजून एक काम हवं.');
  });
});
```

In `src/core/__tests__/pushSchedule.test.ts` replace

```ts
    expect(build(withSettings(state, { checklistTimes: ['21:00', 'x', '13:00'] })).checklist!.times).toEqual(['13:00', '21:00']);
  });

  it('says what the day so far says on the phone, from the same menu', () => {
    const menu: DayMenu = {
      date: TODAY,
```

with

```ts
    expect(build(withSettings(state, { checklistTimes: ['21:00', 'x', '13:00'] })).checklist!.times).toEqual(['13:00', '21:00']);
  });

  it("opens the day so far with a streak's kind line, the meal streak passed in, and keeps the schedule's shape", () => {
    const s = buildPushSchedule({ ...state, meals: [meal('breakfast')] }, TODAY, en, 'Asia/Kolkata', null, 5);
    expect(s.checklist!.body.split('\n')[0]).toBe("Your 5-day streak needs today's meals too.");
    expect(Object.keys(s)).toEqual(Object.keys(build(state)));
    // Under three days, no line.
    expect(buildPushSchedule({ ...state, meals: [meal('breakfast')] }, TODAY, en, 'Asia/Kolkata', null, 2).checklist!.body.split('\n')[0]).toMatch(/^✓ Breakfast/);
  });

  it('says what the day so far says on the phone, from the same menu', () => {
    const menu: DayMenu = {
      date: TODAY,
```

Create `src/core/__tests__/teacher.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import { dayScore, nothingDone, scoreOf, teacherWords, type DayScore } from '../teacher';
import type { AbhyasItem, AbhyasTick, Meal } from '../types';

const DAY = '2026-10-28';
const slot = (id: string, type: RoutineSlot['type'], time: string): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share: 30 });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30'), slot('lunch', 'lunch', '13:00'), slot('dinner', 'dinner', '20:30')] };
const meal = (slotId: string): Meal => ({ id: slotId, at: `${DAY}T08:00:00.000Z`, date: DAY, type: 'lunch', slotId, items: [], kcal: 400, protein: 10 });
const item = (id: string, order: number): AbhyasItem => ({ id, name: id, icon: 'book-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: [], order, createdAt: '2026-10-01T03:00:00.000Z' });
const tick = (itemId: string): AbhyasTick => ({ id: `${itemId}@${DAY}`, itemId, date: DAY, at: `${DAY}T09:00:00.000Z` });
const t = makeT('en');
const score = (p: Partial<DayScore> = {}): DayScore => ({ meals: { done: 0, of: 2 }, jobs: { done: 0, of: 0, next: null }, water: { ml: 0, goal: 3000 }, walk: { min: 0, goal: 30 }, ...p });

describe('dayScore', () => {
  const input = {
    date: DAY,
    routine,
    meals: [meal('morning')],
    skips: [],
    nowMinutes: 18 * 60,
    abhyas: { items: [item('Yoga', 0), item('Coding', 1), item('Reading', 2)], ticks: [tick('Yoga')], sessions: [], running: null },
    now: new Date(`${DAY}T18:00:00`),
    water: [{ id: 'w', at: '', date: DAY, ml: 3000 }],
    activities: [],
    waterGoalMl: 3000,
    walkGoalMin: 30,
  };

  it('counts the meals due so far, the jobs done with the first one left, water and the walk', () => {
    // At 18:00 dinner (20:30) is not due yet: one of two meals.
    expect(dayScore(input)).toEqual({ meals: { done: 1, of: 2 }, jobs: { done: 1, of: 3, next: 'Coding' }, water: { ml: 3000, goal: 3000 }, walk: { min: 0, goal: 30 } });
    expect(dayScore({ ...input, nowMinutes: 1440 }).meals).toEqual({ done: 1, of: 3 });
  });

  it('scores a day by meals logged, jobs done and the water goal met', () => {
    expect(scoreOf(dayScore(input))).toBe(3);
    expect(nothingDone(score())).toBe(true);
    expect(nothingDone(score({ walk: { min: 10, goal: 30 } }))).toBe(false);
  });
});

describe('teacherWords', () => {
  it('starts with what went well, then one tip for tomorrow: the first job not done', () => {
    const today = score({ meals: { done: 2, of: 2 }, jobs: { done: 2, of: 3, next: 'Coding' }, water: { ml: 3000, goal: 3000 }, walk: { min: 15, goal: 30 } });
    expect(teacherWords({ today, yesterday: null, earlier: [] }, t)).toEqual({
      lead: 'Well done today: 2 of 3 jobs done, every meal logged, water goal met, 15 min walked.',
      best: null,
      tip: 'Tomorrow, start Coding a little earlier.',
    });
  });

  it('takes the tip from what is left, in turn: jobs, meals, water, the walk, else the same again', () => {
    const tip = (p: Partial<DayScore>) => teacherWords({ today: score({ meals: { done: 1, of: 1 }, water: { ml: 3000, goal: 3000 }, walk: { min: 30, goal: 30 }, ...p }), yesterday: null, earlier: [] }, t).tip;
    expect(tip({ meals: { done: 1, of: 2 } })).toBe('Tomorrow, log each meal as you eat it.');
    expect(tip({ water: { ml: 1000, goal: 3000 } })).toBe('Tomorrow, one bottle of water before lunch.');
    expect(tip({ walk: { min: 10, goal: 30 } })).toBe('Tomorrow, a ten-minute walk after a meal.');
    expect(tip({})).toBe('Tomorrow, the same again. You know how.');
  });

  it('a day with nothing done yet is "not yet", never missed, with one easier thing for tomorrow', () => {
    expect(teacherWords({ today: score(), yesterday: null, earlier: [] }, t)).toEqual({
      lead: "Not yet today, and that's okay.",
      best: null,
      tip: 'Tomorrow, just one small thing: a bottle of water when you wake up.',
    });
  });

  it('welcomes the user back on the first evening after a day with nothing done', () => {
    const today = score({ meals: { done: 1, of: 2 } });
    expect(teacherWords({ today, yesterday: score(), earlier: [score()] }, t).lead).toBe('Welcome back. Well done today: 1 meal logged.');
    expect(teacherWords({ today: score({ water: { ml: 500, goal: 3000 } }), yesterday: null, earlier: [] }, t).lead).toBe('Well done today: you made a start.');
  });

  it('says so when today did more than every other day of the week so far', () => {
    const today = score({ meals: { done: 2, of: 2 }, jobs: { done: 3, of: 3, next: null }, water: { ml: 3000, goal: 3000 } });
    const earlier = [score({ meals: { done: 2, of: 2 } }), score({ jobs: { done: 3, of: 3, next: null } })];
    expect(teacherWords({ today, yesterday: earlier[1], earlier }, t).best).toBe('Today was your best day this week: 6 of 6 done.');
    // A tie is not the best, and Monday has nothing to compare with.
    expect(teacherWords({ today, yesterday: null, earlier: [today] }, t).best).toBeNull();
    expect(teacherWords({ today, yesterday: null, earlier: [] }, t).best).toBeNull();
  });

  it('speaks Marathi and Hindi', () => {
    const today = score({ jobs: { done: 3, of: 3, next: null }, meals: { done: 2, of: 2 }, water: { ml: 3000, goal: 3000 }, walk: { min: 30, goal: 30 } });
    expect(teacherWords({ today, yesterday: null, earlier: [] }, makeT('mr')).lead).toBe('आज छान केलंत: 3 पैकी 3 कामं पूर्ण, सगळी जेवणं नोंदवली, पाण्याचं लक्ष्य पूर्ण, 30 मिनिटे चाललात.');
    expect(teacherWords({ today: score(), yesterday: null, earlier: [] }, makeT('hi')).lead).toBe('आज अभी कुछ नहीं हुआ, और यह ठीक है.');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/checklist.test.ts src/core/__tests__/pushSchedule.test.ts src/core/__tests__/teacher.test.ts`
Expected: FAIL, because `../teacher` does not exist yet and `dayChecklist` has no streak line: `Tests  4 failed | 48 passed (52)`, the first reads `Error: Cannot find module '../teacher'`

- [ ] **Step 3: Change `src/core/checklist.ts`**

The streak line comes first, only when the day is not complete (the list is not null).

In `src/core/checklist.ts` replace

```ts
   * every slot is listed.
   */
  times?: readonly string[];
  lang: Lang;
  t: (key: string) => string;
};
```

with

```ts
   * every slot is listed.
   */
  times?: readonly string[];
  /**
   * The streaks as they stand (with the shield): from `STREAK_NUDGE_DAYS` days, a day not complete yet starts with one
   * kind line that the streak needs today too. The phone and the relay pass them for today only.
   */
  streaks?: { meals: number; routine: number };
  lang: Lang;
  t: (key: string) => string;
};
```

In `src/core/checklist.ts` replace

```ts
  return out;
}

/**
 * The day so far, in the user's language: the title, and up to three lines
 * (meals, the Abhyas list, water and the walk), each part marked ✓ or ○, as
 * `✓ Breakfast · ✓ Lunch · ○ Dinner`. Null when every part is done or there
 * is nothing to list: nothing is sent then.
 */
export function dayChecklist(input: ChecklistInput): { title: string; body: string } | null {
  const lines = [mealMarks(input), abhyasMarks(input), waterWalkMarks(input)].filter((marks) => marks.length > 0);
  if (lines.every((marks) => marks.every((m) => m.done))) return null;
  return { title: input.t('rem_checklist_title'), body: lines.map(line).join('\n') };
}
```

with

```ts
  return out;
}

/** A streak this long or longer gets the kind line on a day not complete yet. */
export const STREAK_NUDGE_DAYS = 3;

/** The kind line for a streak: the routine's while jobs are left today, else the meal record's while a meal is; null otherwise. */
function streakLine(input: ChecklistInput, meals: Mark[], jobs: Mark[]): string | null {
  const s = input.streaks;
  if (!s) return null;
  const left = jobs.filter((m) => !m.done).length;
  if (s.routine >= STREAK_NUDGE_DAYS && left > 0) return left === 1 ? fill(input.t('rem_streak_job_one'), { n: s.routine }) : fill(input.t('rem_streak_jobs'), { n: s.routine, k: left });
  if (s.meals >= STREAK_NUDGE_DAYS && meals.some((m) => !m.done)) return fill(input.t('rem_streak_meals'), { n: s.meals });
  return null;
}

/**
 * The day so far, in the user's language: the title, and up to three lines
 * (meals, the routine list, water and the walk), each part marked ✓ or ○, as
 * `✓ Breakfast · ✓ Lunch · ○ Dinner`. With a streak of three days or more
 * and the day not complete yet, one kind line comes first ("Your 21-day
 * routine streak needs one more job today."). Null when every part is done
 * or there is nothing to list: nothing is sent then.
 */
export function dayChecklist(input: ChecklistInput): { title: string; body: string } | null {
  const meals = mealMarks(input);
  const jobs = abhyasMarks(input);
  const lines = [meals, jobs, waterWalkMarks(input)].filter((marks) => marks.length > 0);
  if (lines.every((marks) => marks.every((m) => m.done))) return null;
  const lead = streakLine(input, meals, jobs);
  return { title: input.t('rem_checklist_title'), body: [...(lead ? [lead] : []), ...lines.map(line)].join('\n') };
}
```

- [ ] **Step 4: Change `src/core/pushSchedule.ts`**

The meal streak comes in as a sixth argument; the routine streak is worked out here on finished timers. The schedule's fields are as before.

In `src/core/pushSchedule.ts` replace

```ts
import { cleanDays, cleanTimes, isDone, MAX_TIMES, minutesOn } from './abhyas';
import { breaksAsSwitched } from './breaks';
import { checklistTimes, dayChecklist } from './checklist';
import { addDays, isIsoDate } from './date';
```

with

```ts
import { cleanDays, cleanTimes, isDone, MAX_TIMES, minutesOn, streakRun } from './abhyas';
import { breaksAsSwitched } from './breaks';
import { checklistTimes, dayChecklist } from './checklist';
import { addDays, isIsoDate } from './date';
```

In `src/core/pushSchedule.ts` replace

```ts

/**
 * "Day so far" for today as it stands, at its times, while it is switched on: none on the day setup was finished
 * or on an off day, as on the phone, and none when everything is done. `menu` is today's, as Today shows it.
 */
function checklistPart(state: AppState, today: ISODate, t: (k: string) => string, menu: DayMenu | null): PushSchedule['checklist'] {
  const s = state.settings;
  if (!s.reminders.checklist || today === state.profile.onboardedOn || isOffDay(s.offDays, today)) return null;
  const text = dayChecklist({
```

with

```ts

/**
 * "Day so far" for today as it stands, at its times, while it is switched on: none on the day setup was finished
 * or on an off day, as on the phone, and none when everything is done. `menu` is today's, as Today shows it;
 * `mealStreak` the meal record's streak, for the kind line a streak of three days or more gets (the routine's is
 * worked out here, on finished timers, as the rest of the schedule is).
 */
function checklistPart(state: AppState, today: ISODate, t: (k: string) => string, menu: DayMenu | null, mealStreak: number): PushSchedule['checklist'] {
  const s = state.settings;
  if (!s.reminders.checklist || today === state.profile.onboardedOn || isOffDay(s.offDays, today)) return null;
  const text = dayChecklist({
```

In `src/core/pushSchedule.ts` replace

```ts
    waterWalk: s.todayCards.some((c) => c.id === 'waterWalk' && c.on),
    // As on the phone: a meal still open, or not open yet, at the last of the times is left out rather than shown as not done.
    times: checklistTimes(s.checklistTimes),
    lang: state.profile.lang,
    t,
  });
```

with

```ts
    waterWalk: s.todayCards.some((c) => c.id === 'waterWalk' && c.on),
    // As on the phone: a meal still open, or not open yet, at the last of the times is left out rather than shown as not done.
    times: checklistTimes(s.checklistTimes),
    streaks: { meals: mealStreak, routine: streakRun({ items: state.abhyasItems, ticks: state.abhyasTicks, sessions: state.abhyasSessions, running: null }, today, NO_TIMER_CLOCK, true).days },
    lang: state.profile.lang,
    t,
  });
```

In `src/core/pushSchedule.ts` replace

```ts
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The schedule for the relay as of `today`; `menu` is today's menu as Today shows it, for "Day so far" (null lists every meal). */
export function buildPushSchedule(state: AppState, today: ISODate, t: (k: string) => string, tz: string, menu: DayMenu | null = null): PushSchedule {
  const lang = state.profile.lang;
  const sched: WorkSchedule = state.schedule;
  const routine: Routine = state.routine;
```

with

```ts
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The schedule for the relay as of `today`; `menu` is today's menu as Today shows it, for "Day so far" (null lists every
 * meal), and `mealStreak` the meal record's streak (the store's `streakDays`), for its kind line. Its shape is unchanged.
 */
export function buildPushSchedule(state: AppState, today: ISODate, t: (k: string) => string, tz: string, menu: DayMenu | null = null, mealStreak = 0): PushSchedule {
  const lang = state.profile.lang;
  const sched: WorkSchedule = state.schedule;
  const routine: Routine = state.routine;
```

In `src/core/pushSchedule.ts` replace

```ts
    // The weigh day is a nudge, as water is: it goes out only while the nudges are switched on.
    weigh: state.settings.nudgesEnabled ? { weekday: state.settings.weighDay ?? 1, title: t('weigh_q'), body: t('weigh_hint') } : null,
    ...abhyasPart(state, today, t),
    checklist: checklistPart(state, today, t, menu),
  };
}
```

with

```ts
    // The weigh day is a nudge, as water is: it goes out only while the nudges are switched on.
    weigh: state.settings.nudgesEnabled ? { weekday: state.settings.weighDay ?? 1, title: t('weigh_q'), body: t('weigh_hint') } : null,
    ...abhyasPart(state, today, t),
    checklist: checklistPart(state, today, t, menu, mealStreak),
  };
}
```

- [ ] **Step 5: Create `src/core/teacher.ts`**

Create `src/core/teacher.ts`:

```ts
import { isDone, itemsOn, minutesOn, type AbhyasData } from './abhyas';
import { skippedOn } from './menu';
import { slotStates } from './pattern';
import type { Routine } from './routine';
import { walkMinutesOn, waterMlOn } from './tileText';
import type { ActivityLog, ISODate, Meal, SlotSkip, WaterLog } from './types';
import { fill } from '../i18n';

/**
 * The kind teacher: what the coach says in the evening, on Today after six
 * and in the day's review. It starts with what went well, then gives one
 * small tip for tomorrow. A day with nothing done yet is "not yet", never
 * missed or failed, with one easier thing for tomorrow; the first evening
 * after such a day opens with "Welcome back". When today did the most of the
 * week so far (meals logged, routine jobs done and the water goal), it says
 * so. Pure.
 */
export type DayScore = {
  /** Meals logged of the pattern's meals due so far (a skipped one is neither). */
  meals: { done: number; of: number };
  /** Routine jobs done of the jobs on the day, and the name of the first one not done yet. */
  jobs: { done: number; of: number; next: string | null };
  water: { ml: number; goal: number };
  walk: { min: number; goal: number };
};

/** A day as the teacher reads it, at `nowMinutes` of that day (1440 for a day gone by). `now` is for a running timer's minutes. */
export function dayScore(input: {
  date: ISODate;
  routine: Routine;
  meals: Meal[];
  skips: SlotSkip[];
  nowMinutes: number;
  abhyas: AbhyasData;
  now: Date;
  water: WaterLog[];
  activities: ActivityLog[];
  waterGoalMl: number;
  walkGoalMin: number;
}): DayScore {
  const meals = input.meals.filter((m) => m.date === input.date);
  const due = slotStates({ routine: input.routine, target: 0, meals, nowMinutes: input.nowMinutes, skippedSlots: skippedOn(input.skips, input.date) }).filter((s) => s.status !== 'later' && s.status !== 'skipped');
  const { items, ticks, sessions, running } = input.abhyas;
  const on = itemsOn(items, input.date);
  const left = on.filter((i) => !isDone(i, input.date, ticks, minutesOn(sessions, running, i.id, input.date, input.now)));
  return {
    meals: { done: due.filter((s) => s.status === 'done').length, of: due.length },
    jobs: { done: on.length - left.length, of: on.length, next: left[0]?.name ?? null },
    water: { ml: waterMlOn(input.water, input.date), goal: input.waterGoalMl },
    walk: { min: walkMinutesOn(input.activities, input.date), goal: input.walkGoalMin },
  };
}

const waterMet = (d: DayScore) => d.water.goal > 0 && d.water.ml >= d.water.goal;

/** What a day did, to compare days: meals logged, jobs done, and one for the water goal met. */
export function scoreOf(d: DayScore): number {
  return d.meals.done + d.jobs.done + (waterMet(d) ? 1 : 0);
}

/** A day with nothing done at all: no meal logged, no job done, no water and no walk. */
export function nothingDone(d: DayScore): boolean {
  return d.meals.done === 0 && d.jobs.done === 0 && d.water.ml === 0 && d.walk.min === 0;
}

/**
 * The evening words: `lead`, what went well ("Well done today: 3 of 3 jobs
 * done, water goal met."), with "Welcome back." before it on the first
 * evening after a day with nothing done; `best`, the best day of the week so
 * far, or null; and `tip`, one small thing for tomorrow. `yesterday` is null
 * for an off day or a day before the user started; `earlier` is this week's
 * days before today that count (Monday on, off days left out).
 */
export function teacherWords(input: { today: DayScore; yesterday: DayScore | null; earlier: DayScore[] }, t: (key: string) => string): { lead: string; best: string | null; tip: string } {
  const d = input.today;
  if (nothingDone(d)) return { lead: t('teach_not_yet'), best: null, tip: t('teach_tip_easy') };
  const parts = [
    d.jobs.done > 0 ? fill(t('teach_jobs'), { n: d.jobs.done, m: d.jobs.of }) : null,
    d.meals.done > 0 ? (d.meals.done === d.meals.of ? t('teach_meals_all') : d.meals.done === 1 ? t('teach_meal_one') : fill(t('teach_meals'), { n: d.meals.done })) : null,
    waterMet(d) ? t('teach_water') : null,
    d.walk.min > 0 ? fill(t('teach_walk'), { n: Math.round(d.walk.min) }) : null,
  ].filter((p): p is string => p !== null);
  const praise = parts.length > 0 ? fill(t('teach_lead'), { parts: parts.join(', ') }) : t('teach_lead_small');
  const lead = input.yesterday && nothingDone(input.yesterday) ? `${t('teach_welcome')} ${praise}` : praise;
  const score = scoreOf(d);
  const best = input.earlier.length > 0 && score > 0 && input.earlier.every((e) => scoreOf(e) < score) ? fill(t('teach_best'), { n: score, m: d.meals.of + d.jobs.of + (d.water.goal > 0 ? 1 : 0) }) : null;
  const tip =
    d.jobs.next !== null
      ? fill(t('teach_tip_job'), { name: d.jobs.next })
      : d.meals.done < d.meals.of
        ? t('teach_tip_meals')
        : d.water.goal > 0 && !waterMet(d)
          ? t('teach_tip_water')
          : d.walk.goal > 0 && d.walk.min < d.walk.goal
            ? t('teach_tip_walk')
            : t('teach_tip_same');
  return { lead, best, tip };
}
```

- [ ] **Step 6: Add the words to `src/i18n/index.ts`**

Add 21 keys at the end of each of the three dicts. First check that none is there yet:

Run: `grep -nE "^  (teach_title|teach_lead|teach_lead_small|teach_jobs|teach_meals_all|teach_meals|teach_meal_one|teach_water|teach_walk|teach_welcome|teach_not_yet|teach_best|teach_tip_job|teach_tip_meals|teach_tip_water|teach_tip_walk|teach_tip_same|teach_tip_easy|rem_streak_job_one|rem_streak_jobs|rem_streak_meals):" src/i18n/index.ts`
Expected: no output.

In `src/i18n/index.ts` replace

```ts
  medal_sub_challenges: 'Small steps, done again and again.',
  shelf_title: 'Trophy shelf',
  shelf_count: '{n} earned',
};

const mr: Dict = {
```

with

```ts
  medal_sub_challenges: 'Small steps, done again and again.',
  shelf_title: 'Trophy shelf',
  shelf_count: '{n} earned',
  teach_title: 'Your coach · this evening',
  teach_lead: 'Well done today: {parts}.',
  teach_lead_small: 'Well done today: you made a start.',
  teach_jobs: '{n} of {m} jobs done',
  teach_meals_all: 'every meal logged',
  teach_meals: '{n} meals logged',
  teach_meal_one: '1 meal logged',
  teach_water: 'water goal met',
  teach_walk: '{n} min walked',
  teach_welcome: 'Welcome back.',
  teach_not_yet: "Not yet today, and that's okay.",
  teach_best: 'Today was your best day this week: {n} of {m} done.',
  teach_tip_job: 'Tomorrow, start {name} a little earlier.',
  teach_tip_meals: 'Tomorrow, log each meal as you eat it.',
  teach_tip_water: 'Tomorrow, one bottle of water before lunch.',
  teach_tip_walk: 'Tomorrow, a ten-minute walk after a meal.',
  teach_tip_same: 'Tomorrow, the same again. You know how.',
  teach_tip_easy: 'Tomorrow, just one small thing: a bottle of water when you wake up.',
  rem_streak_job_one: 'Your {n}-day routine streak needs one more job today.',
  rem_streak_jobs: 'Your {n}-day routine streak needs {k} more jobs today.',
  rem_streak_meals: "Your {n}-day streak needs today's meals too.",
};

const mr: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  medal_sub_challenges: 'छोटी पावलं, पुन्हा पुन्हा.',
  shelf_title: 'पदकांचं कपाट',
  shelf_count: '{n} मिळाली',
};

const hi: Dict = {
```

with

```ts
  medal_sub_challenges: 'छोटी पावलं, पुन्हा पुन्हा.',
  shelf_title: 'पदकांचं कपाट',
  shelf_count: '{n} मिळाली',
  teach_title: 'तुमचा कोच · आज संध्याकाळी',
  teach_lead: 'आज छान केलंत: {parts}.',
  teach_lead_small: 'आज छान केलंत: सुरुवात झाली.',
  teach_jobs: '{m} पैकी {n} कामं पूर्ण',
  teach_meals_all: 'सगळी जेवणं नोंदवली',
  teach_meals: '{n} जेवणं नोंदवली',
  teach_meal_one: '1 जेवण नोंदवलं',
  teach_water: 'पाण्याचं लक्ष्य पूर्ण',
  teach_walk: '{n} मिनिटे चाललात',
  teach_welcome: 'पुन्हा स्वागत आहे.',
  teach_not_yet: 'आज अजून काही झालं नाही, आणि ते ठीक आहे.',
  teach_best: 'आज या आठवड्यातला तुमचा सर्वोत्तम दिवस: {m} पैकी {n} पूर्ण.',
  teach_tip_job: 'उद्या {name} थोडं लवकर सुरू करा.',
  teach_tip_meals: 'उद्या प्रत्येक जेवण खाल्ल्यावर लगेच नोंदवा.',
  teach_tip_water: 'उद्या दुपारच्या जेवणाआधी एक बाटली पाणी.',
  teach_tip_walk: 'उद्या जेवणानंतर दहा मिनिटे चाला.',
  teach_tip_same: 'उद्याही असंच. तुम्हाला जमतंय.',
  teach_tip_easy: 'उद्या फक्त एक छोटी गोष्ट: उठल्यावर एक बाटली पाणी.',
  rem_streak_job_one: 'तुमच्या {n} दिवसांच्या दिनक्रम मालिकेला आज अजून एक काम हवं.',
  rem_streak_jobs: 'तुमच्या {n} दिवसांच्या दिनक्रम मालिकेला आज अजून {k} कामं हवीत.',
  rem_streak_meals: 'तुमच्या {n} दिवसांच्या मालिकेला आजची जेवणंही हवीत.',
};

const hi: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  medal_sub_challenges: 'छोटे कदम, बार-बार.',
  shelf_title: 'पदकों की अलमारी',
  shelf_count: '{n} मिले',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

with

```ts
  medal_sub_challenges: 'छोटे कदम, बार-बार.',
  shelf_title: 'पदकों की अलमारी',
  shelf_count: '{n} मिले',
  teach_title: 'आपका कोच · आज शाम',
  teach_lead: 'आज बढ़िया किया: {parts}.',
  teach_lead_small: 'आज बढ़िया किया: शुरुआत हो गई.',
  teach_jobs: '{m} में से {n} काम पूरे',
  teach_meals_all: 'सारे खाने दर्ज',
  teach_meals: '{n} खाने दर्ज',
  teach_meal_one: '1 खाना दर्ज',
  teach_water: 'पानी का लक्ष्य पूरा',
  teach_walk: '{n} मिनट टहले',
  teach_welcome: 'फिर से स्वागत है.',
  teach_not_yet: 'आज अभी कुछ नहीं हुआ, और यह ठीक है.',
  teach_best: 'आज इस हफ़्ते का आपका सबसे अच्छा दिन रहा: {m} में से {n} पूरे.',
  teach_tip_job: 'कल {name} थोड़ा पहले शुरू करें.',
  teach_tip_meals: 'कल हर खाना खाते ही दर्ज करें.',
  teach_tip_water: 'कल दोपहर के खाने से पहले एक बोतल पानी.',
  teach_tip_walk: 'कल खाने के बाद दस मिनट टहलें.',
  teach_tip_same: 'कल भी ऐसे ही. आपसे हो रहा है.',
  teach_tip_easy: 'कल बस एक छोटी चीज़: उठते ही एक बोतल पानी.',
  rem_streak_job_one: 'आपके {n} दिन के दिनचर्या सिलसिले को आज एक और काम चाहिए.',
  rem_streak_jobs: 'आपके {n} दिन के दिनचर्या सिलसिले को आज {k} और काम चाहिए.',
  rem_streak_meals: 'आपके {n} दिन के सिलसिले को आज के खाने भी चाहिए.',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

- [ ] **Step 7: Change `src/services/usePushSync.ts`**

The relay's text gets the store's meal streak.

In `src/services/usePushSync.ts` replace

```ts

  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata';
  // Compared by value below: a render that builds the same schedule sends nothing.
  const payload = configured && relayOn && active ? JSON.stringify(buildPushSchedule(state, today, makeT(state.profile.lang), tz, menuOn(today))) : '';

  useEffect(() => {
    const step = pushStep({ configured, relayOn, known, active, payload, lastSent: lastSent.current });
```

with

```ts

  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata';
  // Compared by value below: a render that builds the same schedule sends nothing.
  const payload = configured && relayOn && active ? JSON.stringify(buildPushSchedule(state, today, makeT(state.profile.lang), tz, menuOn(today), app.streakDays)) : '';

  useEffect(() => {
    const step = pushStep({ configured, relayOn, known, active, payload, lastSent: lastSent.current });
```

- [ ] **Step 8: Change `src/services/useScheduledReminders.ts`**

On the phone, today's text gets the streaks; the days after it do not (the streak by then is not known).

In `src/services/useScheduledReminders.ts` replace

```ts
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { breaksAsSwitched, type BreakSettings } from '../core/breaks';
import { checklistTimes, dayChecklist } from '../core/checklist';
import { addDays } from '../core/date';
```

with

```ts
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { streakRun } from '../core/abhyas';
import { breaksAsSwitched, type BreakSettings } from '../core/breaks';
import { checklistTimes, dayChecklist } from '../core/checklist';
import { addDays } from '../core/date';
```

In `src/services/useScheduledReminders.ts` replace

```ts
  // "Day so far" for each day it can come, as the day stands now, as one string: a meal, a skip, a bottle, a walk, a tick
  // or a stopped timer changes its words, and so the pending one is replaced. The running timer is left out, as above, so
  // the words do not change every minute it runs. Water and the walk are listed while their card is on Today; a meal not
  // late yet at the last of its times is left out. The times by value, as the rest.
  const waterWalk = todayCards.some((c) => c.id === 'waterWalk' && c.on);
  const timesKey = checklistTimes(storedTimes).join(',');
  const checklistJson = useMemo(() => {
    if (Platform.OS === 'web' || !reminders.checklist) return '';
    const t = makeT(lang);
    const data = { items: abhyasItems, ticks: abhyasTicks, sessions: abhyasSessions, running: null };
    const texts: Record<ISODate, { title: string; body: string } | null> = {};
    for (let k = 0; k < OWN_DAYS; k++) {
      const date = addDays(today, k);
```

with

```ts
  // "Day so far" for each day it can come, as the day stands now, as one string: a meal, a skip, a bottle, a walk, a tick
  // or a stopped timer changes its words, and so the pending one is replaced. The running timer is left out, as above, so
  // the words do not change every minute it runs. Water and the walk are listed while their card is on Today; a meal not
  // late yet at the last of its times is left out. The times by value, as the rest. Today's opens with the kind line a
  // streak of three days or more gets while the day is not complete (the streaks with the shield, on finished timers).
  const waterWalk = todayCards.some((c) => c.id === 'waterWalk' && c.on);
  const timesKey = checklistTimes(storedTimes).join(',');
  const mealStreak = app.streakDays;
  const checklistJson = useMemo(() => {
    if (Platform.OS === 'web' || !reminders.checklist) return '';
    const t = makeT(lang);
    const data = { items: abhyasItems, ticks: abhyasTicks, sessions: abhyasSessions, running: null };
    const streaks = { meals: mealStreak, routine: streakRun(data, today, new Date(0), true).days };
    const texts: Record<ISODate, { title: string; body: string } | null> = {};
    for (let k = 0; k < OWN_DAYS; k++) {
      const date = addDays(today, k);
```

In `src/services/useScheduledReminders.ts` replace

```ts
        walkGoalMin,
        waterWalk,
        times: timesKey.split(','),
        lang,
        t,
      });
    }
    return JSON.stringify(texts);
  }, [reminders.checklist, lang, abhyasItems, abhyasTicks, abhyasSessions, today, routine, menuOn, meals, slotSkips, waterLogs, activities, waterGoalMl, bottleMl, walkGoalMin, waterWalk, timesKey]);

  const anyOn = reminders.mealPrompt || reminders.away || reminders.fillYesterday || reminders.planWeek || reminders.weeklyReport || reminders.abhyas || reminders.checklist;
  const wanted = useMemo(() => {
```

with

```ts
        walkGoalMin,
        waterWalk,
        times: timesKey.split(','),
        ...(date === today ? { streaks } : {}),
        lang,
        t,
      });
    }
    return JSON.stringify(texts);
  }, [reminders.checklist, lang, abhyasItems, abhyasTicks, abhyasSessions, today, routine, menuOn, meals, slotSkips, waterLogs, activities, waterGoalMl, bottleMl, walkGoalMin, waterWalk, timesKey, mealStreak]);

  const anyOn = reminders.mealPrompt || reminders.away || reminders.fillYesterday || reminders.planWeek || reminders.weeklyReport || reminders.abhyas || reminders.checklist;
  const wanted = useMemo(() => {
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run src/core/__tests__/checklist.test.ts src/core/__tests__/pushSchedule.test.ts src/core/__tests__/teacher.test.ts`
Expected: PASS, 60 tests.

- [ ] **Step 10: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1833 tests passing; relay 73 tests passing.

- [ ] **Step 11: Commit**

```bash
git add src/core/__tests__/checklist.test.ts src/core/__tests__/pushSchedule.test.ts src/core/__tests__/teacher.test.ts src/core/checklist.ts src/core/pushSchedule.ts src/core/teacher.ts src/i18n/index.ts src/services/usePushSync.ts src/services/useScheduledReminders.ts
git commit -m "$(cat <<'EOF'
The evening coach is a kind teacher, what went well first and one small tip for tomorrow, "not yet" for a day not done, and "Day so far" opens with a kind line when a streak of three days or more still needs today; the relay's schedule keeps its shape

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The palette in the store, and the store's streaks with the shield

`settings.palette` is stored, synced like the other settings (merged field by field, not a device setting) and read through `paletteOf` on every load and sync landing, so a value from a damaged file or a newer build is emerald. A missing palette takes the default, so no version step is needed and `STATE_VERSION` stays 8. The store works its streaks out with the shield and gives the screens the days it covered; `markCelebrated` keeps a day's challenge id for a fortnight.

**Files:**
- Modify: `src/core/__tests__/migrate.test.ts`
- Modify: `src/core/__tests__/sync.test.ts`
- Modify: `src/core/types.ts`
- Modify: `src/store/AppProvider.tsx`
- Modify: `src/store/defaults.ts`
- Modify: `src/store/migrate.ts`

**Interfaces:**
- Consumes: `paletteOf`, `DEFAULT_PALETTE`; `chapterStreaks(… shield)`; `withCelebrated`.
- Produces: `Settings.palette: PaletteId` (default `'emerald'`); the store's `streakCovered: ISODate[]`; `streakDays`, `bestStreakDays`, `lifetimeStreakDays` and `lifetimeBestStreakDays` now with the shield.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/migrate.test.ts` replace

```ts
    expect(migrateState({ ...v1, version: 7, profile: { ...v1.profile, chapterStart: '2026-02-30', firstStartWeightKg: -4 } }, NOW).profile).not.toHaveProperty('chapterStart');
  });
});
```

with

```ts
    expect(migrateState({ ...v1, version: 7, profile: { ...v1.profile, chapterStart: '2026-02-30', firstStartWeightKg: -4 } }, NOW).profile).not.toHaveProperty('chapterStart');
  });
});

describe('the palette', () => {
  it('a store from before the palettes starts on emerald and gold, and a choice made is kept', () => {
    expect(migrateState(v1, NOW).settings.palette).toBe('emerald');
    const s = migrateState({ ...v1, version: 8, settings: { ...v1.settings, palette: 'saffron' } }, NOW);
    expect(s.settings.palette).toBe('saffron');
    expect(migrateState(s, NOW)).toEqual(s);
  });

  it('a palette this build does not know, from sync or a damaged file, reads as emerald and gold', () => {
    for (const palette of ['rose', 7, null]) expect(migrateState({ ...v1, version: 8, settings: { ...v1.settings, palette } }, NOW).settings.palette, String(palette)).toBe('emerald');
  });
});
```

In `src/core/__tests__/sync.test.ts` replace

```ts
    for (const out of [merge3(b, phone, pc).profile, merge3(b, pc, phone).profile]) {
      expect([out.weightKg, out.goalWeightKg, out.name]).toEqual([89.4, 72, 'Varad']);
    }
  });

  it('two devices switching different reminders, or different parts of the app, both keep their switch, wherever the merge runs', () => {
```

with

```ts
    for (const out of [merge3(b, phone, pc).profile, merge3(b, pc, phone).profile]) {
      expect([out.weightKg, out.goalWeightKg, out.name]).toEqual([89.4, 72, 'Varad']);
    }
  });

  it('the palette is the person’s, not the machine’s: chosen on the phone, it reaches the PC, and a later choice on the PC wins there', () => {
    const b = cloudOf(used([]));
    const phone = cloudOf(used([], { settings: { ...EMPTY_STATE.settings, palette: 'indigo' } }));
    expect(cloudOf(used([], { settings: { ...EMPTY_STATE.settings, palette: 'indigo' } })).settings.palette).toBe('indigo');
    expect(merge3(b, cloudOf(used([])), phone).settings.palette).toBe('indigo');
    const pc = cloudOf(used([], { settings: { ...EMPTY_STATE.settings, palette: 'saffron' } }));
    expect(merge3(phone, pc, phone).settings.palette).toBe('saffron');
  });

  it('two devices switching different reminders, or different parts of the app, both keep their switch, wherever the merge runs', () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/migrate.test.ts src/core/__tests__/sync.test.ts`
Expected: FAIL, because the settings have no palette yet: `Tests  2 failed | 178 passed (180)`, the first reads `AssertionError: expected undefined to be 'emerald' // Object.is equality`

- [ ] **Step 3: Change `src/core/types.ts`**

In `src/core/types.ts` replace

```ts
import type { BreakLog, BreakSettings } from './breaks';
import type { MemoryItem } from './memory';
import type { QueuedPhoto } from './queue';
import type { PlanLine, Routine, SpendLog } from './routine';
import type { WorkSchedule } from './schedule';
```

with

```ts
import type { BreakLog, BreakSettings } from './breaks';
import type { MemoryItem } from './memory';
import type { PaletteId } from './palette';
import type { QueuedPhoto } from './queue';
import type { PlanLine, Routine, SpendLog } from './routine';
import type { WorkSchedule } from './schedule';
```

In `src/core/types.ts` replace

```ts
  diet: Diet;
  /** Follow the phone, or force light or dark. */
  appearance: 'system' | 'light' | 'dark';
  /** Multiplier on every type size; 1 is the design size. */
  textScale: number;
  /** Web only: reminders through the relay while the app is closed. */
```

with

```ts
  diet: Diet;
  /** Follow the phone, or force light or dark. */
  appearance: 'system' | 'light' | 'dark';
  /** The colours, one of the three palettes (core/palette.ts); the same on every device, as the person chose it. */
  palette: PaletteId;
  /** Multiplier on every type size; 1 is the design size. */
  textScale: number;
  /** Web only: reminders through the relay while the app is closed. */
```

- [ ] **Step 4: Change `src/store/AppProvider.tsx`**

The streaks with the shield, their covered days for the notes, and `markCelebrated` through `withCelebrated`.

In `src/store/AppProvider.tsx` replace

```tsx
import { dequeue, enqueue, markFailed, type QueuedPhoto } from '../core/queue';
import { slotStates } from '../core/pattern';
import { chapterStreaks } from '../core/chapter';
import {
  addMenuLine,
  alignMenus,
```

with

```tsx
import { dequeue, enqueue, markFailed, type QueuedPhoto } from '../core/queue';
import { slotStates } from '../core/pattern';
import { chapterStreaks } from '../core/chapter';
import { withCelebrated } from '../core/medals';
import {
  addMenuLine,
  alignMenus,
```

In `src/store/AppProvider.tsx` replace

```tsx
  bestStreakDays: number;
  /** The streak over the whole journey, a new chapter or not (still within the streak's own window): only the points and the streak badges count it. */
  lifetimeStreakDays: number;
  /** The best run over the whole journey, by the same rule: only the streak badges count it. */
  lifetimeBestStreakDays: number;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  addMeal: (m: Meal) => void;
```

with

```tsx
  bestStreakDays: number;
  /** The streak over the whole journey, a new chapter or not (still within the streak's own window): only the points and the streak badges count it. */
  lifetimeStreakDays: number;
  /** The best run over the whole journey, by the same rule: only the streak medals count it. */
  lifetimeBestStreakDays: number;
  /** The days the streak shield covered in the streak's window, for its note (`shieldNote`). Every streak here is worked out with the shield. */
  streakCovered: ISODate[];
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  addMeal: (m: Meal) => void;
```

In `src/store/AppProvider.tsx` replace

```tsx
        floor: fit.floor,
        menuOn,
        chapterStart: state.profile.chapterStart,
      }),
    [today, state.routine, state.meals, state.slotSkips, state.settings.offDays, fit.floor, menuOn, state.profile.chapterStart],
  );
  const { days: streakDays, best: bestStreakDays, lifetimeDays: lifetimeStreakDays, lifetimeBest: lifetimeBestStreakDays } = streaks;

  // Planned meals fill themselves 90 minutes after their slot, today is noted as a day the app was open, and an Abhyas timer
  // left running stops where it stops by itself (three hours, or midnight after its day): checked once the store is loaded,
```

with

```tsx
        floor: fit.floor,
        menuOn,
        chapterStart: state.profile.chapterStart,
        shield: true,
      }),
    [today, state.routine, state.meals, state.slotSkips, state.settings.offDays, fit.floor, menuOn, state.profile.chapterStart],
  );
  const { days: streakDays, best: bestStreakDays, lifetimeDays: lifetimeStreakDays, lifetimeBest: lifetimeBestStreakDays } = streaks;
  const streakCovered = useMemo(() => streaks.covered ?? [], [streaks]);

  // Planned meals fill themselves 90 minutes after their slot, today is noted as a day the app was open, and an Abhyas timer
  // left running stops where it stops by itself (three hours, or midnight after its day): checked once the store is loaded,
```

In `src/store/AppProvider.tsx` replace

```tsx
      bestStreakDays,
      lifetimeStreakDays,
      lifetimeBestStreakDays,
      tipToday: tipRecord?.text ?? null,
      screenMinutesToday,
      stepsToday: state.steps.find((x) => x.date === today)?.count ?? 0,
```

with

```tsx
      bestStreakDays,
      lifetimeStreakDays,
      lifetimeBestStreakDays,
      streakCovered,
      tipToday: tipRecord?.text ?? null,
      screenMinutesToday,
      stepsToday: state.steps.find((x) => x.date === today)?.count ?? 0,
```

In `src/store/AppProvider.tsx` replace

```tsx
      removeActivity: (id) => update((s) => ({ ...s, activities: (s.activities ?? []).filter((x) => x.id !== id) })),
      burnedToday,
      toggleGrocery: (week, foodId) => update((s) => ({ ...s, groceryTicks: toggleTick(s.groceryTicks, week, foodId, groceryThisWeek(today)) })),
      markCelebrated: (ids) => update((s) => ({ ...s, celebrated: Array.from(new Set([...(s.celebrated ?? []), ...ids])) })),
      abhyas,
      addAbhyasItem: (draft) => {
        // Refused at the tap, so the sheet knows nothing was saved.
```

with

```tsx
      removeActivity: (id) => update((s) => ({ ...s, activities: (s.activities ?? []).filter((x) => x.id !== id) })),
      burnedToday,
      toggleGrocery: (week, foodId) => update((s) => ({ ...s, groceryTicks: toggleTick(s.groceryTicks, week, foodId, groceryThisWeek(today)) })),
      // A day's challenge is kept among the celebrated ids for a fortnight, so the list never grows by one a day for good.
      markCelebrated: (ids) => update((s) => ({ ...s, celebrated: withCelebrated(s.celebrated, ids, today) })),
      abhyas,
      addAbhyasItem: (draft) => {
        // Refused at the tap, so the sheet knows nothing was saved.
```

In `src/store/AppProvider.tsx` replace

```tsx
      storageError,
      exportJSON: () => JSON.stringify(state, null, 2),
    };
  }, [state, ready, today, hour, update, storageError, saveCloudBase, readNow, switchAccount, planFoods, fit, menuOn, streakDays, bestStreakDays, lifetimeStreakDays, lifetimeBestStreakDays, patternMealsLeft, weekPlan, abhyas]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
```

with

```tsx
      storageError,
      exportJSON: () => JSON.stringify(state, null, 2),
    };
  }, [state, ready, today, hour, update, storageError, saveCloudBase, readNow, switchAccount, planFoods, fit, menuOn, streakDays, bestStreakDays, lifetimeStreakDays, lifetimeBestStreakDays, streakCovered, patternMealsLeft, weekPlan, abhyas]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
```

- [ ] **Step 5: Change `src/store/defaults.ts`**

In `src/store/defaults.ts` replace

```ts
import foodsJson from '../data/foods.json';
import { DEFAULT_BREAK_SETTINGS } from '../core/breaks';
import { DEFAULT_CHECKLIST_TIMES } from '../core/checklist';
import { NEUTRAL_ROUTINE } from '../core/routine';
import { DEFAULT_SCHEDULE } from '../core/schedule';
import { DEFAULT_TABS, DEFAULT_TODAY_CARDS } from '../core/tabs';
```

with

```ts
import foodsJson from '../data/foods.json';
import { DEFAULT_BREAK_SETTINGS } from '../core/breaks';
import { DEFAULT_CHECKLIST_TIMES } from '../core/checklist';
import { DEFAULT_PALETTE } from '../core/palette';
import { NEUTRAL_ROUTINE } from '../core/routine';
import { DEFAULT_SCHEDULE } from '../core/schedule';
import { DEFAULT_TABS, DEFAULT_TODAY_CARDS } from '../core/tabs';
```

In `src/store/defaults.ts` replace

```ts
  // Most of the people this is built for are vegetarian; the setting is one tap away.
  diet: 'veg',
  appearance: 'system',
  textScale: 1,
  pushRelay: false,
  weighDay: 0,
```

with

```ts
  // Most of the people this is built for are vegetarian; the setting is one tap away.
  diet: 'veg',
  appearance: 'system',
  palette: DEFAULT_PALETTE,
  textScale: 1,
  pushRelay: false,
  weighDay: 0,
```

- [ ] **Step 6: Change `src/store/migrate.ts`**

The palette is read through `paletteOf` on every load and sync landing.

In `src/store/migrate.ts` replace

```ts
import { addDays, isIsoDate, mondayOf, toISODate } from '../core/date';
import { foodsForDiet } from '../core/foods';
import { addSkip, menusFromTemplate, NOT_EDITED, settleAuto, type DayMenu } from '../core/menu';
import { slotShare } from '../core/pattern';
import { canPlace, DEFAULT_ROUTINE, DEFAULT_SLOTS, DINNER_SLOT, NEUTRAL_ROUTINE, SKIP_PREFIX, type RoutineSlot } from '../core/routine';
import { forCloud, stable, type CloudState } from '../core/sync';
```

with

```ts
import { addDays, isIsoDate, mondayOf, toISODate } from '../core/date';
import { foodsForDiet } from '../core/foods';
import { addSkip, menusFromTemplate, NOT_EDITED, settleAuto, type DayMenu } from '../core/menu';
import { paletteOf } from '../core/palette';
import { slotShare } from '../core/pattern';
import { canPlace, DEFAULT_ROUTINE, DEFAULT_SLOTS, DINNER_SLOT, NEUTRAL_ROUTINE, SKIP_PREFIX, type RoutineSlot } from '../core/routine';
import { forCloud, stable, type CloudState } from '../core/sync';
```

In `src/store/migrate.ts` replace

```ts
  // "Day so far" comes at clock times only, each once, in the day's order, at most three; a list with none left, or none
  // stored, is the default 21:30 (core/checklist.ts).
  s.checklistTimes = checklistTimes(raw.checklistTimes);
  return s;
}
```

with

```ts
  // "Day so far" comes at clock times only, each once, in the day's order, at most three; a list with none left, or none
  // stored, is the default 21:30 (core/checklist.ts).
  s.checklistTimes = checklistTimes(raw.checklistTimes);
  // One of the three palettes; none stored yet (a store from before them), or one this build does not know, is emerald.
  s.palette = paletteOf(raw.palette);
  return s;
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/core/__tests__/migrate.test.ts src/core/__tests__/sync.test.ts`
Expected: PASS, 180 tests.

- [ ] **Step 8: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1836 tests passing; relay 73 tests passing.

- [ ] **Step 9: Commit**

```bash
git add src/core/__tests__/migrate.test.ts src/core/__tests__/sync.test.ts src/core/types.ts src/store/AppProvider.tsx src/store/defaults.ts src/store/migrate.ts
git commit -m "$(cat <<'EOF'
The palette is kept with the settings, emerald unless chosen, and reaches the user's other devices; the store works its streaks out with the shield and keeps a day's challenge among the celebrated ids for a fortnight

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: The new look: palettes applied and chosen, the tint band, the tab bar

The palette is applied with the light or dark mode before the tree renders, and the tree remounts on a change, as the mode already does. Every tab draws its tint band behind its header and the top of its page (`TintBand`), the scrolling page lets it show through; screen titles and the two big numbers take `TITLE_WEIGHT`; the streak pill is a reward, so it is gold. The tab bar takes its sizes from `barGeometry.ts`: its active pill is `accentSoft` (the mockup's), and the plus is lifted half its height with a soft shadow instead of a teal glow. Settings → Appearance gains a row of three swatches. The logo tile already reads `C.accent`, so it follows the palette with no change.

**Files:**
- Modify: `src/app/(tabs)/body.tsx`
- Modify: `src/app/(tabs)/sleep-tab.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/settings.tsx`
- Modify: `src/components/CaloriesLeft.tsx`
- Create: `src/components/PaletteSwatches.tsx`
- Modify: `src/components/StreakPill.tsx`
- Modify: `src/components/TabBar.tsx`
- Modify: `src/components/WeightTrendCard.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/ui/TopBar.tsx`
- Modify: `src/ui/components.tsx`

**Interfaces:**
- Consumes: `paletteOf`, `applyTheme(mode, palette)`, `paletteNow`, `TITLE_WEIGHT`, `barHeight`, `tabLabelSize`, `TAB_*`, `PLUS_*`, `PALETTE_SETS`.
- Produces: `Screen`'s `onBand?: boolean`; `TintBand` and `TINT_BAND = 168` in `src/ui/TopBar.tsx`; `PaletteSwatches` in `src/components/PaletteSwatches.tsx`.
- Words: `palette_title`, `palette_emerald`, `palette_indigo`, `palette_saffron`.

- [ ] **Step 1: Change `src/app/(tabs)/body.tsx`**

In `src/app/(tabs)/body.tsx` replace

```tsx
import { SectionTabs } from '../../ui/SectionTabs';
import { useSectionParam } from '../../ui/useSectionParam';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';

type Section = 'move' | 'yoga' | 'sleep' | 'mind';
const SECTIONS: Section[] = ['move', 'yoga', 'sleep', 'mind'];
```

with

```tsx
import { SectionTabs } from '../../ui/SectionTabs';
import { useSectionParam } from '../../ui/useSectionParam';
import { C } from '../../ui/theme';
import { TintBand, TopBar } from '../../ui/TopBar';

type Section = 'move' | 'yoga' | 'sleep' | 'mind';
const SECTIONS: Section[] = ['move', 'yoga', 'sleep', 'mind'];
```

In `src/app/(tabs)/body.tsx` replace

```tsx
  const [section, setSection] = useSectionParam(SECTIONS);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t('tab_body')} alt={lang === 'en' ? undefined : t('tab_body')} right={<TopBarActions />} />
      <SectionTabs options={[{ key: 'move', label: t('fit_title') }, { key: 'yoga', label: t('yoga_tab') }, { key: 'sleep', label: t('sleep_title') }, { key: 'mind', label: t('mind_title') }]} value={section} onChange={setSection} />
      {section === 'move' ? <FitScreen embedded /> : null}
```

with

```tsx
  const [section, setSection] = useSectionParam(SECTIONS);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TintBand />
      <TopBar title={t('tab_body')} alt={lang === 'en' ? undefined : t('tab_body')} right={<TopBarActions />} />
      <SectionTabs options={[{ key: 'move', label: t('fit_title') }, { key: 'yoga', label: t('yoga_tab') }, { key: 'sleep', label: t('sleep_title') }, { key: 'mind', label: t('mind_title') }]} value={section} onChange={setSection} />
      {section === 'move' ? <FitScreen embedded /> : null}
```

- [ ] **Step 2: Change `src/app/(tabs)/sleep-tab.tsx`**

Replace the whole `src/app/(tabs)/sleep-tab.tsx` with:

```tsx
import React from 'react';
import { View } from 'react-native';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { TintBand, TopBar } from '../../ui/TopBar';
import SleepScreen from '../sleep';

/** Sleep as a tab, for a person who put it on the bar. /sleep stays the page links and the sleep tile open. */
export default function SleepTab() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TintBand />
      <TopBar title={t('sleep_title')} />
      <SleepScreen embedded />
    </View>
  );
}
```

- [ ] **Step 3: Change `src/app/_layout.tsx`**

The palette is applied with the mode, before paint, and the tree remounts when either changes.

In `src/app/_layout.tsx` replace

```tsx
import { BreakOverlay } from '../components/BreakOverlay';
import { BreakToast } from '../components/BreakToast';
import { HeaderBack } from '../components/HeaderBack';
import { pageTitle } from '../core/screenTitle';
import { makeT } from '../i18n';
import { FeedbackProvider } from '../services/feedback';
```

with

```tsx
import { BreakOverlay } from '../components/BreakOverlay';
import { BreakToast } from '../components/BreakToast';
import { HeaderBack } from '../components/HeaderBack';
import { paletteOf } from '../core/palette';
import { pageTitle } from '../core/screenTitle';
import { makeT } from '../i18n';
import { FeedbackProvider } from '../services/feedback';
```

In `src/app/_layout.tsx` replace

```tsx
import { usePushSync } from '../services/usePushSync';
import { useWorkSchedule } from '../services/useWorkSchedule';
import { AppProvider, useApp } from '../store/AppProvider';
import { applyTextScale, applyTheme, C, themeMode, type ThemeMode } from '../ui/theme';

/**
 * The tabs sit under every other page: a link or a reload that opens a page of
```

with

```tsx
import { usePushSync } from '../services/usePushSync';
import { useWorkSchedule } from '../services/useWorkSchedule';
import { AppProvider, useApp } from '../store/AppProvider';
import { applyTextScale, applyTheme, C, paletteNow, themeMode, type ThemeMode } from '../ui/theme';

/**
 * The tabs sit under every other page: a link or a reload that opens a page of
```

In `src/app/_layout.tsx` replace

```tsx
  );
}

/** Picks dark or light from the setting and the phone, applies it before the tree renders, and remounts on change. */
function Themed({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const system = useColorScheme();
  const mode: ThemeMode = state.settings.appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : state.settings.appearance;
  // Swap the palette before paint, then remount the tree so every component reads the new colours.
  const scale = state.settings.textScale || 1;
  const lang = state.profile.lang;
  const [applied, setApplied] = useState<string>(`${themeMode()}-1`);
  useLayoutEffect(() => {
    applyTheme(mode);
    applyTextScale(scale);
    // Deliberate: the remount must follow the palette swap, and nothing else re-renders this subtree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplied(`${mode}-${scale}`);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.background = C.bg;
      document.documentElement.style.colorScheme = mode;
```

with

```tsx
  );
}

/** Picks dark or light from the setting and the phone, and the palette the user chose, applies them before the tree renders, and remounts on change. */
function Themed({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const system = useColorScheme();
  const mode: ThemeMode = state.settings.appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : state.settings.appearance;
  const palette = paletteOf(state.settings.palette);
  // Swap the palette before paint, then remount the tree so every component reads the new colours.
  const scale = state.settings.textScale || 1;
  const lang = state.profile.lang;
  const [applied, setApplied] = useState<string>(`${themeMode()}-${paletteNow()}-1`);
  useLayoutEffect(() => {
    applyTheme(mode, palette);
    applyTextScale(scale);
    // Deliberate: the remount must follow the palette swap, and nothing else re-renders this subtree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplied(`${mode}-${palette}-${scale}`);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.background = C.bg;
      document.documentElement.style.colorScheme = mode;
```

In `src/app/_layout.tsx` replace

```tsx
      // The root view behind the app, seen in screen transitions and behind the keyboard, takes the same colour.
      SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});
    }
  }, [mode, scale]);
  // The page's language follows the profile, so screen readers and the browser read Marathi and Hindi as such.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = lang;
```

with

```tsx
      // The root view behind the app, seen in screen transitions and behind the keyboard, takes the same colour.
      SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});
    }
  }, [mode, palette, scale]);
  // The page's language follows the profile, so screen readers and the browser read Marathi and Hindi as such.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = lang;
```

- [ ] **Step 4: Change `src/app/settings.tsx`**

In `src/app/settings.tsx` replace

```tsx
import { pushConfigured, stopPush, testPush } from '../services/push';
import Constants from 'expo-constants';
import { OllamaSetup } from '../components/OllamaSetup';
import { BreakPanel } from '../components/BreakPanel';
import { BreakSettingsCard } from '../components/BreakSettingsCard';
import { FeatureSettings } from '../components/FeatureSettings';
```

with

```tsx
import { pushConfigured, stopPush, testPush } from '../services/push';
import Constants from 'expo-constants';
import { OllamaSetup } from '../components/OllamaSetup';
import { PaletteSwatches } from '../components/PaletteSwatches';
import { BreakPanel } from '../components/BreakPanel';
import { BreakSettingsCard } from '../components/BreakSettingsCard';
import { FeatureSettings } from '../components/FeatureSettings';
```

In `src/app/settings.tsx` replace

```tsx
              <Pill key={a} label={t(`appearance_${a}`)} active={s.appearance === a} onPress={() => app.setSettings({ appearance: a })} />
            ))}
          </Row>
          <Divider />
          <Micro>{t('text_size')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
```

with

```tsx
              <Pill key={a} label={t(`appearance_${a}`)} active={s.appearance === a} onPress={() => app.setSettings({ appearance: a })} />
            ))}
          </Row>
          <Micro>{t('palette_title')}</Micro>
          <PaletteSwatches />
          <Divider />
          <Micro>{t('text_size')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
```

- [ ] **Step 5: Change `src/components/CaloriesLeft.tsx`**

In `src/components/CaloriesLeft.tsx` replace

```tsx
import { fill, makeT, numberText } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar } from '../ui/components';
import { C, F, lh } from '../ui/theme';

/**
 * The one number the day is about, on the page and centred: calories left
```

with

```tsx
import { fill, makeT, numberText } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar } from '../ui/components';
import { C, F, lh, TITLE_WEIGHT } from '../ui/theme';

/**
 * The one number the day is about, on the page and centred: calories left
```

In `src/components/CaloriesLeft.tsx` replace

```tsx
    <View style={{ alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`${label ? `${n(w.kcal)} ${label}. ` : ''}${line}`}>
      {label ? (
        <>
          <Text style={{ color: w.alarm ? C.red : C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{n(w.kcal)}</Text>
          <Text style={{ color: w.alarm ? C.red : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{label}</Text>
          {/* On the page, not in a card, so the empty part of the bar takes a deeper grey than a card's. */}
          <View style={{ alignSelf: 'stretch', marginVertical: 6 }}>
```

with

```tsx
    <View style={{ alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`${label ? `${n(w.kcal)} ${label}. ` : ''}${line}`}>
      {label ? (
        <>
          <Text style={{ color: w.alarm ? C.red : C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: TITLE_WEIGHT, fontVariant: ['tabular-nums'] }}>{n(w.kcal)}</Text>
          <Text style={{ color: w.alarm ? C.red : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{label}</Text>
          {/* On the page, not in a card, so the empty part of the bar takes a deeper grey than a card's. */}
          <View style={{ alignSelf: 'stretch', marginVertical: 6 }}>
```

- [ ] **Step 6: Create `src/components/PaletteSwatches.tsx`**

Create `src/components/PaletteSwatches.tsx`:

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PALETTE_IDS } from '../core/palette';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { chosenProps } from '../ui/chosen';
import { C, F, lh, PALETTE_SETS, S, themeMode } from '../ui/theme';

/**
 * Settings → Appearance: the three palettes as swatches, each its action
 * colour with its reward colour on it, in the light or dark the app is in,
 * and its name under it. The chosen one is ringed and says it is chosen; a
 * tap switches the whole app, and the choice reaches the user's other devices.
 */
export function PaletteSwatches() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const chosen = app.state.settings.palette;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {PALETTE_IDS.map((id) => {
        const p = PALETTE_SETS[id][themeMode()];
        const on = id === chosen;
        const name = t(`palette_${id}`);
        return (
          <Pressable
            key={id}
            onPress={() => app.setSettings({ palette: id })}
            accessibilityRole="button"
            accessibilityLabel={name}
            {...chosenProps(on)}
            style={({ pressed }) => ({ flex: 1, minHeight: S.touch, alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4, borderRadius: S.radiusSm, borderWidth: 2, borderColor: on ? C.accentText : 'transparent', opacity: pressed ? 0.8 : 1 })}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accent, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: p.gold, borderWidth: 2, borderColor: C.card }} />
            </View>
            <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), textAlign: 'center' }}>{name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 7: Change `src/components/StreakPill.tsx`**

In `src/components/StreakPill.tsx` replace

```tsx
import { spokenLine } from '../ui/toastWords';

/**
 * The streak at the right of Today's header: a small soft teal pill, "5 days"
 * beside a flame, the store's own streak (the one the Streak tile climbs). It
 * opens Progress, as the tile on Today does, and says so in its name, which
 * the web reads where it reads no hint; the box round it is a finger tall on
 * every platform. Nothing while there is no streak to show.
```

with

```tsx
import { spokenLine } from '../ui/toastWords';

/**
 * The streak at the right of Today's header: a small gold pill (a reward, so
 * the reward colours: ink on the reward fill), "5 days" beside a flame, the
 * store's own streak (the one the Streak tile climbs). It
 * opens Progress, as the tile on Today does, and says so in its name, which
 * the web reads where it reads no hint; the box round it is a finger tall on
 * every platform. Nothing while there is no streak to show.
```

In `src/components/StreakPill.tsx` replace

```tsx
      accessibilityRole="button"
      accessibilityLabel={spokenLine([`${t('tile_streak')}: ${days}`, t('tile_hint_streak')])}
      style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.accentSoft }}>
        <Ionicons name="flame" size={F.small} color={C.accentText} />
        <Text numberOfLines={1} style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
          {days}
        </Text>
      </View>
```

with

```tsx
      accessibilityRole="button"
      accessibilityLabel={spokenLine([`${t('tile_streak')}: ${days}`, t('tile_hint_streak')])}
      style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.goldSoft }}>
        <Ionicons name="flame" size={F.small} color={C.goldInk} />
        <Text numberOfLines={1} style={{ color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
          {days}
        </Text>
      </View>
```

- [ ] **Step 8: Change `src/components/TabBar.tsx`**

Sizes from `barGeometry.ts`; the active pill is `accentSoft`; ➕ rises half its height above the bar with the soft lift and no teal glow.

In `src/components/TabBar.tsx` replace

```tsx
import { addSlot, barItems, viewedDate, type BarItem } from '../core/bar';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, F, lh, lift, S } from '../ui/theme';
import { useAddSheet } from './AddSheet';

/**
 * The bar: Today, the extra tabs the person chose (Progress unless changed),
 * ➕ in the middle, and Me. core/bar.ts sets the order, so the sidebar on a
 * wide screen shows the same list. The tabs are tabs in a tab list, so the
 * selected one is announced on the web too; ➕ is a button, not a tab, laid
 * over an empty slot in the list's middle: it adds food for the day Today is
 * showing. Holding any tab opens Customize, where the tabs are chosen.
 * Hand-rolled because the stock bar gives its label a box that clips
 * Devanagari marks on the web.
 */
type IconName = keyof typeof Ionicons.glyphMap;
type Route = { key: string; name: string; params?: object };
```

with

```tsx
import { addSlot, barItems, viewedDate, type BarItem } from '../core/bar';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { barHeight, PLUS_LIFT, PLUS_SIZE, TAB_GAP, TAB_ICON, TAB_PAD, TAB_PILL, tabLabelSize } from '../ui/barGeometry';
import { C, lh, lift, S, textScale } from '../ui/theme';
import { useAddSheet } from './AddSheet';

/**
 * The bar: Today, the extra tabs the person chose (Routine and Progress
 * unless changed), ➕ in the middle, and Me. core/bar.ts sets the order, so
 * the sidebar on a wide screen shows the same list. The tabs are tabs in a
 * tab list, so the selected one is announced on the web too; ➕ is a button,
 * not a tab, laid over an empty slot in the list's middle, lifted half its
 * height above the bar: it logs anything for the day Today is showing. The
 * sizes are ui/barGeometry.ts's. Holding any tab opens Customize, where the
 * tabs are chosen. Hand-rolled because the stock bar gives its label a box
 * that clips Devanagari marks on the web.
 */
type IconName = keyof typeof Ionicons.glyphMap;
type Route = { key: string; name: string; params?: object };
```

In `src/components/TabBar.tsx` replace

```tsx
        borderTopColor: C.border,
        ...lift(2),
        shadowOffset: { width: 0, height: -4 },
        minHeight: 64 + bottom,
        paddingTop: 8,
        paddingBottom: bottom,
      }}>
      {/* The tab list holds only tabs; ➕'s place in it is an empty slot. */}
```

with

```tsx
        borderTopColor: C.border,
        ...lift(2),
        shadowOffset: { width: 0, height: -4 },
        minHeight: barHeight(textScale()) + bottom,
        paddingBottom: bottom,
      }}>
      {/* The tab list holds only tabs; ➕'s place in it is an empty slot. */}
```

In `src/components/TabBar.tsx` replace

```tsx
          ),
        )}
      </View>
      {/* ➕ is a button laid over that slot, outside the list, so a screen reader never counts it as a tab. */}
      <View style={{ position: 'absolute', top: 8, left: `${(slot.index / slot.count) * 100}%`, width: `${100 / slot.count}%`, alignItems: 'center' }}>
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => ({
            width: 60,
            height: 60,
            borderRadius: 30,
            marginTop: -26,
            backgroundColor: C.accent,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 5,
            borderColor: C.bgAlt,
            ...lift(2),
            shadowColor: C.accent,
            shadowOpacity: 0.4,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}>
          <Ionicons name="add" size={30} color={C.onAccent} />
        </Pressable>
      </View>
    </View>
```

with

```tsx
          ),
        )}
      </View>
      {/* ➕ is a button laid over that slot, outside the list, so a screen reader never counts it as a tab. Half of it rises above the bar. */}
      <View style={{ position: 'absolute', top: -PLUS_LIFT, left: `${(slot.index / slot.count) * 100}%`, width: `${100 / slot.count}%`, alignItems: 'center' }}>
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => ({
            width: PLUS_SIZE,
            height: PLUS_SIZE,
            borderRadius: PLUS_SIZE / 2,
            backgroundColor: C.accent,
            alignItems: 'center',
            justifyContent: 'center',
            ...lift(2),
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}>
          <Ionicons name="add" size={28} color={C.onAccent} />
        </Pressable>
      </View>
    </View>
```

In `src/components/TabBar.tsx` replace

```tsx
  onLongPress: () => void;
}) {
  const color = focused ? C.accentText : C.textFaint;
  return (
    <Pressable
      onPress={onPress}
```

with

```tsx
  onLongPress: () => void;
}) {
  const color = focused ? C.accentText : C.textFaint;
  const size = tabLabelSize(textScale());
  return (
    <Pressable
      onPress={onPress}
```

In `src/components/TabBar.tsx` replace

```tsx
      aria-selected={focused}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'flex-start', gap: 3, paddingHorizontal: 2, opacity: pressed ? 0.6 : 1 })}>
      {/* The active tab sits on a 48 × 32 tinted pill: seen before it is read. */}
      <View style={{ width: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.accentDim : 'transparent' }}>
        <Ionicons name={item.icon as IconName} size={24} color={color} />
      </View>
      <Text numberOfLines={1} style={{ color, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', includeFontPadding: false, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
```

with

```tsx
      aria-selected={focused}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({ flex: 1, minHeight: S.touch, alignItems: 'center', justifyContent: 'flex-start', gap: TAB_GAP, paddingTop: TAB_PAD, paddingHorizontal: 2, opacity: pressed ? 0.6 : 1 })}>
      {/* The active tab sits on a soft pill: seen before it is read. */}
      <View style={{ width: TAB_PILL.width, height: TAB_PILL.height, borderRadius: TAB_PILL.height / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.accentSoft : 'transparent' }}>
        <Ionicons name={item.icon as IconName} size={TAB_ICON} color={color} />
      </View>
      <Text numberOfLines={1} style={{ color, fontSize: size, lineHeight: lh(size), fontWeight: '500', includeFontPadding: false, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
```

- [ ] **Step 9: Change `src/components/WeightTrendCard.tsx`**

In `src/components/WeightTrendCard.tsx` replace

```tsx
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row, Small } from '../ui/components';
import { C, F, lh } from '../ui/theme';
import { toPath } from '../ui/tileGeometry';
import { spokenLine } from '../ui/toastWords';
import { WeightSheet } from './WeightSheet';
```

with

```tsx
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row, Small } from '../ui/components';
import { C, F, lh, TITLE_WEIGHT } from '../ui/theme';
import { toPath } from '../ui/tileGeometry';
import { spokenLine } from '../ui/toastWords';
import { WeightSheet } from './WeightSheet';
```

In `src/components/WeightTrendCard.tsx` replace

```tsx
          </Row>
          {trend ? (
            <>
              <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '400', fontVariant: ['tabular-nums'] }}>
                {oneDecimal(trend.kg)}
                <Text style={{ color: C.textDim, fontSize: F.title, fontWeight: '400' }}>{` ${kg}`}</Text>
              </Text>
```

with

```tsx
          </Row>
          {trend ? (
            <>
              <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: TITLE_WEIGHT, fontVariant: ['tabular-nums'] }}>
                {oneDecimal(trend.kg)}
                <Text style={{ color: C.textDim, fontSize: F.title, fontWeight: '400' }}>{` ${kg}`}</Text>
              </Text>
```

- [ ] **Step 10: Add the words to `src/i18n/index.ts`**

Add 4 keys at the end of each of the three dicts. First check that none is there yet:

Run: `grep -nE "^  (palette_title|palette_emerald|palette_indigo|palette_saffron):" src/i18n/index.ts`
Expected: no output.

In `src/i18n/index.ts` replace

```ts
  rem_streak_job_one: 'Your {n}-day routine streak needs one more job today.',
  rem_streak_jobs: 'Your {n}-day routine streak needs {k} more jobs today.',
  rem_streak_meals: "Your {n}-day streak needs today's meals too.",
};

const mr: Dict = {
```

with

```ts
  rem_streak_job_one: 'Your {n}-day routine streak needs one more job today.',
  rem_streak_jobs: 'Your {n}-day routine streak needs {k} more jobs today.',
  rem_streak_meals: "Your {n}-day streak needs today's meals too.",
  palette_title: 'Colours',
  palette_emerald: 'Emerald and gold',
  palette_indigo: 'Indigo and amber',
  palette_saffron: 'Forest and saffron',
};

const mr: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  rem_streak_job_one: 'तुमच्या {n} दिवसांच्या दिनक्रम मालिकेला आज अजून एक काम हवं.',
  rem_streak_jobs: 'तुमच्या {n} दिवसांच्या दिनक्रम मालिकेला आज अजून {k} कामं हवीत.',
  rem_streak_meals: 'तुमच्या {n} दिवसांच्या मालिकेला आजची जेवणंही हवीत.',
};

const hi: Dict = {
```

with

```ts
  rem_streak_job_one: 'तुमच्या {n} दिवसांच्या दिनक्रम मालिकेला आज अजून एक काम हवं.',
  rem_streak_jobs: 'तुमच्या {n} दिवसांच्या दिनक्रम मालिकेला आज अजून {k} कामं हवीत.',
  rem_streak_meals: 'तुमच्या {n} दिवसांच्या मालिकेला आजची जेवणंही हवीत.',
  palette_title: 'रंग',
  palette_emerald: 'पाचू आणि सोनेरी',
  palette_indigo: 'नीळ आणि अंबर',
  palette_saffron: 'वनहिरवा आणि केशरी',
};

const hi: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  rem_streak_job_one: 'आपके {n} दिन के दिनचर्या सिलसिले को आज एक और काम चाहिए.',
  rem_streak_jobs: 'आपके {n} दिन के दिनचर्या सिलसिले को आज {k} और काम चाहिए.',
  rem_streak_meals: 'आपके {n} दिन के सिलसिले को आज के खाने भी चाहिए.',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

with

```ts
  rem_streak_job_one: 'आपके {n} दिन के दिनचर्या सिलसिले को आज एक और काम चाहिए.',
  rem_streak_jobs: 'आपके {n} दिन के दिनचर्या सिलसिले को आज {k} और काम चाहिए.',
  rem_streak_meals: 'आपके {n} दिन के सिलसिले को आज के खाने भी चाहिए.',
  palette_title: 'रंग',
  palette_emerald: 'पन्ना और सुनहरा',
  palette_indigo: 'नील और अंबर',
  palette_saffron: 'गहरा हरा और केसरिया',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

- [ ] **Step 11: Change `src/ui/TopBar.tsx`**

`TintBand` draws the tint; the top bar no longer paints the page colour, so the band shows behind it; the title is heavier.

In `src/ui/TopBar.tsx` replace

```tsx
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from './components';
import { C, F, lh, S } from './theme';
import { useBreakpoint } from './useBreakpoint';

/** One compact bar per tab. Replaces the stock navigation header. `over` is a small quiet line above the title (Today's date over its greeting). */
export function TopBar({
  title,
  alt,
```

with

```tsx
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from './components';
import { C, F, lh, S, TITLE_WEIGHT } from './theme';
import { useBreakpoint } from './useBreakpoint';

/** How far the tint band reaches under the top of the screen, past the safe area: behind the header and the first block under it. */
export const TINT_BAND = 168;

/** The soft tint at the top of every tab, in the palette's own colour, behind the header and what comes first under it. Drawn first, so the page scrolls over it. */
export function TintBand() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + TINT_BAND, backgroundColor: C.tint }} />;
}

/** One compact bar per tab, over the tab's tint band. Replaces the stock navigation header. `over` is a small quiet line above the title (Today's date over its greeting). */
export function TopBar({
  title,
  alt,
```

In `src/ui/TopBar.tsx` replace

```tsx
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() === 'desktop';
  return (
    <View style={{ backgroundColor: C.bg }}>
      <View
        style={{
          paddingTop: insets.top + 10,
```

with

```tsx
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() === 'desktop';
  return (
    <View>
      <View
        style={{
          paddingTop: insets.top + 10,
```

In `src/ui/TopBar.tsx` replace

```tsx
              {over}
            </Text>
          ) : null}
          <Text numberOfLines={1} accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
            {alt || title}
          </Text>
          {subtitle ? (
```

with

```tsx
              {over}
            </Text>
          ) : null}
          <Text numberOfLines={1} accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: TITLE_WEIGHT }}>
            {alt || title}
          </Text>
          {subtitle ? (
```

In `src/ui/TopBar.tsx` replace

```tsx
  );
}

/** A tab screen: TopBar, then the scrolling body. */
export function Page({
  title,
  alt,
```

with

```tsx
  );
}

/** A tab screen: the tint band, the TopBar, then the scrolling body over the band. */
export function Page({
  title,
  alt,
```

In `src/ui/TopBar.tsx` replace

```tsx
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {header ? <TopBar title={title} alt={alt} over={over} subtitle={subtitle} right={right} left={left} /> : null}
      <Screen wide={wide}>{children}</Screen>
    </View>
  );
}
```

with

```tsx
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {header ? <TintBand /> : null}
      {header ? <TopBar title={title} alt={alt} over={over} subtitle={subtitle} right={right} left={left} /> : null}
      <Screen wide={wide} onBand={header}>
        {children}
      </Screen>
    </View>
  );
}
```

- [ ] **Step 12: Change `src/ui/components.tsx`**

In `src/ui/components.tsx` replace

```tsx
/** A chip's button is a finger wide and tall on every platform, sized by the box itself (the web adds no reach around a control); the chip stays 35 tall in the middle of it. */
const PILL_REACH: ViewStyle = { minHeight: S.touch, minWidth: S.touch, justifyContent: 'center' };

export function Screen({ children, refreshing, wide }: { children: React.ReactNode; refreshing?: boolean; wide?: boolean }) {
  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={[st.screenContent, wide && { maxWidth: S.maxWide, paddingHorizontal: S.gutterWide, paddingTop: 4 }]}
      keyboardShouldPersistTaps="handled">
      {refreshing ? <ActivityIndicator color={C.accent} /> : null}
```

with

```tsx
/** A chip's button is a finger wide and tall on every platform, sized by the box itself (the web adds no reach around a control); the chip stays 35 tall in the middle of it. */
const PILL_REACH: ViewStyle = { minHeight: S.touch, minWidth: S.touch, justifyContent: 'center' };

/** A scrolling page. `onBand`: it sits over a tab's tint band (`Page`), so it lets the band show through instead of painting the page colour. */
export function Screen({ children, refreshing, wide, onBand }: { children: React.ReactNode; refreshing?: boolean; wide?: boolean; onBand?: boolean }) {
  return (
    <ScrollView
      style={[st.screen, onBand ? { backgroundColor: 'transparent' } : null]}
      contentContainerStyle={[st.screenContent, wide && { maxWidth: S.maxWide, paddingHorizontal: S.gutterWide, paddingTop: 4 }]}
      keyboardShouldPersistTaps="handled">
      {refreshing ? <ActivityIndicator color={C.accent} /> : null}
```

- [ ] **Step 13: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1836 tests passing; relay 73 tests passing.

- [ ] **Step 14: Commit**

```bash
git add 'src/app/(tabs)/body.tsx' 'src/app/(tabs)/sleep-tab.tsx' src/app/_layout.tsx src/app/settings.tsx src/components/CaloriesLeft.tsx src/components/PaletteSwatches.tsx src/components/StreakPill.tsx src/components/TabBar.tsx src/components/WeightTrendCard.tsx src/i18n/index.ts src/ui/TopBar.tsx src/ui/components.tsx
git commit -m "$(cat <<'EOF'
Settings → Appearance has the three palettes as swatches; every tab has a soft tint at its top, screen titles and the big number are heavier, the streak pill is gold, and the tab bar is the new size with the plus lifted half above it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: ➕ logs anything

Decision 3. A row of quick actions above the food search, from a pure list (`quickActions`): Food (the food search, where the sheet opens), Water and Walk (one tap each, the toast carries Undo as the sheet closes, as a one-tap meal does), Weight (the weight entry over the sheet; closing it closes both) and Routine (the date's own list, the card from Today). The row shows only when logging; the weight only on today. The plus is named "Add" now, since it adds more than food.

**Files:**
- Modify: `src/app/customize.tsx`
- Modify: `src/components/AddSheet.tsx`
- Modify: `src/components/TopBarActions.tsx`
- Modify: `src/core/__tests__/addSheet.test.ts`
- Modify: `src/core/addSheet.ts`
- Modify: `src/core/bar.ts`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `WALK_STEP_MIN`, `WeightSheet`, `AbhyasCard`, `chosenProps`.
- Produces, in `src/core/addSheet.ts`: `type QuickKey = 'food' | 'water' | 'walk' | 'weight' | 'routine'`, `type QuickAction = { key: QuickKey; icon: string; labelKey: string; panel: boolean }`, `quickActions(mode: 'log' | 'plan', isToday: boolean): QuickAction[]`.
- Words: `add_any`, `quick_food`, `quick_water_a11y`, `quick_walk_a11y`.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/addSheet.test.ts` replace

```ts
import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { addRows, addsIntoMeal, alreadySaved, filledIn, menuSave, offersPlanned, offersYesterday, plannedSummary, removeUndoSteps, repeatItems, sheetMode, slotAllowance, slotBefore, slotLine, slotLineText, startLines, startSlot, switchDraft, undoSteps, yesterdayIn } from '../addSheet';
import { addLine, basketFromLines, lineOf, setCount, slotPreview, type BasketLine } from '../basket';
import { makeT } from '../../i18n';
import { addSkip } from '../menu';
```

with

```ts
import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { addRows, addsIntoMeal, alreadySaved, filledIn, menuSave, offersPlanned, offersYesterday, plannedSummary, quickActions, removeUndoSteps, repeatItems, sheetMode, slotAllowance, slotBefore, slotLine, slotLineText, startLines, startSlot, switchDraft, undoSteps, yesterdayIn } from '../addSheet';
import { addLine, basketFromLines, lineOf, setCount, slotPreview, type BasketLine } from '../basket';
import { makeT } from '../../i18n';
import { addSkip } from '../menu';
```

In `src/core/__tests__/addSheet.test.ts` replace

```ts

  it('changing a menu offers no eating as planned, no yesterday, no photo or barcode', () => {
    expect(kinds(addRows({ ...base, mode: 'plan' }))).toEqual(['head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati']);
  });
});
```

with

```ts

  it('changing a menu offers no eating as planned, no yesterday, no photo or barcode', () => {
    expect(kinds(addRows({ ...base, mode: 'plan' }))).toEqual(['head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati']);
  });
});

describe('quickActions: ➕ logs anything', () => {
  it('offers Food, Water, Walk, Weight and Routine when logging today, Food and Routine as panels of the sheet', () => {
    expect(quickActions('log', true).map((q) => `${q.key}${q.panel ? ' panel' : ''}`)).toEqual(['food panel', 'water', 'walk', 'weight', 'routine panel']);
  });

  it('leaves the weight out on another day, and offers nothing while a menu is being changed', () => {
    expect(quickActions('log', false).map((q) => q.key)).toEqual(['food', 'water', 'walk', 'routine']);
    expect(quickActions('plan', true)).toEqual([]);
  });

  it('names every action in all three languages', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const t = makeT(lang);
      for (const q of quickActions('log', true)) expect(t(q.labelKey), `${lang} ${q.key}`).not.toBe(q.labelKey);
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/addSheet.test.ts`
Expected: FAIL, because `quickActions` does not exist yet: `Tests  3 failed | 50 passed (53)`, the first reads `TypeError: quickActions is not a function`

- [ ] **Step 3: Change `src/app/customize.tsx`**

In `src/app/customize.tsx` replace

```tsx
          <Small color={C.textDim}>{t('cust_tabs_note')}</Small>
          {locked('today-outline', t('tab_today'))}
          <Divider />
          {locked('add', t('add_food'))}
          <Divider />
          {locked('person-circle-outline', t('tab_me'))}
          {TAB_IDS.map((id) => (
```

with

```tsx
          <Small color={C.textDim}>{t('cust_tabs_note')}</Small>
          {locked('today-outline', t('tab_today'))}
          <Divider />
          {locked('add', t('add_any'))}
          <Divider />
          {locked('person-circle-outline', t('tab_me'))}
          {TAB_IDS.map((id) => (
```

- [ ] **Step 4: Change `src/components/AddSheet.tsx`**

The quick actions over the food search; Routine shows the card from Today in the sheet; Weight opens the weight entry over it. The food search is unchanged, one level deeper.

In `src/components/AddSheet.tsx` replace

```tsx
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, ScrollView, Text, View } from 'react-native';
import {
  addRows,
  addsIntoMeal,
```

with

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import {
  addRows,
  addsIntoMeal,
```

In `src/components/AddSheet.tsx` replace

```tsx
  offersPlanned,
  offersYesterday,
  plannedSummary,
  repeatItems,
  sheetMode,
  slotAllowance,
```

with

```tsx
  offersPlanned,
  offersYesterday,
  plannedSummary,
  quickActions,
  repeatItems,
  sheetMode,
  slotAllowance,
```

In `src/components/AddSheet.tsx` replace

```tsx
  undoSteps,
  yesterdayIn,
  type AddRow,
} from '../core/addSheet';
import { addLine, basketFromItems, basketFromLines, basketMeal, basketTotals, itemsMeal, lineOf, linesFromBasket, putLine, setCount, setGrams, slotPreview, stepCount, type BasketLine } from '../core/basket';
import { addDays } from '../core/date';
```

with

```tsx
  undoSteps,
  yesterdayIn,
  type AddRow,
  type QuickKey,
} from '../core/addSheet';
import { addLine, basketFromItems, basketFromLines, basketMeal, basketTotals, itemsMeal, lineOf, linesFromBasket, putLine, setCount, setGrams, slotPreview, stepCount, type BasketLine } from '../core/basket';
import { addDays } from '../core/date';
```

In `src/components/AddSheet.tsx` replace

```tsx
import { useMinute } from '../services/useClock';
import { useApp } from '../store/AppProvider';
import { Btn, Empty, Field, Micro, Pill } from '../ui/components';
import { IconButton } from '../ui/IconButton';
import { SheetFrame } from '../ui/Sheet';
import { C, F, lh, S } from '../ui/theme';
import { FoodRow, OneTapRow, PlannedCard, SaveAsOffer, ToolsRow } from './AddSheetRows';
import { CustomFoodForm } from './CustomFoodForm';
import { FoodDetailSheet } from './FoodDetailSheet';

/**
 * What the add sheet is opened for: a date and a slot, the foods to start
```

with

```tsx
import { useMinute } from '../services/useClock';
import { useApp } from '../store/AppProvider';
import { Btn, Empty, Field, Micro, Pill } from '../ui/components';
import { chosenProps } from '../ui/chosen';
import { IconButton } from '../ui/IconButton';
import { SheetFrame } from '../ui/Sheet';
import { C, F, lh, S } from '../ui/theme';
import { AbhyasCard } from './AbhyasCard';
import { FoodRow, OneTapRow, PlannedCard, SaveAsOffer, ToolsRow } from './AddSheetRows';
import { CustomFoodForm } from './CustomFoodForm';
import { FoodDetailSheet } from './FoodDetailSheet';
import { WALK_STEP_MIN } from './tiles/WalkTile';
import { WeightSheet } from './WeightSheet';

/**
 * What the add sheet is opened for: a date and a slot, the foods to start
```

In `src/components/AddSheet.tsx` replace

```tsx
}

/**
 * The ➕ sheet: anything eaten that is not ticked off the menu, for the date
 * and slot being looked at. Search sits at the top so its matches stay above
 * the keyboard; under it any food with a − / + and a grams box, and a bar
 * with "N items · X kcal" and Save. Every meal goes through the store's
 * addMeal (or addMealFromPlan) with calories from the database. The fast ways
```

with

```tsx
}

/**
 * The ➕ sheet logs anything: a row of quick actions at its top (Food, Water,
 * Walk, Weight, Routine; core/addSheet.ts `quickActions`) over the food
 * search. Water adds a bottle and Walk ten minutes to the date in one tap,
 * with Undo on the toast as the sheet closes; Weight opens the weight entry;
 * Routine shows the date's own list (the card on Today, to tick or start).
 * The food search is anything eaten that is not ticked off the menu, for the
 * date and slot being looked at. Search sits at the top so its matches stay above
 * the keyboard; under it any food with a − / + and a grams box, and a bar
 * with "N items · X kcal" and Save. Every meal goes through the store's
 * addMeal (or addMealFromPlan) with calories from the database. The fast ways
```

In `src/components/AddSheet.tsx` replace

```tsx
  const [customOpen, setCustomOpen] = useState(false);
  // After a logged meal of two or more foods: its lines, offered as a saved meal, and the words saying it was logged.
  const [offer, setOffer] = useState<{ lines: PlanLine[]; logged: string } | null>(null);

  // The slot: the one asked for; else, today, the one whose turn it is; else the day's first still open.
  const { menuOn } = app;
```

with

```tsx
  const [customOpen, setCustomOpen] = useState(false);
  // After a logged meal of two or more foods: its lines, offered as a saved meal, and the words saying it was logged.
  const [offer, setOffer] = useState<{ lines: PlanLine[]; logged: string } | null>(null);
  // What the sheet shows under its quick actions: the food search, or the date's routine list.
  const [panel, setPanel] = useState<'food' | 'routine'>('food');
  const [weightOpen, setWeightOpen] = useState(false);
  const quick = quickActions(mode, isToday);

  // The slot: the one asked for; else, today, the one whose turn it is; else the day's first still open.
  const { menuOn } = app;
```

In `src/components/AddSheet.tsx` replace

```tsx
    onClose();
  }

  function renderRow({ item }: { item: AddRow }) {
    switch (item.kind) {
      case 'head':
```

with

```tsx
    onClose();
  }

  /** A quick action: a panel shows, or water or a walk is logged to the date with Undo on the toast, or the weight entry opens. */
  function onQuick(key: QuickKey) {
    if (key === 'food' || key === 'routine') {
      setPanel(key);
      return;
    }
    if (key === 'weight') {
      setWeightOpen(true);
      return;
    }
    fb.haptic('light');
    if (key === 'water') {
      const ml = state.settings.bottleMl;
      const id = app.addWater(ml, date);
      fb.notify(fill(t('tile_added_water'), { ml }), { label: t('undo'), onPress: () => app.removeWater(id) });
    } else {
      const id = app.logWalk(date, WALK_STEP_MIN);
      fb.notify(fill(t('tile_added_walk'), { min: WALK_STEP_MIN }), { label: t('undo'), onPress: () => app.removeActivity(id) });
    }
    onClose();
  }

  function quickLabel(key: QuickKey, label: string): string {
    if (key === 'water') return fill(t('quick_water_a11y'), { ml: state.settings.bottleMl });
    if (key === 'walk') return fill(t('quick_walk_a11y'), { min: WALK_STEP_MIN });
    return label;
  }

  function renderRow({ item }: { item: AddRow }) {
    switch (item.kind) {
      case 'head':
```

In `src/components/AddSheet.tsx` replace

```tsx
    <SheetFrame open onClose={onClose} maxWidth={560} tall>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: S.padLg, paddingRight: 8, paddingTop: 8 }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
          {mode === 'plan' ? t('add_plan_title') : t('add_food')}
        </Text>
        <IconButton name="close" label={t('close')} onPress={onClose} />
      </View>
```

with

```tsx
    <SheetFrame open onClose={onClose} maxWidth={560} tall>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: S.padLg, paddingRight: 8, paddingTop: 8 }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
          {mode === 'plan' ? t('add_plan_title') : panel === 'routine' ? t('abhyas') : t('add_food')}
        </Text>
        <IconButton name="close" label={t('close')} onPress={onClose} />
      </View>
```

In `src/components/AddSheet.tsx` replace

```tsx
        </ScrollView>
      ) : (
        <>
          <View style={{ gap: 4, paddingBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: S.padLg }}>
              {menu.meals.map((m) => (
                <Pill key={m.id} label={`${slotName(m)} ${m.time}`} active={slot?.id === m.id} onPress={() => pickSlot(m.id)} />
              ))}
            </ScrollView>
            {lineText ? <Text style={{ color: lineColor, fontSize: F.small, lineHeight: lh(F.small), paddingHorizontal: S.padLg }}>{lineText}</Text> : null}
            <View style={{ flexDirection: 'row', paddingHorizontal: S.padLg, paddingTop: 4 }}>
              <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} accessibilityLabel={t('search_food')} />
            </View>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: S.padLg, paddingBottom: S.padLg }}
            ListFooterComponent={
              customOpen ? (
                <CustomFoodForm
                  initialName={query}
                  onSaved={(f) => {
                    setCustomOpen(false);
                    addFood(f);
                    setQuery('');
                  }}
                  onCancel={() => setCustomOpen(false)}
                />
              ) : null
            }
          />
          {basket.length > 0 || mode === 'plan' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.padLg, paddingVertical: 12, borderTopWidth: S.hairline, borderTopColor: C.border, backgroundColor: C.bgAlt }}>
              <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
                {fill(t(totals.items === 1 ? 'add_bar_one' : 'add_bar'), { n: totals.items, kcal: numberText(totals.kcal) })}
              </Text>
              <Btn label={mode === 'plan' ? t('add_save_menu') : t('save')} onPress={save} disabled={!slot} style={{ minWidth: 120 }} />
            </View>
          ) : null}
        </>
      )}
      <FoodDetailSheet
        food={detail}
        initial={editing ? { unit: editing.unit, gramsPerUnit: editing.gramsPerUnit, count: editing.count } : null}
```

with

```tsx
        </ScrollView>
      ) : (
        <>
          {quick.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: S.padLg, paddingTop: 4, paddingBottom: 10 }}>
              {quick.map((q) => {
                const on = q.panel && panel === q.key;
                const label = t(q.labelKey);
                return (
                  <Pressable
                    key={q.key}
                    onPress={() => onQuick(q.key)}
                    accessibilityRole="button"
                    accessibilityLabel={quickLabel(q.key, label)}
                    {...(q.panel ? chosenProps(on) : {})}
                    style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2, borderRadius: S.radiusSm, backgroundColor: on ? C.accentSoft : C.card, opacity: pressed ? 0.8 : 1 })}>
                    <Ionicons name={q.icon as keyof typeof Ionicons.glyphMap} size={22} color={on ? C.accentText : C.textDim} />
                    <Text numberOfLines={1} style={{ color: on ? C.accentText : C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {panel === 'routine' ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: S.padLg, paddingBottom: S.padLg }}>
              <AbhyasCard date={date} />
            </ScrollView>
          ) : (
          <>
            <View style={{ gap: 4, paddingBottom: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: S.padLg }}>
                {menu.meals.map((m) => (
                  <Pill key={m.id} label={`${slotName(m)} ${m.time}`} active={slot?.id === m.id} onPress={() => pickSlot(m.id)} />
                ))}
              </ScrollView>
              {lineText ? <Text style={{ color: lineColor, fontSize: F.small, lineHeight: lh(F.small), paddingHorizontal: S.padLg }}>{lineText}</Text> : null}
              <View style={{ flexDirection: 'row', paddingHorizontal: S.padLg, paddingTop: 4 }}>
                <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} accessibilityLabel={t('search_food')} />
              </View>
            </View>
            <FlatList
              data={rows}
              keyExtractor={(r) => r.key}
              renderItem={renderRow}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: S.padLg, paddingBottom: S.padLg }}
              ListFooterComponent={
                customOpen ? (
                  <CustomFoodForm
                    initialName={query}
                    onSaved={(f) => {
                      setCustomOpen(false);
                      addFood(f);
                      setQuery('');
                    }}
                    onCancel={() => setCustomOpen(false)}
                  />
                ) : null
              }
            />
            {basket.length > 0 || mode === 'plan' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.padLg, paddingVertical: 12, borderTopWidth: S.hairline, borderTopColor: C.border, backgroundColor: C.bgAlt }}>
                <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
                  {fill(t(totals.items === 1 ? 'add_bar_one' : 'add_bar'), { n: totals.items, kcal: numberText(totals.kcal) })}
                </Text>
                <Btn label={mode === 'plan' ? t('add_save_menu') : t('save')} onPress={save} disabled={!slot} style={{ minWidth: 120 }} />
              </View>
            ) : null}
          </>
          )}
        </>
      )}
      {/* The weight entry, over the sheet; closing it closes both, as the weight was what the tap was for. */}
      <WeightSheet
        open={weightOpen}
        onClose={() => {
          setWeightOpen(false);
          onClose();
        }}
      />
      <FoodDetailSheet
        food={detail}
        initial={editing ? { unit: editing.unit, gramsPerUnit: editing.gramsPerUnit, count: editing.count } : null}
```

- [ ] **Step 5: Change `src/components/TopBarActions.tsx`**

In `src/components/TopBarActions.tsx` replace

```tsx
        </Row>
      ) : null}
      {wide ? (
        <IconButton name="add-circle-outline" label={t('add_food')} onPress={() => addSheet.open({ date: today })} />
      ) : (
        <>
          {/* The guide lives in Me; the phone header keeps room for the name. */}
```

with

```tsx
        </Row>
      ) : null}
      {wide ? (
        <IconButton name="add-circle-outline" label={t('add_any')} onPress={() => addSheet.open({ date: today })} />
      ) : (
        <>
          {/* The guide lives in Me; the phone header keeps room for the name. */}
```

- [ ] **Step 6: Change `src/core/addSheet.ts`**

In `src/core/addSheet.ts` replace

```ts
 */
export function sheetMode(date: ISODate, today: ISODate, asked?: 'log' | 'plan'): 'log' | 'plan' {
  return date > today ? 'plan' : (asked ?? 'log');
}

/**
```

with

```ts
 */
export function sheetMode(date: ISODate, today: ISODate, asked?: 'log' | 'plan'): 'log' | 'plan' {
  return date > today ? 'plan' : (asked ?? 'log');
}

/** One of the quick actions above the food search: Food and Routine are panels of the sheet, the rest log in one tap. */
export type QuickKey = 'food' | 'water' | 'walk' | 'weight' | 'routine';
export type QuickAction = { key: QuickKey; icon: string; labelKey: string; panel: boolean };

/**
 * The row of quick actions at the top of the ➕ sheet, so ➕ logs anything:
 * Food (the food search, where the sheet opens), Water (a bottle), Walk (ten
 * minutes), Weight (the weight entry) and Routine (the day's list, to tick or
 * start). Only when logging: a menu being changed is food alone. The weight
 * only on today, the one day a weigh-in is entered for.
 */
export function quickActions(mode: 'log' | 'plan', isToday: boolean): QuickAction[] {
  if (mode === 'plan') return [];
  const weight: QuickAction[] = isToday ? [{ key: 'weight', icon: 'scale-outline', labelKey: 'add_weight', panel: false }] : [];
  return [
    { key: 'food', icon: 'restaurant-outline', labelKey: 'quick_food', panel: true },
    { key: 'water', icon: 'water-outline', labelKey: 'water', panel: false },
    { key: 'walk', icon: 'walk-outline', labelKey: 'tile_walk', panel: false },
    ...weight,
    { key: 'routine', icon: 'book-outline', labelKey: 'abhyas', panel: true },
  ];
}

/**
```

- [ ] **Step 7: Change `src/core/bar.ts`**

In `src/core/bar.ts` replace

```ts
export type BarItem = { key: BarKey; route: string | null; icon: string; labelKey: string };

const TODAY: BarItem = { key: 'today', route: 'index', icon: 'today-outline', labelKey: 'tab_today' };
const ADD: BarItem = { key: 'add', route: null, icon: 'add', labelKey: 'add_food' };
const ME: BarItem = { key: 'me', route: 'me', icon: 'person-circle-outline', labelKey: 'tab_me' };
const EXTRA: Record<TabId, BarItem> = {
  progress: { key: 'progress', route: 'progress', icon: 'trending-up-outline', labelKey: 'tab_progress' },
```

with

```ts
export type BarItem = { key: BarKey; route: string | null; icon: string; labelKey: string };

const TODAY: BarItem = { key: 'today', route: 'index', icon: 'today-outline', labelKey: 'tab_today' };
const ADD: BarItem = { key: 'add', route: null, icon: 'add', labelKey: 'add_any' };
const ME: BarItem = { key: 'me', route: 'me', icon: 'person-circle-outline', labelKey: 'tab_me' };
const EXTRA: Record<TabId, BarItem> = {
  progress: { key: 'progress', route: 'progress', icon: 'trending-up-outline', labelKey: 'tab_progress' },
```

- [ ] **Step 8: Add the words to `src/i18n/index.ts`**

Add 4 keys at the end of each of the three dicts. First check that none is there yet:

Run: `grep -nE "^  (add_any|quick_food|quick_water_a11y|quick_walk_a11y):" src/i18n/index.ts`
Expected: no output.

In `src/i18n/index.ts` replace

```ts
  palette_emerald: 'Emerald and gold',
  palette_indigo: 'Indigo and amber',
  palette_saffron: 'Forest and saffron',
};

const mr: Dict = {
```

with

```ts
  palette_emerald: 'Emerald and gold',
  palette_indigo: 'Indigo and amber',
  palette_saffron: 'Forest and saffron',
  add_any: 'Add',
  quick_food: 'Food',
  quick_water_a11y: 'Add {ml} ml of water',
  quick_walk_a11y: 'Add a {min}-minute walk',
};

const mr: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  palette_emerald: 'पाचू आणि सोनेरी',
  palette_indigo: 'नीळ आणि अंबर',
  palette_saffron: 'वनहिरवा आणि केशरी',
};

const hi: Dict = {
```

with

```ts
  palette_emerald: 'पाचू आणि सोनेरी',
  palette_indigo: 'नीळ आणि अंबर',
  palette_saffron: 'वनहिरवा आणि केशरी',
  add_any: 'जोडा',
  quick_food: 'जेवण',
  quick_water_a11y: '{ml} ml पाणी जोडा',
  quick_walk_a11y: '{min} मिनिटांचं चालणं जोडा',
};

const hi: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  palette_emerald: 'पन्ना और सुनहरा',
  palette_indigo: 'नील और अंबर',
  palette_saffron: 'गहरा हरा और केसरिया',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

with

```ts
  palette_emerald: 'पन्ना और सुनहरा',
  palette_indigo: 'नील और अंबर',
  palette_saffron: 'गहरा हरा और केसरिया',
  add_any: 'जोड़ें',
  quick_food: 'खाना',
  quick_water_a11y: '{ml} ml पानी जोड़ें',
  quick_walk_a11y: '{min} मिनट की सैर जोड़ें',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run src/core/__tests__/addSheet.test.ts`
Expected: PASS, 53 tests.

- [ ] **Step 10: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1839 tests passing; relay 73 tests passing.

- [ ] **Step 11: Commit**

```bash
git add src/app/customize.tsx src/components/AddSheet.tsx src/components/TopBarActions.tsx src/core/__tests__/addSheet.test.ts src/core/addSheet.ts src/core/bar.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The plus logs anything: Food, Water, Walk, Weight and Routine sit above the food search, water and a walk logged in one tap with Undo, the weight entry and the day's routine list in the same sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Today: the challenge card and the evening teacher

Today shows the day's challenge under the reminders line (today only, nothing on an off day; outside the six customisable blocks, as the reminders line is). From 18:00 the coach line is the teacher's card; the evening review's plain text (no model) is the teacher's praise, the day's numbers, then the tip.

**Files:**
- Modify: `src/app/(tabs)/index.tsx`
- Create: `src/components/ChallengeCard.tsx`
- Modify: `src/components/CoachLine.tsx`
- Modify: `src/components/DayReview.tsx`
- Create: `src/components/TeacherCard.tsx`
- Create: `src/components/useRewards.ts`

**Interfaces:**
- Consumes: `dailyChallenge`, `challengeProgress`, `challengeText`, `dayScore`, `teacherWords`, `stripSince`, `isOffDay`.
- Produces, in `src/components/useRewards.ts`: `useChallengeData(): ChallengeData`, `useTodayChallenge(): { challenge: DailyChallenge; progress: ChallengeProgress } | null`; `ChallengeCard`; in `src/components/TeacherCard.tsx`: `EVENING_FROM = 1080`, `useTeacherWords(): { lead: string; best: string | null; tip: string }`, `TeacherCard`.

- [ ] **Step 1: Change `src/app/(tabs)/index.tsx`**

In `src/app/(tabs)/index.tsx` replace

```tsx
import { AbhyasCard } from '../../components/AbhyasCard';
import { CaloriesLeft } from '../../components/CaloriesLeft';
import { Celebration } from '../../components/Celebration';
import { CoachLine } from '../../components/CoachLine';
import { DayMenu } from '../../components/DayMenu';
import { DayReview } from '../../components/DayReview';
```

with

```tsx
import { AbhyasCard } from '../../components/AbhyasCard';
import { CaloriesLeft } from '../../components/CaloriesLeft';
import { Celebration } from '../../components/Celebration';
import { ChallengeCard } from '../../components/ChallengeCard';
import { CoachLine } from '../../components/CoachLine';
import { DayMenu } from '../../components/DayMenu';
import { DayReview } from '../../components/DayReview';
```

In `src/app/(tabs)/index.tsx` replace

```tsx
      {mode === 'today' ? <IntakeCard /> : null}
      {/* While reminders cannot reach this device, one line that gets them here (components/RemindersBanner.tsx); nothing otherwise. */}
      {mode === 'today' ? <RemindersBanner /> : null}
      {/* A day still to come has no night to check in yet, so todayBlocks leaves its Sleep tile out; the day's line shows only while it is switched on. */}
      {withReview(todayBlocks(state.settings.todayCards, mode, state.settings.features.mantra), review).map((b, i) => {
        if (b.kind === 'review') return <DayReview key="review" />;
```

with

```tsx
      {mode === 'today' ? <IntakeCard /> : null}
      {/* While reminders cannot reach this device, one line that gets them here (components/RemindersBanner.tsx); nothing otherwise. */}
      {mode === 'today' ? <RemindersBanner /> : null}
      {/* Today's challenge, one small step from the user's own last week; nothing on an off day. */}
      {mode === 'today' ? <ChallengeCard /> : null}
      {/* A day still to come has no night to check in yet, so todayBlocks leaves its Sleep tile out; the day's line shows only while it is switched on. */}
      {withReview(todayBlocks(state.settings.todayCards, mode, state.settings.features.mantra), review).map((b, i) => {
        if (b.kind === 'review') return <DayReview key="review" />;
```

- [ ] **Step 2: Create `src/components/ChallengeCard.tsx`**

Create `src/components/ChallengeCard.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { challengeText } from '../core/challenge';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { C, F, lh } from '../ui/theme';
import { useTodayChallenge } from './useRewards';

/**
 * "Today's challenge" on Today: one small step from the user's own last week
 * (core/challenge.ts), how far today has come, and "Done" once it is. Its
 * icon sits on the reward fill; the words are the page's. Nothing on an off
 * day. Read as one line by a screen reader.
 */
export function ChallengeCard() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const today = useTodayChallenge();
  if (!today) return null;
  const { challenge, progress } = today;
  const text = challengeText(challenge, t);
  const sub = progress.done ? t('chal_done') : progress.of > 1 ? fill(t('chal_progress'), { n: progress.n, m: progress.of }) : null;
  return (
    <Card still>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityLabel={[t('chal_title'), text, sub].filter(Boolean).join('. ')}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={progress.done ? 'checkmark' : 'flag-outline'} size={20} color={C.goldInk} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{t('chal_title')}</Text>
          <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{text}</Text>
          {sub ? <Text style={{ color: progress.done ? C.goldInk : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: progress.done ? '500' : '400' }}>{sub}</Text> : null}
        </View>
      </View>
    </Card>
  );
}
```

- [ ] **Step 3: Change `src/components/CoachLine.tsx`**

In `src/components/CoachLine.tsx` replace

```tsx
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';
import { adviceHint, adviceText, useAdviceAction } from './CoachStrip';
import { useCoach } from './useCoach';

/**
 * The coach in one sentence: the one thing that matters now, and the tap that does it. Advice with nothing to do is plain words,
 * not a button. A tap on the water advice adds a bottle and says so, with Undo. Nothing when there is nothing to say.
 */
export function CoachLine() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const minute = useMinute();
  const advice = useCoach(minute)[0];
  const act = useAdviceAction();
  if (!advice) return null;
```

with

```tsx
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';
import { adviceHint, adviceText, useAdviceAction } from './CoachStrip';
import { EVENING_FROM, TeacherCard } from './TeacherCard';
import { useCoach } from './useCoach';

/**
 * The coach in one sentence: the one thing that matters now, and the tap that does it. Advice with nothing to do is plain words,
 * not a button. A tap on the water advice adds a bottle and says so, with Undo. Nothing when there is nothing to say. From six in
 * the evening the coach is the kind teacher instead: what went well today and one small tip for tomorrow (`TeacherCard`).
 */
export function CoachLine() {
  const minute = useMinute();
  return minute >= EVENING_FROM ? <TeacherCard /> : <AdviceLine minute={minute} />;
}

/** The advice of this minute, in one sentence. */
function AdviceLine({ minute }: { minute: number }) {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const advice = useCoach(minute)[0];
  const act = useAdviceAction();
  if (!advice) return null;
```

- [ ] **Step 4: Change `src/components/DayReview.tsx`**

In `src/components/DayReview.tsx` replace

```tsx
import { useApp } from '../store/AppProvider';
import { Btn, Card, Micro, P, Row } from '../ui/components';
import { C } from '../ui/theme';

/**
 * The end-of-day recap, shown on Today in the evening while its reminder is
 * on (`dayReviewShown`). The model writes it from the day's sentences; with no
 * model to ask, the sentences themselves are the recap, in the person's
 * language, at once, with no wait on a model that is not there. Writing it
 * also stores a one-line day note in memory, which is what lets tomorrow's
 * advice know how today went.
 */
```

with

```tsx
import { useApp } from '../store/AppProvider';
import { Btn, Card, Micro, P, Row } from '../ui/components';
import { C } from '../ui/theme';
import { useTeacherWords } from './TeacherCard';

/**
 * The end-of-day recap, shown on Today in the evening while its reminder is
 * on (`dayReviewShown`). The model writes it from the day's sentences; with no
 * model to ask, the sentences themselves are the recap, in the person's
 * language, at once, with no wait on a model that is not there, as the kind
 * teacher says it: what went well first, the day's numbers, then one small
 * tip for tomorrow. Writing it
 * also stores a one-line day note in memory, which is what lets tomorrow's
 * advice know how today went.
 */
```

In `src/components/DayReview.tsx` replace

```tsx
  const t = makeT(lang);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  const written = dayReviewWritten(app.state.memory, app.today);
```

with

```tsx
  const t = makeT(lang);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const teach = useTeacherWords();

  const written = dayReviewWritten(app.state.memory, app.today);
```

In `src/components/DayReview.tsx` replace

```tsx
    };
  }

  // The day's own sentences, in the person's language: the recap when there is no model to ask.
  function writePlain() {
    setText(dayReviewLines(dayFacts(), t).join(' '));
    app.rememberText(summaryLine(), 'episode', 'auto');
  }
```

with

```tsx
    };
  }

  // The day's own sentences, in the person's language, between the teacher's praise and tip: the recap when there is no model to ask.
  function plain(): string {
    return [teach.lead, ...(teach.best ? [teach.best] : []), ...dayReviewLines(dayFacts(), t), teach.tip].join(' ');
  }

  function writePlain() {
    setText(plain());
    app.rememberText(summaryLine(), 'episode', 'auto');
  }
```

In `src/components/DayReview.tsx` replace

```tsx
      ) : written ? (
        <>
          {/* The day note itself is kept in English for the coach; the person reads the day in their own language. */}
          <P dim>{dayReviewLines(dayFacts(), t).join(' ')}</P>
          <Micro>{t('review_saved')}</Micro>
        </>
      ) : busy ? (
```

with

```tsx
      ) : written ? (
        <>
          {/* The day note itself is kept in English for the coach; the person reads the day in their own language. */}
          <P dim>{plain()}</P>
          <Micro>{t('review_saved')}</Micro>
        </>
      ) : busy ? (
```

- [ ] **Step 5: Create `src/components/TeacherCard.tsx`**

Create `src/components/TeacherCard.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { addDays, atMinute, mondayOf } from '../core/date';
import { dayScore, teacherWords } from '../core/teacher';
import type { ISODate } from '../core/types';
import { isOffDay } from '../core/week';
import { stripSince } from '../core/weekStrip';
import { makeT } from '../i18n';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

/** From this minute of the day the coach on Today is the evening teacher. */
export const EVENING_FROM = 18 * 60;

/**
 * The kind teacher's words for this evening (core/teacher.ts): today as it
 * stands at this minute, yesterday, and this week's earlier days, each a day
 * that counts (not an off day, not before the user started).
 */
export function useTeacherWords() {
  const app = useApp();
  const minute = useMinute();
  const { state, today, abhyas } = app;
  const { routine, meals, slotSkips, water, activities, settings, profile } = state;
  return useMemo(() => {
    const since = stripSince(profile, meals, today);
    const counts = (date: ISODate) => date >= since && !isOffDay(settings.offDays, date);
    const now = atMinute(today, minute);
    const score = (date: ISODate, nowMinutes: number) =>
      dayScore({ date, routine, meals, skips: slotSkips, nowMinutes, abhyas, now, water, activities: activities ?? [], waterGoalMl: settings.waterGoalMl, walkGoalMin: settings.walkGoalMin });
    const earlier: ReturnType<typeof score>[] = [];
    for (let d = mondayOf(today); d < today; d = addDays(d, 1)) if (counts(d)) earlier.push(score(d, 1440));
    const yesterday = addDays(today, -1);
    return teacherWords({ today: score(today, minute), yesterday: counts(yesterday) ? score(yesterday, 1440) : null, earlier }, makeT(profile.lang));
  }, [profile, meals, today, minute, routine, slotSkips, abhyas, water, activities, settings.offDays, settings.waterGoalMl, settings.walkGoalMin]);
}

/**
 * The coach on Today in the evening: "Your coach · this evening", what went
 * well, the best day of the week in the reward ink when today is one, and one
 * small tip for tomorrow.
 */
export function TeacherCard() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const w = useTeacherWords();
  return (
    <Card still>
      <View accessible accessibilityLabel={[t('teach_title'), w.lead, w.best, w.tip].filter(Boolean).join('. ')} style={{ gap: 8 }}>
        <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{t('teach_title')}</Text>
        <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body) }}>{w.lead}</Text>
        {w.best ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.goldSoft, borderRadius: S.radiusXs, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Ionicons name="star" size={14} color={C.goldInk} />
            <Text style={{ flexShrink: 1, color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{w.best}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Ionicons name="arrow-forward" size={16} color={C.textDim} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{w.tip}</Text>
        </View>
      </View>
    </Card>
  );
}
```

- [ ] **Step 6: Create `src/components/useRewards.ts`**

Create `src/components/useRewards.ts`:

```ts
import { useMemo } from 'react';
import { challengeProgress, dailyChallenge, type ChallengeData } from '../core/challenge';
import { useApp } from '../store/AppProvider';

/** What the challenges read, from the store: a new object only when one of its parts changes. */
export function useChallengeData(): ChallengeData {
  const { state, targets, abhyas } = useApp();
  const { meals, water, activities, settings } = state;
  return useMemo(
    () => ({ meals, water, activities: activities ?? [], abhyas, bottleMl: settings.bottleMl, waterGoalMl: settings.waterGoalMl, proteinTarget: targets.proteinG, offDays: settings.offDays ?? [] }),
    [meals, water, activities, abhyas, settings.bottleMl, settings.waterGoalMl, settings.offDays, targets.proteinG],
  );
}

/** Today's challenge and how far it has come; null on an off day. */
export function useTodayChallenge() {
  const { today } = useApp();
  const data = useChallengeData();
  return useMemo(() => {
    const challenge = dailyChallenge(data, today);
    return challenge ? { challenge, progress: challengeProgress(data, challenge) } : null;
  }, [data, today]);
}
```

- [ ] **Step 7: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1839 tests passing; relay 73 tests passing.

- [ ] **Step 8: Commit**

```bash
git add 'src/app/(tabs)/index.tsx' src/components/ChallengeCard.tsx src/components/CoachLine.tsx src/components/DayReview.tsx src/components/TeacherCard.tsx src/components/useRewards.ts
git commit -m "$(cat <<'EOF'
Today shows the day's challenge, and from six in the evening the coach is the kind teacher, as is the evening review when there is no model to write it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Progress as the trophy room; the shield on the Routine tab

Progress gains the shield's gold note under the Streak tile (while there is a streak), the trophy shelf after Lost and To go, and gold stars on perfect days in the calendar; the climb row loses its level, points and badges. The Routine tab's streak line takes the shield and its note, and Progress's routine row counts its streak with the shield too. The Journey page keeps the mountain and the weigh-ins; the level card, the weekly challenge and the badge grid go (their code goes in Task 14).

**Files:**
- Modify: `src/app/(tabs)/abhyas.tsx`
- Modify: `src/app/(tabs)/progress.tsx`
- Modify: `src/app/journey.tsx`
- Create: `src/components/MedalArt.tsx`
- Modify: `src/components/RecordCalendar.tsx`
- Create: `src/components/ShieldNote.tsx`
- Create: `src/components/TrophyShelf.tsx`
- Modify: `src/components/useRewards.ts`
- Modify: `src/core/__tests__/abhyasView.test.ts`
- Modify: `src/core/abhyasView.ts`
- Modify: `src/i18n/index.ts`
- Create: `src/store/usePerfectOn.ts`

**Interfaces:**
- Consumes: `useMedals`'s inputs (`streakRun`, `perfectWeeks`, `challengesDone`, `earnedMedals`, `useGame`), `shelf`, `shelfWords`, `medalFace`, `shieldNote`, `perfectDay`, `dayRecord`, `streakStep`, `fitOn`.
- Produces: `useMedals(): { input: MedalInput; medals: Medal[] }` in `src/components/useRewards.ts`; `MedalArt({ size, face, faded?, shine? })`; `ShieldNote({ covered })`; `TrophyShelf`; `usePerfectOn(): (date: ISODate) => boolean` in `src/store/usePerfectOn.ts`.
- Words: `shield_ready`, `shield_used`, `perfect_day`.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/abhyasView.test.ts` replace

```ts
    it('a new week starts on Monday, and a day still to come this week counts nothing yet', () => {
      // Monday 2 November: yoga and that day's one-off so far; the bike on Tuesday not yet.
      const dentist = item('dentist', { kind: 'once', days: [], date: '2026-11-02' });
      expect(abhyasProgress(data({ items: [yoga, dentist, bike], ticks: [tick('yoga', TODAY)] }), '2026-11-02', at('2026-11-02', '09:00'))).toEqual({ done: 0, total: 2, streak: 0 });
    });

    it('the running timer counts once it reaches the target', () => {
```

with

```ts
    it('a new week starts on Monday, and a day still to come this week counts nothing yet', () => {
      // Monday 2 November: yoga and that day's one-off so far; the bike on Tuesday not yet.
      const dentist = item('dentist', { kind: 'once', days: [], date: '2026-11-02' });
      // Yoga was done Thursday to Saturday, not on Sunday: the shield of that week covers Sunday, so the streak is still 3.
      expect(abhyasProgress(data({ items: [yoga, dentist, bike], ticks: ['2026-10-29', YESTERDAY, TODAY].map((d) => tick('yoga', d)) }), '2026-11-02', at('2026-11-02', '09:00'))).toEqual({ done: 0, total: 2, streak: 3 });
    });

    it('the running timer counts once it reaches the target', () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/abhyasView.test.ts`
Expected: FAIL, because the routine row still counts its streak without the shield: `Tests  1 failed | 29 passed (30)`, the first reads `AssertionError: expected { done: +0, total: 2, streak: +0 } to deeply equal { done: +0, total: 2, streak: 3 }`

- [ ] **Step 3: Change `src/app/(tabs)/abhyas.tsx`**

In `src/app/(tabs)/abhyas.tsx` replace

```tsx
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import { AbhyasItemRow } from '../../components/AbhyasItemRow';
import { AbhyasItemSheet } from '../../components/AbhyasItemSheet';
import { UndoLine, useUndoable } from '../../components/tiles/UndoLine';
import { itemsOn, reorder, streak, type DayStatus } from '../../core/abhyas';
import { abhyasCard, abhyasRow, comingUp, movedPlace, recentDays, repeating, weekdayRuns } from '../../core/abhyasView';
import { formatDayLabel } from '../../core/date';
import type { AbhyasItem } from '../../core/types';
```

with

```tsx
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import { AbhyasItemRow } from '../../components/AbhyasItemRow';
import { AbhyasItemSheet } from '../../components/AbhyasItemSheet';
import { ShieldNote } from '../../components/ShieldNote';
import { UndoLine, useUndoable } from '../../components/tiles/UndoLine';
import { itemsOn, reorder, streakRun, type DayStatus } from '../../core/abhyas';
import { abhyasCard, abhyasRow, comingUp, movedPlace, recentDays, repeating, weekdayRuns } from '../../core/abhyasView';
import { formatDayLabel } from '../../core/date';
import type { AbhyasItem } from '../../core/types';
```

In `src/app/(tabs)/abhyas.tsx` replace

```tsx
  return <AbhyasItemRow row={abhyasRow(app.abhyas, item, app.today, app.today, now)} date={app.today} onEdit={onEdit} />;
}

/** The last 14 days under the streak, "3 of 4 done · 85 min" each; nothing before the first item. */
function LastDays() {
  const app = useApp();
  const now = useNow();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const days = recentDays(app.abhyas, app.today, now);
  const run = streak(app.abhyas, app.today, now);
  if (days.length === 0) return null;

  const dayText = (d: DayStatus) => {
```

with

```tsx
  return <AbhyasItemRow row={abhyasRow(app.abhyas, item, app.today, app.today, now)} date={app.today} onEdit={onEdit} />;
}

/** The last 14 days under the streak and its shield's gold note, "3 of 4 done · 85 min" each; nothing before the first item. */
function LastDays() {
  const app = useApp();
  const now = useNow();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const days = recentDays(app.abhyas, app.today, now);
  const { days: run, covered } = streakRun(app.abhyas, app.today, now, true);
  if (days.length === 0) return null;

  const dayText = (d: DayStatus) => {
```

In `src/app/(tabs)/abhyas.tsx` replace

```tsx
      <SectionHeader title={t('abh_last_14')} />
      <Card>
        {run > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flame-outline" size={18} color={C.accentText} />
            <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{run === 1 ? t('abh_in_row_one') : fill(t('abh_in_row'), { n: run })}</Text>
          </View>
        ) : null}
        <View>
          {days.map((d) => {
```

with

```tsx
      <SectionHeader title={t('abh_last_14')} />
      <Card>
        {run > 0 ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="flame" size={18} color={C.goldInk} />
              <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{run === 1 ? t('abh_in_row_one') : fill(t('abh_in_row'), { n: run })}</Text>
            </View>
            <ShieldNote covered={covered} />
          </>
        ) : null}
        <View>
          {days.map((d) => {
```

- [ ] **Step 4: Change `src/app/(tabs)/progress.tsx`**

The shield note under the Streak tile, the trophy shelf after Lost and To go, and the climb row without its level, points and badges.

In `src/app/(tabs)/progress.tsx` replace

```tsx
import { useGame } from '../../components/useGame';
import { NutrientCard } from '../../components/NutrientCard';
import { RecordCalendar } from '../../components/RecordCalendar';
import { StreakTile } from '../../components/tiles/StreakTile';
import { TileRow } from '../../components/tiles/TileRow';
import { TopBarActions } from '../../components/TopBarActions';
import { WeightTrendCard } from '../../components/WeightTrendCard';
import { abhyasProgress } from '../../core/abhyasView';
import { mondayOf, weekDates } from '../../core/date';
```

with

```tsx
import { useGame } from '../../components/useGame';
import { NutrientCard } from '../../components/NutrientCard';
import { RecordCalendar } from '../../components/RecordCalendar';
import { ShieldNote } from '../../components/ShieldNote';
import { StreakTile } from '../../components/tiles/StreakTile';
import { TileRow } from '../../components/tiles/TileRow';
import { TopBarActions } from '../../components/TopBarActions';
import { TrophyShelf } from '../../components/TrophyShelf';
import { WeightTrendCard } from '../../components/WeightTrendCard';
import { abhyasProgress } from '../../core/abhyasView';
import { mondayOf, weekDates } from '../../core/date';
```

In `src/app/(tabs)/progress.tsx` replace

```tsx
}

/**
 * Five blocks: the one weight card (the smoothed weight, its change, the line
 * and the goal; a tap opens the weight entry); the Streak tile; Lost, To go
 * and this week's full days; the record calendar; and one card with the last
 * seven days' average against the goal, the Abhyas row while the user has a
 * list, today's nutrition a tap away, the climb as one row (the mountain and
 * every badge on the climb page) and History and Charts as links.
 */
function Progress() {
  const app = useApp();
```

with

```tsx
}

/**
 * The trophy room: the one weight card (the smoothed weight, its change, the
 * line and the goal; a tap opens the weight entry); the Streak tile with the
 * shield's gold note under it; Lost, To go and this week's full days; the
 * trophy shelf, every medal earned and the next of each; the record calendar,
 * a gold star on each perfect day; and one card with the last seven days'
 * average against the goal, the routine row while the user has a list,
 * today's nutrition a tap away, the climb as one row (the mountain on the
 * climb page) and History and Charts as links.
 */
function Progress() {
  const app = useApp();
```

In `src/app/(tabs)/progress.tsx` replace

```tsx
  const intake = useMemo(() => recentIntake({ today, since, meals: state.meals, recordOn }), [today, since, state.meals, recordOn]);
  const kg = t('unit_kg');
  const lost = lostWords(g.plan.lostKg);
  const earned = g.badges.filter((b) => b.earned).length;
  const level = t(`level_${g.level.key}`);
  const points = fill(t('points_n'), { n: g.points });
  const badges = fill(t('progress_badges'), { n: earned, of: g.badges.length });
  const avgOff = intake !== null && Math.abs(intake.avg - targets.kcal) > targets.kcal * 0.05;
  const strong = { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' } as const;
```

with

```tsx
  const intake = useMemo(() => recentIntake({ today, since, meals: state.meals, recordOn }), [today, since, state.meals, recordOn]);
  const kg = t('unit_kg');
  const lost = lostWords(g.plan.lostKg);
  const avgOff = intake !== null && Math.abs(intake.avg - targets.kcal) > targets.kcal * 0.05;
  const strong = { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' } as const;
```

In `src/app/(tabs)/progress.tsx` replace

```tsx
        <StreakTile />
        <View style={{ flex: 1 }} />
      </TileRow>

      <Card>
        <StatQuad
```

with

```tsx
        <StreakTile />
        <View style={{ flex: 1 }} />
      </TileRow>
      {app.streakDays > 0 ? <ShieldNote covered={app.streakCovered} /> : null}

      <Card>
        <StatQuad
```

In `src/app/(tabs)/progress.tsx` replace

```tsx
          ]}
        />
      </Card>

      <RecordCalendar />
```

with

```tsx
          ]}
        />
      </Card>

      <TrophyShelf />

      <RecordCalendar />
```

In `src/app/(tabs)/progress.tsx` replace

```tsx
        <Pressable
          onPress={() => router.push('/journey')}
          accessibilityRole="button"
          accessibilityLabel={fill(t('progress_climb_a11y'), { climb: t('journey_title'), level, points, badges })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="flag-outline" size={20} color={C.cyan} />
          <View style={{ flex: 1, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <Text style={strong}>{t('journey_title')}</Text>
              <Micro color={C.textDim}>{`${level} · ${points}`}</Micro>
            </Row>
            <Bar value={g.progress * 100} max={100} color={C.cyan} />
            <Micro color={C.textDim}>{badges}</Micro>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
        </Pressable>
```

with

```tsx
        <Pressable
          onPress={() => router.push('/journey')}
          accessibilityRole="button"
          accessibilityLabel={t('journey_title')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="flag-outline" size={20} color={C.cyan} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={strong}>{t('journey_title')}</Text>
            <Bar value={g.progress * 100} max={100} color={C.cyan} />
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
        </Pressable>
```

- [ ] **Step 5: Change `src/app/journey.tsx`**

The level card, the weekly challenge and the badge grid go; the mountain and the weigh-ins stay.

In `src/app/journey.tsx` replace

```tsx
import { Pressable, Text, View } from 'react-native';
import { toTabs } from '../components/toTabs';
import { useGame } from '../components/useGame';
import { BADGE_ICON } from '../core/game';
import { WeightSheet } from '../components/WeightSheet';
import { formatDayLabel } from '../core/date';
import { lostWords } from '../core/tileText';
import { fill, makeT, numberText } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Divider, Micro, Pill, Row, Screen, SectionHeader, Small } from '../ui/components';
import { Mountain } from '../ui/Mountain';
import { C, F, S } from '../ui/theme';

/** The whole climb: the mountain, the camps, every weigh-in, the level, the week's challenge and every badge. Progress opens it from its climb row; the Weight and Streak tiles are on Progress. */
export default function Journey() {
  const app = useApp();
  const fb = useFeedback();
```

with

```tsx
import { Pressable, Text, View } from 'react-native';
import { toTabs } from '../components/toTabs';
import { useGame } from '../components/useGame';
import { WeightSheet } from '../components/WeightSheet';
import { formatDayLabel } from '../core/date';
import { lostWords } from '../core/tileText';
import { fill, makeT, numberText } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Micro, Row, Screen, SectionHeader, Small } from '../ui/components';
import { Mountain } from '../ui/Mountain';
import { C, F, S } from '../ui/theme';

/** The whole climb: the mountain, the camps and every weigh-in. Progress opens it from its climb row; the Weight and Streak tiles and the medals are on Progress. */
export default function Journey() {
  const app = useApp();
  const fb = useFeedback();
```

In `src/app/journey.tsx` replace

```tsx
  const g = useGame();
  const [weighOpen, setWeighOpen] = useState(false);
  const weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  const earned = g.badges.filter((b) => b.earned);
  const lost = lostWords(g.plan.lostKg);

  return (
    <Screen>
      <Card rail={C.cyan}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro color={C.textDim}>{t('journey_title')}</Micro>
          <Pill label={`⛰ ${t(`level_${g.level.key}`)}`} color={C.cardAlt} textColor={C.cyan} />
        </Row>
        <Mountain tall progress={g.progress} startLabel={`${g.plan.startKg} ${t('unit_kg')}`} nowLabel={`${g.plan.currentKg} ${t('unit_kg')}`} goalLabel={`${g.plan.goalKg} ${t('unit_kg')}`} camps={g.camps} trail={g.trail} />
        <Row style={{ gap: 18 }}>
          <Stat label={t(lost.key)} value={lost.kg} unit={t('unit_kg')} color={g.plan.lostKg > 0 ? C.cyan : undefined} />
```

with

```tsx
  const g = useGame();
  const [weighOpen, setWeighOpen] = useState(false);
  const weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  const lost = lostWords(g.plan.lostKg);

  return (
    <Screen>
      <Card rail={C.cyan}>
        <Micro color={C.textDim}>{t('journey_title')}</Micro>
        <Mountain tall progress={g.progress} startLabel={`${g.plan.startKg} ${t('unit_kg')}`} nowLabel={`${g.plan.currentKg} ${t('unit_kg')}`} goalLabel={`${g.plan.goalKg} ${t('unit_kg')}`} camps={g.camps} trail={g.trail} />
        <Row style={{ gap: 18 }}>
          <Stat label={t(lost.key)} value={lost.kg} unit={t('unit_kg')} color={g.plan.lostKg > 0 ? C.cyan : undefined} />
```

In `src/app/journey.tsx` replace

```tsx
          <Small color={C.accentText}>{t('journey_add_weight')}</Small>
        </Pressable>
      </Card>

      <SectionHeader title={t('level_title')} icon={<Ionicons name="flag-outline" size={13} color={C.textFaint} />} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{t(`level_${g.level.key}`)}</Text>
          <Micro>{fill(t('points_n'), { n: g.level.next ? `${g.points} / ${g.level.next}` : g.points })}</Micro>
        </Row>
        <Bar value={g.level.progress * 100} max={100} color={C.amber} />
        <Micro color={C.textFaint}>{t('xp_how')}</Micro>
      </Card>

      <SectionHeader title={t('challenge_week')} icon={<Ionicons name="trophy-outline" size={13} color={C.textFaint} />} />
      <Card rail={g.challenge.done ? C.green : undefined}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500', flex: 1 }}>{fill(t(`challenge_${g.challenge.key}`), { n: g.challenge.target })}</Text>
          <Micro color={g.challenge.done ? C.green : C.textDim}>{g.challenge.done ? t('challenge_done') : `${g.challenge.n}/${g.challenge.target}`}</Micro>
        </Row>
        <Bar value={g.challenge.n} max={g.challenge.target} color={g.challenge.done ? C.green : C.accent} />
        <Micro color={C.textFaint}>{fill(t('challenge_days_left'), { n: g.challenge.daysLeft })}</Micro>
      </Card>

      <SectionHeader title={t('badges')} meta={`${earned.length}/${g.badges.length}`} icon={<Ionicons name="medal-outline" size={13} color={C.textFaint} />} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {g.badges.map((b) => (
          <View key={b.key} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <Card>
              <Row style={{ gap: 10, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 22, opacity: b.earned ? 1 : 0.35 }}>{BADGE_ICON[b.key] ?? '🏅'}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: b.earned ? C.text : C.textDim, fontSize: F.small, fontWeight: '500' }}>{t(`badge_${b.key}`)}</Text>
                  {b.earned ? <Micro color={C.green}>{t('badge_earned')}</Micro> : <Bar value={b.n} max={b.target} color={C.textFaint} height={3} />}
                  {!b.earned ? <Micro color={C.textFaint}>{`${b.n}/${b.target}`}</Micro> : null}
                </View>
              </Row>
            </Card>
          </View>
        ))}
      </View>

      <SectionHeader title={t('weigh_history')} meta={`${weights.length}`} icon={<Ionicons name="scale-outline" size={13} color={C.textFaint} />} />
      <Card>
```

with

```tsx
          <Small color={C.accentText}>{t('journey_add_weight')}</Small>
        </Pressable>
      </Card>

      <SectionHeader title={t('weigh_history')} meta={`${weights.length}`} icon={<Ionicons name="scale-outline" size={13} color={C.textFaint} />} />
      <Card>
```

- [ ] **Step 6: Create `src/components/MedalArt.tsx`**

Create `src/components/MedalArt.tsx`:

```tsx
import React from 'react';
import { Platform, View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { C } from '../ui/theme';

const ARect = Animated.createAnimatedComponent(Rect);
/** The face's number in the app's own font on the web, where an SVG text otherwise falls back to a serif. */
const FACE_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined;

/**
 * A medal: a ribbon in the action colours, a ring of the reward metal and a
 * face of the reward fill with its number, ½, ★ or ✓ in the reward ink (4.5:1
 * on the fill). A medal still to earn is drawn faded. Look only, hidden from
 * screen readers on the phone and the web: whoever shows it says what it is.
 * With `shine` (0 to 1), a soft band of light crosses the face, for the
 * celebration.
 */
export function MedalArt({ size, face, faded, shine }: { size: number; face: string; faded?: boolean; shine?: SharedValue<number> }) {
  const id = `face-${size}`;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ opacity: faded ? 0.35 : 1 }}>
      <Svg width={size} height={size * 1.1} viewBox="0 0 100 110">
        <Defs>
          <ClipPath id={id}>
            <Circle cx={50} cy={66} r={36} />
          </ClipPath>
        </Defs>
        <Path d="M28 4 L44 38 L56 38 L40 4 Z" fill={C.accent} />
        <Path d="M72 4 L56 38 L44 38 L60 4 Z" fill={C.accentText} />
        <Circle cx={50} cy={66} r={38} fill={C.gold} />
        <Circle cx={50} cy={66} r={30} fill={C.goldSoft} />
        {shine ? (
          <G clipPath={`url(#${id})`}>
            <Shine shine={shine} />
          </G>
        ) : null}
        <SvgText x={50} y={76} textAnchor="middle" fontSize={face.length > 2 ? 22 : 28} fontWeight="600" fontFamily={FACE_FONT} fill={C.goldInk}>
          {face}
        </SvgText>
      </Svg>
    </View>
  );
}

function Shine({ shine }: { shine: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ x: -30 + 130 * shine.get() }));
  return <ARect y={20} width={16} height={100} fill={C.white} opacity={0.35} transform="rotate(20 50 66)" animatedProps={props} />;
}
```

- [ ] **Step 7: Change `src/components/RecordCalendar.tsx`**

A perfect day: the reward fill, its date in the reward ink and a star in place of the dot, and "Perfect day" in its name.

In `src/components/RecordCalendar.tsx` replace

```tsx
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
```

with

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
```

In `src/components/RecordCalendar.tsx` replace

```tsx
import { stripDayLabel, stripSince } from '../core/weekStrip';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useRecordOn } from '../store/useRecordOn';
import { Card } from '../ui/components';
import { STRIP_CHOSEN, STRIP_MARGIN } from '../ui/stripGeometry';
```

with

```tsx
import { stripDayLabel, stripSince } from '../core/weekStrip';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { usePerfectOn } from '../store/usePerfectOn';
import { useRecordOn } from '../store/useRecordOn';
import { Card } from '../ui/components';
import { STRIP_CHOSEN, STRIP_MARGIN } from '../ui/stripGeometry';
```

In `src/components/RecordCalendar.tsx` replace

```tsx
/**
 * The record as a month: under each day the same dot as on Today's week
 * strip (core/progress.ts `monthMarks`), lighter while meals the app filled
 * in are not confirmed, nothing before the person started. The arrows step a
 * month, from the month the person started up to this one; tapping a day
 * opens it on Today. The rows reach over the card's padding
 * (ui/stripGeometry.ts `STRIP_MARGIN`), so a day is a finger wide on a 360
```

with

```tsx
/**
 * The record as a month: under each day the same dot as on Today's week
 * strip (core/progress.ts `monthMarks`), lighter while meals the app filled
 * in are not confirmed, nothing before the person started. A perfect day
 * (core/perfect.ts) is gold: its date in the reward ink on the reward fill,
 * and a star in place of the dot. The arrows step a
 * month, from the month the person started up to this one; tapping a day
 * opens it on Today. The rows reach over the card's padding
 * (ui/stripGeometry.ts `STRIP_MARGIN`), so a day is a finger wide on a 360
```

In `src/components/RecordCalendar.tsx` replace

```tsx
  const router = useRouter();
  const { state, today } = app;
  const recordOn = useRecordOn();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [month, setMonth] = useState(today.slice(0, 7));
```

with

```tsx
  const router = useRouter();
  const { state, today } = app;
  const recordOn = useRecordOn();
  const perfectOn = usePerfectOn();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [month, setMonth] = useState(today.slice(0, 7));
```

In `src/components/RecordCalendar.tsx` replace

```tsx
        </View>
        {weeks.map((week, i) => (
          <View key={`${month}-${i}`} style={{ flexDirection: 'row' }}>
            {week.map((d, j) =>
              d ? (
                <Pressable
                  key={d.date}
                  onPress={() => router.navigate({ pathname: '/', params: { date: d.date } })}
                  accessibilityRole="button"
                  accessibilityLabel={stripDayLabel({ ...d, isToday: d.date === today }, lang)}
                  accessibilityHint={t('progress_day_hint')}
                  style={({ pressed }) => ({
                    flex: 1,
```

with

```tsx
        </View>
        {weeks.map((week, i) => (
          <View key={`${month}-${i}`} style={{ flexDirection: 'row' }}>
            {week.map((d, j) => {
              if (!d) return <View key={`blank-${j}`} style={{ flex: 1 }} />;
              const gold = perfectOn(d.date);
              const label = stripDayLabel({ ...d, isToday: d.date === today }, lang);
              return (
                <Pressable
                  key={d.date}
                  onPress={() => router.navigate({ pathname: '/', params: { date: d.date } })}
                  accessibilityRole="button"
                  accessibilityLabel={gold ? `${label}, ${t('perfect_day')}` : label}
                  accessibilityHint={t('progress_day_hint')}
                  style={({ pressed }) => ({
                    flex: 1,
```

In `src/components/RecordCalendar.tsx` replace

```tsx
                    borderRadius: S.radiusSm,
                    borderWidth: 1,
                    borderColor: d.date === today ? C[STRIP_CHOSEN] : 'transparent',
                    opacity: pressed ? 0.6 : 1,
                  })}>
                  <Text numberOfLines={1} style={{ color: d.date === today ? C.accentText : C.text, fontSize: F.small, lineHeight: lh(F.small, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                    {Number(d.date.slice(8))}
                  </Text>
                  <StripDot mark={d.mark} light={d.light} />
                </Pressable>
              ) : (
                <View key={`blank-${j}`} style={{ flex: 1 }} />
              ),
            )}
          </View>
        ))}
      </View>
```

with

```tsx
                    borderRadius: S.radiusSm,
                    borderWidth: 1,
                    borderColor: d.date === today ? C[STRIP_CHOSEN] : 'transparent',
                    backgroundColor: gold ? C.goldSoft : 'transparent',
                    opacity: pressed ? 0.6 : 1,
                  })}>
                  <Text numberOfLines={1} style={{ color: gold ? C.goldInk : d.date === today ? C.accentText : C.text, fontSize: F.small, lineHeight: lh(F.small, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                    {Number(d.date.slice(8))}
                  </Text>
                  {gold ? <Ionicons name="star" size={10} color={C.goldInk} /> : <StripDot mark={d.mark} light={d.light} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
```

- [ ] **Step 8: Create `src/components/ShieldNote.tsx`**

Create `src/components/ShieldNote.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { shieldNote } from '../core/shield';
import type { ISODate } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';

/**
 * The small gold note under a streak: "Shield ready: one rest day this week
 * won't break your streak.", or "Shield used this week." once the shield
 * covered a day of this week (core/shield.ts). `covered` is the streak's own.
 */
export function ShieldNote({ covered }: { covered: readonly ISODate[] }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const words = t(shieldNote(covered, app.today) === 'used' ? 'shield_used' : 'shield_ready');
  return (
    <View accessible accessibilityLabel={words} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.goldSoft, borderRadius: S.radiusSm, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Ionicons name="shield-checkmark-outline" size={18} color={C.goldInk} />
      <Text style={{ flex: 1, color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{words}</Text>
    </View>
  );
}
```

- [ ] **Step 9: Create `src/components/TrophyShelf.tsx`**

Create `src/components/TrophyShelf.tsx`:

```tsx
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { medalFace, shelf, shelfWords } from '../core/medals';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { C, F, lh, MICRO } from '../ui/theme';
import { MedalArt } from './MedalArt';
import { useMedals } from './useRewards';

/**
 * The trophy shelf on Progress: every medal earned (the kilos as the highest
 * one, a job's perfect weeks as one with how many), then the next medal of
 * each track, faded, with how far it is ("9 to go"). Three to a row; each
 * place is read as one line.
 */
export function TrophyShelf() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const { input, medals } = useMedals();
  const tiles = useMemo(() => shelf(input), [input]);
  return (
    <Card>
      <Text accessibilityRole="header" style={[MICRO, { color: C.textDim }]}>
        {`${t('shelf_title')} · ${fill(t('shelf_count'), { n: medals.length })}`}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {tiles.map((tile) => {
          const w = shelfWords(tile, t);
          return (
            <View key={tile.key} accessible accessibilityLabel={[w.label, w.sub].filter(Boolean).join(', ')} style={{ width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 2 }}>
              <MedalArt size={56} face={medalFace(tile.track, tile.n)} faded={!tile.earned} />
              <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', textAlign: 'center' }}>{w.label}</Text>
              {w.sub ? <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), textAlign: 'center' }}>{w.sub}</Text> : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}
```

- [ ] **Step 10: Change `src/components/useRewards.ts`**

Replace the whole `src/components/useRewards.ts` with:

```ts
import { useMemo } from 'react';
import { streakRun } from '../core/abhyas';
import { challengeProgress, challengesDone, dailyChallenge, type ChallengeData } from '../core/challenge';
import { earnedMedals, type MedalInput } from '../core/medals';
import { perfectWeeks } from '../core/perfect';
import { useApp } from '../store/AppProvider';
import { useGame } from './useGame';

/** What the challenges read, from the store: a new object only when one of its parts changes. */
export function useChallengeData(): ChallengeData {
  const { state, targets, abhyas } = useApp();
  const { meals, water, activities, settings } = state;
  return useMemo(
    () => ({ meals, water, activities: activities ?? [], abhyas, bottleMl: settings.bottleMl, waterGoalMl: settings.waterGoalMl, proteinTarget: targets.proteinG, offDays: settings.offDays ?? [] }),
    [meals, water, activities, abhyas, settings.bottleMl, settings.waterGoalMl, settings.offDays, targets.proteinG],
  );
}

/** Today's challenge and how far it has come; null on an off day. */
export function useTodayChallenge() {
  const { today } = useApp();
  const data = useChallengeData();
  return useMemo(() => {
    const challenge = dailyChallenge(data, today);
    return challenge ? { challenge, progress: challengeProgress(data, challenge) } : null;
  }, [data, today]);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Everything the medals read, from the store, and the medals earned: both
 * streaks over the whole journey with the shield (the routine's on finished
 * timers, so a medal is earned when a timer stops), the kilos from the very
 * first start to the weight Progress shows, the perfect weeks, and the
 * challenges done. Shared by the trophy shelf and the celebration.
 */
export function useMedals() {
  const app = useApp();
  const { state, today, lifetimeStreakDays, lifetimeBestStreakDays } = app;
  const { abhyasItems: items, abhyasTicks: ticks, abhyasSessions: sessions, profile, celebrated } = state;
  const g = useGame();
  const data = useChallengeData();
  const done = useMemo(() => challengesDone(data, today), [data, today]);
  const routine = useMemo(() => streakRun({ items, ticks, sessions, running: null }, today, new Date(0), true), [items, ticks, sessions, today]);
  const weeks = useMemo(() => perfectWeeks({ items, ticks, sessions }, today).map((w) => ({ ...w, name: items.find((i) => i.id === w.itemId)?.name ?? '' })), [items, ticks, sessions, today]);
  return useMemo(() => {
    const firstStart = profile.firstStartWeightKg ?? g.plan.startKg;
    const input: MedalInput = {
      meals: { now: lifetimeStreakDays, best: lifetimeBestStreakDays },
      routine: items.length > 0 ? { now: routine.days, best: routine.best } : null,
      lostKg: round1(firstStart - g.plan.currentKg),
      totalKg: round1(firstStart - profile.goalWeightKg),
      weeks,
      challengesDone: done,
      celebrated,
    };
    return { input, medals: earnedMedals(input) };
  }, [profile.firstStartWeightKg, profile.goalWeightKg, g.plan.startKg, g.plan.currentKg, lifetimeStreakDays, lifetimeBestStreakDays, items.length, routine, weeks, done, celebrated]);
}
```

- [ ] **Step 11: Change `src/core/abhyasView.ts`**

In `src/core/abhyasView.ts` replace

```ts
import { ABHYAS_ICONS, dayStatus, draftProblem, firstDate, isDone, itemsOn, MAX_TARGET_MIN, minutesOn, streak, type AbhyasData, type AbhyasDraft, type DayStatus } from './abhyas';
import { addDays, localDate, mondayOf } from './date';
import type { AbhyasItem, ISODate } from './types';
```

with

```ts
import { ABHYAS_ICONS, dayStatus, draftProblem, firstDate, isDone, itemsOn, MAX_TARGET_MIN, minutesOn, streakRun, type AbhyasData, type AbhyasDraft, type DayStatus } from './abhyas';
import { addDays, localDate, mondayOf } from './date';
import type { AbhyasItem, ISODate } from './types';
```

In `src/core/abhyasView.ts` replace

```ts
}

/**
 * Progress's Abhyas row: this week so far, Monday to today, as items done of
 * items on those days ("18 of 21 this week"), and the streak. A day still to
 * come this week counts nothing yet. Null while nothing is on the list.
 */
export function abhyasProgress(data: AbhyasData, today: ISODate, now: Date): { done: number; total: number; streak: number } | null {
  if (!data.items.some((i) => !i.archivedAt)) return null;
```

with

```ts
}

/**
 * Progress's routine row: this week so far, Monday to today, as items done of
 * items on those days ("18 of 21 this week"), and the streak, with its shield.
 * A day still to come this week counts nothing yet. Null while nothing is on
 * the list.
 */
export function abhyasProgress(data: AbhyasData, today: ISODate, now: Date): { done: number; total: number; streak: number } | null {
  if (!data.items.some((i) => !i.archivedAt)) return null;
```

In `src/core/abhyasView.ts` replace

```ts
    done += s.done;
    total += s.total;
  }
  return { done, total, streak: streak(data, today, now) };
}

/**
```

with

```ts
    done += s.done;
    total += s.total;
  }
  return { done, total, streak: streakRun(data, today, now, true).days };
}

/**
```

- [ ] **Step 12: Add the words to `src/i18n/index.ts`**

Add 3 keys at the end of each of the three dicts. First check that none is there yet:

Run: `grep -nE "^  (shield_ready|shield_used|perfect_day):" src/i18n/index.ts`
Expected: no output.

In `src/i18n/index.ts` replace

```ts
  quick_food: 'Food',
  quick_water_a11y: 'Add {ml} ml of water',
  quick_walk_a11y: 'Add a {min}-minute walk',
};

const mr: Dict = {
```

with

```ts
  quick_food: 'Food',
  quick_water_a11y: 'Add {ml} ml of water',
  quick_walk_a11y: 'Add a {min}-minute walk',
  shield_ready: "Shield ready: one rest day this week won't break your streak.",
  shield_used: 'Shield used this week.',
  perfect_day: 'Perfect day',
};

const mr: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  quick_food: 'जेवण',
  quick_water_a11y: '{ml} ml पाणी जोडा',
  quick_walk_a11y: '{min} मिनिटांचं चालणं जोडा',
};

const hi: Dict = {
```

with

```ts
  quick_food: 'जेवण',
  quick_water_a11y: '{ml} ml पाणी जोडा',
  quick_walk_a11y: '{min} मिनिटांचं चालणं जोडा',
  shield_ready: 'ढाल तयार: या आठवड्यात एक दिवस विश्रांती घेतली तरी मालिका तुटणार नाही.',
  shield_used: 'या आठवड्याची ढाल वापरली.',
  perfect_day: 'सोनेरी दिवस',
};

const hi: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  quick_food: 'खाना',
  quick_water_a11y: '{ml} ml पानी जोड़ें',
  quick_walk_a11y: '{min} मिनट की सैर जोड़ें',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

with

```ts
  quick_food: 'खाना',
  quick_water_a11y: '{ml} ml पानी जोड़ें',
  quick_walk_a11y: '{min} मिनट की सैर जोड़ें',
  shield_ready: 'ढाल तैयार: इस हफ़्ते एक दिन आराम से भी सिलसिला नहीं टूटेगा.',
  shield_used: 'इस हफ़्ते की ढाल लग चुकी.',
  perfect_day: 'सुनहरा दिन',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

- [ ] **Step 13: Create `src/store/usePerfectOn.ts`**

Create `src/store/usePerfectOn.ts`:

```ts
import { useCallback, useMemo } from 'react';
import { dayStatus } from '../core/abhyas';
import { fitOn } from '../core/menu';
import { perfectDay } from '../core/perfect';
import { dayRecord, mealsByDate, streakStep } from '../core/record';
import type { ISODate } from '../core/types';
import { useApp } from './AppProvider';

// Finished timers only, so the calendar does not change while a timer runs.
const NO_TIMER = new Date(0);

/**
 * Whether a day was a perfect one (`perfectDay`), from the store: the record
 * on the menu as it shows, by the streak's rule at the user's safe minimum,
 * the routine list's day, and the water drunk. The calendar on Progress puts a
 * gold star on it.
 */
export function usePerfectOn(): (date: ISODate) => boolean {
  const { state, today, menuOn, abhyas } = useApp();
  const { meals, routine, slotSkips, settings, water, profile } = state;
  const byDate = useMemo(() => mealsByDate(meals), [meals]);
  const waterBy = useMemo(() => {
    const out = new Map<ISODate, number>();
    for (const w of water) out.set(w.date, (out.get(w.date) ?? 0) + w.ml);
    return out;
  }, [water]);
  const floor = fitOn(profile, routine, today).floor;
  const offDays = settings.offDays;
  const goal = settings.waterGoalMl;
  return useCallback(
    (date: ISODate) => {
      const dayMeals = byDate.get(date) ?? [];
      const record = dayRecord({ date, today, menu: menuOn(date), routine, meals: dayMeals, skips: slotSkips, offDays: offDays ?? [] });
      return perfectDay({ step: streakStep(record.state, dayMeals, floor), jobs: dayStatus(abhyas, date, NO_TIMER), waterMl: waterBy.get(date) ?? 0, waterGoalMl: goal });
    },
    [byDate, today, menuOn, routine, slotSkips, offDays, floor, abhyas, waterBy, goal],
  );
}
```

- [ ] **Step 14: Run the tests**

Run: `npx vitest run src/core/__tests__/abhyasView.test.ts`
Expected: PASS, 30 tests.

- [ ] **Step 15: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1839 tests passing; relay 73 tests passing.

- [ ] **Step 16: Commit**

```bash
git add 'src/app/(tabs)/abhyas.tsx' 'src/app/(tabs)/progress.tsx' src/app/journey.tsx src/components/MedalArt.tsx src/components/RecordCalendar.tsx src/components/ShieldNote.tsx src/components/TrophyShelf.tsx src/components/useRewards.ts src/core/__tests__/abhyasView.test.ts src/core/abhyasView.ts src/i18n/index.ts src/store/usePerfectOn.ts
git commit -m "$(cat <<'EOF'
Progress is the trophy room: the shield's note under the streak, a trophy shelf with every medal earned and the next of each, and gold stars on perfect days; the Routine tab's streak shows its shield, and the climb page keeps the mountain and the weigh-ins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: The celebration

A medal fills the screen in the reward fill: the medal with a soft shine crossing it, three sparks rising, "New medal", its title and line, a light tap (`fb.haptic('light')`, expo-haptics `impactAsync(ImpactFeedbackStyle.Light)`; silent on the web, where iPhone Safari has no vibration), and Keep going or See my medals. Reduce motion leaves it still. Today's challenge done is a smaller sheet. The seed and the tap run from effects whose dependencies are complete, so the old `eslint-disable` lines go.

**Files:**
- Modify: `src/components/Celebration.tsx`
- Modify: `src/i18n/index.ts`

**Interfaces:**
- Consumes: `nextWin`, `medalFace`, `medalWords`, `challengesDone`, `challengeText`, `useMedals`, `useTodayChallenge`, `useChallengeData`, `MedalArt`, `useLoop`, `useReducedMotion`.
- Produces: `Celebration` (same mount point on Today).
- Words: `celebrate_keep_going`, `celebrate_see_medals`.

- [ ] **Step 1: Change `src/components/Celebration.tsx`**

Replace the whole `src/components/Celebration.tsx` with:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Modal, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { challengesDone, challengeText } from '../core/challenge';
import { medalFace, medalWords, nextWin, type Medal } from '../core/medals';
import { fill, makeT } from '../i18n';
import { useFeedback, useUndoShowing } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, lh, S, TITLE_WEIGHT } from '../ui/theme';
import { useAddSheetOpen } from './AddSheet';
import { MedalArt } from './MedalArt';
import { useLoop } from './tiles/motion';
import { useChallengeData, useMedals, useTodayChallenge } from './useRewards';

/**
 * A win, made to feel like one. A medal earned fills the screen in the
 * reward colours: the medal with a soft shine crossing it, a few sparks
 * rising, its name and a word of what it took, a light tap on the phone, and
 * Keep going or See my medals. Today's challenge done is a smaller one, a
 * sheet. One at a time, each once (core/medals.ts `nextWin`); the first run
 * marks everything already earned as seen. With reduce motion on nothing
 * moves. Mounted on Today; says nothing when there is nothing new. A win
 * that lands from the add sheet waits until the sheet has closed, its "Save
 * as my meal?" too, and a toast with Undo, or an "… · Undo" line, stays
 * uncovered until it has gone (five seconds at most), so its Undo can still
 * be reached.
 */
export function Celebration() {
  const app = useApp();
  const { haptic } = useFeedback();
  const { markCelebrated } = app;
  const { medals } = useMedals();
  const today = useTodayChallenge();
  const sheetOpen = useAddSheetOpen();
  const undoShowing = useUndoShowing();
  const { seed, next } = nextWin({ medals, challengeDone: !!today?.progress.done, today: app.today, celebrated: app.state.celebrated, waiting: sheetOpen || undoShowing });
  const nextId = next?.id;

  // First run: everything already earned counts as seen, so nobody opens the app to ten celebrations. Marking is idempotent,
  // and once the ids are in there is no seed, so this runs once.
  useEffect(() => {
    if (seed) markCelebrated(seed);
  }, [seed, markCelebrated]);

  // A light tap when a new win appears, not on every render of the same one.
  useEffect(() => {
    if (nextId) haptic('light');
  }, [nextId, haptic]);

  if (!next) return null;
  const done = () => markCelebrated([next.id]);
  return next.kind === 'medal' ? <MedalWin medal={next.medal} onDone={done} /> : <ChallengeWin onDone={done} />;
}

/** The full-screen celebration of a medal. */
function MedalWin({ medal, onDone }: { medal: Medal; onDone: () => void }) {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = makeT(app.state.profile.lang);
  const reduce = useReducedMotion();
  const shine = useLoop(!reduce, 3200);
  const words = medalWords(medal, t);
  return (
    <Modal visible animationType="fade" onRequestClose={onDone}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: C.goldSoft, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: S.gutter, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        {reduce ? null : <Sparks loop={shine} />}
        <MedalArt size={150} face={medalFace(medal.track, medal.n)} shine={reduce ? undefined : shine} />
        <Text style={{ color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{t('medal_new')}</Text>
        <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: TITLE_WEIGHT, textAlign: 'center' }}>
          {words.title}
        </Text>
        <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body), textAlign: 'center', maxWidth: 320 }}>{words.line}</Text>
        <View style={{ alignSelf: 'stretch', maxWidth: 320, width: '100%', marginHorizontal: 'auto', gap: 8, marginTop: 8 }}>
          <Btn label={t('celebrate_keep_going')} onPress={onDone} />
          <Btn
            tone="ghost"
            label={t('celebrate_see_medals')}
            onPress={() => {
              onDone();
              router.push('/progress');
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Where the three sparks rise from, across the screen, and how far into the loop each starts. */
const SPARKS = [
  { left: '22%', top: '62%', phase: 0 },
  { left: '72%', top: '58%', phase: 0.33 },
  { left: '50%', top: '70%', phase: 0.66 },
] as const;

/** A few sparks of the reward metal rising and fading, each a third of the loop after the one before. */
function Sparks({ loop }: { loop: SharedValue<number> }) {
  return (
    <>
      {SPARKS.map((s) => (
        <Spark key={s.left} left={s.left} top={s.top} phase={s.phase} loop={loop} />
      ))}
    </>
  );
}

function Spark({ left, top, phase, loop }: { left: `${number}%`; top: `${number}%`; phase: number; loop: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = (loop.get() + phase) % 1;
    return { opacity: 0.8 * (1 - p), transform: [{ translateY: -120 * p }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left, top, width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold }, style]} />;
}

/** The smaller celebration of today's challenge done: a sheet. */
function ChallengeWin({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const today = useTodayChallenge();
  const data = useChallengeData();
  if (!today) return null;
  const n = challengesDone(data, app.today);
  return (
    <Sheet open title={t('chal_done_title')} onClose={onDone}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.goldSoft, borderRadius: S.radiusSm, padding: 14 }}>
        <Ionicons name="checkmark-circle" size={28} color={C.goldInk} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{challengeText(today.challenge, t)}</Text>
          <Text style={{ color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small) }}>{n <= 1 ? t('chal_count_one') : fill(t('chal_count'), { n })}</Text>
        </View>
      </View>
      <Btn label={t('celebrate_keep_going')} onPress={onDone} />
    </Sheet>
  );
}
```

- [ ] **Step 2: Add the words to `src/i18n/index.ts`**

Add 2 keys at the end of each of the three dicts. First check that none is there yet:

Run: `grep -nE "^  (celebrate_keep_going|celebrate_see_medals):" src/i18n/index.ts`
Expected: no output.

In `src/i18n/index.ts` replace

```ts
  shield_ready: "Shield ready: one rest day this week won't break your streak.",
  shield_used: 'Shield used this week.',
  perfect_day: 'Perfect day',
};

const mr: Dict = {
```

with

```ts
  shield_ready: "Shield ready: one rest day this week won't break your streak.",
  shield_used: 'Shield used this week.',
  perfect_day: 'Perfect day',
  celebrate_keep_going: 'Keep going',
  celebrate_see_medals: 'See my medals',
};

const mr: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  shield_ready: 'ढाल तयार: या आठवड्यात एक दिवस विश्रांती घेतली तरी मालिका तुटणार नाही.',
  shield_used: 'या आठवड्याची ढाल वापरली.',
  perfect_day: 'सोनेरी दिवस',
};

const hi: Dict = {
```

with

```ts
  shield_ready: 'ढाल तयार: या आठवड्यात एक दिवस विश्रांती घेतली तरी मालिका तुटणार नाही.',
  shield_used: 'या आठवड्याची ढाल वापरली.',
  perfect_day: 'सोनेरी दिवस',
  celebrate_keep_going: 'असंच चालू ठेवा',
  celebrate_see_medals: 'माझी पदकं पाहा',
};

const hi: Dict = {
```

In `src/i18n/index.ts` replace

```ts
  shield_ready: 'ढाल तैयार: इस हफ़्ते एक दिन आराम से भी सिलसिला नहीं टूटेगा.',
  shield_used: 'इस हफ़्ते की ढाल लग चुकी.',
  perfect_day: 'सुनहरा दिन',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

with

```ts
  shield_ready: 'ढाल तैयार: इस हफ़्ते एक दिन आराम से भी सिलसिला नहीं टूटेगा.',
  shield_used: 'इस हफ़्ते की ढाल लग चुकी.',
  perfect_day: 'सुनहरा दिन',
  celebrate_keep_going: 'ऐसे ही चलते रहें',
  celebrate_see_medals: 'मेरे पदक देखें',
};

const DICTS: Record<Lang, Dict> = { en, mr, hi };
```

- [ ] **Step 3: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1839 tests passing; relay 73 tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/components/Celebration.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
A medal earned fills the screen in gold with a soft shine, a few sparks and a light tap, still with reduce motion on, and today's challenge done gets a smaller sheet with the number done so far

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Retire the points, camps, badges and weekly challenge

Nothing shows them any more, so their code and words go: `game.ts` keeps the climb (`climbTrail`, `gameView` with the plan, the progress, the camps and the trail), `useGame` follows, and `doneCount` (only the points read it) goes from `abhyas.ts`. The ids they were celebrated under stay in `celebrated`, unread except the streak and kilo badges, which count as medals (Task 6). The tests that were about points, levels, badges and the weekly challenge go; the chapter tests that guarded the streak badges guard the streak medals instead.

**Files:**
- Modify: `src/components/ChapterSheet.tsx`
- Modify: `src/components/useGame.ts`
- Modify: `src/core/__tests__/abhyas.test.ts`
- Modify: `src/core/__tests__/chapter.test.ts`
- Modify: `src/core/__tests__/digits.test.ts`
- Modify: `src/core/__tests__/game.test.ts`
- Modify: `src/core/abhyas.ts`
- Modify: `src/core/chapter.ts`
- Modify: `src/core/game.ts`
- Modify: `src/core/types.ts`
- Modify: `src/i18n/index.ts` (by a sweep)

**Interfaces:**
- Consumes: `shownPlan`, `chapterSince`.
- Produces: `climbTrail(weights, startKg, goalKg)`, `type GameView = { plan: Plan; progress: number; camps: { p: number; label: string }[]; trail: number[] }`, `gameView(o: { state: Pick<AppState, 'profile' | 'weights'>; targets: Targets; today: ISODate }): GameView`.
- Removes: `xp`, `level`, `keptLevel`, `LEVELS`, `badges`, `Badge`, `CHALLENGES`, `weeklyChallenge`, `BADGE_ICON`, the game's `Win` and `nextWin`, `GameInput`, `doneCount`, and the words `celebrate_title|badge|level|challenge|keep|see|footer`, `xp_how`, `badges`, `badge_*`, `level_*`, `challenge_*`, `points_n`, `progress_badges`, `progress_climb_a11y`.

- [ ] **Step 1: Change the tests**

In `src/core/__tests__/abhyas.test.ts` replace

```ts
  archive,
  closeStale,
  dayStatus,
  doneCount,
  draftProblem,
  isAbhyasSession,
  isDone,
```

with

```ts
  archive,
  closeStale,
  dayStatus,
  draftProblem,
  isAbhyasSession,
  isDone,
```

In `src/core/__tests__/abhyas.test.ts` replace

```ts
  });
});

describe('doneCount', () => {
  it('counts each item done on each day up to today, by tick or by minutes, once', () => {
    const d = data({
      items: [item('yoga'), item('read', { targetMin: 20 })],
      ticks: [tick('yoga', '2026-10-26'), tick('yoga', TODAY), tick('read', '2026-10-27')],
      sessions: [session('read', '2026-10-26', 25), session('read', '2026-10-27', 25), session('read', '2026-10-28', 10)],
    });
    // Monday both, Tuesday reading (ticked and timed: once), today yoga; Wednesday's ten minutes are short of the target.
    expect(doneCount(d, TODAY)).toBe(4);
    expect(doneCount({ ...d, ticks: [...d.ticks, tick('yoga', '2026-11-01')] }, TODAY)).toBe(4);
    expect(doneCount(data(), TODAY)).toBe(0);
  });

  it('leaves out a tick for a day the item is not on, and the running timer until it stops', () => {
    const d = data({ items: [item('swim', { days: [1], targetMin: 10 })], ticks: [tick('swim', TODAY)], running: start('swim', at('2026-10-26', '07:00')) });
    expect(doneCount(d, TODAY)).toBe(0);
  });
});

describe('the list', () => {
  const now = at(TODAY, '09:00');
  const draft = (extra: Partial<AbhyasDraft> = {}): AbhyasDraft => ({ name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: ALL_WEEK, times: [], ...extra });
```

with

```ts
  });
});

describe('the list', () => {
  const now = at(TODAY, '09:00');
  const draft = (extra: Partial<AbhyasDraft> = {}): AbhyasDraft => ({ name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: ALL_WEEK, times: [], ...extra });
```

In `src/core/__tests__/abhyas.test.ts` replace

```ts
    expect(withStaleClosed(none, NOW)).toBe(none);
  });

  it('a timer stopped exactly at the target leaves the item done, as it was while the timer ran, and the points count it', () => {
    const s = withStarted(state(), 'study', at(TODAY, '17:30'));
    const view = (x: AbhyasState): AbhyasData => ({ items: x.abhyasItems, ticks: x.abhyasTicks, sessions: x.abhyasSessions, running: x.abhyasRunning });
    expect(dayStatus(view(s), TODAY, NOW)).toEqual({ total: 2, done: 1, minutes: 30 });
```

with

```ts
    expect(withStaleClosed(none, NOW)).toBe(none);
  });

  it('a timer stopped exactly at the target leaves the item done, as it was while the timer ran', () => {
    const s = withStarted(state(), 'study', at(TODAY, '17:30'));
    const view = (x: AbhyasState): AbhyasData => ({ items: x.abhyasItems, ticks: x.abhyasTicks, sessions: x.abhyasSessions, running: x.abhyasRunning });
    expect(dayStatus(view(s), TODAY, NOW)).toEqual({ total: 2, done: 1, minutes: 30 });
```

In `src/core/__tests__/abhyas.test.ts` replace

```ts
    expect(stopped.abhyasSessions.map((x) => x.minutes)).toEqual([30]);
    expect(dayStatus(view(stopped), TODAY, NOW)).toEqual({ total: 2, done: 1, minutes: 30 });
    expect(isDone(stopped.abhyasItems[1], TODAY, [], 30)).toBe(true);
    expect(doneCount(view(stopped), TODAY)).toBe(1);
  });

  it('a timer already stopped on another device keeps that first stop when it is stopped here too', () => {
```

with

```ts
    expect(stopped.abhyasSessions.map((x) => x.minutes)).toEqual([30]);
    expect(dayStatus(view(stopped), TODAY, NOW)).toEqual({ total: 2, done: 1, minutes: 30 });
    expect(isDone(stopped.abhyasItems[1], TODAY, [], 30)).toBe(true);
  });

  it('a timer already stopped on another device keeps that first stop when it is stopped here too', () => {
```

In `src/core/__tests__/chapter.test.ts` replace

```ts
import { describe, expect, it } from 'vitest';
import { chapterDays, chapterSince, chapterStreaks, newChapter } from '../chapter';
import { gameView, nextWin } from '../game';
import type { DayMenu } from '../menu';
import { dailyTargets, KCAL_FLOOR } from '../nutrition';
import { planFrom, shownPlan } from '../plan';
```

with

```ts
import { describe, expect, it } from 'vitest';
import { chapterDays, chapterSince, chapterStreaks, newChapter } from '../chapter';
import { gameView } from '../game';
import { earnedMedals, MEDALS_SEEDED, nextWin } from '../medals';
import type { DayMenu } from '../menu';
import { dailyTargets, KCAL_FLOOR } from '../nutrition';
import { planFrom, shownPlan } from '../plan';
```

In `src/core/__tests__/chapter.test.ts` replace

```ts
    celebrated: [],
    settings: { waterGoalMl: 3000, weighDay: 0, offDays: [] },
  };
  const view = (p: Profile, abhyasDone = 0) => gameView({ state: { ...state, profile: p }, targets, today: TODAY, streakDays: 3, bestStreakDays: 3, lifetime: { streakDays: 3, bestStreakDays: 3 }, abhyasDone });
  const chapter = { ...profile, ...newChapter(profile, weights.filter((w) => w.date <= '2026-10-25'), '2026-10-26') };

  it('counts the Abhyas items done over the whole journey, as it counts meals, so a new chapter takes none of their points away', () => {
    expect(view(profile, 2).points - view(profile).points).toBe(2 * 15);
    expect(view(chapter, 2).points).toBe(view(profile, 2).points);
  });

  it('counts Lost, To go and the climb from the chapter\'s start, at the weight Progress shows', () => {
    const shown = shownWeight(weights, TODAY)!.kg;
```

with

```ts
    celebrated: [],
    settings: { waterGoalMl: 3000, weighDay: 0, offDays: [] },
  };
  const view = (p: Profile) => gameView({ state: { ...state, profile: p }, targets, today: TODAY });
  const chapter = { ...profile, ...newChapter(profile, weights.filter((w) => w.date <= '2026-10-25'), '2026-10-26') };

  it('counts Lost, To go and the climb from the chapter\'s start, at the weight Progress shows', () => {
    const shown = shownWeight(weights, TODAY)!.kg;
```

In `src/core/__tests__/chapter.test.ts` replace

```ts
    expect(view(profile).trail).toHaveLength(4);
  });

  it('starts the weekly challenge again from the chapter\'s first day', () => {
    expect(view(profile).challenge.n).toBe(4);
    expect(view(chapter).challenge.n).toBe(3);
  });

  it('keeps the kilo badges counting from the very first start, so a new chapter takes none away', () => {
    const kg = (g: ReturnType<typeof view>) => Object.fromEntries(g.badges.map((b) => [b.key, b.earned]));
    expect(kg(view(profile)).kg_5).toBe(true);
    expect(kg(view(chapter)).kg_5).toBe(true);
  });

  it('ignores a chapter start after today (a clock ahead on another device): the challenge and the trail are as without one', () => {
    const ahead = { ...profile, chapterStart: '2026-11-05' };
    expect(view(ahead).challenge.n).toBe(view(profile).challenge.n);
    expect(view(ahead).trail).toEqual(view(profile).trail);
  });
```

with

```ts
    expect(view(profile).trail).toHaveLength(4);
  });

  it('ignores a chapter start after today (a clock ahead on another device): the trail is as without one', () => {
    const ahead = { ...profile, chapterStart: '2026-11-05' };
    expect(view(ahead).trail).toEqual(view(profile).trail);
  });
```

In `src/core/__tests__/chapter.test.ts` replace

```ts
    const g = view(ahead);
    const none = view(profile);
    expect(g.plan.startKg).toBe(92);
    expect({ plan: g.plan, progress: g.progress, camps: g.camps, trail: g.trail, points: g.points }).toEqual({ plan: none.plan, progress: none.progress, camps: none.camps, trail: none.trail, points: none.points });
  });
});
```

with

```ts
    const g = view(ahead);
    const none = view(profile);
    expect(g.plan.startKg).toBe(92);
    expect(g).toEqual(none);
  });
});
```

In `src/core/__tests__/chapter.test.ts` replace

```ts
  const state = { profile, weights: [{ date: '2026-10-27', kg: 84.5 }], meals, water: [], sleep: [], steps: [], workouts: [], celebrated: [], settings: { waterGoalMl: 3000, weighDay: 0, offDays: [] } };
  const game = (p: Profile) => {
    const s = chapterStreaks({ ...record, chapterStart: p.chapterStart });
    return { s, g: gameView({ state: { ...state, profile: p }, targets, today: TODAY, streakDays: s.days, bestStreakDays: s.best, lifetime: { streakDays: s.lifetimeDays, bestStreakDays: s.lifetimeBest }, abhyasDone: 0 }) };
  };
  const chapter = { ...profile, ...newChapter(profile, state.weights, TODAY) };
```

with

```ts
  const state = { profile, weights: [{ date: '2026-10-27', kg: 84.5 }], meals, water: [], sleep: [], steps: [], workouts: [], celebrated: [], settings: { waterGoalMl: 3000, weighDay: 0, offDays: [] } };
  const game = (p: Profile) => {
    const s = chapterStreaks({ ...record, chapterStart: p.chapterStart });
    const medals = earnedMedals({ meals: { now: s.lifetimeDays, best: s.lifetimeBest }, routine: null, lostKg: 0, totalKg: 0, weeks: [], challengesDone: 0, celebrated: [MEDALS_SEEDED] });
    return { s, g: gameView({ state: { ...state, profile: p }, targets, today: TODAY }), medals };
  };
  const chapter = { ...profile, ...newChapter(profile, state.weights, TODAY) };
```

In `src/core/__tests__/chapter.test.ts` replace

```ts
    expect(game(chapter).s).toEqual({ days: 0, best: 0, lifetimeDays: 60, lifetimeBest: 60 });
  });

  it('keeps the points of a sixty-day streak from before the chapter, and its streak badges', () => {
    const before = game(profile).g;
    const after = game(chapter).g;
    expect(after.points).toBe(before.points);
    const earned = (g: typeof after) => g.badges.filter((b) => b.earned).map((b) => b.key);
    expect(earned(after)).toEqual(earned(before));
    expect(earned(after)).toEqual(expect.arrayContaining(['streak_7', 'streak_30']));
  });

  it('a seven-day badge never celebrated before the chapter is still celebrated after it', () => {
    const { g } = game(chapter);
    const ids = nextWin({ earned: g.badges.filter((b) => b.earned).map((b) => b.key), level: g.level.key, challenge: g.challenge, celebrated: null }).seed!;
    const celebrated = ids.filter((id) => id !== 'badge:streak_7');
    expect(nextWin({ earned: g.badges.filter((b) => b.earned).map((b) => b.key), level: g.level.key, challenge: g.challenge, celebrated }).next?.id).toBe('badge:streak_7');
  });

  it('a chapter start after today limits nothing', () => {
```

with

```ts
    expect(game(chapter).s).toEqual({ days: 0, best: 0, lifetimeDays: 60, lifetimeBest: 60 });
  });

  it('keeps the streak medals of a sixty-day streak from before the chapter', () => {
    const ids = (m: { id: string }[]) => m.map((x) => x.id);
    expect(ids(game(chapter).medals)).toEqual(ids(game(profile).medals));
    expect(ids(game(chapter).medals)).toEqual(['medal:meals:3', 'medal:meals:7', 'medal:meals:21', 'medal:meals:30']);
  });

  it('a seven-day medal never celebrated before the chapter is still celebrated after it', () => {
    const { medals } = game(chapter);
    const seed = nextWin({ medals, challengeDone: false, today: TODAY, celebrated: null }).seed!;
    const celebrated = seed.filter((id) => id !== 'medal:meals:7');
    expect(nextWin({ medals, challengeDone: false, today: TODAY, celebrated }).next?.id).toBe('medal:meals:7');
  });

  it('a chapter start after today limits nothing', () => {
```

In `src/core/__tests__/digits.test.ts` replace

```ts
    }
  });

  it('writes the app\'s own Marathi words with the same digits: badges, camps, the water toast, the household measures', () => {
    for (const key of ['badge_streak_7', 'badge_meals_100', 'level_camp1', 'toast_water_added', 'measure_bowl', 'oc_walk_do', 'challenge_steps_4']) {
      expect(t('mr', key), key).not.toMatch(DEVANAGARI);
    }
    expect(t('mr', 'badge_streak_7')).toMatch(/7/);
  });

  it('writes the Marathi of the coach\'s lines, the recipes, yoga, exercises, mantras and break nudges with the same digits', () => {
```

with

```ts
    }
  });

  it('writes the app\'s own Marathi words with the same digits: medals, challenges, the water toast, the household measures', () => {
    for (const key of ['medal_meals_title', 'medal_kg_title', 'chal_walk_more', 'toast_water_added', 'measure_bowl', 'oc_walk_do']) {
      expect(t('mr', key), key).not.toMatch(DEVANAGARI);
    }
    expect(fill(t('mr', 'medal_meals_title'), { n: 7 })).toMatch(/7/);
  });

  it('writes the Marathi of the coach\'s lines, the recipes, yoga, exercises, mantras and break nudges with the same digits', () => {
```

Replace the whole `src/core/__tests__/game.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { climbTrail } from '../game';

const TODAY = '2026-10-07'; // a Wednesday
const d = (n: number) => {
  const x = new Date(TODAY + 'T12:00:00');
  x.setDate(x.getDate() - n);
  return x.toISOString().slice(0, 10);
};
const weights = [
  { date: d(21), kg: 98 },
  { date: d(14), kg: 97.2 },
  { date: d(7), kg: 96.6 },
  { date: d(0), kg: 96 },
];

describe('the climb', () => {
  it('lays the weigh-ins along the climb', () => {
    const trail = climbTrail(weights, 98, 88);
    expect(trail.map((t) => t.p)).toEqual([0, 0.08, 0.14, 0.2]);
    expect(climbTrail(weights, 88, 98)).toEqual([]);
  });
});
```

- [ ] **Step 2: Change `src/components/ChapterSheet.tsx`**

In `src/components/ChapterSheet.tsx` replace

```tsx

/**
 * Me → "Start a new chapter", in plain words: the climb starts again today
 * from the weight Progress shows, Lost counts from there, the weekly
 * challenge and the streak start fresh, and nothing is deleted (the points
 * and the badges stay). A weigh-in more than thirty days old is named, so the
 * person can weigh in first.
 */
export function ChapterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
```

with

```tsx

/**
 * Me → "Start a new chapter", in plain words: the climb starts again today
 * from the weight Progress shows, Lost counts from there, the streak starts
 * fresh, and nothing is deleted (the medals stay). A weigh-in more than
 * thirty days old is named, so the
 * person can weigh in first.
 */
export function ChapterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
```

- [ ] **Step 3: Change `src/components/useGame.ts`**

Replace the whole `src/components/useGame.ts` with:

```ts
import { useMemo } from 'react';
import { gameView } from '../core/game';
import { useApp } from '../store/AppProvider';

/**
 * The climb, from the store (`gameView`): Lost, To go, the mountain, its
 * camps and its trail, the chapter's, at the weight Progress shows. Shared by
 * the Journey page, Progress and the medals.
 */
export function useGame() {
  const { state, targets, today } = useApp();
  return useMemo(() => gameView({ state: { profile: state.profile, weights: state.weights }, targets, today }), [state.profile, state.weights, targets, today]);
}
```

- [ ] **Step 4: Change `src/core/abhyas.ts`**

In `src/core/abhyas.ts` replace

```ts
  return streakRun(data, today, now).days;
}

/**
 * Items done over every day up to today, each item on each day once: the
 * climb's points count them. Finished sessions only, so the points move when
 * a timer stops, not every minute it runs.
 */
export function doneCount(data: Omit<AbhyasData, 'running'>, today: ISODate): number {
  const ticks = byDate(data.ticks);
  const sessions = byDate(data.sessions);
  let n = 0;
  for (const date of new Set([...ticks.keys(), ...sessions.keys()])) {
    // No timer, so the moment read at does not count.
    if (date <= today) n += statusIn({ items: data.items, running: null }, date, ticks.get(date) ?? [], sessions.get(date) ?? [], new Date(0)).done;
  }
  return n;
}

/** What the user fills in for an item: everything it is but its id, place and dates. */
export type AbhyasDraft = Pick<AbhyasItem, 'name' | 'icon' | 'kind' | 'days' | 'date' | 'targetMin' | 'times'>;
```

with

```ts
  return streakRun(data, today, now).days;
}

/** What the user fills in for an item: everything it is but its id, place and dates. */
export type AbhyasDraft = Pick<AbhyasItem, 'name' | 'icon' | 'kind' | 'days' | 'date' | 'targetMin' | 'times'>;
```

- [ ] **Step 5: Change `src/core/chapter.ts`**

In `src/core/chapter.ts` replace

```ts
/**
 * A new chapter: the climb starts again from the weight Progress shows (the
 * weight smoothed over a week, `shownWeight`, so Lost reads 0 on the first
 * day) and today, and the weekly challenge, the streak shown and the best run
 * count from that day. The very first start is kept, so the kilo badges still
 * count the whole journey, and the points and the streak badges count the
 * streak of the whole journey. Nothing is deleted. Pure.
 */
export function newChapter(
  profile: Pick<Profile, 'weightKg' | 'startWeightKg' | 'firstStartWeightKg'>,
```

with

```ts
/**
 * A new chapter: the climb starts again from the weight Progress shows (the
 * weight smoothed over a week, `shownWeight`, so Lost reads 0 on the first
 * day) and today, and the streak shown and the best run count from that day.
 * The very first start is kept, so the kilo medals still count the whole
 * journey, and the streak medals count the streak of the whole journey.
 * Nothing is deleted. Pure.
 */
export function newChapter(
  profile: Pick<Profile, 'weightKg' | 'startWeightKg' | 'firstStartWeightKg'>,
```

- [ ] **Step 6: Change `src/core/game.ts`**

Replace the whole `src/core/game.ts` with:

```ts
import { chapterSince } from './chapter';
import type { Targets } from './nutrition';
import { shownPlan, type Plan } from './plan';
import type { AppState, ISODate, WeightLog } from './types';

/**
 * The climb: the weight journey drawn as a mountain, from the start weight at
 * its foot to the goal at its summit, with camps at a quarter, half and three
 * quarters of the way and a trail of the weigh-ins. All derived from the
 * logs, nothing stored. The rewards (medals, the daily challenge) are
 * core/medals.ts and core/challenge.ts; the points, camps-as-levels, badges
 * and weekly challenge that were here are retired, and the ids they were
 * celebrated under stay readable in `celebrated` (the streak and kilo badges
 * count as the medals they became).
 */

/** Where each weigh-in sits on the climb, 0 at the start weight and 1 at the goal. */
export function climbTrail(weights: WeightLog[], startKg: number, goalKg: number): { date: ISODate; p: number }[] {
  const total = startKg - goalKg;
  if (total <= 0) return [];
  return [...weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => ({ date: w.date, p: Math.round(Math.min(1, Math.max(0, (startKg - w.kg) / total)) * 1000) / 1000 }));
}

export type GameView = {
  plan: Plan;
  progress: number;
  camps: { p: number; label: string }[];
  trail: number[];
};

/**
 * Everything the climb shows, from the store: Lost, To go, the mountain, its
 * camps and its trail are the chapter's (`shownPlan`, the trail from the
 * chapter's first day); a chapter start after today is no chapter yet.
 */
export function gameView(o: {
  state: Pick<AppState, 'profile' | 'weights'>;
  targets: Targets;
  today: ISODate;
}): GameView {
  const { state, targets, today } = o;
  const plan = shownPlan(state.profile, state.weights, targets, today);
  const since = chapterSince(state.profile.chapterStart, today);
  const total = Math.max(0, plan.startKg - plan.goalKg);
  const progress = total > 0 ? Math.min(1, Math.max(0, plan.lostKg / total)) : plan.toGoKg <= 0 ? 1 : 0;
  const camps = total > 0 ? [0.25, 0.5, 0.75].map((p) => ({ p, label: `${Math.round((plan.startKg - total * p) * 10) / 10}` })) : [];
  const trailWeights = since ? state.weights.filter((w) => w.date >= since) : state.weights;
  return { plan, progress, camps, trail: climbTrail(trailWeights, plan.startKg, plan.goalKg).map((t) => t.p) };
}
```

- [ ] **Step 7: Change `src/core/types.ts`**

In `src/core/types.ts` replace

```ts
  onboarded: boolean;
  /** The day setup was finished, when no meal-time prompt goes out. Missing on older profiles: they are not on day one. */
  onboardedOn?: ISODate;
  /** The day the current chapter began ("Start a new chapter"): the climb, the weekly challenge and the streak count from it. */
  chapterStart?: ISODate;
  /** The start weight before the first new chapter: the kilo badges keep counting from it. */
  firstStartWeightKg?: number;
  /** No meal is filled in from the plan on or before this date: the day the store moved to version 7, so an update never fills in a day already lived. */
  autoFillFrom?: ISODate;
```

with

```ts
  onboarded: boolean;
  /** The day setup was finished, when no meal-time prompt goes out. Missing on older profiles: they are not on day one. */
  onboardedOn?: ISODate;
  /** The day the current chapter began ("Start a new chapter"): the climb and the streak count from it. */
  chapterStart?: ISODate;
  /** The start weight before the first new chapter: the kilo medals keep counting from it. */
  firstStartWeightKg?: number;
  /** No meal is filled in from the plan on or before this date: the day the store moved to version 7, so an update never fills in a day already lived. */
  autoFillFrom?: ISODate;
```

In `src/core/types.ts` replace

```ts
  schedule: WorkSchedule;
  /** Retired in version 7: the one-week template became this week's `menus`. Always null after a load; kept so a merge with an older file clears it. */
  weekPlan?: import('./weekPlan').WeekPlan | null;
  /** Wins already celebrated (badge:, level:, challenge: ids). Null until first seeded. */
  celebrated?: string[] | null;
  /** Activities done, by the person's own choice. */
  activities: ActivityLog[];
```

with

```ts
  schedule: WorkSchedule;
  /** Retired in version 7: the one-week template became this week's `menus`. Always null after a load; kept so a merge with an older file clears it. */
  weekPlan?: import('./weekPlan').WeekPlan | null;
  /** Wins already celebrated (medal: and challenge:day: ids, and the badge:, level: and challenge: ids of the game before medals). Null until first seeded. */
  celebrated?: string[] | null;
  /** Activities done, by the person's own choice. */
  activities: ActivityLog[];
```

- [ ] **Step 8: Sweep the words in `src/i18n/index.ts`**

The retired words go from all three dictionaries with one sweep (each is on its own line; `progress_climb_a11y` shares `progress_badges`'s line; `celebrate_keep_going` and `celebrate_see_medals` are kept, as the pattern ends at the colon):

```bash
perl -ni -e 'print unless /^\s+(celebrate_(title|badge|level|challenge|keep|see|footer)|xp_how|badges|badge_\w+|level_\w+|challenge_\w+|points_n|progress_badges):/' src/i18n/index.ts
```

Run: `grep -cE "^\s+(celebrate_(title|badge|level|challenge|keep|see|footer)|xp_how|badges|badge_\w+|level_\w+|challenge_\w+|points_n|progress_badges):" src/i18n/index.ts`
Expected: `0`

- [ ] **Step 9: Run the tests**

Run: `npx vitest run src/core/__tests__/abhyas.test.ts src/core/__tests__/chapter.test.ts src/core/__tests__/digits.test.ts src/core/__tests__/game.test.ts`
Expected: PASS, 66 tests.

- [ ] **Step 10: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1823 tests passing; relay 73 tests passing.

- [ ] **Step 11: Commit**

```bash
git add src/components/ChapterSheet.tsx src/components/useGame.ts src/core/__tests__/abhyas.test.ts src/core/__tests__/chapter.test.ts src/core/__tests__/digits.test.ts src/core/__tests__/game.test.ts src/core/abhyas.ts src/core/chapter.ts src/core/game.ts src/core/types.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The points, camps, badges and weekly challenge are gone from the code and the words as they are from the screens; the ids they were celebrated under stay in the store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Words: Routine, and nothing that scolds

Decision 2 and the sweep of Decision 5. The list is "Routine", "दिनक्रम" and "दिनचर्या" wherever it is named (its key, its id and its route stay `abhyas`). The kind rewrites are the spec's table; the low-intake note keeps its meaning ("under your safe minimum" in place of "below the line"). A new test holds every dictionary to it.

**Files:**
- Modify: `src/core/__tests__/bar.test.ts`
- Modify: `src/core/__tests__/intake.test.ts`
- Create: `src/core/__tests__/kindWords.test.ts`
- Modify: `src/core/__tests__/reminders.test.ts`
- Modify: `src/core/__tests__/review.test.ts`
- Modify: `src/i18n/index.ts` (by a sweep)

**Interfaces:**
- Consumes: nothing new.
- Produces: the new values of `abhyas`, `cust_card_abhyas`, `rem_abhyas`, `push_desc`, `rem_web_note`, `plan_eased`, `w_f4_b`, `coach_protein`, `coach_water`, `coach_water_one`, `coach_after_heavy`, `coach_streak`, `intake_note`, `strip_missing`, `menu_missing`, `menu_missing_one`, `rem_fill_body`, `review_no_workout`, `chapter_body`, in all three languages.

- [ ] **Step 1: Write the failing tests**

In `src/core/__tests__/bar.test.ts` replace

```ts
  it('offers Abhyas as a tab with the book icon and its name', () => {
    expect(barItems(['progress', 'abhyas']).map((i) => i.key)).toEqual(['today', 'progress', 'add', 'abhyas', 'me']);
    expect(extraItem('abhyas')).toEqual({ key: 'abhyas', route: 'abhyas', icon: 'book-outline', labelKey: 'abhyas' });
    expect(makeT('mr')(extraItem('abhyas').labelKey)).toBe('अभ्यास');
  });

  it('the bar a new user starts with is balanced, two tabs each side of ➕: Today · Abhyas · ➕ · Progress · Me', () => {
```

with

```ts
  it('offers Abhyas as a tab with the book icon and its name', () => {
    expect(barItems(['progress', 'abhyas']).map((i) => i.key)).toEqual(['today', 'progress', 'add', 'abhyas', 'me']);
    expect(extraItem('abhyas')).toEqual({ key: 'abhyas', route: 'abhyas', icon: 'book-outline', labelKey: 'abhyas' });
    expect(makeT('mr')(extraItem('abhyas').labelKey)).toBe('दिनक्रम');
  });

  it('the bar a new user starts with is balanced, two tabs each side of ➕: Today · Abhyas · ➕ · Progress · Me', () => {
```

In `src/core/__tests__/intake.test.ts` replace

```ts
describe('intakeNote', () => {
  it("says the average and the way out in one line, in each language, the number written as the app writes numbers", () => {
    const intake = { avg: 1395, limit: 1500, days: 3 };
    expect(intakeNote(intake, 'en')).toBe("Last 3 days averaged 1,395 kcal, below the line. Eat today's plan in full.");
    expect(intakeNote(intake, 'mr')).toBe('गेल्या 3 दिवसांत सरासरी 1,395 kcal, रेषेखाली. आजचं नियोजन पूर्ण खा.');
    expect(intakeNote(intake, 'hi')).toBe('पिछले 3 दिनों में औसत 1,395 kcal, रेखा से नीचे. आज का प्लान पूरा खाएँ.');
  });

  it('says nothing when intake is not low', () => {
```

with

```ts
describe('intakeNote', () => {
  it("says the average and the way out in one line, in each language, the number written as the app writes numbers", () => {
    const intake = { avg: 1395, limit: 1500, days: 3 };
    expect(intakeNote(intake, 'en')).toBe("Last 3 days averaged 1,395 kcal, under your safe minimum. Eat today's plan in full.");
    expect(intakeNote(intake, 'mr')).toBe('गेल्या 3 दिवसांत सरासरी 1,395 kcal, सुरक्षित किमानपेक्षा कमी. आजचं नियोजन पूर्ण खा.');
    expect(intakeNote(intake, 'hi')).toBe('पिछले 3 दिनों में औसत 1,395 kcal, सुरक्षित न्यूनतम से कम. आज का प्लान पूरा खाएँ.');
  });

  it('says nothing when intake is not low', () => {
```

Create `src/core/__tests__/kindWords.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { keysOf, t } from '../../i18n';

/**
 * The app never scolds: what is not done is "not yet", never missed, failed,
 * behind or below the line, in any language. A few lines use such a word for
 * something other than the user's day: a save or a sign-in that did not go
 * through, "the maths behind it", a pain that stays.
 */
const SCOLDING = {
  en: /\b(miss|missed|missing|fail|failed|behind)\b|below the line/i,
  mr: /चुकल|चुकले|राहिल|मागे आहे|रेषेखाली/,
  hi: /छूट गय|छूटे|छूटने|पीछे है|रेखा से नीचे/,
} as const;
const NOT_THE_USER: Record<string, string[]> = { en: ['storage_save_failed', 'w_f1_b'], mr: ['auth_err_generic', 'pain_note'], hi: [] };

describe('kind words', () => {
  for (const lang of ['en', 'mr', 'hi'] as const) {
    it(`${lang}: no line scolds the user`, () => {
      const found = keysOf(lang).filter((k) => !NOT_THE_USER[lang].includes(k) && SCOLDING[lang].test(t(lang, k)));
      expect(found).toEqual([]);
    });
  }

  it('calls the list Routine, दिनक्रम and दिनचर्या, and nothing says Abhyas any more', () => {
    expect([t('en', 'abhyas'), t('mr', 'abhyas'), t('hi', 'abhyas')]).toEqual(['Routine', 'दिनक्रम', 'दिनचर्या']);
    for (const lang of ['en', 'mr', 'hi'] as const) expect(keysOf(lang).filter((k) => /Abhyas/.test(t(lang, k))), lang).toEqual([]);
    for (const lang of ['mr', 'hi'] as const) expect(['abhyas', 'cust_card_abhyas', 'rem_abhyas', 'push_desc', 'rem_web_note'].filter((k) => t(lang, k).includes('अभ्यास')), lang).toEqual([]);
  });
});
```

In `src/core/__tests__/reminders.test.ts` replace

```ts
  });

  it('asks to look at yesterday, not that meals are missing: the meals the app fills in from the plan may have completed it by nine', () => {
    expect(makeT('en')('rem_fill_body')).toBe('Take a look at yesterday: confirm what was filled in from the plan and add anything missing.');
    for (const lang of ['mr', 'hi'] as const) {
      const words = makeT(lang)('rem_fill_body');
      expect(words, lang).not.toBe(makeT('en')('rem_fill_body'));
```

with

```ts
  });

  it('asks to look at yesterday, not that meals are missing: the meals the app fills in from the plan may have completed it by nine', () => {
    expect(makeT('en')('rem_fill_body')).toBe('Take a look at yesterday: confirm what was filled in from the plan and add anything not logged yet.');
    for (const lang of ['mr', 'hi'] as const) {
      const words = makeT(lang)('rem_fill_body');
      expect(words, lang).not.toBe(makeT('en')('rem_fill_body'));
```

In `src/core/__tests__/review.test.ts` replace

```ts

  it('leaves out what did not happen, and says when nobody moved', () => {
    const quiet = dayReviewLines({ ...day, movedMin: null, sleep: null, mood: { score: 3 }, screenMin: 0, streakDays: 1 }, makeT('en'));
    expect(quiet).toEqual(['Ate 1,714 of 1,900 kcal, protein 72 of 90 g.', 'Water 2,500 of 3,000 ml.', 'No workout today.', 'Mood 3 out of 5.']);
  });

  it('is said in Marathi and Hindi too, for a day with no model to write it, in plain words with every number filled in', () => {
```

with

```ts

  it('leaves out what did not happen, and says when nobody moved', () => {
    const quiet = dayReviewLines({ ...day, movedMin: null, sleep: null, mood: { score: 3 }, screenMin: 0, streakDays: 1 }, makeT('en'));
    expect(quiet).toEqual(['Ate 1,714 of 1,900 kcal, protein 72 of 90 g.', 'Water 2,500 of 3,000 ml.', 'A rest day from workouts.', 'Mood 3 out of 5.']);
  });

  it('is said in Marathi and Hindi too, for a day with no model to write it, in plain words with every number filled in', () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/__tests__/bar.test.ts src/core/__tests__/intake.test.ts src/core/__tests__/kindWords.test.ts src/core/__tests__/reminders.test.ts src/core/__tests__/review.test.ts`
Expected: FAIL, because the old words are still there: `Tests  8 failed | 141 passed (149)`, the first reads `AssertionError: expected 'अभ्यास' to be 'दिनक्रम' // Object.is equality`

- [ ] **Step 3: Sweep the words in `src/i18n/index.ts`**

Make the 51 replacements in one sweep. Each `from` must be found exactly once; the script stops at the first that is not, before it writes anything:

```bash
node - <<'EOF'
const fs = require('fs');
const file = 'src/i18n/index.ts';
let s = fs.readFileSync(file, 'utf8');
const pairs = [
  // The section's new name: Routine, दिनक्रम, दिनचर्या. The id `abhyas` stays.
  ["push_desc: 'Meals, Abhyas, Day so far,", "push_desc: 'Meals, Routine, Day so far,"],
  ["  cust_card_abhyas: 'Abhyas',\n  // Abhyas: the user's own list for the day, on Today and in its sheet.\n  abhyas: 'Abhyas',", "  cust_card_abhyas: 'Routine',\n  // Routine (the id stays abhyas): the user's own list for the day, on Today and in its sheet.\n  abhyas: 'Routine',"],
  ["rem_abhyas: 'Abhyas', rem_abhyas_desc", "rem_abhyas: 'Routine', rem_abhyas_desc"],
  ["meal-time prompt, Abhyas and Day so far come", "meal-time prompt, Routine and Day so far come"],
  ["push_desc: 'जेवण, अभ्यास,", "push_desc: 'जेवण, दिनक्रम,"],
  ["  cust_card_abhyas: 'अभ्यास',\n  abhyas: 'अभ्यास', abh_done_of: '{m} पैकी", "  cust_card_abhyas: 'दिनक्रम',\n  abhyas: 'दिनक्रम', abh_done_of: '{m} पैकी"],
  ["rem_abhyas: 'अभ्यास', rem_abhyas_desc: 'तुमच्या", "rem_abhyas: 'दिनक्रम', rem_abhyas_desc: 'तुमच्या"],
  ["आठवण, अभ्यास आणि आतापर्यंतचा", "आठवण, दिनक्रम आणि आतापर्यंतचा"],
  ["push_desc: 'खाना, अभ्यास,", "push_desc: 'खाना, दिनचर्या,"],
  ["  cust_card_abhyas: 'अभ्यास',\n  abhyas: 'अभ्यास', abh_done_of: '{m} में से", "  cust_card_abhyas: 'दिनचर्या',\n  abhyas: 'दिनचर्या', abh_done_of: '{m} में से"],
  ["rem_abhyas: 'अभ्यास', rem_abhyas_desc: 'आपकी", "rem_abhyas: 'दिनचर्या', rem_abhyas_desc: 'आपकी"],
  ["याद, अभ्यास और अब तक", "याद, दिनचर्या और अब तक"],
  // Kind words: "not yet" for what is not done, never missed, behind, failed or below the line.
  ["Miss three days and the plan shrinks to meet you.", "Away for three days? The plan shrinks to meet you."],
  ["plan_eased: 'Plan eased after three missed days.'", "plan_eased: 'Plan eased after three quiet days.'"],
  ["coach_protein: 'Protein is behind: {g} g still to go.", "coach_protein: 'Protein: {g} g still to go."],
  ["coach_water: 'You are behind on water: {bottles} bottles to catch up. One now.'", "coach_water: 'Water: {bottles} bottles to go. One now.'"],
  ["coach_water_one: 'You are behind on water: one bottle to catch up. Start it now.'", "coach_water_one: 'Water: one bottle to go. Start it now.'"],
  ["coach_after_heavy: 'Yesterday was heavy. Today: a lighter lunch,", "coach_after_heavy: 'A fresh day: a lighter lunch,"],
  ["coach_streak: '{n} days logged in a row. Keep the chain.'", "coach_streak: '{n} days logged in a row. Well done; today adds one more.'"],
  ["kcal, below the line. Eat today\\'s plan in full.'", "kcal, under your safe minimum. Eat today\\'s plan in full.'"],
  ["strip_missing: 'Meals missing'", "strip_missing: 'Meals not logged yet'"],
  ["menu_missing: '{n} meals missing', menu_missing_one: '1 meal missing'", "menu_missing: '{n} meals not logged yet', menu_missing_one: '1 meal not logged yet'"],
  ["and add anything missing.'", "and add anything not logged yet.'"],
  ["review_no_workout: 'No workout today.'", "review_no_workout: 'A rest day from workouts.'"],
  ["Lost counts from here, and the weekly challenge and the streak start fresh. Nothing is deleted: every meal, weigh-in and badge stays,", "Lost counts from here, and the streak starts fresh. Nothing is deleted: every meal, weigh-in and medal stays,"],
  ["तीन दिवस चुकले तर योजना", "तीन दिवस दूर गेलात तर योजना"],
  ["plan_eased: 'तीन दिवस चुकल्यावर योजना सोपी केली.'", "plan_eased: 'तीन शांत दिवसांनंतर योजना सोपी केली.'"],
  ["coach_protein: 'प्रथिने मागे आहेत: अजून", "coach_protein: 'प्रथिने: अजून"],
  ["coach_water: 'पाणी मागे आहे: {bottles} बाटल्या भरून काढायच्या. एक आत्ता.'", "coach_water: 'पाणी: अजून {bottles} बाटल्या. एक आत्ता.'"],
  ["coach_water_one: 'पाणी मागे आहे: एक बाटली भरून काढायची. ती आत्ता सुरू करा.'", "coach_water_one: 'पाणी: अजून एक बाटली. ती आत्ता सुरू करा.'"],
  ["coach_after_heavy: 'काल जड गेला. आज: हलकं जेवण,", "coach_after_heavy: 'नवा दिवस: हलकं जेवण,"],
  ["coach_streak: '{n} दिवस सलग नोंद. साखळी तोडू नका.'", "coach_streak: '{n} दिवस सलग नोंद. छान; आज आणखी एक.'"],
  ["kcal, रेषेखाली. आजचं नियोजन", "kcal, सुरक्षित किमानपेक्षा कमी. आजचं नियोजन"],
  ["strip_missing: 'काही जेवणं राहिली'", "strip_missing: 'काही जेवणं अजून नोंदवायची'"],
  ["menu_missing: '{n} जेवणं राहिली', menu_missing_one: '1 जेवण राहिलं'", "menu_missing: '{n} जेवणं अजून नोंदवायची', menu_missing_one: '1 जेवण अजून नोंदवायचं'"],
  ["पक्कं करा आणि राहिलेलं जोडा.'", "पक्कं करा आणि अजून न नोंदवलेलं जोडा.'"],
  ["review_no_workout: 'आज व्यायाम नाही.'", "review_no_workout: 'आज व्यायामाला विश्रांती.'"],
  ["आणि आठवड्याचं आव्हान आणि सलग दिवस नव्याने सुरू होतात. काहीही पुसलं जात नाही: प्रत्येक जेवण, वजन आणि बॅज राहतो,", "आणि सलग दिवस नव्याने सुरू होतात. काहीही पुसलं जात नाही: प्रत्येक जेवण, वजन आणि पदक राहतं,"],
  ["तीन दिन छूटे तो योजना", "तीन दिन दूर रहे तो योजना"],
  ["plan_eased: 'तीन दिन छूटने पर योजना आसान की.'", "plan_eased: 'तीन शांत दिनों के बाद योजना आसान की.'"],
  ["coach_protein: 'प्रोटीन पीछे है: अभी", "coach_protein: 'प्रोटीन: अभी"],
  ["coach_water: 'पानी पीछे है: {bottles} बोतलें पूरी करनी हैं. एक अभी.'", "coach_water: 'पानी: अभी {bottles} बोतलें और. एक अभी.'"],
  ["coach_water_one: 'पानी पीछे है: एक बोतल पूरी करनी है. अभी शुरू करें.'", "coach_water_one: 'पानी: अभी एक बोतल और. अभी शुरू करें.'"],
  ["coach_after_heavy: 'कल भारी रहा. आज: हल्का", "coach_after_heavy: 'नया दिन: हल्का"],
  ["coach_streak: '{n} दिन लगातार दर्ज. कड़ी मत तोड़ें.'", "coach_streak: '{n} दिन लगातार दर्ज. बहुत बढ़िया; आज एक और.'"],
  ["kcal, रेखा से नीचे. आज का प्लान", "kcal, सुरक्षित न्यूनतम से कम. आज का प्लान"],
  ["strip_missing: 'कुछ खाने बाकी'", "strip_missing: 'कुछ खाने अभी दर्ज नहीं'"],
  ["menu_missing: '{n} खाने बाकी', menu_missing_one: '1 खाना बाकी'", "menu_missing: '{n} खाने अभी दर्ज नहीं', menu_missing_one: '1 खाना अभी दर्ज नहीं'"],
  ["पक्का करें और जो बाकी है जोड़ें.'", "पक्का करें और जो अभी दर्ज नहीं, वह जोड़ें.'"],
  ["review_no_workout: 'आज कसरत नहीं.'", "review_no_workout: 'आज कसरत से आराम.'"],
  ["और हफ़्ते की चुनौती और लगातार दिन नए सिरे से शुरू होते हैं. कुछ भी मिटता नहीं: हर खाना, वज़न और बैज रहता है,", "और लगातार दिन नए सिरे से शुरू होते हैं. कुछ भी मिटता नहीं: हर खाना, वज़न और पदक रहता है,"],
];
for (const [from, to] of pairs) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`expected once, found ${n}: ${from}`);
  s = s.replace(from, () => to);
}
fs.writeFileSync(file, s);
console.log(`${pairs.length} words changed`);
EOF
```

Run: `grep -c "Abhyas'" src/i18n/index.ts`
Expected: `0`

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/core/__tests__/bar.test.ts src/core/__tests__/intake.test.ts src/core/__tests__/kindWords.test.ts src/core/__tests__/reminders.test.ts src/core/__tests__/review.test.ts`
Expected: PASS, 149 tests.

- [ ] **Step 5: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run && (cd relay && npx vitest run)`
Expected: tsc clean, lint clean, 1827 tests passing; relay 73 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/core/__tests__/bar.test.ts src/core/__tests__/intake.test.ts src/core/__tests__/kindWords.test.ts src/core/__tests__/reminders.test.ts src/core/__tests__/review.test.ts src/i18n/index.ts
git commit -m "$(cat <<'EOF'
The list is called Routine, दिनक्रम and दिनचर्या wherever it is named, and no line scolds: meals not logged yet, the plan eased after quiet days, water and protein said as what is left, a rest day from workouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 16: Look at it on a phone-sized screen

Nothing here changes code unless something is wrong; a fix found here gets its own commit with the four checks before it.

**Files:**
- Create, then delete: `public/seed-dev.json` (never committed)

- [ ] **Step 1: Start the web preview**

Start the `.claude/launch.json` configuration "sobat-web" (port 8082) with the preview tool. If the page goes to `/welcome` because this origin has no session, the check does not need one: stop it and start the same command with `EXPO_PUBLIC_NO_AUTH=1` in front (`src/services/firebase.ts` reads it). If a change does not show after a reload, the bundler cache is stale: restart with `--clear` (the configuration already passes it).

- [ ] **Step 2: Seed a store with a routine**

```bash
node scripts/seed-state.js > public/seed-dev.json
```

Open `http://localhost:8082/manifest.json` (a static page on the same origin), then run in its console:

```js
const s = JSON.parse(JSON.parse(await fetch('/seed-dev.json').then((r) => r.text())));
const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const created = new Date(Date.now() - 20 * 86400000).toISOString();
s.profile.lang = 'en';
s.abhyasItems = [
  { id: 'yoga', name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: ['07:00'], order: 0, createdAt: created },
  { id: 'code', name: 'Coding', icon: 'code-slash-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], targetMin: 30, times: ['20:00'], order: 1, createdAt: created },
];
s.abhyasTicks = []; s.abhyasSessions = [];
for (let i = 1; i <= 9; i++) {
  if (i !== 4) s.abhyasTicks.push({ id: `yoga@${day(i)}`, itemId: 'yoga', date: day(i), at: new Date().toISOString() });
  s.abhyasSessions.push({ id: `code@${day(i)}`, itemId: 'code', date: day(i), startedAt: new Date(`${day(i)}T20:${i % 2 ? '10' : '30'}:00`).toISOString(), endedAt: new Date(`${day(i)}T20:${i % 2 ? '45' : '59'}:00`).toISOString(), minutes: 30 });
}
localStorage.setItem('sobat.state.v1', JSON.stringify(s));
```

Then open `http://localhost:8082/`.

- [ ] **Step 3: Light, 375 points wide, English**

Emulate a 375 × 812 viewport in light mode and take screenshots of:
- **Today:** the tint band behind the header and the week strip; the gold streak pill; "Today's challenge" with its gold icon; the tab bar 60 tall with the active pill, labels 12, ➕ lifted half above the bar. After 18:00 the coach is the teacher's card (to see it earlier, read `useTeacherWords` in the console instead).
- **The ➕ sheet:** Food · Water · Walk · Weight · Routine above the slot chips; tap Water (the sheet closes, the toast says "Added 500 ml water" with Undo; Undo takes it away); open again, tap Routine (the list with Yoga and Coding); open again, tap Weight (the weight entry over the sheet).
- **Routine:** "8 days in a row" with "Shield used this week." under it (the day without yoga is covered), the Last 14 days.
- **Progress:** the shield note under the Streak tile, the trophy shelf (three routine medals earned, the next of each faded with "… to go"), the calendar.
- **A celebration:** in the console, `const s = JSON.parse(localStorage.getItem('sobat.state.v1')); s.celebrated = ['medals:seeded']; localStorage.setItem('sobat.state.v1', JSON.stringify(s)); location.href = '/'` — the full gold screen for "3 days of your routine in a row", the shine crossing the medal, three sparks; Keep going brings the next medal.

The console must show no error (a "React does not recognize the … prop" error means a native-only prop reached a DOM element).

- [ ] **Step 4: Dark, and the other palettes**

Switch the emulation to dark and repeat Today and Progress. In Settings → Appearance tap Indigo and amber, then Forest and saffron: the whole app, the logo tile on Me and the swatch ring follow; words stay readable.

- [ ] **Step 5: Marathi at text scale 1.25**

In the console, `const s = JSON.parse(localStorage.getItem('sobat.state.v1')); s.profile.lang = 'mr'; s.settings.textScale = 1.25; localStorage.setItem('sobat.state.v1', JSON.stringify(s)); location.reload()`. Check that no Devanagari is clipped: the tab labels (आज, दिनक्रम, प्रगती, मी) in a 64 point bar, the quick actions in the ➕ sheet, the shield note, the challenge card, the trophy shelf's labels and the celebration.

- [ ] **Step 6: Clean up**

```bash
rm public/seed-dev.json
git status --short
```

Expected: `git status --short` prints nothing (the seed file was never added). Reset the viewport emulation to desktop.
