import { describe, expect, it } from 'vitest';
import { chapterDays, chapterSince, chapterStreaks, newChapter } from '../chapter';
import { gameView, nextWin } from '../game';
import type { DayMenu } from '../menu';
import { dailyTargets, KCAL_FLOOR } from '../nutrition';
import { planFrom, shownPlan } from '../plan';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import { addDays } from '../date';
import { shownWeight } from '../tileText';
import type { Meal, Profile } from '../types';

describe('newChapter', () => {
  const weights = [
    { date: '2026-09-01', kg: 92 },
    { date: '2026-10-25', kg: 84.6 },
    { date: '2026-11-02', kg: 84 },
  ];

  it('starts today from the latest weigh-in up to today, keeping the very first start', () => {
    expect(newChapter({ weightKg: 85, startWeightKg: 92 }, weights, '2026-10-28')).toEqual({ startWeightKg: 84.6, chapterStart: '2026-10-28', firstStartWeightKg: 92 });
  });

  it('a later chapter keeps the first start; with no weigh-in the profile weight is the start', () => {
    expect(newChapter({ weightKg: 85, startWeightKg: 84.6, firstStartWeightKg: 92 }, [], '2026-12-01')).toEqual({ startWeightKg: 85, chapterStart: '2026-12-01', firstStartWeightKg: 92 });
    expect(newChapter({ weightKg: 85 }, weights, '2026-10-28').firstStartWeightKg).toBe(92);
  });

  it('starts from the weight Progress shows, smoothed over a week, so Lost reads 0 on the chapter\'s first day', () => {
    const week = [
      { date: '2026-10-22', kg: 86 },
      { date: '2026-10-27', kg: 84.6 },
    ];
    const shown = shownWeight(week, '2026-10-28')!.kg;
    expect(shown).not.toBe(84.6);
    const next = newChapter({ weightKg: 84.6, startWeightKg: 92 }, week, '2026-10-28');
    expect(next.startWeightKg).toBe(shown);
    const profile: Profile = { name: 'V', sex: 'male', birthYear: 1990, heightCm: 172, weightKg: 84.6, activity: 'sedentary', goalWeightKg: 75, rateKgPerWeek: 0.5, lang: 'en', onboarded: true, startWeightKg: 92 };
    const targets = dailyTargets(profile, new Date('2026-10-28T12:00:00'));
    expect(shownPlan({ ...profile, ...next }, week, targets, '2026-10-28').lostKg).toBe(0);
  });
});

describe('chapterDays', () => {
  it('lets the streak look back no further than the first day of the chapter', () => {
    expect(chapterDays(undefined, '2026-10-28', 60)).toBe(60);
    expect(chapterDays('2026-10-28', '2026-10-28', 60)).toBe(1);
    expect(chapterDays('2026-10-20', '2026-10-28', 60)).toBe(9);
    expect(chapterDays('2026-01-01', '2026-10-28', 60)).toBe(60);
    expect(chapterDays('2026-11-01', '2026-10-28', 60)).toBe(60);
  });

  it('a start that is not a date (a damaged file) limits nothing', () => {
    expect(chapterDays('soon', '2026-10-28', 90)).toBe(90);
    expect(chapterDays('2026-02-30', '2026-10-28', 90)).toBe(90);
  });

  it('a chapter is there from its first day on, never before it, and never from a start that is not a date', () => {
    expect(chapterSince('2026-10-20', '2026-10-28')).toBe('2026-10-20');
    expect(chapterSince('2026-10-28', '2026-10-28')).toBe('2026-10-28');
    // A start still to come (a clock ahead on another device) is no chapter yet.
    expect(chapterSince('2026-10-29', '2026-10-28')).toBeUndefined();
    expect(chapterSince('2026-02-30', '2026-10-28')).toBeUndefined();
    expect(chapterSince(undefined, '2026-10-28')).toBeUndefined();
  });
});

