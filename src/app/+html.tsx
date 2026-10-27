import { ScrollViewStyleReset } from 'expo-router/html';
import React, { type PropsWithChildren } from 'react';

/**
 * Make the page behave like an app rather than a document: no bounce at the
 * edges, no text selection or long-press callouts on controls, no tap
 * highlight, and inputs at 16px so iOS does not zoom into them. Pinch zoom is
 * left alone: anyone can enlarge the page.
 *
 * Text uses the phone's own font: the system face, Roboto on Android, and
 * Noto Sans Devanagari for Marathi and Hindi where the system face has none.
 * Icons set their own font inline and are left alone.
 */
const APP_CSS = `
#root div[dir="auto"]:not([style*="font-family"]), #root input, #root textarea, #root button { font-family: system-ui, Roboto, "Noto Sans Devanagari", sans-serif; }
html, body { background: #F2F6F7; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
@media (prefers-color-scheme: dark) { html, body { background: #0B1014; } }
body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-text-size-adjust: 100%; }
input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; font-size: 16px !important; }
`;

/**
 * The HTML shell around every statically rendered page. It carries what a
 * browser needs before the app loads: the iPhone home-screen icon and title,
 * the web-app manifest, and the phone's light or dark background so there is
 * no flash. The app then sets the language and the chosen look (_layout.tsx).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="Roz thoda, fit sada. A local-first health companion. Food, sleep, movement and mind, with the AI on your own PC." />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F2F6F7" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B1014" />
        <meta name="color-scheme" content="light dark" />
        {/* Pinned to an iPhone home screen: this icon and name, and no Safari chrome around the app. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Sobat" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: APP_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
