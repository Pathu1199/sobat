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

/** What a tile tap or the sheet just added: which record, so Undo takes exactly that one away. */
export type Added = { kind: 'water' | 'walk'; id: string; amount: number };

/** The line under the tiles: "Added 500 ml water", "Added 10 min walk". */
export function addedText(a: Added, t: (key: string) => string): string {
  return a.kind === 'water' ? fill(t('tile_added_water'), { ml: a.amount }) : fill(t('tile_added_walk'), { min: a.amount });
}

/** A bottle size on its chip: "500 ml", and a litre or more in litres, "1 L". */
export function bottleLabel(ml: number, t: (key: string) => string): string {
  return ml >= 1000 ? `${ml / 1000} ${t('tile_unit_l')}` : `${ml} ${t('tile_unit_ml')}`;
}
