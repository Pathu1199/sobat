import type { Mantra } from '../data/mantras';
import type { Stage } from './plan';
import type { ISODate } from './types';

/**
 * Which line today. The situation picks the pool (what slipped yesterday
 * first, then the stage of the journey, then anything), and the date picks
 * inside the pool, so the line changes every day and never repeats on
 * consecutive days while the pool has more than one entry.
 */
export type MantraContext = {
  stage: Stage;
  waterLow: boolean;
  sleepShort: boolean;
  proteinLow: boolean;
  workDay: boolean;
  evening: boolean;
};

function dayIndex(date: ISODate): number {
  return Math.round(new Date(date + 'T12:00:00').getTime() / 86400000);
}

export function pickMantra(all: Mantra[], ctx: MantraContext, date: ISODate): Mantra | null {
  if (all.length === 0) return null;
  const wanted: string[] = [];
  // Yesterday's slip gets first say, but only on some days, or it would nag.
  const nag = dayIndex(date) % 2 === 0;
  if (nag && ctx.sleepShort) wanted.push('sleep');
  if (nag && ctx.waterLow) wanted.push('water');
  if (nag && ctx.proteinLow) wanted.push('protein');
  if (ctx.stage === 'slipping') wanted.push('slipping');
  if (ctx.evening) wanted.push('evening');
  wanted.push(ctx.stage);
  if (ctx.workDay) wanted.push('office');
  wanted.push('any');

  // The first tag that yields anything defines the day's own lines; 'any' widens the pool for variety.
  let specific: Mantra[] = [];
  let firstTag = '';
  for (const tag of wanted) {
    if (tag === 'any') break;
    specific = all.filter((m) => m.tags.includes(tag));
    if (specific.length > 0) {
      firstTag = tag;
      break;
    }
  }
  const general = all.filter((m) => m.tags.includes('any') && !specific.includes(m));
  const pool = [...specific, ...general];
  const day = dayIndex(date);
  if (pool.length === 0) return all[day % all.length];
  // A slip or a slipping week always gets its own line; a stage speaks on alternate
  // days and roams on the others, so the lines stay fresh.
  const urgent = ['slipping', 'sleep', 'water', 'protein'].includes(firstTag);
  if (specific.length > 0 && (urgent || day % 2 === 1)) return specific[Math.floor(day / 2) % specific.length];
  // Roaming days draw from the general lines, so two neighbouring days never say the same thing.
  const roam = general.length > 0 ? general : pool;
  return roam[(day * 7) % roam.length];
}
