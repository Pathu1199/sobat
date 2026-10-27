import { PALETTES, S } from './theme';

/**
 * The week strip's sizes and dots. Each day takes a seventh of the row, so
 * the seven always fit, on a 320 point phone too: there, inside Today's card,
 * a day is about 35 points wide, narrower than a finger, so its touch box is
 * kept a finger and more tall instead (`STRIP_DAY_HEIGHT`), with room for the
 * weekday, the date and the dot at the largest text size. Pure.
 */
export const STRIP_DAY_HEIGHT = 60;

/** A day's share of the strip's row. */
export function stripDayWidth(rowWidth: number): number {
  return rowWidth / 7;
}

/** The strip's row on Today for a screen this wide: less the screen's padding and the card's padding and border on each side. */
export function stripRowWidth(screenWidth: number): number {
  return screenWidth - 2 * (S.pad + S.padLg + S.hairline);
}

type Token = keyof (typeof PALETTES)['light'];

/**
 * The colour of each dot, a token that stands out at 3:1 on the card, the
 * page and the chosen day's tint in light and dark (the contrast test checks
 * it): the deeper teal of words for a full day, amber for meals missing, and
 * the quiet word colour for an outline.
 */
export const STRIP_DOT = { full: 'accentText', missing: 'amber', outline: 'textFaint' } as const satisfies Record<string, Token>;
