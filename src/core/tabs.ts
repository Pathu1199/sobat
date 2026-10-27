import type { TabId, TodayCardId } from './types';

/**
 * What the person chose to see: up to two extra tabs beside the fixed Today,
 * ➕ and Me, and the cards on Today in their order. Pure, so a value that
 * arrives from sync or an old file is cleaned the same way everywhere.
 */
export const TAB_IDS: TabId[] = ['progress', 'coach', 'body', 'sleep', 'plan'];
export const MAX_EXTRA_TABS = 2;
export const DEFAULT_TABS: TabId[] = ['progress'];

export const TODAY_CARD_IDS: TodayCardId[] = ['menu', 'coach', 'waterWalk', 'weight', 'sleep', 'steps', 'climb', 'mantra'];

/** The day's menu, the coach line and the water and walk tiles are on; the rest can be added. */
export const DEFAULT_TODAY_CARDS: { id: TodayCardId; on: boolean }[] = TODAY_CARD_IDS.map((id) => ({ id, on: id === 'menu' || id === 'coach' || id === 'waterWalk' }));

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
