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
export const C = {
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

/** One step larger than before across the board: this is read on a phone, often outdoors. */
export const F = {
  display: 40,
  h1: 28,
  h2: 22,
  h3: 16,
  body: 15,
  small: 13,
  tiny: 12,
  micro: 11,
  hero: 52,
};

/** Small uppercase label style used for every section heading and stat caption. */
export const MICRO = {
  fontSize: F.micro,
  letterSpacing: 0.9,
  textTransform: 'uppercase' as const,
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
  if (value === null) return C.textGhost;
  if (value >= 80) return C.cyan;
  if (value >= 60) return C.accent;
  if (value >= 35) return C.amber;
  return C.red;
}
