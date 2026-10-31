/**
 * Phrases a screen reader says one after another, as sentences: a full stop
 * between two only where the first has none of its own, so nothing is read
 * with two; a phrase left empty is left out. It also puts what a button does
 * in its name, where the web would drop a separate hint. Pure.
 */
export function spokenLine(parts: (string | null | undefined)[]): string {
  return parts.reduce<string>((said, p) => (!p ? said : !said ? p : /[.!?।]$/.test(said) ? `${said} ${p}` : `${said}. ${p}`), '');
}

/**
 * What a screen reader says for a toast: its words and, when it has a button
 * (Undo), the button's name after them, so the person knows there is
 * something to tap. Pure, so it is tested without a screen.
 */
export function toastSpeech(text: string, actionLabel?: string): string {
  return actionLabel ? spokenLine([text, actionLabel]) : text;
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
