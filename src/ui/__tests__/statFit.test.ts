import { describe, expect, it } from 'vitest';
import { statScale, valueRuns } from '../statFit';

describe('valueRuns', () => {
  it('splits a value into its figures and its words, so the words can be set smaller', () => {
    expect(valueRuns('12.5 किलो')).toEqual([
      { text: '12.5 ', word: false },
      { text: 'किलो', word: true },
    ]);
    expect(valueRuns('14 पैकी 12')).toEqual([
      { text: '14 ', word: false },
      { text: 'पैकी', word: true },
      { text: ' 12', word: false },
    ]);
    expect(valueRuns('12 of 14')).toEqual([
      { text: '12 ', word: false },
      { text: 'of', word: true },
      { text: ' 14', word: false },
    ]);
  });

  it('keeps a value with no words, or a dash for none, whole at the figure size', () => {
    expect(valueRuns('3')).toEqual([{ text: '3', word: false }]);
    expect(valueRuns('1,463')).toEqual([{ text: '1,463', word: false }]);
    expect(valueRuns('—')).toEqual([{ text: '—', word: false }]);
  });

  it('keeps words of more than one part together, a Devanagari vowel sign with its letter', () => {
    expect(valueRuns('3 में से 7')).toEqual([
      { text: '3 ', word: false },
      { text: 'में से', word: true },
      { text: ' 7', word: false },
    ]);
  });
});

describe('statScale', () => {
  it('leaves a value that fits its column at full size', () => {
    expect(statScale(valueRuns('3'), 25, 17, 100)).toBe(1);
    expect(statScale(valueRuns('2.4 kg'), 20, 14, 100)).toBe(1);
  });

  it('sets a value wider than its column smaller, so it stays on one line, but never below 0.6', () => {
    const s = statScale(valueRuns('14 पैकी 12'), 25, 17.5, 90);
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThanOrEqual(0.6);
    expect(statScale(valueRuns('1,234,567 पैकी 1,234,567'), 25, 17.5, 40)).toBe(0.6);
  });

  it('is smaller in a narrower column, and full size before the column has been measured', () => {
    const runs = valueRuns('12.5 किलो');
    expect(statScale(runs, 25, 17.5, 60)).toBeLessThanOrEqual(statScale(runs, 25, 17.5, 80));
    expect(statScale(runs, 25, 17.5, 0)).toBe(1);
  });
});
