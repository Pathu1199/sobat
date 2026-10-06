import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useReducedMotion } from '../ui/animated';
import { Btn } from '../ui/components';
import { Logo } from '../ui/Logo';
import { C, F, M, MICRO } from '../ui/theme';

const PAGES: { icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { icon: 'pie-chart-outline', color: C.accent },
  { icon: 'restaurant-outline', color: C.cyan },
  { icon: 'scale-outline', color: C.green },
];

/**
 * Three screens after setup: the ring, the routine, the weekly habits. Each
 * says one thing. Reachable again from Settings → About.
 */
export default function TourScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const insets = useSafeAreaInsets();
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const reduce = useReducedMotion();
  const [page, setPage] = useState(0);
  // State rather than a ref, so render never touches a ref.
  const [fade] = useState(() => new Animated.Value(1));
  const last = page === PAGES.length - 1;

  function go(next: number) {
    if (reduce) {
      setPage(next);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: M.fast, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setPage(next);
      Animated.timing(fade, { toValue: 1, duration: M.base, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  }

  function done() {
    // After setup the permissions screen is next; from Settings, just go home.
    router.replace(from === 'settings' ? '/' : '/permissions');
  }

  const p = PAGES[page];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size={28} />
        <Pressable onPress={done} hitSlop={10} accessibilityRole="button">
          <Text style={[MICRO, { color: C.textFaint }]}>{t('tour_skip')}</Text>
        </Pressable>
      </View>

      <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 22, opacity: fade, maxWidth: 520, alignSelf: 'center', width: '100%' }}>
        <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={p.icon} size={40} color={p.color} />
        </View>
        <Text style={[MICRO, { color: p.color }]}>{`${page + 1} / ${PAGES.length}`}</Text>
        <Text style={{ color: C.text, fontSize: F.h1, fontWeight: '600', letterSpacing: -0.5, textAlign: 'center', lineHeight: 34 }}>{t(`tour_${page + 1}_t`)}</Text>
        <Text style={{ color: C.textDim, fontSize: F.h3, lineHeight: 24, textAlign: 'center' }}>{t(`tour_${page + 1}_b`)}</Text>
      </Animated.View>

      <View style={{ gap: 18, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {PAGES.map((_, i) => (
            <Pressable key={i} onPress={() => go(i)} hitSlop={8}>
              <View style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? C.accent : C.borderStrong }} />
            </Pressable>
          ))}
        </View>
        <Btn label={last ? t('tour_start') : t('tour_next')} onPress={() => (last ? done() : go(page + 1))} style={{ alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}
