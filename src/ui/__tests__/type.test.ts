import { afterEach, describe, expect, it } from 'vitest';
import { applyTextScale, F, lh, MICRO, scaledSizes, TEXT_SCALES, TITLE_WEIGHT } from '../theme';

describe('type scale', () => {
  it('has four sizes at scale 1: number 48, title 22, body 16, small 13', () => {
    expect(scaledSizes(1)).toEqual({ number: 48, title: 22, body: 16, small: 13 });
    expect(F).toEqual(scaledSizes(1));
  });

  it('scales every size with the text setting, in whole points', () => {
    expect(scaledSizes(1.25)).toEqual({ number: 60, title: 28, body: 20, small: 16 });
    expect(scaledSizes(0.9)).toEqual({ number: 43, title: 20, body: 14, small: 12 });
  });

  it('labels are small, medium weight, normal case and untracked', () => {
    expect(MICRO).toEqual({ fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' });
  });

  it("keeps the heavier weight for a screen's title and its big number", () => {
    expect(TITLE_WEIGHT).toBe('600');
  });
});

describe('applyTextScale', () => {
  afterEach(() => applyTextScale(1));

  it('moves F and the label style to the scaled sizes, and back at scale 1', () => {
    applyTextScale(1.25);
    expect(F).toEqual({ number: 60, title: 28, body: 20, small: 16 });
    expect(MICRO.fontSize).toBe(16);
    expect(MICRO.lineHeight).toBe(lh(F.small));
    expect(MICRO.lineHeight).toBe(23);
    applyTextScale(1);
    expect(F).toEqual({ number: 48, title: 22, body: 16, small: 13 });
    expect(MICRO.fontSize).toBe(13);
    expect(MICRO.lineHeight).toBe(19);
  });
});

describe('lh', () => {
  it('leaves room for Devanagari matras at every size and every text scale', () => {
    for (const scale of TEXT_SCALES) {
      for (const size of Object.values(scaledSizes(scale))) {
        expect(lh(size), `size ${size} at ${scale}`).toBeGreaterThanOrEqual(size * 1.4);
        expect(Number.isInteger(lh(size))).toBe(true);
      }
    }
  });

  it('follows the size it is given', () => {
    expect(lh(13)).toBe(19);
    expect(lh(16)).toBe(23);
    expect(lh(22)).toBe(32);
    expect(lh(22)).toBeGreaterThan(lh(16));
  });

  it('keeps a number on its own tight', () => {
    expect(lh(48, true)).toBe(55);
    expect(lh(48, true)).toBeLessThan(lh(48));
  });
});
