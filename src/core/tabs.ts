import type { TabId, TodayCardId } from './types';

/**
 * What the person chose to see: up to two extra tabs beside the fixed Today,
 * ➕ and Me, and the cards on Today in their order. Pure, so a value that
 * arrives from sync or an old file is cleaned the same way everywhere.
 */
export const TAB_IDS: TabId[] = ['progress', 'coach', 'body', 'sleep', 'plan', 'abhyas'];
export const MAX_EXTRA_TABS = 2;
/** Two tabs each side of ➕, so the bar is balanced: Today · Abhyas · ➕ · Progress · Me. */
export const DEFAULT_TABS: TabId[] = ['abhyas', 'progress'];

export const TODAY_CARD_IDS: TodayCardId[] = ['menu', 'coach', 'waterWalk', 'abhyas', 'weight', 'sleep', 'steps', 'climb', 'mantra'];

/** The day's menu, the coach line, the water and walk tiles and the Abhyas list are on; the rest can be added. */
export const DEFAULT_TODAY_CARDS: { id: TodayCardId; on: boolean }[] = TODAY_CARD_IDS.map((id) => ({ id, on: id === 'menu' || id === 'coach' || id === 'waterWalk' || id === 'abhyas' }));

/** Known ids only, each once, at most two. Anything that is not a list gets the default. */
export function normalizeTabs(tabs: unknown): TabId[] {
  if (!Array.isArray(tabs)) return [...DEFAULT_TABS];
  const out: TabId[] = [];
  for (const t of tabs) {
    if (out.length === MAX_EXTRA_TABS) break;
    if (typeof t === 'string' && (TAB_IDS as string[]).includes(t) && !out.includes(t as TabId)) out.push(t as TabId);
  }
  return out;
}

/**
 * Every known card exactly once, in the order stored, each switch true or
 * false (anything but true is off). Unknown ids and second copies are dropped;
 * a known card missing from the list is added at the end, switched off, so a
 * card added in an update waits to be switched on. Anything that is not a
 * list gets the default cards.
 */
export function normalizeTodayCards(cards: unknown): { id: TodayCardId; on: boolean }[] {
  if (!Array.isArray(cards)) return DEFAULT_TODAY_CARDS.map((c) => ({ ...c }));
  const out: { id: TodayCardId; on: boolean }[] = [];
  for (const c of cards) {
    if (typeof c !== 'object' || c === null) continue;
    const { id, on } = c as { id?: unknown; on?: unknown };
    if (typeof id === 'string' && (TODAY_CARD_IDS as string[]).includes(id) && !out.some((o) => o.id === id)) out.push({ id: id as TodayCardId, on: on === true });
  }
  for (const id of TODAY_CARD_IDS) if (!out.some((o) => o.id === id)) out.push({ id, on: false });
  return out;
}
