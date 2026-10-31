import { describe, expect, it } from 'vitest';
import { STRIP_CORE, STRIP_DAY_HEIGHT, STRIP_DOT_SIZE, STRIP_EDGE, STRIP_MARGIN, STRIP_RING, stripDayWidth, stripRowWidth } from '../stripGeometry';
import { lh, S, scaledSizes, TEXT_SCALES } from '../theme';

/** A digit is about 0.6 of the type size wide (tabular figures). */
const DIGIT = 0.6;
const LARGEST = scaledSizes(TEXT_SCALES[TEXT_SCALES.length - 1]);

describe('the week strip on the narrowest phone', () => {
  it('seven days always fit the row: on a 320 point screen, across Today’s card, nothing runs over', () => {
    for (const screen of [320, 360, 375, 414]) {
      const row = stripRowWidth(screen);
      // (Within a rounding error: a seventh is not a whole number of points.)
      expect(7 * stripDayWidth(row) - row, `${screen} pt`).toBeLessThanOrEqual(1e-9);
    }
    // The strip reaches over the card's padding: 320 less the screen's padding (16) and the strip's edge on each side (a card has no outline).
    expect(stripRowWidth(320)).toBe(320 - 2 * (16 + STRIP_EDGE));
    expect(STRIP_EDGE).toBeLessThan(S.cardPad);
  });

  it("the strip's margin on Today reaches over the card's padding to its edge, and the row is the card's inside less that margin", () => {
    expect(STRIP_MARGIN).toBe(STRIP_EDGE - S.cardPad);
    expect(STRIP_MARGIN).toBeLessThan(0);
    const cardInside = 375 - 2 * (S.pad + S.cardPad);
    expect(stripRowWidth(375)).toBe(cardInside - 2 * STRIP_MARGIN);
  });

  it('every day is a finger wide on a 360 and a 375 point phone', () => {
    for (const screen of [360, 375, 414]) expect(stripDayWidth(stripRowWidth(screen)), `${screen} pt`).toBeGreaterThanOrEqual(S.touch);
  });

  it('a day on a 320 point phone still holds the date at the largest text size', () => {
    const day = stripDayWidth(stripRowWidth(320));
    // Two digits, less the chip's border on each side.
    expect(2 * DIGIT * LARGEST.body).toBeLessThanOrEqual(day - 2);
  });

  it('every day is a touch box at least a finger tall, and its weekday, date and dot fit in it at the largest text size', () => {
    expect(STRIP_DAY_HEIGHT).toBeGreaterThanOrEqual(S.touch);
    // The weekday, a gap, the date, a gap, the dot.
    expect(lh(LARGEST.small) + 3 + lh(LARGEST.body, true) + 3 + STRIP_DOT_SIZE).toBeLessThanOrEqual(STRIP_DAY_HEIGHT);
  });
});

describe("the week strip's dot", () => {
  it('a day filled in from the plan is a ring with a dot in its middle, a clear gap between them', () => {
    expect(STRIP_CORE).toBeGreaterThan(0);
    expect(STRIP_DOT_SIZE - 2 * STRIP_RING - STRIP_CORE).toBeGreaterThanOrEqual(2);
  });
});
