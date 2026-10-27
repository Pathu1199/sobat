import React from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Circle, Path } from 'react-native-svg';
import { walkMinutesOn, walkWords } from '../../core/tileText';
import { walkTile } from '../../core/tiles';
import type { ISODate } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { pointAlong, polylineLength, toPath, WALK_GOAL, WALK_PATH } from '../../ui/tileGeometry';
import { LivingTile, shownWords, TileArt } from './LivingTile';
import { useTileProgress } from './motion';

/** Minutes one tap on the walk tile adds. */
export const WALK_STEP_MIN = 10;

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const WALK_D = toPath(WALK_PATH);
const WALK_LEN = polylineLength(WALK_PATH);

/**
 * Walking, in minutes toward the day's goal. One tap logs a ten-minute walk
 * for the date shown (an activity like any other, so its calories are earned
 * the usual way); the path draws itself from the start and the walker dot
 * sits on the minutes walked.
 */
export function WalkTile({ date, onAdded, onHold }: { date: ISODate; onAdded?: (id: string, minutes: number) => void; onHold?: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const goal = app.state.settings.walkGoalMin;
  const minutes = walkMinutesOn(app.state.activities ?? [], date);
  const walk = walkTile(minutes, goal);
  const level = useTileProgress(walk.fraction);
  return (
    <LivingTile
      icon="walk"
      tint={C.accent}
      name={t('tile_walk')}
      words={shownWords(walkWords(minutes, goal), t)}
      done={walk.reached}
      art={<WalkArt level={level} />}
      onPress={() => {
        const id = app.logWalk(date, WALK_STEP_MIN);
        fb.haptic('light');
        onAdded?.(id, WALK_STEP_MIN);
      }}
      onLongPress={onHold}
      label={fill(t('tile_walk_a11y'), { step: WALK_STEP_MIN, now: minutes, goal })}
      hint={onHold ? t('tile_hint_walk') : undefined}
      holdLabel={onHold ? t('tile_hold_walk') : undefined}
    />
  );
}

function WalkArt({ level }: { level: SharedValue<number> }) {
  const walked = useAnimatedProps(() => ({ strokeDashoffset: WALK_LEN * (1 - level.get()) }));
  const walker = useAnimatedProps(() => {
    const p = pointAlong(WALK_PATH, level.get());
    return { cx: p.x, cy: p.y };
  });
  return (
    <TileArt>
      <Path d={WALK_D} stroke={C.accent} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" fill="none" />
      <APath d={WALK_D} stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" fill="none" strokeDasharray={`${WALK_LEN} ${WALK_LEN}`} animatedProps={walked} />
      <Circle cx={WALK_GOAL.x} cy={WALK_GOAL.y} r={5} stroke={C.accent} strokeWidth={2} fill={C.accent} fillOpacity={0.25} />
      <ACircle r={3.5} fill={C.accent} animatedProps={walker} />
    </TileArt>
  );
}
