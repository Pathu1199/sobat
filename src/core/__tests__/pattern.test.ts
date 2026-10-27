import { describe, expect, it } from 'vitest';
import { allowance, currentSlot, DEFAULT_SHARE, pattern, slotOf, slotShare, slotStates, withSlot } from '../pattern';
import { DEFAULT_ROUTINE, NEUTRAL_ROUTINE, type Routine, type RoutineSlot } from '../routine';
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
    const s = slotStates({ routine, target: 1600, meals, nowMinutes: 19 * 60 + 15, skippedSlots: [], planned: { dinner: 500 } });
    expect(s.map((x) => x.slot.id)).toEqual(['morning', 'lunch', 'dinner']);
    expect(s[0]).toMatchObject({ allowance: 400, eaten: 300, left: 100, status: 'done' });
    expect(s[1]).toMatchObject({ allowance: 640, eaten: 550, left: 90, status: 'done' });
    expect(s[1].meals).toHaveLength(2);
    expect(s[2]).toMatchObject({ allowance: 560, planned: 500, eaten: 0, left: 560, status: 'now' });
  });

  it('shows skipped, missed and later', () => {
    const s = slotStates({ routine, target: 1600, meals: [], nowMinutes: 14 * 60, skippedSlots: ['morning'] });
    expect(s.map((x) => x.status)).toEqual(['skipped', 'missed', 'later']);
  });
});

