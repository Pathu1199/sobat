# Week menu redesign, Plan 2 of 4: style foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the whole app the sober style the spec asks for before any screen is rebuilt: a palette whose words all read at 4.5:1 in light and dark, one teal accent with dark ink on it, four type sizes and two weights with line heights that never clip Devanagari, normal-case labels, flat surfaces, the phone's own font, a native app that follows the phone's light or dark setting, controls that announce themselves and are never smaller than a finger, and plain words in English, Marathi and Hindi.

**Architecture:** Tokens live in `src/ui/theme.ts` (palettes, `F` sizes, `lh()`, `MICRO`, `S.touch`); a pure `src/ui/contrast.ts` lets vitest hold every token pair to WCAG 4.5:1. Shared controls in `src/ui/components.tsx` get roles, states and 44-point targets once, so every screen gains them. Screens are moved onto the new tokens by mechanical sweeps (sed/perl commands with a verification grep after each) plus a short list of hand edits. `GradientBanner` becomes a flat `Banner`. The app shell (`_layout.tsx`, `+html.tsx`, `app.json`) follows the phone. No data, model, store or core file changes.

**Tech Stack:** Expo SDK 57 (`expo` ~57.0.25), React Native 0.86.3, expo-router ~57.0.23, expo-status-bar ~57.0.1, expo-system-ui ~57.0.4, expo-splash-screen ~57.0.9, TypeScript ~6.0, vitest 4.1 (TZ pinned to Asia/Kolkata).

Spec: `docs/superpowers/specs/2026-10-27-week-menu-redesign-design.md` (Decisions 10–12, "Part 2 → Style first", "Living tiles → Colour").

Expo docs read for this plan (SDK 57):
- `https://docs.expo.dev/versions/v57.0.0/config/app/`: top-level `userInterfaceStyle` takes `light | dark | automatic` and "Requires `expo-system-ui` be installed in your project to work on Android"; `androidStatusBar` is "@deprecated Use the `expo-status-bar` plugin configuration instead."
- `https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/`: `StatusBar` `style` is `'auto' | 'inverted' | 'light' | 'dark'`, "Sets the color of the status bar text."
- `https://docs.expo.dev/versions/v57.0.0/sdk/system-ui/`: `SystemUI.setBackgroundColorAsync(color)` sets the root view background. Its config plugin is applied by prebuild on its own (`expo-system-ui` is in `versionedExpoSDKPackages` in `node_modules/@expo/prebuild-config/build/plugins/withDefaultPlugins.js`), so no plugin entry is added.
- `https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/`: the `expo-splash-screen` plugin takes `backgroundColor`, `image`, `imageWidth` and `dark: { backgroundColor, image }`; "These settings require building a new app binary."

## Global Constraints

- Use npm; removing a package is `npm uninstall <name>` (this plan removes `@expo-google-fonts/mukta` that way).
- Any new dependency goes through `npx expo install <package>` (this plan adds none).
- Never push: every push to `main` deploys the website and publishes an APK.
- Run `npx tsc --noEmit`, `npx expo lint` and `npx vitest run` before every commit and before declaring done. At the start: tsc clean, lint clean (no problems), 648 tests passing.
- Do not touch `src/core/**` or `src/store/**`: a parallel plan owns core data, the store and the pattern/coach files (`src/components/useCoach.ts`, `src/services/usePhotoQueue.ts`). Before each commit `git status --short | grep -E "src/(core|store)/"` must print nothing.
- Match the surrounding comment density and naming; refer to the person using the app as "the user" or "they" in comments and copy.
- Never add `eslint-disable` comments.
- macOS tools: `sed -i ''` (BSD sed) and `perl -pi -e`; every sweep is followed by the verification grep it names.
- Every new i18n key goes into all three dicts in `src/i18n/index.ts`: `en` (closes at the `};` on line 985), `mr` (line 1971), `hi` (line 2955). Before adding a key, `grep -nE "^  <key>:" src/i18n/index.ts` must print nothing (a duplicate key is a TS1117 error).
- Do not create or edit `ios/` or `android/` (generated and git-ignored).
- Line numbers below are from `main` at `29e6f9d`. Every edit names the exact text to replace, so a shifted line still matches.

## File Structure

| File | Responsibility in this plan |
|---|---|
| `src/ui/theme.ts` | Palettes (`onAccent`, `accentText`, raised `textFaint`, deeper light status colours; `textGhost`, `heroFrom`, `heroTo` removed), the four sizes `F.number/title/body/small`, `scaledSizes()`, `lh()`, `MICRO` as a normal-case label, `S.touch` |
| `src/ui/contrast.ts` (new) | `luminance()`, `contrastRatio()`: pure WCAG 2.1 maths |
| `src/ui/__tests__/contrast.test.ts` (new) | Holds every word colour and surface pair to 4.5:1 in both modes |
| `src/ui/__tests__/type.test.ts` (new) | Four sizes, scaling, `lh()` room for matras, `MICRO` shape |
| `vitest.config.mts` | Includes `src/ui/**/*.test.ts` |
| `src/ui/components.tsx` | Rewritten: roles, states, 44-point targets, `onAccent`/`accentText`, `lh()` everywhere, two weights |
| `src/ui/tiles.tsx`, `Sheet.tsx`, `TopBar.tsx`, `DateStrip.tsx`, `Logo.tsx`, `charts.tsx` | Labels, header roles, dark ink on teal, no tracking, four sizes |
| `src/ui/Banner.tsx` (new), `src/ui/GradientBanner.tsx` (deleted) | Flat panel for the one number on a screen |
| `src/app/**`, `src/components/**`, `src/services/feedback.tsx` | Swept onto the new sizes, weights, line heights and accent tokens; plain words |
| `src/app/_layout.tsx` | Status bar from `themeMode()`, root view colour, page language, translated header titles |
| `src/app/+html.tsx` | System font stack, light/dark background before load, pinch zoom allowed |
| `src/app/tour.tsx`, `src/app/memory.tsx` | Read colours at render, not at module load |
| `app.json`, `public/manifest.json` | Follow the phone; splash in light and dark; teal for the notification tint |
| `package.json`, `package-lock.json`, `public/fonts/` | Mukta removed |
| `src/i18n/index.ts` | Plain words in all three languages; 13 header titles and the other strings moved in |

---

### Task 1: A palette whose words all read at 4.5:1

**Files:**
- Create: `src/ui/contrast.ts`
- Create: `src/ui/__tests__/contrast.test.ts`
- Modify: `vitest.config.mts` (the `include` line, line 31)
- Modify: `src/ui/theme.ts` (header comment lines 1–10, `DARK` lines 15–49, `LIGHT` lines 51–86, `scoreColor` line 179)
- Modify: every file that reads `C.textGhost` (40 files, swept in Step 6), and `src/app/memory.tsx` line 92

**Interfaces:**
- Consumes: `PALETTES`, `ThemeMode` from `src/ui/theme.ts`.
- Produces: `luminance(hex: string): number`, `contrastRatio(a: string, b: string): number` in `src/ui/contrast.ts`; palette tokens `C.accentText` (teal for words) and `C.onAccent` (dark ink for words and icons on a teal fill). Removes `C.textGhost`: later plans use `C.textFaint` for quiet words.

Contrast of the key pairs after this task (WCAG 2.1, bg / card / cardAlt):

| Pair | Light | Dark |
|---|---|---|
| `onAccent` on `accent` | 5.62 (white was 3.13) | 10.07 (white was 1.90) |
| `textFaint` on surfaces | 4.71 / 5.13 / 4.66 (was 3.44 / 3.74 / 3.40) | 5.74 / 5.12 / 4.62 (was 4.76 / 4.24 / 3.83) |
| `accentText` on surfaces | 5.20 / 5.66 / 5.14 (teal words were 2.87 / 3.13 / 2.84) | 10.07 / 8.98 / 8.10 |
| `accentText` on `accentDim` / `accentSoft` | 5.12 / 4.68 | 7.48 / 4.77 |
| `red` on surfaces, on `redSoft` | 5.33 / 5.80 / 5.27, 4.57 | 6.37 / 5.68 / 5.13, 5.07 |
| `amber` on surfaces, on `amberSoft` | 5.24 / 5.70 / 5.18, 4.83 | 10.83 / 9.66 / 8.72, 5.70 |
| `green`, `cyan`, `pink`, `violet` (min) | 4.64, 4.68, 4.61, 4.75 | 8.19, 7.63, 5.37, 5.65 |
| `text`, `textDim` (min) | 15.96, 6.87 | 14.10, 7.11 |

- [ ] **Step 1: Write the contrast helper**

Create `src/ui/contrast.ts`:

```ts
/**
 * WCAG 2.1 contrast between two colours. Words need 4.5:1 against what they
 * sit on; the palette test holds every token pair the app uses to that.
 * Pure: no React Native, so vitest can import it.
 */

/** Relative luminance of a #RGB or #RRGGBB colour, 0 for black to 1 for white. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const channel = (at: number) => {
    const c = parseInt(full.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** The contrast ratio, 1 to 21, the same whichever colour is passed first. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
```

- [ ] **Step 2: Write the failing palette test**

Create `src/ui/__tests__/contrast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from '../contrast';
import { PALETTES, type ThemeMode } from '../theme';

const MODES: ThemeMode[] = ['light', 'dark'];
/** What words sit on. */
const SURFACES = ['bg', 'card', 'cardAlt'] as const;
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
  for (const mode of MODES) {
    const P = PALETTES[mode];

    it(`${mode}: every colour that carries words reads at 4.5:1 on every surface`, () => {
      for (const fg of WORDS) {
        for (const bg of SURFACES) {
          expect(contrastRatio(P[fg], P[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
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
  }

  it('has no ghost text colour left to reach for', () => {
    expect(Object.keys(PALETTES.light)).not.toContain('textGhost');
    expect(Object.keys(PALETTES.dark)).not.toContain('textGhost');
  });
});
```

In `vitest.config.mts` replace

```ts
    include: ['src/core/**/*.test.ts', 'src/ai/**/*.test.ts'],
```

with

```ts
    include: ['src/core/**/*.test.ts', 'src/ai/**/*.test.ts', 'src/ui/**/*.test.ts'],
```

- [ ] **Step 3: Run the test to see it fail**

Run: `npx vitest run src/ui/__tests__/contrast.test.ts`
Expected: FAIL, 7 failed and 3 passed. The first failure reads `textFaint on bg: expected 3.4376219449718057 to be greater than or equal to 4.5`; the `onAccent` and soft-button tests fail with `TypeError: Cannot read properties of undefined (reading 'replace')` because the tokens do not exist yet.

- [ ] **Step 4: Change the palettes in `src/ui/theme.ts`**

Replace the header comment (lines 1–10) with:

```ts
/**
 * Design tokens. Everything visual comes from here, so a change to the palette
 * moves the whole app at once.
 *
 * A sober health palette: one teal accent for actions, ticks and the current
 * item, soft off-white or deep slate behind, and flat cards on a hairline.
 * Every colour that carries words reads at 4.5:1 or more on the surfaces it
 * sits on (src/ui/__tests__/contrast.test.ts holds the palette to that).
 */
```

Replace the whole `const DARK = { ... };` object with:

```ts
const DARK = {
  bg: '#0B1014',
  bgAlt: '#0F161B',
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
  /** Dark ink for words and icons on an accent fill. White on this teal is 1.9:1; this is 10:1. */
  onAccent: '#0B1014',

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

  white: '#FFFFFF',
  scrim: 'rgba(3, 8, 10, 0.72)',
  shadow: '#000000',
  heroFrom: '#0FA67E',
  heroTo: '#1386B8',
};
```

Replace the comment above `LIGHT` and the whole `const LIGHT: typeof DARK = { ... };` object with:

```ts
/** The same roles in daylight: paper-white panels, ink text, the status colours a shade deeper so their words hold 4.5:1 on white. */
const LIGHT: typeof DARK = {
  bg: '#F2F6F7',
  bgAlt: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F0F5F4',
  cardHigh: '#E2ECEA',
  border: '#E3EBEA',
  borderStrong: '#C8D6D4',

  text: '#0E1B1F',
  textDim: '#45575D',
  textFaint: '#627075',

  accent: '#12A57F',
  accentSoft: '#CFF1E6',
  accentDim: '#E7F7F2',
  accentText: '#0D755A',
  onAccent: '#0E1B1F',

  cyan: '#087794',
  cyanSoft: '#CDEEF6',
  violet: '#6E52E6',
  violetSoft: '#E6E0FD',
  green: '#117E4A',
  amber: '#8A5E07',
  amberSoft: '#FBEBC6',
  red: '#BF2A40',
  redSoft: '#FBDDE2',
  pink: '#C82F78',

  white: '#FFFFFF',
  scrim: 'rgba(14, 27, 31, 0.45)',
  shadow: '#0E2A2A',
  heroFrom: '#12A57F',
  heroTo: '#0B8FC2',
};
```

