import { describe, expect, it } from 'vitest';
import { allowance, currentSlot, DEFAULT_SHARE, pattern, slotOf, slotShare, slotStates, withSlot } from '../pattern';
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
});

describe('currentSlot', () => {
  const at14 = (meals: Meal[], skipped: string[] = []) => slotStates({ routine, target: 1600, meals, nowMinutes: 14 * 60, skipped });

  it('is the latest slot whose window has opened and is still open, so a late lunch is lunch even with breakfast never logged', () => {
    expect(currentSlot(at14([]), 14 * 60)?.slot.id).toBe('lunch');
  });

  it('before any window has opened, is the first open slot of the day', () => {
    const early = slotStates({ routine, target: 1600, meals: [], nowMinutes: 7 * 60, skipped: [] });
    expect(currentSlot(early, 7 * 60)?.slot.id).toBe('morning');
  });

  it('once every opened slot is done or skipped, is the next one', () => {
    expect(currentSlot(at14([meal('breakfast', '08:40', 300), meal('lunch', '13:10', 400)]), 14 * 60)?.slot.id).toBe('dinner');
    expect(currentSlot(at14([meal('lunch', '13:10', 400)], ['skip_morning']), 14 * 60)?.slot.id).toBe('dinner');
    // An opened slot still open comes first: with lunch eaten and breakfast never logged, it is breakfast.
    expect(currentSlot(at14([meal('lunch', '13:10', 400)]), 14 * 60)?.slot.id).toBe('morning');
  });

  it('when the day is done, is the nearest by time; null with no slots', () => {
    const done = slotStates({
      routine,
      target: 1600,
      meals: [meal('breakfast', '08:40', 300), meal('lunch', '13:10', 400), meal('dinner', '19:40', 500)],
      nowMinutes: 21 * 60,
      skipped: [],
    });
    expect(currentSlot(done, 21 * 60)?.slot.id).toBe('dinner');
    expect(currentSlot([], 21 * 60)).toBeNull();
  });

  it('on the default routine: lunch at 14:00 with nothing logged, the dry fruit at 11:05', () => {
    const states = (m: number) => slotStates({ routine: DEFAULT_ROUTINE, target: 1600, meals: [], nowMinutes: m, skipped: [] });
    expect(currentSlot(states(14 * 60), 14 * 60)?.slot.id).toBe('lunch');
    expect(currentSlot(states(11 * 60 + 5), 11 * 60 + 5)?.slot.id).toBe('dry-fruit');
  });
});

describe('withSlot', () => {
  const now = new Date('2026-10-12T14:00:00');
  const input = { routine, target: 1600, meals: [] as Meal[], skipped: [] as string[], now };

  it('gives a meal eaten now the slot that is on now, and that slot\'s type', () => {
    const m = withSlot(meal('snack', '14:00', 300), input);
    expect(m).toMatchObject({ slotId: 'lunch', type: 'lunch' });
  });

  it('gives a meal from earlier (a queued photo, an undo) the slot its own time and type put it in', () => {
    expect(withSlot(meal('breakfast', '08:40', 250), input)).toMatchObject({ slotId: 'morning', type: 'breakfast' });
  });

  it('gives a meal from another day the slot its time and type put it in, whatever the clock says', () => {
    const yesterday = { ...meal('lunch', '13:20', 450), date: '2026-10-11', at: new Date('2026-10-11T13:20:00').toISOString() };
    expect(withSlot(yesterday, input)).toMatchObject({ slotId: 'lunch', type: 'lunch' });
    const lateLastNight = { ...meal('snack', '23:55', 100), date: '2026-10-11', at: new Date('2026-10-11T23:55:00').toISOString() };
    expect(withSlot(lateLastNight, { ...input, now: new Date('2026-10-12T00:02:00') })).toMatchObject({ slotId: 'dinner' });
  });

  it('leaves a meal that names a slot, or a pattern with no slots, alone', () => {
    const named = meal('snack', '14:00', 100, 'dinner');
    expect(withSlot(named, input)).toBe(named);
    const bare = meal('snack', '14:00', 100);
    expect(withSlot(bare, { ...input, routine: { ...routine, slots: [] } })).toBe(bare);
  });
});
