/**
 * WCAG 2.1 contrast between two colours. Words need 4.5:1 against what they
 * sit on; the palette test holds every token pair the app uses to that.
 * Pure: no React Native, so vitest can import it.
 */

/** Relative luminance of a #RGB or #RRGGBB colour, 0 for black to 1 for white. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const channel = (at: number) => {
    const c = parseInt(full.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** The contrast ratio, 1 to 21, the same whichever colour is passed first. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
