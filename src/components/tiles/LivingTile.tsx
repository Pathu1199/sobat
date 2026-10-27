import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { C, lh, textScale } from '../../ui/theme';
import { ART_FIT, ART_H, ART_W, TILE_LINE_GAP, TILE_RADIUS, TILE_SIDE, TILE_TOP, tileMinHeight, tileType } from '../../ui/tileGeometry';
import type { ShownWords } from '../../ui/tileWords';

export { shownWords, type ShownWords } from '../../ui/tileWords';

export type TileSize = { w: number; h: number };

/**
 * The art's 100 × 42 drawing box, filling the tile's bottom zone: its shape
 * kept and seated on the bottom edge (`ART_FIT`), so on a tile taller than
 * square the art still stands on the bottom. Every tile's art draws in one.
 */
export function TileArt({ children }: { children: React.ReactNode }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${ART_W} ${ART_H}`} preserveAspectRatio={ART_FIT}>
      {children}
    </Svg>
  );
}

/**
 * The one frame every tracker sits in: a square with a 22 radius and a
 * hairline edge, two to a row. The words are pinned to the top, 14 from the
 * top and 15 from the sides, in the same place in every tile: the icon and
 * name, the number with its unit smaller, and one short line. The art has the
 * bottom 42% and never reaches the words; `behind` is the one exception, drawn
 * under the words across the whole tile (the water tank). The tile grows
 * taller than square only when the text size needs the room. Each tracker
 * brings its art, its words and its tap.
 */
export function LivingTile({
  icon,
  tint,
  name,
  words,
  done,
  art,
  behind,
  onPress,
  onLongPress,
  label,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** The tracker's own colour, for its icon. */
  tint: string;
  name: string;
  words: ShownWords;
  /** At the goal: a tick beside the name. */
  done?: boolean;
  art?: React.ReactNode;
  behind?: (size: TileSize) => React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  label: string;
  /** What a hold does, said by a screen reader; only for a tile that has a hold. */
  hint?: string;
}) {
  const scale = textScale();
  const type = tileType(scale);
  // The tank behind the words needs the tile's size in points; the art in the bottom zone scales by itself.
  const [size, setSize] = useState<TileSize | null>(null);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 1,
        minHeight: tileMinHeight(scale),
        borderRadius: TILE_RADIUS,
        borderWidth: 0.5,
        borderColor: C.border,
        backgroundColor: C.card,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}>
      {behind && size ? behind(size) : null}
      {art ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', pointerEvents: 'none' }}>{art}</View> : null}
      <View style={{ position: 'absolute', top: TILE_TOP, left: TILE_SIDE, right: TILE_SIDE, gap: TILE_LINE_GAP, pointerEvents: 'none' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={icon} size={type.name + 2} color={tint} />
          <Text numberOfLines={1} style={{ flex: 1, color: C.textDim, fontSize: type.name, lineHeight: lh(type.name), fontWeight: '500' }}>
            {name}
          </Text>
          {done ? <Ionicons name="checkmark-circle" size={type.name + 4} color={C.accentText} /> : null}
        </View>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: type.number, lineHeight: lh(type.number, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
          {words.parts.map((p, i) => (
            <React.Fragment key={i}>
              {i > 0 ? ' ' : ''}
              {p.num}
              {p.unit ? <Text style={{ color: C.textDim, fontSize: type.unit, fontWeight: '400' }}>{` ${p.unit}`}</Text> : null}
            </React.Fragment>
          ))}
        </Text>
        <Text numberOfLines={1} style={{ color: C.textDim, fontSize: type.line, lineHeight: lh(type.line), fontWeight: '400' }}>
          {words.line}
        </Text>
      </View>
    </Pressable>
  );
}
