import React, { useEffect, useState } from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { Circle } from 'react-native-svg';
import { BREATHE_HALF_MS, breathePhase, breatheWords } from '../../core/tileText';
import { fill, makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { BREATHE_CENTRE, BREATHE_MAX_R, BREATHE_MIN_R } from '../../ui/tileGeometry';
import { LivingTile, shownWords, TileArt } from './LivingTile';
import { useBreath } from './motion';

const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * Breathe: a tap starts eight slow breaths, about a minute, and another stops
 * it. The circle grows for four seconds and shrinks for four while the number
 * counts down and the line says in or out; the session ends on a breath out,
 * and a stopped one eases back to small. With reduce motion on, the words
 * alone lead the breath.
 */
export function BreatheTile() {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => {
      const n = Date.now();
      // One rule for the end: the same phase the words read.
      if (breathePhase(n - startedAt).done) setStartedAt(null);
      else setNow(n);
    }, 250);
    return () => clearInterval(timer);
  }, [startedAt]);
  const running = startedAt !== null;
  const words = shownWords(breatheWords(startedAt === null ? null : Math.max(0, now - startedAt)), t);
  const breath = useBreath(running, BREATHE_HALF_MS);
  const name = t('breathe');
  return (
    <LivingTile
      icon="leaf-outline"
      tint={C.pink}
      name={name}
      words={words}
      art={<BreatheArt breath={breath} />}
      onPress={() => {
        if (running) {
          setStartedAt(null);
          return;
        }
        const n = Date.now();
        setNow(n);
        setStartedAt(n);
        fb.haptic('light');
      }}
      label={fill(t('tile_open_a11y'), { name, value: words.value, line: words.line })}
      hint={running ? t('tile_hint_breathe_stop') : t('tile_hint_breathe_start')}
    />
  );
}

function BreatheArt({ breath }: { breath: SharedValue<number> }) {
  const circle = useAnimatedProps(() => ({ r: BREATHE_MIN_R + (BREATHE_MAX_R - BREATHE_MIN_R) * breath.get() }));
  return (
    <TileArt>
      <Circle cx={BREATHE_CENTRE.x} cy={BREATHE_CENTRE.y} r={BREATHE_MAX_R} stroke={C.pink} strokeOpacity={0.25} strokeWidth={1.5} fill="none" />
      <ACircle cx={BREATHE_CENTRE.x} cy={BREATHE_CENTRE.y} fill={C.pink} fillOpacity={0.25} stroke={C.pink} strokeWidth={2} animatedProps={circle} />
    </TileArt>
  );
}
