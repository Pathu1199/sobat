import React from 'react';
import { Platform, View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { C } from '../ui/theme';

const ARect = Animated.createAnimatedComponent(Rect);
/** The face's number in the app's own font on the web, where an SVG text otherwise falls back to a serif. */
const FACE_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined;

/**
 * A medal: a ribbon in the action colours, a ring of the reward metal and a
 * face of the reward fill with its number, ½, ★ or ✓ in the reward ink (4.5:1
 * on the fill). A medal still to earn is drawn faded. Look only, hidden from
 * screen readers on the phone and the web: whoever shows it says what it is.
 * With `shine` (0 to 1), a soft band of light crosses the face, for the
 * celebration.
 */
export function MedalArt({ size, face, faded, shine }: { size: number; face: string; faded?: boolean; shine?: SharedValue<number> }) {
  const id = `face-${size}`;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ opacity: faded ? 0.35 : 1 }}>
      <Svg width={size} height={size * 1.1} viewBox="0 0 100 110">
        <Defs>
          <ClipPath id={id}>
            <Circle cx={50} cy={66} r={36} />
          </ClipPath>
        </Defs>
        <Path d="M28 4 L44 38 L56 38 L40 4 Z" fill={C.accent} />
        <Path d="M72 4 L56 38 L44 38 L60 4 Z" fill={C.accentText} />
        <Circle cx={50} cy={66} r={38} fill={C.gold} />
        <Circle cx={50} cy={66} r={30} fill={C.goldSoft} />
        {shine ? (
          <G clipPath={`url(#${id})`}>
            <Shine shine={shine} />
          </G>
        ) : null}
        <SvgText x={50} y={76} textAnchor="middle" fontSize={face.length > 2 ? 22 : 28} fontWeight="600" fontFamily={FACE_FONT} fill={C.goldInk}>
          {face}
        </SvgText>
      </Svg>
    </View>
  );
}

function Shine({ shine }: { shine: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ x: -30 + 130 * shine.get() }));
  return <ARect y={20} width={16} height={100} fill={C.white} opacity={0.35} transform="rotate(20 50 66)" animatedProps={props} />;
}
