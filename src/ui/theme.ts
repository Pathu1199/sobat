/**
 * Design tokens. Everything visual comes from here, so a change to the palette
 * moves the whole app at once.
 *
 * The language is a deep ink panel: a near-black with a faint indigo warmth,
 * cards a shade lighter with soft hairline edges, a calm indigo-blue as the
 * primary accent and a mint-cyan as its brighter partner. Secondary text is
 * kept readable on a phone in daylight. Numbers are light; labels are small,
 * uppercase and quiet.
 */
const listeners = new Set<() => void>();

export type ThemeMode = 'dark' | 'light';

const DARK = {
  bg: '#0A0B10',
  bgAlt: '#0E1017',
  card: '#141721',
  cardAlt: '#1B1F2B',
  cardHigh: '#222736',
  border: '#232838',
  borderStrong: '#323A4F',

  text: '#F2F4F8',
  textDim: '#A4ACBF',
  textFaint: '#6E778C',
  textGhost: '#474E60',

  accent: '#5B86F5',
  accentSoft: '#2B3F7A',
  accentDim: '#1C2540',

  cyan: '#3FD3E6',
  cyanSoft: '#17606B',
  violet: '#9B7CFF',
  violetSoft: '#4A3590',
  green: '#34C98E',
  amber: '#F0B23F',
  amberSoft: '#6E4A12',
  red: '#F06270',
  redSoft: '#6E2630',
  pink: '#F06AA7',

  white: '#FFFFFF',
  scrim: 'rgba(4, 6, 11, 0.7)',
};

/** The same roles in daylight: paper-white panels, ink text, the accents a shade deeper so they hold on white. */
const LIGHT: typeof DARK = {
  bg: '#F4F5F9',
  bgAlt: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#EEF1F7',
  cardHigh: '#E3E8F2',
  border: '#E1E5EE',
  borderStrong: '#C9D1E0',

  text: '#141826',
  textDim: '#4A536F',
  textFaint: '#7A8399',
  textGhost: '#A7AFC2',

  accent: '#3F6AE0',
  accentSoft: '#D5DEFB',
  accentDim: '#E7ECFC',

  cyan: '#0E9FB6',
  cyanSoft: '#CBEDF3',
  violet: '#7656EE',
  violetSoft: '#E5DEFE',
  green: '#1E9A67',
  amber: '#C4860E',
  amberSoft: '#FAE9C3',
  red: '#D7475A',
  redSoft: '#FAD8DD',
  pink: '#D4478A',

  white: '#FFFFFF',
  scrim: 'rgba(20, 24, 38, 0.45)',
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
  radius: 18,
  radiusSm: 13,
  radiusXs: 9,
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
  fontWeight: '600' as const,
  letterSpacing: 0.9,
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
