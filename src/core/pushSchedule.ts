import { addDays } from './date';
import { pickMantra } from './mantra';
import { planFrom } from './plan';
import { orderedBlocks, type WorkSchedule } from './schedule';
import { slotLabel, slotTime, SLOT_GRACE_MIN, type Routine } from './routine';
import { MANTRAS } from '../data/mantras';
import { dailyTargets } from './nutrition';
import type { AppState, ISODate, Lang } from './types';

/**
 * Everything the relay needs to send reminders while the app is closed, and
 * nothing more: times, labels in the person's language, and the next week of
 * mantras. No food, weight, mood or sleep ever leaves the device.
 */
export type PushSchedule = {
  v: 1;
  tz: string;
  lang: Lang;
  days: number[];
  /** Office blocks: a reminder at each start. */
  blocks: { kind: string; start: string; title: string; body: string }[];
  /** Routine meals: a "log or skip?" prompt at time + grace. */
  slots: { id: string; at: string; title: string; body: string }[];
  /** Short breaks every N minutes between work start and end. */
  breaks: { everyMinutes: number; from: string; to: string; title: string; body: string } | null;
  /** Water every N minutes between the same hours. */
  water: { everyMinutes: number; from: string; to: string; title: string; body: string } | null;
  /** One line a day at eight, precomputed for the week ahead. */
  mantras: { date: ISODate; title: string; text: string }[];
  quiet: { from: number; to: number };
};

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function buildPushSchedule(state: AppState, today: ISODate, t: (k: string) => string, tz: string): PushSchedule {
  const lang = state.profile.lang;
  const sched: WorkSchedule = state.schedule;
  const routine: Routine = state.routine;
  const blocks = sched.enabled ? orderedBlocks(sched) : [];
  const start = blocks.find((b) => b.kind === 'start')?.start ?? '09:00';
  const end = blocks.find((b) => b.kind === 'end')?.start ?? '18:00';
  const br = state.breakSettings;

  // The week's mantras, from today's situation; close enough for a line a day.
  const targets = dailyTargets(state.profile);
  const plan = planFrom(state.profile, state.weights, targets, today);
  const mantras = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const m = pickMantra(MANTRAS[lang] ?? MANTRAS.en, { stage: plan.stage, waterLow: false, sleepShort: false, proteinLow: false, workDay: sched.days.includes(new Date(date + 'T12:00:00').getDay()), evening: false }, date);
    return m ? { date, title: t('mantra_title'), text: m.text } : null;
  }).filter((x): x is { date: ISODate; title: string; text: string } => x !== null);

  return {
    v: 1,
    tz,
    lang,
    days: sched.enabled ? sched.days : [],
    blocks: blocks.map((b) => ({ kind: b.kind, start: b.start, title: t(`ntf_${b.kind}`), body: t(`ntf_${b.kind}_body`) })),
    slots: routine.enabled ? routine.slots.map((s) => ({ id: s.id, at: addMinutes(slotTime(s), SLOT_GRACE_MIN), title: `${slotLabel(s, lang)}?`, body: t('slot_prompt') })) : [],
    breaks:
      sched.enabled && br.enabled && br.micro.enabled
        ? { everyMinutes: br.micro.everyMinutes, from: start, to: end, title: t('brk_micro'), body: t('brk_micro_hint') }
        : null,
    water:
      state.settings.nudgesEnabled
        ? { everyMinutes: Math.max(20, state.settings.nudgeMinutes), from: sched.enabled ? start : '08:00', to: sched.enabled ? end : '21:00', title: t('add_water'), body: t('act_drink_water') }
        : null,
    mantras,
    quiet: { from: state.settings.quietStartHour, to: state.settings.quietEndHour },
  };
}
