/**
 * A figure in a narrow column, kept on one line. A phone shrinks text to fit
 * by itself (`adjustsFontSizeToFit`); a browser cannot, so on the web the
 * value is set smaller by how much wider than its column it would be, from a
 * rough width of its letters. Pure, so it is tested without a screen.
 */

/** A piece of a value: figures (digits, their stops and commas, a dash), or the words between them. */
export type ValueRun = { text: string; word: boolean };

/** Letters and their vowel signs, a few words joined by single spaces ("में से"), as one run. */
const WORDS = /[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*/gu;

/** The value split into its figures and its words, in order, so the words can be set smaller than the figures. */
export function valueRuns(value: string): ValueRun[] {
  const runs: ValueRun[] = [];
  let at = 0;
  for (const m of value.matchAll(WORDS)) {
    const start = m.index ?? 0;
    if (start > at) runs.push({ text: value.slice(at, start), word: false });
    runs.push({ text: m[0], word: true });
    at = start + m[0].length;
  }
  if (at < value.length) runs.push({ text: value.slice(at), word: false });
  return runs;
}

/**
 * How wide a text is, roughly, in ems, from the widths of the web's system
 * fonts: a Devanagari letter is wide, a vowel sign written beside it narrow,
 * one written above or below it takes no room, and a stop or a space little.
 */
function ems(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (/\p{Mn}/u.test(ch)) continue;
    if (/\p{Mc}/u.test(ch)) n += 0.15;
    else if (/\d/.test(ch)) n += 0.62;
    else if (/[.,:;]/.test(ch)) n += 0.25;
    else if (ch === ' ') n += 0.22;
    else if (/[\u0900-\u097F]/.test(ch)) n += 0.8;
    else if (/\p{L}/u.test(ch)) n += 0.55;
    else n += 0.6;
  }
  return n;
}

/** The smallest a value is set, as a share of its size: smaller than this, a figure is no longer read at a glance. */
export const STAT_MIN_SCALE = 0.6;

/**
 * The scale, from 0.6 to 1, that fits a value into a column `width` points
 * wide, its figures at `size` and its words at `small`, with a little room to
 * spare for the rough widths. 1 while the column has not been measured.
 */
export function statScale(runs: ValueRun[], size: number, small: number, width: number): number {
  if (width <= 0) return 1;
  const wide = runs.reduce((sum, r) => sum + ems(r.text) * (r.word ? small : size), 0) * 1.08;
  if (wide <= width) return 1;
  return Math.max(STAT_MIN_SCALE, width / wide);
}
