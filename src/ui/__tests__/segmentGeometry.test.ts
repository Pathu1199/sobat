import { describe, expect, it } from 'vitest';
import { SECTION_MIN_WIDTH, SECTION_SCROLL_MIN_WIDTH, sectionRowMinWidth, sectionsScroll } from '../segmentGeometry';
import { S } from '../theme';

describe('the switch between a tab\'s sections', () => {
  it('fits four sections between the gutters of a 375 and a 360 point phone, so Body\'s last one, Mind, is never pushed off the edge', () => {
    for (const screen of [360, 375]) expect(sectionRowMinWidth(4), `${screen}`).toBeLessThanOrEqual(screen - 2 * S.gutter);
  });

  it('leaves each section room for its name at the largest text size: the longest of Body\'s, हालचाल, is about 51 points there', () => {
    // A section's box, less the switch's 4 point inset shared out and the section's own 6 point sides.
    expect(SECTION_MIN_WIDTH - 2 * 6 - 2).toBeGreaterThanOrEqual(51);
  });

  it('lets a row of more sections than fit scroll sideways, each as wide as ever', () => {
    expect(sectionRowMinWidth(5)).toBeGreaterThan(375 - 2 * S.gutter);
  });

  it('gives each section of a row that scrolls anyway 92 points, so Food\'s names in Hindi stay on one line; a row of four keeps 80', () => {
    expect(SECTION_SCROLL_MIN_WIDTH).toBe(92);
    expect(sectionRowMinWidth(5)).toBe(5 * SECTION_SCROLL_MIN_WIDTH);
    expect(sectionRowMinWidth(4)).toBe(4 * SECTION_MIN_WIDTH);
  });

  it('makes a row of five sections scroll, each section sized to its own name, and keeps a row of four fixed, sharing the width', () => {
    expect(sectionsScroll(5)).toBe(true);
    expect(sectionsScroll(4)).toBe(false);
  });
});
