import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useEased } from './animated';
import { C, F, MICRO } from './theme';

const W = 320;
const H = 150;

/** Where a point `p` along the climb sits on the slope: a gentle rise, then steeper near the top. */
function at(p: number): { x: number; y: number } {
  return { x: 24 + p * (W - 72), y: H - 22 - Math.pow(p, 1.35) * (H - 48) };
}

export type Camp = { p: number; label: string };

/**
 * The journey as a mountain: the foot is the start weight, the peak is the
 * goal, the climber is where the person stands today. Past weigh-ins leave a
 * trail of footprints; camps mark every quarter of the way. The climber eases
 * to a new spot when a weigh-in lands, so a good week is seen, not read.
 */
export function Mountain({
  progress,
  startLabel,
  nowLabel,
  goalLabel,
  camps = [],
  trail = [],
  tall,
}: {
  progress: number;
  startLabel: string;
  nowLabel: string;
  goalLabel: string;
  camps?: Camp[];
  trail?: number[];
  tall?: boolean;
}) {
  const p = useEased(Math.max(0, Math.min(1, progress)));
  const { x, y } = at(p);
  const peak = at(1);
  const ridge = `M 0 ${H} L 24 ${H - 22} C 120 ${H - 36}, 200 ${H - 90}, ${W - 48} 26 L ${W - 36} 18 L ${W - 24} 30 C ${W - 10} 48, ${W} 90, ${W} ${H} Z`;
  const back = `M 0 ${H} L 0 ${H - 40} C 60 ${H - 70}, 110 ${H - 60}, 170 ${H - 85} C 220 ${H - 105}, 260 ${H - 70}, ${W} ${H - 60} L ${W} ${H} Z`;
  const snow = `M ${W - 62} 40 C ${W - 54} 32, ${W - 44} 24, ${W - 36} 18 L ${W - 24} 30 C ${W - 20} 36, ${W - 16} 44, ${W - 12} 52 C ${W - 24} 46, ${W - 36} 50, ${W - 48} 44 Z`;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ width: '100%', aspectRatio: tall ? W / (H + 10) : W / H }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="mtn-sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.accentSoft} stopOpacity="0.35" />
              <Stop offset="1" stopColor={C.card} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="mtn-front" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.accent} stopOpacity="0.85" />
              <Stop offset="1" stopColor={C.accentSoft} stopOpacity="0.35" />
            </LinearGradient>
            <LinearGradient id="mtn-back" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.cyanSoft} stopOpacity="0.5" />
              <Stop offset="1" stopColor={C.card} stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          <Path d={`M 0 0 L ${W} 0 L ${W} ${H} L 0 ${H} Z`} fill="url(#mtn-sky)" />
          {/* Sun, behind the far ridge. */}
          <Circle cx={54} cy={34} r={12} fill={C.amber} opacity={0.55} />
          <Path d={back} fill="url(#mtn-back)" />
          <Path d={ridge} fill="url(#mtn-front)" stroke={C.borderStrong} strokeWidth="1" />
          <Path d={snow} fill={C.white} opacity={0.85} />
          {/* The flag at the peak. */}
          <Line x1={peak.x} y1={peak.y - 4} x2={peak.x} y2={peak.y - 22} stroke={C.text} strokeWidth="1.5" />
          <Path d={`M ${peak.x} ${peak.y - 22} L ${peak.x + 14} ${peak.y - 17} L ${peak.x} ${peak.y - 12} Z`} fill={C.cyan} />
          {/* Camps: a pennant and the weight it stands for. */}
          {camps.map((c) => {
            const q = at(c.p);
            return (
              <React.Fragment key={c.p}>
                <Line x1={q.x} y1={q.y} x2={q.x} y2={q.y - 14} stroke={C.textFaint} strokeWidth="1" />
                <Path d={`M ${q.x} ${q.y - 14} L ${q.x + 9} ${q.y - 11} L ${q.x} ${q.y - 8} Z`} fill={p >= c.p ? C.green : C.textGhost} />
                <SvgText x={q.x + 2} y={q.y + 14} fill={C.textFaint} fontSize="8" fontWeight="600">
                  {c.label}
                </SvgText>
              </React.Fragment>
            );
          })}
          {/* Footprints: every weigh-in so far. */}
          {trail.map((tp, i) => {
            const q = at(Math.max(0, Math.min(1, tp)));
            return <Circle key={i} cx={q.x} cy={q.y} r="2.2" fill={C.text} opacity={0.35} />;
          })}
          {/* The climber: halo, body, head, and a small pack. */}
          <Circle cx={x} cy={y - 6} r="13" fill={C.accent} opacity="0.18" />
          <Line x1={x} y1={y - 2} x2={x} y2={y - 11} stroke={C.text} strokeWidth="2.6" strokeLinecap="round" />
          <Line x1={x - 4} y1={y + 1} x2={x} y2={y - 6} stroke={C.text} strokeWidth="2.2" strokeLinecap="round" />
          <Line x1={x + 4} y1={y + 1} x2={x} y2={y - 6} stroke={C.text} strokeWidth="2.2" strokeLinecap="round" />
          <Circle cx={x - 2.5} cy={y - 8} r="2.6" fill={C.amber} />
          <Circle cx={x} cy={y - 14.5} r="3.6" fill={C.white} stroke={C.accent} strokeWidth="2" />
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
