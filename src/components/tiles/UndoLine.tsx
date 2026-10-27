import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, F, lh, S } from '../../ui/theme';
import type { Added } from '../../ui/tileWords';

export { addedText, type Added } from '../../ui/tileWords';

/** How long "Added … · Undo" stays under the tiles, and "Deleted … · Undo" in a sheet. */
export const UNDO_MS = 5000;

/** What can still be undone, kept for five seconds; a new one replaces it and starts the five seconds again. */
export function useUndoable<T>(): { held: T | null; show: (v: T) => void; clear: () => void } {
  const [held, setHeld] = useState<T | null>(null);
  useEffect(() => {
    if (held === null) return;
    const timer = setTimeout(() => setHeld(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [held]);
  return { held, show: (v) => setHeld(v), clear: () => setHeld(null) };
}

/** The last thing a tap added, cleared after five seconds; a new tap replaces it and starts the five seconds again. */
export function useAddedLine(): { added: Added | null; show: (a: Added) => void; clear: () => void } {
  const { held, show, clear } = useUndoable<Added>();
  return { added: held, show, clear };
}

/**
 * The Undo line: what was just done, and an Undo a finger wide. Under the
 * tiles after a tap, and inside a sheet after a delete, where the app-wide
 * toast would be hidden behind the sheet. No confirm dialogs: a wrong tap is
 * one more tap to put right.
 */
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
