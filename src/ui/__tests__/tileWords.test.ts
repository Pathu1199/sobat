import { describe, expect, it } from 'vitest';
import { NO_VALUE, sleepWords, waterWords, weightWords } from '../../core/tileText';
import { makeT } from '../../i18n';
import type { Lang } from '../../core/types';
import { shownWords } from '../tileWords';

const LANGS: Lang[] = ['en', 'mr', 'hi'];

describe('shownWords', () => {
  it('gives each number its unit in words, fills in the line, and reads the value as one phrase', () => {
    const w = shownWords(waterWords(1000, 3000, 500), makeT('en'));
    expect(w).toEqual({ parts: [{ num: '1.0', unit: 'L' }], line: '4 bottles left', value: '1.0 L' });
    expect(shownWords(sleepWords(430), makeT('en')).value).toBe('7 h 10 m');
  });

  it('before there is a value, shows the dash but gives a screen reader a phrase in its place, in every language', () => {
    const sleep = shownWords(sleepWords(null), makeT('en'));
    expect(sleep.parts).toEqual([{ num: NO_VALUE, unit: undefined }]);
    expect(sleep.value).toBe('No check-in yet');
    expect(sleep.line).toBe('Goal 8 h');
    expect(shownWords(weightWords([], 70, '2026-10-27'), makeT('en')).value).toBe('No weigh-in yet');
    for (const lang of LANGS) {
      const t = makeT(lang);
      for (const words of [sleepWords(null), weightWords([], 70, '2026-10-27')]) {
        const value = shownWords(words, t).value;
        expect(value, lang).not.toContain(NO_VALUE);
        expect(value.length, lang).toBeGreaterThan(3);
      }
    }
  });

  it('says "No weigh-in yet" in Marathi and Hindi the way it says "No check-in yet" for sleep', () => {
    expect(makeT('mr')('tile_no_weight')).toBe('अजून वजन नोंदवलं नाही');
    expect(makeT('hi')('tile_no_weight')).toBe('अभी वज़न दर्ज नहीं');
  });
});
