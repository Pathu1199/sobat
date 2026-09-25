import { describe, expect, it } from 'vitest';
import { guardAdvice, isCrisisText, HELPLINES } from '../guardrails';

describe('isCrisisText', () => {
  it('catches English phrasing', () => {
    expect(isCrisisText('sometimes I want to die')).toBe(true);
    expect(isCrisisText('I think about suicide')).toBe(true);
  });

  it('catches Devanagari phrasing', () => {
    expect(isCrisisText('मला आत्महत्या करावी वाटते')).toBe(true);
  });

  it('does not fire on ordinary sadness', () => {
    expect(isCrisisText('I am feeling low and tired today')).toBe(false);
    expect(isCrisisText('this diet is killing me')).toBe(false);
  });

  it('ships real helpline numbers', () => {
    expect(HELPLINES.map((h) => h.number)).toContain('14416');
  });
});

describe('guardAdvice', () => {
  it('passes normal advice through untouched', () => {
    const r = guardAdvice('Have a katori of dal and a chapati, then walk for 20 minutes.', 1500);
    expect(r.ok).toBe(true);
    expect(r.text).not.toContain('Sobat note');
  });

  it('catches a calorie target under the floor', () => {
    const r = guardAdvice('Eat only 900 calories tomorrow to make up for today.', 1500);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('below_floor');
    expect(r.text).toContain('Sobat note');
  });

  it('catches meal skipping', () => {
    const r = guardAdvice('Just skip dinner tonight.', 1500);
    expect(r.reasons).toContain('skip_meal');
  });

  it('catches a diagnosis', () => {
    const r = guardAdvice('Based on this you have diabetes.', 1500);
    expect(r.reasons).toContain('medical_claim');
  });

  it('leaves a sensible number alone', () => {
    const r = guardAdvice('Aim for about 1800 kcal today.', 1500);
    expect(r.ok).toBe(true);
  });
});
