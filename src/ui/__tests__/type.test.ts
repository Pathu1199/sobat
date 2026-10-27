import { describe, expect, it } from 'vitest';
import { F, lh, MICRO, scaledSizes, TEXT_SCALES } from '../theme';

describe('type scale', () => {
  it('has four sizes at scale 1: number 44, title 20, body 16, small 13', () => {
    expect(scaledSizes(1)).toEqual({ number: 44, title: 20, body: 16, small: 13 });
    expect(F).toEqual(scaledSizes(1));
  });

  it('scales every size with the text setting, in whole points', () => {
    expect(scaledSizes(1.25)).toEqual({ number: 55, title: 25, body: 20, small: 16 });
    expect(scaledSizes(0.9)).toEqual({ number: 40, title: 18, body: 14, small: 12 });
  });

  it('labels are small, medium weight, normal case and untracked', () => {
    expect(MICRO).toEqual({ fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' });
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
    expect(lh(20)).toBe(29);
    expect(lh(20)).toBeGreaterThan(lh(16));
  });

  it('keeps a number on its own tight', () => {
    expect(lh(44, true)).toBe(51);
    expect(lh(44, true)).toBeLessThan(lh(44));
  });
});
