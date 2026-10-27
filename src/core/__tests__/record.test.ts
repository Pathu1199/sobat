import { describe, expect, it } from 'vitest';
import { addSkip, type DayMenu } from '../menu';
import { dayRecord, recordStreak, streakStep, weekRecord } from '../record';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import { KCAL_FLOOR } from '../nutrition';
import type { Meal, SlotSkip } from '../types';

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
/** A meal of 600 kcal unless told otherwise: three make an 1800 kcal day, two the 1200 kcal safe minimum. */
const meal = (date: string, slotId: string, source?: Meal['source'], kcal = 600): Meal => ({ id: `${date}-${slotId}`, at: new Date(`${date}T12:00:00`).toISOString(), date, type: 'lunch', slotId, items: [], kcal, protein: 10, source });
const fullDay = (date: string) => [meal(date, 'morning'), meal(date, 'lunch'), meal(date, 'dinner')];
// 27 October 2026 is a Tuesday.
const TODAY = '2026-10-27';
// The safe minimum is the person's: 1200 kcal for a woman.
const base = { today: TODAY, routine, skips: [], offDays: [] as number[], floor: KCAL_FLOOR.female };
const rec = (date: string, meals: Meal[], extra: Partial<Parameters<typeof dayRecord>[0]> = {}) => dayRecord({ ...base, date, menu: menu(date), meals, ...extra });

