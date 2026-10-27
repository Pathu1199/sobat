import { describe, expect, it } from 'vitest';
import { adviceToSay, coachAdvice, type Advice, type CoachInput } from '../coach';
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, type Routine } from '../routine';
import type { Budget } from '../nutrition';
import type { Meal } from '../types';
import { fill, makeT, t as tr } from '../../i18n';

const TODAY = '2026-10-08';
const meal = (type: Meal['type'], hour: number, kcal: number): Meal => ({ id: type + hour, at: `${TODAY}T${String(hour).padStart(2, '0')}:00:00`, date: TODAY, type, items: [], kcal, protein: 15 });
const budget = (consumed: number, target = 1700): Budget => ({ target, consumed, remaining: target - consumed, earned: 0, perMeal: 500, mealsLeft: 2, proteinTarget: 110, proteinConsumed: 20, proteinLeft: 90, pct: consumed / target });
/** The four meals of the day: breakfast 08:30, lunch 13:00, snack 16:00, dinner 20:30. */
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_SLOTS };
/** The clock as the app gives it: minutes after midnight. The coach reads the hour off the same clock. */
const clock = (hour: number, minute: number) => ({ nowMinutes: hour * 60 + minute });

const base: CoachInput = {
  today: TODAY,
  ...clock(13, 30),
  budget: budget(400),
  meals: [meal('breakfast', 8, 400)],
  water: [{ id: 'w', at: '', date: TODAY, ml: 1500 }],
  sleep: [{ date: TODAY, bed: '23:00', wake: '06:30', quality: 4, wakeups: 0, energy: 4, minutes: 450, score: 80 }],
  weights: [{ date: '2026-10-04', kg: 95.8 }],
  steps: 4000,
  waterGoalMl: 3000,
  weighDay: 0,
  kcalTarget: 1700,
  streakDays: 2,
  routine,
  settledSlotIds: ['breakfast'],
  nextPlate: { id: 'lunch', type: 'lunch', budget: 600, kcal: 580, names: ['Palak bhaji', 'Chapati', 'Dal'] },
};

