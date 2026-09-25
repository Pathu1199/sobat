import { lastNDates } from './date';
import type { ISODate } from './types';

/**
 * Screen-time tracking for the machine the app is open on. Stored as one
 * bucket per hour so a day is 24 small numbers, never a stream of events.
 * Nothing here leaves the device.
 */

export type UsageBucket = { date: ISODate; hour: number; activeMinutes: number };

export function addActive(buckets: UsageBucket[], date: ISODate, hour: number, minutes: number): UsageBucket[] {
  const idx = buckets.findIndex((b) => b.date === date && b.hour === hour);
  if (idx === -1) return [...buckets, { date, hour, activeMinutes: minutes }];
  const next = [...buckets];
  next[idx] = { ...next[idx], activeMinutes: Math.min(60, next[idx].activeMinutes + minutes) };
  return next;
}

export function minutesOn(buckets: UsageBucket[], date: ISODate): number {
  return Math.round(buckets.filter((b) => b.date === date).reduce((a, b) => a + b.activeMinutes, 0));
}

/** 24 numbers, midnight to midnight, for the day strip on the growth screen. */
export function hourlyProfile(buckets: UsageBucket[], date: ISODate): number[] {
  const out = new Array(24).fill(0);
  for (const b of buckets) if (b.date === date) out[b.hour] = Math.round(b.activeMinutes);
  return out;
}

/** The longest run of busy hours, which is the number that matters for your back. */
export function longestStretchMinutes(buckets: UsageBucket[], date: ISODate, busyThreshold = 30): number {
  const profile = hourlyProfile(buckets, date);
  let best = 0;
  let run = 0;
  for (const m of profile) {
    if (m >= busyThreshold) {
      run += m;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function dailySeries(buckets: UsageBucket[], days: number, end: ISODate): { date: ISODate; minutes: number }[] {
  return lastNDates(days, end).map((date) => ({ date, minutes: minutesOn(buckets, date) }));
}

export function averageMinutes(buckets: UsageBucket[], days: number, end: ISODate): number {
  const series = dailySeries(buckets, days, end).filter((d) => d.minutes > 0);
  if (series.length === 0) return 0;
  return Math.round(series.reduce((a, b) => a + b.minutes, 0) / series.length);
}

/** Drop buckets older than the retention window so storage stays small. */
export function pruneUsage(buckets: UsageBucket[], keepDays: number, today: ISODate): UsageBucket[] {
  const keep = new Set(lastNDates(keepDays, today));
  return buckets.filter((b) => keep.has(b.date));
}
