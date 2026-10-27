import { describe, expect, it } from 'vitest';
import { fillFraction, sleepFraction, streakFraction, walkTile, waterTile, weightPoints } from '../tiles';

describe('water', () => {
  it('fills toward the goal, capped at full', () => {
    expect(waterTile(1500, 3000, 500).fraction).toBe(0.5);
    expect(waterTile(4000, 3000, 500).fraction).toBe(1);
    expect(waterTile(0, 3000, 500).fraction).toBe(0);
  });

  it('counts the bottles left, rounding up, for each bottle size', () => {
    expect(waterTile(1500, 3000, 500).bottlesLeft).toBe(3);
    expect(waterTile(1500, 3000, 750).bottlesLeft).toBe(2);
    // 1.5 L left is two 1 L bottles.
    expect(waterTile(1500, 3000, 1000).bottlesLeft).toBe(2);
    expect(waterTile(2900, 3000, 500).bottlesLeft).toBe(1);
  });

  it('says the goal is reached, and keeps counting past it', () => {
    expect(waterTile(3000, 3000, 500)).toEqual({ fraction: 1, bottlesLeft: 0, reached: true });
    expect(waterTile(3500, 3000, 500).reached).toBe(true);
    expect(waterTile(2999, 3000, 500).reached).toBe(false);
  });
});

describe('walk, sleep and streak', () => {
  it('walk fills by minutes and says what is left', () => {
    expect(walkTile(10, 30)).toEqual({ fraction: 1 / 3, minutesLeft: 20, reached: false });
    expect(walkTile(40, 30)).toEqual({ fraction: 1, minutesLeft: 0, reached: true });
  });

  it('sleep and streak are capped at full; the streak is full at the best one', () => {
    expect(sleepFraction(240, 480)).toBe(0.5);
    expect(sleepFraction(600, 480)).toBe(1);
    expect(streakFraction(5, 10)).toBe(0.5);
    expect(streakFraction(12, 10)).toBe(1);
    expect(streakFraction(0, 0)).toBe(0);
  });

  it('a goal of zero is full once anything is logged', () => {
    expect(fillFraction(0, 0)).toBe(0);
    expect(fillFraction(1, 0)).toBe(1);
  });
});

describe('weightPoints', () => {
  const w = (date: string, kg: number) => ({ date, kg });

  it('takes the last eight weigh-ins, oldest first, across a 100 × 42 box with heavier higher', () => {
    const logs = [w('2026-08-01', 105), ...Array.from({ length: 8 }, (_, i) => w(`2026-09-0${i + 1}`, 100 - i))];
    const pts = weightPoints(logs);
    expect(pts).toHaveLength(8);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 14.3, y: 6 });
    expect(pts[7]).toEqual({ x: 100, y: 42 });
  });

  it('sorts by date, puts equal weights in the middle, and one weigh-in in the centre', () => {
    expect(weightPoints([w('2026-09-02', 98), w('2026-09-01', 98)]).map((p) => p.y)).toEqual([21, 21]);
    expect(weightPoints([w('2026-09-01', 98)])).toEqual([{ x: 50, y: 21 }]);
    expect(weightPoints([])).toEqual([]);
  });
});
