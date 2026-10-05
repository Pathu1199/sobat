import { useEffect, useRef, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import { newId } from '../core/id';
import { pickNudge, type NudgeChoice } from '../core/nudge';
import { pickMessage } from '../data/nudges';
import { useApp } from '../store/AppProvider';
import { notifyNow } from './notify';

/** One nudge on screen. `id` changes per nudge, which is what resets the toast. */
export type Nudge = { id: string; choice: NudgeChoice; title: string; body: string; task: string };

/**
 * Runs the nudge timer while the app is open. On the Windows build this is
 * the tray reminder; on Android the same rules also drive OS notifications.
 * Idle time is approximated from the last touch, so it never fires at an
 * empty desk.
 */
export function useNudges() {
  const app = useApp();
  const [current, setCurrent] = useState<Nudge | null>(null);
  // Seeded in an effect: `Date.now()` is impure and must not run in a render.
  const lastInteraction = useRef(0);
  const sittingSince = useRef(0);

  useEffect(() => {
    const now = Date.now();
    lastInteraction.current = now;
    sittingSince.current = now;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const touch = () => {
      lastInteraction.current = Date.now();
    };
    window.addEventListener('mousemove', touch);
    window.addEventListener('keydown', touch);
    window.addEventListener('click', touch);
    return () => {
      window.removeEventListener('mousemove', touch);
      window.removeEventListener('keydown', touch);
      window.removeEventListener('click', touch);
    };
  }, []);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') lastInteraction.current = Date.now();
    });
    return () => sub.remove();
  }, []);

  const { nudgeMinutes, nudgesEnabled, quietStartHour, quietEndHour, waterGoalMl } = app.state.settings;

  useEffect(() => {
    if (!nudgesEnabled) return;
    const every = Math.max(1, nudgeMinutes) * 60 * 1000;
    const timer = setInterval(() => {
      const now = new Date();
      const todayNudges = app.state.nudges.filter((n) => n.date === app.today);
      const lastMeal = [...app.state.meals].filter((m) => m.date === app.today).slice(-1)[0];
      const choice = pickNudge({
        hour: now.getHours(),
        minute: now.getMinutes(),
        idleSeconds: Math.round((Date.now() - lastInteraction.current) / 1000),
        sittingMinutes: Math.round((Date.now() - sittingSince.current) / 60000),
        waterMl: app.waterToday,
        waterGoalMl,
        lastMealHoursAgo: lastMeal ? (Date.now() - new Date(lastMeal.at).getTime()) / 3600000 : null,
        todayNudges,
        quietStartHour,
        quietEndHour,
        enabled: nudgesEnabled,
      });
      if (!choice) return;
      const msg = pickMessage(app.state.profile.lang, choice.type);
      setCurrent({ id: newId(), choice, ...msg });
      notifyNow(msg.title, msg.body).catch(() => {});
    }, every);
    return () => clearInterval(timer);
  }, [nudgeMinutes, nudgesEnabled, quietStartHour, quietEndHour, waterGoalMl, app.state.nudges, app.state.meals, app.waterToday, app.today, app.state.profile.lang]);

  function respond(action: 'done' | 'snooze' | 'skip') {
    if (!current?.choice) return;
    app.logNudge(current.choice.type, action);
    if (action === 'done') {
      if (current.choice.type === 'water') app.addWater(app.state.settings.glassMl);
      sittingSince.current = Date.now();
    }
    setCurrent(null);
  }

  return { current, respond, dismiss: () => setCurrent(null) };
}
