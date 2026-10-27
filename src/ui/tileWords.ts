import type { TileWords } from '../core/tileText';
import { fill } from '../i18n';

/**
 * A tile's number and line in words: each part with its unit, the line filled
 * in, and the value as one phrase for screen readers, which before there is a
 * value is a phrase such as "No weigh-in yet", never the dash.
 */
export type ShownWords = { parts: { num: string; unit?: string }[]; line: string; value: string };

/** Turns a tile's keys (core/tileText.ts) into words in the person's language. Pure, so it is tested without a screen. */
export function shownWords(words: TileWords, t: (key: string) => string): ShownWords {
  const parts = words.parts.map((p) => ({ num: p.num, unit: p.unitKey ? t(p.unitKey) : undefined }));
  return {
    parts,
    line: fill(t(words.line.key), words.line.params ?? {}),
    value: words.empty ? fill(t(words.empty.key), words.empty.params ?? {}) : parts.map((p) => (p.unit ? `${p.num} ${p.unit}` : p.num)).join(' '),
  };
}
