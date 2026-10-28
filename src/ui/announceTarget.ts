/**
 * Which live region says a line on the web. A sheet is a dialog the browser
 * marks modal, and some screen readers hear nothing outside an open dialog,
 * so while a sheet is open the line is said from a region inside the
 * top-most one, and from the page's own region otherwise. Sheets are known by
 * an id each, newest last. Pure.
 */

/** The page's own region, said from while no sheet is open. */
export const PAGE_REGION = 'page';

/** The open sheets with `id` opened, on top. */
export function sheetOpened(stack: readonly string[], id: string): string[] {
  return [...stack.filter((s) => s !== id), id];
}

/** The open sheets with `id` closed. */
export function sheetClosed(stack: readonly string[], id: string): string[] {
  return stack.filter((s) => s !== id);
}

/** The region that says a line now: the top-most open sheet's, or the page's. */
export function speaker(stack: readonly string[]): string {
  return stack.length > 0 ? stack[stack.length - 1] : PAGE_REGION;
}
