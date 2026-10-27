import React, { useState } from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Circle, Path } from 'react-native-svg';
import { weightWords } from '../../core/tileText';
import { weightPoints } from '../../core/tiles';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { ART_H, ART_W, polylineLength, toPath, type Pt } from '../../ui/tileGeometry';
import { WeightSheet } from '../WeightSheet';
import { LivingTile, shownWords, TileArt } from './LivingTile';
import { useDrawOn } from './motion';

const APath = Animated.createAnimatedComponent(Path);
/** Room around the line inside the art box, so the dot and the stroke are never cut at the edge. */
const INSET = 4;

/**
 * Weight: the last eight weigh-ins as a line that draws itself, a dot on the
 * latest. A tap opens the weight entry. The entry is a modal beside the tile,
 * not around it, so the tile sits in its row like every other.
 */
export function WeightTile() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const [open, setOpen] = useState(false);
  const { weights, profile } = app.state;
  const words = shownWords(weightWords(weights, profile.goalWeightKg, app.today), t);
  const points = weightPoints(weights, ART_W - 2 * INSET, ART_H - 2 * INSET).map((p) => ({ x: p.x + INSET, y: p.y + INSET }));
  // The line draws itself again whenever its shape changes, that is when a weigh-in is added or corrected.
  const draw = useDrawOn(toPath(points));
  const name = t('add_weight');
  return (
    <>
      <LivingTile
        icon="scale"
        tint={C.textDim}
        name={name}
        words={words}
        art={points.length > 0 ? <WeightArt points={points} draw={draw} /> : undefined}
        onPress={() => setOpen(true)}
        label={fill(t('tile_open_a11y'), { name, value: words.value, line: words.line })}
        hint={t('tile_hint_weight')}
      />
      <WeightSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function WeightArt({ points, draw }: { points: Pt[]; draw: SharedValue<number> }) {
  const len = polylineLength(points);
  const drawn = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - draw.get()) }));
  const last = points[points.length - 1];
  return (
    <TileArt>
      {points.length > 1 ? (
        <APath d={toPath(points)} stroke={C.textDim} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={`${len} ${len}`} animatedProps={drawn} />
      ) : null}
      <Circle cx={last.x} cy={last.y} r={3.5} fill={C.textDim} />
    </TileArt>
  );
}
