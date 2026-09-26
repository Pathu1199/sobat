import { describe, expect, it } from 'vitest';
import { buildSteps, completedExerciseIds, progressAt, stepSeconds, totalSeconds } from '../session';
import type { Exercise } from '../types';

function ex(id: string, over: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name_en: id,
    name_mr: id,
    name_hi: id,
    category: 'strength',
    impact: 'low',
    level: 1,
    equipment: 'none',
    mode: 'reps',
    default_reps: 10,
    default_sets: 2,
    rest_seconds: 30,
    instructions_en: ['do it'],
    instructions_mr: ['करा'],
    instructions_hi: ['करें'],
    safety_en: 'stop if it hurts',
    muscles: ['legs'],
    ...over,
  };
}

describe('buildSteps', () => {
  it('makes one step per set', () => {
    const steps = buildSteps([ex('a', { default_sets: 3, rest_seconds: 0 })]);
    expect(steps.filter((s) => s.kind === 'exercise')).toHaveLength(3);
  });

  it('puts rest between sets but not after the last one', () => {
    const steps = buildSteps([ex('a', { default_sets: 2 })]);
    expect(steps.map((s) => s.kind)).toEqual(['exercise', 'rest', 'exercise']);
  });

  it('rests between exercises too', () => {
    const steps = buildSteps([ex('a', { default_sets: 1 }), ex('b', { default_sets: 1 })]);
    expect(steps.map((s) => s.kind)).toEqual(['exercise', 'rest', 'exercise']);
  });

  it('names what the rest is leading into', () => {
    const steps = buildSteps([ex('a', { default_sets: 1 }), ex('b', { default_sets: 1 })]);
    const rest = steps.find((s) => s.kind === 'rest');
    expect(rest?.kind === 'rest' && rest.nextExercise.id).toBe('b');
  });

  it('never ends on a rest', () => {
    const steps = buildSteps([ex('a'), ex('b'), ex('c')]);
    expect(steps[steps.length - 1].kind).toBe('exercise');
  });

  it('skips rest when the exercise has none', () => {
    const steps = buildSteps([ex('a', { default_sets: 2, rest_seconds: 0 })]);
    expect(steps.every((s) => s.kind === 'exercise')).toBe(true);
  });

  it('carries the timing for a time-based move', () => {
    const steps = buildSteps([ex('walk', { mode: 'time', default_seconds: 600, default_reps: undefined, default_sets: 1 })]);
    expect(steps[0].kind === 'exercise' && steps[0].seconds).toBe(600);
    expect(steps[0].kind === 'exercise' && steps[0].reps).toBeUndefined();
  });

  it('handles an empty session', () => {
    expect(buildSteps([])).toEqual([]);
  });
});

describe('timing', () => {
  it('adds up time moves and rest exactly', () => {
    const steps = buildSteps([ex('walk', { mode: 'time', default_seconds: 300, default_reps: undefined, default_sets: 2, rest_seconds: 60 })]);
    expect(totalSeconds(steps)).toBe(300 + 60 + 300);
  });

  it('estimates rep moves at three seconds each', () => {
    const steps = buildSteps([ex('a', { default_sets: 1, default_reps: 10, rest_seconds: 0 })]);
    expect(stepSeconds(steps[0])).toBe(30);
  });
});

describe('progressAt', () => {
  const steps = buildSteps([ex('a', { mode: 'time', default_seconds: 60, default_reps: undefined, default_sets: 2, rest_seconds: 60 })]);

  it('starts at zero and ends at one', () => {
    expect(progressAt(steps, 0)).toBe(0);
    expect(progressAt(steps, steps.length)).toBe(1);
  });

  it('moves forward through the session', () => {
    expect(progressAt(steps, 1)).toBeCloseTo(60 / 180, 2);
    expect(progressAt(steps, 2)).toBeCloseTo(120 / 180, 2);
  });
});

describe('completedExerciseIds', () => {
  const steps = buildSteps([ex('a', { default_sets: 1 }), ex('b', { default_sets: 1 })]);

  it('counts only what was reached', () => {
    expect(completedExerciseIds(steps, 0)).toEqual([]);
    expect(completedExerciseIds(steps, 1)).toEqual(['a']);
    expect(completedExerciseIds(steps, steps.length)).toEqual(['a', 'b']);
  });

  it('does not repeat an exercise done for several sets', () => {
    const many = buildSteps([ex('a', { default_sets: 3 })]);
    expect(completedExerciseIds(many, many.length)).toEqual(['a']);
  });
});