describe('dayRecord', () => {
  it('is full when every planned meal was eaten or skipped; a slot with nothing planned does not count', () => {
    const d = '2026-10-26';
    expect(rec(d, [meal(d, 'morning'), meal(d, 'lunch')], { skips: addSkip([], d, 'dinner') })).toEqual({ state: 'full', fromPlan: false, nothingEaten: false });
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
    expect(rec(d, [meal(d, 'morning', 'auto'), meal(d, 'lunch', 'plan'), meal(d, 'dinner')])).toEqual({ state: 'full', fromPlan: true, nothingEaten: false });
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

  // Every planned slot of the date marked skipped, nothing eaten.
  const allSkipped = (date: string) => ['morning', 'lunch', 'dinner'].reduce<SlotSkip[]>((acc, id) => addSkip(acc, date, id), []);

  it('a day settled only by skips is a complete record, but never counts and ends the run: skipping is never rewarded', () => {
    expect(rec('2026-10-25', [], { skips: allSkipped('2026-10-25') })).toEqual({ state: 'full', fromPlan: false, nothingEaten: true });
    const meals = [...fullDay('2026-10-24'), ...fullDay('2026-10-26')];
    expect(recordStreak({ ...base, skips: allSkipped('2026-10-25'), menuOn: menu, meals })).toBe(1);
  });

  it('a day with one meal eaten and the rest skipped, under the safe minimum, neither counts nor ends the run', () => {
    const skips = addSkip(addSkip([], '2026-10-25', 'morning'), '2026-10-25', 'dinner');
    const meals = [...fullDay('2026-10-24'), meal('2026-10-25', 'lunch'), ...fullDay('2026-10-26')];
    expect(rec('2026-10-25', meals, { skips }).state).toBe('full');
    expect(recordStreak({ ...base, skips, menuOn: menu, meals })).toBe(2);
  });

  it('a full day eaten under the safe minimum neither counts nor ends the run: a sick day is not punished, and eating little is never rewarded', () => {
    // Every planned meal eaten, but small: 3 × 300 is 900 kcal, under 1200.
    const light = ['morning', 'lunch', 'dinner'].map((id) => meal('2026-10-25', id, undefined, 300));
    const meals = [...fullDay('2026-10-23'), ...fullDay('2026-10-24'), ...light, ...fullDay('2026-10-26')];
    expect(rec('2026-10-25', meals).state).toBe('full');
    expect(streakOf(meals)).toBe(3);
    // At the safe minimum it counts: 3 × 400 is 1200.
    const enough = ['morning', 'lunch', 'dinner'].map((id) => meal('2026-10-25', id, undefined, 400));
    expect(streakOf([...fullDay('2026-10-23'), ...fullDay('2026-10-24'), ...enough, ...fullDay('2026-10-26')])).toBe(4);
    // The minimum is the person's own: the same 1200 kcal day is under a man's 1500.
    expect(recordStreak({ ...base, floor: KCAL_FLOOR.male, menuOn: menu, meals: [...fullDay('2026-10-24'), ...enough, ...fullDay('2026-10-26')] })).toBe(2);
  });

  it('a today eaten under the safe minimum neither counts nor ends the run', () => {
    const before = [...fullDay('2026-10-25'), ...fullDay('2026-10-26')];
    const light = ['morning', 'lunch', 'dinner'].map((id) => meal(TODAY, id, undefined, 300));
    expect(streakOf([...before, ...light])).toBe(2);
  });

  it('a meal logged without a slot settles the slot it was eaten in, matched by its type and time', () => {
    const d = '2026-10-26';
    // Breakfast at 08:45 and dinner at 20:10, neither naming its slot.
    const loose = (id: string, type: Meal['type'], hhmm: string): Meal => ({ id, at: new Date(`${d}T${hhmm}:00`).toISOString(), date: d, type, items: [], kcal: 600, protein: 10 });
    const meals = [loose('b', 'breakfast', '08:45'), meal(d, 'lunch'), loose('d', 'dinner', '20:10')];
    expect(rec(d, meals).state).toBe('full');
    expect(streakOf([...fullDay('2026-10-25'), ...meals])).toBe(2);
  });

  it('on dates whose menu holds no meals, a day eaten up to the safe minimum counts and a day with nothing breaks the run', () => {
    const bare = (date: string): DayMenu => ({ date, editedAt: '', meals: [] });
    const meals = [meal('2026-10-23', 'lunch', undefined, 1300), meal('2026-10-25', 'lunch', undefined, 1300), meal('2026-10-26', 'dinner', undefined, 1300)];
    expect(recordStreak({ ...base, menuOn: bare, meals })).toBe(2);
    expect(dayRecord({ ...base, date: '2026-10-24', menu: bare('2026-10-24'), meals }).state).toBe('empty');
  });

  it('looks back no further than the limit', () => {
    const meals = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', TODAY].flatMap(fullDay);
    expect(streakOf(meals)).toBe(8);
    expect(recordStreak({ ...base, menuOn: menu, meals, limit: 3 })).toBe(3);
    // Today not settled yet still takes one of the days looked at.
    expect(recordStreak({ ...base, menuOn: menu, meals: meals.filter((m) => m.date !== TODAY), limit: 3 })).toBe(2);
  });

  it('a today with some meals eaten neither counts nor breaks the run until it is full', () => {
    const before = [...fullDay('2026-10-25'), ...fullDay('2026-10-26')];
    expect(streakOf([...before, meal(TODAY, 'morning')])).toBe(2);
    expect(streakOf([...before, meal(TODAY, 'morning'), meal(TODAY, 'lunch')])).toBe(2);
    expect(streakOf([...before, ...fullDay(TODAY)])).toBe(3);
  });

  it('skips on several days inside the run keep it going: each of those days is full on what was eaten and skipped, and counts', () => {
    const skips = addSkip(addSkip(addSkip([], '2026-10-24', 'dinner'), '2026-10-25', 'morning'), TODAY, 'lunch');
    const meals = [
      meal('2026-10-24', 'morning'), meal('2026-10-24', 'lunch'),
      meal('2026-10-25', 'lunch'), meal('2026-10-25', 'dinner'),
      ...fullDay('2026-10-26'),
      meal(TODAY, 'morning'), meal(TODAY, 'dinner'),
    ];
    for (const d of ['2026-10-24', '2026-10-25', '2026-10-26', TODAY]) expect(rec(d, meals, { skips }), d).toEqual({ state: 'full', fromPlan: false, nothingEaten: false });
    expect(recordStreak({ ...base, skips, menuOn: menu, meals })).toBe(4);
  });

  it('a today settled by skips alone, nothing eaten, ends the run at once: it is a full day, so it need not wait for tomorrow', () => {
    const meals = [...fullDay('2026-10-24'), ...fullDay('2026-10-25'), ...fullDay('2026-10-26')];
    expect(recordStreak({ ...base, skips: allSkipped(TODAY), menuOn: menu, meals })).toBe(0);
    // Warm water in the morning slot and the rest skipped is still nothing eaten.
    const skips = addSkip(addSkip([], TODAY, 'lunch'), TODAY, 'dinner');
    expect(recordStreak({ ...base, skips, menuOn: menu, meals: [...meals, meal(TODAY, 'morning', undefined, 0)] })).toBe(0);
    // A today not settled yet still never ends it.
    expect(recordStreak({ ...base, skips: addSkip([], TODAY, 'lunch'), menuOn: menu, meals })).toBe(3);
  });

  it('a full day with under 50 kcal eaten is nothing eaten and ends the run: warm water, black tea or coffee in one slot and every other slot skipped', () => {
    const d = '2026-10-25';
    const skips = addSkip(addSkip([], d, 'lunch'), d, 'dinner');
    const before = fullDay('2026-10-24');
    const after = fullDay('2026-10-26');
    // Warm water: 0 kcal.
    const water = [...before, meal(d, 'morning', undefined, 0), ...after];
    expect(rec(d, water, { skips })).toMatchObject({ state: 'full', nothingEaten: true });
    expect(rec(d, [meal(d, 'morning', undefined, 40)], { skips }).nothingEaten).toBe(true);
    expect(rec(d, [meal(d, 'morning')], { skips }).nothingEaten).toBe(false);
    expect(recordStreak({ ...base, skips, menuOn: menu, meals: water })).toBe(1);
    // A cup of tea: 40 kcal.
    expect(recordStreak({ ...base, skips, menuOn: menu, meals: [...before, meal(d, 'morning', undefined, 40), ...after] })).toBe(1);
    // A real meal under the safe minimum holds: 600 kcal.
    expect(recordStreak({ ...base, skips, menuOn: menu, meals: [...before, meal(d, 'morning'), ...after] })).toBe(2);
  });
});

describe('streakStep', () => {
  const ate = (kcal: number) => [meal(TODAY, 'lunch', undefined, kcal)];

  it('is the one rule the streak and the best run both follow', () => {
    // A full day at or above the safe minimum counts; a full day eaten under it holds.
    expect(streakStep('full', ate(1200), 1200)).toBe('count');
    expect(streakStep('full', [...ate(600), meal(TODAY, 'dinner')], 1200)).toBe('count');
    expect(streakStep('full', ate(1199), 1200)).toBe('hold');
    // Under 50 kcal is nothing eaten, a drink and no meal, and ends the run, whatever the minimum; 50 or more under the minimum holds.
    expect(streakStep('full', ate(0), 0)).toBe('break');
    expect(streakStep('full', ate(40), 1200)).toBe('break');
    expect(streakStep('full', ate(49), 0)).toBe('break');
    expect(streakStep('full', ate(50), 1200)).toBe('hold');
    expect(streakStep('full', ate(50), 0)).toBe('count');
    expect(streakStep('full', ate(600), 1200)).toBe('hold');
    // A total that is not a number (a damaged record) never counts and never ends the run.
    expect(streakStep('full', ate(Number.NaN), 1200)).toBe('hold');
    expect(streakStep('full', ate(Number.NaN), 0)).toBe('hold');
    // Every slot skipped and nothing eaten ends the run, whatever the minimum: skipping is never kept alive by the streak.
    expect(streakStep('full', [], 1200)).toBe('break');
    expect(streakStep('full', [], 0)).toBe('break');
    // An off day holds; any other day ends the run, however much was eaten.
    expect(streakStep('off', [], 1200)).toBe('hold');
    for (const state of ['partial', 'empty', 'planned'] as const) expect(streakStep(state, ate(2000), 1200)).toBe('break');
  });
});
