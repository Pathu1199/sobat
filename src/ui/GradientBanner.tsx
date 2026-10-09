import React, { useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { C } from './theme';

/**
 * A rounded panel painted with the brand gradient, for the one number a
 * screen is about. Two faint circles in the corner give it depth without
 * an image. Children are drawn on top; use white text inside.
 */
export function GradientBanner({ children, style, from = C.heroFrom, to = C.heroTo, radius = 20 }: { children: React.ReactNode; style?: ViewStyle; from?: string; to?: string; radius?: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[{ borderRadius: radius, overflow: 'hidden', padding: 20, gap: 12 }, style]}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id="hero-grad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill="url(#hero-grad)" />
          <Circle cx={size.w - 30} cy={20} r={70} fill="#FFFFFF" opacity={0.08} />
          <Circle cx={size.w - 6} cy={size.h - 10} r={46} fill="#FFFFFF" opacity={0.06} />
        </Svg>
      ) : (
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: from }} />
      )}
      {children}
    </View>
  );
}

/** A progress bar for use on the gradient: white on translucent white. */
export function BannerBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
    </View>
  );
}
