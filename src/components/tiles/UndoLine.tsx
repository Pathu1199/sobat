import React, { useEffect, useId, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useFeedback } from '../../services/feedback';
import { sayOnPhone } from '../../ui/announce';
import { C, F, lh, S } from '../../ui/theme';
import { toastSpeech } from '../../ui/toastWords';

export { addedText, type Added } from '../../ui/tileWords';

/** How long "Added … · Undo" stays under the tiles, and "Deleted … · Undo" in a sheet. */
export const UNDO_MS = 5000;

/**
 * What can still be undone, kept for five seconds; a new one replaces it and
 * starts the five seconds again. `words` are the line's words for it, and
 * `undoLabel` its button's name, given here once: the line takes both from
 * what this returns (`text`, empty while nothing is held, and `undoLabel`).
 * The web hears them at the tap that shows the line, from the app's region,
 * which is on the page before the line is (the phone hears them from the line
 * itself, once it is on screen). While something is held the app knows a line
 * with Undo is on screen, so a win waits for it (`undoLine`); it is told from
 * the tap, the timer and the Undo, and when the page or sheet goes.
 */
export function useUndoable<T>(
  words: (v: T) => string,
  undoLabel: string,
): { held: T | null; text: string; undoLabel: string; show: (v: T) => void; clear: () => void } {
  const { announce, undoLine } = useFeedback();
  const id = useId();
  const [held, setHeld] = useState<T | null>(null);
  useEffect(() => {
    if (held === null) return;
    const timer = setTimeout(() => {
      setHeld(null);
      undoLine(id, false);
    }, UNDO_MS);
    return () => clearTimeout(timer);
  }, [held, id, undoLine]);
  // A line that leaves with its page or sheet is gone too.
  useEffect(() => () => undoLine(id, false), [id, undoLine]);
  function show(v: T) {
    setHeld(v);
    undoLine(id, true);
    if (Platform.OS === 'web') announce(toastSpeech(words(v), undoLabel));
  }
  function clear() {
    setHeld(null);
    undoLine(id, false);
  }
  return { held, text: held === null ? '' : words(held), undoLabel, show, clear };
}

/**
 * The Undo line: what was just done, and an Undo a finger wide. Under the
 * tiles after a tap, and inside a sheet after a delete, where the app-wide
 * toast would be hidden behind the sheet. No confirm dialogs: a wrong tap is
 * one more tap to put right. A screen reader says the line and its button's
 * name as it appears. Not from a live region of its own: one that comes onto
 * the page with its words already in it is not read. The phone says them from
 * here, once the line is on screen (after a delete has taken the focused
 * button away), and the web from the app's region, at the tap (`useUndoable`).
 */
export function UndoLine({ text, undoLabel, onUndo }: { text: string; undoLabel: string; onUndo: () => void }) {
  useEffect(() => {
    sayOnPhone(toastSpeech(text, undoLabel));
  }, [text, undoLabel]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch }}>
      <Text style={{ flex: 1, color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>
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
