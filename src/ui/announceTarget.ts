/**
 * Which live region says a line on the web. A sheet is a dialog the browser
 * marks modal, and some screen readers hear nothing outside an open dialog,
 * so while a sheet is open the line is said from a region inside the
 * top-most one, and from the page's own region otherwise. A sheet that has
 * just closed is still on the page while it slides out (react-native-web's
 * Modal keeps its dialog until its `onDismiss`), so while the top-most one is
 * closing the line waits: neither the page under it nor a sheet under it
 * speaks yet. Sheets are known by an id each, newest last. Pure.
 */

/** The page's own region, said from while no sheet is open. */
export const PAGE_REGION = 'page';

/**
 * The longest a closing sheet holds a line, in ms: its slide out takes 250,
 * and a browser that runs no animation never says the dialog has gone, so the
 * line is not held for good.
 */
export const CLOSING_MAX_MS = 1000;

/** A sheet on the page: open, or closing since a moment (epoch ms) until its dialog has gone. */
export type OpenSheet = { id: string; closingSince: number | null };

/** The sheets with `id` open, on top. */
export function sheetOpened(stack: readonly OpenSheet[], id: string): OpenSheet[] {
  return [...stack.filter((s) => s.id !== id), { id, closingSince: null }];
}

/** The sheets with `id` closing from `nowMs`, its dialog still on the page; the others as they were. */
export function sheetClosing(stack: readonly OpenSheet[], id: string, nowMs: number): OpenSheet[] {
  return stack.map((s) => (s.id === id && s.closingSince === null ? { id, closingSince: nowMs } : s));
}

/** The sheets with `id` gone from the page: its dialog dismissed, or the sheet unmounted. */
export function sheetClosed(stack: readonly OpenSheet[], id: string): OpenSheet[] {
  return stack.filter((s) => s.id !== id);
}

/**
 * The region that says a line now: the top-most sheet's while it is open, the
 * page's when no sheet is on it, and null, to wait, while the top-most one is
 * closing (for CLOSING_MAX_MS at most).
 */
export function speaker(stack: readonly OpenSheet[], nowMs: number): string | null {
  const on = stack.filter((s) => s.closingSince === null || nowMs - s.closingSince < CLOSING_MAX_MS);
  if (on.length === 0) return PAGE_REGION;
  const top = on[on.length - 1];
  return top.closingSince === null ? top.id : null;
}
