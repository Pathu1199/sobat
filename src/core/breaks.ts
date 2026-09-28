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

export function inQuiet(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
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

/** What the desktop shell can tell us about the window in front. */
export type ForegroundState = { fullscreen: boolean; exe: string; onCall: boolean };

/** When each kind's clock last restarted, in epoch ms. */
export type BreakClocks = Record<BreakKind, number>;

export type BreakContext = {
  nowMs: number;
  clocks: BreakClocks;
  idleSeconds: number;
  hour: number;
  /** 0 is Sunday, matching Date.getDay(). */
  weekday: number;
  settings: BreakSettings;
  /** Null in a browser or on a phone, where these facts are unknowable. */
  foreground: ForegroundState | null;
  logsToday: BreakLog[];
};

export type Due = { kind: BreakKind; inSeconds: number };

/** Away this long and the eyes and back have already had their rest. */
export const IDLE_RESETS_SHORT_SECONDS = 180;
/** Away this long and even the long break can start over. */
export const IDLE_RESETS_LONG_SECONDS = 300;

/** Micro and long blank the screen. Posture and blink are only a toast. */
export function takesScreen(kind: BreakKind): boolean {
  return kind === 'micro' || kind === 'long';
}

/** Longest first, so a tie is resolved in favour of the more restful break. */
const PRIORITY: BreakKind[] = ['long', 'micro', 'posture', 'blink'];

function kindSettings(s: BreakSettings, kind: BreakKind): KindSettings {
  return s[kind];
}

/**
 * The next break to offer and how long until it is due, or null when nothing
 * is scheduled. Does not consider pausing: ask `isPaused` separately, so the
 * interface can still show a countdown while a pause is in force.
 */
export function nextDue(ctx: BreakContext): Due | null {
  if (!ctx.settings.enabled) return null;
  let best: Due | null = null;
  for (const kind of PRIORITY) {
    const k = kindSettings(ctx.settings, kind);
    if (!k.enabled) continue;
    const elapsed = Math.max(0, ctx.nowMs - ctx.clocks[kind]) / 1000;
    const inSeconds = Math.max(0, Math.round(k.everyMinutes * 60 - elapsed));
    // Strictly less keeps PRIORITY's order on a tie.
    if (best === null || inSeconds < best.inSeconds) best = { kind, inSeconds };
  }
  return best;
}

/** Every reason the app should hold its tongue right now. */
export function isPaused(ctx: BreakContext): boolean {
  const s = ctx.settings;
  if (!s.enabled) return true;
  if (s.pausedUntilMs !== null && ctx.nowMs < s.pausedUntilMs) return true;
  if (inQuiet(ctx.hour, s.quietStartHour, s.quietEndHour)) return true;
  if (s.schedule) {
    const { days, startHour, endHour } = s.schedule;
    if (!days.includes(ctx.weekday)) return true;
    if (ctx.hour < startHour || ctx.hour >= endHour) return true;
  }
  const fg = ctx.foreground;
  if (fg) {
    if (s.smartPause.whenFullscreen && fg.fullscreen) return true;
    if (s.smartPause.whenOnCall && fg.onCall) return true;
    const exe = fg.exe.toLowerCase();
    if (s.smartPause.apps.some((a) => a.toLowerCase() === exe)) return true;
  }
  return false;
}

/**
 * The clocks to run after a break of this kind ends. A long break has already
 * rested the eyes and the back, so it restarts those clocks too.
 */
export function clocksAfter(kind: BreakKind, clocks: BreakClocks, nowMs: number): BreakClocks {
  if (kind === 'long') return { ...clocks, long: nowMs, micro: nowMs, posture: nowMs };
  return { ...clocks, [kind]: nowMs };
}

/** New clocks when the desk has been empty long enough to count, else null. */
export function clocksAfterIdle(ctx: BreakContext): BreakClocks | null {
  if (ctx.idleSeconds >= IDLE_RESETS_LONG_SECONDS) {
    return { micro: ctx.nowMs, long: ctx.nowMs, posture: ctx.nowMs, blink: ctx.nowMs };
  }
  if (ctx.idleSeconds >= IDLE_RESETS_SHORT_SECONDS) {
    return { ...ctx.clocks, micro: ctx.nowMs, posture: ctx.nowMs, blink: ctx.nowMs };
  }
  return null;
}

/** How many skips are left today. Infinity in gentle mode, zero in strict. */
export function skipsLeft(logsToday: BreakLog[], settings: BreakSettings): number {
  if (settings.strictness === 'gentle') return Infinity;
  if (settings.strictness === 'strict') return 0;
  const used = logsToday.filter((l) => l.action === 'skipped').length;
  return Math.max(0, settings.maxSkipsPerDay - used);
}

export function canSkip(logsToday: BreakLog[], settings: BreakSettings): boolean {
  return skipsLeft(logsToday, settings) > 0;
}

export type BreakStats = {
  taken: number;
  skipped: number;
  compliancePct: number;
  longestStretchMinutes: number;
  byKind: Record<BreakKind, { taken: number; offered: number }>;
  /** Taken over offered, counting a long break twice. 0 to 100. */
  eyeCareScore: number;
};

const KINDS: BreakKind[] = ['micro', 'long', 'posture', 'blink'];
/** A long break is worth two of anything else to the eyes. */
const WEIGHT: Record<BreakKind, number> = { micro: 1, long: 2, posture: 1, blink: 1 };

export function breakStats(logs: BreakLog[]): BreakStats {
  const byKind = Object.fromEntries(KINDS.map((k) => [k, { taken: 0, offered: 0 }])) as BreakStats['byKind'];
  let weightedTaken = 0;
  let weightedOffered = 0;
  for (const l of logs) {
    const bucket = byKind[l.kind];
    if (!bucket) continue;
    bucket.offered += 1;
    weightedOffered += WEIGHT[l.kind];
    if (l.action === 'taken') {
      bucket.taken += 1;
      weightedTaken += WEIGHT[l.kind];
    }
  }
  const taken = logs.filter((l) => l.action === 'taken').length;
  const skipped = logs.filter((l) => l.action === 'skipped').length;
  const total = taken + skipped;
  return {
    taken,
    skipped,
    compliancePct: total === 0 ? 0 : Math.round((taken / total) * 100),
    longestStretchMinutes: logs.reduce((m, l) => Math.max(m, Math.round(l.workedMinutes)), 0),
    byKind,
    eyeCareScore: weightedOffered === 0 ? 0 : Math.round((weightedTaken / weightedOffered) * 100),
  };
}

/**
 * Skipping the same kind five times running means its interval is wrong for
 * how this person works. Suggest a longer one rather than nagging on.
 */
export function suggestLongerInterval(logs: BreakLog[], kind: BreakKind, current: number): number | null {
  const forKind = logs.filter((l) => l.kind === kind);
  const recent = forKind.slice(-5);
  if (recent.length < 5) return null;
  if (!recent.every((l) => l.action === 'skipped')) return null;
  const next = Math.min(current + 15, 90);
  return next === current ? null : next;
}
