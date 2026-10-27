import { describe, expect, it } from 'vitest';
import { fillFraction, sheetAmount, sleepFraction, streakFraction, walkTile, waterLog, waterTile, weightPoints, withWaterAdded, withWaterRemoved } from '../tiles';

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

describe('waterLog', () => {
  it('a tap logs now for today and at noon for an earlier day, like a walk', () => {
    const now = new Date('2026-10-27T18:05:00');
    expect(waterLog({ id: 'w1', date: '2026-10-27', ml: 500, now })).toEqual({ id: 'w1', at: now.toISOString(), date: '2026-10-27', ml: 500 });
    expect(waterLog({ id: 'w2', date: '2026-10-25', ml: 750, now })?.at).toBe(new Date('2026-10-25T12:00:00').toISOString());
  });

  it('never logs water on a date after today: nothing is drunk in the future', () => {
    const now = new Date('2026-10-27T23:59:00');
    expect(waterLog({ id: 'w1', date: '2026-10-28', ml: 500, now })).toBeNull();
    expect(waterLog({ id: 'w1', date: '2026-10-27', ml: 500, now })).not.toBeNull();
  });
});

describe('adding and taking back water', () => {
  const now = new Date('2026-10-27T18:05:00');
  const w = (id: string, date: string, ml: number) => ({ id, at: new Date(`${date}T12:00:00`).toISOString(), date, ml });
  const logs = [w('w1', '2026-10-26', 500), w('w10', '2026-10-27', 500), w('w2', '2026-10-27', 750)];

  it('adds one log for the date given, after the others', () => {
    expect(withWaterAdded(logs, { id: 'w3', date: '2026-10-27', ml: 250, now })).toEqual([...logs, { id: 'w3', at: now.toISOString(), date: '2026-10-27', ml: 250 }]);
    expect(withWaterAdded(logs, { id: 'w3', date: '2026-10-20', ml: 1000, now }).at(-1)).toEqual(w('w3', '2026-10-20', 1000));
  });

  it('adds nothing for a date after today, and hands back the same list', () => {
    expect(withWaterAdded(logs, { id: 'w3', date: '2026-10-28', ml: 500, now })).toBe(logs);
  });

  it('takes back exactly the log with that id, and no other', () => {
    expect(withWaterRemoved(logs, 'w1')).toEqual([logs[1], logs[2]]);
    expect(withWaterRemoved(logs, 'w2')).toEqual([logs[0], logs[1]]);
  });

  it('hands back the same list when no log has that id', () => {
    expect(withWaterRemoved(logs, 'w3')).toBe(logs);
    expect(withWaterRemoved([], 'w1')).toEqual([]);
  });
});

describe('another amount, typed in the long-press sheet', () => {
  it('takes 10 ml to 3 L of water, a whole number of millilitres', () => {
    expect(sheetAmount('water', '250')).toBe(250);
    expect(sheetAmount('water', ' 330 ')).toBe(330);
    expect(sheetAmount('water', '10')).toBe(10);
    expect(sheetAmount('water', '3000')).toBe(3000);
    expect(sheetAmount('water', '250.6')).toBe(251);
    expect(sheetAmount('water', '9')).toBeNull();
    expect(sheetAmount('water', '3001')).toBeNull();
  });

  it('takes 1 to 300 minutes of walking', () => {
    expect(sheetAmount('walk', '15')).toBe(15);
    expect(sheetAmount('walk', '1')).toBe(1);
    expect(sheetAmount('walk', '300')).toBe(300);
    expect(sheetAmount('walk', '0')).toBeNull();
    expect(sheetAmount('walk', '301')).toBeNull();
  });

  it('takes only digits, with a decimal point if any: not an empty box, words, letters after a number, or a number written another way', () => {
    for (const text of ['', ' ', 'abc', '12abc', '1,000', 'Infinity', '-250', '1e3', '0x10', '+250', '.5', '250.', '0b11', '25 0']) {
      expect(sheetAmount('water', text), text).toBeNull();
      expect(sheetAmount('walk', text), text).toBeNull();
    }
  });
});
