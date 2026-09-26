import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useEased } from './animated';
import { C, F, MICRO } from './theme';

/** The one large ring on Today: a big light number, a tiny caption, an eased fill. */
export function HeroRing({
  value,
  max,
  size = 156,
  stroke = 8,
  color = C.accent,
  big,
  caption,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  big: string;
  caption: string;
  children?: React.ReactNode;
}) {
  const safe = Math.max(60, size);
  const r = (safe - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const pct = useEased(target);
  return (
    <View style={{ width: safe, height: safe, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={safe} height={safe} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={safe / 2} cy={safe / 2} r={r} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={safe / 2}
          cy={safe / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ color: C.text, fontSize: safe >= 150 ? F.hero * 0.72 : 27, fontWeight: '200', letterSpacing: -1.6 }}>{big}</Text>
        <Text style={[MICRO, { color: C.textFaint }]}>{caption}</Text>
        {children}
      </View>
    </View>
  );
}
