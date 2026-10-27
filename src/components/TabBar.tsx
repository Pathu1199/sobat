import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { barItems, type BarItem } from '../core/bar';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, F, lh, lift, S } from '../ui/theme';

/**
 * The bar: Today, the extra tabs the person chose (Progress unless changed),
 * ➕ in the middle, and Me. core/bar.ts sets the order, so the sidebar on a
 * wide screen shows the same list. ➕ is a button, not a tab: it adds food
 * for the day Today is showing. Hand-rolled because the stock bar gives its
 * label a box that clips Devanagari marks on the web.
 */
type IconName = keyof typeof Ionicons.glyphMap;
type Route = { key: string; name: string; params?: object };

type TabBarProps = {
  state: { index: number; routes: Route[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

/** The date Today is showing, from its ?date= param; undefined while it shows today. */
export function viewedDate(routes: Route[]): string | undefined {
  const params = routes.find((r) => r.name === 'index')?.params as { date?: unknown } | undefined;
  return typeof params?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;
}

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const focused = state.routes[state.index]?.name;

  function open(item: BarItem) {
    const route = state.routes.find((r) => r.name === item.route);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (focused !== route.name && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  }

  function add() {
    const date = viewedDate(state.routes);
    router.push(date ? { pathname: '/log', params: { date } } : '/log');
  }

  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 6);
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: C.bgAlt,
        borderTopWidth: S.hairline,
        borderTopColor: C.border,
        ...lift(2),
        shadowOffset: { width: 0, height: -4 },
        minHeight: 64 + bottom,
        paddingTop: 8,
        paddingBottom: bottom,
      }}>
      {barItems(app.state.settings.tabs).map((item) =>
        item.route === null ? (
          <View key={item.key} style={{ flex: 1, alignItems: 'center' }}>
            <Pressable
              onPress={add}
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
              style={({ pressed }) => ({
                width: 60,
                height: 60,
                borderRadius: 30,
                marginTop: -26,
                backgroundColor: C.accent,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 5,
                borderColor: C.bgAlt,
                ...lift(2),
                shadowColor: C.accent,
                shadowOpacity: 0.4,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}>
              <Ionicons name="add" size={30} color={C.onAccent} />
            </Pressable>
          </View>
        ) : (
          <TabButton key={item.key} item={item} focused={focused === item.route} label={t(item.labelKey)} onPress={() => open(item)} />
        ),
      )}
    </View>
  );
}

function TabButton({ item, focused, label, onPress }: { item: BarItem; focused: boolean; label: string; onPress: () => void }) {
  const color = focused ? C.accentText : C.textFaint;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={focused || undefined}
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'flex-start', gap: 3, paddingHorizontal: 2, opacity: pressed ? 0.6 : 1 })}>
      {/* The active tab sits on a 48 × 32 tinted pill: seen before it is read. */}
      <View style={{ width: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.accentDim : 'transparent' }}>
        <Ionicons name={item.icon as IconName} size={24} color={color} />
      </View>
      <Text numberOfLines={1} style={{ color, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', includeFontPadding: false, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
