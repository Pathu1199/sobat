import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { slotBefore, undoSteps } from '../core/addSheet';
import { firstTap, tapPlanAt } from '../core/reminders';
import { runUndo } from '../core/undo';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useFeedback } from './feedback';
import { clearLastTap, dismiss, lastTap, onTap, type TapResponse } from './notify';
import { useReminderGate } from './useScheduledReminders';

// Every tap acted on since the app started, one per delivery (`TapResponse.key`). Kept outside the hook: the shell remounts
// (the theme, a sign-in), and a tap that started the app can be read at start and still reach the listener after. This
// only saves a second toast: what stops a tap handed over again from logging twice is the slot itself. On Android a JS
// reload (a development build only) empties this while the tap that started the app can be handed over again; the meal
// it logged is on the record, its slot settled, so `promptOutcome` finds nothing to do (a new log would carry a new id,
// so no id check could catch it).
let handled: ReadonlySet<string> = new Set();

/**
 * Acts on a tap on a notification. The body opens the page it is about:
 * Today on that day for a meal-time prompt or "fill in yesterday", next
 * week's plan, or Progress for the report; a daily one opens its own page
 * (the check-in, and Today for the rest, the day's line included).
 * "Ate as planned" logs that date's slot from its plan through the store
 * (database calories, with an Undo), or confirms the meal the app filled in
 * meanwhile, or does nothing for a slot already settled; it says which,
 * takes the notification off the tray, and opens Today on that day. All of
 * it is worked out on the date the clock shows when the tap arrives
 * (`tapPlanAt`), never the store's, which can still be yesterday's on an app
 * the tap has just woken. A day still to come gets nothing logged. A tap that
 * launched the app is read once the store and the session are known; later
 * ones come through the listener; the same delivery read both ways is acted
 * on once (`firstTap`), and a tap that comes again however it comes never
 * logs twice, as its slot is settled by then (`promptOutcome`). A tap
 * made while nobody is signed in, or on a device that was reset, is forgotten,
 * never acted on at the next sign-in. Not on the web, which keeps its in-app
 * prompts.
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
    if (Platform.OS === 'web' || !known) return;
    if (!active) {
      // Nobody's data here: a tap made now belongs to no one, so it is forgotten rather than kept for the next sign-in.
      clearLastTap();
      return onTap(() => clearLastTap());
    }
    const handle = (r: TapResponse) => {
      // Forgotten at once, so a remount does not read it again; acted on once, however many times it arrives.
      clearLastTap();
      const seen = firstTap(handled, r.key);
      if (!seen) return;
      handled = seen;
      const { app: a, fb: f } = latest.current;
      const t = makeT(a.state.profile.lang);
      const plan = tapPlanAt({ action: r.action, data: r.data, now: new Date(), menuOn: a.menuOn, state: a.state });
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
