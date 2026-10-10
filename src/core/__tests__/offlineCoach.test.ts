import { describe, expect, it } from 'vitest';
import { answerOffline, parseQuestion, type OfflineCtx } from '../offlineCoach';

describe('parseQuestion', () => {
  it('reads the question in English, Marathi and Hindi', () => {
    expect(parseQuestion('What should I eat now?').intent).toBe('eat_now');
    expect(parseQuestion('mi ata kay khau').intent).toBe('eat_now');
    expect(parseQuestion('आता काय खाऊ?').intent).toBe('eat_now');
    expect(parseQuestion('maza wajan ka kami hot nahi').intent).toBe('why_not_dropping');
    expect(parseQuestion('मेरा वज़न क्यों नहीं घट रहा?').intent).toBe('why_not_dropping');
    expect(parseQuestion('Why is my weight not dropping?').intent).toBe('why_not_dropping');
    expect(parseQuestion('aaj khup khalla').intent).toBe('overate');
    expect(parseQuestion('I overate today').intent).toBe('overate');
    expect(parseQuestion('300 kcal madhe kay khau')).toEqual({ intent: 'fits_kcal', kcal: 300 });
    expect(parseQuestion('kiti calories baki ahet').intent).toBe('left');
    expect(parseQuestion('रात्री काय खाऊ')).toEqual({ intent: 'meal', meal: 'dinner' });
    expect(parseQuestion('pani kiti pyaycha').intent).toBe('water');
    expect(parseQuestion('झोप लागत नाही').intent).toBe('sleep');
    expect(parseQuestion('vyayamacha kantala').intent).toBe('walk');
    expect(parseQuestion('full day plan dya').intent).toBe('plan_day');
  });
});

const t = (k: string) => `[${k}]`;
const ctx: OfflineCtx = {
  budget: { target: 1700, consumed: 420, remaining: 1280, earned: 0, perMeal: 500, mealsLeft: 2, proteinTarget: 110, proteinConsumed: 12, proteinLeft: 98, pct: 0.25 },
  hour: 13,
  plan: { startKg: 98, currentKg: 95.8, goalKg: 85, lostKg: 2.2, toGoKg: 10.8, targetRate: 0.5, actualRate: 0.45, weeksAtTarget: 22, etaAtTarget: '2027-03-08', weeksAtActual: 24, etaAtActual: '2027-03-22', dailyKcal: 1700, proteinG: 110, stage: 'early', daysLogging: 30 },
  journey: { days: 14, loggedDays: 12, avgKcal: 1650, overDays: 3, heavyDays: 1, avgProtein: 70, avgWaterMl: 2100, avgSleepMin: 410, workoutDays: 2, weighIns: 2, avoidSlips: 1, lateDinners: 2 },
  dayPlan: { remaining: 1280, stop: false, now: 'lunch', slots: [{ type: 'lunch', budget: 640, kcal: 600, protein: 30, picks: [{ food: { id: 'palak' } as never, grams: 150, kcal: 120, protein: 5 }] }] },
  advice: [],
  waterMl: 1000,
  waterGoalMl: 3000,
  streakDays: 4,
  lastSleepMinutes: 410,
  stepsToday: 2500,
  kcalTarget: 1700,
  proteinTarget: 110,
  optionsFor: (max) => (max >= 100 ? [{ foodId: 'palak', name_en: 'Palak', name_mr: 'पालक', grams: 150, kcal: 120, protein: 5 }] : []),
  foodName: () => 'Palak bhaji',
  mealName: (m) => m,
};

describe('answerOffline', () => {
  it('answers "what to eat" with the numbers and the plate, and offers options', () => {
    const a = answerOffline('what should I eat now', ctx, t);
    expect(a.text).toContain('[oc_left]');
    expect(a.text).toContain('[oc_plate]');
    expect(a.options).toHaveLength(1);
  });
  it('answers "why not dropping" with the verdict and the evidence', () => {
    const a = answerOffline('why is my weight not dropping', ctx, t);
    expect(a.text).toContain('[verdict_working]');
    expect(a.text).toContain('[oc_evidence]');
  });
  it('says stop when nothing is left', () => {
    const a = answerOffline('kay khau', { ...ctx, budget: { ...ctx.budget, remaining: 20 } }, t);
    expect(a.text).toContain('[oc_stop]');
    expect(a.options).toHaveLength(0);
  });
});
