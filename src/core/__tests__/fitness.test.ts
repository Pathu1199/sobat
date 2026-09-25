import { describe, expect, it } from 'vitest';
import { buildSession, phaseForWeek, readiness, shouldEasePlan, weeksSince } from '../fitness';
import type { Exercise, SleepLog, WorkoutLog } from '../types';

function ex(id: string, category: Exercise['category'], level: 1 | 2 | 3, seconds?: number): Exercise {
  return {
    id,
    name_en: id,
    name_mr: id,
    name_hi: id,
    category,
    impact: 'low',
    level,
    equipment: 'none',
    mode: seconds ? 'time' : 'reps',
    default_seconds: seconds,
    default_reps: seconds ? undefined : 10,
    default_sets: 2,
    rest_seconds: 30,
    instructions_en: ['do it'],
    instructions_mr: ['करा'],
    instructions_hi: ['करें'],
    safety_en: 'stop if it hurts',
    muscles: ['legs'],
  };
}

const library: Exercise[] = [
  ex('walk-10', 'walk', 1, 600),
  ex('walk-30', 'walk', 1, 1800),
  ex('neck-rolls', 'mobility', 1),
  ex('shoulder-rolls', 'mobility', 1),
  ex('hip-circles', 'mobility', 1),
  ex('chair-squat', 'strength', 1),
  ex('wall-push-up', 'strength', 1),
  ex('glute-bridge', 'strength', 1),
  ex('plank-knees', 'strength', 2),
  ex('box-breathing', 'breathing', 1, 120),
  ex('calf-stretch', 'stretch', 1, 30),
  ex('hamstring-stretch', 'stretch', 1, 30),
];

const goodSleep: SleepLog = { date: '2026-09-24', bed: '23:00', wake: '07:00', quality: 4, wakeups: 0, energy: 4, minutes: 480, score: 85 };
const badSleep: SleepLog = { date: '2026-09-24', bed: '02:00', wake: '06:00', quality: 2, wakeups: 2, energy: 1, minutes: 240, score: 25 };

describe('readiness', () => {
  it('is green after a good night', () => {
    expect(readiness({ lastSleep: goodSleep }).level).toBe('green');
  });

  it('drops after a short night', () => {
    const r = readiness({ lastSleep: badSleep });
    expect(r.level).not.toBe('green');
    expect(r.reasons).toContain('short_sleep');
  });

  it('goes red when pain was reported and sleep was bad', () => {
    const w: WorkoutLog = { id: '1', date: '2026-09-24', exerciseIds: [], minutes: 20, status: 'done', pain: true };
    const r = readiness({ lastSleep: badSleep, lastWorkout: w });
    expect(r.level).toBe('red');
  });

  it('stays inside 0 to 100', () => {
    const w: WorkoutLog = { id: '1', date: '2026-09-24', exerciseIds: [], minutes: 20, status: 'done', pain: true, felt: 5 };
    const r = readiness({ lastSleep: badSleep, lastWorkout: w, moodScore: 1, soreness: 5 });
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe('phaseForWeek', () => {
  it('starts with walking only', () => {
    const p = phaseForWeek(1);
    expect(p.phase).toBe(1);
    expect(p.walkMinutes).toBe(10);
    expect(p.strengthDays).toBe(0);
  });

  it('ramps walking, then adds strength', () => {
    expect(phaseForWeek(3).strengthDays).toBe(1);
    expect(phaseForWeek(6).phase).toBe(2);
    expect(phaseForWeek(20).phase).toBe(3);
  });
});

describe('buildSession', () => {
  it('gives a full day when ready', () => {
    const s = buildSession(library, 8, readiness({ lastSleep: goodSleep }));
    expect(s.level).toBe('green');
    expect(s.exercises.some((e) => e.category === 'strength')).toBe(true);
  });

  it('never returns an empty session on a red day', () => {
    const s = buildSession(library, 8, { score: 20, level: 'red', reasons: [] });
    expect(s.exercises.length).toBeGreaterThan(0);
    expect(s.exercises.some((e) => e.category === 'strength')).toBe(false);
  });

  it('keeps week 1 free of level 2 moves', () => {
    const s = buildSession(library, 1, readiness({ lastSleep: goodSleep }));
    expect(s.exercises.every((e) => e.level === 1)).toBe(true);
  });
});

describe('shouldEasePlan', () => {
  const skip = (d: string): WorkoutLog => ({ id: d, date: d, exerciseIds: [], minutes: 0, status: 'skipped' });
  it('eases after three skips in a row', () => {
    expect(shouldEasePlan([skip('a'), skip('b'), skip('c')])).toBe(true);
  });
  it('does not ease after two', () => {
    expect(shouldEasePlan([skip('a'), skip('b')])).toBe(false);
  });
});

describe('weeksSince', () => {
  it('counts from week 1', () => {
    expect(weeksSince('2026-09-25', '2026-09-25')).toBe(1);
    expect(weeksSince('2026-09-01', '2026-09-25')).toBe(4);
  });
});
