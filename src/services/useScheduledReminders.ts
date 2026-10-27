import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { slotStates } from '../core/pattern';
import { DAILY_IDS, dailyReminders, LONG_BREAK_ID, lastLogDate, plannedReminders, type Reminder } from '../core/reminders';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { firebaseEnabled } from './firebase';
import { cancel, scheduleAt, scheduleDaily, scheduledIds, setupAndroidChannel } from './notify';
import { useAuth } from './useAuth';
import { useMantra } from './useMantra';

/** Everything planned a week ahead carries this, so it can be told apart from the daily ones. */
const PLANNED = 'sobat-r-';

/** A short signature of when and what a reminder says, so a changed slot time, name or language replaces the pending notification instead of leaving the old one. */
function signature(r: Reminder): string {
  const s = `${r.time}\n${r.title}\n${r.body}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const osId = (r: Reminder) => `${PLANNED}${r.id}@${signature(r)}`;

// Runs are chained so two never interleave their cancels and adds.
let chain: Promise<void> = Promise.resolve();
let dailyChain: Promise<void> = Promise.resolve();

/**
 * Whether this device may hold reminders, and whether that is known yet.
 * Reminders belong to a person: a device that is signed out, or reset and not
 * onboarded again, holds none, so nothing keeps pinging after either. Not
 * known until the store has loaded and the session has been reported; a store
 * that failed to load is never taken as the person's.
 */
export function useReminderGate(): { known: boolean; active: boolean } {
  const { ready, storageError, state } = useApp();
  const { user, ready: authReady } = useAuth();
  const known = ready && storageError !== 'load' && (!firebaseEnabled || authReady);
  const active = state.profile.onboarded && (!firebaseEnabled || user !== null);
  return { known, active };
}

/**
 * Registers the reminders that must fire while the app is closed. The in-app
 * nudge timer only runs when the app is open, so on a phone these are what
 * actually reach you. The daily ones are re-registered on change; the week
 * of slot prompts and absence lines is reconciled against what the OS still
 * holds, so a logged slot's prompt is cancelled and a quiet week stays covered.
 */
export function useScheduledReminders() {
  const app = useApp();
  const { nudgesEnabled, quietStartHour, quietEndHour, offDays } = app.state.settings;
  const lang = app.state.profile.lang;
  const mantra = useMantra();
  const mantraText = mantra?.text ?? '';
  const routine = app.state.routine;
  const breakSettings = app.state.breakSettings;
  const { today, hour } = app;
  const { known, active } = useReminderGate();

  // The daily ones: whatever the plan does not hold is cancelled, so a sign-out
  // or a reset clears them and the repeating long break older builds left goes too.
  useEffect(() => {
    if (Platform.OS === 'web' || !known) return;
    const want = dailyReminders({
      active,
      nudgesEnabled,
      routineEnabled: routine.enabled,
      quietStartHour,
      quietEndHour,
      mantra: mantraText,
      breaks: breakSettings,
      nowMs: Date.now(),
      t: makeT(lang),
    });
    let stale = false;
    dailyChain = dailyChain
      .then(async () => {
        if (stale) return;
        await setupAndroidChannel();
        const ids = new Set(want.map((r) => r.id));
        for (const id of [...Object.values(DAILY_IDS), LONG_BREAK_ID]) if (!ids.has(id)) await cancel(id);
        for (const id of await scheduledIds()) if (id.startsWith(LONG_BREAK_ID) && !ids.has(id)) await cancel(id);
        for (const r of want) await scheduleDaily(r.id, r.hour, r.minute, r.title, r.body);
      })
      .catch(() => {
        // Permission refused or the OS declined. The app still works.
      });
    return () => {
      stale = true;
    };
  }, [known, active, nudgesEnabled, quietStartHour, quietEndHour, lang, breakSettings, mantraText, routine.enabled]);

  // Slots done or skipped today, as one string so the memo below only moves when the set does.
  const doneKey = useMemo(() => {
    if (!routine.enabled) return '';
    const todayMeals = app.state.meals.filter((m) => m.date === today);
    return slotStates({ routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: hour * 60, skipped: app.actionsDoneToday })
      .filter((s) => s.status === 'done' || s.status === 'skipped')
      .map((s) => s.slot.id)
      .sort()
      .join(',');
  }, [routine, app.state.meals, today, app.targets.kcal, hour, app.actionsDoneToday]);
  const lastLog = useMemo(() => lastLogDate(app.state.meals, today), [app.state.meals, today]);

  const wanted = useMemo(() => {
    if (Platform.OS === 'web' || !active || !nudgesEnabled) return [];
    return plannedReminders({
      today,
      nowMinutes: hour * 60,
      routine,
      doneSlotIds: doneKey ? doneKey.split(',') : [],
      lastLogDate: lastLog,
      offDays: offDays ?? [],
      quietStartHour,
      quietEndHour,
      lang,
      t: makeT(lang),
    });
  }, [active, nudgesEnabled, today, hour, routine, doneKey, lastLog, offDays, quietStartHour, quietEndHour, lang]);

  // Runs once the store and the session are known, whoever is there: after a sign-out or a reset `wanted` is
  // empty and the planned week is cancelled. Never on a store that failed to load, whose empty state is not the person's.
  useEffect(() => {
    if (Platform.OS === 'web' || !known) return;
    let stale = false;
    chain = chain
      .then(async () => {
        if (stale) return;
        const have = (await scheduledIds()).filter((id) => id.startsWith(PLANNED));
        const want = new Map(wanted.map((r) => [osId(r), r]));
        for (const id of have) {
          if (stale) return;
          if (!want.has(id)) await cancel(id);
        }
        const now = Date.now();
        for (const [id, r] of want) {
          if (stale) return;
          if (have.includes(id)) continue;
          const at = new Date(`${r.date}T${r.time}:00`);
          // A moment already past would fire at once; the next tick plans the rest.
          if (at.getTime() <= now) continue;
          try {
            await scheduleAt(id, at, r.title, r.body);
          } catch {
            // One refused reminder must not stop the rest.
          }
        }
      })
      .catch(() => {
        // Permission refused or the OS declined. The app still works.
      });
    return () => {
      stale = true;
    };
  }, [wanted, known]);
}
