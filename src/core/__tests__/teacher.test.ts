import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import { dayScore, EVENING_FROM, nothingDone, scoreOf, teacherOn, teacherWords, weekScores, type DayScore } from '../teacher';
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

  it('says so only when today did at least half of what the day held: one of six after a quiet week is no best day', () => {
    const quiet = [score({ meals: { done: 0, of: 2 } }), score()];
    // The day holds six things (two meals, three jobs, the water goal): one done is the best of a quiet week, and hollow.
    const hollow = score({ meals: { done: 1, of: 2 }, jobs: { done: 0, of: 3, next: 'Yoga' } });
    expect(teacherWords({ today: hollow, yesterday: null, earlier: quiet }, t).best).toBeNull();
    // Three of six is half: said. Two of six is not.
    const half = score({ meals: { done: 2, of: 2 }, jobs: { done: 1, of: 3, next: 'Yoga' } });
    expect(teacherWords({ today: half, yesterday: null, earlier: quiet }, t).best).toBe('Today was your best day this week: 3 of 6 done.');
    const third = score({ meals: { done: 2, of: 2 }, jobs: { done: 0, of: 3, next: 'Yoga' } });
    expect(teacherWords({ today: third, yesterday: null, earlier: quiet }, t).best).toBeNull();
    // The lead still praises what was done.
    expect(teacherWords({ today: hollow, yesterday: null, earlier: quiet }, t).lead).toBe('Well done today: 1 meal logged.');
  });

  it('says no best day for a day that scored nothing (a walk only), whatever the days before were', () => {
    const walkOnly = score({ walk: { min: 15, goal: 30 } });
    expect(scoreOf(walkOnly)).toBe(0);
    expect(teacherWords({ today: walkOnly, yesterday: null, earlier: [score()] }, t)).toMatchObject({ lead: 'Well done today: 15 min walked.', best: null });
  });

  it('does not welcome the user back on a day with nothing done, even after a day with nothing done: that is "not yet", never a welcome', () => {
    const words = teacherWords({ today: score(), yesterday: score(), earlier: [score()] }, t);
    expect(words.lead).toBe("Not yet today, and that's okay.");
    expect(words.lead).not.toMatch(/Welcome/);
    expect(words.best).toBeNull();
  });

  it('speaks Marathi and Hindi', () => {
    const today = score({ jobs: { done: 3, of: 3, next: null }, meals: { done: 2, of: 2 }, water: { ml: 3000, goal: 3000 }, walk: { min: 30, goal: 30 } });
    expect(teacherWords({ today, yesterday: null, earlier: [] }, makeT('mr')).lead).toBe('आज छान केलंत: 3 पैकी 3 कामं पूर्ण, सगळी जेवणं नोंदवली, पाण्याचं लक्ष्य पूर्ण, 30 मिनिटे चाललात.');
    expect(teacherWords({ today: score(), yesterday: null, earlier: [] }, makeT('hi')).lead).toBe('आज अभी कुछ नहीं हुआ, और यह ठीक है.');
  });
});

