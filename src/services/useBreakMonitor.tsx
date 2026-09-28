import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import {
  breakRemainingSeconds, inQuiet, isBreakOver, minutesUntilBreak, resetPointFor,
  shouldStartBreak, suggestLongerInterval, workedMinutes,
} from '../core/breaks';
import { useApp } from '../store/AppProvider';
import { notifyNow } from './notify';
import { systemIdleSeconds } from './platform';

export type BreakPhase = 'working' | 'warning' | 'breaking';

const TICK_MS = 1000;
const WARNING_SECONDS = 60;

/**
 * Starts the moment the app opens and runs for as long as it is open, which on
 * the desktop build means from when the PC starts. Counts a stretch of work,
 * warns a minute before, then takes the screen for the pause.
 */
function useBreakClock() {
  const app = useApp();
  // Task 2 replaces this loop wholesale. Until then, drive it from the micro
  // break so the app keeps running.
  const settings = app.state.breakSettings;
  const workMinutes = settings.micro.everyMinutes;
  const breakSeconds = settings.micro.seconds;
  const allowSkip = settings.strictness !== 'strict';

  const [phase, setPhase] = useState<BreakPhase>('working');
  const [remaining, setRemaining] = useState(breakSeconds);
  const [minutesLeft, setMinutesLeft] = useState(workMinutes);

  const workingSince = useRef(Date.now());
  const breakStartedAt = useRef<number | null>(null);
  const lastActivity = useRef(Date.now());
  const warnedForStretch = useRef(false);

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

  const endBreak = useCallback(
    (action: 'taken' | 'skipped') => {
      const worked = workedMinutes({
        nowMs: breakStartedAt.current ?? Date.now(),
        workingSinceMs: workingSince.current,
        idleSeconds: 0,
        hour: new Date().getHours(),
        settings: { enabled: settings.enabled, workMinutes, breakSeconds, allowSkip, quietStartHour: settings.quietStartHour, quietEndHour: settings.quietEndHour },
      });
      app.logBreak('micro', action, worked, breakSeconds);
      breakStartedAt.current = null;
      workingSince.current = Date.now();
      warnedForStretch.current = false;
      setPhase('working');
    },
    [app, settings, workMinutes, breakSeconds, allowSkip],
  );

  // On the Windows shell this is replaced every second by real system idle
  // time, so switching to another program still counts as being at the desk.
  const systemIdle = useRef<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      systemIdleSeconds()
        .then((v) => {
          systemIdle.current = v;
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const windowIdle = Math.round((now - lastActivity.current) / 1000);
      const idleSeconds = systemIdle.current ?? windowIdle;
      const hour = new Date().getHours();
      const ctx = { nowMs: now, workingSinceMs: workingSince.current, idleSeconds, hour, settings: { enabled: settings.enabled, workMinutes, breakSeconds, allowSkip, quietStartHour: settings.quietStartHour, quietEndHour: settings.quietEndHour } };

      if (breakStartedAt.current !== null) {
        setRemaining(breakRemainingSeconds(breakStartedAt.current, now, breakSeconds));
        if (isBreakOver(breakStartedAt.current, now, breakSeconds)) {
          // The pause is over, but leaving is the person's choice.
          setPhase('breaking');
        }
        return;
      }

      // Stepping away already gave the eyes their rest, so restart the clock.
      const reset = resetPointFor(ctx);
      if (reset !== null) {
        workingSince.current = reset;
        warnedForStretch.current = false;
        setMinutesLeft(workMinutes);
        setPhase('working');
        return;
      }

      if (!settings.enabled || inQuiet(hour, settings.quietStartHour, settings.quietEndHour)) {
        setPhase('working');
        return;
      }

      const left = minutesUntilBreak(ctx);
      setMinutesLeft(left);

      if (shouldStartBreak(ctx)) {
        breakStartedAt.current = now;
        setRemaining(breakSeconds);
        setPhase('breaking');
        return;
      }

      if (left * 60 <= WARNING_SECONDS) {
        if (!warnedForStretch.current) {
          warnedForStretch.current = true;
          notifyNow('Break in 1 minute', 'Finish what you are typing.').catch(() => {});
        }
        setPhase('warning');
      } else {
        setPhase('working');
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [settings, workMinutes, breakSeconds, allowSkip]);

  const snooze = useCallback(
    (minutes: number) => {
      workingSince.current = Date.now() - Math.max(0, workMinutes - minutes) * 60000;
      warnedForStretch.current = false;
      setPhase('working');
    },
    [workMinutes],
  );

  const suggestion = suggestLongerInterval(app.state.breaks, workMinutes);

  return {
    phase,
    remaining,
    minutesLeft,
    enabled: settings.enabled,
    allowSkip,
    breakSeconds,
    workMinutes,
    takenToday: app.state.breaks.filter((b) => b.date === app.today).length,
    suggestion,
    finish: () => endBreak('taken'),
    skip: () => endBreak('skipped'),
    snooze,
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
