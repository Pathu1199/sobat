import { describe, expect, it } from 'vitest';
import { WALK_ACTIVITY_ID } from '../activity';
import { challengeChoices, challengeProgress, challengesDone, challengeText, clockOf, dailyChallenge, type ChallengeData, type DailyChallenge } from '../challenge';
import { addDays } from '../date';
import { makeT } from '../../i18n';
import type { AbhyasItem, AbhyasSession, ActivityLog, Meal, MealSource, WaterLog } from '../types';

// Saturday 31 October 2026; the clock is Asia/Kolkata (vitest.config.mts).
const TODAY = '2026-10-31';
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
/** The seven days before today, 24 to 30 October. */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i - 7));
const meal = (date: string, hhmm: string, protein: number, source?: MealSource): Meal => ({ id: `${date}${hhmm}`, at: at(date, hhmm).toISOString(), date, type: 'lunch', items: [], kcal: 500, protein, ...(source ? { source } : {}) });
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

  it('is the same all day and on every device, and none on an off day', () => {
    expect(dailyChallenge(base, TODAY)).toEqual(dailyChallenge({ ...base }, TODAY));
    expect(dailyChallenge({ ...base, offDays: [6] }, TODAY)).toBeNull();
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

  it('the first meal logged: a quarter of an hour before the usual, never earlier than the week’s earliest; a meal the app filled in is not one logged', () => {
    const meals = [meal(WEEK[0], '09:30', 10), meal(WEEK[1], '09:40', 10), meal(WEEK[2], '10:00', 10), meal(WEEK[3], '07:00', 10, 'auto')];
    expect(choice({ ...base, meals }, 'logBy')).toMatchObject({ target: 9 * 60 + 30, usual: 9 * 60 + 43 });
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

  it('a start time is done once the job started by then, the timer still running included; a first meal by its time', () => {
    const ch: DailyChallenge = { date: TODAY, kind: 'start', target: 20 * 60 + 35, usual: 21 * 60, itemId: 'code', name: 'Coding' };
    const running = { ...base, abhyas: { ...base.abhyas, items: [code], running: { itemId: 'code', startedAt: at(TODAY, '20:30').toISOString() } } };
    expect(challengeProgress(running, ch)).toEqual({ n: 1, of: 1, done: true });
    expect(challengeProgress({ ...base, abhyas: { ...base.abhyas, items: [code], sessions: [session(TODAY, '20:40')] } }, ch)).toEqual({ n: 0, of: 1, done: false });
    const log: DailyChallenge = { date: TODAY, kind: 'logBy', target: 9 * 60 + 30, usual: 9 * 60 + 43 };
    expect(challengeProgress({ ...base, meals: [meal(TODAY, '09:20', 10)] }, log).done).toBe(true);
    expect(challengeProgress({ ...base, meals: [meal(TODAY, '09:20', 10, 'auto')] }, log).done).toBe(false);
  });
});

describe('challengesDone', () => {
  it('is none with nothing logged', () => {
    expect(challengesDone(base, TODAY)).toBe(0);
  });
});

describe('challengeText', () => {
  const t = makeT('en');

  it('says the step and how it compares with the usual', () => {
    expect(challengeText({ date: TODAY, kind: 'walk', target: 15, usual: 10 }, t)).toBe('Walk 15 min, 5 more than your usual');
    expect(challengeText({ date: TODAY, kind: 'water', target: 6, usual: 7 }, t)).toBe('Drink 6 bottles of water');
    expect(challengeText({ date: TODAY, kind: 'protein', target: 60, usual: 50 }, t)).toBe('Eat 60 g of protein, 10 g more than your usual');
    expect(challengeText({ date: TODAY, kind: 'start', target: 20 * 60 + 35, usual: 20 * 60 + 53, itemId: 'code', name: 'Coding' }, t)).toBe('Start Coding by 20:35, a little earlier than usual');
    expect(challengeText({ date: TODAY, kind: 'logBy', target: 9 * 60 + 30, usual: 9 * 60 + 30 }, t)).toBe('Log your first meal by 09:30');
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
