import { describe, expect, it } from 'vitest';
import { DEFAULT_BREAK_SETTINGS } from '../breaks';
import { daysBetween } from '../date';
import type { DayMenu } from '../menu';
import { skipId } from '../menu';
import type { DayRecord, DayRecordState } from '../record';
import {
  abhyasWords,
  DAILY_IDS,
  LONG_BREAK_ID,
  byPriority,
  dailyReminders,
  lastLogDate,
  missedDays,
  OFFICE_PREFIX,
  officeReminders,
  OWN_DAYS,
  opList,
  PENDING_LIMIT,
  pendingFit,
  plannedReminders,
  promptDue,
  promptOutcome,
  REMINDER_ROWS,
  reminderOps,
  syncReminders,
  reportMonday,
  reportText,
  slotPlans,
  firstTap,
  fitPending,
  fixedDaily,
  tapKey,
  tapPlan,
  tapPlanAt,
  tapRoute,
  weeklyReport,
  weekReport,
  type HeldLists,
  type Phone,
  type ReminderOp,
  type ReminderInput,
} from '../reminders';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import { DEFAULT_SCHEDULE, type WorkSchedule } from '../schedule';
import { shownWeight } from '../tileText';
import type { AbhyasItem, FoodItem, Meal } from '../types';
import foodsJson from '../../data/foods.json';
import { makeT } from '../../i18n';
import { DEFAULT_SETTINGS, EMPTY_STATE } from '../../store/defaults';

const foodsList = foodsJson as FoodItem[];

const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '19:30', 35)] };
const meal = (date: string): Meal => ({ id: date, at: `${date}T13:00:00.000Z`, date, type: 'lunch', items: [], kcal: 400, protein: 10 });
const WORDS: Record<string, string> = {
  prompt_title: '{slot} · {kcal} kcal',
  rem_report_full: '{n} of {m} full',
  rem_report_avg: 'average {avg}, goal {goal}',
  rem_report_weight: 'weight {kg} kg in {weeks} weeks',
  rem_abhyas_min: '{n} of {m} min today',
};
const t = (k: string) => WORDS[k] ?? k;
const plannedKcal: Record<string, number> = {};
for (const d of ['2026-10-12', '2026-10-13', '2026-10-14']) Object.assign(plannedKcal, { [`${d}:morning`]: 300, [`${d}:lunch`]: 600, [`${d}:dinner`]: 500 });
// 2026-10-12 is a Monday.
const base: ReminderInput = {
  today: '2026-10-12',
  nowMinutes: 10 * 60,
  routine,
  mealPrompt: true,
  awayLines: true,
  doneSlotIds: [],
  plannedKcal,
  lastLogDate: '2026-10-12',
  offDays: [],
  quietStartHour: 22,
  quietEndHour: 7,
  lang: 'en',
  t,
  fillYesterday: false,
  records: {},
  planWeek: false,
  reviewedWeeks: [],
  report: null,
};
const quiet: ReminderInput = { ...base, mealPrompt: false, awayLines: false };

describe('plannedReminders: the meal-time prompt', () => {
  it('prompts every planned slot at its own time, titled with what is planned, today and the next two days only', () => {
    const r = plannedReminders(base).filter((x) => x.id.startsWith('slot:'));
    // Monday at 10:00: lunch and dinner today, then all three on Tuesday and Wednesday.
    expect(r).toHaveLength(2 + 3 + 3);
    expect(r[0]).toMatchObject({
      id: 'slot:lunch:2026-10-12',
      date: '2026-10-12',
      time: '13:00',
      title: 'lunch · 600 kcal',
      body: 'prompt_body',
      category: 'meal',
      data: { kind: 'slot', date: '2026-10-12', slotId: 'lunch' },
    });
    expect(r[1]).toMatchObject({ id: 'slot:dinner:2026-10-12', time: '19:30' });
    expect(r[2]).toMatchObject({ id: 'slot:morning:2026-10-13', time: '08:30' });
    expect(r.some((x) => x.date > '2026-10-14')).toBe(false);
  });

  it('a slot planned empty gets no prompt; one whose plan is not known gets the plain question, without the button', () => {
    const empty = plannedReminders({ ...base, plannedKcal: { ...plannedKcal, '2026-10-12:dinner': null } }).filter((x) => x.date === '2026-10-12');
    expect(empty.map((x) => x.id)).toEqual(['slot:lunch:2026-10-12']);
    const plain = plannedReminders({ ...base, plannedKcal: {} })[0];
    expect(plain).toMatchObject({ id: 'slot:lunch:2026-10-12', title: 'lunch?', body: 'slot_prompt' });
    expect(plain.category).toBeUndefined();
  });

  it('a slot is planned by its lines, as the record reads it: lines that add up to no calories (black tea) still get the prompt', () => {
    const tea = plannedReminders({ ...base, plannedKcal: { ...plannedKcal, '2026-10-12:dinner': 0 } }).filter((x) => x.date === '2026-10-12');
    expect(tea.map((x) => x.id)).toEqual(['slot:lunch:2026-10-12', 'slot:dinner:2026-10-12']);
    expect(tea[1]).toMatchObject({ title: 'dinner · 0 kcal', body: 'prompt_body', category: 'meal' });
  });

  it('writes a big plan with its thousands', () => {
    const r = plannedReminders({ ...base, plannedKcal: { ...plannedKcal, '2026-10-12:lunch': 1240 } });
    expect(r[0].title).toBe('lunch · 1,240 kcal');
  });

  it('leaves out today\'s slots already done and those whose moment has passed', () => {
    const r = plannedReminders({ ...base, nowMinutes: 14 * 60, doneSlotIds: ['dinner'] }).filter((x) => x.date === '2026-10-12');
    expect(r).toEqual([]);
  });

  it('keeps today\'s prompt in the list through its own minute, so a reconcile in that minute never cancels it', () => {
    const at = (nowMinutes: number) => plannedReminders({ ...base, nowMinutes }).filter((x) => x.date === '2026-10-12').map((x) => x.id);
    expect(at(13 * 60)).toEqual(['slot:lunch:2026-10-12', 'slot:dinner:2026-10-12']);
    expect(at(13 * 60 + 1)).toEqual(['slot:dinner:2026-10-12']);
  });

  it('leaves out a slot skipped ahead on a later day', () => {
    const skips = [{ id: skipId('2026-10-13', 'lunch'), date: '2026-10-13', slotId: 'lunch' }];
    const r = plannedReminders({ ...base, skips }).filter((x) => x.id.startsWith('slot:'));
    expect(r.map((x) => x.id)).not.toContain('slot:lunch:2026-10-13');
    expect(r).toHaveLength(2 + 2 + 3);
  });

  it('skips off days and quiet hours, and says nothing when the meal-time prompt is off', () => {
    const r = plannedReminders({ ...base, offDays: [2], lastLogDate: null });
    expect(r.some((x) => x.date === '2026-10-13')).toBe(false);
    const late: Routine = { ...routine, slots: [slot('night', 'snack', '22:00', 10)] };
    expect(plannedReminders({ ...base, routine: late, lastLogDate: null })).toEqual([]);
    expect(plannedReminders({ ...base, mealPrompt: false, lastLogDate: null })).toEqual([]);
  });
});

describe('plannedReminders: the switches and the first day', () => {
  const slots = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('slot:'));
  const away = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('away:'));

  it('with the meal-time prompt off there is no slot prompt, and the away lines still come while they are on', () => {
    const r = plannedReminders({ ...base, mealPrompt: false });
    expect(slots(r)).toEqual([]);
    expect(away(r).map((x) => x.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
  });

  it('with the away lines off and the meal-time prompt on there are slot prompts and no away lines', () => {
    const r = plannedReminders({ ...base, awayLines: false });
    expect(slots(r)).toHaveLength(2 + 3 + 3);
    expect(away(r)).toEqual([]);
  });

  it('no slot prompt on the day the person finished setup; they start the next day', () => {
    const r = slots(plannedReminders({ ...base, onboardedOn: '2026-10-12' }));
    expect(r.some((x) => x.date === '2026-10-12')).toBe(false);
    expect(r.filter((x) => x.date === '2026-10-13').map((x) => x.id)).toEqual(['slot:morning:2026-10-13', 'slot:lunch:2026-10-13', 'slot:dinner:2026-10-13']);
    expect(r).toHaveLength(3 + 3);
    // A setup day long past changes nothing.
    expect(slots(plannedReminders({ ...base, onboardedOn: '2026-09-01' }))).toHaveLength(2 + 3 + 3);
  });
});

describe('plannedReminders: absence', () => {
  const away = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('away:'));
  it('with a log today, says something on the second, third and fourth quiet day, then stops', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false }));
    expect(r.map((x) => [x.date, x.time, x.title])).toEqual([
      ['2026-10-14', '09:00', 'away_2_title'],
      ['2026-10-15', '09:00', 'away_3_title'],
      ['2026-10-16', '09:00', 'away_4_title'],
    ]);
    expect(r[0].body).toBe('away_2_body');
    expect(r[0].data).toEqual({ kind: 'away', date: '2026-10-14' });
  });

  it('counts from the last log when today has none, and never nags someone who has never logged', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false, lastLogDate: '2026-10-11' }));
    expect(r.map((x) => x.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    expect(away(plannedReminders({ ...base, lastLogDate: null }))).toEqual([]);
    expect(away(plannedReminders({ ...base, lastLogDate: '2026-10-01' }))).toEqual([]);
  });

  it('does not count an off day as a day away: last log Saturday, Sunday off, the lines start Tuesday', () => {
    // 2026-10-10 is a Saturday; counted days after it are Monday (1), Tuesday (2), Wednesday (3), Thursday (4).
    const r = away(plannedReminders({ ...base, mealPrompt: false, lastLogDate: '2026-10-10', offDays: [0] }));
    expect(r.map((x) => [x.date, x.title])).toEqual([
      ['2026-10-13', 'away_2_title'],
      ['2026-10-14', 'away_3_title'],
      ['2026-10-15', 'away_4_title'],
    ]);
    expect(r.some((x) => x.date === '2026-10-12')).toBe(false);
  });

  it('planned on a Saturday with a log and Sunday off, says nothing on Monday', () => {
    const r = away(plannedReminders({ ...base, today: '2026-10-10', mealPrompt: false, lastLogDate: '2026-10-10', offDays: [0] }));
    expect(r.map((x) => [x.date, x.title])).toEqual([
      ['2026-10-13', 'away_2_title'],
      ['2026-10-14', 'away_3_title'],
      ['2026-10-15', 'away_4_title'],
    ]);
  });

  it('waits for quiet hours to end before the morning line', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false, quietEndHour: 10 }));
    expect(r[0].time).toBe('10:00');
  });
});

