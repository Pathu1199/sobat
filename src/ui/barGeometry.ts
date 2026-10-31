import { lh } from './theme';

/**
 * The tab bar's sizes: 60 points tall above the bottom safe area, icons 24,
 * labels 12 at weight 500 (times the text size, as every size), the chosen
 * tab's soft pill 56 × 32 behind its icon, and ➕ 56 across, lifted half its
 * height above the bar. At a larger text size the bar grows by what the label
 * needs, so a Devanagari label is never clipped. Pure.
 */
export const BAR_HEIGHT = 60;
export const TAB_ICON = 24;
export const TAB_LABEL = 12;
export const TAB_PILL = { width: 56, height: 32 } as const;
/** Above the pill, and below the label. */
export const TAB_PAD = 4;
/** Between the pill and the label. */
export const TAB_GAP = 2;
export const PLUS_SIZE = 56;
/** How far ➕ rises above the bar's top edge: half its height. */
export const PLUS_LIFT = PLUS_SIZE / 2;
/** The room kept between ➕'s top and anything floating above it. */
export const PLUS_CLEAR_GAP = 8;

/** A tab's label size for a text size, in whole points. */
export function tabLabelSize(scale: number): number {
  return Math.round(TAB_LABEL * scale);
}

/** The bar's height above the safe area for a text size: 60, or what the pill and the label at that size need, if more. */
export function barHeight(scale: number): number {
  return Math.max(BAR_HEIGHT, TAB_PAD + TAB_PILL.height + TAB_GAP + lh(tabLabelSize(scale)) + TAB_PAD);
}

/** The padding under the tabs: the bottom safe area, and at least 6 points on the phone and 10 on the web. TabBar and clearOfBar share it, so the two never disagree. */
export function barBottom(insetBottom: number, web: boolean): number {
  return Math.max(insetBottom, web ? 10 : 6);
}

/** How far from the bottom of the screen a floating thing (a toast, the Coach's input row) must sit to clear the bar and the top of ➕. */
export function clearOfBar(scale: number, insetBottom: number, web: boolean): number {
  return barHeight(scale) + barBottom(insetBottom, web) + PLUS_LIFT + PLUS_CLEAR_GAP;
}

/**
 * Where a floating thing sits above the bottom of the screen, for the toasts and nudges: on a phone clear of the bar and the top of ➕;
 * on a wide screen, which has no bar, `wideGap` above the bottom safe area. One rule for all of them, so none drifts behind the bar.
 */
export function floatBottom(wide: boolean, scale: number, insetBottom: number, web: boolean, wideGap: number): number {
  return wide ? wideGap + insetBottom : clearOfBar(scale, insetBottom, web);
}
