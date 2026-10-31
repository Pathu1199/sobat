import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { breaksAsSwitched, type BreakSettings } from '../core/breaks';
import { checklistTimes, dayChecklist } from '../core/checklist';
import { addDays } from '../core/date';
import { settledSlotIds, slotStates } from '../core/pattern';
import type { DayRecordState } from '../core/record';
import {
  dailyReminders,
  fitPending,
  fixedDaily,
  lastLogDate,
  MORNING_HOUR,
  officeReminders,
  OWN_DAYS,
  PLANNED_PREFIX,
  plannedReminders,
  SLOT_DAYS,
  slotPlans,
  syncReminders,
  weeklyReport,
  type DailyReminder,
  type HeldLists,
  type Phone,
  type Reminder,
  type ReminderOp,
  type WeeklyReminder,
} from '../core/reminders';
import type { ISODate } from '../core/types';
import { stripSince } from '../core/weekStrip';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useRecordOn } from '../store/useRecordOn';
import { firebaseEnabled } from './firebase';
import { cancelHeld, dismissAll, MEAL_CATEGORY, scheduleAt, scheduleDaily, scheduledIds, scheduleWeekly, setMealCategory, setupAndroidChannel } from './notify';
import { useAuth } from './useAuth';
import { useMinute } from './useClock';
import { useMantra } from './useMantra';

