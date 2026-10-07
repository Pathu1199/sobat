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
    expect(r.text).not.toContain('Fitoo note');
  });

  it('catches a calorie target under the floor', () => {
    const r = guardAdvice('Eat only 900 calories tomorrow to make up for today.', 1500);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('below_floor');
    expect(r.text).toContain('Fitoo note');
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

describe('guardAdvice calorie context', () => {
  it('allows a normal meal-sized number', () => {
    const r = guardAdvice('Your next meal can be 500 to 700 kcal, something like dal and rice.', 1500);
    expect(r.ok).toBe(true);
  });

  it('still catches a low number meant for the whole day', () => {
    expect(guardAdvice('Try to stay under 900 kcal per day this week.', 1500).reasons).toContain('below_floor');
    expect(guardAdvice('Eat only 1200 calories today to make up for it.', 1500).reasons).toContain('below_floor');
  });

  it('catches a low daily figure written in Devanagari', () => {
    expect(guardAdvice('आज फक्त 800 कॅलरी खा.', 1500).reasons).toContain('below_floor');
  });

  it('leaves a 400 kcal snack suggestion alone', () => {
    expect(guardAdvice('A 400 kcal snack is fine here.', 1500).ok).toBe(true);
  });
});
