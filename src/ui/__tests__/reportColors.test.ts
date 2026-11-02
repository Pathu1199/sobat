import { describe, expect, it } from 'vitest';
import { PALETTE_IDS } from '../../core/palette';
import { reportColors } from '../reportColors';
import { PALETTE_SETS } from '../theme';

describe('reportColors', () => {
  it('reads the daylight colours of the palette', () => {
    for (const id of PALETTE_IDS) {
      const p = PALETTE_SETS[id].light;
      expect(reportColors(id), id).toEqual({ accent: p.accent, accentSoft: p.accentSoft, text: p.text, textDim: p.textDim, textFaint: p.textFaint, border: p.border, gold: p.gold, goldSoft: p.goldSoft, card: p.card, bg: p.bg, white: p.white });
    }
  });
});
