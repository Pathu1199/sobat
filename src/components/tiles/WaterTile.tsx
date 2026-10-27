import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { waterLabel, waterMlOn, waterWords } from '../../core/tileText';
import { waterTile } from '../../core/tiles';
import type { ISODate } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { wavePath } from '../../ui/tileGeometry';
import { LivingTile, shownWords, type TileSize } from './LivingTile';
import { useLoop, useTileProgress } from './motion';

/** Water at about a quarter strength, so the words read over it in light and in dark. */
const WATER_ALPHA = 0.26;
/** The wave along the top of the water, in points. */
const WAVE_H = 8;

/**
 * Water, counted in bottles. One tap adds a bottle for the date shown; the
 * tank behind the words fills from the bottom toward the day's goal with a
 * gentle wave on top, and stays full with a tick once the goal is reached.
 */
export function WaterTile({ date, onAdded, onHold }: { date: ISODate; onAdded?: (id: string, ml: number) => void; onHold?: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const { bottleMl, waterGoalMl } = app.state.settings;
  const ml = waterMlOn(app.state.water, date);
  const tank = waterTile(ml, waterGoalMl, bottleMl);
  const level = useTileProgress(tank.fraction);
  const label = waterLabel(ml, waterGoalMl);
  return (
    <LivingTile
      icon="water"
      tint={C.cyan}
      name={t('water')}
      words={shownWords(waterWords(ml, waterGoalMl, bottleMl), t)}
      done={tank.reached}
      behind={(size) => <WaterTank size={size} level={level} waving={tank.fraction > 0 && tank.fraction < 1} />}
      onPress={() => {
        const id = app.addWater(bottleMl, date);
        fb.haptic('light');
        onAdded?.(id, bottleMl);
      }}
      onLongPress={onHold}
      label={fill(t(label.key), label.params ?? {})}
      hint={onHold ? t('tile_hint_water') : undefined}
      holdLabel={onHold ? t('tile_hold_water') : undefined}
    />
  );
}

/** The water: a column that rises with the level, its top a wave sliding sideways one tile width per loop. */
function WaterTank({ size, level, waving }: { size: TileSize; level: SharedValue<number>; waving: boolean }) {
  const loop = useLoop(waving, 2600);
  // Empty: the column sits just below the tile. Full: the wave rises out of sight and the water fills it.
  const column = useAnimatedStyle(() => ({ transform: [{ translateY: size.h * (1 - level.get()) - WAVE_H * Math.min(1, level.get() * 20) }] }));
  const wave = useAnimatedStyle(() => ({ transform: [{ translateX: -size.w * loop.get() }] }));
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: size.w, height: size.h, overflow: 'hidden', pointerEvents: 'none' }}>
      <Animated.View style={[{ width: size.w, height: size.h + WAVE_H }, column]}>
        <Animated.View style={[{ width: size.w * 2, height: WAVE_H }, wave]}>
          <Svg width={size.w * 2} height={WAVE_H}>
            <Path d={wavePath(size.w * 2, size.w / 2, 3, WAVE_H)} fill={C.cyan} fillOpacity={WATER_ALPHA} />
          </Svg>
        </Animated.View>
        <View style={{ width: size.w, height: size.h, backgroundColor: C.cyan, opacity: WATER_ALPHA }} />
      </Animated.View>
    </View>
  );
}
