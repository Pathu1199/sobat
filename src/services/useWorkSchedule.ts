import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { msToNextMinute } from '../core/date';
import { orderedBlocks, startedBetween, toMinutes } from '../core/schedule';
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
  const { schedule, profile } = app.state;
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
      const body = t(`ntf_${b.kind}_body`);
      fb.notify(`${title} · ${body}`);
      notifyNow(title, body).catch(() => {});
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
      // Blocks removed in Settings must stop firing too.
      for (const id of lastRegistered.current) if (!blocks.some((b) => `${PREFIX}${b.id}` === id)) await cancel(id);
      lastRegistered.current = blocks.map((b) => `${PREFIX}${b.id}`);
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, profile.onboarded, profile.lang]);
}
