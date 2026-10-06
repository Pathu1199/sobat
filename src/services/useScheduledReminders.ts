import { useEffect } from 'react';
import { Platform } from 'react-native';
import { cancel, scheduleDaily, scheduleRepeating, setupAndroidChannel } from './notify';
import { useApp } from '../store/AppProvider';
import { makeT } from '../i18n';
import { useMantra } from './useMantra';

const IDS = {
  sleep: 'sobat-sleep-checkin',
  water: 'sobat-water',
  dinner: 'sobat-dinner',
  review: 'sobat-day-review',
  long: 'sobat-long-break',
  mantra: 'sobat-mantra',
};

/**
 * Registers the reminders that must fire while the app is closed. The in-app
 * nudge timer only runs when the app is open, so on a phone these are what
 * actually reach you.
 */
export function useScheduledReminders() {
  const app = useApp();
  const { nudgesEnabled, waterGoalMl, quietStartHour } = app.state.settings;
  const lang = app.state.profile.lang;
  const onboarded = app.state.profile.onboarded;
  const mantra = useMantra();
  const mantraText = mantra?.text ?? '';

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
      // Nudge dinner earlier than the quiet hours start.
      await scheduleDaily(IDS.dinner, Math.max(18, quietStartHour - 3), 30, t('dinner'), t('act_light_dinner'));
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
  }, [nudgesEnabled, waterGoalMl, quietStartHour, lang, onboarded, app.state.breakSettings, mantraText]);
}
