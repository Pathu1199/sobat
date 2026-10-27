import { describe, expect, it } from 'vitest';
import { handOff, logLinkStep, webHandOff } from '../logLink';

describe('logLinkStep', () => {
  it('a new link opens the sheet', () => {
    expect(logLinkStep({ date: '2026-10-27' }, new WeakSet(), true)).toBe('open');
  });

  it('a link already handled steps back past /log instead of opening the sheet again', () => {
    const link = { date: '2026-10-27' };
    expect(logLinkStep(link, new WeakSet([link]), true)).toBe('back');
  });

  it('a link already handled with nothing behind /log leaves it for Today', () => {
    const link = {};
    expect(logLinkStep(link, new WeakSet([link]), false)).toBe('leave');
  });

  it('the same address followed again is a new link, though its words are the same', () => {
    const first = { slot: 'lunch' };
    expect(logLinkStep({ slot: 'lunch' }, new WeakSet([first]), true)).toBe('open');
  });
});

const tabs = (history: string[], index = 2) => ({
  key: 'tab-1',
  index,
  routes: [
    { key: 'index-1', name: 'index', params: { date: '2026-10-20' } },
    { key: 'me-1', name: 'me' },
    { key: 'log-1', name: 'log', params: { slot: 'lunch' } },
  ],
  history: history.map((key) => ({ type: 'route', key })),
});
const keys = (s: { history?: { key: string }[] }) => (s.history ?? []).map((h) => h.key);

describe('handOff', () => {
  it('puts Today in front for the day and takes /log off the way back, so Back goes where the person was before the link', () => {
    const s = handOff(tabs(['me-1', 'index-1', 'log-1']), 'log-1', 'index', { date: '2026-10-25' });
    expect(s.index).toBe(0);
    expect(s.routes[0].params).toEqual({ date: '2026-10-25' });
    expect(keys(s)).toEqual(['me-1', 'index-1']);
  });

  it('opened by a link with nothing before it, Today is all there is to go back from', () => {
    expect(keys(handOff(tabs(['log-1']), 'log-1', 'index', {}))).toEqual(['index-1']);
  });

  it('Today seen before the link is not kept twice, and the other tabs are left as they were', () => {
    const before = tabs(['index-1', 'me-1', 'log-1']);
    const s = handOff(before, 'log-1', 'index', {});
    expect(keys(s)).toEqual(['me-1', 'index-1']);
    expect(s.routes[1]).toBe(before.routes[1]);
    expect(s.routes[2]).toBe(before.routes[2]);
    expect(s.key).toBe('tab-1');
  });

  it('without new words for Today, Today keeps the day it was showing', () => {
    expect(handOff(tabs(['log-1']), 'log-1', 'index').routes[0].params).toEqual({ date: '2026-10-20' });
  });

  it('a navigator with no Today is left as it is', () => {
    const s = tabs(['log-1']);
    expect(handOff(s, 'log-1', 'home', {})).toBe(s);
  });
});

describe('webHandOff', () => {
  it('a /log loaded on its own, alone in the way back, hands over with the reset: the same length, so the browser replaces its entry', () => {
    expect(webHandOff(tabs(['log-1']), 'log-1', 'index')).toBe('reset');
    expect(keys(handOff(tabs(['log-1']), 'log-1', 'index'))).toHaveLength(1);
  });

  it('arriving from Today, the reset steps the browser back onto Today\'s own entry, so Today is never there twice', () => {
    expect(webHandOff(tabs(['me-1', 'index-1', 'log-1']), 'log-1', 'index')).toBe('reset');
  });

  it('with another page right behind /log, a replace, so the browser keeps that page and Today follows it', () => {
    expect(webHandOff(tabs(['me-1', 'log-1']), 'log-1', 'index')).toBe('replace');
    // Today seen earlier is not right behind /log: a reset would step the browser back past the page in between.
    expect(webHandOff(tabs(['index-1', 'me-1', 'log-1']), 'log-1', 'index')).toBe('replace');
  });

  it('a navigator with no way back of its own, or no Today, is handed over with a replace', () => {
    const { history: _h, ...plain } = tabs(['log-1']);
    expect(webHandOff(plain, 'log-1', 'index')).toBe('replace');
    expect(webHandOff(tabs(['log-1']), 'log-1', 'home')).toBe('replace');
  });
});
