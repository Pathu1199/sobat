/// <reference types="node" />
// The route-file checks read src/app from disk, so this test (and only this one) uses Node's types.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import { addSlot, barItems, extraItem, goalLine, hrefOf, meRows, routeAt, viewedDate } from '../bar';
import { firstName } from '../todayLayout';
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

  it('offers Abhyas as a tab with the book icon and its name', () => {
    expect(barItems(['progress', 'abhyas']).map((i) => i.key)).toEqual(['today', 'progress', 'add', 'abhyas', 'me']);
    expect(extraItem('abhyas')).toEqual({ key: 'abhyas', route: 'abhyas', icon: 'book-outline', labelKey: 'abhyas' });
    expect(makeT('mr')(extraItem('abhyas').labelKey)).toBe('अभ्यास');
  });

  it('a bad value from sync can never hide Today, ➕ or Me, nor show more than two extras', () => {
    expect(barItems('progress').map((i) => i.key)).toEqual(['today', 'add', 'progress', 'me']);
    expect(barItems(['me', 'today', 'body', 'coach', 'sleep']).map((i) => i.key)).toEqual(['today', 'body', 'add', 'coach', 'me']);
  });

  it('➕ sits over the empty slot in the middle of the tab list: its place and how many slots there are', () => {
    expect(addSlot(barItems(['progress']))).toEqual({ index: 1, count: 4 });
    expect(addSlot(barItems([]))).toEqual({ index: 1, count: 3 });
    expect(addSlot(barItems(['progress', 'coach']))).toEqual({ index: 2, count: 5 });
  });

  it('gives each extra tab its item for Customize, the same the bar shows', () => {
    for (const id of TAB_IDS) expect(barItems([id])).toContainEqual(extraItem(id));
    expect(extraItem('sleep')).toMatchObject({ key: 'sleep', route: 'sleep-tab', labelKey: 'sleep_title' });
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
    expect(meRows([]).map((r) => r.key)).toEqual(['coach', 'progress', 'body', 'plan', 'abhyas', 'saved', 'grocery', 'recipes', 'customize', 'chapter', 'settings', 'guide']);
    expect(meRows(['progress']).map((r) => r.key)).toEqual(['coach', 'body', 'plan', 'abhyas', 'saved', 'grocery', 'recipes', 'customize', 'chapter', 'settings', 'guide']);
  });

  it('has an Abhyas row above Saved meals to the Abhyas page, whether or not Abhyas is on the bar', () => {
    for (const tabs of [[], ['abhyas'], ['progress', 'abhyas']]) {
      const rows = meRows(tabs);
      expect(rows.find((r) => r.key === 'abhyas')).toEqual({ key: 'abhyas', icon: 'book-outline', labelKey: 'abhyas', href: '/abhyas' });
      expect(rows.findIndex((r) => r.key === 'abhyas')).toBe(rows.findIndex((r) => r.key === 'saved') - 1);
    }
  });

  it('has a Customize row before Settings, to the tabs and the cards on Today', () => {
    expect(meRows([]).find((r) => r.key === 'customize')).toMatchObject({ labelKey: 'me_customize', subKey: 'me_customize_sub', href: '/customize' });
  });

  it('every row goes somewhere: a page, or a sheet', () => {
    for (const r of meRows([])) expect(Boolean(r.href) !== Boolean(r.sheet)).toBe(true);
  });

  it('has a "Start a new chapter" row that opens its sheet on Me, never a page', () => {
    expect(meRows([]).find((r) => r.key === 'chapter')).toEqual({ key: 'chapter', icon: 'flag-outline', labelKey: 'me_chapter', subKey: 'me_chapter_sub', sheet: 'chapter' });
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

describe("Me's header", () => {
  it('greets by the first word of the name, whatever the spacing, and falls back when there is no name', () => {
    expect(firstName('Varad Shinde')).toBe('Varad');
    expect(firstName('  वरद   शिंदे ')).toBe('वरद');
    expect(firstName('Varad')).toBe('Varad');
    expect(firstName('')).toBeNull();
    expect(firstName('   ')).toBeNull();
  });

  it('says the goal and the weekly pace in each language, without a needless ".0", the pace to its quarter kilo', () => {
    const profile = { goalWeightKg: 80, rateKgPerWeek: 0.5 };
    expect(goalLine(profile, makeT('en'))).toBe('Goal 80 kg · 0.5 a week');
    expect(goalLine(profile, makeT('mr'))).toBe('लक्ष्य 80 किलो · आठवड्याला 0.5');
    expect(goalLine(profile, makeT('hi'))).toBe('लक्ष्य 80 किलो · हफ़्ते में 0.5');
    expect(goalLine({ goalWeightKg: 72.5, rateKgPerWeek: 1 }, makeT('en'))).toBe('Goal 72.5 kg · 1 a week');
    expect(goalLine({ goalWeightKg: 68.04, rateKgPerWeek: 0.25 }, makeT('en'))).toBe('Goal 68 kg · 0.25 a week');
    expect(goalLine({ goalWeightKg: 90, rateKgPerWeek: 0.75 }, makeT('mr'))).toBe('लक्ष्य 90 किलो · आठवड्याला 0.75');
  });
});
