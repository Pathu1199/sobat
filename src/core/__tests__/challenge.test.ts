import { describe, expect, it } from 'vitest';
import { WALK_ACTIVITY_ID } from '../activity';
import { challengeChoices, challengeProgress, challengesDone, challengeText, clockOf, dailyChallenge, type ChallengeData, type DailyChallenge } from '../challenge';
import { addDays } from '../date';
import { makeT } from '../../i18n';
import type { AbhyasItem, AbhyasSession, ActivityLog, Meal, WaterLog } from '../types';

// Saturday 31 October 2026; the clock is Asia/Kolkata (vitest.config.mts).
const TODAY = '2026-10-31';
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
/** The seven days before today, 24 to 30 October. */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i - 7));
const meal = (date: string, hhmm: string, protein: number): Meal => ({ id: `${date}${hhmm}`, at: at(date, hhmm).toISOString(), date, type: 'lunch', items: [], kcal: 500, protein });
const water = (date: string, ml: number): WaterLog => ({ id: `w${date}${ml}`, at: '', date, ml });
const walk = (date: string, minutes: number): ActivityLog => ({ id: `a${date}${minutes}`, date, at: '', activityId: WALK_ACTIVITY_ID, minutes, intensity: 1, kcal: 40 });
const code: AbhyasItem = { id: 'code', name: 'Coding', icon: 'code-slash-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], targetMin: 30, times: [], order: 0, createdAt: at('2026-10-01', '06:00').toISOString() };
const session = (date: string, hhmm: string): AbhyasSession => ({ id: `code@${date}${hhmm}`, itemId: 'code', date, startedAt: at(date, hhmm).toISOString(), endedAt: at(date, '23:00').toISOString(), minutes: 30 });
const base: ChallengeData = { meals: [], water: [], activities: [], abhyas: { items: [], ticks: [], sessions: [], running: null }, bottleMl: 500, waterGoalMl: 3000, proteinTarget: 90, offDays: [] };
const choice = (data: ChallengeData, kind: DailyChallenge['kind'], date = TODAY) => challengeChoices(data, date).find((c) => c.kind === kind);

describe('dailyChallenge with no history', () => {
  it('is still one small step: two bottles of water or a ten-minute walk, in turn by the day', () => {
    expect(challengeChoices(base, TODAY)).toEqual([
      { date: TODAY, kind: 'water', target: 2, usual: 0 },
      { date: TODAY, kind: 'walk', target: 10, usual: 0 },
    ]);
    expect(dailyChallenge(base, TODAY)).toEqual({ date: TODAY, kind: 'walk', target: 10, usual: 0 });
    expect(dailyChallenge(base, '2026-11-01')).toEqual({ date: '2026-11-01', kind: 'water', target: 2, usual: 0 });
  });

  it('is none on an off day', () => {
    expect(dailyChallenge({ ...base, offDays: [6] }, TODAY)).toBeNull();
  });
});

describe('the day holds all day: only the seven days before it count', () => {
  const week: ChallengeData = {
    ...base,
    water: WEEK.map((d) => water(d, 2000)),
    activities: WEEK.map((d) => walk(d, 12)),
    meals: [WEEK[1], WEEK[3], WEEK[5]].map((d) => meal(d, '13:00', 50)),
    abhyas: { ...base.abhyas, items: [code], sessions: [session(WEEK[0], '21:00'), session(WEEK[2], '21:00')] },
  };

  it('logging water, a walk, a meal and starting a timer today changes neither the day’s challenge nor its choices', () => {
    const logged: ChallengeData = {
      ...week,
      water: [...week.water, water(TODAY, 3000)],
      activities: [...week.activities, walk(TODAY, 45)],
      meals: [...week.meals, meal(TODAY, '08:00', 80)],
      abhyas: { ...week.abhyas, running: { itemId: 'code', startedAt: at(TODAY, '06:00').toISOString() } },
    };
    const choices = challengeChoices(week, TODAY);
    // All four areas are on offer, so each one's reading of the week is checked.
    expect(choices.map((c) => c.kind)).toEqual(['water', 'walk', 'start', 'protein']);
    expect(choices).toMatchObject([{ target: 5, usual: 4 }, { target: 20, usual: 12 }, { target: 21 * 60, usual: 21 * 60 }, { target: 60, usual: 50 }]);
    expect(challengeChoices(logged, TODAY)).toEqual(choices);
    expect(dailyChallenge(logged, TODAY)).toEqual(dailyChallenge(week, TODAY));
  });

  it('the next day does read today', () => {
    const tomorrow = addDays(TODAY, 1);
    const walkedToday = { ...week, activities: [...week.activities, walk(TODAY, 45)] };
    expect(choice(walkedToday, 'walk', tomorrow)?.usual).toBeGreaterThan(choice(week, 'walk', tomorrow)?.usual ?? Infinity);
  });
});

describe('the turn of areas', () => {
  /** Twenty days of logs around a date, so every day in a fortnight beside it has a full week behind it. */
  const around = (date: string, withJob: boolean): ChallengeData => {
    const days = Array.from({ length: 20 }, (_, i) => addDays(date, i - 10));
    return {
      ...base,
      meals: days.map((d) => meal(d, '13:00', 50)),
      // The job was on the list a month before the first of these days, so it is on the list on every one of them.
      abhyas: { ...base.abhyas, items: withJob ? [{ ...code, createdAt: at(addDays(date, -40), '06:00').toISOString() }] : [], sessions: days.map((d) => session(d, '21:00')) },
    };
  };
  const kinds = (data: ChallengeData, from: string, n: number) => Array.from({ length: n }, (_, i) => dailyChallenge(data, addDays(from, i))?.kind);

  it('with four areas cycles through all four on consecutive days, then again in the same order', () => {
    const data = around(TODAY, true);
    expect(challengeChoices(data, TODAY).map((c) => c.kind)).toEqual(['water', 'walk', 'start', 'protein']);
    expect(kinds(data, TODAY, 8)).toEqual(['protein', 'water', 'walk', 'start', 'protein', 'water', 'walk', 'start']);
  });

  it('with three areas cycles through all three', () => {
    const data = around(TODAY, false);
    expect(challengeChoices(data, TODAY).map((c) => c.kind)).toEqual(['water', 'walk', 'protein']);
    expect(kinds(data, TODAY, 6)).toEqual(['protein', 'water', 'walk', 'protein', 'water', 'walk']);
  });

  it('before the day it counts from still picks one of the areas, each in turn', () => {
    for (const withJob of [false, true]) {
      const from = '2025-12-25';
      const data = around(from, withJob);
      const list = challengeChoices(data, from).map((c) => c.kind);
      // Four areas with a job on the list (water, walk, its start, protein), three without: a real four before the day the turn counts from.
      expect(list).toHaveLength(withJob ? 4 : 3);
      const picked = kinds(data, from, list.length * 2);
      expect(picked.every((k) => k !== undefined && list.includes(k))).toBe(true);
      expect(new Set(picked.slice(0, list.length)).size).toBe(list.length);
      expect(picked.slice(list.length)).toEqual(picked.slice(0, list.length));
    }
    // The day before the first turn: one back from the first.
    expect(dailyChallenge(base, '2026-01-04')?.kind).toBe('walk');
    expect(dailyChallenge(base, '2026-01-05')?.kind).toBe('water');
  });
});

describe('areas the user switched off', () => {
  const week: ChallengeData = {
    ...base,
    abhyas: { ...base.abhyas, items: [code], sessions: [session(WEEK[0], '21:00'), session(WEEK[2], '21:00')] },
  };
  const gap = [WEEK[1], WEEK[3], WEEK[5]].map((d) => meal(d, '13:00', 50));
  const kinds = (data: ChallengeData) => challengeChoices(data, TODAY).map((c) => c.kind);

  it('on unless said off: left out and true are the same', () => {
    expect(kinds(week)).toEqual(['water', 'walk', 'start']);
    expect(kinds({ ...week, waterWalk: true, routine: true })).toEqual(['water', 'walk', 'start']);
  });

  it('water and walk off: no water or walk challenge, the job and protein stay', () => {
    expect(kinds({ ...week, waterWalk: false })).toEqual(['start']);
    expect(kinds({ ...week, waterWalk: false, meals: gap })).toEqual(['start', 'protein']);
    expect(dailyChallenge({ ...week, waterWalk: false }, TODAY)).toMatchObject({ kind: 'start', itemId: 'code' });
  });

  it('the routine off: no job-start challenge, water and walk stay', () => {
    expect(kinds({ ...week, routine: false })).toEqual(['water', 'walk']);
  });

  it('both off with no protein gap: no challenge at all, and none done', () => {
    const off = { ...week, waterWalk: false, routine: false, water: WEEK.map((d) => water(d, 4000)), activities: WEEK.map((d) => walk(d, 40)) };
    expect(kinds(off)).toEqual([]);
    expect(dailyChallenge(off, TODAY)).toBeNull();
    expect(challengesDone({ ...off, water: [...off.water, water(TODAY, 4000)] }, TODAY)).toBe(0);
  });

  it('both off with a protein gap: protein is the day’s challenge', () => {
    const off = { ...week, waterWalk: false, routine: false, meals: gap };
    expect(kinds(off)).toEqual(['protein']);
    expect(dailyChallenge(off, TODAY)).toMatchObject({ kind: 'protein', target: 60, usual: 50 });
  });

  it('a meal logged from the plan is stamped with its slot’s time and offers no challenge of its own', () => {
    const planned = WEEK.map((d) => ({ ...meal(d, '09:00', 120), source: 'plan' as const }));
    expect(kinds({ ...base, meals: planned })).toEqual(['water', 'walk']);
    // The same week of meals typed by hand at the same times offers the same: when a meal was logged is no area at all.
    expect(kinds({ ...base, meals: WEEK.map((d) => meal(d, '09:00', 120)) })).toEqual(kinds({ ...base, meals: planned }));
    // And the week's choices do not move with the minute a plan-logged meal carries.
    expect(kinds({ ...base, meals: WEEK.map((d) => ({ ...meal(d, '23:30', 120), source: 'plan' as const })) })).toEqual(['water', 'walk']);
  });
});

describe('challengeChoices: a little past the usual, capped so it stays doable', () => {
  it('water: one bottle past the last week, never past the day’s goal', () => {
    expect(choice({ ...base, water: WEEK.map((d) => water(d, 2000)) }, 'water')).toMatchObject({ target: 5, usual: 4 });
    expect(choice({ ...base, water: WEEK.map((d) => water(d, 3500)) }, 'water')).toMatchObject({ target: 6, usual: 7 });
    expect(choice({ ...base, waterGoalMl: 0 }, 'water')).toBeUndefined();
  });

  it('walk: five minutes past the usual, to the next five, from ten to an hour', () => {
    expect(choice({ ...base, activities: WEEK.map((d) => walk(d, 12)) }, 'walk')).toMatchObject({ target: 20, usual: 12 });
    expect(choice({ ...base, activities: WEEK.map((d) => walk(d, 58)) }, 'walk')).toMatchObject({ target: 60, usual: 58 });
  });

  it("a timed job's start: a quarter of an hour before the usual start, never earlier than the week's earliest", () => {
    const sessions = [session(WEEK[0], '21:00'), session(WEEK[2], '21:00'), session(WEEK[4], '21:00'), session(WEEK[6], '20:30')];
    const data = { ...base, abhyas: { ...base.abhyas, items: [code], sessions } };
    expect(choice(data, 'start')).toEqual({ date: TODAY, kind: 'start', target: 20 * 60 + 35, usual: 20 * 60 + 53, itemId: 'code', name: 'Coding' });
    // Started on one day of the seven: nothing to go by yet.
    expect(choice({ ...data, abhyas: { ...data.abhyas, sessions: sessions.slice(0, 1) } }, 'start')).toBeUndefined();
  });

  it('protein: ten grams past the usual on days something was eaten, never past the target, and none once the usual meets it', () => {
    const three = [WEEK[1], WEEK[3], WEEK[5]].map((d) => meal(d, '13:00', 50));
    expect(choice({ ...base, meals: three }, 'protein')).toMatchObject({ target: 60, usual: 50 });
    expect(choice({ ...base, meals: three.slice(0, 2) }, 'protein')).toBeUndefined();
    expect(choice({ ...base, meals: [WEEK[1], WEEK[3], WEEK[5]].map((d) => meal(d, '13:00', 95)) }, 'protein')).toBeUndefined();
  });

  it('grows with the user: the same walk every day asks for more each day until the challenge is a little past it', () => {
    // Thirty minutes a day for two weeks, from 18 October; water off, so every day is a walk.
    const data = { ...base, waterGoalMl: 0, activities: Array.from({ length: 14 }, (_, i) => walk(addDays('2026-10-18', i), 30)) };
    expect(Array.from({ length: 8 }, (_, i) => dailyChallenge(data, addDays('2026-10-18', i))?.target)).toEqual([10, 10, 15, 20, 25, 30, 35, 35]);
    expect(challengesDone(data, addDays('2026-10-18', 13))).toBe(6);
  });
});

describe('challengeProgress', () => {
  it('counts whole bottles, minutes and grams of the day toward the target', () => {
    const ch: DailyChallenge = { date: TODAY, kind: 'water', target: 5, usual: 4 };
    expect(challengeProgress({ ...base, water: [water(TODAY, 2400)] }, ch)).toEqual({ n: 4, of: 5, done: false });
    expect(challengeProgress({ ...base, water: [water(TODAY, 2500)] }, ch)).toEqual({ n: 5, of: 5, done: true });
    expect(challengeProgress({ ...base, activities: [walk(TODAY, 20)] }, { date: TODAY, kind: 'walk', target: 20, usual: 12 })).toEqual({ n: 20, of: 20, done: true });
  });

  it('a start time is done once the job started by then, the timer still running included', () => {
    const ch: DailyChallenge = { date: TODAY, kind: 'start', target: 20 * 60 + 35, usual: 21 * 60, itemId: 'code', name: 'Coding' };
    const running = { ...base, abhyas: { ...base.abhyas, items: [code], running: { itemId: 'code', startedAt: at(TODAY, '20:30').toISOString() } } };
    expect(challengeProgress(running, ch)).toEqual({ n: 1, of: 1, done: true });
    expect(challengeProgress({ ...base, abhyas: { ...base.abhyas, items: [code], sessions: [session(TODAY, '20:40')] } }, ch)).toEqual({ n: 0, of: 1, done: false });
  });
});

describe('challengesDone', () => {
  it('is none with nothing logged', () => {
    expect(challengesDone(base, TODAY)).toBe(0);
  });

  it('ignores a timer still running: it counts once the timer has stopped', () => {
    // Water, walk and the start of Coding are on offer, and today's turn is the start, by 21:00.
    const sessions = [session(WEEK[0], '21:00'), session(WEEK[2], '21:00')];
    const idle = { ...base, abhyas: { ...base.abhyas, items: [code], sessions } };
    expect(dailyChallenge(idle, TODAY)).toMatchObject({ kind: 'start', target: 21 * 60 });
    const running = { ...idle, abhyas: { ...idle.abhyas, running: { itemId: 'code', startedAt: at(TODAY, '20:00').toISOString() } } };
    // The day's progress counts the running timer, the count of challenges done does not.
    expect(challengeProgress(running, dailyChallenge(running, TODAY) as DailyChallenge).done).toBe(true);
    expect(challengesDone(running, TODAY)).toBe(challengesDone(idle, TODAY));
    const stopped = { ...idle, abhyas: { ...idle.abhyas, sessions: [...sessions, session(TODAY, '20:00')] } };
    expect(challengesDone(stopped, TODAY)).toBe(challengesDone(idle, TODAY) + 1);
  });
});

describe('challengeText', () => {
  const t = makeT('en');

  it('says the step and how it compares with the usual', () => {
    expect(challengeText({ date: TODAY, kind: 'walk', target: 15, usual: 10 }, t)).toBe('Walk 15 min, 5 more than your usual');
    expect(challengeText({ date: TODAY, kind: 'water', target: 6, usual: 7 }, t)).toBe('Drink 6 bottles of water');
    expect(challengeText({ date: TODAY, kind: 'protein', target: 60, usual: 50 }, t)).toBe('Eat 60 g of protein, 10 g more than your usual');
    expect(challengeText({ date: TODAY, kind: 'start', target: 20 * 60 + 35, usual: 20 * 60 + 53, itemId: 'code', name: 'Coding' }, t)).toBe('Start Coding by 20:35, a little earlier than usual');
  });

  it('says the step plainly on a first day, with no "more than your usual" when there is no usual yet', () => {
    expect(challengeText({ date: TODAY, kind: 'walk', target: 10, usual: 0 }, t)).toBe('Walk 10 min');
    expect(challengeText({ date: TODAY, kind: 'water', target: 2, usual: 0 }, t)).toBe('Drink 2 bottles of water');
    expect(challengeText({ date: TODAY, kind: 'water', target: 1, usual: 0 }, t)).toBe('Drink 1 bottle of water');
  });

  it('says one bottle in the singular, in every language, and several in the plural', () => {
    const one = { date: TODAY, kind: 'water' as const, target: 1, usual: 1 };
    const oneMore = { ...one, usual: 0 };
    const two = { ...one, target: 2, usual: 2 };
    const twoMore = { ...two, usual: 1 };
    expect([one, oneMore, two, twoMore].map((c) => challengeText(c, t))).toEqual([
      'Drink 1 bottle of water',
      'Drink 1 bottle of water',
      'Drink 2 bottles of water',
      'Drink 2 bottles of water, 1 more than your usual',
    ]);
    expect([one, oneMore, two, twoMore].map((c) => challengeText(c, makeT('mr')))).toEqual([
      '1 बाटली पाणी प्या',
      '1 बाटली पाणी प्या',
      '2 बाटल्या पाणी प्या',
      '2 बाटल्या पाणी प्या, नेहमीपेक्षा 1 जास्त',
    ]);
    expect([one, oneMore, two, twoMore].map((c) => challengeText(c, makeT('hi')))).toEqual([
      '1 बोतल पानी पिएँ',
      '1 बोतल पानी पिएँ',
      '2 बोतल पानी पिएँ',
      '2 बोतल पानी पिएँ, आम दिनों से 1 ज़्यादा',
    ]);
  });

  it('writes a time as the app does', () => {
    expect(clockOf(7 * 60 + 5)).toBe('07:05');
    expect(clockOf(0)).toBe('00:00');
  });

  it('has its words in Marathi and Hindi', () => {
    expect(challengeText({ date: TODAY, kind: 'walk', target: 15, usual: 10 }, makeT('mr'))).toBe('15 मिनिटे चाला, नेहमीपेक्षा 5 जास्त');
    expect(challengeText({ date: TODAY, kind: 'walk', target: 15, usual: 10 }, makeT('hi'))).toBe('15 मिनट टहलें, आम दिनों से 5 ज़्यादा');
  });
});
