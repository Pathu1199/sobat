import { describe, expect, it } from 'vitest';
import { DEFAULT_TODAY_CARDS, normalizeTabs } from '../tabs';

describe('normalizeTabs', () => {
  it('keeps known tabs in the order chosen, and an empty choice', () => {
    expect(normalizeTabs(['coach', 'progress'])).toEqual(['coach', 'progress']);
    expect(normalizeTabs([])).toEqual([]);
  });

  it('drops unknown ids and duplicates, so a bad value from sync cannot hide the fixed tabs', () => {
    expect(normalizeTabs(['today', 'coach', 'me', 'coach', 42, null])).toEqual(['coach']);
  });

  it('keeps at most two', () => {
    expect(normalizeTabs(['progress', 'coach', 'body', 'sleep'])).toEqual(['progress', 'coach']);
  });

  it('gives the default to anything that is not a list', () => {
    expect(normalizeTabs(undefined)).toEqual(['progress']);
    expect(normalizeTabs('progress')).toEqual(['progress']);
  });
});

describe('DEFAULT_TODAY_CARDS', () => {
  it('has the menu, the coach line and water and walk on, in that order, and every other card off', () => {
    expect(DEFAULT_TODAY_CARDS.map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk', 'weight', 'sleep', 'steps', 'climb', 'mantra']);
    expect(DEFAULT_TODAY_CARDS.filter((c) => c.on).map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk']);
  });
});
