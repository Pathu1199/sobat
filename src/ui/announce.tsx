import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Text, View, type ViewStyle } from 'react-native';

/** On the page for a screen reader, off it for the eye. */
export const OFF_SCREEN: ViewStyle = { position: 'absolute', left: -10000, top: 0, width: 1, height: 1, overflow: 'hidden' };

/**
 * Says a line to a screen reader on the phone (iOS after what it is already
 * saying). Nothing on the web, which reads `useAnnounce`'s region instead.
 * Android's TalkBack drops a line said just before the focus moves, so a page
 * that moves the focus says the line after it, from the effect that moved it.
 */
export function sayOnPhone(text: string): void {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  else if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(text);
}

/**
 * Says a line to a screen reader. The phone says it at once (iOS after what it
 * is already saying, so a focus moved at the same moment does not cut it
 * off). The web has no such call: the line goes into a region kept on the
 * page from the start, empty until then, which the browser reads whenever its
 * words appear. Render `region` once, anywhere on the page; it is null on the
 * phone.
 */
export function useAnnounce(): { announce: (text: string) => void; region: React.ReactElement | null } {
  const [said, setSaid] = useState({ text: '', n: 0 });

  // The same function every render, so a callback built on it stays the same too.
  const announce = useCallback((text: string) => {
    if (Platform.OS === 'web') setSaid((s) => ({ text, n: s.n + 1 }));
    else sayOnPhone(text);
  }, []);

  // A new line each time, so the same words said twice are read twice.
  const region =
    Platform.OS === 'web' ? (
      <View aria-live="polite" style={OFF_SCREEN}>
        <Text key={said.n}>{said.text}</Text>
      </View>
    ) : null;
  return { announce, region };
}

/**
 * Whether a screen reader is on, kept up to date as it is switched on or off.
 * False until the phone has answered. The web cannot tell, and react-native-web
 * answers true, so there the app always leaves the time a screen reader needs.
 */
export function useScreenReaderOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (live) setOn(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => setOn(v));
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);
  return on;
}