describe('shownPlan', () => {
  const TODAY = '2026-10-28';
  const profile: Profile = { name: 'V', sex: 'male', birthYear: 1990, heightCm: 172, weightKg: 84.6, activity: 'sedentary', goalWeightKg: 84.8, rateKgPerWeek: 0.5, lang: 'en', onboarded: true, startWeightKg: 92 };
  const targets = dailyTargets(profile, new Date(`${TODAY}T12:00:00`));
  const weights = [
    { date: '2026-10-22', kg: 86 },
    { date: '2026-10-27', kg: 84.6 },
  ];

  it('reads Lost and To go at the weight Progress shows (smoothed over a week), not the latest weigh-in alone', () => {
    const shown = shownWeight(weights, TODAY)!.kg;
    const raw = planFrom(profile, weights, targets, TODAY);
    const plan = shownPlan(profile, weights, targets, TODAY);
    expect(raw.currentKg).toBe(84.6);
    expect(plan.currentKg).toBe(shown);
    expect(plan.lostKg).toBe(Math.round((92 - shown) * 10) / 10);
    // Above the goal by the shown weight, though the latest weigh-in alone is under it: the goal is not reached yet.
    expect(raw.toGoKg).toBe(0);
    expect(plan.toGoKg).toBe(Math.round((shown - 84.8) * 10) / 10);
    expect(plan.toGoKg).toBeGreaterThan(0);
  });

  it('counts from the chapter\'s start weight', () => {
    expect(shownPlan({ ...profile, startWeightKg: 85, chapterStart: '2026-10-20', firstStartWeightKg: 92 }, weights, targets, TODAY).startKg).toBe(85);
  });

  it('a chapter start after today (a clock ahead on another device) is no chapter yet: Lost counts from the very first start', () => {
    const ahead = { ...profile, startWeightKg: 85, chapterStart: '2026-10-29', firstStartWeightKg: 92 };
    expect(shownPlan(ahead, weights, targets, TODAY)).toEqual(shownPlan(profile, weights, targets, TODAY));
    expect(planFrom(ahead, weights, targets, TODAY).startKg).toBe(92);
    // From its first day on, it is the chapter's start.
    expect(shownPlan(ahead, weights, targets, '2026-10-29').startKg).toBe(85);
  });

  it('with no weigh-in it is the plan as it was', () => {
    expect(shownPlan(profile, [], targets, TODAY)).toEqual(planFrom(profile, [], targets, TODAY));
  });
});

describe('gameView', () => {
  const TODAY = '2026-10-28'; // a Wednesday; with Sunday as the weigh day its week starts on 25 October
  const profile: Profile = { name: 'V', sex: 'male', birthYear: 1990, heightCm: 172, weightKg: 84.5, activity: 'sedentary', goalWeightKg: 75, rateKgPerWeek: 0.5, lang: 'en', onboarded: true, startWeightKg: 92 };
  const targets = dailyTargets(profile, new Date(`${TODAY}T12:00:00`));
  const days = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
  const weights = [
    { date: '2026-09-01', kg: 92 },
    { date: '2026-10-10', kg: 86 },
    { date: '2026-10-25', kg: 85 },
    { date: '2026-10-27', kg: 84.5 },
  ];
  // Every day of this week so far meets every weekly challenge, whichever one this week has.
  const state = {
    profile,
    weights,
    meals: days.map((date) => ({ id: date, at: `${date}T13:00:00`, date, type: 'lunch' as const, items: [], kcal: 1500, protein: 60 })),
    water: days.map((date) => ({ id: `w${date}`, at: '', date, ml: 3000 })),
    sleep: days.map((date) => ({ date, bed: '23:00', wake: '06:30', quality: 4, wakeups: 0, energy: 4, minutes: 450, score: 80 })),
    steps: days.map((date) => ({ date, count: 8000 })),
    workouts: [],
    celebrated: [],
    settings: { waterGoalMl: 3000, weighDay: 0, offDays: [] },
  };
  const view = (p: Profile, abhyasDone = 0) => gameView({ state: { ...state, profile: p }, targets, today: TODAY, streakDays: 3, bestStreakDays: 3, lifetime: { streakDays: 3, bestStreakDays: 3 }, abhyasDone });
  const chapter = { ...profile, ...newChapter(profile, weights.filter((w) => w.date <= '2026-10-25'), '2026-10-26') };

  it('counts the Abhyas items done over the whole journey, as it counts meals, so a new chapter takes none of their points away', () => {
    expect(view(profile, 2).points - view(profile).points).toBe(2 * 15);
    expect(view(chapter, 2).points).toBe(view(profile, 2).points);
  });

  it('counts Lost, To go and the climb from the chapter\'s start, at the weight Progress shows', () => {
    const shown = shownWeight(weights, TODAY)!.kg;
    const g = view(chapter);
    expect(chapter.chapterStart).toBe('2026-10-26');
    expect(g.plan.startKg).toBe(chapter.startWeightKg);
    expect(g.plan.currentKg).toBe(shown);
    expect(g.plan.lostKg).toBe(Math.round((chapter.startWeightKg - shown) * 10) / 10);
    // The trail starts on the chapter's first day: one weigh-in since.
    expect(g.trail).toHaveLength(1);
    expect(view(profile).trail).toHaveLength(4);
  });

  it('starts the weekly challenge again from the chapter\'s first day', () => {
    expect(view(profile).challenge.n).toBe(4);
    expect(view(chapter).challenge.n).toBe(3);
  });

  it('keeps the kilo badges counting from the very first start, so a new chapter takes none away', () => {
    const kg = (g: ReturnType<typeof view>) => Object.fromEntries(g.badges.map((b) => [b.key, b.earned]));
    expect(kg(view(profile)).kg_5).toBe(true);
    expect(kg(view(chapter)).kg_5).toBe(true);
  });

  it('ignores a chapter start after today (a clock ahead on another device): the challenge and the trail are as without one', () => {
    const ahead = { ...profile, chapterStart: '2026-11-05' };
    expect(view(ahead).challenge.n).toBe(view(profile).challenge.n);
    expect(view(ahead).trail).toEqual(view(profile).trail);
  });

  it('with a chapter start after today, Lost, To go and the camps count from the very first start too, so every part agrees', () => {
    // A chapter started on another device whose clock is ahead: its start weight is in the profile, its first day still to come.
    const ahead = { ...chapter, chapterStart: '2026-11-05' };
    expect(ahead.startWeightKg).not.toBe(92);
    const g = view(ahead);
    const none = view(profile);
    expect(g.plan.startKg).toBe(92);
    expect({ plan: g.plan, progress: g.progress, camps: g.camps, trail: g.trail, points: g.points }).toEqual({ plan: none.plan, progress: none.progress, camps: none.camps, trail: none.trail, points: none.points });
  });
});

