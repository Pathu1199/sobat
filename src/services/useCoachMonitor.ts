import { useEffect, useRef } from 'react';
import { adviceText } from '../components/CoachStrip';
import { useCoach } from '../components/useCoach';
import { adviceToSay } from '../core/coach';
import { storyLine, storySeed, type StoryKind } from '../core/storyLines';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useFeedback } from './feedback';
import { notifyNow } from './notify';
import { useReminderGate } from './useScheduledReminders';
import { useMinute } from './useWorkSchedule';

/**
 * The coach speaking up on its own: every minute it re-reads the day, and
 * any advice that is urgent now is said once, as a toast and a notification.
 * Never in quiet hours, never twice for the same thing on the same day, and
 * never in the first minute after opening, when the screen already shows it.
 * Silent on a device that is signed out or reset: signing in counts as opening.
 */
export function useCoachMonitor() {
  const app = useApp();
  const fb = useFeedback();
  const minute = useMinute();
  const advice = useCoach(minute);
  const said = useRef<{ date: string; keys: Set<string> }>({ date: app.today, keys: new Set() });
  const first = useRef(true);
  const t = makeT(app.state.profile.lang);
  const { quietStartHour, quietEndHour, nudgesEnabled } = app.state.settings;
  const { known, active } = useReminderGate();

  useEffect(() => {
    if (!known || !active) {
      first.current = true;
      return;
    }
    if (first.current) {
      first.current = false;
      return;
    }
    if (said.current.date !== app.today) said.current = { date: app.today, keys: new Set() };
    const a = adviceToSay({ advice, said: said.current.keys, known, active, nudgesEnabled, hour: app.hour, quietStartHour, quietEndHour });
    if (!a) return;
    said.current.keys.add(a.key);
    const kind: StoryKind = a.kind === 'water' ? 'water' : a.kind === 'stop' ? 'stop' : a.kind === 'move' ? 'walk' : a.kind === 'sleep' ? 'sleep' : a.kind === 'weigh' ? 'weigh' : a.kind === 'log' ? 'log' : 'meal';
    const body = `${adviceText(a, t)} ${storyLine(kind, app.state.profile.lang, storySeed(app.today, said.current.keys.size), { consumed: app.budget.consumed, target: app.budget.target })}`;
    notifyNow(t('coach_says'), body)
      .then((sent) => {
        if (sent) fb.notify(body);
        else said.current.keys.delete(a.key);
      })
      .catch(() => {});
    // Only the minute should speak; a log landing mid-minute waits for the next tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute]);
}
