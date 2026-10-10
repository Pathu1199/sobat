import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, M, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

export type ToastAction = { label: string; onPress: () => void };

type Feedback = {
  /** A one-line confirmation that fades after two seconds; with an action (Undo), it stays five and can be tapped. */
  notify: (text: string, action?: ToastAction) => void;
  /** A tap on the phone. Silent on the web. */
  haptic: (kind: 'light' | 'success') => void;
};

const Ctx = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeedback must be used inside FeedbackProvider');
  return c;
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
  // eslint-disable-next-line react-hooks/refs
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(
    (t: string, a?: ToastAction) => {
      setText(t);
      setAction(a ?? null);
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
      }, a ? 5000 : 2000);
    },
    [opacity],
  );

  const haptic = useCallback((kind: 'light' | 'success') => {
    vibrate(kind).catch(() => {});
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ notify, haptic }), [notify, haptic]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {text ? (
        <ToastView
          text={text}
          opacity={opacity}
          action={action}
          onAction={() => {
            action?.onPress();
            if (timer.current) clearTimeout(timer.current);
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
          <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: pressed ? C.accentSoft : C.accentDim, alignItems: 'center', justifyContent: 'center' })}>
            <Text style={{ color: C.accent, fontSize: F.small, fontWeight: '800' }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
