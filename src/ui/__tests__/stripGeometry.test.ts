import { describe, expect, it } from 'vitest';
import { STRIP_CORE, STRIP_DAY_HEIGHT, STRIP_DOT_GAP, STRIP_DOT_SIZE, STRIP_EDGE, STRIP_MARGIN, STRIP_PILL_PAD, STRIP_RING, stripDayWidth, stripRowWidth } from '../stripGeometry';
import { lh, S, scaledSizes, TEXT_SCALES } from '../theme';

/** A digit is about 0.6 of the type size wide (tabular figures). */
const DIGIT = 0.6;
const LARGEST = scaledSizes(TEXT_SCALES[TEXT_SCALES.length - 1]);

describe('the week strip on the narrowest phone', () => {
  it('seven days always fit the row: on a 320 point screen, across Today’s page, nothing runs over', () => {
    for (const screen of [320, 360, 375, 414]) {
      const row = stripRowWidth(screen);
      // (Within a rounding error: a seventh is not a whole number of points.)
      expect(7 * stripDayWidth(row) - row, `${screen} pt`).toBeLessThanOrEqual(1e-9);
    }
    // The strip sits on the page, not in a card: 320 less the screen's padding (16) on each side.
    expect(stripRowWidth(320)).toBe(320 - 2 * 16);
  });

  it("the calendar on Progress reaches over its card's padding to STRIP_EDGE from the card's edge", () => {
    expect(STRIP_EDGE).toBeLessThan(S.cardPad);
    expect(STRIP_MARGIN).toBe(STRIP_EDGE - S.cardPad);
    expect(STRIP_MARGIN).toBeLessThan(0);
  });

  it('every day is a finger wide on a 360 and a 375 point phone', () => {
    for (const screen of [360, 375, 414]) expect(stripDayWidth(stripRowWidth(screen)), `${screen} pt`).toBeGreaterThanOrEqual(S.touch);
  });

  it('a day on a 320 point phone still holds the date at the largest text size', () => {
    const day = stripDayWidth(stripRowWidth(320));
    // Two digits, less the pill's outline on each side.
    expect(2 * DIGIT * LARGEST.body).toBeLessThanOrEqual(day - 2 * S.hairline);
  });

  it('every day is a touch box at least a finger tall, and its weekday, date and dot fit in it at the largest text size', () => {
    expect(STRIP_DAY_HEIGHT).toBeGreaterThanOrEqual(S.touch);
    // The pill (its outline, its padding, the weekday and the date), a gap, the dot.
    const pill = 2 * (S.hairline + STRIP_PILL_PAD) + lh(LARGEST.small) + lh(LARGEST.body, true);
    expect(pill + STRIP_DOT_GAP + STRIP_DOT_SIZE).toBeLessThanOrEqual(STRIP_DAY_HEIGHT);
  });
});

describe("the week strip's dot", () => {
  it('a day filled in from the plan is a ring with a dot in its middle, a clear gap between them', () => {
    expect(STRIP_CORE).toBeGreaterThan(0);
    expect(STRIP_DOT_SIZE - 2 * STRIP_RING - STRIP_CORE).toBeGreaterThanOrEqual(2);
  });
});