describe('coachAdvice', () => {
  it('names the meal that is on, with its plate and budget', () => {
    const a = coachAdvice(base);
    expect(a[0].key).toBe('coach_meal_plate');
    expect(a[0].params.meal).toBe('lunch');
    expect(a[0].params.kcal).toBe(600);
    expect(a[0].action).toBe('plan');
  });

  it('says stop when the day is spent, and asks for water when behind', () => {
    const a = coachAdvice({ ...base, ...clock(19, 30), budget: budget(1680), water: [] });
    expect(a.find((x) => x.key === 'coach_stop')).toBeTruthy();
    const water = a.find((x) => x.key === 'coach_water');
    expect(water?.urgency).toBe('now');
  });

  it('asks for the first log, a walk, the weigh-in and the morning check-in at the right hours', () => {
    const morning = coachAdvice({ ...base, ...clock(8, 30), meals: [], sleep: [], weights: [{ date: '2026-09-27', kg: 96 }], today: '2026-10-11' /* a Sunday */ });
    expect(morning.map((x) => x.key)).toEqual(expect.arrayContaining(['coach_sleep_checkin', 'coach_weigh']));
    const afternoon = coachAdvice({ ...base, ...clock(17, 30), steps: 1200, meals: [meal('breakfast', 8, 400), meal('lunch', 13, 600)], budget: budget(1000) });
    expect(afternoon.map((x) => x.key)).toContain('coach_walk');
    const noon = coachAdvice({ ...base, ...clock(14, 30), meals: [], settledSlotIds: [], budget: budget(0) });
    expect(noon.slice(0, 2).map((x) => x.key)).toEqual(['coach_meal_plate', 'coach_log_first']);
    expect(noon.find((x) => x.key === 'coach_log_first')?.urgency).toBe('now');
  });

  it('orders by urgency', () => {
    const a = coachAdvice({ ...base, ...clock(19, 30), budget: budget(1680), water: [] });
    const order = a.map((x) => x.urgency);
    const rank = { now: 0, soon: 1, note: 2 };
    for (let i = 1; i < order.length; i++) expect(rank[order[i]]).toBeGreaterThanOrEqual(rank[order[i - 1]]);
  });

  it('reads the meal clock from the pattern: a 21:30 dinner is not late at 21:00, and is at 22:20', () => {
    const lateDinner: Routine = { ...routine, slots: DEFAULT_SLOTS.map((s) => (s.id === 'dinner' ? { ...s, time: '21:30' } : s)) };
    const at = (hour: number, minute: number) => coachAdvice({ ...base, routine: lateDinner, ...clock(hour, minute), settledSlotIds: ['breakfast', 'lunch', 'snack'], budget: budget(1100) });
    expect(at(21, 0).map((x) => x.key)).not.toContain('coach_late_dinner');
    expect(at(22, 20).map((x) => x.key)).toContain('coach_late_dinner');
  });

  it('with two snack slots, the next meal is the slot after the one just eaten, at its own time', () => {
    const twoSnacks: Routine = { ...routine, slots: [...DEFAULT_SLOTS, { ...DEFAULT_SLOTS[2], id: 'evening', time: '18:30', label_en: 'Evening' }] };
    const a = coachAdvice({ ...base, routine: twoSnacks, ...clock(16, 30), settledSlotIds: ['breakfast', 'lunch', 'snack'], budget: budget(1100) });
    expect(a.find((x) => x.key === 'coach_next_meal')?.params).toMatchObject({ slot: 'evening', at: '18:30' });
  });

  it('takes a skipped slot as settled: no call to eat it, the next meal named with no water-only clause, and a skipped dinner is not late', () => {
    // Lunch skipped: at 14:30 the coach names the snack at its own time and says nothing more about lunch.
    const a = coachAdvice({ ...base, ...clock(14, 30), settledSlotIds: ['breakfast', 'lunch'] });
    expect(a.filter((x) => x.params.slot === 'lunch')).toEqual([]);
    const next = a.find((x) => x.key === 'coach_next_meal')!;
    expect(next.params).toMatchObject({ slot: 'snack', at: '16:00' });
    // After a missed meal the next one is named plainly, with no "only water until then".
    const en = makeT('en');
    const text = fill(en(next.key), { ...next.params, meal: en(String(next.params.meal)).toLowerCase() });
    expect(text).toBe('Next: snack at 16:00, about 500 kcal.');
    expect(text).not.toMatch(/water/i);
    expect(tr('mr', next.key)).not.toContain('पाणी');
    expect(tr('hi', next.key)).not.toContain('पानी');
    const night = coachAdvice({ ...base, ...clock(22, 0), settledSlotIds: ['breakfast', 'lunch', 'snack', 'dinner'], budget: budget(1100) });
    expect(night.map((x) => x.key)).not.toContain('coach_late_dinner');
  });

  it('reads the clock as minutes after midnight: at 10:40 with breakfast eaten it names lunch at 13:00 and nothing about dinner', () => {
    const a = coachAdvice({ ...base, ...clock(10, 40), settledSlotIds: ['breakfast'] });
    expect(a.find((x) => x.key === 'coach_next_meal')?.params).toMatchObject({ slot: 'lunch', at: '13:00' });
    expect(a.filter((x) => x.params.slot === 'dinner' || x.params.meal === 'dinner' || x.key === 'coach_late_dinner')).toEqual([]);
  });

  it('reads the hour off the same clock as the meals: bedtime is said from 22:00, not at 21:59', () => {
    const at = (hour: number, minute: number) => coachAdvice({ ...base, ...clock(hour, minute), settledSlotIds: ['breakfast', 'lunch', 'snack', 'dinner'], budget: budget(1600) }).map((x) => x.key);
    expect(at(21, 59)).not.toContain('coach_bedtime');
    expect(at(22, 0)).toContain('coach_bedtime');
  });

  it('a 20:30 dinner at 20:45, inside its grace, still gets its plate; at 21:16, past it, only the late-dinner call', () => {
    const plate = { id: 'dinner', type: 'dinner' as const, budget: 450, kcal: 430, names: ['Bhakri', 'Pithla'] };
    const evening = (hour: number, minute: number) => coachAdvice({ ...base, ...clock(hour, minute), settledSlotIds: ['breakfast', 'lunch', 'snack'], budget: budget(1100), nextPlate: plate });
    expect(evening(20, 45).filter((x) => x.params.slot === 'dinner')).toEqual([expect.objectContaining({ key: 'coach_meal_plate', urgency: 'soon', params: expect.objectContaining({ slot: 'dinner', kcal: 450 }) })]);
    const late = evening(21, 16);
    expect(late.filter((x) => x.params.slot === 'dinner')).toEqual([expect.objectContaining({ key: 'coach_late_dinner', urgency: 'now', params: { slot: 'dinner', kcal: 450 } })]);
    expect(late.map((x) => x.key)).not.toContain('coach_meal_plate');
    expect(late.map((x) => x.key)).not.toContain('coach_meal_due');
  });

  it('calls a dinner past its grace once, as late, with its plate and its slot', () => {
    // Dinner at 20:30 with nothing in it at 21:30: one late-dinner call, not the dinner plate as well.
    const late = { ...base, ...clock(21, 30), settledSlotIds: ['breakfast', 'lunch', 'snack'], budget: budget(1100) };
    const a = coachAdvice({ ...late, nextPlate: { id: 'dinner', type: 'dinner', budget: 450, kcal: 430, names: ['Bhakri', 'Pithla'] } });
    expect(a.filter((x) => x.params.slot === 'dinner')).toEqual([expect.objectContaining({ key: 'coach_late_dinner', urgency: 'now', params: { slot: 'dinner', kcal: 450 } })]);
    expect(a.map((x) => x.key)).not.toContain('coach_meal_plate');
    // With no plate laid for dinner, the size comes from what is left.
    const bare = coachAdvice({ ...late, nextPlate: null });
    expect(bare.filter((x) => x.params.slot === 'dinner')).toEqual([expect.objectContaining({ key: 'coach_late_dinner', params: { slot: 'dinner', kcal: 500 } })]);
    expect(bare.map((x) => x.key)).not.toContain('coach_meal_due');
  });
});

