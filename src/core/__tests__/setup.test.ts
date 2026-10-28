import { describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { numberIn, setupBlocks, setupNumber, setupProblems, setupTarget, STEP_OF } from '../setup';
import type { Profile } from '../types';

const NOW = new Date('2026-10-28T12:00:00');
const TODAY = '2026-10-28';
const ok = { sex: 'female' as const, birthYear: '1990', height: '170', weight: '82', goal: '68' };

describe('setupProblems', () => {
  it('accepts a grown-up with sensible numbers', () => {
    expect(setupProblems(ok, NOW)).toEqual([]);
  });

  it('wants the four-digit year of an adult', () => {
    expect(setupProblems({ ...ok, birthYear: '90' }, NOW)).toEqual(['year']);
    expect(setupProblems({ ...ok, birthYear: '2015' }, NOW)).toEqual(['year']);
  });

  it('takes empty boxes as problems, never as zero', () => {
    expect(setupProblems({ sex: null, birthYear: '', height: '', weight: '', goal: '' }, NOW)).toEqual(['sex', 'year', 'height', 'weight', 'goal']);
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
    expect(setupProblems({ sex: 'male', birthYear: '१९९०', height: '१७०', weight: '८२', goal: '६८' }, NOW)).toEqual([]);
  });

  it('wants male or female chosen: nothing is chosen for the person, so the first step holds until one is', () => {
    expect(setupProblems({ ...ok, sex: null }, NOW)).toEqual(['sex']);
    expect(setupBlocks(setupProblems({ ...ok, sex: null }, NOW), 1)).toEqual(['sex']);
    expect(setupProblems({ ...ok, sex: 'male' }, NOW)).toEqual([]);
  });
});

describe('setup answers', () => {
  it('reads a decimal comma, and puts each answer on its step', () => {
    expect(setupNumber('72,5')).toBe(72.5);
    expect(setupNumber(' 80 ')).toBe(80);
    expect(Number.isNaN(setupNumber(''))).toBe(true);
    expect(STEP_OF).toEqual({ sex: 1, year: 1, height: 1, weight: 2, goal: 2 });
  });

  it('reads Devanagari digits and a number still being typed, and nothing else', () => {
    expect(setupNumber('७२')).toBe(72);
    expect(setupNumber('72.')).toBe(72);
    for (const s of ['-5', '7 2', '72kg', '.5', '1.2.3', 'abc']) expect(Number.isNaN(setupNumber(s)), s).toBe(true);
  });

  it('reads a weight typed in the weight sheet with a decimal comma or in Devanagari digits, and only inside its range', () => {
    expect(numberIn('72,5', 25, 350)).toBe(72.5);
    expect(numberIn('७२.५', 25, 350)).toBe(72.5);
    expect(numberIn('७२,५', 25, 350)).toBe(72.5);
    expect(numberIn('25', 25, 350)).toBe(25);
    expect(numberIn('350', 25, 350)).toBe(350);
    for (const s of ['', '20', '351', '72kg', '-72']) expect(numberIn(s, 25, 350), s).toBeNull();
  });

  it('holds a step back for a problem on that step or an earlier one, never a later one', () => {
    const all = setupProblems({ sex: null, birthYear: '', height: '', weight: '', goal: '' }, NOW);
    expect(setupBlocks(all, 0)).toEqual([]);
    expect(setupBlocks(all, 1)).toEqual(['sex', 'year', 'height']);
    expect(setupBlocks(all, 2)).toEqual(['sex', 'year', 'height', 'weight', 'goal']);
    expect(setupBlocks(['goal'], 3)).toEqual(['goal']);
    expect(setupBlocks(['goal'], 1)).toEqual([]);
  });
});

describe('setup words', () => {
  const KEYS = [
    'setup_step', 'setup_lang_title', 'setup_about_title', 'setup_weight_title', 'setup_done_title', 'setup_eg', 'setup_back', 'setup_range',
    'setup_bad_sex', 'setup_bad_year', 'setup_bad_height', 'setup_bad_weight', 'setup_bad_goal', 'setup_target_line', 'setup_goal_line', 'setup_hold_line',
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

  // A woman of 66, 155 cm, mostly sitting: her upkeep is a little above the safe minimum, so the minimum leaves little pace.
  const slow: Profile = { ...base, sex: 'female', birthYear: 1960, heightCm: 155, weightKg: 57, startWeightKg: 57, goalWeightKg: 50 };

  it('has no date, only the floor note, when the pace the safe minimum leaves is under 0.1 kg a week', () => {
    const t = setupTarget(slow, TODAY, NOW);
    expect(t.floored).toBe(true);
    expect(t.reach).toBeNull();
  });

  it('has no date when the goal is more than two years away, however steady the pace', () => {
    // 12 kg at 0.11 kg a week: late in 2028, past two years.
    const far = setupTarget({ ...slow, weightKg: 62, startWeightKg: 62 }, TODAY, NOW);
    expect(far.floored).toBe(true);
    expect(far.reach).toBeNull();
    // 20 kg at 0.27 kg a week comes in March 2028, inside two years: the date stays.
    expect(setupTarget({ ...slow, birthYear: 1975, heightCm: 158, weightKg: 68, startWeightKg: 68, goalWeightKg: 48 }, TODAY, NOW).reach).toEqual({ rateKg: 0.27, goalKg: 48, date: '2028-03-30' });
  });

  it('has no date and keeps the floor note when the upkeep itself is under the safe minimum', () => {
    // A woman of 76, 150 cm and 47 kg: her upkeep is about 1040 kcal, under the 1200 kcal minimum the target is raised to.
    const t = setupTarget({ ...slow, birthYear: 1950, heightCm: 150, weightKg: 47, startWeightKg: 47, goalWeightKg: 43 }, TODAY, NOW);
    expect(t.kcal).toBe(1200);
    expect(t.floored).toBe(true);
    expect(t.hold).toBe(false);
    expect(t.reach).toBeNull();
  });
});
