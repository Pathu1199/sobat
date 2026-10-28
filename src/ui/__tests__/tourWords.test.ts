import { describe, expect, it } from 'vitest';
import { GUIDE } from '../../data/guide';
import { t } from '../../i18n';

const TOUR = ['tour_1_t', 'tour_1_b', 'tour_2_t', 'tour_2_b', 'tour_3_t', 'tour_3_b'];
/** A word in Latin letters; digits, ➕ and the rest are fine. */
const LATIN = /[A-Za-z]/;

describe('the tour and the Guide describe the app as it is', () => {
  it('the tour names Calories left, the menu and Ate as planned, ➕, the week strip, the Weight tile on Progress and the Guide in Me', () => {
    const tour = TOUR.map((k) => t('en', k)).join(' ');
    for (const words of ['Calories left', 'menu', 'Ate as planned', '➕', 'week strip', 'Weight tile', 'Progress', 'Guide', 'Me']) expect(tour).toContain(words);
    // Names of screens and cards that are gone.
    expect(tour).not.toMatch(/\bring\b|plan card|Log on a meal|\? guide/i);
  });

  it('the coach\'s day plan no longer points to a card on Today', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) expect(t(lang, 'oc_day_plan_tip'), lang).not.toMatch(/What fits|काय बसेल|क्या फ़िट|card|कार्ड/);
  });

  it('the Guide speaks of the screens there are: no Log screen, plan card or ring', () => {
    const lines = GUIDE.en.flatMap((s) => s.lines).join(' ');
    expect(lines).not.toMatch(/Log screen|plan card|The ring|routine screen|Move tab/);
    expect(lines).toMatch(/Ate as planned/);
    expect(lines).toMatch(/Weight tile/);
  });

  it('in Marathi and Hindi, the tour, the Guide and the day plan\'s last line carry no word in Latin letters', () => {
    for (const lang of ['mr', 'hi'] as const) {
      for (const k of [...TOUR, 'oc_day_plan_tip']) expect(t(lang, k), `${lang} ${k}`).not.toMatch(LATIN);
      for (const s of GUIDE[lang]) for (const line of [s.title, ...s.lines]) expect(line, `${lang} ${s.id}`).not.toMatch(LATIN);
    }
  });

  it('the office day\'s line describes the breaks the app runs now: look away every 20 minutes, stand up every hour, follow the prompt on screen', () => {
    const office = (lang: 'en' | 'mr' | 'hi') => GUIDE[lang].find((s) => s.id === 'office')!.lines.join(' ');
    expect(office('en')).toMatch(/look away .*every 20 minutes/i);
    expect(office('en')).toMatch(/stand up .*every hour/i);
    expect(office('en')).toMatch(/prompt on the screen/);
    // The check-in that asked for these is no longer shown.
    expect(office('en')).not.toMatch(/glass of water|two minutes|five minutes/);
    expect(office('mr')).not.toMatch(/ग्लास पाणी|दोन मिनिटे|पाच मिनिटे/);
    expect(office('hi')).not.toMatch(/गिलास पानी|दो मिनट|पाँच मिनट/);
    for (const lang of ['mr', 'hi'] as const) expect(office(lang), lang).toMatch(/20/);
  });

  it('has every Guide topic in all three languages, in the same order', () => {
    expect(GUIDE.mr.map((s) => s.id)).toEqual(GUIDE.en.map((s) => s.id));
    expect(GUIDE.hi.map((s) => s.id)).toEqual(GUIDE.en.map((s) => s.id));
  });
});
