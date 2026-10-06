import { describe, expect, it } from 'vitest';
import { dailyTargets } from '../nutrition';
import { actualRateKgPerWeek, motivationKey, planFrom } from '../plan';
import type { Profile, WeightLog } from '../types';

const TODAY = '2026-10-06';
const profile: Profile = { name: 'V', sex: 'male', birthYear: 1998, heightCm: 172, weightKg: 95, activity: 'sedentary', goalWeightKg: 80, rateKgPerWeek: 0.5, lang: 'en', onboarded: true };
const targets = dailyTargets(profile, new Date(TODAY + 'T12:00:00'));
const w = (date: string, kg: number): WeightLog => ({ date, kg });

describe('actualRateKgPerWeek', () => {
  it('needs two logs at least a week apart inside the window', () => {
    expect(actualRateKgPerWeek([], TODAY)).toBeNull();
    expect(actualRateKgPerWeek([w('2026-10-01', 96), w('2026-10-05', 95)], TODAY)).toBeNull();
    expect(actualRateKgPerWeek([w('2026-08-01', 99), w('2026-08-20', 97)], TODAY)).toBeNull();
  });

  it('measures lost kilos per week, positive when losing', () => {
    expect(actualRateKgPerWeek([w('2026-09-08', 97), w('2026-09-22', 96), w('2026-10-06', 95)], TODAY)).toBe(0.5);
    expect(actualRateKgPerWeek([w('2026-09-22', 94), w('2026-10-06', 95)], TODAY)).toBe(-0.5);
  });
});

describe('planFrom', () => {
  it('starts from the first logged weight and reports what is left', () => {
    const p = planFrom(profile, [w('2026-08-01', 98), w('2026-10-06', 95)], targets, TODAY);
    expect(p.startKg).toBe(98);
    expect(p.currentKg).toBe(95);
    expect(p.lostKg).toBe(3);
    expect(p.toGoKg).toBe(15);
    expect(p.weeksAtTarget).toBe(Math.ceil(15 / targets.rateKgPerWeek));
    expect(p.etaAtTarget).toMatch(/^2027-/);
    expect(p.dailyKcal).toBe(targets.kcal);
  });

  it('falls back to the profile weight with no log', () => {
    const p = planFrom(profile, [], targets, TODAY);
    expect(p.lostKg).toBe(0);
    expect(p.toGoKg).toBe(15);
    expect(p.stage).toBe('start');
    expect(p.actualRate).toBeNull();
    expect(p.etaAtActual).toBeNull();
  });

  it('names the stage honestly', () => {
    expect(planFrom(profile, [w('2026-10-01', 95)], targets, TODAY).stage).toBe('start');
    expect(planFrom(profile, [w('2026-09-01', 96), w('2026-10-06', 95)], targets, TODAY).stage).toBe('early');
    expect(planFrom(profile, [w('2026-06-01', 96), w('2026-10-06', 87)], targets, TODAY).stage).toBe('halfway');
    expect(planFrom(profile, [w('2026-06-01', 96), w('2026-10-06', 81.5)], targets, TODAY).stage).toBe('close');
    expect(planFrom(profile, [w('2026-06-01', 96), w('2026-10-06', 80)], targets, TODAY).stage).toBe('done');
    expect(planFrom(profile, [w('2026-09-01', 93), w('2026-09-22', 94), w('2026-10-06', 95)], targets, TODAY).stage).toBe('slipping');
  });

  it('picks a line for the stage that rotates by day', () => {
    const p = planFrom(profile, [], targets, TODAY);
    expect(motivationKey(p, TODAY)).toMatch(/^mot_start_[012]$/);
    expect(motivationKey(p, '2026-10-07')).not.toBe(motivationKey(p, TODAY));
  });
});
