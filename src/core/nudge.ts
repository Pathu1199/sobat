import { toISODate } from './date';
import type { ISODate, NudgeLog } from './types';

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
  /** A day off from logging: nothing asks for a log. */
  offDay: boolean;
};

export type NudgeChoice = { type: NudgeType; microTaskSeconds: number } | null;

const IDLE_SKIP_SECONDS = 300;

export function inQuietHours(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  // Quiet window normally wraps midnight, e.g. 22 to 7.
  if (startHour > endHour) return hour >= startHour || hour < endHour;
  return hour >= startHour && hour < endHour;
}

/**
 * How often the app may speak up on its own. One gate for every reminder, so
 * water, breaks, the coach and the office day together never exceed it: a
 * minimum gap between two notifications, a daily cap, and quiet hours.
 */
export type NotifyGate = { gapMinutes: number; maxPerDay: number; quietStartHour: number; quietEndHour: number };
/** What the gate remembers: the last one sent, and how many went out on which day. */
export type GateState = { lastAt: number; sentOn: ISODate | ''; sentCount: number };

/**
 * Whether one more reminder may go out at `now`, and the gate's record with
 * it counted; null when it may not (quiet hours, the day's cap reached, or
 * inside the gap; a 'high' one waits half the gap). The day's count is kept
 * by the person's own date, so it starts again at their midnight, not UTC's.
 */
export function gateStep(gate: NotifyGate, state: GateState, now: Date, priority?: 'high' | 'normal'): GateState | null {
  if (inQuietHours(now.getHours(), gate.quietStartHour, gate.quietEndHour)) return null;
  const today = toISODate(now);
  const count = state.sentOn === today ? state.sentCount : 0;
  if (count >= gate.maxPerDay) return null;
  const gapMs = (priority === 'high' ? gate.gapMinutes / 2 : gate.gapMinutes) * 60000;
  if (now.getTime() - state.lastAt < gapMs) return null;
  return { lastAt: now.getTime(), sentOn: today, sentCount: count + 1 };
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
    // Nothing logged by late morning, or the last meal long ago: either way, ask for a log. Never on a day off.
    { type: 'log', seconds: 60, want: !ctx.offDay && (ctx.lastMealHoursAgo === null ? ctx.hour >= 11 : ctx.lastMealHoursAgo > 5) },
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

/** The end of the waking day, 21:00: the water pace reaches the whole goal then, and from then today offers "Day looks right" as a past day does. */
export const DAY_ENDS_AT_HOUR = 21;

/** Water should be spread across waking hours, not gulped at night. */
export function expectedWaterByHour(hour: number, goalMl: number): number {
  const start = 7;
  const end = DAY_ENDS_AT_HOUR;
  if (hour <= start) return 0;
  if (hour >= end) return goalMl;
  return Math.round(((hour - start) / (end - start)) * goalMl);
}
