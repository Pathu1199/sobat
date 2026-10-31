/**
 * The three looks the user picks from in Settings, each one action colour, a
 * soft tint at the top of every tab and a reward colour kept for rewards:
 * emerald and gold (the default), indigo and amber, forest and saffron. The
 * colours themselves are in src/ui/theme.ts; this is the choice as it is
 * stored and synced. Pure.
 */
export const PALETTE_IDS = ['emerald', 'indigo', 'saffron'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export const DEFAULT_PALETTE: PaletteId = 'emerald';

/** A stored choice as the app reads it: one of the three, anything else (a missing setting, a damaged file) the default. */
export function paletteOf(v: unknown): PaletteId {
  return typeof v === 'string' && (PALETTE_IDS as readonly string[]).includes(v) ? (v as PaletteId) : DEFAULT_PALETTE;
}
