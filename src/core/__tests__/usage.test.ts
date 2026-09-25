import { describe, expect, it } from 'vitest';
import { addActive, averageMinutes, dailySeries, hourlyProfile, longestStretchMinutes, minutesOn, pruneUsage } from '../usage';
import type { UsageBucket } from '../usage';

const D = '2026-09-25';

describe('addActive', () => {
  it('creates a bucket then adds to it', () => {
    let b: UsageBucket[] = [];
    b = addActive(b, D, 10, 5);
    b = addActive(b, D, 10, 5);
    expect(b).toHaveLength(1);
    expect(b[0].activeMinutes).toBe(10);
  });

  it('never lets an hour exceed sixty minutes', () => {
    let b: UsageBucket[] = [];
    for (let i = 0; i < 20; i++) b = addActive(b, D, 10, 5);
    expect(b[0].activeMinutes).toBe(60);
  });

  it('keeps hours and days apart', () => {
    let b = addActive([], D, 10, 5);
    b = addActive(b, D, 11, 5);
    b = addActive(b, '2026-09-24', 10, 5);
    expect(b).toHaveLength(3);
    expect(minutesOn(b, D)).toBe(10);
  });
});

describe('hourlyProfile', () => {
  it('returns 24 slots', () => {
    const p = hourlyProfile(addActive([], D, 9, 45), D);
    expect(p).toHaveLength(24);
    expect(p[9]).toBe(45);
    expect(p[8]).toBe(0);
  });
});

describe('longestStretchMinutes', () => {
  it('adds up back-to-back busy hours', () => {
    let b: UsageBucket[] = [];
    for (const h of [9, 10, 11]) b = addActive(b, D, h, 50);
    b = addActive(b, D, 13, 50);
    expect(longestStretchMinutes(b, D)).toBe(150);
  });

  it('ignores quiet hours', () => {
    const b = addActive([], D, 9, 10);
    expect(longestStretchMinutes(b, D)).toBe(0);
  });
});

describe('dailySeries and averages', () => {
  it('fills missing days with zero', () => {
    const b = addActive([], D, 9, 30);
    const s = dailySeries(b, 3, D);
    expect(s).toHaveLength(3);
    expect(s[2].minutes).toBe(30);
    expect(s[0].minutes).toBe(0);
  });

  it('averages only the days actually used', () => {
    let b = addActive([], D, 9, 60);
    b = addActive(b, '2026-09-24', 9, 30);
    expect(averageMinutes(b, 7, D)).toBe(45);
  });
});

describe('pruneUsage', () => {
  it('drops anything past the retention window', () => {
    let b = addActive([], D, 9, 30);
    b = addActive(b, '2026-01-01', 9, 30);
    expect(pruneUsage(b, 30, D)).toHaveLength(1);
  });
});
