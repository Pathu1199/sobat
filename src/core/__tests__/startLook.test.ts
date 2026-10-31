import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE_IDS } from '../palette';
import { PALETTE_SETS } from '../../ui/theme';
import { appearanceOf, isDarkLook, LOOK_KEY, lookOf, readLook, START_BG, startBackground, startScript, writeLook, type Look } from '../startLook';

describe('START_BG', () => {
  it('is the theme’s own page colour for every palette in light and dark, so the first frame matches the app', () => {
    for (const id of PALETTE_IDS) {
      expect(START_BG[id].light, `${id} light`).toBe(PALETTE_SETS[id].light.bg);
      expect(START_BG[id].dark, `${id} dark`).toBe(PALETTE_SETS[id].dark.bg);
    }
  });

  it('is what app.json’s splash shows for the default look, light and dark', () => {
    const splash = (JSON.parse(readFileSync('app.json', 'utf8')) as { expo: { plugins: unknown[] } }).expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === 'expo-splash-screen',
    ) as [string, { backgroundColor: string; dark: { backgroundColor: string } }];
    expect(splash[1].backgroundColor).toBe(START_BG.emerald.light);
    expect(splash[1].dark.backgroundColor).toBe(START_BG.emerald.dark);
  });

  it('keeps the notification colour and the primary colour the default palette’s daylight action colour', () => {
    const expo = (JSON.parse(readFileSync('app.json', 'utf8')) as { expo: { plugins: unknown[]; primaryColor: string } }).expo;
    const notifications = expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-notifications') as [string, { color: string }];
    expect(notifications[1].color).toBe(PALETTE_SETS.emerald.light.accent);
    expect(expo.primaryColor).toBe(PALETTE_SETS.emerald.light.accent);
  });
});

describe('lookOf', () => {
  it('reads a stored look back', () => {
    expect(lookOf('{"appearance":"dark","palette":"indigo"}')).toEqual({ appearance: 'dark', palette: 'indigo' });
    expect(lookOf('{"appearance":"light","palette":"saffron"}')).toEqual({ appearance: 'light', palette: 'saffron' });
  });

  it('reads nothing as null, and an unknown value in either field as the default (the phone’s setting, emerald)', () => {
    for (const raw of [null, undefined, '', 'not json', '3', 'null', '"indigo"']) expect(lookOf(raw), String(raw)).toBeNull();
    expect(lookOf('{"appearance":"sepia","palette":"rose"}')).toEqual({ appearance: 'system', palette: 'emerald' });
    expect(lookOf('{}')).toEqual({ appearance: 'system', palette: 'emerald' });
  });

  it('normalises appearance the way the setting does', () => {
    expect(appearanceOf('light')).toBe('light');
    expect(appearanceOf('dark')).toBe('dark');
    for (const v of ['system', 'x', undefined, null, 1]) expect(appearanceOf(v)).toBe('system');
  });
});

describe('startBackground', () => {
  it('follows the phone only when the setting is system', () => {
    const sys: Look = { appearance: 'system', palette: 'indigo' };
    expect(startBackground(sys, true)).toBe(START_BG.indigo.dark);
    expect(startBackground(sys, false)).toBe(START_BG.indigo.light);
    expect(startBackground({ appearance: 'dark', palette: 'saffron' }, false)).toBe(START_BG.saffron.dark);
    expect(startBackground({ appearance: 'light', palette: 'saffron' }, true)).toBe(START_BG.saffron.light);
    expect(isDarkLook({ appearance: 'light', palette: 'emerald' }, true)).toBe(false);
  });
});

describe('the copy in storage', () => {
  function fake(initial?: string) {
    const data = new Map<string, string>();
    if (initial !== undefined) data.set(LOOK_KEY, initial);
    return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  }

  it('is written and read back whole', () => {
    const s = fake();
    writeLook(s, { appearance: 'dark', palette: 'saffron' });
    expect(readLook(s)).toEqual({ appearance: 'dark', palette: 'saffron' });
  });

  it('reads and writes nothing, quietly, when storage is missing or blocked', () => {
    expect(readLook(null)).toBeNull();
    expect(readLook(undefined)).toBeNull();
    writeLook(null, { appearance: 'dark', palette: 'indigo' });
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readLook(blocked)).toBeNull();
    expect(() => writeLook(blocked, { appearance: 'dark', palette: 'indigo' })).not.toThrow();
  });
});

describe('startScript', () => {
  /** Runs the inline script against a fake page; returns what it set. */
  function run(raw: string | null, systemDark: boolean) {
    const vars: Record<string, string> = {};
    const root = { style: { colorScheme: '', setProperty: (k: string, v: string) => void (vars[k] = v) } };
    const metas = [{ v: '', setAttribute(_: string, c: string) { this.v = c; } }, { v: '', setAttribute(_: string, c: string) { this.v = c; } }];
    const doc = { documentElement: root, querySelectorAll: () => metas };
    const win = { matchMedia: () => ({ matches: systemDark }) };
    const storage = { getItem: () => raw };
    new Function('localStorage', 'document', 'window', startScript())(storage, doc, win);
    return { bg: vars['--dhyey-bg'], scheme: root.style.colorScheme, themeColors: metas.map((m) => m.v) };
  }

  it('sets the page colour, the browser’s scheme and both theme-color tags for the stored look, in all three palettes, light and dark', () => {
    for (const id of PALETTE_IDS) {
      for (const appearance of ['light', 'dark'] as const) {
        const got = run(JSON.stringify({ appearance, palette: id }), appearance === 'light');
        expect(got.bg, `${id} ${appearance}`).toBe(START_BG[id][appearance]);
        expect(got.scheme).toBe(appearance);
        expect(got.themeColors).toEqual([START_BG[id][appearance], START_BG[id][appearance]]);
      }
    }
  });

  it('follows the phone when the setting is system, and when it is unreadable', () => {
    expect(run('{"appearance":"system","palette":"indigo"}', true).bg).toBe(START_BG.indigo.dark);
    expect(run('{"appearance":"system","palette":"indigo"}', false).bg).toBe(START_BG.indigo.light);
    expect(run('{"appearance":"sepia","palette":"indigo"}', true).bg).toBe(START_BG.indigo.dark);
  });

  it('falls back to emerald for a palette it does not know, including names that exist on every object', () => {
    for (const palette of ['rose', 'constructor', '__proto__', 'toString']) {
      expect(run(JSON.stringify({ appearance: 'dark', palette }), true).bg, palette).toBe(START_BG.emerald.dark);
    }
  });

  it('does nothing when there is no copy or it is damaged, so the page’s own CSS colours stand', () => {
    for (const raw of [null, '', 'not json', 'null', '7']) {
      const got = run(raw, true);
      expect(got.bg, String(raw)).toBeUndefined();
      expect(got.themeColors).toEqual(['', '']);
    }
  });

  it('reads the same key the app writes', () => {
    expect(startScript()).toContain(JSON.stringify(LOOK_KEY));
  });
});
