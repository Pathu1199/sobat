import { describe, expect, it } from 'vitest';
import { migrateState } from '../../store/migrate';
import { EMPTY_STATE } from '../../store/defaults';

// A realistic v1 blob: the shape the app has been writing until now.
const v1 = {
  version: 1,
  profile: { name: 'Varad', sex: 'male', birthYear: 1998, heightCm: 172, weightKg: 98.7, activity: 'sedentary', goalWeightKg: 80, rateKgPerWeek: 0.5, lang: 'mr', onboarded: true },
  settings: { ollamaUrl: 'http://192.168.1.10:11434', ollamaFallbackUrl: '', textModel: 'qwen3:8b', visionModel: 'qwen2.5vl:7b', nudgeMinutes: 30, nudgesEnabled: true, quietStartHour: 22, quietEndHour: 7, waterGoalMl: 3000, glassMl: 250 },
  meals: [{ id: 'm1', at: '2026-09-26T03:10:00.000Z', date: '2026-09-26', type: 'breakfast', items: [], kcal: 300, protein: 6 }],
  water: [], weights: [], sleep: [], moods: [], workouts: [], nudges: [], chat: [], customFoods: [], memory: [], usage: [],
  breaks: [
    { id: 'b1', date: '2026-09-26', at: '2026-09-26T09:20:00.000Z', action: 'taken', workedMinutes: 20 },
    { id: 'b2', date: '2026-09-26', at: '2026-09-26T10:20:00.000Z', action: 'skipped', workedMinutes: 20 },
  ],
  breakSettings: { enabled: true, workMinutes: 20, breakSeconds: 60, allowSkip: true, quietStartHour: 22, quietEndHour: 7 },
  tips: [], photoQueue: [], steps: [], actionsDone: [],
};

describe('migrateState', () => {
  it('carries the old interval and length into the micro break', () => {
    const s = migrateState({ ...v1, breakSettings: { ...v1.breakSettings, workMinutes: 30, breakSeconds: 45 } });
    expect(s.breakSettings.micro.everyMinutes).toBe(30);
    expect(s.breakSettings.micro.seconds).toBe(45);
    expect(s.breakSettings.enabled).toBe(true);
  });

  it('leaves micro breaks off where the screen is the phone itself', () => {
    // vitest runs under the node platform, which is the non-web branch.
    expect(migrateState(v1).breakSettings.micro.enabled).toBe(false);
    // The kinds that only ever show a notification stay on.
    expect(migrateState(v1).breakSettings.long.enabled).toBe(true);
    expect(migrateState(v1).breakSettings.posture.enabled).toBe(true);
  });

  it('maps the old allowSkip onto a strictness', () => {
    expect(migrateState(v1).breakSettings.strictness).toBe('normal');
    expect(migrateState({ ...v1, breakSettings: { ...v1.breakSettings, allowSkip: false } }).breakSettings.strictness).toBe('strict');
  });

  it('stamps old break logs as micro breaks with the old length', () => {
    const s = migrateState(v1);
    expect(s.breaks).toHaveLength(2);
    expect(s.breaks[0].kind).toBe('micro');
    expect(s.breaks[0].seconds).toBe(60);
    // Everything the old log carried survives.
    expect(s.breaks[1].action).toBe('skipped');
    expect(s.breaks[1].workedMinutes).toBe(20);
  });

  it('keeps every other slice untouched', () => {
    const s = migrateState(v1);
    expect(s.meals).toHaveLength(1);
    expect(s.meals[0].kcal).toBe(300);
    expect(s.profile.name).toBe('Varad');
    expect(s.settings.waterGoalMl).toBe(3000);
  });

  it('marks the result as version 2 and is idempotent', () => {
    const once = migrateState(v1);
    expect(once.version).toBe(2);
    const twice = migrateState(once);
    expect(twice).toEqual(once);
  });

  it('fills defaults for a blob with no break settings at all', () => {
    const s = migrateState({ ...v1, breakSettings: undefined });
    expect(s.breakSettings.micro.everyMinutes).toBe(20);
    expect(s.breakSettings.long.everyMinutes).toBe(60);
  });

  it('returns a fresh state for junk input rather than throwing', () => {
    expect(migrateState(null).version).toBe(EMPTY_STATE.version);
    expect(migrateState('nonsense').profile.onboarded).toBe(false);
  });
});
