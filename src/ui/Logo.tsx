import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C, F } from './theme';

/**
 * The Dhyey mark: three rising steps and a dot at the foot of them, a small
 * step every day with the person about to climb. Drawn as vectors so it is
 * sharp at any size; the PNG icons in assets/images are made from the same
 * geometry by scripts/make-logo.py.
 */
export function Logo({ size = 28, mono }: { size?: number; mono?: boolean }) {
  // A 100-unit square, matching the script: a teal tile with the white mark,
  // or, in mono, the mark alone in the accent colour on whatever is behind it.
  const ink = mono ? C.accent : C.white;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Dhyey">
      {mono ? null : <Rect width={100} height={100} rx={22} fill={C.accent} />}
      <Path d="M18 78 H36 V60 H54 V42 H72 V24" fill="none" stroke={ink} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={76} cy={76} r={8} fill={ink} />
    </Svg>
  );
}

/** The mark with the name beside it, for page headers. */
export function Wordmark({ size = 22, alt }: { size?: number; alt?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Logo size={size + 8} />
      <View>
        <Text style={{ color: C.text, fontSize: size, fontWeight: '500' }}>
          Dhyey
        </Text>
        {alt ? <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500' }}>{alt}</Text> : null}
      </View>
    </View>
  );
}
