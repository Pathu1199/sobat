import { describe, expect, it } from 'vitest';
import { activeBlock, blockEnd, checkinKey, DEFAULT_SCHEDULE, fromMinutes, isValidTime, isWorkDay, minutesLeft, newBreak, nextBlock, startedBetween, toMinutes } from '../schedule';

// 2026-10-06 is a Tuesday, 2026-10-11 a Sunday.
const TUE = '2026-10-06';
const SUN = '2026-10-11';
const at = (h: number, m = 0) => h * 60 + m;

describe('times', () => {
  it('validates and converts HH:MM', () => {
    expect(isValidTime('09:05')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
    expect(toMinutes('13:30')).toBe(810);
    expect(fromMinutes(810)).toBe('13:30');
    expect(fromMinutes(1445)).toBe('00:05');
  });

  it('gives a moment a short window and a break its own end', () => {
    expect(blockEnd(DEFAULT_SCHEDULE.blocks[0])).toBe(at(9, 15));
    expect(blockEnd(DEFAULT_SCHEDULE.blocks[1])).toBe(at(9, 30));
  });
});

describe('the office day', () => {
  it('knows which block is on and which comes next', () => {
    expect(activeBlock(DEFAULT_SCHEDULE, TUE, at(9, 20))?.id).toBe('break1');
    expect(activeBlock(DEFAULT_SCHEDULE, TUE, at(13, 29))?.id).toBe('lunch');
    expect(activeBlock(DEFAULT_SCHEDULE, TUE, at(13, 30))).toBeNull();
    expect(activeBlock(DEFAULT_SCHEDULE, TUE, at(18, 5))?.id).toBe('end');
    expect(nextBlock(DEFAULT_SCHEDULE, TUE, at(10))?.id).toBe('lunch');
    expect(nextBlock(DEFAULT_SCHEDULE, TUE, at(18, 30))).toBeNull();
  });

  it('is quiet on a day off or when switched off', () => {
    expect(isWorkDay(DEFAULT_SCHEDULE, SUN)).toBe(false);
    expect(activeBlock(DEFAULT_SCHEDULE, SUN, at(9, 20))).toBeNull();
    expect(nextBlock({ ...DEFAULT_SCHEDULE, enabled: false }, TUE, at(8))).toBeNull();
  });

  it('announces blocks that began inside a tick, not ones already running', () => {
    expect(startedBetween(DEFAULT_SCHEDULE, TUE, at(9, 14), at(9, 15)).map((b) => b.id)).toEqual(['break1']);
    expect(startedBetween(DEFAULT_SCHEDULE, TUE, at(9, 15), at(9, 16))).toEqual([]);
    // A long gap (the app was asleep) catches up on everything inside it.
    expect(startedBetween(DEFAULT_SCHEDULE, TUE, at(8, 59), at(13)).map((b) => b.id)).toEqual(['start', 'break1', 'lunch']);
  });

  it('counts minutes left and keys ticks per block', () => {
    expect(minutesLeft(DEFAULT_SCHEDULE.blocks[1], at(9, 20))).toBe(10);
    expect(minutesLeft(DEFAULT_SCHEDULE.blocks[1], at(9, 40))).toBe(0);
    expect(checkinKey(DEFAULT_SCHEDULE.blocks[3], 'water')).toBe('sched_tea_water');
  });

  it('ignores a block with a broken time instead of crashing', () => {
    const s = { ...DEFAULT_SCHEDULE, blocks: [...DEFAULT_SCHEDULE.blocks, { id: 'x', kind: 'break' as const, start: 'soon' }] };
    expect(nextBlock(s, TUE, at(8))?.id).toBe('start');
  });

  it('adds a new break an hour after the given one', () => {
    const b = newBreak(DEFAULT_SCHEDULE.blocks[1]);
    expect(b.start).toBe('10:30');
    expect(b.end).toBe('10:45');
    expect(newBreak(null).start).toBe('11:00');
  });
});
