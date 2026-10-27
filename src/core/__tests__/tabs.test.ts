import { describe, expect, it } from 'vitest';
import { DEFAULT_TODAY_CARDS, normalizeTabs, normalizeTodayCards, TODAY_CARD_IDS } from '../tabs';

describe('normalizeTabs', () => {
  it('keeps known tabs in the order chosen, and an empty choice', () => {
    expect(normalizeTabs(['coach', 'progress'])).toEqual(['coach', 'progress']);
    expect(normalizeTabs([])).toEqual([]);
  });

  it('drops unknown ids and duplicates, so a bad value from sync cannot hide the fixed tabs', () => {
    expect(normalizeTabs(['today', 'coach', 'me', 'coach', 42, null])).toEqual(['coach']);
  });

  it('keeps at most two', () => {
    expect(normalizeTabs(['progress', 'coach', 'body', 'sleep'])).toEqual(['progress', 'coach']);
  });

  it('gives the default to anything that is not a list', () => {
    expect(normalizeTabs(undefined)).toEqual(['progress']);
    expect(normalizeTabs('progress')).toEqual(['progress']);
  });
});

describe('DEFAULT_TODAY_CARDS', () => {
  it('has the menu, the coach line and water and walk on, in that order, and every other card off', () => {
    expect(DEFAULT_TODAY_CARDS.map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk', 'weight', 'sleep', 'steps', 'climb', 'mantra']);
    expect(DEFAULT_TODAY_CARDS.filter((c) => c.on).map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk']);
  });
});

describe('normalizeTodayCards', () => {
  const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

  it('keeps every known card once, in the order stored, with each switch as it was', () => {
    const stored = [...DEFAULT_TODAY_CARDS].reverse().map((c, i) => ({ id: c.id, on: i % 2 === 0 }));
    expect(normalizeTodayCards(stored)).toEqual(stored);
  });

  it('drops unknown ids and a second copy of a card; the first copy stays where it was', () => {
    const out = normalizeTodayCards([{ id: 'sleep', on: true }, { id: 'today', on: true }, { id: 'menu', on: true }, { id: 'sleep', on: false }, { id: 42, on: true }, null, 'coach']);
    expect(out.slice(0, 2)).toEqual([{ id: 'sleep', on: true }, { id: 'menu', on: true }]);
    expect(ids(out)).not.toContain('today');
    expect(ids(out).filter((id) => id === 'sleep')).toHaveLength(1);
  });

  it('adds every known card missing from the list at the end, switched off, so a card added in an update never appears on its own', () => {
    const out = normalizeTodayCards([{ id: 'mantra', on: true }, { id: 'menu', on: true }]);
    expect(ids(out)).toEqual(['mantra', 'menu', 'coach', 'waterWalk', 'weight', 'sleep', 'steps', 'climb']);
    expect(out.filter((c) => c.on).map((c) => c.id)).toEqual(['mantra', 'menu']);
    expect([...ids(out)].sort()).toEqual([...TODAY_CARD_IDS].sort());
  });

  it('reads a switch that is not true or false as off', () => {
    const out = normalizeTodayCards([{ id: 'menu', on: 'yes' }, { id: 'coach', on: 1 }, { id: 'waterWalk' }, { id: 'weight', on: true }]);
    expect(out.slice(0, 4)).toEqual([{ id: 'menu', on: false }, { id: 'coach', on: false }, { id: 'waterWalk', on: false }, { id: 'weight', on: true }]);
    for (const c of out) expect(typeof c.on).toBe('boolean');
  });

  it('gives the default cards to anything that is not a list, as copies', () => {
    for (const bad of [undefined, null, 'menu', 7, { menu: true }]) expect(normalizeTodayCards(bad)).toEqual(DEFAULT_TODAY_CARDS);
    const out = normalizeTodayCards(undefined);
    expect(out[0]).not.toBe(DEFAULT_TODAY_CARDS[0]);
  });

  it('keeps nothing of the list it was given: changing the result never changes the stored cards', () => {
    const stored = [{ id: 'menu', on: true }];
    normalizeTodayCards(stored)[0].on = false;
    expect(stored[0].on).toBe(true);
  });
});
