import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Circle, Line, Path } from 'react-native-svg';
import { KCAL_FLOOR } from '../../core/nutrition';
import { bestStreak, streakWords } from '../../core/tileText';
import { streakFraction } from '../../core/tiles';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { FLAG_D, FLAG_TOP, MOUNTAIN, pointAlong, polylineLength, RIDGE, SUMMIT, toPath } from '../../ui/tileGeometry';
import { LivingTile, shownWords, TileArt } from './LivingTile';
import { useTileProgress } from './motion';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const MOUNTAIN_D = `${toPath(MOUNTAIN)} Z`;
const RIDGE_D = toPath(RIDGE);
const RIDGE_LEN = polylineLength(RIDGE);

/**
 * Streak: a mountain with the flag on its summit; the climbed part of the
 * ridge is drawn and the climber sits on today's streak, at the top at the
 * best one. The best run is judged by the streak's own rule, with the
 * person's safe minimum.
 */
export function StreakTile() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const { state, today, streakDays, menuOn } = app;
  const best = useMemo(
    () =>
      bestStreak({
        today,
        menuOn,
        routine: state.routine,
        meals: state.meals,
        skips: state.slotSkips,
        offDays: state.settings.offDays ?? [],
        floor: KCAL_FLOOR[state.profile.sex],
      }),
    [today, menuOn, state.routine, state.meals, state.slotSkips, state.settings.offDays, state.profile.sex],
  );
  const words = shownWords(streakWords(streakDays, best), t);
  const level = useTileProgress(streakFraction(streakDays, best));
  const name = t('tile_streak');
  return (
    <LivingTile
      icon="flame"
      tint={C.amber}
      name={name}
      words={words}
      art={<StreakArt level={level} />}
      onPress={() => router.push('/progress')}
      label={fill(t('tile_open_a11y'), { name, value: words.value, line: words.line })}
      hint={t('tile_hint_streak')}
    />
  );
}

function StreakArt({ level }: { level: SharedValue<number> }) {
  const climbed = useAnimatedProps(() => ({ strokeDashoffset: RIDGE_LEN * (1 - level.get()) }));
  const climber = useAnimatedProps(() => {
    const p = pointAlong(RIDGE, level.get());
    return { cx: p.x, cy: p.y };
  });
  return (
    <TileArt>
      <Path d={MOUNTAIN_D} fill={C.amber} fillOpacity={0.25} />
      <APath d={RIDGE_D} stroke={C.amber} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={`${RIDGE_LEN} ${RIDGE_LEN}`} animatedProps={climbed} />
      <Line x1={SUMMIT.x} y1={SUMMIT.y} x2={FLAG_TOP.x} y2={FLAG_TOP.y} stroke={C.amber} strokeWidth={1.5} />
      <Path d={FLAG_D} fill={C.amber} />
      <ACircle r={3.5} fill={C.amber} stroke={C.card} strokeWidth={1.5} animatedProps={climber} />
    </TileArt>
  );
}
