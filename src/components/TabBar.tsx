import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addSlot, barItems, viewedDate, type BarItem } from '../core/bar';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { barBottom, barHeight, PLUS_LIFT, PLUS_SIZE, TAB_GAP, TAB_ICON, TAB_PAD, TAB_PILL, tabLabelSize } from '../ui/barGeometry';
import { C, lh, lift, S, textScale } from '../ui/theme';
import { useAddSheet } from './AddSheet';

/**
 * The bar: Today, the extra tabs the person chose (Routine and Progress
 * unless changed), ➕ in the middle, and Me. core/bar.ts sets the order, so
 * the sidebar on a wide screen shows the same list. The tabs are tabs in a
 * tab list, so the selected one is announced on the web too; ➕ is a button,
 * not a tab, laid over an empty slot in the list's middle, lifted half its
 * height above the bar: it logs anything for the day Today is showing. The
 * sizes are ui/barGeometry.ts's. Holding any tab opens Customize, where the
 * tabs are chosen. Hand-rolled because the stock bar gives its label a box
 * that clips Devanagari marks on the web.
 */
type IconName = keyof typeof Ionicons.glyphMap;
// The slot ➕ sits in is a full slot wide, so it lets taps through to what is beside the circle. In a StyleSheet, because the web
// only reads 'box-none' there; written in a plain style object, react-native-web leaves it out.
const slotStyle = StyleSheet.create({ pass: { pointerEvents: 'box-none' } });
type Route = { key: string; name: string; params?: object };

type TabBarProps = {
  state: { index: number; routes: Route[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const addSheet = useAddSheet();
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
    // The day Today shows, only while Today is in front: from any other tab ➕ adds to today.
    addSheet.open({ date: viewedDate(state.routes[state.index]) ?? app.today });
  }

  const items = barItems(app.state.settings.tabs);
  const slot = addSlot(items);
  const addLabel = t(items[slot.index].labelKey);
  const bottom = barBottom(insets.bottom, Platform.OS === 'web');
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: C.bgAlt,
        borderTopWidth: S.hairline,
        borderTopColor: C.border,
        ...lift(2),
        shadowOffset: { width: 0, height: -4 },
        minHeight: barHeight(textScale()) + bottom,
        paddingBottom: bottom,
      }}>
      {/* The tab list holds only tabs; ➕'s place in it is an empty slot. */}
      <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: 'row' }}>
        {items.map((item) =>
          item.route === null ? (
            <View key={item.key} style={{ flex: 1 }} />
          ) : (
            <TabButton
              key={item.key}
              item={item}
              focused={focused === item.route}
              label={t(item.labelKey)}
              hint={t('cust_hint')}
              onPress={() => open(item)}
              onLongPress={() => router.push('/customize' as never)}
            />
          ),
        )}
      </View>
      {/* ➕ is a button laid over that slot, outside the list, so a screen reader never counts it as a tab. Half of it rises above the bar. */}
      <View style={[slotStyle.pass, { position: 'absolute', top: -PLUS_LIFT, left: `${(slot.index / slot.count) * 100}%`, width: `${100 / slot.count}%`, alignItems: 'center' }]}>
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => ({
            width: PLUS_SIZE,
            height: PLUS_SIZE,
            borderRadius: PLUS_SIZE / 2,
            backgroundColor: C.accent,
            alignItems: 'center',
            justifyContent: 'center',
            ...lift(2),
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}>
          <Ionicons name="add" size={28} color={C.onAccent} />
        </Pressable>
      </View>
    </View>
  );
}

function TabButton({
  item,
  focused,
  label,
  hint,
  onPress,
  onLongPress,
}: {
  item: BarItem;
  focused: boolean;
  label: string;
  hint: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const color = focused ? C.accentText : C.textFaint;
  const size = tabLabelSize(textScale());
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      aria-selected={focused}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({ flex: 1, minHeight: S.touch, alignItems: 'center', justifyContent: 'flex-start', gap: TAB_GAP, paddingTop: TAB_PAD, paddingHorizontal: 2, opacity: pressed ? 0.6 : 1 })}>
      {/* The active tab sits on a soft pill: seen before it is read. */}
      <View style={{ width: TAB_PILL.width, height: TAB_PILL.height, borderRadius: TAB_PILL.height / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.accentSoft : 'transparent' }}>
        <Ionicons name={item.icon as IconName} size={TAB_ICON} color={color} />
      </View>
      <Text numberOfLines={1} style={{ color, fontSize: size, lineHeight: lh(size), fontWeight: '500', includeFontPadding: false, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}