/** A short signature of when and what a reminder says and does, so a changed slot time, plan, name or language replaces the pending notification instead of leaving the old one. */
function signature(r: Reminder): string {
  const s = `${r.time}\n${r.title}\n${r.body}\n${r.category ?? ''}\n${JSON.stringify(r.data)}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const osId = (r: Reminder) => `${PLANNED_PREFIX}${r.id}@${signature(r)}`;

// One chain for every reminder, so two runs never interleave, and each run does every cancel before any add (`reminderOps`).
let chain: Promise<void> = Promise.resolve();
// The latest lists wanted, each null until its effect has run: a run reads them as they are when it starts.
let wantedDaily: DailyReminder[] | null = null;
let wantedOffice: WeeklyReminder[] | null = null;
let wantedPlanned: Reminder[] | null = null;
// The daily and office lists last registered in full, so a run that would register the same list again leaves it.
const NONE_HELD: HeldLists = { daily: '', office: '' };
let held: HeldLists = NONE_HELD;

/** Takes one step to the phone. A cancel the phone refuses rejects, so its list is tried again; `scheduleDaily`'s own cancel first stays quiet. */
async function apply(op: ReminderOp): Promise<void> {
  if (op.kind === 'cancel') await cancelHeld(op.id);
  else if (op.kind === 'daily') await scheduleDaily(op.reminder.id, op.reminder.hour, op.reminder.minute, op.reminder.title, op.reminder.body, op.reminder.data);
  else if (op.kind === 'weekly') await scheduleWeekly(op.reminder.id, op.reminder.weekday, op.reminder.hour, op.reminder.minute, op.reminder.title, op.reminder.body);
  else await scheduleAt(op.id, new Date(`${op.reminder.date}T${op.reminder.time}:00`), op.reminder.title, op.reminder.body, { data: op.reminder.data, category: op.reminder.category === 'meal' ? MEAL_CATEGORY : undefined });
}

// A failed read of what the phone holds rejects (`scheduledIds`), so the run settles nothing and the next one tries again.
const PHONE: Phone = { ids: scheduledIds, apply, setup: setupAndroidChannel };

/**
 * Brings the phone to the latest lists, after any run already going: the
 * planned ones, the office day and the daily ones in one run, every cancel
 * before any add, so the pending count never passes the phone's cap on the
 * way (`syncReminders`). Each step is tried on its own, so one the OS refuses
 * never stops the rest (the meal-time prompts above all); a list with a
 * refused step, an add or a cancel, is tried again whole on the next run, and
 * so is every list when the phone cannot say what it holds. The planned list
 * is matched against what the phone holds on every run, so a planned cancel
 * refused is tried again anyway.
 */
function reconcile(): void {
  chain = chain
    .then(async () => {
      const planned = wantedPlanned ? wantedPlanned.map((r) => ({ osId: osId(r), reminder: r })) : null;
      held = await syncReminders({ daily: wantedDaily, office: wantedOffice, planned, held, phone: PHONE, nowMs: Date.now() });
    })
    .catch(() => {
      // Permission refused or the OS declined. The app still works, and the next run tries the lists again.
      held = NONE_HELD;
    });
}

/**
 * Whether this device may hold reminders, and whether that is known yet.
 * Reminders belong to a person: a device that is signed out, or reset and not
 * onboarded again, holds none, so nothing keeps pinging after either. Not
 * known until the store has loaded and the session has been reported; a store
 * that failed to load is never taken as the person's.
 */
export function useReminderGate(): { known: boolean; active: boolean } {
  const { ready, storageError, state } = useApp();
  const { user, ready: authReady } = useAuth();
  const known = ready && storageError !== 'load' && (!firebaseEnabled || authReady);
  const active = state.profile.onboarded && (!firebaseEnabled || user !== null);
  return { known, active };
}

/**
 * Registers the reminders that must fire while the app is closed, each kind
 * by its own switch in Settings (core/reminders.ts says what and when). The
 * daily ones and the office day's weekly ones are re-registered when their
 * list changes; the meal-time prompts and the other planned ones are
 * reconciled against what the OS still holds, so a logged slot's prompt is
 * cancelled and a quiet week stays covered. All of them stay under the
 * phone's cap of 64 pending notifications (`fitPending`): the planned ones
 * first, the meal-time prompts above all, then the office day, then the fixed
 * daily ones; the Abhyas times get what is left and the long breaks what
 * remains after them. One run at a time takes every list to the phone, every
 * cancel before any add (`reminderOps`), so the count never passes the cap on
 * the way. A device
 * signed out or reset also has what is on its tray taken off, so a later
 * person's tap never acts on it. The web and the PC keep their in-app prompts
 * instead (useWorkSchedule).
 */
export function useScheduledReminders() {
  const app = useApp();
  const { quietStartHour, quietEndHour, offDays, reminders, features, reviewedWeeks, waterGoalMl, bottleMl, walkGoalMin, todayCards } = app.state.settings;
  const storedTimes = app.state.settings.checklistTimes;
  const { lang, onboardedOn, autoFillFrom } = app.state.profile;
  const mantra = useMantra();
  // The day's line goes out only while it is switched on in Settings.
  const mantraText = features.mantra ? (mantra?.text ?? '') : '';
  const routine = app.state.routine;
  // By value: a sync landing rebuilds this object unchanged, and must not re-register the day's reminders.
  // Eye-care breaks off in Settings means no long-break notifications, whatever the break panel says.
  const breaksJson = JSON.stringify(breaksAsSwitched(app.state.breakSettings, features.breaks));
  const { today, menuOn, planFoods } = app;
  const minute = useMinute();
  const recordOn = useRecordOn();
  const { known, active } = useReminderGate();
  const { sleepCheckin, water, dayReview } = reminders;
  // The office day's blocks, weekly on each day chosen: they count against the phone's cap too.
  const schedule = app.state.schedule;
  const office = useMemo(() => officeReminders({ active, schedule, t: makeT(lang) }), [active, schedule, lang]);

  // "Ate as planned" on the meal-time prompt, in the person's language; registered before the prompts fire, kept current on a language change.
  useEffect(() => {
    if (Platform.OS === 'web' || !known || !active) return;
    setMealCategory(makeT(lang)('menu_ate_planned')).catch(() => {
      // Without the button the prompt still opens Today.
    });
  }, [known, active, lang]);

  // Slots done or skipped today (a meal the app filled in counts as eaten), as one string so the plan below only moves when the set does.
  const doneKey = useMemo(() => {
    const todayMeals = app.state.meals.filter((m) => m.date === today);
    return settledSlotIds(slotStates({ routine, target: app.targets.kcal, meals: todayMeals, nowMinutes: minute, skippedSlots: app.skippedToday }))
      .sort()
      .join(',');
  }, [routine, app.state.meals, today, app.targets.kcal, minute, app.skippedToday]);
  const lastLog = useMemo(() => lastLogDate(app.state.meals, today), [app.state.meals, today]);

  // Each slot's planned calories on the days that get prompts, null for a slot with no lines (planned by its lines, as the record reads it), as one string for the same reason.
  const plannedJson = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (let k = 0; k < SLOT_DAYS; k++) {
      const date = addDays(today, k);
      for (const [id, kcal] of Object.entries(slotPlans(menuOn(date), planFoods))) out[`${date}:${id}`] = kcal;
    }
    return JSON.stringify(out);
  }, [menuOn, planFoods, today]);

  // Yesterday's and today's record, read the way Progress reads it, for "fill in yesterday".
  const recordsJson = useMemo(() => {
    const yesterday = addDays(today, -1);
    return JSON.stringify({ [yesterday]: recordOn(yesterday).state, [today]: recordOn(today).state });
  }, [recordOn, today]);

  // The coming Monday's report as this open can say it (numbers only once the week has ended), by Progress's rules; every open works it out again.
  const morning = Math.max(MORNING_HOUR, quietEndHour) * 60;
  const reportJson = useMemo(() => {
    if (!reminders.weeklyReport) return '';
    const since = stripSince({ onboardedOn, autoFillFrom }, app.state.meals, today);
    const r = weeklyReport({ today, nowMinutes: minute, atMinutes: morning, since, recordOn, meals: app.state.meals, weights: app.state.weights, goal: app.targets.kcal, t: makeT(lang) });
    return r ? JSON.stringify(r) : '';
  }, [reminders.weeklyReport, today, minute, morning, onboardedOn, autoFillFrom, recordOn, app.state.meals, app.state.weights, app.targets.kcal, lang]);

  // The Abhyas list while its reminders are on: the items, with the ticks and finished sessions of the days that get
  // reminders. A tick or a stopped timer changes it, so the next reconcile drops the item's prompts for that day.
  const { abhyasItems, abhyasTicks, abhyasSessions, meals, slotSkips, water: waterLogs } = app.state;
  const activities = app.state.activities;
  const abhyas = useMemo(() => {
    if (!reminders.abhyas) return null;
    const last = addDays(today, OWN_DAYS - 1);
    const near = (date: ISODate) => date >= today && date <= last;
    return { items: abhyasItems, ticks: abhyasTicks.filter((x) => near(x.date)), sessions: abhyasSessions.filter((x) => near(x.date)) };
  }, [reminders.abhyas, abhyasItems, abhyasTicks, abhyasSessions, today]);

  // "Day so far" for each day it can come, as the day stands now, as one string: a meal, a skip, a bottle, a walk, a tick
  // or a stopped timer changes its words, and so the pending one is replaced. The running timer is left out, as above, so
  // the words do not change every minute it runs. Water and the walk are listed while their card is on Today; a meal not
  // late yet at the last of its times is left out. The times by value, as the rest.
  const waterWalk = todayCards.some((c) => c.id === 'waterWalk' && c.on);
  const timesKey = checklistTimes(storedTimes).join(',');
  const checklistJson = useMemo(() => {
    if (Platform.OS === 'web' || !reminders.checklist) return '';
    const t = makeT(lang);
    const data = { items: abhyasItems, ticks: abhyasTicks, sessions: abhyasSessions, running: null };
    const texts: Record<ISODate, { title: string; body: string } | null> = {};
    for (let k = 0; k < OWN_DAYS; k++) {
      const date = addDays(today, k);
      texts[date] = dayChecklist({
        date,
        routine,
        menu: menuOn(date),
        meals,
        skips: slotSkips,
        abhyas: data,
        now: new Date(`${date}T12:00:00`),
        water: waterLogs,
        activities: activities ?? [],
        waterGoalMl,
        bottleMl,
        walkGoalMin,
        waterWalk,
        times: timesKey.split(','),
        lang,
        t,
      });
    }
    return JSON.stringify(texts);
  }, [reminders.checklist, lang, abhyasItems, abhyasTicks, abhyasSessions, today, routine, menuOn, meals, slotSkips, waterLogs, activities, waterGoalMl, bottleMl, walkGoalMin, waterWalk, timesKey]);

  const anyOn = reminders.mealPrompt || reminders.away || reminders.fillYesterday || reminders.planWeek || reminders.weeklyReport || reminders.abhyas || reminders.checklist;
  const wanted = useMemo(() => {
    if (Platform.OS === 'web' || !active || !anyOn) return [];
    return plannedReminders({
      today,
      nowMinutes: minute,
      routine,
      mealPrompt: reminders.mealPrompt,
      awayLines: reminders.away,
      onboardedOn,
      autoFillFrom,
      doneSlotIds: doneKey ? doneKey.split(',') : [],
      skips: app.state.slotSkips,
      plannedKcal: JSON.parse(plannedJson) as Record<string, number | null>,
      lastLogDate: lastLog,
      offDays: offDays ?? [],
      quietStartHour,
      quietEndHour,
      lang,
      t: makeT(lang),
      fillYesterday: reminders.fillYesterday,
      records: JSON.parse(recordsJson) as Record<string, DayRecordState>,
      planWeek: reminders.planWeek,
      reviewedWeeks: reviewedWeeks ?? [],
      report: reportJson ? (JSON.parse(reportJson) as { monday: string; text: string }) : null,
      abhyas,
      checklist: checklistJson ? { times: checklistTimes(storedTimes), texts: JSON.parse(checklistJson) as Record<ISODate, { title: string; body: string } | null> } : null,
    });
  }, [
    active,
    anyOn,
    reminders.mealPrompt,
    reminders.away,
    reminders.fillYesterday,
    reminders.planWeek,
    onboardedOn,
    autoFillFrom,
    today,
    minute,
    routine,
    doneKey,
    app.state.slotSkips,
    plannedJson,
    lastLog,
    offDays,
    quietStartHour,
    quietEndHour,
    lang,
    recordsJson,
    reviewedWeeks,
    reportJson,
    abhyas,
    checklistJson,
    storedTimes,
  ]);
  // The fixed daily ones (check-in, the day's line, water, review), counted so they keep their room before the Abhyas times.
  const fixedCount = useMemo(
    () => fixedDaily({ active, sleepCheckin, water, dayReview, quietStartHour, quietEndHour, mantra: mantraText, t: makeT(lang) }).length,
    [active, sleepCheckin, water, dayReview, quietStartHour, quietEndHour, mantraText, lang],
  );
  // Under the phone's cap (`fitPending`): the meal-time prompts, "Day so far" and the rest planned, then the office day,
  // then the fixed daily ones; the Abhyas times get what is left, soonest first, and the long breaks what remains.
  const fit = useMemo(() => fitPending({ planned: wanted, office: office.length, fixed: fixedCount }), [wanted, office.length, fixedCount]);
  // By value: the list is worked out again every minute, and only a real change is taken to the OS.
  const wantedJson = JSON.stringify(fit.planned);
  const officeJson = JSON.stringify(office.slice(0, fit.office));
  const room = fit.daily;

  // The office day: whatever the list does not hold is cancelled, so a day switched off, a block removed, a sign-out or a
  // reset leaves none behind, and so do the daily ones older builds registered for each block.
  useEffect(() => {
    if (Platform.OS === 'web' || !known) return;
    wantedOffice = JSON.parse(officeJson) as WeeklyReminder[];
    reconcile();
  }, [officeJson, known]);

  // Signed out or reset: what is already on the tray goes too, so the next person here never taps the last one's.
  useEffect(() => {
    if (Platform.OS === 'web' || !known || active) return;
    dismissAll().catch(() => {});
  }, [known, active]);

  // The daily ones: whatever the plan does not hold is cancelled, so a sign-out
  // or a reset clears them and the repeating long break older builds left goes too.
  useEffect(() => {
    if (Platform.OS === 'web' || !known) return;
    wantedDaily = dailyReminders({
      active,
      sleepCheckin,
      water,
      dayReview,
      quietStartHour,
      quietEndHour,
      mantra: mantraText,
      breaks: JSON.parse(breaksJson) as BreakSettings,
      nowMs: Date.now(),
      t: makeT(lang),
      room,
    });
    reconcile();
  }, [known, active, sleepCheckin, water, dayReview, quietStartHour, quietEndHour, lang, breaksJson, mantraText, room]);

  // Runs once the store and the session are known, whoever is there: after a sign-out or a reset `wanted` is
  // empty and the planned week is cancelled. Never on a store that failed to load, whose empty state is not the person's.
  useEffect(() => {
    if (Platform.OS === 'web' || !known) return;
    wantedPlanned = JSON.parse(wantedJson) as Reminder[];
    reconcile();
  }, [wantedJson, known]);
}
