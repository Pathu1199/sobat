/**
 * Design tokens. Everything visual comes from here, so a change to the palette
 * moves the whole app at once.
 *
 * A fresh health palette: a leaf green as the brand colour with a teal
 * partner (the hero gradient and the logo run between them), soft
 * off-white or deep slate behind, and cards that float on a soft shadow
 * rather than sit inside a hard outline. Numbers are bold; labels are
 * small, uppercase and quiet.
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
  textFaint: '#6F8288',
  textGhost: '#465A61',

  accent: '#2DD4A3',
  accentSoft: '#145243',
  accentDim: '#10302A',

  cyan: '#38C6E8',
  cyanSoft: '#14566A',
  violet: '#A48BFF',
  violetSoft: '#463A86',
  green: '#3BD68B',
  amber: '#F5B941',
  amberSoft: '#6E4A12',
  red: '#F2677A',
  redSoft: '#5E2430',
  pink: '#F06AA7',

  white: '#FFFFFF',
  scrim: 'rgba(3, 8, 10, 0.72)',
  shadow: '#000000',
  heroFrom: '#0FA67E',
  heroTo: '#1386B8',
};

/** The same roles in daylight: paper-white panels, ink text, the accents a shade deeper so they hold on white. */
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
  textFaint: '#76878C',
  textGhost: '#A9B7BA',

  accent: '#12A57F',
  accentSoft: '#CFF1E6',
  accentDim: '#E7F7F2',

  cyan: '#0B9CC2',
  cyanSoft: '#CDEEF6',
  violet: '#6E52E6',
  violetSoft: '#E6E0FD',
  green: '#16A05E',
  amber: '#C98A0B',
  amberSoft: '#FBEBC6',
  red: '#D9445A',
  redSoft: '#FBDDE2',
  pink: '#D4478A',

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
  gutter: 16,
  gutterWide: 24,
  maxWide: 1360,
};

/** Durations in ms. One curve for everything, ease-out cubic. */
export const M = { fast: 180, base: 320, slow: 600 };

/** Base type sizes at scale 1. Read on a phone, often outdoors. */
const F_BASE = {
  display: 42,
  h1: 30,
  h2: 24,
  h3: 18,
  body: 17,
  small: 15,
  tiny: 13,
  micro: 12,
  hero: 54,
};

/** The live type sizes: F_BASE times the person's text-size setting. Mutated by applyTextScale, like C. */
export const F: typeof F_BASE = { ...F_BASE };
export const TEXT_SCALES = [0.9, 1, 1.12, 1.25] as const;
let scaleNow = 1;

export function textScale(): number {
  return scaleNow;
}

export function applyTextScale(scale: number): void {
  if (scale === scaleNow) return;
  scaleNow = scale;
  for (const k of Object.keys(F_BASE) as (keyof typeof F_BASE)[]) F[k] = Math.round(F_BASE[k] * scale);
  MICRO.fontSize = F.micro;
  listeners.forEach((fn) => fn());
}

/** Small uppercase label style used for every section heading and stat caption. */
export const MICRO = {
  fontSize: F.micro,
  fontWeight: '700' as const,
  letterSpacing: 0.7,
  textTransform: 'uppercase' as const,
};

export function severityColor(s: 'good' | 'watch' | 'act') {
  return s === 'good' ? C.accent : s === 'watch' ? C.amber : C.red;
}

export function readinessColor(l: 'green' | 'yellow' | 'red') {
  return l === 'green' ? C.accent : l === 'yellow' ? C.amber : C.red;
}

/** Green when the value is good, amber when it is not, quiet when unknown. */
export function scoreColor(value: number | null) {
  if (value === null) return C.textGhost;
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
