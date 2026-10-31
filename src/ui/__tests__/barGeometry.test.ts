import { describe, expect, it } from 'vitest';
import { BAR_HEIGHT, barBottom, barHeight, clearOfBar, floatBottom, PLUS_CLEAR_GAP, PLUS_LIFT, PLUS_SIZE, TAB_ICON, TAB_LABEL, TAB_PILL, tabLabelSize } from '../barGeometry';
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

  it('pads under the tabs by the safe area, never less than 6 on the phone and 10 on the web', () => {
    expect(barBottom(34, true)).toBe(34);
    expect(barBottom(34, false)).toBe(34);
    expect(barBottom(0, false)).toBe(6);
    expect(barBottom(0, true)).toBe(10);
    expect(barBottom(8, false)).toBe(8);
  });

  it('keeps a floating thing 8 above the top of ➕: the bar, its padding and the lift, in points from the screen bottom', () => {
    expect(PLUS_CLEAR_GAP).toBe(8);
    // Written out, not from the module's own sum: 60 + 6 + 28 + 8, and 10 on the web; a 34 point inset replaces the padding.
    expect(clearOfBar(1, 0, false)).toBe(102);
    expect(clearOfBar(1, 0, true)).toBe(106);
    expect(clearOfBar(1, 34, false)).toBe(130);
    // The bar grows with the text size (64 at 1.25), and so does what must clear it.
    expect(clearOfBar(1.25, 34, false)).toBe(134);
  });
});

describe('floatBottom', () => {
  it('on a phone is the clearance above the bar and ➕, whatever gap a wide screen would take', () => {
    expect(floatBottom(false, 1, 0, false, 24)).toBe(clearOfBar(1, 0, false));
    expect(floatBottom(false, 1, 0, false, 20)).toBe(102);
    expect(floatBottom(false, 1.25, 34, true, 20)).toBe(clearOfBar(1.25, 34, true));
    // ➕'s top is at 60 + 6 + 28 = 94 from the screen bottom at the default text size; the old hard-coded 96 (the Break toast) left 2 points, and so does nothing now.
    expect(floatBottom(false, 1, 0, false, 20)).toBeGreaterThanOrEqual(94 + PLUS_CLEAR_GAP);
  });

  it('on a wide screen, which has no bar, is the gap above the bottom safe area', () => {
    expect(floatBottom(true, 1, 0, false, 24)).toBe(24);
    expect(floatBottom(true, 1.25, 20, true, 24)).toBe(44);
    expect(floatBottom(true, 1, 8, false, 20)).toBe(28);
  });
});
