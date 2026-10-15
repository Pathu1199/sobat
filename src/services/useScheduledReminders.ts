import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { slotStates } from '../core/pattern';
import { lastLogDate, plannedReminders, type Reminder } from '../core/reminders';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { cancel, scheduleAt, scheduleDaily, scheduledIds, scheduleRepeating, setupAndroidChannel } from './notify';
import { useMantra } from './useMantra';

const IDS = {
  sleep: 'sobat-sleep-checkin',
  water: 'sobat-water',
  dinner: 'sobat-dinner',
  review: 'sobat-day-review',
  long: 'sobat-long-break',
  mantra: 'sobat-mantra',
};

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

/**
 * Registers the reminders that must fire while the app is closed. The in-app
 * nudge timer only runs when the app is open, so on a phone these are what
 * actually reach you. The daily ones are re-registered on change; the week
 * of slot prompts and absence lines is reconciled against what the OS still
 * holds, so a logged slot's prompt is cancelled and a quiet week stays covered.
 */
export function useScheduledReminders() {
  const app = useApp();
  const { nudgesEnabled, waterGoalMl, quietStartHour, quietEndHour, offDays } = app.state.settings;
  const lang = app.state.profile.lang;
  const onboarded = app.state.profile.onboarded;
  const mantra = useMantra();
  const mantraText = mantra?.text ?? '';
  const routine = app.state.routine;
  const { today, hour, ready, storageError } = app;

  useEffect(() => {
    if (Platform.OS === 'web' || !onboarded) return;
    const t = makeT(lang);

    (async () => {
      await setupAndroidChannel();

      if (!nudgesEnabled) {
        await Promise.all(Object.values(IDS).map(cancel));
        return;
      }

      // Morning check-in, while last night is still fresh.
      await scheduleDaily(IDS.sleep, 7, 30, t('sleep_checkin'), t('bed_time'));
      // The day's line, at eight. Re-registered daily so it is that day's line.
      if (mantraText) await scheduleDaily(IDS.mantra, 8, 0, t('mantra_title'), mantraText);
      // A single mid-afternoon water prompt; the in-app engine handles the rest.
      await scheduleDaily(IDS.water, 15, 0, t('add_water'), t('act_drink_water'));
      // Nudge dinner earlier than the quiet hours start. With the pattern on, the dinner slot's own prompt does this.
      if (routine.enabled) await cancel(IDS.dinner);
      else await scheduleDaily(IDS.dinner, Math.max(18, quietStartHour - 3), 30, t('dinner'), t('act_light_dinner'));
      // The day recap, just before things wind down.
      await scheduleDaily(IDS.review, 21, 30, t('day_review'), t('write_review'));

      // The phone cannot blank its own screen, so a long break is a
      // notification. A repeating notification cannot respect quiet hours or a
      // schedule, so when either is in force, do not register it at all.
      const br = app.state.breakSettings;
      const paused = br.pausedUntilMs !== null && Date.now() < br.pausedUntilMs;
      if (br.enabled && br.long.enabled && !paused && br.schedule === null) {
        await scheduleRepeating(IDS.long, br.long.everyMinutes * 60, t('brk_long'), t('brk_long_hint'));
      } else {
        await cancel(IDS.long);
      }
    })().catch(() => {
      // Permission refused or the OS declined. The app still works.
    });
  }, [nudgesEnabled, waterGoalMl, quietStartHour, lang, onboarded, app.state.breakSettings, mantraText, routine.enabled]);

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
    if (Platform.OS === 'web' || !ready || !onboarded || !nudgesEnabled) return [];
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
  }, [ready, onboarded, nudgesEnabled, today, hour, routine, doneKey, lastLog, offDays, quietStartHour, quietEndHour, lang]);

  // Runs once the store is loaded, onboarded or not: after a sign-out or a reset `wanted` is empty and the
  // planned week is cancelled. Never on a store that failed to load, whose empty state is not the person's.
  useEffect(() => {
    if (Platform.OS === 'web' || !ready || storageError === 'load') return;
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
  }, [wanted, ready, storageError]);
}
