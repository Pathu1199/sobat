/**
 * The switch between a tab's sections (Body's Move, Yoga, Sleep and Mind):
 * each section is at least this wide, room for its name at the largest text
 * size, so four fit between the gutters of a 360 or 375 point phone and a row
 * of more scrolls sideways. Pure.
 */
export const SECTION_MIN_WIDTH = 80;

/** Each section of a row of more than four, which scrolls anyway: wider, so a short name still has room around it. */
export const SECTION_SCROLL_MIN_WIDTH = 92;

/**
 * A row of more than four sections scrolls sideways, and each of its sections
 * is as wide as its own name, kept on one line, so a long one (Food's आहार
 * नियोजन at the largest text size) never wraps; a row of four shares the
 * width equally.
 */
export function sectionsScroll(n: number): boolean {
  return n > 4;
}

/** The least width of a row of `n` sections; a row wider than the screen scrolls. */
export function sectionRowMinWidth(n: number): number {
  return n * (sectionsScroll(n) ? SECTION_SCROLL_MIN_WIDTH : SECTION_MIN_WIDTH);
}
