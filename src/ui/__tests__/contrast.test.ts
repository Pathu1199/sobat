import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from '../contrast';
import { STRIP_CHOSEN, STRIP_DOT, STRIP_TODAY, stripDot } from '../stripGeometry';
import { AMBER_NOTE, PALETTES, type ThemeMode } from '../theme';

const MODES: ThemeMode[] = ['light', 'dark'];
/** What words sit on. */
const SURFACES = ['bg', 'pageAlt', 'card', 'cardAlt'] as const;
/** Every token the app sets words in. */
const WORDS = ['text', 'textDim', 'textFaint', 'accentText', 'red', 'amber', 'green', 'cyan', 'violet', 'pink'] as const;

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('is the same whichever colour comes first', () => {
    expect(contrastRatio('#12A57F', '#0E1B1F')).toBe(contrastRatio('#0E1B1F', '#12A57F'));
  });

  it('reads three-digit hex', () => {
    expect(luminance('#fff')).toBeCloseTo(1, 5);
    expect(luminance('#000')).toBe(0);
  });
});

describe('palette', () => {
  for (const mode of MODES) {
    const P = PALETTES[mode];

    it(`${mode}: every colour that carries words reads at 4.5:1 on every surface`, () => {
      for (const fg of WORDS) {
        for (const bg of SURFACES) {
          expect(contrastRatio(P[fg], P[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${mode}: pageAlt is the page one step lighter, short of a card`, () => {
      expect(luminance(P.pageAlt)).toBeGreaterThan(luminance(P.bg));
      expect(luminance(P.pageAlt)).toBeLessThan(luminance(P.card));
    });

    it(`${mode}: words on the accent use onAccent at 4.5:1`, () => {
      expect(contrastRatio(P.onAccent, P.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${mode}: soft buttons and status chips keep their words readable`, () => {
      expect(contrastRatio(P.accentText, P.accentDim), 'accentText on accentDim').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(P.accentText, P.accentSoft), 'accentText on accentSoft').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(P.red, P.redSoft), 'red on redSoft').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(P.amber, P.amberSoft), 'amber on amberSoft').toBeGreaterThanOrEqual(4.5);
    });

    it(`${mode}: the amber note on Today reads at 4.5:1, its words and its △ in dark amber on soft amber`, () => {
      expect(contrastRatio(P[AMBER_NOTE.words], P[AMBER_NOTE.fill])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${mode}: the current meal's block on accentSoft sets its words, the small ones too, in text or accentText`, () => {
      for (const fg of ['text', 'accentText'] as const) {
        expect(contrastRatio(P[fg], P.accentSoft), `${fg} on accentSoft`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${mode}: the week strip's dots stand out at 3:1 on the page and the card (a dot sits under today's pill, never on it)`, () => {
      for (const [kind, token] of Object.entries(STRIP_DOT)) {
        for (const bg of ['bg', 'card', 'cardAlt'] as const) {
          expect(contrastRatio(P[token], P[bg]), `${kind} dot (${token}) on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it(`${mode}: a day filled in from the plan keeps its dot at full colour, 3:1, and is told apart by its shape, never faded`, () => {
      for (const mark of ['full', 'missing', 'today'] as const) {
        const plain = stripDot(mark, false);
        const fromPlan = stripDot(mark, true);
        expect(fromPlan.kind, mark).toBe('ringDot');
        expect(fromPlan.kind, mark).not.toBe(plain.kind);
        if (plain.kind === 'none' || fromPlan.kind === 'none') throw new Error(mark);
        expect(fromPlan.color, mark).toBe(plain.color);
        for (const bg of ['bg', 'card', 'cardAlt'] as const) {
          expect(contrastRatio(P[fromPlan.color], P[bg]), `${mark} from the plan on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      }
      expect(stripDot('planned', false)).toEqual({ kind: 'ring', color: STRIP_DOT.outline });
      // A day of meals all skipped and nothing eaten: a quiet grey dot, never the teal of a full day.
      expect(stripDot('skipped', false)).toEqual({ kind: 'dot', color: STRIP_DOT.skipped });
      expect(stripDot('skipped', true)).toEqual({ kind: 'dot', color: STRIP_DOT.skipped });
      expect(STRIP_DOT.skipped).not.toBe(STRIP_DOT.full);
      expect(stripDot('off', true)).toEqual({ kind: 'none' });
      expect(stripDot('unplanned', false)).toEqual({ kind: 'none' });
      expect(stripDot('none', false)).toEqual({ kind: 'none' });
    });

    it(`${mode}: the chosen day's outline is the full dot's colour, 3:1 on the page and the card`, () => {
      expect(STRIP_CHOSEN).toBe(STRIP_DOT.full);
      for (const bg of ['bg', 'card', 'cardAlt'] as const) {
        expect(contrastRatio(P[STRIP_CHOSEN], P[bg]), `chosen outline on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    });

    it(`${mode}: today's pill on the week strip sets its weekday and date in accentText on accentSoft, at 4.5:1`, () => {
      expect(contrastRatio(P[STRIP_TODAY.words], P[STRIP_TODAY.fill])).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('has no ghost text colour left to reach for', () => {
    expect(Object.keys(PALETTES.light)).not.toContain('textGhost');
    expect(Object.keys(PALETTES.dark)).not.toContain('textGhost');
  });
});
