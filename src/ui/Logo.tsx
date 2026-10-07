import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Stop } from 'react-native-svg';
import { C } from './theme';

/**
 * The Fitoo mark: two discs on a tilted bar. It is the "oo" of the name, a
 * dumbbell, and two eyes looking up, all at once. Drawn as vectors so it is
 * sharp at any size; the PNG icons in assets/images are made from the same
 * geometry by scripts/make-logo.py.
 */
export function Logo({ size = 28, mono }: { size?: number; mono?: boolean }) {
  // Geometry in a 100-unit square, matching the script. The bar rises
  // left to right, so the mark reads as progress rather than a plain "oo".
  const a = { cx: 31, cy: 61, r: 17 };
  const b = { cx: 69, cy: 39, r: 17 };
  const fill = mono ? C.white : 'url(#fitoo-grad)';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Fitoo">
      <Defs>
        <LinearGradient id="fitoo-grad" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={C.accent} />
          <Stop offset="1" stopColor={C.cyan} />
        </LinearGradient>
      </Defs>
      <Line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={fill} strokeWidth={11} strokeLinecap="round" />
      <Circle cx={a.cx} cy={a.cy} r={a.r} fill={fill} />
      <Circle cx={b.cx} cy={b.cy} r={b.r} fill={fill} />
      {/* A highlight in each disc: the eyes, and the sheen on a weight plate. */}
      <Circle cx={a.cx + 5} cy={a.cy - 5} r={4.2} fill={C.bg} opacity={0.9} />
      <Circle cx={b.cx + 5} cy={b.cy - 5} r={4.2} fill={C.bg} opacity={0.9} />
    </Svg>
  );
}

/** The mark with the name beside it, for page headers. */
export function Wordmark({ size = 22, alt }: { size?: number; alt?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Logo size={size + 8} />
      <View>
        <Text style={{ color: C.text, fontSize: size, fontWeight: '700', letterSpacing: -0.6 }}>
          fit
          <Text style={{ color: C.accent }}>oo</Text>
        </Text>
        {alt ? <Text style={{ color: C.textGhost, fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '500' }}>{alt}</Text> : null}
      </View>
    </View>
  );
}
