/// <reference types="node" />
// The route-file checks read src/app from disk, so this test (and only this one) uses Node's types.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { barItems, hrefOf, isIsoDate, meRows, routeAt, sectionFromLink, viewedDate } from '../bar';
import { TAB_IDS } from '../tabs';

/** The screens expo-router can open: the files under src/app and under src/app/(tabs), by name without the extension. */
function screens(dir: string): string[] {
  return readdirSync(fileURLToPath(new URL(dir, import.meta.url)))
    .filter((f) => f.endsWith('.tsx') && !f.startsWith('_') && !f.startsWith('+'))
    .map((f) => f.replace(/\.tsx$/, ''));
}
const TAB_SCREENS = screens('../../app/(tabs)/');
const STACK_SCREENS = screens('../../app/');

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

  it('every tab the bar can show has its screen file under src/app/(tabs)', () => {
    expect(TAB_SCREENS).toContain('index');
    for (const id of TAB_IDS) {
      for (const item of barItems([id])) {
        if (item.route !== null) expect(TAB_SCREENS).toContain(item.route);
      }
    }
  });
});

describe('the addresses of the tabs', () => {
  it('Today is the root address, every other tab its own name', () => {
    expect(hrefOf('index')).toBe('/');
    expect(hrefOf('progress')).toBe('/progress');
    expect(routeAt('/')).toBe('index');
    expect(routeAt('/sleep-tab')).toBe('sleep-tab');
  });
});

describe('isIsoDate', () => {
  it('takes a date written YYYY-MM-DD and nothing else', () => {
    expect(isIsoDate('2026-10-27')).toBe(true);
    expect(isIsoDate('2026-10-7')).toBe(false);
    expect(isIsoDate('27-10-2026')).toBe(false);
    expect(isIsoDate(['2026-10-27'])).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe('viewedDate: the day ➕ adds to', () => {
  it('is the date Today shows while Today is in front', () => {
    expect(viewedDate({ name: 'index', params: { date: '2026-10-25' } })).toBe('2026-10-25');
  });

  it('is undefined while Today shows today, or holds something that is not a date', () => {
    expect(viewedDate({ name: 'index' })).toBeUndefined();
    expect(viewedDate({ name: 'index', params: {} })).toBeUndefined();
    expect(viewedDate({ name: 'index', params: { date: 'yesterday' } })).toBeUndefined();
  });

  it('is undefined while another tab is in front, even one that carries a ?date=', () => {
    expect(viewedDate({ name: 'progress', params: { date: '2026-10-25' } })).toBeUndefined();
    expect(viewedDate({ name: 'me' })).toBeUndefined();
    expect(viewedDate(undefined)).toBeUndefined();
  });
});

describe('meRows', () => {
  it('lists the pages in a plain order, with Progress while it is not a tab', () => {
    expect(meRows([]).map((r) => r.key)).toEqual(['coach', 'progress', 'body', 'plan', 'saved', 'grocery', 'recipes', 'settings', 'guide']);
    expect(meRows(['progress']).map((r) => r.key)).toEqual(['coach', 'body', 'plan', 'saved', 'grocery', 'recipes', 'settings', 'guide']);
  });

  it('every row goes somewhere: a page, or a sheet', () => {
    for (const r of meRows([])) expect(Boolean(r.href) !== Boolean(r.sheet)).toBe(true);
  });

  it('the grocery list opens as a sheet, and Recipes is its own row to the recipes on Food', () => {
    const rows = meRows([]);
    expect(rows.find((r) => r.key === 'grocery')).toMatchObject({ labelKey: 'grocery_title', sheet: 'grocery' });
    expect(rows.find((r) => r.key === 'recipes')).toMatchObject({ labelKey: 'recipes', href: '/food?s=recipes' });
    expect(rows.find((r) => r.key === 'saved')).toMatchObject({ sheet: 'savedMeals' });
  });

  it('every page a row opens has its screen file', () => {
    for (const r of meRows([])) {
      if (!r.href) continue;
      const name = r.href.slice(1).split('?')[0];
      expect([...TAB_SCREENS, ...STACK_SCREENS]).toContain(name);
    }
  });
});

describe('sectionFromLink: what a ?s= link opens', () => {
  const SECTIONS = ['plan', 'foods', 'recipes', 'history'] as const;

  it('opens the section only when the link changes, so a link left in the address never overrides a pick by hand', () => {
    // A cold load of /food?s=history opens History from the start; the same param seen again changes nothing.
    expect(sectionFromLink(SECTIONS, 'history', 'history')).toBeNull();
    // A new link opens its section, even the one opened before once the param was cleared.
    expect(sectionFromLink(SECTIONS, 'recipes', 'history')).toBe('recipes');
    expect(sectionFromLink(SECTIONS, 'history', undefined)).toBe('history');
    // Clearing the param, or a name that is not a section, changes nothing.
    expect(sectionFromLink(SECTIONS, undefined, 'history')).toBeNull();
    expect(sectionFromLink(SECTIONS, 'nonsense', undefined)).toBeNull();
    expect(sectionFromLink(SECTIONS, ['plan'], undefined)).toBeNull();
  });
});
