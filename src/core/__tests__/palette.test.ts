import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, PALETTE_IDS, paletteOf } from '../palette';

describe('paletteOf', () => {
  it('reads each of the three looks as stored', () => {
    for (const id of PALETTE_IDS) expect(paletteOf(id)).toBe(id);
    expect(PALETTE_IDS).toEqual(['emerald', 'indigo', 'saffron']);
  });

  it('reads anything else as emerald and gold, the default: a setting not stored yet, a damaged file, a look from a newer build', () => {
    expect(DEFAULT_PALETTE).toBe('emerald');
    for (const v of [undefined, null, '', 'rose', 3, {}, ['indigo']]) expect(paletteOf(v), String(v)).toBe('emerald');
  });
});
