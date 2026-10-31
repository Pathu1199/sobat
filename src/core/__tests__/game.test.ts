import { describe, expect, it } from 'vitest';
import { climbTrail } from '../game';

const TODAY = '2026-10-07'; // a Wednesday
const d = (n: number) => {
  const x = new Date(TODAY + 'T12:00:00');
  x.setDate(x.getDate() - n);
  return x.toISOString().slice(0, 10);
};
const weights = [
  { date: d(21), kg: 98 },
  { date: d(14), kg: 97.2 },
  { date: d(7), kg: 96.6 },
  { date: d(0), kg: 96 },
];

describe('the climb', () => {
  it('lays the weigh-ins along the climb', () => {
    const trail = climbTrail(weights, 98, 88);
    expect(trail.map((t) => t.p)).toEqual([0, 0.08, 0.14, 0.2]);
    expect(climbTrail(weights, 88, 98)).toEqual([]);
  });
});