describe('plannedReminders: fill in yesterday', () => {
  const on: ReminderInput = { ...quiet, nowMinutes: 8 * 60, fillYesterday: true };

  it('at nine when yesterday is partly or not at all filled in, and tomorrow too while today is not complete', () => {
    const r = plannedReminders({ ...on, records: { '2026-10-11': 'partial', '2026-10-12': 'empty' } });
    expect(r.map((x) => [x.id, x.time, x.data])).toEqual([
      ['fill:2026-10-12', '09:00', { kind: 'fill', date: '2026-10-11' }],
      ['fill:2026-10-13', '09:00', { kind: 'fill', date: '2026-10-12' }],
    ]);
    expect(r[0]).toMatchObject({ title: 'rem_fill_title', body: 'rem_fill_body' });
    // Through nine o'clock's own minute, like the meal-time prompt.
    expect(plannedReminders({ ...on, nowMinutes: 9 * 60, records: { '2026-10-11': 'partial', '2026-10-12': 'full' } }).map((x) => x.id)).toEqual(['fill:2026-10-12']);
  });

  it('says nothing for a complete, free or unknown yesterday, once nine has passed, for the setup day or before, or with the switch off', () => {
    const partly: Record<string, DayRecordState> = { '2026-10-11': 'partial', '2026-10-12': 'partial' };
    expect(plannedReminders({ ...on, records: { '2026-10-11': 'full', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, records: { '2026-10-11': 'off', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, records: {} })).toEqual([]);
    expect(plannedReminders({ ...on, nowMinutes: 9 * 60 + 1, records: { '2026-10-11': 'partial', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, onboardedOn: '2026-10-12', records: partly })).toEqual([]);
    expect(plannedReminders({ ...on, fillYesterday: false, records: partly })).toEqual([]);
  });

  it('counts from the record\'s start as the rest of the app does: a setup day after today (a clock that ran ahead) never holds it back, and a later start from the plan does', () => {
    const partly: Record<string, DayRecordState> = { '2026-10-11': 'partial', '2026-10-12': 'partial' };
    expect(plannedReminders({ ...on, onboardedOn: '2026-10-20', records: partly }).map((x) => x.id)).toEqual(['fill:2026-10-12', 'fill:2026-10-13']);
    expect(plannedReminders({ ...on, onboardedOn: '2026-09-01', autoFillFrom: '2026-10-12', records: partly })).toEqual([]);
    expect(plannedReminders({ ...on, onboardedOn: '2026-09-01', autoFillFrom: '2026-10-11', records: partly }).map((x) => x.id)).toEqual(['fill:2026-10-13']);
  });

  it('waits for quiet hours to end', () => {
    const r = plannedReminders({ ...on, nowMinutes: 0, quietEndHour: 10, records: { '2026-10-11': 'partial', '2026-10-12': 'full' } });
    expect(r.map((x) => x.time)).toEqual(['10:00']);
  });

  it('asks to look at yesterday, not that meals are missing: the meals the app fills in from the plan may have completed it by nine', () => {
    expect(makeT('en')('rem_fill_body')).toBe('Take a look at yesterday: confirm what was filled in from the plan and add anything missing.');
    for (const lang of ['mr', 'hi'] as const) {
      const words = makeT(lang)('rem_fill_body');
      expect(words, lang).not.toBe(makeT('en')('rem_fill_body'));
      expect(words, lang).not.toMatch(/[\u0966-\u096F\u2014{}]/);
    }
  });
});

describe('plannedReminders: plan next week and the weekly report', () => {
  it('plan next week on Sunday at six, off day or not, opening next week; not for a week already saved', () => {
    expect(plannedReminders({ ...quiet, planWeek: true, offDays: [0] })).toEqual([
      { id: 'planweek:2026-10-18', date: '2026-10-18', time: '18:00', title: 'rem_planweek_title', body: 'rem_planweek_body', data: { kind: 'planweek', date: '2026-10-19' } },
    ]);
    expect(plannedReminders({ ...quiet, planWeek: true, reviewedWeeks: ['2026-10-19'] })).toEqual([]);
    expect(plannedReminders({ ...quiet, planWeek: false })).toEqual([]);
  });

  it('plans the second Sunday too when today is a Sunday, each for the week after it, and a week already saved is left out', () => {
    // Sunday 18 October before six: this evening's and next Sunday's, both inside the eight days planned ahead.
    const sunday = { ...quiet, today: '2026-10-18', nowMinutes: 10 * 60, planWeek: true };
    expect(plannedReminders(sunday).map((r) => [r.id, r.data.date])).toEqual([
      ['planweek:2026-10-18', '2026-10-19'],
      ['planweek:2026-10-25', '2026-10-26'],
    ]);
    expect(plannedReminders({ ...sunday, reviewedWeeks: ['2026-10-19'] }).map((r) => r.id)).toEqual(['planweek:2026-10-25']);
    // After six on that Sunday, only next Sunday's is still to come.
    expect(plannedReminders({ ...sunday, nowMinutes: 19 * 60 }).map((r) => r.id)).toEqual(['planweek:2026-10-25']);
  });

  it('the report on the Monday it was worked out for, at nine', () => {
    expect(plannedReminders({ ...quiet, today: '2026-10-13', report: { monday: '2026-10-19', text: '5 of 7 full' } })).toEqual([
      { id: 'report:2026-10-19', date: '2026-10-19', time: '09:00', title: 'rem_report_title', body: '5 of 7 full', data: { kind: 'report', date: '2026-10-19' } },
    ]);
  });

  it('a report worked out on a Monday after nine is planned for next Monday, a week ahead', () => {
    const r = plannedReminders({ ...quiet, today: '2026-10-12', nowMinutes: 10 * 60, report: { monday: '2026-10-19', text: 'rem_report_ready' } });
    expect(r.map((x) => [x.id, x.time])).toEqual([['report:2026-10-19', '09:00']]);
  });
});

describe('abhyasWords', () => {
  const item = (p: Partial<AbhyasItem> = {}): AbhyasItem => ({ id: 'i', name: 'Reading', icon: 'book-outline', kind: 'repeat', days: [1], times: ['07:00'], order: 0, createdAt: '2026-10-01T08:00:00.000Z', ...p });
  const t = (k: string) => (k === 'rem_abhyas_min' ? '{n} of {m} min today' : k);

  it("says the item's name, and the minutes so far for one with a target or that it is on today's list for one without", () => {
    expect(abhyasWords(item({ targetMin: 30 }), 12, t)).toEqual({ title: 'Reading', body: '12 of 30 min today' });
    expect(abhyasWords(item(), 12, t)).toEqual({ title: 'Reading', body: 'rem_abhyas_list' });
    expect(abhyasWords(item({ targetMin: 0 }), 0, t).body).toBe('rem_abhyas_list');
    // An item with no name is called Abhyas.
    expect(abhyasWords(item({ name: '' }), 0, t).title).toBe('rem_abhyas');
  });
});

describe('plannedReminders: the user\'s Abhyas items', () => {
  const item = (id: string, p: Partial<AbhyasItem> = {}): AbhyasItem => ({ id, name: id, icon: 'book-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: ['07:00'], order: 0, createdAt: '2026-10-01T08:00:00.000Z', ...p });
  const reading = item('Reading', { targetMin: 30, times: ['07:00', '18:00'] });
  const coding = item('Coding', { times: ['21:00'], order: 1 });
  const list = (p: Partial<NonNullable<ReminderInput['abhyas']>> = {}) => ({ items: [reading, coding], ticks: [], sessions: [], ...p });
  const abhyas = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.data.kind === 'abhyas');

  it('comes for each item on each of its times, today (only what is still to come) and the next two days, titled with its name', () => {
    const r = plannedReminders({ ...quiet, abhyas: list() });
    // Monday at 10:00: reading at 18:00 and coding at 21:00 today, then all three times on Tuesday and Wednesday.
    expect(r.map((x) => `${x.date} ${x.time} ${x.title}`)).toEqual([
      '2026-10-12 18:00 Reading',
      '2026-10-12 21:00 Coding',
      '2026-10-13 07:00 Reading',
      '2026-10-13 18:00 Reading',
      '2026-10-13 21:00 Coding',
      '2026-10-14 07:00 Reading',
      '2026-10-14 18:00 Reading',
      '2026-10-14 21:00 Coding',
    ]);
    expect(OWN_DAYS).toBe(3);
    expect(r[0]).toEqual({ id: 'abhyas:Reading:18:00:2026-10-12', date: '2026-10-12', time: '18:00', title: 'Reading', body: '0 of 30 min today', data: { kind: 'abhyas', itemId: 'Reading', date: '2026-10-12' } });
    // A tick-only item says it is on today's list.
    expect(r[1].body).toBe('rem_abhyas_list');
  });

  it('says the minutes so far today, and is quiet for an item done: ticked, or its target reached by the timer', () => {
    const session = (minutes: number, date = '2026-10-12') => ({ id: `s${minutes}${date}`, itemId: 'Reading', date, startedAt: `${date}T07:00:00.000Z`, endedAt: `${date}T08:00:00.000Z`, minutes });
    const some = abhyas(plannedReminders({ ...quiet, abhyas: list({ sessions: [session(12)] }) }));
    expect(some.find((x) => x.id === 'abhyas:Reading:18:00:2026-10-12')?.body).toBe('12 of 30 min today');
    expect(some.find((x) => x.id === 'abhyas:Reading:07:00:2026-10-13')?.body).toBe('0 of 30 min today');
    const target = abhyas(plannedReminders({ ...quiet, abhyas: list({ sessions: [session(30)] }) }));
    expect(target.filter((x) => x.date === '2026-10-12').map((x) => x.title)).toEqual(['Coding']);
    const ticked = abhyas(plannedReminders({ ...quiet, abhyas: list({ ticks: [{ id: 't', itemId: 'Coding', date: '2026-10-13', at: '2026-10-13T09:00:00.000Z' }] }) }));
    expect(ticked.filter((x) => x.title === 'Coding').map((x) => x.date)).toEqual(['2026-10-12', '2026-10-14']);
  });

  it('keeps to the item\'s own days, a one-off to its date, and leaves out an item removed', () => {
    const r = plannedReminders({
      ...quiet,
      abhyas: { items: [item('Swim', { days: [3] }), item('Bike', { kind: 'once', days: [], date: '2026-10-13' }), item('Gone', { archivedAt: '2026-10-11T08:00:00.000Z' })], ticks: [], sessions: [] },
    });
    expect(r.map((x) => `${x.title} ${x.date}`)).toEqual(['Bike 2026-10-13', 'Swim 2026-10-14']);
  });

  it('never in quiet hours; on an off day, which the item\'s own days decide; nothing while the switch is off', () => {
    const late = plannedReminders({ ...quiet, abhyas: { items: [item('Late', { times: ['23:00', '06:30'] })], ticks: [], sessions: [] } });
    expect(late).toEqual([]);
    expect(abhyas(plannedReminders({ ...quiet, offDays: [2], abhyas: list() })).some((x) => x.date === '2026-10-13')).toBe(true);
    expect(plannedReminders({ ...quiet, abhyas: null })).toEqual([]);
    expect(plannedReminders(quiet)).toEqual([]);
  });

  it('reads an item\'s times as kept: clock times only, each once', () => {
    const odd = item('Odd', { times: ['18:00', '25:00', 'x', '18:00'] });
    expect(plannedReminders({ ...quiet, abhyas: { items: [odd], ticks: [], sessions: [] } }).map((x) => x.time)).toEqual(['18:00', '18:00', '18:00']);
  });

  it('keeps a list of four items at two times each, with the meal-time prompts and the day so far, well under the phone\'s cap', () => {
    const four = ['A', 'B', 'C', 'D'].map((id, i) => item(id, { times: ['11:00', '17:00'], order: i }));
    const texts = { '2026-10-12': { title: 'T', body: 'B' }, '2026-10-13': { title: 'T', body: 'B' }, '2026-10-14': { title: 'T', body: 'B' } };
    const r = plannedReminders({ ...base, abhyas: { items: four, ticks: [], sessions: [] }, checklist: { times: ['20:30'], texts } });
    expect(r.filter((x) => x.data.kind === 'abhyas')).toHaveLength(4 * 2 * 3);
    expect(r.length).toBeLessThanOrEqual(PENDING_LIMIT / 2 + 8);
    expect(r.some((x) => x.date > '2026-10-14' && (x.data.kind === 'abhyas' || x.data.kind === 'checklist'))).toBe(false);
  });
});

describe('plannedReminders: "Day so far"', () => {
  const texts = { '2026-10-12': { title: 'Dhyey · Day so far', body: '○ Lunch' }, '2026-10-13': { title: 'Dhyey · Day so far', body: '○ Breakfast' }, '2026-10-14': null, '2026-10-15': { title: 'x', body: 'y' } };
  const checklist = { times: ['13:00', '20:30'], texts };

  it('comes at each of its times with the words worked out for that day, today and the next two days; a day with nothing to say gets none', () => {
    const r = plannedReminders({ ...quiet, checklist });
    expect(r.map((x) => [x.id, x.body])).toEqual([
      ['checklist:13:00:2026-10-12', '○ Lunch'],
      ['checklist:20:30:2026-10-12', '○ Lunch'],
      ['checklist:13:00:2026-10-13', '○ Breakfast'],
      ['checklist:20:30:2026-10-13', '○ Breakfast'],
    ]);
    expect(r[0]).toEqual({ id: 'checklist:13:00:2026-10-12', date: '2026-10-12', time: '13:00', title: 'Dhyey · Day so far', body: '○ Lunch', data: { kind: 'checklist', date: '2026-10-12' } });
  });

  it('only what is still to come today, never in quiet hours, on an off day or on the day setup was finished, and nothing while it is off', () => {
    expect(plannedReminders({ ...quiet, nowMinutes: 14 * 60, checklist }).map((x) => x.id)).toEqual(['checklist:20:30:2026-10-12', 'checklist:13:00:2026-10-13', 'checklist:20:30:2026-10-13']);
    expect(plannedReminders({ ...quiet, checklist: { ...checklist, times: ['22:30', '06:00'] } })).toEqual([]);
    expect(plannedReminders({ ...quiet, offDays: [1], checklist }).map((x) => x.date)).toEqual(['2026-10-13', '2026-10-13']);
    expect(plannedReminders({ ...quiet, onboardedOn: '2026-10-12', checklist }).map((x) => x.date)).toEqual(['2026-10-13', '2026-10-13']);
    expect(plannedReminders({ ...quiet, checklist: null })).toEqual([]);
    expect(plannedReminders({ ...quiet, checklist: { ...checklist, times: [] } })).toEqual([]);
  });

  it('reads its times as kept: clock times only, each once', () => {
    expect(plannedReminders({ ...quiet, checklist: { times: ['20:30', '20:30', '9:00', 'x'], texts } }).map((x) => x.id)).toEqual(['checklist:20:30:2026-10-12', 'checklist:20:30:2026-10-13']);
  });
});

describe('weekReport: the week before a Monday, by the rules Progress uses', () => {
  const monday = '2026-10-19';
  // Monday 12th to Sunday 18th; the 15th is complete with every meal skipped.
  const states: [string, DayRecordState, boolean][] = [
    ['2026-10-12', 'full', false],
    ['2026-10-13', 'full', false],
    ['2026-10-14', 'partial', false],
    ['2026-10-15', 'full', true],
    ['2026-10-16', 'empty', false],
    ['2026-10-17', 'full', false],
    ['2026-10-18', 'off', false],
  ];
  const byDate = new Map(states.map(([date, state, nothingEaten]): [string, DayRecord] => [date, { state, fromPlan: false, nothingEaten }]));
  const recordOn = (date: string): DayRecord => byDate.get(date) ?? { state: 'empty', fromPlan: false, nothingEaten: true };
  const meals = [
    { date: '2026-10-12', kcal: 1800 },
    { date: '2026-10-13', kcal: 1600 },
    { date: '2026-10-13', kcal: 400 },
    { date: '2026-10-14', kcal: 1000 },
    { date: '2026-10-15', kcal: 30 },
    { date: '2026-10-17', kcal: 1700 },
    { date: '2026-10-19', kcal: 900 },
  ];
  const weights = [
    { date: '2026-09-20', kg: 80 },
    { date: '2026-09-27', kg: 79.6 },
    { date: '2026-10-04', kg: 79.3 },
    { date: '2026-10-11', kg: 79 },
    { date: '2026-10-18', kg: 78.6 },
  ];
  const input = { monday, today: '2026-10-18', since: '2026-10-01', recordOn, meals, weights, goal: 1850 };

  it('counts the full days of the days that can be full, averages the complete days, and gives the weight and its change as Progress shows them', () => {
    const r = weekReport(input);
    // Full: the 12th, 13th and 17th; the 15th is complete but nothing was eaten; the free 18th cannot be full.
    // Average over the complete days 12th, 13th, 15th and 17th: (1800 + 2000 + 30 + 1700) / 4.
    expect(r).toEqual({ full: { n: 3, of: 6 }, avgKcal: 1383, goal: 1850, weight: { kg: -1, weeks: 3 } });
    expect(r!.weight).toEqual(shownWeight(weights, '2026-10-18')!.change);
  });

  it('says the week in one line', () => {
    expect(reportText(weekReport(input)!, t)).toBe('3 of 6 full · average 1,383, goal 1,850 · weight −1.0 kg in 3 weeks');
  });

  it('leaves out what it cannot say: no complete day, no change to show, no day that could be full', () => {
    const none = weekReport({ ...input, recordOn: () => ({ state: 'partial', fromPlan: false, nothingEaten: false }), weights: [{ date: '2026-10-18', kg: 78.6 }] });
    expect(none).toEqual({ full: { n: 0, of: 7 }, avgKcal: null, goal: 1850, weight: null });
    expect(reportText(none!, t)).toBe('0 of 7 full');
    // Days before the start cannot be full: a week before it says no count.
    const early = weekReport({ ...input, since: '2026-10-19' });
    expect(early!.full).toEqual({ n: 0, of: 0 });
    expect(reportText(early!, t)).toBe('weight −1.0 kg in 3 weeks');
    // A weigh-in more than thirty days old shows no change, as on Progress.
    expect(weekReport({ ...input, today: '2026-12-01' })!.weight).toBeNull();
  });

  it('has its words in English, Marathi and Hindi, the numbers in the digits the app writes', () => {
    const keys = ['prompt_title', 'prompt_body', 'rem_fill_title', 'rem_fill_body', 'rem_planweek_title', 'rem_planweek_body', 'rem_report_title', 'rem_report_full', 'rem_report_avg', 'rem_report_weight'];
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const words = makeT(lang);
      for (const k of keys) {
        expect(words(k), `${lang} ${k}`).not.toBe(k);
        // The prompt's title is only the slot and its calories, the same in every language.
        if (lang !== 'en' && k !== 'prompt_title') expect(words(k), `${lang} ${k}`).not.toBe(makeT('en')(k));
      }
      const line = reportText(weekReport(input)!, words);
      expect(line, lang).toMatch(/3/);
      expect(line, lang).toMatch(/1,383/);
      expect(line, lang).toMatch(/−1\.0/);
      expect(line, lang).not.toMatch(/[\u0966-\u096F{}]/);
    }
  });

  it('says nothing for a week with no meal and no weigh-in', () => {
    expect(weekReport({ ...input, meals: [{ date: '2026-10-19', kcal: 900 }], weights: weights.filter((w) => w.date < '2026-10-12') })).toBeNull();
  });

  // The report as it is planned at an open: its words are fixed then, and the phone shows them on Monday without asking again.
  const plan = { since: input.since, recordOn, meals, weights, goal: 1850, t };

  it('worked out on Sunday 14:00, before the week has ended, carries no numbers: Progress will count the days logged after it', () => {
    expect(weeklyReport({ ...plan, today: '2026-10-18', nowMinutes: 14 * 60 })).toEqual({ monday: '2026-10-19', text: 'rem_report_ready' });
    expect(weeklyReport({ ...plan, today: '2026-10-14', nowMinutes: 9 * 60 })).toEqual({ monday: '2026-10-19', text: 'rem_report_ready' });
  });

  it('worked out on the Monday before nine, once the week has ended, carries the numbers, judged on that Monday', () => {
    const r = weeklyReport({ ...plan, today: '2026-10-19', nowMinutes: 8 * 60 });
    expect(r).toEqual({ monday: '2026-10-19', text: reportText(weekReport({ ...input, today: '2026-10-19' })!, t) });
    expect(r!.text).toMatch(/^3 of 6 full · average 1,383, goal 1,850/);
    // Through nine o'clock's own minute, and the moment follows the end of quiet hours.
    expect(weeklyReport({ ...plan, today: '2026-10-19', nowMinutes: 9 * 60 })!.text).toBe(r!.text);
    expect(weeklyReport({ ...plan, today: '2026-10-19', nowMinutes: 10 * 60, atMinutes: 11 * 60 })!.text).toBe(r!.text);
  });

  it('worked out on a Monday after nine, plans next Monday\'s, without numbers', () => {
    expect(weeklyReport({ ...plan, today: '2026-10-19', nowMinutes: 10 * 60 })).toEqual({ monday: '2026-10-26', text: 'rem_report_ready' });
  });

  it('sends none for a week with nothing in it, or when every part of it would be left out', () => {
    expect(weeklyReport({ ...plan, today: '2026-10-19', nowMinutes: 10 * 60, meals: meals.filter((m) => m.date < '2026-10-19') })).toBeNull();
    // Days before the start cannot be full, no day is complete, and one weigh-in shows no change: nothing to say.
    const nothing = { ...plan, since: '2026-10-19', recordOn: () => ({ state: 'partial', fromPlan: false, nothingEaten: false }) as DayRecord, weights: [{ date: '2026-10-18', kg: 78.6 }] };
    expect(reportText(weekReport({ ...input, ...nothing, today: '2026-10-19' })!, t)).toBe('');
    expect(weeklyReport({ ...nothing, today: '2026-10-19', nowMinutes: 8 * 60 })).toBeNull();
    expect(weeklyReport({ ...nothing, today: '2026-10-18', nowMinutes: 14 * 60 })).toBeNull();
  });

  it('says the week is ready in English, Marathi and Hindi, with no number in it', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const words = makeT(lang)('rem_report_ready');
      expect(words, lang).not.toBe('rem_report_ready');
      expect(words, lang).not.toMatch(/[0-9\u0966-\u096F\u2014{}]/);
    }
    expect(makeT('en')('rem_report_ready')).toBe('Your week is ready. See how it went on Progress.');
  });

  it('goes out on the coming Monday: today until nine has passed', () => {
    expect(reportMonday('2026-10-19', 8 * 60)).toBe('2026-10-19');
    expect(reportMonday('2026-10-19', 9 * 60)).toBe('2026-10-19');
    expect(reportMonday('2026-10-19', 10 * 60)).toBe('2026-10-26');
    expect(reportMonday('2026-10-19', 10 * 60, 11 * 60)).toBe('2026-10-19');
    expect(reportMonday('2026-10-21', 0)).toBe('2026-10-26');
    expect(reportMonday('2026-10-25', 0)).toBe('2026-10-26');
  });
});

describe('a tap on a notification', () => {
  const menu: DayMenu = {
    date: '2026-10-12',
    editedAt: '',
    meals: [
      { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
      { id: 'dinner', type: 'dinner', time: '19:30', lines: [] },
    ],
  };
  const lunch = (source?: Meal['source']): Meal => ({ id: 'm1', at: new Date('2026-10-12T13:10:00').toISOString(), date: '2026-10-12', type: 'lunch', slotId: 'lunch', items: [], kcal: 300, protein: 10, source });

  it('"Ate as planned" logs the planned meal while the slot is open, and confirms the one the app filled in', () => {
    expect(promptOutcome({ menu, meals: [], skips: [], slotId: 'lunch' })).toEqual({ kind: 'log' });
    expect(promptOutcome({ menu, meals: [lunch('auto')], skips: [], slotId: 'lunch' })).toEqual({ kind: 'confirm', mealId: 'm1' });
  });

  it('does nothing for a slot eaten, skipped, or with nothing planned', () => {
    expect(promptOutcome({ menu, meals: [lunch('manual')], skips: [], slotId: 'lunch' })).toEqual({ kind: 'none' });
    expect(promptOutcome({ menu, meals: [], skips: [{ id: skipId('2026-10-12', 'lunch'), date: '2026-10-12', slotId: 'lunch' }], slotId: 'lunch' })).toEqual({ kind: 'none' });
    expect(promptOutcome({ menu, meals: [], skips: [], slotId: 'dinner' })).toEqual({ kind: 'none' });
    expect(promptOutcome({ menu, meals: [], skips: [], slotId: 'nope' })).toEqual({ kind: 'none' });
  });

  it('opens the day it is about, next week\'s plan, or Progress', () => {
    expect(tapRoute({ kind: 'slot', date: '2026-10-12', slotId: 'lunch' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'slot', date: '2026-10-13', slotId: 'lunch' }, '2026-10-12')).toBe('/?date=2026-10-13');
    expect(tapRoute({ kind: 'fill', date: '2026-10-11' }, '2026-10-12')).toBe('/?date=2026-10-11');
    expect(tapRoute({ kind: 'planweek', date: '2026-10-19' }, '2026-10-12')).toBe('/plan?date=2026-10-19');
    expect(tapRoute({ kind: 'report', date: '2026-10-19' }, '2026-10-19')).toBe('/progress');
    expect(tapRoute({ kind: 'away', date: 'soon' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'fill', date: '2026-02-30' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'planweek', date: 7 }, '2026-10-12')).toBe('/plan');
    expect(tapRoute({}, '2026-10-12')).toBe('/');
  });

  it('an Abhyas reminder and "Day so far" open Today, whatever day they were for', () => {
    expect(tapRoute({ kind: 'abhyas', itemId: 'reading', date: '2026-10-12' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'abhyas', itemId: 'reading', date: '2026-10-11' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'checklist', date: '2026-10-11' }, '2026-10-12')).toBe('/');
  });

  it('a daily reminder opens its own page: the check-in, and Today for water, the review, a break and the day\'s line', () => {
    expect(tapRoute({ kind: 'sleep' }, '2026-10-12')).toBe('/sleep');
    expect(tapRoute({ kind: 'water' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'review' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'break' }, '2026-10-12')).toBe('/');
    // The day's line always opens Today.
    expect(tapRoute({ kind: 'mantra' }, '2026-10-12')).toBe('/');
  });

  // A meal-time prompt for lunch on 12 October, tapped on its button or its body.
  const prompt = { kind: 'slot', date: '2026-10-12', slotId: 'lunch' };
  const tap = (action: 'open' | 'ate', o: { data?: Record<string, unknown>; today?: string; meals?: Meal[]; skips?: { id: string; date: string; slotId: string }[] } = {}) =>
    tapPlan({ action, data: o.data ?? prompt, today: o.today ?? '2026-10-12', menuOn: (date) => ({ ...menu, date }), meals: o.meals ?? [], skips: o.skips ?? [] });

  it('"Ate as planned" logs that date\'s slot while it is open and opens Today on that day; the body only opens the day', () => {
    expect(tap('ate')).toEqual({ route: '/', ate: { date: '2026-10-12', slotId: 'lunch', outcome: { kind: 'log' } } });
    expect(tap('open')).toEqual({ route: '/', ate: null });
    // Tapped the next morning: yesterday's lunch, and Today opens on yesterday.
    expect(tap('ate', { today: '2026-10-13' })).toEqual({ route: '/?date=2026-10-12', ate: { date: '2026-10-12', slotId: 'lunch', outcome: { kind: 'log' } } });
  });

  it('confirms the meal the app filled in meanwhile, and does nothing for a slot already eaten or skipped', () => {
    expect(tap('ate', { meals: [lunch('auto')] }).ate?.outcome).toEqual({ kind: 'confirm', mealId: 'm1' });
    expect(tap('ate', { meals: [lunch('manual')] }).ate?.outcome).toEqual({ kind: 'none' });
    expect(tap('ate', { skips: [{ id: skipId('2026-10-12', 'lunch'), date: '2026-10-12', slotId: 'lunch' }] }).ate?.outcome).toEqual({ kind: 'none' });
  });

  it('never logs the meal twice: once the meal it logged is there, the same tap does nothing', () => {
    expect(tap('ate', { meals: [lunch('plan')] }).ate?.outcome).toEqual({ kind: 'none' });
  });

  it('a tap on a daily reminder goes through the same plan: its page, and nothing logged', () => {
    const daily = (data: Record<string, unknown>) => tapPlan({ action: 'open', data, today: '2026-10-12', menuOn: (date) => ({ ...menu, date }), meals: [], skips: [] });
    expect(daily({ kind: 'sleep' })).toEqual({ route: '/sleep', ate: null });
    expect(daily({ kind: 'water' })).toEqual({ route: '/', ate: null });
    expect(daily({ kind: 'mantra' })).toEqual({ route: '/', ate: null });
  });

  it('logs nothing into a day still to come, nor from a notification whose data is damaged or not a meal-time prompt', () => {
    expect(tap('ate', { today: '2026-10-11' })).toEqual({ route: '/?date=2026-10-12', ate: null });
    expect(tap('ate', { data: { ...prompt, date: '2026-02-30' } }).ate).toBeNull();
    expect(tap('ate', { data: { kind: 'slot', date: '2026-10-12' } }).ate).toBeNull();
    expect(tap('ate', { data: { kind: 'fill', date: '2026-10-12', slotId: 'lunch' } })).toEqual({ route: '/', ate: null });
    expect(tap('ate', { data: {} })).toEqual({ route: '/', ate: null });
  });

  // The store as a tap finds it: no meal yet, and the day's line switched on with its card on Today or not.
  const store = (mantraCard: boolean) => ({
    meals: [] as Meal[],
    slotSkips: [],
    settings: {
      todayCards: [...DEFAULT_SETTINGS.todayCards.filter((c) => c.id !== 'mantra'), { id: 'mantra' as const, on: mantraCard }],
      features: { ...DEFAULT_SETTINGS.features, mantra: true },
    },
  });
  const arrives = (action: 'open' | 'ate', data: Record<string, unknown>, now: string, mantraCard = false) =>
    tapPlanAt({ action, data, now: new Date(now), menuOn: (date) => ({ ...menu, date }), state: store(mantraCard) });

  it('a tap reads today from the clock as it arrives, so a woken app whose day has not turned yet still logs this morning\'s meal', () => {
    const today = { kind: 'slot', date: '2026-10-13', slotId: 'lunch' };
    // The clock says 13 October; the store may still say the 12th for a moment.
    expect(arrives('ate', today, '2026-10-13T13:05:00')).toEqual({ route: '/', ate: { date: '2026-10-13', slotId: 'lunch', outcome: { kind: 'log' } } });
    // Read on the store's day, the same tap would be a day still to come, and log nothing.
    expect(tap('ate', { data: today, today: '2026-10-12' }).ate).toBeNull();
  });

  it('a tap just after midnight on yesterday\'s prompt logs and opens that day, not the new one', () => {
    expect(arrives('ate', prompt, '2026-10-13T00:10:00')).toEqual({ route: '/?date=2026-10-12', ate: { date: '2026-10-12', slotId: 'lunch', outcome: { kind: 'log' } } });
    expect(arrives('open', { kind: 'fill', date: '2026-10-12' }, '2026-10-13T09:00:00').route).toBe('/?date=2026-10-12');
  });

  it('the day\'s line opens Today, whether its card is shown there or not', () => {
    expect(arrives('open', { kind: 'mantra' }, '2026-10-12T08:00:00', true).route).toBe('/');
    expect(arrives('open', { kind: 'mantra' }, '2026-10-12T08:00:00', false).route).toBe('/');
  });

  it('acts on a tap once: read at start and from the listener it is one tap; the button and the body, or a reminder back the next day, are new ones', () => {
    const seen = firstTap(new Set(), tapKey('sobat-water', 'open', 1000));
    expect(seen).not.toBeNull();
    expect(firstTap(seen!, tapKey('sobat-water', 'open', 1000))).toBeNull();
    expect(firstTap(seen!, tapKey('sobat-water', 'ate', 1000))).not.toBeNull();
    expect(firstTap(seen!, tapKey('sobat-water', 'open', 1000 + 86400000))).not.toBeNull();
    expect(firstTap(seen!, tapKey('sobat-water@2026-10-12', 'open', 1000))).not.toBeNull();
  });

  it('the check for a first tap is pure: the keys given are left as they were', () => {
    const given: ReadonlySet<string> = new Set(['a']);
    const next = firstTap(given, 'b');
    expect([...given]).toEqual(['a']);
    expect([...next!]).toEqual(['a', 'b']);
  });

  it('says what the button did in English, Marathi and Hindi, in plain words', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const words = makeT(lang);
      for (const k of ['prompt_logged', 'prompt_already']) {
        expect(words(k), `${lang} ${k}`).not.toBe(k);
        expect(words(k), `${lang} ${k}`).not.toMatch(/[\u0966-\u096F\u2014{}]/);
      }
    }
  });
});