describe('currentSlot', () => {
  const at14 = (meals: Meal[], skippedSlots: string[] = []) => slotStates({ routine, target: 1600, meals, nowMinutes: 14 * 60, skippedSlots });

  it('is the latest slot whose window has opened and is still open, so a late lunch is lunch even with breakfast never logged', () => {
    expect(currentSlot(at14([]), 14 * 60)?.slot.id).toBe('lunch');
  });

  it('before any window has opened, is the first open slot of the day', () => {
    const early = slotStates({ routine, target: 1600, meals: [], nowMinutes: 7 * 60, skippedSlots: [] });
    expect(currentSlot(early, 7 * 60)?.slot.id).toBe('morning');
  });

  it('once the latest opened slot is done or skipped, is the next one, even with an earlier slot missed', () => {
    expect(currentSlot(at14([meal('breakfast', '08:40', 300), meal('lunch', '13:10', 400)]), 14 * 60)?.slot.id).toBe('dinner');
    expect(currentSlot(at14([meal('lunch', '13:10', 400)], ['morning']), 14 * 60)?.slot.id).toBe('dinner');
    // A snack after lunch is not a late breakfast: with lunch eaten and breakfast never logged, it is dinner.
    expect(currentSlot(at14([meal('lunch', '13:10', 400)]), 14 * 60)?.slot.id).toBe('dinner');
  });

  it('takes a slot holding only a meal the app filled in as still open, though it reads as done; a real or confirmed meal in it closes it', () => {
    const filled: Meal = { ...meal('lunch', '13:00', 600, 'lunch'), source: 'auto' };
    expect(at14([filled])[1].status).toBe('done');
    expect(currentSlot(at14([filled]), 14 * 60)?.slot.id).toBe('lunch');
    expect(currentSlot(at14([filled, meal('lunch', '13:10', 400)]), 14 * 60)?.slot.id).toBe('dinner');
    expect(currentSlot(at14([{ ...filled, source: 'plan' }]), 14 * 60)?.slot.id).toBe('dinner');
  });

  describe('a slot holding only a meal the app filled in', () => {
    const auto = (type: Meal['type'], hhmm: string, slotId: string): Meal => ({ ...meal(type, hhmm, 500, slotId), id: `auto-${slotId}`, source: 'auto' });
    const typed = (type: Meal['type'], hhmm: string, slotId: string): Meal => ({ ...meal(type, hhmm, 400, slotId), source: 'manual' });
    const day = (r: Routine, meals: Meal[], m: number, skippedSlots: string[] = []) => slotStates({ routine: r, target: 1600, meals, nowMinutes: m, skippedSlots });

    it('takes a real lunch eaten at 15:00, as before', () => {
      const states = day(routine, [typed('breakfast', '08:40', 'morning'), auto('lunch', '13:00', 'lunch')], 15 * 60);
      expect(currentSlot(states, 15 * 60)?.slot.id).toBe('lunch');
    });

    it('is closed once a later slot holds a real meal: a snack after a hand-logged dinner does not take the planned lunch', () => {
      const states = day(routine, [typed('breakfast', '08:40', 'morning'), auto('lunch', '13:00', 'lunch'), typed('dinner', '19:40', 'dinner')], 21 * 60);
      const picked = currentSlot(states, 21 * 60)?.slot.id;
      expect(picked).not.toBe('lunch');
      // Every slot is settled, so the nearest by time.
      expect(picked).toBe('dinner');
    });

    it('on the four meals of the day: a snack and a lunch filled in, dinner logged by hand, an item at 21:30 goes to dinner', () => {
      const meals = [typed('breakfast', '08:40', 'breakfast'), auto('lunch', '13:00', 'lunch'), auto('snack', '16:00', 'snack'), typed('dinner', '20:40', 'dinner')];
      const picked = currentSlot(day(NEUTRAL_ROUTINE, meals, 21 * 60 + 30), 21 * 60 + 30)?.slot.id;
      expect(picked).not.toBe('snack');
      expect(picked).toBe('dinner');
    });

    it('is closed once a later slot is skipped: dinner skipped and the snack filled in, an item at 21:30 goes to dinner', () => {
      const meals = [typed('breakfast', '08:40', 'breakfast'), typed('lunch', '13:10', 'lunch'), auto('snack', '16:00', 'snack')];
      expect(currentSlot(day(NEUTRAL_ROUTINE, meals, 21 * 60 + 30, ['dinner']), 21 * 60 + 30)?.slot.id).toBe('dinner');
      const now = new Date('2026-10-12T21:30:00');
      const late = withSlot(meal('snack', '21:30', 200), { routine: NEUTRAL_ROUTINE, target: 1600, meals, skippedSlots: ['dinner'], now });
      expect(late).toMatchObject({ slotId: 'dinner', type: 'dinner' });
    });

    it('with nothing real anywhere after it, stays open: at 22:00 with lunch, snack and dinner all filled in, the item is dinner', () => {
      const meals = [typed('breakfast', '08:40', 'breakfast'), auto('lunch', '13:00', 'lunch'), auto('snack', '16:00', 'snack'), auto('dinner', '20:30', 'dinner')];
      expect(currentSlot(day(NEUTRAL_ROUTINE, meals, 22 * 60), 22 * 60)?.slot.id).toBe('dinner');
    });

    it('is never open when the slot itself is skipped, though its leftover meal reads as done', () => {
      const states = day(routine, [typed('breakfast', '08:40', 'morning'), auto('lunch', '13:00', 'lunch')], 14 * 60, ['lunch']);
      expect(states[1]).toMatchObject({ status: 'done', skipped: true });
      expect(currentSlot(states, 14 * 60)?.slot.id).toBe('dinner');
      const now = new Date('2026-10-12T14:00:00');
      expect(withSlot(meal('snack', '14:00', 200), { routine, target: 1600, meals: states.flatMap((s) => s.meals), skippedSlots: ['lunch'], now })).toMatchObject({ slotId: 'dinner' });
    });
  });

  it('with the latest opened slot done and nothing after it, is the latest earlier slot still open', () => {
    const evening = (meals: Meal[]) => slotStates({ routine, target: 1600, meals, nowMinutes: 20 * 60 + 30, skippedSlots: [] });
    expect(currentSlot(evening([meal('breakfast', '08:40', 300), meal('dinner', '19:40', 500)]), 20 * 60 + 30)?.slot.id).toBe('lunch');
    expect(currentSlot(evening([meal('dinner', '19:40', 500)]), 20 * 60 + 30)?.slot.id).toBe('lunch');
  });

  it('when the day is done, is the nearest by time; null with no slots', () => {
    const done = slotStates({
      routine,
      target: 1600,
      meals: [meal('breakfast', '08:40', 300), meal('lunch', '13:10', 400), meal('dinner', '19:40', 500)],
      nowMinutes: 21 * 60,
      skippedSlots: [],
    });
    expect(currentSlot(done, 21 * 60)?.slot.id).toBe('dinner');
    expect(currentSlot([], 21 * 60)).toBeNull();
  });

  it('on the default routine: lunch at 14:00 with nothing logged, tea once lunch is logged, the dry fruit at 11:05', () => {
    const states = (m: number, meals: Meal[] = []) => slotStates({ routine: DEFAULT_ROUTINE, target: 1600, meals, nowMinutes: m, skippedSlots: [] });
    expect(currentSlot(states(14 * 60), 14 * 60)?.slot.id).toBe('lunch');
    expect(currentSlot(states(14 * 60, [meal('lunch', '13:10', 450)]), 14 * 60)?.slot.id).toBe('tea');
    expect(currentSlot(states(11 * 60 + 5), 11 * 60 + 5)?.slot.id).toBe('dry-fruit');
  });
});

describe('withSlot', () => {
  const now = new Date('2026-10-12T14:00:00');
  const input = { routine, target: 1600, meals: [] as Meal[], skippedSlots: [] as string[], now };

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

  it('gives a lunch eaten after the app filled lunch in the lunch slot, not dinner; after a real lunch, the next slot as before', () => {
    const at15 = { ...input, now: new Date('2026-10-12T15:00:00') };
    const filled: Meal = { ...meal('lunch', '13:00', 600, 'lunch'), source: 'auto' };
    expect(withSlot(meal('snack', '15:00', 450), { ...at15, meals: [filled] })).toMatchObject({ slotId: 'lunch', type: 'lunch' });
    const typed: Meal = { ...meal('lunch', '13:10', 450, 'lunch'), source: 'manual' };
    expect(withSlot(meal('snack', '15:00', 300), { ...at15, meals: [typed] })).toMatchObject({ slotId: 'dinner', type: 'dinner' });
  });

  it('leaves a meal that names a slot, or a pattern with no slots, alone', () => {
    const named = meal('snack', '14:00', 100, 'dinner');
    expect(withSlot(named, input)).toBe(named);
    const bare = meal('snack', '14:00', 100);
    expect(withSlot(bare, { ...input, routine: { ...routine, slots: [] } })).toBe(bare);
  });
});