describe('adviceToSay', () => {
  const urgent: Advice = { key: 'coach_stop', kind: 'stop', urgency: 'now', action: 'water', params: {} };
  const soon: Advice = { key: 'coach_meal_plate', kind: 'food', urgency: 'soon', action: 'log', params: {} };
  const said = new Set<string>();
  const here = { known: true, active: true, nudgesEnabled: true, hour: 13, quietStartHour: 22, quietEndHour: 7 };

  it('says the first urgent advice to the person who is here', () => {
    expect(adviceToSay({ ...here, advice: [soon, urgent], said })).toBe(urgent);
  });

  it('says nothing on a device that is signed out or reset', () => {
    expect(adviceToSay({ ...here, active: false, advice: [urgent], said })).toBeNull();
  });

  it('says nothing before the store and the session are known', () => {
    expect(adviceToSay({ ...here, known: false, advice: [urgent], said })).toBeNull();
  });

  it('says nothing with nudges off or in quiet hours', () => {
    expect(adviceToSay({ ...here, nudgesEnabled: false, advice: [urgent], said })).toBeNull();
    expect(adviceToSay({ ...here, hour: 23, advice: [urgent], said })).toBeNull();
  });

  it('never says the same thing twice, and never advice with nothing to do', () => {
    const quiet: Advice = { ...urgent, key: 'coach_win', action: 'none' };
    expect(adviceToSay({ ...here, advice: [urgent, quiet], said: new Set(['coach_stop']) })).toBeNull();
  });
});
