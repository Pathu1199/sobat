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

/** A tab's label size for a text size, in whole points. */
export function tabLabelSize(scale: number): number {
  return Math.round(TAB_LABEL * scale);
}

/** The bar's height above the safe area for a text size: 60, or what the pill and the label at that size need, if more. */
export function barHeight(scale: number): number {
  return Math.max(BAR_HEIGHT, TAB_PAD + TAB_PILL.height + TAB_GAP + lh(tabLabelSize(scale)) + TAB_PAD);
}
