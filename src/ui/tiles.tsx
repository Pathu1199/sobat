import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from './animated';
import { PressScale } from './PressScale';
import { C, F, M, MICRO, S } from './theme';

/** A compact stat for horizontal strips: caption, value, one quiet line. */
export function Tile({
  label,
  value,
  sub,
  color = C.text,
  onPress,
  width = 112,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  onPress?: () => void;
  width?: number;
}) {
  const body = (
    <View
      style={{
        width,
        backgroundColor: C.card,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radiusSm,
        paddingVertical: 12,
        paddingHorizontal: 13,
        gap: 5,
      }}>
      <Text style={[MICRO, { color: C.textFaint }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color, fontSize: F.h2, fontWeight: '700', letterSpacing: -0.5 }} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={{ color: C.textFaint, fontSize: F.tiny }} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
  return onPress ? <PressScale onPress={onPress}>{body}</PressScale> : body;
}

/** Rows with a check circle. The decision card's actions. */
export function Checklist({
  items,
  onToggle,
  color = C.accent,
}: {
  items: { key: string; label: string; done: boolean }[];
  onToggle: (key: string) => void;
  color?: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      {items.map((i) => (
        <Pressable
          key={i.key}
          onPress={() => onToggle(i.key)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: i.done }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: i.done ? color : C.borderStrong,
              backgroundColor: i.done ? color : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {i.done ? <Ionicons name="checkmark" size={13} color={C.white} /> : null}
          </View>
          <Text
            style={{
              color: i.done ? C.textFaint : C.text,
              fontSize: F.body,
              lineHeight: 20,
              flex: 1,
              textDecorationLine: i.done ? 'line-through' : 'none',
            }}>
            {i.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A shimmering placeholder block while the store loads. */
export function Skeleton({ height, width = '100%', style }: { height: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const reduce = useReducedMotion();
  // eslint-disable-next-line react-hooks/refs
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: M.slow, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: M.slow, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  return <Animated.View style={[{ height, width, borderRadius: S.radiusSm, backgroundColor: C.cardAlt, opacity: pulse }, style]} />;
}

/** Desktop columns. `weights` are flex values, one per child. */
export function Cols({ weights, gap = 14, children }: { weights: number[]; gap?: number; children: React.ReactNode }) {
  const kids = React.Children.toArray(children);
  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'flex-start' }}>
      {kids.map((k, i) => (
        <View key={i} style={{ flex: weights[i] ?? 1, gap: 14 }}>
          {k}
        </View>
      ))}
    </View>
  );
}
