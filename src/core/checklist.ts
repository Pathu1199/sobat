import { cleanTimes, isDone, itemsOn, MAX_TIMES, minutesOn, type AbhyasData } from './abhyas';
import { skippedOn, type DayMenu } from './menu';
import { slotStates } from './pattern';
import { slotLabel, type Routine } from './routine';
import { walkMinutesOn, waterMlOn } from './tileText';
import { walkTile, waterTile } from './tiles';
import type { ActivityLog, ISODate, Lang, Meal, SlotSkip, WaterLog } from './types';
import { fill } from '../i18n';

/**
 * "Day so far": one notification, at times the user chooses, that reads as a
 * checklist of the day, what is done (✓) and what is not yet (○). One line
 * each for the meals, the user's Abhyas list, and water and the walk, in that
 * order; a line with nothing on it is left out, and a day with everything done
 * (or nothing to list) sends nothing. Pure; the phone plans it ahead
 * (`plannedReminders`) and works it out again on every reconcile.
 */

/** When "Day so far" comes unless the user picks other times. */
export const DEFAULT_CHECKLIST_TIMES: readonly string[] = ['20:30'];

/**
 * `settings.checklistTimes` as the app reads it: clock times, each once, in
 * the day's order, at most three, as an item's times are kept (`cleanTimes`).
 * Anything that is not a list, as on a store from before the setting existed,
 * and a list with no clock time left in it, has the default: the switch, not
 * an empty list, is what turns "Day so far" off.
 */
export function checklistTimes(v: unknown): string[] {
  const times = cleanTimes(v);
  return times.length > 0 ? times : [...DEFAULT_CHECKLIST_TIMES];
}

/** The times with the one at `index` changed to `text`, kept as `checklistTimes` keeps them; null while `text` is not a clock time, or changes nothing. */
export function withTimeAt(times: unknown, index: number, text: string): string[] | null {
  const now = checklistTimes(times);
  if (index < 0 || index >= now.length || now[index] === text || cleanTimes([text]).length === 0) return null;
  return checklistTimes(now.map((t, i) => (i === index ? text : t)));
}

/** The times the Settings row offers next, in this order: the first one not on the list yet. */
const ADD_CHOICES = ['13:00', '18:00', '20:30', '09:00'];

/** The times with one more, the first of `ADD_CHOICES` not already there, in the day's order; the same times when three are set, as for an Abhyas item. */
export function withChecklistTime(times: unknown): string[] {
  const now = checklistTimes(times);
  const next = ADD_CHOICES.find((t) => !now.includes(t));
  return next && now.length < MAX_TIMES ? checklistTimes([...now, next]) : now;
}

export type ChecklistInput = {
  date: ISODate;
  routine: Routine;
  /** The date's menu: a slot it plans empty (no lines) is not listed unless something was eaten or skipped there. Null lists every slot, as the record judges a date with no menu. */
  menu: DayMenu | null;
  meals: Meal[];
  skips: SlotSkip[];
  abhyas: AbhyasData;
  /** For the running timer's minutes; not read when `abhyas.running` is null. */
  now: Date;
  water: WaterLog[];
  activities: ActivityLog[];
  waterGoalMl: number;
  bottleMl: number;
  walkGoalMin: number;
  /** Whether the water-and-walk line is on the list: the user keeps that card on Today. */
  waterWalk: boolean;
  lang: Lang;
  t: (key: string) => string;
};

type Mark = { done: boolean; text: string };

const line = (marks: Mark[]) => marks.map((m) => `${m.done ? '✓' : '○'} ${m.text}`).join(' · ');

/** Each slot of the pattern in the day's order: eaten (a meal the app filled in counts), skipped, or still to log when the menu plans something in it. */
function mealMarks(input: ChecklistInput): Mark[] {
  const meals = input.meals.filter((m) => m.date === input.date);
  const states = slotStates({ routine: input.routine, target: 0, meals, nowMinutes: 0, skippedSlots: skippedOn(input.skips, input.date) });
  const out: Mark[] = [];
  for (const s of states) {
    const name = slotLabel(s.slot.slot, input.lang);
    if (s.status === 'done') out.push({ done: true, text: name });
    else if (s.status === 'skipped') out.push({ done: true, text: fill(input.t('rem_checklist_skipped'), { slot: name }) });
    else if (!input.menu || (input.menu.meals.find((m) => m.id === s.slot.id)?.lines.length ?? 0) > 0) out.push({ done: false, text: name });
  }
  return out;
}

/** Each Abhyas item on the date: done with the minutes it got, or the minutes against its target, or just its name. */
function abhyasMarks(input: ChecklistInput): Mark[] {
  const { items, ticks, sessions, running } = input.abhyas;
  const min = input.t('tile_unit_min');
  return itemsOn(items, input.date).map((item) => {
    const minutes = minutesOn(sessions, running, item.id, input.date, input.now);
    const done = isDone(item, input.date, ticks, minutes);
    const target = typeof item.targetMin === 'number' && item.targetMin > 0 ? item.targetMin : null;
    if (done) return { done, text: minutes > 0 ? `${item.name} ${minutes} ${min}` : item.name };
    return { done, text: target ? `${item.name} ${minutes}/${target} ${min}` : item.name };
  });
}

/** Water by the bottles still to drink, the walk by the minutes walked or still to go; each left out without a goal above 0. */
function waterWalkMarks(input: ChecklistInput): Mark[] {
  if (!input.waterWalk) return [];
  const { t } = input;
  const out: Mark[] = [];
  if (input.waterGoalMl > 0) {
    const w = waterTile(waterMlOn(input.water, input.date), input.waterGoalMl, input.bottleMl);
    const left = w.bottlesLeft === 1 ? t('tile_bottle_left') : fill(t('tile_bottles_left'), { n: w.bottlesLeft });
    out.push({ done: w.reached, text: w.reached || w.bottlesLeft === 0 ? t('water') : `${t('water')}, ${left}` });
  }
  if (input.walkGoalMin > 0) {
    const minutes = walkMinutesOn(input.activities, input.date);
    const w = walkTile(minutes, input.walkGoalMin);
    out.push({ done: w.reached, text: w.reached ? `${t('tile_walk')} ${Math.round(minutes)} ${t('tile_unit_min')}` : `${t('tile_walk')}, ${fill(t('tile_min_left'), { n: w.minutesLeft })}` });
  }
  return out;
}

/**
 * The day so far, in the user's language: the title, and up to three lines
 * (meals, the Abhyas list, water and the walk), each part marked ✓ or ○, as
 * `✓ Breakfast · ✓ Lunch · ○ Dinner`. Null when every part is done or there
 * is nothing to list: nothing is sent then.
 */
export function dayChecklist(input: ChecklistInput): { title: string; body: string } | null {
  const lines = [mealMarks(input), abhyasMarks(input), waterWalkMarks(input)].filter((marks) => marks.length > 0);
  if (lines.every((marks) => marks.every((m) => m.done))) return null;
  return { title: input.t('rem_checklist_title'), body: lines.map(line).join('\n') };
}
