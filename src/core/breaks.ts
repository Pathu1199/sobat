/**
 * Break monitor. Starts counting when you sit down at the PC, then blanks the
 * screen for a short forced pause. Pure logic so the rules can be tested
 * without a timer or a window.
 */

export type BreakKind = 'micro' | 'long' | 'posture' | 'blink';

/** How hard the app is allowed to insist. */
export type Strictness = 'gentle' | 'normal' | 'strict';

export type KindSettings = { enabled: boolean; everyMinutes: number; seconds: number };

export type BreakSettings = {
  enabled: boolean;
  micro: KindSettings;
  long: KindSettings;
  posture: KindSettings;
  blink: KindSettings;
  strictness: Strictness;
  maxSkipsPerDay: number;
  snoozeMinutes: number[];
  smartPause: { whenFullscreen: boolean; whenOnCall: boolean; apps: string[] };
  schedule: { days: number[]; startHour: number; endHour: number } | null;
  quietStartHour: number;
  quietEndHour: number;
  sound: boolean;
  /** Epoch ms until which every break is held. Null when not paused. */
  pausedUntilMs: number | null;
};

export const DEFAULT_BREAK_SETTINGS: BreakSettings = {
  enabled: true,
  // 20-20-20: every twenty minutes, look twenty feet away for twenty seconds.
  micro: { enabled: true, everyMinutes: 20, seconds: 20 },
  long: { enabled: true, everyMinutes: 60, seconds: 180 },
  posture: { enabled: true, everyMinutes: 30, seconds: 6 },
  // Off by default: a blink prompt every ten minutes is a lot to ask for.
  blink: { enabled: false, everyMinutes: 10, seconds: 3 },
  strictness: 'normal',
  maxSkipsPerDay: 3,
  snoozeMinutes: [1, 5, 15],
  smartPause: { whenFullscreen: true, whenOnCall: true, apps: [] },
  schedule: null,
  quietStartHour: 22,
  quietEndHour: 7,
  sound: true,
  pausedUntilMs: null,
};

export type BreakPhase = 'working' | 'breaking' | 'off';

/** The shape the old single-timer rules below still expect. Task 2 removes them. */
type LegacySettings = { enabled: boolean; workMinutes: number; breakSeconds: number; allowSkip: boolean; quietStartHour: number; quietEndHour: number };

export type BreakContext = {
  nowMs: number;
  /** When the current stretch of work began: session start, or the end of the last break. */
  workingSinceMs: number;
  idleSeconds: number;
  hour: number;
  settings: LegacySettings;
};

/** Long enough away from the keyboard that the eyes already got their rest. */
export const IDLE_COUNTS_AS_BREAK_SECONDS = 180;

export function inQuiet(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}

export function workedMinutes(ctx: BreakContext): number {
  return Math.max(0, (ctx.nowMs - ctx.workingSinceMs) / 60000);
}

export function minutesUntilBreak(ctx: BreakContext): number {
  if (!ctx.settings.enabled) return Infinity;
  return Math.max(0, ctx.settings.workMinutes - workedMinutes(ctx));
}

export function shouldStartBreak(ctx: BreakContext): boolean {
  if (!ctx.settings.enabled) return false;
  if (inQuiet(ctx.hour, ctx.settings.quietStartHour, ctx.settings.quietEndHour)) return false;
  // Already away from the desk, so interrupting would be pointless.
  if (ctx.idleSeconds >= IDLE_COUNTS_AS_BREAK_SECONDS) return false;
  return workedMinutes(ctx) >= ctx.settings.workMinutes;
}

/**
 * Stepping away resets the work clock, so a natural break counts and you are
 * not ambushed the moment you come back.
 */
export function resetPointFor(ctx: BreakContext): number | null {
  if (ctx.idleSeconds >= IDLE_COUNTS_AS_BREAK_SECONDS) return ctx.nowMs;
  return null;
}

export function breakRemainingSeconds(startedMs: number, nowMs: number, breakSeconds: number): number {
  return Math.max(0, Math.ceil((startedMs + breakSeconds * 1000 - nowMs) / 1000));
}

export function isBreakOver(startedMs: number, nowMs: number, breakSeconds: number): boolean {
  return breakRemainingSeconds(startedMs, nowMs, breakSeconds) <= 0;
}

export type BreakLog = {
  id: string;
  date: string;
  at: string;
  kind: BreakKind;
  action: 'taken' | 'skipped';
  workedMinutes: number;
  seconds: number;
};

export type BreakStats = { taken: number; skipped: number; compliancePct: number; longestStretchMinutes: number };

export function breakStats(logs: BreakLog[]): BreakStats {
  const taken = logs.filter((l) => l.action === 'taken').length;
  const skipped = logs.filter((l) => l.action === 'skipped').length;
  const total = taken + skipped;
  return {
    taken,
    skipped,
    compliancePct: total === 0 ? 0 : Math.round((taken / total) * 100),
    longestStretchMinutes: logs.reduce((m, l) => Math.max(m, Math.round(l.workedMinutes)), 0),
  };
}

/**
 * Skipping every break means the interval is wrong for how this person works.
 * Suggest a longer one rather than nagging at the same rate.
 */
export function suggestLongerInterval(logs: BreakLog[], current: number): number | null {
  const recent = logs.slice(-5);
  if (recent.length < 5) return null;
  if (!recent.every((l) => l.action === 'skipped')) return null;
  const next = Math.min(current + 15, 90);
  return next === current ? null : next;
}
