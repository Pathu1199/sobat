import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, M, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

type Feedback = {
  /** A one-line confirmation that fades after two seconds. */
  notify: (text: string) => void;
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
    const H = require('expo-haptics') as typeof import('expo-haptics');
    if (kind === 'success') await H.notificationAsync(H.NotificationFeedbackType.Success);
    else await H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch {
    // No haptics engine. Nothing to do.
  }
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/refs
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(
    (t: string) => {
      setText(t);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: M.fast, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: M.base, useNativeDriver: true }).start(() => setText(null));
      }, 2000);
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
      {text ? <ToastView text={text} opacity={opacity} /> : null}
    </Ctx.Provider>
  );
}

function ToastView({ text, opacity }: { text: string; opacity: Animated.Value }) {
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'mobile';
  return (
    <Animated.View
      pointerEvents="none"
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
          paddingVertical: 10,
          paddingHorizontal: 16,
        }}>
        <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{text}</Text>
      </View>
    </Animated.View>
  );
}
