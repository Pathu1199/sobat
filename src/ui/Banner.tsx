import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { C, S } from './theme';

/**
 * A flat panel for the one number a screen is about: a quiet surface on a
 * hairline, with no gradient and nothing drawn behind it. `over` turns it to
 * the soft red of a warning. Use the normal text colours inside.
 */
export function Banner({ children, style, over }: { children: React.ReactNode; style?: ViewStyle; over?: boolean }) {
  return (
    <View
      style={[
        { borderRadius: S.radiusSm, borderWidth: S.hairline, padding: S.padLg, gap: 12 },
        { backgroundColor: over ? C.redSoft : C.cardAlt, borderColor: over ? C.red : C.border },
        style,
      ]}>
      {children}
    </View>
  );
}

/** The banner's progress bar: the accent on a quiet track, red once past the end. */
export function BannerBar({ value, max, over }: { value: number; max: number; over?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: C.cardHigh, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: over ? C.red : C.accent }} />
    </View>
  );
}
