import { afterEach, describe, expect, it } from 'vitest';
import { luminance } from '../contrast';
import { applyTheme, cardShadow, PALETTES, S } from '../theme';
import { TILE_RADIUS } from '../tileGeometry';

describe('cardShadow', () => {
  it('on a phone in daylight: a faint dark-green shadow, 12 wide, 4 down, elevation 2 on Android', () => {
    expect(cardShadow('light', false)).toEqual({
      shadowColor: '#10211D',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    });
  });

  it('on a phone in the dark: the same shape, stronger, in the dark palette’s shadow colour', () => {
    expect(cardShadow('dark', false)).toEqual({
      shadowColor: PALETTES.dark.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    });
  });

  it('on the web in daylight: a tight contact shadow under a wide soft one', () => {
    expect(cardShadow('light', true)).toEqual({ boxShadow: '0 1px 2px rgba(16,33,29,0.06), 0 8px 24px rgba(16,33,29,0.06)' });
  });

  it('on the web in the dark: the same two layers at a stronger alpha, so they still show on the deep page', () => {
    expect(cardShadow('dark', true)).toEqual({ boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.3)' });
  });

  it('gives the web only a boxShadow and a phone none, so neither gets the other’s props', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(Object.keys(cardShadow(mode, true))).toEqual(['boxShadow']);
      expect(cardShadow(mode, false)).not.toHaveProperty('boxShadow');
    }
  });

  it('is darker than the page it falls on in both themes, so it reads as a shadow and never as a glow', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(luminance(PALETTES[mode].shadow), mode).toBeLessThan(luminance(PALETTES[mode].bg));
    }
  });
});

describe('S.shadow', () => {
  afterEach(() => applyTheme('dark'));

  it('follows the theme: applyTheme swaps it with the palette', () => {
    // Vitest runs as a phone (react-native is stubbed with Platform.OS 'ios').
    expect(S.shadow).toEqual(cardShadow('dark', false));
    applyTheme('light');
    expect(S.shadow).toEqual(cardShadow('light', false));
    applyTheme('dark');
    expect(S.shadow).toEqual(cardShadow('dark', false));
  });
});

describe('corners', () => {
  it('cards and tiles 20, sheets 24 on top, buttons and text boxes 14, chips 12', () => {
    expect(S.radius).toBe(20);
    expect(TILE_RADIUS).toBe(S.radius);
    expect(S.radiusSheet).toBe(24);
    expect(S.radiusSm).toBe(14);
    expect(S.radiusXs).toBe(12);
  });

  it('16 inside a card, the same as the screen’s side gutter', () => {
    expect(S.cardPad).toBe(16);
    expect(S.cardPad).toBe(S.pad);
  });
});
