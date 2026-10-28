import type { TileWords } from '../core/tileText';
import type { ISODate } from '../core/types';
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

/** What a tile tap or the sheet just added: which record, so Undo takes exactly that one away, and the day it went to. */
export type Added = { kind: 'water' | 'walk'; id: string; amount: number; date: ISODate };

/** The line under the tiles: "Added 500 ml water", "Added 10 min walk". */
export function addedText(a: Added, t: (key: string) => string): string {
  return a.kind === 'water' ? fill(t('tile_added_water'), { ml: a.amount }) : fill(t('tile_added_walk'), { min: a.amount });
}

/** What was just added, while the day shown is the day it went to; null on any other day, so the line never shows there. */
export function addedOn(a: Added | null, date: ISODate): Added | null {
  return a && a.date === date ? a : null;
}

/** A bottle size on its chip: "500 ml", and a litre or more in litres, "1 L". */
export function bottleLabel(ml: number, t: (key: string) => string): string {
  return ml >= 1000 ? `${ml / 1000} ${t('tile_unit_l')}` : `${ml} ${t('tile_unit_ml')}`;
}

/** A walk goal on its chip: "20 min". */
export function walkGoalLabel(min: number, t: (key: string) => string): string {
  return `${min} ${t('tile_unit_min')}`;
}

/** A bottle chip as a screen reader names it, with what it sets: "Bottle size 500 ml". */
export function bottleName(ml: number, t: (key: string) => string): string {
  return `${t('tile_bottle_size')} ${bottleLabel(ml, t)}`;
}

/** A walk goal chip as a screen reader names it: "Walk goal 20 min". */
export function walkGoalName(min: number, t: (key: string) => string): string {
  return `${t('walk_target')} ${walkGoalLabel(min, t)}`;
}

/**
 * Whether a key on a tile opens what its hold opens (the water or walk sheet):
 * Shift+Enter, the way on a keyboard with no context menu key, a Mac's. Enter
 * or Space alone is the tap, and Shift+Enter with Control, Alt or Command is
 * left to the browser.
 */
export function opensHold(e: { key: string; shiftKey: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }): boolean {
  return e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
}

/**
 * How a screen reader takes a tile. With a tap or a hold it is a button (a
 * hold alone still makes it one, so the hold is never dropped). With neither
 * it is the tile read as one phrase, its label: text on a phone, and on the
 * web an image, because the web drops a label given to plain text, and an
 * image is read by its label alone, the words and art inside it as one.
 */
export function tileRole(has: { tap: boolean; hold: boolean }, os: string): 'button' | 'text' | 'image' {
  if (has.tap || has.hold) return 'button';
  return os === 'web' ? 'image' : 'text';
}
