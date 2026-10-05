import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C } from './theme';

/**
 * The Sobat mark: a ring and a dot side by side. सोबत means company, someone
 * with you. Drawn as vectors so it is sharp at any size; the PNG icons in
 * assets/images are made from the same geometry by scripts/make-logo.py.
 */
export function Logo({ size = 28, mono }: { size?: number; mono?: boolean }) {
  // Geometry in a 100-unit square, matching the script.
  const ring = { cx: 44, cy: 50, r: 21.5, w: 8.8 };
  const dot = { cx: 73.5, cy: 65.5, r: 9.5 };
  const gap = dot.r + ring.w * 0.42;
  const fill = mono ? C.white : 'url(#sobat-grad)';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Sobat">
      <Defs>
        <LinearGradient id="sobat-grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={C.accent} />
          <Stop offset="1" stopColor={C.cyan} />
        </LinearGradient>
      </Defs>
      <Circle cx={ring.cx} cy={ring.cy} r={ring.r} stroke={fill} strokeWidth={ring.w} fill="none" />
      {/* A hole where the dot sits, so the two shapes touch rather than overlap. */}
      <Circle cx={dot.cx} cy={dot.cy} r={gap} fill={C.bg} />
      <Circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={fill} />
    </Svg>
  );
}

/** The mark with the name beside it, for page headers. */
export function Wordmark({ size = 22, alt }: { size?: number; alt?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Logo size={size + 8} />
      <View>
        <Text style={{ color: C.text, fontSize: size, fontWeight: '600', letterSpacing: -0.4 }}>Sobat</Text>
        {alt ? <Text style={{ color: C.textGhost, fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '500' }}>{alt}</Text> : null}
      </View>
    </View>
  );
}
