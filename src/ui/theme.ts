/**
 * Design tokens. Everything visual comes from here, so a change to the palette
 * moves the whole app at once.
 *
 * A sober health palette: one teal accent for actions, ticks and the current
 * item, soft off-white or deep slate behind, and flat cards on a hairline.
 * Every colour that carries words reads at 4.5:1 or more on the surfaces it
 * sits on (src/ui/__tests__/contrast.test.ts holds the palette to that).
 */
const listeners = new Set<() => void>();

export type ThemeMode = 'dark' | 'light';

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

export const PALETTES: Record<ThemeMode, typeof DARK> = { dark: DARK, light: LIGHT };

/**
 * The live palette. Every component reads from this object at render, so a
 * switch is an Object.assign plus a remount of the tree (ThemeProvider does
 * that); modules that bake colours into a StyleSheet subscribe to rebuild.
 */
export const C: typeof DARK = { ...DARK };
let current: ThemeMode = 'dark';

export function themeMode(): ThemeMode {
  return current;
}

export function applyTheme(mode: ThemeMode): void {
  if (mode === current) return;
  current = mode;
  Object.assign(C, PALETTES[mode]);
  listeners.forEach((fn) => fn());
}

export function onThemeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}


export const S = {
  gap: 12,
  pad: 16,
  padLg: 20,
  radius: 22,
  radiusSm: 15,
  radiusXs: 10,
  hairline: 1,
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

/** The lift under a card: soft and wide in daylight, barely there in the dark. */
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
