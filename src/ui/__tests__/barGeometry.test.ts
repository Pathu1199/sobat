import { describe, expect, it } from 'vitest';
import { BAR_HEIGHT, barHeight, PLUS_LIFT, PLUS_SIZE, TAB_GAP, TAB_ICON, TAB_LABEL, TAB_PAD, TAB_PILL, tabLabelSize } from '../barGeometry';
import { lh, S, TEXT_SCALES } from '../theme';

describe('the tab bar', () => {
  it('is 60 tall with icons 24, labels 12, the chosen pill 56 × 32 and ➕ 56 across, lifted half its height', () => {
    expect([BAR_HEIGHT, TAB_ICON, TAB_LABEL, PLUS_SIZE]).toEqual([60, 24, 12, 56]);
    expect(TAB_PILL).toEqual({ width: 56, height: 32 });
    expect(PLUS_LIFT).toBe(28);
  });

  it('scales its labels with the text size, in whole points', () => {
    expect(TEXT_SCALES.map(tabLabelSize)).toEqual([11, 12, 13, 15]);
  });

  it('holds the pill and a label with room for Devanagari matras at every text size, growing only past 60 when the label needs it', () => {
    // Every text size pinned: 0.9, 1, 1.12, 1.25.
    expect(TEXT_SCALES.map(barHeight)).toEqual([60, 60, 61, 64]);
    for (const scale of TEXT_SCALES) {
      const label = tabLabelSize(scale);
      expect(lh(label), `${scale}`).toBeGreaterThanOrEqual(label * 1.4);
      // Written out, not from the module's own sum: 4 above, the 32 point pill, 2 between, a label line with room for
      // matras (1.4 times its size), 4 below. A bar shorter than that clips Marathi and Hindi labels.
      expect(barHeight(scale), `${scale}`).toBeGreaterThanOrEqual(4 + 32 + 2 + Math.ceil(1.4 * label) + 4);
    }
  });

  it('gives each of five places a finger and more on a 320 point phone, the pill and ➕ inside its share', () => {
    const share = 320 / 5;
    expect(share).toBeGreaterThanOrEqual(S.touch);
    expect(TAB_PILL.width).toBeLessThanOrEqual(share);
    expect(PLUS_SIZE).toBeLessThanOrEqual(share);
  });
});
