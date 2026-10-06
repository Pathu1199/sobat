import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { M } from './theme';

let cachedReduce: boolean | null = null;

/** True when the OS asks for less motion. Everything animated checks this. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(cachedReduce ?? false);
  useEffect(() => {
    if (cachedReduce !== null) return;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        cachedReduce = v;
        setReduce(v);
      })
      .catch(() => {});
  }, []);
  return reduce;
}

/**
 * A number that eases toward `target`. Rings, bars and counters render from
 * it, so they fill instead of snapping. Plain React state underneath, which is
 * why it behaves the same on the web and on Android.
 */
export function useEased(target: number, duration: number = M.slow): number {
  const reduce = useReducedMotion();
  // eslint-disable-next-line react-hooks/refs
  const value = useRef(new Animated.Value(target)).current;
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    if (reduce) {
      value.setValue(target);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrent(target);
      return;
    }
    const id = value.addListener(({ value: v }) => setCurrent(v));
    const anim = Animated.timing(value, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => {
      anim.stop();
      value.removeListener(id);
    };
  }, [target, duration, reduce, value]);

  return current;
}

/**
 * Opacity and a small rise for something that has just appeared. Cards use
 * it on mount, so a screen settles in instead of popping. Off under reduced
 * motion, where the values simply start at their final state.
 */
export function useEntrance(delayMs = 0): { opacity: Animated.Value; translateY: Animated.Value } {
  const reduce = useReducedMotion();
  // Created once per mount; state rather than a ref so render never touches a ref.
  const [{ opacity, translateY }] = useState(() => ({ opacity: new Animated.Value(reduce ? 1 : 0), translateY: new Animated.Value(reduce ? 0 : 8) }));
  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: M.base, delay: delayMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: M.base, delay: delayMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduce, delayMs, opacity, translateY]);
  return { opacity, translateY };
}
