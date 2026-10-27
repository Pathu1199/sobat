import { describe, expect, it } from 'vitest';
import { addSkip, type DayMenu } from '../menu';
import { dayRecord, recordStreak, weekRecord } from '../record';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { Meal } from '../types';

const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '20:00', 35)] };
const line = { foodId: 'chapati', unit: 'piece', qty: 2 };
/** Breakfast, lunch and dinner planned; a tea slot with nothing planned. */
const menu = (date: string): DayMenu => ({
  date,
  editedAt: '',
  meals: [
    { id: 'morning', type: 'breakfast', time: '08:30', lines: [line] },
    { id: 'lunch', type: 'lunch', time: '13:00', lines: [line] },
    { id: 'tea', type: 'snack', time: '16:00', lines: [] },
    { id: 'dinner', type: 'dinner', time: '20:00', lines: [line] },
  ],
});
const meal = (date: string, slotId: string, source?: Meal['source']): Meal => ({ id: `${date}-${slotId}`, at: new Date(`${date}T12:00:00`).toISOString(), date, type: 'lunch', slotId, items: [], kcal: 400, protein: 10, source });
const fullDay = (date: string) => [meal(date, 'morning'), meal(date, 'lunch'), meal(date, 'dinner')];
// 27 October 2026 is a Tuesday.
const TODAY = '2026-10-27';
const base = { today: TODAY, routine, skips: [], offDays: [] as number[] };
const rec = (date: string, meals: Meal[], extra: Partial<Parameters<typeof dayRecord>[0]> = {}) => dayRecord({ ...base, date, menu: menu(date), meals, ...extra });

describe('dayRecord', () => {
  it('is full when every planned meal was eaten or skipped; a slot with nothing planned does not count', () => {
    const d = '2026-10-26';
    expect(rec(d, [meal(d, 'morning'), meal(d, 'lunch')], { skips: addSkip([], d, 'dinner') })).toEqual({ state: 'full', fromPlan: false });
  });

  it('is partial with some, empty with none, and partial when only an unplanned slot was eaten', () => {
    const d = '2026-10-26';
    expect(rec(d, [meal(d, 'lunch')]).state).toBe('partial');
    expect(rec(d, []).state).toBe('empty');
    expect(rec(d, [meal(d, 'tea')]).state).toBe('partial');
  });

  it('counts today too: partial until its last slot is settled', () => {
    expect(rec(TODAY, [meal(TODAY, 'morning'), meal(TODAY, 'lunch')]).state).toBe('partial');
    expect(rec(TODAY, fullDay(TODAY)).state).toBe('full');
  });

  it('a date after today is planned, and an off day is off', () => {
    expect(rec('2026-10-28', []).state).toBe('planned');
    // 25 October 2026 is a Sunday.
    expect(rec('2026-10-25', [], { offDays: [0] }).state).toBe('off');
  });

  it('marks a day while any meal of it is still filled in from the plan', () => {
    const d = '2026-10-26';
    expect(rec(d, [meal(d, 'morning', 'auto'), meal(d, 'lunch', 'plan'), meal(d, 'dinner')])).toEqual({ state: 'full', fromPlan: true });
    expect(rec(d, [meal(d, 'morning', 'plan'), meal(d, 'lunch', 'plan'), meal(d, 'dinner', 'plan')]).fromPlan).toBe(false);
  });

  it('judges a date with no menu against every slot of the pattern', () => {
    const d = '2026-10-20';
    expect(dayRecord({ ...base, date: d, menu: null, meals: [meal(d, 'morning'), meal(d, 'lunch')] }).state).toBe('partial');
    expect(dayRecord({ ...base, date: d, menu: null, meals: fullDay(d) }).state).toBe('full');
  });
});

describe('weekRecord', () => {
  it('gives the seven days from Monday for the week strip', () => {
    const out = weekRecord({ ...base, monday: '2026-10-26', menuOn: menu, meals: fullDay('2026-10-26') });
    expect(out.map((r) => r.state)).toEqual(['full', 'empty', 'planned', 'planned', 'planned', 'planned', 'planned']);
  });
});

describe('recordStreak', () => {
  const streakOf = (meals: Meal[], offDays: number[] = []) => recordStreak({ ...base, offDays, menuOn: menu, meals });

  it('does not drop to 0 in the morning: a today with nothing yet keeps yesterday\'s streak', () => {
    expect(streakOf([...fullDay('2026-10-24'), ...fullDay('2026-10-25'), ...fullDay('2026-10-26')])).toBe(3);
  });

  it('counts today once it is full', () => {
    expect(streakOf([...fullDay('2026-10-24'), ...fullDay('2026-10-25'), ...fullDay('2026-10-26'), ...fullDay(TODAY)])).toBe(4);
  });

  it('a partial day breaks it', () => {
    expect(streakOf([...fullDay('2026-10-24'), meal('2026-10-25', 'lunch'), ...fullDay('2026-10-26')])).toBe(1);
  });

  it('an off day neither breaks it nor counts', () => {
    expect(streakOf([...fullDay('2026-10-24'), ...fullDay('2026-10-26')], [0])).toBe(2);
  });
});
