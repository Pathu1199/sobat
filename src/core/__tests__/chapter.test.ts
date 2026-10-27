import { describe, expect, it } from 'vitest';
import { chapterDays, gameView, newChapter, shownPlan } from '../chapter';
import { dailyTargets } from '../nutrition';
import { planFrom } from '../plan';
import { shownWeight } from '../tileText';
import type { Profile } from '../types';

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
  const view = (p: Profile) => gameView({ state: { ...state, profile: p }, targets, today: TODAY, streakDays: 3, bestStreakDays: 3 });
  const chapter = { ...profile, ...newChapter(profile, weights.filter((w) => w.date <= '2026-10-25'), '2026-10-26') };

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

  it('keeps points and the kilo badges counting from the very first start, so a new chapter takes none away', () => {
    const before = view(profile);
    const after = view(chapter);
    expect(after.points).toBe(before.points);
    const kg = (g: typeof before) => Object.fromEntries(g.badges.map((b) => [b.key, b.earned]));
    expect(kg(before).kg_5).toBe(true);
    expect(kg(after).kg_5).toBe(true);
    expect(after.badges.filter((b) => b.earned).length).toBe(before.badges.filter((b) => b.earned).length);
  });
});
