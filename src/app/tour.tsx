import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useReducedMotion } from '../ui/animated';
import { Btn } from '../ui/components';
import { Logo } from '../ui/Logo';
import { C, F, lh, M, MICRO, S } from '../ui/theme';

// Colour names, not values: the palette changes with the theme, so each page reads C at render.
const PAGES: { icon: keyof typeof Ionicons.glyphMap; color: keyof typeof C }[] = [
  { icon: 'pie-chart-outline', color: 'accentText' },
  { icon: 'restaurant-outline', color: 'cyan' },
  { icon: 'scale-outline', color: 'green' },
];

/**
 * Three screens about the app: Calories left and the week strip, the day's
 * menu with Ate as planned and ➕, and the weight on Progress. Each says one
 * thing. Opened from Me → Guide and Settings → About,
 * once setup is done (setup goes on to the permissions screen, not here).
 * Every control is a finger wide on every platform by its own box, the web
 * included, where reach added around a control does not count.
 */
export default function TourScreen() {
  const router = useRouter();
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
    // Skip and Start go to Today, wherever the tour was opened from.
    router.replace('/');
  }

  const p = PAGES[page];
  const tint = C[p.color];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size={28} />
        <Pressable
          onPress={done}
          accessibilityRole="button"
          accessibilityLabel={t('tour_skip')}
          style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, alignItems: 'flex-end', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Text style={[MICRO, { color: C.textFaint }]}>{t('tour_skip')}</Text>
        </Pressable>
      </View>

      <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 22, opacity: fade, maxWidth: 520, alignSelf: 'center', width: '100%' }}>
        <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={p.icon} size={40} color={tint} />
        </View>
        <Text style={[MICRO, { color: tint }]}>{`${page + 1} / ${PAGES.length}`}</Text>
        <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500', textAlign: 'center', lineHeight: lh(F.title) }}>{t(`tour_${page + 1}_t`)}</Text>
        <Text style={{ color: C.textDim, fontSize: F.title, lineHeight: lh(F.title), textAlign: 'center' }}>{t(`tour_${page + 1}_b`)}</Text>
      </Animated.View>

      <View style={{ gap: 18, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row' }}>
          {PAGES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => go(i)}
              accessibilityRole="button"
              accessibilityLabel={fill(t('tour_page'), { n: i + 1, m: PAGES.length })}
              // The web says "current"; the phone, which has no aria-current, says "selected".
              aria-current={i === page ? 'step' : undefined}
              aria-selected={Platform.OS === 'web' ? undefined : i === page}
              style={{ minWidth: S.touch, minHeight: S.touch, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? C.accent : C.borderStrong }} />
            </Pressable>
          ))}
        </View>
        <Btn label={last ? t('tour_start') : t('tour_next')} onPress={() => (last ? done() : go(page + 1))} style={{ alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}
