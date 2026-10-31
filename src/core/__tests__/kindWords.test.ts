import { describe, expect, it } from 'vitest';
import { GUIDE } from '../../data/guide';
import { NUDGES } from '../../data/nudges';
import { keysOf, t } from '../../i18n';

/**
 * The app never scolds: what is not done is "not yet", never missed, failed,
 * behind or below the line, in any language. A few lines use such a word for
 * something other than the user's day: a save or a sign-in that did not go
 * through, "the maths behind it", a pain that stays.
 */
const SCOLDING = {
  en: /\b(miss|missed|missing|fail|failed|behind|slip|slipped|lazy|cheat|cheated)\b|below the line/i,
  mr: /चुकल|चुकले|राहिल|मागे आहे|रेषेखाली/,
  hi: /छूट गय|छूटे|छूटने|पीछे है|रेखा से नीचे/,
} as const;
const NOT_THE_USER: Record<string, string[]> = { en: ['storage_save_failed', 'w_f1_b'], mr: ['auth_err_generic', 'pain_note'], hi: [] };

describe('kind words', () => {
  for (const lang of ['en', 'mr', 'hi'] as const) {
    it(`${lang}: no line scolds the user`, () => {
      const found = keysOf(lang).filter((k) => !NOT_THE_USER[lang].includes(k) && SCOLDING[lang].test(t(lang, k)));
      expect(found).toEqual([]);
    });
  }

  it('the guide and the nudges, written outside the dictionaries, hold to the same rule', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const lines = [
        ...GUIDE[lang].flatMap((g) => [g.title, ...g.lines]),
        ...Object.values(NUDGES[lang]).flatMap((list) => list.flatMap((m) => [m.title, m.body, m.task])),
      ];
      expect(lines.filter((l) => SCOLDING[lang].test(l)), lang).toEqual([]);
    }
  });

  it('calls the list Routine, दिनक्रम and दिनचर्या, and nothing says Abhyas any more', () => {
    expect([t('en', 'abhyas'), t('mr', 'abhyas'), t('hi', 'abhyas')]).toEqual(['Routine', 'दिनक्रम', 'दिनचर्या']);
    for (const lang of ['en', 'mr', 'hi'] as const) expect(keysOf(lang).filter((k) => /Abhyas/.test(t(lang, k))), lang).toEqual([]);
    for (const lang of ['mr', 'hi'] as const) expect(['abhyas', 'cust_card_abhyas', 'rem_abhyas', 'push_desc', 'rem_web_note'].filter((k) => t(lang, k).includes('अभ्यास')), lang).toEqual([]);
  });
});
