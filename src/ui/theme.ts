/**
 * Design tokens. Everything visual comes from here, so a change to the palette
 * moves the whole app at once.
 *
 * The language is a blue-black instrument panel: near-black with a blue cast,
 * cards a shade lighter with hairline borders, electric blue as the primary
 * accent and cyan as its brighter partner. Numbers are large and light;
 * labels are tiny, uppercase and quiet.
 */
export const C = {
  bg: '#07090F',
  bgAlt: '#0B0E17',
  card: '#10131D',
  cardAlt: '#161A27',
  cardHigh: '#1B2030',
  border: '#1C2233',
  borderStrong: '#2A3247',

  text: '#E9EDF7',
  textDim: '#8992A8',
  textFaint: '#5A6379',
  textGhost: '#3A4256',

  accent: '#3B82F6',
  accentSoft: '#1E3A8A',
  accentDim: '#1A2744',

  cyan: '#22D3EE',
  cyanSoft: '#155E75',
  violet: '#8B5CF6',
  violetSoft: '#4C1D95',
  green: '#10B981',
  amber: '#F59E0B',
  amberSoft: '#78350F',
  red: '#EF4444',
  redSoft: '#7F1D1D',
  pink: '#EC4899',

  white: '#FFFFFF',
};

export const S = {
  gap: 12,
  pad: 16,
  padLg: 20,
  radius: 16,
  radiusSm: 12,
  radiusXs: 8,
  hairline: 1,
};

export const F = {
  display: 44,
  h1: 27,
  h2: 20,
  h3: 15,
  body: 14,
  small: 12,
  tiny: 11,
  micro: 10,
};

/** Tiny uppercase label style used for every section heading and stat caption. */
export const MICRO = {
  fontSize: F.micro,
  letterSpacing: 1.1,
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
