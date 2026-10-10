import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, F, lift, S } from '../ui/theme';

/**
 * A hand-rolled tab bar: Today · Growth · [+] · Move · Mind.
 *
 * The stock one clips its labels on the web: it gives the text a 9px box with
 * overflow hidden, which is fine for Latin but cuts the marks above and below
 * Devanagari. Owning the layout also lets the centre button sit proud of the
 * bar. Coach is a hidden route reached from the top bar, so it is skipped here.
 */
type TabIconProps = { focused: boolean; color: string; size: number };

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  descriptors: Record<string, { options: { title?: string; tabBarIcon?: (p: TabIconProps) => React.ReactNode; tabBarAccessibilityLabel?: string } }>;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const HIDDEN = new Set(['coach', 'log', 'growth', 'fit', 'mind']);
const CENTRE_AFTER = 'food';

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state: app } = useApp();
  const t = makeT(app.profile.lang);

  const onLog = state.routes[state.index]?.name === 'log';
  const slots: React.ReactNode[] = [];
  state.routes.forEach((route, index) => {
    if (HIDDEN.has(route.name)) return;
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const color = focused ? C.accent : C.textFaint;
    const label = typeof options.title === 'string' ? options.title : route.name;

    slots.push(
      <Pressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
        style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'flex-start', gap: 3, paddingHorizontal: 2, opacity: pressed ? 0.6 : 1 })}>
        {/* The active tab sits on a 48 × 32 tinted pill: seen before it is read. */}
        <View style={{ width: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.accentDim : 'transparent' }}>
          {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 24 }) : null}
        </View>
        <Text
          numberOfLines={1}
          style={{ color: focused ? C.accent : C.textFaint, fontSize: Math.max(12, F.micro), lineHeight: 16, fontWeight: focused ? '800' : '600', letterSpacing: 0.2, includeFontPadding: false, textAlign: 'center' }}>
          {label}
        </Text>
      </Pressable>,
    );

    if (route.name === CENTRE_AFTER) {
      slots.push(
        <View key="centre" style={{ flex: 1, alignItems: 'center' }}>
          <Pressable
            onPress={() => router.push('/log')}
            accessibilityRole="button"
            accessibilityLabel={t('tab_log')}
            style={({ pressed }) => ({
              width: 60,
              height: 60,
              borderRadius: 30,
              marginTop: -26,
              backgroundColor: onLog ? C.cyan : C.accent,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 5,
              borderColor: C.bgAlt,
              ...lift(2),
              shadowColor: C.accent,
              shadowOpacity: 0.4,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}>
            <Ionicons name="add" size={30} color={C.white} />
          </Pressable>
        </View>,
      );
    }
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: C.bgAlt,
        borderTopWidth: S.hairline,
        borderTopColor: C.border,
        ...lift(2),
        shadowOffset: { width: 0, height: -4 },
        minHeight: 64 + Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 6),
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 6),
      }}>
      {slots}
    </View>
  );
}
