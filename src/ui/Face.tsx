import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { C } from './theme';

/**
 * A line-drawn face for a 1–5 mood. The mouth's curve is the score: a frown
 * at 1, flat at 3, a smile at 5. No emoji, so it matches the rest of the
 * instrument panel and renders identically on every platform.
 */
export function Face({ score, size = 28, color = C.textDim }: { score: number; size?: number; color?: string }) {
  const s = Math.max(1, Math.min(5, score));
  const r = size / 2;
  const cx = r;
  const cy = r;
  const stroke = Math.max(1.5, size / 16);
  const eyeY = cy - r * 0.18;
  const eyeX = r * 0.32;
  const mouthY = cy + r * 0.28;
  const mouthHalf = r * 0.38;
  // Control point moves from above the mouth (frown) to below it (smile).
  const bend = (s - 3) * r * 0.24;
  const mouth = `M ${cx - mouthHalf} ${mouthY} Q ${cx} ${mouthY + bend} ${cx + mouthHalf} ${mouthY}`;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r - stroke} stroke={color} strokeWidth={stroke} fill="none" />
      <Circle cx={cx - eyeX} cy={eyeY} r={stroke * 0.9} fill={color} />
      <Circle cx={cx + eyeX} cy={eyeY} r={stroke * 0.9} fill={color} />
      <Path d={mouth} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
