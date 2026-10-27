import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE } from '../routine';
import { makeMemory } from '../memory';
import { dayReviewLines, dayReviewWritten, journey, journeyFacts, wasHeavy, wins, type DayFacts } from '../review';
import { makeT } from '../../i18n';
import type { Plan } from '../plan';
import type { Meal } from '../types';

const TODAY = '2026-10-06';
const meal = (date: string, kcal: number, protein = 20, hour = 13, type: Meal['type'] = 'lunch', foodId?: string): Meal => ({
  id: `${date}-${hour}`,
  at: `${date}T${String(hour).padStart(2, '0')}:00:00`,
  date,
  type,
  items: [{ foodId, name_en: foodId ?? 'x', name_mr: '', grams: 100, kcal, protein, carbs: 10, fat: 2, estimated: false }],
  kcal,
  protein,
});
const plan = { startKg: 98, currentKg: 95, goalKg: 80, lostKg: 3, toGoKg: 15, targetRate: 0.5, actualRate: 0.2 } as unknown as Plan;

describe('journey', () => {
  it('counts logged, over and heavy days and the slips that explain a stall', () => {
    const meals = [meal('2026-10-05', 2600), meal('2026-10-04', 1900), meal('2026-10-03', 1500), meal('2026-10-02', 1600, 20, 22, 'dinner'), meal('2026-10-01', 300, 5, 17, 'snack', 'cashews')];
    const j = journey({ today: TODAY, meals, water: [], sleep: [], workouts: [], weights: [{ date: '2026-10-04', kg: 95 }], kcalTarget: 1800, proteinTarget: 110, waterGoalMl: 3000, avoid: DEFAULT_ROUTINE.avoid, plan });
    expect(j.loggedDays).toBe(5);
    expect(j.overDays).toBe(2);
    expect(j.heavyDays).toBe(1);
    expect(j.lateDinners).toBe(1);
    expect(j.avoidSlips).toBe(1);
    expect(j.weighIns).toBe(1);
    expect(j.avgSleepMin).toBeNull();
    const facts = journeyFacts(j, { kcalTarget: 1800, proteinTarget: 110, waterGoalMl: 3000, plan }).join('\n');
    expect(facts).toContain('over target on 2 days');
    expect(facts).toContain('Logging is patchy');
    expect(facts).toContain('real pace 0.2 kg/week');
  });
});

describe('wasHeavy', () => {
  it('is a day more than a fifth over target', () => {
    expect(wasHeavy([meal('2026-10-05', 2200)], '2026-10-05', 1800)).toBe(true);
    expect(wasHeavy([meal('2026-10-05', 2100)], '2026-10-05', 1800)).toBe(false);
    expect(wasHeavy([], '2026-10-05', 1800)).toBe(false);
  });
});

describe('wins', () => {
  it('rewards behaviour, not the scale', () => {
    const water = ['2026-10-05', '2026-10-04'].flatMap((date) => [1, 2, 3].map((i) => ({ id: `${date}${i}`, at: '', date, ml: 1000 })));
    const w = wins({ today: TODAY, meals: [], water, weights: [{ date: '2026-10-05', kg: 95 }], workouts: [], waterGoalMl: 3000, streakDays: 5 });
    expect(w.map((x) => x.key)).toEqual(['streak', 'water_days', 'weighed']);
    expect(wins({ today: TODAY, meals: [], water: [], weights: [], workouts: [], waterGoalMl: 3000, streakDays: 1 })).toEqual([]);
  });
});

describe('dayReviewLines', () => {
  const day: DayFacts = {
    kcal: 1714,
    kcalTarget: 1900,
    protein: 72,
    proteinTarget: 90,
    waterMl: 2500,
    waterGoalMl: 3000,
    movedMin: 30,
    sleep: { minutes: 450, score: 80 },
    mood: { score: 4, note: 'calm' },
    screenMin: 300,
    sittingMin: 75,
    streakDays: 5,
  };

  it('says the day in plain sentences, the way the model is told it', () => {
    expect(dayReviewLines(day, makeT('en'))).toEqual([
      'Ate 1,714 of 1,900 kcal, protein 72 of 90 g.',
      'Water 2,500 of 3,000 ml.',
      'Moved for 30 minutes.',
      'Slept 7h 30m, sleep score 80.',
      'Mood 4 out of 5, wrote: calm.',
      'Screen time 5h 00m, longest sitting 1h 15m.',
      '5 full days in a row.',
    ]);
  });

  it('leaves out what did not happen, and says when nobody moved', () => {
    const quiet = dayReviewLines({ ...day, movedMin: null, sleep: null, mood: { score: 3 }, screenMin: 0, streakDays: 1 }, makeT('en'));
    expect(quiet).toEqual(['Ate 1,714 of 1,900 kcal, protein 72 of 90 g.', 'Water 2,500 of 3,000 ml.', 'No workout today.', 'Mood 3 out of 5.']);
  });

  it('is said in Marathi and Hindi too, for a day with no model to write it, in plain words with every number filled in', () => {
    const other = { ...day, movedMin: null, mood: { score: 3 } };
    const en = [...dayReviewLines(day, makeT('en')), ...dayReviewLines(other, makeT('en'))];
    for (const lang of ['mr', 'hi'] as const) {
      const lines = [...dayReviewLines(day, makeT(lang)), ...dayReviewLines(other, makeT(lang))];
      expect(lines).toHaveLength(en.length);
      lines.forEach((l, i) => {
        expect(l, `${lang} ${l}`).not.toBe(en[i]);
        expect(l, `${lang} ${l}`).not.toMatch(/[\u0966-\u096F\u2014{}]/);
      });
    }
  });
});

describe('dayReviewWritten', () => {
  it('is the evening review\'s own day note, so a gratitude line written on Mind does not hide the button', () => {
    const grateful = makeMemory({ text: 'grateful for: tea', type: 'episode', date: '2026-10-28', source: 'user' });
    const review = makeMemory({ text: 'stayed within the target, no workout', type: 'episode', date: '2026-10-28', source: 'auto' });
    const yesterday = makeMemory({ text: 'ate over the target', type: 'episode', date: '2026-10-27', source: 'auto' });
    expect(dayReviewWritten([grateful], '2026-10-28')).toBe(false);
    expect(dayReviewWritten([yesterday], '2026-10-28')).toBe(false);
    expect(dayReviewWritten([grateful, review], '2026-10-28')).toBe(true);
  });
});
