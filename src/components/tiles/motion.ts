import { useEffect } from 'react';
import { cancelAnimation, Easing, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { restOfSweep } from '../../ui/tileGeometry';

/**
 * How the living tiles move. A change eases in within the 1.1 s a tile may
 * take, on one ease-out curve; a tap made while it moves only moves the
 * target, so taps add up and the art catches up. Only the water wave, the
 * sleep stars and a breathing session loop. With reduce motion on (read once,
 * at start, by Reanimated), nothing loops and values land at once. Shared
 * values are written with set() in effects and read with get() in worklets,
 * never with .value and never during render, as the React Compiler needs.
 */
export const TILE_MS = 900;

const EASE = { duration: TILE_MS, easing: Easing.out(Easing.cubic) };

/** A fill or a drawn line, 0 to 1: from 0 when the tile first appears, then easing to each new target. */
export function useTileProgress(target: number): SharedValue<number> {
  const reduce = useReducedMotion();
  const v = useSharedValue(reduce ? target : 0);
  useEffect(() => {
    v.set(reduce ? target : withTiming(target, EASE));
  }, [target, reduce, v]);
  return v;
}

/** A line that draws itself, 0 to 1, again each time `key` changes (the weight line when a weigh-in is added). */
export function useDrawOn(key: string): SharedValue<number> {
  const reduce = useReducedMotion();
  const v = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    v.set(reduce ? 1 : withSequence(withTiming(0, { duration: 0 }), withTiming(1, EASE)));
  }, [key, reduce, v]);
  return v;
}

/**
 * 0 to 1 over `ms`, again and again, while `active`; always still at 0 under
 * reduce motion. It never jumps: when it stops, it runs out the sweep under
 * way to its end (1, the same picture as 0) and rests there; when it starts
 * again it carries on from where it stands.
 */
export function useLoop(active: boolean, ms: number): SharedValue<number> {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const { from, duration } = restOfSweep(v.get(), ms);
    // Stopped and at rest: nothing under way to finish.
    if (!active && from === 0) return;
    const sweep = { duration: ms, easing: Easing.linear };
    const rest = withTiming(1, { duration, easing: Easing.linear });
    v.set(from);
    v.set(active ? withSequence(rest, withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, sweep)), -1, false)) : rest);
    return () => cancelAnimation(v);
  }, [active, reduce, ms, v]);
  return v;
}

/** A breath: 0 to 1 over `halfMs` and back, for as long as `active`; still at 0 otherwise and under reduce motion. */
export function useBreath(active: boolean, halfMs: number): SharedValue<number> {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(v);
    v.set(0);
    if (!active || reduce) return;
    const half = { duration: halfMs, easing: Easing.inOut(Easing.sin) };
    v.set(withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1, false));
    return () => cancelAnimation(v);
  }, [active, reduce, halfMs, v]);
  return v;
}
