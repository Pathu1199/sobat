import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { setupBlocks, setupNumber, setupProblems, setupTarget, STEP_OF } from '../setup';
import type { Profile } from '../types';

const NOW = new Date('2026-10-28T12:00:00');
const TODAY = '2026-10-28';
const ok = { birthYear: '1990', height: '170', weight: '82', goal: '68' };

describe('setupProblems', () => {
  it('accepts a grown-up with sensible numbers', () => {
    expect(setupProblems(ok, NOW)).toEqual([]);
  });

  it('wants the four-digit year of an adult', () => {
    expect(setupProblems({ ...ok, birthYear: '90' }, NOW)).toEqual(['year']);
    expect(setupProblems({ ...ok, birthYear: '2015' }, NOW)).toEqual(['year']);
  });

  it('takes empty boxes as problems, never as zero', () => {
    expect(setupProblems({ birthYear: '', height: '', weight: '', goal: '' }, NOW)).toEqual(['year', 'height', 'weight', 'goal']);
    expect(setupProblems({ ...ok, height: '17o' }, NOW)).toEqual(['height']);
  });

  it('a goal under the healthy range for the height is a problem', () => {
    // 170 cm: the healthy range starts at 53 kg.
    expect(setupProblems({ ...ok, goal: '52' }, NOW)).toEqual(['goal']);
    expect(setupProblems({ ...ok, goal: '53' }, NOW)).toEqual([]);
  });

  it('keeps a height of 120 to 230 cm, a weight of 30 to 300 kg and a goal up to 300 kg', () => {
    expect(setupProblems({ ...ok, height: '120', goal: '30' }, NOW)).toEqual([]);
    expect(setupProblems({ ...ok, height: '230', weight: '300', goal: '98' }, NOW)).toEqual([]);
    expect(setupProblems({ ...ok, height: '119' }, NOW)).toEqual(['height']);
    expect(setupProblems({ ...ok, height: '231' }, NOW)).toEqual(['height']);
    expect(setupProblems({ ...ok, weight: '29' }, NOW)).toEqual(['weight']);
    expect(setupProblems({ ...ok, weight: '301' }, NOW)).toEqual(['weight']);
    expect(setupProblems({ ...ok, goal: '301' }, NOW)).toEqual(['goal']);
  });

  it('reads a year and numbers typed with Devanagari digits', () => {
    expect(setupProblems({ birthYear: '१९९०', height: '१७०', weight: '८२', goal: '६८' }, NOW)).toEqual([]);
  });
});

describe('setup answers', () => {
  it('reads a decimal comma, and puts each answer on its step', () => {
    expect(setupNumber('72,5')).toBe(72.5);
    expect(setupNumber(' 80 ')).toBe(80);
    expect(Number.isNaN(setupNumber(''))).toBe(true);
    expect(STEP_OF).toEqual({ year: 1, height: 1, weight: 2, goal: 2 });
  });

  it('reads Devanagari digits and a number still being typed, and nothing else', () => {
    expect(setupNumber('७२')).toBe(72);
    expect(setupNumber('72.')).toBe(72);
    for (const s of ['-5', '7 2', '72kg', '.5', '1.2.3', 'abc']) expect(Number.isNaN(setupNumber(s)), s).toBe(true);
  });

  it('holds a step back for a problem on that step or an earlier one, never a later one', () => {
    const all = setupProblems({ birthYear: '', height: '', weight: '', goal: '' }, NOW);
    expect(setupBlocks(all, 0)).toEqual([]);
    expect(setupBlocks(all, 1)).toEqual(['year', 'height']);
    expect(setupBlocks(all, 2)).toEqual(['year', 'height', 'weight', 'goal']);
    expect(setupBlocks(['goal'], 3)).toEqual(['goal']);
    expect(setupBlocks(['goal'], 1)).toEqual([]);
  });
});

describe('setup words', () => {
  const KEYS = [
    'setup_step', 'setup_lang_title', 'setup_about_title', 'setup_weight_title', 'setup_done_title', 'setup_eg', 'setup_back', 'setup_range',
    'setup_bad_year', 'setup_bad_height', 'setup_bad_weight', 'setup_bad_goal', 'setup_target_line', 'setup_goal_line', 'setup_hold_line',
  ];
  const blanks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('are written in Marathi and Hindi too, with the same blanks and the digits the rest of the app writes', () => {
    for (const key of KEYS) {
      const en = t('en', key);
      expect(en, key).not.toBe(key);
      for (const lang of ['mr', 'hi'] as const) {
        const s = t(lang, key);
        expect(s, `${lang} ${key}`).not.toBe(en);
        expect(s, `${lang} ${key}`).not.toMatch(/[०-९]/);
        expect(blanks(s), `${lang} ${key}`).toEqual(blanks(en));
      }
    }
  });
});

describe('setupTarget', () => {
  const base: Profile = {
    name: '',
    sex: 'male',
    birthYear: 1990,
    heightCm: 170,
    weightKg: 82,
    startWeightKg: 82,
    activity: 'sedentary',
    goalWeightKg: 68,
    rateKgPerWeek: 0.5,
    lang: 'en',
    onboarded: true,
    onboardedOn: TODAY,
  };

  it('gives the day target and the date the goal comes at the chosen pace', () => {
    expect(setupTarget(base, TODAY, NOW)).toEqual({
      kcal: 1500,
      proteinG: 95,
      floored: false,
      hold: false,
      // 14 kg at half a kilo a week: 196 days.
      reach: { rateKg: 0.5, goalKg: 68, date: '2027-05-12' },
    });
  });

  it('dates the goal at the pace the safe minimum allows, not the one chosen', () => {
    const t = setupTarget({ ...base, sex: 'female', heightCm: 155, weightKg: 60, startWeightKg: 60, goalWeightKg: 50, rateKgPerWeek: 1 }, TODAY, NOW);
    expect(t.kcal).toBe(1200);
    expect(t.floored).toBe(true);
    // 10 kg at a quarter of a kilo a week: 280 days.
    expect(t.reach).toEqual({ rateKg: 0.25, goalKg: 50, date: '2027-08-04' });
  });

  it('has no date when the plan keeps the weight where it is', () => {
    const t = setupTarget({ ...base, goalWeightKg: 82 }, TODAY, NOW);
    expect(t.hold).toBe(true);
    expect(t.reach).toBeNull();
  });
});
