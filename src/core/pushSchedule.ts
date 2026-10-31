import { cleanDays, cleanTimes, isDone, MAX_TIMES, minutesOn } from './abhyas';
import { breaksAsSwitched } from './breaks';
import { checklistTimes, dayChecklist } from './checklist';
import { addDays, isIsoDate } from './date';
import { pickMantra } from './mantra';
import type { DayMenu } from './menu';
import { planFrom } from './plan';
import { orderedBlocks, type WorkSchedule } from './schedule';
import { slotLabel, slotTime, SLOT_GRACE_MIN, type Routine } from './routine';
import { abhyasWords } from './reminders';
import { isOffDay } from './week';
import { MANTRAS } from '../data/mantras';
import { dailyTargets } from './nutrition';
import type { AbhyasItem, AppState, ISODate, Lang } from './types';

/**
 * Everything the relay needs to send reminders while the app is closed, and
 * nothing more: times, labels in the person's language, the next week of
 * mantras, the user's Abhyas items with their times, and "Day so far" as
 * today stands. No food, weight, mood or sleep ever leaves the device: the day
 * so far names the meals eaten or not, never what was in them. It follows the
 * same switches as the app: no short breaks while eye-care breaks are off, no
 * day's line while it is off, water and the weigh day only while the nudges
 * are on, and Abhyas and "Day so far" by their own reminder switches. Nothing
 * in it goes by the time of day, only the date, so it changes when the day,
 * the logs or the settings do, never minute by minute: the running timer
 * stays out.
 * Version 2 adds the Abhyas and "Day so far" parts; the relay still takes a
 * version 1 schedule from an older app.
 */
export type PushSchedule = {
  v: 2;
  tz: string;
  lang: Lang;
  days: number[];
  /** Office blocks: a reminder at each start. */
  blocks: { kind: string; start: string; title: string; body: string }[];
  /** Routine meals: a "log or skip?" prompt at time + grace, on any day but a free one. */
  slots: { id: string; at: string; title: string; body: string }[];
  /** The free days, 0 = Sunday as Date.getDay() counts: no meal is asked about on one, as the phone and the app ask about none. */
  offDays: number[];
  /** Short breaks every N minutes between work start and end. */
  breaks: { everyMinutes: number; from: string; to: string; title: string; body: string } | null;
  /** Water every N minutes between the same hours. */
  water: { everyMinutes: number; from: string; to: string; title: string; body: string } | null;
  /** One line a day at eight, precomputed for the week ahead. */
  mantras: { date: ISODate; title: string; text: string }[];
  quiet: { from: number; to: number };
  /** The weigh day, once a week at a quarter to eight, before the day's line at eight. */
  weigh: { weekday: number; title: string; body: string } | null;
  /**
   * Abhyas items that repeat: a reminder at each of `times` on each of `days`, off days too, as on the phone. `body`
   * is what it says on a day with nothing counted yet; `bodyToday`, there when minutes were counted on `doneDate` and
   * the item is not done yet, says them on that day. `order`, here and on a one-off, is the item's place in the
   * user's list, both kinds together, so the relay sends items due in the same minute in that order.
   */
  abhyas: { id: string; days: number[]; times: string[]; title: string; body: string; bodyToday?: string; order: number }[];
  /** One-off Abhyas items still to do, from today on: one row for each reminder time, soonest first. */
  once: { date: ISODate; time: string; title: string; body: string; order: number }[];
  /** Repeating items already done on `doneDate`: the relay skips them that day only. */
  doneToday: string[];
  doneDate: ISODate;
  /** "Day so far" as `date` stood at upload, at each of `times` on that date only; null while it is off or has nothing to say. */
  checklist: { times: string[]; title: string; body: string; date: ISODate } | null;
};

/**
 * What the relay takes in the Abhyas and "Day so far" parts (relay/src/schedule.ts, `LIMITS`). A schedule over
 * them is refused whole, and every reminder with it, so the app keeps under them: the first rows, the words cut,
 * and no more reminder times than an item may have (`cleanTimes` keeps to them).
 */
export const PUSH_LIMITS = { rows: 30, id: 64, text: 80, checklist: 800, times: MAX_TIMES } as const;

