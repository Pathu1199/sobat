import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SaidProvider, useAnnounce, useScreenReaderOn } from '../ui/announce';
import { undoLinesShown } from '../ui/listUndo';
import { C, F, M, S } from '../ui/theme';
import { toastMs, toastSpeech } from '../ui/toastWords';
import { useBreakpoint } from '../ui/useBreakpoint';

export type ToastAction = { label: string; onPress: () => void };

type Feedback = {
  /**
   * A one-line confirmation that fades after two seconds; with an action (Undo), it stays five and can be tapped, ten
   * while a screen reader is on, and always ten on the web, which cannot tell whether one is on. A screen reader hears the
   * words and the action's name as the toast appears, from inside an open sheet on the web; the words leave the page's
   * region as the toast fades.
   */
  notify: (text: string, action?: ToastAction) => void;
  /** A tap on the phone. Silent on the web. */
  haptic: (kind: 'light' | 'success') => void;
  /**
   * Says a line to a screen reader with no toast: on the phone at once, on the web from the region the toasts use, kept on
   * the page from the start, so words that appear on screen together with their own text are heard too.
   */
  announce: (text: string) => void;
  /**
   * Marks an "… · Undo" line under the tiles or in a sheet as on screen (`on`) or gone, by the id of what shows it
   * (`useUndoable`), so a win waits for it as it waits for a toast with Undo.
   */
  undoLine: (id: string, on: boolean) => void;
};

const Ctx = createContext<Feedback | null>(null);
/** Whether a toast with a button (Undo) or an Undo line is on screen. Its own context, so the rest of the app does not render again with it. */
const UndoShowingCtx = createContext(false);

export function useFeedback(): Feedback {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeedback must be used inside FeedbackProvider');
  return c;
}

/**
 * True while a toast with a button (Undo) or an "… · Undo" line is on screen, so something else that would cover it can
 * wait until it has gone. Never for long: the toast fades and the line goes after five seconds.
 */
export function useUndoShowing(): boolean {
  return useContext(UndoShowingCtx);
}

async function vibrate(kind: 'light' | 'success') {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // No haptics engine. Nothing to do.
  }
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const [action, setAction] = useState<ToastAction | null>(null);
  // The Undo lines on screen, set from the tap that shows one and from its own timer, never from an effect body.
  const [lines, setLines] = useState<readonly string[]>([]);
  // eslint-disable-next-line react-hooks/refs
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerOn = useScreenReaderOn();
  // The phone says the toast at once; the web reads it from this region, on the page from the start, or from the top-most open sheet's.
  const { announce, clear, region, said } = useAnnounce(true);

  const notify = useCallback(
    (t: string, a?: ToastAction) => {
      setText(t);
      setAction(a ?? null);
      // The web cannot tell whether a screen reader is on, so a toast with a button there always leaves it the time.
      const ms = toastMs(!!a, readerOn || Platform.OS === 'web');
      // The words stay in the region as long as the toast is on screen.
      announce(toastSpeech(t, a?.label), ms);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: M.fast, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: M.base, useNativeDriver: true }).start((result) => {
          // A new toast interrupts this fade-out; its callback must not blank the new text.
          if (result.finished) {
            setText(null);
            setAction(null);
          }
        });
      }, ms);
    },
    [opacity, announce, readerOn],
  );

  const haptic = useCallback((kind: 'light' | 'success') => {
    vibrate(kind).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const undoLine = useCallback((id: string, on: boolean) => setLines((shown) => undoLinesShown(shown, id, on)), []);

  const value = useMemo(() => ({ notify, haptic, announce, undoLine }), [notify, haptic, announce, undoLine]);

  return (
    <Ctx.Provider value={value}>
      <UndoShowingCtx.Provider value={(text !== null && action !== null) || lines.length > 0}>
        <SaidProvider value={said}>{children}</SaidProvider>
      </UndoShowingCtx.Provider>
      {region}
      {text ? (
        <ToastView
          text={text}
          opacity={opacity}
          action={action}
          onAction={() => {
            action?.onPress();
            if (timer.current) clearTimeout(timer.current);
            clear();
            setText(null);
            setAction(null);
            opacity.setValue(0);
          }}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function ToastView({ text, opacity, action, onAction }: { text: string; opacity: Animated.Value; action: ToastAction | null; onAction: () => void }) {
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'mobile';
  return (
    <Animated.View
      pointerEvents={action ? 'box-none' : 'none'}
      style={{
        position: 'absolute',
        bottom: (wide ? 24 : 84) + insets.bottom,
        right: wide ? 24 : undefined,
        alignSelf: wide ? 'flex-end' : 'center',
        left: wide ? undefined : 0,
        width: wide ? undefined : '100%',
        alignItems: 'center',
        opacity,
        zIndex: 950,
      }}>
      <View
        style={{
          backgroundColor: C.cardHigh,
          borderWidth: S.hairline,
          borderColor: C.borderStrong,
          borderRadius: 999,
          paddingVertical: action ? 6 : 10,
          paddingLeft: 16,
          paddingRight: action ? 6 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{text}</Text>
        {action ? (
          // A finger wide, like every other control.
          <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, paddingHorizontal: 16, borderRadius: 999, backgroundColor: pressed ? C.accentSoft : C.accentDim, alignItems: 'center', justifyContent: 'center' })}>
            <Text style={{ color: C.accentText, fontSize: F.small, fontWeight: '500' }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
