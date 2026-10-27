import React, { useState } from 'react';
import { AccessibilityInfo, Platform, Text, View, type ViewStyle } from 'react-native';

// On the page for a screen reader, off it for the eye.
const OFF_SCREEN: ViewStyle = { position: 'absolute', left: -10000, top: 0, width: 1, height: 1, overflow: 'hidden' };

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

  function announce(text: string) {
    if (Platform.OS === 'web') setSaid((s) => ({ text, n: s.n + 1 }));
    else if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
    else AccessibilityInfo.announceForAccessibility(text);
  }

  // A new line each time, so the same words said twice are read twice.
  const region =
    Platform.OS === 'web' ? (
      <View aria-live="polite" style={OFF_SCREEN}>
        <Text key={said.n}>{said.text}</Text>
      </View>
    ) : null;
  return { announce, region };
}
