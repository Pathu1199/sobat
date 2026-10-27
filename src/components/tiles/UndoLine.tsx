import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, F, lh, S } from '../../ui/theme';
import type { Added } from '../../ui/tileWords';

export { addedText, type Added } from '../../ui/tileWords';

/** How long "Added … · Undo" stays under the tiles. */
export const UNDO_MS = 5000;

/** The last thing a tap added, cleared after five seconds; a new tap replaces it and starts the five seconds again. */
export function useAddedLine(): { added: Added | null; show: (a: Added) => void; clear: () => void } {
  const [added, setAdded] = useState<Added | null>(null);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [added]);
  return { added, show: (a) => setAdded(a), clear: () => setAdded(null) };
}

/** The line under the tiles: what was added, and an Undo a finger wide. No confirm dialogs: a wrong tap is one more tap to put right. */
export function UndoLine({ text, undoLabel, onUndo }: { text: string; undoLabel: string; onUndo: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch }}>
      <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>
        {text}
      </Text>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel={`${undoLabel}: ${text}`}
        style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.accentSoft : C.accentDim })}>
        <Text style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{undoLabel}</Text>
      </Pressable>
    </View>
  );
}
