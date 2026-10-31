/**
 * The look the web page opens in. The store (the user's palette and light or
 * dark choice) loads after the page has painted, so the first frame would
 * show the default look and then jump. The app therefore keeps a copy of the
 * two choices in the browser's own storage; an inline script in the page's
 * head (src/app/+html.tsx) and the first render of the theme (_layout.tsx)
 * read it, so a user on Indigo or Saffron sees their colours from the first
 * frame. Pure: storage and the phone's light or dark setting are passed in.
 */
import { DEFAULT_PALETTE, paletteOf, type PaletteId } from './palette';

/** Where the copy lives in the browser's storage. */
export const LOOK_KEY = 'dhyey.look';

export type Appearance = 'system' | 'light' | 'dark';

export type Look = { appearance: Appearance; palette: PaletteId };

/**
 * The page colour of every palette in light and dark: what the page shows
 * before the app's own theme (src/ui/theme.ts) can. A test holds each to the
 * theme's `bg`, so a colour changed there cannot be left behind here.
 */
export const START_BG: Record<PaletteId, { light: string; dark: string }> = {
  emerald: { light: '#F3F7F6', dark: '#0B1014' },
  indigo: { light: '#F4F5FB', dark: '#0D0F1A' },
  saffron: { light: '#F8F5EF', dark: '#12100B' },
};

/** A stored choice as the app reads it: one of the three, anything else the phone's own setting. */
export function appearanceOf(v: unknown): Appearance {
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** The copy as stored; null when there is none or it cannot be read, and then the default look stands. */
export function lookOf(raw: string | null | undefined): Look | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const o = v as { appearance?: unknown; palette?: unknown };
    return { appearance: appearanceOf(o.appearance), palette: paletteOf(o.palette) };
  } catch {
    return null;
  }
}

/** Whether a look is dark, given whether the phone is. */
export function isDarkLook(look: Look, systemDark: boolean): boolean {
  return look.appearance === 'dark' || (look.appearance === 'system' && systemDark);
}

/** The page colour a look opens in. */
export function startBackground(look: Look, systemDark: boolean): string {
  return START_BG[look.palette][isDarkLook(look, systemDark) ? 'dark' : 'light'];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The look kept in storage; null when storage is missing, blocked (a private window) or holds nothing usable. */
export function readLook(storage: Pick<Storage, 'getItem'> | null | undefined): Look | null {
  if (!storage) return null;
  try {
    return lookOf(storage.getItem(LOOK_KEY));
  } catch {
    return null;
  }
}

/** Keep the two choices for the next time the page opens. A blocked or full storage is skipped: the look then loads with the store, as it did. */
export function writeLook(storage: StorageLike | null | undefined, look: Look): void {
  if (!storage) return;
  try {
    storage.setItem(LOOK_KEY, JSON.stringify({ appearance: look.appearance, palette: look.palette }));
  } catch {
    // Nothing to do: the copy is only there to save a frame.
  }
}

/**
 * The script run in the page's head, before anything paints: reads the copy
 * and sets the page colour (as the `--dhyey-bg` variable the page's CSS reads),
 * the browser's own light or dark and both theme-color tags. It does nothing
 * when there is no copy, so the CSS defaults stand. Plain ES5 on purpose: it
 * is inlined as text and must not depend on how the app is built.
 */
export function startScript(): string {
  return `(function(){try{
var BG=${JSON.stringify(START_BG)};
var raw=localStorage.getItem(${JSON.stringify(LOOK_KEY)});
var l=raw?JSON.parse(raw):null;
if(!l||typeof l!=='object')return;
var has=Object.prototype.hasOwnProperty;
var p=BG[has.call(BG,l.palette)?l.palette:${JSON.stringify(DEFAULT_PALETTE)}];
var dark=l.appearance==='dark'||(l.appearance!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var c=dark?p.dark:p.light;
var r=document.documentElement;
r.style.setProperty('--dhyey-bg',c);
r.style.colorScheme=dark?'dark':'light';
var m=document.querySelectorAll('meta[name="theme-color"]');
for(var i=0;i<m.length;i++)m[i].setAttribute('content',c);
}catch(e){}})();`;
}
