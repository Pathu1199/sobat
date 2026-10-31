import { describe, expect, it } from 'vitest';
import { afterMove, askingNow, cardsShown, defaultCustomize, moveCard, replaceTab, toggleCard, toggleTab } from '../customize';
import { DEFAULT_TODAY_CARDS } from '../tabs';

const onIds = (cards: { id: string; on: boolean }[]) => cards.filter((c) => c.on).map((c) => c.id);

describe('extra tabs', () => {
  it('switches one on while there is room, and off at any time', () => {
    expect(toggleTab(['progress'], 'coach')).toEqual({ tabs: ['progress', 'coach'], full: false });
    expect(toggleTab(['progress', 'coach'], 'progress')).toEqual({ tabs: ['coach'], full: false });
    expect(toggleTab([], 'sleep')).toEqual({ tabs: ['sleep'], full: false });
  });

  it('a third changes nothing and asks which one to replace; the answer takes its place', () => {
    expect(toggleTab(['progress', 'coach'], 'sleep')).toEqual({ tabs: ['progress', 'coach'], full: true });
    expect(replaceTab(['progress', 'coach'], 'progress', 'sleep')).toEqual(['sleep', 'coach']);
    expect(replaceTab(['progress', 'coach'], 'coach', 'plan')).toEqual(['progress', 'plan']);
  });

  it('cleans a damaged list from sync first, so the fixed tabs are never hidden', () => {
    expect(toggleTab(['progress', 'nope', 'progress'], 'coach')).toEqual({ tabs: ['progress', 'coach'], full: false });
    expect(toggleTab('x', 'coach')).toEqual({ tabs: ['progress', 'coach'], full: false });
    // A tab already on the bar cannot come in twice.
    expect(replaceTab(['progress', 'coach'], 'progress', 'coach')).toEqual(['coach']);
  });

  it('the question stands only while the tabs are the ones it was asked about and still full', () => {
    const asked = { id: 'sleep' as const, tabs: ['progress', 'coach'] as ('progress' | 'coach')[] };
    expect(askingNow(asked, ['progress', 'coach'])).toBe('sleep');
    expect(askingNow(null, ['progress', 'coach'])).toBeNull();
    // Sync changed the bar while the question was open: it goes away, whatever the change.
    expect(askingNow(asked, ['progress'])).toBeNull();
    expect(askingNow(asked, ['progress', 'plan'])).toBeNull();
    expect(askingNow(asked, ['coach', 'progress'])).toBeNull();
    expect(askingNow(asked, ['progress', 'sleep'])).toBeNull();
    // A damaged list from sync is cleaned before it is compared.
    expect(askingNow(asked, ['progress', 'coach', 'nope'])).toBe('sleep');
  });
});

