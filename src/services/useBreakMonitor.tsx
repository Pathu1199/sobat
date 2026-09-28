import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import {
  clocksAfter,
  clocksAfterIdle,
  isPaused,
  nextDue,
  skipsLeft as computeSkipsLeft,
  suggestLongerInterval,
  takesScreen,
  type BreakClocks,
  type BreakKind,
  type ForegroundState,
} from '../core/breaks';
import { useApp } from '../store/AppProvider';
import { notifyNow } from './notify';
import { foregroundState, systemIdleSeconds } from './platform';

export type BreakPhase = 'working' | 'warning' | 'breaking';

const TICK_MS = 1000;
/** How long before a screen-taking break the warning toast appears. */
const WARNING_SECONDS = 60;
const KINDS: BreakKind[] = ['micro', 'long', 'posture', 'blink'];

/**
 * One clock for the whole app, mounted by BreakMonitorProvider. Each second it
 * builds a context from the store and the platform, asks the rules what is due,
 * and reacts. All the judgement lives in src/core/breaks.ts.
 */
function useBreakClock() {
  const app = useApp();
  const settings = app.state.breakSettings;

  const [phase, setPhase] = useState<BreakPhase>('working');
  const [kind, setKind] = useState<BreakKind | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(Infinity);
  const [nextKind, setNextKind] = useState<BreakKind | null>(null);
  const [paused, setPaused] = useState(false);

  const mountedAt = Date.now();
  const clocks = useRef<BreakClocks>({ micro: mountedAt, long: mountedAt, posture: mountedAt, blink: mountedAt });
  const breakStartedAt = useRef<number | null>(null);
  const runningKind = useRef<BreakKind | null>(null);
  const lastActivity = useRef(Date.now());
  const warnedFor = useRef<BreakKind | null>(null);
  const systemIdle = useRef<number | null>(null);
  const foreground = useRef<ForegroundState | null>(null);
  /** While a toast-only nudge is on screen, no other break is offered. */
  const nudgeUntil = useRef<number | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any input counts as being at the desk.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, touch));
  }, []);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') lastActivity.current = Date.now();
    });
    return () => sub.remove();
  }, []);

  // The shell knows real system idle time and what is in front. Off the shell
  // both stay null and the rules fall back to what the window can see.
  useEffect(() => {
    const id = setInterval(() => {
      systemIdleSeconds()
        .then((v) => {
          systemIdle.current = v;
        })
        .catch(() => {});
      foregroundState()
        .then((v) => {
          foreground.current = v;
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const logsToday = useMemo(() => app.state.breaks.filter((b) => b.date === app.today), [app.state.breaks, app.today]);

  const buildCtx = useCallback(
    (now: number) => {
      const windowIdle = Math.round((now - lastActivity.current) / 1000);
      const d = new Date(now);
      return {
        nowMs: now,
        clocks: clocks.current,
        idleSeconds: systemIdle.current ?? windowIdle,
        hour: d.getHours(),
        weekday: d.getDay(),
        settings,
        foreground: foreground.current,
        logsToday,
      };
    },
    [settings, logsToday],
  );

  /** End the running break, write it down, and restart the right clocks. */
  const endBreak = useCallback(
    (action: 'taken' | 'skipped') => {
      const now = Date.now();
      const k = runningKind.current ?? 'micro';
      const workedMinutes = Math.max(0, (breakStartedAt.current ?? now) - clocks.current[k]) / 60000;
      app.logBreak(k, action, workedMinutes, settings[k].seconds);
      clocks.current = clocksAfter(k, clocks.current, now);
      breakStartedAt.current = null;
      runningKind.current = null;
      warnedFor.current = null;
      setKind(null);
      setPhase('working');
    },
    [app, settings],
  );

  /** Start a break of this kind right now. */
  const start = useCallback((k: BreakKind, now: number) => {
    breakStartedAt.current = now;
    runningKind.current = k;
    setKind(k);
    setPhase('breaking');
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();

      // A break is running: count it down and stop there.
      if (breakStartedAt.current !== null && runningKind.current !== null) {
        const total = settings[runningKind.current].seconds;
        setRemaining(Math.max(0, Math.ceil((breakStartedAt.current + total * 1000 - now) / 1000)));
        return;
      }

      // A toast-only nudge is showing; let it finish before offering another.
      if (nudgeUntil.current !== null) {
        if (now < nudgeUntil.current) return;
        nudgeUntil.current = null;
      }

      const ctx = buildCtx(now);

      // Stepping away already gave the rest, so restart the clocks it earned.
      const rested = clocksAfterIdle(ctx);
      if (rested) {
        clocks.current = rested;
        warnedFor.current = null;
      }

      const held = isPaused(ctx);
      setPaused(held);

      const due = nextDue(ctx);
      setNextKind(due?.kind ?? null);
      setSecondsLeft(due ? due.inSeconds : Infinity);

      if (held || !due) {
        setPhase('working');
        return;
      }

      if (due.inSeconds <= 0) {
        if (takesScreen(due.kind)) {
          start(due.kind, now);
        } else {
          // Posture and blink never take the screen. Show them, write them
          // down as taken, and restart their clock.
          const seconds = settings[due.kind].seconds;
          setKind(due.kind);
          setPhase('breaking');
          app.logBreak(due.kind, 'taken', 0, seconds);
          clocks.current = clocksAfter(due.kind, clocks.current, now);
          nudgeUntil.current = now + seconds * 1000;
          if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
          nudgeTimer.current = setTimeout(() => {
            nudgeTimer.current = null;
            setKind(null);
            setPhase('working');
          }, seconds * 1000);
        }
        return;
      }

      if (takesScreen(due.kind) && due.inSeconds <= WARNING_SECONDS) {
        if (warnedFor.current !== due.kind) {
          warnedFor.current = due.kind;
          notifyNow('Break in 1 minute', 'Finish what you are typing.').catch(() => {});
        }
        setPhase('warning');
        return;
      }

      setPhase('working');
    }, TICK_MS);
    return () => {
      clearInterval(id);
      if (nudgeTimer.current) {
        clearTimeout(nudgeTimer.current);
        nudgeTimer.current = null;
      }
      nudgeUntil.current = null;
    };
  }, [settings, buildCtx, start, app]);

  const snooze = useCallback(
    (minutes: number) => {
      const k = runningKind.current ?? nextKind ?? 'micro';
      // Push this kind's clock forward so it comes due again in `minutes`.
      const now = Date.now();
      clocks.current = { ...clocks.current, [k]: now - Math.max(0, settings[k].everyMinutes - minutes) * 60000 };
      breakStartedAt.current = null;
      runningKind.current = null;
      warnedFor.current = null;
      setKind(null);
      setPhase('working');
    },
    [settings, nextKind],
  );

  const takeNow = useCallback(
    (k: BreakKind) => {
      if (!takesScreen(k)) return;
      start(k, Date.now());
    },
    [start],
  );

  // The desktop shell fires these from global shortcuts and the tray.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const take = () => takeNow('micro');
    const pause = () => app.pauseBreaks(60);
    window.addEventListener('sobat:take-break', take);
    window.addEventListener('sobat:pause-breaks', pause);
    return () => {
      window.removeEventListener('sobat:take-break', take);
      window.removeEventListener('sobat:pause-breaks', pause);
    };
  }, [takeNow, app]);

  const suggestionCandidates = useMemo(
    () => KINDS.map((k) => ({ kind: k, minutes: suggestLongerInterval(app.state.breaks, k, settings[k].everyMinutes) })),
    [app.state.breaks, settings],
  );
  const suggestion = suggestionCandidates.find((c): c is { kind: BreakKind; minutes: number } => c.minutes !== null) ?? null;

  return {
    phase,
    kind,
    remaining,
    secondsLeft,
    nextKind,
    enabled: settings.enabled,
    paused,
    sound: settings.sound,
    skipsLeft: computeSkipsLeft(logsToday, settings),
    takenToday: logsToday.filter((b) => b.action === 'taken').length,
    suggestion,
    finish: () => endBreak('taken'),
    skip: () => endBreak('skipped'),
    snooze,
    takeNow,
  };
}

type Monitor = ReturnType<typeof useBreakClock>;
const Ctx = createContext<Monitor | null>(null);

/** Mount once, above every screen. The clock runs here and nowhere else. */
export function BreakMonitorProvider({ children }: { children: React.ReactNode }) {
  const monitor = useBreakClock();
  return <Ctx.Provider value={monitor}>{children}</Ctx.Provider>;
}

export function useBreakMonitor(): Monitor {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBreakMonitor must be used inside BreakMonitorProvider');
  return c;
}