describe('days away', () => {
  it('counts days between dates and since the last log', () => {
    expect(daysBetween('2026-10-01', '2026-10-04')).toBe(3);
    expect(lastLogDate([meal('2026-10-03'), meal('2026-10-01')], '2026-10-12')).toBe('2026-10-03');
    expect(lastLogDate([meal('2026-10-20')], '2026-10-12')).toBeNull();
  });

  it('leaves off days out of the count, so an off Sunday is not a day away on Monday', () => {
    expect(missedDays('2026-10-10', '2026-10-12', [0])).toBe(1);
    expect(missedDays('2026-10-10', '2026-10-12', [])).toBe(2);
    expect(missedDays('2026-10-12', '2026-10-12', [])).toBe(0);
  });
});

describe('dailyReminders', () => {
  const day = { active: true, sleepCheckin: true, water: true, dayReview: true, quietStartHour: 22, quietEndHour: 7, mantra: 'Steady.', breaks: DEFAULT_BREAK_SETTINGS, nowMs: 0, t };
  const longs = (x: ReturnType<typeof dailyReminders>) => x.filter((r) => r.id.startsWith('sobat-long-break'));
  const at = (r: { hour: number; minute: number }) => `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`;
  const ids = (x: ReturnType<typeof dailyReminders>) => x.filter((r) => !r.id.startsWith('sobat-long-break')).map((r) => `${r.id} ${at(r)}`);

  it('a device that is signed out or reset keeps no daily reminders at all', () => {
    expect(dailyReminders({ ...day, active: false })).toEqual([]);
  });

  it('the long-break reminder never falls in quiet hours: hourly from the end of the night to the start of the next', () => {
    const r = longs(dailyReminders(day));
    expect(r.map(at)).toEqual(['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']);
    expect(r[0]).toMatchObject({ title: 'brk_long', body: 'brk_long_hint' });
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
  });

  it('the app\'s own quiet hours hold it back too', () => {
    const r = longs(dailyReminders({ ...day, quietStartHour: 20, quietEndHour: 9 }));
    expect(r.map(at)[0]).toBe('09:00');
    expect(r.every((x) => x.hour >= 9 && x.hour < 20)).toBe(true);
  });

  it('none while breaks are off, paused, or kept to a work schedule a daily reminder cannot follow', () => {
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, enabled: false } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, long: { ...DEFAULT_BREAK_SETTINGS.long, enabled: false } } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, nowMs: 1000, breaks: { ...DEFAULT_BREAK_SETTINGS, pausedUntilMs: 5000 } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, schedule: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 } } }))).toEqual([]);
  });

  it('keeps the fixed day, each reminder with its own switch: check-in, the day\'s line, water and the recap', () => {
    expect(ids(dailyReminders(day))).toEqual(['sobat-sleep-checkin 07:30', 'sobat-mantra 08:00', 'sobat-water 15:00', 'sobat-day-review 21:30']);
    expect(ids(dailyReminders({ ...day, mantra: '' }))).toEqual(['sobat-sleep-checkin 07:30', 'sobat-water 15:00', 'sobat-day-review 21:30']);
    expect(ids(dailyReminders({ ...day, sleepCheckin: false, water: false, dayReview: false }))).toEqual(['sobat-mantra 08:00']);
    expect(ids(dailyReminders({ ...day, sleepCheckin: false, water: true, dayReview: false, mantra: '' }))).toEqual(['sobat-water 15:00']);
  });

  it('each one carries what a tap opens: the check-in, the day\'s line, water, the review and the long breaks', () => {
    const all = dailyReminders(day);
    const kinds = Object.fromEntries(all.filter((r) => !r.id.startsWith('sobat-long-break')).map((r) => [r.id, r.data]));
    expect(kinds).toEqual({ 'sobat-sleep-checkin': { kind: 'sleep' }, 'sobat-mantra': { kind: 'mantra' }, 'sobat-water': { kind: 'water' }, 'sobat-day-review': { kind: 'review' } });
    expect(longs(all).every((r) => r.data.kind === 'break')).toBe(true);
  });

  it('never holds the old dinner reminder: the pattern is always on and its dinner slot asks; the id stays known so a device that holds it cancels it', () => {
    for (const quietStartHour of [20, 22, 23]) expect(dailyReminders({ ...day, quietStartHour }).some((r) => r.id === DAILY_IDS.dinner)).toBe(false);
    expect(Object.values(DAILY_IDS)).toContain('sobat-dinner');
  });
});