(`heroFrom` and `heroTo` go in Task 5, once nothing reads them.)

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/ui/__tests__/contrast.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Move every `C.textGhost` to `C.textFaint`**

`textGhost` (2.07:1 on a light card) was used for words in 40 files: empty-state lines, the medical note, placeholders, chevrons and close icons. Every use moves to `textFaint`, which now reads at 4.5:1; icons and dots get darker too, which helps them.

```bash
grep -rl "C\.textGhost" src/app src/components src/ui | xargs sed -i '' 's/C\.textGhost/C.textFaint/g'
```

This also rewrites `scoreColor` in `theme.ts` (line 179: `if (value === null) return C.textFaint;`).

One line becomes a ternary with two equal sides. In `src/app/memory.tsx` (line 92) replace

```tsx
                      <Micro color={m.source === 'auto' ? C.textFaint : C.textFaint}>
```

with

```tsx
                      <Micro color={C.textFaint}>
```

Run: `grep -rn "textGhost" src | grep -v __tests__; grep -rnE "C\.textFaint : C\.textFaint" src`
Expected: no output (the only `textGhost` left is the test that checks it is gone).

- [ ] **Step 7: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, 658 tests passing.

- [ ] **Step 8: Commit**

```bash
git status --short | grep -E "src/(core|store)/"   # must print nothing
git add vitest.config.mts src/ui src/app src/components
git commit -m "$(cat <<'EOF'
Design: every colour that carries words reads at 4.5:1 in light and dark, with dark ink for words on the teal, a deeper teal for teal words, a darker faint grey and no ghost grey left for text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Four sizes, two weights, line heights from the size, no caps or tracking

**Files:**
- Create: `src/ui/__tests__/type.test.ts`
- Modify: `src/ui/theme.ts` (the type block from `/** Base type sizes at scale 1.` near line 131 to the end of `MICRO` near line 167)
- Modify (sweeps): 58 files that use the old size names; 22 files with literal line heights; 12 files with literal font sizes; every file with weights `'200'`, `'600'`, `'700'`, `'800'`, `letterSpacing` or `textTransform: 'uppercase'` under `src/app`, `src/components`, `src/ui`, `src/services`

**Interfaces:**
- Consumes: nothing new.
- Produces: `F.number` (44), `F.title` (20), `F.body` (16), `F.small` (13), all times the text scale; `scaledSizes(scale: number): { number; title; body; small }`; `lh(size: number, digits = false): number` (1.45 × size, or 1.15 × for a number on its own); `MICRO = { fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }`. Removes `F.display`, `F.hero`, `F.h1`, `F.h2`, `F.h3`, `F.tiny`, `F.micro`. Weights in the app are `'400'` (reading) and `'500'` (names, numbers, buttons) only.

- [ ] **Step 1: Write the failing type test**

Create `src/ui/__tests__/type.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { F, lh, MICRO, scaledSizes, TEXT_SCALES } from '../theme';

describe('type scale', () => {
  it('has four sizes at scale 1: number 44, title 20, body 16, small 13', () => {
    expect(scaledSizes(1)).toEqual({ number: 44, title: 20, body: 16, small: 13 });
    expect(F).toEqual(scaledSizes(1));
  });

  it('scales every size with the text setting, in whole points', () => {
    expect(scaledSizes(1.25)).toEqual({ number: 55, title: 25, body: 20, small: 16 });
    expect(scaledSizes(0.9)).toEqual({ number: 40, title: 18, body: 14, small: 12 });
  });

  it('labels are small, medium weight, normal case and untracked', () => {
    expect(MICRO).toEqual({ fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' });
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
    expect(lh(20)).toBe(29);
    expect(lh(20)).toBeGreaterThan(lh(16));
  });

  it('keeps a number on its own tight', () => {
    expect(lh(44, true)).toBe(51);
    expect(lh(44, true)).toBeLessThan(lh(44));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/ui/__tests__/type.test.ts`
Expected: FAIL, `TypeError: scaledSizes is not a function` (and `lh is not a function`).

- [ ] **Step 3: Replace the type block in `src/ui/theme.ts`**

Replace everything from `/** Base type sizes at scale 1. Read on a phone, often outdoors. */` down to and including the closing `};` of `export const MICRO = { ... };` with:

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
```

Run: `npx vitest run src/ui/__tests__/type.test.ts`
Expected: PASS, 6 tests. (`npx tsc --noEmit` fails until Step 4: screens still read the old names.)

- [ ] **Step 4: Rename the old size names everywhere**

Mapping: `h1`, `h2`, `h3` → `title`; `display`, `hero` → `number`; `tiny`, `micro` → `small`; `body` and `small` stay.

```bash
grep -rlE "F\.(h1|h2|h3|display|hero|tiny|micro)([^A-Za-z0-9_]|$)" src/app src/components src/ui src/services \
  | xargs sed -i '' -E 's/F\.(h1|h2|h3)([^A-Za-z0-9_]|$)/F.title\2/g; s/F\.(display|hero)([^A-Za-z0-9_]|$)/F.number\2/g; s/F\.(tiny|micro)([^A-Za-z0-9_]|$)/F.small\2/g'
```

The 58 files it touches: `src/app/(tabs)/coach.tsx`, `fit.tsx`, `growth.tsx`, `index.tsx`, `log.tsx`, `mind.tsx`; `src/app/admin.tsx`, `guide.tsx`, `history.tsx`, `journey.tsx`, `login.tsx`, `memory.tsx`, `onboarding.tsx`, `plan.tsx`, `scan.tsx`, `session.tsx`, `settings.tsx`, `sleep.tsx`, `tour.tsx`, `welcome.tsx`; `src/components/ActivityPanel.tsx`, `AwayCard.tsx`, `BreakCheckin.tsx`, `BreakOverlay.tsx`, `Celebration.tsx`, `CravingSOS.tsx`, `DayScore.tsx`, `DecisionCard.tsx`, `FitsCard.tsx`, `FoodDetailSheet.tsx`, `GrocerySheet.tsx`, `IntakeCard.tsx`, `MealSheet.tsx`, `MountainCard.tsx`, `NotificationNudge.tsx`, `NutrientCard.tsx`, `PlanCard.tsx`, `PlanTodayCard.tsx`, `RecipeSheet.tsx`, `RecoveryCard.tsx`, `RoutineCard.tsx`, `Sidebar.tsx`, `SlotEditor.tsx`, `TabBar.tsx`, `TimingCard.tsx`, `TomorrowCard.tsx`, `WaterSheet.tsx`, `WeekGrid.tsx`, `WeighInCard.tsx`, `WeightSheet.tsx`, `YogaPanel.tsx`; `src/ui/DateStrip.tsx`, `HeroRing.tsx`, `Sheet.tsx`, `TopBar.tsx`, `charts.tsx`, `components.tsx`, `tiles.tsx`.

Run: `grep -rnE "F\.(h1|h2|h3|display|hero|tiny|micro)([^A-Za-z0-9_]|$)" src; npx tsc --noEmit`
Expected: no grep output; tsc clean.

- [ ] **Step 5: Line heights come from the size**

`src/ui/components.tsx` is rewritten in Task 3 and is left out here. Every other literal line height takes `lh()` of the font size in the same style:

```bash
grep -rlE "lineHeight: [0-9]+" src/app src/components src/ui | grep -v "src/ui/components.tsx" \
  | xargs perl -pi -e 's/(fontSize: (F\.\w+)[^}]*?)lineHeight: \d+/$1lineHeight: lh($2)/g'
```

That command changes the 29 lines marked "perl" below. Then make the five hand edits marked "hand". Perl rows show the text as it is on `main` (the size names in them were renamed by Step 4, which perl does not mind); hand rows show the exact text to find after Step 4.

| Where | Before | After | By |
|---|---|---|---|
| `src/ui/tiles.tsx:57` | `fontSize: F.tiny, lineHeight: 17` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/ui/tiles.tsx:102` | `              lineHeight: 20,` (font size `F.body` on line 101) | `              lineHeight: lh(F.body),` | hand |
| `src/app/tour.tsx:66` | `fontSize: F.h1, fontWeight: '600', letterSpacing: -0.5, textAlign: 'center', lineHeight: 34` | `fontSize: F.title, fontWeight: '600', letterSpacing: -0.5, textAlign: 'center', lineHeight: lh(F.title)` | perl |
| `src/app/tour.tsx:67` | `fontSize: F.h3, lineHeight: 24` | `fontSize: F.title, lineHeight: lh(F.title)` | perl |
| `src/app/(tabs)/index.tsx:140` | `lineHeight: F.number + 4 }}` | `lineHeight: lh(F.number, true) }}` | hand |
| `src/app/(tabs)/index.tsx:158` | `fontSize: F.small, lineHeight: 19` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/app/session.tsx:240` | `fontSize: F.small, lineHeight: 20` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/app/guide.tsx:52` | `fontSize: F.body, lineHeight: 22` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/app/(tabs)/coach.tsx:387` | `fontSize: F.body, lineHeight: 20` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/app/(tabs)/coach.tsx:392` | `fontSize: F.body, lineHeight: 21` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/app/plan.tsx:213` | `fontSize: F.body, fontWeight: '600', lineHeight: 22` | `fontSize: F.body, fontWeight: '600', lineHeight: lh(F.body)` | perl |
| `src/app/welcome.tsx:50` | `fontSize: wide ? 52 : 34, fontWeight: '700', lineHeight: wide ? 60 : 42, letterSpacing: -1 }}` | `fontSize: wide ? F.number : F.title, fontWeight: '700', lineHeight: lh(wide ? F.number : F.title), letterSpacing: -1 }}` | hand |
| `src/app/welcome.tsx:53` | `fontSize: wide ? F.title : F.body, lineHeight: 26, marginTop: 18 }}` | `fontSize: wide ? F.title : F.body, lineHeight: lh(wide ? F.title : F.body), marginTop: 18 }}` | hand |
| `src/app/welcome.tsx:70` | `fontSize: F.tiny, marginTop: 12, lineHeight: 17` | `fontSize: F.small, marginTop: 12, lineHeight: lh(F.small)` | perl |
| `src/app/welcome.tsx:105` | `fontSize: F.small, lineHeight: 20` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/app/welcome.tsx:125` | `fontSize: F.body, lineHeight: 23` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/app/welcome.tsx:136` | `fontSize: F.small, lineHeight: 20` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/app/memory.tsx:91` | `fontSize: F.body, lineHeight: 20` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/app/(tabs)/fit.tsx:147` | `fontSize: F.small, lineHeight: 19` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/app/(tabs)/log.tsx:284` | `fontSize: F.small, lineHeight: 18` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/app/(tabs)/log.tsx:322` | `fontSize: F.small, lineHeight: 18` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/components/BreakToast.tsx:53` | `fontSize: F.small, lineHeight: 18` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/components/BreakOverlay.tsx:141` | `fontSize: F.small, textAlign: 'center', lineHeight: 19` | `fontSize: F.small, textAlign: 'center', lineHeight: lh(F.small)` | perl |
| `src/components/RecipeSheet.tsx:68` | `fontSize: F.body, lineHeight: 22` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/components/CoachStrip.tsx:77` | `fontSize: F.body, lineHeight: 22` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/components/DecisionCard.tsx:101` | `fontSize: F.body, lineHeight: 21` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/components/DecisionCard.tsx:106` | `fontSize: F.body, lineHeight: 21` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/components/RoutineCard.tsx:236` | `fontSize: F.small, lineHeight: 18` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/components/OllamaSetup.tsx:69` | `fontSize: F.body, lineHeight: 23` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/components/PlanTodayCard.tsx:123` | `fontSize: F.small, lineHeight: 20` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/components/NudgeToast.tsx:49` | `fontSize: F.body, lineHeight: 20` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/components/TabBar.tsx:64` | `fontSize: Math.max(12, F.small), lineHeight: 16, fontWeight: focused ? '800' : '600', letterSpacing: 0.2, includeFontPadding: false` | `fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', includeFontPadding: false` | hand |
| `src/components/YogaPanel.tsx:153` | `fontSize: F.body, lineHeight: 24` | `fontSize: F.body, lineHeight: lh(F.body)` | perl |
| `src/components/YogaPanel.tsx:165` | `fontSize: F.small, lineHeight: 20` | `fontSize: F.small, lineHeight: lh(F.small)` | perl |
| `src/ui/components.tsx:223, 380, 445, 446` | `lineHeight: 18`, `22`, `24`, `21` | `lh(F.small)`, `lh(F.small)`, `lh(F.body)`, `lh(F.small)` | Task 3 rewrite |

