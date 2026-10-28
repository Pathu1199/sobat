import type { StripMark } from '../core/weekStrip';
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

/** The strip's own margin on Today: negative, so it reaches over the card's padding to STRIP_EDGE from the card's edge. */
export const STRIP_MARGIN = STRIP_EDGE - S.padLg;

/** The strip's row on Today for a screen this wide: inside the card (less the screen's padding, the card's border and its padding on each side), less the strip's margin. */
export function stripRowWidth(screenWidth: number): number {
  const cardInside = screenWidth - 2 * (S.pad + S.hairline + S.padLg);
  return cardInside - 2 * STRIP_MARGIN;
}

type Token = keyof (typeof PALETTES)['light'];

/**
 * The colour of each dot, a token that stands out at 3:1 on the card, the
 * page and the chosen day's tint in light and dark (the contrast test checks
 * it): the deeper teal of words for a full day, amber for meals missing, and
 * the quiet word colour for an outline and for a day of meals all skipped.
 */
export const STRIP_DOT = { full: 'accentText', missing: 'amber', outline: 'textFaint', skipped: 'textFaint' } as const satisfies Record<string, Token>;

/** The outline round the chosen day (and today on the calendar): the full dot's colour, so it keeps 3:1 like the dots. */
export const STRIP_CHOSEN = STRIP_DOT.full;

/** The dot's size, the width of its ring, and the dot in the middle of a ring. */
export const STRIP_DOT_SIZE = 8;
export const STRIP_RING = 1.5;
export const STRIP_CORE = 3;

export type StripDot = { kind: 'none' } | { kind: 'dot' | 'ring' | 'ringDot'; color: (typeof STRIP_DOT)[keyof typeof STRIP_DOT] };

/**
 * How a day's dot is drawn, always at full colour so it keeps 3:1: a filled
 * dot for a full day and for meals missing, a ring for a planned day and for
 * today, and a grey dot for a day of meals all skipped. A day still holding
 * meals filled in from the plan is told apart by its shape, a ring in its
 * colour with a small dot in the middle, never by fading it. Nothing on a free
 * day, a past day that planned nothing and ate nothing, or before the person
 * started.
 */
export function stripDot(mark: StripMark, fromPlan: boolean): StripDot {
  if (mark === 'off' || mark === 'unplanned' || mark === 'none') return { kind: 'none' };
  if (mark === 'skipped') return { kind: 'dot', color: STRIP_DOT.skipped };
  const color = mark === 'full' ? STRIP_DOT.full : mark === 'missing' ? STRIP_DOT.missing : STRIP_DOT.outline;
  if (fromPlan && mark !== 'planned') return { kind: 'ringDot', color };
  return { kind: mark === 'planned' || mark === 'today' ? 'ring' : 'dot', color };
}
