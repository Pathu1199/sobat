import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { takesScreen, type BreakKind } from '../core/breaks';
import type { Exercise } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { useReducedMotion } from '../ui/animated';
import { C, F, MICRO } from '../ui/theme';

/** Calm, low-effort moves worth doing while you are already standing. */
const LONG_BREAK_CATEGORIES = ['mobility', 'stretch', 'breathing'];

/**
 * Takes the whole screen for a micro or long break. Deliberately almost empty:
 * the point is to stop looking at it. A long break also offers two moves,
 * because three minutes standing still is harder than three minutes moving.
 */
export function BreakOverlay() {
  const monitor = useBreakMonitor();
  const app = useApp();
  const fb = useFeedback();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  // useMemo rather than useRef().current: the React Compiler rule objects to
  // reading a ref's value during render, and a memoized value is stable
  // across renders in exactly the same way for an instance that is never reassigned.
  const fade = useMemo(() => new Animated.Value(0), []);
  const breathe = useMemo(() => new Animated.Value(0), []);

  const kind: BreakKind = monitor.kind ?? 'micro';
  const showing = app.state.profile.onboarded && monitor.phase === 'breaking' && takesScreen(kind);
  const total = app.state.breakSettings[kind].seconds;
  const over = monitor.remaining <= 0;

  // Two moves, chosen once per break rather than on every tick. Breaks taken
  // so far today is already a pure, derived number that changes from break to
  // break, so it stands in for a random seed without calling an impure clock
  // during render (the React Compiler rule objects to that too).
  const seed = monitor.takenToday;

  const moves: Exercise[] = useMemo(() => {
    if (kind !== 'long') return [];
    const pool = app.exercises.filter((e) => LONG_BREAK_CATEGORIES.includes(e.category));
    if (pool.length === 0) return [];
    const a = pool[seed % pool.length];
    const b = pool[(seed + 7) % pool.length];
    return a.id === b.id ? [a] : [a, b];
  }, [kind, app.exercises, seed]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: showing ? 1 : 0,
      duration: showing ? 600 : 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [showing, fade]);

  // The ring breathes so the screen is alive without being interesting.
  useEffect(() => {
    if (!showing || reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showing, reduce, breathe]);

  if (!showing) return null;

  const size = Math.max(160, Math.min(260, Math.min(width, height) * 0.5));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? monitor.remaining / total : 0;
  const mins = Math.floor(monitor.remaining / 60);
  const secs = monitor.remaining % 60;
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const nextIn = Number.isFinite(monitor.secondsLeft) ? Math.ceil(monitor.secondsLeft / 60) : 0;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fade,
        zIndex: 999,
      }}>
      <Text style={{ color: C.textDim, fontSize: F.h2, fontWeight: '300', marginBottom: 8, textAlign: 'center', paddingHorizontal: 24, letterSpacing: -0.2 }}>
        {t(`brk_${kind}`)}
      </Text>
      <Text style={{ color: C.textFaint, fontSize: F.body, marginBottom: 36, textAlign: 'center', paddingHorizontal: 32 }}>{t(`brk_${kind}_hint`)}</Text>

      <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={kind === 'long' ? C.cyan : C.accent}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circ}`}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={{ color: C.text, fontSize: size * 0.24, fontWeight: '200', letterSpacing: -2 }}>
          {mins}:{String(secs).padStart(2, '0')}
        </Text>
      </Animated.View>

      {moves.length > 0 ? (
        <View style={{ marginTop: 36, gap: 10, paddingHorizontal: 32, maxWidth: 520 }}>
          <Text style={[MICRO, { color: C.textGhost, textAlign: 'center' }]}>{t('brk_try_these')}</Text>
          {moves.map((e) => (
            <Text key={e.id} style={{ color: C.textDim, fontSize: F.small, textAlign: 'center', lineHeight: 19 }}>
              {lang === 'mr' ? e.name_mr : lang === 'hi' ? e.name_hi : e.name_en}
              <Text style={{ color: C.textGhost }}>
                {'  '}
                {(lang === 'mr' ? e.instructions_mr : lang === 'hi' ? e.instructions_hi : e.instructions_en)[0]}
              </Text>
            </Text>
          ))}
        </View>
      ) : null}

      <View
        style={{
          position: 'absolute',
          bottom: 48,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 40,
          alignItems: 'center',
        }}>
        {!over && monitor.skipsLeft > 0 ? (
          <Pressable onPress={monitor.skip} accessibilityRole="button" accessibilityLabel={t('break_skip')}>
            <Text style={{ color: C.textFaint, fontSize: F.small }}>{t('break_skip')}</Text>
          </Pressable>
        ) : !over ? (
          <Text style={{ color: C.textGhost, fontSize: F.small }}>{monitor.skipsLeft === 0 ? t('brk_no_skips') : ''}</Text>
        ) : (
          <View />
        )}
        {over ? (
          <Pressable
            onPress={() => {
              monitor.finish();
              fb.notify(t('toast_break_done'));
            }}
            accessibilityRole="button"
            style={{ backgroundColor: C.accent, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999 }}>
            <Text style={{ color: C.white, fontSize: F.body, fontWeight: '600' }}>{t('break_done')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <Text style={[MICRO, { position: 'absolute', top: 30, right: 30, color: C.textGhost }]}>
        {fill(t('brk_counter'), {
          kind: t(`brk_${kind}`),
          n: monitor.takenToday + 1,
          next: monitor.nextKind ? t(`brk_${monitor.nextKind}`) : '—',
          m: nextIn,
        })}
      </Text>
    </Animated.View>
  );
}
