/**
 * What a screen reader says for a toast: its words and, when it has a button
 * (Undo), the button's name after them, so the person knows there is
 * something to tap. Pure, so it is tested without a screen.
 */
export function toastSpeech(text: string, actionLabel?: string): string {
  if (!actionLabel) return text;
  return /[.!?।]$/.test(text) ? `${text} ${actionLabel}` : `${text}. ${actionLabel}`;
}

/**
 * How long a toast stays, in milliseconds: two seconds with nothing to tap,
 * five with a button. With a screen reader on, a toast with a button stays
 * ten, the time it takes to hear it and move to the button; the web cannot
 * tell whether one is on, so its caller passes true there.
 */
export function toastMs(hasAction: boolean, readerOn: boolean): number {
  if (!hasAction) return 2000;
  return readerOn ? 10000 : 5000;
}
