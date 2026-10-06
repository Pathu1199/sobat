import { ScrollViewStyleReset } from 'expo-router/html';
import React, { type PropsWithChildren } from 'react';

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
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="description" content="A local-first health companion. Food, sleep, movement and mind, with the AI on your own PC." />
        <meta name="theme-color" content="#07090F" />
        <meta name="color-scheme" content="dark" />
        {/* Pinned to an iPhone home screen: this icon and name, and no Safari chrome around the app. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Sobat" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html, body { background: #07090F; }' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
