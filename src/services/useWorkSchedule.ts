import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { msToNextMinute } from '../core/date';
import { skipKey, slotLabel, slotLogged, slotMinutes, slotsDueBetween, SLOT_GRACE_MIN, bhajiFor } from '../core/routine';
import { orderedBlocks, startedBetween, toMinutes } from '../core/schedule';
import { storyLine, storySeed, type StoryKind } from '../core/storyLines';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useFeedback } from './feedback';
import { cancel, notifyNow, scheduleDaily } from './notify';

export function nowMinutes(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Minutes since midnight, re-read on the minute. For countdowns and "what is on now". */
export function useMinute(): number {
  const [m, setM] = useState(() => nowMinutes());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setM(nowMinutes());
      timer = setTimeout(tick, msToNextMinute());
    };
    timer = setTimeout(tick, msToNextMinute());
    return () => clearTimeout(timer);
  }, []);
  return m;
}

const PREFIX = 'sobat-sched-';

/**
 * Says something at the start of each block of the office day. While the app
 * is open, a toast and a notification come from the minute tick; on a phone
 * the blocks are also registered as daily notifications, so they arrive with
 * the app closed. A web app on a phone cannot do that, so there the tick is
 * all there is.
 */
export function useWorkSchedule() {
  const app = useApp();
  const fb = useFeedback();
  const { schedule, profile, routine } = app.state;
  const minute = useMinute();
  const last = useRef(minute);
  const lastRegistered = useRef<string[]>([]);
  const t = makeT(profile.lang);

  useEffect(() => {
    const from = last.current;
    last.current = minute;
    // Across midnight the minute count drops; nothing starts at that moment anyway.
    if (minute <= from) return;
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
    // A routine meal whose time passed with nothing logged: ask once, log or skip.
    if (routine.enabled) {
      const todayMeals = app.state.meals.filter((m) => m.date === app.today);
      const bhaji = bhajiFor(routine, app.today);
      for (const s of slotsDueBetween(routine, from, minute)) {
        if (slotLogged(s, bhaji, todayMeals) || app.actionsDoneToday.includes(skipKey(s))) continue;
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

  // Native: the OS fires these even with the app closed. One per block, daily.
  useEffect(() => {
    if (Platform.OS === 'web' || !profile.onboarded) return;
    (async () => {
      const blocks = schedule.enabled ? orderedBlocks(schedule) : [];
      for (const b of blocks) {
        const m = toMinutes(b.start);
        await scheduleDaily(`${PREFIX}${b.id}`, Math.floor(m / 60), m % 60, t(`ntf_${b.kind}`), t(`ntf_${b.kind}_body`));
      }
      // Routine meals: the same "log or skip?" prompt, at time + grace, with the app closed.
      const slots = routine.enabled ? routine.slots : [];
      for (const s of slots) {
        const m = slotMinutes(s) + SLOT_GRACE_MIN;
        await scheduleDaily(`${PREFIX}slot-${s.id}`, Math.floor(m / 60) % 24, m % 60, `${slotLabel(s, profile.lang)}?`, t('slot_prompt'));
      }
      const wanted = [...blocks.map((b) => `${PREFIX}${b.id}`), ...slots.map((s) => `${PREFIX}slot-${s.id}`)];
      // Blocks and slots removed in Settings must stop firing too.
      for (const id of lastRegistered.current) if (!wanted.includes(id)) await cancel(id);
      lastRegistered.current = wanted;
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, routine, profile.onboarded, profile.lang]);
}
