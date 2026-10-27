import { useRouter } from 'expo-router';
import React from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Circle, Path } from 'react-native-svg';
import { SLEEP_TARGET_MIN, sleepWords } from '../../core/tileText';
import { sleepFraction } from '../../core/tiles';
import type { ISODate } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { NIGHT_ARC, polylineLength, STARS, starOpacity, toPath } from '../../ui/tileGeometry';
import { LivingTile, shownWords, TileArt } from './LivingTile';
import { useLoop, useTileProgress } from './motion';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const ARC_D = toPath(NIGHT_ARC);
const ARC_LEN = polylineLength(NIGHT_ARC);

/** Sleep: the night arc fills to hours slept over eight, with three faint stars that twinkle. A tap opens the sleep check-in. */
export function SleepTile({ date }: { date: ISODate }) {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const minutes = app.state.sleep.find((s) => s.date === date)?.minutes ?? null;
  const words = shownWords(sleepWords(minutes), t);
  const level = useTileProgress(sleepFraction(minutes ?? 0, SLEEP_TARGET_MIN));
  const name = t('sleep_title');
  return (
    <LivingTile
      icon="moon"
      tint={C.violet}
      name={name}
      words={words}
      done={(minutes ?? 0) >= SLEEP_TARGET_MIN}
      art={<SleepArt level={level} />}
      onPress={() => router.push('/sleep')}
      label={fill(t('tile_open_a11y'), { name, value: words.value, line: words.line })}
      hint={t('tile_hint_sleep')}
    />
  );
}

function SleepArt({ level }: { level: SharedValue<number> }) {
  const twinkle = useLoop(true, 2400);
  const slept = useAnimatedProps(() => ({ strokeDashoffset: ARC_LEN * (1 - level.get()) }));
  const s0 = useAnimatedProps(() => ({ opacity: starOpacity(twinkle.get(), 0) }));
  const s1 = useAnimatedProps(() => ({ opacity: starOpacity(twinkle.get(), 1) }));
  const s2 = useAnimatedProps(() => ({ opacity: starOpacity(twinkle.get(), 2) }));
  return (
    <TileArt>
      <Path d={ARC_D} stroke={C.violet} strokeOpacity={0.25} strokeWidth={3} strokeLinecap="round" fill="none" />
      <APath d={ARC_D} stroke={C.violet} strokeWidth={3} strokeLinecap="round" fill="none" strokeDasharray={`${ARC_LEN} ${ARC_LEN}`} animatedProps={slept} />
      <ACircle cx={STARS[0].x} cy={STARS[0].y} r={1.6} fill={C.violet} animatedProps={s0} />
      <ACircle cx={STARS[1].x} cy={STARS[1].y} r={1.6} fill={C.violet} animatedProps={s1} />
      <ACircle cx={STARS[2].x} cy={STARS[2].y} r={1.6} fill={C.violet} animatedProps={s2} />
    </TileArt>
  );
}
