import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useReducedMotion } from '../ui/animated';
import { C, F } from '../ui/theme';

/**
 * Small moving pictures for a break: something to do with the eyes or the
 * neck instead of staring at a countdown. Pure Animated, so they run the
 * same on the web and on a phone; still under reduced motion.
 */

/** A dot drifting in a slow figure of eight. Eyes follow it, head still. */
export function FollowDot({ width, label }: { width: number; label: string }) {
  const reduce = useReducedMotion();
  const [tv] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(tv, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [tv, reduce]);
  const w = Math.min(width - 48, 420);
  const h = Math.round(w * 0.42);
  // A Lissajous path sampled into keyframes: x once around, y twice.
  const steps = 48;
  const input = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  const x = tv.interpolate({ inputRange: input, outputRange: input.map((p) => (w / 2 - 14) * Math.sin(2 * Math.PI * p)) });
  const y = tv.interpolate({ inputRange: input, outputRange: input.map((p) => (h / 2 - 14) * Math.sin(4 * Math.PI * p)) });
  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View style={{ width: w, height: h, borderRadius: 24, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Animated.View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: C.cyan, transform: [{ translateX: x }, { translateY: y }] }}>
          <View style={{ position: 'absolute', left: -9, top: -9, width: 40, height: 40, borderRadius: 20, backgroundColor: C.cyan, opacity: 0.18 }} />
        </Animated.View>
      </View>
      <Text style={{ color: C.textDim, fontSize: F.body, textAlign: 'center', paddingHorizontal: 24 }}>{label}</Text>
    </View>
  );
}

/** An eye that closes and opens on a slow beat: ten real blinks. */
export function Blink({ label }: { label: string }) {
  const reduce = useReducedMotion();
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(v, { toValue: 0.06, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduce]);
  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <Animated.View style={{ width: 120, height: 64, borderRadius: 60, backgroundColor: C.card, borderWidth: 2, borderColor: C.textFaint, alignItems: 'center', justifyContent: 'center', transform: [{ scaleY: v }] }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.accent }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.bg, margin: 10 }} />
        </View>
      </Animated.View>
      <Text style={{ color: C.textDim, fontSize: F.body, textAlign: 'center', paddingHorizontal: 24 }}>{label}</Text>
    </View>
  );
}

/** A head tilting ear to shoulder, slowly, each side. */
export function NeckTilt({ label }: { label: string }) {
  const reduce = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(v, { toValue: -1, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(v, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduce]);
  const rotate = v.interpolate({ inputRange: [-1, 1], outputRange: ['-22deg', '22deg'] });
  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View style={{ alignItems: 'center', height: 150, justifyContent: 'flex-end' }}>
        <Animated.View style={{ alignItems: 'center', transform: [{ rotate }] }}>
          <View style={{ width: 64, height: 76, borderRadius: 32, backgroundColor: C.card, borderWidth: 2, borderColor: C.textFaint }} />
          <View style={{ width: 22, height: 18, backgroundColor: C.card, borderLeftWidth: 2, borderRightWidth: 2, borderColor: C.textFaint, marginTop: -2 }} />
        </Animated.View>
        <View style={{ width: 170, height: 26, borderTopLeftRadius: 40, borderTopRightRadius: 40, backgroundColor: C.card, borderWidth: 2, borderBottomWidth: 0, borderColor: C.textFaint, marginTop: -2 }} />
      </View>
      <Text style={{ color: C.textDim, fontSize: F.body, textAlign: 'center', paddingHorizontal: 24 }}>{label}</Text>
    </View>
  );
}

/** Shoulders rolling: a ring with a travelling spot, one circle per two seconds. */
export function ShoulderRoll({ label }: { label: string }) {
  const reduce = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, reduce]);
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 28 }}>
        {[0, 1].map((i) => (
          <Animated.View key={i} style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: C.border, transform: [{ rotate }, { scaleX: i === 0 ? 1 : -1 }] }}>
            <View style={{ position: 'absolute', top: -7, left: 29, width: 14, height: 14, borderRadius: 7, backgroundColor: C.accent }} />
          </Animated.View>
        ))}
      </View>
      <Text style={{ color: C.textDim, fontSize: F.body, textAlign: 'center', paddingHorizontal: 24 }}>{label}</Text>
    </View>
  );
}
