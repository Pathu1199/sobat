import { useEffect, useRef } from 'react';
import { buildPushSchedule, pushStep } from '../core/pushSchedule';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { pushConfigured, stopPush, syncSchedule } from './push';
import { useReminderGate } from './useScheduledReminders';

// Sends and removals are chained, so a sign-out's removal and the next sign-in's send never cross.
let chain: Promise<void> = Promise.resolve();

/**
 * Keeps the relay's copy of the schedule current: whenever the times change,
 * the language changes, a new day begins (fresh mantras), or the day moves on
 * (a tick, a stopped timer, a meal, a skip, a bottle or a walk changes which
 * Abhyas items are done and what "Day so far" says), the app uploads again.
 * The schedule reads the date, never the clock, so it is not sent again every
 * minute; the running timer is left out for the same reason. Debounced, and
 * only while background reminders are switched on. A device that is signed
 * out or reset has its copy removed and its browser subscription dropped, so
 * the relay sends it nothing until someone is back.
 */
export function usePushSync() {
  const app = useApp();
  const { state, today, menuOn } = app;
  const configured = pushConfigured();
  const relayOn = state.settings.pushRelay;
  const { known, active } = useReminderGate();
  const lastSent = useRef<string>('');
  // Bumped by each removal, so a send already on its way cannot mark itself sent after one.
  const removals = useRef(0);

  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata';
  // Compared by value below: a render that builds the same schedule sends nothing.
  const payload = configured && relayOn && active ? JSON.stringify(buildPushSchedule(state, today, makeT(state.profile.lang), tz, menuOn(today))) : '';

  useEffect(() => {
    const step = pushStep({ configured, relayOn, known, active, payload, lastSent: lastSent.current });
    if (step === 'stop') {
      // Forget what was sent, so the next person here sends theirs even when it reads the same.
      removals.current += 1;
      lastSent.current = '';
      chain = chain.then(stopPush).catch(() => {});
      return;
    }
    if (step !== 'send') return;
    const timer = setTimeout(() => {
      const at = removals.current;
      chain = chain
        .then(() => syncSchedule(JSON.parse(payload)))
        .then((ok) => {
          if (ok && at === removals.current) lastSent.current = payload;
        })
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [configured, relayOn, known, active, payload]);
}
