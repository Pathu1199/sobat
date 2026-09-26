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