`F.small` is never below 12 (13 × 0.9 rounds to 12), so the `Math.max` in `TabBar.tsx:64` goes.

Then import `lh` in every file that now calls it:

```bash
grep -rl "lineHeight: lh(" src/app src/components src/ui | grep -v "src/ui/theme.ts" \
  | xargs sed -i '' -E "s/^import \{ C, F, /import { C, F, lh, /; s/^import \{ C, F \}/import { C, F, lh }/"
```

It changes the theme import in these 22 files: `src/app/(tabs)/coach.tsx`, `fit.tsx`, `index.tsx`, `log.tsx`; `src/app/guide.tsx`, `memory.tsx`, `plan.tsx`, `session.tsx`, `tour.tsx`, `welcome.tsx`; `src/components/BreakOverlay.tsx`, `BreakToast.tsx`, `CoachStrip.tsx`, `DecisionCard.tsx`, `NudgeToast.tsx`, `OllamaSetup.tsx`, `PlanTodayCard.tsx`, `RecipeSheet.tsx`, `RoutineCard.tsx`, `TabBar.tsx`, `YogaPanel.tsx`; `src/ui/tiles.tsx`. For example `src/ui/tiles.tsx` line 6 becomes `import { C, F, lh, lift, M, MICRO, S } from './theme';`.

Run: `grep -rn "lineHeight" src | grep -v "lh(" | grep -v "src/ui/components.tsx"; npx tsc --noEmit`
Expected: no grep output; tsc clean.

- [ ] **Step 6: The literal font sizes join the four sizes**

Numbers that were 40 to 44 points become `F.number`; 24 to 34 become `F.title`. Make these edits (weights and tracking on the same lines go in Steps 7 and 8):

| Where | Replace | With |
|---|---|---|
| `src/app/session.tsx:133` | `<Text style={{ color: C.text, fontSize: 30, fontWeight: '700' }}>` | `<Text style={{ color: C.text, fontSize: F.number, fontWeight: '700' }}>` |
| `src/app/onboarding.tsx:111` | `fontSize: 40, fontWeight: '200'` | `fontSize: F.number, fontWeight: '200'` |
| `src/app/photo.tsx:302` | `fontSize: 28, fontWeight: '700' }}>{totalKcal}` | `fontSize: F.title, fontWeight: '700' }}>{totalKcal}` |
| `src/app/welcome.tsx:134` | `fontSize: 30, fontWeight: '200', letterSpacing: -1 }}>{n}` | `fontSize: F.title, fontWeight: '200', letterSpacing: -1 }}>{n}` |
| `src/app/welcome.tsx:158` | `fontSize: 32, fontWeight: '200', letterSpacing: -1 }}>{value}` | `fontSize: F.title, fontWeight: '200', letterSpacing: -1 }}>{value}` |
| `src/app/(tabs)/mind.tsx:215` | `fontSize: 28, fontWeight: '600' }}>{count}` | `fontSize: F.title, fontWeight: '600' }}>{count}` |
| `src/app/(tabs)/fit.tsx:61` | `fontSize: 26, fontWeight: '700' }}>{r.score}` | `fontSize: F.title, fontWeight: '700' }}>{r.score}` |
| `src/app/(tabs)/growth.tsx:121` | `fontSize: 42, fontWeight: '200', letterSpacing: -1.5 }}>` | `fontSize: F.number, fontWeight: '200', letterSpacing: -1.5 }}>` |
| `src/app/(tabs)/growth.tsx:358` | `fontSize: 24, fontWeight: '700', letterSpacing: -0.5 }}>{value}` | `fontSize: F.title, fontWeight: '700', letterSpacing: -0.5 }}>{value}` |
| `src/components/CravingSOS.tsx:83` | `fontSize: 28, fontWeight: '200' }}>` | `fontSize: F.title, fontWeight: '200' }}>` |
| `src/components/BreakPanel.tsx:41` | `fontSize: 26, fontWeight: '200', letterSpacing: -1 }}>{left}` | `fontSize: F.title, fontWeight: '200', letterSpacing: -1 }}>{left}` |
| `src/components/NudgeToast.tsx:53` | `fontSize: 30, fontWeight: '200', textAlign: 'center'` | `fontSize: F.title, fontWeight: '200', textAlign: 'center'` |
| `src/ui/charts.tsx:124` | `textAlign: 'center', fontSize: 9 }]` | `textAlign: 'center' }]` |
| `src/ui/Logo.tsx:45` | `fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '500' }` | `fontSize: F.small, fontWeight: '500' }` |
| `src/ui/Logo.tsx:4` | `import { C } from './theme';` | `import { C, F } from './theme';` |

Kept on purpose, because they are not type: the `Wordmark`'s `fontSize: size` (`Logo.tsx:42`, the brand name), the mountain's SVG label (`Mountain.tsx:80`, art), the timers sized to their ring (`session.tsx:215`, `BreakOverlay.tsx:124`: `size * 0.24`), and emoji glyph sizes (`journey.tsx:80`, `ActivityPanel.tsx:92,115`, `Celebration.tsx:52`, `YogaPanel.tsx:75,119,138`, `FoodDetailSheet.tsx:23`), which later plans replace.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Two weights**

One ternary would collapse to two equal sides, so edit it first. In `src/components/CoachStrip.tsx` (line 77) replace

```tsx
fontWeight: a.urgency === 'now' ? '600' : '500' }}
```

with

```tsx
fontWeight: '500' }}
```

Then sweep: `'600'`, `'700'`, `'800'` become `'500'`; `'200'` becomes `'400'`; the three `weight="600"` props on `BiText` (`session.tsx:193`, `scan.tsx:117`, `(tabs)/fit.tsx:65`) and `fontWeight="600"` on the SVG label (`Mountain.tsx:80`) become `"500"`. Under these four folders every quoted `'200'`, `'600'`, `'700'`, `'800'` and `"600"` is a font weight (checked with `grep -rnE "['\"](200|600|700|800)['\"]"`).

```bash
grep -rlE "'(200|600|700|800)'|\"600\"" src/app src/components src/ui src/services \
  | xargs sed -i '' -E "s/'(600|700|800)'/'500'/g; s/\"600\"/\"500\"/g; s/'200'/'400'/g"
```

Two ternaries keep a real difference: `Sidebar.tsx:74` becomes `active ? '500' : '400'` and `WeekGrid.tsx:81` becomes `ok(d) && !empty ? '500' : '400'`.

Run: `grep -rnE "'(200|600|700|800|900)'|\"(200|600|700|800)\"|'500' : '500'" src/app src/components src/ui src/services`
Expected: no output. (`src/ui/components.tsx` line 88 now types `BiText`'s weight as `'400' | '500' | '500'`; Task 3 rewrites it.)

- [ ] **Step 8: No letter spacing, no capitals by style**

```bash
grep -rlE "letterSpacing|textTransform: 'uppercase'" src/app src/components src/ui src/services \
  | xargs perl -pi -e "s/,\s*letterSpacing:\s*-?[\d.]+//g; s/letterSpacing:\s*-?[\d.]+,\s*//g; s/,\s*textTransform: 'uppercase'//g"
```

This removes every remaining `letterSpacing` value (labels, big numbers, the wordmark) and the two remaining style capitals (`(tabs)/index.tsx:139`, `TimingCard.tsx:48`); `Logo.tsx:45` lost its capitals in Step 6 and `MICRO` in Step 3. Devanagari is never pulled apart by tracking, and words show as they are written in `i18n`.

Run: `grep -rnE "letterSpacing|textTransform" src`
Expected: no output.

- [ ] **Step 9: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, 664 tests passing.

- [ ] **Step 10: Commit**

```bash
git status --short | grep -E "src/(core|store)/"   # must print nothing
git add src/ui src/app src/components src/services
git commit -m "$(cat <<'EOF'
Design: four type sizes and two weights everywhere, line heights taken from the size so Marathi matras never clip at 1.25x, and labels in normal case with no letter spacing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Shared controls say what they are and take a finger

**Files:**
- Modify: `src/ui/theme.ts` (`S`, near line 115)
- Rewrite: `src/ui/components.tsx`
- Modify: `src/ui/tiles.tsx` (lines 63, 84, 96), `src/ui/Sheet.tsx` (lines 4, 13–15, 31), `src/ui/TopBar.tsx` (lines 5, 41, 45), `src/ui/DateStrip.tsx` (lines 60–62)

**Interfaces:**
- Consumes: `C.onAccent`, `C.accentText` (Task 1); `F`, `lh`, `MICRO` (Task 2).
- Produces: `S.touch = 44`. `Btn` gains `accessibilityLabel?: string` and announces `button` with `disabled`; `Pill` with `onPress` announces `button` with `selected`; `Toggle` is one `switch` row with `checked`, its title as label and its description as hint; `Segmented` (and so `SectionTabs`) is a `tablist` of `tab`s with `selected`; `Field` gains `accessibilityLabel?: string` and labels its `TextInput` from `label`, then `placeholder`; `ListRow` with `onPress` is a `button`; `H1`/`H2`/`H3`, `SectionHeader`, the `Sheet` title and the `TopBar` title are `header`s. Every control is at least 44 points tall (`Btn` 48, small `Btn` 44, `Pill` 35 plus a 6-point hit slop, segments 44, `Toggle` row 44, inputs 48, list rows 44).

- [ ] **Step 1: Add the touch size to `S` in `src/ui/theme.ts`**

Replace

```ts
  hairline: 1,
  gutter: 16,
```

with

```ts
  hairline: 1,
  /** The smallest a control may be under a finger, in points. */
  touch: 44,
  gutter: 16,
```

- [ ] **Step 2: Rewrite `src/ui/components.tsx`**

Replace the whole file with:

```tsx
import React from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useEased, useEntrance } from './animated';
import { C, F, lh, lift, MICRO, onThemeChange, S } from './theme';

/** Extra reach around a pill, so a 35-point chip still takes a 44-point finger. */
const PILL_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

export function Screen({ children, refreshing, wide }: { children: React.ReactNode; refreshing?: boolean; wide?: boolean }) {
  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={[st.screenContent, wide && { maxWidth: S.maxWide, paddingHorizontal: S.gutterWide, paddingTop: 4 }]}
      keyboardShouldPersistTaps="handled">
      {refreshing ? <ActivityIndicator color={C.accent} /> : null}
      {children}
      <View style={{ height: 56 }} />
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  tone,
  flat,
  rail,
  still,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: string;
  flat?: boolean;
  rail?: string;
  /** No entrance animation, for cards that re-mount often. */
  still?: boolean;
}) {
  const { opacity, translateY } = useEntrance();
  return (
    <Animated.View
      style={[
        st.card,
        flat ? { backgroundColor: 'transparent', borderColor: 'transparent', padding: 0, shadowOpacity: 0, elevation: 0 } : lift(1),
        tone ? { borderColor: tone } : null,
        rail ? { borderLeftWidth: 4, borderLeftColor: rail } : null,
        style,
        still ? null : { opacity, transform: [{ translateY }] },
      ]}>
      {children}
    </Animated.View>
  );
}

/** Screen and card titles. All three are the one title size now; the names stay so screens need not change. */
export function H1({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={st.title}>
      {children}
    </Text>
  );
}
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={st.title}>
      {children}
    </Text>
  );
}
export function H3({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={st.title}>
      {children}
    </Text>
  );
}
export function P({ children, dim, style }: { children: React.ReactNode; dim?: boolean; style?: any }) {
  return <Text style={[st.p, dim && { color: C.textDim }, style]}>{children}</Text>;
}
export function Small({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[st.small, color ? { color } : null]}>{children}</Text>;
}

