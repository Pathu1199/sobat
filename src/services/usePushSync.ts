import { useEffect, useRef } from 'react';
import { buildPushSchedule } from '../core/pushSchedule';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { pushConfigured, syncSchedule } from './push';

/**
 * Keeps the relay's copy of the schedule current: whenever the times change,
 * the language changes, or a new day begins (fresh mantras), the app uploads
 * again. Debounced, and only while background reminders are switched on.
 */
export function usePushSync() {
  const app = useApp();
  const { state, today } = app;
  const enabled = state.settings.pushRelay && pushConfigured();
  const lastSent = useRef<string>('');

  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata';
  const payload = enabled ? JSON.stringify(buildPushSchedule(state, today, makeT(state.profile.lang), tz)) : '';

  useEffect(() => {
    if (!enabled || !payload || payload === lastSent.current) return;
    const timer = setTimeout(() => {
      syncSchedule(JSON.parse(payload)).then((ok) => {
        if (ok) lastSent.current = payload;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [enabled, payload]);
}
