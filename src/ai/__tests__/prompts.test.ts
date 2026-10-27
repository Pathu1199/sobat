import { describe, expect, it } from 'vitest';
import { journeyFact } from '../prompts';

describe('journeyFact', () => {
  const plan = { lostKg: 2.4, toGoKg: 7.1, stage: 'early' as const };

  it('says where Lost counts from: the first weigh-in, or the chapter start once there is a chapter', () => {
    expect(journeyFact(plan, undefined)).toBe('Weight journey: lost 2.4 kg since the first weigh-in, 7.1 kg to go, stage "early".');
    expect(journeyFact(plan, '2026-10-20')).toBe('Weight journey: lost 2.4 kg since the chapter start, 7.1 kg to go, stage "early".');
  });
});
