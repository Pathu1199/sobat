import { describe, expect, it } from 'vitest';
import { keysOf } from '../../i18n';

describe('the word lists', () => {
  it('has every Marathi and Hindi word in English too, so no word is left with nothing to fall back on', () => {
    const en = new Set(keysOf('en'));
    for (const lang of ['mr', 'hi'] as const) expect(keysOf(lang).filter((k) => !en.has(k)), lang).toEqual([]);
  });
});