describe("Today's cards", () => {
  it('a card switched on joins the end of the ones that are on; switched off it keeps its place', () => {
    const on = toggleCard(DEFAULT_TODAY_CARDS, 'climb');
    expect(onIds(on)).toEqual(['menu', 'coach', 'waterWalk', 'abhyas', 'climb']);
    expect(toggleCard(on, 'coach').map((c) => c.id)).toEqual(on.map((c) => c.id));
    expect(toggleCard(on, 'coach').find((c) => c.id === 'coach')?.on).toBe(false);
    // Every card is still there once.
    expect(on.map((c) => c.id).sort()).toEqual(DEFAULT_TODAY_CARDS.map((c) => c.id).sort());
  });

  it('moves among the cards that are on, and not past either end', () => {
    expect(onIds(moveCard(DEFAULT_TODAY_CARDS, 'waterWalk', -1))).toEqual(['menu', 'waterWalk', 'coach', 'abhyas']);
    expect(onIds(moveCard(DEFAULT_TODAY_CARDS, 'waterWalk', 1))).toEqual(['menu', 'coach', 'abhyas', 'waterWalk']);
    expect(moveCard(DEFAULT_TODAY_CARDS, 'menu', -1)).toEqual(DEFAULT_TODAY_CARDS);
    expect(moveCard(DEFAULT_TODAY_CARDS, 'abhyas', 1)).toEqual(DEFAULT_TODAY_CARDS);
    // A card that is off does not move.
    expect(moveCard(DEFAULT_TODAY_CARDS, 'climb', -1)).toEqual(DEFAULT_TODAY_CARDS);
  });

  it('steps over a card that is on but not shown, so every press moves the card one place on the page', () => {
    // The day's line is on, but its switch in Settings is off, so the page does not list it.
    const cards = [
      { id: 'menu' as const, on: true },
      { id: 'mantra' as const, on: true },
      { id: 'coach' as const, on: true },
    ];
    expect(onIds(moveCard(cards, 'coach', -1, ['mantra']))).toEqual(['coach', 'mantra', 'menu']);
    expect(onIds(moveCard(cards, 'menu', 1, ['mantra']))).toEqual(['coach', 'mantra', 'menu']);
  });

  it('cleans a damaged list from sync before it changes anything', () => {
    const cards = toggleCard([{ id: 'coach', on: true }, { id: 'menu', on: true }, { id: 'coach', on: false }, { id: 'nope', on: true }], 'weight');
    expect(cards.map((c) => c.id)).toEqual(['coach', 'menu', 'weight', 'waterWalk', 'abhyas', 'sleep', 'steps', 'climb', 'mantra']);
    expect(onIds(cards)).toEqual(['coach', 'menu', 'weight']);
    expect(toggleCard('x', 'coach')).toEqual(DEFAULT_TODAY_CARDS.map((c) => (c.id === 'coach' ? { ...c, on: false } : c)));
  });

  it('lists the cards on and off for the page, the day\'s line only while it is switched on in Settings', () => {
    const cards = toggleCard(DEFAULT_TODAY_CARDS, 'mantra');
    expect(cardsShown(cards, true).on.map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk', 'abhyas', 'mantra']);
    expect(cardsShown(cards, false).on.map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk', 'abhyas']);
    expect(cardsShown(DEFAULT_TODAY_CARDS, true).off.map((c) => c.id)).toEqual(['weight', 'sleep', 'steps', 'climb', 'mantra']);
    expect(cardsShown(DEFAULT_TODAY_CARDS, false).off.map((c) => c.id)).toEqual(['weight', 'sleep', 'steps', 'climb']);
  });

  it('after a move says the card\'s new place among those shown, and which of its buttons keeps the focus', () => {
    const cards = moveCard(DEFAULT_TODAY_CARDS, 'waterWalk', -1);
    // Moved up to the middle: up is still there, so the focus stays on it.
    expect(afterMove(cards, 'waterWalk', -1, true)).toEqual({ n: 2, m: 4, focus: 'up' });
    // Moved up to the top: up is gone there, so the focus goes to its down button.
    expect(afterMove(moveCard(cards, 'waterWalk', -1), 'waterWalk', -1, true)).toEqual({ n: 1, m: 4, focus: 'down' });
    // Moved down to the bottom: down is gone, so up.
    expect(afterMove(moveCard(DEFAULT_TODAY_CARDS, 'waterWalk', 1), 'waterWalk', 1, true)).toEqual({ n: 4, m: 4, focus: 'up' });
    expect(afterMove(moveCard(DEFAULT_TODAY_CARDS, 'menu', 1), 'menu', 1, true)).toEqual({ n: 2, m: 4, focus: 'down' });
    // The day's line, on but not shown, is not counted.
    const withLine = [
      { id: 'menu' as const, on: true },
      { id: 'mantra' as const, on: true },
      { id: 'coach' as const, on: true },
    ];
    expect(afterMove(withLine, 'coach', 1, false)).toEqual({ n: 2, m: 2, focus: 'up' });
    expect(afterMove(withLine, 'coach', 1, true)).toEqual({ n: 3, m: 3, focus: 'up' });
    // A card that is off or gone has no place.
    expect(afterMove(DEFAULT_TODAY_CARDS, 'climb', 1, true)).toBeNull();
  });

  it('resets to the default tabs and cards, as copies', () => {
    const d = defaultCustomize();
    expect(d).toEqual({ tabs: ['progress'], todayCards: DEFAULT_TODAY_CARDS });
    d.todayCards[0].on = false;
    expect(DEFAULT_TODAY_CARDS[0].on).toBe(true);
  });
});
