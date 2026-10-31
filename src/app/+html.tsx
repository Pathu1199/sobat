import { ScrollViewStyleReset } from 'expo-router/html';
import React, { type PropsWithChildren } from 'react';
import { START_BG, startScript } from '../core/startLook';

/**
 * Make the page behave like an app rather than a document: no bounce at the
 * edges, no text selection or long-press callouts on controls, no tap
 * highlight, and inputs at 16px so iOS does not zoom into them. Pinch zoom is
 * left alone: anyone can enlarge the page.
 *
 * Text uses the phone's own font: the system face, Roboto on Android, and
 * Noto Sans Devanagari for Marathi and Hindi where the system face has none.
 * Icons set their own font inline and are left alone.
 *
 * The page colour is the default look's (daylight, or dark on a dark phone)
 * until the start script, run in the head, finds the user's own look in the
 * browser's storage and sets `--dhyey-bg` (core/startLook.ts).
 */
const APP_CSS = `
#root div[dir="auto"]:not([style*="font-family"]), #root input, #root textarea, #root button { font-family: system-ui, Roboto, "Noto Sans Devanagari", sans-serif; }
html, body { background: var(--dhyey-bg, ${START_BG.emerald.light}); overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
@media (prefers-color-scheme: dark) { html, body { background: var(--dhyey-bg, ${START_BG.emerald.dark}); } }
body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-text-size-adjust: 100%; }
input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; font-size: 16px !important; }
`;

/**
 * The HTML shell around every statically rendered page. It carries what a
 * browser needs before the app loads: the iPhone home-screen icon and title,
 * the web-app manifest, and the background of the user's own look (their
 * palette, light or dark) so there is no flash. The app then sets the
 * language and the chosen look (_layout.tsx).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Roz thoda, fit sada. A local-first health companion. Food, sleep, movement and mind, with the AI on your own PC." />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content={START_BG.emerald.light} />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={START_BG.emerald.dark} />
        <meta name="color-scheme" content="light dark" />
        {/* Pinned to an iPhone home screen: this icon and name, no Safari chrome around the app, and the normal status bar, not a black band above a light page. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Dhyey" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: APP_CSS }} />
        {/* After the theme-color tags it updates, before anything paints. */}
        <script dangerouslySetInnerHTML={{ __html: startScript() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