/** The small quiet label over a section or beside a stat. Normal case, as the words are written. */
export function Micro({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[MICRO, { color: color ?? C.textFaint }]}>{children}</Text>;
}

/** A section heading with an optional quiet note on the right. */
export function SectionHeader({ title, meta, color, icon }: { title: string; meta?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <View style={[st.row, { justifyContent: 'space-between', marginTop: 4 }]}>
      <View style={[st.row, { gap: 7 }]}>
        {icon}
        <Text accessibilityRole="header" style={[MICRO, { color: color ?? C.textDim }]}>
          {title}
        </Text>
      </View>
      {meta ? <Micro>{meta}</Micro> : null}
    </View>
  );
}

/** One language at a time: the chosen language when a translation is given, English otherwise. */
export function BiText({ en, alt, size = F.body, color, weight = '500' }: { en: string; alt?: string; size?: number; color?: string; weight?: '400' | '500' }) {
  return <Text style={{ color: color ?? C.text, fontSize: size, lineHeight: lh(size), fontWeight: weight }}>{alt || en}</Text>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[st.row, style]}>{children}</View>;
}

/**
 * The button. Primary is the one teal action on a screen, its words in dark
 * ink (onAccent); soft and ghost are the quieter choices; danger is for
 * deleting. Never shorter than a finger.
 */
export function Btn({
  label,
  onPress,
  tone = 'primary',
  small,
  disabled,
  style,
  icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger' | 'soft';
  small?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
  /** What a screen reader says when the visible label is not enough on its own. */
  accessibilityLabel?: string;
}) {
  const bg = tone === 'primary' ? C.accent : tone === 'danger' ? C.redSoft : tone === 'soft' ? C.accentDim : 'transparent';
  const border = tone === 'ghost' ? C.borderStrong : bg;
  const fg = tone === 'primary' ? C.onAccent : tone === 'danger' ? C.red : tone === 'soft' ? C.accentText : C.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        st.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        small && st.btnSmall,
        style,
      ]}>
      {icon ? <View style={{ marginRight: 7 }}>{icon}</View> : null}
      <Text style={[st.btnText, { color: fg }, small && st.btnTextSmall]}>{label}</Text>
    </Pressable>
  );
}

