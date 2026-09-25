import type { NudgeLog } from './types';

export type NudgeType = 'water' | 'stand' | 'eyes' | 'posture' | 'breathe' | 'progress' | 'log';

export type NudgeContext = {
  hour: number;
  minute: number;
  idleSeconds: number;
  sittingMinutes: number;
  waterMl: number;
  waterGoalMl: number;
  lastMealHoursAgo: number | null;
  todayNudges: NudgeLog[];
  quietStartHour: number;
  quietEndHour: number;
  enabled: boolean;
};

export type NudgeChoice = { type: NudgeType; microTaskSeconds: number } | null;

const IDLE_SKIP_SECONDS = 300;

export function inQuietHours(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  // Quiet window normally wraps midnight, e.g. 22 to 7.
  if (startHour > endHour) return hour >= startHour || hour < endHour;
  return hour >= startHour && hour < endHour;
}

/** How many times this nudge type was skipped in a row today. */
export function skipStreak(logs: NudgeLog[], type: NudgeType): number {
  const forType = logs.filter((l) => l.type === type);
  let n = 0;
  for (let i = forType.length - 1; i >= 0; i--) {
    if (forType[i].action === 'skip') n++;
    else break;
  }
  return n;
}

/**
 * Picks one nudge by priority, or nothing at all. Returning null often is
 * the point: an app that interrupts every 30 minutes gets uninstalled.
 */
export function pickNudge(ctx: NudgeContext): NudgeChoice {
  if (!ctx.enabled) return null;
  if (inQuietHours(ctx.hour, ctx.quietStartHour, ctx.quietEndHour)) return null;
  if (ctx.idleSeconds > IDLE_SKIP_SECONDS) return null;

  const waterBehind = ctx.waterMl < expectedWaterByHour(ctx.hour, ctx.waterGoalMl);
  const candidates: { type: NudgeType; seconds: number; want: boolean }[] = [
    { type: 'water', seconds: 30, want: waterBehind },
    { type: 'stand', seconds: 120, want: ctx.sittingMinutes >= 90 },
    { type: 'eyes', seconds: 20, want: ctx.sittingMinutes >= 45 },
    { type: 'posture', seconds: 60, want: ctx.sittingMinutes >= 60 },
    { type: 'log', seconds: 60, want: ctx.lastMealHoursAgo !== null && ctx.lastMealHoursAgo > 5 },
    { type: 'breathe', seconds: 60, want: true },
    { type: 'progress', seconds: 30, want: true },
  ];

  for (const c of candidates) {
    if (!c.want) continue;
    // Backs off instead of nagging when this type keeps getting skipped.
    if (skipStreak(ctx.todayNudges, c.type) >= 3) continue;
    const shownRecently = ctx.todayNudges.slice(-2).some((l) => l.type === c.type);
    if (shownRecently) continue;
    return { type: c.type, microTaskSeconds: c.seconds };
  }
  return null;
}

/** Water should be spread across waking hours, not gulped at night. */
export function expectedWaterByHour(hour: number, goalMl: number): number {
  const start = 7;
  const end = 21;
  if (hour <= start) return 0;
  if (hour >= end) return goalMl;
  return Math.round(((hour - start) / (end - start)) * goalMl);
}
