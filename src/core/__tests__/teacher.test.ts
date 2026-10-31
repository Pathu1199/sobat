import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import { dayScore, nothingDone, scoreOf, teacherWords, type DayScore } from '../teacher';
import type { AbhyasItem, AbhyasTick, Meal } from '../types';

const DAY = '2026-10-28';
const slot = (id: string, type: RoutineSlot['type'], time: string): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share: 30 });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30'), slot('lunch', 'lunch', '13:00'), slot('dinner', 'dinner', '20:30')] };
const meal = (slotId: string): Meal => ({ id: slotId, at: `${DAY}T08:00:00.000Z`, date: DAY, type: 'lunch', slotId, items: [], kcal: 400, protein: 10 });
const item = (id: string, order: number): AbhyasItem => ({ id, name: id, icon: 'book-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: [], order, createdAt: '2026-10-01T03:00:00.000Z' });
const tick = (itemId: string): AbhyasTick => ({ id: `${itemId}@${DAY}`, itemId, date: DAY, at: `${DAY}T09:00:00.000Z` });
const t = makeT('en');
const score = (p: Partial<DayScore> = {}): DayScore => ({ meals: { done: 0, of: 2 }, jobs: { done: 0, of: 0, next: null }, water: { ml: 0, goal: 3000 }, walk: { min: 0, goal: 30 }, ...p });

describe('dayScore', () => {
  const input = {
    date: DAY,
    routine,
    meals: [meal('morning')],
    skips: [],
    nowMinutes: 18 * 60,
    abhyas: { items: [item('Yoga', 0), item('Coding', 1), item('Reading', 2)], ticks: [tick('Yoga')], sessions: [], running: null },
    now: new Date(`${DAY}T18:00:00`),
    water: [{ id: 'w', at: '', date: DAY, ml: 3000 }],
    activities: [],
    waterGoalMl: 3000,
    walkGoalMin: 30,
  };

  it('counts the meals due so far, the jobs done with the first one left, water and the walk', () => {
    // At 18:00 dinner (20:30) is not due yet: one of two meals.
    expect(dayScore(input)).toEqual({ meals: { done: 1, of: 2 }, jobs: { done: 1, of: 3, next: 'Coding' }, water: { ml: 3000, goal: 3000 }, walk: { min: 0, goal: 30 } });
    expect(dayScore({ ...input, nowMinutes: 1440 }).meals).toEqual({ done: 1, of: 3 });
  });

  it('scores a day by meals logged, jobs done and the water goal met', () => {
    expect(scoreOf(dayScore(input))).toBe(3);
    expect(nothingDone(score())).toBe(true);
    expect(nothingDone(score({ walk: { min: 10, goal: 30 } }))).toBe(false);
  });
});

describe('teacherWords', () => {
  it('starts with what went well, then one tip for tomorrow: the first job not done', () => {
    const today = score({ meals: { done: 2, of: 2 }, jobs: { done: 2, of: 3, next: 'Coding' }, water: { ml: 3000, goal: 3000 }, walk: { min: 15, goal: 30 } });
    expect(teacherWords({ today, yesterday: null, earlier: [] }, t)).toEqual({
      lead: 'Well done today: 2 of 3 jobs done, every meal logged, water goal met, 15 min walked.',
      best: null,
      tip: 'Tomorrow, start Coding a little earlier.',
    });
  });

  it('takes the tip from what is left, in turn: jobs, meals, water, the walk, else the same again', () => {
    const tip = (p: Partial<DayScore>) => teacherWords({ today: score({ meals: { done: 1, of: 1 }, water: { ml: 3000, goal: 3000 }, walk: { min: 30, goal: 30 }, ...p }), yesterday: null, earlier: [] }, t).tip;
    expect(tip({ meals: { done: 1, of: 2 } })).toBe('Tomorrow, log each meal as you eat it.');
    expect(tip({ water: { ml: 1000, goal: 3000 } })).toBe('Tomorrow, one bottle of water before lunch.');
    expect(tip({ walk: { min: 10, goal: 30 } })).toBe('Tomorrow, a ten-minute walk after a meal.');
    expect(tip({})).toBe('Tomorrow, the same again. You know how.');
  });

  it('a day with nothing done yet is "not yet", never missed, with one easier thing for tomorrow', () => {
    expect(teacherWords({ today: score(), yesterday: null, earlier: [] }, t)).toEqual({
      lead: "Not yet today, and that's okay.",
      best: null,
      tip: 'Tomorrow, just one small thing: a bottle of water when you wake up.',
    });
  });

  it('welcomes the user back on the first evening after a day with nothing done', () => {
    const today = score({ meals: { done: 1, of: 2 } });
    expect(teacherWords({ today, yesterday: score(), earlier: [score()] }, t).lead).toBe('Welcome back. Well done today: 1 meal logged.');
    expect(teacherWords({ today: score({ water: { ml: 500, goal: 3000 } }), yesterday: null, earlier: [] }, t).lead).toBe('Well done today: you made a start.');
  });

  it('says so when today did more than every other day of the week so far', () => {
    const today = score({ meals: { done: 2, of: 2 }, jobs: { done: 3, of: 3, next: null }, water: { ml: 3000, goal: 3000 } });
    const earlier = [score({ meals: { done: 2, of: 2 } }), score({ jobs: { done: 3, of: 3, next: null } })];
    expect(teacherWords({ today, yesterday: earlier[1], earlier }, t).best).toBe('Today was your best day this week: 6 of 6 done.');
    // A tie is not the best, and Monday has nothing to compare with.
    expect(teacherWords({ today, yesterday: null, earlier: [today] }, t).best).toBeNull();
    expect(teacherWords({ today, yesterday: null, earlier: [] }, t).best).toBeNull();
  });

  it('speaks Marathi and Hindi', () => {
    const today = score({ jobs: { done: 3, of: 3, next: null }, meals: { done: 2, of: 2 }, water: { ml: 3000, goal: 3000 }, walk: { min: 30, goal: 30 } });
    expect(teacherWords({ today, yesterday: null, earlier: [] }, makeT('mr')).lead).toBe('आज छान केलंत: 3 पैकी 3 कामं पूर्ण, सगळी जेवणं नोंदवली, पाण्याचं लक्ष्य पूर्ण, 30 मिनिटे चाललात.');
    expect(teacherWords({ today: score(), yesterday: null, earlier: [] }, makeT('hi')).lead).toBe('आज अभी कुछ नहीं हुआ, और यह ठीक है.');
  });
});
