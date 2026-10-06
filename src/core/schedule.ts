import type { ISODate } from './types';

/**
 * The shape of an office day: when work starts, the breaks, lunch, tea, and
 * when it ends. At each of those the app checks in: water, a walk, the eyes.
 * Times are "HH:MM" strings the person edits in Settings.
 */

export type BlockKind = 'start' | 'break' | 'lunch' | 'tea' | 'end';

export type ScheduleBlock = {
  id: string;
  kind: BlockKind;
  start: string;
  /** Breaks have an end; start and end of work are moments. */
  end?: string;
};

export type WorkSchedule = {
  enabled: boolean;
  /** Weekdays it applies to, 0 = Sunday as Date.getDay() counts. */
  days: number[];
  blocks: ScheduleBlock[];
};

/** What to ask about at each kind of block. Keys match i18n `chk_<key>`. */
export const CHECKINS: Record<BlockKind, string[]> = {
  start: ['water', 'breathe'],
  break: ['water', 'walk', 'eyes'],
  lunch: ['log_lunch', 'water', 'walk'],
  tea: ['water', 'walk', 'eyes'],
  end: ['walk_home', 'water', 'log_dinner'],
};

/** How long a moment (start or end of work) stays "now", in minutes. */
export const MOMENT_MINUTES = 15;

export const DEFAULT_SCHEDULE: WorkSchedule = {
  enabled: true,
  days: [1, 2, 3, 4, 5, 6],
  blocks: [
    { id: 'start', kind: 'start', start: '09:00' },
    { id: 'break1', kind: 'break', start: '09:15', end: '09:30' },
    { id: 'lunch', kind: 'lunch', start: '13:00', end: '13:30' },
    { id: 'tea', kind: 'tea', start: '15:45', end: '16:00' },
    { id: 'end', kind: 'end', start: '18:00' },
  ],
};

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function blockEnd(b: ScheduleBlock): number {
  return b.end && isValidTime(b.end) ? toMinutes(b.end) : toMinutes(b.start) + MOMENT_MINUTES;
}

export function isWorkDay(s: WorkSchedule, date: ISODate): boolean {
  return s.enabled && s.days.includes(new Date(date + 'T12:00:00').getDay());
}

/** Blocks in time order, skipping any with a broken time. */
export function orderedBlocks(s: WorkSchedule): ScheduleBlock[] {
  return s.blocks.filter((b) => isValidTime(b.start)).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/** The block happening right now, if any. */
export function activeBlock(s: WorkSchedule, date: ISODate, nowMinutes: number): ScheduleBlock | null {
  if (!isWorkDay(s, date)) return null;
  return orderedBlocks(s).find((b) => nowMinutes >= toMinutes(b.start) && nowMinutes < blockEnd(b)) ?? null;
}

/** The next block still ahead today, if any. */
export function nextBlock(s: WorkSchedule, date: ISODate, nowMinutes: number): ScheduleBlock | null {
  if (!isWorkDay(s, date)) return null;
  return orderedBlocks(s).find((b) => toMinutes(b.start) > nowMinutes) ?? null;
}

/** Blocks that began after `fromMinutes` and by `toMinutes`; what a minute tick should announce. */
export function startedBetween(s: WorkSchedule, date: ISODate, fromMinutes: number, toMinutes_: number): ScheduleBlock[] {
  if (!isWorkDay(s, date)) return [];
  return orderedBlocks(s).filter((b) => {
    const m = toMinutes(b.start);
    return m > fromMinutes && m <= toMinutes_;
  });
}

/** Minutes left in a block, never below zero. */
export function minutesLeft(b: ScheduleBlock, nowMinutes: number): number {
  return Math.max(0, blockEnd(b) - nowMinutes);
}

/** The done-key for one check-in item, scoped to the block so each break has its own ticks. */
export function checkinKey(block: ScheduleBlock, item: string): string {
  return `sched_${block.id}_${item}`;
}

export function newBreak(after: ScheduleBlock | null): ScheduleBlock {
  const start = after ? blockEnd(after) + 60 : 11 * 60;
  return { id: `b${Date.now().toString(36)}`, kind: 'break', start: fromMinutes(start), end: fromMinutes(start + 15) };
}
