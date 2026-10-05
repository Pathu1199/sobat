import { useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { msToNextMinute, toISODate } from '../core/date';
import type { ISODate } from '../core/types';

export type Clock = { date: ISODate; hour: number };

export function readClock(now: Date = new Date()): Clock {
  return { date: toISODate(now), hour: now.getHours() };
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
 * The timer re-measures the distance to the next minute every tick rather than
 * repeating a fixed interval, so it cannot drift, and a new object is only
 * committed when the date or the hour actually changes — at most 24 renders a
 * day, not 1440.
 */
export function useClock(): Clock {
  const [clock, setClock] = useState<Clock>(readClock);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const sync = () => {
      const next = readClock();
      setClock((prev) => (prev.date === next.date && prev.hour === next.hour ? prev : next));
    };

    const tick = () => {
      sync();
      timer = setTimeout(tick, msToNextMinute());
    };

    timer = setTimeout(tick, msToNextMinute());

    // A sleeping laptop or a backgrounded phone can hold the timer for hours.
    // Coming back is the one moment the clock is most likely to be wrong.
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (timer) clearTimeout(timer);
      tick();
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return clock;
}
