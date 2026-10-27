import { useSyncExternalStore } from 'react';
import { AppState as RNAppState } from 'react-native';
import { msToNextMinute, toISODate } from '../core/date';
import type { ISODate } from '../core/types';

export type Clock = { date: ISODate; hour: number };

export function readClock(now: Date = new Date()): Clock {
  return { date: toISODate(now), hour: now.getHours() };
}

/** What every clock hook reads: the minute of the day, and the date and hour as one object that changes only when they do. */
type Now = { minutes: number; clock: Clock };

let now: Now = { minutes: nowMinutes(), clock: readClock() };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let resume: { remove: () => void } | null = null;

/** Reads the clock and tells every hook when the minute, the hour or the date has moved. */
function refresh() {
  const d = new Date();
  const minutes = nowMinutes(d);
  const clock = readClock(d);
  const moved = clock.date !== now.clock.date || clock.hour !== now.clock.hour;
  if (minutes === now.minutes && !moved) return;
  now = { minutes, clock: moved ? clock : now.clock };
  for (const l of listeners) l();
}

function tick() {
  refresh();
  timer = setTimeout(tick, msToNextMinute());
}

/**
 * One timer for every screen: it runs while any hook listens and stops with
 * the last one, so all of them turn the minute together.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    timer = setTimeout(tick, msToNextMinute());
    // A sleeping laptop or a backgrounded phone can hold the timer for hours.
    // Coming back is the one moment the clock is most likely to be wrong.
    resume = RNAppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (timer) clearTimeout(timer);
      tick();
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (timer) clearTimeout(timer);
    timer = null;
    resume?.remove();
    resume = null;
  };
}

/**
 * Today's date and the current hour, as state rather than a `new Date()` read
 * during render.
 *
 * The desktop build starts with the machine and is never closed, so without
 * this the app freezes at whatever hour it last happened to re-render: at
 * midnight Today keeps showing yesterday, and the decision card keeps sizing
 * the next meal for lunch long after dinner.
 *
 * The shared timer re-measures the distance to the next minute every tick
 * rather than repeating a fixed interval, so it cannot drift, and a new object
 * is only handed out when the date or the hour actually changes — at most 24
 * renders a day, not 1440.
 */
export function useClock(): Clock {
  return useSyncExternalStore(subscribe, () => now.clock, () => now.clock);
}

export function nowMinutes(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Minutes since midnight, re-read on the minute by the same timer as the date and hour. For countdowns and "what is on now". */
export function useMinute(): number {
  return useSyncExternalStore(subscribe, () => now.minutes, () => now.minutes);
}