describe('teacherWords in Marathi and Hindi', () => {
  const mr = makeT('mr');
  const hi = makeT('hi');
  const done = score({ jobs: { done: 3, of: 3, next: null }, meals: { done: 2, of: 2 }, water: { ml: 3000, goal: 3000 }, walk: { min: 30, goal: 30 } });
  const earlier = [score({ meals: { done: 1, of: 2 } })];

  it('welcomes the user back after a day with nothing done', () => {
    const small = score({ meals: { done: 1, of: 2 } });
    expect(teacherWords({ today: small, yesterday: score(), earlier: [score()] }, mr).lead).toBe('पुन्हा स्वागत आहे. आज छान केलंत: 1 जेवण नोंदवलं.');
    expect(teacherWords({ today: small, yesterday: score(), earlier: [score()] }, hi).lead).toBe('फिर से स्वागत है. आज बढ़िया किया: 1 खाना दर्ज.');
  });

  it('praises a good day, names the best day of the week, in both', () => {
    expect(teacherWords({ today: done, yesterday: null, earlier }, hi)).toEqual({
      lead: 'आज बढ़िया किया: 3 में से 3 काम पूरे, सारे खाने दर्ज, पानी का लक्ष्य पूरा, 30 मिनट टहले.',
      best: 'आज इस हफ़्ते का आपका सबसे अच्छा दिन रहा: 6 में से 6 पूरे.',
      tip: 'कल भी ऐसे ही. आपसे हो रहा है.',
    });
    expect(teacherWords({ today: done, yesterday: null, earlier }, mr).best).toBe('आज या आठवड्यातला तुमचा सर्वोत्तम दिवस: 6 पैकी 6 पूर्ण.');
  });

  it('gives each tip in both: a job, a meal, water, a walk, and the not-yet one', () => {
    const tip = (t: (k: string) => string, p: Partial<DayScore>) => teacherWords({ today: score({ meals: { done: 1, of: 1 }, water: { ml: 3000, goal: 3000 }, walk: { min: 30, goal: 30 }, ...p }), yesterday: null, earlier: [] }, t).tip;
    expect(tip(hi, { jobs: { done: 1, of: 2, next: 'योग' } })).toBe('कल योग थोड़ा पहले शुरू करें.');
    expect(tip(hi, { meals: { done: 1, of: 2 } })).toBe('कल हर खाना खाते ही दर्ज करें.');
    expect(tip(hi, { water: { ml: 1000, goal: 3000 } })).toBe('कल दोपहर के खाने से पहले एक बोतल पानी.');
    expect(tip(hi, { walk: { min: 10, goal: 30 } })).toBe('कल खाने के बाद दस मिनट टहलें.');
    expect(tip(mr, { jobs: { done: 1, of: 2, next: 'योग' } })).toBe('उद्या योग थोडं लवकर सुरू करा.');
    expect(tip(mr, { meals: { done: 1, of: 2 } })).toBe('उद्या प्रत्येक जेवण खाल्ल्यावर लगेच नोंदवा.');
    expect(tip(mr, { water: { ml: 1000, goal: 3000 } })).toBe('उद्या दुपारच्या जेवणाआधी एक बाटली पाणी.');
    expect(tip(mr, { walk: { min: 10, goal: 30 } })).toBe('उद्या जेवणानंतर दहा मिनिटे चाला.');
    expect(teacherWords({ today: score(), yesterday: null, earlier: [] }, hi).tip).toBe('कल बस एक छोटी चीज़: उठते ही एक बोतल पानी.');
    expect(teacherWords({ today: score(), yesterday: null, earlier: [] }, mr).tip).toBe('उद्या फक्त एक छोटी गोष्ट: उठल्यावर एक बाटली पाणी.');
  });
});

describe('weekScores', () => {
  // Thursday 29 October 2026; the week began on Monday the 26th.
  const THURSDAY = '2026-10-29';
  const mark = (date: string) => score({ meals: { done: Number(date.slice(8)) - 25, of: 2 } });

  it('is this week\'s days before today, Monday on, each read as the day ended', () => {
    const asked: string[] = [];
    const out = weekScores({ today: THURSDAY, since: '2026-10-01', offDays: [], score: (d) => { asked.push(d); return mark(d); } });
    expect(asked).toEqual(['2026-10-26', '2026-10-27', '2026-10-28']);
    expect(out.map((d) => d.meals.done)).toEqual([1, 2, 3]);
  });

  it('has none on a Monday, the first day of the week', () => {
    expect(weekScores({ today: '2026-10-26', since: '2026-10-01', offDays: [], score: mark })).toEqual([]);
  });

  it('leaves out the days before the user started, and off days', () => {
    // Started on Tuesday the 27th: Monday is not a day that counts.
    expect(weekScores({ today: THURSDAY, since: '2026-10-27', offDays: [], score: mark }).map((d) => d.meals.done)).toEqual([2, 3]);
    // Tuesday is a free day: left out; Monday and Wednesday count.
    expect(weekScores({ today: THURSDAY, since: '2026-10-01', offDays: [2], score: mark }).map((d) => d.meals.done)).toEqual([1, 3]);
  });

  it('a tie with the best day before is not a best day', () => {
    const today = score({ meals: { done: 2, of: 2 }, jobs: { done: 2, of: 2, next: null } });
    const earlier = weekScores({ today: THURSDAY, since: '2026-10-01', offDays: [], score: (d) => (d === '2026-10-27' ? today : score()) });
    expect(teacherWords({ today, yesterday: null, earlier }, t).best).toBeNull();
  });
});

describe('teacherOn', () => {
  // Wednesday 28 October 2026; Wednesday is weekday 3.
  const WEDNESDAY = '2026-10-28';

  it('is the coach from six in the evening, not before', () => {
    expect(EVENING_FROM).toBe(18 * 60);
    expect(teacherOn(18 * 60, WEDNESDAY, [])).toBe(true);
    expect(teacherOn(23 * 60 + 59, WEDNESDAY, [])).toBe(true);
    expect(teacherOn(18 * 60 - 1, WEDNESDAY, [])).toBe(false);
  });

  it('stays quiet on a free day, as the morning coach does, and speaks on the days around it', () => {
    expect(teacherOn(20 * 60, WEDNESDAY, [3])).toBe(false);
    expect(teacherOn(20 * 60, WEDNESDAY, [0, 6])).toBe(true);
    expect(teacherOn(20 * 60, WEDNESDAY, undefined)).toBe(true);
  });
});
