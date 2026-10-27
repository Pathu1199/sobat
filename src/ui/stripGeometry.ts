import { PALETTES, S } from './theme';

/**
 * The week strip's sizes and dots. Each day takes a seventh of the row, so
 * the seven always fit. On Today the strip reaches over its card's padding to
 * `STRIP_EDGE` from the card's edge, so a day is a finger wide (44 points and
 * more) on a 360 or 375 point phone. On a 320 point phone a day is about 40
 * points wide, narrower than a finger, so its touch box is kept a finger and
 * more tall as well (`STRIP_DAY_HEIGHT`), with room for the weekday, the date
 * and the dot at the largest text size. Pure.
 */
export const STRIP_DAY_HEIGHT = 60;

/** How far in from the card's edge the strip sits on Today: it takes the rest of the card's padding, so the chosen day's tint never runs into the card's border. */
export const STRIP_EDGE = 4;

/** A day's share of the strip's row. */
export function stripDayWidth(rowWidth: number): number {
  return rowWidth / 7;
}

/** The strip's row on Today for a screen this wide: less the screen's padding, the card's border and the strip's edge on each side. */
export function stripRowWidth(screenWidth: number): number {
  return screenWidth - 2 * (S.pad + S.hairline + STRIP_EDGE);
}

type Token = keyof (typeof PALETTES)['light'];

/**
 * The colour of each dot, a token that stands out at 3:1 on the card, the
 * page and the chosen day's tint in light and dark (the contrast test checks
 * it): the deeper teal of words for a full day, amber for meals missing, and
 * the quiet word colour for an outline.
 */
export const STRIP_DOT = { full: 'accentText', missing: 'amber', outline: 'textFaint' } as const satisfies Record<string, Token>;