describe('the streak at a new chapter', () => {
  const TODAY = '2026-10-28';
  const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
  const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '20:00', 35)] };
  const line = { foodId: 'chapati', unit: 'piece', qty: 2 };
  const menu = (date: string): DayMenu => ({
    date,
    editedAt: '',
    meals: [
      { id: 'morning', type: 'breakfast', time: '08:30', lines: [line] },
      { id: 'lunch', type: 'lunch', time: '13:00', lines: [line] },
      { id: 'dinner', type: 'dinner', time: '20:00', lines: [line] },
    ],
  });
  const meal = (date: string, slotId: string): Meal => ({ id: `${date}-${slotId}`, at: new Date(`${date}T12:00:00`).toISOString(), date, type: 'lunch', slotId, items: [], kcal: 600, protein: 10 });
  // Sixty full days in a row, up to yesterday.
  const meals = Array.from({ length: 60 }, (_, i) => addDays(TODAY, -60 + i)).flatMap((d) => ['morning', 'lunch', 'dinner'].map((id) => meal(d, id)));
  const record = { today: TODAY, routine, meals, skips: [], offDays: [] as number[], floor: KCAL_FLOOR.male, menuOn: menu };
  const profile: Profile = { name: 'V', sex: 'male', birthYear: 1990, heightCm: 172, weightKg: 84.5, activity: 'sedentary', goalWeightKg: 75, rateKgPerWeek: 0.5, lang: 'en', onboarded: true, startWeightKg: 92 };
  const targets = dailyTargets(profile, new Date(`${TODAY}T12:00:00`));
  const state = { profile, weights: [{ date: '2026-10-27', kg: 84.5 }], meals, water: [], sleep: [], steps: [], workouts: [], celebrated: [], settings: { waterGoalMl: 3000, weighDay: 0, offDays: [] } };
  const game = (p: Profile) => {
    const s = chapterStreaks({ ...record, chapterStart: p.chapterStart });
    return { s, g: gameView({ state: { ...state, profile: p }, targets, today: TODAY, streakDays: s.days, bestStreakDays: s.best, lifetime: { streakDays: s.lifetimeDays, bestStreakDays: s.lifetimeBest }, abhyasDone: 0 }) };
  };
  const chapter = { ...profile, ...newChapter(profile, state.weights, TODAY) };

  it('starts the streak shown and the best run again from the chapter\'s first day', () => {
    expect(game(profile).s).toEqual({ days: 60, best: 60, lifetimeDays: 60, lifetimeBest: 60 });
    expect(game(chapter).s).toEqual({ days: 0, best: 0, lifetimeDays: 60, lifetimeBest: 60 });
  });

  it('keeps the points of a sixty-day streak from before the chapter, and its streak badges', () => {
    const before = game(profile).g;
    const after = game(chapter).g;
    expect(after.points).toBe(before.points);
    const earned = (g: typeof after) => g.badges.filter((b) => b.earned).map((b) => b.key);
    expect(earned(after)).toEqual(earned(before));
    expect(earned(after)).toEqual(expect.arrayContaining(['streak_7', 'streak_30']));
  });

  it('a seven-day badge never celebrated before the chapter is still celebrated after it', () => {
    const { g } = game(chapter);
    const ids = nextWin({ earned: g.badges.filter((b) => b.earned).map((b) => b.key), level: g.level.key, challenge: g.challenge, celebrated: null }).seed!;
    const celebrated = ids.filter((id) => id !== 'badge:streak_7');
    expect(nextWin({ earned: g.badges.filter((b) => b.earned).map((b) => b.key), level: g.level.key, challenge: g.challenge, celebrated }).next?.id).toBe('badge:streak_7');
  });

  it('a chapter start after today limits nothing', () => {
    expect(game({ ...profile, chapterStart: '2026-11-05' }).s).toEqual({ days: 60, best: 60, lifetimeDays: 60, lifetimeBest: 60 });
  });
});
