import { describe, expect, it } from 'vitest';
import { keysOf, t } from '../../i18n';

describe('the word lists', () => {
  it('has every Marathi and Hindi word in English too, so no word is left with nothing to fall back on', () => {
    const en = new Set(keysOf('en'));
    for (const lang of ['mr', 'hi'] as const) expect(keysOf(lang).filter((k) => !en.has(k)), lang).toEqual([]);
  });

  it('names the app ध्येय in Marathi and Hindi sentences, never in Latin letters, the old name included', () => {
    // `app_name` is the name itself, in Latin letters in every language as under the icon and on the wordmark; a word the
    // language has none of its own for falls back to English, and is checked here too.
    for (const lang of ['mr', 'hi'] as const) expect(keysOf(lang).filter((k) => k !== 'app_name' && /Dhyey|Sobat/i.test(t(lang, k))), lang).toEqual([]);
    expect(t('mr', 'app_name')).toBe('Dhyey');
  });
});
