import { describe, expect, it } from 'vitest';
import { allowance, DEFAULT_SHARE, nextSlot, pattern, slotForNow, slotOf, slotShare, slotStates } from '../pattern';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { Meal } from '../types';

export const slot = (id: string, type: RoutineSlot['type'], time: string, share?: number): RoutineSlot => ({
  id,
  type,
  time,
  label_en: id,
  label_mr: '',
  label_hi: '',
  options: [[]],
  withBhaji: false,
  share,
});
const routine: Routine = {
  ...DEFAULT_ROUTINE,
  enabled: true,
  slots: [slot('dinner', 'dinner', '19:30', 35), slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40)],
};
const at = (hhmm: string) => new Date(`2026-10-12T${hhmm}:00`).toISOString();
const meal = (type: Meal['type'], hhmm: string, kcal: number, slotId?: string): Meal => ({
  id: `${type}-${hhmm}`,
  at: at(hhmm),
  date: '2026-10-12',
  type,
  items: [],
  kcal,
  protein: 0,
  slotId,
});

describe('pattern', () => {
  it('sorts the slots by time and turns shares into fractions that add up to one', () => {
    const p = pattern(routine);
    expect(p.map((s) => s.id)).toEqual(['morning', 'lunch', 'dinner']);
    expect(p.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
    expect(p[1].share).toBeCloseTo(0.4);
    expect(p[1].minutes).toBe(13 * 60);
  });

  it('gives a slot without a share the usual one for its kind, and all-zero shares equal ones', () => {
    expect(slotShare(slot('x', 'snack', '16:00'))).toBe(DEFAULT_SHARE.snack);
    expect(slotShare(slot('x', 'snack', '16:00', -4))).toBe(0);
    const zero = pattern({ ...routine, slots: [slot('a', 'lunch', '13:00', 0), slot('b', 'dinner', '20:00', 0)] });
    expect(zero.map((s) => s.share)).toEqual([0.5, 0.5]);
  });

  it('allowances add up to the target, give or take rounding', () => {
    const p = pattern(routine);
    const sum = p.reduce((a, s) => a + allowance(1600, s), 0);
    expect(Math.abs(sum - 1600)).toBeLessThanOrEqual(2);
    expect(allowance(1600, p[1])).toBe(640);
  });
});

describe('slotOf', () => {
  const p = pattern(routine);
  it('trusts a slot id that still exists', () => {
    expect(slotOf(meal('snack', '09:00', 100, 'dinner'), p)?.id).toBe('dinner');
  });

  it('otherwise takes the slot of the same type nearest in time', () => {
    expect(slotOf(meal('lunch', '14:30', 500), p)?.id).toBe('lunch');
    expect(slotOf(meal('breakfast', '10:00', 200, 'gone'), p)?.id).toBe('morning');
  });

  it('falls back to the nearest slot of any type, and null with no slots', () => {
    expect(slotOf(meal('snack', '18:00', 120), p)?.id).toBe('dinner');
    expect(slotOf(meal('snack', '18:00', 120), [])).toBeNull();
  });
});

describe('slotStates', () => {
  it('sums what was eaten per slot, keeps what is left, and reads the status off the clock', () => {
    const meals = [meal('breakfast', '08:40', 300), meal('lunch', '13:10', 400), meal('snack', '13:30', 150, 'lunch')];
    const s = slotStates({ routine, target: 1600, meals, nowMinutes: 19 * 60 + 15, skipped: [], planned: { dinner: 500 } });
    expect(s.map((x) => x.slot.id)).toEqual(['morning', 'lunch', 'dinner']);
    expect(s[0]).toMatchObject({ allowance: 400, eaten: 300, left: 100, status: 'done' });
    expect(s[1]).toMatchObject({ allowance: 640, eaten: 550, left: 90, status: 'done' });
    expect(s[1].meals).toHaveLength(2);
    expect(s[2]).toMatchObject({ allowance: 560, planned: 500, eaten: 0, left: 560, status: 'now' });
  });

  it('shows skipped, missed and later', () => {
    const s = slotStates({ routine, target: 1600, meals: [], nowMinutes: 14 * 60, skipped: ['skip_morning'] });
    expect(s.map((x) => x.status)).toEqual(['skipped', 'missed', 'later']);
  });

  it('nextSlot is the one on now, else the missed one, else the next; slotForNow falls back to the nearest', () => {
    const midday = slotStates({ routine, target: 1600, meals: [], nowMinutes: 12 * 60 + 45, skipped: [] });
    expect(nextSlot(midday)?.slot.id).toBe('lunch');
    const morningOnly = slotStates({ routine, target: 1600, meals: [], nowMinutes: 10 * 60, skipped: [] });
    expect(nextSlot(morningOnly)?.slot.id).toBe('morning');
    const done = slotStates({
      routine,
      target: 1600,
      meals: [meal('breakfast', '08:40', 300), meal('lunch', '13:10', 400), meal('dinner', '19:40', 500)],
      nowMinutes: 21 * 60,
      skipped: [],
    });
    expect(nextSlot(done)).toBeNull();
    expect(slotForNow(done, 21 * 60)?.slot.id).toBe('dinner');
    expect(slotForNow([], 21 * 60)).toBeNull();
  });
});
