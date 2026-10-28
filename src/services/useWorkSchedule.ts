import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { settledSlotIds, slotStates } from '../core/pattern';
import { promptDue, slotPlans } from '../core/reminders';
import { slotLabel, slotsDueBetween } from '../core/routine';
import { startedBetween } from '../core/schedule';
import { storyLine, storySeed, type StoryKind } from '../core/storyLines';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useFeedback } from './feedback';
import { notifyNow } from './notify';
import { useMinute } from './useClock';
import { useReminderGate } from './useScheduledReminders';

// The minute clock lives beside the hour clock, where the store can read it too; the screens still import it from here.
export { useMinute } from './useClock';

/**
 * What the app says on its own from the minute tick, on the web and the PC
 * only: the start of each block of the office day, and the meal-time prompt
 * for a slot whose time has passed with nothing logged. A phone has both from
 * the OS (useScheduledReminders: the office day weekly on each day chosen,
 * the meal-time prompts planned ahead), app closed or not, so it never gets a
 * second copy from here. A web app cannot be woken, so there the tick is all
 * there is.
 */
export function useWorkSchedule() {
  const app = useApp();
  const fb = useFeedback();
  const { schedule, profile, routine, settings } = app.state;
  const minute = useMinute();
  const last = useRef(minute);
  const t = makeT(profile.lang);
  const { active } = useReminderGate();

  useEffect(() => {
    const from = last.current;
    last.current = minute;
    // Across midnight the minute count drops; nothing starts at that moment anyway.
    if (Platform.OS !== 'web' || minute <= from || !active) return;
    for (const b of startedBetween(schedule, app.today, from, minute)) {
      const title = t(`ntf_${b.kind}`);
      const kind: StoryKind = b.kind === 'break' ? 'break' : b.kind === 'end' ? 'walk' : b.kind === 'start' ? 'mantra' : 'meal';
      const body = `${t(`ntf_${b.kind}_body`)} ${storyLine(kind, profile.lang, storySeed(app.today, minute), { consumed: app.budget.consumed, target: app.budget.target })}`;
      // The office day is the person's own timetable: it passes the gap, not the cap.
      notifyNow(title, body, { priority: 'high' })
        .then((sent) => {
          if (sent) fb.notify(`${title} · ${body}`);
        })
        .catch(() => {});
    }
    // A slot whose time passed with nothing logged against it: ask once, log or skip. Only while the meal-time prompt is on,
    // and by the phone's rules (`promptDue`): never on a free day, on the day the person finished setup, for a slot planned
    // empty, or for one eaten or skipped.
    if (settings.reminders.mealPrompt) {
      const todayMeals = app.state.meals.filter((m) => m.date === app.today);
      const settled = settledSlotIds(slotStates({ routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: minute, skippedSlots: app.skippedToday }));
      const plans = slotPlans(app.menuOn(app.today), app.planFoods);
      for (const s of slotsDueBetween(routine, from, minute)) {
        const due = promptDue({ date: app.today, slotId: s.id, offDays: settings.offDays ?? [], onboardedOn: profile.onboardedOn, planned: plans[s.id], settled, skips: app.state.slotSkips });
        if (!due) continue;
        const title = `${slotLabel(s, profile.lang)}?`;
        notifyNow(title, t('slot_prompt'), { priority: 'high' })
          .then((sent) => {
            if (sent) fb.notify(`${title} · ${t('slot_prompt')}`);
          })
          .catch(() => {});
      }
    }
    // Only the minute changing should speak; a schedule edit should not replay the day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute]);
}
