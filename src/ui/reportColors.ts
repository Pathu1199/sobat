import { paletteOf, type PaletteId } from '../core/palette';
import type { ReportColors } from '../core/reportDoc';
import { PALETTE_SETS } from './theme';

/** The daylight colours of a palette (the default for one this build does not know): a report is printed, so it is always on white paper. */
export function reportColors(palette: PaletteId): ReportColors {
  const p = PALETTE_SETS[paletteOf(palette)].light;
  return { accent: p.accent, accentSoft: p.accentSoft, text: p.text, textDim: p.textDim, textFaint: p.textFaint, border: p.border, gold: p.gold, goldSoft: p.goldSoft, card: p.card, bg: p.bg, white: p.white };
}
