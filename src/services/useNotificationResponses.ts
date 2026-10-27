import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { slotBefore, undoSteps } from '../core/addSheet';
import { cardsShown } from '../core/customize';
import { tapPlan } from '../core/reminders';
import { runUndo } from '../core/undo';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useFeedback } from './feedback';
import { clearLastTap, dismiss, lastTap, onTap, type TapResponse } from './notify';
import { useReminderGate } from './useScheduledReminders';

// Every tap acted on since the app started, one per delivery (`TapResponse.key`). Kept outside the hook: the shell remounts
// (the theme, a sign-in), and a tap that started the app can be read at start and still reach the listener after.
const handled = new Set<string>();

/**
 * Acts on a tap on a notification. The body opens the page it is about:
 * Today on that day for a meal-time prompt or "fill in yesterday", next
 * week's plan, or Progress for the report; a daily one opens its own page
 * (the check-in, the day's line where it is shown, Today for the rest).
 * "Ate as planned" logs that date's slot from its plan through the store
 * (database calories, with an Undo), or confirms the meal the app filled in
 * meanwhile, or does nothing for a slot already settled; it says which,
 * takes the notification off the tray, and opens Today on that day
 * (`tapPlan`). A day still to come gets nothing
 * logged. A tap that launched the app is read once the store and the session
 * are known; later ones come through the listener; each is acted on once.
 * Never on a device that holds nobody's data, and not on the web, which keeps
 * its in-app prompts.
 */
export function useNotificationResponses() {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const { known, active } = useReminderGate();
  // The store as it is now, for a listener registered once.
  const latest = useRef({ app, fb });
  useEffect(() => {
    latest.current = { app, fb };
  });

  useEffect(() => {
    if (Platform.OS === 'web' || !known || !active) return;
    const handle = (r: TapResponse) => {
      // Forgotten at once, so a remount does not read it again; acted on once, however many times it arrives.
      clearLastTap();
      if (handled.has(r.key)) return;
      handled.add(r.key);
      const { app: a, fb: f } = latest.current;
      const t = makeT(a.state.profile.lang);
      const { todayCards, features } = a.state.settings;
      const mantraOnToday = cardsShown(todayCards, features.mantra).on.some((c) => c.id === 'mantra');
      const plan = tapPlan({ action: r.action, data: r.data, today: a.today, menuOn: a.menuOn, meals: a.state.meals, skips: a.state.slotSkips, mantraOnToday });
      if (plan.ate) {
        const { date, slotId, outcome } = plan.ate;
        if (outcome.kind === 'log') {
          const before = slotBefore(a.state, date, slotId);
          const id = a.addMealFromPlan(date, slotId);
          // Refused by the store (nothing to log after all): nothing is said.
          if (id !== null) f.notify(t('prompt_logged'), { label: t('undo'), onPress: () => runUndo(latest.current.app, undoSteps({ id, date, slotId, ...before })) });
        } else if (outcome.kind === 'confirm') {
          a.confirmMeal(outcome.mealId);
          f.notify(t('prompt_logged'));
        } else {
          f.notify(t('prompt_already'));
        }
        void dismiss(r.id);
      }
      router.navigate(plan.route as never);
    };
    const first = lastTap();
    if (first) handle(first);
    return onTap(handle);
  }, [known, active, router]);
}
