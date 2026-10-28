import { describe, expect, it } from 'vitest';
import exercisesJson from '../../data/exercises.json';
import foodsJson from '../../data/foods.json';
import { MANTRAS } from '../../data/mantras';
import { NUDGES } from '../../data/nudges';
import { RECIPES } from '../../data/recipes';
import { ASANAS } from '../../data/yoga';
import { fill, keysOf, latinDigits, numberText, t } from '../../i18n';
import { amountText } from '../basket';
import { formatDayLabel, formatDayMonth, formatDayMonthYear, formatMonthYear } from '../date';
import { foodName, itemName, measureName, portionLabel } from '../foods';
import { storyLine } from '../storyLines';
import type { FoodItem } from '../types';

const foods = foodsJson as unknown as FoodItem[];
/** Devanagari digits, ० to ९. */
const DEVANAGARI = /[०-९]/;

describe('one digit style', () => {
  it('writes Devanagari digits as the digits the rest of the app writes, and leaves everything else as it is', () => {
    expect(latinDigits('२६ ऑक्टो, १,७१४')).toBe('26 ऑक्टो, 1,714');
    expect(latinDigits('3 × 1 नग (40 ग्रॅ)')).toBe('3 × 1 नग (40 ग्रॅ)');
  });

  it('writes a day total with a comma for thousands, on every device whatever its own language', () => {
    expect([numberText(1714), numberText(950), numberText(12345), numberText(1714.4), numberText(0)]).toEqual(['1,714', '950', '12,345', '1,714', '0']);
    expect(fill(t('en', 'menu_planned_of'), { kcal: numberText(1714), goal: numberText(1762) })).toBe('Planned 1,714 of 1,762');
  });

  it('writes dates in Marathi with the same digits as the numbers beside them: the week strip\'s header, a day, a month', () => {
    for (const s of [formatDayMonth('2026-10-26', 'mr'), formatDayLabel('2026-10-26', 'mr'), formatDayMonthYear('2027-03-14', 'mr'), formatMonthYear('2026-10-01', 'mr')]) {
      expect(s).not.toMatch(DEVANAGARI);
    }
    expect(formatDayMonth('2026-10-26', 'mr')).toMatch(/26/);
    expect(formatMonthYear('2026-10-01', 'mr')).toMatch(/2026/);
    expect(formatDayMonth('2026-10-26', 'hi')).toMatch(/26/);
  });

  it('writes a food\'s measures and names in Marathi with the same digits as its count: "3 × 1 नग", never "3 × १ नग"', () => {
    const chapati = foods.find((f) => f.id === 'chapati')!;
    expect(portionLabel(chapati.portions[0], 'mr')).toBe('1 नग (40 ग्रॅ)');
    expect(amountText(3, measureName(chapati, 'piece', 'mr'))).toBe('3 × 1 नग (40 ग्रॅ)');
    // A food read from a photo, logged under its own Marathi name.
    expect(itemName({ name_en: 'Chicken 65', name_mr: 'चिकन ६५' }, foods, 'mr')).toBe('चिकन 65');
    for (const f of foods) {
      expect(foodName(f, 'mr'), f.id).not.toMatch(DEVANAGARI);
      for (const p of f.portions) expect(portionLabel(p, 'mr'), `${f.id} ${p.unit}`).not.toMatch(DEVANAGARI);
    }
  });

  it('writes every one of the app\'s own words in Marathi and Hindi with the same digits, key by key', () => {
    for (const lang of ['mr', 'hi'] as const) {
      const keys = keysOf(lang);
      expect(keys.length, lang).toBeGreaterThan(1000);
      for (const key of keys) expect(t(lang, key), `${lang} ${key}`).not.toMatch(DEVANAGARI);
    }
  });

  it('writes the app\'s own Marathi words with the same digits: badges, camps, the water toast, the household measures', () => {
    for (const key of ['badge_streak_7', 'badge_meals_100', 'level_camp1', 'toast_water_added', 'measure_bowl', 'act_walk_20', 'oc_walk_do', 'challenge_steps_4']) {
      expect(t('mr', key), key).not.toMatch(DEVANAGARI);
    }
    expect(t('mr', 'badge_streak_7')).toMatch(/7/);
  });

  it('writes the Marathi of the coach\'s lines, the recipes, yoga, exercises, mantras and break nudges with the same digits', () => {
    for (let seed = 0; seed < 8; seed++) {
      for (const kind of ['water', 'break', 'eyes', 'posture', 'walk', 'meal', 'stop', 'sleep', 'log', 'weigh'] as const) expect(storyLine(kind, 'mr', seed), kind).not.toMatch(DEVANAGARI);
    }
    for (const [name, data] of Object.entries({ RECIPES, ASANAS, MANTRAS, NUDGES, exercises: exercisesJson })) expect(JSON.stringify(data), name).not.toMatch(DEVANAGARI);
  });
});
