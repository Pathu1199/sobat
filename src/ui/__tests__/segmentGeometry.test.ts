import { describe, expect, it } from 'vitest';
import { SECTION_MIN_WIDTH, sectionRowMinWidth } from '../segmentGeometry';
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
});
