import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, S } from '../ui/theme';

/**
 * A hand-rolled tab bar.
 *
 * The stock one clips its labels on the web: it gives the text a 9px box with
 * overflow hidden, which is fine for Latin but cuts the marks above and below
 * Devanagari. Owning the layout also matches the design exactly.
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

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: C.bgAlt,
        borderTopWidth: S.hairline,
        borderTopColor: C.border,
        paddingTop: 9,
        paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 6),
      }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? C.accent : C.textFaint;
        const label = typeof options.title === 'string' ? options.title : route.name;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 5,
              paddingHorizontal: 2,
              opacity: pressed ? 0.6 : 1,
            })}>
            {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 21 }) : null}
            <Text
              numberOfLines={1}
              style={{
                color,
                fontSize: F.micro,
                lineHeight: 15,
                fontWeight: focused ? '600' : '500',
                letterSpacing: 0.3,
                // A generous line box so Devanagari marks are never cut.
                includeFontPadding: false,
                textAlign: 'center',
              }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
