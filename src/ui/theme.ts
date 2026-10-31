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
  cardPad: 18,
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
  /** The screen's side margin on a phone, from the edge to the cards. */
  gutter: 20,
  gutterWide: 24,
  maxWide: 1360,
};

/** Durations in ms. One curve for everything, ease-out cubic. */
export const M = { fast: 180, base: 320, slow: 600 };

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

/** The weight of a screen's title and of the one big number a screen is about; everything else is '400' or '500'. */
export const TITLE_WEIGHT = '600' as const;

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
