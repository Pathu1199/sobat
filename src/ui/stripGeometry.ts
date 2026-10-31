import type { StripMark } from '../core/weekStrip';
import { PALETTES, S } from './theme';

/**
 * The week strip's sizes and dots. Each day takes a seventh of the row, so
 * the seven always fit. On Today the strip sits on the page, not in a card,
 * so a day is a finger wide (44 points and more) on a 360 or 375 point phone.
 * On a 320 point phone a day is about 41 points wide, narrower than a finger,
 * so its touch box is kept a finger and more tall as well
 * (`STRIP_DAY_HEIGHT`), with room for the weekday and the date in their pill
 * and the dot under it at the largest text size. Pure.
 */
export const STRIP_DAY_HEIGHT = 64;

/** Above and below the weekday and the date, inside the pill that marks today (and the outline of the chosen day). */
export const STRIP_PILL_PAD = 2;

/** Each side of a day's pill, inside the day's seventh: the outline round the chosen day never touches the day beside it. */
export const STRIP_PILL_MARGIN = 3;

/** Between a day's pill and its dot. */
export const STRIP_DOT_GAP = 4;

/** How far in from the card's edge the calendar on Progress sits: it takes the rest of the card's padding, so the outline round today never runs into the card's edge. */
export const STRIP_EDGE = 4;

/** A day's share of the strip's row. */
export function stripDayWidth(rowWidth: number): number {
  return rowWidth / 7;
}

/** The calendar's own margin on Progress: negative, so its rows reach over the card's padding to STRIP_EDGE from the card's edge. */
export const STRIP_MARGIN = STRIP_EDGE - S.cardPad;

/** The strip's row on Today for a screen this wide: the page less the screen's padding on each side. */
export function stripRowWidth(screenWidth: number): number {
  return screenWidth - 2 * S.pad;
}

type Token = keyof (typeof PALETTES)['light'];

/**
 * The colour of each dot, a token that stands out at 3:1 on the page and the
 * card in light and dark (the contrast test checks it): the deeper teal of words for a full day, amber for meals missing, and
 * the quiet word colour for an outline and for a day of meals all skipped.
 */
export const STRIP_DOT = { full: 'accentText', missing: 'amber', outline: 'textFaint', skipped: 'textFaint' } as const satisfies Record<string, Token>;

/** The outline round the chosen day (and today on the calendar): the full dot's colour, so it keeps 3:1 like the dots. */
export const STRIP_CHOSEN = STRIP_DOT.full;

/** Today on the strip: a soft teal pill, its weekday and date in the teal of words (4.5:1 on it; the contrast test checks it). Its dot sits under the pill, on the page. */
export const STRIP_TODAY = { fill: 'accentSoft', words: 'accentText' } as const satisfies Record<string, Token>;

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
