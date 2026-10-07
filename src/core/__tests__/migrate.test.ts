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
    expect(once.version).toBe(3);
    const twice = migrateState(once);
    expect(twice).toEqual(once);
  });

  it('fills defaults for a blob with no break settings at all', () => {
    const s = migrateState({ ...v1, breakSettings: undefined });
    expect(s.breakSettings.micro.everyMinutes).toBe(20);
    expect(s.breakSettings.long.everyMinutes).toBe(60);
  });

  it('gives an older store the default routine and keeps an edited one', () => {
    const s = migrateState(v1);
    expect(s.routine).toEqual(EMPTY_STATE.routine);
    expect(s.spend).toEqual([]);
    // A routine saved before a field existed keeps its edits and gains the new field.
    const edited = migrateState({ ...v1, routine: { enabled: false, budgetMin: 150 }, spend: [{ id: 's', date: '2026-09-26', at: '', category: 'fruit', rupees: 300, spreadDays: 7 }] });
    expect(edited.routine.enabled).toBe(false);
    expect(edited.routine.budgetMin).toBe(150);
    expect(edited.routine.budgetMax).toBe(EMPTY_STATE.routine.budgetMax);
    expect(edited.spend).toHaveLength(1);
  });

  it('keeps an address the person typed, and the PC address on a phone', () => {
    const custom = migrateState({ ...v1, settings: { ...v1.settings, ollamaUrl: 'http://10.0.0.5:11434' } });
    expect(custom.settings.ollamaUrl).toBe('http://10.0.0.5:11434');
    // vitest runs as a phone, where localhost would be the phone itself.
    expect(migrateState(v1).settings.ollamaUrl).toBe('http://192.168.1.10:11434');
  });

  it('switches an older store\'s routine off once, and leaves a version-3 store alone', () => {
    expect(migrateState({ ...v1, routine: { ...EMPTY_STATE.routine, enabled: true } }).routine.enabled).toBe(false);
    expect(migrateState({ ...v1, version: 3, routine: { ...EMPTY_STATE.routine, enabled: true } }).routine.enabled).toBe(true);
  });

  it('gives routine meals saved without a time their default time', () => {
    const old = { ...v1, routine: { ...EMPTY_STATE.routine, slots: EMPTY_STATE.routine.slots.map(({ time: _t, ...s }) => s) } };
    const s = migrateState(old);
    expect(s.routine.slots.find((x) => x.id === 'bhel')?.time).toBe('18:30');
    expect(s.routine.slots.find((x) => x.id === 'lunch')?.time).toBe('13:00');
    const custom = migrateState({ ...v1, routine: { ...EMPTY_STATE.routine, slots: [{ id: 'x', type: 'dinner', label_en: 'X', label_mr: '', label_hi: '', options: [[]], withBhaji: false }] } });
    expect(custom.routine.slots[0].time).toBe('20:30');
  });

  it('returns a fresh state for junk input rather than throwing', () => {
    expect(migrateState(null).version).toBe(EMPTY_STATE.version);
    expect(migrateState('nonsense').profile.onboarded).toBe(false);
  });
});
