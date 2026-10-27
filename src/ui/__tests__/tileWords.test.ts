import { describe, expect, it } from 'vitest';
import { NO_VALUE, sleepWords, waterWords, weightWords } from '../../core/tileText';
import { makeT } from '../../i18n';
import type { Lang } from '../../core/types';
import { addedText, bottleLabel, shownWords, tileRole } from '../tileWords';

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

describe('the line under the tiles, and the bottle sizes', () => {
  it('says what a tap added: "Added 500 ml water", "Added 10 min walk"', () => {
    expect(addedText({ kind: 'water', id: 'a', amount: 500 }, makeT('en'))).toBe('Added 500 ml water');
    expect(addedText({ kind: 'walk', id: 'b', amount: 10 }, makeT('en'))).toBe('Added 10 min walk');
    for (const lang of LANGS) {
      const t = makeT(lang);
      expect(addedText({ kind: 'water', id: 'a', amount: 750 }, t), lang).toContain('750');
      expect(addedText({ kind: 'walk', id: 'b', amount: 25 }, t), lang).toContain('25');
      expect(addedText({ kind: 'walk', id: 'b', amount: 25 }, t), lang).not.toContain('{');
    }
  });

  it('names a bottle in millilitres, and a litre or more in litres', () => {
    expect(bottleLabel(500, makeT('en'))).toBe('500 ml');
    expect(bottleLabel(750, makeT('en'))).toBe('750 ml');
    expect(bottleLabel(1000, makeT('en'))).toBe('1 L');
    expect(bottleLabel(1500, makeT('en'))).toBe('1.5 L');
    expect(bottleLabel(1000, makeT('hi'))).toBe('1 ली');
  });
});

describe('how a screen reader takes a tile', () => {
  it('a tile with a tap, or with only a hold, is a button, so the hold is never lost', () => {
    expect(tileRole({ tap: true, hold: false }, 'ios')).toBe('button');
    expect(tileRole({ tap: true, hold: true }, 'web')).toBe('button');
    expect(tileRole({ tap: false, hold: true }, 'android')).toBe('button');
    expect(tileRole({ tap: false, hold: true }, 'web')).toBe('button');
  });

  it('a tile with neither is read as one phrase: text on a phone, and on the web an image with its label, since the web drops a label on plain text', () => {
    expect(tileRole({ tap: false, hold: false }, 'ios')).toBe('text');
    expect(tileRole({ tap: false, hold: false }, 'android')).toBe('text');
    expect(tileRole({ tap: false, hold: false }, 'web')).toBe('image');
  });
});
