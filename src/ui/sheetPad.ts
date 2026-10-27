/**
 * The room under a bottom sheet's last row: the phone's home-indicator inset,
 * so nothing sits under the bar at the bottom of the screen. Not while the
 * keyboard is up, which covers that bar and already sits under the sheet, and
 * never on a wide screen, where the sheet is a centred panel.
 */
export function sheetBottomPad(input: { wide: boolean; keyboardUp: boolean; inset: number }): number {
  return input.wide || input.keyboardUp ? 0 : input.inset;
}