// What joins onto the character before it (a mark: a vowel sign, a virama, a variation selector; the joiners; a skin
// tone; an emoji tag), and what joins the next character onto itself (the joiner, and the virama of Devanagari and the
// scripts beside it, which makes a conjunct such as क्ष).
const JOINS_BACK = /^[\p{M}\u200C\u200D\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/u;
const JOINS_ON = /^[\u200D\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D]$/;
const HIGH = /^[\uD800-\uDBFF]$/;
const LOW = /^[\uDC00-\uDFFF]$/;

/**
 * The text cut to at most `max` UTF-16 units, the relay's measure, with an ellipsis, on a whole letter as the reader
 * sees it: never half of an emoji, a Devanagari letter without its vowel sign, or a conjunct after its virama. With
 * `Intl.Segmenter`, which current browsers have (the relay is used on the web only) and an older one may not, the cut
 * falls between graphemes; without it, or where it does not keep conjuncts whole yet, the cut backs off to the start
 * of the letter it fell in, and past any space before it.
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = max - 1;
  const Segmenter = typeof Intl === 'undefined' ? undefined : Intl.Segmenter;
  if (typeof Segmenter === 'function') {
    cut = 0;
    for (const { segment } of new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
      if (cut + segment.length > max - 1) break;
      cut += segment.length;
    }
  } else if (HIGH.test(text[cut - 1])) cut -= 1;
  const back = () => (cut >= 2 && LOW.test(text[cut - 1]) && HIGH.test(text[cut - 2]) ? 2 : 1);
  while (cut > 0 && (/\s/.test(text[cut - 1]) || JOINS_ON.test(text[cut - 1]) || JOINS_BACK.test(text.slice(cut, cut + 2)))) cut -= back();
  return `${text.slice(0, cut)}…`;
}

// Finished sessions only: the running timer would change the words every minute it runs. Its minutes count once it stops.
const NO_TIMER_CLOCK = new Date(0);

/**
 * The Abhyas part, while its reminders are on: the repeating items in the user's order, the one-offs from today
 * on that are not done yet, and the repeating items done today. An item removed, or with no reminder time, has
 * none. The words are the phone's (`abhyasWords`), cut to what the relay takes.
 */
function abhyasPart(state: AppState, today: ISODate, t: (k: string) => string): Pick<PushSchedule, 'abhyas' | 'once' | 'doneToday' | 'doneDate'> {
  if (!state.settings.reminders.abhyas) return { abhyas: [], once: [], doneToday: [], doneDate: today };
  const { abhyasTicks: ticks, abhyasSessions: sessions } = state;
  const minutes = (item: AbhyasItem, date: ISODate) => minutesOn(sessions, null, item.id, date, NO_TIMER_CLOCK);
  const words = (item: AbhyasItem, n: number) => clip(abhyasWords(item, n, t).body, PUSH_LIMITS.text);
  const title = (item: AbhyasItem) => clip(abhyasWords(item, 0, t).title, PUSH_LIMITS.text);
  const live = state.abhyasItems.filter((i) => !i.archivedAt && cleanTimes(i.times).length > 0);
  // Each item's place in the user's list, as Today shows it (`itemsOn`).
  const place = new Map([...live].sort((a, b) => a.order - b.order).map((i, n) => [i.id, n]));
  const order = (item: AbhyasItem) => place.get(item.id) ?? 0;

  const repeating = live
    .filter((i) => i.kind !== 'once' && i.id.length > 0 && i.id.length <= PUSH_LIMITS.id && cleanDays(i.days).length > 0)
    .sort((a, b) => a.order - b.order)
    .slice(0, PUSH_LIMITS.rows);
  const doneToday = repeating.filter((i) => isDone(i, today, ticks, minutes(i, today))).map((i) => i.id);
  const abhyas = repeating.map((i) => {
    const n = minutes(i, today);
    const row = { id: i.id, days: cleanDays(i.days), times: cleanTimes(i.times), title: title(i), body: words(i, 0), order: order(i) };
    return n > 0 && !doneToday.includes(i.id) ? { ...row, bodyToday: words(i, n) } : row;
  });

  const once = live
    .filter((i): i is AbhyasItem & { date: ISODate } => i.kind === 'once' && isIsoDate(i.date) && i.date >= today)
    .filter((i) => !isDone(i, i.date, ticks, minutes(i, i.date)))
    .flatMap((i) => cleanTimes(i.times).map((time) => ({ date: i.date, time, title: title(i), body: words(i, minutes(i, i.date)), order: order(i) })))
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
    .slice(0, PUSH_LIMITS.rows);

  return { abhyas, once, doneToday, doneDate: today };
}

/**
 * "Day so far" for today as it stands, at its times, while it is switched on: none on the day setup was finished
 * or on an off day, as on the phone, and none when everything is done. `menu` is today's, as Today shows it.
 */
function checklistPart(state: AppState, today: ISODate, t: (k: string) => string, menu: DayMenu | null): PushSchedule['checklist'] {
  const s = state.settings;
  if (!s.reminders.checklist || today === state.profile.onboardedOn || isOffDay(s.offDays, today)) return null;
  const text = dayChecklist({
    date: today,
    routine: state.routine,
    menu,
    meals: state.meals,
    skips: state.slotSkips,
    abhyas: { items: state.abhyasItems, ticks: state.abhyasTicks, sessions: state.abhyasSessions, running: null },
    now: new Date(`${today}T12:00:00`),
    water: state.water,
    activities: state.activities ?? [],
    waterGoalMl: s.waterGoalMl,
    bottleMl: s.bottleMl,
    walkGoalMin: s.walkGoalMin,
    waterWalk: s.todayCards.some((c) => c.id === 'waterWalk' && c.on),
    // As on the phone: a meal still open, or not open yet, at the last of the times is left out rather than shown as not done.
    times: checklistTimes(s.checklistTimes),
    lang: state.profile.lang,
    t,
  });
  if (!text) return null;
  return { times: checklistTimes(s.checklistTimes), title: clip(text.title, PUSH_LIMITS.text), body: clip(text.body, PUSH_LIMITS.checklist), date: today };
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The schedule for the relay as of `today`; `menu` is today's menu as Today shows it, for "Day so far" (null lists every meal). */
export function buildPushSchedule(state: AppState, today: ISODate, t: (k: string) => string, tz: string, menu: DayMenu | null = null): PushSchedule {
  const lang = state.profile.lang;
  const sched: WorkSchedule = state.schedule;
  const routine: Routine = state.routine;
  const blocks = sched.enabled ? orderedBlocks(sched) : [];
  const start = blocks.find((b) => b.kind === 'start')?.start ?? '09:00';
  const end = blocks.find((b) => b.kind === 'end')?.start ?? '18:00';
  // Eye-care breaks switched off in Settings read as off here too, whatever the break panel says.
  const br = breaksAsSwitched(state.breakSettings, state.settings.features.breaks);

  // The week's mantras, from today's situation; close enough for a line a day.
  const targets = dailyTargets(state.profile);
  const plan = planFrom(state.profile, state.weights, targets, today);
  const mantras = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const m = pickMantra(MANTRAS[lang] ?? MANTRAS.en, { stage: plan.stage, waterLow: false, sleepShort: false, proteinLow: false, workDay: sched.days.includes(new Date(date + 'T12:00:00').getDay()), evening: false }, date);
    return m ? { date, title: t('mantra_title'), text: m.text } : null;
  }).filter((x): x is { date: ISODate; title: string; text: string } => x !== null);

  return {
    v: 2,
    tz,
    lang,
    days: sched.enabled ? sched.days : [],
    blocks: blocks.map((b) => ({ kind: b.kind, start: b.start, title: t(`ntf_${b.kind}`), body: t(`ntf_${b.kind}_body`) })),
    // The meal-time prompt, when it is on, and never on the day the person finished setup. The mantras change the
    // payload every day, so the slots go back the next day the app runs.
    slots:
      state.settings.reminders.mealPrompt && today !== state.profile.onboardedOn
        ? routine.slots.map((s) => ({ id: s.id, at: addMinutes(slotTime(s), SLOT_GRACE_MIN), title: `${slotLabel(s, lang)}?`, body: t('slot_prompt') }))
        : [],
    offDays: state.settings.offDays ?? [],
    breaks:
      sched.enabled && br.enabled && br.micro.enabled
        ? { everyMinutes: br.micro.everyMinutes, from: start, to: end, title: t('brk_micro'), body: t('brk_micro_hint') }
        : null,
    water:
      state.settings.nudgesEnabled
        ? { everyMinutes: Math.max(20, state.settings.nudgeMinutes), from: sched.enabled ? start : '08:00', to: sched.enabled ? end : '21:00', title: t('add_water'), body: t('act_drink_water') }
        : null,
    // The day's line goes out only while it is switched on in Settings.
    mantras: state.settings.features.mantra ? mantras : [],
    quiet: { from: state.settings.quietStartHour, to: state.settings.quietEndHour },
    // The weigh day is a nudge, as water is: it goes out only while the nudges are switched on.
    weigh: state.settings.nudgesEnabled ? { weekday: state.settings.weighDay ?? 1, title: t('weigh_q'), body: t('weigh_hint') } : null,
    ...abhyasPart(state, today, t),
    checklist: checklistPart(state, today, t, menu),
  };
}

/**
 * What the relay's copy of this device's schedule needs now, while background
 * reminders are on. A device someone is using sends its schedule when it
 * changes; one that is signed out or reset has its copy removed, so the relay
 * sends it nothing. Nothing is decided before the store and the session are
 * known, so a store still loading never stops the person's reminders.
 */
export function pushStep(p: { configured: boolean; relayOn: boolean; known: boolean; active: boolean; payload: string; lastSent: string }): 'send' | 'stop' | 'none' {
  if (!p.configured || !p.relayOn || !p.known) return 'none';
  if (!p.active) return 'stop';
  return p.payload && p.payload !== p.lastSent ? 'send' : 'none';
}
