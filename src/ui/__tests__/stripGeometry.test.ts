import { describe, expect, it } from 'vitest';
import { STRIP_DAY_HEIGHT, stripDayWidth, stripRowWidth } from '../stripGeometry';
import { lh, S, scaledSizes, TEXT_SCALES } from '../theme';

/** A digit is about 0.6 of the type size wide (tabular figures). */
const DIGIT = 0.6;
const LARGEST = scaledSizes(TEXT_SCALES[TEXT_SCALES.length - 1]);

describe('the week strip on the narrowest phone', () => {
  it('seven days always fit the row: on a 320 point screen, inside Today’s card, nothing runs over', () => {
    for (const screen of [320, 360, 375, 414]) {
      const row = stripRowWidth(screen);
      // (Within a rounding error: a seventh is not a whole number of points.)
      expect(7 * stripDayWidth(row) - row, `${screen} pt`).toBeLessThanOrEqual(1e-9);
    }
    // 320 less the screen's padding (16) and the card's padding (20) and border (1) on each side.
    expect(stripRowWidth(320)).toBe(320 - 2 * (16 + 20 + 1));
  });

  it('a day narrower than a finger on a small phone still holds the date at the largest text size', () => {
    const day = stripDayWidth(stripRowWidth(320));
    expect(day).toBeLessThan(S.touch);
    // Two digits, less the chip's border on each side.
    expect(2 * DIGIT * LARGEST.body).toBeLessThanOrEqual(day - 2);
  });

  it('every day is a touch box at least a finger tall, and its weekday, date and dot fit in it at the largest text size', () => {
    expect(STRIP_DAY_HEIGHT).toBeGreaterThanOrEqual(S.touch);
    // The weekday, a gap, the date, a gap, the dot.
    expect(lh(LARGEST.small) + 3 + lh(LARGEST.body, true) + 3 + 8).toBeLessThanOrEqual(STRIP_DAY_HEIGHT);
  });
});
