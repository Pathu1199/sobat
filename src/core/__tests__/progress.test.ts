import { describe, expect, it } from 'vitest';
import { monthCells, shiftMonth } from '../progress';

describe('monthCells', () => {
  it('lays a month out in weeks from Monday, blank before the 1st and after the last day', () => {
    // 1 October 2026 is a Thursday.
    const weeks = monthCells('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks[4]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('a February that starts on a Monday is four full weeks', () => {
    const weeks = monthCells('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2027-02-01');
    expect(weeks[3][6]).toBe('2027-02-28');
  });
});

describe('shiftMonth', () => {
  it('steps months across the turn of a year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-10', -12)).toBe('2025-10');
  });
});