/** A chip. With onPress it is a button, and `active` is announced as selected. */
export function Pill({
  label,
  color,
  textColor,
  onPress,
  active,
  tone,
}: {
  label: string;
  color?: string;
  textColor?: string;
  onPress?: () => void;
  active?: boolean;
  tone?: string;
}) {
  const bg = active ? C.accent : color ?? C.card;
  const bd = active ? C.accent : tone ?? C.border;
  const fg = active ? C.onAccent : textColor ?? C.text;
  const body = (
    <View style={[st.pill, { backgroundColor: bg, borderColor: bd }]}>
      <Text style={[st.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} hitSlop={PILL_SLOP} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** A status chip: a coloured dot and a small label, used in headers. */
export function StatusChip({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <View style={[st.pill, { backgroundColor: C.cardAlt, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={[MICRO, { color: C.textDim }]}>{label}</Text>
    </View>
  );
}

/** Two to four choices side by side, one selected. Read out as tabs, with the selected one marked. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={st.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[st.segment, on && { backgroundColor: C.card, ...lift(1) }]}>
            <Text style={[MICRO, { color: on ? C.accentText : C.textDim }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A text box with its label above it; the label is also what a screen reader calls the box. */
export function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  multiline,
  autoFocus,
  accessibilityLabel,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  /** For a box without a visible label. */
  accessibilityLabel?: string;
}) {
  return (
    <View style={{ gap: 7, flex: 1 }}>
      {label ? <Micro>{label}</Micro> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        multiline={multiline}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        style={[st.input, multiline && { minHeight: 78, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

/** A labelled switch row with a one-line reason under it. The whole row is the switch. */
export function Toggle({ title, desc, on, onToggle }: { title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={desc}
      accessibilityState={{ checked: on }}
      style={({ pressed }) => [st.row, { justifyContent: 'space-between', gap: 14, minHeight: S.touch, opacity: pressed ? 0.8 : 1 }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{title}</Text>
        <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{desc}</Text>
      </View>
      <View
        style={{
          width: 46,
          height: 27,
          borderRadius: 999,
          backgroundColor: on ? C.accent : C.cardAlt,
          borderWidth: S.hairline,
          borderColor: on ? C.accent : C.borderStrong,
          padding: 3,
          justifyContent: 'center',
          alignItems: on ? 'flex-end' : 'flex-start',
        }}>
        <View style={{ width: 19, height: 19, borderRadius: 999, backgroundColor: on ? C.onAccent : C.textFaint }} />
      </View>
    </Pressable>
  );
}

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

/** A labelled bar row: name on the left, value on the right, bar underneath. */
export function MeterRow({
  label,
  alt,
  value,
  total,
  unit,
  color = C.accent,
  marker,
}: {
  label: string;
  alt?: string;
  value: number;
  total: number;
  unit?: string;
  color?: string;
  marker?: number;
}) {
  return (
    <View style={{ gap: 7 }}>
      <View style={[st.row, { justifyContent: 'space-between', gap: 10 }]}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <BiText en={label} alt={alt} size={F.small} color={C.textDim} weight="400" />
        </View>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
          {value.toLocaleString()}
          <Text style={{ color: C.textFaint, fontWeight: '400' }}>
            {' / '}
            {total.toLocaleString()}
            {unit ? ` ${unit}` : ''}
          </Text>
        </Text>
      </View>
      <Bar value={value} max={total} color={color} marker={marker} />
    </View>
  );
}

export function Ring({
  value,
  max,
  size = 140,
  stroke = 8,
  color = C.accent,
  track = C.cardAlt,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const safe = Math.max(28, size);
  const r = (safe - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const pct = useEased(target);
  return (
    <View style={{ width: safe, height: safe, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={safe} height={safe} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={safe / 2} cy={safe / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
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
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/** A small ring with a percentage inside and a caption beneath. */
export function RingStat({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, minWidth: 52 }}>
      <Ring value={value ?? 0} max={100} size={44} stroke={3} color={color} track={C.cardAlt}>
        <Text style={{ color: value === null ? C.textFaint : C.text, fontSize: F.small, fontWeight: '500' }}>{value === null ? '·' : `${value}%`}</Text>
      </Ring>
      <Text style={[MICRO, { color: C.textFaint }]}>{label}</Text>
    </View>
  );
}

/** The four-up statistic strip under the decision card. */
export function StatQuad({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <View style={[st.row, { justifyContent: 'space-between', paddingTop: 4 }]}>
      {items.map((i) => (
        <View key={i.label} style={{ alignItems: 'center', flex: 1, gap: 5 }}>
          <Micro>{i.label}</Micro>
          <Text style={{ color: i.color ?? C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A quoted line, used for the Marathi aside inside the decision card. */
export function Quote({ children, color = C.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: color, paddingLeft: 12, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>{children}</Text>
    </View>
  );
}

/** A list row: leading icon, title with subtitle, trailing value. With onPress it is one button, at least a finger tall. */
export function ListRow({
  icon,
  title,
  alt,
  sub,
  value,
  valueUnit,
  onPress,
  trailing,
}: {
  icon?: React.ReactNode;
  title: string;
  alt?: string;
  sub?: string;
  value?: string;
  valueUnit?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const body = (
    <View style={[st.row, { paddingVertical: 11, gap: 12, minHeight: S.touch }]}>
      {icon ? <View style={st.rowIcon}>{icon}</View> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <BiText en={title} alt={alt} size={F.body} />
        {sub ? <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{sub}</Text> : null}
      </View>
      {value ? (
        <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>
          {value}
          {valueUnit ? <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}> {valueUnit}</Text> : null}
        </Text>
      ) : null}
      {trailing}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Divider() {
  return <View style={st.divider} />;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={st.empty}>
      <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{text}</Text>
    </View>
  );
}

// Baked once per theme; rebuilt when the palette or the text size changes (the tree remounts right after).
function buildStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    screenContent: { padding: S.pad, gap: S.gap, maxWidth: 780, width: '100%', alignSelf: 'center' },
    card: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: S.hairline, borderColor: C.border, padding: S.padLg, gap: 12 },
    title: { color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' },
    p: { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400' },
    small: { color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
    btn: {
      minHeight: 48,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: S.hairline,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    btnSmall: { minHeight: S.touch, paddingVertical: 8, paddingHorizontal: 14 },
    btnText: { fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' },
    btnTextSmall: { fontSize: F.small, lineHeight: lh(F.small) },
    pill: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: S.hairline },
    pillText: { fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' },
    segmented: { flexDirection: 'row', backgroundColor: C.cardAlt, borderRadius: 999, padding: 4 },
    segment: { flex: 1, minHeight: S.touch, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    input: {
      minHeight: 48,
      backgroundColor: C.cardAlt,
      borderWidth: S.hairline,
      borderColor: C.border,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 11,
      color: C.text,
      fontSize: F.body,
    },
    barTrack: { backgroundColor: C.cardAlt, overflow: 'visible', width: '100%' },
    divider: { height: S.hairline, backgroundColor: C.border },
    empty: { paddingVertical: 22, alignItems: 'center' },
  });
}

let st = buildStyles();
onThemeChange(() => {
  st = buildStyles();
});
```

What changed, for the reviewer: the primary button's teal glow is gone (flat), its words are `onAccent`, soft words are `accentText`; the toggle knob is `onAccent` (as Material's selected handle); `P` and `Small` read at weight 400; the stale duplicate comment over `BiText` is dropped; no literal line height is left. `TextInput` gets no line height on purpose: a fixed one misplaces single-line text on iOS.

- [ ] **Step 3: `src/ui/tiles.tsx`**

Replace (line 63)

```tsx
  return onPress ? <PressScale onPress={onPress}>{body}</PressScale> : body;
```

with

```tsx
  return onPress ? (
    <PressScale onPress={onPress} accessibilityLabel={[label, value, sub].filter(Boolean).join(', ')}>
      {body}
    </PressScale>
  ) : (
    body
  );
```

Replace (line 84)

```tsx
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
```

with

```tsx
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
```

Replace (line 96) `<Ionicons name="checkmark" size={13} color={C.white} />` with `<Ionicons name="checkmark" size={13} color={C.onAccent} />`.

- [ ] **Step 4: `src/ui/Sheet.tsx`**

The inner `Pressable` that stops taps reaching the scrim is accessible by default, which makes VoiceOver read the whole sheet as one element and hides its buttons. Replace the import `import { C, F, S } from './theme';` with `import { C, F, lh, S } from './theme';`, then replace

```tsx
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: C.scrim, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable
          onPress={() => {}}
          style={{
```

with

```tsx
      {/* The scrim closes on a tap; screen readers close with their own escape gesture or Back, so neither layer is announced. */}
      <Pressable onPress={onClose} accessible={false} style={{ flex: 1, backgroundColor: C.scrim, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable
          onPress={() => {}}
          accessible={false}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={{
```

and replace the title line

```tsx
            <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{title}</Text>
```

with

```tsx
            <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
              {title}
            </Text>
```

- [ ] **Step 5: `src/ui/TopBar.tsx`**

Replace `import { C, F, S } from './theme';` with `import { C, F, lh, S } from './theme';`. Replace

```tsx
          <Text numberOfLines={1} style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>
```

with

```tsx
          <Text numberOfLines={1} accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
```

and

```tsx
            <Text numberOfLines={1} style={{ color: C.textDim, fontSize: F.small, fontWeight: '500' }}>
```

with

```tsx
            <Text numberOfLines={1} style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>
```

- [ ] **Step 6: `src/ui/DateStrip.tsx`**

The selected day sits on the teal. On lines 60–62 change all three `C.white` to `C.onAccent`:

```bash
sed -i '' 's/C\.white/C.onAccent/g' src/ui/DateStrip.tsx
```

Run: `grep -c "C.onAccent" src/ui/DateStrip.tsx; grep -rn "lineHeight: [0-9]" src`
Expected: `3`; no output from the second grep.

- [ ] **Step 7: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, 664 tests passing.

- [ ] **Step 8: Commit**

```bash
git status --short | grep -E "src/(core|store)/"   # must print nothing
git add src/ui
git commit -m "$(cat <<'EOF'
Design: buttons, chips, switches, segmented tabs and text boxes say what they are and whether they are on, none is smaller than a finger, and a sheet's buttons are reachable by screen readers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Words on the teal are dark ink; teal words are the deeper teal

**Files:**
- Modify: 27 files with teal words (Step 1), five files with teal-when-selected words (Step 2), 12 files with white on teal plus `src/app/admin.tsx` (Step 3)

**Interfaces:**
- Consumes: `C.accentText`, `C.onAccent` (Task 1).
- Produces: the rule later plans follow: a teal fill (`C.accent`) carries `C.onAccent`; teal words and teal icons beside words use `C.accentText`; `C.accent` stays for fills, rings, bars and ticks.

- [ ] **Step 1: Teal words become `accentText`**

```bash
grep -rlE "<(Micro|Small) color=\{C\.accent\}>|color: C\.accent, (fontSize|marginBottom)" src/app src/components src/services \
  | xargs sed -i '' -E 's/<(Micro|Small) color=\{C\.accent\}>/<\1 color={C.accentText}>/g; s/color: C\.accent, (fontSize|marginBottom)/color: C.accentText, \1/g'
```

It changes these 44 places (`<Micro color={C.accent}>` → `<Micro color={C.accentText}>`, `<Small color={C.accent}>` → `<Small color={C.accentText}>`, `color: C.accent, fontSize` → `color: C.accentText, fontSize`, `color: C.accent, marginBottom` → `color: C.accentText, marginBottom`):
`src/app/journey.tsx:50,128`; `src/app/session.tsx:132,239`; `src/app/login.tsx:90,110`; `src/app/history.tsx:68`; `src/app/(tabs)/index.tsx:187,196`; `src/app/onboarding.tsx:109`; `src/app/welcome.tsx:49,134`; `src/app/(tabs)/coach.tsx:66,333,368`; `src/app/(tabs)/mind.tsx:276`; `src/app/plan.tsx:173,252`; `src/app/(tabs)/fit.tsx:146`; `src/components/ActivityPanel.tsx:77,101`; `src/components/StartHereCard.tsx:45,48`; `src/components/CustomFoodForm.tsx:75`; `src/components/BreakToast.tsx:59`; `src/components/PlanCard.tsx:63`; `src/components/BreakPanel.tsx:33`; `src/components/SlotEditor.tsx:132`; `src/components/NutrientCard.tsx:35`; `src/components/RoutineCard.tsx:202,217,254`; `src/components/PlanTodayCard.tsx:100,119`; `src/components/IntakeCard.tsx:33`; `src/components/TomorrowCard.tsx:77`; `src/components/FitsCard.tsx:79,133,145,157`; `src/components/NudgeToast.tsx:48`; `src/components/YogaPanel.tsx:95,164`; `src/services/feedback.tsx:125`.

Left as `C.accent` on purpose (icons and fills): `tour.tsx:14` and `memory.tsx:11` (Task 6 moves both to `accentText` names), `AIBadge.tsx:11` (a dot), `(tabs)/fit.tsx:91` (a bar).

- [ ] **Step 2: Teal-when-selected words**

```bash
sed -i '' -E 's/\? C\.accent : C\.text(Dim|Faint)/? C.accentText : C.text\1/g' \
  src/app/sleep.tsx "src/app/(tabs)/fit.tsx" src/components/WeekGrid.tsx src/components/TabBar.tsx src/components/FitsCard.tsx
```

It changes: `sleep.tsx:121` (`s.score >= 70 ? C.accentText : C.textDim`), `(tabs)/fit.tsx:100` and `:102` (`doneToday.status === 'done' ? C.accentText : C.textFaint`, an icon and its words), `(tabs)/fit.tsx:193`, `WeekGrid.tsx:47` (`isToday ? C.accentText : C.textFaint`), `TabBar.tsx:44` and `:64` (the focused tab's icon and label), `FitsCard.tsx:113`.

- [ ] **Step 3: White on teal becomes `onAccent`**

Two hand edits first, because their white is not on teal:

In `src/components/YogaPanel.tsx` (line 94) replace

```tsx
paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.white }}>
```

with

```tsx
paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.card }}>
```

(its label on line 95 is already `C.accentText` from Step 1: teal words on a card.)

In `src/app/admin.tsx` (line 90) replace

```tsx
<Pill label={t('admin_blocked')} color={C.red} textColor={C.white} />
```

with

```tsx
<Pill label={t('admin_blocked')} color={C.redSoft} textColor={C.red} />
```

Then, in these files every remaining `C.white` sits on a teal fill (a primary `Btn`'s icon, a selected day or routine, the coach's own bubble, a teal button):

```bash
sed -i '' 's/C\.white/C.onAccent/g' src/app/login.tsx src/app/plan.tsx src/app/welcome.tsx "src/app/(tabs)/coach.tsx" src/app/settings.tsx \
  src/components/ActivityPanel.tsx src/components/RecipeSheet.tsx src/components/BreakOverlay.tsx src/components/GrocerySheet.tsx \
  src/components/AwayCard.tsx src/components/TabBar.tsx src/components/YogaPanel.tsx
```

It changes: `login.tsx:86`; `plan.tsx:166,167,216`; `welcome.tsx:41,59,146`; `(tabs)/coach.tsx:387,456`; `settings.tsx:102` (the admin pill: `textColor={C.onAccent}`); `ActivityPanel.tsx:186`; `RecipeSheet.tsx:72`; `BreakOverlay.tsx:183`; `GrocerySheet.tsx:64`; `AwayCard.tsx:30`; `TabBar.tsx:92` (the centre ➕; dark ink is 9.5:1 on the dark-mode cyan it turns on the log screen and 3.4:1 on the light-mode one, enough for an icon; the tab-bar plan rebuilds this button); `YogaPanel.tsx:91,92,120,151,158,180`.

Run: `grep -rnE "<(Micro|Small) color=\{C\.accent\}>|color: C\.accent, (fontSize|marginBottom)" src; grep -rn "C\.white" src | grep -v "src/ui/theme.ts"`
Expected: the first grep prints nothing; the second prints only art and the plain logo: `src/ui/charts.tsx:161`, `src/ui/Mountain.tsx:69`, `src/ui/Mountain.tsx:97`, `src/ui/Logo.tsx:17`.

- [ ] **Step 4: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, 664 tests passing.

- [ ] **Step 5: Commit**

```bash
git status --short | grep -E "src/(core|store)/"   # must print nothing
git add src/app src/components src/services
git commit -m "$(cat <<'EOF'
Design: words and icons on the teal are dark ink and teal words are a deeper teal on every screen, so both read at 4.5:1 in light and dark

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Flat surfaces

**Files:**
- Create: `src/ui/Banner.tsx`
- Delete: `src/ui/GradientBanner.tsx`
- Modify: `src/app/(tabs)/index.tsx` (imports lines 42–44, the hero block lines 137–143)
- Modify: `src/components/Celebration.tsx` (imports lines 9 and 11, the banner block lines 51–58)
- Modify: `src/ui/theme.ts` (drop `heroFrom`, `heroTo` from both palettes)
- Modify: `src/i18n/index.ts` (add `points_n` to `en`, `mr`, `hi`)

**Interfaces:**
- Consumes: `C.cardAlt`, `C.cardHigh`, `C.redSoft`, `C.red`, `C.accent`, `C.accentDim`, `C.accentText`, `F`, `lh`, `S`.
- Produces: `Banner({ children, style?, over? })` and `BannerBar({ value, max, over? })` in `src/ui/Banner.tsx`; i18n key `points_n` ("{n} points"). Removes `GradientBanner`, `C.heroFrom`, `C.heroTo`.

- [ ] **Step 1: Create `src/ui/Banner.tsx`**

```tsx
import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { C, S } from './theme';

/**
 * A flat panel for the one number a screen is about: a quiet surface on a
 * hairline, with no gradient and nothing drawn behind it. `over` turns it to
 * the soft red of a warning. Use the normal text colours inside.
 */
export function Banner({ children, style, over }: { children: React.ReactNode; style?: ViewStyle; over?: boolean }) {
  return (
    <View
      style={[
        { borderRadius: S.radiusSm, borderWidth: S.hairline, padding: S.padLg, gap: 12 },
        { backgroundColor: over ? C.redSoft : C.cardAlt, borderColor: over ? C.red : C.border },
        style,
      ]}>
      {children}
    </View>
  );
}

/** The banner's progress bar: the accent on a quiet track, red once past the end. */
export function BannerBar({ value, max, over }: { value: number; max: number; over?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: C.cardHigh, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: over ? C.red : C.accent }} />
    </View>
  );
}
```

Then: `git rm src/ui/GradientBanner.tsx`

- [ ] **Step 2: Today's number on the flat panel (`src/app/(tabs)/index.tsx`)**

Delete the import line `import { BannerBar, GradientBanner } from '../../ui/GradientBanner';` and put `import { Banner, BannerBar } from '../../ui/Banner';` directly above `import { Card, Divider, ListRow, MeterRow, Micro, Quote, Row, Small } from '../../ui/components';`.

Replace (state after Tasks 1–4)

```tsx
        {/* The one number the day is about, on the brand gradient: what is left, and how far through the day's food. */}
        <GradientBanner from={over ? C.red : C.heroFrom} to={over ? C.amber : C.heroTo}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: F.small, fontWeight: '500' }}>{over ? t('kcal_over') : t('kcal_left')}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: F.number, fontWeight: '500', lineHeight: lh(F.number, true) }}>{Math.abs(dayBudget.remaining).toLocaleString()}</Text>
          <BannerBar value={dayBudget.consumed} max={dayBudget.target} />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: F.small, fontWeight: '500' }}>
```

with

```tsx
        {/* The one number the day is about, on a flat panel: what is left, and how far through the day's food. */}
        <Banner over={over}>
          <Micro color={over ? C.red : C.textDim}>{over ? t('kcal_over') : t('kcal_left')}</Micro>
          <Text style={{ color: over ? C.red : C.text, fontSize: F.number, fontWeight: '500', lineHeight: lh(F.number, true) }}>{Math.abs(dayBudget.remaining).toLocaleString()}</Text>
          <BannerBar value={dayBudget.consumed} max={dayBudget.target} over={over} />
          <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>
```

(the template string after `>` on that last line stays as it is), and replace the closing

```tsx
        </GradientBanner>
        <View style={{ gap: 13 }}>
```

with

```tsx
        </Banner>
        <View style={{ gap: 13 }}>
```

- [ ] **Step 3: The win sheet (`src/components/Celebration.tsx`)**

Replace `import { GradientBanner } from '../ui/GradientBanner';` with `import { Banner } from '../ui/Banner';` and `import { C, F } from '../ui/theme';` with `import { C, F, lh } from '../ui/theme';`. Replace

```tsx
      <GradientBanner style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ fontSize: 64 }}>{icon}</Text>
        <Text style={{ color: '#FFFFFF', fontSize: F.title, fontWeight: '500', textAlign: 'center' }}>{title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: F.body, fontWeight: '500', textAlign: 'center' }}>{sub}</Text>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 }}>
          <Text style={{ color: '#FFFFFF', fontSize: F.small, fontWeight: '500' }}>{`${g.points} XP · ${t(`level_${g.level.key}`)}`}</Text>
        </View>
      </GradientBanner>
```

with

```tsx
      <Banner style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ fontSize: 64 }}>{icon}</Text>
        <Text style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500', textAlign: 'center' }}>{title}</Text>
        <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400', textAlign: 'center' }}>{sub}</Text>
        <View style={{ backgroundColor: C.accentDim, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 }}>
          <Text style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{`${fill(t('points_n'), { n: g.points })} · ${t(`level_${g.level.key}`)}`}</Text>
        </View>
      </Banner>
```

`fill` is already imported there (`import { fill, makeT } from '../i18n';`).

- [ ] **Step 4: Add `points_n` to the three dicts**

Run: `grep -nE "^  points_n:" src/i18n/index.ts`
Expected: no output.

In `src/i18n/index.ts` add one line just above each dict's closing `};`:
- `en` (after `  intake_open_plan: 'Open the plan',`): `  points_n: '{n} points',`
- `mr` (after `  intake_open_plan: 'नियोजन उघडा',`): `  points_n: '{n} गुण',`
- `hi` (after `  intake_open_plan: 'प्लान खोलें',`): `  points_n: '{n} अंक',`

- [ ] **Step 5: Drop the gradient colours from `src/ui/theme.ts`**

In `DARK` delete the two lines `  heroFrom: '#0FA67E',` and `  heroTo: '#1386B8',`; in `LIGHT` delete `  heroFrom: '#12A57F',` and `  heroTo: '#0B8FC2',`.

Run: `grep -rn "heroFrom\|heroTo\|GradientBanner\|#FFFFFF\|rgba(255" src/app src/components src/ui | grep -v "src/ui/theme.ts\|__tests__"`
Expected: no output.

(The mountain's sky gradient in `Mountain.tsx` and the logo's gradient stay: one is art that the Streak living tile replaces later, the other is the brand mark.)

- [ ] **Step 6: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, 664 tests passing.

- [ ] **Step 7: Commit**

```bash
git status --short | grep -E "src/(core|store)/"   # must print nothing
git add src/ui "src/app/(tabs)/index.tsx" src/components/Celebration.tsx src/i18n/index.ts
git commit -m "$(cat <<'EOF'
Design: the day's number and the win sheet sit on a flat panel with no gradient and no decorative circles, in the normal text colours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The phone's own font, and the app follows the phone

**Files:**
- Delete: `public/fonts/Mukta_400Regular.woff2`, `Mukta_500Medium.woff2`, `Mukta_600SemiBold.woff2`
- Modify: `package.json`, `package-lock.json` (via `npm uninstall`)
- Rewrite: `src/app/+html.tsx`
- Modify: `app.json` (`userInterfaceStyle` line 12, `expo-splash-screen` plugin lines 38–45, `expo-notifications` color line 48, `primaryColor` and `androidStatusBar` lines 74–78)
- Modify: `public/manifest.json` (lines 9–10)
- Modify: `src/app/_layout.tsx` (imports, `Themed` lines 44–65, the `StatusBar` line 101)
- Modify: `src/app/tour.tsx` (lines 13–17, 51, 63, 65), `src/app/memory.tsx` (lines 10–16, 88)

**Interfaces:**
- Consumes: `themeMode()`, `applyTheme`, `C` from `src/ui/theme.ts`; `SystemUI.setBackgroundColorAsync` from `expo-system-ui`; `StatusBar` `style` from `expo-status-bar`.
- Produces: no new exports. Native text has no `fontFamily` (already true: the only one left is the monospace command box in `OllamaSetup.tsx:76`, kept); web text uses `system-ui, Roboto, "Noto Sans Devanagari", sans-serif`; `<html lang>` follows `profile.lang`; colour lists in screens hold token names (`keyof typeof C`), read at render.

- [ ] **Step 1: Remove Mukta**

```bash
git rm -r public/fonts
npm uninstall @expo-google-fonts/mukta
```

Expected: `removed 1 package` (npm also rewrites `package-lock.json`). `grep -rn "Mukta\|google-fonts" src package.json app.json` prints nothing after Step 2. (The service worker's `/fonts/` cache rule in `public/sw.js` is generic and stays.)

- [ ] **Step 2: Rewrite `src/app/+html.tsx`**

`lang` stays `"en"` in the static shell because it is rendered at build time, before any profile is known; the app sets the real language at runtime in Step 4.

```tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React, { type PropsWithChildren } from 'react';

/**
 * Make the page behave like an app rather than a document: no bounce at the
 * edges, no text selection or long-press callouts on controls, no tap
 * highlight, and inputs at 16px so iOS does not zoom into them. Pinch zoom is
 * left alone: anyone can enlarge the page.
 *
 * Text uses the phone's own font: the system face, Roboto on Android, and
 * Noto Sans Devanagari for Marathi and Hindi where the system face has none.
 * Icons set their own font inline and are left alone.
 */
const APP_CSS = `
#root div[dir="auto"]:not([style*="font-family"]), #root input, #root textarea, #root button { font-family: system-ui, Roboto, "Noto Sans Devanagari", sans-serif; }
html, body { background: #F2F6F7; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
@media (prefers-color-scheme: dark) { html, body { background: #0B1014; } }
body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-text-size-adjust: 100%; }
input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; font-size: 16px !important; }
`;

/**
 * The HTML shell around every statically rendered page. It carries what a
 * browser needs before the app loads: the iPhone home-screen icon and title,
 * the web-app manifest, and the phone's light or dark background so there is
 * no flash. The app then sets the language and the chosen look (_layout.tsx).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Roz thoda, fit sada. A local-first health companion. Food, sleep, movement and mind, with the AI on your own PC." />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F6F7" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B1014" />
        <meta name="color-scheme" content="light dark" />
        {/* Pinned to an iPhone home screen: this icon and name, and no Safari chrome around the app. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Sobat" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: APP_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Gone: the three `@font-face` rules, `maximum-scale=1` and `shrink-to-fit=no` from the viewport, `touch-action: pan-x pan-y` and the `gesturestart`/`gesturechange` script that blocked pinch zoom.

- [ ] **Step 3: `app.json` and the web manifest**

In `app.json`:

Replace `    "userInterfaceStyle": "dark",` with `    "userInterfaceStyle": "automatic",`.

Replace the `expo-splash-screen` options object

```json
        {
          "backgroundColor": "#0A0B10",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 120
        }
```

with

```json
        {
          "backgroundColor": "#F2F6F7",
          "image": "./assets/images/android-icon-foreground.png",
          "imageWidth": 192,
          "dark": {
            "backgroundColor": "#0B1014",
            "image": "./assets/images/android-icon-foreground.png"
          }
        }
```

(`splash-icon.png` is a white mark that vanishes on a light splash; the adaptive icon's teal mark reads on both. That image has more padding, so 192 keeps the mark at the same 75-point size the old 120 gave.)

Replace `          "color": "#5B86F5",` (the `expo-notifications` options) with `          "color": "#12A57F",`.

Replace

```json
    "primaryColor": "#5B86F5",
    "androidStatusBar": {
      "barStyle": "light-content",
      "backgroundColor": "#111F1C"
    },
```

with

```json
    "primaryColor": "#12A57F",
```

(`androidStatusBar` is deprecated in SDK 57; the status bar's style is set at runtime in Step 4, and Android draws edge to edge, so its background is the app's own.)

In `public/manifest.json` replace both `"#0A0B10"` values (`background_color`, `theme_color`) with `"#0B1014"`, the real dark background:

```bash
sed -i '' 's/"#0A0B10"/"#0B1014"/g' public/manifest.json
```

Run: `npx expo config --type public --json 2>/dev/null | node -e "const c=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(c.userInterfaceStyle, c.primaryColor, 'androidStatusBar' in c)"`
Expected: `automatic #12A57F false`

- [ ] **Step 4: Status bar, root view and page language (`src/app/_layout.tsx`)**

Add after `import { StatusBar } from 'expo-status-bar';`:

```tsx
import * as SystemUI from 'expo-system-ui';
```

In `Themed`, replace

```tsx
  const [applied, setApplied] = useState<string>(`${themeMode()}-1`);
  useLayoutEffect(() => {
    applyTheme(mode);
    applyTextScale(scale);
    // Deliberate: the remount must follow the palette swap, and nothing else re-renders this subtree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplied(`${mode}-${scale}`);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.background = C.bg;
      document.body.style.background = C.bg;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', C.bg);
    }
  }, [mode, scale]);
```

with

```tsx
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
      document.body.style.background = C.bg;
      // Both theme-color tags (light and dark) take the chosen look, so the setting beats the phone's when they differ.
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', C.bg));
    } else {
      // The root view behind the app, seen in screen transitions and behind the keyboard, takes the same colour.
      SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});
    }
  }, [mode, scale]);
  // The page's language follows the profile, so screen readers and the browser read Marathi and Hindi as such.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);
```

(The existing `eslint-disable-next-line` comment is kept as it is; no new one is added.)

In `AppShell`, replace

```tsx
      <StatusBar style={C.bg === '#F4F5F9' ? 'dark' : 'light'} />
```

with

```tsx
      {/* Dark icons on a light page, light icons on a dark one. AppShell remounts with the theme, so this is read fresh. */}
      <StatusBar style={themeMode() === 'light' ? 'dark' : 'light'} />
```

(The old comparison was against a light background this palette no longer has, so the status bar was always light.)

- [ ] **Step 5: Colours read at render in `src/app/tour.tsx` and `src/app/memory.tsx`**

Both files captured `C.*` values when the module loaded, so after a switch to light they kept the dark palette's colours.

`src/app/tour.tsx`: replace

```tsx
const PAGES: { icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { icon: 'pie-chart-outline', color: C.accent },
  { icon: 'restaurant-outline', color: C.cyan },
  { icon: 'scale-outline', color: C.green },
];
```

with

```tsx
// Colour names, not values: the palette changes with the theme, so each page reads C at render.
const PAGES: { icon: keyof typeof Ionicons.glyphMap; color: keyof typeof C }[] = [
  { icon: 'pie-chart-outline', color: 'accentText' },
  { icon: 'restaurant-outline', color: 'cyan' },
  { icon: 'scale-outline', color: 'green' },
];
```

Replace `  const p = PAGES[page];` with

```tsx
  const p = PAGES[page];
  const tint = C[p.color];
```

Replace `<Ionicons name={p.icon} size={40} color={p.color} />` with `<Ionicons name={p.icon} size={40} color={tint} />` and `<Text style={[MICRO, { color: p.color }]}>` with `<Text style={[MICRO, { color: tint }]}>`.

`src/app/memory.tsx`: replace

```tsx
const GROUPS: { type: MemoryType; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'fact', icon: 'person-outline', color: C.accent },
  { type: 'preference', icon: 'heart-outline', color: C.violet },
  { type: 'goal', icon: 'flag-outline', color: C.cyan },
  { type: 'correction', icon: 'create-outline', color: C.amber },
  { type: 'episode', icon: 'calendar-outline', color: C.textFaint },
];
```

with

```tsx
// Colour names, not values: the palette changes with the theme, so the list reads C at render.
const GROUPS: { type: MemoryType; icon: keyof typeof Ionicons.glyphMap; color: keyof typeof C }[] = [
  { type: 'fact', icon: 'person-outline', color: 'accentText' },
  { type: 'preference', icon: 'heart-outline', color: 'violet' },
  { type: 'goal', icon: 'flag-outline', color: 'cyan' },
  { type: 'correction', icon: 'create-outline', color: 'amber' },
  { type: 'episode', icon: 'calendar-outline', color: 'textFaint' },
];
```

and replace `<Ionicons name={g.icon} size={14} color={g.color} />` with `<Ionicons name={g.icon} size={14} color={C[g.color]} />`.

Run: `grep -rnE "^\s*\{ [a-z]+: '[^']+', [^}]*color: C\." src/app src/components`
Expected: no output.

- [ ] **Step 6: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, 664 tests passing.

The splash, `userInterfaceStyle` and notification colour only reach a phone through a new build (`eas build` or a local `npx expo run:android`, which regenerates the git-ignored `android/`). Do not run a build in this plan; the web preview in Task 8 checks the rest.

- [ ] **Step 7: Commit**

```bash
git status --short | grep -E "src/(core|store)/"   # must print nothing
git add package.json package-lock.json app.json public src/app/+html.tsx src/app/_layout.tsx src/app/tour.tsx src/app/memory.tsx
git commit -m "$(cat <<'EOF'
Design: the app follows the phone, light or dark, with the status bar, root view and splash to match; text uses the phone's own font, pinch zoom works on the web, and the page's language follows the profile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Plain words in all three languages

**Files:**
- Modify: `src/i18n/index.ts` (the values below, and new keys before each dict's closing `};`)
- Modify: `src/app/_layout.tsx` (the 13 `Stack.Screen` titles)
- Modify: `src/app/(tabs)/index.tsx` (lines 130, 290), `src/components/TopBarActions.tsx` (lines 27, 29), `src/app/session.tsx` (lines 27, 132, 137, 183), `src/app/(tabs)/fit.tsx` (line 193), `src/app/settings.tsx` (line 364), `src/app/journey.tsx` (line 58), `src/components/ActivityPanel.tsx` (lines 144, 151), `src/app/plan.tsx` (lines 247, 254), `src/components/FitsCard.tsx` (line 97)

**Interfaces:**
- Consumes: `t`, `fill`, `makeT` from `src/i18n`.
- Produces: i18n keys `hdr_admin`, `hdr_journey`, `hdr_history`, `hdr_plan`, `hdr_settings`, `hdr_photo`, `hdr_sleep`, `hdr_memory`, `hdr_guide`, `hdr_foods`, `hdr_recipes`, `hdr_session`, `hdr_scan`, `ollama_fallback_label`, `less`, `more`, `show_more`, `show_less` in `en`, `mr` and `hi`. Later plans reuse `less`/`more` for every − / + stepper and `show_more`/`show_less` for every fold.

- [ ] **Step 1: Replace the jargon values**

Each old line below appears once in `src/i18n/index.ts`; replace it whole.

| Line | Old | New |
|---|---|---|
| 207 (en) | `  verified_record: 'Verified record',` | `  verified_record: 'Exact',` |
| 1188 (mr) | `  verified_record: 'तपासलेली नोंद',` | `  verified_record: 'अचूक',` |
| 2174 (hi) | `  verified_record: 'जाँची गई प्रविष्टि',` | `  verified_record: 'सटीक',` |
| 209 (en) | `  bmr: 'BMR',` | `  bmr: 'Calories at rest',` |
| 1190 (mr) | `  bmr: 'बीएमआर',` | `  bmr: 'विश्रांतीतील कॅलरी',` |
| 2176 (hi) | `  bmr: 'बीएमआर',` | `  bmr: 'आराम में कैलोरी',` |
| 212 (en) | `  tef: 'TEF',` | `  tef: 'Digesting food',` |
| 1193 (mr) | `  tef: 'टीईएफ',` | `  tef: 'अन्न पचवणे',` |
| 2179 (hi) | `  tef: 'टीईएफ',` | `  tef: 'खाना पचाना',` |
| 213 (en) | `  tdee: 'TDEE',` | `  tdee: 'Daily burn',` |
| 1194 (mr) | `  tdee: 'टीडीईई',` | `  tdee: 'रोजचा खर्च',` |
| 2180 (hi) | `  tdee: 'टीडीईई',` | `  tdee: 'रोज़ का खर्च',` |
| 252 (en) | `  day_score: 'Day score',` | `  day_score: 'How the day went',` |
| 1238 (mr) | `  day_score: 'आजचे गुण',` | `  day_score: 'दिवस कसा गेला',` |
| 2218 (hi) | `  day_score: 'आज के अंक',` | `  day_score: 'दिन कैसा रहा',` |
| 365 (en) | `  act_math: '{met} MET × {kg} kg × time. Half of it ({back} kcal) is added to today\'s food; the rest stays a deficit.',` | `  act_math: 'Half of what this burns, {back} kcal, is added to today\'s food. The rest helps your goal.',` |
| 1351 (mr) | `  act_math: '{met} MET × {kg} किलो × वेळ. निम्म्या ({back} kcal) आजच्या जेवणात जोडल्या; बाकी तूट म्हणून राहतात.',` | `  act_math: 'यातल्या निम्म्या, {back} kcal, आजच्या जेवणात जोडल्या जातात. बाकीच्या तुमच्या ध्येयाला मदत करतात.',` |
| 2331 (hi) | `  act_math: '{met} MET × {kg} किलो × समय. आधी ({back} kcal) आज के खाने में जुड़ीं; बाकी घाटे में रहती हैं.',` | `  act_math: 'इसका आधा, {back} kcal, आज के खाने में जुड़ता है. बाकी आपके लक्ष्य में मदद करता है.',` |
| 410 (en) | `  plan_footer: 'Tap a food to swap it, − / + for how much,` (start of the line) | `  plan_footer: 'Tap a food to change it, − / + for how much,` (rest unchanged) |
| 432 (en) | `  fits_show_swaps: 'Swaps',` | `  fits_show_swaps: 'Other choices',` |
| 1418 (mr) | `  fits_show_swaps: 'बदल',` | `  fits_show_swaps: 'दुसरे पर्याय',` |
| 2398 (hi) | `  fits_show_swaps: 'बदलाव',` | `  fits_show_swaps: 'दूसरे विकल्प',` |
| 439 (en) | `  fits_full_day: 'Full-day sheet',` | `  fits_full_day: 'Whole day',` |
| 1425 (mr) | `  fits_full_day: 'पूर्ण दिवसाची शीट',` | `  fits_full_day: 'पूर्ण दिवस',` |
| 2405 (hi) | `  fits_full_day: 'पूरे दिन की शीट',` | `  fits_full_day: 'पूरा दिन',` |
| 441 (en) | `  fits_hint: 'Tap a line to log it. Shuffle for other plates. Swaps cost the same or less.',` | `  fits_hint: 'Tap a line to log it. Shuffle for other plates. Other choices have the same calories or fewer.',` |
| 530 (en) | `  oc_day_plan_tip: 'The What-fits card on Today has the same plan with swaps; each line logs with a tap.',` | `  oc_day_plan_tip: 'The What fits card on Today has the same plan with other choices; each line logs with a tap.',` |
| 753 (en) | `  xp: 'XP',` | `  xp: 'Points',` |
| 1739 (mr) | `  xp: 'XP',` | `  xp: 'गुण',` |
| 2719 (hi) | `  xp: 'XP',` | `  xp: 'अंक',` |
| 896 (en) | `Today's plan logs in one tap, and swaps are suggested when you slip.",` (end of `w_f7_b`) | `Today's plan logs in one tap, and other choices are suggested when you slip.",` |
| 912 (en) | `  routine_swap: 'Swap',` | `  routine_swap: 'Change',` |

The `bmr`, `tdee`, `tef` and `xp` lines are identical in `mr` and `hi` (and `xp` in all three): edit them by line number, the first in `mr`, the second in `hi`. The Marathi and Hindi `fits_hint`, `plan_footer`, `oc_day_plan_tip`, `w_f7_b` and `routine_swap` already say "बदल / पर्याय / विकल्प" in plain words and stay. `act_math` keeps receiving `met` and `kg` from `ActivityPanel.tsx:184`; `fill` ignores values a template no longer names.

`BMI` (a word most people know), `AI`, `PC`, `WHO`, `B12`, `GB`, `HTTPS`, `FAQ` and `OK` stay: they are names, not jargon in capitals.

- [ ] **Step 2: Add the new keys**

Run: `grep -nE "^  (hdr_[a-z]+|ollama_fallback_label|less|more|show_more|show_less):" src/i18n/index.ts`
Expected: no output.

In `en`, after `  points_n: '{n} points',` (added in Task 5) and before `};`, add:

```ts
  hdr_admin: 'Admin',
  hdr_journey: 'Journey',
  hdr_history: 'History',
  hdr_plan: 'Diet plan',
  hdr_settings: 'Settings',
  hdr_photo: 'Photo',
  hdr_sleep: 'Sleep',
  hdr_memory: 'Memory',
  hdr_guide: 'Guide',
  hdr_foods: 'Foods',
  hdr_recipes: 'Recipes',
  hdr_session: 'Workout',
  hdr_scan: 'Scan a barcode',
  ollama_fallback_label: 'Second address (Tailscale)',
  less: 'Less',
  more: 'More',
  show_more: 'Show more',
  show_less: 'Show less',
```

In `mr`, after `  points_n: '{n} गुण',`:

```ts
  hdr_admin: 'अ‍ॅडमिन',
  hdr_journey: 'प्रवास',
  hdr_history: 'इतिहास',
  hdr_plan: 'आहार नियोजन',
  hdr_settings: 'सेटिंग',
  hdr_photo: 'फोटो',
  hdr_sleep: 'झोप',
  hdr_memory: 'आठवण',
  hdr_guide: 'मार्गदर्शक',
  hdr_foods: 'पदार्थ',
  hdr_recipes: 'रेसिपी',
  hdr_session: 'व्यायाम',
  hdr_scan: 'बारकोड स्कॅन',
  ollama_fallback_label: 'दुसरा पत्ता (Tailscale)',
  less: 'कमी',
  more: 'जास्त',
  show_more: 'आणखी दाखवा',
  show_less: 'कमी दाखवा',
```

In `hi`, after `  points_n: '{n} अंक',`:

```ts
  hdr_admin: 'एडमिन',
  hdr_journey: 'सफ़र',
  hdr_history: 'इतिहास',
  hdr_plan: 'डाइट प्लान',
  hdr_settings: 'सेटिंग',
  hdr_photo: 'फ़ोटो',
  hdr_sleep: 'नींद',
  hdr_memory: 'याद',
  hdr_guide: 'गाइड',
  hdr_foods: 'खाने',
  hdr_recipes: 'विधियाँ',
  hdr_session: 'व्यायाम',
  hdr_scan: 'बारकोड स्कैन',
  ollama_fallback_label: 'दूसरा पता (Tailscale)',
  less: 'कम',
  more: 'ज़्यादा',
  show_more: 'और दिखाएँ',
  show_less: 'कम दिखाएँ',
```

(The `mr` and `hi` values reuse the words those dicts already use: `diet_title`, `history`, `settings`, `sleep_title`, `foods`, `recipes`.)

- [ ] **Step 3: Header titles from i18n (`src/app/_layout.tsx`)**

`AppShell` already has `const t = makeT(appState.profile.lang);`. Replace each title:

| Replace | With |
|---|---|
| `<Stack.Screen name="admin" options={{ title: 'Admin' }} />` | `<Stack.Screen name="admin" options={{ title: t('hdr_admin') }} />` |
| `<Stack.Screen name="journey" options={{ title: 'Journey' }} />` | `<Stack.Screen name="journey" options={{ title: t('hdr_journey') }} />` |
| `<Stack.Screen name="history" options={{ title: 'History' }} />` | `<Stack.Screen name="history" options={{ title: t('hdr_history') }} />` |
| `<Stack.Screen name="plan" options={{ title: 'Diet plan' }} />` | `<Stack.Screen name="plan" options={{ title: t('hdr_plan') }} />` |
| `<Stack.Screen name="settings" options={{ title: 'Settings' }} />` | `<Stack.Screen name="settings" options={{ title: t('hdr_settings') }} />` |
| `<Stack.Screen name="photo" options={{ title: 'Photo' }} />` | `<Stack.Screen name="photo" options={{ title: t('hdr_photo') }} />` |
| `<Stack.Screen name="sleep" options={{ title: 'Sleep' }} />` | `<Stack.Screen name="sleep" options={{ title: t('hdr_sleep') }} />` |
| `<Stack.Screen name="memory" options={{ title: 'Memory' }} />` | `<Stack.Screen name="memory" options={{ title: t('hdr_memory') }} />` |
| `<Stack.Screen name="guide" options={{ title: 'Guide' }} />` | `<Stack.Screen name="guide" options={{ title: t('hdr_guide') }} />` |
| `<Stack.Screen name="foods" options={{ title: 'Foods' }} />` | `<Stack.Screen name="foods" options={{ title: t('hdr_foods') }} />` |
| `<Stack.Screen name="recipes" options={{ title: 'Recipes' }} />` | `<Stack.Screen name="recipes" options={{ title: t('hdr_recipes') }} />` |
| `<Stack.Screen name="session" options={{ title: 'Session' }} />` | `<Stack.Screen name="session" options={{ title: t('hdr_session') }} />` |
| `<Stack.Screen name="scan" options={{ title: 'Scan' }} />` | `<Stack.Screen name="scan" options={{ title: t('hdr_scan') }} />` |

Run: `grep -n "title: '" src/app/_layout.tsx`
Expected: no output.

- [ ] **Step 4: The other hard-coded English and the jargon in code**

`src/app/(tabs)/index.tsx`:
- line 130: replace ``  const titleName = `${greeting}, ${state.profile.name || 'there'}`;`` with ``  const titleName = state.profile.name ? `${greeting}, ${state.profile.name}` : greeting;``
- line 290: replace ``<Micro color={C.textDim}>{`${t('more_today')} · ${t('day_score')} ${score.total}`}</Micro>`` with `<Micro color={C.textDim}>{t('more_today')}</Micro>` (the score is still shown by `DayScoreCard`, which reads "How the day went").

`src/components/TopBarActions.tsx`:
- line 27: replace ``<StatusChip label={`${streak}d`} color={C.amber} />`` with ``<StatusChip label={`${streak} ${t('streak_days')}`} color={C.amber} />``
- line 29: replace ``<View accessibilityLabel={`${streak} day streak`}`` with ``<View accessibilityLabel={`${streak} ${t('streak_days')}`}``

`src/app/session.tsx` (it forced English for one line):
- delete line 27, `  const en = makeT('en');`
- line 132: replace `{en(done ? 'session_complete' : 'session_stopped')}` with `{t(done ? 'session_complete' : 'session_stopped')}`
- line 137: replace ``<Micro>{`${elapsedMinutes} min`}</Micro>`` with ``<Micro>{`${elapsedMinutes} ${t('act_min')}`}</Micro>``
- line 183: replace ``<Micro>{`${Math.round(totalSeconds(steps) / 60)} min`}</Micro>`` with ``<Micro>{`${Math.round(totalSeconds(steps) / 60)} ${t('act_min')}`}</Micro>``

`src/app/(tabs)/fit.tsx` line 193: replace ``` `${t('done')} · ${w.minutes} min` ``` with ``` `${t('done')} · ${w.minutes} ${t('act_min')}` ```.

`src/app/settings.tsx` line 364: replace `<Field label="Fallback (Tailscale)"` with `<Field label={t('ollama_fallback_label')}`.

`src/app/journey.tsx` line 58: replace

```tsx
          <Micro>{g.level.next ? `${g.points} / ${g.level.next} ${t('xp')}` : `${g.points} ${t('xp')}`}</Micro>
```

with

```tsx
          <Micro>{fill(t('points_n'), { n: g.level.next ? `${g.points} / ${g.level.next}` : g.points })}</Micro>
```

- [ ] **Step 5: Icon-only buttons in shared components get names**

`src/components/ActivityPanel.tsx`:
- line 144: replace `onPress={() => setMinutes((m) => Math.max(5, m - 5))} accessibilityLabel="−"` with `onPress={() => setMinutes((m) => Math.max(5, m - 5))} accessibilityRole="button" accessibilityLabel={t('less')}`
- line 151: replace `onPress={() => setMinutes((m) => Math.min(300, m + 5))} accessibilityLabel="+"` with `onPress={() => setMinutes((m) => Math.min(300, m + 5))} accessibilityRole="button" accessibilityLabel={t('more')}`

`src/app/plan.tsx` (28-point buttons; a hit slop of 8 makes them 44):
- line 247: replace `onPress={() => changeQty(meal.id, i, line, -1)} hitSlop={6} accessibilityLabel="−"` with `onPress={() => changeQty(meal.id, i, line, -1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('less')}`
- line 254: replace `onPress={() => changeQty(meal.id, i, line, 1)} hitSlop={6} accessibilityLabel="+"` with `onPress={() => changeQty(meal.id, i, line, 1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('more')}`

`src/components/FitsCard.tsx` line 97 (a 15-point chevron): replace

```tsx
<Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" hitSlop={8}>
```

with

```tsx
<Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={open ? t('show_less') : t('show_more')} accessibilityState={{ expanded: open }} hitSlop={15}>
```

- [ ] **Step 6: Check the words**

Run:

```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('src/i18n/index.ts', 'utf8');
const body = src.slice(src.indexOf('const en: Dict'), src.indexOf('const DICTS')).replace(/: Dict/g, '');
const { en, mr, hi } = new Function(body + '; return { en, mr, hi };')();
const own = (from, to) => new Set([...src.slice(src.indexOf(from), src.indexOf(to)).matchAll(/^  ([a-z0-9_]+):/gm)].map((m) => m[1]));
const M = own('const mr: Dict', 'const hi: Dict'), H = own('const hi: Dict', 'const DICTS');
const fresh = ['points_n','hdr_admin','hdr_journey','hdr_history','hdr_plan','hdr_settings','hdr_photo','hdr_sleep','hdr_memory','hdr_guide','hdr_foods','hdr_recipes','hdr_session','hdr_scan','ollama_fallback_label','less','more','show_more','show_less'];
for (const k of fresh) if (!(k in en) || !M.has(k) || !H.has(k)) console.log('MISSING', k);
const re = /TDEE|BMR|\bTEF\b|\bXP\b|\bMET\b|day score|swap|verified|full-day/i;
for (const [l, d] of Object.entries({ en, mr, hi })) for (const [k, v] of Object.entries(d)) if (re.test(v.replace(/\{[a-z]+\}/g, ''))) console.log('JARGON', l, k, v);
console.log('checked', Object.keys(en).length, 'keys');
"
```

Expected: only `checked 1199 keys` (1180 before this plan, plus `points_n` and the 18 above).

- [ ] **Step 7: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, 664 tests passing.

- [ ] **Step 8: Commit**

```bash
git status --short | grep -E "src/(core|store)/"   # must print nothing
git add src/i18n/index.ts src/app src/components
git commit -m "$(cat <<'EOF'
Plain words in English, Marathi and Hindi: no TDEE, BMR, XP, day score, swaps or verified record, every header title translated, and the minus, plus and fold buttons named for screen readers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: See it on screen

**Files:**
- None changed unless a check fails.

**Interfaces:**
- Consumes: everything above; `.claude/launch.json` configuration `sobat-web` (port 8082); `npm run seed` (`scripts/seed-state.js`, ten days of history for `localStorage['sobat.state.v1']`). `.env.local` sets `EXPO_PUBLIC_NO_AUTH=1`, so no sign-in is needed locally.
- Produces: screenshots for the final report.

- [ ] **Step 1: Start the preview and load ten days of history**

Start the `sobat-web` preview (`preview_start` with name `sobat-web`), then set the viewport to 375 × 812 (`resize_window` preset `mobile`, `colorScheme: "light"`). Run `npm run seed` in a terminal, and in the page run `localStorage.setItem('sobat.state.v1', <the printed JSON>); location.reload()` (via `javascript_tool`).

- [ ] **Step 2: Light, English, text size normal**

Open `http://localhost:8082/settings` and choose Appearance "Light", Language "English", Text size the second option (1×). Check and screenshot Today (`/`, `today-light-en.png`), Settings (`/settings`, `settings-light-en.png`) and the Food tab (`/food`, `food-light-en.png`):
- Today's number sits on a flat grey panel, no gradient, no circles; the label above it reads "kcal left" in normal case.
- Every label is in normal case; no word is spaced out.
- Primary buttons are teal with dark words; the selected segment's word is a deeper teal; toggles show a dark knob on teal when on.
- Header titles read "Settings" on `/settings`, "Diet plan" on `/plan`, "Workout" on `/session`.

- [ ] **Step 3: Dark, English**

Switch the preview to `colorScheme: "dark"` and, in `/settings`, Appearance to "System": the app turns dark with no reload. Screenshot Today (`today-dark-en.png`) and a sheet (on Today tap the water row or any button that opens a sheet: `sheet-dark-en.png`). Check: the panel and words are readable; dark ink on teal; the faint grey lines (empty states, the medical note) are clearly legible.

- [ ] **Step 4: Marathi at 1.25**

In `/settings` set Language "मराठी" and Text size the largest option (1.25). In light and in dark, screenshot Today (`today-light-mr-125.png`, `today-dark-mr-125.png`), Settings (`settings-dark-mr-125.png`) and the plan (`/plan`, `plan-light-mr-125.png`). Check:
- No matra is cut at the top or bottom of a line (look at ि, ी, ु, ू, ृ in the toggles' descriptions, the coach line and the meal rows).
- Header titles read "सेटिंग" on `/settings`, "आहार नियोजन" on `/plan`, "व्यायाम" on `/session`.
- No word anywhere reads TDEE, BMR, XP, "Swaps", "Day score", "Verified record" or "Full-day sheet" (`get_page_text` on `/`, `/food`, `/body` and `/progress`, in English and Marathi).

- [ ] **Step 5: The page itself**

Run in the page (`javascript_tool`):

```js
({
  lang: document.documentElement.lang,
  viewport: document.querySelector('meta[name="viewport"]').content,
  themeColors: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content),
  font: getComputedStyle(document.querySelector('#root div[dir="auto"]:not([style*="font-family"])')).fontFamily,
})
```

Expected: `lang` is `"mr"`; `viewport` has no `maximum-scale`; both theme colours equal the current background (`#0B1014` in dark, `#F2F6F7` in light); `font` starts with `system-ui`. `read_network_requests` with `urlPattern: "Mukta"` lists nothing.

- [ ] **Step 6: What screen readers get**

`read_page` with `filter: "interactive"` on `/settings` and on `/food`:
- Each toggle is a `switch` with its title as name and checked true or false.
- The section switch on Food is a `tablist` of `tab`s, one `selected`.
- Text boxes (Settings → AI addresses) have the field's label as their name.
- Every `Btn` is a `button` with its label.

- [ ] **Step 7: Final gate**

Run: `npx tsc --noEmit && npx expo lint && npx vitest run`
Expected: tsc clean, lint clean, 664 tests passing.

Reset the viewport (`resize_window` preset `desktop`) and stop the preview.

- [ ] **Step 8: Commit any fix**

If a check above failed and you fixed it, commit the fix on its own, naming the behaviour it restores (for example `git add src/ui/components.tsx && git commit -m "Design: ..."` with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer). If every check passed there is nothing to commit. Attach the screenshots to the final report. Do not push.

---

## Self-review

**Spec coverage for Plan 2** ("Part 2 → Style first" and Decisions 10–12):

| Spec item | Where |
|---|---|
| Type scale 44 / 20 / 16 / 13, weights 400 and 500 | Task 2 (`F`, Steps 4, 6, 7) |
| Line heights from size × text scale, no Devanagari clipping at 1.25× | Task 2 (`lh`, Step 5; tested), Task 3 (shared components), Task 8 Step 4 |
| `MICRO` normal case, no letter spacing; no ALL-CAPS labels | Task 2 Steps 3 and 8 |
| One teal accent; `onAccent` at 4.5:1 or more | Task 1 (light 5.62, dark 10.07; tested), Tasks 3–4 |
| `textGhost` not used for text; light `textFaint` at 4.5:1 or more | Task 1 (token removed; light 4.66 minimum) |
| No gradients, no decorative circles | Task 5 (`Banner`) |
| Native system font; web `system-ui, Roboto, "Noto Sans Devanagari", sans-serif`; Mukta removed from `public/fonts`, the CSS and the dependency | Task 6 Steps 1–2 |
| `userInterfaceStyle: "automatic"`; status bar from `themeMode()` | Task 6 Steps 3–4 |
| Controls at least 44 pt; `Btn`, `Pill`, `Toggle`, `Segmented` with roles and states; `Field` labels its input | Task 3; Task 7 Step 5 for icon-only buttons |
| No TDEE, BMR, XP, day score, swaps, verified record, full-day sheet in any language; header titles and hard-coded English in `i18n` | Task 7 |
| Follow the phone on the web too (background, theme colour, `lang`, pinch zoom); `tour.tsx` reads colours at render | Task 6 |

Beyond the spec but found on the way: `memory.tsx` captured colours at load like `tour.tsx`; the `Sheet`'s inner `Pressable` hid its buttons from VoiceOver; light-mode status colours (amber, red, green, cyan, pink) were below 4.5:1 as words; `session.tsx` forced one line into English.

**Left to later plans:**
- **Living tiles** (`src/components/tiles/`, `LivingTile`, the Water tank, `src/core/tiles.ts`): they consume `F.title`/`F.small`, `lh`, `S.touch`, `C.onAccent` and the identity colours from this plan. The mountain's sky gradient (`Mountain.tsx`) goes when the Streak tile replaces it.
- **Tab bar and Me**: the centre ➕'s cyan state and teal glow, tab items' `selected` state, `Sidebar`.
- **Today**: the hero is rebuilt around the week strip; `HeroRing.tsx` is already unused; `StartHereCard` and the mantra leave Today.
- **The add sheet**: no emoji in food rows (`FoodThumb` or an initial), the − / + stepper (reusing `less`/`more`), `FoodDetailSheet`'s fixed `QTYS`.
- **Plan next week, Progress, Setup**: the bar-chart day labels now at 13 points may truncate on 14-day charts until Progress is rebuilt; the onboarding placeholder "Varad"; per-screen 44-point audits for screen-local controls (for example the tour's dots and Skip link).
- **Reminders**: notification categories; the notification tint is already teal.
- Not changed on purpose: the logo gradient and the `Wordmark` size (brand), timer numbers sized to their ring, `apple-mobile-web-app-status-bar-style` (no automatic value exists), the English facts `DayReview` writes for the AI.
