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
    // 1 L left is one and a third 750 ml bottles, so two.
    expect(waterTile(2000, 3000, 750).bottlesLeft).toBe(2);
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

describe('a goal of 0 or less, or no goal at all', () => {
  const noGoal = [0, -500, Number.NaN, undefined as unknown as number, 'none' as unknown as number];

  it('an empty tile never reads as reached, and nothing is left to drink or walk', () => {
    for (const goal of noGoal) {
      expect(waterTile(0, goal, 500)).toEqual({ fraction: 0, bottlesLeft: 0, reached: false });
      expect(walkTile(0, goal)).toEqual({ fraction: 0, minutesLeft: 0, reached: false });
    }
  });

  it('once anything is logged the tile is full and reached, as a goal of 0 is', () => {
    for (const goal of noGoal) {
      expect(waterTile(250, goal, 500)).toEqual({ fraction: 1, bottlesLeft: 0, reached: true });
      expect(walkTile(5, goal)).toEqual({ fraction: 1, minutesLeft: 0, reached: true });
    }
  });

  it('a bottle of no size leaves no count of bottles, never a number that is not one', () => {
    expect(waterTile(1000, 3000, 0).bottlesLeft).toBe(0);
    expect(waterTile(1000, 3000, Number.NaN).bottlesLeft).toBe(0);
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

  it('sorts by date, so the latest weigh-in is last however the list was stored', () => {
    // Stored newest first: 96 kg on the 3rd is the latest and the lightest.
    const pts = weightPoints([w('2026-09-03', 96), w('2026-09-01', 100), w('2026-09-02', 99)]);
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 50, y: 10.5 }, { x: 100, y: 42 }]);
  });

  it('puts equal weights in the middle, and one weigh-in in the centre', () => {
    expect(weightPoints([w('2026-09-02', 98), w('2026-09-01', 98)]).map((p) => p.y)).toEqual([21, 21]);
    expect(weightPoints([w('2026-09-01', 98)])).toEqual([{ x: 50, y: 21 }]);
    expect(weightPoints([])).toEqual([]);
  });
});
