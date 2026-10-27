import { DEFAULT_TABS, DEFAULT_TODAY_CARDS, MAX_EXTRA_TABS, normalizeTabs, normalizeTodayCards } from './tabs';
import type { TabId, TodayCardId } from './types';

/**
 * Customize's rules. Extra tabs: at most two; a third is never added
 * silently, the page asks which one it replaces. Today's cards: every card
 * once in the person's order, each on or off; one switched on joins the end
 * of the cards that are on, and moving steps over the cards that are off or
 * not shown. Every rule cleans what it is given first (`normalizeTabs`,
 * `normalizeTodayCards`), so a damaged value from sync is never saved back.
 * Pure: the page saves what these return.
 */
export type CardSetting = { id: TodayCardId; on: boolean };

/** An extra tab switched: off, or on while there is room. With two on already nothing changes and `full` says to ask which one to replace. */
export function toggleTab(tabs: unknown, id: TabId): { tabs: TabId[]; full: boolean } {
  const now = normalizeTabs(tabs);
  if (now.includes(id)) return { tabs: now.filter((x) => x !== id), full: false };
  if (now.length >= MAX_EXTRA_TABS) return { tabs: now, full: true };
  return { tabs: [...now, id], full: false };
}

/** The open "which one should it replace?" question: the tab asked about, and the bar as it was when it was asked. */
export type ReplaceQuestion = { id: TabId; tabs: TabId[] };

/**
 * The tab the question is about, while it still stands: the bar is the one it
 * was asked about and still full. Sync may change the bar while the question
 * is open; any change ends it, so a reply never replaces a tab the person did
 * not see.
 */
export function askingNow(q: ReplaceQuestion | null, tabs: unknown): TabId | null {
  if (!q) return null;
  const now = normalizeTabs(tabs);
  const same = now.length === q.tabs.length && now.every((x, i) => x === q.tabs[i]);
  return same && toggleTab(now, q.id).full ? q.id : null;
}

/** `id` in the place of `out`. */
export function replaceTab(tabs: unknown, out: TabId, id: TabId): TabId[] {
  return normalizeTabs(normalizeTabs(tabs).map((x) => (x === out ? id : x)));
}

/** A card switched off keeps its place; one switched on goes after the last card that is on. */
export function toggleCard(cards: unknown, id: TodayCardId): CardSetting[] {
  const list = normalizeTodayCards(cards);
  const card = list.find((c) => c.id === id);
  if (!card) return list;
  if (card.on) return list.map((c) => (c.id === id ? { ...c, on: false } : c));
  const rest = list.filter((c) => c.id !== id);
  const lastOn = rest.reduce((at, c, i) => (c.on ? i : at), -1);
  return [...rest.slice(0, lastOn + 1), { id, on: true }, ...rest.slice(lastOn + 1)];
}

/**
 * A card that is on, one place up (-1) or down (1) among the cards that are
 * on and shown: it steps over cards that are off and the `hidden` ones (the
 * day's line while it is switched off in Settings), so each press moves it
 * one place on the page. At either end nothing changes.
 */
export function moveCard(cards: unknown, id: TodayCardId, by: -1 | 1, hidden: TodayCardId[] = []): CardSetting[] {
  const list = normalizeTodayCards(cards);
  const from = list.findIndex((c) => c.id === id && c.on);
  if (from < 0) return list;
  const stop = (c: CardSetting) => c.on && !hidden.includes(c.id);
  let to = from + by;
  while (to >= 0 && to < list.length && !stop(list[to])) to += by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** The cards Customize lists, on (in order) and off: the day's line only while it is switched on in Settings. */
export function cardsShown(cards: unknown, mantraOn: boolean): { on: CardSetting[]; off: CardSetting[] } {
  const shown = normalizeTodayCards(cards).filter((c) => c.id !== 'mantra' || mantraOn);
  return { on: shown.filter((c) => c.on), off: shown.filter((c) => !c.on) };
}

/**
 * After a card moved: its place among the cards shown ("place 2 of 3"), and
 * which of its buttons keeps the focus: the one pressed, or the other one when
 * the card reached the end where the pressed one no longer works. Null for a
 * card that is off or not there.
 */
export function afterMove(cards: unknown, id: TodayCardId, by: -1 | 1, mantraOn: boolean): { n: number; m: number; focus: 'up' | 'down' } | null {
  const on = cardsShown(cards, mantraOn).on;
  const i = on.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const last = on.length - 1;
  const focus = by < 0 ? (i > 0 ? 'up' : 'down') : i < last ? 'down' : 'up';
  return { n: i + 1, m: on.length, focus };
}

/** Progress as the one extra tab, and the menu, the coach line and the water and walk cards on Today. */
export function defaultCustomize(): { tabs: TabId[]; todayCards: CardSetting[] } {
  return { tabs: [...DEFAULT_TABS], todayCards: DEFAULT_TODAY_CARDS.map((c) => ({ ...c })) };
}