describe('the phone\'s cap on pending notifications', () => {
  const day = { active: true, sleepCheckin: true, water: true, dayReview: true, quietStartHour: 0, quietEndHour: 0, mantra: 'Steady.', nowMs: 0, t };
  // Every fifteen minutes round the clock, with no quiet hours: 95 long breaks, more than the phone keeps on its own.
  const often = { ...DEFAULT_BREAK_SETTINGS, quietStartHour: 0, quietEndHour: 0, long: { ...DEFAULT_BREAK_SETTINGS.long, everyMinutes: 15 } };
  const isLong = (r: { id: string }) => r.id.startsWith('sobat-long-break');

  it('is 64, as iOS keeps no more than that for an app and drops the rest without a word', () => {
    expect(PENDING_LIMIT).toBe(64);
  });

  it('keeps the planned reminders first, then the daily ones and the office day, and leaves the long breaks what is left', () => {
    expect(pendingFit(30, 6)).toEqual({ planned: 30, office: 6, daily: 28 });
    expect(pendingFit(0, 0)).toEqual({ planned: 0, office: 0, daily: 64 });
    // More than 64 planned is unlikely (three days of prompts, Abhyas times and a few morning lines), but the cap holds if it comes.
    expect(pendingFit(70, 6)).toEqual({ planned: 64, office: 0, daily: 0 });
    expect(pendingFit(60, 6)).toEqual({ planned: 60, office: 4, daily: 0 });
  });

  describe('reminderOps: one run that brings the phone to what is wanted', () => {
    const at = (id: string, date = '2026-10-13', time = '13:00') => ({ osId: `sobat-r-${id}`, reminder: { id, date, time, title: id, body: '', data: { kind: 'slot' } } });
    const daily = (id: string) => ({ id, hour: 8, minute: 0, title: id, body: '', data: { kind: 'break' as const } });
    const NOW = new Date('2026-10-12T12:00:00').getTime();

    it('does every cancel, of either kind, before any add, so the count never passes the cap on the way', () => {
      const ops = reminderOps({
        have: ['sobat-r-old', 'sobat-r-keep', `${LONG_BREAK_ID}-3`, 'sobat-water'],
        planned: [at('keep'), at('new')],
        daily: [daily('sobat-sleep-checkin'), daily(`${LONG_BREAK_ID}-1`)],
        nowMs: NOW,
      });
      const kinds = ops.map((o) => o.kind);
      expect(kinds.lastIndexOf('cancel')).toBeLessThan(kinds.findIndex((k) => k !== 'cancel'));
      // Only what the phone holds is cancelled: the planned one no longer wanted, the long break and water switched off.
      expect(ops.filter((o) => o.kind === 'cancel').map((o) => o.id).sort()).toEqual(['sobat-r-old', `${LONG_BREAK_ID}-3`, 'sobat-water'].sort());
      // The daily list is registered whole (a repeating notification is replaced by its id); a planned one the phone holds is left.
      expect(ops.filter((o) => o.kind === 'daily').map((o) => o.kind === 'daily' && o.reminder.id)).toEqual(['sobat-sleep-checkin', `${LONG_BREAK_ID}-1`]);
      expect(ops.filter((o) => o.kind === 'at').map((o) => o.id)).toEqual(['sobat-r-new']);
    });

    it('leaves a kind not known yet, or already held, as it is, and never plans a moment already past', () => {
      const ops = reminderOps({ have: ['sobat-r-old', 'sobat-water'], planned: [at('gone', '2026-10-12', '11:00')], daily: null, nowMs: NOW });
      expect(ops).toEqual([{ kind: 'cancel', id: 'sobat-r-old' }]);
      expect(reminderOps({ have: ['sobat-r-old'], planned: null, daily: null, nowMs: NOW })).toEqual([]);
    });
  });

  it('cuts the long breaks to the room left, after the check-in, the line, water and the review, earliest first', () => {
    const full = dailyReminders({ ...day, breaks: often });
    expect(full.filter(isLong).length).toBeGreaterThan(PENDING_LIMIT);
    const r = dailyReminders({ ...day, breaks: often, room: 10 });
    expect(r).toHaveLength(10);
    expect(r.slice(0, 4).map((x) => x.id)).toEqual(['sobat-sleep-checkin', 'sobat-mantra', 'sobat-water', 'sobat-day-review']);
    expect(r.slice(4).map((x) => x.id)).toEqual(full.filter(isLong).slice(0, 6).map((x) => x.id));
    expect(dailyReminders({ ...day, breaks: often, room: 2 }).map((x) => x.id)).toEqual(['sobat-sleep-checkin', 'sobat-mantra']);
    expect(dailyReminders({ ...day, breaks: often, room: 0 })).toEqual([]);
  });

  it('orders the planned list by what matters: the meal-time prompts, "Day so far", the morning lines, then the Abhyas times, each soonest first', () => {
    const r = (id: string, kind: string, date: string, time: string) => ({ id, date, time, title: id, body: '', data: { kind, date } });
    const list = [r('a2', 'abhyas', '2026-10-13', '07:00'), r('a1', 'abhyas', '2026-10-12', '21:00'), r('f', 'fill', '2026-10-13', '09:00'), r('c', 'checklist', '2026-10-13', '20:30'), r('s2', 'slot', '2026-10-13', '13:00'), r('s1', 'slot', '2026-10-12', '19:30')];
    expect(byPriority(list).map((x) => x.id)).toEqual(['s1', 's2', 'c', 'f', 'a1', 'a2']);
    // The list given is left as it was.
    expect(list[0].id).toBe('a2');
  });

  it('counts the fixed daily ones each by its switch, none in quiet hours, and none on a device signed out', () => {
    expect(fixedDaily(day).map((r) => r.id)).toEqual(['sobat-sleep-checkin', 'sobat-mantra', 'sobat-water', 'sobat-day-review']);
    expect(fixedDaily({ ...day, water: false, mantra: '' }).map((r) => r.id)).toEqual(['sobat-sleep-checkin', 'sobat-day-review']);
    // Quiet from 21:00 to 08:00: the check-in at 7:30 and the review at 21:30 stay quiet.
    expect(fixedDaily({ ...day, quietStartHour: 21, quietEndHour: 8 }).map((r) => r.id)).toEqual(['sobat-mantra', 'sobat-water']);
    expect(fixedDaily({ ...day, active: false })).toEqual([]);
  });

  it('a long Abhyas list never pushes out a meal-time prompt, "Day so far", the office day or the fixed daily ones: Abhyas gets what is left, soonest first, and the long breaks after it', () => {
    const many = Array.from({ length: 12 }, (_, i): AbhyasItem => ({ id: `job${i}`, name: `Job ${i}`, icon: 'book-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: ['08:00', '12:00', '17:00'], order: i, createdAt: '2026-10-01T08:00:00.000Z' }));
    const text = { title: 'Dhyey · Day so far', body: '○ Lunch' };
    const planned = plannedReminders({ ...base, nowMinutes: 0, abhyas: { items: many, ticks: [], sessions: [] }, checklist: { times: ['20:30'], texts: { '2026-10-12': text, '2026-10-13': text, '2026-10-14': text } } });
    const kind = (k: string) => (r: { data: Record<string, string> }) => r.data.kind === k;
    const own = planned.filter(kind('abhyas'));
    expect(own).toHaveLength(12 * 3 * 3);
    expect(planned.length).toBeGreaterThan(PENDING_LIMIT);

    const office = 10;
    const fit = fitPending({ planned, office, fixed: fixedDaily(day).length });
    // Every meal-time prompt and "Day so far" of the days planned is held, and the office day whole.
    expect(fit.planned.filter(kind('slot')).map((r) => r.id)).toEqual(planned.filter(kind('slot')).map((r) => r.id));
    expect(fit.planned.filter(kind('slot'))).toHaveLength(3 * 3);
    expect(fit.planned.filter(kind('checklist'))).toHaveLength(3);
    expect(fit.office).toBe(office);
    // The fixed daily ones keep their room; the long breaks, every fifteen minutes, get none once Abhyas has taken the rest.
    const daily = dailyReminders({ ...day, breaks: often, room: fit.daily });
    expect(daily.filter((r) => !isLong(r))).toHaveLength(4);
    expect(daily.filter(isLong)).toEqual([]);
    // The lines after days away are held too: everything but Abhyas comes first.
    const rest = planned.filter((r) => r.data.kind !== 'abhyas');
    expect(fit.planned.filter((r) => r.data.kind !== 'abhyas')).toHaveLength(rest.length);
    // Abhyas fills what is left, the soonest first.
    const held = fit.planned.filter(kind('abhyas'));
    expect(held.length).toBe(PENDING_LIMIT - rest.length - office - 4);
    expect(held.length).toBeGreaterThan(0);
    expect(held.map((r) => r.id)).toEqual(own.slice(0, held.length).map((r) => r.id));
    expect(fit.planned.length + fit.office + daily.length).toBe(PENDING_LIMIT);
  });

  it('with room to spare holds every planned one, Abhyas included, and leaves the rest to the daily ones', () => {
    const planned = plannedReminders({ ...base, abhyas: { items: [{ id: 'yoga', name: 'Yoga', icon: 'book-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: ['18:00'], order: 0, createdAt: '2026-10-01T08:00:00.000Z' }], ticks: [], sessions: [] } });
    const fit = fitPending({ planned, office: 6, fixed: 4 });
    expect([...fit.planned].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...planned].sort((a, b) => a.id.localeCompare(b.id)));
    expect(fit).toMatchObject({ office: 6, daily: PENDING_LIMIT - planned.length - 6 });
  });

  it('never goes over 64 in all: a busy week of meal prompts, the office day and breaks every fifteen minutes', () => {
    const six: Routine = { ...routine, slots: ['07:00', '09:00', '11:00', '13:00', '16:00', '19:30'].map((time, i) => slot(`s${i}`, 'snack', time, 10)) };
    const planned = plannedReminders({ ...base, nowMinutes: 0, routine: six, plannedKcal: {}, fillYesterday: true, records: { '2026-10-11': 'partial', '2026-10-12': 'partial' }, report: { monday: '2026-10-19', text: 'x' } });
    const office = 6;
    const fit = pendingFit(planned.length, office);
    const daily = dailyReminders({ ...day, breaks: often, room: fit.daily });
    expect(fit.planned).toBe(planned.length);
    expect(fit.planned + office + daily.length).toBe(PENDING_LIMIT);
    expect(daily.filter((r) => !isLong(r))).toHaveLength(4);
  });
});

describe('Settings: a switch for every reminder', () => {
  it('lists each reminder once, in the order they come in a day and a week, the meal-time prompt first; it, Abhyas and the day so far are on to begin with', () => {
    expect(REMINDER_ROWS.map((r) => r.key).sort()).toEqual(Object.keys(DEFAULT_SETTINGS.reminders).sort());
    expect(REMINDER_ROWS.map((r) => r.key)).toEqual(['mealPrompt', 'abhyas', 'fillYesterday', 'planWeek', 'weeklyReport', 'sleepCheckin', 'water', 'checklist', 'dayReview', 'away']);
    expect(Object.entries(DEFAULT_SETTINGS.reminders).filter(([, on]) => on).map(([k]) => k)).toEqual(['mealPrompt', 'abhyas', 'checklist']);
    // Every switch is a switch; the day so far's times sit beside them.
    expect(Object.values(DEFAULT_SETTINGS.reminders).every((v) => typeof v === 'boolean')).toBe(true);
    expect(DEFAULT_SETTINGS.checklistTimes).toEqual(['20:30']);
    expect(Object.values(DEFAULT_SETTINGS.features)).toEqual([false, false, false]);
  });

  it('names every switch in English, Marathi and Hindi, in plain words', () => {
    const keys = [
      ...REMINDER_ROWS.flatMap((r) => [`rem_${r.name}`, `rem_${r.name}_desc`]),
      'rem_abhyas_min',
      'rem_abhyas_list',
      'rem_checklist_title',
      'rem_checklist_skipped',
      'rem_checklist_times',
      'rem_checklist_time',
      'rem_checklist_add',
      'rem_checklist_remove',
      'rem_web_note',
      'rem_nudges',
      'rem_nudges_desc',
      'features_title',
      'feat_breaks',
      'feat_breaks_desc',
      'feat_mantra',
      'feat_mantra_desc',
      'feat_plates',
      'feat_plates_desc',
      'tour_page',
    ];
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const words = makeT(lang);
      for (const k of keys) {
        expect(words(k), `${lang} ${k}`).not.toBe(k);
        expect(words(k), `${lang} ${k}`).not.toMatch(/[\u0966-\u096F\u2014]|\b(TDEE|BMR|XP)\b/);
        // Marathi and Hindi have words of their own, never the English left in place.
        if (lang !== 'en') expect(words(k), `${lang} ${k}`).not.toBe(makeT('en')(k));
      }
    }
    // The evening review says where it goes, in each language.
    expect(makeT('en')('rem_review_desc')).toContain('opens Today');
    expect(makeT('mr')('rem_review_desc')).toContain('आजचं पान उघडतं');
    expect(makeT('hi')('rem_review_desc')).toContain('आज का पन्ना खोलता है');
  });

  it('says each Settings description in one short line, with no word about tapping', () => {
    const keys = [
      ...REMINDER_ROWS.map((r) => `rem_${r.name}_desc`),
      'rem_web_note',
      'rem_nudges_desc',
      'notify_gap_desc',
      'push_desc',
      'push_privacy',
      'feat_breaks_desc',
      'feat_mantra_desc',
      'feat_plates_desc',
      'break_monitor_desc',
      'brk_fullscreen_desc',
      'brk_gentle_desc',
      'brk_normal_desc',
      'brk_oncall_desc',
      'brk_schedule_desc',
      'brk_sound_desc',
      'brk_strict_desc',
      'sched_desc',
      'sched_phone_note',
      'data_where',
      'diet_hint',
      'plan_free_desc',
      'drive_note',
      'drive_restore_confirm',
      'advanced_desc',
      'local_ai_body',
    ];
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const words = makeT(lang);
      for (const k of keys) {
        expect(words(k), `${lang} ${k}`).not.toBe(k);
        // One sentence: a full stop, if any, only at the end.
        expect(words(k).replace(/[.।]$/, ''), `${lang} ${k}`).not.toMatch(/[.।] /);
        expect(words(k), `${lang} ${k}`).not.toMatch(/\btap\b|टॅप|टैप|दाबा|दबाएँ|दबाएं/i);
      }
    }
    for (const k of keys) expect(makeT('en')(k).length, k).toBeLessThanOrEqual(75);
  });
});

describe('promptDue: one rule for the meal-time prompt, on the phone and in the app', () => {
  // 2026-10-12 is a Monday, 2026-10-18 a Sunday.
  const due = { date: '2026-10-12', slotId: 'lunch', offDays: [] as number[], planned: 600 as number | null | undefined, settled: [] as string[], skips: [] as { id: string; date: string; slotId: string }[] };

  it('asks about a slot with a plan, and about one whose plan is not known', () => {
    expect(promptDue(due)).toBe(true);
    expect(promptDue({ ...due, planned: undefined })).toBe(true);
    // Lines that add up to no calories (black tea) are still a plan.
    expect(promptDue({ ...due, planned: 0 })).toBe(true);
  });

  it('never on a free day', () => {
    expect(promptDue({ ...due, offDays: [1] })).toBe(false);
    expect(promptDue({ ...due, date: '2026-10-18', offDays: [0] })).toBe(false);
    expect(promptDue({ ...due, offDays: [0] })).toBe(true);
  });

  it('never for a slot planned empty', () => {
    expect(promptDue({ ...due, planned: null })).toBe(false);
  });

  it('never on the day the person finished setup', () => {
    expect(promptDue({ ...due, onboardedOn: '2026-10-12' })).toBe(false);
    expect(promptDue({ ...due, onboardedOn: '2026-10-11' })).toBe(true);
  });

  it('never for a slot eaten or skipped, today or skipped ahead', () => {
    expect(promptDue({ ...due, settled: ['lunch'] })).toBe(false);
    expect(promptDue({ ...due, skips: [{ id: skipId('2026-10-12', 'lunch'), date: '2026-10-12', slotId: 'lunch' }] })).toBe(false);
    expect(promptDue({ ...due, skips: [{ id: skipId('2026-10-13', 'lunch'), date: '2026-10-13', slotId: 'lunch' }] })).toBe(true);
  });

  it('reads each slot\'s plan off the day\'s menu: its calories, null for one planned empty', () => {
    const menu: DayMenu = {
      date: '2026-10-12',
      editedAt: '',
      meals: [
        { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
        { id: 'dinner', type: 'dinner', time: '19:30', lines: [] },
      ],
    } as unknown as DayMenu;
    const plans = slotPlans(menu, foodsList);
    expect(plans.dinner).toBeNull();
    expect(plans.lunch).toBeGreaterThan(0);
    expect(Object.keys(plans).sort()).toEqual(['dinner', 'lunch']);
  });
});

describe('officeReminders: the office day on the phone, one per block on each chosen weekday', () => {
  const words = (k: string) => k;
  const office: WorkSchedule = {
    enabled: true,
    days: [3, 1],
    blocks: [
      { id: 'lunch', kind: 'lunch', start: '13:00', end: '13:30' },
      { id: 'start', kind: 'start', start: '09:15' },
      { id: 'bad', kind: 'break', start: 'soon' },
    ],
  };

  it('repeats each block weekly on each day chosen, the weekday as the phone counts it (1 is Sunday)', () => {
    const r = officeReminders({ active: true, schedule: office, t: words });
    expect(r.map((x) => `${x.id} ${x.weekday} ${x.hour}:${x.minute}`)).toEqual([
      'sobat-sched-start@2 2 9:15',
      'sobat-sched-lunch@2 2 13:0',
      'sobat-sched-start@4 4 9:15',
      'sobat-sched-lunch@4 4 13:0',
    ]);
    expect(r[0]).toMatchObject({ title: 'ntf_start', body: 'ntf_start_body' });
    expect(r.every((x) => x.id.startsWith(OFFICE_PREFIX))).toBe(true);
    // Sunday is the phone's 1 and Saturday its 7.
    expect(officeReminders({ active: true, schedule: { ...office, days: [0, 6] }, t: words }).map((x) => x.weekday)).toEqual([1, 1, 7, 7]);
  });

  it('a day switched off stays quiet, and so does every day while the check-ins are off or nobody is signed in', () => {
    expect(officeReminders({ active: true, schedule: { ...office, days: [1] }, t: words }).map((x) => x.weekday)).toEqual([2, 2]);
    expect(officeReminders({ active: true, schedule: { ...office, days: [] }, t: words })).toEqual([]);
    expect(officeReminders({ active: true, schedule: { ...office, enabled: false }, t: words })).toEqual([]);
    expect(officeReminders({ active: false, schedule: office, t: words })).toEqual([]);
    // A day stored twice or out of the week is read once, or not at all.
    expect(officeReminders({ active: true, schedule: { ...office, days: [1, 1, 9, -1] }, t: words }).map((x) => x.weekday)).toEqual([2, 2]);
  });

  it('is off until the person switches the check-ins on', () => {
    expect(DEFAULT_SCHEDULE.enabled).toBe(false);
    expect(EMPTY_STATE.schedule.enabled).toBe(false);
  });
});

describe('reminderOps: the office day joins the one run', () => {
  const NOW = new Date('2026-10-12T12:00:00').getTime();
  const weekly = (id: string, weekday = 2) => ({ id, weekday, hour: 9, minute: 0, title: id, body: '' });

  it('cancels the office reminders no longer wanted, the daily ones older builds left included, before any add', () => {
    const ops = reminderOps({
      have: ['sobat-sched-start', 'sobat-sched-lunch@3', 'sobat-sched-start@2', 'sobat-r-x'],
      planned: null,
      daily: null,
      office: [weekly('sobat-sched-start@2'), weekly('sobat-sched-start@4', 4)],
      nowMs: NOW,
    });
    const kinds = ops.map((o) => o.kind);
    expect(kinds.lastIndexOf('cancel')).toBeLessThan(kinds.findIndex((k) => k !== 'cancel'));
    expect(ops.filter((o) => o.kind === 'cancel').map((o) => o.id).sort()).toEqual(['sobat-sched-lunch@3', 'sobat-sched-start']);
    // The office list is registered whole, as the daily one is.
    expect(ops.filter((o) => o.kind === 'weekly').map((o) => o.kind === 'weekly' && o.reminder.id)).toEqual(['sobat-sched-start@2', 'sobat-sched-start@4']);
  });

  it('a signed-out device cancels every office reminder; an office list not known yet is left as it is', () => {
    expect(reminderOps({ have: ['sobat-sched-start@2', 'sobat-water'], planned: null, daily: null, office: [], nowMs: NOW })).toEqual([{ kind: 'cancel', id: 'sobat-sched-start@2' }]);
    expect(reminderOps({ have: ['sobat-sched-start@2'], planned: null, daily: null, office: null, nowMs: NOW })).toEqual([]);
  });

  it('adds the meal-time prompts first, then the office day, then the daily ones', () => {
    const at = { osId: 'sobat-r-slot', reminder: { id: 'slot', date: '2026-10-13', time: '13:00', title: '', body: '', data: { kind: 'slot' } } };
    const daily = { id: 'sobat-water', hour: 15, minute: 0, title: '', body: '', data: { kind: 'water' as const } };
    const ops = reminderOps({ have: [], planned: [at], daily: [daily], office: [weekly('sobat-sched-start@2')], nowMs: NOW }).filter((o) => o.kind !== 'cancel');
    expect(ops.map((o) => o.kind)).toEqual(['at', 'weekly', 'daily']);
  });

  it('fits the office day under the cap after the planned ones, and the daily ones after both', () => {
    expect(pendingFit(20, 30)).toEqual({ planned: 20, office: 30, daily: 14 });
    expect(pendingFit(20, 50)).toEqual({ planned: 20, office: 44, daily: 0 });
    expect(pendingFit(70, 6)).toEqual({ planned: 64, office: 0, daily: 0 });
  });
});

describe('opList: the list a step to the phone belongs to, so a refused step has its own list tried again', () => {
  const NOW = new Date('2026-10-12T12:00:00').getTime();
  const at = { osId: 'sobat-r-slot', reminder: { id: 'slot', date: '2026-10-13', time: '13:00', title: '', body: '', data: { kind: 'slot' } } };
  const daily = { id: 'sobat-water', hour: 15, minute: 0, title: '', body: '', data: { kind: 'water' as const } };
  const weekly = { id: 'sobat-sched-start@2', weekday: 2, hour: 9, minute: 0, title: '', body: '' };

  it('reads a cancel by its id: the office day\'s ids old and new, the daily ones and the long breaks, the planned ones', () => {
    const cancel = (id: string) => opList({ kind: 'cancel', id });
    expect(cancel('sobat-sched-start@2')).toBe('office');
    // The daily one an older build registered for a block.
    expect(cancel('sobat-sched-start')).toBe('office');
    for (const id of Object.values(DAILY_IDS)) expect(cancel(id)).toBe('daily');
    expect(cancel(LONG_BREAK_ID)).toBe('daily');
    expect(cancel(`${LONG_BREAK_ID}-3`)).toBe('daily');
    expect(cancel('sobat-r-slot@abc')).toBe('planned');
  });

  it('reads an add by its kind', () => {
    expect(opList({ kind: 'at', id: at.osId, reminder: at.reminder })).toBe('planned');
    expect(opList({ kind: 'weekly', reminder: weekly })).toBe('office');
    expect(opList({ kind: 'daily', reminder: daily })).toBe('daily');
  });

  it('puts every step of a run under the list that asked for it', () => {
    const have = ['sobat-r-old', 'sobat-sched-lunch@3', 'sobat-sched-start', 'sobat-water', `${LONG_BREAK_ID}-3`];
    const lists = (input: Partial<Parameters<typeof reminderOps>[0]>) => [...new Set(reminderOps({ have, planned: null, daily: null, office: null, nowMs: NOW, ...input }).map(opList))];
    expect(lists({ planned: [at] })).toEqual(['planned']);
    expect(lists({ office: [weekly] })).toEqual(['office']);
    expect(lists({ daily: [daily] })).toEqual(['daily']);
    expect(lists({ office: [] })).toEqual(['office']);
    expect(lists({ daily: [] })).toEqual(['daily']);
  });
});

describe('a run to the phone: a refused cancel is tried again, and a run with nothing refused settles', () => {
  const NOW = new Date('2026-10-12T12:00:00').getTime();
  const water = { id: 'sobat-water', hour: 15, minute: 0, title: '', body: '', data: { kind: 'water' as const } };
  const at = { osId: 'sobat-r-slot', reminder: { id: 'slot', date: '2026-10-13', time: '13:00', title: '', body: '', data: { kind: 'slot' } } };
  const weekly = { id: 'sobat-sched-start@2', weekday: 2, hour: 9, minute: 0, title: '', body: '' };
  const NONE: HeldLists = { daily: '', office: '' };

  /** A phone holding `held`, which refuses the cancels in `refuse` while they are in it, and refuses to say what it holds while `unread` is set. */
  function fakePhone(held: string[], refuse: Set<string> = new Set()) {
    const sent: ReminderOp[] = [];
    const ids = new Set(held);
    const read = { fails: false };
    const phone: Phone = {
      ids: async () => {
        if (read.fails) throw new Error('unread');
        return [...ids];
      },
      apply: async (op) => {
        sent.push(op);
        if (op.kind === 'cancel') {
          if (refuse.has(op.id)) throw new Error('refused');
          ids.delete(op.id);
        } else ids.add(op.kind === 'at' ? op.id : op.reminder.id);
      },
    };
    return { phone, sent, ids, refuse, read };
  }

  it('never cancels an id the phone does not hold, the daily ones and the long breaks included', () => {
    expect(reminderOps({ have: [], planned: null, daily: [], office: [], nowMs: NOW })).toEqual([]);
    expect(reminderOps({ have: ['sobat-mantra'], planned: [], daily: [], office: [], nowMs: NOW })).toEqual([{ kind: 'cancel', id: 'sobat-mantra' }]);
  });

  it('keeps a list whose cancel was refused unsettled, and the next run sends that cancel again', async () => {
    const p = fakePhone(['sobat-water'], new Set(['sobat-water']));
    // Water switched off: the daily list is now empty, and the phone refuses the cancel.
    const first = await syncReminders({ daily: [], office: null, planned: null, held: NONE, phone: p.phone, nowMs: NOW });
    expect(first.daily).toBe('');
    expect(p.sent).toEqual([{ kind: 'cancel', id: 'sobat-water' }]);
    p.refuse.clear();
    const second = await syncReminders({ daily: [], office: null, planned: null, held: first, phone: p.phone, nowMs: NOW });
    expect(p.sent).toEqual([{ kind: 'cancel', id: 'sobat-water' }, { kind: 'cancel', id: 'sobat-water' }]);
    expect(second.daily).toBe('[]');
    expect(p.ids.has('sobat-water')).toBe(false);
  });

  it('a run that cannot read what the phone holds sends nothing and settles nothing, and the next run does the cancels and settles', async () => {
    // Water switched off and the long breaks gone: the phone still holds both.
    const p = fakePhone(['sobat-water', 'sobat-long-break-0']);
    p.read.fails = true;
    const first = await syncReminders({ daily: [], office: [weekly], planned: [at], held: NONE, phone: p.phone, nowMs: NOW });
    expect(first).toEqual(NONE);
    expect(p.sent).toEqual([]);
    p.read.fails = false;
    const second = await syncReminders({ daily: [], office: [weekly], planned: [at], held: first, phone: p.phone, nowMs: NOW });
    expect(p.sent.filter((o) => o.kind === 'cancel')).toEqual([
      { kind: 'cancel', id: 'sobat-water' },
      { kind: 'cancel', id: 'sobat-long-break-0' },
    ]);
    expect(second).toEqual({ daily: '[]', office: JSON.stringify([weekly]) });
    expect([...p.ids].sort()).toEqual(['sobat-r-slot', 'sobat-sched-start@2']);
  });

  it('a refused office cancel keeps only the office list unsettled', async () => {
    const p = fakePhone(['sobat-sched-lunch@3'], new Set(['sobat-sched-lunch@3']));
    const held = await syncReminders({ daily: [water], office: [weekly], planned: null, held: NONE, phone: p.phone, nowMs: NOW });
    expect(held).toEqual({ daily: JSON.stringify([water]), office: '' });
  });

  it('settles: a second run with the same lists sends nothing', async () => {
    const p = fakePhone(['sobat-r-old']);
    const lists = { daily: [water], office: [weekly], planned: [at] };
    const held = await syncReminders({ ...lists, held: NONE, phone: p.phone, nowMs: NOW });
    expect(p.sent.map((o) => o.kind)).toEqual(['cancel', 'at', 'weekly', 'daily']);
    const n = p.sent.length;
    const again = await syncReminders({ ...lists, held, phone: p.phone, nowMs: NOW });
    expect(p.sent).toHaveLength(n);
    expect(again).toEqual(held);
  });
});

describe('dailyReminders: quiet hours', () => {
  const day = { active: true, sleepCheckin: true, water: true, dayReview: true, quietStartHour: 22, quietEndHour: 7, mantra: 'Steady.', breaks: { ...DEFAULT_BREAK_SETTINGS, enabled: false }, nowMs: 0, t };

  it('drops a fixed reminder whose hour falls in quiet hours', () => {
    // Quiet from nine at night to eight in the morning: the 07:30 check-in and the 21:30 review fall in it.
    expect(dailyReminders({ ...day, quietStartHour: 21, quietEndHour: 8 }).map((r) => r.id)).toEqual(['sobat-mantra', 'sobat-water']);
    // Quiet through the afternoon, a window that does not wrap midnight.
    expect(dailyReminders({ ...day, quietStartHour: 14, quietEndHour: 16 }).map((r) => r.id)).toEqual(['sobat-sleep-checkin', 'sobat-mantra', 'sobat-day-review']);
    // No quiet hours at all keeps all four.
    expect(dailyReminders({ ...day, quietStartHour: 0, quietEndHour: 0 })).toHaveLength(4);
  });
});
