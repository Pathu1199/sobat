import { ScrollViewStyleReset } from 'expo-router/html';
import React, { type PropsWithChildren } from 'react';

/**
 * Make the page behave like an app rather than a document: no bounce at the
 * edges, no text selection or long-press callouts on controls, no tap
 * highlight, and inputs at 16px so iOS does not zoom into them.
 */
const APP_CSS = `
@font-face { font-family: 'Mukta'; font-weight: 400; font-display: swap; src: url('/fonts/Mukta_400Regular.woff2') format('woff2'); }
@font-face { font-family: 'Mukta'; font-weight: 500; font-display: swap; src: url('/fonts/Mukta_500Medium.woff2') format('woff2'); }
@font-face { font-family: 'Mukta'; font-weight: 600; font-display: swap; src: url('/fonts/Mukta_600SemiBold.woff2') format('woff2'); }
/* Mukta carries Devanagari and Latin in one design. Icons set their own font inline and are left alone. */
#root div[dir="auto"]:not([style*="font-family"]), #root input, #root textarea, #root button { font-family: 'Mukta', -apple-system, 'Segoe UI', Roboto, sans-serif; }
html, body { background: #0A0B10; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-text-size-adjust: 100%; touch-action: pan-x pan-y; }
input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; font-size: 16px !important; }
`;

const NO_ZOOM_JS = `
document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
`;

/**
 * The HTML shell around every statically rendered page. It carries what a
 * browser needs before the app loads: the iPhone home-screen icon and title,
 * the web-app manifest, and the dark background so there is no white flash.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* maximum-scale=1 stops iOS zooming the page when a text box is tapped. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="description" content="Roz thoda, fit sada. A local-first health companion. Food, sleep, movement and mind, with the AI on your own PC." />
        <meta name="theme-color" content="#0A0B10" />
        <meta name="color-scheme" content="dark light" />
        {/* Pinned to an iPhone home screen: this icon and name, and no Safari chrome around the app. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Fitoo" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: APP_CSS }} />
        {/* iOS ignores the viewport's zoom lock for pinch gestures; this is the only way to keep the page fixed. */}
        <script dangerouslySetInnerHTML={{ __html: NO_ZOOM_JS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
