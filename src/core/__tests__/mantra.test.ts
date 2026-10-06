import { describe, expect, it } from 'vitest';
import { MANTRAS } from '../../data/mantras';
import { pickMantra, type MantraContext } from '../mantra';

const base: MantraContext = { stage: 'early', waterLow: false, sleepShort: false, proteinLow: false, workDay: true, evening: false };

describe('mantras', () => {
  it('has the same lines in every language', () => {
    const ids = MANTRAS.en.map((m) => m.id);
    expect(MANTRAS.mr.map((m) => m.id)).toEqual(ids);
    expect(MANTRAS.hi.map((m) => m.id)).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MANTRAS.en) expect(m.why.length).toBeGreaterThan(40);
  });

  it('changes from day to day and is the same for the same day', () => {
    const a = pickMantra(MANTRAS.en, base, '2026-10-06');
    const b = pickMantra(MANTRAS.en, base, '2026-10-07');
    expect(a).not.toBeNull();
    expect(a?.id).not.toBe(b?.id);
    expect(pickMantra(MANTRAS.en, base, '2026-10-06')?.id).toBe(a?.id);
  });

  it('speaks to a slipping week and to being done', () => {
    const slipping = pickMantra(MANTRAS.en, { ...base, stage: 'slipping' }, '2026-10-06');
    expect(slipping?.tags).toContain('slipping');
    // Over a week, the done stage reaches its own lines.
    const week = ['01', '02', '03', '04', '05', '06', '07'].map((d) => pickMantra(MANTRAS.en, { ...base, stage: 'done' }, `2026-11-${d}`)?.id);
    expect(week).toContain('maintain');
  });

  it('brings up yesterday\'s slip on alternate days, not every day', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
    const picks = days.map((d) => pickMantra(MANTRAS.en, { ...base, waterLow: true }, d));
    expect(picks.some((m) => m?.tags.includes('water'))).toBe(true);
    expect(picks.every((m) => m?.tags.includes('water'))).toBe(false);
  });
});
