import { describe, expect, it } from 'vitest';
import { barItems, meRows } from '../bar';

describe('barItems', () => {
  it('puts ➕ in the middle: Today · ➕ · Progress · Me by default', () => {
    expect(barItems(['progress']).map((i) => i.key)).toEqual(['today', 'add', 'progress', 'me']);
    expect(barItems([]).map((i) => i.key)).toEqual(['today', 'add', 'me']);
    expect(barItems(['progress', 'coach']).map((i) => i.key)).toEqual(['today', 'progress', 'add', 'coach', 'me']);
  });

  it('sends Sleep and Diet plan to their tab routes; ➕ is a button with no route', () => {
    expect(barItems(['sleep', 'plan']).map((i) => i.route)).toEqual(['index', 'sleep-tab', null, 'plan-tab', 'me']);
  });

  it('a bad value from sync can never hide Today, ➕ or Me, nor show more than two extras', () => {
    expect(barItems('progress').map((i) => i.key)).toEqual(['today', 'add', 'progress', 'me']);
    expect(barItems(['me', 'today', 'body', 'coach', 'sleep']).map((i) => i.key)).toEqual(['today', 'body', 'add', 'coach', 'me']);
  });
});

describe('meRows', () => {
  it('lists the pages in a plain order, with Progress while it is not a tab', () => {
    expect(meRows([]).map((r) => r.key)).toEqual(['coach', 'progress', 'body', 'plan', 'saved', 'grocery', 'settings', 'guide']);
    expect(meRows(['progress']).map((r) => r.key)).toEqual(['coach', 'body', 'plan', 'saved', 'grocery', 'settings', 'guide']);
  });

  it('every row goes somewhere: a page, or the saved meals sheet', () => {
    for (const r of meRows([])) expect(Boolean(r.href) !== Boolean(r.sheet)).toBe(true);
  });
});
