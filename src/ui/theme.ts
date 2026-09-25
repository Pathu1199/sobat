export const C = {
  bg: '#0B1412',
  bgAlt: '#111F1C',
  card: '#152826',
  cardAlt: '#1B332F',
  border: '#24423D',
  text: '#ECF6F3',
  textDim: '#9DB8B2',
  textFaint: '#6D8A84',
  teal: '#1D9E75',
  tealSoft: '#0F6E56',
  amber: '#EF9F27',
  amberSoft: '#854F0B',
  red: '#E24B4A',
  redSoft: '#791F1F',
  blue: '#378ADD',
  purple: '#7F77DD',
  white: '#FFFFFF',
};

export const S = {
  gap: 12,
  pad: 16,
  radius: 14,
  radiusSm: 10,
};

export const F = {
  h1: 26,
  h2: 19,
  h3: 16,
  body: 15,
  small: 13,
  tiny: 11,
};

export function severityColor(s: 'good' | 'watch' | 'act') {
  return s === 'good' ? C.teal : s === 'watch' ? C.amber : C.red;
}

export function readinessColor(l: 'green' | 'yellow' | 'red') {
  return l === 'green' ? C.teal : l === 'yellow' ? C.amber : C.red;
}
