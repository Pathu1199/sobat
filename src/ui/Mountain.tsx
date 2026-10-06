import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useEased } from './animated';
import { C, F, MICRO } from './theme';

const W = 320;
const H = 120;

/**
 * The journey as a mountain: the foot is the first weigh-in, the peak is the
 * goal, and the marker is where the person stands today. One picture that
 * says "this far, this much left" without a single decimal.
 */
export function Mountain({ progress, startLabel, nowLabel, goalLabel }: { progress: number; startLabel: string; nowLabel: string; goalLabel: string }) {
  const p = useEased(Math.max(0, Math.min(1, progress)));
  // The slope: a gentle rise, then steeper near the top, like a real climb.
  const x = 24 + p * (W - 72);
  const y = H - 18 - Math.pow(p, 1.35) * (H - 40);
  const ridge = `M 0 ${H} L 24 ${H - 18} C 120 ${H - 30}, 200 ${H - 70}, ${W - 48} 22 L ${W - 36} 16 L ${W - 24} 26 C ${W - 10} 40, ${W} 70, ${W} ${H} Z`;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ width: '100%', aspectRatio: W / H }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.accentSoft} stopOpacity="0.9" />
              <Stop offset="1" stopColor={C.card} stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          <Path d={ridge} fill="url(#mtn)" stroke={C.borderStrong} strokeWidth="1" />
          {/* The flag at the peak. */}
          <Path d={`M ${W - 36} 16 L ${W - 36} 2 L ${W - 22} 7 L ${W - 36} 12`} fill={C.cyan} stroke={C.cyan} strokeWidth="1" />
          {/* The person, with a soft halo so the dot reads against the slope. */}
          <Circle cx={x} cy={y} r="9" fill={C.accent} opacity="0.25" />
          <Circle cx={x} cy={y} r="5" fill={C.white} stroke={C.accent} strokeWidth="2.5" />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[MICRO, { color: C.textFaint }]}>{startLabel}</Text>
        <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{nowLabel}</Text>
        <Text style={[MICRO, { color: C.cyan }]}>{goalLabel}</Text>
      </View>
    </View>
  );
}
